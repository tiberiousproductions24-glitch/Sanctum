#!/usr/bin/env python3
"""Render a ~37 s showcase of the v0.3.1 modern banks from the bank WAVs (all original synthesis).
Output: release/Sanctum-modern-banks-demo.mp3 (+ .wav)."""
import numpy as np, os, subprocess
from scipy.io import wavfile
from scipy import signal
SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__)); BANKS = os.path.join(HERE, '..', 'wav', 'modern')
OUT = os.path.join(HERE, '..', '..', '..', 'release')
def load(rel):
    sr, x = wavfile.read(os.path.join(BANKS, rel + '.wav')); x = x.astype(float) / 32768
    return np.stack([x, x], 1) if x.ndim == 1 else x
def loopbars(rel, bpm, bars_out):
    x = load(rel); n = int(round(bars_out * 4 * 60 / bpm * SR)); reps = int(np.ceil(n / len(x)))
    return np.tile(x, (reps, 1))[:n]
mix = np.zeros((SR * 40, 2)); cur = 0.0
def put(x, t, g=1.0):
    s = int(round(t * SR)); n = min(len(x), len(mix) - s); mix[s:s + n] += x[:n] * g
def section(parts, bpm, bars):
    global cur
    for rel, g, from_bar in parts:
        x = loopbars(rel, bpm, bars - from_bar); put(x, cur + from_bar * 4 * 60 / bpm, g)
    t0 = cur; cur += bars * 4 * 60 / bpm; return t0

# 1) Trap Sanctuary, F minor, 140 BPM
t = section([('trap-sanctuary/15_sanctuary_keys_fm_140', 0.5, 0), ('trap-sanctuary/13_trap_drums_140', 0.55, 1),
             ('trap-sanctuary/14_808_line_fm_140', 0.5, 1)], 140, 4)
put(load('trap-sanctuary/16_riser_2_bars_140'), t + 2 * 4 * 60 / 140, 0.35)
# 2) Drill Pulpit, G minor, 142 BPM
t = section([('drill-pulpit/15_dark_choir_gm_142', 0.45, 0), ('drill-pulpit/13_drill_drums_142', 0.55, 0),
             ('drill-pulpit/14_808_slides_gm_142', 0.5, 0)], 142, 4)
put(load('stage-fx-modern/02_impact_crack'), t, 0.45)
# tape-stop the last half bar of drill: replace with the Tape Stop FX
half = 2 * 60 / 142; s = int((cur - half) * SR); mix[s:int(cur * SR)] *= np.linspace(1, 0, int(cur * SR) - s)[:, None] ** 2
put(load('stage-fx-modern/05_tape_stop'), cur - half, 0.5)
# 3) Amapiano Praise, D minor, 112 BPM
t = section([('amapiano-praise/13_amapiano_drums_112', 0.55, 0), ('amapiano-praise/14_log_drum_line_dm_112', 0.5, 0),
             ('amapiano-praise/15_praise_keys_dm_112', 0.45, 2)], 112, 4)
put(load('stage-fx-modern/08_downlifter'), t, 0.3)
put(load('neo-soul-sunday/04_brush_swirl'), cur - 1.2, 0.35)
# 4) Neo-Soul Sunday, Eb, 84 BPM
t = section([('neo-soul-sunday/14_rhodes_changes_eb_84', 0.5, 0), ('neo-soul-sunday/13_neo_soul_drums_84', 0.5, 0),
             ('neo-soul-sunday/15_sub_line_eb_84', 0.45, 0), ('neo-soul-sunday/16_sunday_organ_eb_84', 0.3, 2)], 84, 4)
# ending: Ebmaj9 Rhodes + choir + sub drop + impact
put(load('neo-soul-sunday/07_rhodes_ebmaj9'), cur, 0.55); put(load('stage-fx-modern/01_impact_boom'), cur, 0.45)
put(load('stage-fx-modern/03_sub_drop'), cur, 0.35)
end = cur + 3.0
y = mix[:int(end * SR)]
y[-int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR))[:, None]
y = np.tanh(1.6 * y / np.max(np.abs(y))) / np.tanh(1.6)       # bus glue
tp = max(np.max(np.abs(signal.resample_poly(y[:, c], 4, 1))) for c in range(2)); y *= 10 ** (-1.5 / 20) / tp
os.makedirs(OUT, exist_ok=True); wav = os.path.join(OUT, 'Sanctum-modern-banks-demo.wav')
wavfile.write(wav, SR, (y * 32767).astype(np.int16))
mp3 = os.path.join(OUT, 'Sanctum-modern-banks-demo.mp3')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '192k', '-metadata', 'title=Sanctum modern banks demo (v0.3.1)',
                '-metadata', 'artist=Tiberious Productions / Sanctum', '-metadata', 'comment=100% original synthesis, no samples', mp3], check=True)
os.remove(wav)
print(mp3, round(len(y) / SR, 2), 's')
