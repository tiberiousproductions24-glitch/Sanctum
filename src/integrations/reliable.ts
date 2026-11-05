// ReliableLink: client side of the Sanctum Live Relay protocol (bridge/live-relay.js).
// - auto-reconnect with exponential backoff + jitter
// - heartbeat ping every 2 s → RTT + clock offset; a silent socket (no pong for 6 s) is dropped and redialled
// - every outgoing message has an idempotent id; it stays in the outbox until the relay acks it,
//   is re-sent after reconnect (or after 3 s without an ack) and the relay de-duplicates by id
// - queue-and-replay: messages sent while offline are queued (persisted to localStorage) and flushed in order
//   on reconnect, unless their ttl expired; receivers resume from their last seen seq (relay replays the gap)
// - receipts: the receiver answers {t:'rcpt'} (applied / failed / query results), resolved via send().receipt
import { ClockEstimate, localNow } from './clock';

export type LinkStatus = 'off' | 'connecting' | 'online' | 'reconnecting' | 'error';
export interface RelayMsg { id: string; seq: number; from: string; fromRole: string; fromName?: string; kind: string; body: any; at?: number; st: number; replay?: boolean }
export interface Peer { peer: string; role: string; name: string }
export interface Outgoing { id: string; to: string; kind: string; body: any; ttl: number; at?: number; created: number; sentAt?: number; tries: number }
export interface SendResult { id: string; acked: Promise<{ delivered: number; dup?: boolean }>; receipt: Promise<{ ok: boolean; result?: any; error?: string }> }

export const uid = () => (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12);

export interface ReliableOpts {
  url: () => string | null; room: () => string; role: string; name: () => string;
  storageKey?: string; WebSocketImpl?: typeof WebSocket;
  pingMs?: number; deadMs?: number; ackTimeoutMs?: number; maxBackoffMs?: number;
}

export class ReliableLink {
  status: LinkStatus = 'off'; error = ''; peers: Peer[] = [];
  clock = new ClockEstimate();
  attempts = 0; connectedAt = 0; lastPongAt = 0;
  outbox: Outgoing[] = [];
  onMessage?: (m: RelayMsg) => void;
  onChange?: () => void;
  readonly peerId: string;
  private ws: WebSocket | null = null; private want = false;
  private retryT: any; private pingT: any; private pid = 0; private pings = new Map<number, number>();
  private waiters = new Map<string, { ack?: (v: any) => void; rcpt?: (v: any) => void; rcptT?: any }>();
  private seenIds = new Set<string>(); private lastSeq = 0; private epoch = '';

  constructor(private o: ReliableOpts) {
    const k = this.key('peer');
    this.peerId = localStorage.getItem(k) || uid().slice(0, 12); localStorage.setItem(k, this.peerId);
    try { this.outbox = JSON.parse(localStorage.getItem(this.key('outbox')) || '[]'); } catch { this.outbox = []; }
    try { const r = JSON.parse(localStorage.getItem(this.key('resume')) || '{}'); this.lastSeq = r.seq || 0; this.epoch = r.epoch || ''; } catch {}
  }
  private key(k: string) { return `${this.o.storageKey || 'sanctum.live'}.${this.o.role}.${k}`; }
  private persist() { try { localStorage.setItem(this.key('outbox'), JSON.stringify(this.outbox.slice(-200))); } catch {} }
  private set(s: LinkStatus, err = '') { this.status = s; this.error = err; this.onChange?.(); }

  get rttMs() { return this.clock.rttMedian; }
  get queued() { return this.outbox.length; }

  start() { this.want = true; this.attempts = 0; this.dial(); }
  stop() { this.want = false; clearTimeout(this.retryT); clearInterval(this.pingT); const ws = this.ws; this.ws = null; try { ws?.close(1000, 'bye'); } catch {} this.peers = []; this.set('off'); }
  restart() { this.stop(); this.start(); }
  /** Simulate a dropped network (tests / "test reconnect" button). */
  drop() { try { (this.ws as any)?.close(4000, 'test-drop'); } catch {} }

