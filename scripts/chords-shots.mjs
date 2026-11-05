// Headless screenshots of Chords UI → screenshots/chords-*.png
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const mint = (...a) => execFileSync('node', ['scripts/license.mjs', 'mint', '--nolog', ...a]).toString().trim();
const CHROME = '/usr/bin/google-chrome';
const PORT = 4188;
const BASE = `http://localhost:${PORT}/`;
const procs = [];
const run = (cmd, args) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); procs.push(p); return p; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitHttp(url, ms = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if ((await fetch(url)).ok) return true; } catch {} await sleep(200); }
  return false;
}
mkdirSync('screenshots', { recursive: true });
try { execFileSync('bash', ['-lc', `fuser -k ${PORT}/tcp || true`]); } catch {}
await sleep(300);
run('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort']);
if (!(await waitHttp(BASE))) { console.error('no preview'); process.exit(1); }

const inv = mint('--type', 'invite', '--days', '30', '--name', 'ChordsShot');
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => new Promise((r) => {
  localStorage.clear();
  const q = indexedDB.deleteDatabase('sanctum-license');
  q.onsuccess = q.onerror = q.onblocked = () => r();
}));
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.waitForSelector('.overlay.lock', { timeout: 10000 });

const enterCode = async (code) => {
  await page.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => /have a (new )?code/i.test(b.textContent || '')).click());
  await page.waitForSelector('.overlay.lock textarea');
  await page.$eval('.overlay.lock textarea', (t, c) => { t.value = c; }, code);
  await page.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => b.textContent === 'Unlock').click());
  await sleep(500);
};
await enterCode(inv);
await page.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => b.textContent === 'Open Sanctum')?.click());
await page.waitForFunction(() => window.__sanctum?.app && document.querySelectorAll('.pad').length === 16, { timeout: 12000 });

// Tap to start
await page.evaluate(async () => {
  const splash = document.querySelector('.overlay.start');
  if (splash) { splash.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  else await window.__sanctum.app.start();
});
await page.waitForFunction(() => window.__sanctum.app.started, { timeout: 12000 });
await sleep(400);

await page.evaluate(() => { window.__sanctum.sheets.close(); window.__sanctum.sheets.chords(); });
await page.waitForSelector('#sanctum-chords', { timeout: 8000 });

const seedLive = () => page.evaluate(() => {
  const c = window.__sanctum.sheets.chordsUI;
  c.state = {
    current: { label: 'Bbmaj7', root: 10, quality: 'maj7', bass: 10, confidence: 0.91, start: 0, end: 1, roman: 'Imaj7' },
    history: [
      { label: 'Cm7', root: 0, quality: 'm7', bass: 0, confidence: 0.8, start: 0, end: 1 },
      { label: 'F7', root: 5, quality: '7', bass: 5, confidence: 0.85, start: 0, end: 1 },
      { label: 'Bb', root: 10, quality: 'maj', bass: 10, confidence: 0.88, start: 0, end: 1 },
    ],
    key: { tonic: 10, mode: 'major', name: 'Bb', confidence: 0.82 },
    level: 0.12,
    nextLikely: [
      { label: 'Eb', roman: 'IV', p: 0.28 },
      { label: 'F', roman: 'V', p: 0.22 },
      { label: 'Gm', roman: 'vi', p: 0.18 },
    ],
  };
  c.tab = 'live';
  c.render();
});
await seedLive();
await sleep(300);
await page.screenshot({ path: 'screenshots/chords-live.png' });
console.log('wrote screenshots/chords-live.png');

await page.evaluate(() => {
  const c = window.__sanctum.sheets.chordsUI;
  c.tab = 'import';
  c.chart = {
    chords: [
      { label: 'C', root: 0, quality: 'maj', bass: 0, confidence: 0.9, start: 0, end: 2, roman: 'I' },
      { label: 'Am', root: 9, quality: 'min', bass: 9, confidence: 0.88, start: 2, end: 4, roman: 'vi' },
      { label: 'F', root: 5, quality: 'maj', bass: 5, confidence: 0.86, start: 4, end: 6, roman: 'IV' },
      { label: 'G7', root: 7, quality: '7', bass: 7, confidence: 0.92, start: 6, end: 8, roman: 'V7' },
    ],
    bpm: 100, key: { tonic: 0, mode: 'major', name: 'C', confidence: 0.9 }, duration: 8,
    source: { kind: 'file', title: 'demo-progression.wav' },
  };
  c.render();
});
await sleep(300);
await page.screenshot({ path: 'screenshots/chords-import-sources.png' });
console.log('wrote screenshots/chords-import-sources.png');
await page.screenshot({ path: 'screenshots/chords-chart.png' });
console.log('wrote screenshots/chords-chart.png');

await page.evaluate(() => {
  const c = window.__sanctum.sheets.chordsUI;
  c.tab = 'theory';
  c.render();
});
await sleep(300);
await page.screenshot({ path: 'screenshots/chords-theory.png' });
console.log('wrote screenshots/chords-theory.png');

await browser.close();
for (const p of procs) try { p.kill('SIGTERM'); } catch {}
process.exit(0);
