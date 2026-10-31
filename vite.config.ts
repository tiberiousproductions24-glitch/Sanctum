import { defineConfig, type Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'node:fs';
import path from 'node:path';

const LINK_BRIDGE = process.env.SANCTUM_BRIDGE || 'ws://127.0.0.1:20809';
const useHttps = process.env.HTTPS === '1';
const CONTENT_DIR = path.resolve(import.meta.dirname, 'content');

// Serves /content/** (extra soundbanks, e.g. content/church-banks/manifest.json) in dev/preview
// and copies it into dist/content on build (WAV + OGG only; MP3 is skipped — it pads loops).
function contentBanks(): Plugin {
  const serve = (req: any, res: any, next: any) => {
    if (!req.url || !req.url.startsWith('/content/')) return next();
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/content\//, '');
    const file = path.join(CONTENT_DIR, rel);
    if (!file.startsWith(CONTENT_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next();
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
      if (!fs.existsSync(CONTENT_DIR)) return;
      const out = path.resolve(import.meta.dirname, 'dist', 'content');
      const copy = (src: string, dst: string) => {
        for (const e of fs.readdirSync(src, { withFileTypes: true })) {
          if (e.name.startsWith('_') || e.name === 'mp3' || e.name === 'PROGRESS.md') continue;
          const s = path.join(src, e.name), d = path.join(dst, e.name);
          if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); }
          else fs.copyFileSync(s, d);
        }
      };
      fs.mkdirSync(out, { recursive: true });
      copy(CONTENT_DIR, out);
    },
  };
}

const proxy = { '/link': { target: LINK_BRIDGE, ws: true, changeOrigin: true } };

export default defineConfig({
  base: './',
  plugins: [contentBanks(), ...(useHttps ? [basicSsl()] : [])],
  server: { host: true, port: 5173, proxy },
  preview: { host: true, port: 4173, proxy },
  build: { target: 'es2022', sourcemap: true },
});
