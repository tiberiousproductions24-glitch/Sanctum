// Sanctum Live Relay: one small WebSocket hub for live-service integrations.
//
//   Sanctum (drum machine)  ──┐                       ┌── Lampstand operator console (screen receiver)
//                             ├──  ws://<laptop>:20810 ┤
//   rehearsal / monitor peers ┘                       └── more screens / a second Sanctum
//
// Runs on a laptop in the sanctuary (LAN first, no internet, no accounts, no keys).
//   node bridge/live-relay.js [--port 20810] [--host 0.0.0.0] [--lampstand http://192.168.1.20:8080]
//
// Protocol (JSON text frames, see docs in MANUAL.md "Live Relay"):
//   → {t:'hello', v:1, room:'<church>/<ROOM>', role:'sanctum'|'screen'|'rehearsal'|'monitor', name, peer, since?, epoch?}
//   ← {t:'welcome', room, epoch, seq, peers:[…], s}          (s = relay clock, ms, monotonic epoch)
//   → {t:'ping', id, c0}  ← {t:'pong', id, c0, s}            (heartbeat + RTT + clock offset)
//   → {t:'msg', id, to, kind, body, ttl?, at?}                (id = idempotency key; to = role | peer id | '*')
//   ← {t:'ack', id, seq, delivered, dup?}                     (relay accepted it; duplicates are re-acked, never re-sent)
//   ← {t:'msg', id, seq, from, fromRole, kind, body, at, st}  (forwarded to every matching peer in the room)
//   → {t:'rcpt', id, ok, result?, error?}  → forwarded to the original sender as {t:'rcpt', …, by}
//   Replay: a receiver that reconnects sends since=<last seq it saw> (+ the relay epoch); the relay re-sends
//   every logged message after that seq that was addressed to it and has not expired (ttl).
import { WebSocketServer } from 'ws';
import http from 'node:http';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-generator';

const now = () => performance.timeOrigin + performance.now();   // monotonic epoch-ms (same domain as the browsers' clocks)
const ROOM_RE = /^[a-z0-9][a-z0-9-]{0,39}\/[A-Z0-9-]{3,12}$/;
const ROLES = new Set(['sanctum', 'screen', 'rehearsal', 'monitor']);

export function normRoom(r) {
  const s = String(r || '').trim();
  const i = s.indexOf('/');
  const church = (i > -1 ? s.slice(0, i) : 'default').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'default';
  const code = (i > -1 ? s.slice(i + 1) : s).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);
  const out = `${church}/${code}`;
  return ROOM_RE.test(out) ? out : null;
}

export function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
}

export function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(String(text).slice(0, 600)); q.make();
  const n = q.getModuleCount(), m = 2; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

