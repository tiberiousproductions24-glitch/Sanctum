// MIDI for Sanctum. Two backends with one API:
//  • web    — Web MIDI (Chrome/Edge desktop + Android Chrome; not iOS Safari, not Android WebView)
//  • native — SanctumMidi Capacitor plugin on android.media.midi: USB host devices, Bluetooth LE MIDI,
//             and the phone as a USB MIDI peripheral (Android USB mode "MIDI").
// Features: clock out (24 PPQN + Start/Stop/Continue, scheduled ahead) and clock in (tempo follow),
// note in → pads (omni; 36–51 = pads 1–16), note out (pads → DAW), CC in/out with a learnable map.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface MidiPort { id: string; name: string; type?: string; open?: boolean }
export interface MidiStatus { supported: boolean; backend: 'web' | 'native' | 'none'; enabled: boolean; error?: string; inputs: MidiPort[]; outputs: MidiPort[]; clockInBpm: number | null; lastIn?: string; ble: { address: string; name: string }[]; scanning: boolean; usbPeripheral?: boolean }
export type CcTarget = 'master' | 'swing' | 'padLevel' | 'padTune' | 'tempo';
export const CC_TARGETS: { v: CcTarget; label: string }[] = [
  { v: 'master', label: 'Main volume' }, { v: 'swing', label: 'Swing' }, { v: 'padLevel', label: 'Pad level (selected pad)' }, { v: 'padTune', label: 'Pad tune (selected pad)' }, { v: 'tempo', label: 'Tempo (60–187)' }];
export const DEFAULT_CC_MAP: Record<string, CcTarget> = { '7': 'master', '9': 'swing', '71': 'padLevel', '74': 'padTune' };

