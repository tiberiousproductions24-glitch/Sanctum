// Sanctum ⇄ Worship Rehearsal Platform. Sanctum joins the rehearsal room *as a member* over the platform's own
// transport (WebSocket /ws signaling + NTP clock, WebRTC mesh for media), so nothing new is needed on the members' side
// except the small Sanctum panel (public/js/sanctum-panel.js) and the 'sanctum' relay case in server.js.
//
//  → room: Sanctum's master output as a WebRTC audio track (MediaStreamDestination tap, Opus 10 ms, music settings)
//  ← room: stems (decoded onto a pad bank), lyrics (for Send to Screen), song tempo, leader transport
//  ⇄ events: {type:'sanctum', id, to, kind, body, at} — remote pad/clip triggers as tiny timestamped events
//            (at = server-clock ms; Sanctum schedules them sample-accurately at at+offset, or ASAP when late)
import { ClockEstimate, localNow } from './clock';
import { SanctumMesh } from './mesh';
import { uid } from './reliable';
import type { RehearsalConfig } from './config';
import { isLanHost } from '../sync/link';

export type RehStatus = 'off' | 'connecting' | 'online' | 'reconnecting' | 'denied' | 'error';
export interface RehStem { id: string; name: string; group?: string; url: string }
export interface RehLyricSection { section: string; time: number; lines: { t: number; text: string }[] }
export interface RehSong { title: string; author?: string; copyright?: string; bpm?: number | null; duration?: number | null; key?: string; stems: RehStem[]; lyrics: RehLyricSection[] }
export interface RehPeer { id: string; name: string; role: string }
export interface SanctumEvent { id: string; from: string; fromName?: string; kind: string; body: any; at?: number; st?: number }

