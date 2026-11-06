// Sanctum Chords sheet: Live · Import · Theory. Consistent with existing sheet UI.
import './chords.css';
import type { App } from '../app';
import { h, toast, toggle } from '../ui/dom';
import { LiveChordDetector } from './live';
import { analyseArrayBuffer, analyseUrl, chartToText, chartToJson, groupByBar, probeDecodeSupport } from './offline';
import { ADAPTERS, listChurchBankLoops, setSourceConfig, getSourceConfig } from './sources';
import { theoryPanel, parseKeySafe, keyName, relativeKey, annotateRoman } from './theory-ext';
import { pushChordsToScreen, formatChartSection } from './screen-push';
import { ScreenLink } from '../integrations/screen';
import { loadConfig } from '../integrations/config';
import type { ChordChart, LiveChordState } from './types';

type Tab = 'live' | 'import' | 'theory';

export class ChordsUI {
  private live: LiveChordDetector | null = null;
  private tab: Tab = 'live';
  private state: LiveChordState | null = null;
  private chart: ChordChart | null = null;
  private showOnScreen = false;
  private screen: ScreenLink | null = null;
  private body: HTMLElement | null = null;
  private playAudio: HTMLAudioElement | null = null;
  private playUrl: string | null = null;
  private cursorBar = 1;

  constructor(private app: App, private openSheet: (title: string, body: HTMLElement, update?: () => void) => void) {}

  open() {
    this.body = h('div', { class: 'chords-ui', id: 'sanctum-chords' });
    this.render();
    this.openSheet('Chords', this.body, () => this.refreshLiveDom());
  }

  private render() {
    if (!this.body) return;
    this.body.innerHTML = '';
    const tabs = h('div', { class: 'chords-tabs', role: 'tablist' },
      (['live', 'import', 'theory'] as Tab[]).map((t) => h('button', {
        class: this.tab === t ? 'on' : '', role: 'tab', 'aria-selected': String(this.tab === t),
        onclick: () => { this.tab = t; this.render(); },
      }, t === 'live' ? 'Live' : t === 'import' ? 'Import' : 'Theory')),
    );
    this.body.append(tabs);
    if (this.tab === 'live') this.body.append(this.livePanel());
    else if (this.tab === 'import') this.body.append(this.importPanel());
    else this.body.append(this.theoryPanelEl());
  }

  private livePanel() {
    const s = this.state;
    const cur = s?.current;
    const conf = h('div', { class: 'chords-conf' }, h('i', { style: { width: `${Math.round((cur?.confidence || 0) * 100)}%` } }));
    const big = h('div', { class: 'chords-live-chord' },
      h('div', { class: 'big', 'aria-live': 'polite', id: 'chords-current' }, cur?.label || '—'),
      h('div', { class: 'meta', id: 'chords-meta' }, this.metaLine(s)),
      conf,
    );
    const hist = h('div', { class: 'chords-history', id: 'chords-history', 'aria-label': 'Chord history' },
      ...(s?.history || []).map((c) => h('div', { class: 'hitem' }, c.label)),
    );
    const next = h('div', { class: 'chords-next', id: 'chords-next' },
      h('span', { class: 'note' }, 'Likely next:'),
      ...(s?.nextLikely || []).map((n) => h('span', { class: 'pill' }, `${n.label} (${n.roman})`)),
    );
    const level = h('div', { class: 'chords-level', title: 'Input level' }, h('i', { id: 'chords-level', style: { width: `${Math.min(100, (s?.level || 0) * 400)}%` } }));
    const startBtn = h('button', { class: 'btn primary', id: 'chords-mic', onclick: () => this.toggleMic() },
      this.live?.running ? 'Stop listening' : 'Start mic / line-in');
    const screenToggle = toggle('Show chords on screen (Lampstand)', this.showOnScreen, (v) => {
      this.showOnScreen = v;
      if (v) this.ensureScreen();
      this.pushScreen();
      toast(v ? 'Chord push to Lampstand on' : 'Chord push off');
    });
    return h('div', {},
      h('p', { class: 'note' }, 'On-device chromagram + templates + smoothing. Mic is analysis-only (never routed to speakers).'),
      big, level, hist, next,
      h('div', { class: 'chords-row' }, startBtn),
      h('div', { class: 'chords-row' }, screenToggle),
    );
  }

