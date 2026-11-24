// Pure Follow Me engine — no DOM / AudioContext. Safe for node strip-type tests.
import type {
  ChartProgression, ChartStep, EasyPlayStep, FollowMePattern, IntensityCue,
  PadLaunch, PulpitChartsFile, ResolvedChord, ShoutChordMap,
} from './types';
import { FOLLOW_ME_NAME, FOLLOW_ME_SUBTITLE } from './types';

export { FOLLOW_ME_NAME, FOLLOW_ME_SUBTITLE };

const KEY_ORDER = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export function normalizeKeyName(key: string, preferMinor = false): string {
  const raw = (key || 'Ab').trim();
  const m = raw.match(/^([A-Ga-g])([#b]?)(m|min|minor)?$/i);
  if (!m) return preferMinor ? 'Fm' : 'Ab';
  let letter = m[1].toUpperCase();
  const acc = m[2] === '#' ? '#' : m[2] === 'b' ? 'b' : '';
  const name = letter + acc;
  const alias: Record<string, string> = {
    'C#': 'Db', 'D#': 'Eb', 'G#': 'Ab', 'A#': 'Bb', Gb: 'F#',
  };
  const major = alias[name] || name;
  const minor = !!(m[3] || preferMinor);
  if (!minor) return major;
  // parallel minor spelling used by charts (Fm, Dbm, …)
  if (major === 'F#') return 'F#m';
  return major + 'm';
}

export class FollowMeEngine {
  shout: ShoutChordMap;
  charts: PulpitChartsFile;
  patternId: string | null;
  progressionId: string | null;
  keyName: string;

  constructor(shout: ShoutChordMap, charts: PulpitChartsFile) {
    this.shout = shout;
    this.charts = charts;
    this.patternId = null;
    this.progressionId = charts.progressions?.[0]?.id || null;
    this.keyName = normalizeKeyName(charts.progressions?.[0]?.defaultKey || 'Ab');
  }

  featureName() { return this.charts.feature || FOLLOW_ME_NAME; }
  featureSubtitle() { return this.charts.featureSubtitle || FOLLOW_ME_SUBTITLE; }
  sourceLabel() { return this.charts.sourceLabel || ''; }
  firstProgressionId(): string | null { return this.charts.progressions?.[0]?.id || null; }

  listShoutPatterns(): FollowMePattern[] {
    return this.shout.patterns.slice();
  }

  listChartProgressions(): ChartProgression[] {
    return this.charts.progressions?.slice() || [];
  }

  listKeys(mode: 'major' | 'minor' = 'major'): string[] {
    if (mode === 'minor') {
      return KEY_ORDER.map((k) => (k === 'F#' ? 'F#m' : k + 'm'));
    }
    return [...KEY_ORDER];
  }

  shoutPattern(id: string) {
    return this.shout.patterns.find((p) => p.id === id);
  }

  chartProgression(id: string) {
    return this.charts.progressions?.find((p) => p.id === id);
  }

  setShoutPattern(id: string) {
    const p = this.shoutPattern(id);
    if (!p) throw new Error('Unknown shout pattern: ' + id);
    this.patternId = id;
    this.progressionId = null;
    return p;
  }

  setChartProgression(id: string) {
    const p = this.chartProgression(id);
    if (!p) throw new Error('Unknown Follow Me progression: ' + id);
    this.progressionId = id;
    this.patternId = null;
    return p;
  }

  setKey(key: string, mode: 'major' | 'minor' = /m$/i.test(key) ? 'minor' : 'major') {
    this.keyName = normalizeKeyName(key, mode === 'minor');
    return this.keyName;
  }

  /** Resolve shout I7–IV7–V7–bVII7 (etc.) for a key from shout map. */
  resolveShoutProgression(key = this.keyName, patternId = this.patternId || 'shout-full-break'): ResolvedChord[] {
    const kn = normalizeKeyName(key);
    const p = this.shoutPattern(patternId);
    if (!p) throw new Error('Unknown pattern ' + patternId);
    const table = this.shout.resolvedAllKeys[kn];
    if (!table) throw new Error('No resolvedAllKeys for ' + kn);
    const byTok = new Map(table.map((c) => [c.token, c]));
    return p.tokens.map((tok) => {
      const hit = byTok.get(tok);
      if (hit) return { ...hit };
      const base = tok.split('/')[0];
      const soft = byTok.get(base);
      if (soft) return { ...soft, token: tok };
      return { token: tok, name: tok, root: -1, notesMidi: [], bassMidi: 0 };
    });
  }

  chartSteps(progressionId: string, key: string): ChartStep[] | null {
    const prog = this.chartProgression(progressionId);
    if (!prog?.charts) return null;
    const preferMinor = prog.mode === 'minor';
    const kn = normalizeKeyName(key, preferMinor);
    return prog.charts[kn] || prog.charts[key] || prog.charts[normalizeKeyName(key, false)] || null;
  }

  /** Easy Play steps: chart lookup preferred; shout pattern fallback; else empty. */
  stepsForEasyPlay(opts: {
    key: string;
    mode?: 'major' | 'minor';
    progressionId?: string | null;
    shoutPatternId?: string | null;
  }): EasyPlayStep[] {
    const { key, mode } = opts;
    const progId = opts.progressionId ?? this.progressionId;
    const patId = opts.shoutPatternId ?? this.patternId;

    if (progId) {
      const steps = this.chartSteps(progId, key);
      if (steps?.length) {
        return steps.map((s) => ({
          c: s.token,
          beats: 4,
          cue: s.symbol,
          notesMidi: s.notesMidi,
          bassMidi: s.bassMidi,
          intensityCue: s.intensityCue,
          hit: s.intensityCue === 'hit' || undefined,
          run: s.intensityCue === 'run' || undefined,
        }));
      }
    }
    if (patId) {
      return this.resolveShoutProgression(normalizeKeyName(key, mode === 'minor'), patId).map((c) => ({
        c: c.token, beats: 4, cue: c.name, notesMidi: c.notesMidi, bassMidi: c.bassMidi,
      }));
    }
    return [];
  }

  /** Intensity cue from charts intensityWiring (Shout/Worship 1–4). */
  intensityCue(lane: 'shout' | 'worship' | 'none', level: number): IntensityCue {
    const lv = Math.max(0, Math.min(4, level | 0));
    if (lane === 'none' || lv === 0) {
      return {
        level: 0, lane: 'none', name: 'Off', velocityScale: 0.5, densityScale: 0,
        organRunEveryBars: null, chordDensity: '', bass: '', drums: '', organ: '', harmonicRhythm: '',
      };
    }
    const row = this.charts.intensityWiring?.[lane === 'shout' ? 'shoutLevel' : 'worshipLevel']?.[String(lv)];
    const densityScale = lv / 4;
    const organRunEveryBars = lane === 'shout' ? (lv >= 4 ? 4 : lv >= 3 ? 8 : null) : null;
    return {
      level: lv,
      lane,
      name: row?.name || `${lane} ${lv}`,
      velocityScale: 0.5 + 0.5 * densityScale,
      densityScale,
      organRunEveryBars,
      chordDensity: row?.chordDensity || '',
      bass: row?.bass || '',
      drums: row?.drums || '',
      organ: row?.organ || '',
      harmonicRhythm: row?.harmonicRhythm || '',
    };
  }

  patternLaunchPads(): PadLaunch[] {
    const bankA = this.shout.midiPadMap?.banks?.find((b) => b.letter === 'A');
    return (bankA?.pads || []).filter((p) => p.role === 'pattern' || (p.triggers || []).some((t) => String(t).startsWith('shout-')));
  }

  chordStabPads(): PadLaunch[] {
    const bankC = this.shout.midiPadMap?.banks?.find((b) => b.letter === 'C');
    return bankC?.pads?.slice() || [];
  }

  hookChords(key = this.keyName): string[] {
    const kn = normalizeKeyName(key);
    const fromCharts = this.charts.hookChords?.byKey?.[kn] || this.charts.hookChords?.byKey?.[key];
    if (fromCharts?.length) return fromCharts.map((h) => h.token);
    const table = this.shout.resolvedAllKeys[kn];
    return table ? table.map((c) => c.token) : ['I7', 'IV7', 'V7', 'bVII7'];
  }

  organRunsForLevel(lane: 'shout' | 'worship', level: number) {
    return (this.charts.organRunCues || []).filter((c) => c.lane === lane && level >= c.minLevel);
  }

  /** Ab I7–IV7–V7–bVII7 sanity from shout map (PREVIEW.txt). */
  previewAbFullBreak() {
    const resolved = this.resolveShoutProgression('Ab', 'shout-full-break');
    return {
      names: resolved.map((c) => c.name),
      notes: resolved.map((c) => c.notesMidi),
      bass: resolved.map((c) => c.bassMidi),
    };
  }

  /** Gb shout-cadence sanity from the reference transcription charts. */
  previewGbShoutCadence() {
    const steps = this.chartSteps('lw-shout-cadence', 'Gb') || [];
    return { symbols: steps.map((s) => s.symbol), tokens: steps.map((s) => s.token), notes: steps.map((s) => s.notesMidi), bass: steps.map((s) => s.bassMidi) };
  }

  /** Ab whoop-14 sanity from legacy Beat Theory charts (PREVIEW_PULPIT.txt). */
  previewAbWhoop14() {
    const steps = this.chartSteps('whoop-14', 'Ab') || [];
    return {
      symbols: steps.map((s) => s.symbol),
      tokens: steps.map((s) => s.token),
      notes: steps.map((s) => s.notesMidi),
      bass: steps.map((s) => s.bassMidi),
    };
  }
}

export function assertShoutMapShape(map: ShoutChordMap): string[] {
  const errs: string[] = [];
  if (!map.patterns || map.patterns.length !== 8) errs.push(`expected 8 patterns, got ${map.patterns?.length}`);
  const keys = Object.keys(map.resolvedAllKeys || {});
  if (keys.length !== 12) errs.push(`expected 12 keys in resolvedAllKeys, got ${keys.length}`);
  for (const k of KEY_ORDER) if (!map.resolvedAllKeys?.[k]) errs.push('missing key ' + k);
  return errs;
}

/** v0.3.4 chart source: shout reference transcription (chord-maps/lawrence/progressions.json). */
export const REFERENCE_PROGRESSION_IDS = [
  'lw-shout-cadence', 'lw-shout-cadence-vi7', 'lw-aug-lick', 'lw-turnaround-lift', 'lw-half-step-lift',
  'lw-walkup-low', 'lw-two-chromatic-low', 'lw-lift-shout', 'lw-lift-shout-ext', 'lw-lift-tag',
];
export const CHECK_BY_EAR_IDS = ['lw-walkup-low', 'lw-two-chromatic-low'];
const CHART_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function assertChartsShape(charts: PulpitChartsFile): string[] {
  const errs: string[] = [];
  const progs = charts.progressions || [];
  if (charts.source !== 'reference-transcription') errs.push('source should be reference-transcription, got ' + charts.source);
  if (!charts.sourceLabel || !/reference transcription/i.test(charts.sourceLabel)) errs.push('sourceLabel must say "reference transcription"');
  if (progs.length !== REFERENCE_PROGRESSION_IDS.length) errs.push(`expected ${REFERENCE_PROGRESSION_IDS.length} progressions, got ${progs.length}`);
  for (const id of REFERENCE_PROGRESSION_IDS) if (!progs.find((p) => p.id === id)) errs.push('missing progression ' + id);
  for (const p of progs) {
    for (const k of [...CHART_KEYS, 'F#']) {
      const c = p.charts?.[k];
      if (!c || c.length !== p.tokens.length) { errs.push(`${p.id} chart ${k} missing/short`); continue; }
      for (const s of c) {
        if (!s.notesMidi?.length || s.bassMidi < 28 || s.bassMidi > 39) errs.push(`${p.id} ${k} ${s.token} bad voicing`);
      }
    }
    if (!!p.checkByEar !== CHECK_BY_EAR_IDS.includes(p.id)) errs.push(`${p.id} checkByEar flag wrong`);
  }
  const cad = progs.find((p) => p.id === 'lw-shout-cadence')?.charts?.['Gb'];
  if (!cad || JSON.stringify(cad.map((s) => s.symbol)) !== JSON.stringify(['Ebm7', 'Dbsus4', 'Gbm', 'Gb'])) {
    errs.push('lw-shout-cadence Gb expected Ebm7 Dbsus4 Gbm Gb got ' + (cad ? cad.map((s) => s.symbol).join(' ') : 'none'));
  }
  if (!charts.intensityWiring?.shoutLevel?.['4'] || !charts.intensityWiring?.worshipLevel?.['4']) {
    errs.push('intensityWiring needs shoutLevel/worshipLevel 1–4');
  }
  return errs;
}

/** Legacy Beat Theory charts (pulpit-12key-charts.json) — unused since v0.3.4, kept for rollback. */
export function assertLegacyChartsShape(charts: PulpitChartsFile): string[] {
  const errs: string[] = [];
  const progs = charts.progressions || [];
  if (progs.length !== 15) errs.push(`expected 15 progressions, got ${progs.length}`);
  const want = ['whoop-14', 'whoop-145', 'two-five-one', 'one-six-two-five', 'passing-walk', 'minor-whoop', 'minor-walk', 'band-hits', 'tune-up', 'altar-call', 'shout-14', 'shout-1415', 'shout-minor', 'shout-fast-1625', 'i-iv-v-bvii'];
  for (const id of want) if (!progs.find((p) => p.id === id)) errs.push('missing progression ' + id);
  const ab = progs.find((p) => p.id === 'whoop-14')?.charts?.['Ab'];
  if (!ab || ab.length < 4) errs.push('whoop-14 Ab chart missing');
  else {
    if (ab[0].symbol !== 'Ab9' || ab[1].symbol !== 'Db9') errs.push(`whoop-14 Ab expected Ab9/Db9 got ${ab[0].symbol}/${ab[1].symbol}`);
  }
  const iv = progs.find((p) => p.id === 'i-iv-v-bvii')?.charts?.['Ab'];
  if (iv) {
    const names = iv.map((s) => s.symbol);
    if (JSON.stringify(names) !== JSON.stringify(['Ab7', 'Db7', 'Eb7', 'Gb7'])) {
      errs.push('i-iv-v-bvii Ab expected Ab7 Db7 Eb7 Gb7 got ' + names.join(' '));
    }
  }
  if (!charts.intensityWiring?.shoutLevel?.['4'] || !charts.intensityWiring?.worshipLevel?.['4']) {
    errs.push('intensityWiring needs shoutLevel/worshipLevel 1–4');
  }
  return errs;
}
