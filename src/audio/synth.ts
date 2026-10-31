// Sanctum built-in sound synthesis. Every starter-bank sound is generated here from scratch
// (no samples, no third-party content). Output: one or two Float32Array channels at `sr`.

export type Channels = Float32Array[];
export interface SynthParams { [k: string]: number | string | undefined }

let seed = 1234567;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };

class OnePole { y = 0; constructor(public a: number) {} lp(x: number) { this.y += this.a * (x - this.y); return this.y; } }
const lpCoef = (fc: number, sr: number) => 1 - Math.exp(-2 * Math.PI * fc / sr);

class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0; x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  constructor(type: 'bp' | 'hp' | 'lp', fc: number, q: number, sr: number) { this.set(type, fc, q, sr); }
  set(type: 'bp' | 'hp' | 'lp', fc: number, q: number, sr: number) {
    const w = 2 * Math.PI * Math.min(fc, sr * 0.45) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2; const a0 = 1 + al;
    if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
  }
  run(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y;
  }
}

const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));
const sat = (x: number, k: number) => Math.tanh(x * k) / Math.tanh(k);
const buf = (sr: number, sec: number) => new Float32Array(Math.max(1, Math.round(sr * sec)));

function normalize(chs: Channels, peak = 0.89): Channels {
  let m = 0; for (const c of chs) for (let i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i]));
  if (m > 0) { const g = peak / m; for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= g; }
  // 1.5 ms fade-out tail to avoid clicks
  for (const c of chs) { const f = Math.min(c.length, 64); for (let i = 0; i < f; i++) c[c.length - 1 - i] *= i / f; }
  return chs;
}

export function kick(sr: number, p: SynthParams = {}): Channels {
  const f0 = Number(p.f0 ?? 150), f1 = Number(p.f1 ?? 48), dec = Number(p.decay ?? 0.32), click = Number(p.click ?? 0.6), drive = Number(p.drive ?? 1.6);
  const len = dec * 4 + 0.05; const o = buf(sr, len); let ph = 0; const lp = new OnePole(lpCoef(3000, sr));
  for (let i = 0; i < o.length; i++) {
    const t = i / sr; const f = f1 + (f0 - f1) * Math.exp(-t / 0.035);
    ph += 2 * Math.PI * f / sr;
    let x = Math.sin(ph) * env(t, 0.001, dec);
    x += click * lp.lp(rnd()) * Math.exp(-t / 0.004);
    o[i] = sat(x, drive);
  }
  return normalize([o]);
}

export function snare(sr: number, p: SynthParams = {}): Channels {
  const tone = Number(p.tone ?? 190), dec = Number(p.decay ?? 0.18), snap = Number(p.snap ?? 0.8), bright = Number(p.bright ?? 5000);
  const o = buf(sr, dec * 4 + 0.05); const bp = new Biquad('bp', bright, 0.7, sr); const hp = new Biquad('hp', 900, 0.7, sr);
  let ph1 = 0, ph2 = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr; const pf = 1 + 0.5 * Math.exp(-t / 0.01);
    ph1 += 2 * Math.PI * tone * pf / sr; ph2 += 2 * Math.PI * tone * 1.62 * pf / sr;
    const body = (Math.sin(ph1) * 0.7 + Math.sin(ph2) * 0.35) * env(t, 0.001, 0.05);
    const nz = hp.run(bp.run(rnd()) * 2.2) * env(t, 0.001, dec) * snap;
    o[i] = sat(body + nz, 1.3);
  }
  return normalize([o]);
}

export function clap(sr: number, p: SynthParams = {}): Channels {
  const dec = Number(p.decay ?? 0.22), fc = Number(p.fc ?? 1300), spread = Number(p.spread ?? 0.011);
  const L = buf(sr, dec * 4 + 0.08), R = buf(sr, dec * 4 + 0.08);
  const bpL = new Biquad('bp', fc, 1.4, sr), bpR = new Biquad('bp', fc * 1.06, 1.4, sr);
  const bursts = [0, spread, spread * 2.1, spread * 3.0];
  for (let i = 0; i < L.length; i++) {
    const t = i / sr; let e = 0;
    for (let b = 0; b < bursts.length; b++) { const tt = t - bursts[b]; if (tt >= 0) e += (b === bursts.length - 1 ? env(tt, 0.0005, dec) : Math.exp(-tt / 0.006)); }
    const n1 = rnd(), n2 = rnd();
    L[i] = bpL.run(n1 * 0.8 + n2 * 0.2) * e * 3; R[i] = bpR.run(n2 * 0.8 + n1 * 0.2) * e * 3;
  }
  return normalize([L, R]);
}

