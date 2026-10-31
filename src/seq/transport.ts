// Clock, transport, sequencer, swing, quantize, note repeat, recording with latency correction.
import { PPQ, QUANT_TICKS, type NoteEvent, type Project } from '../state';
import type { Engine } from '../audio/engine';

export class Clock {
  anchorTime = 0; anchorBeat = 0; bpm = 120;
  beatAt(t: number) { return this.anchorBeat + (t - this.anchorTime) * this.bpm / 60; }
  timeAt(b: number) { return this.anchorTime + (b - this.anchorBeat) * 60 / this.bpm; }
  setTempo(bpm: number, now: number) { this.anchorBeat = this.beatAt(now); this.anchorTime = now; this.bpm = bpm; }
  /** Re-anchor so that `beat` happens at `time` (used by Link / MIDI clock follow). */
  align(beat: number, time: number, bpm = this.bpm) { this.anchorBeat = beat; this.anchorTime = time; this.bpm = bpm; }
}

export interface SeqHooks {
  /** play a pad (global index) at context time `at`; source: 'seq' | 'repeat' */
  voice(pad: number, vel: number, at: number, source: 'seq' | 'repeat'): void;
  click(accent: boolean, at: number): void;
  midiClock?(times: number[]): void;
  onPosition?(tick: number, bar: number): void;
  onTransport?(playing: boolean, recording: boolean): void;
  onRecorded?(ev: NoteEvent): void;
  isLoopPad(pad: number): boolean;
}

interface Held { pad: number; vel: number; next: number; origin: number }

export class Sequencer {
  clock = new Clock();
  playing = false; recording = false;
  playStartBeat = 0;          // beat at which pattern tick 0 plays
  countInUntil = -Infinity;   // beat where count-in ends
  private scheduledTo = 0;    // beat up to which events were scheduled
  private timer: number | undefined;
  held = new Map<number, Held>(); // pointer/key id -> note repeat state
  noteRepeat = false;
  private skip = new Map<NoteEvent, number>(); // freshly recorded events -> beat to skip once (avoid double hit)
  lookahead = 0.12;
  linkQuantum: number | null = null; // when Link is on, start on quantum boundaries

  constructor(private engine: Engine, private proj: () => Project, private hooks: SeqHooks) {
    this.clock.bpm = proj().bpm;
  }

  get pattern() { const p = this.proj(); return p.patterns[p.currentPattern]; }
  get patternTicks() { return this.pattern.bars * 4 * PPQ; }

  startTimer() {
    if (this.timer) return;
    this.timer = window.setInterval(() => this.schedule(), 20);
  }
  stopTimer() { clearInterval(this.timer); this.timer = undefined; }

  setTempo(bpm: number) {
    bpm = Math.max(30, Math.min(300, bpm));
    this.clock.setTempo(bpm, this.engine.now);
  }

  /** Swing: piecewise-linear time warp inside each 8th/16th pair (50% = straight, 66% ≈ triplet). */
  warp(tick: number) {
    const p = this.proj(); const s = p.swing / 100; if (Math.abs(s - 0.5) < 1e-4) return tick;
    const pair = p.swingRes === 8 ? PPQ : PPQ / 2; const half = pair / 2;
    const base = Math.floor(tick / pair) * pair; const pos = tick - base;
    return pos < half ? base + pos * (s * pair / half) : base + s * pair + (pos - half) * ((1 - s) * pair / half);
  }
  unwarp(tick: number) {
    const p = this.proj(); const s = p.swing / 100; if (Math.abs(s - 0.5) < 1e-4) return tick;
    const pair = p.swingRes === 8 ? PPQ : PPQ / 2; const half = pair / 2;
    const base = Math.floor(tick / pair) * pair; const pos = tick - base; const split = s * pair;
    return pos < split ? base + pos * half / split : base + half + (pos - split) * half / ((1 - s) * pair);
  }

  play(opts: { startBeat?: number } = {}) {
    if (this.playing) return;
    const now = this.engine.now;
    const startDelay = 0.06;
    if (opts.startBeat != null) {
      this.playStartBeat = opts.startBeat;
    } else if (this.linkQuantum) {
      const q = this.linkQuantum; const b = this.clock.beatAt(now + startDelay);
      this.playStartBeat = Math.ceil(b / q) * q;
    } else {
      this.clock.align(0, now + startDelay, this.clock.bpm);
      this.playStartBeat = 0;
    }
    if (this.recording && this.proj().settings.countIn) { this.countInUntil = this.playStartBeat + 4; this.playStartBeat += 4; }
    else this.countInUntil = -Infinity;
    this.scheduledTo = this.clock.beatAt(now);
    this.playing = true;
    this.hooks.onTransport?.(true, this.recording);
  }

  stop() {
    if (!this.playing) { this.hooks.onTransport?.(false, this.recording); return; }
    this.playing = false; this.recording = false;
    this.hooks.onTransport?.(false, false);
  }

  toggleRecord() {
    this.recording = !this.recording;
    if (this.recording && !this.playing) this.play();
    this.hooks.onTransport?.(this.playing, this.recording);
  }

  /** Current pattern tick (straight, unswung) for display. */
  positionTick(t = this.engine.now) {
    if (!this.playing) return -1;
    const b = this.clock.beatAt(t) - this.playStartBeat; if (b < 0) return -1;
    const L = this.patternTicks; return ((b * PPQ) % L + L) % L;
  }

