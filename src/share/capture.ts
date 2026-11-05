// Share panel media: screenshot of the live screen, promo card, and audio/video clips of Sanctum's output.
// Everything is rendered on-device; nothing is uploaded anywhere.
import { toBlob } from 'html-to-image';
import type { App } from '../app';
import type { View } from '../ui/view';
import { archPadSvg } from '../ui/logo';

export interface Media { blob: Blob; mime: string; filename: string; kind: 'image' | 'video' | 'audio'; url: string }

const stamp = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }; // local time
export const makeMedia = (blob: Blob, kind: Media['kind'], base: string): Media => {
  const mime = blob.type || (kind === 'image' ? 'image/png' : kind === 'video' ? 'video/mp4' : 'audio/mp4');
  const ext = kind === 'image' ? 'png' : mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : kind === 'audio' ? 'm4a' : 'mp4';
  return { blob, mime, kind, filename: `sanctum-${base}-${stamp()}.${ext}`, url: URL.createObjectURL(blob) };
};

/** Theme colours read from the live CSS custom properties, so captures match the selected theme. */
export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  const accent = v('--accent', '#FF6A13');
  return { bg: v('--bg', '#07070C'), surface: v('--surface', '#0E0E16'), text: v('--text', '#F4F1EA'), muted: v('--muted', '#9A97A8'), accent,
    gold: v('--mark-accent', '#E8B931'), cap: v('--cap-top', '#2A2A3A'), edge: v('--cap-edge', '#3A3A52'),
    zones: [v('--z0', accent), v('--z1', accent), v('--z2', accent), v('--z3', accent)], mark: v('--mark', '#F4F1EA'), markPad: v('--mark-pad', accent) };
}

/** Screenshot of the instrument surface (#app) at device resolution (capped at 2×). Sheets/toasts are not included. */
export async function captureScreenshot(): Promise<Media> {
  const root = document.getElementById('app')!;
  const c = themeColors();
  const blob = await toBlob(root, {
    pixelRatio: Math.min(2, window.devicePixelRatio || 1), backgroundColor: c.bg, skipFonts: true, cacheBust: false,
    filter: (n) => !(n instanceof HTMLElement && (n.classList.contains('sr-only') || n.classList.contains('drawer-body'))),
  });
  if (!blob) throw new Error('Screenshot failed (the WebView refused to rasterise the page).');
  return makeMedia(blob, 'image', 'screenshot');
}

function logoImage(c: ReturnType<typeof themeColors>): Promise<HTMLImageElement> {
  const svg = archPadSvg(false).replace(/var\(--mark-accent\)/g, c.gold).replace(/var\(--mark-pad\)/g, c.markPad).replace(/var\(--mark\)/g, c.mark);
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}

/** 1080×1350 (4:5, Instagram feed friendly) promo card in the current theme's colours. */
export async function renderPromo(app: App, caption: string): Promise<Media> {
  const W = 1080, H = 1350; const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!; const c = themeColors();
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
  try { const g = ctx.createRadialGradient(W / 2, H * 1.05, 50, W / 2, H, H * 0.8); g.addColorStop(0, c.accent); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; } catch { ctx.globalAlpha = 1; }
  try { const logo = await logoImage(c); ctx.drawImage(logo, W / 2 - 230, 110, 460, 508); } catch {}
  ctx.fillStyle = c.text; ctx.textAlign = 'center';
  ctx.font = '400 96px Georgia, "Noto Serif", serif'; (ctx as any).letterSpacing = '28px'; ctx.fillText('SANCTUM', W / 2 + 14, 730); (ctx as any).letterSpacing = '0px';
  ctx.fillStyle = c.accent; ctx.font = '800 38px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${app.p.bpm.toFixed(0)} BPM · DRUMS · STAGE SOUNDS · SHOUT BANKS`, W / 2, 800);
  ctx.fillStyle = c.text; ctx.font = '600 44px system-ui, -apple-system, sans-serif';
  const lines = wrap(ctx, caption || 'Made with Sanctum', W - 160).slice(0, 6);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 920 + i * 60));
  ctx.fillStyle = c.muted; ctx.font = '600 30px system-ui, -apple-system, sans-serif'; ctx.fillText('Made with Sanctum', W / 2, H - 70);
  const blob: Blob = await new Promise((r, j) => cv.toBlob((b) => (b ? r(b) : j(new Error('toBlob failed'))), 'image/png'));
  return makeMedia(blob, 'image', 'promo');
}

// ---------- clip recording ----------
export type ClipKind = 'video-square' | 'video-vertical' | 'audio';
// H.264 MP4 first (what Instagram / TikTok / X accept everywhere; iOS Safari/WKWebView records this), WebM last.
const VIDEO_TYPES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,opus', 'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const AUDIO_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
const PAD_POS = (idx: number) => ({ col: idx % 4, row: 3 - Math.floor(idx / 4) }); // pad 1 = bottom-left

export function clipSupport(kind: ClipKind): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  if (kind !== 'audio' && typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  const list = kind === 'audio' ? AUDIO_TYPES : VIDEO_TYPES;
  return list.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
}

/** Records Sanctum's master output (WebAudio → MediaStreamDestination). Video clips add a live canvas visual: theme-coloured 4×4 pads that light on every hit, a level waveform, BPM and the caption. */
export class ClipRecorder {
  private rec: MediaRecorder | null = null;
  private stopFns: (() => void)[] = [];
  private t0 = 0;
  recording = false;
  constructor(private app: App, private view: View) {}