  private metaLine(s: LiveChordState | null | undefined) {
    if (!s?.current) return 'Waiting for audio…';
    const k = s.key ? `Key ${s.key.name}` : '';
    const r = s.current.roman ? ` · ${s.current.roman}` : '';
    const c = ` · ${Math.round(s.current.confidence * 100)}%`;
    const rel = s.key ? ` · rel ${keyName(relativeKey({ tonic: s.key.tonic, mode: s.key.mode }))}` : '';
    return k + r + c + rel;
  }

  private refreshLiveDom() {
    if (this.tab !== 'live' || !this.body) return;
    const s = this.state;
    const cur = this.body.querySelector('#chords-current');
    const meta = this.body.querySelector('#chords-meta');
    const hist = this.body.querySelector('#chords-history');
    const next = this.body.querySelector('#chords-next');
    const lvl = this.body.querySelector('#chords-level') as HTMLElement | null;
    const conf = this.body.querySelector('.chords-conf > i') as HTMLElement | null;
    if (cur) cur.textContent = s?.current?.label || '—';
    if (meta) meta.textContent = this.metaLine(s);
    if (conf) conf.style.width = `${Math.round((s?.current?.confidence || 0) * 100)}%`;
    if (lvl) lvl.style.width = `${Math.min(100, (s?.level || 0) * 400)}%`;
    if (hist && s) {
      hist.innerHTML = '';
      for (const c of s.history) hist.append(h('div', { class: 'hitem' }, c.label));
    }
    if (next && s) {
      next.innerHTML = '';
      next.append(h('span', { class: 'note' }, 'Likely next:'));
      for (const n of s.nextLikely) next.append(h('span', { class: 'pill' }, `${n.label} (${n.roman})`));
    }
  }

