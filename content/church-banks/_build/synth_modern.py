#!/usr/bin/env python3
"""Sanctum v0.3.1 "modern" banks — 100% original synthesis by Tiberious Productions / Sanctum.
No samples, no downloaded or ripped audio. numpy + scipy only, rendered at 48 kHz.

Banks (16 pads each): Trap Sanctuary · Drill Pulpit · Amapiano Praise · Neo-Soul Sunday · Stage FX Modern
Run:  python3 synth_modern.py [bank-id ...]   -> wav/modern/** + ogg/modern/** + _build/banks_modern.json
Mastering per file: soft-clip glue (loops), 4x-oversampled true-peak normalise to -1.3 dBTP,
leading silence trimmed on one-shots, OGG re-measured after encode (must stay < -1 dBTP).
"""
import numpy as np, json, os, subprocess, sys
from scipy import signal
from scipy.io import wavfile

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TP_TARGET = -1.3      # dBTP for the WAV master
TP_LIMIT = -1.0       # hard requirement for WAV and decoded OGG
AUTHOR = 'Tiberious Productions / Sanctum (original synthesis)'
LICENSE = 'Original work - synthesized by Tiberious Productions / Sanctum; no samples or third-party audio'

def mtof(m): return 440.0 * 2 ** ((np.asarray(m, dtype=float) - 69) / 12)
def T(n): return np.arange(int(n)) / SR
def N(sec): return int(round(sec * SR))
R = np.random.default_rng(2026)

# ------------------------------------------------------------------ filters / utils
def _sos(kind, f, order=2):
    nyq = SR / 2 * 0.98
    if isinstance(f, (list, tuple)): f = [max(10, min(nyq, f[0])), max(11, min(nyq, f[1]))]
    else: f = max(10, min(nyq, f))
    return signal.butter(order, f, kind, fs=SR, output='sos')
def lp(x, f, o=2): return signal.sosfilt(_sos('lowpass', f, o), x, axis=0)
def hp(x, f, o=2): return signal.sosfilt(_sos('highpass', f, o), x, axis=0)
def bp(x, lo, hi, o=2): return signal.sosfilt(_sos('bandpass', [lo, hi], o), x, axis=0)
def formant(x, f, bw): return bp(x, f - bw / 2, f + bw / 2, 1)

def sweep(x, f0, f1, kind='lowpass', block=128, curve='exp'):
    """Time-varying 2-pole filter (block-wise, state carried)."""
    n = len(x); out = np.zeros_like(x); zi = None
    for s in range(0, n, block):
        k = s / max(1, n - 1)
        f = f0 * (f1 / f0) ** k if curve == 'exp' else f0 + (f1 - f0) * k
        sos = _sos(kind, f if kind != 'bandpass' else [f * 0.7, f * 1.4])
        if zi is None: zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        out[s:s + block], zi = signal.sosfilt(sos, x[s:s + block], axis=0, zi=zi)
    return out

def sine(freq, ph0=0.0):
    freq = np.asarray(freq, float); return np.sin(ph0 + 2 * np.pi * np.cumsum(freq) / SR)
def phase(freq): return 2 * np.pi * np.cumsum(np.asarray(freq, float)) / SR

def saw(freq, ph0=None):
    """PolyBLEP band-limited saw with per-sample frequency."""
    freq = np.asarray(freq, float); dt = np.clip(freq / SR, 1e-6, 0.49)
    p = ((R.random() if ph0 is None else ph0) + np.cumsum(dt)) % 1.0
    y = 2 * p - 1
    m = p < dt; t = p[m] / dt[m]; y[m] -= t + t - t * t - 1
    m = p > 1 - dt; t = (p[m] - 1) / dt[m]; y[m] -= t * t + t + t + 1
    return y

def square_naive(f, n): return np.sign(np.sin(2 * np.pi * f * T(n) + R.random() * 6.28))
def noise(n): return R.standard_normal(int(n))
def fade_out(x, sec=0.008):
    f = min(len(x), N(sec)); r = np.linspace(1, 0, f)
    x = x.copy(); x[-f:] *= r if x.ndim == 1 else r[:, None]; return x
def st(x, pan=0.0):
    """mono -> stereo with constant-power pan (-1..1)."""
    if x.ndim == 2: return x
    a = (pan + 1) * np.pi / 4; return np.stack([x * np.cos(a), x * np.sin(a)], 1) * np.sqrt(2)
def add(buf, x, pos):
    pos = int(round(pos)); x = st(x) if buf.ndim == 2 and x.ndim == 1 else x
    if pos < 0: x = x[-pos:]; pos = 0
    n = min(len(x), len(buf) - pos)
    if n > 0: buf[pos:pos + n] += x[:n]
def sat(x, k=2.0): return np.tanh(k * x) / np.tanh(k)
def peak(x): return float(np.max(np.abs(x))) if len(x) else 0.0
def norm(x, p=1.0): m = peak(x); return x * (p / m) if m > 0 else x

def reverb(x, t=1.6, mix=0.25, pre=0.02, damp=6000, seed=1, width=1.0):
    """Stereo decorrelated noise-IR reverb (pre-delay, damped)."""
    r = np.random.default_rng(seed); n = N(t); tt = T(n)
    x2 = st(x); out = x2.copy()
    for c in range(2):
        ir = r.standard_normal(n) * np.exp(-tt * 6.9 / t)
        ir = lp(ir, damp); ir = hp(ir, 180)
        ir = np.concatenate([np.zeros(N(pre)), ir]); ir /= np.sqrt(np.sum(ir ** 2))
        src = x2[:, c] if width >= 1 else x2.mean(1)
        out[:, c] += mix * signal.fftconvolve(src, ir)[:len(x2)]
    return out

def tape(x, wow=0.0012, flutter=0.00025, drive=1.4, lpf=11500, seed=3):
    """Tape-ish: wow/flutter (variable delay), soft saturation, HF roll-off."""
    r = np.random.default_rng(seed); x2 = st(x); n = len(x2); t = T(n)
    d = 0.004 + wow * np.sin(2 * np.pi * 0.55 * t + r.random() * 6) + flutter * np.sin(2 * np.pi * 7.3 * t)
    idx = np.arange(n) - d * SR
    y = np.stack([np.interp(idx, np.arange(n), x2[:, c]) for c in range(2)], 1)
    return lp(sat(y, drive), lpf)

def crackle(n, density=6, level=0.02, seed=9):
    r = np.random.default_rng(seed); y = np.zeros(int(n))
    k = int(density * n / SR); pos = r.integers(0, n - 64, k)
    for p in pos: y[p:p + 24] += r.standard_normal(24) * np.exp(-np.arange(24) / 4) * r.uniform(0.2, 1)
    return hp(y, 1500) * level + lp(noise(n), 3000) * level * 0.08

def true_peak(x):
    x2 = x if x.ndim == 2 else x[:, None]
    return max(peak(signal.resample_poly(x2[:, c], 4, 1)) for c in range(x2.shape[1]))
def db(v): return 20 * np.log10(max(v, 1e-12))

def trim_lead(x, thresh_db=-50):
    a = np.abs(x) if x.ndim == 1 else np.max(np.abs(x), 1)
    th = a.max() * 10 ** (thresh_db / 20); i = np.argmax(a > th)
    return x[max(0, i - 8):]
def trim_tail(x, thresh_db=-62):
    a = np.abs(x) if x.ndim == 1 else np.max(np.abs(x), 1)
    th = a.max() * 10 ** (thresh_db / 20); idx = np.where(a > th)[0]
    return fade_out(x[:min(len(x), idx[-1] + N(0.02))] if len(idx) else x, 0.01)

