// Pure Voice Follow DSP (no DOM / AudioContext). Safe for `node` strip-type tests.
import { detectPitch } from './keydetect';
import { chordIn, mod12, type Key } from './theory';

export const NOTE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function chordForPitch(pc: number, tonic: number, mode: 'major' | 'minor', candidates: string[]): string {
  const key = { tonic, mode };
  let best = candidates[0] || 'I'; let bestScore = -1;
  for (const tok of candidates) {
    try {
      const ch = chordIn(tok, key);
      const pcs = new Set(ch.intervals.map((iv) => mod12(ch.root + iv)));
      pcs.add(ch.root); pcs.add(ch.bass);
      const hit = pcs.has(mod12(pc)) ? 2 : 0;
      if (hit > bestScore) { bestScore = hit; best = tok; }
    } catch { /* skip */ }
  }
  return best;
}

export function pickChordForNote(midi: number, key: Key, candidates: string[]): { token: string; pc: number; name: string; midi: number } {
  const pc = mod12(midi);
  const token = chordForPitch(pc, key.tonic, key.mode, candidates.length ? candidates : ['I', 'IV', 'V7', 'vi', 'ii7', 'I/5']);
  return { token, pc, name: NOTE[pc], midi };
}

export class CadenceTracker {
  private env = 0;
  private prev = 0;
  private onsets: number[] = [];
  private lastOnset = -1;
  private inPhrase = false;
  private silenceMs = 0;
  sensitivity = 0.55;
  reset() {
    this.env = 0; this.prev = 0; this.onsets = []; this.lastOnset = -1;
    this.inPhrase = false; this.silenceMs = 0;
  }
  feed(rms: number, t: number): { onset: boolean; phraseEnd: boolean; onsetsPerSec: number; wpm: number } {
    const gate = 0.012 + (1 - this.sensitivity) * 0.04;
    const attack = 0.35, release = 0.08;
    this.env = rms > this.env ? this.env + attack * (rms - this.env) : this.env + release * (rms - this.env);
    const deriv = this.env - this.prev; this.prev = this.env;
    let onset = false;
    const minGap = 0.09;
    if (this.env > gate && deriv > (0.008 + (1 - this.sensitivity) * 0.02) && (t - this.lastOnset) > minGap) {
      onset = true; this.lastOnset = t; this.onsets.push(t); this.inPhrase = true; this.silenceMs = 0;
      while (this.onsets.length && t - this.onsets[0] > 8) this.onsets.shift();
    }
    let phraseEnd = false;
    if (this.inPhrase) {
      if (rms < gate * 0.7) this.silenceMs += 50;
      else this.silenceMs = 0;
      if (this.silenceMs >= 220) { phraseEnd = true; this.inPhrase = false; this.silenceMs = 0; }
    }
    const recent = this.onsets.filter((x) => t - x <= 4);
    const onsetsPerSec = recent.length / 4;
    const wpm = onsetsPerSec * 60 / 1.3;
    return { onset, phraseEnd, onsetsPerSec, wpm };
  }
  intensityFromRate(onsetsPerSec: number): number {
    return Math.max(0, Math.min(1, (onsetsPerSec - 1.5) / 5));
  }
}

export function analyseFollowSignal(sig: Float32Array, sampleRate: number, sensitivity = 0.7) {
  const cad = new CadenceTracker(); cad.sensitivity = sensitivity;
  const hop = Math.floor(sampleRate * 0.05);
  const frame = 2048;
  const onsets: number[] = [];
  const pitches: number[] = [];
  let phraseEnds = 0;
  for (let s = 0; s + frame < sig.length; s += hop) {
    const slice = sig.subarray(s, s + frame);
    let rms = 0; for (let i = 0; i < slice.length; i++) rms += slice[i] * slice[i];
    rms = Math.sqrt(rms / slice.length);
    const t = s / sampleRate;
    const ev = cad.feed(rms, t);
    if (ev.onset) onsets.push(t);
    if (ev.phraseEnd) phraseEnds++;
    if (rms > 0.02) {
      const p = detectPitch(slice, sampleRate);
      if (p && p.clarity > 0.7) pitches.push(Math.round(69 + 12 * Math.log2(p.hz / 440)));
    }
  }
  const dur = sig.length / sampleRate;
  const onsetsPerSec = onsets.length / dur;
  const median = (arr: number[]) => { if (!arr.length) return null; const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  return { onsets: onsets.length, onsetsPerSec, phraseEnds, medianMidi: median(pitches), pitches: pitches.length };
}