export function hat(sr: number, p: SynthParams = {}): Channels {
  const dec = Number(p.decay ?? 0.05), fc = Number(p.fc ?? 8000);
  const o = buf(sr, dec * 5 + 0.03); const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21]; const base = Number(p.base ?? 330);
  const ph = ratios.map(() => Math.random()); const hp = new Biquad('hp', fc, 0.8, sr); const bp = new Biquad('bp', fc * 1.2, 0.6, sr);
  for (let i = 0; i < o.length; i++) {
    const t = i / sr; let x = 0;
    for (let k = 0; k < ratios.length; k++) { ph[k] += base * ratios[k] / sr; x += (ph[k] % 1) < 0.5 ? 1 : -1; }
    x = x / ratios.length + rnd() * 0.35;
    o[i] = hp.run(bp.run(x)) * env(t, 0.0005, dec);
  }
  return normalize([o], 0.8);
}

export function cymbal(sr: number, p: SynthParams = {}): Channels {
  const dec = Number(p.decay ?? 1.4), fc = Number(p.fc ?? 6000), bell = Number(p.bell ?? 0);
  const L = buf(sr, dec * 3.5), R = buf(sr, dec * 3.5); const ratios = [1, 1.483, 1.932, 2.546, 2.63, 3.897];
  const ph = ratios.map(() => Math.random()); const hpL = new Biquad('hp', fc, 0.7, sr), hpR = new Biquad('hp', fc * 0.92, 0.7, sr);
  for (let i = 0; i < L.length; i++) {
    const t = i / sr; let x = 0;
    for (let k = 0; k < ratios.length; k++) { ph[k] += 420 * ratios[k] / sr; x += (ph[k] % 1) < 0.5 ? 1 : -1; }
    const e = env(t, 0.002, dec); const b = bell * Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t / 0.4);
    L[i] = hpL.run(x / 6 * 0.6 + rnd() * 0.5) * e + b; R[i] = hpR.run(x / 6 * 0.6 + rnd() * 0.5) * e + b;
  }
  return normalize([L, R], 0.75);
}

export function tom(sr: number, p: SynthParams = {}): Channels {
  const f = Number(p.f ?? 140), dec = Number(p.decay ?? 0.35);
  const o = buf(sr, dec * 4); let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr; ph += 2 * Math.PI * f * (1 + 0.6 * Math.exp(-t / 0.04)) / sr;
    o[i] = sat(Math.sin(ph) * env(t, 0.001, dec) + rnd() * 0.15 * Math.exp(-t / 0.01), 1.4);
  }
  return normalize([o]);
}

export function rim(sr: number, p: SynthParams = {}): Channels {
  const o = buf(sr, 0.12); const bp = new Biquad('bp', Number(p.fc ?? 1700), 6, sr);
  for (let i = 0; i < o.length; i++) { const t = i / sr; o[i] = bp.run((i < 20 ? 1 : 0) + rnd() * 0.3 * Math.exp(-t / 0.003)) * 6 * Math.exp(-t / 0.03); }
  return normalize([o]);
}

export function cowbell(sr: number, p: SynthParams = {}): Channels {
  const o = buf(sr, 0.5); const bp = new Biquad('bp', 900, 2.5, sr); let a = 0, b = 0; const f = Number(p.f ?? 562);
  for (let i = 0; i < o.length; i++) { const t = i / sr; a += f / sr; b += f * 1.5 / sr;
    const x = ((a % 1) < 0.5 ? 1 : -1) + ((b % 1) < 0.5 ? 1 : -1); o[i] = bp.run(x) * env(t, 0.001, 0.09); }
  return normalize([o]);
}

export function shaker(sr: number, p: SynthParams = {}): Channels {
  const dur = Number(p.dur ?? 0.12); const o = buf(sr, dur + 0.05); const hp = new Biquad('hp', 5500, 0.7, sr);
  for (let i = 0; i < o.length; i++) { const t = i / sr; const e = Math.sin(Math.PI * Math.min(1, t / dur)) ** 2 * (t < dur ? 1 : 0); o[i] = hp.run(rnd()) * e; }
  return normalize([o], 0.6);
}