  private dial() {
    clearTimeout(this.retryT);
    if (!this.want || this.ws) return;
    const url = this.o.url();
    if (!url) { this.set('error', 'Enter the relay address first (the computer running "npm run live-relay").'); return; }
    this.set(this.attempts ? 'reconnecting' : 'connecting', this.error);
    const WS = this.o.WebSocketImpl || WebSocket;
    let ws: WebSocket;
    try { ws = new WS(url); } catch (e) { this.set('error', String((e as Error).message || e)); return this.schedule(); }
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'hello', v: 1, room: this.o.room(), role: this.o.role, name: this.o.name(), peer: this.peerId, since: this.lastSeq, epoch: this.epoch }));
    };
    ws.onmessage = (e) => { let m: any; try { m = JSON.parse(String(e.data)); } catch { return; } this.handle(m); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null; clearInterval(this.pingT); this.peers = [];
      for (const o of this.outbox) o.sentAt = undefined;
      if (this.want) { this.set('reconnecting', this.error || 'Connection lost. Reconnecting…'); this.schedule(); } else this.set('off');
    };
    ws.onerror = () => { this.error = `Can't reach the relay at ${url}`; };
  }
  private schedule() {
    if (!this.want) return;
    const base = Math.min(this.o.maxBackoffMs ?? 10_000, 400 * 2 ** Math.min(this.attempts, 6));
    this.attempts++;
    this.retryT = setTimeout(() => this.dial(), base * (0.75 + Math.random() * 0.5));
  }

  private handle(m: any) {
    if (m.t === 'pong') {
      const t0 = this.pings.get(m.id); this.pings.delete(m.id);
      if (t0 != null) { this.clock.add(m.c0 ?? t0, m.s, m.s); this.lastPongAt = performance.now(); this.onChange?.(); }
      return;
    }
    if (m.t === 'welcome') {
      if (m.epoch !== this.epoch) { this.lastSeq = 0; this.epoch = m.epoch; }  // relay restarted: old seqs mean nothing
      this.peers = m.peers || []; this.attempts = 0; this.connectedAt = performance.now(); this.lastPongAt = performance.now();
      this.saveResume();
      this.set('online');
      clearInterval(this.pingT);
      this.pingT = setInterval(() => this.heartbeat(), this.o.pingMs ?? 2000);
      for (let i = 0; i < 3; i++) setTimeout(() => this.ping(), i * 60);
      this.flush();
      return;
    }
    if (m.t === 'presence') { this.peers = m.peers || []; this.onChange?.(); return; }
    if (m.t === 'ack') {
      const idx = this.outbox.findIndex((o) => o.id === m.id);
      if (idx > -1) { this.outbox.splice(idx, 1); this.persist(); }
      this.waiters.get(m.id)?.ack?.({ delivered: m.delivered, dup: m.dup });
      this.onChange?.();
      return;
    }
    if (m.t === 'rcpt') {
      const w = this.waiters.get(m.id);
      if (w?.rcpt) { clearTimeout(w.rcptT); w.rcpt({ ok: m.ok, result: m.result, error: m.error }); this.waiters.delete(m.id); }
      return;
    }
    if (m.t === 'msg') {
      if (m.seq > this.lastSeq) { this.lastSeq = m.seq; this.saveResume(); }
      if (this.seenIds.has(m.id)) return;                                   // idempotent receive
      this.seenIds.add(m.id); if (this.seenIds.size > 1000) this.seenIds.delete(this.seenIds.values().next().value!);
      this.onMessage?.(m);
      return;
    }
    if (m.t === 'error') { this.set('error', m.message || m.code); return; }
  }
  private saveResume() { try { localStorage.setItem(this.key('resume'), JSON.stringify({ seq: this.lastSeq, epoch: this.epoch })); } catch {} }

  private heartbeat() {
    if (performance.now() - this.lastPongAt > (this.o.deadMs ?? 6000)) { this.error = 'Relay stopped answering (heartbeat lost).'; try { this.ws?.close(4002, 'dead'); } catch {} return; }
    this.ping();
    // re-send anything not acked within ackTimeout (relay de-dupes by id)
    const t = performance.now();
    for (const o of this.outbox) if (o.sentAt != null && t - o.sentAt > (this.o.ackTimeoutMs ?? 3000)) { o.sentAt = undefined; }
    this.flush();
  }
  private ping() { const id = ++this.pid; const c0 = localNow(); this.pings.set(id, c0); this.raw({ t: 'ping', id, c0 }); if (this.pings.size > 20) this.pings.delete(this.pings.keys().next().value!); }
  private raw(m: object) { if (this.ws?.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; } return false; }

  private flush() {
    if (this.status !== 'online') return;
    const t = Date.now();
    const before = this.outbox.length;
    this.outbox = this.outbox.filter((o) => t - o.created < o.ttl);             // stale content is dropped, not replayed
    if (this.outbox.length !== before) this.persist();
    for (const o of this.outbox) if (o.sentAt == null) {
      if (!this.raw({ t: 'msg', id: o.id, to: o.to, kind: o.kind, body: o.body, ttl: Math.max(0, o.ttl - (t - o.created)), at: o.at })) break;
      o.sentAt = performance.now(); o.tries++;
    }
  }

  /** Queue a message. Returns promises for the relay ack and the receiver's receipt. */
  send(to: string, kind: string, body: any, opt: { ttl?: number; at?: number; id?: string; receiptTimeoutMs?: number } = {}): SendResult {
    const o: Outgoing = { id: opt.id || uid(), to, kind, body, ttl: opt.ttl ?? 60_000, at: opt.at, created: Date.now(), tries: 0 };
    const w: any = {}; this.waiters.set(o.id, w);
    const acked = new Promise<any>((res) => (w.ack = res));
    const receipt = new Promise<any>((res) => { w.rcpt = res; w.rcptT = setTimeout(() => { res({ ok: false, error: 'No answer from the receiver yet (it may be offline; the message stays queued at the relay until its ttl).' }); }, opt.receiptTimeoutMs ?? Math.max(4000, Math.min(o.ttl, 15000))); });
    this.outbox.push(o); this.persist(); this.flush(); this.onChange?.();
    return { id: o.id, acked, receipt };
  }
  /** Drop queued messages matching a predicate (e.g. blackout cancels pending screen content). */
  purge(pred: (o: Outgoing) => boolean) { const n = this.outbox.length; this.outbox = this.outbox.filter((o) => !pred(o)); if (n !== this.outbox.length) { this.persist(); this.onChange?.(); } }
  rcpt(id: string, ok: boolean, result?: any, error?: string) { this.raw({ t: 'rcpt', id, ok, result, error }); }
}
