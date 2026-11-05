// Map Sanctum SoundDef → Acrylic Kit instrument silhouette.
import type { SoundDef } from '../../../audio/kits';
import type { KitInstrument } from './instruments';

const GEN_MAP: Record<string, KitInstrument> = {
  kick: 'kick',
  snare: 'snare',
  clap: 'clap',
  rim: 'rim',
  hat: 'hat-closed',
  tom: 'tom',
  cymbal: 'crash',
  tambourine: 'tambourine',
  shaker: 'shaker',
  bass808: 'bass808',
  cowbell: 'cowbell',
  snap: 'clap',
  riser: 'fx',
  subDrop: 'fx',
  impact: 'fx',
  reverseCymbal: 'crash',
  noiseSweep: 'fx',
  swell: 'fx',
  zap: 'fx',
  click: 'rim',
};

function fromName(name: string, short: string): KitInstrument | null {
  const n = `${name} ${short}`.toLowerCase();
  if (/\b(kick|bass drum|bd)\b/.test(n) && !/808/.test(n)) return 'kick';
  if (/808|sub bass|808s/.test(n)) return 'bass808';
  if (/snare|sd\b/.test(n)) return 'snare';
  if (/rim/.test(n)) return 'rim';
  if (/clap|snap/.test(n)) return 'clap';
  if (/open\s*hat|ohh|op hat|hats?\s*open/.test(n)) return 'hat-open';
  if (/closed\s*hat|chh|cl hat|pedal\s*hat|pd hat|hi-?hat|hat/.test(n)) return 'hat-closed';
  if (/ride/.test(n)) return 'ride';
  if (/crash|china|splash|rev\s*cym/.test(n)) return 'crash';
  if (/tom/.test(n)) return 'tom';
  if (/cowbell|cow bell/.test(n)) return 'cowbell';
  if (/tamb/.test(n)) return 'tambourine';
  if (/shaker|cabasa|maraca/.test(n)) return 'shaker';
  if (/organ|leslie|tonewheel|hammond|keys?|piano|pipe/.test(n)) return 'organ';
  if (/choir|ooh|aah|vocal|voice|satb|hum/.test(n)) return 'choir';
  if (/guitar|scratch|bass\b|loop|groove|shout/.test(n)) return 'loop';
  if (/riser|sweep|impact|zap|laser|fx|drop|swell/.test(n)) return 'fx';
  return null;
}

/** Resolve the acrylic instrument for a sound (or empty). */
export function instrumentForSound(s: SoundDef | null | undefined): KitInstrument {
  if (!s) return 'empty';
  if (s.kind === 'loop') {
    const byName = fromName(s.name, s.short);
    if (byName && byName !== 'empty') return byName;
    return 'loop';
  }
  if (s.gen) {
    if (s.gen === 'hat') {
      const n = `${s.name} ${s.short}`.toLowerCase();
      if (/open|ohh|op hat/.test(n)) return 'hat-open';
      return 'hat-closed';
    }
    if (s.gen === 'cymbal') {
      const n = `${s.name} ${s.short}`.toLowerCase();
      if (/ride/.test(n)) return 'ride';
      if ((s.params as { bell?: number } | undefined)?.bell) return 'ride';
      return 'crash';
    }
    if (s.gen === 'tom') return 'tom';
    const g = GEN_MAP[s.gen];
    if (g) return g;
  }
  return fromName(s.name, s.short) || 'fx';
}

/** Motion class for hit feedback (head flex vs cymbal shimmer vs jiggle). */
export function motionClass(inst: KitInstrument): 'head' | 'cymbal' | 'metal' | 'shake' | 'soft' | 'none' {
  switch (inst) {
    case 'kick': case 'snare': case 'tom': case 'rim': case 'bass808': return 'head';
    case 'hat-closed': case 'hat-open': case 'crash': case 'ride': return 'cymbal';
    case 'cowbell': return 'metal';
    case 'tambourine': case 'shaker': return 'shake';
    case 'clap': case 'fx': case 'loop': case 'organ': case 'choir': return 'soft';
    default: return 'none';
  }
}
