// Entry: license gate first. The app/engine/pads module is only imported after a valid license.
import './styles.css';
import './hardware.css';
import './themes.css';
import './skins/acrylic.css';
import { Capacitor } from '@capacitor/core';
import { checkLicense, activate } from './license/license';
import { LockScreen } from './license/gate';
import { extractCode } from './license/token';
import type { LicensePayload } from './license/token';

// Apply the saved colour theme + layout mode before anything renders (lock screen included).
try {
  const t = localStorage.getItem('sanctum.theme') || JSON.parse(localStorage.getItem('sanctum.project.v1') || '{}').theme;
  if (['dark', 'light', 'warm', 'contrast', 'neon', 'minimal'].includes(t)) document.documentElement.dataset.theme = t;
  const l = localStorage.getItem('sanctum.layout'); if (l === 'auto' || l === 'phone' || l === 'tablet') document.documentElement.dataset.layoutMode = l;
  const raw = localStorage.getItem('sanctum.padSkin') || JSON.parse(localStorage.getItem('sanctum.project.v1') || '{}')?.settings?.padSkin;
  document.documentElement.dataset.padSkin = (raw === 'hardware' || raw === 'acrylic') ? raw : 'acrylic';
} catch {}

let mounted = false;
let lock: LockScreen | null = null;
let pendingCode: string | null = null;

async function mount(p: LicensePayload, st: Awaited<ReturnType<typeof checkLicense>>) {
  if (mounted) return; mounted = true;
  const { mountApp } = await import('./boot-app');
  mountApp(p, st);
}

async function handleUrl(url: string) {
  if (!/^sanctum:\/\/activate|\/activate\?/.test(url)) return;
  const code = extractCode(url);
  if (!code) return;
  if (lock) { lock.render('enter'); await lock.tryCode(code); return; }
  if (!mounted) { pendingCode = code; return; }
  // Already unlocked: a new code (e.g. renewal) replaces the stored one if it verifies.
  const st = await checkLicense();
  const r = await activate(code, st.deviceId);
  alert(r.status === 'valid' ? 'New code saved. Sanctum will restart.' : 'That code could not be used (' + r.status + ').');
  if (r.status === 'valid') location.reload();
}

async function boot() {
  if (Capacitor.isNativePlatform()) {
    const { App: CapApp } = await import('@capacitor/app');
    CapApp.addListener('appUrlOpen', (e) => handleUrl(e.url));
    const launch = await CapApp.getLaunchUrl(); if (launch?.url) await handleUrl(launch.url);
  } else if (location.search.includes('code=')) pendingCode = extractCode(location.search);
  const st = await checkLicense();
  try { const { SplashScreen } = await import('@capacitor/splash-screen'); SplashScreen.hide(); } catch {}
  if (st.result?.status === 'valid') return mount(st.result.payload, st);
  lock = new LockScreen(st, (p) => { lock = null; mount(p, st); });
  if (pendingCode) { lock.render('enter'); await lock.tryCode(pendingCode); pendingCode = null; }
  else lock.render();
}
boot().catch((e) => { console.error(e); document.body.textContent = 'Sanctum failed to start: ' + (e as Error).message; });

// Re-check once a minute so an expiring license locks the app (after saving).
setInterval(async () => {
  if (!mounted) return;
  const st = await checkLicense();
  if (st.result?.status !== 'valid') { (window as any).__sanctum?.app?.save?.(); location.reload(); }
}, 60_000);

if ('serviceWorker' in navigator && window.isSecureContext && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
