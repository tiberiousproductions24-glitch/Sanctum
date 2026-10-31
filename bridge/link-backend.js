// Link backends for the Sanctum bridge.
//  1. "relay"  — bridge/native/sanctum-link-relay (built from the current Ableton Link SDK). Preferred.
//  2. "addon"  — the 'abletonlink' npm native addon (bundles an older Link; on some Linux
//                hosts discovery is one-directional — see README).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import readline from 'node:readline';

const here = path.dirname(fileURLToPath(import.meta.url));
export const RELAY_PATH = path.join(here, 'native', 'sanctum-link-relay');

export function createRelayBackend({ bpm = 120, quantum = 4, intervalMs = 10 } = {}) {
  if (!existsSync(RELAY_PATH)) throw new Error(`relay binary not found at ${RELAY_PATH} (run bridge/native/build.sh)`);
  const child = spawn(RELAY_PATH, [String(bpm), String(quantum), String(intervalMs)], { stdio: ['pipe', 'pipe', 'inherit'] });
  let last = { bpm, beat: 0, phase: 0, quantum, peers: 0, playing: false, enabled: true, us: 0 };
  readline.createInterface({ input: child.stdout }).on('line', (l) => { try { last = JSON.parse(l); } catch {} });
  const send = (s) => { if (child.stdin.writable) child.stdin.write(s + '\n'); };
  const kill = () => { try { send('quit'); child.kill(); } catch {} };
  process.on('exit', kill);
  return {
    kind: 'relay',
    child,
    state: () => last,
    setTempo: (v) => send(`tempo ${v}`),
    setPlaying: (p) => send(`play ${p ? 1 : 0}`),
    setQuantum: (q) => send(`quantum ${q}`),
    enable: (on) => send(`enable ${on ? 1 : 0}`),
    close: kill,
  };
}

export function createAddonBackend({ bpm = 120, quantum = 4 } = {}) {
  const require = createRequire(import.meta.url);
  const AbletonLink = require('abletonlink');
  const link = new AbletonLink(bpm, quantum, true);
  link.quantum = quantum;
  link.enable();
  try { link.enablePlayStateSync(); } catch {}
  return {
    kind: 'addon',
    state: () => {
      link.update();
      return { bpm: link.bpm, beat: link.beat, phase: link.phase, quantum: link.quantum, peers: link.getNumPeers(),
        playing: !!link.isPlayingWhenUpdate, enabled: !!link.linkEnable, us: 0 };
    },
    setTempo: (v) => { link.bpm = v; },
    setPlaying: (p) => { try { p ? link.play() : link.stop(); } catch {} },
    setQuantum: (q) => { link.quantum = q; },
    enable: (on) => (on ? link.enable() : link.disable()),
    close: () => link.disable(),
  };
}

export function createBackend(opts = {}) {
  const prefer = opts.backend || process.env.SANCTUM_LINK_BACKEND || 'relay';
  const order = prefer === 'addon' ? ['addon', 'relay'] : ['relay', 'addon'];
  const errors = [];
  for (const k of order) {
    try { return k === 'relay' ? createRelayBackend(opts) : createAddonBackend(opts); }
    catch (e) { errors.push(`${k}: ${e.message}`); }
  }
  const err = new Error('No Link backend available — ' + errors.join(' | '));
  err.errors = errors;
  throw err;
}
