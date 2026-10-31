// Timing Lab — live latency readout, buffer size, loopback round-trip + tap calibration,
// recording correction and pad pre-light, with the hard limits from latency-spec.md.
import type { App } from '../app';
import { h, slider, toast } from './dom';

export const BUFFER_STEPS = [0, 128, 256, 512, 1024, 2048, 4096]; // frames @48k; 0 = 'interactive' (browser minimum)

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

export function timingLabBody(app: App) {
  const kv = h('div', { class: 'kv' });
  const specT = h('table', { class: 'spec' });
  const badge = h('div', {});
  const s = app.p.settings;
  const curIdx = Math.max(0, BUFFER_STEPS.findIndex((f) => Math.abs(f / 48000 - s.latencyHint) < 1e-5));
  const bufLabel = (i: number) => BUFFER_STEPS[i] === 0 ? 'Lowest (interactive)' : `${BUFFER_STEPS[i]} fr ≈ ${(BUFFER_STEPS[i] / 48).toFixed(1)} ms`;
  const buf = slider('Buffer', 0, BUFFER_STEPS.length - 1, 1, curIdx, bufLabel, () => {}, async (i) => {
    toast('Recreating audio engine…'); await app.setLatencyHint(BUFFER_STEPS[i] / 48000); update();
  });
  buf.querySelector('output')!.setAttribute('style', 'min-width:150px');
  (buf as HTMLElement).style.gridTemplateColumns = '64px 1fr 150px';

  const update = () => {
    const r = app.latencyReport(); const l = app.engine.latency(); const st = app.engine.stats;
    kv.innerHTML = '';
    const rows: [string, string][] = [
      ['Engine', `${l.mode === 'worklet' ? 'AudioWorklet (sample-offset scheduling)' : l.mode === 'buffer' ? 'BufferSource fallback (start(when))' : 'not started'} · ${l.state}`],
      ['Sample rate', `${l.sampleRate} Hz`], ['latencyHint', String(l.hint)],
      ['baseLatency', `${r.baseMs.toFixed(2)} ms`], ['outputLatency', `${r.outputMs.toFixed(2)} ms`], ['Render quantum', `${r.quantumMs.toFixed(2)} ms`],
      ['Touch input', `${r.touchMs.toFixed(1)} ms ${r.touchMeasured ? '(measured, tap test)' : '(estimate for ' + r.os + ')'}`],
      ['Touch → sound (est.)', `${r.touchToSoundMs.toFixed(1)} ms`], ['MIDI-in → sound (est.)', `${r.midiToSoundMs.toFixed(1)} ms`],
      ['Round trip (measured)', app.p.lab.roundTripMs != null ? `${app.p.lab.roundTripMs.toFixed(2)} ms ± ${(app.p.lab.roundTripJitterMs ?? 0).toFixed(2)}` : 'not measured'],
      ['Recording correction', `−${s.touchCompMs.toFixed(1)} ms (touch) · output path via getOutputTimestamp()`],
      ['Pad pre-light', `${s.preLightMs} ms ahead (sequenced) · live hits light on touch-down`],
      ['Sequenced playback error', l.mode === 'none' ? '–' : '0 samples (events land on exact frames)'],
      ['Late events / voices', `${st.late} / ${st.voices}`],
    ];
    for (const [k, v] of rows) kv.append(h('div', {}, k), h('div', {}, v));
    const stc = (x: string) => h('td', { class: `st ${x}` }, x === 'ok' ? 'OK' : x === 'warn' ? 'OVER TARGET' : x === 'bad' ? 'OVER CEILING' : 'not measured');
    specT.innerHTML = '';
    specT.append(h('tr', {}, h('th', {}, `Metric (${r.os} ${r.device})`), h('th', {}, 'Now'), h('th', {}, 'Target'), h('th', {}, 'Ceiling'), h('th', {}, '')),
      h('tr', {}, h('td', {}, 'Touch-to-sound'), h('td', { class: 'num' }, r.touchToSoundMs.toFixed(1)), h('td', { class: 'num' }, '≤' + r.t2s.target), h('td', { class: 'num' }, String(r.t2s.ceiling)), stc(r.t2sStatus)),
      h('tr', {}, h('td', {}, 'MIDI-in-to-sound'), h('td', { class: 'num' }, r.midiToSoundMs.toFixed(1)), h('td', { class: 'num' }, '≤' + r.midi.target), h('td', { class: 'num' }, String(r.midi.ceiling)), stc(r.midiStatus)),
      h('tr', {}, h('td', {}, 'Audio round trip'), h('td', { class: 'num' }, r.roundTripMs != null ? r.roundTripMs.toFixed(1) : '–'), h('td', { class: 'num' }, '≤' + r.rt.target), h('td', { class: 'num' }, String(r.rt.ceiling)), stc(r.rtStatus)),
      h('tr', {}, h('td', {}, 'Recorded-timing error'), h('td', { class: 'num' }, app.p.lab.tapJitterMs != null ? '±' + app.p.lab.tapJitterMs.toFixed(1) : '–'), h('td', { class: 'num' }, '≤1'), h('td', { class: 'num' }, '2'), h('td', { class: 'note' }, 'tap jitter incl. human')),
      h('tr', {}, h('td', {}, 'Sequenced playback error'), h('td', { class: 'num' }, '0'), h('td', { class: 'num' }, '0'), h('td', { class: 'num' }, '0'), h('td', { class: 'st ok' }, 'OK')));
    badge.innerHTML = '';
    if (r.btSuspect) badge.append(h('div', { class: 'banner bad' }, `Output latency ${r.outputMs.toFixed(0)} ms — looks like Bluetooth or a high-latency route. Bluetooth audio is not allowed for performance (Stage mode); use wired/USB or the speaker.`));
    badge.append(h('div', { class: `banner ${r.stageCertified ? 'ok' : 'bad'}` }, r.stageCertified ? 'Within the hard ceilings (latency-spec.md).' : 'NOT STAGE-CERTIFIED — at least one metric exceeds its hard ceiling. Try a smaller buffer, wired/USB output, or an external MIDI pad.'));
  };

  // ---- loopback round trip ----
  const rtOut = h('div', { class: 'note' });
  const rtBtn = h('button', { class: 'btn primary', onclick: async () => {
    if (!app.started) await app.start();
    if (app.engine.mode !== 'worklet') { rtOut.textContent = 'Loopback needs the AudioWorklet engine (https:// or localhost).'; return; }
    rtBtn.disabled = true; rtOut.textContent = 'Requesting microphone…';
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as any });
      await app.engine.attachInput(stream);
      const frames: number[] = [];
      for (let i = 0; i < 6; i++) {
        rtOut.textContent = `Impulse ${i + 1}/6… keep the room quiet (speaker → mic, or a loopback cable)`;
        const r = await app.engine.measureOnce(0.5);
        if (r.frames > 0 && r.peak > 0.01) frames.push(r.frames);
        await new Promise((res) => setTimeout(res, 150));
      }
      if (frames.length < 3) { rtOut.textContent = `Only ${frames.length}/6 impulses detected — turn the volume up or use a loopback cable.`; return; }
      const sr = app.engine.sampleRate; const ms = frames.map((f) => f / sr * 1000);
      app.p.lab.roundTripMs = median(ms); app.p.lab.roundTripJitterMs = sd(ms); app.p.lab.measuredAt = new Date().toISOString(); app.save();
      rtOut.textContent = `Round trip ${app.p.lab.roundTripMs.toFixed(2)} ms (median of ${ms.length}, jitter ±${app.p.lab.roundTripJitterMs.toFixed(2)} ms). Stored for this route.`;
      app.checkLatencyLimits();
    } catch (e) { rtOut.textContent = 'Loopback failed: ' + (e as Error).message; }
    finally { app.engine.detachInput(); stream?.getTracks().forEach((t) => t.stop()); rtBtn.disabled = false; update(); }
  } }, 'Measure round trip (loopback)');

  // ---- tap test ----
  const tapOut = h('div', { class: 'note' });
  const zone = h('div', { class: 'tapzone', role: 'button', 'aria-label': 'Tap along with the clicks' }, 'Start tap test');
  let clicks: number[] = []; let taps: number[] = []; let running = false;
  zone.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    if (!app.started) await app.start();
    if (!running) {
      running = true; taps = []; clicks = [];
      const t0 = app.engine.now + 0.6; const iv = 60 / 100;
      for (let i = 0; i < 16; i++) { const t = t0 + i * iv; clicks.push(t); app.engine.trigger({ at: t, id: i % 4 === 0 ? 'sys.click.hi' : 'sys.click.lo', vel: 0.9 }); }
      zone.textContent = 'Tap on every click…';
      (window as any).__sanctumTapTest = { clicks };
      setTimeout(() => {
        running = false; zone.textContent = 'Start tap test';
        const offs = taps.map((ht) => { const near = clicks.reduce((b, c) => Math.abs(c - ht) < Math.abs(b - ht) ? c : b, clicks[0]); return (ht - near) * 1000; }).filter((o) => Math.abs(o) < 200).slice(2);
        if (offs.length < 6) { tapOut.textContent = `Need at least 8 taps (got ${taps.length}). Try again.`; return; }
        const m = median(offs); app.p.lab.tapOffsetMs = m; app.p.lab.tapJitterMs = sd(offs);
        app.p.settings.touchCompMs = Math.max(0, Math.min(80, Math.round(m * 10) / 10)); app.save();
        tapOut.textContent = `Your taps land ${m.toFixed(1)} ms after the audible click (±${sd(offs).toFixed(1)} ms). Recording correction set to −${app.p.settings.touchCompMs} ms.`;
        comp.set(app.p.settings.touchCompMs); update(); app.checkLatencyLimits();
      }, (16 * iv + 1.2) * 1000);
      return;
    }
    taps.push(app.engine.perfToCtx(e.timeStamp)); // audible-time of the tap
    zone.classList.add('flash'); setTimeout(() => zone.classList.remove('flash'), 60);
  });

  const comp = slider('Touch comp', -20, 80, 0.5, s.touchCompMs, (v) => v.toFixed(1) + ' ms', (v) => { s.touchCompMs = v; app.save(); update(); });
  const pre = slider('Pre-light', 0, 40, 1, s.preLightMs, (v) => v + ' ms', (v) => { s.preLightMs = v; app.save(); update(); });

  update();
  const el = h('div', {},
    badge, h('h3', {}, 'Live readout'), kv,
    h('h3', {}, 'Hard limits (latency-spec.md)'), specT,
    h('h3', {}, 'Buffer size'), buf,
    h('p', { class: 'note' }, 'Sets AudioContext latencyHint and recreates the engine. Browsers treat it as a request and may grant a different buffer — the readout shows what you actually got.'),
    h('h3', {}, 'Loopback test (round trip)'), h('div', { class: 'row' }, rtBtn), rtOut,
    h('p', { class: 'note' }, 'Plays an impulse and listens for it on the mic/line input in the same audio clock (output + input path). Headphones won\'t work acoustically — use the speaker near the mic or a loopback cable/interface.'),
    h('h3', {}, 'Tap test (touch input latency → recording correction)'), zone, tapOut,
    h('h3', {}, 'Manual correction'), comp, pre,
    h('p', { class: 'note' }, 'Recorded hits are stored at the time you heard (getOutputTimestamp maps the touch timestamp to the audible sample) minus the touch compensation, then quantized. Live pad flashes fire on raw touch-down (before audio); sequenced flashes fire "pre-light" ms before the note is audible.'));
  return { el, update };
}
