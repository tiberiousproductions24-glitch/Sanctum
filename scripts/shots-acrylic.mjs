// Screenshots of the Acrylic Kit pad skin × layouts/themes + mid-hit.
//   npm run build && node scripts/shots-acrylic.mjs
import puppeteer from 'puppeteer-core';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
const mint = (...a) => execFileSync('node', ['scripts/license.mjs', 'mint', '--nolog', ...a]).toString().trim();
const CODE = mint('--type', 'invite', '--days', '30', '--name', 'Acrylic Shots');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const PORT = 4181; const BASE = `http://localhost:${PORT}/`; const SHOTS = 'screenshots';
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prev = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 75; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const TAB_L = { width: 1180, height: 820, deviceScaleFactor: 1, isMobile: true, hasTouch: true };

async function open(vp) {
  const ctx = await browser.createBrowserContext(); const pg = await ctx.newPage(); await pg.setViewport(vp);
  await pg.goto(BASE, { waitUntil: 'networkidle0' });
  await pg.evaluate(() => new Promise((r) => { localStorage.clear(); const q = indexedDB.deleteDatabase('sanctum-license'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
  await pg.goto(BASE + '?code=' + encodeURIComponent(CODE), { waitUntil: 'networkidle0' });
  await pg.waitForSelector('.overlay.lock[data-screen="welcome"]', { timeout: 8000 }).catch(() => {});
  await pg.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => b.textContent === 'Open Sanctum')?.click());
  await pg.waitForFunction(() => window.__sanctum?.app, { timeout: 10000 });
  await pg.evaluate(() => document.querySelector('.overlay.start')?.click());
  await pg.waitForFunction(() => window.__sanctum.app.started, { timeout: 10000 });
  return { pg, ctx };
}
const set = (pg, theme, layout, skin = 'acrylic') => pg.evaluate((t, l, s) => {
  const a = window.__sanctum.app;
  a.p.theme = t; a.p.settings.deviceClass = l; a.p.settings.padSkin = s;
  a.save(); a.emit('theme'); a.emit('layout'); a.emit('select');
}, theme, layout, skin);
const shoot = async (pg, name) => {
  await sleep(400);
  await pg.evaluate(() => document.querySelectorAll('.toast').forEach((t) => (t.style.display = 'none')));
  await pg.screenshot({ path: `${SHOTS}/${name}.png` });
  console.log('saved', `${SHOTS}/${name}.png`);
};
const hitSnare = async (pg) => {
  await pg.evaluate(() => {
    const view = window.__sanctum.view;
    const pad = view.pads[2];
    const r = pad.getBoundingClientRect();
    view.flash(2, 110, r.width * 0.45, r.height * 0.4);
    pad.classList.add('down');
  });
  await sleep(90);
};

try {
  let { pg, ctx } = await open(PHONE);
  for (const t of ['dark', 'neon', 'warm', 'contrast', 'light']) {
    await set(pg, t, 'phone', 'acrylic');
    await shoot(pg, `skin-acrylic-phone-${t}`);
  }
  await set(pg, 'dark', 'phone', 'acrylic');
  await hitSnare(pg);
  await shoot(pg, 'skin-acrylic-phone-dark-hit');
  await pg.evaluate(() => window.__sanctum.view.pads[2].classList.remove('down'));
  await set(pg, 'dark', 'phone', 'hardware');
  await shoot(pg, 'skin-hardware-phone-dark');
  await ctx.close();

  ({ pg, ctx } = await open(TAB_L));
  for (const t of ['dark', 'neon', 'light']) {
    await set(pg, t, 'tablet', 'acrylic');
    await shoot(pg, `skin-acrylic-tablet-${t}`);
  }
  await set(pg, 'neon', 'tablet', 'acrylic');
  await hitSnare(pg);
  await shoot(pg, 'skin-acrylic-tablet-neon-hit');
  await ctx.close();
} finally {
  await browser.close(); prev.kill('SIGTERM');
}
