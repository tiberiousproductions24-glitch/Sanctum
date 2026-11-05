// Screenshots of every colour theme × layout mode, plus the Share panel and a functional share check.
//   npm run build && node scripts/shots-themes.mjs
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const ADMIN = fs.readFileSync('licensing-keys/ADMIN-TOKEN.txt', 'utf8').trim();
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const PORT = 4179; const BASE = `http://localhost:${PORT}/`; const SHOTS = 'screenshots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prev = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 75; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = []; const results = {};
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PHONE_L = { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const TAB_L = { width: 1180, height: 820, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const TAB_P = { width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
async function open(vp) {
  const ctx = await browser.createBrowserContext(); const pg = await ctx.newPage(); await pg.setViewport(vp);
  pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await pg.goto(BASE + '?code=' + encodeURIComponent(ADMIN), { waitUntil: 'networkidle0' });
  await pg.waitForSelector('.overlay.lock[data-screen="welcome"]', { timeout: 6000 }).catch(() => {});
  await pg.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => b.textContent === 'Open Sanctum')?.click());
  await pg.waitForFunction(() => window.__sanctum?.app, { timeout: 8000 });
  await pg.evaluate(() => document.querySelector('.overlay.start')?.click());
  await pg.waitForFunction(() => window.__sanctum.app.started, { timeout: 8000 });
  await pg.evaluate(() => { const a = window.__sanctum.app; const st = a.stepTicks(); for (let i = 0; i < 16; i++) { if (i % 4 === 0) a.toggleStep(0, i * st, st); if (i % 8 === 4) a.toggleStep(1, i * st, st); if (i % 2 === 1) a.toggleStep(2, i * st, st); } a.p.selectedPad = 0; a.emit('select'); });
  return { pg, ctx };
}
const set = (pg, theme, layout) => pg.evaluate((t, l) => { const a = window.__sanctum.app; a.p.theme = t; a.p.settings.deviceClass = l; a.save(); a.emit('theme'); a.emit('layout'); }, theme, layout);
const shoot = async (pg, name) => { await sleep(350); await pg.evaluate(() => document.querySelectorAll('.toast').forEach((t) => (t.style.display = 'none'))); await pg.screenshot({ path: `${SHOTS}/${name}.png` }); console.log('saved', `${SHOTS}/${name}.png`); };
const THEMES = ['dark', 'light', 'warm', 'contrast', 'neon', 'minimal'];
try {
  // themes on phone (auto layout)
  let { pg, ctx } = await open(PHONE);
  await pg.evaluate(() => window.__sanctum.app.play()); await sleep(600);
  for (const t of THEMES) { await set(pg, t, 'auto'); await shoot(pg, `themes-phone-${t}`); }
  // phone drawer open + settings theme picker + share panel
  await set(pg, 'neon', 'phone'); await pg.evaluate(() => window.__sanctum.view.toggleDrawer(true)); await shoot(pg, 'layout-phone-drawer-neon');
  await pg.evaluate(() => window.__sanctum.view.toggleDrawer(false));
  await pg.evaluate(() => window.__sanctum.sheets.settings()); await shoot(pg, 'themes-picker-settings');
  await pg.evaluate(() => window.__sanctum.app.stop());
  // functional share checks (headless Chrome): promo card, html-to-image screenshot, 2.5 s audio + video clips via MediaRecorder
  await pg.evaluate(() => window.__sanctum.sheets.share()); await sleep(200);
  await pg.evaluate(() => [...document.querySelectorAll('.share-promo')][0].click()); await sleep(800);
  results.promo = await pg.evaluate(() => { const m = window.__sanctum.sheets.sharePanel.media; return m && { kind: m.kind, size: m.blob.size, name: m.filename }; });
  await shoot(pg, 'share-panel-promo');
  await pg.evaluate(() => [...document.querySelectorAll('.share-shot')][0].click());
  await pg.waitForFunction(() => window.__sanctum.sheets.sharePanel.media?.filename.includes('screenshot'), { timeout: 15000 }).catch(() => {});
  results.screenshot = await pg.evaluate(() => { const m = window.__sanctum.sheets.sharePanel.media; return m && { kind: m.kind, size: m.blob.size, name: m.filename }; });
  await shoot(pg, 'share-panel-screenshot');
  for (const kind of ['audio', 'video-vertical']) {
    await pg.evaluate((k) => { localStorage.setItem('sanctum.share.kind', k); localStorage.setItem('sanctum.share.len', '15'); window.__sanctum.sheets.share(); }, kind); await sleep(150);
    await pg.evaluate(() => document.querySelector('.share-rec').click()); await sleep(2500);
    const pill = await pg.evaluate(() => document.querySelector('.clip-pill')?.textContent);
    if (kind === 'video-vertical') await shoot(pg, 'share-recording-pill');
    await pg.evaluate(() => document.querySelector('.clip-pill')?.click());
    await pg.waitForFunction((k) => (window.__sanctum.sheets.sharePanel.media?.filename || '').includes(k === 'audio' ? 'clip-audio' : 'clip-'), { timeout: 8000 }, kind).catch(() => {});
    results[kind] = await pg.evaluate(() => { const m = window.__sanctum.sheets.sharePanel.media; return m && { kind: m.kind, size: m.blob.size, mime: m.mime, name: m.filename }; });
    results[kind + '-pill'] = pill;
  }
  await shoot(pg, 'share-panel-clip');
  await ctx.close();
  // phone landscape
  ({ pg, ctx } = await open(PHONE_L)); await set(pg, 'dark', 'auto'); await shoot(pg, 'layout-phone-landscape-dark'); await ctx.close();
  // tablet landscape / portrait in auto, forced phone + tablet modes
  ({ pg, ctx } = await open(TAB_L)); await pg.evaluate(() => window.__sanctum.app.play()); await sleep(600);
  for (const t of ['neon', 'contrast', 'minimal']) { await set(pg, t, 'auto'); await shoot(pg, `themes-tablet-landscape-${t}`); }
  await set(pg, 'dark', 'tablet'); await shoot(pg, 'layout-tablet-landscape');
  await set(pg, 'warm', 'phone'); await shoot(pg, 'layout-forced-phone-on-tablet');
  await pg.evaluate(() => window.__sanctum.app.stop()); await ctx.close();
  ({ pg, ctx } = await open(TAB_P)); await set(pg, 'dark', 'auto'); await shoot(pg, 'layout-tablet-portrait-auto');
  await set(pg, 'neon', 'tablet'); await shoot(pg, 'layout-tablet-portrait-neon'); await ctx.close();
  ({ pg, ctx } = await open(PHONE)); await set(pg, 'light', 'phone'); await shoot(pg, 'layout-phone-auto-light');
  await set(pg, 'minimal', 'tablet'); await shoot(pg, 'layout-forced-tablet-on-phone'); await ctx.close();
} finally {
  const real = errors.filter((e) => !/favicon|sw\.js/i.test(e));
  console.log(JSON.stringify({ results, errors: real.slice(0, 8) }, null, 2));
  fs.writeFileSync(`${SHOTS}/themes-share-results.json`, JSON.stringify({ at: new Date().toISOString(), results, errors: real }, null, 2));
  await browser.close(); prev.kill();
}
