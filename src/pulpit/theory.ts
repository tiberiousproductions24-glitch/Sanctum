// Sanctum Pulpit: music theory core. Pure TypeScript with no imports, so it runs in the browser and under
// `node` (type stripping) for unit tests. Key-relative progressions (Roman numerals or Nashville numbers) are
// transposed to any key.

export type Mode = 'major' | 'minor';
export interface Key { tonic: number; mode: Mode }          // tonic pitch class 0..11 (C = 0)
export interface Chord {
  token: string;        // the key-relative source token, e.g. "ii7", "bVII", "4(9)", "V7/5"
  root: number;         // pitch class 0..11
  bass: number;         // pitch class of the bass note (differs from root for slash chords)
  intervals: number[];  // semitones above root (can exceed 12 for extensions)
  name: string;         // absolute chord name, e.g. "Ab7", "Fm9", "Eb/Bb"
  degree: number;       // semitone offset of the root from the tonic
}

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
// Gospel-friendly spelling for key names: flats everywhere except F#.
export const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const ROMANS = ['VII', 'III', 'VI', 'IV', 'II', 'V', 'I']; // longest first for greedy matching
const ROMAN_DEGREE: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Major keys use sharps for G D A E B F#, flats for F Bb Eb Ab Db. Minor keys follow their relative major. */
export function usesFlats(k: Key): boolean {
  const rel = k.mode === 'minor' ? mod12(k.tonic + 3) : k.tonic;
  return [0, 5, 10, 3, 8, 1].includes(rel); // C/Am spell accidentals as flats (bVII = Bb), gospel convention
}
export function pcName(pc: number, flats = true) { return (flats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)]; }
export function keyName(k: Key) { return KEY_NAMES[mod12(k.tonic)] + (k.mode === 'minor' ? 'm' : ''); }

