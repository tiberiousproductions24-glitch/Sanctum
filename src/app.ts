// Sanctum application core: wires engine, sequencer, sounds, Link, MIDI, autosave.
import { Engine } from './audio/engine';
import { GENERATORS } from './audio/synth';
import { BUILTIN_BANKS, COMING_SOON, METRONOME, loadManifestBanks, type SoundBank, type SoundDef } from './audio/kits';
import { Sequencer } from './seq/transport';
import { LinkClient } from './sync/link';
import { Midi, type CcTarget } from './sync/midi';
import { loadProject, saveProject, PPQ, QUANT_TICKS, type Project, type NoteEvent } from './state';
import { toast } from './ui/dom';
import { hitHaptic } from './native';
import type { LicensePayload } from './license/token';
import type { LicenseState } from './license/license';

export interface LoopState { sound: SoundDef; at: number; startBeat: number }
export interface LatencyReport {
  os: 'iOS' | 'Android' | 'Desktop'; device: 'phone' | 'tablet';
  baseMs: number; outputMs: number; quantumMs: number; touchMs: number; touchMeasured: boolean;
  touchToSoundMs: number; midiToSoundMs: number; roundTripMs: number | null;
  t2s: { target: number; ceiling: number }; rt: { target: number; ceiling: number }; midi: { target: number; ceiling: number };
  t2sStatus: Status; rtStatus: Status | 'n/a'; midiStatus: Status; stageCertified: boolean; btSuspect: boolean;
}
export type Status = 'ok' | 'warn' | 'bad';

const ua = navigator.userAgent;
export const IS_IOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
export const IS_ANDROID = /Android/.test(ua);

export class App {
  p: Project; restored: boolean;
  license!: LicensePayload; licenseState!: LicenseState;
  get isAdmin() { return this.license?.type === 'admin'; }
  engine = new Engine();
  seq: Sequencer;
  link: LinkClient;
  midi = new Midi();
  sounds = new Map<string, SoundDef>();
  banks: SoundBank[] = [...BUILTIN_BANKS];
  extBanks: SoundBank[] = [];
  comingSoon = COMING_SOON;
  bankLoad = new Map<string, 'loading' | 'ready' | 'error'>();
  loops = new Map<number, LoopState>();
  started = false;
  fullLevel = false; sixteenLevels = false; editMode = false;
  listeners = new Set<(what: string) => void>();
  // view hooks (set by View)
  flash: (pad16: number, vel: number, x?: number, y?: number) => void = () => {};
  scheduleFlash: (globalPad: number, vel: number, perfMs: number) => void = () => {};
  private warned = '';
  fromMidi = false;
  midiLearn: CcTarget | null = null;
  pulpit: any = null; // set by View (PulpitUI)

