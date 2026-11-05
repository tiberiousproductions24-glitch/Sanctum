import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
const mint = (...a) => execFileSync('node', ['scripts/license.mjs', 'mint', '--nolog', ...a]).toString().trim();
const CHROME = '/usr/bin/google-chrome';
const PORT = 4177; const BASE = `http://localhost:${PORT}/`;
const procs = [];
const run = (cmd, args) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); procs.push(p); return p; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitHttp(url, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if ((await fetch(url)).ok) return true; } catch {} await sleep(200); } return false; }
// kill anything on 4177
try { execFileSync('bash', ['-lc', 'fuser -k 4177/tcp || true']); } catch {}
await sleep(300);
run('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort']);
if (!(await waitHttp(BASE))) { console.error('no preview'); process.exit(1); }
const inv = mint('--type', 'invite', '--days', '30', '--name', 'Shot');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => new Promise((r) => { localStorage.clear(); const q = indexedDB.deleteDatabase('sanctum-license'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
await page.goto(BASE + '?code=' + encodeURIComponent(inv), { waitUntil: 'networkidle0' });
await sleep(800);
// dismiss welcome if present
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /continue|start|enter|ok/i.test(x.textContent || '')); b?.click(); });
await sleep(400);
await page.waitForFunction(() => window.__sanctum?.app, { timeout: 12000 });
await page.touchscreen.tap(590, 574);
await page.waitForFunction(() => window.__sanctum.app.started, { timeout: 12000 });
for (const theme of ['neon', 'warm']) {
  await page.evaluate((theme) => { const a = window.__sanctum.app; a.p.theme = theme; a.emit('theme'); if (!document.getElementById('sanctum-pulpit')) window.__sanctum.view.openPulpit(); }, theme);
  await sleep(400);
  await page.evaluate(() => window.__sanctum.app.pulpit.player.easyPlay());
  await sleep(250);
  await page.screenshot({ path: `screenshots/tablet-landscape-${theme}-pulpit.png` });
  console.log('wrote tablet-landscape-' + theme + '-pulpit.png');
}
await browser.close(); for (const p of procs) try { p.kill('SIGTERM'); } catch {}
process.exit(0);
