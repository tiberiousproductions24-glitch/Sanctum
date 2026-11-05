// Sanctum Pulpit performance engine: Easy Play, levels, mutes, quantized key change, band modes.
import type { Engine } from '../audio/engine';
import type { Clock } from '../seq/transport';
import { chordIn, parseKey, keyName, shiftKey, KEY_NAMES, type Key, type Chord } from './theory';
import { PROGRESSIONS, FEELS, type Progression, type Step } from './library';
import { renderChord, drumBar, organRun } from './tones';

export type BandMode = 'full' | 'duo';
export type PulpitLane = 'none' | 'shout' | 'worship';

export interface PulpitState {
  open: boolean;
  key: Key;
  pendingKey: Key | null;       // quantized key change waiting for next beat/bar
  bpm: number;
  band: BandMode;
  progressionId: string;
  stepIndex: number;
  customSteps: Step[] | null;   // pads-view editable sequence (autosaved)
  shoutLevel: number;           // 0 = off, 1..4
  worshipLevel: number;         // 0 = off, 1..4
  drumsMute: boolean;
  musicMute: boolean;
  stageLock: boolean;
  playing: boolean;
  followVoice: boolean;
  lastChord: Chord | null;
  cue: string;
  activity: string;
}

const STORE = 'sanctum.pulpit.v1';

export class PulpitPlayer {
  state: PulpitState;
  private chordCache = new Map<string, string>(); // cacheKey -> sample id
  private drumId: string | null = null;
  private drumFeel: string | null = null;
  private sampleN = 0;
  private ready = false;
  onChange?: () => void;

  constructor(private engine: Engine, private clock: () => Clock, private projectBpm: () => number, private linkEnabled: () => boolean) {
    this.state = this.load() || {
      open: false, key: parseKey('Ab')!, pendingKey: null, bpm: 92, band: 'full',
      progressionId: 'whoop-14', stepIndex: 0, customSteps: null,
      shoutLevel: 0, worshipLevel: 0, drumsMute: false, musicMute: false,
      stageLock: false, playing: false, followVoice: false, lastChord: null, cue: '', activity: 'Ready',
    };
  }

  private load(): PulpitState | null {
    try {
      const raw = localStorage.getItem(STORE); if (!raw) return null;
      const o = JSON.parse(raw);
      const key = parseKey(o.keyName || 'Ab') || { tonic: 8, mode: 'major' as const };
      return {
        open: false, key, pendingKey: null, bpm: o.bpm || 92, band: o.band === 'duo' ? 'duo' : 'full',
        progressionId: o.progressionId || 'whoop-14', stepIndex: 0,
        customSteps: Array.isArray(o.customSteps) ? o.customSteps : null,
        shoutLevel: o.shoutLevel | 0, worshipLevel: o.worshipLevel | 0,
        drumsMute: !!o.drumsMute, musicMute: !!o.musicMute, stageLock: false,
        playing: false, followVoice: false, lastChord: null, cue: '', activity: 'Ready',
      };
    } catch { return null; }
  }
  save() {
    const s = this.state;
    try {
      localStorage.setItem(STORE, JSON.stringify({
        keyName: keyName(s.key), bpm: s.bpm, band: s.band, progressionId: s.progressionId,
        customSteps: s.customSteps, shoutLevel: s.shoutLevel, worshipLevel: s.worshipLevel,
        drumsMute: s.drumsMute, musicMute: s.musicMute,
      }));
    } catch {}
  }
  private emit(activity?: string) {
    if (activity) this.state.activity = activity;
    this.onChange?.();
  }

  progression(): Progression {
    return PROGRESSIONS.find((p) => p.id === this.state.progressionId) || PROGRESSIONS[0];
  }
  steps(): Step[] {
    return this.state.customSteps?.length ? this.state.customSteps : this.progression().steps;
  }
  setProgression(id: string) {
    this.state.progressionId = id; this.state.stepIndex = 0; this.state.customSteps = null;
    const p = this.progression(); const feel = FEELS[p.feel];
    if (feel) this.state.bpm = feel.bpm;
    this.save(); this.emit('Loaded ' + p.name);
  }
  setCustomSteps(steps: Step[]) {
    this.state.customSteps = steps.map((s) => ({ ...s }));
    this.state.stepIndex = Math.min(this.state.stepIndex, Math.max(0, steps.length - 1));
    this.save(); this.emit('Sequence saved');
  }

  /** Ensure drum + a few reference samples exist. Call after audio engine is running. */
  ensureSamples() {
    if (this.ready || !this.engine.ctx) return;
    this.rebuildDrums();
    // Warm organ run samples at C
    const sr = this.engine.sampleRate;
    this.engine.register('pulpit.run.up', organRun(sr, 60, 7, 0.5));
    this.engine.register('pulpit.run.down', organRun(sr, 67, -7, 0.5));
    this.engine.register('pulpit.run.slide', organRun(sr, 58, 12, 0.7));
    this.ready = true;
  }

