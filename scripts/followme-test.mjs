// Follow Me / Preacher Assist — chart integration tests (v0.3.4: shout reference transcription charts;
// legacy Beat Theory charts still validated as a rollback file).
//   node --import ./scripts/ts-ext-resolve.mjs scripts/followme-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FollowMeEngine, assertShoutMapShape, assertChartsShape, assertLegacyChartsShape, normalizeKeyName,
  REFERENCE_PROGRESSION_IDS, CHECK_BY_EAR_IDS,
  FOLLOW_ME_NAME, FOLLOW_ME_SUBTITLE,
} from '../src/followme/engine.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shout = JSON.parse(fs.readFileSync(path.join(root, 'chord-maps/shout-iv-v-bvii.json'), 'utf8'));
const legacy = JSON.parse(fs.readFileSync(path.join(root, 'chord-maps/pulpit-12key-charts.json'), 'utf8'));
const charts = JSON.parse(fs.readFileSync(path.join(root, 'chord-maps/lawrence/progressions.json'), 'utf8'));
const contentRef = path.join(root, 'content/chord-maps/follow-me-shout-reference.json');
const loadSrc = fs.readFileSync(path.join(root, 'src/followme/load.ts'), 'utf8');
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

check('content reference mirror exists', fs.existsSync(contentRef), true);
check('content reference mirror == chord-maps/lawrence', JSON.stringify(JSON.parse(fs.readFileSync(contentRef, 'utf8'))), JSON.stringify(charts));
check('loader uses reference charts', /CHARTS_URL = '\.\/content\/chord-maps\/follow-me-shout-reference\.json'/.test(loadSrc), true);
check('legacy charts kept for rollback', /LEGACY_CHARTS_URL = '\.\/content\/chord-maps\/pulpit-12key-charts\.json'/.test(loadSrc), true);

const cErr = assertChartsShape(charts);
check('charts shape', cErr, []);
check('charts feature', charts.feature, 'Follow Me');
check('charts subtitle', charts.featureSubtitle, 'Preacher Assist');
check('charts 10 progressions', charts.progressions.length, 10);
check('charts source honest', charts.source, 'reference-transcription');
check('sourceLabel says live stream, not Lawrence', /live stream/i.test(charts.sourceLabel) && /not Lawrence/i.test(charts.sourceLabel), true);
check('no Beat Theory ids in charts', charts.progressions.some((p) => ['whoop-14', 'i-iv-v-bvii'].includes(p.id)), false);
check('check-by-ear ids', charts.progressions.filter((p) => p.checkByEar).map((p) => p.id), CHECK_BY_EAR_IDS);
check('check-by-ear names', charts.progressions.filter((p) => p.checkByEar).every((p) => /check by ear/i.test(p.name)), true);
check('legacy charts still valid', assertLegacyChartsShape(legacy), []);

const eng = new FollowMeEngine(shout, charts);
check('engine feature', eng.featureName(), 'Follow Me');
check('engine subtitle', eng.featureSubtitle(), 'Preacher Assist');
check('engine default progression', eng.progressionId, 'lw-shout-cadence');
check('engine list ids', eng.listChartProgressions().map((p) => p.id), REFERENCE_PROGRESSION_IDS);
check('engine sourceLabel', /reference transcription/i.test(eng.sourceLabel()), true);

const abBreak = eng.previewAbFullBreak();
check('Ab full-break names (shout map)', abBreak.names, ['Ab7', 'Db7', 'Eb7', 'Gb7']);

const cad = eng.previewGbShoutCadence();
check('Gb cadence symbols', cad.symbols, ['Ebm7', 'Dbsus4', 'Gbm', 'Gb']);
check('Gb cadence tokens', cad.tokens, ['vi7', 'Vsus', 'i', 'I']);
check('Gb cadence vi7 notes', cad.notes[0], [51, 54, 58, 61]);
check('Gb cadence I bass', cad.bass[3], 30);

// Gb is normalized to F# by the engine — mirror must resolve.
check('F# alias resolves', eng.chartSteps('lw-shout-cadence', 'F#')?.map((s) => s.symbol), ['Ebm7', 'Dbsus4', 'Gbm', 'Gb']);
check('Gb key resolves', eng.chartSteps('lw-shout-cadence', 'Gb')?.length, 4);

const c = eng.stepsForEasyPlay({ key: 'C', progressionId: 'lw-shout-cadence' });
check('C cadence cues', c.map((s) => s.cue), ['Am7', 'Gsus4', 'Cm', 'C']);
const ab = eng.stepsForEasyPlay({ key: 'Ab', progressionId: 'lw-lift-shout' });
check('Ab lifted shout cues', ab.map((s) => s.cue), ['Ab', 'Dbsus2', 'Dm7b5', 'Ebsus4']);
const g = eng.stepsForEasyPlay({ key: 'G', progressionId: 'lw-lift-shout' });
check('G lifted shout cues', g.map((s) => s.cue), ['G', 'Csus2', 'C#m7b5', 'Dsus4']);
const lift = eng.stepsForEasyPlay({ key: 'Gb', progressionId: 'lw-half-step-lift' });
check('Gb half-step lift', lift.map((s) => s.cue), ['Gbsus4', 'Cdim7', 'G']);
check('C lift spells F#dim7', eng.stepsForEasyPlay({ key: 'C', progressionId: 'lw-half-step-lift' })[1].cue, 'F#dim7');
let allKeys = true;
for (const p of charts.progressions) for (const k of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']) {
  const st = eng.stepsForEasyPlay({ key: k, progressionId: p.id });
  if (st.length !== p.tokens.length || st.some((x) => !x.notesMidi?.length)) allKeys = false;
}
check('all 10 progressions × 12 keys resolve via Easy Play', allKeys, true);
check('normalize Ab', normalizeKeyName('Ab'), 'Ab');
check('normalize Gb', normalizeKeyName('Gb'), 'F#');

const shoutCue = eng.intensityCue('shout', 4);
check('shout4 density', shoutCue.densityScale, 1);
check('shout4 name has text', typeof shoutCue.name === 'string' && shoutCue.name.length > 0, true);
const worshipCue = eng.intensityCue('worship', 2);
check('worship2 density', worshipCue.densityScale, 0.5);
check('organ runs at shout 4', eng.organRunsForLevel('shout', 4).length > 0, true);

check('hook Gb has vi7', eng.hookChords('Gb').includes('vi7'), true);
check('hook C has #ivdim7', eng.hookChords('C').includes('#ivdim7'), true);
check('pattern launch pads', eng.patternLaunchPads().length >= 8, true);

check('beat-theory maps 30 progressions', theory.progressions.length, 30);
check('beat-theory has whoop-14', theory.progressions.some((p) => p.id === 'whoop-14'), true);
check('beat-theory has shout-full-break', theory.progressions.some((p) => p.id === 'shout-full-break'), true);

console.log(fail ? `FAIL ${pass}/${pass + fail}` : `PASS ${pass}/${pass + fail}`);
for (const line of out) console.log(line);
process.exit(fail ? 1 : 0);