export function tambourine(sr: number, p: SynthParams = {}): Channels {
  const dec = Number(p.decay ?? 0.18); const L = buf(sr, dec * 4), R = buf(sr, dec * 4);
  const bpL = new Biquad('bp', 7800, 3, sr), bpR = new Biquad('bp', 9100, 3, sr);
  for (let i = 0; i < L.length; i++) { const t = i / sr; const jingle = 1 + 0.5 * Math.sin(2 * Math.PI * 38 * t);
    const e = env(t, 0.002, dec) * jingle; L[i] = bpL.run(rnd()) * e * 3; R[i] = bpR.run(rnd()) * e * 3; }
  return normalize([L, R], 0.7);
}

export function conga(sr: number, p: SynthParams = {}): Channels {
  const f = Number(p.f ?? 300); const o = buf(sr, 0.45); let ph = 0;
  for (let i = 0; i < o.length; i++) { const t = i / sr; ph += 2 * Math.PI * f * (1 + 0.25 * Math.exp(-t / 0.015)) / sr;
    o[i] = Math.sin(ph) * env(t, 0.001, 0.11) + rnd() * 0.25 * Math.exp(-t / 0.002); }
  return normalize([o]);
}

export function snap(sr: number): Channels {
  const o = buf(sr, 0.12); const bp = new Biquad('bp', 2800, 2, sr);
  for (let i = 0; i < o.length; i++) { const t = i / sr; o[i] = bp.run(rnd()) * Math.exp(-t / 0.018) * 3; }
  return normalize([o]);
}

const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export function bass808(sr: number, p: SynthParams = {}): Channels {
  const note = Number(p.note ?? 36), dec = Number(p.decay ?? 0.9), drive = Number(p.drive ?? 2.2);
  const f = midiHz(note); const o = buf(sr, dec * 3); let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr; ph += 2 * Math.PI * f * (1 + 1.5 * Math.exp(-t / 0.018)) / sr;
    o[i] = sat(Math.sin(ph) * env(t, 0.002, dec), drive);
  }
  return normalize([o]);
}

/** Tonewheel-ish additive chord (drawbars 888000000-style). */
export function organ(sr: number, p: SynthParams = {}): Channels {
  const root = Number(p.note ?? 55), dur = Number(p.dur ?? 0.8), chord = String(p.chord ?? '0,4,7,10').split(',').map(Number);
  const L = buf(sr, dur + 0.3), R = buf(sr, dur + 0.3); const harm = [0.5, 1, 1.5, 2, 3, 4]; const lvl = [1, 1, 0.8, 0.5, 0.25, 0.15];
  const lp = new OnePole(lpCoef(5000, sr));
  for (let i = 0; i < L.length; i++) {
    const t = i / sr; let x = 0;
    for (const c of chord) { const f = midiHz(root + c); for (let h = 0; h < harm.length; h++) x += Math.sin(2 * Math.PI * f * harm[h] * t) * lvl[h]; }
    x /= chord.length * 3;
    const e = (t < 0.004 ? t / 0.004 : 1) * (t > dur ? Math.exp(-(t - dur) / 0.06) : 1);
    const click = t < 0.003 ? rnd() * 0.3 : 0;
    const lesL = 1 + 0.25 * Math.sin(2 * Math.PI * 6.2 * t), lesR = 1 + 0.25 * Math.sin(2 * Math.PI * 6.2 * t + 1.6);
    const y = lp.lp(sat(x * e + click, 1.5));
    L[i] = y * lesL; R[i] = y * lesR;
  }
  return normalize([L, R], 0.8);
}

export function riser(sr: number, p: SynthParams = {}): Channels {
  const dur = Number(p.dur ?? 2); const L = buf(sr, dur + 0.1), R = buf(sr, dur + 0.1);
  const bpL = new Biquad('bp', 300, 3, sr), bpR = new Biquad('bp', 300, 3, sr); let ph = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr, k = Math.min(1, t / dur); const fc = 200 * Math.pow(60, k);
    if (i % 32 === 0) { bpL.set('bp', fc, 3, sr); bpR.set('bp', fc * 1.03, 3, sr); }
    ph += 2 * Math.PI * (110 * Math.pow(8, k)) / sr; const tone = Math.sin(ph) * 0.15;
    const e = k * k * (t > dur ? Math.exp(-(t - dur) / 0.02) : 1);
    L[i] = (bpL.run(rnd()) * 2 + tone) * e; R[i] = (bpR.run(rnd()) * 2 + tone) * e;
  }
  return normalize([L, R], 0.8);
}

