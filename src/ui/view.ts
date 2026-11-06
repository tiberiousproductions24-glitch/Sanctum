// Main instrument surface: status strip, bank row, step editor, pads, action bar, tablet panels.
import { App } from '../app';
import { BANKS, PPQ, QUANT_TICKS, type QuantizeKey } from '../state';
import { h, $, toast, slider } from './dom';
import { archPadSvg } from './logo';
import type { Sheets } from './sheets';
import { PulpitUI } from '../pulpit/ui';
import { applyPadSkin, paintPadInstrument, acrylicHit, type PadSkin } from './skins/kit';

const PAD_ORDER = [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3]; // DOM order -> pad index (pad 1 bottom-left)
const KEYMAP: Record<string, number> = { Digit1: 12, Digit2: 13, Digit3: 14, Digit4: 15, KeyQ: 8, KeyW: 9, KeyE: 10, KeyR: 11, KeyA: 4, KeyS: 5, KeyD: 6, KeyF: 7, KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3 };

export class View {
  root = $('#app');
  pads: HTMLElement[] = [];
  private stepCells: { el: HTMLElement; col: number }[] = [];
  private headCol = -1;
  private barPage = 0;
  private visQ: { pad: number; vel: number; t: number }[] = [];
  sheets!: Sheets;
  layout: 'phone' | 'tablet' = 'phone';
  orient: 'portrait' | 'landscape' = 'portrait';
  private els: Record<string, HTMLElement> = {};
  private macro: Record<string, any> = {};
  private live = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  private tempoT = 0;
  pulpitUI: PulpitUI | null = null;
  /** Screen-reader announcement (polite live region). */
  announce(msg: string) { this.live.textContent = ''; requestAnimationFrame(() => { this.live.textContent = msg; }); }

  constructor(public app: App) {
    document.body.appendChild(this.live);
    app.flash = (pad16, vel, x, y) => this.flash(pad16, vel, x, y);
    app.scheduleFlash = (g, vel, t) => { if (Math.floor(g / 16) === app.p.currentBank || app.sixteenLevels) this.visQ.push({ pad: g % 16, vel, t }); };
    this.build();
    this.pulpitUI = new PulpitUI(app);
    app.pulpit = this.pulpitUI;
    app.on((w) => this.onEvent(w));
    window.addEventListener('resize', () => this.relayout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.relayout(), 200));
    this.keyboard();
    requestAnimationFrame(this.frame);
    // block page-level gestures (pinch zoom / double-tap zoom on iOS)
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  openPulpit() {
    if (!this.app.started) this.app.start().then(() => this.pulpitUI?.open());
    else this.pulpitUI?.open();
  }

