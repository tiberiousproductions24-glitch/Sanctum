// Chord detection DSP: chromagram + template matching + causal/offline Viterbi.
// Reuses FFT/chroma from Sanctum Pulpit keydetect — do not duplicate DSP.
import { magnitudes, chromaFromSpectrum, detectKey, KEY_LABELS } from '../pulpit/keydetect';
import type { ChordQuality, DetectedChord, ChordFrame, ChordChart } from './types';

export const PC_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const PC_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface ChordTemplate {
  quality: ChordQuality;
  /** Pitch-class weights relative to root (length 12). */
  mask: number[];
  label: string; // suffix after root name
}

/** Template dictionary: maj, min, 7, maj7, m7, sus2/4, dim, aug (+ N handled separately). */
export const TEMPLATES: ChordTemplate[] = [
  { quality: 'maj',  label: '',     mask: w([0, 4, 7]) },
  { quality: 'min',  label: 'm',    mask: w([0, 3, 7]) },
  { quality: '7',    label: '7',    mask: w([0, 4, 7, 10]) },
  { quality: 'maj7', label: 'maj7', mask: w([0, 4, 7, 11]) },
  { quality: 'm7',   label: 'm7',   mask: w([0, 3, 7, 10]) },
  { quality: 'sus2', label: 'sus2', mask: w([0, 2, 7]) },
  { quality: 'sus4', label: 'sus4', mask: w([0, 5, 7]) },
  { quality: 'dim',  label: 'dim',  mask: w([0, 3, 6]) },
  { quality: 'aug',  label: 'aug',  mask: w([0, 4, 8]) },
];

function w(pcs: number[]): number[] {
  const m = new Array(12).fill(0);
  for (const p of pcs) m[((p % 12) + 12) % 12] = 1;
  // Soft-penalize the major/minor third clash for triad templates that have a third
  return m;
}

export const N_TEMPLATES = TEMPLATES.length * 12; // rooted templates

export function templateIndex(root: number, qualityIndex: number) {
  return qualityIndex * 12 + ((root % 12) + 12) % 12;
}

export function decodeTemplateIndex(i: number): { root: number; quality: ChordQuality; suffix: string } {
  const q = Math.floor(i / 12);
  const root = i % 12;
  const t = TEMPLATES[q];
  return { root, quality: t.quality, suffix: t.label };
}

function rotate(mask: number[], root: number): number[] {
  const out = new Array(12);
  for (let i = 0; i < 12; i++) out[i] = mask[((i - root) % 12 + 12) % 12];
  return out;
}

function l2norm(v: number[]): number {
  let s = 0; for (const x of v) s += x * x; return Math.sqrt(s) || 1e-12;
}

/** Cosine similarity of chroma vs a rooted template, with a missing-tone penalty. */
export function scoreTemplate(chroma: number[], root: number, mask: number[]): number {
  const t = rotate(mask, root);
  const nt = l2norm(t), nc = l2norm(chroma);
  let dot = 0; for (let i = 0; i < 12; i++) dot += chroma[i] * t[i];
  let cos = dot / (nt * nc);
  // Penalise templates that require a pitch class nearly absent from the chroma
  // (stops Am {A,C,E} ranking as Fmaj7 {F,A,C,E} when F is weak).
  const peak = Math.max(...chroma, 1e-12);
  let miss = 0, need = 0;
  for (let i = 0; i < 12; i++) if (t[i] > 0) {
    need++;
    if (chroma[i] < peak * 0.18) miss++;
  }
  if (need) cos *= 1 - 0.35 * (miss / need);
  // Also lightly penalise extra strong chroma peaks outside the template (noise OK)
  return cos;
}

