/**
 * Pluggable import source adapters. No API keys embedded — placeholders only.
 * Legal sources only: files, CORS URLs, church-banks, metadata stubs for SC/Spotify/Apple/Bandcamp.
 */
import type { SourceAdapter, SourceMeta, SourceAudio } from './types';
import { analyseArrayBuffer, analyseUrl } from './offline';

export interface ChordSourceConfig {
  spotifyClientId?: string;
  appleMusicDeveloperToken?: string;
  soundcloudClientId?: string;
}

let cfg: ChordSourceConfig = {};
export function setSourceConfig(c: ChordSourceConfig) { cfg = { ...cfg, ...c }; }
export function getSourceConfig() { return { ...cfg }; }

const fileAdapter: SourceAdapter = {
  id: 'file',
  label: 'File upload',
  capability: 'audio',
  description: 'MP3, WAV, AAC/M4A, FLAC (decode support varies by WebView). User-owned files only.',
  async resolve(input: unknown) {
    const file = input as File | Blob & { name?: string };
    if (!file || typeof (file as Blob).arrayBuffer !== 'function') {
      return { meta: {}, error: 'No file provided.' };
    }
    const buf = await (file as Blob).arrayBuffer();
    const meta: SourceMeta = { title: (file as File).name || 'upload' };
    const r = await analyseArrayBuffer(buf, meta);
    if (r.error) return { meta, error: r.error };
    return { meta: { ...meta, durationSec: r.chart.duration } };
  },
};

const urlAdapter: SourceAdapter = {
  id: 'url',
  label: 'Direct audio URL',
  capability: 'audio',
  description: 'http(s) URL to an audio file that permits CORS download. Clear error if blocked.',
  async resolve(input: unknown) {
    const url = String(input || '').trim();
    if (!/^https?:\/\//i.test(url)) return { meta: {}, error: 'Enter an http(s) audio URL.' };
    const r = await analyseUrl(url);
    return { meta: { title: url.split('/').pop(), url, notes: r.error }, error: r.error };
  },
};

const churchAdapter: SourceAdapter = {
  id: 'church-banks',
  label: 'Sanctum church banks',
  capability: 'both',
  description: 'Royalty-cleared loops from content/church-banks (OGG/WAV) with key/BPM from the manifest.',
  async resolve(input: unknown) {
    const item = input as { path: string; name?: string; key?: string; bpm?: number };
    if (!item?.path) return { meta: {}, error: 'Pick a church-bank loop.' };
    const url = item.path.startsWith('/') ? item.path : '/' + item.path;
    try {
      const res = await fetch(url);
      if (!res.ok) return { meta: { title: item.name }, error: `HTTP ${res.status} loading bank sample.` };
      const buf = await res.arrayBuffer();
      const meta: SourceMeta = { title: item.name || url, key: item.key, bpm: item.bpm, url };
      const r = await analyseArrayBuffer(buf, meta);
      return { meta: { ...meta, durationSec: r.chart.duration }, error: r.error };
    } catch (e) {
      return { meta: { title: item.name }, error: (e as Error).message };
    }
  },
};

const soundcloudAdapter: SourceAdapter = {
  id: 'soundcloud',
  label: 'SoundCloud (oEmbed)',
  capability: 'metadata',
  description: 'Track info via oEmbed. Audio download only through official API when the owner enabled it (requires client id — configure separately).',
  async resolve(input: unknown) {
    const url = String(input || '').trim();
    if (!url) return { meta: {}, error: 'Paste a SoundCloud track URL.' };
    try {
      const oembed = 'https://soundcloud.com/oembed?format=json&url=' + encodeURIComponent(url);
      const res = await fetch(oembed);
      if (!res.ok) return { meta: { url }, error: `oEmbed HTTP ${res.status}` };
      const j = await res.json();
      const meta: SourceMeta = {
        title: j.title, artist: j.author_name, thumbnail: j.thumbnail_url, url,
        notes: cfg.soundcloudClientId
          ? 'Client id present — use official download API only when allowed by the track owner.'
          : 'Metadata only. Set soundcloudClientId to attempt official downloads when enabled by the owner.',
      };
      return { meta };
    } catch (e) {
      return { meta: { url }, error: 'SoundCloud oEmbed failed (network/CORS): ' + (e as Error).message };
    }
  },
};

const spotifyAdapter: SourceAdapter = {
  id: 'spotify',
  label: 'Spotify (metadata)',
  capability: 'metadata',
  description: 'Track metadata via Web API. No raw audio. audio-features & audio-analysis deprecated for new apps (27 Nov 2024).',
  async resolve(input: unknown) {
    const q = String(input || '').trim();
    if (!cfg.spotifyClientId) {
      return {
        meta: { title: q || undefined, notes: 'Configure spotifyClientId to look up metadata. No audio is ever fetched from Spotify.' },
        error: 'Spotify client id not configured (placeholder only). Paste a track URI/URL for display; analyse a user-owned file for chords.',
      };
    }
    return {
      meta: {
        title: q,
        notes: 'Spotify client id set — implement OAuth + Get Track for metadata. audio-features/analysis unavailable to new apps.',
      },
      error: 'OAuth flow not wired in this build. Metadata-only by design.',
    };
  },
};

const appleAdapter: SourceAdapter = {
  id: 'apple-music',
  label: 'Apple Music (metadata)',
  capability: 'metadata',
  description: 'MusicKit / Apple Music API: catalog & library metadata. No raw audio export.',
  async resolve(input: unknown) {
    const q = String(input || '').trim();
    if (!cfg.appleMusicDeveloperToken) {
      return {
        meta: { title: q || undefined, notes: 'Configure appleMusicDeveloperToken (never commit secrets).' },
        error: 'Apple Music developer token not configured.',
      };
    }
    return { meta: { title: q, notes: 'Token present — MusicKit auth not wired in this build.' }, error: 'MusicKit not wired.' };
  },
};

const bandcampAdapter: SourceAdapter = {
  id: 'bandcamp',
  label: 'Bandcamp',
  capability: 'info',
  description: 'No official public API. Purchased downloads are user-owned — import them with File upload.',
  async resolve() {
    return {
      meta: { notes: 'Use File upload for Bandcamp purchases you own. No stream ripping.' },
    };
  },
};

export const ADAPTERS: SourceAdapter[] = [
  fileAdapter, urlAdapter, churchAdapter, soundcloudAdapter, spotifyAdapter, appleAdapter, bandcampAdapter,
];

export function adapter(id: string) { return ADAPTERS.find((a) => a.id === id); }

/** Load church-banks manifest entries useful for chord import. */
export async function listChurchBankLoops(): Promise<{ path: string; name: string; key?: string; bpm?: number; bank: string }[]> {
  try {
    const res = await fetch('/content/church-banks/manifest.json');
    if (!res.ok) return [];
    const man = await res.json();
    const out: { path: string; name: string; key?: string; bpm?: number; bank: string }[] = [];
    const banks = man.banks || [];
    for (const bank of banks) {
      for (const p of bank.pads || []) {
        const file = p.file || p.web?.wav || p.web?.ogg;
        if (!file) continue;
        const path = '/content/church-banks/' + String(file).replace(/^\//, '');
        out.push({ path, name: p.name || file, key: p.key, bpm: p.bpm || bank.bpm, bank: bank.name || bank.id || '' });
      }
    }
    return out;
  } catch { return []; }
}

export type { SourceAdapter, SourceMeta, SourceAudio };