def loop_len(bpm, bars): return int(round(bars * 4 * 60.0 / bpm * SR))
def wrap(buf, L):
    out = buf[:L].copy(); rest = buf[L:]
    while len(rest): n = min(L, len(rest)); out[:n] += rest[:n]; rest = rest[n:]
    return out
def step_t(step, bpm, swing=0.5, laid=0.0):
    """16th-step -> seconds; swing applies to odd 16ths (0.5 = straight); laid = late offset (s)."""
    q16 = 60.0 / bpm / 4; pair, odd = divmod(step, 2)
    return pair * 2 * q16 + (odd * swing * 2 * q16) + laid

# ------------------------------------------------------------------ drums
def kick(f_end=48, f_start=230, pdec=0.028, dec=0.26, click=0.6, drive=2.4, n_sec=0.7):
    n = N(n_sec); t = T(n)
    f = f_end + (f_start - f_end) * np.exp(-t / pdec)
    body = sine(f) * np.exp(-t / dec) * np.minimum(1, t / 0.0006 + 0.05)
    cl = hp(noise(N(0.006)), 2500) * np.exp(-T(N(0.006)) / 0.0015) * click
    cl = np.concatenate([cl, np.zeros(n - len(cl))]) + click * 0.6 * np.sin(2 * np.pi * 3200 * t) * np.exp(-t / 0.002)
    return trim_tail(sat(body * 1.1 + cl, drive))

def snare(tone=190, dec_t=0.09, dec_n=0.16, crack=0.7, band=(1600, 9500), drive=1.8, n_sec=0.5):
    n = N(n_sec); t = T(n)
    tn = (np.sin(2 * np.pi * tone * (1 + 0.5 * np.exp(-t / 0.01)) * t) + 0.5 * np.sin(2 * np.pi * tone * 1.78 * t)) * np.exp(-t / dec_t)
    nz = bp(noise(n), *band) * np.exp(-t / dec_n) * 1.4
    cr = hp(noise(n), 4000) * np.exp(-t / 0.008) * crack
    return trim_tail(sat(0.8 * tn + nz + cr, drive))

def clap_one(seed, band=(900, 6500), tail=0.11, bursts=(0, 0.009, 0.019, 0.027)):
    r = np.random.default_rng(seed); n = N(0.45); y = np.zeros(n)
    for i, b in enumerate(bursts):
        m = N(0.008); e = np.exp(-T(m) / 0.0022)
        add(y, r.standard_normal(m) * e * (0.8 + 0.2 * i / len(bursts)), (b + r.uniform(0, 0.002)) * SR)
    tl = r.standard_normal(n) * np.exp(-T(n) / tail); tl[:N(bursts[-1])] = 0
    return bp(y + 0.7 * tl, *band)

def clap_stack():
    a = clap_one(11, (1000, 7000)); b = clap_one(12, (700, 4000), 0.09); c = clap_one(13, (1800, 9000), 0.14)
    sn = snare(tone=230, dec_n=0.12, crack=0.4) * 0.35
    L = np.zeros(N(0.5)); Rr = np.zeros(N(0.5))
    add(L, a, 0); add(Rr, a * 0.8, N(0.0007)); add(L, b * 0.7, N(0.0012)); add(Rr, b, 0)
    add(L, c * 0.5, N(0.002)); add(Rr, c * 0.6, N(0.0005)); add(L, sn, 0); add(Rr, sn, 0)
    y = sat(np.stack([L, Rr], 1) * 1.2, 1.6)
    return trim_tail(reverb(y, 0.6, 0.12, seed=4))

HAT_F = np.array([205.3, 304.4, 369.6, 522.7, 540.0, 800.0])
def hat(dec=0.045, scale=1.25, hpf=7200, bright=0.35, n_sec=None):
    n = N(n_sec or max(0.08, dec * 6)); t = T(n)
    m = sum(square_naive(f * scale, n) for f in HAT_F) / 6
    y = hp(bp(m, 3500, 17000), hpf) + bright * hp(noise(n), 9000) * 0.5
    e = np.exp(-t / dec) * np.minimum(1, t / 0.0004)
    return trim_tail(sat(y * e * 1.5, 1.3))

def rim(f1=1750, f2=480, dec=0.018):
    n = N(0.12); t = T(n)
    y = np.sin(2 * np.pi * f1 * t) * np.exp(-t / (dec * 0.6)) + 0.8 * np.sin(2 * np.pi * f2 * t) * np.exp(-t / dec)
    y += bp(noise(n), 2000, 8000) * np.exp(-t / 0.003) * 0.8
    return trim_tail(sat(y, 2.0))

def perc_clack():
    n = N(0.15); t = T(n)
    y = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, a, d in [(1180, 1, 0.025), (2650, 0.5, 0.012), (640, 0.4, 0.04)])
    y += bp(noise(n), 1500, 5000) * np.exp(-t / 0.004)
    return trim_tail(sat(y, 2.2))

def shaker(level=1.0, dec=0.035, att=0.006):
    n = N(0.15); t = T(n); e = np.minimum(1, t / att) * np.exp(-np.maximum(0, t - att) / dec)
    return trim_tail(bp(noise(n), 4500, 14000) * e * level)

def woodblock():
    n = N(0.18); t = T(n)
    y = np.sin(2 * np.pi * 980 * t) * np.exp(-t / 0.035) + 0.45 * np.sin(2 * np.pi * 2480 * t) * np.exp(-t / 0.012)
    y += bp(noise(n), 900, 3000) * np.exp(-t / 0.002) * 0.6
    return trim_tail(sat(y, 1.6))

def conga(f=330, dec=0.16):
    n = N(0.5); t = T(n); fr = f * (1 + 0.25 * np.exp(-t / 0.012))
    y = sine(fr) * np.exp(-t / dec) + bp(noise(n), 1200, 5000) * np.exp(-t / 0.004) * 0.5
    return trim_tail(sat(y, 1.5))

def brush_snare():
    n = N(0.6); t = T(n)
    sw = bp(noise(n), 1800, 8500) * np.minimum(1, t / 0.012) * np.exp(-t / 0.17)
    tn = np.sin(2 * np.pi * 210 * t) * np.exp(-t / 0.05) * 0.35
    return trim_tail(sat(sw + tn, 1.3))

def brush_swirl(sec=1.6):
    n = N(sec); t = T(n)
    am = 0.55 + 0.45 * np.sin(2 * np.pi * 2.6 * t - np.pi / 2)
    y = bp(noise(n), 2200, 7500) * am * np.sin(np.pi * t / sec) ** 0.7
    return st(y, -0.3) * 0.6 + st(bp(noise(n), 2200, 7500) * am[::-1] * np.sin(np.pi * t / sec) ** 0.7, 0.3) * 0.4

def brush_kick():
    n = N(0.45); t = T(n); f = 52 + 90 * np.exp(-t / 0.02)
    y = sine(f) * np.exp(-t / 0.2) + lp(noise(n), 600) * np.exp(-t / 0.01) * 0.4
    return trim_tail(sat(y, 1.6))