/** Score all rooted templates; returns scores[N_TEMPLATES] and best index + confidence. */
export function matchChroma(chroma: number[], bassChroma?: number[]): { scores: number[]; best: number; confidence: number } {
  const scores = new Array(N_TEMPLATES);
  let best = 0, bestS = -1, second = -1;
  const energy = chroma.reduce((a, b) => a + b, 0);
  if (energy < 1e-9) {
    scores.fill(0);
    return { scores, best: 0, confidence: 0 };
  }
  // Quality prior: prefer tertian chords over sus when chroma fits both (sus2/sus4 share PCs with another root).
  const prior: Record<string, number> = { maj: 0.02, min: 0.02, '7': 0.015, maj7: 0.01, m7: 0.01, sus4: 0.005, sus2: 0, dim: 0.01, aug: 0.01, N: 0 };
  for (let q = 0; q < TEMPLATES.length; q++) {
    for (let r = 0; r < 12; r++) {
      const i = templateIndex(r, q);
      let s = scoreTemplate(chroma, r, TEMPLATES[q].mask) + (prior[TEMPLATES[q].quality] || 0);
      // Bass vote: boost templates whose root matches low-band peak
      if (bassChroma) {
        const b = bassFromChroma(bassChroma);
        if (b === r) s += 0.04;
      }
      scores[i] = s;
      if (s > bestS) { second = bestS; bestS = s; best = i; }
      else if (s > second) second = s;
    }
  }
  const gap = bestS - Math.max(0, second);
  const confidence = Math.max(0, Math.min(1, bestS)) * Math.min(1, 0.4 + gap * 4);
  return { scores, best, confidence };
}

/** Prefer low-band chroma for bass/slash detection. */
export function bassFromChroma(bassChroma: number[]): number {
  let best = 0, v = -1;
  for (let i = 0; i < 12; i++) if (bassChroma[i] > v) { v = bassChroma[i]; best = i; }
  return best;
}

export function formatChord(root: number, suffix: string, bass: number, flats = true): string {
  if (root < 0) return 'N';
  const names = flats ? PC_NAMES_FLAT : PC_NAMES_SHARP;
  const base = names[root] + suffix;
  if (bass !== root && bass >= 0) return base + '/' + names[bass];
  return base;
}

/** Transition log-prob from template state a → b (musical bias + self-stay). */
function logTrans(a: number, b: number, stay: number, I: number): number {
  if (a === b) return Math.log(stay + 1e-12);
  const ra = a % 12, rb = b % 12;
  const qa = Math.floor(a / 12), qb = Math.floor(b / 12);
  const interval = Math.min((ra - rb + 12) % 12, (rb - ra + 12) % 12);
  // Relative / fifth / quality-change are cheaper than random jumps (keeps Am→F from collapsing into Fmaj7).
  let w = 1;
  if (interval === 0 && qa !== qb) w = 4;          // same root, quality change
  else if (interval === 3 || interval === 4) w = 3.5; // relative maj/min area
  else if (interval === 5) w = 3;                  // fourth/fifth
  else if (interval === 2 || interval === 1) w = 1.5;
  const leaveMass = 1 - stay;
  // Normalise roughly: average weight ~1 across I-1 others
  const p = leaveMass * w / ((I - 1) * 1.6);
  return Math.log(Math.max(p, 1e-9));
}

/**
 * Offline Viterbi over template states.
 * Self-transition bias `stay` (0.7–0.9) reduces flicker without swallowing short chords.
 */
export function viterbi(frameScores: number[][], stay = 0.8): number[] {
  const N = frameScores.length;
  if (!N) return [];
  const I = frameScores[0].length;
  const tiny = 1e-12;
  const D = new Float64Array(I);
  const Dprev = new Float64Array(I);
  const back: Uint16Array[] = [];
  for (let i = 0; i < I; i++) D[i] = Math.log(frameScores[0][i] + tiny);
  for (let n = 1; n < N; n++) {
    const E = new Uint16Array(I);
    Dprev.set(D);
    for (let i = 0; i < I; i++) {
      let best = -Infinity, bj = 0;
      for (let j = 0; j < I; j++) {
        const v = Dprev[j] + logTrans(j, i, stay, I);
        if (v > best) { best = v; bj = j; }
      }
      D[i] = best + Math.log(frameScores[n][i] + tiny);
      E[i] = bj;
    }
    back.push(E);
  }
  const path = new Array(N);
  let cur = 0; let mv = -Infinity;
  for (let i = 0; i < I; i++) if (D[i] > mv) { mv = D[i]; cur = i; }
  path[N - 1] = cur;
  for (let n = N - 2; n >= 0; n--) { cur = back[n][cur]; path[n] = cur; }
  return path;
}