  private async toggleMic() {
    try {
      if (!this.app.started) await this.app.start();
      if (this.live?.running) {
        this.live.stop(); this.live = null;
        toast('Listening stopped');
        this.render();
        return;
      }
      const ctx = this.app.engine.ctx;
      if (!ctx) throw new Error('Audio engine not ready');
      this.live = new LiveChordDetector(ctx);
      this.live.onUpdate = (st) => {
        this.state = st;
        this.refreshLiveDom();
        this.pushScreen();
      };
      await this.live.start();
      toast('Listening for chords');
      this.render();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  private ensureScreen() {
    if (this.screen) return;
    const cfg = () => loadConfig();
    this.screen = new ScreenLink(cfg);
    if (cfg().screenOn) this.screen.link.start();
  }

  private pushScreen() {
    if (!this.showOnScreen) return;
    this.ensureScreen();
    const s = this.state;
    pushChordsToScreen(this.screen, {
      current: s?.current?.label || this.chart?.chords[0]?.label || '—',
      next: s?.nextLikely[0]?.label,
      roman: s?.current?.roman,
      key: s?.key?.name || this.chart?.key?.name,
      chartLine: this.chart ? formatChartSection(this.chart.chords, 0, 4) : undefined,
    }, { enabled: true });
  }

  private importPanel() {
    const status = h('p', { class: 'note', id: 'chords-import-status' }, 'Pick a legal source. YouTube and stream ripping are not available.');
    const chartEl = h('pre', { class: 'chords-chart', id: 'chords-chart' }, this.chart ? chartToText(this.chart) : 'No chart yet.');
    const file = h('input', {
      type: 'file', accept: 'audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg', 'aria-label': 'Audio file',
      onchange: async () => {
        const f = (file as HTMLInputElement).files?.[0];
        if (!f) return;
        status.textContent = `Decoding ${f.name}…`;
        const buf = await f.arrayBuffer();
        if (!this.app.started) await this.app.start();
        const r = await analyseArrayBuffer(buf, { title: f.name }, this.app.engine.ctx || undefined);
        if (r.error) { status.textContent = r.error; toast(r.error); return; }
        this.chart = r.chart;
        chartEl.textContent = chartToText(r.chart);
        status.textContent = `Analysed ${f.name} · ${r.chart.chords.filter((c) => c.label !== 'N').length} chords · ${r.chart.key?.name || '?'} · ${r.chart.bpm || '—'} BPM`;
        this.wirePlayback(f);
        this.pushScreen();
      },
    });
    const urlInp = h('input', { type: 'url', placeholder: 'https://…/song.wav (CORS required)' }) as HTMLInputElement;
    const urlBtn = h('button', { class: 'btn', onclick: async () => {
      status.textContent = 'Fetching…';
      if (!this.app.started) await this.app.start();
      const r = await analyseUrl(urlInp.value.trim(), this.app.engine.ctx || undefined);
      if (r.error) { status.textContent = r.error; toast(r.error); return; }
      this.chart = r.chart;
      chartEl.textContent = chartToText(r.chart);
      status.textContent = `URL analysed · ${r.chart.key?.name || '?'}`;
      this.pushScreen();
    } }, 'Analyse URL');

    const adapters = h('div', { class: 'chords-import-grid' },
      ADAPTERS.map((a) => h('button', {
        class: 'src',
        onclick: () => this.onAdapter(a.id, status, chartEl),
      }, h('b', {}, a.label), h('small', {}, `${a.capability} · ${a.description}`))),
    );

    const exportRow = h('div', { class: 'chords-row' },
      h('button', { class: 'btn', onclick: () => this.exportText() }, 'Export text'),
      h('button', { class: 'btn', onclick: () => this.exportJson() }, 'Export JSON'),
    );

    const support = h('p', { class: 'note' }, 'Decode: WAV/MP3 universal; AAC/M4A usually OK; FLAC varies on Android WebView; OGG no on Safari. See docs/chord-import-sources.md.');

    return h('div', {},
      h('h3', {}, 'File'), file,
      h('h3', {}, 'Direct URL'), h('div', { class: 'chords-row' }, urlInp, urlBtn),
      h('h3', {}, 'Sources'), adapters,
      status, chartEl, exportRow, support,
      h('div', { id: 'chords-player' }),
    );
  }

  private async onAdapter(id: string, status: HTMLElement, chartEl: HTMLElement) {
    if (id === 'file') { toast('Use the file picker above'); return; }
    if (id === 'url') { toast('Paste a URL above'); return; }
    if (id === 'church-banks') {
      status.textContent = 'Loading church banks…';
      const loops = await listChurchBankLoops();
      if (!loops.length) { status.textContent = 'No church-bank loops found (manifest empty or missing).'; return; }
      const pick = loops[0];
      status.textContent = `Analysing ${pick.name}…`;
      if (!this.app.started) await this.app.start();
      const res = await fetch(pick.path);
      if (!res.ok) { status.textContent = `HTTP ${res.status}`; return; }
      const r = await analyseArrayBuffer(await res.arrayBuffer(), { title: pick.name, key: pick.key, bpm: pick.bpm, url: pick.path }, this.app.engine.ctx || undefined);
      if (r.error) { status.textContent = r.error; return; }
      this.chart = r.chart;
      chartEl.textContent = chartToText(r.chart);
      status.textContent = `${pick.name} · ${loops.length} loops available · showing first`;
      return;
    }
    if (id === 'bandcamp') {
      status.textContent = 'Bandcamp purchases → use File upload. No public API / no ripping.';
      return;
    }
    if (id === 'spotify' || id === 'apple-music' || id === 'soundcloud') {
      const a = ADAPTERS.find((x) => x.id === id)!;
      const q = prompt(id === 'soundcloud' ? 'SoundCloud track URL' : 'Track name or URI (metadata only)') || '';
      const r = await a.resolve(q);
      status.textContent = (r.meta.title || id) + ' — ' + (r.meta.notes || r.error || 'ok');
      if (r.error) toast(r.error);
      return;
    }
  }

  private wirePlayback(file: File) {
    const host = this.body?.querySelector('#chords-player');
    if (!host) return;
    host.innerHTML = '';
    if (this.playUrl) URL.revokeObjectURL(this.playUrl);
    this.playUrl = URL.createObjectURL(file);
    this.playAudio = h('audio', { controls: true, src: this.playUrl, style: { width: '100%' } }) as HTMLAudioElement;
    this.playAudio.addEventListener('timeupdate', () => this.syncCursor());
    host.append(h('h3', {}, 'Playback'), this.playAudio, h('p', { class: 'note' }, 'Cursor highlights the current bar in the chart when tempo was detected.'));
  }

  private syncCursor() {
    if (!this.chart?.bpm || !this.playAudio) return;
    const barDur = (60 / this.chart.bpm) * 4;
    const bar = Math.max(1, Math.floor(this.playAudio.currentTime / barDur) + 1);
    if (bar === this.cursorBar) return;
    this.cursorBar = bar;
    const pre = this.body?.querySelector('#chords-chart');
    if (!pre || !this.chart) return;
    const groups = groupByBar(this.chart.chords, this.chart.bpm, this.chart.duration);
    pre.innerHTML = '';
    for (const g of groups) {
      const line = `Bar ${g.bar}: ${g.chords.length ? g.chords.map((c) => c.label).join(' | ') : '—'}`;
      pre.append(h('div', { class: g.bar === bar ? 'cursor-line' : '' }, line));
    }
  }

  private exportText() {
    if (!this.chart) { toast('Nothing to export'); return; }
    this.downloadBlob(new Blob([chartToText(this.chart)], { type: 'text/plain' }), 'sanctum-chords.txt');
  }
  private exportJson() {
    if (!this.chart) { toast('Nothing to export'); return; }
    this.downloadBlob(new Blob([chartToJson(this.chart)], { type: 'application/json' }), 'sanctum-chords.json');
  }
  private downloadBlob(b: Blob, name: string) {
    const a = h('a', { href: URL.createObjectURL(b), download: name }) as HTMLAnchorElement;
    document.body.appendChild(a); a.click(); a.remove();
  }

  private theoryPanelEl() {
    const key = this.state?.key
      ? { tonic: this.state.key.tonic, mode: this.state.key.mode }
      : this.chart?.key
        ? { tonic: this.chart.key.tonic, mode: this.chart.key.mode }
        : parseKeySafe('C');
    const panel = theoryPanel(key, this.state?.current || null);
    return h('div', { class: 'chords-theory' },
      h('div', { class: 'kv' },
        h('div', {}, 'Key'), h('div', {}, panel.keyName),
        h('div', {}, 'Relative'), h('div', {}, panel.relativeName),
        h('div', {}, 'Current Roman'), h('div', {}, panel.currentRoman),
        h('div', {}, 'Maps'), h('div', {}, panel.mapsSource),
      ),
      h('h3', {}, 'Diatonic chords'),
      h('div', { class: 'dia' }, ...panel.diatonic.map((c) => h('span', {}, `${c.token} ${c.name}`))),
      h('h3', {}, 'Likely next'),
      h('div', { class: 'chords-next' }, ...panel.next.map((n) => h('span', { class: 'pill' }, `${n.label} · ${n.roman} · ${Math.round(n.p * 100)}%`))),
      h('h3', {}, 'Gospel / jazz moves'),
      h('ul', { class: 'list' }, ...panel.subs.map((s) => h('li', {}, `${s.label}: ${s.from} → ${s.to.join(' ')}`))),
      h('p', { class: 'note' }, 'Beat Theory maps load from content/theory/beat-theory-maps.json (Follow Me + shout progressions). Override by replacing that file.'),
    );
  }
}

export { probeDecodeSupport, setSourceConfig, getSourceConfig, annotateRoman };