# ------------------------------------------------------------------ 808 (clean sub + parallel mid distortion)
def e808_line(events, total, drive=3.0, dist=0.55, punch=1.0, click=0.35, hard=False, tail_tau=None):
    """Continuous-phase 808 line. events: list of (t_sec, midi, dur_sec, glide) where glide = None or
    (to_midi, glide_start_sec_after_onset, glide_time_sec). New onsets retrigger amp + punch blip."""
    n = int(total); t = T(n)
    midi = np.full(n, float(events[0][1])); amp = np.zeros(n); blip = np.zeros(n)
    for i, (t0, m, dur, gl) in enumerate(events):
        s = N(t0); e = min(n, N(t0 + dur)); nxt = N(events[i + 1][0]) if i + 1 < len(events) else n
        seg = np.arange(s, min(n, max(e, s + 1)))
        tt = (seg - s) / SR
        midi[s:nxt] = m
        if gl:
            to, gs, gt = gl; k = np.clip(((np.arange(s, nxt) - s) / SR - gs) / gt, 0, 1)
            k = 1 - (1 - k) ** 2.2   # fast-then-settle portamento
            midi[s:nxt] = m + (to - m) * k
        tau = tail_tau or max(0.25, dur * 0.55)
        a = np.minimum(1, tt / 0.0015) * np.exp(-tt / tau)
        rel = np.clip((e - seg) / N(0.02), 0, 1)
        amp[seg] = np.maximum(amp[seg], a * rel)
        blip[seg] = np.maximum(blip[seg], np.exp(-tt / 0.02))
    f = mtof(midi) * (1 + punch * 1.4 * blip)
    amp = lp(amp, 400, 1)
    x = sine(f) * amp
    sub = x
    mid = bp(sat(x * drive, 1.0) * (1 + (0.6 if hard else 0)), 110, 2600) * dist
    if hard: mid = np.clip(mid * 2.2, -0.5, 0.5)
    cl = np.zeros(n)
    for (t0, m, dur, gl) in events:
        c = hp(noise(N(0.005)), 2500) * np.exp(-T(N(0.005)) / 0.0012) * click
        add(cl, c, N(t0))
    return sat(sub + mid + cl, 1.25)

def e808(midi, dur=1.6, glide=None, **kw):
    y = e808_line([(0, midi, dur, glide)], N(dur + 0.05), **kw)
    return trim_tail(trim_lead(y))

def sub_tone(midi, dur=1.8, att=0.012):
    n = N(dur); t = T(n); f = mtof(midi)
    y = (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t)) * np.minimum(1, t / att) * np.exp(-t / (dur * 0.5))
    return fade_out(sat(y, 1.6), 0.05)

# ------------------------------------------------------------------ log drum (FM)
def log_drum(midi, dec=0.22, pitch_st=6, pdec=0.035, index=3.2, ratio=2.0, n_sec=0.6):
    n = N(n_sec); t = T(n); f0 = mtof(midi)
    f = f0 * 2 ** (pitch_st / 12 * np.exp(-t / pdec))
    I = index * np.exp(-t / 0.014) + 0.35 * np.exp(-t / 0.12)
    mod = np.sin(phase(f * ratio))
    car = np.sin(phase(f) + I * mod)
    a = np.minimum(1, t / 0.0005) * np.exp(-t / dec)
    y = sat(car * a * 1.6, 2.2)
    y = lp(y, 1700) + 0.25 * bp(y, f0 * 1.6, f0 * 2.6)
    knock = bp(noise(n), 800, 2500) * np.exp(-t / 0.003) * 0.25
    return trim_tail(y + knock)

# ------------------------------------------------------------------ keys
def rhodes_note(midi, dur=1.6, vel=0.8, n_extra=0.6):
    n = N(dur + n_extra); t = T(n); f = mtof(midi)
    hi = np.clip((midi - 48) / 36, 0, 1)
    tau = 1.8 - 1.0 * hi
    I1 = (0.5 + 1.3 * vel) * np.exp(-t / 0.45)
    body = np.sin(2 * np.pi * f * t + I1 * np.sin(2 * np.pi * f * t))
    tine = np.sin(2 * np.pi * f * 7.02 * t) * np.exp(-t / 0.018) * (0.35 * vel) / (1 + f / 900)
    hammer = bp(noise(n), 1000, 4000) * np.exp(-t / 0.0025) * 0.05 * vel
    env = np.minimum(1, t / 0.0015) * np.exp(-t / tau) * np.clip((N(dur) - np.arange(n)) / N(0.12) + 1, 0, 1)
    y = (body + tine) * env + hammer
    return sat(y * (0.7 + 0.8 * vel), 1.2 + 1.4 * vel)  # bark when hit harder

def rhodes_chord(notes, dur=1.6, vel=0.8, roll=0.006, trem=4.6, depth=0.28):
    n = N(dur + 0.7); y = np.zeros(n)
    for i, m in enumerate(sorted(notes)):
        v = vel * (0.9 if i == 0 else 1.0) * (0.9 + 0.2 * R.random())
        add(y, rhodes_note(m, dur, v), N(i * roll + R.uniform(0, 0.002)))
    t = T(n); pan = depth * np.sin(2 * np.pi * trem * t)
    out = np.stack([y * (1 - pan), y * (1 + pan)], 1) * 0.5
    return out

DRAW = [0.5, 1.5, 1, 2, 3, 4, 5, 6, 8]
def tonewheel(notes, dur, bars='888000000', perc=True, drive=2.6, leslie=6.8, click=0.35, vel=1.0, rel=0.06, swell=None):
    n = N(dur + rel + 0.05); t = T(n); x = np.zeros(n)
    lv = [0 if c == '0' else 10 ** (-(8 - int(c)) * 3 / 20) for c in bars]
    for m in notes:
        f = mtof(m); jitter = 1 + R.uniform(-0.0006, 0.0006)
        for r, l in zip(DRAW, lv):
            if l and f * r < SR / 2.2: x += l * np.sin(2 * np.pi * f * r * jitter * t + R.random() * 6.28)
        if perc: x += 0.6 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t / 0.18)
    x /= max(1, len(notes)) ** 0.6
    env = np.minimum(1, t / 0.004) * np.clip((N(dur) - np.arange(n)) / N(rel) + 1, 0, 1)
    if swell is not None: env *= swell(t)
    x = x * env * vel
    ck = bp(noise(N(0.004)), 800, 6000) * np.exp(-T(N(0.004)) / 0.001) * click
    add(x, ck, 0)
    x = sat(x * drive * 0.5, 1.0)          # preamp growl
    return leslie_fx(x, leslie)

def leslie_fx(x, horn_hz=6.8, drum_hz=None):
    n = len(x); t = T(n); drum_hz = drum_hz or horn_hz * 0.86
    lo = lp(x, 800, 2); hi = hp(x, 800, 2)
    out = np.zeros((n, 2)); idx = np.arange(n)
    for c, ph in enumerate([0, np.pi / 2]):
        d = 0.0012 + 0.00034 * np.sin(2 * np.pi * horn_hz * t + ph)
        h = np.interp(idx - d * SR, idx, hi) * (1 + 0.32 * np.sin(2 * np.pi * horn_hz * t + ph + 0.6))
        l = lo * (1 + 0.14 * np.sin(2 * np.pi * drum_hz * t + ph * 1.3))
        out[:, c] = h + l
    return lp(out, 7500)

# ------------------------------------------------------------------ synths / choir
def supersaw(notes, dur, voices=7, spread=0.18, att=0.6, rel=1.0, cutoff=(900, 3800), level=1.0):
    n = N(dur + rel); t = T(n); out = np.zeros((n, 2))
    det = np.linspace(-1, 1, voices) * spread
    for m in notes:
        for i, d in enumerate(det):
            drift = 1 + 0.0008 * np.sin(2 * np.pi * (0.2 + 0.07 * i) * t + R.random() * 6)
            s = saw(np.full(n, mtof(m + d)) * drift)
            out += st(s, (i / (voices - 1)) * 2 - 1) * (0.7 if abs(d) > spread * 0.5 else 1.0)
    out = sweep(out, cutoff[0], cutoff[1])
    env = np.minimum(1, t / att) * np.clip((N(dur) - np.arange(n)) / N(rel) + 1, 0, 1)
    return hp(out * env[:, None] * level / (len(notes) * voices) ** 0.5, 120)

