# Sanctum Church / Funky Gospel Shout Banks

4 banks × 16 pads = 64 sounds of church-style "shout music" content: funky gospel guitar,
Hammond-style organ, shout bass, and shout percussion. **All sounds are original synthesis**
(see `_build/synth.py`); there are no third-party samples, so no attribution is required.
Freesound was checked but its API/download needs an account key, so no account was created and nothing was downloaded.

| Bank (`id`) | Pads |
|---|---|
| Shout Guitar (`shout-guitar`) | 1-4 Chicken Scratch G/C/D/A · 5-8 Passing Chords G/C/D/A · 9-12 Shout Lick G/C/D/A · 13 G9 stab · 14 C13 stab · 15 D7#9 stab · 16 muted scratch |
| Shout Organ (`shout-organ`) | 1-8 I7 / IV9 stabs in G, C, D, A · 9-12 Shout Organ loops G/C/D/A · 13-16 6/9 swells G/C/D/A |
| Shout Bass (`shout-bass`) | 1-4 Octave Pump G/C/D/A · 5-8 Passing Walk G/C/D/A · 9-12 Turnaround Run G/C/D/A · 13-16 bass hits G/C/D/A |
| Shout Percussion (`shout-percussion`) | 1-8 one-shots (shaker fwd/back, tamb hit/shake, clap, layered clap, congregation clap, snap) · 9-16 Tamb+Shaker and Shout Claps loops at 120/132/140/150 |

**v0.3.1 modern banks** (group `modern`, 48 kHz, synthesized by Tiberious Productions / Sanctum, `_build/synth_modern.py`):

| Bank (`id`) | Key / BPM | Pads |
|---|---|---|
| Trap Sanctuary (`trap-sanctuary`) | Fm / 140 | 1 Kick Punch · 2 Snare Crack · 3 Clap Stack · 4 Rim Knock · 5 Closed Hat · 6 Open Hat · 7 Hat Roll 1/32 · 8 Hat Roll Triplet · 9-12 808 F/Ab/C/Db Dist · 13 Trap Drums 140 (loop 2b) · 14 808 Line Fm 140 (loop 2b) · 15 Sanctuary Keys Fm 140 (loop 4b) · 16 Riser 2 Bars 140 |
| Drill Pulpit (`drill-pulpit`) | Gm / 142 | 1 Drill Kick · 2 Drill Snare · 3 Ghost Snare · 4 Rim Click · 5 Drill Hat · 6 Hat Triplet Roll · 7 Perc Clack · 8 Reverse Snare · 9 808 G Slide 5th · 10 808 G Slide Oct · 11 808 Bb Long · 12 808 Eb Electro · 13 Drill Drums 142 (2b) · 14 808 Slides Gm 142 (2b) · 15 Dark Choir Gm 142 (4b) · 16 Drill Hats 3-3-2 142 (2b) |
| Amapiano Praise (`amapiano-praise`) | Dm / 112 | 1 Piano Kick · 2-6 Log Drum D/F/G/A/C · 7 Shaker · 8 Wood Block · 9 Rim Shot · 10 Open Hat · 11 Conga · 12 Soft Clap · 13 Amapiano Drums 112 (2b) · 14 Log Drum Line Dm 112 (2b) · 15 Praise Keys Dm 112 (4b) · 16 Deep Sub D |
| Neo-Soul Sunday (`neo-soul-sunday`) | Eb / 84 | 1 Brush Kick · 2 Brush Snare · 3 Rim Click · 4 Brush Swirl · 5 Soft Hat · 6 Sub Eb · 7-10 Rhodes Ebmaj9/Cm11/Fm9/Bb13sus · 11 Organ Abmaj9 Stab · 12 Organ Shout Chop · 13 Neo-Soul Drums 84 (2b) · 14 Rhodes Changes Eb 84 (4b) · 15 Sub Line Eb 84 (4b) · 16 Sunday Organ Eb 84 (4b) |
| Stage FX Modern (`stage-fx-modern`) | C | 1 Impact Boom · 2 Impact Crack · 3 Sub Drop · 4 Reverse Swell · 5 Tape Stop · 6 Riser 4 s · 7 Riser 8 s · 8 Downlifter · 9 Choir Ooh C · 10 Choir Aah C · 11 Choir Ooh F · 12 Choir Aah G · 13 Supersaw Pad C · 14 Reese Bass C · 15 Shimmer Swell · 16 Choir Stab Aah |

