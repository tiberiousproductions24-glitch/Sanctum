// Sanctum AudioWorklet engine — sample-offset scheduled sampler voices.
// Every trigger carries an absolute frame number (`at`); voices start at the exact sample
// offset inside the 128-frame render quantum (never quantized to buffer boundaries).
// Also hosts the Timing Lab loopback measurement (impulse out -> mic/line in, same clock).
const MAX_VOICES = 96;
const FADE_FRAMES = 96; // ~2ms de-click fade for chokes/stops

class SanctumProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Map();   // id -> { ch: Float32Array[], len, sr }
    this.voices = [];
    this.queue = [];            // pending events sorted by `at`
    this.master = 0.85;
    this.late = 0;              // events that arrived after their frame
    this.peak = 0;
    this.blocks = 0;
    this.measure = null;
    this.lastStat = 0;
    this.port.onmessage = (e) => this.onMessage(e.data);
  }

  onMessage(m) {
    switch (m.t) {
      case 'sample':
        this.samples.set(m.id, { ch: m.ch, len: m.ch[0].length, sr: m.sr || sampleRate });
        break;
      case 'trig': case 'stop': case 'rate':
        this.insert(m);
        break;
      case 'stopAll':
        for (const v of this.voices) v.fade = FADE_FRAMES;
        this.queue = this.queue.filter((q) => q.t !== 'trig');
        break;
      case 'master':
        this.master = m.v;
        break;
      case 'measure':
        // { at, frames, thr } -> emit a short impulse at frame `at`, record input for `frames`
        this.measure = { at: m.at, frames: m.frames, buf: new Float32Array(m.frames), n: 0, noise: 0, noiseN: 0, id: m.id };
        break;
    }
  }

  insert(m) {
    const q = this.queue;
    let i = q.length;
    while (i > 0 && q[i - 1].at > m.at) i--;
    q.splice(i, 0, m);
  }

  startVoice(m, offset) {
    const s = this.samples.get(m.id);
    if (!s) return;
    if (m.choke) {
      for (const v of this.voices) if (v.choke === m.choke && !v.fade) { v.fade = FADE_FRAMES; v.fadeStart = offset; }
    }
    if (m.mono) { // retrigger same key cuts previous (e.g. loop restarts)
      for (const v of this.voices) if (v.key === m.key && !v.fade) { v.fade = FADE_FRAMES; v.fadeStart = offset; }
    }
    if (this.voices.length >= MAX_VOICES) this.voices.shift();
    const g = (m.gain ?? 1) * (m.vel ?? 1);
    const pan = Math.max(-1, Math.min(1, m.pan || 0));
    this.voices.push({
      s, pos: 0, rate: (m.rate || 1) * (s.sr / sampleRate), loop: !!m.loop,
      gl: g * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2,
      gr: g * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2,
      key: m.key, choke: m.choke, start: offset, fade: 0, fadeStart: 0, srcRate: s.sr / sampleRate,
    });
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    const n = L.length;
    const f0 = currentFrame;
    const f1 = f0 + n;

    // dispatch due events
    const q = this.queue;
    while (q.length && q[0].at < f1) {
      const m = q.shift();
      let off = m.at - f0;
      if (off < 0) { if (m.at > 0 && off < -n) this.late++; off = 0; }
      off = Math.floor(off);
      if (m.t === 'trig') this.startVoice(m, off);
      else if (m.t === 'stop') {
        for (const v of this.voices) if ((m.key == null || v.key === m.key) && (m.choke == null || v.choke === m.choke) && !v.fade) { v.fade = FADE_FRAMES; v.fadeStart = off; }
      } else if (m.t === 'rate') {
        for (const v of this.voices) if (v.key === m.key) v.rate = m.rate * v.srcRate;
      }
    }

    // render voices
    const alive = [];
    for (const v of this.voices) {
      const ch0 = v.s.ch[0], ch1 = v.s.ch[1] || ch0, len = v.s.len;
      let done = false;
      for (let i = v.start; i < n; i++) {
        let p = v.pos;
        if (p >= len) {
          if (v.loop) { p -= len; v.pos = p; } else { done = true; break; }
        }
        const idx = p | 0, fr = p - idx;
        const j = idx + 1 < len ? idx + 1 : (v.loop ? 0 : idx);
        let a = ch0[idx] + (ch0[j] - ch0[idx]) * fr;
        let b = ch1[idx] + (ch1[j] - ch1[idx]) * fr;
        if (v.fade && i >= v.fadeStart) {
          const k = v.fade / FADE_FRAMES; a *= k; b *= k;
          if (--v.fade <= 0) { done = true; break; }
        }
        L[i] += a * v.gl;
        R[i] += b * v.gr;
        v.pos += v.rate;
      }
      v.start = 0; v.fadeStart = 0;
      if (!done) alive.push(v);
    }
    this.voices = alive;

    // Timing Lab loopback
    const ms = this.measure;
    if (ms) {
      const inp = inputs[0] && inputs[0][0];
      for (let i = 0; i < n; i++) {
        const f = f0 + i;
        if (f >= ms.at && f < ms.at + 48) { const s = (f - ms.at) < 24 ? 0.9 : -0.9; L[i] += s; R[i] += s; }
        if (inp) {
          if (f < ms.at && f >= ms.at - 4800) { ms.noise = Math.max(ms.noise, Math.abs(inp[i])); }
          if (f >= ms.at && ms.n < ms.frames) ms.buf[ms.n++] = inp[i];
        }
      }
      if (ms.n >= ms.frames || (!inp && f1 > ms.at + ms.frames)) {
        let hit = -1, max = 0;
        for (let i = 0; i < ms.n; i++) max = Math.max(max, Math.abs(ms.buf[i]));
        const thr = Math.max(ms.noise * 3, max * 0.5, 0.01);
        for (let i = 0; i < ms.n; i++) if (Math.abs(ms.buf[i]) >= thr) { hit = i; break; }
        this.port.postMessage({ t: 'measure', id: ms.id, frames: hit, peak: max, noise: ms.noise, hasInput: !!inp });
        this.measure = null;
      }
    }

    // master + soft clip + meter
    let pk = 0;
    const g = this.master;
    for (let i = 0; i < n; i++) {
      let a = L[i] * g, b = R[i] * g;
      if (a > 1 || a < -1 || b > 1 || b < -1) { a = Math.tanh(a); b = Math.tanh(b); }
      L[i] = a; if (R !== L) R[i] = b;
      const m = a > 0 ? a : -a; if (m > pk) pk = m;
    }
    this.peak = Math.max(pk, this.peak * 0.97);
    if (++this.blocks - this.lastStat >= 32) {
      this.lastStat = this.blocks;
      this.port.postMessage({ t: 'stat', frame: f1, voices: this.voices.length, late: this.late, peak: this.peak, queued: q.length });
    }
    return true;
  }
}
registerProcessor('sanctum-engine', SanctumProcessor);