  private rebuildDrums() {
    const s = this.state;
    const intensity = Math.max(s.shoutLevel, s.worshipLevel) / 4;
    const feel = s.shoutLevel > 0 ? 'shout' : s.worshipLevel > 0 ? (s.worshipLevel >= 3 ? 'praise' : 'worship') : 'hold';
    const key = `${feel}:${s.bpm}:${intensity.toFixed(2)}`;
    if (this.drumFeel === key && this.drumId) return;
    const id = 'pulpit.drums.' + (++this.sampleN);
    const ch = drumBar(this.engine.sampleRate || 48000, s.bpm, intensity, feel);
    this.engine.register(id, ch);
    // stop old loop, start new if playing
    if (this.drumId) this.engine.stop({ key: 'pulpit-drums' });
    this.drumId = id; this.drumFeel = key;
    if (s.playing && !s.drumsMute) this.startDrumLoop();
  }

  private startDrumLoop() {
    if (!this.drumId || this.state.drumsMute) return;
    const rate = 1; // rendered at current bpm
    this.engine.trigger({ at: 0, id: this.drumId, vel: 0.85, loop: true, choke: 'pulpit-drums', key: 'pulpit-drums', mono: true, rate });
  }

  private chordSample(ch: Chord, hit: boolean): string {
    const s = this.state;
    const intensity = Math.max(s.shoutLevel, s.worshipLevel, 1) / 4;
    const cacheKey = `${ch.name}|${s.band}|${hit}|${intensity.toFixed(2)}`;
    const cached = this.chordCache.get(cacheKey);
    if (cached && this.engine.has(cached)) return cached;
    const id = 'pulpit.ch.' + (++this.sampleN);
    const buf = renderChord(this.engine.sampleRate || 48000, ch, s.band, intensity, hit);
    this.engine.register(id, buf);
    this.chordCache.set(cacheKey, id);
    // Bound cache size
    if (this.chordCache.size > 64) {
      const first = this.chordCache.keys().next().value!;
      this.chordCache.delete(first);
    }
    return id;
  }

  /** Easy Play: advance one step and sound immediately (never quantized). */
  easyPlay() {
    this.ensureSamples();
    this.applyPendingKeyIfDue(true); // immediate apply on tap if somehow pending and user wants next chord in new key? Keep pending for beat.
    const steps = this.steps();
    if (!steps.length) return;
    const step = steps[this.state.stepIndex % steps.length];
    this.state.stepIndex = (this.state.stepIndex + 1) % steps.length;
    this.fireStep(step, true);
    if (!this.state.playing) this.start();
    this.save();
  }

  /** Fire a stab / hit without advancing. */
  hit() {
    this.ensureSamples();
    const steps = this.steps();
    const step = steps[Math.max(0, this.state.stepIndex - 1)] || steps[0] || { c: 'I', hit: true };
    this.fireStep({ ...step, hit: true }, false);
  }

  fireStep(step: Step, advanceCue: boolean) {
    const ch = chordIn(step.c, this.state.key);
    this.state.lastChord = ch;
    if (advanceCue) this.state.cue = step.cue || ch.name;
    if (!this.state.musicMute) {
      const id = this.chordSample(ch, !!step.hit);
      this.engine.trigger({ at: 0, id, vel: step.hit ? 1 : 0.9, choke: 'pulpit-music', key: 'pulpit-music', mono: true });
    }
    if (step.run && !this.state.musicMute) {
      const root = 48 + ((ch.root) % 12);
      // pitch-shift pre-rendered C runs via rate
      const rate = Math.pow(2, (root - 60) / 12);
      this.engine.trigger({ at: 0, id: 'pulpit.run.up', vel: 0.85, rate, choke: 'pulpit-run', key: 'pulpit-run' });
    }
    this.emit(step.hit ? `Hit ${ch.name}` : ch.name);
  }

  /** Trigger a chord token from Voice Follow / external (does not advance Easy Play index unless asked). */
  triggerToken(token: string, opts: { advance?: boolean; hit?: boolean } = {}) {
    const step: Step = { c: token, hit: opts.hit };
    if (opts.advance) {
      const steps = this.steps();
      this.state.stepIndex = (this.state.stepIndex + 1) % Math.max(1, steps.length);
    }
    this.fireStep(step, true);
    if (!this.state.playing) this.start();
  }

  start() {
    this.ensureSamples();
    this.state.playing = true;
    this.rebuildDrums();
    this.startDrumLoop();
    this.emit('Playing');
  }

