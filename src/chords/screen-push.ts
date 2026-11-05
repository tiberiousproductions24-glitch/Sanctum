// Optional "Show chords on screen" → Lampstand via ScreenLink (integrations/screen.ts).
import type { ScreenLink } from '../integrations/screen';
import type { DetectedChord } from './types';

export interface ChordScreenPayload {
  current: string;
  next?: string;
  roman?: string;
  key?: string;
  section?: string;
  chartLine?: string;
}

/**
 * Push current (+ next) chord to Lampstand.
 * Uses nowPlaying for ephemeral updates; lyrics-style slide text for a chart section when provided.
 */
export function pushChordsToScreen(
  screen: ScreenLink | null | undefined,
  payload: ChordScreenPayload,
  opts: { enabled: boolean } = { enabled: true },
) {
  if (!opts.enabled || !screen) return null;
  const title = payload.current || '—';
  const detail = [
    payload.roman ? `Roman ${payload.roman}` : '',
    payload.next ? `Next ${payload.next}` : '',
    payload.key ? `Key ${payload.key}` : '',
    payload.section || '',
  ].filter(Boolean).join(' · ');
  return screen.nowPlaying({
    title: `♩ ${title}`,
    detail: detail || payload.chartLine,
    kind: 'clip',
    on: true,
  });
}

export function formatChartSection(chords: DetectedChord[], from = 0, n = 4): string {
  return chords.slice(from, from + n).map((c) => c.label).join('  →  ');
}
