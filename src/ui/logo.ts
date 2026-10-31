// Brand marks from /mpc-research/branding (Arch Pad = header/splash, Keystone S = app icon).
// Colors are bound to theme CSS variables so the mark adapts to Dark / Light / Warm.
export const archPadSvg = (withWord = false) => `
<svg viewBox="0 0 ${withWord ? 520 : 190} 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sanctum">
 <g transform="translate(15,20)">
  <path d="M0 160 V60 A80 80 0 0 1 160 60 V160 Z" fill="none" stroke="var(--mark-accent)" stroke-width="8"/>
  <g fill="var(--mark)">
   <rect x="16" y="70" width="28" height="28" rx="5"/><rect x="52" y="70" width="28" height="28" rx="5"/><rect x="88" y="70" width="28" height="28" rx="5"/><rect x="124" y="70" width="20" height="28" rx="5"/>
   <rect x="16" y="110" width="28" height="28" rx="5"/><rect x="52" y="110" width="28" height="28" rx="5" fill="var(--mark-pad)"/><rect x="88" y="110" width="28" height="28" rx="5"/><rect x="124" y="110" width="20" height="28" rx="5"/>
   <rect x="56" y="30" width="48" height="28" rx="14"/>
  </g>
 </g>
 ${withWord ? '<text x="215" y="118" font-family="Georgia,\'Noto Serif\',serif" font-size="48" letter-spacing="10" fill="var(--mark)">SANCTUM</text>' : ''}
</svg>`;

export const keystoneSvg = () => `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sanctum">
 <rect width="1024" height="1024" rx="200" fill="#0B0B0F"/>
 <path d="M332 232 H692 L612 792 H412 Z" fill="none" stroke="#C9A227" stroke-width="28"/>
 <text x="512" y="640" text-anchor="middle" font-family="Georgia,'Noto Serif',serif" font-size="380" fill="#F2EEE6">S</text>
 <circle cx="512" cy="720" r="22" fill="#FF6A13"/>
</svg>`;
