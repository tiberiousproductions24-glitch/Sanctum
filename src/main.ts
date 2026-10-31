import './styles.css';
import { App } from './app';
import { View } from './ui/view';
import { Sheets } from './ui/sheets';
import { AccessGate } from './ui/access';
import { h } from './ui/dom';
import { archPadSvg } from './ui/logo';
import type { AccessState } from './state';

const app = new App();
const view = new View(app);
const sheets = new Sheets(app, view);
view.sheets = sheets;
view.renderAll();
const gate = new AccessGate(app, () => sheets.accessPreview());

const q = new URLSearchParams(location.search);
const qa = q.get('access') as AccessState | null;
if (qa && ['owner', 'locked', 'invite', 'expired', 'revoked', 'paywall', 'grace'].includes(qa)) app.p.access = qa;
if (q.get('theme') && ['dark', 'light', 'warm'].includes(q.get('theme')!)) { app.p.theme = q.get('theme') as any; app.emit('theme'); }
if (q.get('layout') && ['phone', 'tablet', 'auto'].includes(q.get('layout')!)) { app.p.settings.deviceClass = q.get('layout') as any; app.emit('layout'); }
gate.render();

// Audio needs a user gesture: "tap to start" splash (also the brand splash).
const splash = h('div', { class: 'overlay start', role: 'button', 'aria-label': 'Tap to start Sanctum' },
  h('div', { class: 'archmark', html: archPadSvg(false) }), h('h1', {}, 'SANCTUM'),
  h('p', {}, app.restored ? 'Project restored from autosave.' : 'Foundation Kit · Stage FX · Church shout banks'),
  h('button', { class: 'btn primary', style: { height: '56px', width: 'min(320px, 80vw)', fontSize: '18px', borderRadius: '14px' } }, 'Tap to start'));
const startNow = async () => {
  splash.remove();
  try { await app.start(); } catch (e) { console.error(e); alert('Audio failed to start: ' + (e as Error).message); }
};
splash.addEventListener('pointerdown', (e) => { e.preventDefault(); startNow(); }, { once: true });
document.body.appendChild(splash);

if ('serviceWorker' in navigator && window.isSecureContext && import.meta.env.PROD) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
(window as any).__sanctum = { app, view, sheets, gate };