  constructor() {
    const { project, restored } = loadProject();
    this.p = project; this.restored = restored;
    for (const b of this.banks) for (const s of b.sounds) if (s) this.sounds.set(s.id, s);
    this.sounds.set(METRONOME.hi.id, METRONOME.hi); this.sounds.set(METRONOME.lo.id, METRONOME.lo);
    if (!restored) { this.assignBank(0, 'foundation', false); this.assignBank(1, 'stagefx', false); }
    this.seq = new Sequencer(this.engine, () => this.p, {
      voice: (pad, vel, at, src) => this.voice(pad, vel, at, src),
      click: (accent, at) => this.engine.trigger({ at, id: accent ? METRONOME.hi.id : METRONOME.lo.id, vel: accent ? 0.9 : 0.6 }),
      midiClock: (times) => this.midi.sendClock(times.map((t) => this.engine.ctxToPerf(t) + this.p.settings.midiClockOffsetMs)),
      onTransport: () => this.emit('transport'),
      onRecorded: () => { this.save(); this.emit('pattern'); },
      isLoopPad: (pad) => this.soundOf(pad)?.kind === 'loop',
    });
    this.seq.noteRepeat = false;
    this.link = new LinkClient(this.engine, this.seq.clock, () => this.p.settings.linkUrl);
    let linkWasPlaying = false;
    this.link.onState = (st) => {
      // Link start/stop sync: follow other peers' transport (start lands on the next quantum)
      if (this.p.settings.linkEnabled && st.connected && st.playing !== linkWasPlaying) {
        linkWasPlaying = st.playing;
        if (st.playing && !this.seq.playing && this.started) this.play();
        else if (!st.playing && this.seq.playing) this.stop();
      }
      this.emit('link');
    };
    this.link.onTempo = (bpm) => { this.p.bpm = Math.round(bpm * 100) / 100; this.updateLoopRates(); this.save(); this.emit('tempo'); };
    this.engine.onStats = () => this.emit('stats');
    this.engine.onRecreate.push((changed) => { if (changed) this.regenerateSynth(); });
    this.midi.clockIn = this.p.settings.midiClockIn;
    this.midi.outId = this.p.settings.midiOutId; this.midi.inId = this.p.settings.midiInId;
    this.midi.onStatus = () => this.emit('midi');
    this.midi.onClockIn = (bpm) => { if (!this.p.settings.linkEnabled) this.setTempo(bpm, true); };
    this.midi.onStart = () => { this.seq.stop(); this.play(); };
    this.midi.onContinue = () => this.play();
    this.midi.onStop = () => this.stop();
    this.midi.onNote = (note, vel, on, ts) => {
      if (!this.p.settings.midiNotesIn) return;
      const pad16 = note >= 36 && note <= 51 ? note - 36 : ((note % 16) + 16) % 16;
      this.fromMidi = true;
      try { if (on) this.padDown(pad16, vel, ts, 5000 + note, undefined, undefined, 'midi'); else this.padUp(5000 + note); } finally { this.fromMidi = false; }
    };
    this.midi.onCC = (cc, val) => {
      if (this.midiLearn) { const t = this.midiLearn; for (const k of Object.keys(this.p.settings.ccMap)) if (this.p.settings.ccMap[k] === t) delete this.p.settings.ccMap[k]; this.p.settings.ccMap[String(cc)] = t; this.midiLearn = null; this.save(); toast(`CC ${cc} now controls ${t}`); this.emit('midi'); return; }
      const t = this.p.settings.ccMap[String(cc)] as CcTarget | undefined; if (t) this.applyCC(t, val / 127, true);
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveProject(this.p, true); });
    window.addEventListener('pagehide', () => saveProject(this.p, true));
  }

  on(fn: (what: string) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(what: string) { for (const l of this.listeners) l(what); }
  save() { saveProject(this.p); }

  // ---------- startup ----------
  async start() {
    if (this.started) { await this.engine.resume(); return; }
    this.started = true;
    await this.engine.init(this.p.settings.latencyHint || 'interactive');
    await this.engine.resume();
    this.engine.setMaster(this.p.settings.master);
    this.seq.clock.bpm = this.p.bpm;
    this.generateSynth();
    this.seq.startTimer();
    if (this.p.settings.linkEnabled) this.setLink(true);
    if (this.p.settings.midiClockOut || this.p.settings.midiClockIn || this.p.settings.midiNotesOut || this.midi.isNative) this.midi.enable();
    this.emit('started');
    this.loadExternal();
    // ensure every assigned bank is loaded
    for (const id of new Set(this.p.bankSources)) if (id) this.ensureBankLoaded(id);
  }

  private generateSynth() {
    const sr = this.engine.sampleRate;
    for (const s of this.sounds.values()) if (s.gen && !this.engine.has(s.id)) {
      const g = GENERATORS[s.gen]; if (g) this.engine.register(s.id, g(sr, s.params || {}), sr);
    }
  }
  private regenerateSynth() {
    for (const s of this.sounds.values()) if (s.gen) this.engine.samples.delete(s.id);
    this.generateSynth();
  }

  async loadExternal() {
    const ext = await loadManifestBanks('content/church-banks/manifest.json');
    if (!ext.length) return;
    this.extBanks = ext;
    for (const b of ext) { this.banks.push(b); for (const s of b.sounds) if (s) this.sounds.set(s.id, s); }
    // First run (or banks C–F still empty): drop the church shout banks into C–F.
    ext.slice(0, 4).forEach((b, i) => { const slot = 2 + i; if (!this.p.bankSources[slot]) this.assignBank(slot, b.id, false); });
    for (const id of new Set(this.p.bankSources)) if (id) this.ensureBankLoaded(id);
    this.save();
    this.emit('banks');
  }

  bank(id: string | null) { return id ? this.banks.find((b) => b.id === id) : undefined; }

  assignBank(slot: number, bankId: string, load = true) {
    const b = this.bank(bankId); if (!b || b.status === 'coming-soon') return;
    this.p.bankSources[slot] = bankId;
    for (let i = 0; i < 16; i++) { const pad = this.p.pads[slot * 16 + i]; pad.sound = b.sounds[i]?.id ?? null; pad.tune = 0; pad.gain = 1; pad.pan = 0; pad.mute = false; }
    if (load) this.ensureBankLoaded(bankId);
    this.save(); this.emit('banks');
  }

  async ensureBankLoaded(bankId: string) {
    const b = this.bank(bankId); if (!b || b.status !== 'external' || !this.engine.ctx) return;
    if (this.bankLoad.get(bankId)) return;
    this.bankLoad.set(bankId, 'loading'); this.emit('banks');
    let fails = 0;
    await Promise.all(b.sounds.map(async (s) => { if (s && !this.engine.has(s.id)) { try { await this.loadFileSound(s); } catch (e) { fails++; console.warn('load failed', s.id, e); } } }));
    this.bankLoad.set(bankId, fails ? 'error' : 'ready');
    if (fails) toast(`${b.name}: ${fails} sound(s) failed to load`);
    this.emit('banks');
  }

  private async loadFileSound(s: SoundDef) {
    const tryUrl = async (url: string) => {
      const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`);
      const ch = await this.engine.decode(await r.arrayBuffer());
      return ch;
    };
    let ch: Float32Array[] | null = null;
    const sr = this.engine.sampleRate;
    const expected = s.samples && s.fileSampleRate ? Math.round(s.samples * sr / s.fileSampleRate) : 0;
    try { ch = await tryUrl(s.file!); } catch (e) { if (!s.fallbackFile) throw e; }
    if (ch && expected && s.kind === 'loop' && Math.abs(ch[0].length - expected) > expected * 0.01 && s.fallbackFile) ch = null; // decoder padding → use WAV master
    if (!ch && s.fallbackFile) ch = await tryUrl(s.fallbackFile);
    if (!ch) throw new Error('no audio');
    if (expected && s.kind === 'loop') ch = ch.map((c) => { const o = new Float32Array(expected); o.set(c.subarray(0, expected)); return o; }); // exact loop length
    this.engine.register(s.id, ch, sr);
  }

  // ---------- pads ----------
  soundOf(globalPad: number) { const id = this.p.pads[globalPad]?.sound; return id ? this.sounds.get(id) : undefined; }
  velGain(vel: number) { return Math.pow(Math.max(1, Math.min(127, vel)) / 127, this.p.settings.velocityCurve); }
  setVelocityPreset(preset: 'soft' | 'linear' | 'hard' | 'fixed-curve') {
    const map = { soft: 0.7, linear: 1.0, hard: 1.6, 'fixed-curve': 2.4 } as const;
    this.p.settings.velocityPreset = preset;
    this.p.settings.velocityCurve = map[preset];
    this.save(); this.emit('settings');
  }

  padDown(pad16: number, vel: number, perfMs: number, pointerId: number, x?: number, y?: number, src: 'touch' | 'midi' | 'key' = 'touch') {
    if (!this.started) this.start();
    else this.engine.resume();
    let global = this.p.currentBank * 16 + pad16;
    if (this.sixteenLevels) { global = this.p.selectedPad; vel = Math.round((pad16 + 1) * 127 / 16); }
    else if (this.fullLevel) vel = 127;
    else if (this.p.settings.velocityMode === 'fixed' && src === 'touch') vel = this.p.settings.fixedVelocity;
    if (!this.sixteenLevels && this.p.selectedPad !== global) { this.p.selectedPad = global; this.emit('select'); }
    this.flash(pad16, vel, x, y); // pre-light: visual on raw touch-down, same frame, never waits for audio
    const s = this.soundOf(global);
    if (!s) return;
    if (s.kind === 'loop') { this.toggleLoop(global); if (this.p.settings.haptics && src === 'touch') hitHaptic(vel); return; }
    this.voice(global, vel, 0, 'live');
    if (this.p.settings.haptics && src === 'touch') hitHaptic(vel); // after the voice is queued: never delays audio
    const comp = src === 'midi' ? 0 : undefined;
    this.recordHit(global, vel, perfMs, comp);
    if (this.seq.noteRepeat) this.seq.holdStart(pointerId, global, vel);
  }
  padPressure(pointerId: number, vel: number) { this.seq.holdUpdate(pointerId, vel); }
  padUp(pointerId: number) { this.seq.holdEnd(pointerId); }

  private recordHit(global: number, vel: number, perfMs: number, compOverride?: number) {
    if (compOverride != null) { const keep = this.p.settings.touchCompMs; this.p.settings.touchCompMs = compOverride; this.seq.recordHit(global, vel, perfMs); this.p.settings.touchCompMs = keep; }
    else this.seq.recordHit(global, vel, perfMs);
  }

  voice(global: number, vel: number, at: number, src: 'live' | 'seq' | 'repeat') {
    const slot = this.p.pads[global]; if (!slot || slot.mute) return;
    const s = this.soundOf(global); if (!s) return;
    if (s.kind === 'loop') { if (src !== 'live') this.startLoop(global, at || this.engine.now); return; }
    const bank = Math.floor(global / 16);
    this.engine.trigger({ at, id: s.id, vel: this.velGain(vel), gain: slot.gain, pan: slot.pan, rate: Math.pow(2, slot.tune / 12),
      choke: s.choke ? `${bank}:${s.choke}` : undefined, key: 'p' + global, decay: slot.decay > 0 ? slot.decay : undefined });
    if (this.p.settings.midiNotesOut && !this.fromMidi) this.midi.sendNote(36 + (global % 16), vel, at ? this.engine.ctxToPerf(at) + this.p.settings.midiClockOffsetMs : undefined, (this.p.settings.midiChannel - 1) & 15);
    if (src !== 'live') this.scheduleFlash(global, vel, this.engine.ctxToPerf(at) - this.p.settings.preLightMs);
  }

  // ---------- MIDI CC (in + out) ----------
  /** v01: 0..1. fromMidi=true: came in from a controller/DAW (don't echo it back). */
  applyCC(t: CcTarget, v01: number, fromMidi = false) {
    const p = this.p; const pad = p.pads[p.selectedPad];
    if (t === 'master') { p.settings.master = v01; this.engine.setMaster(v01); }
    else if (t === 'swing') p.swing = Math.round(50 + v01 * 25);
    else if (t === 'padLevel') pad.gain = Math.round(v01 * 150) / 100;
    else if (t === 'padTune') pad.tune = Math.round(v01 * 24 - 12); if (this.loops.has(p.selectedPad)) this.updateLoopRates();
    else if (t === 'tempo') { this.setTempo(Math.round(60 + v01 * 127)); }
    this.save(); this.emit(fromMidi ? 'cc' : 'cc-local');
    if (!fromMidi) this.ccOut(t);
  }
  /** Send the current value of a mapped target out as CC (UI change → DAW). */
  ccOut(t: CcTarget) {
    if (!this.p.settings.ccOut || !this.midi.status.enabled) return;
    const cc = Object.keys(this.p.settings.ccMap).find((k) => this.p.settings.ccMap[k] === t); if (cc == null) return;
    const p = this.p; const pad = p.pads[p.selectedPad];
    const v = t === 'master' ? p.settings.master : t === 'swing' ? (p.swing - 50) / 25 : t === 'padLevel' ? pad.gain / 1.5 : t === 'padTune' ? (pad.tune + 12) / 24 : (p.bpm - 60) / 127;
    this.midi.sendCC(Number(cc), Math.max(0, Math.min(1, v)) * 127, (p.settings.midiChannel - 1) & 15);
  }

  // ---------- loops (tempo-synced, bar-quantized, choke groups) ----------
  toggleLoop(global: number) {
    if (this.loops.has(global)) {
      const at = this.seq.nextLaunchTime(this.p.settings.loopLaunch);
      this.engine.stop({ key: 'L' + global, at });
      this.loops.delete(global);
      this.emit('loops');
      return;
    }
    const s = this.soundOf(global)!;
    if (!this.engine.has(s.id)) { toast('Loading…'); return; }
    if (!this.loops.size && !this.seq.playing && !this.p.settings.linkEnabled && s.bpm && Math.abs(s.bpm - this.p.bpm) > 0.01) {
      this.setTempo(s.bpm); toast(`Tempo → ${s.bpm} BPM to match ${s.key ? s.key + ' ' : ''}loops`);
    }
    const at = this.seq.nextLaunchTime(this.p.settings.loopLaunch);
    this.startLoop(global, at);
  }

  startLoop(global: number, at: number) {
    const s = this.soundOf(global); if (!s || !this.engine.has(s.id)) return;
    const slot = this.p.pads[global]; const bank = Math.floor(global / 16);
    const choke = s.choke ? `loop:${bank}:${s.choke}` : undefined;
    if (choke) for (const [g, l] of this.loops) if (g !== global && l.sound.choke === s.choke && Math.floor(g / 16) === bank) this.loops.delete(g);
    this.engine.trigger({ at, id: s.id, vel: this.velGain(110), gain: slot.gain, pan: slot.pan, rate: this.loopRate(s, slot.tune), loop: true, choke, key: 'L' + global, mono: true });
    this.loops.set(global, { sound: s, at, startBeat: this.seq.clock.beatAt(at) });
    this.emit('loops');
  }
  loopRate(s: SoundDef, tune = 0) {
    if (!s.bpm) return Math.pow(2, tune / 12);
    // exact: one loop cycle must last beats*60/projectBpm seconds, regardless of resampling rounding
    const smp = this.engine.samples.get(s.id); const beats = s.beats || (s.bars ? s.bars * 4 : 0);
    const lenSec = smp ? smp.ch[0].length / smp.sr : 0;
    const fix = smp && beats ? lenSec / (beats * 60 / s.bpm) : 1;
    return (this.seq.clock.bpm / s.bpm) * fix * Math.pow(2, tune / 12);
  }
  updateLoopRates() { for (const [g, l] of this.loops) this.engine.setRate('L' + g, this.loopRate(l.sound, this.p.pads[g].tune)); }
  stopLoops() { for (const g of this.loops.keys()) this.engine.stop({ key: 'L' + g }); this.loops.clear(); this.emit('loops'); }

  // ---------- transport ----------
  play() {
    if (!this.started) this.start();
    this.seq.linkQuantum = this.p.settings.linkEnabled && this.link.state.connected ? this.p.settings.linkQuantum : null;
    if (!this.seq.linkQuantum && this.loops.size) {
      // keep running loops in phase: start the pattern on the loops' next bar line
      const first = [...this.loops.values()][0];
      const now = this.engine.now; const b = this.seq.clock.beatAt(now + 0.05);
      this.seq.play({ startBeat: first.startBeat + Math.ceil((b - first.startBeat) / 4) * 4 });
    } else this.seq.play();
    if (this.p.settings.midiClockOut) this.midi.sendStart(this.engine.ctxToPerf(this.seq.clock.timeAt(this.seq.playStartBeat)) + this.p.settings.midiClockOffsetMs);
    if (this.p.settings.linkEnabled) this.link.setPlaying(true);
    this.emit('transport');
  }
  stop() {
    const wasPlaying = this.seq.playing;
    this.seq.stop();
    this.stopLoops();
    if (wasPlaying && this.p.settings.midiClockOut) this.midi.sendStop();
    if (this.p.settings.linkEnabled) this.link.setPlaying(false);
    this.emit('transport');
  }
  toggleRecord() { if (!this.started) this.start(); this.seq.toggleRecord(); if (this.seq.playing && this.seq.recording) this.emit('transport'); }

  setTempo(bpm: number, fromExternal = false) {
    bpm = Math.round(Math.max(30, Math.min(300, bpm)) * 100) / 100;
    this.p.bpm = bpm;
    if (this.p.settings.linkEnabled && this.link.state.connected && !fromExternal) this.link.setTempo(bpm);
    else this.seq.setTempo(bpm);
    this.updateLoopRates();
    this.save(); this.emit('tempo');
  }

  setLink(on: boolean) {
    this.p.settings.linkEnabled = on; this.save();
    this.seq.linkQuantum = on ? this.p.settings.linkQuantum : null;
    this.link.enable(on);
    this.emit('link');
  }

  // ---------- pattern editing ----------
  stepTicks() { const q = QUANT_TICKS[this.p.quantize]; return q && q >= 80 ? q : 240; }
  toggleStep(global: number, tick: number, len: number) {
    const pat = this.seq.pattern;
    const hit = pat.events.filter((e) => e.p === global && e.t >= tick && e.t < tick + len);
    if (hit.length) pat.events = pat.events.filter((e) => !hit.includes(e));
    else { pat.events.push({ p: global, t: tick, v: this.fullLevel ? 127 : 100 }); pat.events.sort((a, b) => a.t - b.t); }
    this.save(); this.emit('pattern');
  }
  clearPattern() { this.seq.pattern.events = []; this.save(); this.emit('pattern'); }
  clearPad(global: number) { const pat = this.seq.pattern; pat.events = pat.events.filter((e) => e.p !== global); this.save(); this.emit('pattern'); }
  setBars(n: number) { const pat = this.seq.pattern; pat.bars = n; const L = n * 4 * PPQ; pat.events = pat.events.filter((e: NoteEvent) => e.t < L); this.save(); this.emit('pattern'); }

  // ---------- latency ----------
  latencyReport(): LatencyReport {
    const l = this.engine.latency();
    const os = IS_IOS ? 'iOS' : IS_ANDROID ? 'Android' : 'Desktop';
    const minDim = Math.min(screen.width, screen.height);
    const device = this.p.settings.deviceClass !== 'auto' ? this.p.settings.deviceClass : (minDim < 600 ? 'phone' : 'tablet');
    const quantumMs = this.engine.mode === 'worklet' ? 128 / l.sampleRate * 1000 : 0;
    const measured = this.p.lab.tapOffsetMs != null;
    const touchMs = measured ? Math.max(0, this.p.lab.tapOffsetMs!) : (os === 'Android' ? 20 : os === 'iOS' ? 12 : 8);
    const baseMs = l.base * 1000, outputMs = l.output * 1000;
    const midiToSoundMs = baseMs + outputMs + quantumMs;
    const touchToSoundMs = touchMs + midiToSoundMs;
    const t2s = os === 'Android' ? { target: 30, ceiling: 40 } : { target: 20, ceiling: 30 };
    const rt = { target: 10, ceiling: 20 }; const midi = { target: 10, ceiling: 15 };
    const st = (v: number, s: { target: number; ceiling: number }): Status => v <= s.target ? 'ok' : v <= s.ceiling ? 'warn' : 'bad';
    const rtv = this.p.lab.roundTripMs;
    const t2sStatus = st(touchToSoundMs, t2s), midiStatus = st(midiToSoundMs, midi);
    const rtStatus = rtv == null ? 'n/a' : st(rtv, rt);
    return { os, device, baseMs, outputMs, quantumMs, touchMs, touchMeasured: measured, touchToSoundMs, midiToSoundMs, roundTripMs: rtv,
      t2s, rt, midi, t2sStatus, rtStatus, midiStatus, stageCertified: t2sStatus !== 'bad' && midiStatus !== 'bad' && rtStatus !== 'bad', btSuspect: outputMs > 80 };
  }

  checkLatencyLimits() {
    const r = this.latencyReport();
    const key = `${r.t2sStatus}${r.midiStatus}${r.rtStatus}${r.btSuspect}`;
    if (key === this.warned) return; this.warned = key;
    if (r.btSuspect) toast(`⚠ Output latency ${r.outputMs.toFixed(0)} ms — Bluetooth or high-latency route? Not for performance.`, 5000);
    else if (r.t2sStatus === 'bad') toast(`⚠ Touch-to-sound ≈ ${r.touchToSoundMs.toFixed(0)} ms exceeds ${r.t2s.ceiling} ms ceiling — Not stage-certified`, 5000);
    else if (r.rtStatus === 'bad') toast(`⚠ Round trip ${r.roundTripMs!.toFixed(1)} ms exceeds ${r.rt.ceiling} ms ceiling`, 5000);
  }

  async setLatencyHint(sec: number) {
    this.p.settings.latencyHint = sec; this.save();
    if (!this.started) return;
    const playing = this.seq.playing; if (playing) this.stop();
    await this.engine.init(sec || 'interactive');
    await this.engine.resume();
    this.engine.setMaster(this.p.settings.master);
    this.seq.clock.align(0, this.engine.now, this.p.bpm);
    this.warned = '';
    this.emit('latency');
    this.checkLatencyLimits();
  }
}