  applyTheme() {
    document.documentElement.dataset.theme = this.app.p.theme;
    try { localStorage.setItem('sanctum.theme', this.app.p.theme); } catch {}
    const skin = (this.app.p.settings.padSkin === 'hardware' ? 'hardware' : 'acrylic') as PadSkin;
    applyPadSkin(skin);
    const meta = document.querySelector('meta[name=theme-color]'); const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    meta?.setAttribute('content', bg || '#0B0B0F');
    document.body.classList.toggle('reduce-motion', this.app.p.settings.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ---------- build ----------
  private build() {
    const a = this.app; const r = this.root; r.innerHTML = '';
    this.applyTheme();
    // status strip
    const rec = h('button', { class: 'tbtn rec', 'aria-label': 'Record', title: 'Record (Enter)', onclick: () => a.toggleRecord() }, h('span', { class: 'dot' }), h('span', { class: 'hide-phone' }, 'REC'));
    const play = h('button', { class: 'tbtn play', 'aria-label': 'Play / Stop', title: 'Play / Stop (Space)', onclick: () => (a.seq.playing ? a.stop() : a.play()) }, '▶');
    const stop = h('button', { class: 'tbtn stop', 'aria-label': 'Stop', onclick: () => a.stop() }, '■');
    const lcd = h('div', { class: 'lcd', role: 'button', 'aria-label': 'Tempo and transport settings', onclick: () => this.sheets.transport() },
      h('span', { class: 'seg' }, h('span', { class: 'big bpm' }, '120.0')),
      h('span', { class: 'seg lblbpm' }, h('span', { class: 'lbl' }, 'BPM')),
      h('span', { class: 'seg pos' }, '1.1'),
      h('span', { class: 'seg hide-phone' }, h('span', { class: 'lbl' }, 'SW'), h('span', { class: 'swing' }, '56%')),
      h('span', { class: 'seg hide-phone' }, h('span', { class: 'lbl' }, 'Q'), h('span', { class: 'quant' }, '1/16')),
      h('span', { class: 'seg hide-phone' }, h('span', { class: 'sig' }, '4/4')));
    const lat = h('button', { class: 'chip lat', 'aria-label': 'Latency — open Timing Lab', onclick: () => this.sheets.timingLab() }, '⚡', h('span', { class: 'v' }, '–'));
    const link = h('button', { class: 'chip link', 'aria-label': 'Ableton Link', onclick: () => this.sheets.sync() }, h('span', { class: 'led' }), 'LINK', h('span', { class: 'v' }, ''));
    const midi = h('button', { class: 'chip midi hide-phone', 'aria-label': 'MIDI', onclick: () => this.sheets.sync() }, h('span', { class: 'led' }), 'MIDI');
    const menu = h('button', { class: 'tbtn hide-phone', 'aria-label': 'Menu', onclick: () => this.sheets.menu() }, '⚙');
    const share = h('button', { class: 'tbtn share hide-phone', 'aria-label': 'Share or post a clip, screenshot or promo', title: 'Share / Post', onclick: () => this.sheets.share() }, '⤴', h('span', { class: 'hide-phone' }, 'SHARE'));
    const pulpit = h('button', { class: 'tbtn pulpitBtn', 'aria-label': 'Open Follow Me — Preacher Assist', title: 'Follow Me', onclick: () => this.openPulpit() }, '✝', h('span', { class: 'hide-phone' }, 'FOLLOW ME'));
    const status = h('header', { class: 'status' }, h('div', { class: 'mark', html: archPadSvg(false) + '<span class="word">SANCTUM</span>' }), rec, play, stop, lcd, lat, link, midi, pulpit, share, menu);
    Object.assign(this.els, { rec, play, lcd, lat, link, midi });

    // track row
    const banks = h('div', { class: 'banks', role: 'tablist', 'aria-label': 'Pad banks' },
      BANKS.map((b, i) => h('button', { class: 'bank', role: 'tab', 'aria-label': `Bank ${b}`, 'aria-selected': 'false', onclick: () => this.setBank(i) }, b)));
    const patBtn = h('button', { class: 'pill', 'aria-label': 'Pattern', onclick: () => this.sheets.transport() }, 'PAT ', h('b', { class: 'patn' }, '1'));
    const info = h('div', { class: 'trackinfo', role: 'status' });
    const soundsBtn = h('button', { class: 'pill soundsBtn', onclick: () => this.sheets.sounds() }, '♫ Sounds');
    const track = h('section', { class: 'trackrow' }, patBtn, banks, info, soundsBtn);
    Object.assign(this.els, { banks, info, patBtn });

    // editor
    const editor = h('section', { class: 'editor', 'aria-label': 'Step editor' });
    this.els.editor = editor;

    // pads
    const padsEl = h('div', { class: 'pads', role: 'group', 'aria-label': 'Pads' });
    this.pads = [];
    for (let i = 0; i < 16; i++) {
      const idx = PAD_ORDER[i];
      // .pad = static well (fixed shadow); .cap = raised face that travels (transform only); glow/flash = opacity only
      const p = h('div', { class: 'pad', role: 'button', tabindex: '0', 'data-pad': idx, 'data-row': String(Math.floor(idx / 4)) },
        h('span', { class: 'cap' }, h('span', { class: 'num', 'aria-hidden': 'true' }, String(idx + 1)), h('span', { class: 'tag', 'aria-hidden': 'true' }), h('span', { class: 'name', 'aria-hidden': 'true' }, ''),
          h('span', { class: 'flash' }), h('span', { class: 'ring' }), h('span', { class: 'led', 'aria-hidden': 'true' })),
        h('span', { class: 'glow', 'aria-hidden': 'true' }));
      this.pads[idx] = p; padsEl.appendChild(p);
    }
    this.padEvents(padsEl);
    const sideacts = h('div', { class: 'sideacts' });
    const padzone = h('section', { class: 'padzone' }, padsEl, sideacts);
    this.els.padsEl = padsEl; this.els.padzone = padzone; this.els.sideacts = sideacts;

    // action bar, wrapped in the phone "drawer": a handle that slides a controls panel up over the pads
    const actions = h('nav', { class: 'actions', 'aria-label': 'Pad actions' });
    this.els.actions = actions;
    this.buildActions(actions); this.buildActions(sideacts);
    const drawerBody = h('div', { class: 'drawer-body', id: 'sanctum-drawer', role: 'region', 'aria-label': 'Controls drawer' });
    const handle = h('button', { class: 'drawer-handle', 'aria-expanded': 'false', 'aria-controls': 'sanctum-drawer', onclick: () => this.toggleDrawer() }, h('i', { 'aria-hidden': 'true' }), h('span', { class: 'lbl' }, 'CONTROLS'));
    const drawer = h('section', { class: 'drawer' }, drawerBody, handle, actions);
    Object.assign(this.els, { drawer, drawerBody, handle });

    // tablet panels
    const browser = h('aside', { class: 'browser panel', 'aria-label': 'Sound browser' });
    const inspector = h('aside', { class: 'inspector panel', 'aria-label': 'Inspector' });
    const macro = h('section', { class: 'macro', 'aria-label': 'Macro strip' });
    Object.assign(this.els, { browser, inspector, macro });
    browser.style.gridArea = 'browser'; inspector.style.gridArea = 'inspector';

    r.append(status, track, browser, editor, inspector, padzone, macro, drawer);
    this.relayout();
    this.renderAll();
  }

  private buildActions(host: HTMLElement) {
    const a = this.app;
    const nr = h('button', { class: 'act nr', 'aria-label': 'Repeat: hold a pad to repeat it in time. Long-press for options', 'aria-pressed': 'false', onclick: () => { a.seq.noteRepeat = !a.seq.noteRepeat; this.updateActs(); this.announce(a.seq.noteRepeat ? 'Repeat on' : 'Repeat off'); } }, 'REPEAT', h('small', { class: 'rate' }, a.p.noteRepeatRate));
    let pressT = 0;
    nr.addEventListener('pointerdown', () => { pressT = window.setTimeout(() => { pressT = 0; this.sheets.noteRepeat(); }, 550); });
    nr.addEventListener('pointerup', () => clearTimeout(pressT));
    nr.addEventListener('pointerleave', () => clearTimeout(pressT));
    const rate = h('button', { class: 'act rateBtn', 'aria-label': 'Repeat speed', onclick: () => this.cycleRate() }, 'SPEED', h('small', { class: 'rate' }, a.p.noteRepeatRate));
    const full = h('button', { class: 'act full', 'aria-label': 'Full volume: every hit at full strength', 'aria-pressed': 'false', onclick: () => { a.fullLevel = !a.fullLevel; if (a.fullLevel) a.sixteenLevels = false; this.updateActs(); this.renderPads(); } }, 'FULL', h('small', {}, 'volume'));
    const six = h('button', { class: 'act six', 'aria-label': '16 levels: the selected sound on all pads, soft to loud', 'aria-pressed': 'false', onclick: () => { a.sixteenLevels = !a.sixteenLevels; if (a.sixteenLevels) a.fullLevel = false; this.updateActs(); this.renderPads(); } }, '16', h('small', {}, 'levels'));
    const edit = h('button', { class: 'act edit', 'aria-label': 'Edit the selected pad', onclick: () => this.sheets.padEditor(a.p.selectedPad) }, 'EDIT', h('small', {}, 'pad'));
    const more = h('button', { class: 'act', 'aria-label': 'Menu', onclick: () => this.sheets.menu() }, '☰', h('small', {}, 'menu'));
    host.append(nr, rate, full, six, edit, more);
  }

  toggleDrawer(open = !this.els.drawer.classList.contains('open')) {
    this.els.drawer.classList.toggle('open', open);
    this.els.handle.setAttribute('aria-expanded', String(open));
    this.els.handle.querySelector('.lbl')!.textContent = open ? 'CLOSE' : 'CONTROLS';
    if (open) this.renderDrawer();
  }

  /** Phone-layout controls drawer: mixer sliders + quick buttons (Share, Theme, Timing Lab, Link). */
  renderDrawer() {
    const a = this.app; const d = this.els.drawerBody; if (!d) return; d.innerHTML = '';
    const sel = a.p.pads[a.p.selectedPad];
    d.append(
      slider('Tempo', 30, 300, 0.5, a.p.bpm, (v) => v.toFixed(1), (v) => a.setTempo(v)),
      slider('Swing', 50, 75, 1, a.p.swing, (v) => v + '%', (v) => { a.p.swing = v; a.save(); a.ccOut('swing'); this.renderHeader(); }),
      slider('Master', 0, 1, 0.01, a.p.settings.master, (v) => Math.round(v * 100) + '%', (v) => { a.p.settings.master = v; a.engine.setMaster(v); a.save(); a.ccOut('master'); }),
      slider('Pad level', 0, 1.5, 0.01, sel.gain, (v) => Math.round(v * 100) + '%', (v) => { a.p.pads[a.p.selectedPad].gain = v; a.save(); a.ccOut('padLevel'); }),
      h('div', { class: 'drawer-btns' },
        h('button', { class: 'btn primary', onclick: () => { this.toggleDrawer(false); this.openPulpit(); } }, '✝ Follow Me'),
        h('button', { class: 'btn', onclick: () => { this.toggleDrawer(false); this.sheets.share(); } }, '⤴ Share / Post'),
        h('button', { class: 'btn', onclick: () => { this.toggleDrawer(false); this.sheets.settings(); } }, 'Theme & layout'),
        h('button', { class: 'btn', onclick: () => { this.toggleDrawer(false); this.sheets.timingLab(); } }, 'Timing Lab'),
        h('button', { class: 'btn', onclick: () => { this.toggleDrawer(false); this.sheets.sync(); } }, 'Link / MIDI')));
  }

  private cycleRate() {
    const order: QuantizeKey[] = ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/32T'];
    const i = order.indexOf(this.app.p.noteRepeatRate);
    this.app.p.noteRepeatRate = order[(i + 1) % order.length]; this.app.save(); this.updateActs();
  }

  updateActs() {
    const a = this.app;
    this.root.querySelectorAll('.act.nr').forEach((e) => { e.classList.toggle('on', a.seq.noteRepeat); e.setAttribute('aria-pressed', String(a.seq.noteRepeat)); });
    this.root.querySelectorAll('.act.full').forEach((e) => e.setAttribute('aria-pressed', String(a.fullLevel)));
    this.root.querySelectorAll('.act.six').forEach((e) => e.setAttribute('aria-pressed', String(a.sixteenLevels)));
    this.root.querySelectorAll('.act .rate').forEach((e) => (e.textContent = a.p.noteRepeatRate));
    this.root.querySelectorAll('.act.full').forEach((e) => e.classList.toggle('on', a.fullLevel));
    this.root.querySelectorAll('.act.six').forEach((e) => e.classList.toggle('on', a.sixteenLevels));
  }

  // ---------- pad input ----------
  private padEvents(el: HTMLElement) {
    const active = new Map<number, number>(); // pointerId -> pad
    const velocityOf = (e: PointerEvent, pad: HTMLElement) => {
      const s = this.app.p.settings; const r = pad.getBoundingClientRect();
      const yRel = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      const posV = 1 - yRel;                                  // top of pad = loudest
      const hasForce = e.pressure > 0 && e.pressure !== 0.5 && e.pressure !== 1 && (e.pointerType === 'touch' || e.pointerType === 'pen');
      let v: number;
      if (s.velocityMode === 'position') v = posV;
      else if (s.velocityMode === 'pressure') v = hasForce || e.pointerType === 'pen' ? e.pressure : posV;
      else if (s.velocityMode === 'fixed') return s.fixedVelocity;
      else { // auto
        if (e.pointerType === 'pen' || hasForce) v = e.pressure;
        else if (e.pointerType === 'touch' && e.width > 2) { const size = Math.min(1, Math.max(0, ((e.width + e.height) / 2 - 10) / 34)); v = 0.55 * posV + 0.45 * size; }
        else v = posV;
      }
      return Math.round(18 + 109 * Math.min(1, Math.max(0, v)));
    };
    el.addEventListener('pointerdown', (e) => {
      const pad = (e.target as HTMLElement).closest('.pad') as HTMLElement | null; if (!pad) return;
      e.preventDefault();
      try { pad.setPointerCapture(e.pointerId); } catch {}
      const idx = Number(pad.dataset.pad);
      active.set(e.pointerId, idx);
      const r = pad.getBoundingClientRect();
      this.app.padDown(idx, velocityOf(e, pad), e.timeStamp, e.pointerId, e.clientX - r.left, e.clientY - r.top, 'touch');
      pad.classList.add('down');
      if (this.app.seq.noteRepeat) pad.classList.add('held');
    }, { passive: false });
    el.addEventListener('pointermove', (e) => {
      const idx = active.get(e.pointerId); if (idx == null) return;
      if (e.pressure > 0 && e.pressure !== 0.5) this.app.padPressure(e.pointerId, Math.round(18 + 109 * e.pressure));
    });
    const up = (e: PointerEvent) => {
      const idx = active.get(e.pointerId); if (idx == null) return;
      active.delete(e.pointerId); this.app.padUp(e.pointerId);
      if (![...active.values()].includes(idx)) this.pads[idx].classList.remove('held', 'down');
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Screen readers / switch access: a focused pad plays on Enter or Space (TalkBack double-tap sends a click).
    el.addEventListener('keydown', (e) => {
      const pad = (e.target as HTMLElement).closest('.pad') as HTMLElement | null; if (!pad || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault(); e.stopPropagation(); if (e.repeat) return;
      const idx = Number(pad.dataset.pad); this.app.padDown(idx, 100, e.timeStamp, 20000 + idx, undefined, undefined, 'key'); setTimeout(() => this.app.padUp(20000 + idx), 120);
    });
    el.addEventListener('click', (e) => { // TalkBack/VoiceOver activation arrives as a click with no preceding pointerdown
      if ((e as PointerEvent).pointerId > 0 || e.detail > 0) return;
      const pad = (e.target as HTMLElement).closest('.pad') as HTMLElement | null; if (!pad) return;
      const idx = Number(pad.dataset.pad); this.app.padDown(idx, 100, e.timeStamp, 20000 + idx, undefined, undefined, 'key'); setTimeout(() => this.app.padUp(20000 + idx), 120);
    });
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false }); // kills iOS double-tap zoom / 300ms delay / callout
  }

  private keyboard() {
    const down = new Set<string>();
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.closest('input,select,textarea')) return;
      if ((e.code === 'Space' || e.code === 'Enter') && (e.target as HTMLElement)?.closest('button,[role=button],[role=checkbox],[role=radio],[role=tab]')) return;
      if (e.code in KEYMAP) { if (e.repeat || down.has(e.code)) return; down.add(e.code); e.preventDefault();
        const pad16 = KEYMAP[e.code]; this.app.padDown(pad16, e.shiftKey ? 127 : 100, e.timeStamp, 10000 + pad16, undefined, undefined, 'key');
        this.pads[pad16].classList.add('down');
        if (this.app.seq.noteRepeat) this.pads[pad16].classList.add('held'); return; }
      if (e.code === 'Space') { e.preventDefault(); this.app.seq.playing ? this.app.stop() : this.app.play(); }
      else if (e.code === 'Enter') { e.preventDefault(); this.app.toggleRecord(); }
      else if (e.code === 'BracketLeft') this.setBank((this.app.p.currentBank + 7) % 8);
      else if (e.code === 'BracketRight') this.setBank((this.app.p.currentBank + 1) % 8);
      else if (e.code === 'KeyN') { this.app.seq.noteRepeat = !this.app.seq.noteRepeat; this.updateActs(); }
      else if (e.code === 'ArrowUp') this.app.setTempo(this.app.p.bpm + (e.shiftKey ? 10 : 1));
      else if (e.code === 'ArrowDown') this.app.setTempo(this.app.p.bpm - (e.shiftKey ? 10 : 1));
      else if (e.code === 'Escape') this.sheets.close();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code in KEYMAP) { down.delete(e.code); const pad16 = KEYMAP[e.code]; this.app.padUp(10000 + pad16); this.pads[pad16].classList.remove('held', 'down'); }
    });
  }

  setBank(i: number) { this.app.p.currentBank = i; this.app.p.selectedPad = i * 16 + (this.app.p.selectedPad % 16); this.app.save(); this.renderAll(); const b = this.app.bank(this.app.p.bankSources[i]); this.announce(`Bank ${BANKS[i]}, ${b ? b.name : 'empty'}`); }

  // ---------- visuals ----------
  flash(pad16: number, vel: number, x?: number, y?: number) {
    const pad = this.pads[pad16]; if (!pad) return;
    const k = vel / 127; const a = 0.25 + 0.75 * k;
    const reduce = document.body.classList.contains('reduce-motion');
    const cap = pad.querySelector('.cap') as HTMLElement;
    const fl = cap.querySelector('.flash') as HTMLElement;
    const ring = cap.querySelector('.ring') as HTMLElement;
    const glow = pad.querySelector('.glow') as HTMLElement;
    // GPU-cheap: opacity + transform only (no layout, no box-shadow animation)
    fl.animate([{ opacity: a }, { opacity: 0 }], { duration: reduce ? 90 : 120 + 120 * k, easing: 'cubic-bezier(.2,.7,.3,1)' });
    glow.animate([{ opacity: 0.35 + 0.65 * k, transform: `scale(${1 + 0.06 * k})` }, { opacity: 0, transform: 'scale(1)' }], { duration: reduce ? 120 : 220 + 260 * k, easing: 'cubic-bezier(.15,.7,.3,1)' });
    acrylicHit(pad, vel, reduce);
    if (reduce) return;
    ring.animate([{ opacity: a, transform: 'scale(1)' }, { opacity: 0, transform: `scale(${1.04 + 0.12 * k})` }], { duration: 200, easing: 'ease-out' });
    const w = cap.clientWidth, hgt = cap.clientHeight;
    const cx = x ?? w / 2, cy = y ?? hgt / 2;
    const rp = document.createElement('span'); rp.className = 'ripple'; rp.style.left = cx + 'px'; rp.style.top = cy + 'px';
    cap.appendChild(rp);
    const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, hgt - cy)) / 10;
    rp.animate([{ opacity: 0.95 * a, transform: 'scale(0.4)' }, { opacity: 0, transform: `scale(${maxR * (0.6 + 0.4 * k)})` }], { duration: 300 + 220 * k, easing: 'cubic-bezier(.1,.6,.3,1)' }).onfinish = () => rp.remove();
    if (!pad.classList.contains('down')) { // sequenced / MIDI / keyboard hits: short press-travel blip
      cap.animate([{ transform: 'translateY(var(--travel))' }, { transform: 'translateY(0)' }], { duration: 110, easing: 'ease-out' });
    }
  }

  private frame = (now: number) => {
    // sequenced/pre-lit flashes
    if (this.visQ.length) {
      const due = this.visQ.filter((q) => q.t <= now + 4);
      if (due.length) { this.visQ = this.visQ.filter((q) => q.t > now + 4); for (const d of due) if (now - d.t < 120) this.flash(d.pad, d.vel); }
    }
    this.updatePosition();
    requestAnimationFrame(this.frame);
  };

  private lastPosText = '';
  private updatePosition() {
    const a = this.app; const t = a.seq.positionTick(a.engine.ctx ? a.engine.perfToCtx(performance.now()) : 0);
    let txt = '-.-.-';
    if (t >= 0) { const bar = Math.floor(t / (4 * PPQ)); const beat = Math.floor(t / PPQ) % 4; const sixteenth = Math.floor((t % PPQ) / 240); txt = `${bar + 1}.${beat + 1}.${sixteenth + 1}`; }
    else if (a.seq.playing) txt = 'COUNT';
    if (txt !== this.lastPosText) { this.lastPosText = txt; const el = this.els.lcd.querySelector('.pos'); if (el) el.textContent = txt; }
    // playhead
    const st = a.stepTicks(); const col = t >= 0 ? Math.floor(t / st) : -1;
    if (col !== this.headCol) {
      for (const c of this.stepCells) { if (c.col === this.headCol) c.el.classList.remove('head'); if (c.col === col) c.el.classList.add('head'); }
      this.headCol = col;
      if (this.layout === 'phone' || this.orient === 'portrait') {
        const perBar = (4 * PPQ) / st; const bar = col >= 0 ? Math.floor(col / perBar) : -1;
        if (bar >= 0 && bar !== this.barPage && a.seq.playing && a.seq.pattern.bars > 1 && this.followPlayhead) { this.barPage = bar; this.renderSteps(); }
        this.els.editor.querySelectorAll('.bartab').forEach((b, i) => b.classList.toggle('playing', i === bar));
      }
    }
  }
  followPlayhead = true;

  // ---------- layout ----------
  relayout() {
    const W = window.innerWidth, H = window.innerHeight;
    const forced = this.app.p.settings.deviceClass;
    // Auto: tablet when the short side is ≥ 600 px, or a wide landscape window (≥ 1024 × 600, e.g. desktop / iPad split view)
    const tablet = forced === 'tablet' || (forced === 'auto' && (Math.min(W, H) >= 600 || (W >= 1024 && H >= 560)));
    this.layout = tablet ? 'tablet' : 'phone';
    this.orient = W > H ? 'landscape' : 'portrait';
    const r = this.root;
    r.className = `layout-${this.layout} orient-${this.orient} hand-${this.app.p.settings.handedness}`;
    // data-layout = resolved layout on #app; data-layout-mode = the user's choice (auto | phone | tablet) on <html>
    r.dataset.layout = this.layout; r.dataset.orient = this.orient;
    document.documentElement.dataset.layoutMode = forced;
    try { localStorage.setItem('sanctum.layout', forced); } catch {}
    if (this.layout !== 'phone' && this.els.drawer) this.toggleDrawer(false);
    // pad grid size: as big as possible (pads are the hero), keep the editor usable
    const header = 52 + 47; const actions = this.layout === 'phone' ? 58 + 22 : 58;  // phone: + drawer handle
    let size: number;
    if (this.layout === 'phone') {
      if (this.orient === 'landscape') size = Math.min(H - header - actions - 12, W * 0.5);
      else size = Math.min(W - 16, H - header - actions - (H > 760 ? 230 : 120));
    } else if (this.orient === 'landscape') size = Math.min(H * 0.58, (W - 290) * 0.75, H - header - 290);
    else size = Math.min(W - 300, H * 0.5);   // tablet portrait: pads + mixer side by side
    size = Math.max(220, Math.floor(size));
    r.style.setProperty('--grid', size + 'px');
    this.renderSteps();
  }

  // ---------- render ----------
  renderAll() {
    this.renderHeader(); this.renderBanks(); this.renderPads(); this.renderSteps(); this.updateActs();
    if (this.layout === 'tablet' && this.sheets) { this.renderBrowser(); this.renderInspector(); this.renderMacro(); }
  }

  renderHeader() {
    const a = this.app; const l = this.els.lcd;
    (l.querySelector('.bpm') as HTMLElement).textContent = a.p.bpm.toFixed(1);
    (l.querySelector('.swing') as HTMLElement).textContent = a.p.swing + '%';
    (l.querySelector('.quant') as HTMLElement).textContent = a.p.quantize.toUpperCase();
    this.els.rec.classList.toggle('on', a.seq.recording); this.els.rec.setAttribute('aria-pressed', String(a.seq.recording));
    this.els.play.classList.toggle('on', a.seq.playing); this.els.play.setAttribute('aria-label', a.seq.playing ? 'Stop' : 'Play');
    this.els.lcd.setAttribute('aria-label', `Tempo ${a.p.bpm.toFixed(1)} BPM, swing ${a.p.swing} percent. Open tempo and sequencer settings`);
    if (this.layout === 'phone') this.els.play.textContent = a.seq.playing ? '■' : '▶'; else this.els.play.textContent = '▶';
    this.els.patBtn.querySelector('.patn')!.textContent = String(a.p.currentPattern + 1);
    this.renderLatency(); this.renderLink(); this.renderMidi();
  }

  renderLatency() {
    const a = this.app; const el = this.els.lat;
    if (!a.engine.ctx) { el.querySelector('.v')!.textContent = '–'; el.className = 'chip lat'; return; }
    const r = a.latencyReport();
    el.querySelector('.v')!.textContent = `${r.touchToSoundMs.toFixed(0)}ms`;
    el.className = `chip lat ${r.btSuspect ? 'bad' : r.t2sStatus}`;
    el.title = `Estimated touch-to-sound ${r.touchToSoundMs.toFixed(1)} ms (target ≤${r.t2s.target}, ceiling ${r.t2s.ceiling})`;
  }
  renderLink() {
    const a = this.app; const s = a.link.state; const el = this.els.link;
    const on = a.p.settings.linkEnabled;
    el.className = 'chip link ' + (!on ? '' : s.connected && s.available ? (s.peers > 0 ? 'ok' : 'warn') : 'bad');
    el.querySelector('.v')!.textContent = on ? (s.connected ? String(s.peers) : '×') : '';
    el.setAttribute('aria-label', on ? `Ableton Link ${s.connected ? `on, ${s.peers} peers` : 'bridge not connected'}` : 'Ableton Link off');
  }
  renderMidi() {
    const m = this.app.midi.status; const el = this.els.midi;
    el.className = 'chip midi hide-phone ' + (m.enabled ? (m.inputs.length || m.outputs.length ? 'ok' : 'warn') : m.error ? 'bad' : '');
  }

  renderBanks() {
    const a = this.app;
    [...this.els.banks.children].forEach((b, i) => { b.classList.toggle('on', i === a.p.currentBank); b.classList.toggle('has', !!a.p.bankSources[i]); (b as HTMLElement).setAttribute('aria-selected', String(i === a.p.currentBank)); });
    const bank = a.bank(a.p.bankSources[a.p.currentBank]);
    const sel = a.soundOf(a.p.selectedPad);
    const st = bank ? a.bankLoad.get(bank.id) : undefined;
    this.els.info.innerHTML = '';
    this.els.info.append(h('b', {}, `Bank ${BANKS[a.p.currentBank]}`), ` · ${bank ? bank.name : 'empty — tap ♫ Sounds'}${st === 'loading' ? ' (loading…)' : ''}`,
      sel ? h('span', {}, ` · Pad ${(a.p.selectedPad % 16) + 1}: `, h('b', {}, sel.name)) : '');
  }

  renderPads() {
    const a = this.app;
    for (let i = 0; i < 16; i++) {
      const g = a.p.currentBank * 16 + i; const pad = this.pads[i];
      const showG = a.sixteenLevels ? a.p.selectedPad : g;
      const s = a.soundOf(showG); const slot = a.p.pads[showG];
      const cap = pad.querySelector('.cap') as HTMLElement;
      (cap.querySelector('.name') as HTMLElement).textContent = a.sixteenLevels ? `${s?.short || '—'} ${Math.round((i + 1) * 127 / 16)}` : (s?.short || '—');
      (cap.querySelector('.tag') as HTMLElement).textContent = s?.kind === 'loop' ? `LOOP${s.bars ? ' ' + s.bars + 'B' : ''}` : (s?.choke ? 'CHK' : '');
      paintPadInstrument(pad, s);
      pad.classList.toggle('empty', !s);
      pad.classList.toggle('sel', !a.sixteenLevels && g === a.p.selectedPad);
      pad.classList.toggle('muted', !!slot?.mute);
      pad.setAttribute('aria-label', `Pad ${i + 1}, ${s ? s.name : 'empty'}, bank ${BANKS[a.p.currentBank]}${s?.kind === 'loop' ? ', loop' : ''}${a.loops.has(g) ? ', playing' : ''}${slot?.mute ? ', muted' : ''}`);
      const lp = a.loops.get(g);
      const queued = !!lp && lp.at > a.engine.now + 0.01;
      pad.classList.toggle('looping', !!lp && !queued); pad.classList.toggle('queued', queued);
      if (queued) setTimeout(() => this.renderPads(), Math.max(10, (lp!.at - a.engine.now) * 1000 + 10));
    }
  }

  renderSteps() {
    const a = this.app; const ed = this.els.editor; if (!ed) return;
    ed.innerHTML = ''; this.stepCells = []; this.headCol = -1;
    const pat = a.seq.pattern; const st = a.stepTicks(); const perBar = Math.round(4 * PPQ / st); const bars = pat.bars;
    const beatEvery = Math.max(1, Math.round(PPQ / st));
    const tabletGrid = this.layout === 'tablet';
    if (!tabletGrid) {
      if (this.barPage >= bars) this.barPage = 0;
      const sel = a.p.selectedPad; const s = a.soundOf(sel);
      ed.append(h('div', { class: 'bartabs' },
        h('span', {}, `Pad ${(sel % 16) + 1}${s ? ' ' + s.short : ''} · `),
        Array.from({ length: bars }, (_, i) => h('button', { class: 'bartab' + (i === this.barPage ? ' on' : ''), onclick: () => { this.barPage = i; this.followPlayhead = false; this.renderSteps(); } }, `BAR ${i + 1}`)),
        h('button', { class: 'bartab' + (this.followPlayhead ? ' on' : ''), title: 'Follow playhead', onclick: () => { this.followPlayhead = !this.followPlayhead; this.renderSteps(); } }, '⇥')));
      const cols = Math.min(16, perBar);
      const lane = h('div', { class: 'lane', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
      const evs = pat.events.filter((e) => e.p === sel);
      for (let i = 0; i < perBar; i++) {
        const col = this.barPage * perBar + i; const t0 = col * st;
        const ev = evs.find((e) => e.t >= t0 && e.t < t0 + st);
        const c = h('div', { class: 'step' + (i % beatEvery === 0 ? ' beat' : '') + (ev ? ' on' : ''), role: 'checkbox', tabindex: '0', 'aria-checked': ev ? 'true' : 'false', 'aria-label': `Bar ${this.barPage + 1}, step ${i + 1}${s ? ', ' + s.name : ''}`, style: ev ? { '--v': `${Math.round(ev.v / 127 * 100)}%` } : {} });
        c.addEventListener('pointerdown', (e) => { e.preventDefault(); a.toggleStep(sel, t0, st); });
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); a.toggleStep(sel, t0, st); } });
        c.addEventListener('click', (e) => { if (e.detail === 0) a.toggleStep(sel, t0, st); });
        lane.appendChild(c); this.stepCells.push({ el: c, col });
      }
      ed.appendChild(lane);
      if (ed.clientHeight > 200 || window.innerHeight > 760) ed.appendChild(this.bankGrid(true));
      return;
    }
    ed.append(h('div', { class: 'bartabs' }, h('b', {}, `${pat.name}`), ` · ${bars} bar${bars > 1 ? 's' : ''} · grid ${a.p.quantize === 'off' ? '1/16' : a.p.quantize} · swing ${a.p.swing}% · ${pat.events.length} notes`), this.bankGrid(false));
  }

  /** 16-row drum grid of the current bank (tablet editor; mini overview on tall phones). */
  private bankGrid(mini: boolean) {
    const a = this.app; const pat = a.seq.pattern; const st = a.stepTicks(); const perBar = Math.round(4 * PPQ / st); const bars = pat.bars;
    const beatEvery = Math.max(1, Math.round(PPQ / st));
    const total = perBar * bars;
    const wrap = h('div', { class: 'gridwrap' });
    const grid = h('div', { class: 'grid', style: { gridTemplateColumns: `${mini ? 58 : 86}px repeat(${total}, minmax(${mini ? 9 : 16}px, 1fr))` } });
    const byPad = new Map<number, typeof pat.events>();
    for (const e of pat.events) { const l = byPad.get(e.p) || []; l.push(e); byPad.set(e.p, l); }
    for (let r = 15; r >= 0; r--) {
      const g = a.p.currentBank * 16 + r; const s = a.soundOf(g);
      grid.appendChild(h('div', { class: 'rowlbl' + (g === a.p.selectedPad ? ' sel' : ''), onclick: () => { a.p.selectedPad = g; a.emit('select'); } }, `${r + 1} ${s?.short || '—'}`));
      const evs = byPad.get(g) || [];
      for (let col = 0; col < total; col++) {
        const t0 = col * st; const ev = evs.find((e) => e.t >= t0 && e.t < t0 + st);
        const c = h('div', { class: 'step' + (col % beatEvery === 0 ? ' beat' : '') + (col % perBar === 0 && col ? ' barline' : '') + (ev ? ' on' : ''), role: 'checkbox', tabindex: mini ? '-1' : '0', 'aria-checked': ev ? 'true' : 'false', 'aria-label': `Pad ${r + 1}${s ? ' ' + s.name : ''}, bar ${Math.floor(col / perBar) + 1}, step ${(col % perBar) + 1}`, style: ev ? { '--v': `${Math.round(ev.v / 127 * 100)}%` } : {} });
        c.addEventListener('pointerdown', (e) => { e.preventDefault(); a.toggleStep(g, t0, st); });
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); a.toggleStep(g, t0, st); } });
        c.addEventListener('click', (e) => { if (e.detail === 0) a.toggleStep(g, t0, st); });
        grid.appendChild(c); this.stepCells.push({ el: c, col });
      }
    }
    wrap.appendChild(grid);
    return wrap;
  }

  renderBrowser() {
    const a = this.app; const b = this.els.browser; b.innerHTML = '';
    const cur = a.p.bankSources[a.p.currentBank];
    b.append(h('div', { class: 'panel-title' }, `Load into bank ${BANKS[a.p.currentBank]}`));
    for (const bank of a.banks) {
      const st = a.bankLoad.get(bank.id);
      b.append(h('div', { class: 'bankitem' + (bank.id === cur ? ' cur' : ''), role: 'button', onclick: () => { a.assignBank(a.p.currentBank, bank.id); toast(`${bank.name} → Bank ${BANKS[a.p.currentBank]}`); } },
        h('b', {}, bank.name), h('span', {}, bank.status === 'external' ? `External manifest · ${st || 'not loaded'}` : 'Built-in starter · synthesized')));
    }
    b.append(h('div', { class: 'panel-title' }, 'Coming soon'));
    for (const bank of a.comingSoon) b.append(h('div', { class: 'bankitem soon', 'aria-disabled': 'true' }, h('b', {}, bank.name), h('span', {}, bank.description), h('span', { class: 'badge' }, 'COMING SOON')));
    b.append(h('button', { class: 'btn', style: { width: '100%', marginTop: '6px' }, onclick: () => this.sheets.credits() }, 'Credits & licenses'));
  }

  renderInspector() {
    if (!this.sheets) return;
    const el = this.els.inspector; el.innerHTML = '';
    el.append(h('div', { class: 'panel-title' }, 'Pad'), this.sheets.padEditorBody(this.app.p.selectedPad, true), h('div', { class: 'panel-title' }, 'Sequencer'), this.sheets.transportBody(true));
  }

  renderMacro() {
    const a = this.app; const m = this.els.macro; m.innerHTML = '';
    m.append(h('div', { class: 'panel-title' }, 'Mixer & macros'));
    this.macro.tempo = slider('Tempo', 30, 300, 0.5, a.p.bpm, (v) => v.toFixed(1), (v) => a.setTempo(v));
    this.macro.swing = slider('Swing', 50, 75, 1, a.p.swing, (v) => v + '%', (v) => { a.p.swing = v; a.save(); a.ccOut('swing'); this.renderHeader(); });
    this.macro.master = slider('Master', 0, 1, 0.01, a.p.settings.master, (v) => Math.round(v * 100) + '%', (v) => { a.p.settings.master = v; a.engine.setMaster(v); a.save(); a.ccOut('master'); });
    const sel = a.p.pads[a.p.selectedPad];
    this.macro.gain = slider('Pad level', 0, 1.5, 0.01, sel.gain, (v) => Math.round(v * 100) + '%', (v) => { a.p.pads[a.p.selectedPad].gain = v; a.save(); a.ccOut('padLevel'); });
    this.macro.tune = slider('Pad tune', -12, 12, 1, sel.tune, (v) => (v > 0 ? '+' : '') + v + ' st', (v) => { a.p.pads[a.p.selectedPad].tune = v; a.save(); a.ccOut('padTune'); });
    m.append(this.macro.tempo, this.macro.swing, this.macro.master, this.macro.gain, this.macro.tune,
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => this.sheets.timingLab() }, 'Timing Lab'), h('button', { class: 'btn', onclick: () => this.sheets.sync() }, 'Link / MIDI'), h('button', { class: 'btn', onclick: () => this.sheets.settings() }, 'Settings'), h('button', { class: 'btn primary', onclick: () => this.sheets.share() }, '⤴ Share')));
  }

  private onEvent(w: string) {
    switch (w) {
      case 'transport': this.announce(this.app.seq.playing ? (this.app.seq.recording ? 'Recording' : 'Playing') : this.app.seq.recording ? 'Record armed' : 'Stopped'); this.renderHeader(); if (!this.app.seq.playing) { this.headCol = -2; this.updatePosition(); } break;
      case 'tempo': clearTimeout(this.tempoT); this.tempoT = window.setTimeout(() => this.announce(`Tempo ${this.app.p.bpm} beats per minute`), 600); this.renderHeader(); this.macro.tempo?.set(this.app.p.bpm); this.renderPads(); break;
      case 'pattern': this.renderSteps(); this.renderHeader(); break;
      case 'select': this.renderBanks(); this.renderPads(); if (this.layout === 'phone') this.renderSteps(); else { this.renderSteps(); this.renderInspector(); this.renderMacro(); } break;
      case 'banks': this.renderBanks(); this.renderPads(); if (this.layout === 'tablet') { this.renderBrowser(); this.renderSteps(); } break;
      case 'loops': this.renderPads(); break;
      case 'cc': this.renderHeader(); if (this.layout === 'tablet') { this.renderMacro(); this.renderInspector(); } break;
      case 'link': this.renderLink(); break;
      case 'midi': this.renderMidi(); break;
      case 'stats': case 'latency': case 'started': this.renderLatency(); if (w !== 'stats') this.app.checkLatencyLimits(); break;
      case 'theme': this.applyTheme(); break;
      case 'layout': this.relayout(); this.renderAll(); break;
      case 'all': this.applyTheme(); this.relayout(); this.renderAll(); break;
    }
  }
}
