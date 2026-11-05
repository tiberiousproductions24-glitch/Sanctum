// Chord detection + theory tests (synthetic harmonic tones + noise).
//   node scripts/chords-test.mjs
import { analyseChords, matchChroma, formatChord, decodeTemplateIndex, templateIndex, TEMPLATES, estimateTempo, chartToText } from '../src/chords/detect.ts';
import { analyseBuffer } from '../src/chords/offline.ts';
import {
  theoryPanel, toRoman, nextChords, relativeKey, diatonicChords, loadBeatTheoryMaps, currentMaps,
  parseKeySafe, keyName, annotateRoman,
} from '../src/chords/theory-ext.ts';
import { ADAPTERS } from '../src/chords/sources.ts';

let pass = 0, fail = 0; const out = [];
const check = (name, got, want, soft = false) => {
  const ok = typeof want === 'function' ? !!want(got) : JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; out.push(`FAIL ${name}: got ${JSON.stringify(got)} want ${typeof want === 'function' ? '<predicate>' : JSON.stringify(want)}`); if (!soft) {} }
  return ok;
};

const SR = 22050;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };

function chordTone(sig, start, dur, rootMidi, intervals, amp = 0.2) {
  const s0 = Math.floor(start * SR), n = Math.floor(dur * SR);
  for (const iv of intervals) {
    let ph = 0; const f0 = hz(rootMidi + iv);
    for (let i = 0; i < n && s0 + i < sig.length; i++) {
      const t = i / SR;
      ph += 2 * Math.PI * f0 / SR;
      const env = Math.min(1, t / 0.01) * Math.min(1, (dur - t) / 0.05);
      let x = 0; for (let k = 1; k <= 5; k++) x += Math.sin(ph * k) / k;
      sig[s0 + i] += amp * env * x;
    }
  }
}
function addNoise(sig, snrDb) {
  let p = 0; for (const x of sig) p += x * x; p /= sig.length;
  const a = Math.sqrt(p / Math.pow(10, snrDb / 10)) * Math.sqrt(3);
  for (let i = 0; i < sig.length; i++) sig[i] += a * rnd();
  return sig;
}

const QUAL = {
  maj: [0, 4, 7], min: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], aug: [0, 4, 8],
};

// ---- unit: template match on pure chroma ----
{
  const chroma = new Array(12).fill(0); chroma[0] = 1; chroma[4] = 1; chroma[7] = 1;
  const { best } = matchChroma(chroma);
  const d = decodeTemplateIndex(best);
  check('template C maj', d.root === 0 && d.quality === 'maj', true);
}
{
  const chroma = new Array(12).fill(0); chroma[9] = 1; chroma[0] = 1; chroma[4] = 1; // A C E
  const { best } = matchChroma(chroma);
  const d = decodeTemplateIndex(best);
  check('template Am', d.root === 9 && d.quality === 'min', true);
}

// ---- offline path accuracy ----
function synthProg(chords, noiseDb = null) {
  // chords: [{root, quality, dur}]
  const total = chords.reduce((a, c) => a + c.dur, 0);
  const sig = new Float32Array(Math.floor(total * SR));
  let t = 0;
  for (const c of chords) {
    chordTone(sig, t, c.dur, 48 + c.root, QUAL[c.quality], 0.22);
    chordTone(sig, t, c.dur, 36 + c.root, [0], 0.28); // bass
    t += c.dur;
  }
  if (noiseDb != null) addNoise(sig, noiseDb);
  return sig;
}

const cases = [
  { root: 0, quality: 'maj', want: 'C' },
  { root: 9, quality: 'min', want: 'Am' },
  { root: 7, quality: '7', want: 'G7' },
  { root: 5, quality: 'maj7', want: 'Fmaj7' },
  { root: 2, quality: 'm7', want: 'Dm7' },
  { root: 0, quality: 'sus4', want: 'Csus4', alt: ['Csus4'] },
  { root: 5, quality: 'sus2', want: 'Fsus2', alt: ['Fsus2'] },
  { root: 11, quality: 'dim', want: 'Bdim' },
  { root: 0, quality: 'aug', want: 'Caug' },
];

let exact = 0;
for (const c of cases) {
  const sig = synthProg([{ root: c.root, quality: c.quality, dur: 2.0 }], 25);
  const chart = analyseChords(sig, { sampleRate: SR, fftSize: 4096, hop: 2048, stay: 0.95, minConfidence: 0.15 });
  // majority label among non-N
  const counts = {};
  for (const x of chart.chords) if (x.label !== 'N') counts[x.label] = (counts[x.label] || 0) + (x.end - x.start);
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const alts = c.alt || [c.want];
  const ok = alts.includes(best) || (best && best.replace(/\/.*$/, '') === c.want);
  if (ok) exact++;
  check(`offline ${c.want}`, ok, true);
}
const offlineAcc = exact / cases.length;