VOWELS = {  # (freq, gain, bandwidth)  — sung-vowel approximations (see docs/modern-sound-research.md)
    'oo': [(360, 1.0, 90), (720, 0.45, 110), (2400, 0.10, 160), (2850, 0.05, 180)],
    'aa': [(660, 1.0, 110), (1080, 0.62, 120), (2450, 0.22, 160), (2950, 0.12, 180)],
}
def choir(notes, dur, vowel='oo', voices=4, att=0.35, rel=0.9, breath=0.05, vib=0.0045, seed=5):
    r = np.random.default_rng(seed); n = N(dur + rel); t = T(n); src = np.zeros((n, 2))
    for m in notes:
        for v in range(voices):
            cents = r.uniform(-14, 14); vr = r.uniform(4.6, 5.6); onset = r.uniform(0.25, 0.6)
            vibd = vib * np.clip((t - onset) / 0.5, 0, 1)
            f = mtof(m) * 2 ** (cents / 1200) * (1 + vibd * np.sin(2 * np.pi * vr * t + r.random() * 6)) * (1 + 0.002 * lp(r.standard_normal(n), 8))
            g = lp(saw(f), 4200) + breath * hp(r.standard_normal(n), 1500)
            src += st(g, r.uniform(-0.8, 0.8))
    y = sum(gn * formant(src, fq, bw) for fq, gn, bw in VOWELS[vowel])
    y = hp(y, 140)
    env = np.minimum(1, t / att) ** 1.5 * np.clip((N(dur) - np.arange(n)) / N(rel) + 1, 0, 1)
    y = y * env[:, None]
    return reverb(y / (len(notes) * voices) ** 0.5, 2.4, 0.35, pre=0.03, seed=seed)

def reese(midi, dur, cutoff=650):
    n = N(dur); t = T(n); f = mtof(midi)
    a = saw(np.full(n, f * 2 ** (0.14 / 12))); b = saw(np.full(n, f * 2 ** (-0.14 / 12)))
    y = lp(a + b, cutoff * (1 + 0.4 * np.sin(2 * np.pi * 0.35 * t)), ) if False else sweep(a + b, cutoff, cutoff * 1.8)
    y = sat(y * 0.8, 2.0) + 0.9 * np.sin(2 * np.pi * f * t)
    env = np.minimum(1, t / 0.006) * np.clip((n - np.arange(n)) / N(0.15), 0, 1)
    return sat(y * env, 1.3)

# ------------------------------------------------------------------ FX
def riser(sec, f0=300, f1=9000, pitch=(48, 72), bpm=None):
    n = N(sec); t = T(n); k = t / sec
    nz = sweep(noise(n), f0, f1, 'bandpass')
    p = pitch[0] + (pitch[1] - pitch[0]) * k ** 1.6
    tone = sum(saw(mtof(p + o)) for o in (0, 0.12, -0.12, 12)) / 4
    tone = sweep(tone, 400, 7000)
    y = st(nz * 0.9, -0.4) + st(nz[::-1] * 0 + hp(noise(n), 3000) * 0.25 * k ** 3, 0.5) + st(tone * 0.55, 0.2)
    y = y * (0.04 + 0.96 * k ** 1.6)[:, None]
    if bpm:  # 16th-note gate that tightens near the end (tempo-locked build)
        q = 60 / bpm / 4; g = ((t % q) < q * (0.92 - 0.5 * k)).astype(float); g = lp(g, 300)
        y *= (1 - 0.6 * k ** 2 + 0.6 * k ** 2 * g)[:, None]
    y = reverb(y, 1.2, 0.2, seed=8)[:n]
    return fade_out(y, 0.004)

def impact(kind='boom'):
    n = N(3.2); t = T(n)
    f = 32 + 140 * np.exp(-t / 0.05)
    sub = sine(f) * np.exp(-t / (0.9 if kind == 'boom' else 0.5))
    crack = hp(noise(n), 1500 if kind == 'boom' else 3000) * np.exp(-t / (0.06 if kind == 'boom' else 0.025)) * (0.7 if kind == 'boom' else 1.3)
    mid = bp(noise(n), 150, 900) * np.exp(-t / 0.15) * 0.6
    y = sat(sub * 1.3, 2.0) + crack + mid
    return trim_tail(reverb(y, 2.8, 0.35, seed=12))

def sub_drop(sec=2.2):
    n = N(sec); t = T(n); f = 28 + 70 * np.exp(-t / 0.5)
    y = sine(f) * np.minimum(1, t / 0.003) * np.exp(-t / (sec * 0.45))
    return fade_out(sat(y * 1.4, 1.8) + 0.2 * bp(sat(y * 3, 1), 80, 400), 0.05)

def downlifter(sec=3.0):
    n = N(sec); t = T(n); k = t / sec
    nz = sweep(noise(n), 9000, 250, 'bandpass') * (1 - k) ** 1.5
    tone = sweep(saw(mtof(72 - 30 * k ** 0.7)), 5000, 300) * (1 - k) ** 2 * 0.4
    return fade_out(reverb(st(nz, 0.3) + st(tone, -0.3), 1.5, 0.25, seed=13), 0.03)

def reverse_swell(notes, sec=2.4):
    a = np.zeros((N(1.6), 2)); add(a, supersaw(notes, 0.6, att=0.002, rel=0.8, cutoff=(4000, 4000)), 0)
    add(a, choir(notes, 0.6, 'aa', voices=2, att=0.01, rel=0.6), 0)
    a = np.concatenate([a, np.zeros((N(sec), 2))]); w = reverb(a, 3.0, 0.9, pre=0.0, seed=14)
    w = w[:N(sec)]; w = w[::-1].copy()
    w *= np.linspace(0, 1, len(w))[:, None] ** 1.8
    return fade_out(w, 0.003)

def tape_stop(src, stop_sec=1.0):
    """Pitch + speed fall together (rate 1 -> 0)."""
    n_out = N(0.25 + stop_sec); t = T(n_out)
    rate = np.where(t < 0.25, 1.0, np.clip(1 - (t - 0.25) / stop_sec, 0, 1) ** 1.4)
    pos = np.cumsum(rate); pos = np.clip(pos, 0, len(src) - 1)
    x = st(src); y = np.stack([np.interp(pos, np.arange(len(x)), x[:, c]) for c in range(2)], 1)
    y = lp(y, 9000) * np.clip(rate * 4, 0, 1)[:, None]
    return fade_out(y, 0.01)

# ------------------------------------------------------------------ loop helpers
def place(buf, x, sec, g=1.0, pan=0.0): add(buf, st(x, pan) * g, sec * SR)
def glue(x, drive=1.7):
    x = norm(x, 1.0); return sat(x * drive, 1.0)

# voicings ---------------------------------------------------------
def chord_notes(root, ivs, low=None): return [root + i for i in ivs]

