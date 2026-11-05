// Live chord detector: getUserMedia → AnalyserNode → chroma match + causal HMM.
import { chromaFromSpectrum, detectKey, KEY_LABELS } from '../pulpit/keydetect';
import {
  matchChroma, causalStep, decodeTemplateIndex, formatChord, bassFromChroma, TEMPLATES,
} from './detect';
import { nextChords, toRoman, parseKeySafe, relativeKey, keyName } from './theory-ext';
import type { DetectedChord, LiveChordState } from './types';
import type { Key } from '../pulpit/theory';

export class LiveChordDetector {
  ctx: AudioContext;
  stream: MediaStream | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private an: AnalyserNode | null = null;
  private timer = 0;
  private prevState = 0;
  private hold: { id: number; n: number; conf: number } = { id: 0, n: 0, conf: 0 };
  private history: DetectedChord[] = [];
  private current: DetectedChord | null = null;
  private key: Key = { tonic: 0, mode: 'major' };
  private keyConf = 0;
  private chromaAcc = new Array(12).fill(0);
  private frames = 0;
  level = 0;
  onUpdate?: (s: LiveChordState) => void;
  /** Require this many agreeing frames before committing a chord change. */
  holdFrames = 3;
  stay = 0.9;
  maxHistory = 24;

  constructor(ctx: AudioContext) { this.ctx = ctx; }
  get running() { return !!this.stream; }

  async start(constraints?: MediaTrackConstraints) {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone needs a secure page (https) and getUserMedia.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: constraints ?? { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    });
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.an = this.ctx.createAnalyser();
    this.an.fftSize = 8192;
    this.an.smoothingTimeConstant = 0;
    this.src.connect(this.an); // analysis only — never to destination
    this.chromaAcc.fill(0); this.frames = 0;
    this.timer = window.setInterval(() => this.tick(), 120);
  }

  stop() {
    clearInterval(this.timer); this.timer = 0;
    try { this.src?.disconnect(); } catch {}
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.src = null; this.an = null;
  }

  setKey(k: Key) { this.key = k; this.emit(); }

  private tick() {
    const an = this.an!;
    const fd = new Float32Array(an.frequencyBinCount);
    const td = new Float32Array(an.fftSize);
    const mag = new Float64Array(fd.length);
    an.getFloatFrequencyData(fd);
    an.getFloatTimeDomainData(td);
    let rms = 0; for (let i = 0; i < td.length; i++) rms += td[i] * td[i];
    rms = Math.sqrt(rms / td.length); this.level = rms;
    if (rms < 0.008) { this.emit(); return; }
    for (let i = 0; i < fd.length; i++) mag[i] = Math.pow(10, fd[i] / 20);
    const chroma = chromaFromSpectrum(mag, this.ctx.sampleRate, an.fftSize, 80, 3000);
    const bassChroma = chromaFromSpectrum(mag, this.ctx.sampleRate, an.fftSize, 40, 250);
    for (let i = 0; i < 12; i++) this.chromaAcc[i] = this.chromaAcc[i] * 0.97 + chroma[i];
    this.frames++;
    if (this.frames % 8 === 0) {
      const kr = detectKey(this.chromaAcc.slice());
      this.key = { tonic: kr.best.tonic, mode: kr.best.mode };
      this.keyConf = kr.confidence;
    }
    const { scores, best, confidence } = matchChroma(chroma, bassChroma);
    const decoded = causalStep(this.prevState, scores, this.stay);
    this.prevState = decoded;
    // Hold / hysteresis
    if (decoded === this.hold.id) { this.hold.n++; this.hold.conf = Math.max(this.hold.conf, confidence); }
    else { this.hold = { id: decoded, n: 1, conf: confidence }; }
    if (this.hold.n >= this.holdFrames && confidence > 0.2) {
      const { root, quality, suffix } = decodeTemplateIndex(this.hold.id);
      let bass = bassFromChroma(bassChroma);
      const mask = TEMPLATES.find((t) => t.quality === quality)!.mask;
      const tones = new Set<number>();
      for (let p = 0; p < 12; p++) if (mask[p]) tones.add((root + p) % 12);
      if (!tones.has(bass) || bassChroma[bass] < bassChroma[root] * 1.2) bass = root;
      const label = formatChord(root, suffix, bass, true);
      const now = this.ctx.currentTime;
      if (!this.current || this.current.label !== label) {
        if (this.current) {
          this.current.end = now;
          this.history.unshift({ ...this.current });
          if (this.history.length > this.maxHistory) this.history.length = this.maxHistory;
        }
        const roman = toRoman(root, quality, this.key);
        this.current = {
          label, root, quality, bass, confidence: this.hold.conf,
          start: now, end: now, roman,
        };
      } else {
        this.current.confidence = this.hold.conf;
        this.current.end = now;
        this.current.roman = toRoman(root, quality, this.key);
      }
    }
    this.emit();
  }

  private emit() {
    const roman = this.current?.roman || (this.key.mode === 'minor' ? 'i' : 'I');
    const nextLikely = nextChords(roman === 'N' ? (this.key.mode === 'minor' ? 'i' : 'I') : roman, this.key, 3);
    this.onUpdate?.({
      current: this.current,
      history: this.history.slice(),
      key: { tonic: this.key.tonic, mode: this.key.mode, name: keyName(this.key), confidence: this.keyConf },
      level: this.level,
      nextLikely,
    });
  }

  snapshot(): LiveChordState {
    const roman = this.current?.roman || 'I';
    return {
      current: this.current,
      history: this.history.slice(),
      key: { tonic: this.key.tonic, mode: this.key.mode, name: keyName(this.key), confidence: this.keyConf },
      level: this.level,
      nextLikely: nextChords(roman, this.key, 3),
    };
  }
}

export { KEY_LABELS, parseKeySafe, relativeKey, keyName };
