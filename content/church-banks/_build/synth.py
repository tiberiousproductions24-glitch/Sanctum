#!/usr/bin/env python3
"""Sanctum church-banks synthesizer. All sounds are original synthesis (no samples).
Run: python3 synth.py  -> writes wav/ ogg/ mp3/ + manifest.json in parent dir."""
import numpy as np, json, os, subprocess, sys
from scipy import signal
from scipy.io import wavfile

SR = 44100
OS = 4                    # oversampling for Karplus-Strong tuning accuracy
SRO = SR * OS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(7)

KEYS = {  # key: (bpm, guitar root midi, bass root midi)
    'G': (132, 55, 31),
    'C': (120, 48, 36),
    'D': (140, 50, 38),
    'A': (150, 57, 33),
}
NOTE_NAMES = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

# ---------------------------------------------------------------- utils
def bp(x, lo, hi, sr=SR, order=2):
    sos = signal.butter(order, [lo, hi], 'bandpass', fs=sr, output='sos'); return signal.sosfilt(sos, x)
def lp(x, f, sr=SR, order=2):
    sos = signal.butter(order, f, 'lowpass', fs=sr, output='sos'); return signal.sosfilt(sos, x)
def hp(x, f, sr=SR, order=2):
    sos = signal.butter(order, f, 'highpass', fs=sr, output='sos'); return signal.sosfilt(sos, x)

def room(x, t=0.35, mix=0.12, sr=SR, seed=1):
    r = np.random.default_rng(seed)
    n = int(t * sr); tt = np.arange(n) / sr
    ir = r.standard_normal(n) * np.exp(-tt * 6.9 / t)
    ir = lp(ir, 5000); ir[:int(0.012*sr)] = 0; ir /= np.sqrt(np.sum(ir**2))
    if x.ndim == 1:
        wet = signal.fftconvolve(x, ir)[:len(x)]
    else:
        wet = np.stack([signal.fftconvolve(x[:, c], ir)[:len(x)] for c in range(x.shape[1])], 1)
    return x + mix * wet

def loop_len(bpm, bars): return int(round(bars * 4 * 60.0 / bpm * SR))

def wrap(buf, L):
    """Fold tail past loop end back onto start => seamless loop."""
    out = buf[:L].copy(); rest = buf[L:]; i = 0
    while len(rest):
        n = min(L, len(rest)); out[:n] += rest[:n]; rest = rest[n:]
    return out

def normalize(x, db=-1.0):
    pk = np.max(np.abs(x)); return x * (10 ** (db / 20) / pk) if pk > 0 else x

def trim_oneshot(x, thresh_db=-60):
    a = np.abs(x) if x.ndim == 1 else np.max(np.abs(x), 1)
    th = a.max() * 10 ** (thresh_db / 20); idx = np.where(a > th)[0]
    end = min(len(x), idx[-1] + int(0.01 * SR)) if len(idx) else len(x)
    st = max(0, idx[0] - 16) if len(idx) else 0
    x = x[st:end].copy(); f = min(len(x), int(0.006 * SR))
    ramp = np.linspace(1, 0, f)
    if x.ndim == 1: x[-f:] *= ramp
    else: x[-f:] *= ramp[:, None]
    return x

def add(buf, x, pos):
    pos = int(pos)
    if pos < 0: x = x[-pos:]; pos = 0
    n = min(len(x), len(buf) - pos)
    if n > 0: buf[pos:pos + n] += x[:n]

