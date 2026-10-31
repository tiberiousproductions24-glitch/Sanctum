// Sanctum Link Bridge — relays Ableton Link (tempo / beat / phase / peers / start-stop)
// to the Sanctum web app over WebSocket. Browsers cannot join a Link session directly
// (Link uses UDP multicast + unicast), so this small Node process joins and relays.
//
//   node bridge/server.js [--port 20809] [--quantum 4] [--bpm 120] [--backend relay|addon]
//
import { WebSocketServer } from 'ws';
import os from 'node:os';
import { createBackend } from './link-backend.js';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : process.env[`SANCTUM_${name.toUpperCase()}`] ?? def;
};
const PORT = Number(arg('port', 20809));
const QUANTUM = Number(arg('quantum', 4));
const START_BPM = Number(arg('bpm', 120));
const RATE_MS = Number(arg('rate', 20));

let link = null, linkError = null;
try { link = createBackend({ bpm: START_BPM, quantum: QUANTUM, backend: arg('backend') }); }
catch (e) { linkError = e.message; console.error('[bridge]', linkError); }

function state() {
  if (!link) return { type: 'link', available: false, error: linkError, t: Date.now() };
  return { type: 'link', available: true, backend: link.kind, ...link.state(), t: Date.now() };
}

const wss = new WebSocketServer({ host: '0.0.0.0', port: PORT });
const clients = new Set();
wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log(`[bridge] app connected from ${req.socket.remoteAddress} (${clients.size} client(s))`);
  ws.send(JSON.stringify({ ...state(), hello: true }));
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(String(raw)); } catch { return; }
    if (m.type === 'ping') { ws.send(JSON.stringify({ type: 'pong', id: m.id, t: Date.now() })); return; }
    if (!link) return;
    if (m.type === 'setTempo' && m.bpm > 20 && m.bpm < 999) link.setTempo(Number(m.bpm));
    else if (m.type === 'setQuantum' && m.quantum > 0) link.setQuantum(Number(m.quantum));
    else if (m.type === 'enable') link.enable(!!m.on);
    else if (m.type === 'setPlaying') link.setPlaying(!!m.playing);
  });
  ws.on('close', () => { clients.delete(ws); console.log(`[bridge] app disconnected (${clients.size})`); });
});
wss.on('error', (e) => { console.error('[bridge] websocket error:', e.message); process.exit(1); });

let lastPeers = -1, lastBpm = -1;
setInterval(() => {
  const s = state();
  if (s.available && (s.peers !== lastPeers || Math.abs(s.bpm - lastBpm) > 0.01)) {
    console.log(`[bridge] peers=${s.peers} bpm=${Number(s.bpm).toFixed(2)} beat=${Number(s.beat).toFixed(2)}`);
    lastPeers = s.peers; lastBpm = s.bpm;
  }
  const msg = JSON.stringify(s);
  for (const c of clients) if (c.readyState === 1) c.send(msg);
}, RATE_MS);

const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
console.log(`[bridge] Sanctum Link bridge listening on ws://0.0.0.0:${PORT}`);
console.log(`[bridge] LAN URLs: ${ips.map(ip => `ws://${ip}:${PORT}`).join(', ') || 'none'}`);
console.log(`[bridge] Link backend: ${link ? link.kind : 'UNAVAILABLE'}  quantum=${QUANTUM}  start bpm=${START_BPM}`);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { link?.close(); process.exit(0); });