/** Parse "Ab", "F#m", "Bb minor", "c#" (lowercase = minor). */
export function parseKey(s: string): Key | null {
  const m = /^\s*([A-Ga-g])([#b♯♭]?)\s*(m|min|minor|maj|major)?\s*$/.exec(s);
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase() as 'C'];
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  const minor = m[3] ? /^m(in(or)?)?$/.test(m[3]) : m[1] === m[1].toLowerCase();
  return { tonic: mod12(base + acc), mode: minor ? 'minor' : 'major' };
}

// Chord-quality suffixes → intervals. Each suffix has a major-numeral and a minor-numeral reading.
const QUALITY: Record<string, { up: number[]; low: number[]; label: [string, string] }> = {
  '':     { up: [0, 4, 7],          low: [0, 3, 7],          label: ['', 'm'] },
  '7':    { up: [0, 4, 7, 10],      low: [0, 3, 7, 10],      label: ['7', 'm7'] },
  'maj7': { up: [0, 4, 7, 11],      low: [0, 3, 7, 11],      label: ['maj7', 'm(maj7)'] },
  '9':    { up: [0, 4, 7, 10, 14],  low: [0, 3, 7, 10, 14],  label: ['9', 'm9'] },
  'maj9': { up: [0, 4, 7, 11, 14],  low: [0, 3, 7, 11, 14],  label: ['maj9', 'm(maj9)'] },
  '11':   { up: [0, 7, 10, 14, 17], low: [0, 3, 7, 10, 17],  label: ['11', 'm11'] },
  '13':   { up: [0, 4, 10, 14, 21], low: [0, 3, 10, 14, 21], label: ['13', 'm13'] },
  '6':    { up: [0, 4, 7, 9],       low: [0, 3, 7, 9],       label: ['6', 'm6'] },
  '69':   { up: [0, 4, 7, 9, 14],   low: [0, 3, 7, 9, 14],   label: ['6/9', 'm6/9'] },
  'add9': { up: [0, 4, 7, 14],      low: [0, 3, 7, 14],      label: ['add9', 'm(add9)'] },
  'sus':  { up: [0, 5, 7],          low: [0, 5, 7],          label: ['sus4', 'sus4'] },
  '7sus': { up: [0, 5, 7, 10],      low: [0, 5, 7, 10],      label: ['7sus4', '7sus4'] },
  '7#9':  { up: [0, 4, 10, 15],     low: [0, 3, 10, 15],     label: ['7#9', 'm7#9'] },
  '7b9':  { up: [0, 4, 10, 13],     low: [0, 3, 10, 13],     label: ['7b9', 'm7b9'] },
  'dim':  { up: [0, 3, 6],          low: [0, 3, 6],          label: ['dim', 'dim'] },
  'dim7': { up: [0, 3, 6, 9],       low: [0, 3, 6, 9],       label: ['dim7', 'dim7'] },
  'm7b5': { up: [0, 3, 6, 10],      low: [0, 3, 6, 10],      label: ['m7b5', 'm7b5'] },
  'aug':  { up: [0, 4, 8],          low: [0, 4, 8],          label: ['+', '+'] },
  'm':    { up: [0, 3, 7],          low: [0, 3, 7],          label: ['m', 'm'] },
  'm7':   { up: [0, 3, 7, 10],      low: [0, 3, 7, 10],      label: ['m7', 'm7'] },
  'm9':   { up: [0, 3, 7, 10, 14],  low: [0, 3, 7, 10, 14],  label: ['m9', 'm9'] },
  'm11':  { up: [0, 3, 7, 10, 17],  low: [0, 3, 7, 10, 17],  label: ['m11', 'm11'] },
};
const ALIASES: Record<string, string> = { 'o': 'dim', '°': 'dim', 'o7': 'dim7', '°7': 'dim7', 'ø': 'm7b5', 'ø7': 'm7b5', '+': 'aug', 'sus4': 'sus', '7sus4': '7sus', '6/9': '69', 'M7': 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', 'mi7': 'm7', 'min7': 'm7', '(9)': '9', '(7)': '7', '(13)': '13', '(7#9)': '7#9', 'm(9)': 'm9' };

/**
 * Parse one key-relative chord token.
 * Roman: [b|#]<I..VII|i..vii><suffix>[/<bass degree>]   e.g. "I", "ii7", "V7", "bVII", "#ivdim7", "I/5", "vi9"
 * Nashville: [b|#]<1..7>[m]<suffix>[/<bass degree>]     e.g. "1", "4(9)", "2m9", "6m7", "5(13)", "1/5"
 * Bass degree after "/" is a scale degree number (Nashville-style), with optional b/# ("I/b7").
 */
export function parseToken(token: string, mode: Mode = 'major'): { degree: number; intervals: number[]; label: string; bassDegree: number | null } {
  let s = token.trim();
  let bassDegree: number | null = null;
  const slash = s.lastIndexOf('/');
  if (slash > 0 && /^[b#]?[1-7]$/.test(s.slice(slash + 1)) && !/6\/9$/.test(s)) {
    bassDegree = degreeOffset(s.slice(slash + 1), mode); s = s.slice(0, slash);
  }
  let acc = 0;
  while (s[0] === 'b' || s[0] === '#' || s[0] === '♭' || s[0] === '♯') { acc += s[0] === '#' || s[0] === '♯' ? 1 : -1; s = s.slice(1); }
  let deg = 0; let lower = false; let rest = '';
  const nash = /^([1-7])(.*)$/.exec(s);
  if (nash) {
    deg = Number(nash[1]); rest = nash[2];
    // Nashville: plain numbers take the diatonic quality of the mode only when marked; default major, "m" = minor
    if (rest.startsWith('m') && !rest.startsWith('maj')) { lower = true; rest = rest.slice(1); }
  } else {
    const up = s.toUpperCase();
    const r = ROMANS.find((x) => up.startsWith(x));
    if (!r) throw new Error(`Bad chord token "${token}"`);
    deg = ROMAN_DEGREE[r]; lower = s.slice(0, r.length) === s.slice(0, r.length).toLowerCase(); rest = s.slice(r.length);
  }
  let q = rest.replace(/^\((.*)\)$/, '$1');
  q = ALIASES[rest] ?? ALIASES[q] ?? q;
  if (lower && (q === 'm' || q === 'm7' || q === 'm9' || q === 'm11')) q = q.slice(1);
  const def = QUALITY[q];
  if (!def) throw new Error(`Unknown chord quality "${rest}" in "${token}"`);
  // Roman numerals: accidentals are relative to the MAJOR scale of the tonic (standard analytic
  // convention), so bVI in A minor is F — not a double-flat of natural-minor VI. Nashville numbers
  // stay mode-relative (1..7 of the active scale).
  const scale = nash ? (mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE) : MAJOR_SCALE;
  const degree = mod12(scale[deg - 1] + acc);
  return { degree, intervals: lower ? def.low : def.up, label: lower ? def.label[1] : def.label[0], bassDegree };
}

function degreeOffset(s: string, mode: Mode): number {
  let acc = 0; let t = s;
  while (t[0] === 'b' || t[0] === '#') { acc += t[0] === '#' ? 1 : -1; t = t.slice(1); }
  const scale = mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  return mod12(scale[Number(t) - 1] + acc);
}

/** Resolve one key-relative token into an absolute chord in `key`. */
export function chordIn(token: string, key: Key): Chord {
  const p = parseToken(token, key.mode);
  const root = mod12(key.tonic + p.degree);
  const bass = p.bassDegree == null ? root : mod12(key.tonic + p.bassDegree);
  const flats = usesFlats(key);
  const nm = (pc: number) => pcName(pc, flats);
  const name = nm(root) + p.label + (bass !== root ? '/' + nm(bass) : '');
  return { token, root, bass, intervals: p.intervals, name, degree: p.degree };
}

/** Transpose a whole progression (array of tokens) into a key. */
export function transpose(tokens: string[], key: Key): Chord[] { return tokens.map((t) => chordIn(t, key)); }

/** Shift a key by n semitones (key change "up a step"). */
export function shiftKey(k: Key, semis: number): Key { return { tonic: mod12(k.tonic + semis), mode: k.mode }; }

/** MIDI notes for a chord voiced in a register: close voicing starting at or above `low` (root position, no doubling). */
export function voice(ch: Chord, low = 52, maxNotes = 5): number[] {
  let r = low + mod12(ch.root - low);
  const notes = ch.intervals.slice(0, maxNotes).map((i) => r + i);
  // keep the voicing compact: fold extensions above 2 octaves down an octave
  return notes.map((n) => (n - r > 16 ? n - 12 : n)).sort((a, b) => a - b).filter((n, i, a) => a.indexOf(n) === i);
}
/** Bass note (MIDI) for a chord in the 28..43 range (E1..G2). */
export function bassNote(ch: Chord, low = 31) { return low + mod12(ch.bass - low); }

/** Minimal-motion voice leading: shift each note of `next` by octaves to stay near `prev`. */
export function lead(prev: number[] | null, next: number[]): number[] {
  if (!prev || !prev.length) return next;
  const center = prev.reduce((a, b) => a + b, 0) / prev.length;
  const c2 = next.reduce((a, b) => a + b, 0) / next.length;
  const shift = Math.round((center - c2) / 12) * 12;
  return next.map((n) => n + shift);
}

export const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
