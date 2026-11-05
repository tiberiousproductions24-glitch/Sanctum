// Unit tests for Sanctum Pulpit: progression transposer + key detector (synthetic audio of known keys).
//   node scripts/pulpit-test.mjs        (Node ≥ 23.6 runs the .ts modules directly via type stripping)
import { chordIn, transpose, parseKey, keyName, shiftKey, voice, mod12 } from '../src/pulpit/theory.ts';
import { analyseSignal, KEY_LABELS } from '../src/pulpit/keydetect.ts';
import { PROGRESSIONS, SONGS, SHOUT_SETS, PLAYLISTS, validateLibrary } from '../src/pulpit/library.ts';

let pass = 0, fail = 0; const out = [];
const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; if (!ok) out.push(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const names = (toks, k) => transpose(toks, parseKey(k)).map((c) => c.name);

// ---------- transposer ----------
check('I IV V7 in C', names(['I', 'IV', 'V7'], 'C'), ['C', 'F', 'G7']);
check('I IV V7 in Ab', names(['I', 'IV', 'V7'], 'Ab'), ['Ab', 'Db', 'Eb7']);
check('1-6-2-5 Nashville in Eb', names(['1', '6m7', '2m7', '5(7)'], 'Eb'), ['Eb', 'Cm7', 'Fm7', 'Bb7']);
check('ii-V-I in Bb', names(['ii7', 'V7', 'Imaj7'], 'Bb'), ['Cm7', 'F7', 'Bbmaj7']);
check('minor shout i-iv in Fm', names(['i', 'iv'], 'Fm'), ['Fm', 'Bbm']);
check('bVI bVII i in Am', names(['bVI', 'bVII', 'i'], 'Am'), ['F', 'G', 'Am']);
check('V7 in C minor', names(['V7'], 'Cm'), ['G7']);
check('#ivdim7 in C', names(['#ivdim7'], 'C'), ['Gbdim7']);
check('I/5 in G', names(['I/5'], 'G'), ['G/D']);
check('ii7 in F#', names(['ii7'], 'F#'), ['G#m7']);
check('4(13) in D', names(['4(13)'], 'D'), ['G13']);
check('6(7#9) in A', names(['6(7#9)'], 'A'), ['F#7#9']);
check('2m9 5(13) in Db', names(['2m9', '5(13)'], 'Db'), ['Ebm9', 'Ab13']);
check('shiftKey Eb +2 = F', keyName(shiftKey(parseKey('Eb'), 2)), 'F');
check('parseKey c# = C#m', keyName(parseKey('c#')), 'Dbm');
check('voice C7 from E3 (close voicing)', voice(chordIn('I7', parseKey('C')), 52), [60, 64, 67, 70]);
// exhaustive: every library progression in all 24 keys keeps root - tonic == its degree, and pitch classes stay in 0..11
let exhaustive = 0, exErr = 0;
for (const p of [...PROGRESSIONS, ...SHOUT_SETS.flatMap((s) => [s.vamp, s.ending].map((toks) => ({ mode: s.mode, steps: toks.map((c) => ({ c })) })))]) {
  for (let t = 0; t < 12; t++) {
    const key = { tonic: t, mode: p.mode };
    for (const st of p.steps) { const ch = chordIn(st.c, key); exhaustive++; if (mod12(ch.root - t) !== ch.degree || ch.root < 0 || ch.root > 11) exErr++; }
  }
}
check('library progressions × 12 tonics consistent', exErr, 0);
const lib = validateLibrary((t, m) => chordIn(t, { tonic: 0, mode: m })); check('library validates (songs, playlists reference real items)', lib, []);
const transposerSummary = `${pass}/${pass + fail} transposer checks (+${exhaustive} exhaustive chord resolutions)`;

// ---------- key detector ----------
const SR = 22050;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
function tone(sig, start, dur, midi, amp, partials = 6, vib = 0) {
  const s0 = Math.floor(start * SR), n = Math.floor(dur * SR); let ph = 0;
  for (let i = 0; i < n && s0 + i < sig.length; i++) {
    const t = i / SR; const f = hz(midi) * (1 + vib * Math.sin(2 * Math.PI * 5.5 * t));
    ph += 2 * Math.PI * f / SR; const env = Math.min(1, t / 0.02) * Math.min(1, (dur - t) / 0.05);
    let x = 0; for (let k = 1; k <= partials; k++) x += Math.sin(ph * k) / k;
    sig[s0 + i] += amp * env * x;
  }
}
const MAJ = [0, 4, 7], MIN = [0, 3, 7];
function cadence(tonic, minor) {
  // I-IV-V7-I (major) / i-iv-V7-i (minor), bass + triad, 1.5 s each
  const chords = minor ? [[0, MIN], [5, MIN], [7, [0, 4, 7, 10]], [0, MIN]] : [[0, MAJ], [5, MAJ], [7, [0, 4, 7, 10]], [0, MAJ]];
  const sig = new Float32Array(SR * 6);
  chords.forEach(([deg, iv], j) => { const root = 48 + mod12(tonic + deg); tone(sig, j * 1.5, 1.5, root - 12, 0.3); for (const x of iv) tone(sig, j * 1.5, 1.5, root + x, 0.15); });
  return sig;
}
function hum(tonic, minor) {
  // monophonic "whoop"-like line: voice-ish spectrum (many partials) + vibrato, centred on tonic/3rd/5th
  const deg = minor ? [0, 3, 7, 3, 5, 3, 2, 0, 7, 0, 3, 0] : [0, 4, 7, 4, 2, 0, 7, 9, 7, 4, 2, 0];
  const sig = new Float32Array(SR * 7);
  deg.forEach((d, j) => tone(sig, j * 0.55, 0.55, 48 + mod12(tonic) + d, 0.35, 10, 0.006));
  return sig;
}
const addNoise = (sig, snrDb) => { let p = 0; for (const x of sig) p += x * x; p /= sig.length; const a = Math.sqrt(p / Math.pow(10, snrDb / 10)) * Math.sqrt(3); for (let i = 0; i < sig.length; i++) sig[i] += a * rnd(); return sig; };

function run(label, gen, noise) {
  let exact = 0, related = 0, total = 0; const misses = [];
  for (let t = 0; t < 12; t++) for (const minor of [false, true]) {
    let sig = gen(t, minor); if (noise != null) sig = addNoise(sig, noise);
    const r = analyseSignal(sig, SR, 4096, 2048);
    const want = KEY_LABELS[t] + (minor ? 'm' : ''); total++;
    if (r.best.name === want) exact++;
    else {
      const rel = minor ? KEY_LABELS[mod12(t + 3)] : KEY_LABELS[mod12(t + 9)] + 'm';
      const fifth = KEY_LABELS[mod12(t + 7)] + (minor ? 'm' : ''), fourth = KEY_LABELS[mod12(t + 5)] + (minor ? 'm' : '');
      if ([rel, fifth, fourth].includes(r.best.name)) related++;
      misses.push(`${want}→${r.best.name}`);
    }
  }
  return { label, exact, related, total, pct: Math.round(exact / total * 100), misses };
}
const results = [
  run('chord cadence (I-IV-V7-I), clean', cadence),
  run('chord cadence, white noise SNR 10 dB', cadence, 10),
  run('monophonic hummed/whooped line, clean', hum),
  run('monophonic line, white noise SNR 15 dB', hum, 15),
];

console.log('Sanctum Pulpit tests');
console.log('Transposer:', transposerSummary); out.forEach((l) => console.log('  ' + l));
for (const r of results) console.log(`Key detect — ${r.label}: ${r.exact}/${r.total} exact (${r.pct}%), ${r.related} more within relative/4th/5th${r.misses.length ? '  misses: ' + r.misses.join(', ') : ''}`);



// ---------- Voice Follow (inline pure DSP so node strip-type needs no .ts import paths) ----------
import { detectPitch as yinPitch } from '../src/pulpit/keydetect.ts';

class CadenceT {
  env = 0; prev = 0; onsets = []; lastOnset = -1; inPhrase = false; silenceMs = 0; sensitivity = 0.75;
  feed(rms, t) {
    const gate = 0.008 + (1 - this.sensitivity) * 0.03;
    const attack = 0.45, release = 0.1;
    this.env = rms > this.env ? this.env + attack * (rms - this.env) : this.env + release * (rms - this.env);
    const deriv = this.env - this.prev; this.prev = this.env;
    let onset = false;
    if (this.env > gate && deriv > 0.006 && (t - this.lastOnset) > 0.08) {
      onset = true; this.lastOnset = t; this.onsets.push(t); this.inPhrase = true; this.silenceMs = 0;
      while (this.onsets.length && t - this.onsets[0] > 8) this.onsets.shift();
    }
    let phraseEnd = false;
    if (this.inPhrase) {
      if (rms < gate * 0.65) this.silenceMs += 50; else this.silenceMs = 0;
      if (this.silenceMs >= 180) { phraseEnd = true; this.inPhrase = false; this.silenceMs = 0; }
    }
    const recent = this.onsets.filter((x) => t - x <= 4);
    return { onset, phraseEnd, onsetsPerSec: recent.length / 4, wpm: recent.length / 4 * 60 / 1.3 };
  }
}
function sylVoice(tonicMidi, sylPerSec, durSec) {
  const sig = new Float32Array(Math.floor(SR * durSec));
  const f = hz(tonicMidi); let ph = 0; const sylLen = 1 / sylPerSec;
  for (let i = 0; i < sig.length; i++) {
    const t = i / SR; const sylIdx = Math.floor(t / sylLen);
    const inPause = (sylIdx % 5) === 4; // pause every 5th slot → phrase ends
    const local = t - sylIdx * sylLen;
    const env = inPause ? 0 : Math.min(1, local / 0.02) * Math.exp(-local / (sylLen * 0.5));
    ph += 2 * Math.PI * f / SR;
    sig[i] = 0.45 * env * (Math.sin(ph) + 0.35 * Math.sin(2 * ph));
  }
  return sig;
}
{
  const sig = sylVoice(57, 4.0, 6.0);
  const cad = new CadenceT();
  const hop = Math.floor(SR * 0.05), frame = 2048;
  let phraseEnds = 0; const pitches = []; const onsetTimes = [];
  for (let s = 0; s + frame < sig.length; s += hop) {
    const slice = sig.subarray(s, s + frame);
    let rms = 0; for (let i = 0; i < slice.length; i++) rms += slice[i] * slice[i];
    rms = Math.sqrt(rms / slice.length);
    const t = s / SR; const ev = cad.feed(rms, t);
    if (ev.onset) onsetTimes.push(t);
    if (ev.phraseEnd) phraseEnds++;
    if (rms > 0.02) { const p = yinPitch(slice, SR); if (p && p.clarity > 0.7) pitches.push(Math.round(69 + 12 * Math.log2(p.hz / 440))); }
  }
  const dur = sig.length / SR; const ops = onsetTimes.length / dur;
  const med = pitches.length ? pitches.slice().sort((a,b)=>a-b)[Math.floor(pitches.length/2)] : null;
  console.log(`Voice Follow — synthetic A3 @ 4 syl/s: onsets/s=${ops.toFixed(2)} medianMidi=${med} phraseEnds=${phraseEnds}`);
  check('Voice Follow onset rate in band', ops >= 2.2 && ops <= 5.5, true);
  check('Voice Follow detects pitch near A3', med != null && Math.abs(med - 57) <= 1, true);
  check('Voice Follow finds phrase ends', phraseEnds >= 1, true);
  const ch = chordIn('I', parseKey('A'));
  const fits = ch.root === 9; // A
  check('Voice Follow chord theory: I in A is A', fits, true);
}

const keyOk = results[0].pct >= 90 && results[2].pct >= 75;
if (fail || !keyOk) { console.log('RESULT: FAIL'); process.exit(1); } else console.log('RESULT: PASS');
