// Headless renders of Acrylic Kit style frames (phone + tablet, idle + mid-hit).
// Uses the same SVG instrument markup as the app (inlined here for offline render).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const OUT = __dirname;

// Import instrument SVG builders by evaluating the built approach: read TS source is awkward;
// instead embed a minimal HTML that loads the app's dist after build, OR inline copies.
// We inline a compact HTML document that mirrors acrylic tokens + SVGs for the three directions.

const instruments = ['kick','snare','tom','hat-closed','hat-open','crash','ride','cowbell','clap','rim','tambourine','shaker','bass808','fx','loop','organ'];

function padSvg(kind) {
  // simplified markers for frame grid — full art lives in the app; frames show direction lighting
  const common = {
    kick: `<circle class="shell" cx="50" cy="50" r="40"/><circle class="film" cx="50" cy="50" r="34"/><circle class="port" cx="50" cy="54" r="10"/><circle class="hoop" cx="50" cy="50" r="38" fill="none" stroke-width="3"/>`,
    snare: `<circle class="shell" cx="50" cy="50" r="36"/><circle class="film" cx="50" cy="50" r="30"/>${Array.from({length:8},(_,i)=>`<line class="wire" x1="26" y1="${32+i*4}" x2="74" y2="${32+i*4}"/>`).join('')}<circle class="hoop" cx="50" cy="50" r="34" fill="none" stroke-width="3"/>`,
    tom: `<circle class="shell" cx="50" cy="50" r="34"/><circle class="film" cx="50" cy="50" r="28"/><circle class="hoop" cx="50" cy="50" r="32" fill="none" stroke-width="3"/>`,
    'hat-closed': `<circle class="cym" cx="50" cy="52" r="32"/><circle class="cym" cx="50" cy="48" r="32"/><circle class="bell" cx="50" cy="48" r="7"/>`,
    'hat-open': `<circle class="cym" cx="50" cy="56" r="32"/><circle class="cym" cx="50" cy="42" r="32"/><circle class="bell" cx="50" cy="42" r="7"/>`,
    crash: `<circle class="cym" cx="50" cy="50" r="36"/><circle class="lathe" cx="50" cy="50" r="28" fill="none"/><circle class="bell" cx="50" cy="50" r="6"/>`,
    ride: `<circle class="cym" cx="50" cy="50" r="38"/><circle class="bell" cx="50" cy="50" r="11"/>`,
    cowbell: `<path class="metal" d="M30 30 L70 30 L64 78 L36 78 Z"/>`,
    clap: `<circle class="palm" cx="38" cy="52" r="14"/><circle class="palm" cx="62" cy="52" r="14"/>`,
    rim: `<circle class="hoop" cx="50" cy="50" r="32" fill="none" stroke-width="4"/><circle class="stick" cx="62" cy="38" r="4"/>`,
    tambourine: `<circle class="hoop" cx="50" cy="50" r="34" fill="none" stroke-width="5"/><circle class="film" cx="50" cy="50" r="20"/>`,
    shaker: `<ellipse class="film" cx="50" cy="50" rx="20" ry="32"/>`,
    bass808: `<circle class="shell" cx="50" cy="50" r="36"/><circle class="film" cx="50" cy="50" r="14"/><text x="50" y="54" text-anchor="middle" class="lab">808</text>`,
    fx: `<circle class="film" cx="50" cy="50" r="28"/><path class="bolt" d="M54 24 L42 52 L52 52 L48 76 L64 46 L52 46 Z"/>`,
    loop: `<circle class="hoop" cx="50" cy="50" r="28" fill="none" stroke-width="3"/><polygon points="50,18 56,28 44,28" class="metal"/>`,
    organ: `<rect class="metal" x="20" y="40" width="60" height="24" rx="2"/>`,
  };
  return `<svg viewBox="0 0 100 100" class="art">${common[kind]||common.tom}</svg>`;
}

const dirs = {
  'stage-glass': {
    bg: '#07070C', well: '#030306', film: 'rgba(190,215,240,.18)', shell: 'rgba(40,55,75,.5)',
    chrome: '#D8DEE8', brass: '#C4A35A', label: '#F4F1EA', rim: ['#FF6A13','#FF2D95','#9B5CFF','#19E3FF'],
    title: 'Stage Glass', subtitle: 'Clear · rim-lit · dark stage',
  },
  'smoked-acrylic': {
    bg: '#05030C', well: '#000', film: 'rgba(100,160,220,.12)', shell: 'rgba(20,10,40,.65)',
    chrome: '#B0B8D0', brass: '#A6FF00', label: '#E9FDFF', rim: ['#A6FF00','#00F0FF','#FF2BD6','#00F0FF'],
    title: 'Smoked Acrylic', subtitle: 'Tinted plexi · neon edge-glow',
  },
  'studio-daylight': {
    bg: '#E9E8E3', well: '#C4C2BA', film: 'rgba(255,255,255,.5)', shell: 'rgba(90,110,130,.22)',
    chrome: '#8A919C', brass: '#C4A35A', label: '#1A1A22', rim: ['#FF5A00','#F0157F','#7B3CFF','#00A6D6'],
    title: 'Studio Daylight', subtitle: 'Bright · realistic · softbox',
  },
};