# ==================================================================== BANKS
def bank_trap():
    bpm, key, bars = 140, 'Fm', 2
    q = 60 / bpm
    K = kick(f_end=50, dec=0.22, click=0.8, drive=3.0); S = snare(tone=200, dec_n=0.14, crack=0.9, drive=2.2)
    C = clap_stack(); RM = rim(); CH = hat(0.038); OH = hat(0.32, scale=1.15, hpf=6800)
    def roll(div, beats=1.0, base=0.04):
        n = N(beats * q + 0.2); y = np.zeros(n); k = int(round(beats * div))
        for i in range(k): add(y, hat(base) * (0.45 + 0.55 * i / max(1, k - 1)), i * q / div * SR)
        return trim_tail(y)
    pads = []
    pads += [('Kick Punch', K, 'Short clicky trap kick, sine body 230->50 Hz, driven'),
             ('Snare Crack', S, 'Bright crack snare, tone + band noise, saturated'),
             ('Clap Stack', C, 'Three layered claps + snare noise, stereo, short room'),
             ('Rim Knock', RM, 'Woody rimshot for bounce and ghost notes'),
             ('Closed Hat', CH, 'Tight 808-style metallic hat (choke: hats)', 'hats'),
             ('Open Hat', OH, 'Open hat for upbeats (choke: hats)', 'hats'),
             ('Hat Roll 1/32', roll(8), '1/32 hat roll, one beat at 140 BPM, velocity ramp', 'hats'),
             ('Hat Roll Triplet', roll(6), '1/16-triplet hat roll, one beat at 140 BPM', 'hats')]
    for nm, m in [('F', 29), ('Ab', 32), ('C', 36), ('Db', 37)]:
        pads.append((f'808 {nm} Dist', e808(m, 1.5, drive=3.4, dist=0.65), f'Distorted 808 in F minor ({nm}); clean sub + parallel mid drive + click', '808'))
    # loop: drums
    L = loop_len(bpm, bars); buf = np.zeros((L + N(1.5), 2))
    kicks = [0, 7, 10, 16, 19, 26, 27]
    for s in kicks: place(buf, K, step_t(s, bpm), 1.0)
    for b in range(bars):
        place(buf, C, step_t(b * 16 + 8, bpm), 0.85); place(buf, S, step_t(b * 16 + 8, bpm), 0.55)
    place(buf, RM, step_t(13, bpm), 0.35, 0.3); place(buf, RM, step_t(30, bpm), 0.3, 0.3)
    for s in range(0, 32, 2):
        if s in (12, 22): continue
        if s == 30: place(buf, fade_out(OH[:N(2 * q / 4)], 0.02), step_t(s, bpm), 0.45, 0.2); continue
        place(buf, CH, step_t(s, bpm), 0.5 + 0.15 * (s % 4 == 0), 0.2)
    for i in range(8): place(buf, hat(0.03), step_t(12, bpm) + i * q / 8, 0.25 + 0.35 * i / 7, 0.25)   # 1/32 roll
    for i in range(6): place(buf, hat(0.03), step_t(22, bpm) + i * q / 6, 0.3 + 0.3 * i / 5, 0.15)    # triplet roll
    drums = wrap(glue(buf, 1.6), L)
    # loop: 808 line following kicks
    ev = [(step_t(0, bpm), 29, step_t(6, bpm), None), (step_t(7, bpm), 29, q * 0.6, None), (step_t(10, bpm), 32, step_t(6, bpm), None),
          (step_t(16, bpm), 37, step_t(3, bpm), None), (step_t(19, bpm), 36, step_t(7, bpm), None),
          (step_t(26, bpm), 36, step_t(6, bpm), (41, step_t(2, bpm) - step_t(0, bpm), 0.09))]
    line = wrap(st(e808_line(ev, L + N(1), drive=3.4, dist=0.65, tail_tau=0.5)), L)
    # loop: sanctuary keys (dark Rhodes + ooh choir), 4 bars Fm9 | Dbmaj9 | Bbm11 | C7sus->C7b9
    bars_k = 4; Lk = loop_len(bpm, bars_k); kb = np.zeros((Lk + N(3), 2)); bar = 4 * q
    prog = [[53, 56, 60, 63, 67], [49, 53, 56, 60, 63], [46, 56, 61, 63, 65], [48, 58, 60, 65, 67]]
    for i, ch in enumerate(prog):
        place(kb, choir(ch[1:], bar, 'oo', voices=3, att=0.4, rel=0.5, seed=20 + i), i * bar, 0.55)
        place(kb, rhodes_chord(ch, bar * 0.45, 0.75), i * bar, 0.6)
        place(kb, rhodes_chord(ch[2:], 0.3, 0.55), i * bar + step_t(11, bpm), 0.4)
    place(kb, rhodes_chord([52, 58, 61, 64], q, 0.7), 3 * bar + 2 * q, 0.5)   # C7b9 resolve tension
    keys_loop = wrap(reverb(kb, 1.6, 0.18, seed=21), Lk)
    pads += [('Trap Drums 140', drums, 'Half-time trap groove: clicky kicks, stacked clap on 3, 1/32 + triplet hat rolls', 'trap-drums', bpm, bars),
             ('808 Line Fm 140', line, 'Distorted 808 bassline in F minor locked to the Trap Drums kicks, octave slide at the end', 'trap-808', bpm, bars),
             ('Sanctuary Keys Fm 140', keys_loop, 'Dark Rhodes + formant "ooh" choir: Fm9 | Dbmaj9 | Bbm11 | C7sus-C7b9', 'trap-keys', bpm, bars_k),
             ('Riser 2 Bars 140', riser(2 * 4 * q, bpm=bpm), 'Noise + saw riser, exactly 2 bars at 140 BPM with tightening 16th gate; ends on the downbeat')]
    return dict(id='trap-sanctuary', name='Trap Sanctuary', key=key, bpm=bpm, pads=pads)

