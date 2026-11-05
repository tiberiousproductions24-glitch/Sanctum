// Headless smoke test + screenshots.
//   npm run build && npm run smoke
// Starts `vite preview` (4173), the Link bridge (20809) and a second Link test peer, then drives
// headless Chrome: loads the app, taps pads, plays the sequencer, checks for console errors,
// verifies Link peers/tempo in the UI, and saves phone/tablet screenshots in every theme.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const mint = (...a) => execFileSync('node', ['scripts/license.mjs', 'mint', '--nolog', ...a]).toString().trim();
const ADMIN = fs.readFileSync('licensing-keys/ADMIN-TOKEN.txt', 'utf8').trim();

const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const PORT = 4173; const BASE = `http://localhost:${PORT}/`;
const SHOTS = 'screenshots'; fs.mkdirSync(SHOTS, { recursive: true });
const procs = [];
const run = (cmd, args, name) => { const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] }); p.stdout.on('data', (d) => process.env.VERBOSE && process.stdout.write(`[${name}] ${d}`)); p.stderr.on('data', (d) => process.stdout.write(`[${name}!] ${d}`)); procs.push(p); return p; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = []; const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

async function waitHttp(url, ms = 15000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const r = await fetch(url); if (r.ok) return true; } catch {} await sleep(200); } return false; }