# ---------------------------------------------------------------- guitar (Karplus-Strong)
def ks_note(midi, dur, t60=1.2, s=0.25, bright=0.6, vel=1.0, mute=False):
    f = mtof(midi); Nf = SRO / f - s; N = max(2, int(round(Nf)))
    total = int(dur * SRO)
    exc = rng.uniform(-1, 1, N)
    exc = lp(exc, 800 + bright * 9000, sr=SRO, order=1)
    # pick position comb (pluck ~1/5 from bridge)
    d = max(1, N // 5); exc = exc - 0.8 * np.concatenate([np.zeros(d), exc[:-d]])
    exc -= exc.mean()
    g = 10 ** (-3 * (N / SRO) / t60)
    y = np.zeros(total + N + 1)
    y[:N] = exc
    for st in range(N, total, N):
        a = y[st - N:st]; b = y[st - N - 1:st - 1] if st - N - 1 >= 0 else np.concatenate([[0], y[:N - 1]])
        y[st:st + N] = g * ((1 - s) * a + s * b)
    y = y[:total] * vel
    if mute:
        y = lp(y, 1400, sr=SRO, order=2)
    return y

def choke(x, keep_s, rel_s=0.03, sr=SRO):
    k = int(keep_s * sr); r = int(rel_s * sr)
    if k >= len(x): return x
    env = np.ones(len(x)); env[k:k + r] = np.linspace(1, 0, min(r, len(x) - k)); env[k + r:] = 0
    return x * env

def strum(buf, t, notes, direction='down', kind='open', length=0.2, vel=1.0, spread=0.008):
    ns = sorted(notes) if direction == 'down' else sorted(notes, reverse=True)
    if direction == 'up': ns = ns[:4]  # upstrokes catch top strings
    for i, m in enumerate(ns):
        dt = i * spread * (0.7 + 0.6 * rng.random())
        v = vel * (0.85 + 0.3 * rng.random()) * (0.9 if direction == 'up' else 1.0)
        if kind == 'scratch':   # fully muted chicken scratch: very short, pitched thunk + pick noise
            x = ks_note(m, 0.09, t60=0.05, s=0.5, bright=0.9, vel=v * 2.6, mute=True)
            nz = rng.standard_normal(int(0.012 * SRO)) * np.exp(-np.linspace(0, 6, int(0.012 * SRO)))
            x[:len(nz)] += 0.7 * v * bp(nz, 1500, 6000, sr=SRO)
        elif kind == 'palm':
            x = ks_note(m, length + 0.1, t60=0.25, s=0.45, bright=0.5, vel=v, mute=True)
            x = choke(x, length)
        else:
            x = ks_note(m, length + 0.12, t60=1.6, s=0.18, bright=0.6, vel=v)
            x = choke(x, length, 0.04)
        add(buf, x, (t + dt) * SRO)

def guitar_post(x):
    x = hp(x, 75) + 0.25 * bp(x, 90, 140) + 0.15 * bp(x, 180, 260) + 0.1 * bp(x, 2500, 4000)
    x = lp(x, 7500)
    x = normalize(x, 0); x = np.tanh(1.6 * x) / np.tanh(1.6)   # light clean-amp drive
    return room(x, 0.3, 0.10, seed=3)

INTERVALS = {'9': [0, 4, 10, 14, 19], '13': [0, 10, 16, 21], '7#9': [0, 4, 10, 15], 'dim7': [0, 3, 6, 9, 12],
             'm9': [0, 3, 10, 14], '6/9': [0, 4, 9, 14], '7': [0, 4, 10, 12, 16], 'maj': [0, 4, 7, 12, 16],
             'm7': [0, 3, 7, 10, 15]}
def chord(key_root, degree_semi, quality, low=50, high=80, bass_semi=None):
    r = key_root + degree_semi
    ns = [r + i for i in INTERVALS[quality]]
    while min(ns) < low: ns = [n + 12 for n in ns]
    while min(ns) >= low + 12: ns = [n - 12 for n in ns]
    while max(ns) > high: ns = [n - 12 if n == max(ns) else n for n in ns]
    if bass_semi is not None:
        b = key_root + bass_semi
        while b > min(ns): b -= 12
        while b < 40: b += 12
        ns = [b] + ns
    return sorted(set(ns))

def swing16(step, bpm, amt=0.56):
    """step = 16th index -> seconds, with 16th swing."""
    q = 60.0 / bpm; beat, sub = divmod(step, 4)
    off = [0, amt * 2, 1, 1 + amt * 2][sub] * (q / 4) if False else [0, amt, 1.0, 1 + amt][sub] * (q / 2)
    return beat * q + off

def hum(): return rng.normal(0, 0.003)

def g_scratch_loop(key):
    """2 bars: 1(9) | 4(9) — 16th chicken-scratch with open stabs on accents. Nashville: | 1 | 4 |"""
    bpm, gr, _ = KEYS[key]; bars = 2; L = loop_len(bpm, bars)
    buf = np.zeros(int((L / SR + 2) * SRO))
    chords = [chord(gr, 0, '9'), chord(gr, 5, '9')]
    # pattern per bar (16 steps): O=open stab, x=scratch, .=rest/ghost-muted
    pat = 'O.xxx.Oxx.xxO.xx'
    for b in range(bars):
        for i, c in enumerate(pat):
            step = b * 16 + i; t = swing16(step, bpm) + hum()
            d = 'down' if i % 2 == 0 else 'up'; ch = chords[b]
            if c == 'O': strum(buf, t, ch[1:], d, 'open', length=0.11, vel=0.7)
            elif c == 'x': strum(buf, t, ch[1:], d, 'scratch', vel=0.55 + 0.2 * (i % 4 == 2), spread=0.005)
            elif c == '.': strum(buf, t, ch[2:], d, 'scratch', vel=0.18, spread=0.003)  # ghost
    y = signal.resample_poly(buf, 1, OS); y = guitar_post(y); return wrap(y, L), bpm, bars

def g_passing_loop(key):
    """4 bars of gospel passing chords: | 1(9) | 4(13) #4dim7 | 1/5 6(7#9) | 2m9 5(13) |"""
    bpm, gr, _ = KEYS[key]; bars = 4; L = loop_len(bpm, bars)
    buf = np.zeros(int((L / SR + 2) * SRO))
    prog = [[chord(gr, 0, '9')] * 2, [chord(gr, 5, '13'), chord(gr, 6, 'dim7')],
            [chord(gr, 0, 'maj', bass_semi=7), chord(gr, 9, '7#9')], [chord(gr, 2, 'm9'), chord(gr, 7, '13')]]
    # per half-bar (8 steps): stab on 1, 'and' of 1 scratch, push on 'a' of 2
    half = ['O', 'x', '.', 'x', 'x', 'S', 'x', 'P']
    for b in range(bars):
        for h in range(2):
            ch = prog[b][h]; nxt = prog[(b + (h == 1)) % bars][(h + 1) % 2]
            for i, c in enumerate(half):
                step = b * 16 + h * 8 + i; t = swing16(step, bpm) + hum(); d = 'down' if i % 2 == 0 else 'up'
                if c == 'O': strum(buf, t, ch, d, 'open', length=0.16)
                elif c == 'S': strum(buf, t, ch[-4:], d, 'open', length=0.07, vel=0.7)
                elif c == 'P': strum(buf, t, nxt[-4:], 'up', 'open', length=0.09, vel=0.8)  # anticipation
                elif c == 'x': strum(buf, t, ch[-4:], d, 'scratch', vel=0.5)
                else: strum(buf, t, ch[-3:], d, 'scratch', vel=0.16)
    y = signal.resample_poly(buf, 1, OS); y = guitar_post(y); return wrap(y, L), bpm, bars

def g_lick(key):
    """2-bar single-note shout lick (major pentatonic + blue b3 grace notes). Nashville 1 -> 4 -> 1."""
    bpm, gr, _ = KEYS[key]; bars = 2; L = loop_len(bpm, bars)
    buf = np.zeros(int((L / SR + 2) * SRO)); base = gr + 12
    if base > 69: base -= 12
    # (16th step, length in 16ths, semitone above root, grace-from)
    line = [(0, 2, 12, None), (2, 1, 9, None), (3, 1, 7, None), (4, 2, 4, 3), (6, 1, 2, None), (7, 1, 0, None),
            (8, 2, 2, None), (10, 1, 4, 3), (11, 1, 7, None), (12, 3, 9, None), (15, 1, 7, None),
            (16, 2, 10, 9), (18, 1, 9, None), (19, 1, 5, None), (20, 2, 9, None), (22, 1, 7, None), (23, 1, 4, None),
            (24, 2, 7, None), (26, 1, 4, 3), (27, 1, 2, None), (28, 4, 0, None)]
    q16 = 60.0 / bpm / 4
    for st, ln, semi, gfrom in line:
        t = swing16(st, bpm) + hum(); m = base + semi; dur = ln * q16 * 0.95
        if gfrom is not None:   # hammer-on / slide grace note
            gx = ks_note(base + gfrom, 0.05, t60=0.8, s=0.15, bright=0.8, vel=0.7); add(buf, choke(gx, 0.035, 0.01), (t - 0.035) * SRO)
            x = ks_note(m, dur + 0.1, t60=1.3, s=0.15, bright=0.55, vel=0.85)
        else:
            x = ks_note(m, dur + 0.1, t60=1.3, s=0.15, bright=0.8, vel=1.0)
        add(buf, choke(x, dur, 0.03), t * SRO)
    y = signal.resample_poly(buf, 1, OS); y = guitar_post(y); return wrap(y, L), bpm, bars

def g_oneshot(notes, kind='open', length=0.6, direction='down'):
    buf = np.zeros(int(2.5 * SRO)); strum(buf, 0.005, notes, direction, kind, length=length)
    y = signal.resample_poly(buf, 1, OS); return trim_oneshot(guitar_post(y))

# ---------------------------------------------------------------- organ (drawbar additive + perc + Leslie)
FOOT = [0.5, 1.5, 1, 2, 3, 4, 5, 6, 8]
def tonewheels(midi, dur, reg, sr=SR):
    n = int(dur * sr); t = np.arange(n) / sr; f0 = mtof(midi); y = np.zeros(n)
    for ratio, lvl in zip(FOOT, reg):
        if lvl == 0: continue
        f = f0 * ratio
        while f > 6000: f /= 2   # foldback like a real tonewheel generator
        y += 10 ** ((int(lvl) - 8) * 3 / 20) * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))
    return y

