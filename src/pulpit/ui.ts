// Sanctum Pulpit screen — big stage-friendly controls for backing a preacher or singer.
import type { App } from '../app';
import { h, toast, slider } from '../ui/dom';
import { PulpitPlayer, keyName, parseKey, KEY_NAMES } from './player';
import { PROGRESSIONS } from './library';
import { VoiceFollow, type FollowMeter } from './voicefollow';
import { MicKeyDetector } from './keydetect';
import type { KeyResult } from './keydetect';
import { loadFollowMe, FOLLOW_ME_NAME, FOLLOW_ME_SUBTITLE } from '../followme';

export class PulpitUI {
  root: HTMLElement | null = null;
  player: PulpitPlayer;
  follow: VoiceFollow | null = null;
  private keyDetect: MicKeyDetector | null = null;
  private detecting = false;
  private detected: KeyResult | null = null;
  private els: Record<string, HTMLElement> = {};
  private meter: FollowMeter | null = null;
  private raf = 0;

  constructor(private app: App) {
    this.player = new PulpitPlayer(
      app.engine,
      () => app.seq.clock,
      () => app.p.bpm,
      () => app.p.settings.linkEnabled && app.link.state.connected,
    );
    this.player.onChange = () => this.refresh();
    app.on((w) => {
      if (w === 'tempo' || w === 'link') this.player.syncFromProject();
      if (w === 'tempo' && this.player.state.open && app.p.settings.linkEnabled) {
        // Pulpit follows Link/project tempo
        this.player.setBpm(app.p.bpm);
      }
    });
  }

  open() {
    if (this.player.state.stageLock && this.root) { toast('Stage Mode is on — hold UNLOCK to leave'); return; }
    this.player.state.open = true;
    this.mount();
    this.player.ensureSamples();
    this.ensureFollowMe();
    this.loop();
  }
  close() {
    if (this.player.state.stageLock) { toast('Stage Mode locked'); return; }
    this.player.state.open = false;
    this.follow?.stop(); this.player.setFollowVoice(false);
    this.stopKeyDetect();
    cancelAnimationFrame(this.raf);
    this.root?.remove(); this.root = null;
    document.body.classList.remove('pulpit-open', 'stage-lock');
  }

