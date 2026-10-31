// Sound library: built-in starter soundbanks (synthesized), "coming soon" slots, and
// external manifest banks (content/church-banks/manifest.json) adapted into the same shape.
import type { SynthParams } from './synth';

export interface Credit { author: string; license: string; url?: string; source?: string; note?: string }
export interface SoundDef {
  id: string;            // globally unique
  name: string;
  short: string;         // label on the pad
  kind: 'oneshot' | 'loop';
  gen?: string;          // synth generator name (built-ins)
  params?: SynthParams;
  file?: string;         // primary web file (manifest banks)
  fallbackFile?: string;
  bpm?: number; bars?: number; beats?: number; key?: string | null;
  samples?: number; fileSampleRate?: number;
  choke?: string;
  credit: Credit;
}
export interface SoundBank {
  id: string; name: string; status: 'ready' | 'coming-soon' | 'external';
  description: string; sounds: (SoundDef | null)[]; // 16 slots
  source?: string;
}

const SYNTH: Credit = { author: 'Sanctum built-in synthesis (generated in-app at load time)', license: 'Original work — no samples, no third-party content', source: 'src/audio/synth.ts' };
const s = (id: string, name: string, short: string, gen: string, params: SynthParams = {}, choke?: string): SoundDef =>
  ({ id, name, short, kind: 'oneshot', gen, params, choke, credit: SYNTH });

// Pad order = MPC numbering: pad 1 bottom-left … pad 16 top-right.
export const FOUNDATION: SoundBank = {
  id: 'foundation', name: 'Sanctum Foundation Kit', status: 'ready',
  description: 'Starter drum kit — kicks, snares, claps, hats, cymbals, toms, tambourine, shaker. 100% synthesized.',
  sounds: [
    s('fk.kick', 'Kick Deep', 'KICK', 'kick', { f0: 140, f1: 46, decay: 0.38 }),
    s('fk.kick2', 'Kick Tight', 'KICK 2', 'kick', { f0: 190, f1: 58, decay: 0.18, click: 0.9, drive: 2.4 }),
    s('fk.snare', 'Snare', 'SNARE', 'snare', {}),
    s('fk.snare2', 'Snare Fat', 'SNARE 2', 'snare', { tone: 160, decay: 0.28, bright: 3500 }),
    s('fk.clap', 'Clap', 'CLAP', 'clap', {}),
    s('fk.rim', 'Rimshot', 'RIM', 'rim', {}),
    s('fk.chh', 'Closed Hat', 'CL HAT', 'hat', { decay: 0.035 }, 'hats'),
    s('fk.phh', 'Pedal Hat', 'PD HAT', 'hat', { decay: 0.07, fc: 6500 }, 'hats'),
    s('fk.ohh', 'Open Hat', 'OP HAT', 'hat', { decay: 0.35, fc: 7000 }, 'hats'),
    s('fk.tomlo', 'Tom Low', 'TOM LO', 'tom', { f: 95, decay: 0.45 }),
    s('fk.tommid', 'Tom Mid', 'TOM MID', 'tom', { f: 135, decay: 0.38 }),
    s('fk.tomhi', 'Tom High', 'TOM HI', 'tom', { f: 190, decay: 0.32 }),
    s('fk.crash', 'Crash', 'CRASH', 'cymbal', { decay: 1.3 }),
    s('fk.ride', 'Ride', 'RIDE', 'cymbal', { decay: 0.9, fc: 7500, bell: 0.15 }),
    s('fk.tamb', 'Tambourine', 'TAMB', 'tambourine', {}),
    s('fk.shaker', 'Shaker', 'SHAKER', 'shaker', {}),
  ],
};

export const STAGE_FX: SoundBank = {
  id: 'stagefx', name: 'Sanctum Stage FX & 808', status: 'ready',
  description: 'Starter FX/bass bank — risers, sub drops, impacts, reverse cymbal, swells, tuned 808s. 100% synthesized.',
  sounds: [
    s('fx.808c', '808 C', '808 C', 'bass808', { note: 36 }, '808'),
    s('fx.808ds', '808 D#', '808 D#', 'bass808', { note: 39 }, '808'),
    s('fx.808f', '808 F', '808 F', 'bass808', { note: 41 }, '808'),
    s('fx.808g', '808 G', '808 G', 'bass808', { note: 43 }, '808'),
    s('fx.808as', '808 A#', '808 A#', 'bass808', { note: 46 }, '808'),
    s('fx.808c2', '808 C (hi)', '808 C+', 'bass808', { note: 48, decay: 0.7 }, '808'),
    s('fx.snap', 'Finger Snap', 'SNAP', 'snap'),
    s('fx.cowbell', 'Cowbell', 'COWBELL', 'cowbell'),
    s('fx.riser2', 'Riser 2s', 'RISER', 'riser', { dur: 2 }),
    s('fx.riser4', 'Riser 4s', 'RISER L', 'riser', { dur: 4 }),
    s('fx.subdrop', 'Sub Drop', 'SUB DROP', 'subDrop'),
    s('fx.impact', 'Impact', 'IMPACT', 'impact'),
    s('fx.revcym', 'Reverse Cymbal', 'REV CYM', 'reverseCymbal'),
    s('fx.sweep', 'Noise Sweep Down', 'SWEEP', 'noiseSweep'),
    s('fx.swellc', 'Swell C6/9', 'SWELL C', 'swell', { note: 48 }),
    s('fx.zap', 'Laser Zap', 'ZAP', 'zap'),
  ],
};

