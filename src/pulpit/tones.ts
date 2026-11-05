// Sanctum Pulpit tone generators. All original synthesis — no third-party samples.
// Used for chord stabs, sustained band layers, drum grooves, and organ runs/slides.
import { kick, snare, hat, clap, cymbal, organ as organChord } from '../audio/synth';
import { midiHz, type Chord, voice, bassNote } from './theory';

export type Channels = Float32Array[];
const buf = (sr: number, sec: number) => new Float32Array(Math.max(1, Math.round(sr * sec)));
const rnd = (() => { let s = 991; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; }; })();
const sat = (x: number, k = 1.4) => Math.tanh(x * k) / Math.tanh(k);
function normalize(chs: Channels, peak = 0.85): Channels {
  let m = 0; for (const c of chs) for (let i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i]));
  if (m > 0) { const g = peak / m; for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= g; }
  for (const c of chs) { const f = Math.min(c.length, 96); for (let i = 0; i < f; i++) c[c.length - 1 - i] *= i / f; }
  return chs;
}

/** Hammond-ish single note (drawbar 888000000 feel) with gentle Leslie. */
export function organNote(sr: number, midi: number, dur = 2.4, vel = 1): Channels {
  const L = buf(sr, dur + 0.25), R = buf(sr, dur + 0.25);
  const harm = [0.5, 1, 1.5, 2, 3, 4, 6]; const lvl = [0.9, 1, 0.7, 0.45, 0.22, 0.12, 0.06];
  const f0 = midiHz(midi);
  for (let i = 0; i < L.length; i++) {
    const t = i / sr; let x = 0;
    for (let h = 0; h < harm.length; h++) x += Math.sin(2 * Math.PI * f0 * harm[h] * t) * lvl[h];
    const e = (t < 0.006 ? t / 0.006 : 1) * (t > dur ? Math.exp(-(t - dur) / 0.08) : 1) * vel;
    const lesL = 1 + 0.22 * Math.sin(2 * Math.PI * 5.8 * t);
    const lesR = 1 + 0.22 * Math.sin(2 * Math.PI * 5.8 * t + 1.7);
    const y = sat(x * 0.22 * e, 1.35);
    L[i] = y * lesL; R[i] = y * lesR;
  }
  return normalize([L, R], 0.78);
}

/** Soft Rhodes / electric piano note. */
export function rhodesNote(sr: number, midi: number, dur = 2.0, vel = 1): Channels {
  const L = buf(sr, dur + 0.3), R = buf(sr, dur + 0.3);
  const f = midiHz(midi);
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const e = Math.exp(-t / (0.55 + vel * 0.5)) * (t < 0.002 ? t / 0.002 : 1) * (t > dur ? Math.exp(-(t - dur) / 0.05) : 1);
    const tone = Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t / 0.25)
      + 0.12 * Math.sin(2 * Math.PI * f * 3 * t) * Math.exp(-t / 0.12)
      + 0.04 * Math.sin(2 * Math.PI * f * 7.1 * t) * Math.exp(-t / 0.04);
    const y = sat(tone * e * 0.55 * vel, 1.2);
    L[i] = y * (1 + 0.05 * Math.sin(2 * Math.PI * 4.5 * t));
    R[i] = y * (1 + 0.05 * Math.sin(2 * Math.PI * 4.5 * t + 1));
  }
  return normalize([L, R], 0.75);
}

/** Warm bass note (sine + soft square). */
export function bassTone(sr: number, midi: number, dur = 1.6, vel = 1): Channels {
  const o = buf(sr, dur + 0.15); const f = midiHz(midi);
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    const e = (t < 0.008 ? t / 0.008 : Math.exp(-(t - 0.008) / (dur * 0.55))) * (t > dur ? Math.exp(-(t - dur) / 0.04) : 1);
    const sq = Math.sign(Math.sin(2 * Math.PI * f * t));
    o[i] = sat((0.75 * Math.sin(2 * Math.PI * f * t) + 0.18 * sq) * e * vel, 1.6);
  }
  return normalize([o], 0.8);
}

/** Modern distorted 808: clean sine sub + parallel mid-band drive + click (stays in key: odd harmonics only). */
export function bass808(sr: number, midi: number, dur = 1.4, vel = 1, drive = 3.2): Channels {
  const o = buf(sr, dur + 0.05); const f = midiHz(midi); let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    const fr = f * (1 + 1.3 * Math.exp(-t / 0.02));
    ph += 2 * Math.PI * fr / sr;
    const e = Math.min(1, t / 0.0015) * Math.exp(-t / (dur * 0.6)) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.04) : 1) * vel;
    const x = Math.sin(ph) * e;
    const d = Math.tanh(x * drive) - x * 0.9; // mostly the added harmonics
    const click = t < 0.004 ? rnd() * (1 - t / 0.004) * 0.25 : 0;
    o[i] = sat(x + 0.55 * d + click, 1.2);
  }
  return normalize([o], 0.85);
}

