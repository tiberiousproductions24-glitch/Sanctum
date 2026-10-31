// A second, independent Ableton Link peer for testing the bridge on one machine.
//   node bridge/test-peer.js [--bpm 98] [--set-after 2] [--duration 0] [--backend relay|addon]
import { createBackend } from './link-backend.js';
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const bpm = Number(arg('bpm', 98)), setAfter = Number(arg('set-after', 2)), duration = Number(arg('duration', 0));
const link = createBackend({ bpm: 120, quantum: 4, backend: arg('backend') });
console.log(`[peer] joined Link via ${link.kind}; will propose ${bpm} BPM after ${setAfter}s`);
setTimeout(() => { link.setTempo(bpm); console.log(`[peer] proposed tempo ${bpm}`); }, setAfter * 1000);
setInterval(() => {
  const s = link.state();
  console.log(`[peer] t=${Date.now()} peers=${s.peers} bpm=${Number(s.bpm).toFixed(2)} beat=${Number(s.beat).toFixed(3)} phase=${Number(s.phase).toFixed(3)}`);
}, 500);
const quit = () => { link.close(); process.exit(0); };
if (duration > 0) setTimeout(quit, duration * 1000);
process.on('SIGINT', quit); process.on('SIGTERM', quit);
