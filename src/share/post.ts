// Posting: native iOS/Android share sheet (Capacitor Share + Filesystem), Web Share API, X / Facebook web intents, download.
// No API keys, no OAuth, no direct posting to accounts — the user picks the app (Instagram, TikTok, X, Facebook, YouTube,
// Messages, Save Video…) in the system share sheet and posts from there.
import { Capacitor } from '@capacitor/core';
import type { Media } from './capture';

export const NATIVE_SHARE = Capacitor.isNativePlatform();

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
}

/** Writes the file to the app cache (native) and opens the share sheet. Returns how it was shared. */
export async function shareMedia(m: Media | null, text: string, link: string): Promise<'native' | 'web' | 'download' | 'cancelled'> {
  const fullText = [text, link].filter(Boolean).join(' ');
  if (NATIVE_SHARE) {
    const { Share } = await import('@capacitor/share');
    let files: string[] | undefined;
    if (m) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const data = await blobToBase64(m.blob);
      const w = await Filesystem.writeFile({ path: `share/${m.filename}`, data, directory: Directory.Cache, recursive: true });
      files = [w.uri];
    }
    try {
      await Share.share({ title: 'Sanctum', text: fullText, ...(files ? { files } : link ? { url: link } : {}), dialogTitle: 'Post with…' });
      return 'native';
    } catch (e) { if (/cancel/i.test(String((e as Error)?.message || e))) return 'cancelled'; throw e; }
  }
  if (m && navigator.canShare) {
    const file = new File([m.blob], m.filename, { type: m.mime });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Sanctum', text: fullText }); return 'web'; }
      catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
    }
  } else if (!m && navigator.share) {
    try { await navigator.share({ title: 'Sanctum', text, ...(link ? { url: link } : {}) }); return 'web'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  if (m) { download(m); return 'download'; }
  return 'cancelled';
}

export function download(m: Media) {
  const a = document.createElement('a'); a.href = m.url; a.download = m.filename; document.body.appendChild(a); a.click(); a.remove();
}

/** X web intent: text + link only (X's intent URL can't carry an attachment — attach media through the share sheet). */
export const xIntentUrl = (text: string, link: string) => `https://x.com/intent/post?text=${encodeURIComponent(text)}${link ? `&url=${encodeURIComponent(link)}` : ''}`;
/** Facebook sharer: shares a link (Facebook ignores pre-filled text). */
export const facebookShareUrl = (link: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;

/** Opens an external URL: system browser / the platform's app via universal link on native, new tab on web. */
export function openExternal(url: string) {
  const w = window.open(url, '_blank', 'noopener');
  if (!w && !NATIVE_SHARE) location.href = url;
}
