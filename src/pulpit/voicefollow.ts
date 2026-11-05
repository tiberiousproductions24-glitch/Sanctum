// Sanctum Pulpit — Voice Follow browser controller. Pure DSP lives in follow-core.ts.
import { detectPitch, MicKeyDetector, type KeyResult } from './keydetect';
import { mod12, type Key } from './theory';
import { CadenceTracker, pickChordForNote, NOTE } from './follow-core';

export { CadenceTracker, pickChordForNote, analyseFollowSignal, NOTE } from './follow-core';

export interface FollowMeter {
  level: number;
  note: string | null;
  midi: number | null;
  wpm: number;
  onsetsPerSec: number;
  action: string;
  phraseEnd: boolean;
  confidence: number;
}

export class VoiceFollow {
  meter: FollowMeter = { level: 0, note: null, midi: null, wpm: 0, onsetsPerSec: 0, action: 'Off', phraseEnd: false, confidence: 0 };
  cadence = new CadenceTracker();
  sensitivity = 0.55;
  enabled = false;
  ctx: AudioContext;
  getKey: () => Key;
  getCandidates: () => string[];
  private stream: MediaStream | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private an: AnalyserNode | null = null;
  private timer = 0;
  private t0 = 0;
  private levelHist = 0;
  private shoutHold = 0;
  private worshipHold = 0;
  private lastChordAt = 0;
  private keyDetector: MicKeyDetector | null = null;
  onMeter?: (m: FollowMeter) => void;
  onPhraseEnd?: (info: { wpm: number; intensity: number }) => void;
  onPitchChord?: (info: { token: string; midi: number; name: string }) => void;
  onLevelSuggest?: (lane: 'shout' | 'worship' | 'none', level: number) => void;
  onTempoHint?: (bpm: number) => void;
  onKeyGuess?: (r: KeyResult) => void;
  lastError: string | null = null;

  constructor(ctx: AudioContext, getKey: () => Key, getCandidates: () => string[]) {
    this.ctx = ctx; this.getKey = getKey; this.getCandidates = getCandidates;
  }

  get running() { return !!this.stream || !!this.an; }

  async start(): Promise<boolean> {
    this.lastError = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.lastError = 'Microphone needs a secure page (https) and getUserMedia.';
      this.meter.action = 'No mic API'; this.onMeter?.(this.meter); return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as MediaTrackConstraints,
      });
    } catch (e) {
      this.lastError = (e as Error).message || 'Mic permission denied';
      this.meter.action = 'Mic blocked — tap to retry'; this.onMeter?.(this.meter); return false;
    }
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.an = this.ctx.createAnalyser(); this.an.fftSize = 2048; this.an.smoothingTimeConstant = 0.2;
    this.src.connect(this.an);
    this.cadence.reset(); this.cadence.sensitivity = this.sensitivity;
    this.t0 = this.ctx.currentTime; this.enabled = true;
    this.keyDetector = new MicKeyDetector(this.ctx);
    this.meter.action = 'Listening — keep speakers away from the mic';
    this.loop();
    return true;
  }

  attachAnalyser(an: AnalyserNode) {
    this.an = an; this.enabled = true; this.cadence.reset(); this.cadence.sensitivity = this.sensitivity;
    this.t0 = this.ctx.currentTime; this.meter.action = 'Listening (injected)'; this.loop();
  }

  stop() {
    this.enabled = false; clearInterval(this.timer); this.timer = 0;
    try { this.src?.disconnect(); } catch {}
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.src = null; this.an = null;
    this.keyDetector?.stop(); this.keyDetector = null;
    this.meter = { ...this.meter, action: 'Off', level: 0, phraseEnd: false };
    this.onMeter?.(this.meter);
  }

  setSensitivity(v: number) {
    this.sensitivity = Math.max(0, Math.min(1, v));
    this.cadence.sensitivity = this.sensitivity;
  }

  private loop() {
    clearInterval(this.timer);
    const td = new Float32Array(2048);
    this.timer = window.setInterval(() => {
      if (!this.enabled || !this.an) return;
      this.an.getFloatTimeDomainData(td);
      let rms = 0; for (let i = 0; i < td.length; i++) rms += td[i] * td[i];
      rms = Math.sqrt(rms / td.length);
      this.levelHist = this.levelHist * 0.85 + rms * 0.15;
      const t = this.ctx.currentTime - this.t0;
      const cad = this.cadence.feed(rms, t);
      let midi: number | null = null; let note: string | null = null;
      const gate = 0.012 + (1 - this.sensitivity) * 0.04;
      if (rms > gate) {
        const p = detectPitch(td, this.ctx.sampleRate);
        if (p && p.clarity > 0.7) {
          midi = Math.round(69 + 12 * Math.log2(p.hz / 440));
          note = NOTE[mod12(midi)];
          if (t - this.lastChordAt > 0.35) {
            const pick = pickChordForNote(midi, this.getKey(), this.getCandidates());
            this.lastChordAt = t;
            this.meter.action = `Chord ${pick.token} ← ${pick.name}`;
            this.onPitchChord?.(pick);
          }
        }
      }
      const intensity = this.cadence.intensityFromRate(cad.onsetsPerSec);
      if (intensity > 0.62) { this.shoutHold = Math.min(4, this.shoutHold + 0.15); this.worshipHold = Math.max(0, this.worshipHold - 0.2); }
      else if (intensity < 0.28) { this.worshipHold = Math.min(4, this.worshipHold + 0.12); this.shoutHold = Math.max(0, this.shoutHold - 0.2); }
      else { this.shoutHold = Math.max(0, this.shoutHold - 0.05); this.worshipHold = Math.max(0, this.worshipHold - 0.05); }
      if (this.shoutHold >= 1.2) this.onLevelSuggest?.('shout', Math.min(4, Math.round(this.shoutHold)));
      else if (this.worshipHold >= 1.2) this.onLevelSuggest?.('worship', Math.min(4, Math.round(this.worshipHold)));
      else if (this.shoutHold < 0.4 && this.worshipHold < 0.4) this.onLevelSuggest?.('none', 0);

      if (cad.phraseEnd) {
        this.meter.action = 'Phrase end → hit';
        this.onPhraseEnd?.({ wpm: cad.wpm, intensity });
      }
      if (cad.onsetsPerSec > 1.2 && cad.onsetsPerSec < 8) {
        const bpmHint = Math.round(cad.onsetsPerSec * 30);
        if (bpmHint >= 50 && bpmHint <= 180) this.onTempoHint?.(bpmHint);
      }
      if (this.keyDetector && midi != null) {
        this.keyDetector.acc.addPitch(440 * Math.pow(2, (midi - 69) / 12), 0.5);
        this.onKeyGuess?.(this.keyDetector.acc.result());
      }
      this.meter = {
        level: this.levelHist, note, midi, wpm: Math.round(cad.wpm),
        onsetsPerSec: Math.round(cad.onsetsPerSec * 100) / 100,
        action: this.meter.action, phraseEnd: cad.phraseEnd,
        confidence: midi != null ? 0.8 : Math.min(1, cad.onsetsPerSec / 4),
      };
      this.onMeter?.(this.meter);
    }, 50);
  }
}