def organ_voice(notes, dur, reg='888000000', perc=True, attack=0.004, release=0.06, swell=False, vel=1.0):
    n = int((dur + release + 0.05) * SR); y = np.zeros(n)
    for m in notes:
        x = tonewheels(m, n / SR, reg)
        if perc:   # 3rd-harmonic percussion, fast decay
            t = np.arange(n) / SR; x += 0.9 * np.sin(2 * np.pi * mtof(m) * 3 * t) * np.exp(-t / 0.18)
        # key click
        k = int(0.004 * SR); x[:k] += 0.4 * bp(rng.standard_normal(k), 1500, 8000) * np.linspace(1, 0, k)
        y += x
    env = np.ones(n); a = int(attack * SR); env[:a] = np.linspace(0, 1, a)
    d = int(dur * SR); r = int(release * SR); env[d:d + r] = np.linspace(1, 0, r); env[d + r:] = 0
    if swell:
        t = np.arange(n) / SR; env *= np.clip(t / (dur * 0.85), 0, 1) ** 1.6 * 0.95 + 0.05
    return y * env * vel / max(1, len(notes)) ** 0.5

def leslie(x, horn_hz=6.8, drum_hz=5.9, ramp=None, sr=SR):
    """Rotary-speaker sim: crossover 800 Hz, AM + Doppler per rotor, stereo mics. ramp=(start_hz,end_hz) for horn speed-up."""
    n = len(x); t = np.arange(n) / sr
    lo = lp(x, 800, order=4); hi = hp(x, 800, order=4)
    def phase(hz):
        if ramp is None: return 2 * np.pi * hz * t
        f = np.interp(t, [0, t[-1] * 0.7, t[-1]], [ramp[0] * hz / 6.8, hz, hz])
        return 2 * np.pi * np.cumsum(f) / sr
    out = np.zeros((n, 2))
    for sig, ph, depth_am, depth_ms in [(hi, phase(horn_hz), 0.45, 0.35), (lo, phase(drum_hz * 0.98), 0.2, 0.15)]:
        for c, off in enumerate([0, np.pi / 2]):
            dly = (depth_ms / 1000) * sr * (1 + np.sin(ph + off))
            idx = np.arange(n) - dly
            sh = np.interp(idx, np.arange(n), sig, left=0)
            out[:, c] += sh * (1 - depth_am * 0.5 * (1 + np.cos(ph + off)))
    return out