/** Causal one-step decode: pick argmax of (prevStay boost + emission). */
export function causalStep(prev: number, scores: number[], stay = 0.9): number {
  let best = 0, bv = -Infinity;
  const leave = (1 - stay) / (scores.length - 1);
  for (let i = 0; i < scores.length; i++) {
    const a = i === prev ? stay : leave;
    const v = Math.log(a + 1e-12) + Math.log(scores[i] + 1e-12);
    if (v > bv) { bv = v; best = i; }
  }
  return best;
}

export interface AnalyseOpts {
  fftSize?: number;
  hop?: number;
  stay?: number;
  minConfidence?: number;
  sampleRate: number;
  flats?: boolean;
}

/** Offline analyse a mono signal → chord chart (+ key + rough BPM). */
export function analyseChords(sig: Float32Array | Float64Array, opts: AnalyseOpts): ChordChart {
  const fftSize = opts.fftSize ?? 4096;
  const hop = opts.hop ?? 2048;
  const stay = opts.stay ?? 0.8;
  const sr = opts.sampleRate;
  const flats = opts.flats ?? true;
  const frame = new Float64Array(fftSize);
  const frames: ChordFrame[] = [];
  const scoreRows: number[][] = [];
  const accChroma = new Array(12).fill(0);

  for (let s = 0; s + fftSize <= sig.length; s += hop) {
    for (let i = 0; i < fftSize; i++) frame[i] = sig[s + i];
    const mag = magnitudes(frame);
    const chroma = chromaFromSpectrum(mag, sr, fftSize, 80, 3000);
    const bassChroma = chromaFromSpectrum(mag, sr, fftSize, 40, 250);
    const { scores, best, confidence } = matchChroma(chroma, bassChroma);
    for (let i = 0; i < 12; i++) accChroma[i] += chroma[i];
    const t = s / sr;
    frames.push({ time: t, chroma, bassChroma, scores, best, confidence });
    scoreRows.push(scores);
  }

  const path = viterbi(scoreRows, stay);
  const chords: DetectedChord[] = [];
  const minConf = opts.minConfidence ?? 0.25;
  let i = 0;
  while (i < path.length) {
    const id = path[i];
    let j = i + 1;
    while (j < path.length && path[j] === id) j++;
    const conf = frames.slice(i, j).reduce((a, f) => a + f.confidence, 0) / (j - i);
    const { root, quality, suffix } = decodeTemplateIndex(id);
    // Bass: average bass chroma over the segment
    const bassAcc = new Array(12).fill(0);
    for (let k = i; k < j; k++) for (let p = 0; p < 12; p++) bassAcc[p] += frames[k].bassChroma[p];
    let bass = bassFromChroma(bassAcc);
    // Only emit slash if bass is a chord tone other than root and clearly stronger
    const chordTones = new Set<number>();
    const mask = TEMPLATES.find((t) => t.quality === quality)!.mask;
    for (let p = 0; p < 12; p++) if (mask[p]) chordTones.add((root + p) % 12);
    if (!chordTones.has(bass) || bassAcc[bass] < bassAcc[root] * 1.15) bass = root;
    const start = frames[i].time;
    const end = (j < frames.length ? frames[j].time : (frames[j - 1].time + hop / sr));
    if (conf >= minConf) {
      chords.push({
        label: formatChord(root, suffix, bass, flats),
        root, quality, bass, confidence: conf, start, end,
      });
    } else {
      chords.push({ label: 'N', root: -1, quality: 'N', bass: -1, confidence: conf, start, end });
    }
    i = j;
  }

  // Merge adjacent identical labels
  const merged: DetectedChord[] = [];
  for (const c of chords) {
    const last = merged[merged.length - 1];
    if (last && last.label === c.label) { last.end = c.end; last.confidence = Math.max(last.confidence, c.confidence); }
    else merged.push({ ...c });
  }

  const keyRes = detectKey(accChroma);
  const bpm = estimateTempo(sig, sr);

  return {
    chords: merged,
    bpm,
    key: { tonic: keyRes.best.tonic, mode: keyRes.best.mode, name: keyRes.best.name, confidence: keyRes.confidence },
    duration: sig.length / sr,
  };
}

