// Share / Post panel: capture a screenshot, render a promo card, or record a clip of Sanctum's output, then hand it to
// the iOS/Android share sheet (Instagram, TikTok, X, Facebook, YouTube, Messages, Save to Photos…), Web Share, or download.
import type { App } from '../app';
import type { View } from './view';
import type { Sheets } from './sheets';
import { h, seg, toggle, toast } from './dom';
import { captureScreenshot, renderPromo, ClipRecorder, clipSupport, type ClipKind, type Media } from '../share/capture';
import { shareMedia, download, xIntentUrl, facebookShareUrl, openExternal, NATIVE_SHARE } from '../share/post';

const K_CAPTION = 'sanctum.share.caption', K_LINK = 'sanctum.share.link', K_KIND = 'sanctum.share.kind', K_LEN = 'sanctum.share.len';
const ls = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

export class SharePanel {
  media: Media | null = null;
  private rec: ClipRecorder;
  private pill: HTMLElement | null = null;
  private autoPlayed = false;
  constructor(private app: App, private view: View, private sheets: Sheets) { this.rec = new ClipRecorder(app, view); }

  private caption() { return ls(K_CAPTION, `New beat on Sanctum 🥁 ${Math.round(this.app.p.bpm)} BPM #Sanctum #drummachine #beatmaker #MPC`); }