def organ_post(y, **kw):
    y = normalize(y, 0); y = np.tanh(1.8 * y) / np.tanh(1.8)  # tube-ish overdrive
    s = leslie(y, **kw); return room(s, 0.6, 0.15, seed=5)

def organ_stab(key, degree, quality, length=0.22):
    _, gr, _ = KEYS[key]; ns = chord(gr, degree, quality, low=55, high=79)
    y = organ_voice(ns, length, '888000000', perc=True)
    y = np.concatenate([y, np.zeros(int(0.8 * SR))]); return trim_oneshot(organ_post(y))

def organ_swell(key, secs=3.2):
    _, gr, _ = KEYS[key]; ns = chord(gr, 0, '6/9', low=52, high=79) + [gr - 12 + 12 * (gr < 52)]
    y = organ_voice(ns, secs, '888888888', perc=False, attack=0.05, release=0.5, swell=True)
    y = np.concatenate([y, np.zeros(int(0.8 * SR))])
    return trim_oneshot(organ_post(y, ramp=(0.8, 6.8)))  # Leslie spins up from slow to fast

def organ_shout_loop(key):
    """2 bars, offbeat shout stabs: | 1 (7) | 4 (9)  #4dim | — stabs on the &s, push into bar 2."""
    bpm, gr, _ = KEYS[key]; bars = 2; L = loop_len(bpm, bars); q = 60.0 / bpm
    buf = np.zeros(L + 2 * SR)
    I = chord(gr, 0, '7', 55, 79); IV = chord(gr, 5, '9', 55, 79); dim = chord(gr, 6, 'dim7', 55, 79)
    hits = [(0, 0.35, I, 1.0), (0.5 + 0.06, 0.2, I, 0.8), (1.5 + 0.06, 0.2, I, 0.9), (2.5 + 0.06, 0.2, I, 0.8), (3.5 + 0.06, 0.3, IV, 0.95),
            (4.5 + 0.06, 0.2, IV, 0.8), (5.5 + 0.06, 0.2, IV, 0.9), (6.0, 0.35, dim, 0.9), (6.5 + 0.06, 0.2, dim, 0.8), (7.5 + 0.06, 0.3, I, 0.95)]
    for beat, ln, ns, v in hits:
        add(buf, organ_voice(ns, ln * q * 2, '888000000', perc=True, vel=v), (beat * q + hum()) * SR)
    # left-hand pad underneath (soft 16' 8')
    for b in range(bars):
        root = gr - 12 + (5 if b == 1 else 0)
        add(buf, organ_voice([root, root + 7], 4 * q * 0.98, '808000000', perc=False, vel=0.35, attack=0.01), b * 4 * q * SR)
    y = organ_post(buf); return wrap(y, L), bpm, bars