/** Soft pad / string cluster for worship. */
export function padTone(sr: number, midi: number, dur = 3.2, vel = 0.7): Channels {
  const L = buf(sr, dur + 0.4), R = buf(sr, dur + 0.4);
  const f = midiHz(midi);
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const e = (t < 0.25 ? t / 0.25 : 1) * (t > dur - 0.4 ? Math.max(0, (dur - t) / 0.4) : 1) * vel;
    const det = 1 + 0.003 * Math.sin(2 * Math.PI * 0.7 * t);
    const x = Math.sin(2 * Math.PI * f * det * t) * 0.5 + Math.sin(2 * Math.PI * f * 0.997 * t) * 0.35
      + Math.sin(2 * Math.PI * f * 1.503 * t) * 0.2;
    L[i] = x * e * 0.35; R[i] = x * e * 0.35 * (1 + 0.08 * Math.sin(2 * Math.PI * 0.35 * t));
  }
  return normalize([L, R], 0.65);
}

/** Mix chord voices into one stereo buffer for immediate trigger. */
export function renderChord(sr: number, ch: Chord, band: 'full' | 'duo' | 'modern', intensity: number, hit = false): Channels {
  const notes = voice(ch, 52, 5);
  const bass = bassNote(ch, 31);
  const dur = hit ? 0.55 : 2.6;
  const L = buf(sr, dur + 0.35), R = buf(sr, dur + 0.35);
  const mix = (src: Channels, g: number) => {
    const n = Math.min(L.length, src[0].length);
    for (let i = 0; i < n; i++) { L[i] += src[0][i] * g; R[i] += (src[1] ? src[1][i] : src[0][i]) * g; }
  };
  if (band === 'modern') {
    // Modern: Rhodes + airy pad + distorted 808 bass (no organ), trap-gospel colour.
    for (const n of notes.slice(0, 5)) mix(rhodesNote(sr, n, dur * 0.8, 0.6 + intensity * 0.25), 0.3);
    mix(padTone(sr, notes[0] + 12, dur, 0.3 + intensity * 0.2), 0.28);
    mix(bass808(sr, bassNote(ch, 28), dur * 0.85, 0.8 + intensity * 0.2), 0.75);
    return normalize([L, R], 0.82);
  }
  // Organ always (duo and full)
  const intervals = notes.map((n) => n - notes[0]);
  mix(organChord(sr, { note: notes[0], dur: dur * 0.92, chord: intervals.join(',') }), 0.55 + intensity * 0.15);
  if (band === 'full') {
    for (const n of notes.slice(0, 4)) mix(rhodesNote(sr, n, dur * 0.85, 0.55 + intensity * 0.2), 0.28);
    mix(padTone(sr, notes[0] + 12, dur, 0.35 + intensity * 0.2), 0.22);
  }
  mix(bassTone(sr, bass, dur * 0.9, 0.7 + intensity * 0.25), band === 'duo' ? 0.35 : 0.55);
  if (hit) {
    // Add a short percussive edge for stabs
    const k = kick(sr, { decay: 0.18, f0: 120, f1: 50 });
    const n = Math.min(L.length, k[0].length);
    for (let i = 0; i < n; i++) { L[i] += k[0][i] * 0.25; R[i] += k[0][i] * 0.25; }
  }
  return normalize([L, R], 0.82);
}

/** Organ run / slide (triggerable fill). Direction +1 up, -1 down. */
export function organRun(sr: number, fromMidi: number, semis: number, dur = 0.55): Channels {
  const L = buf(sr, dur + 0.15), R = buf(sr, dur + 0.15);
  for (let i = 0; i < L.length; i++) {
    const t = i / sr; const k = Math.min(1, t / dur);
    const midi = fromMidi + semis * k;
    const f = midiHz(midi);
    const e = (t < 0.01 ? t / 0.01 : 1) * (t > dur ? Math.exp(-(t - dur) / 0.05) : 1);
    let x = 0; for (const h of [1, 2, 3, 4]) x += Math.sin(2 * Math.PI * f * h * t) / h;
    const y = sat(x * 0.28 * e, 1.4);
    L[i] = y; R[i] = y * 0.95;
  }
  return normalize([L, R], 0.75);
}

