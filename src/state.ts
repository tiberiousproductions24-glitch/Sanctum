// Project state + crash-safe autosave (localStorage, debounced, plus rolling snapshots).
export const PPQ = 960;
export const BANKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type Theme = 'dark' | 'light' | 'warm' | 'contrast' | 'neon' | 'minimal';
export const THEMES: Theme[] = ['dark', 'light', 'warm', 'contrast', 'neon', 'minimal'];
export type LayoutMode = 'auto' | 'phone' | 'tablet';
export type QuantizeKey = 'off' | '1/4' | '1/8' | '1/8T' | '1/16' | '1/16T' | '1/32' | '1/32T';
export const QUANT_TICKS: Record<QuantizeKey, number> = { off: 0, '1/4': 960, '1/8': 480, '1/8T': 320, '1/16': 240, '1/16T': 160, '1/32': 120, '1/32T': 80 };
export type VelocityMode = 'auto' | 'position' | 'pressure' | 'fixed';
export type AccessState = 'owner' | 'locked' | 'invite' | 'expired' | 'revoked' | 'paywall' | 'grace';

export interface NoteEvent { p: number; t: number; v: number }   // pad (0..127 = bank*16+pad), tick, velocity 1..127
export interface Pattern { name: string; bars: number; events: NoteEvent[] }
export interface PadSlot { sound: string | null; gain: number; pan: number; tune: number; mute: boolean }

export interface Settings {
  velocityMode: VelocityMode; fixedVelocity: number; velocityCurve: number;
  latencyHint: number;          // seconds; 0 = 'interactive'
  touchCompMs: number;          // input-path (touch) latency compensation for recording
  preLightMs: number;           // visual pre-light ahead of audible sound for sequenced notes
  metronome: boolean; countIn: boolean; haptics: boolean; reduceMotion: boolean;
  handedness: 'right' | 'left';
  linkEnabled: boolean; linkUrl: string; linkQuantum: number;
  midiClockOut: boolean; midiClockIn: boolean; midiNotesIn: boolean; midiNotesOut: boolean; midiChannel: number; ccMap: Record<string, string>; ccOut: boolean; midiOutId: string; midiInId: string; midiClockOffsetMs: number;
  loopLaunch: 'bar' | 'beat';
  deviceClass: LayoutMode;       // layout mode (separate from the colour theme)
  master: number;
}

export interface Lab { roundTripMs: number | null; roundTripJitterMs: number | null; tapOffsetMs: number | null; tapJitterMs: number | null; measuredAt: string | null; route: string }

export interface Project {
  version: 1;
  bpm: number; swing: number; swingRes: 8 | 16; quantize: QuantizeKey; noteRepeatRate: QuantizeKey;
  patterns: Pattern[]; currentPattern: number;
  pads: PadSlot[]; bankSources: (string | null)[]; currentBank: number; selectedPad: number;
  theme: Theme; settings: Settings; lab: Lab; access: AccessState;
  savedAt?: string;
}

export const emptyPattern = (i: number): Pattern => ({ name: `Pattern ${i + 1}`, bars: 2, events: [] });

export function defaultProject(): Project {
  return {
    version: 1, bpm: 92, swing: 56, swingRes: 16, quantize: '1/16', noteRepeatRate: '1/16',
    patterns: Array.from({ length: 8 }, (_, i) => emptyPattern(i)), currentPattern: 0,
    pads: Array.from({ length: 128 }, () => ({ sound: null, gain: 1, pan: 0, tune: 0, mute: false })),
    bankSources: Array(8).fill(null), currentBank: 0, selectedPad: 0,
    theme: 'dark',
    settings: {
      velocityMode: 'auto', fixedVelocity: 110, velocityCurve: 1.6,
      latencyHint: 0, touchCompMs: 0, preLightMs: 8,
      metronome: false, countIn: false, haptics: true, reduceMotion: false, handedness: 'right',
      linkEnabled: false, linkUrl: '', linkQuantum: 4,
      midiClockOut: false, midiClockIn: false, midiNotesIn: true, midiNotesOut: false, midiChannel: 10, ccMap: { '7': 'master', '9': 'swing', '71': 'padLevel', '74': 'padTune' }, ccOut: true, midiOutId: '', midiInId: '', midiClockOffsetMs: 0,
      loopLaunch: 'bar', deviceClass: 'auto', master: 0.85,
    },
    lab: { roundTripMs: null, roundTripJitterMs: null, tapOffsetMs: null, tapJitterMs: null, measuredAt: null, route: 'default output' },
    access: 'owner',
  };
}

const KEY = 'sanctum.project.v1';
const SNAP_KEY = 'sanctum.snapshots.v1';

export function loadProject(): { project: Project; restored: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const d = defaultProject();
      const project: Project = { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) }, lab: { ...d.lab, ...(p.lab || {}) } };
      if (!Array.isArray(project.pads) || project.pads.length !== 128) project.pads = d.pads;
      if (!Array.isArray(project.patterns) || project.patterns.length === 0) project.patterns = d.patterns;
      return { project, restored: true };
    }
  } catch (e) { console.warn('autosave restore failed', e); }
  return { project: defaultProject(), restored: false };
}

let timer: number | undefined;
let lastSnap = 0;
export let lastSavedAt = '';
export function saveProject(p: Project, immediate = false) {
  const write = () => {
    try {
      p.savedAt = new Date().toISOString();
      const json = JSON.stringify(p);
      localStorage.setItem(KEY, json);
      lastSavedAt = p.savedAt;
      if (Date.now() - lastSnap > 120_000) {
        lastSnap = Date.now();
        const snaps: { at: string; json: string }[] = JSON.parse(localStorage.getItem(SNAP_KEY) || '[]');
        snaps.unshift({ at: p.savedAt, json }); localStorage.setItem(SNAP_KEY, JSON.stringify(snaps.slice(0, 5)));
      }
      document.dispatchEvent(new CustomEvent('sanctum:saved'));
    } catch (e) { console.warn('autosave failed', e); }
  };
  clearTimeout(timer);
  if (immediate) write(); else timer = window.setTimeout(write, 350);
}
export function listSnapshots(): { at: string; json: string }[] { try { return JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); } catch { return []; } }
export function resetProject() { localStorage.removeItem(KEY); }