  private mount() {
    this.root?.remove();
    const s = this.player.state;
    const overlay = h('div', { class: 'pulpit', id: 'sanctum-pulpit', role: 'dialog', 'aria-label': 'Follow Me — Preacher Assist' });
    const top = h('header', { class: 'pulpit-top' },
      h('button', { class: 'pulpit-back', 'aria-label': 'Back', onclick: () => this.close() }, '←'),
      h('div', { class: 'pulpit-title' },
        h('b', {}, 'FOLLOW ME'),
        h('span', { class: 'pulpit-sub' }, FOLLOW_ME_SUBTITLE + ' · Sanctum preacher-band backup')),
      h('button', { class: 'pulpit-stage', 'aria-pressed': String(s.stageLock), onclick: () => this.toggleStage() }, 'STAGE'),
    );

    const chord = h('div', { class: 'pulpit-chord', 'aria-live': 'polite' }, h('span', { class: 'pc' }, '—'), h('span', { class: 'cue' }, ''));
    const activity = h('div', { class: 'pulpit-activity' }, s.activity);

    // Key row — hold ~1s to listen
    const keyRow = h('div', { class: 'pulpit-keys', role: 'group', 'aria-label': 'Key' });
    for (const kn of KEY_NAMES) {
      keyRow.append(h('button', {
        class: 'pulpit-key' + (keyName(s.key).replace(/m$/, '') === kn ? ' on' : ''),
        'data-key': kn, 'aria-label': `Key ${kn}`,
        onpointerdown: (e: PointerEvent) => this.keyPointer(kn, e, 'down'),
        onpointerup: (e: PointerEvent) => this.keyPointer(kn, e, 'up'),
        onpointerleave: (e: PointerEvent) => this.keyPointer(kn, e, 'up'),
        onclick: () => this.pickKey(kn),
      }, kn));
    }

    const easy = h('button', { class: 'pulpit-easy', 'aria-label': 'Easy Play — tap for next chord', onclick: () => this.player.easyPlay() },
      h('span', { class: 'big' }, 'EASY PLAY'), h('small', {}, 'tap = next chord'));
    const hit = h('button', { class: 'pulpit-hit', 'aria-label': 'Hit / stab', onclick: () => this.player.hit() }, 'HIT');

    const levels = h('div', { class: 'pulpit-levels' },
      h('div', { class: 'lvl-col shout' },
        h('div', { class: 'lbl' }, 'SHOUT'),
        ...[1, 2, 3, 4].map((n) => h('button', { class: 'lvl', 'data-shout': n, onclick: () => this.player.setShout(this.player.state.shoutLevel === n ? 0 : n) }, String(n))),
      ),
      h('div', { class: 'lvl-col worship' },
        h('div', { class: 'lbl' }, 'WORSHIP'),
        ...[1, 2, 3, 4].map((n) => h('button', { class: 'lvl', 'data-worship': n, onclick: () => this.player.setWorship(this.player.state.worshipLevel === n ? 0 : n) }, String(n))),
      ),
    );
    // swipe on levels
    this.bindSwipe(levels);

    const band = h('div', { class: 'pulpit-band' },
      h('button', { class: 'band', 'data-band': 'full', onclick: () => this.player.setBand('full') }, 'Full Band'),
      h('button', { class: 'band', 'data-band': 'duo', onclick: () => this.player.setBand('duo') }, 'Organ + Drums'),
      h('button', { class: 'band', 'data-band': 'modern', 'aria-label': 'Modern band: 808 bass and trap groove', onclick: () => this.player.setBand('modern') }, 'Modern 808'),
    );

    const mutes = h('div', { class: 'pulpit-mutes' },
      h('button', { class: 'mute', 'data-mute': 'drums', onclick: () => this.player.setDrumsMute(!this.player.state.drumsMute) }, 'Drums'),
      h('button', { class: 'mute', 'data-mute': 'music', onclick: () => this.player.setMusicMute(!this.player.state.musicMute) }, 'Music'),
      h('button', { class: 'stop', onclick: () => this.player.stop(false) }, 'STOP'),
      h('button', { class: 'fade', onclick: () => this.player.stop(true) }, 'FADE'),
    );

    const tempo = slider('Tempo', 40, 180, 1, s.bpm, (v) => v.toFixed(0), (v) => {
      this.player.setBpm(v);
      if (!this.app.p.settings.linkEnabled) this.app.setTempo(v);
    });

    const fmPatterns = this.player.followMe?.listShoutPatterns() || [];
    const chartProgs = this.player.followMe?.listChartProgressions() || [];
    const libOptions = chartProgs.length
      ? chartProgs.map((p) => h('option', { value: p.id, selected: !s.followMePatternId && p.id === s.progressionId }, p.checkByEar && !/check by ear/i.test(p.name) ? p.name + ' — check by ear' : p.name))
      : PROGRESSIONS.map((p) => h('option', { value: p.id, selected: !s.followMePatternId && p.id === s.progressionId }, p.name));
    const prog = h('div', { class: 'pulpit-prog' },
      h('label', {}, FOLLOW_ME_NAME + ' · charts'),
      ...(this.player.followMe?.sourceLabel() ? [h('p', { class: 'note fm-source' }, this.player.followMe.sourceLabel())] : []),
      h('select', { class: 'prog-sel', 'aria-label': FOLLOW_ME_NAME + ' progression',
        onchange: (e: Event) => { this.player.setProgression((e.target as HTMLSelectElement).value); this.refresh(); } },
        ...libOptions),
      h('label', {}, 'Shout loops'),
      h('select', {
        class: 'fm-sel', 'aria-label': FOLLOW_ME_NAME + ' shout pattern',
        onchange: (e: Event) => {
          const v = (e.target as HTMLSelectElement).value;
          if (!v) this.player.setFollowMePattern(null);
          else this.player.setFollowMePattern(v);
          this.refresh();
        },
      },
        h('option', { value: '', selected: !s.followMePatternId }, '— Off (use chart above) —'),
        ...fmPatterns.map((p) => h('option', { value: p.id, selected: p.id === s.followMePatternId }, p.name)),
      ),
      h('button', { class: 'btn', onclick: () => this.openPadsEditor() }, 'Edit sequence'),
    );

    // Voice Follow panel
    const followBtn = h('button', { class: 'pulpit-follow', 'aria-pressed': 'false', onclick: () => this.toggleFollow() },
      h('span', { class: 'big' }, 'FOLLOW VOICE'), h('small', {}, 'mic drives the band'));
    const followMeter = h('div', { class: 'pulpit-follow-meter', hidden: true },
      h('div', { class: 'fm-row' }, h('span', { class: 'fm-lvl' }, ''), h('span', { class: 'fm-note' }, '—'), h('span', { class: 'fm-wpm' }, '0 wpm')),
      h('div', { class: 'fm-action' }, 'Off'),
      h('p', { class: 'fm-warn' }, 'Keep the phone mic away from the speakers (feedback). Works best close to the preacher. Accuracy drops in a loud room.'),
    );
    const sens = slider('Follow sensitivity', 0, 1, 0.05, 0.55, (v) => Math.round(v * 100) + '%', (v) => this.follow?.setSensitivity(v));

    const run = h('div', { class: 'pulpit-runs' },
      h('button', { onclick: () => this.fireRun('up') }, 'Organ run ↑'),
      h('button', { onclick: () => this.fireRun('down') }, 'Organ run ↓'),
      h('button', { onclick: () => this.fireRun('slide') }, 'Slide'),
    );

    overlay.append(top, chord, activity, keyRow, easy, hit, levels, band, mutes, tempo, prog, followBtn, followMeter, sens, run);
    document.body.appendChild(overlay);
    document.body.classList.add('pulpit-open');
    this.root = overlay;
    Object.assign(this.els, { chord, activity, keyRow, easy, levels, band, mutes, followBtn, followMeter, prog });
    this.refresh();
  }

