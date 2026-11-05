// Sanctum → Lampstand "Send to Screen". Messages go to role 'screen' in <church>/<ROOM> on the Live Relay;
// Lampstand's operator console (js/sanctum-receiver.js) applies them to the live sanctuary display.
import { ReliableLink, type SendResult } from './reliable';
import { fullRoom, relayUrl, type LiveConfig } from './config';

/** Lampstand's 17 cue scenes (fallback list until the screen answers query.catalog). */
export const DEFAULT_SCENES = [
  ['stand', 'Please Stand'], ['seated', 'Please Be Seated'], ['pray', 'Let Us Pray'], ['worship', 'Let Us Worship'], ['read', 'Read Along'],
  ['offering', 'Tithes & Offering'], ['altar', 'Altar Call'], ['amen', 'Amen'], ['welcome', 'Welcome Visitors'], ['greet', 'Greet Your Neighbor'],
  ['communion', 'Holy Communion'], ['baptism', 'Baptism'], ['benediction', 'Benediction'], ['children', "Children's Church"], ['silence', 'Silence Phones'],
  ['birthday', 'Happy Birthday'], ['anniversary', 'Happy Anniversary'],
].map(([id, label]) => ({ id, label }));
export interface AnnTemplate { id: string; name: string; fields: { k: string; l?: string; t?: string; d?: string }[] }
export const DEFAULT_TEMPLATES: AnnTemplate[] = [   // mirrors Lampstand js/announce.js CSR.ANN_TEMPLATES (field keys must match)
  { id: 'event', name: 'Upcoming Event', fields: [{ k: 'kicker', l: 'Small heading', d: 'Upcoming Event' }, { k: 'title', l: 'Event title' }, { k: 'date', l: 'Date', t: 'date' }, { k: 'time', l: 'Time', t: 'time' }, { k: 'place', l: 'Location' }, { k: 'details', l: 'Details', t: 'textarea' }] },
  { id: 'celebration', name: 'Celebrations', fields: [{ k: 'kind', l: 'Heading', d: 'Happy Birthday!' }, { k: 'names', l: 'Names (one per line)', t: 'textarea' }, { k: 'message', l: 'Message' }] },
  { id: 'series', name: 'Sermon Series', fields: [{ k: 'kicker', l: 'Small heading', d: 'Sermon Series' }, { k: 'title', l: 'Series title' }, { k: 'subtitle', l: 'Subtitle / scripture' }, { k: 'speaker', l: 'Speaker' }, { k: 'when', l: 'When' }] },
  { id: 'countdown', name: 'Service Countdown', fields: [{ k: 'title', l: 'Heading', d: 'Worship begins in' }, { k: 'time', l: 'Start time', t: 'time' }, { k: 'message', l: 'Message' }] },
  { id: 'list', name: 'This Week', fields: [{ k: 'title', l: 'Heading', d: 'This Week at Church' }, { k: 'items', l: "Items (one per line, 'Day - event')", t: 'textarea' }] },
  { id: 'speaker', name: 'Guest Speaker', fields: [{ k: 'kicker', l: 'Small heading', d: 'Guest Speaker' }, { k: 'name', l: 'Name' }, { k: 'role', l: 'Title / church' }, { k: 'when', l: 'When' }] },
];

export interface Catalog { church?: { id: string; name: string }; room?: string; scenes: { id: string; label: string }[]; templates: AnnTemplate[]; songs: { id: string; title: string }[]; announcements?: { id: string; title: string; template: string }[] }

const TTL = { content: 45_000, nowPlaying: 8_000, blackout: 10 * 60_000, query: 8_000 };