function html(dirKey, layout, hit) {
  const d = dirs[dirKey];
  const w = layout === 'phone' ? 390 : 1180;
  const h = layout === 'phone' ? 844 : 820;
  const pads = instruments.map((inst, i) => {
    const row = Math.floor(i / 4);
    const rim = d.rim[row];
    const isHit = hit && i === 1; // snare mid-hit
    return `<div class="pad ${isHit?'hit':''}" style="--rim:${rim}">${padSvg(inst)}<span class="name">${inst.replace('-',' ').toUpperCase()}</span></div>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
html,body{margin:0;background:${d.bg};color:${d.label};font:600 12px system-ui;width:${w}px;height:${h}px;overflow:hidden}
.wrap{padding:${layout==='phone'?'48px 16px 24px':'40px 48px'};height:100%;box-sizing:border-box;display:flex;flex-direction:column}
h1{margin:0;font-size:${layout==='phone'?22:28}px;letter-spacing:.12em;font-weight:800}
.sub{opacity:.7;margin:4px 0 18px;font-size:12px;letter-spacing:.06em}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:${layout==='phone'?8:14}px;flex:1;max-height:${layout==='phone'?420:520}px}
.pad{position:relative;border-radius:16px;background:${d.well};box-shadow:inset 0 2px 8px rgba(0,0,0,.6),0 0 0 1px color-mix(in srgb,var(--rim) 30%,transparent),0 0 18px color-mix(in srgb,var(--rim) 22%,transparent);overflow:hidden;display:flex;align-items:center;justify-content:center}
.pad::before{content:"";position:absolute;inset:2px;border-radius:13px;border:1px solid rgba(255,255,255,.35);background:linear-gradient(145deg,rgba(255,255,255,.16),transparent 42%);pointer-events:none}
.art{width:72%;height:72%;z-index:1}
.shell{fill:${d.shell}} .film{fill:${d.film};stroke:rgba(255,255,255,.25);stroke-width:.8}
.hoop{stroke:${d.chrome}} .port{fill:rgba(0,0,0,.55)} .wire{stroke:rgba(200,210,230,.4);stroke-width:.7}
.cym{fill:${d.brass};opacity:.9} .bell{fill:#E8D090} .lathe{stroke:#7A5A28;stroke-width:1}
.metal{fill:${d.chrome}} .palm{fill:color-mix(in srgb,var(--rim) 40%,#E8C4A8)} .stick{fill:#E8DCC8}
.bolt{fill:var(--rim)} .lab{fill:var(--rim);font-size:10px;font-weight:900;font-family:system-ui}
.name{position:absolute;left:8px;bottom:6px;font-size:9px;font-weight:800;opacity:.8;z-index:2;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.pad.hit{transform:scale(.97)}
.pad.hit::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 45% 40%, color-mix(in srgb,var(--rim) 55%,#fff), transparent 60%);mix-blend-mode:screen;opacity:.85}
.pad.hit .art{transform:scale(.96)}
.brand{margin-top:auto;opacity:.5;font-size:11px;letter-spacing:.08em}
</style></head><body><div class="wrap">
<h1>${d.title}</h1><div class="sub">${d.subtitle} · ${layout} · ${hit?'MID-HIT':'IDLE'} · Sanctum Acrylic Kit</div>
<div class="grid">${pads}</div>
<div class="brand">TIBERIOUS PRODUCTIONS · SANCTUM · CONCEPT FRAME (ORIGINAL)</div>
</div></body></html>`;
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const dir of Object.keys(dirs)) {
  for (const layout of ['phone', 'tablet']) {
    for (const hit of [false, true]) {
      const w = layout === 'phone' ? 390 : 1180;
      const h = layout === 'phone' ? 844 : 820;
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
      await page.setContent(html(dir, layout, hit), { waitUntil: 'load' });
      const name = `frame-${dir}-${layout}-${hit ? 'hit' : 'idle'}.png`;
      await page.screenshot({ path: path.join(OUT, name) });
      console.log('saved', name);
    }
  }
}
await browser.close();