# ---------------------------------------------------------------- bass
def bass_note(midi, dur, vel=1.0, ghost=False, slide_from=None):
    n = int((dur + 0.05) * SR); t = np.arange(n) / SR; f = mtof(midi)
    if slide_from is not None:
        fs = mtof(slide_from); fcur = f + (fs - f) * np.exp(-t / 0.03)
    else: fcur = np.full(n, f)
    ph = 2 * np.pi * np.cumsum(fcur) / SR
    saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
    sine = np.sin(ph)
    # filter envelope on saw (pluck)
    cut = 250 + 1800 * np.exp(-t / 0.06)
    sw = np.zeros(n); zi = 0.0
    a = np.exp(-2 * np.pi * cut / SR)
    # one-pole time-varying LPF x2
    s1 = s2 = 0.0
    for i in range(n):
        s1 = (1 - a[i]) * saw[i] + a[i] * s1; s2 = (1 - a[i]) * s1 + a[i] * s2; sw[i] = s2
    y = 0.9 * sine + 0.55 * sw + 0.15 * np.sin(2 * ph)
    env = np.exp(-t / (0.6 if not ghost else 0.05)) * np.clip(t / 0.003, 0, 1)
    d = int(dur * SR); r = int(0.025 * SR); env[d:d + r] *= np.linspace(1, 0, min(r, n - d)); env[d + r:] = 0
    return y * env * vel * (0.35 if ghost else 1.0)

def bass_post(y):
    y = hp(y, 30); y = normalize(y, 0); y = np.tanh(1.4 * y) / np.tanh(1.4); return lp(y, 4000)

def bass_render(key, events, bars):
    bpm, _, br = KEYS[key]; L = loop_len(bpm, bars); q16 = 60.0 / bpm / 4
    buf = np.zeros(L + SR)
    for st, ln, semi, v, *rest in events:
        ghost = v < 0.5; sl = rest[0] if rest else None
        x = bass_note(br + semi, ln * q16 * 0.92, v, ghost, None if sl is None else br + sl)
        add(buf, x, (swing16(st, bpm) + hum() * 0.5) * SR)
    return wrap(bass_post(buf), L), bpm, bars

def bass_pump(key):   # | 1 | 4 | octave pump with ghosts
    ev = []
    for b, deg in enumerate([0, 5]):
        o = b * 16
        ev += [(o + 0, 2, deg, 1), (o + 2, 1, deg + 12, 0.8), (o + 3, 1, deg, 0.3), (o + 4, 2, deg, 0.9), (o + 6, 1, deg + 12, 0.8),
               (o + 7, 1, deg + 12, 0.3), (o + 8, 2, deg, 1), (o + 10, 1, deg + 12, 0.8), (o + 11, 1, deg + 10, 0.7), (o + 12, 1, deg + 7, 0.9),
               (o + 13, 1, deg + 7, 0.3), (o + 14, 1, deg + 9, 0.8), (o + 15, 1, (6 if b == 0 else -1), 0.8)]
    return bass_render(key, ev, 2)

def bass_walk(key):   # follows guitar passing loop: | 1 | 4 #4 | 5 6 | 2 5 |
    targets = [(0, 0), (8, 0), (16, 5), (24, 6), (32, 7), (40, 9), (48, 2), (56, 7)]
    ev = []
    for i, (st, deg) in enumerate(targets):
        nxt = targets[(i + 1) % len(targets)][1]
        ev += [(st, 3, deg, 1.0, deg - 2 if i % 2 == 0 else None), (st + 3, 1, deg, 0.3), (st + 4, 2, deg + 12, 0.8),
               (st + 6, 1, deg + 7, 0.75), (st + 7, 1, nxt - 1 if nxt > deg else nxt + 1, 0.85)]
    return bass_render(key, ev, 4)

def bass_run(key):    # 1-bar shout turnaround run: 8 b7 6 5 4 3 b3 2 | lands on 1 at loop restart
    seq = [12, 10, 9, 7, 5, 4, 3, 2, 0, 0, 12, 0, 7, 9, 10, 11]
    ev = [(i, 1, s, 0.95 if i % 2 == 0 else 0.75) for i, s in enumerate(seq)]
    return bass_render(key, ev, 1)

