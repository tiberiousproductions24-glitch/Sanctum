// LiveHub: owns the Lampstand screen link, the rehearsal link, the audio tap and the app hooks.
import type { App } from '../app';
import type { SoundBank, SoundDef } from '../audio/kits';
import { toast } from '../ui/dom';
import { ScreenLink } from './screen';
import { RehearsalLink, lyricsToSong, type RehSong, type SanctumEvent } from './rehearsal';
import { applyPairingUrl, loadConfig, saveConfig, type LiveConfig } from './config';

export class LiveHub {
  cfg: LiveConfig = loadConfig();
  screen: ScreenLink;
  reh: RehearsalLink;
  listeners = new Set<() => void>();
  remoteLog: { t: number; text: string; lateMs?: number | null }[] = [];
  stemLoad: Record<string, 'loading' | 'ready' | 'error'> = {};
  private tapCtx: AudioContext | null = null; private tapDest: MediaStreamAudioDestinationNode | null = null;
  private monitors = new Map<string, HTMLAudioElement>();
  private lastNp = ''; private npT: any; private stateT: any;

  constructor(public app: App) {
    if (applyPairingUrl(this.cfg, location.href)) { saveConfig(this.cfg); this.cfg.screenOn = true; }
    this.screen = new ScreenLink(() => this.cfg);
    this.screen.onChange = () => this.changed();
    this.reh = new RehearsalLink(() => this.cfg.reh, () => this.tap());
    this.reh.onChange = () => this.changed();
    this.reh.onEvent = (e) => this.onRemote(e);
    this.reh.onSong = (s) => { this.changed(); this.pushState(); if (s.bpm) this.note(`Rehearsal song ${s.title} · ${s.bpm} BPM`); };
    this.reh.onStream = (id, s) => this.monitor(id, s);
    if (this.cfg.screenOn) this.screen.link.start();
    // App hooks (no edits to app.ts): loops / transport / tempo → now-playing + rehearsal state
    app.on((w) => {
      if (w === 'loops' || w === 'transport') this.nowPlayingFromApp();
      if (w === 'banks' || w === 'transport' || w === 'tempo' || w === 'pattern') this.pushState();
    });
    const voice = app.voice.bind(app);
    app.voice = (global, vel, at, src) => {
      voice(global, vel, at, src);
      const s = app.soundOf(global);
      if (s && s.id.startsWith('reh.') && src === 'live') this.sendNowPlaying({ title: s.name, detail: 'Stem · ' + (this.reh.song?.title || 'rehearsal'), kind: 'stem', pad: padLabel(global) });
    };
    app.engine.onRecreate.push(() => { this.tapCtx = null; const s = this.tap(); this.reh.mesh?.replaceAudio(this.cfg.reh.sendAudio ? s?.getAudioTracks()[0] || null : null); });
    // Pairing deep link inside the native app (sanctum://live?relay=…&room=…)
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      import('@capacitor/app').then(({ App: CapApp }) => CapApp.addListener('appUrlOpen', (e) => {
        if (/^sanctum:\/\/live/.test(e.url) && applyPairingUrl(this.cfg, e.url)) { this.cfg.screenOn = true; this.save(); this.screen.link.restart(); toast('Paired with ' + this.cfg.relay); }
      })).catch(() => {});
    });
  }
  on(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  changed() { for (const l of this.listeners) l(); }
  save() { saveConfig(this.cfg); this.changed(); }
  note(text: string, lateMs?: number | null) { this.remoteLog.unshift({ t: Date.now(), text, lateMs }); this.remoteLog.length = Math.min(this.remoteLog.length, 40); this.changed(); }

  /** Overall status for the header chip. */
  get summary(): { cls: 'ok' | 'warn' | 'bad' | ''; text: string } {
    const s = this.screen.link, r = this.reh;
    const on = [this.cfg.screenOn ? s.status : null, r.status !== 'off' ? r.status : null].filter(Boolean) as string[];
    if (!on.length) return { cls: '', text: '' };
    const bad = on.some((x) => x === 'error' || x === 'denied'), warn = on.some((x) => x === 'connecting' || x === 'reconnecting');
    const rtt = s.status === 'online' ? s.rttMs : r.status === 'online' ? r.clock.rttMedian : null;
    const screenNoReceiver = this.cfg.screenOn && s.status === 'online' && !this.screen.screens.length;
    return { cls: bad ? 'bad' : warn || screenNoReceiver ? 'warn' : 'ok', text: rtt != null ? `${Math.round(rtt)}ms` : on[0] === 'online' ? '' : on[0] };
  }

  // ---------- audio: Sanctum master → MediaStream (for the rehearsal room) ----------
  tap(): MediaStream | null {
    const eng: any = this.app.engine; const ctx: AudioContext | null = eng.ctx; const master: GainNode | null = eng.master;
    if (!ctx || !master) return null;
    if (this.tapCtx !== ctx || !this.tapDest) {
      this.tapDest = ctx.createMediaStreamDestination(); this.tapDest.channelCount = 2;
      master.connect(this.tapDest); this.tapCtx = ctx;
      const t = this.tapDest.stream.getAudioTracks()[0]; if (t) (t as any).contentHint = 'music';
    }
    return this.tapDest.stream;
  }
  setSendAudio(on: boolean) { this.cfg.reh.sendAudio = on; this.save(); const t = this.tap()?.getAudioTracks()[0] || null; this.reh.mesh?.replaceAudio(on ? t : null); }
  private monitor(id: string, s: MediaStream) {
    let a = this.monitors.get(id);
    if (!a) { a = new Audio(); a.autoplay = true; this.monitors.set(id, a); }
    a.srcObject = s; a.muted = !this.cfg.reh.monitor; a.play().catch(() => {});
  }
  setMonitor(on: boolean) { this.cfg.reh.monitor = on; this.save(); for (const a of this.monitors.values()) { a.muted = !on; if (on) a.play().catch(() => {}); } }

  async joinRehearsal() {
    if (!this.app.started) await this.app.start();
    this.cfg.reh.on = true; this.save();
    if (!this.tap()) toast('Audio engine not running yet: tap Start first');
    this.reh.start();
  }
  leaveRehearsal() { this.cfg.reh.on = false; this.save(); this.reh.stop(); for (const a of this.monitors.values()) a.srcObject = null; this.monitors.clear(); }

  // ---------- remote triggers from the rehearsal room ----------
  /** Map a server-clock timestamp to engine context time. Returns at=0 (play now) when late/unsynced. */
  schedule(atServer?: number): { at: number; lateMs: number | null } {
    const eng = this.app.engine;
    if (!atServer || !this.reh.clock.ready || !eng.ctx) return { at: 0, lateMs: null };
    const perf = this.reh.clock.remoteToPerf(atServer);
    const lateMs = performance.now() - perf;
    const ctxT = eng.perfToCtx(perf);
    return { at: ctxT > eng.now + 0.003 ? ctxT : 0, lateMs };
  }
  private onRemote(e: SanctumEvent) {
    const app = this.app; const b = e.body || {};
    const who = e.fromName || 'room';
    if (e.kind === 'pad') {
      const global = Number.isInteger(b.global) ? b.global : (Number.isInteger(b.bank) ? b.bank : app.p.currentBank) * 16 + (Number(b.pad) | 0);
      if (global < 0 || global > 127) return;
      if (!app.started) { this.note(`${who}: pad ignored (tap Start on Sanctum first)`); return; }
      const { at, lateMs } = this.schedule(e.at);
      const vel = Math.max(1, Math.min(127, Number(b.vel) || 100));
      const s = app.soundOf(global);
      if (s?.kind === 'loop') app.toggleLoop(global); else app.voice(global, vel, at, 'seq');
      if (!at) app.flash(global % 16, vel);
      this.note(`${who} → pad ${padLabel(global)} ${s ? s.short : '(empty)'}`, lateMs);
      this.reh.post(e.from, 'rcpt', { ref: e.id, ok: !!s, lateMs, sound: s?.name || null });
    } else if (e.kind === 'clip') {
      const n = Math.max(0, Math.min(7, Number(b.pattern) | 0));
      const act = b.action || 'toggle';
      if (act === 'stop' || (act === 'toggle' && app.seq.playing && app.p.currentPattern === n)) app.stop();
      else { app.p.currentPattern = n; app.emit('pattern'); app.play(); }
      this.note(`${who} → clip ${n + 1} ${act}`);
      this.reh.post(e.from, 'rcpt', { ref: e.id, ok: true, playing: app.seq.playing, pattern: app.p.currentPattern });
    } else if (e.kind === 'stop') { app.stop(); this.note(`${who} → stop all`); this.reh.post(e.from, 'rcpt', { ref: e.id, ok: true }); }
    else if (e.kind === 'stem') { const g = app.p.pads.findIndex((p) => p.sound === 'reh.' + b.stem); if (g > -1) { const { at, lateMs } = this.schedule(e.at); app.voice(g, 110, at, 'seq'); this.note(`${who} → stem ${b.stem}`, lateMs); } }
    else if (e.kind === 'state?') this.pushState(true);
  }
  /** Tell the room what's on Sanctum's pads (labels) and its transport (throttled). */
  pushState(now = false) {
    if (this.reh.status !== 'online') return;
    clearTimeout(this.stateT);
    this.stateT = setTimeout(() => {
      const app = this.app; const bank = app.p.currentBank;
      const pads = Array.from({ length: 16 }, (_, i) => { const s = app.soundOf(bank * 16 + i); return s ? s.short : ''; });
      this.reh.post('*', 'sanctum.state', { bank, bankName: app.bank(app.p.bankSources[bank])?.name || '', pads, playing: app.seq.playing, pattern: app.p.currentPattern, bpm: app.p.bpm, patterns: app.p.patterns.map((p) => p.events.length) });
    }, now ? 0 : 250);
  }

  // ---------- stems → pads ----------
  async loadStems(ids?: string[]) {
    const song = this.reh.song; if (!song) return toast('Join a rehearsal room first');
    if (!this.app.started) await this.app.start();
    const eng = this.app.engine; const sr = eng.sampleRate;
    const stems = song.stems.filter((s) => !ids || ids.includes(s.id)).slice(0, 16);
    const slot = Math.max(0, Math.min(7, this.cfg.reh.stemBank | 0));
    const bankId = 'rehearsal';
    const existing = this.app.banks.find((b) => b.id === bankId);
    const sounds: (SoundDef | null)[] = existing && ids ? [...existing.sounds] : Array(16).fill(null);
    let fails = 0;
    await Promise.all(stems.map(async (st) => {
      this.stemLoad[st.id] = 'loading'; this.changed();
      try {
        const r = await fetch(this.reh.stemUrl(st.url), { headers: this.reh.authHeaders() });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const ch = await eng.decode(await r.arrayBuffer());
        const id = 'reh.' + st.id;
        eng.register(id, ch, sr);
        const def: SoundDef = { id, name: `${st.name} (${song.title})`, short: st.name.toUpperCase().slice(0, 8), kind: 'oneshot', choke: 'stem-' + st.id, bpm: song.bpm || undefined,
          credit: { author: song.author || 'Rehearsal room', license: song.copyright || 'Rehearsal stems (used with the leader\'s permission)', source: this.cfg.reh.url } };
        this.app.sounds.set(id, def);
        const at = sounds.findIndex((x) => x?.id === id); sounds[at > -1 ? at : sounds.findIndex((x) => !x)] = def;
        this.stemLoad[st.id] = 'ready';
      } catch (e) { fails++; this.stemLoad[st.id] = 'error'; console.warn('[rehearsal] stem failed', st.id, e); }
      this.changed();
    }));
    const bank: SoundBank = { id: bankId, name: `Rehearsal: ${song.title}`, status: 'ready', description: `Stems pulled from rehearsal room ${this.reh.roomName}`, sounds };
    const bi = this.app.banks.findIndex((b) => b.id === bankId); if (bi > -1) this.app.banks[bi] = bank; else this.app.banks.push(bank);
    this.app.assignBank(slot, bankId);
    this.app.p.currentBank = slot; this.app.emit('banks'); this.app.emit('bank');
    toast(`${stems.length - fails} stem(s) on bank ${'ABCDEFGH'[slot]}${fails ? ` · ${fails} failed` : ''}`);
    this.pushState(true);
  }
  rehearsalSong() { const s = this.reh.song; return s && s.lyrics?.length ? lyricsToSong(s as RehSong) : null; }
  matchTempo() { const bpm = this.reh.song?.bpm; if (!bpm) return; const rate = this.reh.transport?.rate || 1; this.app.setTempo(bpm * rate); toast(`Tempo ${Math.round(bpm * rate * 10) / 10} BPM (rehearsal song)`); }

  // ---------- now playing → Lampstand + rehearsal ----------
  private nowPlayingFromApp() {
    if (!this.cfg.autoNowPlaying) return;
    const app = this.app;
    const loops = [...app.loops.values()].map((l) => l.sound.name);
    if (loops.length) return this.sendNowPlaying({ title: loops.join(' + '), detail: `Loop · ${app.p.bpm} BPM`, kind: 'loop', bpm: app.p.bpm });
    if (app.seq.playing) return this.sendNowPlaying({ title: `Pattern ${app.p.currentPattern + 1}`, detail: `Sequencer clip · ${app.p.bpm} BPM`, kind: 'clip', bpm: app.p.bpm });
    this.sendNowPlaying(null);
  }
  sendNowPlaying(np: { title: string; detail?: string; kind?: 'pad' | 'loop' | 'clip' | 'stem'; bpm?: number; pad?: string } | null) {
    const key = np ? np.title + '|' + np.detail : '';
    if (key === this.lastNp) return; this.lastNp = key;
    clearTimeout(this.npT);
    this.npT = setTimeout(() => {   // debounce: loop changes at bar lines can fire in bursts
      if (this.cfg.screenOn && this.screen.link.status !== 'off') this.screen.nowPlaying(np ? { ...np, on: true } : { title: '', on: false });
      if (this.reh.status === 'online') this.reh.post('*', 'sanctum.nowplaying', np || { title: '' });
    }, 150);
  }
}
export const padLabel = (g: number) => `${'ABCDEFGH'[Math.floor(g / 16)]}${(g % 16) + 1}`;