  private async ensureFollowMe() {
    if (this.player.followMe) { this.remountFollowMeSelect(); return; }
    try {
      const eng = await loadFollowMe();
      this.player.attachFollowMe(eng);
      if (this.root) this.mount();
      toast(FOLLOW_ME_NAME + ' · ' + FOLLOW_ME_SUBTITLE + ' · shout reference charts ready (12 keys)');
    } catch (e) {
      console.warn(e);
      toast(FOLLOW_ME_NAME + ' maps unavailable');
    }
  }
  private remountFollowMeSelect() { /* options filled at mount */ }

  private fireRun(kind: 'up' | 'down' | 'slide') {
    this.player.ensureSamples();
    const ch = this.player.state.lastChord;
    const root = 48 + (ch ? ch.root % 12 : this.player.state.key.tonic);
    const rate = Math.pow(2, (root - 60) / 12);
    const id = kind === 'up' ? 'pulpit.run.up' : kind === 'down' ? 'pulpit.run.down' : 'pulpit.run.slide';
    this.app.engine.trigger({ at: 0, id, vel: 0.9, rate, choke: 'pulpit-run', key: 'pulpit-run' });
  }

  private bindSwipe(el: HTMLElement) {
    let x0 = 0;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); });
    el.addEventListener('pointerup', (e) => {
      const dx = e.clientX - x0;
      if (Math.abs(dx) < 50) return;
      if (dx > 0) {
        // swipe right → shout up
        const n = Math.min(4, this.player.state.shoutLevel + 1);
        this.player.setShout(n || 1);
      } else {
        const n = Math.min(4, this.player.state.worshipLevel + 1);
        this.player.setWorship(n || 1);
      }
    });
  }

  private keyHoldTimer = 0;
  private keyPointer(kn: string, e: PointerEvent, phase: 'down' | 'up') {
    if (phase === 'down') {
      clearTimeout(this.keyHoldTimer);
      this.keyHoldTimer = window.setTimeout(() => this.startKeyDetect(kn), 900);
    } else {
      clearTimeout(this.keyHoldTimer);
      if (this.detecting) this.stopKeyDetect(true);
    }
  }
  private pickKey(kn: string) {
    const k = parseKey(kn + (this.player.state.key.mode === 'minor' ? 'm' : ''))!;
    this.player.setKey(k, this.player.state.playing ? 'beat' : 'immediate');
    // also nudge project key context for display
    this.refresh();
  }

  private async startKeyDetect(_kn: string) {
    if (this.detecting) return;
    this.detecting = true;
    try {
      if (!this.app.engine.ctx) await this.app.engine.init();
      await this.app.engine.resume();
      this.keyDetect = new MicKeyDetector(this.app.engine.ctx!);
      this.keyDetect.onResult = (r) => {
        this.detected = r;
        this.root?.querySelectorAll('.pulpit-key').forEach((b) => {
          const kn = (b as HTMLElement).dataset.key!;
          b.classList.toggle('detect', r.best.name.replace(/m$/, '') === kn);
        });
        this.els.activity.textContent = `Hearing ${r.best.name} (${Math.round(r.confidence * 100)}%) — tap to lock`;
      };
      await this.keyDetect.start();
      this.els.activity.textContent = 'Listening for key…';
    } catch (e) {
      this.detecting = false;
      toast('Mic unavailable — pick a key manually');
      this.els.activity.textContent = 'Mic blocked — pick a key';
    }
  }
  private stopKeyDetect(lock = false) {
    if (lock && this.detected && this.detected.confidence > 0.25) {
      const name = this.detected.best.name;
      const k = parseKey(name);
      if (k) this.player.setKey(k, 'immediate');
      toast('Locked ' + name);
    }
    this.keyDetect?.stop(); this.keyDetect = null; this.detecting = false; this.detected = null;
    this.root?.querySelectorAll('.pulpit-key.detect').forEach((b) => b.classList.remove('detect'));
  }

  private toggleStage() {
    const on = !this.player.state.stageLock;
    this.player.setStageLock(on);
    document.body.classList.toggle('stage-lock', on);
    this.root?.querySelector('.pulpit-stage')?.setAttribute('aria-pressed', String(on));
    this.root?.querySelector('.pulpit-back')?.toggleAttribute('disabled', on);
    if (on) toast('Stage Mode: navigation locked');
  }

  private async toggleFollow() {
    if (this.player.state.followVoice) {
      this.follow?.stop(); this.player.setFollowVoice(false);
      this.els.followMeter.hidden = true;
      this.els.followBtn.setAttribute('aria-pressed', 'false');
      return;
    }
    if (!this.app.engine.ctx) await this.app.engine.init();
    await this.app.engine.resume();
    this.follow = new VoiceFollow(
      this.app.engine.ctx!,
      () => this.player.state.key,
      () => this.player.steps().map((s) => s.c),
    );
    this.follow.setSensitivity(0.55);
    this.follow.onMeter = (m) => { this.meter = m; this.paintFollow(); };
    this.follow.onPhraseEnd = () => {
      // Manual always wins — only auto-hit if Follow is on
      if (this.player.state.followVoice) this.player.hit();
    };
    this.follow.onPitchChord = (info) => {
      if (!this.player.state.followVoice) return;
      this.player.triggerToken(info.token, { hit: false });
    };
    this.follow.onLevelSuggest = (lane, level) => {
      if (!this.player.state.followVoice) return;
      // Don't fight a user who just tapped a level in the last moment — simple: always suggest
      if (lane === 'shout') this.player.setShout(level);
      else if (lane === 'worship') this.player.setWorship(level);
      else { if (this.player.state.shoutLevel) this.player.setShout(0); if (this.player.state.worshipLevel) this.player.setWorship(0); }
    };
    this.follow.onTempoHint = (bpm) => {
      if (!this.player.state.followVoice) return;
      if (this.app.p.settings.linkEnabled && this.app.link.state.connected) return; // Link owns tempo
      if (Math.abs(bpm - this.player.state.bpm) >= 4) this.player.setBpm(bpm);
    };
    this.follow.onKeyGuess = (r) => {
      if (!this.player.state.followVoice || r.confidence < 0.55) return;
      // Soft highlight only — don't auto-lock key (user taps to lock via hold-detect)
      this.root?.querySelectorAll('.pulpit-key').forEach((b) => {
        b.classList.toggle('detect', (b as HTMLElement).dataset.key === r.best.name.replace(/m$/, ''));
      });
    };
    const ok = await this.follow.start();
    if (!ok) { toast(this.follow.lastError || 'Mic unavailable'); this.follow = null; return; }
    this.player.setFollowVoice(true);
    if (!this.player.state.playing) this.player.start();
    this.els.followMeter.hidden = false;
    this.els.followBtn.setAttribute('aria-pressed', 'true');
    toast('Follow Voice on — manual taps still override');
  }

  private paintFollow() {
    const m = this.meter; if (!m || !this.els.followMeter) return;
    const lvl = this.els.followMeter.querySelector('.fm-lvl') as HTMLElement;
    const note = this.els.followMeter.querySelector('.fm-note') as HTMLElement;
    const wpm = this.els.followMeter.querySelector('.fm-wpm') as HTMLElement;
    const act = this.els.followMeter.querySelector('.fm-action') as HTMLElement;
    const pct = Math.min(100, Math.round(m.level * 400));
    lvl.style.width = pct + '%';
    note.textContent = m.note || '—';
    wpm.textContent = m.wpm + ' wpm';
    act.textContent = m.action;
  }

  private openPadsEditor() {
    const steps = this.player.steps().map((s) => ({ ...s }));
    const body = h('div', { class: 'pulpit-editor' });
    const list = h('div', { class: 'pulpit-ed-list' });
    const redraw = () => {
      list.innerHTML = '';
      steps.forEach((st, i) => {
        const row = h('div', { class: 'pulpit-ed-row' },
          h('input', { value: st.c, 'aria-label': `Chord ${i + 1}`, oninput: (e: Event) => { st.c = (e.target as HTMLInputElement).value; } }),
          h('label', {}, h('input', { type: 'checkbox', checked: !!st.hit, onchange: (e: Event) => { st.hit = (e.target as HTMLInputElement).checked || undefined; } }), 'hit'),
          h('button', { onclick: () => { steps.splice(i, 1); redraw(); } }, '✕'),
        );
        list.append(row);
      });
    };
    redraw();
    body.append(
      h('p', { class: 'note' }, 'Build your own Easy Play sequence. Tokens are Roman (I, IV, V7) or Nashville (1, 4, 5). Autosaves.'),
      list,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { steps.push({ c: 'I' }); redraw(); } }, '+ Chord'),
        h('button', { class: 'btn primary', onclick: () => { this.player.setCustomSteps(steps); toast('Sequence saved'); sheet.remove(); } }, 'Save'),
        h('button', { class: 'btn', onclick: () => sheet.remove() }, 'Cancel'),
      ),
    );
    const sheet = h('div', { class: 'sheet open pulpit-sheet' }, h('div', { class: 'sheet-card' }, h('header', {}, h('h2', {}, 'Pads sequence'), h('button', { onclick: () => sheet.remove() }, '✕')), body));
    document.body.appendChild(sheet);
  }

  refresh() {
    if (!this.root) return;
    const s = this.player.state;
    const pc = this.els.chord.querySelector('.pc')!;
    const cue = this.els.chord.querySelector('.cue')!;
    pc.textContent = s.lastChord?.name || keyName(s.key);
    const fmName = s.followMePatternId && this.player.followMe?.shoutPattern(s.followMePatternId)?.name;
    cue.textContent = s.cue || fmName || this.player.progression().name;
    this.els.activity.textContent = s.activity + (s.pendingKey ? ` · → ${keyName(s.pendingKey)}` : '');
    this.root.querySelectorAll('.pulpit-key').forEach((b) => {
      const kn = (b as HTMLElement).dataset.key!;
      b.classList.toggle('on', keyName(s.key).replace(/m$/, '') === kn);
    });
    this.root.querySelectorAll('.lvl').forEach((b) => {
      const el = b as HTMLElement;
      if (el.dataset.shout) el.classList.toggle('on', Number(el.dataset.shout) === s.shoutLevel);
      if (el.dataset.worship) el.classList.toggle('on', Number(el.dataset.worship) === s.worshipLevel);
    });
    this.root.querySelectorAll('.band').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.band === s.band));
    this.root.querySelectorAll('.mute').forEach((b) => {
      const el = b as HTMLElement;
      const muted = el.dataset.mute === 'drums' ? s.drumsMute : s.musicMute;
      el.classList.toggle('on', muted); el.setAttribute('aria-pressed', String(muted));
    });
    const sel = this.root.querySelector('.prog-sel') as HTMLSelectElement | null;
    if (sel && !s.followMePatternId && sel.value !== s.progressionId) sel.value = s.progressionId;
    const fmSel = this.root.querySelector('.fm-sel') as HTMLSelectElement | null;
    if (fmSel) {
      const want = s.followMePatternId || '';
      if (fmSel.value !== want) fmSel.value = want;
    }
    if (s.followMePatternId && this.player.followMe) {
      const p = this.player.followMe.shoutPattern(s.followMePatternId);
      if (p) cue.textContent = s.cue || p.name;
    }
  }

  private loop = () => {
    if (!this.player.state.open) return;
    this.player.tick();
    this.raf = requestAnimationFrame(this.loop);
  };
}