export function subDrop(sr: number, p: SynthParams = {}): Channels {
  const dur = Number(p.dur ?? 1.6); const o = buf(sr, dur); let ph = 0;
  for (let i = 0; i < o.length; i++) { const t = i / sr; ph += 2 * Math.PI * (30 + 120 * Math.exp(-t / 0.35)) / sr; o[i] = sat(Math.sin(ph) * env(t, 0.003, dur / 3), 1.8); }
  return normalize([o]);
}

export function impact(sr: number): Channels {
  const L = buf(sr, 2.5), R = buf(sr, 2.5); let ph = 0; const lpL = new OnePole(lpCoef(1800, sr)), lpR = new OnePole(lpCoef(1600, sr));
  for (let i = 0; i < L.length; i++) { const t = i / sr; ph += 2 * Math.PI * (40 + 90 * Math.exp(-t / 0.06)) / sr;
    const boom = Math.sin(ph) * env(t, 0.001, 0.5); const nz = env(t, 0.001, 0.6);
    L[i] = sat(boom + lpL.lp(rnd()) * nz * 0.9, 2); R[i] = sat(boom + lpR.lp(rnd()) * nz * 0.9, 2); }
  return normalize([L, R]);
}

export function reverseCymbal(sr: number, p: SynthParams = {}): Channels {
  const c = cymbal(sr, { decay: Number(p.decay ?? 0.7) });
  return normalize(c.map((ch) => { const r = new Float32Array(ch.length); for (let i = 0; i < ch.length; i++) r[i] = ch[ch.length - 1 - i]; return r; }), 0.8);
}

export function zap(sr: number): Channels {
  const o = buf(sr, 0.35); let ph = 0;
  for (let i = 0; i < o.length; i++) { const t = i / sr; ph += 2 * Math.PI * (2500 * Math.exp(-t / 0.05) + 80) / sr; o[i] = ((ph / Math.PI) % 2 < 1 ? 0.6 : -0.6) * env(t, 0.001, 0.08); }
  return normalize([o], 0.6);
}

export function swell(sr: number, p: SynthParams = {}): Channels {
  const root = Number(p.note ?? 48), dur = Number(p.dur ?? 2.5); const chord = [0, 7, 12, 16, 19, 23];
  const L = buf(sr, dur + 0.5), R = buf(sr, dur + 0.5); const lpL = new OnePole(lpCoef(800, sr)), lpR = new OnePole(lpCoef(800, sr));
  for (let i = 0; i < L.length; i++) { const t = i / sr; let a = 0, b = 0;
    for (const c of chord) { const f = midiHz(root + c); a += Math.sin(2 * Math.PI * f * 1.002 * t) + 0.3 * Math.sin(4 * Math.PI * f * t); b += Math.sin(2 * Math.PI * f * 0.998 * t) + 0.3 * Math.sin(4 * Math.PI * f * t); }
    const e = Math.sin(Math.PI * Math.min(1, t / dur)) ** 1.5;
    if (i % 64 === 0) { const fc = 400 + 3000 * e; lpL.a = lpCoef(fc, sr); lpR.a = lpCoef(fc, sr); }
    L[i] = lpL.lp(a) * e; R[i] = lpR.lp(b) * e; }
  return normalize([L, R], 0.7);
}

export function noiseSweep(sr: number, p: SynthParams = {}): Channels {
  const dur = Number(p.dur ?? 1.2); const o = buf(sr, dur); const bp = new Biquad('bp', 4000, 2, sr);
  for (let i = 0; i < o.length; i++) { const t = i / sr, k = t / dur; if (i % 32 === 0) bp.set('bp', 8000 * Math.pow(0.03, k) + 100, 2, sr); o[i] = bp.run(rnd()) * (1 - k) * 2; }
  return normalize([o], 0.7);
}

export function click(sr: number, p: SynthParams = {}): Channels {
  const f = Number(p.f ?? 1500); const o = buf(sr, 0.04);
  for (let i = 0; i < o.length; i++) { const t = i / sr; o[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.008); }
  return normalize([o], 0.6);
}

export const GENERATORS: Record<string, (sr: number, p: SynthParams) => Channels> = {
  kick, snare, clap, hat, cymbal, tom, rim, cowbell, shaker, tambourine, conga, snap: (sr) => snap(sr),
  bass808, organ, riser, subDrop, impact: (sr) => impact(sr), reverseCymbal, zap: (sr) => zap(sr), swell, noiseSweep, click,
};
