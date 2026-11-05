/** Shared chord-detection types for Sanctum Chords (live + import). */

export type ChordQuality =
  | 'maj' | 'min' | '7' | 'maj7' | 'm7' | 'sus2' | 'sus4' | 'dim' | 'aug' | 'N';

export interface DetectedChord {
  /** Absolute label e.g. "Am7", "G/B", "N" (no chord). */
  label: string;
  root: number;          // pitch class 0..11, or -1 for N
  quality: ChordQuality;
  bass: number;          // pitch class; may differ from root (slash)
  confidence: number;    // 0..1
  start: number;         // seconds
  end: number;           // seconds
  /** Roman numeral relative to active key, if known. */
  roman?: string;
}

export interface ChordFrame {
  time: number;
  chroma: number[];
  bassChroma: number[];
  scores: number[];      // per-template similarity
  best: number;          // template index
  confidence: number;
}

export interface ChordChart {
  chords: DetectedChord[];
  bpm: number | null;
  key: { tonic: number; mode: 'major' | 'minor'; name: string; confidence: number } | null;
  duration: number;
  source?: { kind: string; title?: string; artist?: string; url?: string };
}

export interface LiveChordState {
  current: DetectedChord | null;
  history: DetectedChord[];
  key: { tonic: number; mode: 'major' | 'minor'; name: string; confidence: number } | null;
  level: number;
  nextLikely: { label: string; roman: string; p: number }[];
}

export interface SourceMeta {
  title?: string;
  artist?: string;
  album?: string;
  key?: string;
  bpm?: number;
  durationSec?: number;
  thumbnail?: string;
  url?: string;
  notes?: string;
}

export interface SourceAudio {
  samples: Float32Array;
  sampleRate: number;
  meta: SourceMeta;
}

export interface SourceAdapter {
  id: string;
  label: string;
  /** What this adapter can return. */
  capability: 'audio' | 'metadata' | 'both' | 'info';
  description: string;
  /** Resolve a query/URL/file into metadata and optionally decoded mono samples. */
  resolve(input: unknown, opts?: { signal?: AbortSignal }): Promise<{ meta: SourceMeta; audio?: SourceAudio; error?: string }>;
}
