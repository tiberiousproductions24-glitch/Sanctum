// Renders the Android icon + splash sources into assets/ (for `npx capacitor-assets generate --android`).
// Keystone S app icon (gold keystone, serif S, orange keystone dot) on the Neon/Dark chassis; splash = Arch Pad mark.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
fs.mkdirSync('assets', { recursive: true });
const BG = '#07070C';
const glowBg = (s) => `<defs><radialGradient id="g" cx="50%" cy="100%" r="80%"><stop offset="0" stop-color="#FF2D95" stop-opacity=".38"/><stop offset=".6" stop-color="#FF2D95" stop-opacity="0"/></radialGradient>
<radialGradient id="c" cx="50%" cy="0%" r="70%"><stop offset="0" stop-color="#19E3FF" stop-opacity=".22"/><stop offset=".7" stop-color="#19E3FF" stop-opacity="0"/></radialGradient></defs>
<rect width="${s}" height="${s}" fill="${BG}"/><rect width="${s}" height="${s}" fill="url(#g)"/><rect width="${s}" height="${s}" fill="url(#c)"/>`;
const keystone = (scale) => `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
<path d="M332 232 H692 L612 792 H412 Z" fill="none" stroke="#E8B931" stroke-width="30" stroke-linejoin="round" style="filter:drop-shadow(0 0 18px rgba(232,185,49,.6))"/>
<text x="512" y="640" text-anchor="middle" font-family="Georgia,'Noto Serif',serif" font-size="380" fill="#F7F1E3">S</text>
<circle cx="512" cy="720" r="24" fill="#FF2D95" style="filter:drop-shadow(0 0 14px #FF2D95)"/></g>`;
const svg = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`;
const arch = `<g transform="translate(15,20)">
  <path d="M0 160 V60 A80 80 0 0 1 160 60 V160 Z" fill="none" stroke="#E8B931" stroke-width="8" style="filter:drop-shadow(0 0 6px rgba(232,185,49,.7))"/>
  <g fill="#F4F1EA"><rect x="16" y="70" width="28" height="28" rx="5"/><rect x="52" y="70" width="28" height="28" rx="5"/><rect x="88" y="70" width="28" height="28" rx="5"/><rect x="124" y="70" width="20" height="28" rx="5"/>
   <rect x="16" y="110" width="28" height="28" rx="5"/><rect x="52" y="110" width="28" height="28" rx="5" fill="#FF2D95" style="filter:drop-shadow(0 0 6px #FF2D95)"/><rect x="88" y="110" width="28" height="28" rx="5"/><rect x="124" y="110" width="20" height="28" rx="5"/>
   <rect x="56" y="30" width="48" height="28" rx="14"/></g></g>`;
const splash = (S) => svg(S, S, `${glowBg(S)}<g transform="translate(${S / 2 - 285} ${S / 2 - 380}) scale(3)">${arch}</g>
<text x="${S / 2}" y="${S / 2 + 300}" text-anchor="middle" font-family="Georgia,'Noto Serif',serif" font-size="120" letter-spacing="40" fill="#F7E7B0" style="filter:drop-shadow(0 0 16px rgba(232,185,49,.55))">SANCTUM</text>`);
const jobs = [
  ['assets/icon-only.png', 1024, svg(1024, 1024, glowBg(1024) + keystone(1))],
  ['assets/icon-foreground.png', 1024, svg(1024, 1024, keystone(1.1))],  // adaptive: capacitor-assets insets 16.7%, keeps art in the safe zone
  ['assets/icon-background.png', 1024, svg(1024, 1024, glowBg(1024))],
  ['assets/splash.png', 2732, splash(2732)],
  ['assets/splash-dark.png', 2732, splash(2732)],
];
const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
for (const [name, size, s] of jobs) {
  await p.setViewport({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await p.screenshot({ path: name, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await b.close();
console.log('wrote', jobs.map((j) => j[0]).join(', '));