Modern files: WAV 16-bit 48 kHz + OGG Vorbis q5 (no MP3). Mastering: 4x-oversampled true peak <= -1.05 dBTP (WAV and decoded OGG),
leading silence trimmed on one-shots (except risers/reverse FX, which keep their length so they land on the beat), loops sample-exact with tails wrapped.
Each pad has `truePeakDb`, `rmsDb`, `leadMs` in the manifest.

Key → tempo (every loop in a key uses this tempo, so they all line up):
**G = 132 BPM, C = 120, D = 140, A = 150.** Every loop is 4/4, 1, 2 or 4 bars long.
- Guitar **Passing Chords** (4 bars) goes with Bass **Passing Walk** (4 bars): `| 1(9) | 4(13) #4dim7 | 1/5 6(7#9) | 2m9 5(13) |`
- Guitar **Chicken Scratch**, Organ **Shout**, and Bass **Octave Pump** (2 bars) share `| 1 | 4 |`.

## Files
- `wav/<bank>/*.wav`: 44.1 kHz 16-bit masters, peaks normalized to -1 dBFS. Loop files are trimmed to the exact
  sample count `round(bars*4*60/bpm*44100)`, and the release tails are wrapped back onto the start, so they loop with no gap or click.
  Guitar and bass are mono. Organ, percussion loops, and layered claps are stereo.
- `ogg/…` (Vorbis q4) and `mp3/…` (128k) web versions with the same names. MP3 adds encoder padding, so **loop from WAV (or OGG)**.
  Use the MP3 only for one-shots or previews.
- `manifest.json` lists banks → pads with `file`, `web.ogg`, `web.mp3`, `name`, `type` (`loop`|`oneshot`), `bpm`, `key`, `bars`,
  `beats`, `nashville`, `chokeGroup`, `trigger`, `source`, `author`, `license`, `attribution`, `durationSec`, `samples`, `channels`.
  Paths are relative to this folder (`basePath: content/church-banks/`).

## How the app should load and play them
1. Fetch `manifest.json`, then add each `banks[]` entry as an extra pad bank after the starter banks. `pad` runs 1-16 in a 4×4 grid.
2. `fetch(basePath + pad.file)` → `decodeAudioData` (lazy-load per bank to keep startup fast; about 5 MB WAV per bank).
3. **One-shots** (`type: "oneshot"`, `trigger: "immediate"`): play the moment the pad is hit (`source.start(ctx.currentTime)`), with no loop.
4. **Loops** (`type: "loop"`, `trigger: "quantized"`): tempo-sync to the transport.
   - On a pad hit, start at the next bar boundary (or the next beat if the user picks "beat" quantize):
     `start(nextBarTime)`, `loop = true`, `loopStart = 0`, `loopEnd = buffer.duration`.
   - Tempo sync: `playbackRate = projectBpm / pad.bpm` (this repitches; fine within about ±8%), or use a time-stretcher.
     Better still, set the project BPM to the loop's BPM when its bank is first used (a key's loops all share one tempo).
   - Hitting the pad again stops it at the next bar boundary (toggle). Pads with the same `chokeGroup` (e.g. `guitar`, `bass`)
     replace each other at the next bar, so switching G scratch → G passing is seamless.
   - 1-bar runs and 4-bar loops line up with 2-bar loops when they start on a bar that is a multiple of their length.
     The simplest way is to quantize loop starts to `pad.bars`.

## Regenerating
`python3 _build/synth.py [guitar|organ|bass|perc]` (numpy, scipy, ffmpeg) re-renders the WAV/OGG/MP3 files and writes `_build/banks_*.json`.
Then run `python3 _build/make_manifest.py` to rebuild `manifest.json`.

## Synthesis notes
- Guitar: Karplus-Strong plucked string at 4× oversampling (accurate tuning), pick-position comb, palm-mute damping and
  full-mute "chicken scratch", strum spread of about 5-8 ms with up/down strokes, 16th swing at 56%, ghost strokes, body resonance, light amp drive, room.
- Organ: additive 9-drawbar tonewheel model (16' 5⅓' 8' 4' 2⅔' 2' 1⅗' 1⅓' 1'), 3rd-harmonic percussion, key click,
  tube-style overdrive, and a two-rotor Leslie (horn/drum AM + Doppler, stereo). Swells use full drawbars, with the Leslie ramping slow → fast.
- Bass: sine plus an envelope-filtered saw, ghost notes, chromatic approaches, and slide-ins.
- Percussion: band-passed noise shaker, inharmonic-jingle tambourine, multi-burst claps layered with random hand timing, tone and pan.