  nextLaunchTime(mode: 'bar' | 'beat'): number {
    const now = this.engine.now; const unit = mode === 'bar' ? 4 : 1;
    if (!this.playing) return now;
    const b = this.clock.beatAt(now + 0.02) - this.playStartBeat;
    const nb = Math.ceil(b / unit) * unit;
    return this.clock.timeAt(this.playStartBeat + nb);
  }

  /** Live pad hit. perfMs = PointerEvent.timeStamp (performance.now domain). */
  recordHit(pad: number, vel: number, perfMs: number) {
    if (!this.playing || !this.recording) return;
    const p = this.proj();
    const comp = (p.settings.touchCompMs || 0) / 1000;
    const heard = this.engine.perfToCtx(perfMs) - comp; // what the performer heard when they hit
    let rel = this.clock.beatAt(heard) - this.playStartBeat;
    if (rel < -0.5) return;           // during count-in
    if (rel < 0) rel = 0;
    const L = this.patternTicks;
    const absTick = rel * PPQ;
    let tick = this.unwarp(((absTick % L) + L) % L);
    const q = QUANT_TICKS[p.quantize];
    if (q) tick = Math.round(tick / q) * q;
    tick = Math.round(tick) % L;
    this.insert({ p: pad, t: tick, v: Math.round(vel) }, rel);
  }

  private insert(ev: NoteEvent, relBeat: number) {
    const pat = this.pattern;
    const dup = pat.events.findIndex((e) => e.p === ev.p && Math.abs(e.t - ev.t) < 20);
    if (dup >= 0) pat.events.splice(dup, 1);
    pat.events.push(ev);
    pat.events.sort((a, b) => a.t - b.t);
    // The hit was already heard live; skip the copy the scheduler would play this cycle.
    const L = this.patternTicks / PPQ;
    const cycleStart = Math.floor(relBeat / L) * L;
    let evBeat = this.playStartBeat + cycleStart + this.warp(ev.t) / PPQ;
    if (evBeat < this.playStartBeat + relBeat - L / 2) evBeat += L;
    this.skip.set(ev, evBeat);
    this.hooks.onRecorded?.(ev);
  }

  // ---- note repeat ----
  holdStart(id: number, pad: number, vel: number) {
    const now = this.engine.now; const g = QUANT_TICKS[this.proj().noteRepeatRate] || 240;
    const origin = this.playing ? this.playStartBeat : this.clock.beatAt(now);
    const nowTick = (this.clock.beatAt(now) - origin) * PPQ;
    let next = Math.floor(nowTick / g) * g + g;
    if (next - nowTick < g * 0.4) next += g; // avoid a flam right after the live hit
    this.held.set(id, { pad, vel, next, origin });
  }
  holdUpdate(id: number, vel: number) { const h = this.held.get(id); if (h) h.vel = vel; }
  holdEnd(id: number) { this.held.delete(id); }

  schedule() {
    const now = this.engine.now; if (!this.engine.ctx) return;
    const from = Math.max(this.scheduledTo, this.clock.beatAt(now));
    const to = this.clock.beatAt(now + this.lookahead);
    if (to <= from) return;
    const p = this.proj();

    if (this.playing) {
      const start = this.playStartBeat; const Lb = this.patternTicks / PPQ;
      // pattern events
      const relFrom = from - start, relTo = to - start;
      if (relTo > 0) {
        const c0 = Math.floor(Math.max(0, relFrom) / Lb), c1 = Math.floor(relTo / Lb);
        for (let c = c0; c <= c1; c++) {
          for (const ev of this.pattern.events) {
            const b = start + c * Lb + this.warp(ev.t) / PPQ;
            if (b >= from && b < to) {
              const sk = this.skip.get(ev);
              if (sk != null && Math.abs(sk - b) < 0.01) { this.skip.delete(ev); continue; }
              this.hooks.voice(ev.p, ev.v, this.clock.timeAt(b), 'seq');
            }
          }
        }
      }
      // metronome / count-in clicks
      const met = p.settings.metronome || from < this.countInUntil;
      if (met) {
        for (let b = Math.ceil(from); b < to; b++) {
          if (b >= this.countInUntil && !p.settings.metronome) continue;
          const rel = b - start; this.hooks.click(((rel % 4) + 4) % 4 === 0, this.clock.timeAt(b));
        }
      }
      // MIDI clock (24 PPQN)
      if (this.hooks.midiClock && p.settings.midiClockOut) {
        const times: number[] = [];
        for (let k = Math.ceil((from - start) * 24); (k / 24) + start < to; k++) if (k >= 0) times.push(this.clock.timeAt(start + k / 24));
        if (times.length) this.hooks.midiClock(times);
      }
    }
    // note repeat (works with transport stopped too)
    if (this.noteRepeat && this.held.size) {
      const g = QUANT_TICKS[p.noteRepeatRate] || 240;
      for (const h of this.held.values()) {
        let guard = 0;
        while (guard++ < 64) {
          const b = h.origin + this.warp(h.next) / PPQ;
          if (b >= to) break;
          if (b >= from - 1e-6) {
            const at = this.clock.timeAt(b);
            this.hooks.voice(h.pad, h.vel, at, 'repeat');
            if (this.playing && this.recording && h.origin === this.playStartBeat) {
              const L = this.patternTicks; let tk = Math.round(h.next % L);
              const ev = { p: h.pad, t: tk, v: Math.round(h.vel) };
              this.insert(ev, h.next / PPQ);
            }
          }
          h.next += g;
        }
      }
    }
    this.scheduledTo = to;
    if (this.playing) {
      const t = this.positionTick(now);
      if (t >= 0) this.hooks.onPosition?.(t, Math.floor(t / (4 * PPQ)));
    }
  }
}
