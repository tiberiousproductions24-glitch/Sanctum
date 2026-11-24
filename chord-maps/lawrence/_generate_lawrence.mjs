// Generates progressions.json (12-key) for the Follow Me reference-shout analysis.
// Uses the app's own theory.ts (chordIn / voice(low=48) / bassNote(low=28)) so voicings match the app.
//   node --import ./scripts/ts-ext-resolve.mjs chord-maps/lawrence/_generate_lawrence.mjs
import fs from 'node:fs';
import { chordIn, voice, bassNote, mod12, FLAT_NAMES, SHARP_NAMES } from '../../src/pulpit/theory.ts';

const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEYS = new Set(['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']); // gospel spelling: flat keys use flats
// sus2 isn't a theory.ts quality; these tokens produce the same pitch set, displayed as sus2.
const SUS2_DISPLAY = { 'Isus/4': 5, 'bVIIsus/b3': 3, 'bIIsus/#4': 6 };

const PROGS = [
  { id: 'lw-shout-cadence', name: 'Shout cadence (6–5–1, blue 3rd)', defaultKey: 'Gb', confidence: 'medium-high',
    tokens: ['vi7', 'Vsus', 'i', 'I'], cues: ['vamp', 'setup', 'vamp', 'home'],
    heard: [[30.9, 41.9], [49.2, 57.4], [81.7, 88.0]],
    desc: 'Most repeated move in the Gb section: 6m7 → 5sus → 1 with the minor 3rd bending up to major (i → I). Heard 3×.',
    uncertain: 'i vs I: both 3rds are present (blues shout colour); the order minor→major is the best fit, not certain. 5 may be 5(7sus4)/5(9sus4) — 7th not resolved by the detector.' },
  { id: 'lw-shout-cadence-vi7', name: 'Shout cadence with 6 dominant', defaultKey: 'Gb', confidence: 'medium',
    tokens: ['VI7', 'vi', 'Vsus', 'i', 'I'], cues: ['vamp', 'vamp', 'setup', 'vamp', 'home'],
    heard: [[48.3,57.4]],
    desc: '6(7) → 6m → 5sus → 1 (minor-to-major). Variant of the cadence. Heard 1×.',
    uncertain: 'VI7 lasts only ~2 beats; could be a passing 6(7#9).' },
  { id: 'lw-aug-lick', name: 'Augmented lick (7 → 1+ → b3 sus2)', defaultKey: 'Gb', confidence: 'medium',
    tokens: ['VIImaj7', 'I+', 'bVIIsus/b3'], cues: ['pass', 'vamp', 'vamp'],
    heard: [[2.0, 6.4], [71.2, 76.0]],
    desc: 'Pickup from the 7 into 1 augmented (Gb bass), then b3 sus2 (A sus2 over A in Gb). Same 3-chord shape heard twice, identically.',
    uncertain: 'The pickup (VIImaj7) is ~1 beat. 1+ might be a 1(7#5) or a 1(7#9) voicing split across two bars; b3 sus2 could be the upper part of 1(7#9).' },
  { id: 'lw-turnaround-lift', name: 'Long turnaround into the half-step lift', defaultKey: 'Gb', confidence: 'medium',
    tokens: ['I+', 'bVIIsus/b3', 'ii', 'bIImaj7', 'vi7', 'Vsus', 'Imaj7', 'Isus', '#ivdim7', 'bII'],
    cues: ['vamp', 'vamp', 'vamp', 'pass', 'turnaround', 'setup', 'hold', 'hold', 'pass', 'home'],
    heard: [[71.6, 90.6]],
    modulation: { atToken: 9, semitones: 1, note: 'Last chord (bII) is the new 1 — the key goes up a half step (Gb → G at 90.6 s).' },
    desc: 'The full phrase before the key change: 1+ → b3sus2 → 2m → b2maj7 → 6m7 → 5sus → 1maj7 → 1sus → #4dim7 → new 1 (up a half step).',
    uncertain: 'Between 78.6–81.3 s the detector heard a weak 5m9 with a chromatic bass walk-down (b7 6 b6 5) — left out of the tokens. #4dim7 is 1 beat; it works as a rootless V7b9 of the new key.' },
  { id: 'lw-half-step-lift', name: 'Half-step lift (key up one)', defaultKey: 'Gb', confidence: 'medium-high',
    tokens: ['Isus', '#ivdim7', 'bII'], cues: ['hold', 'pass', 'home'],
    heard: [[88.0, 94.0]],
    modulation: { atToken: 2, semitones: 1, note: 'bII becomes the new 1.' },
    desc: '1sus → #4dim7 (= rootless 5(7b9) of the new key) → new 1. Tonal centre move Gb → G is clear in both engines.',
    uncertain: 'The key change itself is high confidence; the exact pivot chord (dim7) is 1 beat, medium.' },
  { id: 'lw-walkup-low', name: '4m9 walk-up back to 1 (LOW confidence)', defaultKey: 'Gb', confidence: 'low',
    tokens: ['iv9', 'bVII7b9', '#ivdim7', 'bVImaj7', 'bIIsus/#4', 'Isus'],
    cues: ['vamp', 'vamp', 'pass', 'vamp', 'setup', 'home'],
    heard: [[57.4, 69.4]],
    bassWalk: 'b-line ~59–62 s: 5 6 b7 7 → 1 (Db Eb E F → Gb in Gb), chromatic walk-up',
    desc: '4m9 → b7(7b9) → #4dim7 → b6maj7 → #4 sus2 → 1sus. Heard 1×.',
    uncertain: 'Chord labels here disagree with the bass line; only the bass walk-up and the #4 sus2 (C sus2 in Gb, 4 beats) are fairly clear. Needs ear check before shipping.' },
  { id: 'lw-two-chromatic-low', name: '2(7sus) → #4(9) → b3 → 1 (LOW confidence)', defaultKey: 'Gb', confidence: 'low',
    tokens: ['II7sus', '#IV9', 'bIII', 'Isus'], cues: ['vamp', 'vamp', 'pass', 'home'],
    heard: [[41.9, 48.3]],
    bassWalk: 'b-line ~42–48 s: 7 6 b6 5 (F Eb D Db in Gb), chromatic walk-down into 5',
    desc: 'Chromatic descending phrase. Heard 1×.',
    uncertain: '#IV9 (C9 in Gb) and bIII are weak matches; the walk-down in the bass is clearer than the chords.' },
  { id: 'lw-lift-shout', name: 'Lifted shout (1 → 4sus2 → #4ø7 → 5sus)', defaultKey: 'G', confidence: 'medium-high',
    tokens: ['I', 'Isus/4', '#ivm7b5', 'Vsus'], cues: ['vamp', 'vamp', 'pass', 'setup'],
    heard: [[90.6, 100.4], [111.8, 118.3], [129.2, 136.1]],
    desc: 'Main loop after the key change: 1 → 4 sus2 → #4 half-dim → 5 sus. Heard 3× (G section).',
    uncertain: '4 sus2 (C sus2 in G) = Gsus4/C pitch set; the 3rd of 4 is weak/absent. Once it was heard as #4m triad instead of ø7.' },
  { id: 'lw-lift-shout-ext', name: 'Lifted shout, extended (4(9) → 2 → 1(7sus) → #4ø7 → 5sus)', defaultKey: 'G', confidence: 'medium',
    tokens: ['IV9', 'II', 'I7sus', '#ivm7b5', 'Vsus', 'I'], cues: ['vamp', 'vamp', 'vamp', 'pass', 'setup', 'home'],
    heard: [[103.0, 114.0]],
    desc: 'Variation of the lifted loop. Heard 1×.',
    uncertain: '#4 was detected as a minor triad (C#m in G); charted as ø7 to match the other bars — a judgement call. II may be II7.' },
  { id: 'lw-lift-tag', name: 'Lifted tag (1(7#9) → 4 → 2(7) → 4sus2 → 1maj7)', defaultKey: 'G', confidence: 'medium',
    tokens: ['I7#9', 'IV', 'II7', 'Isus/4', 'Imaj7'], cues: ['stab', 'vamp', 'vamp', 'setup', 'home'],
    heard: [[119.6, 129.2]],
    desc: 'Blues-shout tag before the last loop. Heard 1×.',
    uncertain: 'A one-beat bIIImaj7 at 123.1 s was dropped as a passing hit.' },
];