  start(kind: ClipKind, maxSec: number, caption: string, onTick: (sec: number) => void, onDone: (m: Media | null, err?: string) => void) {
    const mime = clipSupport(kind);
    if (mime === null) throw new Error(kind === 'audio' ? 'Recording isn’t supported in this browser/WebView.' : 'Video recording isn’t supported here — try “Audio only”.');
    const tap = this.app.engine.tapOutput(); if (!tap) throw new Error('Tap to start the sound first, then record.');
    this.stopFns.push(tap.release);
    let stream = tap.stream;
    if (kind !== 'audio') {
      const cv = this.visual(kind, tap.analyser, caption);
      const vs = cv.captureStream(30);
      stream = new MediaStream([...vs.getVideoTracks(), ...tap.stream.getAudioTracks()]);
      this.stopFns.push(() => vs.getTracks().forEach((t) => t.stop()));
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 192_000, ...(kind !== 'audio' ? { videoBitsPerSecond: 4_000_000 } : {}) });
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      this.cleanup();
      if (!chunks.length) { onDone(null, 'Nothing was recorded.'); return; }
      const blob = new Blob(chunks, { type: rec.mimeType || mime || chunks[0].type });
      onDone(makeMedia(blob, kind === 'audio' ? 'audio' : 'video', kind === 'audio' ? 'clip-audio' : 'clip'));
    };
    rec.onerror = (e: any) => { this.cleanup(); onDone(null, 'Recorder error: ' + (e?.error?.message || 'unknown')); };
    this.rec = rec; this.recording = true; this.t0 = performance.now();
    rec.start(1000);
    const tick = window.setInterval(() => { const s = (performance.now() - this.t0) / 1000; onTick(s); if (s >= maxSec) this.stop(); }, 250);
    this.stopFns.push(() => clearInterval(tick));
  }

  stop() { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); else this.cleanup(); }

  private cleanup() { this.recording = false; this.rec = null; for (const f of this.stopFns.splice(0)) { try { f(); } catch {} } }

  private visual(kind: ClipKind, analyser: AnalyserNode, caption: string) {
    const W = 1080, H = kind === 'video-vertical' ? 1920 : 1080;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d')!;
    const c = themeColors();
    const lit = new Float32Array(16);
    // hook pad flashes (live hits, sequencer, MIDI) without touching the audio path
    const view = this.view as any; const orig = view.flash;
    view.flash = (pad16: number, vel: number, x?: number, y?: number) => { lit[pad16] = Math.max(lit[pad16], 0.35 + 0.65 * vel / 127); return orig.call(view, pad16, vel, x, y); };
    this.stopFns.push(() => { view.flash = orig; });
    let logo: HTMLImageElement | null = null; logoImage(c).then((i) => (logo = i)).catch(() => {});
    const wave = new Uint8Array(analyser.fftSize);
    const grid = Math.min(W - 160, H * 0.55); const gx = (W - grid) / 2; const gy = kind === 'video-vertical' ? 560 : 230; const gap = 22; const ps = (grid - 3 * gap) / 4;
    let raf = 0, last = performance.now();
    const rr = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
      // header
      if (logo) ctx.drawImage(logo, 60, 40, 120, 132);
      ctx.fillStyle = c.text; ctx.textAlign = 'left'; ctx.font = '400 64px Georgia, "Noto Serif", serif'; ctx.fillText('SANCTUM', 200, 130);
      ctx.textAlign = 'right'; ctx.fillStyle = c.accent; ctx.font = '800 52px ui-monospace, Menlo, monospace';
      ctx.fillText(`${this.app.p.bpm.toFixed(1)} BPM`, W - 60, 130);
      // pads
      for (let i = 0; i < 16; i++) {
        const { col, row } = PAD_POS(i); const x = gx + col * (ps + gap), y = gy + row * (ps + gap); const z = c.zones[Math.floor(i / 4)] || c.accent;
        lit[i] = Math.max(0, lit[i] - dt * 3.2);
        ctx.save();
        if (lit[i] > 0.02) { ctx.shadowColor = z; ctx.shadowBlur = 50 * lit[i]; }
        ctx.fillStyle = c.cap; rr(x, y, ps, ps, 22); ctx.fill();
        ctx.restore();
        ctx.lineWidth = 4; ctx.strokeStyle = z; ctx.globalAlpha = 0.45 + 0.55 * lit[i]; rr(x, y, ps, ps, 22); ctx.stroke();
        if (lit[i] > 0.02) { ctx.globalAlpha = lit[i] * 0.85; ctx.fillStyle = z; rr(x, y, ps, ps, 22); ctx.fill(); }
        ctx.globalAlpha = 1;
        const s = this.app.soundOf(this.app.p.currentBank * 16 + i);
        ctx.fillStyle = c.text; ctx.textAlign = 'left'; ctx.font = '800 30px system-ui, -apple-system, sans-serif'; ctx.fillText(s?.short || String(i + 1), x + 18, y + ps - 22);
      }
      // waveform
      analyser.getByteTimeDomainData(wave);
      const wy = gy + grid + 120, wh = 110;
      ctx.strokeStyle = c.accent; ctx.lineWidth = 5; ctx.beginPath();
      for (let i = 0; i < wave.length; i += 4) { const x = 60 + (i / wave.length) * (W - 120); const y = wy + ((wave[i] - 128) / 128) * wh; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      // caption
      ctx.fillStyle = c.text; ctx.textAlign = 'center'; ctx.font = '600 40px system-ui, -apple-system, sans-serif';
      wrap(ctx, caption, W - 140).slice(0, kind === 'video-vertical' ? 5 : 2).forEach((l, i) => ctx.fillText(l, W / 2, wy + wh + 90 + i * 54));
      ctx.fillStyle = c.muted; ctx.font = '600 28px system-ui, -apple-system, sans-serif'; ctx.fillText('Made with Sanctum', W / 2, H - 40);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    this.stopFns.push(() => cancelAnimationFrame(raf));
    return cv;
  }
}
