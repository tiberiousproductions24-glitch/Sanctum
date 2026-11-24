// Load Follow Me chord maps for web + Capacitor (content/ copied into dist by Vite).
import type { PulpitChartsFile, ShoutChordMap } from './types';
import { FollowMeEngine, assertChartsShape, assertShoutMapShape } from './engine';

const SHOUT_URL = './content/chord-maps/shout-iv-v-bvii.json';
// v0.3.4: Follow Me charts = shout reference transcription (chord-maps/lawrence/progressions.json).
// Legacy Beat Theory charts stay in the repo/dist for rollback: swap CHARTS_URL to LEGACY_CHARTS_URL.
const CHARTS_URL = './content/chord-maps/follow-me-shout-reference.json';
const LEGACY_CHARTS_URL = './content/chord-maps/pulpit-12key-charts.json';
const THEORY_URL = './content/theory/beat-theory-maps.json';

let cachedEngine: FollowMeEngine | null = null;
let loadPromise: Promise<FollowMeEngine> | null = null;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Load shout map + Follow Me 12-key charts (shout reference transcription). Idempotent. */
export async function loadFollowMe(): Promise<FollowMeEngine> {
  if (cachedEngine) return cachedEngine;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const [shout, charts] = await Promise.all([
      fetchJson<ShoutChordMap>(SHOUT_URL),
      fetchJson<PulpitChartsFile>(CHARTS_URL),
    ]);
    if (!shout) throw new Error('Follow Me: shout map missing at ' + SHOUT_URL);
    if (!charts) throw new Error('Follow Me: charts missing at ' + CHARTS_URL);
    const sErr = assertShoutMapShape(shout);
    const cErr = assertChartsShape(charts);
    if (sErr.length) console.warn('[Follow Me] shout map warnings:', sErr);
    if (cErr.length) console.warn('[Follow Me] charts warnings:', cErr);
    cachedEngine = new FollowMeEngine(shout, charts);
    return cachedEngine;
  })();
  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

export function getFollowMe(): FollowMeEngine | null {
  return cachedEngine;
}

export function installFollowMe(shout: ShoutChordMap, charts: PulpitChartsFile): FollowMeEngine {
  cachedEngine = new FollowMeEngine(shout, charts);
  return cachedEngine;
}

export async function loadBeatTheoryMapsFromContent(): Promise<boolean> {
  const data = await fetchJson<any>(THEORY_URL);
  if (!data) return false;
  const { loadBeatTheoryMaps } = await import('../chords/theory-ext');
  loadBeatTheoryMaps(data);
  return true;
}

export { SHOUT_URL, CHARTS_URL, LEGACY_CHARTS_URL, THEORY_URL };