function step(tok, cue, key) {
  const tonic = KEYS.indexOf(key);
  const ch = chordIn(tok, { tonic, mode: 'major' });
  const keyNames = FLAT_KEYS.has(key) ? FLAT_NAMES : SHARP_NAMES;
  // Accidental on the degree wins: b-degrees spell flat, #-degrees spell sharp (F#dim7 in C, Bb in G).
  const pick = (acc) => (acc === 'b' ? FLAT_NAMES : acc === '#' ? SHARP_NAMES : keyNames);
  const [head, slashDeg] = tok.split('/');
  const rootNames = pick(head[0]);
  const bassNames = slashDeg ? pick(slashDeg[0]) : rootNames;
  const label = ch.name.replace(/^[A-G][#b]?/, '').replace(/\/[A-G][#b]?$/, '');
  let symbol = rootNames[mod12(ch.root)] + label + (ch.bass !== ch.root ? '/' + bassNames[mod12(ch.bass)] : '');
  if (tok in SUS2_DISPLAY) symbol = bassNames[mod12(tonic + SUS2_DISPLAY[tok])] + 'sus2';
  return { token: tok, symbol, root: ch.root, bass: ch.bass, notesMidi: voice(ch, 48), bassMidi: bassNote(ch, 28), intensityCue: cue };
}

const progressions = PROGS.map((p) => {
  const charts = {};
  for (const k of KEYS) charts[k] = p.tokens.map((t, i) => step(t, p.cues[i], k));
  const { heard, uncertain, confidence, cues, modulation, bassWalk, ...rest } = p;
  return {
    ...rest, mode: 'major', feel: 'Shout', feelId: 'shout', serviceMoment: 'shout', kind: 'shout',
    tags: ['shout', 'reference-transcription', 'confidence:' + confidence], bpm: 136, beatsPerChord: 4,
    analysis: { confidence, heardAtSec: heard, uncertain, ...(bassWalk ? { bassWalk } : {}) },
    ...(modulation ? { modulation } : {}),
    charts,
  };
});
// Engine's normalizeKeyName maps Gb → "F#"; mirror so the file is a drop-in for chartFor().
for (const p of progressions) p.charts['F#'] = p.charts['Gb'];

// Level wiring + organ-run cues are intensity semantics (not chord content): carried over from the
// legacy Beat Theory file so Shout/Worship 1–4 keep working. No Beat Theory chords are reused.
const legacy = JSON.parse(fs.readFileSync(new URL('../pulpit-12key-charts.json', import.meta.url), 'utf8'));
const LOW = new Set(['lw-walkup-low', 'lw-two-chromatic-low']);
for (const p of progressions) {
  p.checkByEar = LOW.has(p.id);
  if (p.checkByEar) { p.name = p.name.replace(' (LOW confidence)', '') + ' — check by ear'; p.tags.push('check-by-ear'); }
}
// Hook chords (single-tap vocabulary) from the transcription's most-heard chords.
const HOOK = [['I', 'I'], ['IV', 'Isus/4'], ['V', 'Vsus'], ['vi', 'vi7'], ['ii', 'ii'], ['#iv', '#ivdim7'], ['I+', 'I+'], ['bII', 'bII']];
const hookByKey = {};
for (const k of KEYS) hookByKey[k] = HOOK.map(([role, t]) => { const st = step(t, 'hold', k); return { role, token: t, symbol: st.symbol, root: st.root, bass: st.bass, notesMidi: st.notesMidi, bassMidi: st.bassMidi }; });
hookByKey['F#'] = hookByKey['Gb'];

const out = {
  version: 1,
  source: 'reference-transcription',
  sourceMedia: 'shout-chords-1.mp4 (screen recording of a Facebook Live; organist likely Montrell James per a stream comment — NOT Lawrence\'s own playing)',
  feature: 'Follow Me', featureSubtitle: 'Preacher Assist',
  created: '2026-11-23', status: 'LIVE chart source for Follow Me from v0.3.4 (replaces pulpit-12key-charts.json)',
  detected: { key: 'Gb major (blues/shout, flat-3 colour) → G major from 90.6 s (half-step lift)', bpm: 136, harmonicRhythm: '~1 chord per bar (4 beats ≈ 1.76 s)' },
  voicingRegister: { closeVoicing: 'voice(ch, 48)', bass: 'bassNote(ch, 28)', keyNames: KEYS, keyAliases: { 'F#': 'Gb' }, gospelFlatSpelling: 'flats for C F Bb Eb Ab Db Gb; sharps for G D A E B' },
  sourceLabel: 'Shout reference transcription (from a live stream) — not Lawrence\'s own playing',
  checkByEar: [...LOW],
  naming: legacy.naming,
  intensityWiring: legacy.intensityWiring,
  organRunCues: legacy.organRunCues,
  hookChords: { description: 'Single-tap vocabulary from the reference transcription (most-heard chords).', roles: HOOK.map(([r]) => r), byKey: hookByKey },
  progressions,
};
fs.writeFileSync(new URL('./progressions.json', import.meta.url), JSON.stringify(out, null, 1));
// Served copy (content/ is shipped into dist by vite.config.ts).
fs.writeFileSync(new URL('../../content/chord-maps/follow-me-shout-reference.json', import.meta.url), JSON.stringify(out));
for (const p of progressions) console.log(p.id.padEnd(22), p.defaultKey.padEnd(3), p.charts[p.defaultKey].map((s) => s.symbol).join('  '), '| C:', p.charts.C.map((s) => s.symbol).join(' '));
