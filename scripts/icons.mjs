// Renders the Keystone S app icon (branding/02-keystone-s.svg geometry) to PNGs with headless Chrome.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const svg = (rx, scale = 1) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<rect width="1024" height="1024" rx="${rx}" fill="#0B0B0F"/>
<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
<path d="M332 232 H692 L612 792 H412 Z" fill="none" stroke="#C9A227" stroke-width="28"/>
<text x="512" y="640" text-anchor="middle" font-family="Georgia,'Noto Serif',serif" font-size="380" fill="#F2EEE6">S</text>
<circle cx="512" cy="720" r="22" fill="#FF6A13"/></g></svg>`;
const out = 'public/icons';
const jobs = [
  ['icon-512.png', 512, svg(0)], ['icon-192.png', 192, svg(0)], ['apple-touch-icon.png', 180, svg(0)], ['favicon-32.png', 32, svg(160, 1.1)],
  ['icon-maskable-512.png', 512, svg(0, 0.72)], // essential art inside the 66/108 safe zone
];
const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
for (const [name, size, s] of jobs) {
  await p.setViewport({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${s.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body></html>`);
  await p.screenshot({ path: `${out}/${name}`, omitBackground: true });
}
fs.writeFileSync(`${out}/keystone-s.svg`, svg(200));
await b.close();
console.log('icons written to', out);
