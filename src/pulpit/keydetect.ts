// Sanctum Pulpit: key detection. The pure DSP here (FFT, chroma, YIN-style pitch, Krumhansl-Schmuckler)
// has no imports and also runs under node for tests. MicKeyDetector is the browser wrapper
// (getUserMedia → AnalyserNode).

export const KEY_LABELS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
// Krumhansl-Kessler probe-tone profiles (Krumhansl 1990).
export const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface KeyGuess { tonic: number; mode: 'major' | 'minor'; name: string; r: number }
export interface KeyResult { best: KeyGuess; ranking: KeyGuess[]; confidence: number; chroma: number[]; energy: number }

/** In-place iterative radix-2 FFT. re/im length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/** Magnitude spectrum (Hann window) of a frame, length n/2. Same shape AnalyserNode gives (linear, not dB). */
export function magnitudes(frame: ArrayLike<number>): Float64Array {
  const n = frame.length; const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = frame[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
  fft(re, im);
  const m = new Float64Array(n / 2); for (let i = 0; i < n / 2; i++) m[i] = Math.hypot(re[i], im[i]); return m;
}

/**
 * Pitch-class profile from a magnitude spectrum. Only spectral peaks count (this reduces window leakage),
 * peak frequency is refined by parabolic interpolation, peaks off-pitch by more than ±35 cents are ignored, and
 * each peak is weighted by sqrt(magnitude) so loud fundamentals don't swamp everything.
 */
export function chromaFromSpectrum(mag: ArrayLike<number>, sampleRate: number, fftSize: number, minHz = 55, maxHz = 2500): number[] {
  const c = new Array(12).fill(0);
  const binHz = sampleRate / fftSize;
  let peak = 0; for (let i = 1; i < mag.length; i++) if (mag[i] > peak) peak = mag[i];
  if (peak <= 0) return c;
  const floor = peak * 0.02;
  const lo = Math.max(2, Math.floor(minHz / binHz)), hi = Math.min(mag.length - 2, Math.ceil(maxHz / binHz));
  for (let i = lo; i <= hi; i++) {
    const m = mag[i]; if (m < floor || m < mag[i - 1] || m < mag[i + 1]) continue;
    const a = mag[i - 1], b = m, g = mag[i + 1];
    const d = 0.5 * (a - g) / (a - 2 * b + g || 1e-12);
    const f = (i + d) * binHz;
    const midi = 69 + 12 * Math.log2(f / 440); const nearest = Math.round(midi);
    if (Math.abs(midi - nearest) > 0.35) continue;
    // de-emphasise higher partials a little (they echo the fundamental's 5th/3rd)
    const w = Math.sqrt(m) * (f < 1000 ? 1 : 0.6);
    c[((nearest % 12) + 12) % 12] += w;
  }
  return c;
}

/** YIN-style fundamental estimate of a monophonic frame (voice). Returns Hz and clarity 0..1, or null. */
export function detectPitch(frame: ArrayLike<number>, sampleRate: number, minHz = 70, maxHz = 900): { hz: number; clarity: number } | null {
  const n = frame.length; const maxLag = Math.min(Math.floor(sampleRate / minHz), Math.floor(n / 2)); const minLag = Math.floor(sampleRate / maxHz);
  let rms = 0; for (let i = 0; i < n; i++) rms += frame[i] * frame[i]; rms = Math.sqrt(rms / n);
  if (rms < 0.01) return null;
  const W = n - maxLag; const d = new Float64Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) { let s = 0; for (let i = 0; i < W; i++) { const x = frame[i] - frame[i + lag]; s += x * x; } d[lag] = s; }
  // cumulative mean normalised difference
  let run = 0; const cm = new Float64Array(maxLag + 1); cm[0] = 1;
  for (let lag = 1; lag <= maxLag; lag++) { run += d[lag]; cm[lag] = d[lag] * lag / (run || 1e-12); }
  let best = -1;
  for (let lag = minLag; lag <= maxLag; lag++) { if (cm[lag] < 0.15) { while (lag + 1 <= maxLag && cm[lag + 1] < cm[lag]) lag++; best = lag; break; } }
  if (best < 0) { let mv = Infinity; for (let lag = minLag; lag <= maxLag; lag++) if (cm[lag] < mv) { mv = cm[lag]; best = lag; } if (mv > 0.35) return null; }
  const a = cm[best - 1] ?? cm[best], b = cm[best], g = cm[best + 1] ?? cm[best];
  const shift = 0.5 * (a - g) / (a - 2 * b + g || 1e-12);
  return { hz: sampleRate / (best + (Number.isFinite(shift) ? shift : 0)), clarity: Math.max(0, 1 - b) };
}

