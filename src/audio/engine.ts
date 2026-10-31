// Sanctum audio engine. Primary path: AudioWorklet (public/sanctum-worklet.js) with
// sample-offset scheduling. Fallback (non-secure contexts / old browsers): AudioBufferSourceNode
// scheduled with start(when) — also sample-accurate, just more garbage per hit.

export interface Trig {
  at: number;          // AudioContext time (s). <= currentTime means "as soon as possible"
  id: string;          // sample id
  vel: number;         // 0..1 linear gain from velocity curve
  gain?: number; pan?: number; rate?: number; loop?: boolean;
  choke?: string; key?: string; mono?: boolean;
}
export interface EngineStats { voices: number; late: number; peak: number; frame: number; queued: number }
export interface LatencyInfo { base: number; output: number; sampleRate: number; hint: number | string; mode: string; state: string }

type Sample = { ch: Float32Array[]; sr: number };

export class Engine {
  ctx: AudioContext | null = null;
  node: AudioWorkletNode | null = null;
  mode: 'worklet' | 'buffer' | 'none' = 'none';
  hint: number | string = 'interactive';
  samples = new Map<string, Sample>();
  stats: EngineStats = { voices: 0, late: 0, peak: 0, frame: 0, queued: 0 };
  onStats?: (s: EngineStats) => void;
  onRecreate: ((sampleRateChanged: boolean) => void)[] = [];
  private buffers = new Map<string, AudioBuffer>();
  private master: GainNode | null = null;
  private active: { src: AudioBufferSourceNode; g: GainNode; key?: string; choke?: string }[] = [];
  private measureCb = new Map<number, (r: any) => void>();
  private measureId = 1;
  private micSource: MediaStreamAudioSourceNode | null = null;
  masterGain = 0.85;
  error: string | null = null;

  get sampleRate() { return this.ctx?.sampleRate ?? 48000; }
  get now() { return this.ctx?.currentTime ?? 0; }

  async init(hint: number | string = this.hint) {
    const prevSr = this.ctx?.sampleRate;
    await this.close();
    this.hint = hint;
    const Ctx: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
    const latencyHint = (typeof hint === 'number' && hint <= 0) ? 'interactive' : hint as any;
    try { this.ctx = new Ctx({ latencyHint }); }
    catch { this.ctx = new Ctx(); }
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = 1; this.master.connect(ctx.destination);
    this.mode = 'buffer';
    if (ctx.audioWorklet && window.isSecureContext !== false) {
      try {
        await ctx.audioWorklet.addModule(new URL('sanctum-worklet.js', document.baseURI).href);
        this.node = new AudioWorkletNode(ctx, 'sanctum-engine', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
        this.node.connect(this.master);
        this.node.port.onmessage = (e) => this.onWorklet(e.data);
        this.mode = 'worklet';
      } catch (e) { this.error = 'AudioWorklet failed, using fallback: ' + (e as Error).message; console.warn(this.error); }
    }
    this.setMaster(this.masterGain);
    // re-upload samples (resampling is handled by per-sample sr in both paths)
    this.buffers.clear();
    for (const [id, s] of this.samples) this.upload(id, s);
    const changed = prevSr != null && prevSr !== ctx.sampleRate;
    for (const cb of this.onRecreate) cb(changed);
    if (!(window as any).__sanctumStatsTimer && this.mode === 'buffer') {
      (window as any).__sanctumStatsTimer = setInterval(() => {
        this.active = this.active.filter((a) => (a as any).alive !== false);
        this.stats = { ...this.stats, voices: this.active.length, frame: Math.round(this.now * this.sampleRate) };
        this.onStats?.(this.stats);
      }, 100);
    }
  }

  async close() {
    if (!this.ctx) return;
    try { this.node?.disconnect(); } catch {}
    try { await this.ctx.close(); } catch {}
    this.ctx = null; this.node = null; this.active = []; this.micSource = null;
  }

  async resume() { if (this.ctx && this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch {} } }

  latency(): LatencyInfo {
    const c = this.ctx as any;
    return { base: c?.baseLatency ?? 0, output: c?.outputLatency ?? 0, sampleRate: this.sampleRate, hint: this.hint, mode: this.mode, state: c?.state ?? 'closed' };
  }

  /** performance.now() ms -> context time of what is AUDIBLE at that moment. */
  perfToCtx(perfMs: number): number {
    const c = this.ctx; if (!c) return 0;
    const ts = (c as any).getOutputTimestamp?.();
    if (ts && ts.performanceTime > 0) return ts.contextTime + (perfMs - ts.performanceTime) / 1000;
    const l = this.latency();
    return c.currentTime - l.base - l.output + (perfMs - performance.now()) / 1000;
  }
  /** context time -> performance.now() ms at which that sample is audible. */
  ctxToPerf(t: number): number {
    const c = this.ctx; if (!c) return performance.now();
    const ts = (c as any).getOutputTimestamp?.();
    if (ts && ts.performanceTime > 0) return ts.performanceTime + (t - ts.contextTime) * 1000;
    const l = this.latency();
    return performance.now() + (t - c.currentTime + l.base + l.output) * 1000;
  }

  register(id: string, ch: Float32Array[], sr: number) {
    const s = { ch, sr }; this.samples.set(id, s); if (this.ctx) this.upload(id, s);
  }
  has(id: string) { return this.samples.has(id); }

  private upload(id: string, s: Sample) {
    if (!this.ctx) return;
    if (this.mode === 'worklet' && this.node) {
      this.node.port.postMessage({ t: 'sample', id, ch: s.ch, sr: s.sr });
    } else {
      const b = this.ctx.createBuffer(s.ch.length, s.ch[0].length, s.sr);
      s.ch.forEach((c, i) => b.copyToChannel(c as Float32Array<ArrayBuffer>, i));
      this.buffers.set(id, b);
    }
  }

  frame(t: number) { return Math.round(t * this.sampleRate); }

  trigger(o: Trig) {
    const ctx = this.ctx; if (!ctx) return;
    if (this.mode === 'worklet' && this.node) {
      const at = o.at <= ctx.currentTime ? 0 : this.frame(o.at);
      this.node.port.postMessage({ t: 'trig', at, id: o.id, vel: o.vel, gain: o.gain ?? 1, pan: o.pan ?? 0, rate: o.rate ?? 1, loop: !!o.loop, choke: o.choke, key: o.key, mono: !!o.mono });
      return;
    }
    const b = this.buffers.get(o.id); if (!b || !this.master) return;
    const when = Math.max(o.at, ctx.currentTime);
    if (o.choke || o.mono) for (const a of this.active) if ((o.choke && a.choke === o.choke) || (o.mono && a.key === o.key)) this.fadeOut(a, when);
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = !!o.loop; src.playbackRate.value = o.rate ?? 1;
    const g = ctx.createGain(); g.gain.value = (o.gain ?? 1) * o.vel;
    let last: AudioNode = g;
    if (ctx.createStereoPanner && o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); last = p; }
    src.connect(g); last.connect(this.master);
    const rec = { src, g, key: o.key, choke: o.choke } as any;
    src.onended = () => { rec.alive = false; try { last.disconnect(); } catch {} };
    src.start(when);
    this.active.push(rec);
  }

