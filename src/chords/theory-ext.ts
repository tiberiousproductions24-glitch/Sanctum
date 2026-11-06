/**
 * Chord theory cross-reference for Sanctum Chords.
 * Extends Pulpit theory with diatonic maps, relatives, gospel/jazz substitutions,
 * and a simple Markov next-chord model.
 *
 * Beat Theory maps ship at content/theory/beat-theory-maps.json (loaded on boot via
 * loadBeatTheoryMapsFromContent). Pass an object to `loadBeatTheoryMaps` to override.
 *
 * Schema (BeatTheoryMaps):
 * {
 *   "version": 1,
 *   "keys": [ { "tonic": 0, "mode": "major", "name": "C" }, ... ],  // optional; 24 covered by default
 *   "diatonic": { "major": ["I","ii","iii","IV","V","vi","vii°"], "minor": ["i","ii°","bIII","iv","v","bVI","bVII"] },
 *   "subs": [ { "id": "tritone", "from": "V7", "to": ["bII7"], "label": "Tritone sub" }, ... ],
 *   "progressions": [ { "id": "2-5-1", "tokens": ["ii7","V7","Imaj7"], "mode": "major" }, ... ],
 *   "markov": { "I": { "IV": 0.35, "V": 0.3, "vi": 0.2, "ii": 0.15 }, ... }  // Roman → next Roman probs
 * }
 */
import {
  type Key, type Mode, chordIn, keyName, mod12, parseKey, pcName, usesFlats, KEY_NAMES,
} from '../pulpit/theory';
import { PC_NAMES_FLAT } from './detect';
import type { ChordQuality, DetectedChord } from './types';

export interface BeatTheorySub { id: string; from: string; to: string[]; label: string }
export interface BeatTheoryProg { id: string; tokens: string[]; mode: Mode; label?: string }
export interface BeatTheoryMaps {
  version: number;
  diatonic?: { major: string[]; minor: string[] };
  subs?: BeatTheorySub[];
  progressions?: BeatTheoryProg[];
  markov?: Record<string, Record<string, number>>;
  source?: string;
}

export const DEFAULT_DIATONIC = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  minor: ['i', 'ii°', 'bIII', 'iv', 'v', 'bVI', 'bVII'],
};

export const DEFAULT_SUBS: BeatTheorySub[] = [
  { id: 'tritone', from: 'V7', to: ['bII7'], label: 'Tritone substitution' },
  { id: '2-5-1', from: 'I', to: ['ii7', 'V7', 'Imaj7'], label: 'ii–V–I approach' },
  { id: '1-6-2-5', from: 'I', to: ['I', 'vi7', 'ii7', 'V7'], label: 'I–vi–ii–V rhythm changes turnaround' },
  { id: 'passing-dim', from: 'I', to: ['I', '#idim7', 'ii7'], label: 'Passing diminished' },
  { id: 'backdoor', from: 'Imaj7', to: ['iv7', 'bVII7', 'Imaj7'], label: 'Backdoor ii–V (iv–bVII–I)' },
  { id: 'gospel-walk', from: 'I', to: ['I', 'IV', 'I/V', 'V7'], label: 'Gospel I–IV–I/V–V7' },
  { id: 'shout-bVII', from: 'I', to: ['I', 'bVII', 'IV', 'I'], label: 'Shout bVII vamp' },
];

export const DEFAULT_PROGS: BeatTheoryProg[] = [
  { id: '2-5-1', tokens: ['ii7', 'V7', 'Imaj7'], mode: 'major', label: 'ii–V–I' },
  { id: '1-6-2-5', tokens: ['I', 'vi7', 'ii7', 'V7'], mode: 'major', label: 'I–vi–ii–V' },
  { id: 'backdoor', tokens: ['iv7', 'bVII7', 'Imaj7'], mode: 'major', label: 'Backdoor' },
  { id: 'minor-2-5-1', tokens: ['iim7b5', 'V7', 'i'], mode: 'minor', label: 'Minor ii–V–i' },
  { id: 'gospel-145', tokens: ['I', 'IV', 'V7', 'I'], mode: 'major', label: 'Gospel I–IV–V' },
  { id: 'shout', tokens: ['I', 'bVII', 'IV', 'I'], mode: 'major', label: 'Shout vamp' },
  { id: 'andante', tokens: ['i', 'bVI', 'bVII', 'i'], mode: 'minor', label: 'Aeolian walkup' },
];

/** Simple major-key Markov over Roman numerals (rows ~sum to 1). */
export const DEFAULT_MARKOV: Record<string, Record<string, number>> = {
  I: { IV: 0.28, V: 0.22, vi: 0.18, ii: 0.12, I: 0.1, V7: 0.1 },
  ii: { V: 0.45, V7: 0.3, I: 0.1, iii: 0.05, ii: 0.1 },
  iii: { vi: 0.4, IV: 0.3, ii: 0.15, iii: 0.15 },
  IV: { I: 0.35, V: 0.25, ii: 0.15, iv: 0.1, V7: 0.15 },
  V: { I: 0.55, vi: 0.2, V7: 0.1, IV: 0.05, V: 0.1 },
  V7: { I: 0.6, vi: 0.15, bII7: 0.1, V7: 0.15 },
  vi: { ii: 0.3, IV: 0.25, V: 0.15, I: 0.1, vi: 0.2 },
  'vii°': { I: 0.5, iii: 0.2, V: 0.15, 'vii°': 0.15 },
  bVII: { IV: 0.4, I: 0.35, bVII: 0.25 },
  bII7: { I: 0.7, bII7: 0.3 },
  i: { iv: 0.3, bVI: 0.2, bVII: 0.2, V: 0.15, i: 0.15 },
  iv: { i: 0.3, V: 0.25, bVII: 0.2, iv: 0.25 },
  bVI: { bVII: 0.4, i: 0.3, bVI: 0.3 },
};