  stop(fade = false) {
    this.state.playing = false;
    if (fade) {
      // soft stop: choke groups with a short delay — engine fade is ~3ms; trigger quiet silence by stopping
      const t = this.engine.now + 0.01;
      this.engine.stop({ key: 'pulpit-music', at: t });
      this.engine.stop({ key: 'pulpit-drums', at: t });
      this.engine.stop({ key: 'pulpit-run', at: t });
    } else {
      this.engine.stop({ key: 'pulpit-music' });
      this.engine.stop({ key: 'pulpit-drums' });
      this.engine.stop({ key: 'pulpit-run' });
    }
    this.emit(fade ? 'Fade out' : 'Stopped');
  }

  setKey(k: Key, quantize: 'immediate' | 'beat' | 'bar' = 'beat') {
    if (quantize === 'immediate' || !this.state.playing) {
      this.state.key = k; this.state.pendingKey = null; this.save(); this.emit('Key ' + keyName(k)); return;
    }
    this.state.pendingKey = k; this.emit('Key → ' + keyName(k) + ' (next ' + quantize + ')');
    this.armKeyChange(quantize);
  }
  private keyTimer: number | undefined;
  private armKeyChange(q: 'beat' | 'bar') {
    clearTimeout(this.keyTimer);
    const clock = this.clock();
    const now = this.engine.now;
    const beat = clock.beatAt(now);
    const target = q === 'bar' ? Math.ceil(beat / 4) * 4 : Math.ceil(beat);
    const wait = Math.max(0.02, clock.timeAt(target) - now);
    this.keyTimer = window.setTimeout(() => this.applyPendingKeyIfDue(false), wait * 1000 + 5);
  }
  applyPendingKeyIfDue(_force: boolean) {
    if (!this.state.pendingKey) return;
    this.state.key = this.state.pendingKey; this.state.pendingKey = null; this.save();
    this.emit('Key ' + keyName(this.state.key));
  }
  /** Poll from rAF — applies pending key when beat crosses. */
  tick() {
    if (!this.state.pendingKey || !this.state.playing) return;
    const clock = this.clock();
    const beat = clock.beatAt(this.engine.now);
    // Apply when within 30ms after an integer beat
    const frac = beat - Math.floor(beat);
    if (frac < 0.05 || frac > 0.98) this.applyPendingKeyIfDue(false);
  }

  setBpm(bpm: number) {
    bpm = Math.max(40, Math.min(200, bpm));
    this.state.bpm = bpm;
    this.drumFeel = null; this.rebuildDrums();
    this.save(); this.emit(`${bpm.toFixed(0)} BPM`);
  }
  setBand(b: BandMode) { this.state.band = b; this.save(); this.emit(b === 'full' ? 'Full Band' : 'Organ + Drums'); }
  setShout(level: number) {
    level = Math.max(0, Math.min(4, level | 0));
    this.state.shoutLevel = level;
    if (level > 0) this.state.worshipLevel = 0;
    this.drumFeel = null; this.rebuildDrums();
    this.save(); this.emit(level ? `Shout ${level}` : 'Shout off');
  }
  setWorship(level: number) {
    level = Math.max(0, Math.min(4, level | 0));
    this.state.worshipLevel = level;
    if (level > 0) this.state.shoutLevel = 0;
    this.drumFeel = null; this.rebuildDrums();
    this.save(); this.emit(level ? `Worship ${level}` : 'Worship off');
  }
  setDrumsMute(m: boolean) {
    this.state.drumsMute = m;
    if (m) this.engine.stop({ key: 'pulpit-drums' });
    else if (this.state.playing) this.startDrumLoop();
    this.save(); this.emit(m ? 'Drums muted' : 'Drums on');
  }
  setMusicMute(m: boolean) {
    this.state.musicMute = m;
    if (m) this.engine.stop({ key: 'pulpit-music' });
    this.save(); this.emit(m ? 'Music muted' : 'Music on');
  }
  setStageLock(on: boolean) { this.state.stageLock = on; this.emit(on ? 'Stage Mode locked' : 'Stage Mode off'); }
  setFollowVoice(on: boolean) { this.state.followVoice = on; this.emit(on ? 'Follow Voice on' : 'Follow Voice off'); }

  syncFromProject() {
    // Follow project tempo when Link is on (Pulpit tempo tracks the session)
    if (this.linkEnabled()) {
      const bpm = this.projectBpm();
      if (Math.abs(bpm - this.state.bpm) > 0.05) this.setBpm(bpm);
    }
  }

  allKeys() { return KEY_NAMES; }
}

export { keyName, parseKey, shiftKey, KEY_NAMES };