  open() {
    const a = this.app;
    const cap = h('textarea', { class: 'codein share-caption', rows: 3, 'aria-label': 'Caption', oninput: () => lsSet(K_CAPTION, cap.value) }) as HTMLTextAreaElement;
    cap.value = this.caption();
    const link = h('input', { type: 'text', inputmode: 'url', placeholder: 'Link (optional) — e.g. your YouTube, Linktree or site', value: ls(K_LINK, ''), 'aria-label': 'Link to include', oninput: () => { lsSet(K_LINK, link.value.trim()); refresh(); } }) as HTMLInputElement;
    const preview = h('div', { class: 'share-preview', 'aria-live': 'polite' });
    const status = h('div', {});
    const shareBtn = h('button', { class: 'btn primary share-main', onclick: () => this.doShare(cap.value, link.value.trim()) });
    const dlBtn = h('button', { class: 'btn', onclick: () => this.media && download(this.media) }, '⬇ Download');
    const fbBtn = h('button', { class: 'btn share-fb', onclick: () => openExternal(facebookShareUrl(link.value.trim())) }, 'f  Facebook (link)');
    const xBtn = h('button', { class: 'btn share-x', onclick: () => openExternal(xIntentUrl(cap.value, link.value.trim())) }, '𝕏  Post text to X');

    const refresh = () => {
      preview.innerHTML = '';
      const m = this.media;
      if (m) {
        preview.append(m.kind === 'image' ? h('img', { src: m.url, alt: 'Captured image preview' })
          : m.kind === 'video' ? h('video', { src: m.url, controls: true, playsinline: true, muted: false })
          : h('audio', { src: m.url, controls: true }),
          h('div', { class: 'note' }, `${m.filename} · ${(m.blob.size / 1024 / 1024).toFixed(2)} MB · ${m.mime}`));
      } else preview.append(h('p', { class: 'note' }, 'Nothing captured yet — take a screenshot, make a promo card, or record a clip. You can also share just the caption.'));
      shareBtn.textContent = m ? `⤴ Share ${m.kind === 'image' ? 'image' : m.kind}…` : '⤴ Share caption…';
      dlBtn.style.display = m && !NATIVE_SHARE ? '' : 'none';
      (fbBtn as HTMLButtonElement).disabled = !link.value.trim();
      fbBtn.title = link.value.trim() ? '' : 'Facebook\'s share link needs a web address — add one in “Link”.';
    };

    let kind = ls(K_KIND, 'video-vertical') as ClipKind; let len = Number(ls(K_LEN, '30')); let autoPlay = !a.seq.playing;
    const recBtn = h('button', { class: 'btn primary share-rec', onclick: () => this.startClip(kind, len, cap.value, autoPlay) }, '● Record clip');
    const support = (k: ClipKind) => { const s = clipSupport(k); return s === null ? 'not supported here' : s || 'default format'; };
    const supportNote = h('p', { class: 'note' });
    const setSupport = () => { supportNote.textContent = `Format on this device: ${support(kind)}. The clip records Sanctum's own output (no microphone). Video clips show your pads lighting up in the current theme.`; };
    setSupport();

    this.sheets.open('Share / Post', h('div', { class: 'share' },
      h('h3', {}, 'Caption & link'), cap, h('div', { class: 'row' }, link),
      h('h3', {}, 'Capture'),
      h('div', { class: 'row' },
        h('button', { class: 'btn share-shot', onclick: async () => {
          this.sheets.close(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          try { this.setMedia(await captureScreenshot()); toast('Screenshot captured'); } catch (e) { toast((e as Error).message); }
          this.open();
        } }, '📸 Screenshot'),
        h('button', { class: 'btn share-promo', onclick: async () => { try { this.setMedia(await renderPromo(a, cap.value)); refresh(); } catch (e) { toast((e as Error).message); } } }, '🖼 Promo card')),
      h('h3', {}, 'Record a clip'),
      h('div', { class: 'row' }, h('label', {}, 'Format'), seg([{ v: 'video-vertical' as ClipKind, label: 'Video 9:16' }, { v: 'video-square' as ClipKind, label: 'Video 1:1' }, { v: 'audio' as ClipKind, label: 'Audio only' }], kind, (v) => { kind = v; lsSet(K_KIND, v); setSupport(); }, 'Clip format')),
      h('div', { class: 'row' }, h('label', {}, 'Max length'), seg([15, 30, 60].map((v) => ({ v, label: v + ' s' })), len, (v) => { len = v; lsSet(K_LEN, String(v)); }, 'Clip length')),
      h('div', { class: 'row' }, toggle('Start the beat when recording starts', autoPlay, (v) => { autoPlay = v; })),
      h('div', { class: 'row' }, recBtn), supportNote,
      h('h3', {}, 'Preview'), preview, status,
      h('h3', {}, 'Post'),
      h('div', { class: 'row' }, shareBtn, dlBtn),
      h('p', { class: 'note' }, NATIVE_SHARE
        ? 'Opens the iOS share sheet — pick Instagram, TikTok, X, Facebook, YouTube, Messages, or Save Video / Save Image, and finish the post in that app.'
        : 'Uses your browser\'s share menu where it supports files (Safari on iPhone/iPad, Chrome on Android); otherwise the file downloads so you can upload it.'),
      h('div', { class: 'row' }, xBtn, fbBtn),
      h('p', { class: 'note' }, 'X and Facebook web links carry text / a link only — attach the clip or image through Share. Sanctum never asks for your passwords and doesn\'t post to your accounts by itself.')));
    refresh();
  }

  private setMedia(m: Media) { if (this.media) URL.revokeObjectURL(this.media.url); this.media = m; }

  private async doShare(text: string, link: string) {
    try {
      const r = await shareMedia(this.media, text, link);
      if (r === 'download') toast('Sharing files isn\'t available here — downloaded instead.');
      else if (r === 'native' || r === 'web') toast('Shared');
    } catch (e) { toast('Share failed: ' + (e as Error).message, 4000); }
  }

  private startClip(kind: ClipKind, len: number, caption: string, autoPlay: boolean) {
    if (!this.app.started) { toast('Tap to start the sound first.'); return; }
    try {
      this.rec.start(kind, len, caption, (s) => this.updatePill(s, len), (m, err) => {
        this.pill?.remove(); this.pill = null;
        if (this.autoPlayed && this.app.seq.playing) this.app.stop();
        this.autoPlayed = false;
        if (m) { this.setMedia(m); toast('Clip ready'); } else if (err) toast(err, 4000);
        this.open();
      });
    } catch (e) { toast((e as Error).message, 4000); return; }
    this.sheets.close();
    this.pill = h('button', { class: 'clip-pill', 'aria-label': 'Recording clip — tap to stop', onclick: () => this.rec.stop() }, h('span', { class: 'dot' }), h('span', { class: 't' }, 'REC 0:00'), h('small', {}, 'tap to stop'));
    document.body.appendChild(this.pill);
    if (autoPlay && !this.app.seq.playing) { this.app.play(); this.autoPlayed = true; }
    this.view.announce('Recording clip');
  }

  private updatePill(s: number, len: number) {
    const t = this.pill?.querySelector('.t'); if (!t) return;
    const left = Math.max(0, Math.ceil(len - s));
    t.textContent = `REC ${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')} · ${left}s left`;
  }
}