let maps: BeatTheoryMaps = {
  version: 1,
  diatonic: DEFAULT_DIATONIC,
  subs: DEFAULT_SUBS,
  progressions: DEFAULT_PROGS,
  markov: DEFAULT_MARKOV,
  source: 'sanctum-builtin',
};

export function loadBeatTheoryMaps(m: BeatTheoryMaps) {
  maps = {
    version: m.version ?? 1,
    diatonic: m.diatonic ?? DEFAULT_DIATONIC,
    subs: m.subs?.length ? m.subs : DEFAULT_SUBS,
    progressions: m.progressions?.length ? m.progressions : DEFAULT_PROGS,
    markov: m.markov ?? DEFAULT_MARKOV,
    source: m.source ?? 'beat-theory',
  };
  return maps;
}

export function currentMaps() { return maps; }

export function relativeKey(k: Key): Key {
  return k.mode === 'major'
    ? { tonic: mod12(k.tonic + 9), mode: 'minor' }
    : { tonic: mod12(k.tonic + 3), mode: 'major' };
}

export function allKeys(): Key[] {
  const out: Key[] = [];
  for (let t = 0; t < 12; t++) {
    out.push({ tonic: t, mode: 'major' });
    out.push({ tonic: t, mode: 'minor' });
  }
  return out;
}

export function diatonicChords(k: Key) {
  const tokens = (maps.diatonic ?? DEFAULT_DIATONIC)[k.mode];
  // vii° / ii° use dim quality via token; chordIn may not know ° — map to dim
  return tokens.map((tok) => {
    const norm = tok.replace('°', 'dim').replace('ø', 'm7b5');
    try { return chordIn(norm, k); }
    catch { return chordIn(tok.replace('°', 'dim'), k); }
  });
}

/** Map absolute chord (root+quality) → Roman relative to key. */
export function toRoman(root: number, quality: ChordQuality, key: Key): string {
  if (root < 0 || quality === 'N') return 'N';
  const deg = mod12(root - key.tonic);
  // Major-scale degree names for analysis (accidentals vs major)
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const ROMAN_MAJ = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  let best = 0, bestDist = 99, acc = 0;
  for (let i = 0; i < 7; i++) {
    for (const a of [0, -1, 1]) {
      const d = Math.abs(mod12(MAJOR[i] + a) - deg);
      const dd = Math.min(d, 12 - d);
      if (dd < bestDist) { bestDist = dd; best = i; acc = a; }
    }
  }
  const base = ROMAN_MAJ[best];
  const prefix = acc === -1 ? 'b' : acc === 1 ? '#' : '';
  const q = quality;
  const minorish = q === 'min' || q === 'm7';
  const body = minorish ? base.toLowerCase() : base;
  let suf = '';
  if (q === '7') suf = '7';
  else if (q === 'maj7') suf = 'maj7';
  else if (q === 'm7') suf = '7';
  else if (q === 'dim') suf = 'dim';
  else if (q === 'aug') suf = '+';
  else if (q === 'sus2') suf = 'sus2';
  else if (q === 'sus4') suf = 'sus4';
  // Natural minor preference: show lowercase for tonic minor when matching
  if (key.mode === 'minor' && deg === 0 && (q === 'min' || q === 'm7')) return 'i' + (q === 'm7' ? '7' : '');
  return prefix + body + suf;
}

export function annotateRoman(chords: DetectedChord[], key: Key): DetectedChord[] {
  return chords.map((c) => ({ ...c, roman: toRoman(c.root, c.quality, key) }));
}

export function nextChords(roman: string, key: Key, n = 3): { label: string; roman: string; p: number }[] {
  const row = (maps.markov ?? DEFAULT_MARKOV)[roman] || (maps.markov ?? DEFAULT_MARKOV)[roman.replace(/\d.*/, '')] || {};
  const entries = Object.entries(row).sort((a, b) => b[1] - a[1]).slice(0, n);
  return entries.map(([r, p]) => {
    try {
      const tok = r.replace('°', 'dim');
      const ch = chordIn(tok, key);
      return { label: ch.name, roman: r, p };
    } catch {
      return { label: r, roman: r, p };
    }
  });
}

export function theoryPanel(key: Key, current?: DetectedChord | null) {
  const rel = relativeKey(key);
  const dia = diatonicChords(key);
  const roman = current ? toRoman(current.root, current.quality, key) : 'I';
  const next = nextChords(roman === 'N' ? (key.mode === 'minor' ? 'i' : 'I') : roman, key, 3);
  const subs = (maps.subs ?? DEFAULT_SUBS).slice(0, 5);
  return {
    keyName: keyName(key),
    relativeName: keyName(rel),
    diatonic: dia.map((c) => ({ name: c.name, token: c.token })),
    currentRoman: roman,
    next,
    subs,
    mapsSource: maps.source ?? 'sanctum-builtin',
  };
}

export function parseKeySafe(s: string): Key {
  return parseKey(s) || { tonic: 0, mode: 'major' };
}

export { keyName, parseKey, KEY_NAMES, pcName, usesFlats, mod12, chordIn, PC_NAMES_FLAT };