  private fadeOut(a: { src: AudioBufferSourceNode; g: GainNode }, when: number) {
    try { a.g.gain.setValueAtTime(a.g.gain.value, when); a.g.gain.linearRampToValueAtTime(0, when + 0.003); a.src.stop(when + 0.004); } catch {}
  }

  stop(opts: { key?: string; choke?: string; at?: number }) {
    const ctx = this.ctx; if (!ctx) return;
    const t = opts.at ?? 0;
    if (this.mode === 'worklet' && this.node) { this.node.port.postMessage({ t: 'stop', at: t <= ctx.currentTime ? 0 : this.frame(t), key: opts.key, choke: opts.choke }); return; }
    for (const a of this.active) if ((opts.key == null || a.key === opts.key) && (opts.choke == null || a.choke === opts.choke)) this.fadeOut(a, Math.max(t, ctx.currentTime));
  }

  setRate(key: string, rate: number, at = 0) {
    const ctx = this.ctx; if (!ctx) return;
    if (this.mode === 'worklet' && this.node) { this.node.port.postMessage({ t: 'rate', at: at <= ctx.currentTime ? 0 : this.frame(at), key, rate }); return; }
    for (const a of this.active) if (a.key === key) a.src.playbackRate.setValueAtTime(rate, Math.max(at, ctx.currentTime));
  }

  stopAll() {
    if (this.mode === 'worklet') this.node?.port.postMessage({ t: 'stopAll' });
    else for (const a of this.active) this.fadeOut(a, this.now);
  }

  setMaster(v: number) {
    this.masterGain = v;
    if (this.mode === 'worklet') this.node?.port.postMessage({ t: 'master', v });
    else if (this.master) this.master.gain.value = v / 0.85;
  }

  private onWorklet(m: any) {
    if (m.t === 'stat') { this.stats = { voices: m.voices, late: m.late, peak: m.peak, frame: m.frame, queued: m.queued }; this.onStats?.(this.stats); }
    else if (m.t === 'measure') { const cb = this.measureCb.get(m.id); this.measureCb.delete(m.id); cb?.(m); }
  }

  /** Connect a mic/line stream to the worklet input for loopback measurement. */
  async attachInput(stream: MediaStream) {
    if (!this.ctx || !this.node) throw new Error('Loopback measurement needs the AudioWorklet engine (secure context: https or localhost).');
    this.micSource?.disconnect();
    this.micSource = this.ctx.createMediaStreamSource(stream);
    this.micSource.connect(this.node);
  }
  detachInput() { try { this.micSource?.disconnect(); } catch {} this.micSource = null; }

  /** Emits an impulse and returns the number of frames until it is heard back at the input (round trip). */
  measureOnce(windowSec = 0.5): Promise<{ frames: number; peak: number; noise: number; hasInput: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.ctx || !this.node) return reject(new Error('worklet engine not running'));
      const id = this.measureId++;
      const at = this.frame(this.ctx.currentTime + 0.15);
      const t = setTimeout(() => { this.measureCb.delete(id); reject(new Error('measurement timed out')); }, (windowSec + 1.5) * 1000);
      this.measureCb.set(id, (r) => { clearTimeout(t); resolve(r); });
      this.node.port.postMessage({ t: 'measure', id, at, frames: Math.round(windowSec * this.sampleRate) });
    });
  }

  /** Decode an encoded file into channels at the context rate. */
  async decode(data: ArrayBuffer): Promise<Float32Array[]> {
    const ctx = this.ctx ?? new OfflineAudioContext(1, 1, 48000);
    const b = await ctx.decodeAudioData(data);
    return Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i).slice());
  }
}