/** Rough tempo from onset-envelope autocorrelation (returns null if unclear). */
export function estimateTempo(sig: Float32Array | Float64Array, sampleRate: number): number | null {
  const hop = 512;
  const n = Math.floor(sig.length / hop);
  if (n < 64) return null;
  const env = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let e = 0; const s0 = i * hop;
    for (let j = 0; j < hop && s0 + j < sig.length; j++) e += sig[s0 + j] * sig[s0 + j];
    env[i] = Math.sqrt(e / hop);
  }
  // half-wave flux
  const flux = new Float64Array(n);
  for (let i = 1; i < n; i++) flux[i] = Math.max(0, env[i] - env[i - 1]);
  const minBpm = 60, maxBpm = 180;
  const minLag = Math.floor((60 / maxBpm) * sampleRate / hop);
  const maxLag = Math.floor((60 / minBpm) * sampleRate / hop);
  let bestLag = minLag, best = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0; for (let i = 0; i + lag < n; i++) s += flux[i] * flux[i + lag];
    if (s > best) { best = s; bestLag = lag; }
  }
  if (best <= 0) return null;
  const bpm = 60 * sampleRate / (bestLag * hop);
  // Prefer doubling into 80–160 if estimate is very slow/fast
  let b = bpm;
  while (b < 70) b *= 2;
  while (b > 170) b /= 2;
  return Math.round(b * 10) / 10;
}

/** Group chords into bars given BPM (4/4). */
export function groupByBar(chords: DetectedChord[], bpm: number, duration: number): { bar: number; chords: DetectedChord[] }[] {
  const barDur = (60 / bpm) * 4;
  const nBars = Math.max(1, Math.ceil(duration / barDur));
  const out: { bar: number; chords: DetectedChord[] }[] = [];
  for (let b = 0; b < nBars; b++) {
    const t0 = b * barDur, t1 = (b + 1) * barDur;
    const cs = chords.filter((c) => c.end > t0 && c.start < t1 && c.label !== 'N');
    out.push({ bar: b + 1, chords: cs });
  }
  return out;
}

export function chartToText(chart: ChordChart): string {
  const lines: string[] = [];
  lines.push(`# Sanctum chord chart`);
  if (chart.source?.title) lines.push(`# ${chart.source.title}${chart.source.artist ? ' — ' + chart.source.artist : ''}`);
  if (chart.key) lines.push(`# Key: ${chart.key.name} (conf ${chart.key.confidence.toFixed(2)})`);
  if (chart.bpm) lines.push(`# Tempo: ${chart.bpm} BPM`);
  lines.push(`# Duration: ${chart.duration.toFixed(2)}s`);
  lines.push('');
  if (chart.bpm) {
    for (const g of groupByBar(chart.chords, chart.bpm, chart.duration)) {
      const labs = g.chords.map((c) => c.label);
      lines.push(`Bar ${g.bar}: ${labs.length ? labs.join(' | ') : '—'}`);
    }
  } else {
    for (const c of chart.chords) if (c.label !== 'N') {
      lines.push(`${c.start.toFixed(2)}–${c.end.toFixed(2)}\t${c.label}\t${(c.confidence * 100).toFixed(0)}%`);
    }
  }
  return lines.join('\n');
}

export function chartToJson(chart: ChordChart): string {
  return JSON.stringify(chart, null, 2);
}

/** Label for KEY_LABELS convenience. */
export { KEY_LABELS };
