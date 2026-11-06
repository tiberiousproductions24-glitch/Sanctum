// Loaded ONLY after a license verifies (dynamic import from main.ts): app core, audio engine, pads, sequencer.
import { App } from './app';
import { View } from './ui/view';
import { Sheets } from './ui/sheets';
import { h } from './ui/dom';
import { archPadSvg } from './ui/logo';
import type { LicenseState } from './license/license';
import type { LicensePayload } from './license/token';
import { initNative } from './native';
import { THEMES } from './state';
import { loadFollowMe, loadBeatTheoryMapsFromContent } from './followme';

export function mountApp(license: LicensePayload, st: LicenseState) {
  const app = new App();
  app.license = license; app.licenseState = st;
  const view = new View(app);
  const sheets = new Sheets(app, view);
  view.sheets = sheets;
  view.renderAll();

  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.get('theme') && THEMES.includes(q.get('theme') as any)) { app.p.theme = q.get('theme') as any; app.emit('theme'); }
    if (q.get('layout') && ['phone', 'tablet', 'auto'].includes(q.get('layout')!)) { app.p.settings.deviceClass = q.get('layout') as any; app.emit('layout'); }
  }
  initNative(app);

  // Audio needs a user gesture: "tap to start" splash (also the brand splash).
  const splash = h('div', { class: 'overlay start', role: 'button', tabindex: 0, 'aria-label': 'Tap to start Sanctum' },
    h('div', { class: 'archmark', html: archPadSvg(false), 'aria-hidden': 'true' }), h('h1', {}, 'SANCTUM'),
    h('p', {}, app.restored ? 'Your last session is back.' : 'Drums · Stage sounds · Church shout banks'),
    h('button', { class: 'btn primary bigstart' }, 'Tap to start'));
  const startNow = async () => {
    splash.remove();
    try { await app.start(); } catch (e) { console.error(e); alert('Sound failed to start: ' + (e as Error).message); }
  };
  // 'click' (not pointerdown): counts as a user activation on iOS (touchend) and avoids click-through to pads below.
  splash.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); startNow(); }, { once: true });
  document.body.appendChild(splash);
  // Safety net for WebView autoplay policy: any touch resumes a suspended AudioContext.
  const resume = () => { if (app.started) app.engine.resume(); };
  window.addEventListener('pointerdown', resume, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });

  (window as any).__sanctum = { app, view, sheets };
  // Beat Theory maps: Follow Me shout library + Chords theory drop-in (non-blocking).
  Promise.all([
    loadFollowMe().then((eng) => { view.pulpitUI?.player.attachFollowMe(eng); }).catch((e) => console.warn('[Follow Me]', e)),
    loadBeatTheoryMapsFromContent().catch((e) => console.warn('[Beat Theory]', e)),
  ]);
  return app;
}
