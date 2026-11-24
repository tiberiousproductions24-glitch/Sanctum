import { defineConfig, type Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'node:fs';
import path from 'node:path';

const LINK_BRIDGE = process.env.SANCTUM_BRIDGE || 'ws://127.0.0.1:20809';
const useHttps = process.env.HTTPS === '1';
// Android/Capacitor build: OGG only (no WAV/MP3 in the APK), no source maps.
const NATIVE = process.env.SANCTUM_TARGET === 'android';
const CONTENT_DIR = path.resolve(import.meta.dirname, 'content');

// Serves /content/** (extra soundbanks, e.g. content/church-banks/manifest.json) in dev/preview
// and copies it into dist/content on build (WAV + OGG only; MP3 is skipped — it pads loops).
const CHORD_MAPS_DIR = path.resolve(import.meta.dirname, 'chord-maps');

function contentBanks(): Plugin {
  const resolveContent = (rel: string) => {
    const primary = path.join(CONTENT_DIR, rel);
    if (primary.startsWith(CONTENT_DIR) && fs.existsSync(primary) && !fs.statSync(primary).isDirectory()) return primary;
    // Fall back: chord-maps/*.json served under /content/chord-maps/
    if (rel.startsWith('chord-maps/')) {
      const alt = path.join(CHORD_MAPS_DIR, rel.slice('chord-maps/'.length));
      if (alt.startsWith(CHORD_MAPS_DIR) && fs.existsSync(alt) && !fs.statSync(alt).isDirectory()) return alt;
    }
    return null;
  };
  const serve = (req: any, res: any, next: any) => {
    if (!req.url || !req.url.startsWith('/content/')) return next();
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/content\//, '');
    const file = resolveContent(rel);
    if (!file) return next();
    const ext = path.extname(file).toLowerCase();
    const type = ({ '.json': 'application/json', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.md': 'text/markdown' } as Record<string, string>)[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(file).pipe(res);
  };
  return {
    name: 'sanctum-content-banks',
    configureServer(s) { s.middlewares.use(serve); },
    configurePreviewServer(s) { s.middlewares.use(serve); },
    closeBundle() {
      const out = path.resolve(import.meta.dirname, 'dist', 'content');
      const copy = (src: string, dst: string) => {
        if (!fs.existsSync(src)) return;
        for (const e of fs.readdirSync(src, { withFileTypes: true })) {
          if (e.name.startsWith('_') || e.name === 'mp3' || e.name === 'PROGRESS.md' || e.name === '__pycache__') continue;
          if (NATIVE && (e.name === 'wav' || /\.(wav|mp3)$/i.test(e.name))) continue;
          const s = path.join(src, e.name), d = path.join(dst, e.name);
          if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); }
          else fs.copyFileSync(s, d);
        }
      };
      fs.mkdirSync(out, { recursive: true });
      copy(CONTENT_DIR, out);
      // Always ship Follow Me maps into dist/content/chord-maps from chord-maps/
      const mapsOut = path.join(out, 'chord-maps');
      fs.mkdirSync(mapsOut, { recursive: true });
      for (const name of ['shout-iv-v-bvii.json', 'pulpit-12key-charts.json']) {
        const src = path.join(CHORD_MAPS_DIR, name);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(mapsOut, name));
      }
      // v0.3.4 Follow Me chart source (shout reference transcription); legacy file above kept for rollback.
      const ref = path.join(CHORD_MAPS_DIR, 'lawrence', 'progressions.json');
      if (fs.existsSync(ref)) fs.copyFileSync(ref, path.join(mapsOut, 'follow-me-shout-reference.json'));
      // Ensure theory drop-in is present even if content/ was sparse
      const theorySrc = path.join(CONTENT_DIR, 'theory', 'beat-theory-maps.json');
      if (fs.existsSync(theorySrc)) {
        const theoryOut = path.join(out, 'theory');
        fs.mkdirSync(theoryOut, { recursive: true });
        fs.copyFileSync(theorySrc, path.join(theoryOut, 'beat-theory-maps.json'));
        const schema = path.join(CONTENT_DIR, 'theory', 'beat-theory-maps.schema.json');
        if (fs.existsSync(schema)) fs.copyFileSync(schema, path.join(theoryOut, 'beat-theory-maps.schema.json'));
      }
    },
  };
}

const proxy = { '/link': { target: LINK_BRIDGE, ws: true, changeOrigin: true } };

export default defineConfig({
  base: './',
  plugins: [contentBanks(), ...(useHttps ? [basicSsl()] : [])],
  server: { host: true, port: 5173, proxy },
  preview: { host: true, port: 4173, proxy },
  define: { __OGG_ONLY__: JSON.stringify(NATIVE) },
  build: { target: 'es2022', sourcemap: !NATIVE },
});
