# Chord detection research — Sanctum on-device vs server

**Date:** Thu Nov 5 2026 (America/Los_Angeles) · Tiberious Productions / Sanctum  
**Goal:** Choose a chord pipeline that runs on phone WebViews (Capacitor 8 Android today; iOS later) with Web Audio / WASM / TF.js, and document what belongs on a server.

## Methods surveyed

### 1. Chromagram / HPCP + template matching + HMM/Viterbi

- Extract a 12-bin pitch-class profile per frame (STFT chroma or Harmonic Pitch Class Profile).
- Score each frame against chord templates (binary or weighted pitch-class masks for maj/min/7/…).
- Smooth the sequence with an HMM whose states are chord labels; decode with Viterbi (or a causal/buffered variant for live).
- Classical MIR baseline (Sheh & Ellis ISMIR 2003; Müller FMP §5.3; Cho & Bello IEEE/ACM TASLP 2014). High self-transition probability reduces flicker.
- **On-device:** Excellent fit. Pure JS/TS or light WASM. Latency ≈ hop size (typically  Hop 1024 @ 22–44 kHz → ~23–46 ms) plus a small observation buffer for causal Viterbi (~3–8 frames → 100–400 ms display lag). Accuracy on clean harmonic material ~70–85% triad ASR; full mixes / distorted guitar lower.
- **Sources:** [FMP C5S3 HMM chord recognition](https://audiolabs-erlangen.de/resources/MIR/FMP/C5/C5S3_ChordRec_HMM.html); Cho & Bello 2014; Jiang et al. AES Semantic Audio 2011 (chroma types).

### 2. Beat-synchronous chroma

- Align chroma frames to estimated beats/downbeats, then run template+HMM once per beat (or bar).
- Improves chart readability and reduces mid-beat flicker; needs a beat tracker (spectral flux + autocorrelation, or a learned tracker).
- **On-device:** Feasible offline and near-real-time if beat tracking is DSP-only. Learned beat trackers (madmom RNN) are heavier.
- Accuracy gain mainly on rhythmic pop/gospel with clear kick; little help on free rubato.

### 3. NNLS-chroma + Chordino (Mauch 2010)

- Non-negative least-squares chroma separates bass and treble chroma; Chordino matches ~217 chord types (maj/min/7/maj7/min7/6/dim/aug/hdim7 + selected inversions) and Viterbi-decodes.
- Reference Vamp plugin; JS port `@audio/mir-chordino` + `@audio/mir-nnls-chroma` (audiojs, 2026).
- **On-device:** Good for **offline** file analysis in a Worker. Real-time on mid phones is borderline (NNLS per frame is heavier than STFT chroma). Expected accuracy above plain templates on jazz/gospel with 7ths and slash chords.
- **Sources:** Mauch PhD QMUL 2010; [audiojs Chordino](https://audio.js.org/modules/mir-chordino/).

### 4. Essentia.js (HPCP, ChordsDetection in WASM)

- Essentia C++ → WASM; chain Windowing → Spectrum → SpectralPeaks → SpectralWhitening → HPCP → ChordsDetection.
- Documented for browser real-time and offline; AGPLv3.
- **On-device:** Proven on Android/iOS browsers (TISMIR 2022 paper). Real-time HPCP OK; ChordsDetection typically used offline or at modest hop rates. Latency similar to chroma+HMM. Accuracy competitive with classical MIR (~MIREX-era maj/min).
- **Sources:** [Essentia.js TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.111); [essentia.js chord issue/example](https://github.com/MTG/essentia.js/issues/22).

### 5. Meyda

- Lightweight Web Audio feature extractor (chroma, MFCC, RMS, …). **No chord classifier** — only features.
- **On-device:** Fine as a chroma front-end; still need templates/HMM afterward.

### 6. Spotify Basic Pitch (TF.js) → chord classification

- Tiny polyphonic AMT CNN (~17K params, ~0.9 MB TF.js). Windows ~2 s; live demos re-decode every ~0.5–0.8 s → ~1 s lag.
- Instrument-agnostic; best on single instrument; weak on dense full mixes. Notes → pitch-class sets → chord label (second stage).
- **On-device:** Runs in phone browsers (WebGPU/WebGL/WASM). Too slow/heavy for tight live worship cueing; useful as an **offline** enrichment pass. CREPE is **monophonic only** — do not use for chords.
- **Sources:** [@spotify/basic-pitch](https://github.com/spotify/basic-pitch-ts); EarSheet web demo; CREPE issue #63 (polyphony unsupported).

### 7. madmom deep-chroma / CRF

- Deep chroma CNN + CRF chord recognition (Korzeniowski & Widmer ISMIR 2016). Strong maj/min accuracy in Python.
- **On-device:** No official browser build. Porting needs ONNX/TF.js conversion + CRF decode. Treat as **server-side** (or future ONNX) unless we ship a converted model.

### 8. BTC and large-vocabulary transformers

- Bi-directional Transformer for Chord Recognition (ISMIR 2019), ~170 chord types. MelodyScan Pro runs BTC in-browser via **ONNX Runtime WebAssembly** (model cached in IndexedDB).
- **On-device:** Possible offline with a multi‑MB model download and noticeable CPU/GPU cost on phones; not ideal for low-latency live. Best accuracy on large vocab when you can wait.
- Server-side batch remains the practical path for catalog-scale analysis.

### 9. Other WASM engines (libsonare)

- `@libraz/libsonare` WASM: BPM, key, chords with optional HMM, inversions, key context, NNLS chroma.
- Useful reference; dependency/size/licensing must be reviewed before shipping in Sanctum.

## Recommendation for Sanctum

| Path | Stack | Latency | Expected accuracy (clean synth / full mix) | Where |
|---|---|---|---|---|
| **Live mic/line** | Pulpit chroma (`keydetect`) + extended templates + causal HMM/Viterbi + hysteresis | ~150–400 ms display | ~80–95% / ~55–75% (maj/min/7 family) | **On-device** (default) |
| **Import / OfflineAudioContext** | Same DSP in a Worker; optional beat-synchronous grouping; optional future Chordino/Essentia | Faster than realtime on desktop; 0.2–1× realtime on phones | +5–10 pts with beat sync / NNLS | **On-device** |
| Basic Pitch → chords | TF.js | ~1 s+ | Helps sparse instruments; weak on full band | Optional offline |
| madmom / BTC large vocab / catalog jobs | Python or ONNX server | seconds–minutes | Best for big vocab & noisy mixes | **Server** (future) |

**Ship now:** on-device chromagram + templates (maj, min, 7, maj7, m7, sus2/4, dim, aug, optional slash via bass chroma) + Viterbi smoothing, reusing `src/pulpit/keydetect.ts`. Keep Beat Theory / Markov for next-chord UI. Do **not** embed YouTube or streaming rippers; import only user files, CORS audio URLs, and Sanctum banks.

## Accuracy & latency targets (this build)

- Synthetic triad/7th tones + mild noise: ≥ 85% exact label match offline; live path same DSP with ≥ 3-frame hold to avoid flicker.
- Live UI update interval ~100–150 ms; chord change commit after confidence + Viterbi agree.
- No network round-trip for detection itself.