export class ScreenLink {
  link: ReliableLink;
  catalog: Catalog = { scenes: DEFAULT_SCENES, templates: DEFAULT_TEMPLATES, songs: [] };
  last: { kind: string; label: string; ok?: boolean; ms?: number; error?: string } | null = null;
  onChange?: () => void;
  constructor(private cfg: () => LiveConfig) {
    this.link = new ReliableLink({
      url: () => { const r = relayUrl(this.cfg().relay); if (r.error) { this.link.error = r.error; return null; } return r.url!; },
      room: () => fullRoom(this.cfg()), role: 'sanctum', name: () => this.cfg().name || 'Sanctum',
      storageKey: 'sanctum.live.screen',
    });
    this.link.onChange = () => this.onChange?.();
    this.link.onMessage = (m) => { if (m.kind === 'screen.catalog' && m.body) { this.setCatalog(m.body); } };
  }
  get screens() { return this.link.peers.filter((p) => p.role === 'screen'); }
  private setCatalog(c: Partial<Catalog>) {
    this.catalog = { ...this.catalog, ...c, scenes: c.scenes?.length ? c.scenes : this.catalog.scenes, templates: c.templates?.length ? c.templates : this.catalog.templates };
    this.onChange?.();
  }
  /** Send to the screen; tracks the receipt for the status line. */
  private push(kind: string, body: any, label: string, ttl = TTL.content): SendResult {
    const t0 = performance.now();
    const r = this.link.send('screen', kind, { ...body, church: this.cfg().church, room: this.cfg().room }, { ttl });
    this.last = { kind, label }; this.onChange?.();
    r.receipt.then((x) => { if (this.last && this.last.label === label) { this.last = { kind, label, ok: x.ok, ms: Math.round(performance.now() - t0), error: x.error }; this.onChange?.(); } });
    return r;
  }
  async refreshCatalog() {
    const r = this.link.send('screen', 'query.catalog', {}, { ttl: TTL.query });
    const x = await r.receipt; if (x.ok && x.result) this.setCatalog(x.result);
    return x;
  }
  async bible(q: string, mode: 'ref' | 'search' = 'search', limit = 25) {
    return (await this.link.send('screen', 'query.bible', { q, mode, limit }, { ttl: TTL.query }).receipt);
  }
  scripture(ref: string, opts: { verse?: number; readAlong?: boolean } = {}) { return this.push('screen.scripture', { ref, ...opts }, ref); }
  lyrics(song: { title: string; author?: string; text?: string; sections?: { id?: string; label: string; lines: string[] }[]; arrangement?: string[]; songId?: string }, slide = 0) {
    return this.push('screen.lyrics', { ...song, slide }, song.title + (slide ? ` · slide ${slide + 1}` : ''));
  }
  slide(index: number) { return this.push('screen.slide', { index }, `slide ${index + 1}`); }
  step(dir: 1 | -1) { return this.push('screen.step', { dir }, dir > 0 ? 'next slide' : 'previous slide'); }
  announcement(template: string, fields: Record<string, string>, mood?: string) { return this.push('screen.announcement', { template, fields, mood }, `announcement: ${fields.title || fields.name || template}`); }
  scene(id: string, opts: { custom?: string; seconds?: number; style?: 'scene' | 'banner' } = {}) { return this.push('screen.scene', { id, ...opts }, `scene: ${id}`); }
  clearScene() { return this.push('screen.scene.clear', {}, 'clear scene'); }
  mode(mode: 'screensaver' | 'resume' | 'blank') { return this.push('screen.mode', { mode }, mode === 'screensaver' ? 'welcome loop' : mode); }
  nowPlaying(np: { title: string; detail?: string; pad?: string; bpm?: number; kind?: 'pad' | 'loop' | 'clip' | 'stem'; on: boolean }) {
    // now-playing is ephemeral: replace anything still queued and expire quickly
    this.link.purge((o) => o.kind === 'screen.nowplaying');
    return this.link.send('screen', 'screen.nowplaying', { ...np, source: 'sanctum', church: this.cfg().church, room: this.cfg().room }, { ttl: TTL.nowPlaying });
  }
  /** PANIC: black screen now. Cancels any queued screen content so nothing stale pops up after it. */
  blackout() {
    this.link.purge((o) => o.kind.startsWith('screen.') && o.kind !== 'screen.blackout');
    return this.push('screen.blackout', {}, 'BLACKOUT', TTL.blackout);
  }
  exportProPresenter(scope: 'live' | 'setlist' = 'setlist', format: 'propresenter' | 'pptx' = 'propresenter') { return this.push('screen.export', { scope, format }, `export ${format}`); }
}