def bank_drill():
    bpm, key, bars = 142, 'Gm', 2; q = 60 / bpm
    K = kick(f_end=46, f_start=200, dec=0.3, click=0.5, drive=2.6); S = snare(tone=240, dec_t=0.06, dec_n=0.1, crack=1.0, band=(2200, 11000), drive=2.4)
    G = snare(tone=240, dec_t=0.04, dec_n=0.06, crack=0.4, band=(2500, 10000), drive=1.5) * 0.5
    RM = rim(1900, 520, 0.012); H = hat(0.03, scale=1.4, hpf=8000); PC = perc_clack()
    rs = reverb(S, 1.2, 0.5, seed=31); rs = rs[::-1].copy()[-N(0.9):]; rs = fade_out(rs * np.linspace(0, 1, len(rs))[:, None] ** 2, 0.004)
    trip = np.zeros(N(q + 0.2))
    for i in range(6): add(trip, hat(0.025, scale=1.4) * (0.5 + 0.5 * i / 5), i * q / 6 * SR)
    pads = [('Drill Kick', K, 'Sparse drill kick, longer sine body'),
            ('Drill Snare', S, 'Short bright drill snare that cuts through busy hats'),
            ('Ghost Snare', G, 'Quiet ghost snare for fills around the backbeat'),
            ('Rim Click', RM, 'High rim click for 3-3-2 fills before the snare'),
            ('Drill Hat', H, 'Very tight metallic hat (choke: hats)', 'hats'),
            ('Hat Triplet Roll', trim_tail(trip), '1/16-triplet roll, one beat at 142 BPM', 'hats'),
            ('Perc Clack', PC, 'Dry clacky wood/metal perc, carries the 3-3-2 too'),
            ('Reverse Snare', rs, 'Reversed reverb snare swell into the backbeat')]
    for nm, m, gl, d in [('G Slide 5th', 31, (38, 0.35, 0.12), 1.8), ('G Slide Oct', 31, (43, 0.35, 0.1), 1.8),
                         ('Bb Long', 34, None, 2.2), ('Eb Electro', 39, None, 1.6)]:
        y = e808(m, d, glide=gl, drive=4.5 if 'Electro' in nm else 3.0, dist=0.9 if 'Electro' in nm else 0.6, hard='Electro' in nm, tail_tau=1.0)
        pads.append((f'808 {nm}', y, f'Sliding drill 808 in G minor ({nm}); sustained, portamento glide' if gl else f'Drill 808 in G minor ({nm})', '808'))
    L = loop_len(bpm, bars); buf = np.zeros((L + N(1.5), 2))
    for s in [0, 11, 19, 22]: place(buf, K, step_t(s, bpm), 1.0)
    place(buf, S, step_t(8, bpm), 0.9); place(buf, S, step_t(16 + 11, bpm), 0.9)   # bar 2 snare displaced late
    for s in [6, 14, 21, 30]: place(buf, G, step_t(s, bpm), 0.6, -0.2)
    place(buf, RM, step_t(15, bpm), 0.5, 0.35); place(buf, PC, step_t(24 + 2, bpm), 0.45, -0.35)
    hats = []
    for b in range(bars):
        for s in [0, 3, 6, 8, 11, 14]: hats.append(b * 16 + s)
    for s in hats:
        if s in (27,): continue
        place(buf, H, step_t(s, bpm), 0.55 + 0.2 * (s % 8 == 0), 0.15)
    for i in range(6): place(buf, hat(0.022, scale=1.4), step_t(28, bpm) + i * q / 6, 0.3 + 0.3 * i / 5, 0.2)
    drums = wrap(glue(buf, 1.6), L)
    hb = np.zeros((L + N(1), 2))
    for b in range(bars):
        for s in [0, 3, 6, 8, 11, 14]:
            if b == 1 and s == 14: continue
            place(hb, H, step_t(b * 16 + s, bpm), 0.6 + 0.25 * (s in (0, 8)), 0.1 if s % 2 else -0.1)
    for i in range(4): place(hb, hat(0.02, scale=1.4), step_t(30, bpm) + i * q / 8, 0.35 + 0.15 * i, 0)
    for i in range(6): place(hb, hat(0.022, scale=1.4), step_t(13, bpm) + i * q / 6 * 0.5, 0.25 + 0.2 * i / 5, 0.25)
    hats_loop = wrap(glue(hb, 1.3), L)
    ev = [(step_t(0, bpm), 31, step_t(10, bpm), (38, step_t(8, bpm), 0.14)),
          (step_t(11, bpm), 38, step_t(7, bpm), (34, step_t(6, bpm), 0.12)),
          (step_t(19, bpm), 34, step_t(3, bpm), None),
          (step_t(22, bpm), 31, step_t(10, bpm), (43, step_t(4, bpm), 0.1))]
    line = e808_line(ev, L + N(0.6), drive=3.2, dist=0.7, tail_tau=1.2)
    line = st(line[:L]) * np.concatenate([np.ones(L - N(0.01)), np.linspace(1, 0, N(0.01))])[:, None]  # sustained: hard loop edge
    bars_c = 4; Lc = loop_len(bpm, bars_c); cb = np.zeros((Lc + N(3), 2)); bar = 4 * q
    prog = [[55, 58, 62, 67], [51, 55, 58, 62], [48, 51, 55, 60], [50, 54, 57, 62]]   # Gm | Eb | Cm | D
    for i, ch in enumerate(prog):
        place(cb, choir(ch, bar, 'aa', voices=3, att=0.3, rel=0.5, seed=40 + i), i * bar, 0.6)
        for j, s in enumerate([0, 3, 6, 8, 11, 14]):   # bell plinks on the 3-3-2
            m = ch[(j * 2) % len(ch)] + 24; bl = rhodes_note(m, 0.25, 0.9) * 0.3
            place(cb, bl, i * bar + step_t(s, bpm), 0.5, 0.4 if j % 2 else -0.4)
    choir_loop = wrap(reverb(cb, 2.0, 0.2, seed=41), Lc)
    pads += [('Drill Drums 142', drums, 'Drill groove: sparse kicks, snare on 3 then displaced late in bar 2, ghost snares, 3-3-2 hats + triplet roll', 'drill-drums', bpm, bars),
             ('808 Slides Gm 142', line, 'Long sliding 808s in G minor: root->5th, 5th->b3, octave jump', 'drill-808', bpm, bars),
             ('Dark Choir Gm 142', choir_loop, 'Formant "aah" choir Gm | Eb | Cm | D with 3-3-2 bell plinks', 'drill-choir', bpm, bars_c),
             ('Drill Hats 3-3-2 142', hats_loop, 'Hats alone on the 3-3-2 grouping with rolls and gaps', 'drill-hats', bpm, bars)]
    return dict(id='drill-pulpit', name='Drill Pulpit', key=key, bpm=bpm, pads=pads)

def bank_amapiano():
    bpm, key, bars = 112, 'Dm', 2; q = 60 / bpm; SW = 0.57
    K = kick(f_end=52, f_start=160, dec=0.2, click=0.2, drive=1.6); SH = shaker(); WB = woodblock()
    RM = rim(1500, 420, 0.02); OH = hat(0.16, scale=1.1, hpf=6500); CG = conga()
    CL = clap_one(77, (900, 5500), 0.15); CL = trim_tail(reverb(sat(CL * 1.5, 1.3), 0.9, 0.2, seed=78))
    logs = [('D', 38), ('F', 41), ('G', 43), ('A', 45), ('C', 48)]
    pads = [('Piano Kick', K, 'Soft round four-on-the-floor kick (leaves room for the log drum)')]
    for nm, m in logs:
        pads.append((f'Log Drum {nm}', log_drum(m), f'FM log drum in D minor ({nm}): pitch blip + metallic FM pock + woody knock', None))
    pads += [('Shaker', SH, 'Swung 16th shaker stroke'), ('Wood Block', WB, 'Bright wood block'), ('Rim Shot', RM, 'Dry rim for syncopations'),
             ('Open Hat', OH, 'Offbeat open hat'), ('Conga', CG, 'High conga tone'), ('Soft Clap', CL, 'Wide soft clap with room')]
    L = loop_len(bpm, bars); buf = np.zeros((L + N(1.5), 2))
    for b in range(bars * 4): place(buf, K, b * q, 0.9)
    for s in range(32):
        acc = [0.35, 0.6, 0.45, 0.8][s % 4]; place(buf, SH, step_t(s, bpm, SW), acc * 0.8, 0.35 if s % 2 else 0.15)
    for b in range(bars * 4): place(buf, OH, b * q + 2 * step_t(1, bpm, SW) - 0 * q, 0.35, -0.2)   # offbeat "&"
    for s in [3, 6, 11, 14, 19, 22, 27, 29]: place(buf, RM, step_t(s, bpm, SW), 0.45, -0.3)
    for s in [7, 23, 26]: place(buf, WB, step_t(s, bpm, SW), 0.35, 0.5)
    for s in [10, 15, 30, 31]: place(buf, CG, step_t(s, bpm, SW), 0.5, 0.4)
    for b in [1, 3, 5, 7]: place(buf, CL, b * q, 0.4, 0)
    drums = wrap(glue(buf, 1.5), L)
    # log drum line (bursts around the kick)
    lb = np.zeros((L + N(1), 2))
    line = [(3, 38, 1.0), (6, 38, 0.8), (7, 41, 0.85), (10, 45, 0.9), (14, 43, 0.8),
            (19, 38, 1.0), (22, 48, 0.9), (23, 45, 0.8), (26, 43, 0.85), (27, 41, 0.8), (30, 38, 0.9)]
    for s, m, v in line: place(lb, log_drum(m), step_t(s, bpm, SW), v)
    log_loop = wrap(glue(lb, 1.4), L)
    # praise keys: piano-ish Rhodes stabs Dm9 | Gm9 | Bbmaj9 | A7sus4->A7
    bars_k = 4; Lk = loop_len(bpm, bars_k); kb = np.zeros((Lk + N(3), 2)); bar = 4 * q
    prog = [[50, 57, 60, 64, 65], [55, 58, 62, 65, 69], [46, 57, 60, 62, 65], [45, 55, 59, 62, 64]]
    rhythm = [0, 3, 6, 10, 12]
    for i, ch in enumerate(prog):
        for j, s in enumerate(rhythm):
            place(kb, rhodes_chord(ch, 0.18 if j else 0.4, 0.8 if j in (0, 3) else 0.6, roll=0.003), i * bar + step_t(s, bpm, SW), 0.55)
        place(kb, supersaw(ch[1:], bar * 0.95, voices=5, spread=0.1, att=0.3, rel=0.4, cutoff=(600, 1500), level=0.5), i * bar, 0.35)
    keys_loop = wrap(reverb(kb, 1.4, 0.18, seed=51), Lk)
    deep = sub_tone(38 - 12 + 12, 2.0)   # D2 sub with soft attack
    pads += [('Amapiano Drums 112', drums, 'Soft 4/4 kick, swung 16th shakers, offbeat open hats, rims/wood/conga syncopation, claps on 2 & 4', 'piano-drums', bpm, bars),
             ('Log Drum Line Dm 112', log_loop, 'Walking FM log-drum bassline in D minor, bursts written around the kick', 'piano-log', bpm, bars),
             ('Praise Keys Dm 112', keys_loop, 'Swung Rhodes stabs + soft saw pad: Dm9 | Gm9 | Bbmaj9 | A7sus', 'piano-keys', bpm, bars_k),
             ('Deep Sub D', deep, 'Deep round sub bass on D (soft attack, long decay)', '808')]
    return dict(id='amapiano-praise', name='Amapiano Praise', key=key, bpm=bpm, pads=pads)