/** One bar drum groove at `bpm`, intensity 0..1 (shout/worship level mapping). */
export function drumBar(sr: number, bpm: number, intensity: number, feel: 'hold' | 'worship' | 'shout' | 'praise' | 'modern' = 'hold'): Channels {
  const beats = 4; const barSec = beats * 60 / bpm; const L = buf(sr, barSec), R = buf(sr, barSec);
  const place = (src: Channels, beat: number, g: number) => {
    const pos = Math.floor(beat * 60 / bpm * sr);
    const n = Math.min(src[0].length, L.length - pos);
    for (let i = 0; i < n; i++) {
      L[pos + i] += src[0][i] * g;
      R[pos + i] += (src[1] ? src[1][i] : src[0][i]) * g;
    }
  };
  const k = kick(sr, { decay: 0.28 + intensity * 0.1 });
  const s = snare(sr, { decay: 0.16 + intensity * 0.08 });
  const hh = hat(sr, { decay: 0.04 + intensity * 0.02 });
  const oh = hat(sr, { decay: 0.22, fc: 7500 });
  const cl = clap(sr, { decay: 0.18 });
  if (feel === 'modern') {
    // Trap-gospel groove (half-time feel): clicky kick, clap+snare on beat 3, 1/8 hats with 1/32 + triplet rolls.
    const k2 = kick(sr, { f0: 210, f1: 50, decay: 0.2, click: 0.9, drive: 2.6 });
    place(k2, 0, 0.9); place(k2, 1.75, 0.6); place(k2, 2.5, 0.7);
    if (intensity > 0.4) place(k2, 3.25, 0.55);
    place(s, 2, 0.6); place(cl, 2, 0.6);
    if (intensity > 0.6) place(s, 3.75, 0.25);
    for (let b = 0; b < 8; b++) if (b !== 3 && b !== 7) place(hh, b * 0.5, 0.3 + (b % 2 ? 0 : 0.05));
    for (let r = 0; r < 4; r++) place(hh, 1.5 + r * 0.125, 0.18 + r * 0.05);       // 1/32 roll into beat 3
    for (let r = 0; r < 3; r++) place(hh, 3.5 + r / 6, 0.2 + r * 0.06);            // triplet roll at the end
    if (intensity > 0.5) place(oh, 3.5, 0.18);
  } else if (feel === 'hold' || feel === 'worship') {
    place(k, 0, 0.55 + intensity * 0.2);
    if (intensity > 0.25) place(k, 2, 0.4);
    if (intensity > 0.55) place(s, 2, 0.35);
    for (let b = 0; b < 8; b++) place(hh, b * 0.5, 0.15 + intensity * 0.1);
    if (feel === 'worship' && intensity > 0.4) place(cymbal(sr, { decay: 1.0 }), 0, 0.12);
  } else if (feel === 'praise') {
    place(k, 0, 0.7); place(k, 2.5, 0.45); place(s, 1, 0.55); place(s, 3, 0.55);
    for (let b = 0; b < 8; b++) place(b % 2 ? oh : hh, b * 0.5, 0.25);
    if (intensity > 0.5) place(cl, 1.5, 0.3);
  } else { // shout
    place(k, 0, 0.85); place(k, 1, 0.5); place(k, 2, 0.75); place(k, 3, 0.5);
    place(s, 1, 0.7); place(s, 3, 0.7);
    if (intensity > 0.5) { place(s, 1.75, 0.4); place(k, 2.5, 0.55); }
    for (let b = 0; b < 16; b++) place(hh, b * 0.25, 0.22 + (b % 2 ? 0.05 : 0));
    if (intensity > 0.75) place(cl, 3.5, 0.4);
  }
  // Soft noise bed so silent bars don't click when looped
  for (let i = 0; i < L.length; i++) { const n = rnd() * 0.0008; L[i] += n; R[i] += n; }
  return normalize([L, R], 0.8);
}

/** Chord-fitting helper for Voice Follow: pick a degree token whose chord contains pitch class `pc`. */
export function chordForPitch(pc: number, tonic: number, mode: 'major' | 'minor', candidates: string[], chordIn: typeof import('./theory').chordIn, mod12: typeof import('./theory').mod12): string {
  const key = { tonic, mode };
  let best = candidates[0] || 'I'; let bestScore = -1;
  for (const tok of candidates) {
    try {
      const ch = chordIn(tok, key);
      const pcs = new Set(ch.intervals.map((iv) => mod12(ch.root + iv)));
      pcs.add(ch.root); pcs.add(ch.bass);
      const hit = pcs.has(mod12(pc)) ? 2 : 0;
      const score = hit;
      if (score > bestScore) { bestScore = score; best = tok; }
    } catch { /* skip bad token */ }
  }
  return best;
}