// progression C – Am – F – G7
{
  const sig = synthProg([
    { root: 0, quality: 'maj', dur: 1.5 },
    { root: 9, quality: 'min', dur: 1.5 },
    { root: 5, quality: 'maj', dur: 1.5 },
    { root: 7, quality: '7', dur: 1.5 },
  ], 28);
  const t0 = performance.now();
  const chart = analyseChords(sig, { sampleRate: SR, stay: 0.75, minConfidence: 0.15 });
  chart.source = { kind: 'file', title: 'synth-prog' };
  if (chart.key) {}
  const ms = performance.now() - t0;
  const labels = chart.chords.filter((c) => c.label !== 'N').map((c) => c.label);
  // collapse consecutive
  const seq = labels.filter((l, i) => i === 0 || l !== labels[i - 1]);
  const joined = seq.join(' ');
  check('prog contains C', /\bC\b|Cmaj/.test(joined), true);
  check('prog contains Am', /Am|C\/A|Amin/.test(joined), true);
  check('prog contains F', /\bF\b|Fmaj/.test(joined), true);
  check('prog contains G7', /G7/.test(joined), true);
  console.log('  prog sequence:', seq.join(' → '));
  check('analyse latency < 2s for 6s audio', ms < 2000, true);
  console.log(`  offline analyse ${ms.toFixed(1)} ms for ${chart.duration.toFixed(2)}s audio (${(chart.duration * 1000 / ms).toFixed(1)}× realtime)`);
}

// live-path simulation: frame-by-frame causal (same DSP as live)
{
  const { causalStep } = await import('../src/chords/detect.ts');
  const sig = synthProg([{ root: 0, quality: 'maj', dur: 1.2 }, { root: 7, quality: '7', dur: 1.2 }], 22);
  const fftSize = 4096, hop = 2048;
  let prev = 0, correct = 0, total = 0;
  const frame = new Float64Array(fftSize);
  const { magnitudes, chromaFromSpectrum } = await import('../src/pulpit/keydetect.ts');
  for (let s = 0; s + fftSize <= sig.length; s += hop) {
    for (let i = 0; i < fftSize; i++) frame[i] = sig[s + i];
    const chroma = chromaFromSpectrum(magnitudes(frame), SR, fftSize);
    const { scores } = matchChroma(chroma);
    prev = causalStep(prev, scores, 0.9);
    const d = decodeTemplateIndex(prev);
    const t = s / SR;
    // skip boundary ±150ms
    if (Math.abs(t - 1.2) < 0.15) continue;
    const wantQ = t < 1.2 ? 'maj' : '7';
    const wantR = t < 1.2 ? 0 : 7;
    total++;
    if (d.root === wantR && (d.quality === wantQ || (wantQ === 'maj' && d.quality === 'maj7') || (wantQ === '7' && d.quality === 'maj'))) correct++;
  }
  const liveAcc = total ? correct / total : 0;
  check('live-path frame acc ≥ 0.55', liveAcc >= 0.55, true);
  console.log(`  live-path frame accuracy ${(liveAcc * 100).toFixed(1)}% (${correct}/${total})`);
}

// ---- theory ----
{
  const k = parseKeySafe('Eb');
  check('key Eb', keyName(k), 'Eb');
  check('relative of Eb', keyName(relativeKey(k)), 'Cm');
  check('relative of Am', keyName(relativeKey(parseKeySafe('Am'))), 'C');
  const dia = diatonicChords(parseKeySafe('C'));
  check('diatonic C has 7', dia.length, 7);
  check('I in C is C', dia[0].name, 'C');
  check('toRoman Am in C', toRoman(9, 'min', parseKeySafe('C')), 'vi');
  check('toRoman G7 in C', toRoman(7, '7', parseKeySafe('C')), (x) => x === 'V7' || x === 'V');
  const next = nextChords('I', parseKeySafe('C'), 3);
  check('markov next has entries', next.length >= 2, true);
  const panel = theoryPanel(parseKeySafe('G'), { label: 'D7', root: 2, quality: '7', bass: 2, confidence: 1, start: 0, end: 1, roman: 'V7' });
  check('panel key G', panel.keyName, 'G');
  check('panel relative Em', panel.relativeName, 'Em');
  // schema drop-in
  loadBeatTheoryMaps({ version: 1, source: 'test-maps', markov: { I: { V: 1 } } });
  check('maps source override', currentMaps().source, 'test-maps');
  check('markov override', nextChords('I', parseKeySafe('C'), 1)[0].roman, 'V');
  // restore
  loadBeatTheoryMaps({ version: 1, source: 'sanctum-builtin' });
}

// adapters present
check('7 adapters', ADAPTERS.length, 7);
check('no youtube adapter', ADAPTERS.every((a) => a.id !== 'youtube'), true);
check('spotify is metadata', ADAPTERS.find((a) => a.id === 'spotify')?.capability, 'metadata');

console.log(`\nchords-test: ${pass} pass, ${fail} fail · offline single-chord accuracy ${(offlineAcc * 100).toFixed(0)}%`);
if (out.length) console.log(out.join('\n'));
process.exit(fail ? 1 : 0);
