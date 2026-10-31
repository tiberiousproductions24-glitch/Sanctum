// Ableton Link client — talks to bridge/server.js over WebSocket (default: same-origin /link,
// proxied by the Vite dev/preview server to ws://127.0.0.1:20809). Keeps the Sequencer clock
// phase-locked to the Link timeline.
import type { Engine } from '../audio/engine';
import type { Clock } from '../seq/transport';

export interface LinkState { connected: boolean; available: boolean; peers: number; bpm: number; beat: number; phase: number; quantum: number; playing: boolean; backend?: string; error?: string; rttMs: number; offsetMs: number }

export class LinkClient {
  ws: WebSocket | null = null;
  state: LinkState = { connected: false, available: false, peers: 0, bpm: 120, beat: 0, phase: 0, quantum: 4, playing: false, rttMs: 0, offsetMs: 0 };
  enabled = false;
  onState?: (s: LinkState) => void;
  onTempo?: (bpm: number) => void;
  private retry: number | undefined;
  private pingTimer: number | undefined;
  private pings = new Map<number, number>();
  private pid = 1;
  private rtts: number[] = [];

  constructor(private engine: Engine, private clock: Clock, private urlFn: () => string) {}

  static defaultUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/link`;
  }

  enable(on: boolean) {
    this.enabled = on;
    if (on) this.connect(); else this.disconnect();
  }

  private connect() {
    clearTimeout(this.retry);
    if (this.ws) return;
    let url = this.urlFn() || LinkClient.defaultUrl();
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch (e) { this.state = { ...this.state, connected: false, error: String(e) }; this.onState?.(this.state); return; }
    this.ws = ws;
    ws.onopen = () => {
      this.state = { ...this.state, connected: true, error: undefined }; this.onState?.(this.state);
      this.pingTimer = window.setInterval(() => this.ping(), 1000); this.ping();
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data), performance.now());
    ws.onclose = () => {
      this.ws = null; clearInterval(this.pingTimer);
      this.state = { ...this.state, connected: false, peers: 0 }; this.onState?.(this.state);
      if (this.enabled) this.retry = window.setTimeout(() => this.connect(), 1500);
    };
    ws.onerror = () => { this.state = { ...this.state, error: `Can't reach Link bridge at ${url} — start it with "npm run bridge"` }; this.onState?.(this.state); };
  }

  private disconnect() { clearTimeout(this.retry); clearInterval(this.pingTimer); this.ws?.close(); this.ws = null; this.state = { ...this.state, connected: false, peers: 0 }; this.onState?.(this.state); }

  private ping() { const id = this.pid++; this.pings.set(id, performance.now()); this.send({ type: 'ping', id }); }
  send(m: object) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); }
  setTempo(bpm: number) { this.send({ type: 'setTempo', bpm }); }
  setPlaying(p: boolean) { this.send({ type: 'setPlaying', playing: p }); }
  setQuantum(q: number) { this.send({ type: 'setQuantum', quantum: q }); }

  private lastBpm = 0;
  private onMessage(m: any, arrival: number) {
    if (m.type === 'pong') {
      const t0 = this.pings.get(m.id); this.pings.delete(m.id);
      if (t0 != null) { this.rtts.push(arrival - t0); if (this.rtts.length > 10) this.rtts.shift(); this.state.rttMs = [...this.rtts].sort((a, b) => a - b)[Math.floor(this.rtts.length / 2)]; }
      return;
    }
    if (m.type !== 'link') return;
    if (!m.available) { this.state = { ...this.state, available: false, error: m.error || 'Link unavailable on bridge' }; this.onState?.(this.state); return; }
    this.state = { ...this.state, available: true, connected: true, peers: m.peers, bpm: m.bpm, beat: m.beat, phase: m.phase, quantum: m.quantum, playing: m.playing, backend: m.backend, error: undefined };
    if (!this.enabled || !this.engine.ctx) { this.onState?.(this.state); return; }
    // The bridge sampled `beat` ~rtt/2 before we got it. Map to the audible context time.
    const oneWay = (this.state.rttMs || 0) / 2000;
    const heardNow = this.engine.perfToCtx(arrival);
    const linkBeatNow = m.beat + oneWay * m.bpm / 60;
    const ourBeat = this.clock.beatAt(heardNow);
    const err = linkBeatNow - ourBeat;
    this.state.offsetMs = err * 60000 / m.bpm;
    if (Math.abs(m.bpm - this.clock.bpm) > 1e-3 || Math.abs(err) > 0.25) {
      this.clock.align(linkBeatNow, heardNow, m.bpm);               // tempo change or big jump: snap
    } else {
      this.clock.align(ourBeat + err * 0.1, heardNow, m.bpm);       // small drift: slew (jitter filter)
    }
    if (Math.abs(m.bpm - this.lastBpm) > 1e-3) { this.lastBpm = m.bpm; this.onTempo?.(m.bpm); }
    this.onState?.(this.state);
  }
}