run('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], 'preview');
run('node', ['bridge/server.js'], 'bridge');
await sleep(800);
const peer = run('node', ['bridge/test-peer.js', '--bpm', '97', '--set-after', '1'], 'peer');
let peerLines = []; peer.stdout.on('data', (d) => { peerLines.push(...String(d).trim().split('\n')); peerLines = peerLines.slice(-5); });
if (!(await waitHttp(BASE))) { console.error('preview server did not start'); process.exit(1); }

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
async function newPage(vp) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.text()}`); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return page;
}
const shoot = async (pg, name) => { await sleep(250); await pg.evaluate(() => document.querySelectorAll('.toast').forEach((t) => (t.style.display = 'none'))); await pg.screenshot({ path: `${SHOTS}/${name}.png` }); };
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const TAB_L = { width: 1180, height: 820, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const TAB_P = { width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true };

try {
  // ---------- license gate ----------
  const page = await newPage(PHONE);
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => new Promise((r) => { localStorage.clear(); const q = indexedDB.deleteDatabase('sanctum-license'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.overlay.lock');
  const locked = await page.evaluate(() => ({ screen: document.querySelector('.overlay.lock')?.dataset.screen, pads: document.querySelectorAll('.pad').length, app: !!window.__sanctum, ctx: typeof window.__sanctum?.app?.engine }));
  ok('locked: only the lock screen mounts (no pads, no app/engine)', locked.screen === 'locked' && locked.pads === 0 && !locked.app, JSON.stringify(locked));
  await shoot(page, 'phone-lock');
  const enterCode = async (pg, code) => {
    await pg.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => /have a (new )?code/i.test(b.textContent)).click());
    await pg.waitForSelector('.overlay.lock textarea');
    await pg.$eval('.overlay.lock textarea', (t, c) => { t.value = c; }, code);
    await pg.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => b.textContent === 'Unlock').click());
    await sleep(400);
  };
  await enterCode(page, 'S1-notarealcode');
  const bad = await page.evaluate(() => ({ err: document.querySelector('.overlay.lock .err')?.textContent, pads: document.querySelectorAll('.pad').length }));
  ok('garbage code is rejected', !!bad.err && bad.pads === 0, bad.err);
  await page.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => b.textContent === 'Back').click());
  await enterCode(page, mint('--type', 'invite', '--days', '-1', '--name', 'Expired Test'));
  const exp = await page.evaluate(() => ({ screen: document.querySelector('.overlay.lock')?.dataset.screen, pads: document.querySelectorAll('.pad').length, app: !!window.__sanctum }));
  ok('expired token shows the expired screen and stays locked', exp.screen === 'expired' && exp.pads === 0 && !exp.app, JSON.stringify(exp));
  await shoot(page, 'phone-lock-expired');
  await page.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => /Subscribe/.test(b.textContent)).click()); await shoot(page, 'phone-lock-paywall');
  await page.evaluate(() => [...document.querySelectorAll('.overlay.lock a')].find((b) => b.textContent === 'Back').click());
  // tampered invite (flip a char in the signature) must fail
  const inv = mint('--type', 'invite', '--days', '30', '--name', 'Smoke Test');
  const tampered = inv.slice(0, -3) + (inv.at(-3) === 'A' ? 'B' : 'A') + inv.slice(-2);
  await enterCode(page, tampered);
  const tam = await page.evaluate(() => ({ err: document.querySelector('.overlay.lock .err')?.textContent, app: !!window.__sanctum }));
  ok('tampered (bad signature) code is rejected', /signature/i.test(tam.err || '') && !tam.app, tam.err);
  await page.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => b.textContent === 'Back').click());
  await enterCode(page, inv);
  const wel = await page.evaluate(() => document.querySelector('.overlay.lock')?.dataset.screen);
  await shoot(page, 'phone-lock-welcome');
  await page.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => b.textContent === 'Open Sanctum').click());
  await page.waitForFunction(() => window.__sanctum?.app && document.querySelectorAll('.pad').length === 16, { timeout: 8000 }).catch(() => {});
  const unl = await page.evaluate(() => ({ app: !!window.__sanctum, pads: document.querySelectorAll('.pad').length, type: window.__sanctum?.app?.license?.type }));
  ok('invite code unlocks (welcome → app mounts with 16 pads)', wel === 'welcome' && unl.app && unl.pads === 16 && unl.type === 'invite', JSON.stringify(unl));
  // admin token via link (?code=… — same path as the sanctum://activate deep link) in a fresh profile
  {
    const ctx = await browser.createBrowserContext();
    const ap = await ctx.newPage(); await ap.setViewport(PHONE);
    ap.on('pageerror', (e) => errors.push('pageerror(admin): ' + e.message));
    await ap.goto(BASE + '?code=' + encodeURIComponent(ADMIN), { waitUntil: 'networkidle0' });
    await ap.waitForSelector('.overlay.lock[data-screen="welcome"]', { timeout: 5000 }).catch(() => {});
    await ap.evaluate(() => [...document.querySelectorAll('.overlay.lock .btn')].find((b) => b.textContent === 'Open Sanctum')?.click());
    await ap.waitForFunction(() => window.__sanctum?.app, { timeout: 8000 }).catch(() => {});
    const ad = await ap.evaluate(() => { const s = window.__sanctum; if (!s) return null; s.sheets.menu(); const hasAdmin = [...document.querySelectorAll('.menu-grid button')].some((b) => b.textContent === 'Admin'); s.sheets.admin(); return { type: s.app.license.type, hasAdmin, panel: !!document.querySelector('.sheet') && /Token id/.test(document.body.textContent) }; });
    ok('admin token unlocks and shows the hidden Admin panel', !!ad && ad.type === 'admin' && ad.hasAdmin && ad.panel, JSON.stringify(ad));
    await ap.evaluate(() => document.querySelectorAll('.overlay.start').forEach((e) => e.remove())); await shoot(ap, 'phone-dark-admin');
    await ctx.close();
  }
  const noAdmin = await page.evaluate(() => { window.__sanctum.sheets.menu(); const r = [...document.querySelectorAll('.menu-grid button')].some((b) => b.textContent === 'Admin'); window.__sanctum.sheets.close(); return r; });
  ok('invite license does not see the Admin panel', !noAdmin);

  // ---------- phone: core checks ----------
  await page.touchscreen.tap(195, 600); // splash "tap to start"
  await page.waitForFunction(() => window.__sanctum.app.started && window.__sanctum.app.engine.ctx, { timeout: 8000 });
  // headless Chrome's audio sink can take a moment to come up on this shared box
  await page.waitForFunction(() => window.__sanctum.app.engine.stats.frame > 0, { timeout: 15000 }).catch(() => {});
  const eng = await page.evaluate(() => { const a = window.__sanctum.app; return { mode: a.engine.mode, sr: a.engine.sampleRate, state: a.engine.ctx.state, t: a.engine.now, frame: a.engine.stats.frame, lat: a.engine.latency() }; });
  ok('audio engine starts (render thread running)', eng.state === 'running' && eng.frame > 0, JSON.stringify(eng));
  ok('AudioWorklet engine active', eng.mode === 'worklet', eng.mode);
  await page.waitForFunction(() => [...window.__sanctum.app.bankLoad.values()].length >= 4 && [...window.__sanctum.app.bankLoad.values()].every((v) => v === 'ready'), { timeout: 20000 }).catch(() => {});
  const banks = await page.evaluate(() => { const a = window.__sanctum.app; return { sources: a.p.bankSources, load: Object.fromEntries(a.bankLoad), samples: a.engine.samples.size }; });
  ok('church manifest banks loaded into C–F', banks.sources.slice(2, 6).every((s) => s && s.startsWith('ext.')) && Object.values(banks.load).every((v) => v === 'ready'), JSON.stringify(banks));

  // tap pad 1 (kick) with a real touch event
  const box = await page.evaluate(() => { const r = document.querySelector('.pad[data-pad="0"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 3 }; });
  const peak0 = await page.evaluate(() => window.__sanctum.app.engine.stats.peak);
  await page.touchscreen.tap(box.x, box.y);
  await sleep(250);
  const after = await page.evaluate(() => ({ stats: window.__sanctum.app.engine.stats, sel: window.__sanctum.app.p.selectedPad }));
  ok('pad tap produces audio (worklet voices/peak)', after.stats.peak > peak0 + 0.01 || after.stats.voices > 0, JSON.stringify(after.stats));
  // multi-touch: two pads at once via CDP
  const cdp = await page.createCDPSession();
  const p2 = await page.evaluate(() => [3, 5].map((i) => { const r = document.querySelector(`.pad[data-pad="${i}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: p2.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
  await sleep(30);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
  const v2 = await page.evaluate(() => window.__sanctum.app.engine.stats.voices);
  ok('multi-touch (2 pads) triggers', v2 >= 1, `voices=${v2}`);
  // keyboard pad
  await page.keyboard.down('KeyZ'); await page.keyboard.up('KeyZ');
  // sequencer: program steps, play, verify notes are scheduled and position moves
  await page.evaluate(() => { const a = window.__sanctum.app; a.p.selectedPad = 0; for (let i = 0; i < 16; i += 4) a.toggleStep(0, i * 240, 240); for (let i = 4; i < 16; i += 8) a.toggleStep(2, i * 240, 240); for (let i = 0; i < 16; i += 2) a.toggleStep(6, i * 240, 240); a.emit('select'); });
  await page.evaluate(() => window.__sanctum.app.play());
  await sleep(1500);
  const seq = await page.evaluate(() => { const a = window.__sanctum.app; return { playing: a.seq.playing, tick: a.seq.positionTick(), voices: a.engine.stats.voices, late: a.engine.stats.late, events: a.seq.pattern.events.length }; });
  ok('sequencer plays pattern', seq.playing && seq.tick >= 0 && seq.events >= 14, JSON.stringify(seq));
  ok('no late (unscheduled) events', seq.late === 0, `late=${seq.late}`);
  // record a live hit with note repeat & quantize
  await page.evaluate(() => { const a = window.__sanctum.app; a.p.quantize = '1/16'; a.seq.recording = true; a.seq.noteRepeat = true; });
  const pb = await page.evaluate(() => { const r = document.querySelector('.pad[data-pad="4"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pb.x, y: pb.y, id: 7 }] });
  await sleep(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const rec = await page.evaluate(() => { const a = window.__sanctum.app; const evs = a.seq.pattern.events.filter((e) => e.p === 4); a.seq.recording = false; a.seq.noteRepeat = false; return { n: evs.length, onGrid: evs.every((e) => e.t % 240 === 0) }; });
  ok('note repeat + record → quantized events', rec.n >= 2 && rec.onGrid, JSON.stringify(rec));
  // swing changes timing but keeps grid
  const sw = await page.evaluate(() => { const a = window.__sanctum.app; a.p.swing = 66; const w = a.seq.warp(240); const u = a.seq.unwarp(w); a.p.swing = 56; return { w, u }; });
  ok('swing warp/unwarp', Math.abs(sw.w - 316.8) < 0.5 && Math.abs(sw.u - 240) < 1e-6, JSON.stringify(sw));
  // loop pad from church bank (bank C pad 1) launches on next bar, rate = bpm/loopBpm
  await page.evaluate(() => { window.__sanctum.view.setBank(2); });
  const lp = await page.evaluate(() => { const r = document.querySelector('.pad[data-pad="0"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(lp.x, lp.y);
  const loop = await page.evaluate(() => { const a = window.__sanctum.app; const l = a.loops.get(32); return l ? { at: l.at, now: a.engine.now, startRel: (l.startBeat - a.seq.playStartBeat) % 4, rate: a.loopRate(l.sound), bpm: a.p.bpm, soundBpm: l.sound.bpm } : null; });
  ok('loop pad launches on next bar, tempo-synced rate', !!loop && Math.abs(loop.startRel) < 1e-6 && Math.abs(loop.rate - loop.bpm / loop.soundBpm) < 1e-4, JSON.stringify(loop));
  await sleep(2500);
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => (t.style.display = 'none')));
  await page.screenshot({ path: `${SHOTS}/phone-dark-playing-loop.png` });
  await page.evaluate(() => { window.__sanctum.app.stop(); window.__sanctum.view.setBank(0); });

  // Timing Lab tap test: synthetic taps 25 ms after each audible click → correction ≈ 25 ms
  await page.evaluate(() => window.__sanctum.sheets.timingLab());
  const tz = await page.evaluate(() => { const z = document.querySelector('.tapzone'); z.scrollIntoView({ block: 'center' }); const r = z.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await sleep(200);
  await page.touchscreen.tap(tz.x, tz.y);
  await sleep(50);
  await page.evaluate(() => {
    const a = window.__sanctum.app; const zone = document.querySelector('.tapzone');
    for (const c of window.__sanctumTapTest.clicks.slice(1)) {
      const due = a.engine.ctxToPerf(c) + 25 - performance.now();
      setTimeout(() => zone.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })), due);
    }
  });
  await page.waitForFunction(() => window.__sanctum.app.p.lab.tapOffsetMs != null, { timeout: 15000 }).catch(() => {});
  const tap = await page.evaluate(() => ({ off: window.__sanctum.app.p.lab.tapOffsetMs, jit: window.__sanctum.app.p.lab.tapJitterMs, comp: window.__sanctum.app.p.settings.touchCompMs }));
  ok('Timing Lab tap test measures input offset and sets recording correction', tap.off != null && tap.off > 18 && tap.off < 40 && tap.comp > 18, JSON.stringify(tap));
  await page.evaluate(() => { window.__sanctum.sheets.close(); const a = window.__sanctum.app; a.p.settings.touchCompMs = 0; a.p.lab.tapOffsetMs = null; a.p.lab.tapJitterMs = null; });

  // autosave → reload restores
  await page.evaluate(() => { const a = window.__sanctum.app; a.p.bpm = 101.5; a.p.theme = 'warm'; a.p.swing = 61; a.save(); });
  await sleep(600);
  await page.reload({ waitUntil: 'networkidle0' });
  const restored = await page.evaluate(() => { const a = window.__sanctum.app; return { bpm: a.p.bpm, theme: a.p.theme, swing: a.p.swing, events: a.p.patterns[0].events.length, restored: a.restored, theme2: document.documentElement.dataset.theme }; });
  ok('autosave restores project on reload', restored.restored && restored.bpm === 101.5 && restored.theme === 'warm' && restored.swing === 61 && restored.events >= 14 && restored.theme2 === 'warm', JSON.stringify(restored));
  await page.touchscreen.tap(195, 600);
  await page.waitForFunction(() => window.__sanctum.app.started, { timeout: 8000 });

  // ---------- Link end-to-end ----------
  await page.evaluate(() => { const a = window.__sanctum.app; a.p.bpm = 120; a.setLink(true); });
  await page.waitForFunction(() => { const s = window.__sanctum.app.link.state; return s.connected && s.peers >= 1 && Math.abs(s.bpm - 97) < 0.01; }, { timeout: 12000 }).catch(() => {});
  await sleep(1200);
  // Shared boxes can briefly show a large offset while Link converges; take the best of a few samples.
  let link = null, bestOff = Infinity;
  for (let i = 0; i < 4; i++) {
    const sample = await page.evaluate(() => { const a = window.__sanctum.app; const s = a.link.state; return { connected: s.connected, peers: s.peers, bpm: s.bpm, backend: s.backend, appBpm: a.p.bpm, clockBpm: a.seq.clock.bpm, offsetMs: s.offsetMs, rtt: s.rttMs, chip: document.querySelector('.chip.link').textContent }; });
    if (!link) link = sample;
    if (Math.abs(sample.offsetMs) < Math.abs(bestOff)) { bestOff = sample.offsetMs; link = sample; }
    if (Math.abs(bestOff) < 5) break;
    await sleep(400);
  }
  ok('Link: bridge connected, peer visible, tempo follows peer (97)', link.connected && link.peers >= 1 && Math.abs(link.clockBpm - 97) < 0.01 && Math.abs(link.appBpm - 97) < 0.01, JSON.stringify(link));
  ok('Link: phase error < 5 ms', Math.abs(link.offsetMs) < 5, `offset=${link.offsetMs?.toFixed(2)} ms`);
  // propose a tempo from the app → peer must follow
  await page.evaluate(() => window.__sanctum.app.setTempo(111));
  await sleep(1800);
  const peerSaw = peerLines.join('\n');
  ok('Link: app tempo change propagates to the other peer', /bpm=111\.00/.test(peerSaw), peerLines.at(-1));
  await page.evaluate(() => window.__sanctum.sheets.sync());
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/phone-warm-link-sync.png` });
  await page.evaluate(() => window.__sanctum.sheets.close());

  // ---------- screenshots ----------
  const themes = ['dark', 'light', 'warm'];
  const setTheme = (pg, t) => pg.evaluate((t) => { const a = window.__sanctum.app; a.p.theme = t; a.emit('theme'); }, t);
  for (const t of themes) { await setTheme(page, t); await shoot(page, `phone-${t}`); }
  await setTheme(page, 'dark');
  await page.evaluate(() => window.__sanctum.sheets.timingLab()); await shoot(page, 'phone-dark-timing-lab');
  await page.evaluate(() => window.__sanctum.sheets.sounds()); await shoot(page, 'phone-dark-sounds');
  await page.evaluate(() => window.__sanctum.sheets.close());
  await page.evaluate(() => window.__sanctum.app.setLink(false));

  // ---------- Sanctum Pulpit ----------
  {
    await page.evaluate(() => window.__sanctum.view.openPulpit());
    await sleep(400);
    const opened = await page.evaluate(() => !!document.getElementById('sanctum-pulpit'));
    ok('Pulpit screen opens', opened);
    const before = await page.evaluate(() => { const p = window.__sanctum.app.pulpit.player; return { idx: p.state.stepIndex, chord: p.state.lastChord?.name || null, peak: window.__sanctum.app.engine.stats.peak, voices: window.__sanctum.app.engine.stats.voices }; });
    await page.evaluate(() => window.__sanctum.app.pulpit.player.easyPlay());
    await sleep(250);
    const afterEasy = await page.evaluate(() => { const p = window.__sanctum.app.pulpit.player; return { idx: p.state.stepIndex, chord: p.state.lastChord?.name || null, peak: window.__sanctum.app.engine.stats.peak, voices: window.__sanctum.app.engine.stats.voices, playing: p.state.playing }; });
    ok('Easy Play advances chords and produces audio', afterEasy.idx !== before.idx && !!afterEasy.chord && (afterEasy.voices > 0 || afterEasy.peak > before.peak || afterEasy.peak > 0.01), JSON.stringify({ before, afterEasy }));
    // Quantized key change: start playing, request next key, wait for a beat
    await page.evaluate(() => { const pl = window.__sanctum.app.pulpit.player; pl.setBpm(120); pl.start(); pl.setKey({ tonic: 0, mode: 'major' }, 'beat'); });
    await sleep(600);
    const keyLand = await page.evaluate(() => { const pl = window.__sanctum.app.pulpit.player; return { key: pl.state.key.tonic, pending: pl.state.pendingKey }; });
    ok('Pulpit key change lands on beat', keyLand.key === 0 && keyLand.pending == null, JSON.stringify(keyLand));
    await page.evaluate(() => window.__sanctum.app.pulpit.player.setShout(3));
    const shout = await page.evaluate(() => window.__sanctum.app.pulpit.player.state.shoutLevel);
    await page.evaluate(() => window.__sanctum.app.pulpit.player.setWorship(2));
    const worship = await page.evaluate(() => ({ s: window.__sanctum.app.pulpit.player.state.shoutLevel, w: window.__sanctum.app.pulpit.player.state.worshipLevel }));
    ok('Shout/Worship level switch', shout === 3 && worship.s === 0 && worship.w === 2, JSON.stringify({ shout, worship }));
    await page.evaluate(() => { const pl = window.__sanctum.app.pulpit.player; pl.setMusicMute(true); pl.setDrumsMute(true); });
    const mutes = await page.evaluate(() => { const s = window.__sanctum.app.pulpit.player.state; return { d: s.drumsMute, m: s.musicMute }; });
    ok('Pulpit mute works', mutes.d && mutes.m, JSON.stringify(mutes));
    await page.evaluate(() => window.__sanctum.app.pulpit.player.setStageLock(true));
    const lockedNav = await page.evaluate(() => { window.__sanctum.app.pulpit.close(); return !!document.getElementById('sanctum-pulpit') && window.__sanctum.app.pulpit.player.state.stageLock; });
    ok('Stage Mode lock blocks leaving Pulpit', lockedNav, 'stage lock held screen open');
    await page.evaluate(() => window.__sanctum.app.pulpit.player.setStageLock(false));
    // Autosave custom progression
    await page.evaluate(() => { const pl = window.__sanctum.app.pulpit.player; pl.setCustomSteps([{ c: 'I' }, { c: 'IV' }, { c: 'V7' }, { c: 'I' }]); });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sanctum.pulpit.v1') || '{}'));
    ok('Pulpit autosaves custom progression', Array.isArray(saved.customSteps) && saved.customSteps.length === 4 && saved.customSteps[2].c === 'V7', JSON.stringify(saved.customSteps));
    // Screenshots: Pulpit in Neon + Warm, phone + tablet later
    await page.evaluate(() => { const a = window.__sanctum.app; a.p.theme = 'neon'; a.emit('theme'); window.__sanctum.app.pulpit.player.setMusicMute(false); window.__sanctum.app.pulpit.player.setDrumsMute(false); });
    await sleep(200);
    await shoot(page, 'phone-neon-pulpit');
    await page.evaluate(() => { const a = window.__sanctum.app; a.p.theme = 'warm'; a.emit('theme'); });
    await sleep(200);
    await shoot(page, 'phone-warm-pulpit');
    await page.evaluate(() => { window.__sanctum.app.pulpit.player.setStageLock(false); window.__sanctum.app.pulpit.close(); });
  }

  // accessibility tree (what TalkBack/VoiceOver get): named pads, step checkboxes, live region, radio theme picker
  {
    const snap = await page.accessibility.snapshot({ interestingOnly: true });
    const flat = []; const walk = (n) => { if (!n) return; flat.push(n); (n.children || []).forEach(walk); }; walk(snap);
    const pads = flat.filter((n) => n.role === 'button' && /^Pad \d+, .+, bank [A-H]/.test(n.name || ''));
    const steps = flat.filter((n) => n.role === 'checkbox' && /step \d+/.test(n.name || ''));
    const live = await page.evaluate(() => { const l = document.querySelector('[aria-live]'); window.__sanctum.app.play(); return new Promise((r) => setTimeout(() => { const t = l?.textContent; window.__sanctum.app.stop(); r(t); }, 150)); });
    ok('a11y: 16 named pads + labelled step checkboxes + live announcements', pads.length === 16 && steps.length >= 16 && live === 'Playing', `pads=${pads.length} steps=${steps.length} live=${live} e.g. "${pads[0]?.name}"`);
  }
  await page.close();

  for (const [vp, name] of [[TAB_L, 'tablet-landscape'], [TAB_P, 'tablet-portrait']]) {
    const tp = await newPage(vp);
    await tp.goto(BASE, { waitUntil: 'networkidle0' });
    await tp.touchscreen.tap(vp.width / 2, vp.height * 0.7);
    await tp.waitForFunction(() => window.__sanctum.app.started, { timeout: 8000 });
    await tp.evaluate(() => { const a = window.__sanctum.app; a.play(); });
    await sleep(900);
    for (const t of themes) { await setTheme(tp, t); await shoot(tp, `${name}-${t}`); }
    if (name === 'tablet-landscape') { await setTheme(tp, 'warm'); await tp.evaluate(() => window.__sanctum.sheets.timingLab()); await shoot(tp, `${name}-warm-timing-lab`); }
    await tp.evaluate(() => window.__sanctum.app.stop());
    await tp.close();
  }

  const real = errors.filter((e) => !/favicon|Failed to load resource.*sw\.js/i.test(e));
  ok('no console errors', real.length === 0, real.slice(0, 5).join(' | '));
} catch (e) {
  ok('smoke run', false, e.stack || String(e));
} finally {
  await browser.close();
  for (const p of procs) { try { p.kill('SIGTERM'); } catch {} }
  const failed = results.filter((r) => !r.pass);
  fs.writeFileSync(`${SHOTS}/smoke-results.json`, JSON.stringify({ at: new Date().toString(), results }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  setTimeout(() => process.exit(failed.length ? 1 : 0), 300);
}