def bank_neosoul():
    bpm, key, bars = 84, 'Eb', 2; q = 60 / bpm; SW = 0.62; LAID = 0.018
    BK = brush_kick(); BS = brush_snare(); RM = rim(1600, 430, 0.022) * 0.8; SWL = brush_swirl(); HH = hat(0.05, scale=1.0, hpf=6500, bright=0.1) * 0.7
    V = {'Ebmaj9': [51, 58, 62, 65, 67], 'Cm11': [48, 58, 63, 65, 67], 'Fm9': [53, 56, 60, 63, 67],
         'Bb13sus': [46, 56, 60, 63, 67], 'Abmaj9': [44, 55, 58, 60, 63]}
    pads = [('Brush Kick', BK, 'Soft felt kick'), ('Brush Snare', BS, 'Brush slap/swish snare'), ('Rim Click', RM, 'Cross-stick rim click'),
            ('Brush Swirl', SWL, 'Circular brush swirl (sustained, stereo)'), ('Soft Hat', HH, 'Dark soft hat'),
            ('Sub Eb', sub_tone(39, 1.8), 'Warm round sub on Eb', 'sub')]
    for nm in ['Ebmaj9', 'Cm11', 'Fm9', 'Bb13sus']:
        pads.append((f'Rhodes {nm}', reverb(tape(rhodes_chord(V[nm], 1.6, 0.8)), 1.2, 0.15, seed=60), f'Electric-piano {nm} (tight voicing, G on top), tremolo + tape', 'keys'))
    pads.append(('Organ Abmaj9 Stab', tonewheel(V['Abmaj9'][1:] + [44 - 12 + 12], 0.45, '888800000', drive=2.2), 'Tonewheel organ Abmaj9 stab, drawbars 888800000, fast Leslie', 'organ'))
    pads.append(('Organ Shout Chop', tonewheel([51, 55, 58, 61, 63], 0.22, '888000000', drive=4.0, click=0.6), 'Short growling Eb7 "chop" stab, 888000000 + percussion, overdriven Leslie', 'organ'))
    L = loop_len(bpm, bars); buf = np.zeros((L + N(2), 2))
    for s in [0, 7, 10, 16, 23, 26, 27]: place(buf, BK, step_t(s, bpm, SW), 0.9 if s % 16 == 0 else 0.7)
    for b in range(bars):
        place(buf, BS, step_t(b * 16 + 4, bpm, SW, LAID), 0.85); place(buf, BS, step_t(b * 16 + 12, bpm, SW, LAID), 0.85)
    for s in [3, 9, 14, 19, 25, 30]: place(buf, BS * 0.25, step_t(s, bpm, SW, LAID), 0.6, -0.3)   # ghosts
    for s in range(0, 32, 2): place(buf, HH, step_t(s, bpm, SW, LAID * 0.5), 0.5 + 0.2 * (s % 4 == 2), 0.3)
    place(buf, RM, step_t(31, bpm, SW, LAID), 0.4, -0.2)
    drums = glue(buf, 1.3)
    drums = tape(drums, drive=1.5) + st(crackle(len(drums)))
    drums = wrap(drums, L)
    bars_k = 4; Lk = loop_len(bpm, bars_k); kb = np.zeros((Lk + N(3), 2)); bar = 4 * q
    seq = ['Ebmaj9', 'Cm11', 'Abmaj9', 'Bb13sus']
    for i, nm in enumerate(seq):
        ch = V[nm]
        place(kb, rhodes_chord(ch, bar * 0.48, 0.8), i * bar + LAID, 0.6)
        place(kb, rhodes_chord(ch[2:], 0.35, 0.6), i * bar + step_t(6, bpm, SW, LAID), 0.45)   # 'and' of 2 push
        place(kb, rhodes_chord([ch[-1] - 1], 0.08, 0.5), i * bar + step_t(11, bpm, SW, LAID), 0.3)  # grace a half-step below
        place(kb, rhodes_chord(ch[2:], 0.5, 0.65), i * bar + step_t(12, bpm, SW, LAID), 0.45)
    rh = tape(kb); rh = wrap(reverb(rh, 1.5, 0.16, seed=61), Lk)
    sb = np.zeros((Lk + N(2), 2))
    roots = [39, 36, 44, 46]
    for i, r in enumerate(roots):
        place(sb, sub_tone(r, bar * 0.45), i * bar, 0.9); place(sb, sub_tone(r, 0.35), i * bar + step_t(7, bpm, SW), 0.7)
        place(sb, sub_tone(r + 12 if i % 2 else r + 7, 0.3), i * bar + step_t(14, bpm, SW), 0.55)
    sub_loop = wrap(glue(sb, 1.4), Lk)
    ob = np.zeros((Lk + N(2), 2))
    for i, nm in enumerate(seq):
        ch = V[nm][1:]
        sw = lambda t: 0.55 + 0.45 * np.clip(t / 1.2, 0, 1)
        place(ob, tonewheel(ch, bar * 0.92, '808808008', perc=False, drive=1.8, leslie=6.6 if i % 2 else 0.8, swell=sw), i * bar, 0.6)
        place(ob, tonewheel([c + 12 for c in ch[-3:]], 0.14, '888000000', drive=3.5, click=0.6), i * bar + step_t(14, bpm, SW), 0.4)
    org = wrap(glue(ob, 1.2), Lk)
    pads += [('Neo-Soul Drums 84', drums, 'Laid-back swung brush kit with ghost notes, tape wow/flutter + light vinyl crackle', 'ns-drums', bpm, bars),
             ('Rhodes Changes Eb 84', rh, 'Ebmaj9 | Cm11 | Abmaj9 | Bb13sus — common tone G on top, pushes + half-step grace', 'ns-keys', bpm, bars_k),
             ('Sub Line Eb 84', sub_loop, 'Round sub following the Rhodes Changes roots', 'ns-sub', bpm, bars_k),
             ('Sunday Organ Eb 84', org, 'Tonewheel organ 808808008 pad (Leslie slow/fast alternating) + 888 shout chops', 'ns-organ', bpm, bars_k)]
    return dict(id='neo-soul-sunday', name='Neo-Soul Sunday', key=key, bpm=bpm, pads=pads)

