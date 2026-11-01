// Bottom sheets: transport/sequencer, note repeat, pad editor, sounds + credits, settings, sync (Link/MIDI), menu.
import { App } from '../app';
import { BANKS, QUANT_TICKS, listSnapshots, resetProject, type QuantizeKey, type Theme } from '../state';
import { h, seg, toggle, slider, toast } from './dom';
import { LinkClient } from '../sync/link';
import type { View } from './view';
import { timingLabBody } from './timinglab';
import { LockScreen, type GateScreen } from '../license/gate';
import { clearLicense } from '../license/license';
import { storageKind } from '../license/store';
import { REVOKED_IDS } from '../license/revocation';

const QOPTS: { v: QuantizeKey; label: string }[] = (['off', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/32T'] as QuantizeKey[]).map((v) => ({ v, label: v.toUpperCase() }));
const ROPTS: { v: QuantizeKey; label: string }[] = (['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/32T'] as QuantizeKey[]).map((v) => ({ v, label: v.toUpperCase() }));

export class Sheets {
  private back: HTMLElement | null = null;
  private updater: (() => void) | null = null;
  private unsub: (() => void) | null = null;
  constructor(private app: App, private view: View) {
    app.on((w) => { if (this.updater && (w === 'stats' || w === 'link' || w === 'midi' || w === 'latency' || w === 'tempo' || w === 'transport')) this.updater(); });
  }

  open(title: string, body: HTMLElement, update?: () => void) {
    this.close();
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', {}, h('h2', {}, title), h('button', { class: 'btn', 'aria-label': 'Close', onclick: () => this.close() }, 'Done')),
      h('div', { class: 'body' }, body));
    this.back = h('div', { class: 'sheet-back', onpointerdown: (e: PointerEvent) => { if (e.target === this.back) this.close(); } }, sheet);
    document.body.appendChild(this.back);
    this.updater = update || null;
  }
  close() { this.back?.remove(); this.back = null; this.updater = null; this.unsub?.(); this.unsub = null; }

  menu() {
    const items: [string, () => void][] = [
      ['Tempo & Sequencer', () => this.transport()], ['Note Repeat', () => this.noteRepeat()], ['Pad Editor', () => this.padEditor(this.app.p.selectedPad)],
      ['Sounds', () => this.sounds()], ['Timing Lab', () => this.timingLab()], ['Link & MIDI', () => this.sync()],
      ['Settings & Theme', () => this.settings()], ['Credits', () => this.credits()], ['Help', () => this.help()], ...(this.app.isAdmin ? [['Admin', () => this.admin()] as [string, () => void]] : []),
    ];
    this.open('Sanctum', h('div', { class: 'menu-grid' }, items.map(([l, f]) => h('button', { onclick: f }, l))));
  }

  transportBody(compact = false) {
    const a = this.app; const p = a.p;
    const tempo = slider('Tempo', 30, 300, 0.5, p.bpm, (v) => v.toFixed(1), (v) => a.setTempo(v));
    let taps: number[] = [];
    const tap = h('button', { class: 'btn', onpointerdown: (e: PointerEvent) => {
      const t = e.timeStamp; taps = taps.filter((x) => t - x < 2500); taps.push(t);
      if (taps.length >= 3) { const d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); a.setTempo(Math.round(60000 / d * 10) / 10); tempo.set(a.p.bpm); }
    } }, 'TAP');
    const nudge = (d: number) => h('button', { class: 'btn', onclick: () => { a.setTempo(a.p.bpm + d); tempo.set(a.p.bpm); } }, (d > 0 ? '+' : '') + d);
    const swing = slider('Swing', 50, 75, 1, p.swing, (v) => v + '%', (v) => { p.swing = v; a.save(); this.view.renderHeader(); }, () => this.view.renderSteps());
    return h('div', {},
      tempo, h('div', { class: 'row' }, nudge(-1), nudge(-0.1), nudge(0.1), nudge(1), tap),
      h('div', { class: 'row' }, h('label', {}, 'Pattern'), seg(p.patterns.map((_, i) => ({ v: i, label: String(i + 1) })), p.currentPattern, (v) => { p.currentPattern = v; a.save(); a.emit('pattern'); })),
      h('div', { class: 'row' }, h('label', {}, 'Length'), seg([1, 2, 3, 4, 8].map((v) => ({ v, label: `${v} bar${v > 1 ? 's' : ''}` })), a.seq.pattern.bars, (v) => a.setBars(v))),
      swing,
      h('div', { class: 'row' }, h('label', {}, 'Swing on'), seg([{ v: 16 as 8 | 16, label: '1/16' }, { v: 8 as 8 | 16, label: '1/8' }], p.swingRes, (v) => { p.swingRes = v; a.save(); })),
      h('div', { class: 'row' }, h('label', {}, 'Quantize (record + grid)'), seg(QOPTS, p.quantize, (v) => { p.quantize = v; a.save(); a.emit('pattern'); })),
      h('div', { class: 'row' }, toggle('Metronome', p.settings.metronome, (v) => { p.settings.metronome = v; a.save(); }), toggle('Count-in (1 bar)', p.settings.countIn, (v) => { p.settings.countIn = v; a.save(); })),
      h('div', { class: 'row' }, h('label', {}, 'Loop launch'), seg([{ v: 'bar' as const, label: 'Next bar' }, { v: 'beat' as const, label: 'Next beat' }], p.settings.loopLaunch, (v) => { p.settings.loopLaunch = v; a.save(); })),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { a.clearPad(a.p.selectedPad); toast('Pad events cleared'); } }, 'Clear pad'),
        h('button', { class: 'btn danger', onclick: () => { if (confirm('Clear all notes in this pattern?')) a.clearPattern(); } }, 'Clear pattern')),
      compact ? null : h('p', { class: 'note' }, 'Swing is non-destructive (applied at playback, MPC-style: 50% straight, 66% ≈ triplet). Recorded hits are corrected for touch latency (Timing Lab) and then quantized.'));
  }
  transport() { this.open('Tempo & Sequencer', this.transportBody()); }

  noteRepeat() {
    const a = this.app;
    this.open('Note Repeat', h('div', {},
      h('div', { class: 'row' }, toggle('Note repeat on (hold a pad)', a.seq.noteRepeat, (v) => { a.seq.noteRepeat = v; this.view.updateActs(); })),
      h('div', { class: 'row' }, h('label', {}, 'Rate'), seg(ROPTS, a.p.noteRepeatRate, (v) => { a.p.noteRepeatRate = v; a.save(); this.view.updateActs(); })),
      h('p', { class: 'note' }, 'Repeats lock to the tempo grid and follow swing. Pressure / finger-area changes while holding update the repeat velocity where the device reports it. With REC on, repeats are recorded into the pattern.')));
  }

  padEditorBody(global: number, compact = false) {
    const a = this.app; const slot = a.p.pads[global]; const s = a.soundOf(global);
    const sel = h('select', { 'aria-label': 'Sound', onchange: () => { slot.sound = sel.value || null; a.save(); a.emit('banks'); const b = a.banks.find((b) => b.sounds.some((x) => x?.id === sel.value)); if (b) a.ensureBankLoaded(b.id); } });
    sel.append(h('option', { value: '' }, '— empty —'));
    for (const b of a.banks) {
      const og = h('optgroup', { label: b.name });
      for (const x of b.sounds) if (x) og.append(h('option', { value: x.id, selected: x.id === slot.sound }, `${x.name}${x.kind === 'loop' ? ` (loop ${x.bpm} BPM)` : ''}`));
      sel.append(og);
    }
    return h('div', {},
      h('div', { class: 'row' }, h('b', {}, `Bank ${BANKS[Math.floor(global / 16)]} · Pad ${(global % 16) + 1}`), s?.kind === 'loop' ? h('span', { class: 'note' }, `Loop · ${s.bars} bars · ${s.bpm} BPM · key ${s.key ?? '–'} · choke ${s.choke ?? '–'}`) : s?.choke ? h('span', { class: 'note' }, `Choke group: ${s.choke}`) : null),
      h('div', { class: 'row' }, sel),
      compact ? null : slider('Level', 0, 1.5, 0.01, slot.gain, (v) => Math.round(v * 100) + '%', (v) => { slot.gain = v; a.save(); }),
      slider('Pan', -1, 1, 0.05, slot.pan, (v) => (v === 0 ? 'C' : v < 0 ? 'L' + Math.round(-v * 100) : 'R' + Math.round(v * 100)), (v) => { slot.pan = v; a.save(); }),
      compact ? null : slider('Tune', -12, 12, 1, slot.tune, (v) => (v > 0 ? '+' : '') + v + ' st', (v) => { slot.tune = v; a.save(); if (a.loops.has(global)) a.updateLoopRates(); }),
      h('div', { class: 'row' }, toggle('Mute (pad dims to 30%)', slot.mute, (v) => { slot.mute = v; a.save(); a.emit('banks'); }),
        h('button', { class: 'btn', onclick: () => a.voice(global, 110, 0, 'live') }, 'Preview')),
      s ? h('p', { class: 'note' }, `Credit: ${s.credit.author} — ${s.credit.license}`) : null);
  }
  padEditor(global: number) { this.open('Pad Editor', this.padEditorBody(global)); }

  sounds() {
    const a = this.app; const cur = a.p.currentBank;
    const list = h('div', {});
    const render = () => {
      list.innerHTML = '';
      list.append(h('p', { class: 'note' }, `Tap a soundbank to load it into Bank ${BANKS[cur]}. Pad banks A–H each hold 16 pads (128 total).`));
      list.append(h('h3', {}, 'Bank assignments'), h('div', { class: 'kv' }, BANKS.flatMap((b, i) => [h('div', {}, `Bank ${b}`), h('div', {}, a.bank(a.p.bankSources[i])?.name || '— empty —')])));
      list.append(h('h3', {}, 'Starter banks (built-in, synthesized)'));
      for (const b of a.banks.filter((b) => b.status === 'ready')) list.append(this.bankItem(b.id, b.name, b.description, () => { a.assignBank(cur, b.id); render(); }));
      const ext = a.banks.filter((b) => b.status === 'external');
      list.append(h('h3', {}, 'Extra banks (content/church-banks/manifest.json)'));
      if (!ext.length) list.append(h('p', { class: 'note' }, 'No external manifest found.'));
      for (const b of ext) list.append(this.bankItem(b.id, b.name, `${b.description} · ${a.bankLoad.get(b.id) || 'not loaded'} · loops start on the next bar, follow project tempo (playbackRate = project BPM / loop BPM), choke groups cut at the bar line`, () => { a.assignBank(cur, b.id); render(); }));
      list.append(h('h3', {}, 'Coming soon'));
      for (const b of a.comingSoon) list.append(h('div', { class: 'bankitem soon', 'aria-disabled': 'true' }, h('b', {}, b.name), h('span', {}, b.description), h('span', { class: 'badge' }, 'COMING SOON')));
      list.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => this.credits() }, 'Credits & licenses')));
    };
    render();
    this.open('Sounds', list);
  }
  private bankItem(id: string, name: string, desc: string, onClick: () => void) {
    const cur = this.app.p.bankSources[this.app.p.currentBank] === id;
    return h('div', { class: 'bankitem' + (cur ? ' cur' : ''), role: 'button', onclick: () => { onClick(); toast(`${name} → Bank ${BANKS[this.app.p.currentBank]}`); } }, h('b', {}, name), h('span', {}, desc));
  }

  credits() {
    const a = this.app;
    const body = h('div', { class: 'credits' },
      h('p', { class: 'note' }, 'Bundled-bank policy (soundbanks.md): only owned, CC0, or cleared content. No Splice / Loopmasters content ships in Sanctum. Freesound was not used tonight (downloads need an API key/account), so both starter banks are synthesized in-app.'));
    for (const b of a.banks) {
      body.append(h('h3', {}, b.name));
      body.append(h('ul', { class: 'list' }, b.sounds.filter(Boolean).map((s) => h('li', {}, h('b', {}, s!.name), ` — ${s!.credit.author}. License: ${s!.credit.license}.`,
        s!.credit.url ? [' ', h('a', { href: s!.credit.url, target: '_blank', rel: 'noopener' }, 'link')] : s!.credit.source ? ` Source: ${s!.credit.source}.` : '', s!.credit.note ? ` ${s!.credit.note}` : ''))));
    }
    body.append(h('h3', {}, 'Software'), h('ul', { class: 'list' }, h('li', {}, 'Ableton Link SDK (bridge only, GPLv2+ / commercial license from Ableton) — https://github.com/Ableton/link'), h('li', {}, 'ws (MIT) — WebSocket server for the bridge'), h('li', {}, 'Vite (MIT), TypeScript (Apache-2.0)')));
    this.open('Credits & Licenses', body);
  }

  settings() {
    const a = this.app; const s = a.p.settings;
    const themes: { v: Theme; label: string; bg: string; fg: string; acc: string }[] = [
      { v: 'dark', label: 'Dark', bg: '#0B0B0F', fg: '#F2EEE6', acc: '#FF6A13' }, { v: 'light', label: 'Light', bg: '#F5F5F2', fg: '#14141A', acc: '#D9530A' }, { v: 'warm', label: 'Warm · MPC60', bg: '#D9D3C7', fg: '#2B2724', acc: '#FF6A13' }];
    const sw = h('div', { class: 'themes' });
    const renderSw = () => { sw.innerHTML = ''; for (const t of themes) sw.append(h('button', { class: 'swatch' + (a.p.theme === t.v ? ' on' : ''), style: { background: t.bg, color: t.fg }, onclick: () => { a.p.theme = t.v; a.save(); a.emit('theme'); renderSw(); } }, t.label, h('span', { style: { height: '8px', borderRadius: '4px', background: t.acc, display: 'block' } }))); };
    renderSw();
    const snaps = listSnapshots();
    this.open('Settings', h('div', {},
      h('h3', {}, 'Theme'), sw,
      h('h3', {}, 'Velocity'),
      h('div', { class: 'row' }, seg([{ v: 'auto', label: 'Auto' }, { v: 'position', label: 'Position' }, { v: 'pressure', label: 'Pressure' }, { v: 'fixed', label: 'Fixed' }] as const as any, s.velocityMode, (v: any) => { s.velocityMode = v; a.save(); }, 'Velocity mode')),
      h('p', { class: 'note' }, 'Auto: uses stylus/3D-touch force when the device reports it, else finger contact size + vertical position (top of pad = loudest). Mouse/keyboard: position / Shift = 127.'),
      slider('Fixed vel', 1, 127, 1, s.fixedVelocity, (v) => String(v), (v) => { s.fixedVelocity = v; a.save(); }),
      slider('Curve', 0.6, 3, 0.1, s.velocityCurve, (v) => v.toFixed(1), (v) => { s.velocityCurve = v; a.save(); }),
      h('h3', {}, 'Layout & feel'),
      h('div', { class: 'row' }, h('label', {}, 'Layout'), seg([{ v: 'auto', label: 'Auto' }, { v: 'phone', label: 'Phone' }, { v: 'tablet', label: 'Tablet' }] as any, s.deviceClass, (v: any) => { s.deviceClass = v; a.save(); a.emit('layout'); })),
      h('div', { class: 'row' }, h('label', {}, 'Dominant hand'), seg([{ v: 'right', label: 'Right' }, { v: 'left', label: 'Left' }] as any, s.handedness, (v: any) => { s.handedness = v; a.save(); a.emit('layout'); })),
      h('div', { class: 'row' }, toggle('Haptics (Android vibrate)', s.haptics, (v) => { s.haptics = v; a.save(); }), toggle('Reduce motion', s.reduceMotion, (v) => { s.reduceMotion = v; a.save(); a.emit('theme'); })),
      slider('Master', 0, 1, 0.01, s.master, (v) => Math.round(v * 100) + '%', (v) => { s.master = v; a.engine.setMaster(v); a.save(); }),
      h('h3', {}, 'Project'),
      h('p', { class: 'note' }, `Autosaved continuously to this device (localStorage). Last save: ${a.p.savedAt ? new Date(a.p.savedAt).toLocaleString() : '—'}. ${snaps.length} rolling snapshot(s).`),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { const blob = new Blob([JSON.stringify(a.p, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = h('a', { href: u, download: 'sanctum-project.json' }); l.click(); } }, 'Export project JSON'),
        snaps.length ? h('button', { class: 'btn', onclick: () => { if (confirm(`Restore snapshot from ${new Date(snaps[0].at).toLocaleString()}?`)) { localStorage.setItem('sanctum.project.v1', snaps[0].json); location.reload(); } } }, 'Restore last snapshot') : null,
        h('button', { class: 'btn danger', onclick: () => { if (confirm('Reset project to defaults?')) { resetProject(); location.reload(); } } }, 'Reset project')),
      h('h3', {}, 'Access'),
      h('p', { class: 'note' }, `Unlocked with ${a.license.type === 'admin' ? 'the owner (admin) code' : a.license.type === 'invite' ? 'an invite code' : 'a subscription'}${a.license.expiry ? ', until ' + new Date(a.license.expiry * 1000).toLocaleDateString() : ''}.`)));
  }

  /** Hidden owner panel: only listed in the menu when the verified license is type "admin". */
  admin() {
    const a = this.app; if (!a.isAdmin) return;
    const L = a.license; const st = a.licenseState;
    const kv = (rows: [string, string][]) => h('div', { class: 'kv' }, rows.flatMap(([k, v]) => [h('div', {}, k), h('div', { class: 'mono' }, v)]));
    const screens: [GateScreen, string][] = [['locked', 'Lock screen'], ['enter', 'Enter code'], ['expired', 'Expired'], ['revoked', 'Revoked'], ['wrong-device', 'Other device'], ['paywall', 'Subscribe'], ['help', 'Help']];
    this.open('Admin', h('div', {},
      h('h3', {}, 'This license'),
      kv([['Type', L.type], ['Plan', L.plan], ['Token id', L.id], ['Issued', new Date(L.issued * 1000).toLocaleString()], ['Expires', L.expiry ? new Date(L.expiry * 1000).toLocaleString() : 'never'],
        ['Device binding', L.deviceBinding ? 'yes' : 'no'], ['This device id', st.deviceId], ['Activated', st.stored?.activatedAt ? new Date(st.stored.activatedAt).toLocaleString() : '—'], ['Stored in', storageKind()], ['Revoked ids in build', String(REVOKED_IDS.length)]]),
      h('h3', {}, 'Issue invites'),
      h('p', { class: 'note' }, 'Invites are minted on the computer that holds the private key: npm run license:invite -- --name "Name" --days 30. The app never contains the private key.'),
      h('h3', {}, 'Preview lock screens'),
      h('div', { class: 'menu-grid' }, screens.map(([v, l]) => h('button', { onclick: () => { this.close(); new LockScreen(st, () => {}, { preview: true }).render(v); } }, l))),
      h('h3', {}, 'Sign out'),
      h('button', { class: 'btn danger', onclick: async () => { if (confirm('Remove the license from this device? You will need a code to get back in.')) { a.save(); await clearLicense(); location.reload(); } } }, 'Remove license from this device')));
  }


  sync() {
    const a = this.app; const s = a.p.settings;
    const linkInfo = h('div', { class: 'kv' }); const phase = h('div', { class: 'phasebar' }); const linkMsg = h('div', {});
    const midiInfo = h('div', {});
    const urlIn = h('input', { type: 'text', value: s.linkUrl, placeholder: LinkClient.defaultUrl(), 'aria-label': 'Bridge URL', onchange: () => { s.linkUrl = urlIn.value.trim(); a.save(); if (s.linkEnabled) { a.setLink(false); a.setLink(true); } } });
    const update = () => {
      const L = a.link.state;
      linkInfo.innerHTML = '';
      const rows: [string, string][] = [['Bridge', s.linkEnabled ? (L.connected ? `connected (${L.backend || '?'})` : 'not connected') : 'off'], ['Peers', s.linkEnabled ? String(L.peers) : '–'],
        ['Session tempo', s.linkEnabled && L.connected ? L.bpm.toFixed(2) : '–'], ['Beat / phase', s.linkEnabled && L.connected ? `${L.beat.toFixed(2)} / ${L.phase.toFixed(2)}` : '–'],
        ['Bridge RTT', L.rttMs ? L.rttMs.toFixed(1) + ' ms' : '–'], ['Phase error (last)', s.linkEnabled && L.connected ? L.offsetMs.toFixed(1) + ' ms' : '–']];
      for (const [k, v] of rows) linkInfo.append(h('div', {}, k), h('div', {}, v));
      const q = L.quantum || 4; phase.style.setProperty('--q', String(q)); phase.innerHTML = '';
      const cur = Math.floor(((a.seq.clock.beatAt(a.engine.perfToCtx(performance.now())) % q) + q) % q);
      for (let i = 0; i < q; i++) phase.append(h('i', { class: s.linkEnabled && L.connected && i === cur ? 'on' : '' }));
      linkMsg.innerHTML = '';
      if (s.linkEnabled && L.error) linkMsg.append(h('div', { class: 'banner bad' }, L.error));
      else if (s.linkEnabled && L.connected && L.peers === 0) linkMsg.append(h('div', { class: 'banner warn' }, 'Bridge connected, no other Link peers yet. Open Ableton Live / another Link app on the same network.'));
      else if (s.linkEnabled && L.connected) linkMsg.append(h('div', { class: 'banner ok' }, `In sync with ${L.peers} Link peer${L.peers > 1 ? 's' : ''}.`));
      const m = a.midi.status;
      midiInfo.innerHTML = '';
      if (!m.supported || m.error) midiInfo.append(h('div', { class: 'banner warn' }, m.error || 'Web MIDI is not available in this browser.'));
      if (m.enabled) midiInfo.append(h('div', { class: 'kv' }, h('div', {}, 'Inputs'), h('div', {}, m.inputs.map((i) => i.name).join(', ') || 'none'), h('div', {}, 'Outputs'), h('div', {}, m.outputs.map((o) => o.name).join(', ') || 'none'),
        h('div', {}, 'Clock in tempo'), h('div', {}, m.clockInBpm ? m.clockInBpm.toFixed(2) : '–'), h('div', {}, 'Last input'), h('div', {}, m.lastIn || '–')));
    };
    const outSel = h('select', { 'aria-label': 'MIDI output', onchange: () => { s.midiOutId = outSel.value; a.midi.outId = outSel.value; a.save(); } });
    const inSel = h('select', { 'aria-label': 'MIDI input', onchange: () => { s.midiInId = inSel.value; a.midi.inId = inSel.value; a.save(); } });
    const fillSel = () => {
      outSel.innerHTML = ''; inSel.innerHTML = '';
      outSel.append(h('option', { value: '' }, 'All outputs')); inSel.append(h('option', { value: '' }, 'All inputs (omni)'));
      for (const o of a.midi.status.outputs) outSel.append(h('option', { value: o.id, selected: o.id === s.midiOutId }, o.name));
      for (const i of a.midi.status.inputs) inSel.append(h('option', { value: i.id, selected: i.id === s.midiInId }, i.name));
    };
    fillSel();
    const offs = a.on((w) => { if (w === 'midi') fillSel(); });
    update();
    this.open('Link & MIDI Sync', h('div', {},
      h('h3', {}, 'Ableton Link'),
      h('div', { class: 'row' }, toggle('Link (via Sanctum bridge)', s.linkEnabled, (v) => { a.setLink(v); update(); }),
        h('label', {}, 'Quantum'), seg([2, 4, 8].map((v) => ({ v, label: String(v) })), s.linkQuantum, (v) => { s.linkQuantum = v; a.link.setQuantum(v); a.save(); })),
      linkMsg, phase, linkInfo,
      h('div', { class: 'row' }, h('label', {}, 'Bridge URL'), urlIn),
      h('p', { class: 'note' }, 'Browsers can\'t join Link directly (UDP multicast), so run the bridge on a computer on the same network: "npm run bridge". The dev/preview server proxies /link to it, so the default URL works from phones too. Tempo changes here are proposed to the whole Link session; Play starts on the next quantum boundary.'),
      h('h3', {}, 'MIDI (Web MIDI — USB / class-compliant)'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async () => { await a.midi.enable(); fillSel(); update(); } }, a.midi.status.enabled ? 'Rescan MIDI' : 'Enable MIDI')),
      midiInfo,
      h('div', { class: 'row' }, h('label', {}, 'Output'), outSel), h('div', { class: 'row' }, h('label', {}, 'Input'), inSel),
      h('div', { class: 'row' }, toggle('Send MIDI clock + Start/Stop', s.midiClockOut, (v) => { s.midiClockOut = v; a.save(); if (v) a.midi.enable(); }),
        toggle('Follow MIDI clock in', s.midiClockIn, (v) => { s.midiClockIn = v; a.midi.clockIn = v; a.save(); if (v) a.midi.enable(); }),
        toggle('MIDI notes play pads (omni, 36–51 = pads 1–16)', s.midiNotesIn, (v) => { s.midiNotesIn = v; a.save(); })),
      slider('Clock offset', -50, 50, 1, s.midiClockOffsetMs, (v) => v + ' ms', (v) => { s.midiClockOffsetMs = v; a.save(); }),
      h('p', { class: 'note' }, 'Clock out is scheduled ahead with Web MIDI timestamps from the audio clock (no callback jitter). Logic can\'t receive MIDI clock — use Link, or make Logic the master and enable "Follow MIDI clock in". No MIDI 2.0 in this prototype.')),
      () => { update(); });
    const prevClose = this.unsub; this.unsub = () => { offs(); prevClose?.(); };
  }

  timingLab() { const { el, update } = timingLabBody(this.app); this.open('Timing Lab', el, update); }

  help() {
    this.open('Help', h('div', { class: 'note', style: { fontSize: '14px' } },
      h('p', {}, h('b', {}, 'Play: '), 'tap pads (multi-touch). Velocity follows force/contact size/position (Settings). Keyboard: 1-4 / Q-R / A-F / Z-V = pads 13-16 … 1-4, Shift = full velocity, Space = play/stop, Enter = record, [ ] = bank, N = note repeat, ↑↓ = tempo.'),
      h('p', {}, h('b', {}, 'Record: '), 'REC starts the transport (count-in optional). Hits are latency-corrected and quantized. Or tap steps in the grid.'),
      h('p', {}, h('b', {}, 'Note repeat: '), 'toggle NOTE RPT, hold pads. RATE cycles 1/4 … 1/32T. Long-press NOTE RPT for options.'),
      h('p', {}, h('b', {}, 'Loops: '), 'church banks (C–F) contain tempo-synced loops: tap to start on the next bar, tap again to stop; loops in the same choke group replace each other at the bar line.'),
      h('p', {}, h('b', {}, 'Timing: '), 'the ⚡ chip shows estimated touch-to-sound; tap it for the Timing Lab (buffer size, loopback + tap tests, correction).')));
  }
}