interface NativeMidiPlugin {
  isSupported(): Promise<{ supported: boolean; bluetooth: boolean; usbPeripheral: boolean; sdk: number }>;
  listDevices(): Promise<{ devices: { id: number; name: string; manufacturer: string; type: string; inputs: number; outputs: number; open: boolean }[] }>;
  openDevice(o: { id: number }): Promise<unknown>;
  closeDevice(o: { id: number }): Promise<void>;
  send(o: { messages: { data: number[]; delayMs?: number }[]; id?: number }): Promise<void>;
  flush(): Promise<void>;
  startBleScan(o: { timeoutMs?: number }): Promise<void>;
  stopBleScan(): Promise<void>;
  connectBle(o: { address: string }): Promise<unknown>;
  addListener(ev: 'midiMessage', f: (e: { id: number; data: number[]; ageMs: number }) => void): Promise<PluginListenerHandle>;
  addListener(ev: 'devicesChanged', f: (e: any) => void): Promise<PluginListenerHandle>;
  addListener(ev: 'bleDevice', f: (e: { address: string; name: string }) => void): Promise<PluginListenerHandle>;
}
const NativeMidi = registerPlugin<NativeMidiPlugin>('SanctumMidi');
const NATIVE = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export class Midi {
  access: MIDIAccess | null = null;
  status: MidiStatus = { supported: NATIVE || (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator), backend: NATIVE ? 'native' : (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator) ? 'web' : 'none', enabled: false, inputs: [], outputs: [], clockInBpm: null, ble: [], scanning: false };
  onStatus?: (s: MidiStatus) => void;
  onNote?: (note: number, vel: number, on: boolean, ts: number) => void;
  onCC?: (cc: number, value: number, ch: number) => void;
  onClockIn?: (bpm: number) => void;
  onStart?: () => void; onStop?: () => void; onContinue?: () => void;
  outId = ''; inId = '';
  clockIn = false;
  private ticks: number[] = [];
  private nativeQ: { data: number[]; delayMs?: number }[] = [];
  private nativeFlush = false;

  async enable() {
    if (NATIVE) return this.enableNative();
    if (!this.status.supported) { this.status.error = 'MIDI isn\'t available in this browser. Use Chrome or Edge, or the Sanctum Android app.'; this.onStatus?.(this.status); return; }
    if (!window.isSecureContext) { this.status.error = 'Web MIDI needs a secure context (https:// or localhost). Run "npm run dev:https".'; this.onStatus?.(this.status); return; }
    if (this.access) { this.refresh(); return; }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.status.enabled = true; this.status.error = undefined;
      this.access.onstatechange = () => this.refresh();
      this.refresh();
    } catch (e) { this.status.error = 'MIDI permission denied or failed: ' + (e as Error).message; this.onStatus?.(this.status); }
  }

  // ---------- native (android.media.midi) ----------
  private nativeListening = false;
  private async enableNative() {
    try {
      const sup = await NativeMidi.isSupported();
      this.status.usbPeripheral = sup.usbPeripheral;
      if (!sup.supported) { this.status.supported = false; this.status.error = 'This device has no MIDI support (android.software.midi missing).'; this.onStatus?.(this.status); return; }
      if (!this.nativeListening) {
        this.nativeListening = true;
        await NativeMidi.addListener('midiMessage', (e) => { if (this.inId && String(e.id) !== this.inId) return; this.parse(e.data, performance.now() - (e.ageMs || 0)); });
        await NativeMidi.addListener('devicesChanged', () => this.refreshNative(true));
        await NativeMidi.addListener('bleDevice', (d) => { if (!this.status.ble.some((b) => b.address === d.address)) { this.status.ble.push(d); this.onStatus?.(this.status); } });
      }
      this.status.enabled = true; this.status.error = undefined;
      await this.refreshNative(true);
    } catch (e) { this.status.error = 'MIDI failed: ' + (e as Error).message; this.onStatus?.(this.status); }
  }
  private async refreshNative(autoOpen: boolean) {
    const { devices } = await NativeMidi.listDevices();
    if (autoOpen) for (const d of devices) if (!d.open) { try { await NativeMidi.openDevice({ id: d.id }); d.open = true; } catch {} }
    const name = (d: typeof devices[number]) => `${d.name}${d.type === 'bluetooth' ? ' (Bluetooth)' : d.type === 'usb' ? ' (USB)' : ''}`;
    this.status.inputs = devices.filter((d) => d.outputs > 0).map((d) => ({ id: String(d.id), name: name(d), type: d.type, open: d.open }));
    this.status.outputs = devices.filter((d) => d.inputs > 0).map((d) => ({ id: String(d.id), name: name(d), type: d.type, open: d.open }));
    this.onStatus?.(this.status);
  }
  async scanBle() {
    if (!NATIVE) return;
    if (!this.status.enabled) await this.enableNative();
    this.status.ble = []; this.status.scanning = true; this.onStatus?.(this.status);
    try { await NativeMidi.startBleScan({ timeoutMs: 15000 }); setTimeout(() => { this.status.scanning = false; this.onStatus?.(this.status); }, 15000); }
    catch (e) { this.status.scanning = false; this.status.error = 'Bluetooth: ' + (e as Error).message; this.onStatus?.(this.status); }
  }
  async connectBle(address: string) {
    try { await NativeMidi.stopBleScan(); await NativeMidi.connectBle({ address }); this.status.scanning = false; await this.refreshNative(false); }
    catch (e) { this.status.error = 'Bluetooth connect failed: ' + (e as Error).message; this.onStatus?.(this.status); }
  }
  get isNative() { return NATIVE; }

  // ---------- web ----------
  refresh() {
    if (NATIVE) { this.refreshNative(true); return; }
    if (!this.access) return;
    this.status.inputs = [...this.access.inputs.values()].map((i) => ({ id: i.id, name: i.name || i.id }));
    this.status.outputs = [...this.access.outputs.values()].map((o) => ({ id: o.id, name: o.name || o.id }));
    for (const i of this.access.inputs.values()) i.onmidimessage = (e) => { if (this.inId && i.id !== this.inId) return; if (e.data) this.parse(Array.from(e.data), e.timeStamp); };
    this.onStatus?.(this.status);
  }
  private webOutputs(): MIDIOutput[] {
    if (!this.access) return [];
    const all = [...this.access.outputs.values()];
    return this.outId ? all.filter((o) => o.id === this.outId) : all;
  }

  // ---------- output ----------
  /** perfT: performance.now() ms timestamp (future = scheduled). */
  send(data: number[], perfT?: number) {
    if (!this.status.enabled) return;
    if (NATIVE) {
      this.nativeQ.push({ data, delayMs: perfT == null ? 0 : perfT - performance.now() });
      if (!this.nativeFlush) { this.nativeFlush = true; queueMicrotask(() => { this.nativeFlush = false; const m = this.nativeQ; this.nativeQ = []; NativeMidi.send({ messages: m, ...(this.outId ? { id: Number(this.outId) } : {}) }).catch(() => {}); }); }
      return;
    }
    for (const o of this.webOutputs()) o.send(data, perfT);
  }
  sendClock(perfTimes: number[]) { for (const t of perfTimes) this.send([0xf8], t); }
  sendStart(t?: number) { this.send([0xfa], t); }
  sendContinue(t?: number) { this.send([0xfb], t); }
  sendStop(t?: number) { if (NATIVE && this.status.enabled) NativeMidi.flush().catch(() => {}); this.send([0xfc], t); }
  sendNoteOn(note: number, vel: number, t?: number, ch = 9) { this.send([0x90 | ch, note & 127, Math.max(1, Math.min(127, vel | 0))], t); }
  sendNoteOff(note: number, t?: number, ch = 9) { this.send([0x80 | ch, note & 127, 0], t); }
  sendNote(note: number, vel: number, t?: number, ch = 9, lenMs = 60) { this.sendNoteOn(note, vel, t, ch); this.sendNoteOff(note, (t ?? performance.now()) + lenMs, ch); }
  sendCC(cc: number, value: number, ch = 9) { this.send([0xb0 | ch, cc & 127, Math.max(0, Math.min(127, Math.round(value)))]); }

  // ---------- input ----------
  private running = 0;
  /** Parses a byte stream (may hold several messages, running status, interleaved realtime bytes). */
  parse(bytes: number[], ts: number) {
    let i = 0;
    while (i < bytes.length) {
      let s = bytes[i];
      if (s >= 0xf8) { this.realtime(s, ts); i++; continue; }
      if (s & 0x80) { i++; if (s < 0xf0) this.running = s; else { this.running = 0; i += s === 0xf2 ? 2 : s === 0xf3 || s === 0xf1 ? 1 : 0; if (s === 0xf0) while (i < bytes.length && bytes[i] !== 0xf7) i++; continue; } }
      else s = this.running;
      if (!s) { i++; continue; }
      const type = s & 0xf0; const n = type === 0xc0 || type === 0xd0 ? 1 : 2;
      const d = bytes.slice(i, i + n); i += n;
      if (d.length < n) break;
      this.channel(s, d, ts);
    }
  }
  private realtime(s: number, ts: number) {
    if (s === 0xf8) {
      if (!this.clockIn) return;
      this.ticks.push(ts); if (this.ticks.length > 49) this.ticks.shift();
      if (this.ticks.length >= 25) {
        const span = this.ticks[this.ticks.length - 1] - this.ticks[0];
        const bpm = 60000 / (span / (this.ticks.length - 1) * 24);
        if (bpm > 20 && bpm < 400) {
          const prev = this.status.clockInBpm;
          if (prev == null || Math.abs(prev - bpm) > 0.05) { this.status.clockInBpm = Math.round(bpm * 100) / 100; this.onClockIn?.(this.status.clockInBpm); this.onStatus?.(this.status); }
        }
      }
    } else if (s === 0xfa) { if (this.clockIn) { this.ticks = []; this.onStart?.(); } }
    else if (s === 0xfb) { if (this.clockIn) this.onContinue?.(); }
    else if (s === 0xfc) { if (this.clockIn) this.onStop?.(); }
  }
  private channel(s: number, d: number[], ts: number) {
    const type = s & 0xf0; const ch = s & 15;
    if (type === 0x90 || type === 0x80) {
      const on = type === 0x90 && d[1] > 0;
      this.status.lastIn = `${on ? 'Note on' : 'Note off'} ${d[0]} · velocity ${d[1]} · channel ${ch + 1}`;
      this.onNote?.(d[0], d[1], on, ts); this.onStatus?.(this.status);
    } else if (type === 0xb0) {
      this.status.lastIn = `CC ${d[0]} = ${d[1]} · channel ${ch + 1}`;
      this.onCC?.(d[0], d[1], ch); this.onStatus?.(this.status);
    }
  }
}
