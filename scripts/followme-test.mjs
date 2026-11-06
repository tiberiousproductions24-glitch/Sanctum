// Follow Me / Preacher Assist — Beat Theory map integration tests.
//   node --import ./scripts/ts-ext-resolve.mjs scripts/followme-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FollowMeEngine, assertShoutMapShape, assertChartsShape, normalizeKeyName,
  FOLLOW_ME_NAME, FOLLOW_ME_SUBTITLE,
} from '../src/followme/engine.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shout = JSON.parse(fs.readFileSync(path.join(root, 'chord-maps/shout-iv-v-bvii.json'), 'utf8'));
const charts = JSON.parse(fs.readFileSync(path.join(root, 'chord-maps/pulpit-12key-charts.json'), 'utf8'));
const contentShout = path.join(root, 'content/chord-maps/shout-iv-v-bvii.json');
const contentCharts = path.join(root, 'content/chord-maps/pulpit-12key-charts.json');
const theory = JSON.parse(fs.readFileSync(path.join(root, 'content/theory/beat-theory-maps.json'), 'utf8'));

let pass = 0, fail = 0; const out = [];
const check = (name, got, want) => {
  const ok = typeof want === 'function' ? !!want(got) : JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; out.push(`FAIL ${name}: got ${JSON.stringify(got)} want ${typeof want === 'function' ? '<pred>' : JSON.stringify(want)}`); }
};

check('feature name', FOLLOW_ME_NAME, 'Follow Me');
check('subtitle', FOLLOW_ME_SUBTITLE, 'Preacher Assist');
check('content shout mirror exists', fs.existsSync(contentShout), true);
check('content charts mirror exists', fs.existsSync(contentCharts), true);

const sErr = assertShoutMapShape(shout);
check('shout map shape', sErr, []);
check('shout 12 keys', Object.keys(shout.resolvedAllKeys).length, 12);
check('shout 8 patterns', shout.patterns.length, 8);

const cErr = assertChartsShape(charts);
check('charts shape', cErr, []);
check('charts feature', charts.feature, 'Follow Me');
check('charts subtitle', charts.featureSubtitle, 'Preacher Assist');
check('charts 15 progressions', charts.progressions.length, 15);

const eng = new FollowMeEngine(shout, charts);
check('engine feature', eng.featureName(), 'Follow Me');
check('engine subtitle', eng.featureSubtitle(), 'Preacher Assist');

const abBreak = eng.previewAbFullBreak();
check('Ab full-break names', abBreak.names, ['Ab7', 'Db7', 'Eb7', 'Gb7']);
check('Ab full-break I7 notes', abBreak.notes[0], [56, 60, 63, 66]);
check('Ab full-break I7 bass', abBreak.bass[0], 32);
check('Ab full-break IV7 bass', abBreak.bass[1], 37);
check('Ab full-break V7 bass', abBreak.bass[2], 39);
check('Ab full-break bVII7 bass', abBreak.bass[3], 30);

const whoop = eng.previewAbWhoop14();
check('Ab whoop-14 symbols', whoop.symbols, ['Ab9', 'Db9', 'Ab9', 'Db9']);
check('Ab whoop-14 tokens', whoop.tokens, ['I9', 'IV9', 'I9', 'IV9']);
check('Ab whoop-14 I9 notes', whoop.notes[0], [56, 60, 63, 66, 70]);
check('Ab whoop-14 I9 bass', whoop.bass[0], 32);

const iv = eng.stepsForEasyPlay({ key: 'Ab', progressionId: 'i-iv-v-bvii' });
check('Ab i-iv-v-bvii cues', iv.map((s) => s.cue), ['Ab7', 'Db7', 'Eb7', 'Gb7']);

const minor = eng.stepsForEasyPlay({ key: 'Fm', mode: 'minor', progressionId: 'minor-whoop' });
check('Fm minor-whoop has steps', minor.length >= 4, true);
check('normalize Fm', normalizeKeyName('Fm', true), 'Fm');
check('normalize Ab', normalizeKeyName('Ab'), 'Ab');

const shoutCue = eng.intensityCue('shout', 4);
check('shout4 density', shoutCue.densityScale, 1);
check('shout4 name has text', typeof shoutCue.name === 'string' && shoutCue.name.length > 0, true);
const worshipCue = eng.intensityCue('worship', 2);
check('worship2 density', worshipCue.densityScale, 0.5);

check('hook Ab has I9', eng.hookChords('Ab').includes('I9'), true);
check('pattern launch pads', eng.patternLaunchPads().length >= 8, true);

check('beat-theory maps 30 progressions', theory.progressions.length, 30);
check('beat-theory has whoop-14', theory.progressions.some((p) => p.id === 'whoop-14'), true);
check('beat-theory has shout-full-break', theory.progressions.some((p) => p.id === 'shout-full-break'), true);

console.log(fail ? `FAIL ${pass}/${pass + fail}` : `PASS ${pass}/${pass + fail}`);
for (const line of out) console.log(line);
process.exit(fail ? 1 : 0);