def bank_fx():
    C = [48, 55, 60, 64, 67]
    src = np.zeros((N(1.6), 2)); add(src, st(e808(36, 1.4)), 0); add(src, supersaw([60, 63, 67], 1.2, att=0.005, rel=0.3) * 2, 0)
    add(src, st(kick()), 0); add(src, clap_stack() * 0.7, N(0.43))
    pads = [('Impact Boom', impact('boom'), 'Cinematic impact: sub thud 170->32 Hz + noise crack + long tail'),
            ('Impact Crack', impact('crack'), 'Brighter, tighter impact with big room'),
            ('Sub Drop', sub_drop(), 'Sub drop 98->28 Hz with harmonics for small speakers'),
            ('Reverse Swell', reverse_swell([48, 60, 64, 67, 71]), 'Reversed Cmaj7 supersaw + choir swell; peak lands at the end'),
            ('Tape Stop', tape_stop(src), 'Band hit that powers down (pitch + speed fall together)'),
            ('Riser 4 s', riser(4.0), '4-second noise + saw riser, ends hard'),
            ('Riser 8 s', riser(8.0, f0=200, f1=12000, pitch=(43, 79)), '8-second long build'),
            ('Downlifter', downlifter(), 'Falling noise + saw sweep for after the drop')]
    for nm, ch, v in [('Choir Ooh C', C, 'oo'), ('Choir Aah C', C, 'aa'), ('Choir Ooh F', [53, 57, 60, 65, 69], 'oo'), ('Choir Aah G', [55, 59, 62, 67, 71], 'aa')]:
        pads.append((nm, choir(ch, 3.2, v, voices=4, seed=90 + len(pads)), f'Synthesized formant choir pad "{v}" ({nm.split()[-1]} major) - no recorded voices', 'choir'))
    pads += [('Supersaw Pad C', reverb(supersaw([48, 55, 60, 64, 67, 72], 3.5, att=0.7, rel=1.2), 2.4, 0.3, seed=70), 'Wide 7-voice supersaw Cadd9 pad, filter opens', 'pad'),
             ('Reese Bass C', reese(36, 1.6), 'Detuned two-saw reese bass + sub sine, moving filter', '808'),
             ('Shimmer Swell', reverb(supersaw([72, 79, 84, 88], 2.5, att=1.8, rel=1.0, cutoff=(2000, 9000), level=0.8), 3.2, 0.5, seed=71), 'High octave supersaw shimmer that blooms in', 'pad'),
             ('Choir Stab Aah', choir([60, 64, 67, 72], 0.35, 'aa', voices=4, att=0.01, rel=0.25, seed=72), 'Short formant "aah" choir stab for hits', None)]
    return dict(id='stage-fx-modern', name='Stage FX Modern', key='C', bpm=None, pads=pads)

BANKS = {'trap-sanctuary': bank_trap, 'drill-pulpit': bank_drill, 'amapiano-praise': bank_amapiano,
         'neo-soul-sunday': bank_neosoul, 'stage-fx-modern': bank_fx}

# ------------------------------------------------------------------ output
def slug(s): return ''.join(c.lower() if c.isalnum() else '_' for c in s).strip('_').replace('__', '_')

def master(y, is_loop, notrim=False):
    y = np.asarray(y, float)
    if y.ndim == 2 and np.max(np.abs(y[:, 0] - y[:, 1])) < 1e-6: y = y[:, 0]
    if not is_loop and not notrim: y = trim_lead(y, -50)
    y = y - (np.mean(y, axis=0) if is_loop else 0)
    tp = true_peak(y); y = y * (10 ** (TP_TARGET / 20) / tp)
    return y

def decoded_tp(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(float)
    return db(peak(signal.resample_poly(x, 4, 1))) if len(x) else -120

def write(bank_id, idx, name, y, desc, choke=None, bpm=None, bars=None, key=None):
    is_loop = bars is not None
    y = master(y, is_loop, notrim=name.startswith(('Riser', 'Reverse')))
    rel = f'modern/{bank_id}/{idx:02d}_{slug(name)}'
    wpath = os.path.join(ROOT, 'wav', rel + '.wav'); opath = os.path.join(ROOT, 'ogg', rel + '.ogg')
    os.makedirs(os.path.dirname(wpath), exist_ok=True); os.makedirs(os.path.dirname(opath), exist_ok=True)
    g = 1.0
    for _ in range(6):
        pcm = np.clip(np.round(y * g * 32767), -32768, 32767).astype(np.int16); wavfile.write(wpath, SR, pcm)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wpath, '-c:a', 'libvorbis', '-q:a', '5', opath], check=True)
        otp = decoded_tp(opath); wtp = db(true_peak(pcm.astype(float) / 32768))
        if otp < TP_LIMIT - 0.05 and wtp < TP_LIMIT: break
        g *= 10 ** ((TP_LIMIT - 0.25 - max(otp, wtp)) / 20)
    lead_ms = 0.0
    a = np.abs(pcm) if pcm.ndim == 1 else np.max(np.abs(pcm), 1); lead_ms = float(np.argmax(a > 32767 * 10 ** (-40 / 20)) / SR * 1000)
    rms = db(np.sqrt(np.mean((pcm.astype(float) / 32768) ** 2)))
    meta = dict(id=f'{bank_id}-{idx:02d}', name=name, type='loop' if is_loop else 'oneshot', bpm=bpm if is_loop else None, key=key,
                bars=bars, description=desc)
    if is_loop: meta.update(beats=bars * 4, timeSig='4/4')
    if choke: meta['chokeGroup'] = choke
    meta.update(file=os.path.relpath(wpath, ROOT), web={'ogg': os.path.relpath(opath, ROOT)}, samples=len(pcm), sampleRate=SR,
                channels=1 if pcm.ndim == 1 else 2, durationSec=round(len(pcm) / SR, 4), source='synthesized', author=AUTHOR,
                license=LICENSE, attribution='', truePeakDb=round(max(otp, wtp), 2), rmsDb=round(rms, 1), leadMs=round(lead_ms, 2))
    print(f'  {rel:60s} {meta["durationSec"]:6.2f}s tp {meta["truePeakDb"]:+.2f} rms {rms:5.1f} lead {lead_ms:.1f}ms', flush=True)
    return meta

def build(ids):
    out = []
    for bid in ids:
        print('bank', bid, flush=True)
        global R; R = np.random.default_rng(abs(sum(map(ord, bid))) * 7919)
        b = BANKS[bid](); pads = []
        for i, p in enumerate(b['pads']):
            name, y, desc = p[0], p[1], p[2]; choke = p[3] if len(p) > 3 else None
            bpm, bars = (p[4], p[5]) if len(p) > 5 else (None, None)
            pads.append(write(bid, i + 1, name, y, desc, choke, bpm, bars, b['key']))
        assert len(pads) == 16, (bid, len(pads))
        out.append(dict(id=bid, name=b['name'], key=b['key'], bpm=b['bpm'], group='modern', pads=pads))
    return out

if __name__ == '__main__':
    ids = sys.argv[1:] or list(BANKS)
    banks = build(ids)
    path = os.path.join(ROOT, '_build', 'banks_modern.json')
    prev = {b['id']: b for b in (json.load(open(path)) if os.path.exists(path) else [])}
    for b in banks: prev[b['id']] = b
    json.dump([prev[k] for k in BANKS if k in prev], open(path, 'w'), indent=2); print('saved', path)