const soon = (id: string, name: string, description: string): SoundBank =>
  ({ id, name, status: 'coming-soon', description, sounds: Array(16).fill(null) });

export const COMING_SOON: SoundBank[] = [
  soon('a100', 'Sanctuary Tonewheel A-100', 'Lawrence\'s A-100 organ — 8 registrations, Leslie slow/fast/ramp, keyclick, pedals.'),
  soon('choir', 'Choir Loft', 'SATB pads, oohs/aahs, ad-libs and hums by key (session singers, releases signed).'),
  soon('hymn', 'Hymn Roots', 'Public-domain hymn phrases on piano and organ, recorded new.'),
  soon('prayergarden', 'Prayer Garden Sessions', 'Stems from Prayer Garden COGIC — only after full rights clearance.'),
];

export const METRONOME = {
  hi: s('sys.click.hi', 'Click Accent', 'CLICK', 'click', { f: 2000 }),
  lo: s('sys.click.lo', 'Click', 'CLICK', 'click', { f: 1300 }),
};

export const BUILTIN_BANKS: SoundBank[] = [FOUNDATION, STAGE_FX];

// ---------- external manifest adapter ----------
interface ManifestPad {
  id: string; name: string; type: 'loop' | 'oneshot'; bpm?: number; key?: string | null; bars?: number; beats?: number;
  chokeGroup?: string | null; file: string; web?: { ogg?: string; mp3?: string }; samples?: number; sampleRate?: number;
  author?: string; license?: string; attribution?: string; source?: string; url?: string; pad?: number; trigger?: string; description?: string;
}
interface Manifest { name?: string; basePath?: string; license?: string; sampleRate?: number; banks: { id: string; name: string; pads: ManifestPad[] }[] }

const shortName = (n: string) => n.replace(/\(.*?\)/g, '').trim().toUpperCase().slice(0, 14);

/** Adapts content/church-banks/manifest.json (or any manifest with the same shape) to SoundBanks. */
export function adaptManifest(m: Manifest, baseUrl: string): SoundBank[] {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return (m.banks || []).map((b) => {
    const sounds: (SoundDef | null)[] = Array(16).fill(null);
    b.pads.forEach((p, i) => {
      const slot = Math.max(0, Math.min(15, (p.pad ?? i + 1) - 1));
      // Loops: prefer OGG (small) then WAV (sample-accurate master). Never MP3 for loops (encoder padding).
      const ogg = p.web?.ogg ? base + p.web.ogg : undefined;
      const wav = p.file ? base + p.file : undefined;
      sounds[slot] = {
        id: `ext.${b.id}.${p.id}`, name: p.name, short: shortName(p.name), kind: p.type === 'loop' ? 'loop' : 'oneshot',
        file: ogg || wav, fallbackFile: ogg ? wav : undefined,
        bpm: p.bpm, bars: p.bars, beats: p.beats ?? (p.bars ? p.bars * 4 : undefined), key: p.key ?? null,
        samples: p.samples, fileSampleRate: p.sampleRate ?? m.sampleRate, choke: p.chokeGroup || undefined,
        credit: { author: p.author || 'Unknown', license: p.license || m.license || 'See manifest', url: p.url, source: p.source, note: p.attribution || p.description },
      };
    });
    return { id: `ext.${b.id}`, name: b.name, status: 'external', description: `${m.name || 'External bank'} — ${b.pads.length} pads`, sounds, source: m.name };
  });
}

export async function loadManifestBanks(url = 'content/church-banks/manifest.json'): Promise<SoundBank[]> {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return [];
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) return [];
    const m = (await r.json()) as Manifest;
    const baseUrl = url.slice(0, url.lastIndexOf('/') + 1);
    return adaptManifest(m, baseUrl);
  } catch { return []; }
}