function pearson(x: number[], y: number[]) {
  const n = x.length; const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/** Krumhansl-Schmuckler: correlate a chroma vector with all 24 rotated key profiles. */
export function detectKey(chroma: number[]): KeyResult {
  const ranking: KeyGuess[] = [];
  const sum = chroma.reduce((a, b) => a + b, 0) || 1;
  for (let t = 0; t < 12; t++) {
    const rot = (p: number[]) => p.map((_, i) => p[((i - t) % 12 + 12) % 12]);
    let rMaj = pearson(chroma, rot(KK_MAJOR));
    let rMin = pearson(chroma, rot(KK_MINOR));
    // Tie-break same-tonic major/minor by the strength of the minor 3rd vs major 3rd in the chroma.
    // Synthetic and sung minor material often still correlates strongly with the major profile.
    const m3 = chroma[(t + 3) % 12] / sum, M3 = chroma[(t + 4) % 12] / sum;
    if (m3 > M3 * 1.05) rMin += 0.08; else if (M3 > m3 * 1.05) rMaj += 0.08;
    ranking.push({ tonic: t, mode: 'major', name: KEY_LABELS[t], r: rMaj });
    ranking.push({ tonic: t, mode: 'minor', name: KEY_LABELS[t] + 'm', r: rMin });
  }
  ranking.sort((a, b) => b.r - a.r);
  const energy = chroma.reduce((a, b) => a + b, 0);
  // confidence: correlation strength × separation from the runner-up (0..1)
  const gap = ranking[0].r - ranking[1].r;
  const confidence = energy > 0 ? Math.max(0, Math.min(1, ranking[0].r)) * Math.min(1, 0.35 + gap * 6) : 0;
  return { best: ranking[0], ranking, confidence, chroma, energy };
}

/** Leaky accumulator of chroma over time, so the key reflects the last ~N seconds rather than one frame. */
export class ChromaAccumulator {
  acc = new Array(12).fill(0);
  frames = 0;
  halfLifeFrames: number;
  constructor(halfLifeFrames = 80) { this.halfLifeFrames = halfLifeFrames; }
  add(ch: number[], weight = 1) {
    const k = Math.pow(0.5, 1 / this.halfLifeFrames);
    const sum = ch.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < 12; i++) this.acc[i] = this.acc[i] * k + weight * ch[i] / sum;
    this.frames++;
  }
  addPitch(hz: number, weight = 1) {
    const midi = Math.round(69 + 12 * Math.log2(hz / 440)); const v = new Array(12).fill(0); v[((midi % 12) + 12) % 12] = 1; this.add(v, weight);
  }
  reset() { this.acc.fill(0); this.frames = 0; }
  result(): KeyResult { return detectKey(this.acc.slice()); }
}

/** Offline helper (used by tests): analyse a whole mono signal in hops and return the key. */
export function analyseSignal(sig: Float32Array | Float64Array, sampleRate: number, fftSize = 8192, hop = 4096, usePitch = true): KeyResult {
  // Prefer recent frames (phrase endings / cadences) — monophonic whoops and hummed lines often
  // dwell on the fifth mid-phrase and only land on the tonic at the end.
  const acc = new ChromaAccumulator(Math.max(4, Math.floor((sig.length / hop) / 3)));
  const frame = new Float64Array(fftSize);
  const last = Math.max(0, sig.length - fftSize);
  for (let s = 0; s + fftSize <= sig.length; s += hop) {
    for (let i = 0; i < fftSize; i++) frame[i] = sig[s + i];
    const endW = 1 + 2.5 * (s / (last || 1)); // up to 3.5× weight on the final hop
    acc.add(chromaFromSpectrum(magnitudes(frame), sampleRate, fftSize), endW);
    if (usePitch) {
      const p = detectPitch(frame.subarray(0, 2048), sampleRate);
      if (p && p.clarity > 0.8) {
        acc.addPitch(p.hz, 0.45 * endW);
        // Weak tonic hint: a sustained fifth often implies a tonic a fifth below.
        const midi = 69 + 12 * Math.log2(p.hz / 440);
        const fifthDown = 440 * Math.pow(2, (midi - 7 - 69) / 12);
        acc.addPitch(fifthDown, 0.15 * endW);
      }
    }
  }
  return acc.result();
}

/** Browser: listen to the mic and report the key every ~150 ms. */
export class MicKeyDetector {
  ctx: AudioContext; stream: MediaStream | null = null; src: MediaStreamAudioSourceNode | null = null; an: AnalyserNode | null = null;
  acc = new ChromaAccumulator(60); timer = 0; level = 0;
  onResult?: (r: KeyResult, level: number) => void;
  constructor(ctx: AudioContext) { this.ctx = ctx; }
  get running() { return !!this.stream; }
  async start() {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone needs a secure page (https) and a browser with getUserMedia.');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } as MediaTrackConstraints });
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.an = this.ctx.createAnalyser(); this.an.fftSize = 8192; this.an.smoothingTimeConstant = 0;
    this.src.connect(this.an);      // analysis only: never routed to the speakers (no feedback)
    this.acc.reset();
    const fd = new Float32Array(this.an.frequencyBinCount); const td = new Float32Array(this.an.fftSize); const mag = new Float64Array(fd.length);
    this.timer = window.setInterval(() => {
      const an = this.an!; an.getFloatFrequencyData(fd); an.getFloatTimeDomainData(td);
      let rms = 0; for (let i = 0; i < td.length; i++) rms += td[i] * td[i]; rms = Math.sqrt(rms / td.length); this.level = rms;
      if (rms > 0.006) {
        for (let i = 0; i < fd.length; i++) mag[i] = Math.pow(10, fd[i] / 20);
        this.acc.add(chromaFromSpectrum(mag, this.ctx.sampleRate, an.fftSize), Math.min(1, rms * 20));
        const p = detectPitch(td.subarray(0, 2048), this.ctx.sampleRate); if (p && p.clarity > 0.8) this.acc.addPitch(p.hz, 0.6);
      }
      this.onResult?.(this.acc.result(), rms);
    }, 150);
  }
  stop() {
    clearInterval(this.timer); this.timer = 0;
    try { this.src?.disconnect(); } catch {}
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null; this.src = null; this.an = null;
  }
}