export function rehearsalUrls(input: string): { http?: string; ws?: string; error?: string } {
  let s = (input || '').trim(); if (!s) return { error: 'Enter the rehearsal server address, e.g. https://rehearsal.example.org or 192.168.1.30:3030' };
  if (!/^(https?|wss?):\/\//i.test(s)) s = (/^(\d+\.){3}\d+|localhost/.test(s) ? 'http://' : 'https://') + s;
  let u: URL; try { u = new URL(s); } catch { return { error: 'That does not look like an address.' }; }
  const secure = u.protocol === 'https:' || u.protocol === 'wss:';
  if (!secure && !isLanHost(u.hostname)) return { error: 'Use https:// for a rehearsal server on the internet (plain http/ws only on your local network).' };
  const host = u.host;
  return { http: `${secure ? 'https' : 'http'}://${host}`, ws: `${secure ? 'wss' : 'ws'}://${host}/ws` };
}

/** Rehearsal lyrics → Lampstand song (sections + arrangement; a repeated section reuses its id). */
export function lyricsToSong(song: RehSong) {
  const sections: { id: string; label: string; lines: string[] }[] = []; const arrangement: string[] = [];
  for (const sec of song.lyrics || []) {
    const lines = (sec.lines || []).map((l) => l.text).filter(Boolean);
    const same = sections.find((s) => s.label === sec.section && s.lines.join('\n') === lines.join('\n'));
    if (same) { arrangement.push(same.id); continue; }
    const id = (sec.section || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + (sections.length + 1);
    sections.push({ id, label: sec.section || `Section ${sections.length + 1}`, lines }); arrangement.push(id);
  }
  return { title: song.title, author: song.author, sections, arrangement };
}

export class RehearsalLink {
  status: RehStatus = 'off'; error = ''; myId = ''; roomName = ''; church: string | null = null;
  peers: RehPeer[] = []; leaderId: string | null = null;
  song: RehSong | null = null; transport: any = null;
  clock = new ClockEstimate();
  mesh: SanctumMesh | null = null;
  outbox: { id: string; to: string; kind: string; body: any; created: number; ttl: number; sentAt?: number }[] = [];
  log: { t: number; text: string }[] = [];
  onEvent?: (e: SanctumEvent) => void;
  onChange?: () => void;
  onSong?: (s: RehSong) => void;
  onStream?: (id: string, s: MediaStream) => void;
  private ws: WebSocket | null = null; private want = false; private attempts = 0; private retryT: any; private hbT: any; private lastPong = 0;
  private seen = new Set<string>();

  constructor(private cfg: () => RehearsalConfig, private localStream: () => MediaStream | null) {}
  get urls() { return rehearsalUrls(this.cfg().url); }
  serverNow() { return this.clock.remoteNow(); }

  start() { this.want = true; this.attempts = 0; this.status = 'connecting'; this.dial(); }
  stop() { this.want = false; clearTimeout(this.retryT); clearInterval(this.hbT); const ws = this.ws; this.ws = null; try { ws?.close(1000); } catch {} this.mesh?.close(); this.mesh = null; this.peers = []; this.set('off'); }
  drop() { try { this.ws?.close(4000, 'test-drop'); } catch {} }
  private set(s: RehStatus, e = '') { this.status = s; this.error = e; this.onChange?.(); }
  private note(text: string) { this.log.unshift({ t: Date.now(), text }); this.log.length = Math.min(this.log.length, 30); this.onChange?.(); }

  private dial() {
    clearTimeout(this.retryT); if (!this.want || this.ws) return;
    const u = this.urls; if (u.error) return this.set('error', u.error);
    this.set(this.attempts ? 'reconnecting' : 'connecting', this.error);
    let ws: WebSocket; try { ws = new WebSocket(u.ws!); } catch (e) { this.set('error', String(e)); return this.backoff(); }
    this.ws = ws;
    ws.onopen = () => {
      const c = this.cfg();
      this.raw({ type: 'hello', room: c.room, name: c.name || 'Sanctum', part: 'sanctum', wantLeader: false, token: c.token || undefined, church: c.church || undefined });
    };
    ws.onmessage = (e) => { let m: any; try { m = JSON.parse(String(e.data)); } catch { return; } this.handle(m); };
    ws.onclose = () => {
      if (this.ws !== ws) return; this.ws = null; clearInterval(this.hbT);
      this.mesh?.close(); this.mesh = null; this.peers = [];
      for (const o of this.outbox) o.sentAt = undefined;
      if (this.status === 'denied' || !this.want) return this.onChange?.();
      this.set('reconnecting', this.error || 'Disconnected from the rehearsal room. Reconnecting…'); this.backoff();
    };
    ws.onerror = () => { this.error = `Can't reach the rehearsal server at ${u.http}`; };
  }
  private backoff() { if (!this.want) return; const b = Math.min(10_000, 500 * 2 ** Math.min(this.attempts++, 5)); this.retryT = setTimeout(() => this.dial(), b * (0.75 + Math.random() * 0.5)); }
  private raw(m: object) { if (this.ws?.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; } return false; }
  private ping() { this.raw({ type: 'ping', t0: localNow() }); }

  private handle(m: any) {
    switch (m.type) {
      case 'pong': this.clock.add(m.t0, m.t1, m.t2); this.lastPong = performance.now(); if (this.clock.ready && this.clock.rtt != null) this.raw({ type: 'clock', rtt: this.clock.rtt }); this.onChange?.(); return;
      case 'welcome': {
        this.myId = m.id; this.roomName = m.room; this.church = m.church?.name || null; this.leaderId = m.leaderId; this.peers = m.peers || [];
        this.attempts = 0; this.lastPong = performance.now(); this.clock.reset();
        this.applyState(m.state || {});
        this.mesh?.close();
        this.mesh = new SanctumMesh(m.id, m.iceServers || [], (to, data) => this.raw({ type: 'signal', to, data }), this.localStream);
        this.mesh.onState = () => this.onChange?.();
        this.mesh.onStream = (id, s) => this.onStream?.(id, s);
        for (const p of this.peers) this.mesh.connect(p.id);       // newcomer offers to everyone
        for (let i = 0; i < 8; i++) setTimeout(() => this.ping(), i * 40);
        clearInterval(this.hbT);
        this.hbT = setInterval(() => {
          if (performance.now() - this.lastPong > 8000) { this.error = 'Rehearsal server stopped answering (heartbeat lost).'; try { this.ws?.close(4002); } catch {} return; }
          this.ping(); this.flush(true);
        }, 2000);
        this.set('online'); this.note(`Joined ${m.room}${this.church ? ' · ' + this.church : ''} (${this.peers.length} other member${this.peers.length === 1 ? '' : 's'})`);
        this.raw({ type: 'sanctum-sync', since: 0 });
        this.flush();
        return;
      }
      case 'peer-joined': this.peers = [...this.peers.filter((p) => p.id !== m.peer.id), m.peer]; this.note(`${m.peer.name} joined`); this.onChange?.(); return; // they offer to us
      case 'peer-left': this.peers = this.peers.filter((p) => p.id !== m.id); this.mesh?.remove(m.id); this.onChange?.(); return;
      case 'leader': this.leaderId = m.leaderId; if (m.peers) for (const p of m.peers) { const x = this.peers.find((q) => q.id === p.id); if (x) x.role = p.role; } this.onChange?.(); return;
      case 'signal': this.mesh?.handleSignal(m.from, m.data); return;
      case 'state': this.applyState(m.patch || {}); return;
      case 'denied': this.want = false; this.set('denied', m.message || 'The rehearsal room refused this sign-in. Add a church sign-in token or guest link token in Rehearsal settings.'); return;
      case 'error': this.note('Server: ' + m.message); return;
      case 'sanctum-ack': { const i = this.outbox.findIndex((o) => o.id === m.id); if (i > -1) this.outbox.splice(i, 1); this.onChange?.(); return; }
      case 'sanctum': {
        if (!m.id || this.seen.has(m.id)) return; this.seen.add(m.id); if (this.seen.size > 1000) this.seen.delete(this.seen.values().next().value!);
        if (m.from === this.myId) return;
        this.onEvent?.({ id: m.id, from: m.from, fromName: m.fromName, kind: m.kind, body: m.body, at: m.at, st: m.st });
        return;
      }
    }
  }
  private applyState(patch: any) {
    if (patch.song) { this.song = patch.song; this.onSong?.(patch.song); this.note(`Song: ${patch.song.title} · ${patch.song.stems?.length || 0} stems · ${patch.song.lyrics?.length || 0} lyric sections`); }
    if (patch.transport) this.transport = patch.transport;
    this.onChange?.();
  }
  /** Reliable send through the rehearsal server's 'sanctum' relay (acked, de-duplicated by id, re-sent after reconnect). */
  send(to: string, kind: string, body: any, opt: { ttl?: number; at?: number } = {}) {
    const o = { id: uid(), to, kind, body, created: Date.now(), ttl: opt.ttl ?? 30_000, at: opt.at };
    this.outbox.push(o); if (this.outbox.length > 200) this.outbox.shift(); this.flush(); return o.id;
  }
  /** Fire-and-forget (state snapshots, receipts): still id-tagged, not queued. */
  post(to: string, kind: string, body: any) { this.raw({ type: 'sanctum', id: uid(), to, kind, body }); }
  private flush(resendStale = false) {
    if (this.status !== 'online') return;
    const t = Date.now(); this.outbox = this.outbox.filter((o) => t - o.created < o.ttl);
    for (const o of this.outbox) {
      if (o.sentAt != null && !(resendStale && performance.now() - o.sentAt > 3000)) continue;
      if (!this.raw({ type: 'sanctum', id: o.id, to: o.to, kind: o.kind, body: o.body, at: (o as any).at })) break;
      o.sentAt = performance.now();
    }
  }
  /** Absolute URL for a stem (adds the room/church/token the platform's private /uploads need outside FREE_MODE). */
  stemUrl(url: string) {
    const c = this.cfg(); const base = this.urls.http || '';
    const u = new URL(url, base + '/');
    if (u.pathname.startsWith('/uploads/')) { u.searchParams.set('room', c.room); if (c.church) u.searchParams.set('church', c.church); }
    return u.toString();
  }
  authHeaders(): Record<string, string> { const t = this.cfg().token; return t ? { Authorization: 'Bearer ' + t } : {}; }
}
