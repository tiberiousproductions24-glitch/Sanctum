// Follow Me / Preacher Assist — Beat Theory map types.

export const FOLLOW_ME_NAME = 'Follow Me';
export const FOLLOW_ME_SUBTITLE = 'Preacher Assist';

export interface ResolvedChord {
  token: string;
  name: string;
  root: number;
  notesMidi: number[];
  bassMidi: number;
  bassMidiOct?: number;
}

export interface IntensityLevel {
  name: string;
  chordDensity: string;
  bassMotion: string;
  rhythmicDensity: string;
  patterns: string[];
}

export interface IntensityCue {
  level: number; // shout/worship 1..4 (0 = off)
  lane: 'shout' | 'worship' | 'none';
  name: string;
  velocityScale: number;
  densityScale: number; // level/4
  organRunEveryBars: number | null;
  chordDensity: string;
  bass: string;
  drums: string;
  organ: string;
  harmonicRhythm: string;
}

export interface FollowMePattern {
  id: string;
  name: string;
  serviceMoment?: string;
  bpmRange: [number, number];
  defaultBpm: number;
  defaultKey: string;
  tokens: string[];
  bars: number;
  beatsPerBar: number;
  form: string;
  intensity: number;
  padTriggers?: Array<Record<string, unknown>>;
}

export interface PadLaunch {
  pad: number;
  midiNote: number;
  globalPad: number;
  label: string;
  role: string;
  triggers: string[];
  bank?: string;
}

export interface ShoutChordMap {
  version: number;
  source: string;
  style?: string;
  description?: string;
  keys: Array<{ tonic: number; name: string; mode: string }>;
  resolvedAllKeys: Record<string, ResolvedChord[]>;
  patterns: FollowMePattern[];
  intensityMap: { description?: string; levels: Record<string, IntensityLevel> };
  midiPadMap?: {
    suggestedAssignment?: Record<string, unknown>;
    banks?: Array<{ letter: string; role: string; pads: PadLaunch[] }>;
  };
  bassWalks?: unknown[];
  organRuns?: unknown[];
  antiRepetition?: Record<string, unknown>;
  serviceMoments?: Record<string, unknown>;
}

export interface ChartStep {
  token: string;
  symbol: string;
  root: number;
  bass: number;
  notesMidi: number[];
  bassMidi: number;
  intensityCue?: string;
}

export interface ChartProgression {
  id: string;
  name: string;
  mode: 'major' | 'minor';
  feel?: string;
  feelId?: string;
  tokens: string[];
  defaultKey: string;
  kind?: string;
  desc?: string;
  tags?: string[];
  charts: Record<string, ChartStep[]>;
  ending?: string[];
  endingCharts?: Record<string, ChartStep[]>;
  calls?: string[];
  beatsPerChord?: number;
  bpm?: number;
  /** Low-confidence transcription: flag in UI as "check by ear". */
  checkByEar?: boolean;
  analysis?: { confidence: string; heardAtSec?: number[][]; uncertain?: string; bassWalk?: string };
  modulation?: { atToken: number; semitones: number; note?: string };
}

export interface IntensityWiringRow {
  name: string;
  chordDensity: string;
  bass: string;
  drums: string;
  organ: string;
  harmonicRhythm: string;
}

export interface PulpitChartsFile {
  version?: number;
  source?: string;
  feature?: string;
  featureSubtitle?: string;
  /** Honest provenance shown in the UI (e.g. "Shout reference transcription (from a live stream)"). */
  sourceLabel?: string;
  checkByEar?: string[];
  naming?: Record<string, unknown>;
  intensityWiring?: {
    shoutLevel?: Record<string, IntensityWiringRow>;
    worshipLevel?: Record<string, IntensityWiringRow>;
  };
  progressions?: ChartProgression[];
  hookChords?: { byKey?: Record<string, Array<{ role: string; token: string; symbol: string; notesMidi: number[]; bassMidi: number }>> };
  bassWalks?: { walks?: Array<{ id: string; exampleMidi?: Record<string, number[]> }> };
  organRunCues?: Array<{ id: string; minLevel: number; lane: string; description: string }>;
}

export interface EasyPlayStep {
  c: string;
  beats?: number;
  hit?: boolean;
  run?: boolean;
  cue?: string;
  notesMidi?: number[];
  bassMidi?: number;
  intensityCue?: string;
}
