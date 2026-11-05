// Original SVG instrument art for the Acrylic Kit pad skin (Tiberious Productions / Sanctum).
// ViewBox 0 0 100 100. Drawn for top-down / drummer-POV recognition. No third-party assets.

export type KitInstrument =
  | 'kick' | 'snare' | 'tom' | 'hat-closed' | 'hat-open' | 'crash' | 'ride'
  | 'cowbell' | 'clap' | 'rim' | 'tambourine' | 'shaker' | 'bass808'
  | 'fx' | 'loop' | 'organ' | 'choir' | 'empty';

const NS = 'http://www.w3.org/2000/svg';

/** Shared chrome / glass tokens (overridden by CSS currentColor / CSS vars on .kit-art). */
function wrap(inner: string, cls: string): string {
  return `<svg class="kit-art ${cls}" viewBox="0 0 100 100" aria-hidden="true" focusable="false" xmlns="${NS}">${inner}</svg>`;
}

function lugs(cx: number, cy: number, r: number, n: number, size = 3.2): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    out += `<rect class="lug" x="${(x - size / 2).toFixed(2)}" y="${(y - size / 2).toFixed(2)}" width="${size}" height="${size}" rx="0.6" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})"/>`;
  }
  return out;
}

function hoop(cx: number, cy: number, r: number): string {
  return `<circle class="hoop-outer" cx="${cx}" cy="${cy}" r="${r}" fill="none"/>` +
    `<circle class="hoop-inner" cx="${cx}" cy="${cy}" r="${(r - 2.4).toFixed(2)}" fill="none"/>`;
}

function headFilm(cx: number, cy: number, r: number): string {
  return `<circle class="head-film" cx="${cx}" cy="${cy}" r="${r}" />` +
    `<circle class="head-ring" cx="${cx}" cy="${cy}" r="${(r * 0.72).toFixed(2)}" fill="none"/>` +
    `<circle class="head-ring soft" cx="${cx}" cy="${cy}" r="${(r * 0.45).toFixed(2)}" fill="none"/>`;
}

function specular(cx: number, cy: number, r: number): string {
  return `<ellipse class="specular" cx="${(cx - r * 0.22).toFixed(2)}" cy="${(cy - r * 0.28).toFixed(2)}" rx="${(r * 0.38).toFixed(2)}" ry="${(r * 0.18).toFixed(2)}"/>`;
}

function drum(cx: number, cy: number, r: number, lugN: number, under = ''): string {
  return `<g class="drum-shell">${under}${headFilm(cx, cy, r - 4)}${hoop(cx, cy, r)}${lugs(cx, cy, r - 1.1, lugN)}${specular(cx, cy, r)}</g>`;
}