export function startRelay(opts = {}) {
  const port = opts.port ?? 20810, host = opts.host ?? '0.0.0.0';
  const LOG_MAX = opts.logMax ?? 300, DEDUPE_MAX = 2000, DEFAULT_TTL = opts.defaultTtl ?? 120_000;
  const log = opts.quiet ? () => {} : (...a) => console.log('[live-relay]', ...a);
  const epoch = Math.floor(now()).toString(36) + Math.random().toString(36).slice(2, 6);
  const rooms = new Map();   // key -> {key, peers:Map<peerId,{ws,role,name,peer}>, seq, log:[], seen:Map<id,{seq,delivered}>}
  const stats = { msgs: 0, dups: 0, replays: 0 };

  const room = (key) => { let r = rooms.get(key); if (!r) { r = { key, peers: new Map(), seq: 0, log: [], seen: new Map() }; rooms.set(key, r); } return r; };
  const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const peerList = (r) => [...r.peers.values()].map((p) => ({ peer: p.peer, role: p.role, name: p.name }));
  const presence = (r) => { const peers = peerList(r); for (const p of r.peers.values()) send(p.ws, { t: 'presence', peers, s: now() }); };
  const matches = (p, to) => to === '*' || to === p.role || to === p.peer;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    url.pathname = url.pathname.replace(/^\/live(?=\/|$)/, '') || '/';   // same-origin proxy path from the Vite dev/preview server
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Cache-Control': 'no-store' };
    if (req.method === 'OPTIONS') { res.writeHead(204, { ...cors, 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
    if (url.pathname === '/api/info') {
      const list = [...rooms.values()].filter((r) => r.peers.size).map((r) => ({ room: r.key, peers: peerList(r) }));
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, app: 'sanctum-live-relay', v: 1, epoch, port: server.address().port, lan: lanAddresses().map((ip) => `ws://${ip}:${server.address().port}`), rooms: list, stats, s: now() }));
    }
    if (url.pathname === '/qr.svg') { res.writeHead(200, { ...cors, 'Content-Type': 'image/svg+xml' }); return res.end(qrSvg(url.searchParams.get('text') || '')); }
    if (url.pathname === '/' || url.pathname === '/pair') {
      const p = server.address().port, ips = lanAddresses();
      const roomQ = normRoom(url.searchParams.get('room') || '') || '';
      const lamp = (url.searchParams.get('lampstand') || opts.lampstand || '').replace(/\/+$/, '');
      const cards = ips.map((ip) => {
        const relay = `${ip}:${p}`;
        const sanctumLink = `sanctum://live?relay=${encodeURIComponent(relay)}${roomQ ? '&room=' + encodeURIComponent(roomQ) : ''}`;
        const lampLink = lamp ? `${lamp}/operator.html?sanctum=${encodeURIComponent(relay)}${roomQ ? '&sroom=' + encodeURIComponent(roomQ) : ''}` : '';
        return `<div class=c><h2>${relay}</h2><div class=q>${qrSvg(relay)}<p>Relay address<br><small>type it into Sanctum → LIVE → Relay</small></p></div>` +
          (lampLink ? `<div class=q>${qrSvg(lampLink)}<p>Lampstand operator<br><small>${lampLink.replace(/&/g, '&amp;')}</small></p></div>` : '') +
          `<div class=q>${qrSvg(sanctumLink)}<p>Sanctum app link<br><small>${sanctumLink.replace(/&/g, '&amp;')}</small></p></div></div>`;
      }).join('') || '<p>No LAN address found. Connect this computer to the church Wi-Fi.</p>';
      const live = [...rooms.values()].filter((r) => r.peers.size).map((r) => `<li><b>${r.key}</b> — ${peerList(r).map((x) => `${x.role}: ${x.name}`).join(', ')}</li>`).join('') || '<li>none yet</li>';
      res.writeHead(200, { ...cors, 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><meta name=viewport content="width=device-width"><title>Sanctum Live Relay</title><style>body{font:16px system-ui;background:#0b0b12;color:#eee;margin:24px}.c{background:#181826;border-radius:12px;padding:16px;margin:12px 0;display:flex;flex-wrap:wrap;gap:24px}.c h2{width:100%;margin:0}.q svg{width:180px;height:180px;display:block}.q p{max-width:220px;word-break:break-all}small{color:#aaa}</style><h1>Sanctum Live Relay</h1><p>Rooms online:</p><ul>${live}</ul>${cards}<p><small>Add <code>?room=church/ROOM&amp;lampstand=http://ip:8080</code> to this URL for room-specific pairing codes.</small></p>`);
    }
    res.writeHead(404, cors); res.end('not found');
  });

  const wss = new WebSocketServer({ server, perMessageDeflate: false, maxPayload: 2 * 1024 * 1024 });
  wss.on('connection', (ws, req) => {
    ws._socket?.setNoDelay(true);
    ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
    let me = null, r = null;
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(String(raw)); } catch { return; }
      if (m.t === 'ping') return send(ws, { t: 'pong', id: m.id, c0: m.c0, s: now() });
      if (m.t === 'hello') {
        const key = normRoom(m.room);
        if (!key) return send(ws, { t: 'error', code: 'bad-room', message: 'Room must look like church-id/ROOM (3–12 letters/digits).' });
        if (me && r) { r.peers.delete(me.peer); presence(r); }
        r = room(key);
        const role = ROLES.has(m.role) ? m.role : 'monitor';
        const peerId = String(m.peer || Math.random().toString(36).slice(2, 10)).slice(0, 40);
        const old = r.peers.get(peerId); if (old && old.ws !== ws) { try { old.ws.close(4001, 'replaced'); } catch {} }
        me = { ws, role, name: String(m.name || role).slice(0, 60), peer: peerId };
        r.peers.set(peerId, me);
        send(ws, { t: 'welcome', room: key, epoch, seq: r.seq, peer: peerId, peers: peerList(r), s: now() });
        // Replay what this peer missed (same relay epoch, seq > since, addressed to it, not expired).
        if (m.epoch === epoch && Number.isFinite(m.since)) {
          const t = now(); let n = 0;
          for (const e of r.log) if (e.seq > m.since && e.from !== peerId && matches(me, e.to) && t - e.st < e.ttl) { send(ws, { ...e.out, replay: true }); n++; }
          if (n) { stats.replays += n; log(`replayed ${n} message(s) to ${role} ${me.name} in ${key}`); }
        }
        log(`${role} "${me.name}" joined ${key} from ${req.socket.remoteAddress} (${r.peers.size} in room)`);
        presence(r);
        return;
      }
      if (!me || !r) return send(ws, { t: 'error', code: 'no-hello', message: 'Send hello first.' });
      if (m.t === 'msg') {
        const id = String(m.id || '').slice(0, 64); if (!id) return;
        const seen = r.seen.get(id);
        if (seen) { stats.dups++; return send(ws, { t: 'ack', id, seq: seen.seq, delivered: seen.delivered, dup: true, s: now() }); }
        const to = String(m.to || '*').slice(0, 40);
        const st = now(), seq = ++r.seq;
        const out = { t: 'msg', id, seq, from: me.peer, fromRole: me.role, fromName: me.name, kind: String(m.kind || '').slice(0, 40), body: m.body ?? null, at: Number.isFinite(m.at) ? m.at : undefined, st };
        let delivered = 0;
        for (const p of r.peers.values()) if (p !== me && matches(p, to)) { send(p.ws, out); delivered++; }
        const ttl = Math.max(0, Math.min(Number.isFinite(m.ttl) ? m.ttl : DEFAULT_TTL, 30 * 60_000));
        r.log.push({ seq, st, ttl, to, from: me.peer, out }); if (r.log.length > LOG_MAX) r.log.shift();
        r.seen.set(id, { seq, delivered }); if (r.seen.size > DEDUPE_MAX) r.seen.delete(r.seen.keys().next().value);
        stats.msgs++;
        return send(ws, { t: 'ack', id, seq, delivered, s: now() });
      }
      if (m.t === 'rcpt') {
        const e = r.log.find((x) => x.out.id === m.id);
        const target = e && r.peers.get(e.from);
        if (target) send(target.ws, { t: 'rcpt', id: m.id, ok: m.ok !== false, result: m.result, error: m.error, by: me.peer, byRole: me.role, s: now() });
        return;
      }
    });
    ws.on('close', () => { if (me && r && r.peers.get(me.peer) === me) { r.peers.delete(me.peer); log(`${me.role} "${me.name}" left ${r.key}`); presence(r); } });
    ws.on('error', () => {});
  });
  const hb = setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch {} } }, opts.heartbeatMs ?? 10_000);
  hb.unref?.();

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const p = server.address().port;
      log(`listening on ws://${host}:${p}  (pairing page http://localhost:${p}/)`);
      for (const ip of lanAddresses()) log(`LAN: ws://${ip}:${p}   pairing: http://${ip}:${p}/`);
      resolve({ port: p, epoch, rooms, stats, server, wss, close: () => new Promise((res) => { clearInterval(hb); for (const c of wss.clients) c.terminate(); wss.close(); server.close(() => res()); }) });
    });
  });
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : process.env[`SANCTUM_LIVE_${n.toUpperCase()}`] ?? d; };
  startRelay({ port: Number(arg('port', 20810)), host: arg('host', '0.0.0.0'), lampstand: arg('lampstand', '') })
    .then((r) => {
      const ip = lanAddresses()[0];
      if (ip) { // terminal QR of the relay address, for quick pairing
        const q = qrcode(0, 'L'); q.addData(`${ip}:${r.port}`); q.make();
        const n = q.getModuleCount(); let out = '';
        for (let y = -1; y < n + 1; y += 2) { for (let x = -1; x < n + 1; x++) { const a = y >= 0 && y < n && x >= 0 && x < n && q.isDark(y, x), b = y + 1 < n && y + 1 >= 0 && x >= 0 && x < n && q.isDark(y + 1, x); out += a && b ? '█' : a ? '▀' : b ? '▄' : ' '; } out += '\n'; }
        console.log(`\nScan or type in Sanctum → LIVE → Relay:  ${ip}:${r.port}\n` + out.replace(/[█▀▄ ]/g, (c) => ({ '█': ' ', '▀': '▄', '▄': '▀', ' ': '█' })[c]));
      }
      for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => r.close().then(() => process.exit(0)));
    })
    .catch((e) => { console.error('[live-relay]', e.message); process.exit(1); });
}
