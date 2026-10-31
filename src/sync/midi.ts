// Web MIDI: clock out (24 PPQN + Start/Stop, timestamped ahead), clock in (tempo follow + start/stop),
// and omni note input to pads. Graceful fallback when the browser has no Web MIDI (e.g. iOS Safari).
export interface MidiStatus { supported: boolean; enabled: boolean; error?: string; inputs: { id: string; name: string }[]; outputs: { id: string; name: string }[]; clockInBpm: number | null; lastIn?: string }

export class Midi {
  access: MIDIAccess | null = null;
  status: MidiStatus = { supported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator, enabled: false, inputs: [], outputs: [], clockInBpm: null };
  onStatus?: (s: MidiStatus) => void;
  onNote?: (note: number, vel: number, on: boolean, ts: number) => void;
  onClockIn?: (bpm: number) => void;
  onStart?: () => void; onStop?: () => void; onContinue?: () => void;
  outId = ''; inId = '';
  clockIn = false;
  private ticks: number[] = [];

  async enable() {
    if (!this.status.supported) { this.status.error = 'Web MIDI is not available in this browser (iOS/iPadOS Safari has none). Use Chrome/Edge on Android, desktop, or a Chromebook; native builds will use CoreMIDI / android.media.midi.'; this.onStatus?.(this.status); return; }
    if (!window.isSecureContext) { this.status.error = 'Web MIDI needs a secure context (https:// or localhost). Run "npm run dev:https".'; this.onStatus?.(this.status); return; }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.status.enabled = true; this.status.error = undefined;
      this.access.onstatechange = () => this.refresh();
      this.refresh();
    } catch (e) { this.status.error = 'MIDI permission denied or failed: ' + (e as Error).message; this.onStatus?.(this.status); }
  }

  refresh() {
    if (!this.access) return;
    this.status.inputs = [...this.access.inputs.values()].map((i) => ({ id: i.id, name: i.name || i.id }));
    this.status.outputs = [...this.access.outputs.values()].map((o) => ({ id: o.id, name: o.name || o.id }));
    for (const i of this.access.inputs.values()) i.onmidimessage = (e) => this.onMessage(e, i.id);
    this.onStatus?.(this.status);
  }

  private outputs(): MIDIOutput[] {
    if (!this.access) return [];
    const all = [...this.access.outputs.values()];
    return this.outId ? all.filter((o) => o.id === this.outId) : all;
  }

  /** times in performance.now() ms. Web MIDI schedules them precisely (host timestamps). */
  sendClock(perfTimes: number[]) { for (const o of this.outputs()) for (const t of perfTimes) o.send([0xf8], t); }
  sendStart(t?: number) { for (const o of this.outputs()) o.send([0xfa], t); }
  sendStop(t?: number) { for (const o of this.outputs()) o.send([0xfc], t); }
  sendNote(note: number, vel: number, t?: number, ch = 9) { for (const o of this.outputs()) { o.send([0x90 | ch, note, vel], t); o.send([0x80 | ch, note, 0], (t ?? performance.now()) + 50); } }

  private onMessage(e: MIDIMessageEvent, id: string) {
    if (this.inId && id !== this.inId) return;
    const d = e.data; if (!d || !d.length) return;
    const s = d[0];
    if (s === 0xf8) {
      if (!this.clockIn) return;
      this.ticks.push(e.timeStamp); if (this.ticks.length > 49) this.ticks.shift();
      if (this.ticks.length >= 25) {
        const span = this.ticks[this.ticks.length - 1] - this.ticks[0];
        const bpm = 60000 / (span / (this.ticks.length - 1) * 24);
        if (bpm > 20 && bpm < 400) {
          const prev = this.status.clockInBpm;
          if (prev == null || Math.abs(prev - bpm) > 0.05) { this.status.clockInBpm = Math.round(bpm * 100) / 100; this.onClockIn?.(this.status.clockInBpm); this.onStatus?.(this.status); }
        }
      }
      return;
    }
    if (s === 0xfa) { if (this.clockIn) { this.ticks = []; this.onStart?.(); } return; }
    if (s === 0xfb) { if (this.clockIn) this.onContinue?.(); return; }
    if (s === 0xfc) { if (this.clockIn) this.onStop?.(); return; }
    const type = s & 0xf0;
    if (type === 0x90 || type === 0x80) { // omni: any channel
      const on = type === 0x90 && d[2] > 0;
      this.status.lastIn = `${on ? 'Note On' : 'Note Off'} ${d[1]} vel ${d[2]} ch ${(s & 15) + 1}`;
      this.onNote?.(d[1], d[2], on, e.timeStamp); this.onStatus?.(this.status);
    }
  }
}