def bass_hit(key):
    _, _, br = KEYS[key]; y = bass_note(br, 0.9, 1.0, slide_from=br - 2)
    return trim_oneshot(bass_post(np.concatenate([y, np.zeros(SR // 4)])))

# ---------------------------------------------------------------- percussion
def shaker(vel=1.0, length=0.07, back=False):
    n = int(length * SR); t = np.arange(n) / SR
    env = (t / (length * (0.35 if back else 0.15))) * np.exp(1 - t / (length * (0.35 if back else 0.15)))
    x = bp(rng.standard_normal(n), 4500, 12000, order=3) * env
    return x * vel

def tamb_hit(vel=1.0, head=True, length=0.35):
    n = int(length * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for _ in range(14):  # jingles: inharmonic partials w/ micro-onsets
        f = rng.uniform(5200, 11500); on = rng.uniform(0, 0.012); dk = rng.uniform(0.05, 0.16)
        tt = np.clip(t - on, 0, None)
        y += np.sin(2 * np.pi * f * tt) * np.exp(-tt / dk) * (t >= on) * rng.uniform(0.3, 1)
    y += 0.8 * bp(rng.standard_normal(n), 6000, 14000) * np.exp(-t / 0.06)
    if head: y += 1.2 * np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.03) + 0.6 * bp(rng.standard_normal(n), 300, 1200) * np.exp(-t / 0.015)
    return y * vel / 6

def tamb_shake(vel=1.0, length=0.5):
    n = int(length * SR); y = np.zeros(n)
    for k in range(6): add(y, tamb_hit(0.5 + 0.1 * rng.random(), head=False, length=0.2), k * n / 7)
    t = np.arange(n) / SR; return y * np.minimum(1, t / 0.08) * np.exp(-t / 0.35) * vel

def clap_single(vel=1.0, seed=None, tone=1.0):
    r = np.random.default_rng(seed); n = int(0.4 * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for k, dt in enumerate([0, 0.009, 0.019, 0.026]):
        nn = int(0.012 * SR); burst = r.standard_normal(nn) * np.exp(-np.linspace(0, 5, nn))
        add(y, burst * (0.6 + 0.4 * (k == 3)), (dt + r.uniform(0, 0.002)) * SR)
    tail = r.standard_normal(n) * np.exp(-np.clip(t - 0.026, 0, None) / 0.07) * (t > 0.026)
    y = y + 0.5 * tail
    return bp(y, 900 * tone, 3200 * tone, order=2) * vel

def clap_layer(nhands=6, spread=0.022, vel=1.0, seed=0):
    r = np.random.default_rng(seed); y = np.zeros((int(0.6 * SR), 2))
    for h in range(nhands):
        c = clap_single(r.uniform(0.6, 1.0), seed=seed * 100 + h, tone=r.uniform(0.75, 1.35))
        pan = r.uniform(-0.7, 0.7); pos = r.uniform(0, spread) * SR
        add(y[:, 0], c * np.sqrt((1 - pan) / 2), pos); add(y[:, 1], c * np.sqrt((1 + pan) / 2), pos)
    return y * vel

def snap(vel=1.0):
    n = int(0.12 * SR); t = np.arange(n) / SR
    return (bp(rng.standard_normal(n), 2000, 7000) * np.exp(-t / 0.012) + 0.5 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.008)) * vel

def perc_groove(bpm):
    """2 bars: shaker 16ths (accent on &), tambourine on 2 & 4 + 8th jingles, swing."""
    bars = 2; L = loop_len(bpm, bars); buf = np.zeros((L + SR, 2))
    for st in range(32):
        t = swing16(st, bpm) + hum() * 0.5; sub = st % 4
        v = [0.55, 0.3, 0.85, 0.35][sub] * (0.9 + 0.2 * rng.random())
        s = shaker(v, back=(sub % 2 == 1)); add(buf[:, 0], s * 0.8, t * SR); add(buf[:, 1], s * 0.5, t * SR)
        beat = st // 4
        if sub == 0 and beat % 2 == 1: x = tamb_hit(1.0); add(buf[:, 1], x * 0.9, t * SR); add(buf[:, 0], x * 0.6, t * SR)
        elif sub == 2: x = tamb_hit(0.35, head=False, length=0.15); add(buf[:, 1], x * 0.8, t * SR); add(buf[:, 0], x * 0.4, t * SR)
    return wrap(room(buf, 0.4, 0.1), L), bpm, bars

def clap_groove(bpm):
    """2 bars congregational shout claps: big layered claps on 2 & 4, lighter claps on the &s (double-time feel)."""
    bars = 2; L = loop_len(bpm, bars); buf = np.zeros((L + SR, 2)); q = 60.0 / bpm
    for beat in range(8):
        if beat % 2 == 1: add(buf, clap_layer(8, 0.025, 1.0, seed=beat), (beat * q + hum()) * SR)
        add(buf, clap_layer(4, 0.018, 0.45, seed=50 + beat), (swing16(beat * 4 + 2, bpm) + hum()) * SR)
    return wrap(room(buf, 0.5, 0.18), L), bpm, bars

# ---------------------------------------------------------------- output
def write(rel, y, meta):
    y = normalize(y, -1.0); path = os.path.join(ROOT, 'wav', rel + '.wav'); os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = np.clip(np.round(y * 32767), -32768, 32767).astype(np.int16); wavfile.write(path, SR, pcm)
    web = {}
    for ext, args in [('ogg', ['-c:a', 'libvorbis', '-q:a', '4']), ('mp3', ['-c:a', 'libmp3lame', '-b:a', '128k'])]:
        op = os.path.join(ROOT, ext, rel + '.' + ext); os.makedirs(os.path.dirname(op), exist_ok=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path] + args + [op], check=True)
        web[ext] = os.path.relpath(op, ROOT)
    meta = dict(meta); meta.update(file=os.path.relpath(path, ROOT), web=web, samples=len(y), sampleRate=SR,
                                   channels=1 if y.ndim == 1 else 2, durationSec=round(len(y) / SR, 4),
                                   source='synthesized', author='Sanctum (original synthesis for Lawrence Davis Sr)',
                                   license='Original work - no third-party samples', attribution='')
    print('wrote', meta['file'], meta['durationSec'], 's', flush=True); return meta

def loop_meta(pid, name, key, bpm, bars, desc, nashville=None, choke_group=None):
    m = dict(id=pid, name=name, type='loop', bpm=bpm, key=key, bars=bars, beats=bars * 4, timeSig='4/4', description=desc)
    if nashville: m['nashville'] = nashville
    if choke_group: m['chokeGroup'] = choke_group
    return m

def one_meta(pid, name, key, desc):
    return dict(id=pid, name=name, type='oneshot', bpm=None, key=key, bars=None, description=desc)

def build(only=None):
    banks = []
    if only in (None, 'guitar'):
        pads = []
        for k in 'GCDA':
            y, bpm, bars = g_scratch_loop(k)
            pads.append(write(f'guitar/gtr_scratch_{k}_{bpm}bpm_{bars}bar', y, loop_meta(f'gtr-scratch-{k}', f'{k} Chicken Scratch', k, bpm, bars,
                        '16th-note muted chicken-scratch with open 9th stabs, swung', '| 1(9) | 4(9) |', 'guitar')))
        for k in 'GCDA':
            y, bpm, bars = g_passing_loop(k)
            pads.append(write(f'guitar/gtr_passing_{k}_{bpm}bpm_{bars}bar', y, loop_meta(f'gtr-pass-{k}', f'{k} Passing Chords', k, bpm, bars,
                        'Gospel passing-chord comp: 9ths, 13ths, #4dim7, 7#9 with anticipations', '| 1(9) | 4(13) #4dim7 | 1/5 6(7#9) | 2m9 5(13) |', 'guitar')))
        for k in 'GCDA':
            y, bpm, bars = g_lick(k)
            pads.append(write(f'guitar/gtr_lick_{k}_{bpm}bpm_{bars}bar', y, loop_meta(f'gtr-lick-{k}', f'{k} Shout Lick', k, bpm, bars,
                        'Single-note pentatonic shout lick with b3->3 hammer-ons', '6-5-3-2-1 / 2-3-5-6 / b7-6-4 / 5-3-2-1', 'guitar-lick')))
        gr = KEYS['G'][1]
        for pid, name, notes, kind, ln, desc in [
                ('gtr-hit-G9', 'G9 Stab', chord(gr, 0, '9'), 'open', 0.35, 'Open G9 funk stab'),
                ('gtr-hit-C13', 'C13 Stab', chord(gr, 5, '13'), 'open', 0.35, 'C13 (IV13 in G) stab'),
                ('gtr-hit-D7s9', 'D7#9 Stab', chord(gr, 7, '7#9'), 'open', 0.35, 'D7#9 (V in G) gritty stab'),
                ('gtr-hit-scratch', 'Muted Scratch', chord(gr, 0, '9'), 'scratch', 0.1, 'Fully muted chicken-scratch hit')]:
            pads.append(write(f'guitar/gtr_{pid[8:]}', g_oneshot(notes, kind, ln), one_meta(pid, name, 'G', desc)))
        banks.append(dict(id='shout-guitar', name='Shout Guitar', pads=pads))
    if only in (None, 'organ'):
        pads = []
        for k in 'GCDA':
            for deg, q, lbl in [(0, '7', 'I7'), (5, '9', 'IV9')]:
                nm = NOTE_NAMES[(KEYS[k][1] + deg) % 12] + q
                pads.append(write(f'organ/org_stab_{k}_{lbl}', organ_stab(k, deg, q), one_meta(f'org-stab-{k}-{lbl}', f'{nm} Stab ({lbl} of {k})', k,
                            'Drawbars 888000000, 3rd-harmonic percussion, key click, overdrive, fast Leslie')))
        for k in 'GCDA':
            y, bpm, bars = organ_shout_loop(k)
            pads.append(write(f'organ/org_shout_{k}_{bpm}bpm_{bars}bar', y, loop_meta(f'org-shout-{k}', f'{k} Shout Organ', k, bpm, bars,
                        'Offbeat shout stabs over 16\'+8\' left-hand pad, fast Leslie', '| 1(7) | 4(9) #4dim7 |', 'organ')))
        for k in 'GCDA':
            pads.append(write(f'organ/org_swell_{k}', organ_swell(k), one_meta(f'org-swell-{k}', f'{k}6/9 Swell', k,
                        'Full drawbars 888888888 volume-pedal swell, Leslie ramps slow->fast')))
        banks.append(dict(id='shout-organ', name='Shout Organ', pads=pads))
    if only in (None, 'bass'):
        pads = []
        for fn, tag, nm, desc, nash in [(bass_pump, 'pump', 'Octave Pump', 'Octave-pumping shout bass with ghost notes and chromatic pickups', '| 1 | 4 |'),
                                       (bass_walk, 'walk', 'Passing Walk', 'Walks the guitar passing-chord changes (pairs with Passing Chords loop)', '| 1 | 4 #4 | 5 6 | 2 5 |'),
                                       (bass_run, 'run', 'Turnaround Run', '1-bar descending/ascending shout run, lands on 1 at loop restart', '8 b7 6 5 4 3 b3 2 1 ... 5 6 b7 7')]:
            for k in 'GCDA':
                y, bpm, bars = fn(k)
                pads.append(write(f'bass/bass_{tag}_{k}_{bpm}bpm_{bars}bar', y, loop_meta(f'bass-{tag}-{k}', f'{k} {nm}', k, bpm, bars, desc, nash, 'bass')))
        for k in 'GCDA':
            pads.append(write(f'bass/bass_hit_{k}', bass_hit(k), one_meta(f'bass-hit-{k}', f'{k} Bass Hit', k, 'Low root hit with whole-step slide-in')))
        banks.append(dict(id='shout-bass', name='Shout Bass', pads=pads))
    if only in (None, 'perc'):
        pads = []
        for pid, name, y, desc in [('perc-shaker-fwd', 'Shaker Fwd', shaker(1, 0.08), 'Shaker forward stroke'),
                                   ('perc-shaker-back', 'Shaker Back', shaker(1, 0.11, back=True), 'Shaker back stroke (softer attack)'),
                                   ('perc-tamb-hit', 'Tambourine Hit', tamb_hit(1, True, 0.45), 'Tambourine struck on the head'),
                                   ('perc-tamb-shake', 'Tambourine Shake', tamb_shake(1, 0.6), 'Tambourine roll/shake'),
                                   ('perc-clap', 'Clap', clap_single(1, seed=3), 'Single handclap'),
                                   ('perc-clap-layer', 'Layered Clap', clap_layer(6, 0.02, 1, seed=11), 'Six-hand layered clap, stereo spread'),
                                   ('perc-clap-congregation', 'Congregation Clap', room(clap_layer(16, 0.035, 1, seed=21), 0.7, 0.25), 'Sixteen-hand church clap with room'),
                                   ('perc-snap', 'Finger Snap', snap(1), 'Finger snap')]:
            pads.append(write(f'perc/{pid[5:].replace("-", "_")}', trim_oneshot(y), one_meta(pid, name, None, desc)))
        for k in 'GCDA':
            bpm = KEYS[k][0]
            y, _, bars = perc_groove(bpm)
            pads.append(write(f'perc/perc_groove_{bpm}bpm_{bars}bar', y, loop_meta(f'perc-groove-{bpm}', f'Tamb+Shaker {bpm}', None, bpm, bars,
                        f'Shaker 16ths + tambourine on 2&4 (matches {k} loops)', None, 'perc-groove')))
            y, _, bars = clap_groove(bpm)
            pads.append(write(f'perc/perc_claps_{bpm}bpm_{bars}bar', y, loop_meta(f'perc-claps-{bpm}', f'Shout Claps {bpm}', None, bpm, bars,
                        f'Layered congregation claps on 2&4 + light &s (matches {k} loops)', None, 'perc-claps')))
        banks.append(dict(id='shout-percussion', name='Shout Percussion', pads=pads))
    return banks

if __name__ == '__main__':
    only = sys.argv[1] if len(sys.argv) > 1 else None
    banks = build(only)
    out = os.path.join(ROOT, '_build', f'banks_{only or "all"}.json')
    json.dump(banks, open(out, 'w'), indent=2); print('saved', out)
