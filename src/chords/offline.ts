// Offline / import analysis: decode file or URL → mono → analyseChords.
// Pure analyse path works under Node (tests). Browser helpers use OfflineAudioContext / fetch.
import { analyseChords, chartToJson, chartToText, groupByBar } from './detect';
import { annotateRoman, parseKeySafe } from './theory-ext';
import type { ChordChart, SourceMeta } from './types';

export function monoFromChannels(channels: Float32Array[], length: number): Float32Array {
  const out = new Float32Array(length);
  const n = channels.length || 1;
  for (let c = 0; c < n; c++) {
    const ch = channels[c];
    for (let i = 0; i < length; i++) out[i] += (ch[i] || 0) / n;
  }
  return out;
}

/** Node-safe: analyse already-decoded mono PCM. */
export function analyseBuffer(samples: Float32Array, sampleRate: number, meta?: SourceMeta): ChordChart {
  const chart = analyseChords(samples, { sampleRate, fftSize: 4096, hop: 2048, stay: 0.75 });
  if (meta) chart.source = { kind: meta.url ? 'url' : 'file', title: meta.title, artist: meta.artist, url: meta.url };
  if (meta?.key) {
    const k = parseKeySafe(meta.key);
    chart.key = { tonic: k.tonic, mode: k.mode, name: meta.key, confidence: Math.max(chart.key?.confidence ?? 0, 0.5) };
  }
  if (meta?.bpm && !chart.bpm) chart.bpm = meta.bpm;
  if (chart.key) chart.chords = annotateRoman(chart.chords, { tonic: chart.key.tonic, mode: chart.key.mode });
  return chart;
}

export interface DecodeSupport {
  wav: boolean; mp3: boolean; aac: boolean; m4a: boolean; flac: boolean; ogg: boolean;
  notes: string[];
}

/** Probe decodeAudioData support (browser). */
export async function probeDecodeSupport(_ctx?: AudioContext): Promise<DecodeSupport> {
  const notes: string[] = [];
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Android/.test(ua);
  const isAndroid = /Android/.test(ua);
  if (isSafari) notes.push('Safari/iOS: OGG unsupported; prefer WAV/MP3/M4A/FLAC.');
  if (isAndroid) notes.push('Android WebView: FLAC/AAC support varies by OEM — WAV/MP3 safest.');
  notes.push('If decodeAudioData rejects a file, re-encode to WAV 16-bit 44.1 kHz.');
  return {
    wav: true,
    mp3: true,
    aac: true,
    m4a: true,
    flac: !isAndroid,
    ogg: !isSafari,
    notes,
  };
}

/** Browser: decode an ArrayBuffer with AudioContext.decodeAudioData → mono chart. */
export async function analyseArrayBuffer(
  buf: ArrayBuffer,
  meta: SourceMeta | undefined,
  ctx?: AudioContext,
): Promise<{ chart: ChordChart; sampleRate: number; error?: string }> {
  const own = !ctx;
  const ac = ctx || new AudioContext();
  try {
    const audio = await ac.decodeAudioData(buf.slice(0));
    const chans: Float32Array[] = [];
    for (let c = 0; c < audio.numberOfChannels; c++) chans.push(audio.getChannelData(c));
    const mono = monoFromChannels(chans, audio.length);
    const chart = analyseBuffer(mono, audio.sampleRate, meta);
    return { chart, sampleRate: audio.sampleRate };
  } catch (e) {
    return {
      chart: { chords: [], bpm: null, key: null, duration: 0, source: meta ? { kind: 'file', title: meta.title } : undefined },
      sampleRate: 0,
      error: 'Could not decode audio (' + (e as Error).message + '). Try WAV or MP3. FLAC/AAC may be unsupported in this WebView.',
    };
  } finally {
    if (own) try { await ac.close(); } catch {}
  }
}

/** Fetch a direct audio URL (CORS must allow). */
export async function analyseUrl(url: string, ctx?: AudioContext): Promise<{ chart: ChordChart; error?: string }> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return { chart: emptyChart(url), error: `HTTP ${res.status} fetching audio URL.` };
    const buf = await res.arrayBuffer();
    const name = url.split('/').pop() || url;
    const r = await analyseArrayBuffer(buf, { title: name, url }, ctx);
    return { chart: r.chart, error: r.error };
  } catch (e) {
    return {
      chart: emptyChart(url),
      error: 'Could not download audio (CORS blocked or network error). Use a URL that sends Access-Control-Allow-Origin, or upload the file.',
    };
  }
}

function emptyChart(url?: string): ChordChart {
  return { chords: [], bpm: null, key: null, duration: 0, source: url ? { kind: 'url', url } : undefined };
}

export { chartToText, chartToJson, groupByBar, analyseChords };