const ART: Record<KitInstrument, string> = {
  kick: wrap(
    `<g class="inst kick">
      <circle class="shell-depth" cx="50" cy="50" r="42"/>
      ${drum(50, 50, 40, 8, `<circle class="port" cx="50" cy="54" r="11"/><circle class="port-inner" cx="50" cy="54" r="7.5" fill="none"/>`)}
      <circle class="badge" cx="50" cy="34" r="3.5"/>
    </g>`,
    'kit-kick',
  ),
  snare: wrap(
    `<g class="inst snare">
      <circle class="shell-depth" cx="50" cy="50" r="38"/>
      ${drum(50, 50, 36, 10, `
        <g class="snare-wires">${Array.from({ length: 9 }, (_, i) => {
          const y = 34 + i * 3.6;
          return `<line x1="28" y1="${y}" x2="72" y2="${y}"/>`;
        }).join('')}</g>
        <rect class="strainer" x="44" y="78" width="12" height="5" rx="1"/>
      `)}
    </g>`,
    'kit-snare',
  ),
  tom: wrap(
    `<g class="inst tom">
      <circle class="shell-depth" cx="50" cy="50" r="36"/>
      ${drum(50, 50, 34, 6)}
    </g>`,
    'kit-tom',
  ),
  rim: wrap(
    `<g class="inst rim">
      <circle class="shell-depth" cx="50" cy="50" r="34"/>
      ${hoop(50, 50, 32)}
      ${lugs(50, 50, 31, 8, 2.8)}
      <circle class="rim-stick" cx="62" cy="38" r="4.5"/>
      <rect class="rim-stick-shaft" x="60.5" y="20" width="3" height="20" rx="1"/>
    </g>`,
    'kit-rim',
  ),
  'hat-closed': wrap(
    `<g class="inst cym hat-closed">
      <circle class="cym-bow" cx="50" cy="52" r="34"/>
      <circle class="cym-lathe" cx="50" cy="52" r="28" fill="none"/>
      <circle class="cym-lathe" cx="50" cy="52" r="22" fill="none"/>
      <circle class="cym-lathe" cx="50" cy="52" r="16" fill="none"/>
      <circle class="cym-bow top" cx="50" cy="48" r="34"/>
      <circle class="cym-lathe" cx="50" cy="48" r="26" fill="none"/>
      <circle class="cym-bell" cx="50" cy="48" r="8"/>
      <circle class="cym-nut" cx="50" cy="48" r="2.4"/>
      ${specular(50, 48, 30)}
    </g>`,
    'kit-hat-closed',
  ),
  'hat-open': wrap(
    `<g class="inst cym hat-open">
      <circle class="cym-bow" cx="50" cy="56" r="34"/>
      <circle class="cym-lathe" cx="50" cy="56" r="26" fill="none"/>
      <circle class="cym-bow top" cx="50" cy="44" r="34"/>
      <circle class="cym-lathe" cx="50" cy="44" r="28" fill="none"/>
      <circle class="cym-lathe" cx="50" cy="44" r="20" fill="none"/>
      <circle class="cym-bell" cx="50" cy="44" r="8"/>
      <circle class="cym-nut" cx="50" cy="44" r="2.4"/>
      ${specular(50, 44, 30)}
    </g>`,
    'kit-hat-open',
  ),
  crash: wrap(
    `<g class="inst cym crash">
      <circle class="cym-bow" cx="50" cy="50" r="38"/>
      <circle class="cym-lathe" cx="50" cy="50" r="32" fill="none"/>
      <circle class="cym-lathe" cx="50" cy="50" r="26" fill="none"/>
      <circle class="cym-lathe" cx="50" cy="50" r="20" fill="none"/>
      <circle class="cym-lathe" cx="50" cy="50" r="14" fill="none"/>
      <circle class="cym-bell" cx="50" cy="50" r="7"/>
      <circle class="cym-nut" cx="50" cy="50" r="2.2"/>
      ${specular(50, 50, 34)}
    </g>`,
    'kit-crash',
  ),
  ride: wrap(
    `<g class="inst cym ride">
      <circle class="cym-bow" cx="50" cy="50" r="40"/>
      <circle class="cym-lathe" cx="50" cy="50" r="34" fill="none"/>
      <circle class="cym-lathe" cx="50" cy="50" r="28" fill="none"/>
      <circle class="cym-lathe" cx="50" cy="50" r="22" fill="none"/>
      <circle class="cym-bell big" cx="50" cy="50" r="12"/>
      <circle class="cym-lathe" cx="50" cy="50" r="8" fill="none"/>
      <circle class="cym-nut" cx="50" cy="50" r="2.6"/>
      ${specular(50, 50, 36)}
    </g>`,
    'kit-ride',
  ),
  cowbell: wrap(
    `<g class="inst cowbell">
      <path class="bell-body" d="M28 28 L72 28 L66 78 L34 78 Z"/>
      <path class="bell-mouth" d="M34 78 L66 78 L62 86 L38 86 Z"/>
      <line class="bell-edge" x1="50" y1="28" x2="50" y2="78"/>
      <rect class="bell-mount" x="46" y="18" width="8" height="12" rx="1"/>
      ${specular(50, 42, 22)}
    </g>`,
    'kit-cowbell',
  ),
  clap: wrap(
    `<g class="inst clap">
      <path class="palm left" d="M22 58 C18 40 28 28 40 32 C44 22 58 24 58 38 C62 36 70 42 66 54 C78 56 78 72 64 74 C58 84 40 84 34 72 C22 74 18 66 22 58 Z"/>
      <path class="palm right" d="M78 58 C82 40 72 28 60 32 C56 22 42 24 42 38 C38 36 30 42 34 54 C22 56 22 72 36 74 C42 84 60 84 66 72 C78 74 82 66 78 58 Z"/>
    </g>`,
    'kit-clap',
  ),
  tambourine: wrap(
    `<g class="inst tamb">
      <circle class="tamb-ring" cx="50" cy="50" r="36" fill="none"/>
      <circle class="tamb-ring inner" cx="50" cy="50" r="28" fill="none"/>
      ${Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 8;
        const x = 50 + Math.cos(a) * 32;
        const y = 50 + Math.sin(a) * 32;
        return `<ellipse class="jingle" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="5" ry="3.2" transform="rotate(${((a * 180) / Math.PI).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }).join('')}
      <circle class="tamb-head" cx="50" cy="50" r="22"/>
      ${specular(50, 50, 28)}
    </g>`,
    'kit-tamb',
  ),
  shaker: wrap(
    `<g class="inst shaker">
      <ellipse class="shaker-body" cx="50" cy="50" rx="22" ry="34"/>
      <ellipse class="shaker-band" cx="50" cy="50" rx="22" ry="6"/>
      ${Array.from({ length: 14 }, (_, i) => {
        const x = 38 + (i % 5) * 6 + (i > 9 ? 3 : 0);
        const y = 36 + Math.floor(i / 5) * 10 + (i % 3);
        return `<circle class="bead" cx="${x}" cy="${y}" r="1.6"/>`;
      }).join('')}
      ${specular(50, 40, 20)}
    </g>`,
    'kit-shaker',
  ),
  bass808: wrap(
    `<g class="inst bass808">
      <circle class="cone" cx="50" cy="50" r="38"/>
      <circle class="cone-ring" cx="50" cy="50" r="28" fill="none"/>
      <circle class="cone-ring" cx="50" cy="50" r="18" fill="none"/>
      <circle class="dustcap" cx="50" cy="50" r="9"/>
      <text class="eight-label" x="50" y="54" text-anchor="middle">808</text>
      ${specular(50, 50, 34)}
    </g>`,
    'kit-808',
  ),
  fx: wrap(
    `<g class="inst fx">
      <circle class="fx-orb" cx="50" cy="50" r="30"/>
      <path class="fx-bolt" d="M54 22 L40 52 L50 52 L46 78 L66 44 L54 44 Z"/>
      ${specular(50, 42, 24)}
    </g>`,
    'kit-fx',
  ),
  loop: wrap(
    `<g class="inst loop">
      <circle class="loop-ring" cx="50" cy="50" r="30" fill="none"/>
      <circle class="loop-ring" cx="50" cy="50" r="22" fill="none"/>
      <path class="loop-arrow" d="M72 50 A22 22 0 1 1 50 28" fill="none"/>
      <polygon class="loop-head" points="50,22 56,30 44,30"/>
      <rect class="fret" x="40" y="46" width="20" height="3" rx="1"/>
      <rect class="fret" x="40" y="54" width="20" height="3" rx="1"/>
    </g>`,
    'kit-loop',
  ),
  organ: wrap(
    `<g class="inst organ">
      <rect class="keys-base" x="16" y="40" width="68" height="28" rx="2"/>
      ${Array.from({ length: 7 }, (_, i) => `<rect class="key white" x="${18 + i * 9.2}" y="42" width="8.4" height="24" rx="0.8"/>`).join('')}
      ${[0, 1, 3, 4, 5].map((i) => `<rect class="key black" x="${24 + i * 9.2}" y="42" width="5.2" height="14" rx="0.6"/>`).join('')}
      <rect class="pipe" x="28" y="18" width="6" height="20" rx="1"/>
      <rect class="pipe" x="40" y="14" width="6" height="24" rx="1"/>
      <rect class="pipe" x="52" y="16" width="6" height="22" rx="1"/>
      <rect class="pipe" x="64" y="12" width="6" height="26" rx="1"/>
    </g>`,
    'kit-organ',
  ),
  choir: wrap(
    `<g class="inst choir">
      <circle class="voice" cx="32" cy="48" r="12"/>
      <circle class="voice" cx="50" cy="40" r="14"/>
      <circle class="voice" cx="68" cy="48" r="12"/>
      <path class="wave" d="M20 72 Q35 60 50 72 T80 72" fill="none"/>
      <path class="wave soft" d="M24 78 Q40 68 50 78 T76 78" fill="none"/>
    </g>`,
    'kit-choir',
  ),
  empty: wrap(
    `<g class="inst empty">
      <circle class="empty-ring" cx="50" cy="50" r="28" fill="none"/>
      <circle class="empty-ring soft" cx="50" cy="50" r="18" fill="none"/>
    </g>`,
    'kit-empty',
  ),
};

const cache = new Map<KitInstrument, string>();

/** Returns an SVG markup string for the instrument (cached). */
export function instrumentSvg(kind: KitInstrument): string {
  let s = cache.get(kind);
  if (!s) { s = ART[kind] || ART.empty; cache.set(kind, s); }
  return s;
}

/** Parse SVG markup into an Element suitable for appending into a pad cap. */
export function instrumentEl(kind: KitInstrument): SVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = instrumentSvg(kind).trim();
  return tpl.content.firstElementChild as SVGElement;
}
