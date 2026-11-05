# Sanctum Changelog

## v0.3.1 — 2026-11-05 (America/Los_Angeles)

### Modern banks (new)
Five new 16-pad banks, **synthesized by Tiberious Productions / Sanctum**. That's 80 original sounds with no samples, no recorded voices, and no downloaded or ripped audio. They're rendered at 48 kHz with `content/church-banks/_build/synth_modern.py`.
- **Trap Sanctuary** (Fm, 140): clicky kick, crack snare, stacked clap, rim, hats, 1/32 + triplet hat rolls, four distorted 808s in key, trap drums / 808 line / dark keys + synth-choir loops, 2-bar riser.
- **Drill Pulpit** (Gm, 142): drill kick and snares, ghost snare, rim, tight hat, triplet roll, perc clack, reverse snare, sliding 808s (5th, octave, long, electro), drill drums / 808 slides / dark choir / 3-3-2 hats loops.
- **Amapiano Praise** (Dm, 112): FM log drums on D F G A C, piano kick, shaker, wood block, rim, open hat, conga, soft clap, deep sub, amapiano drums / log-drum line / praise keys loops.
- **Neo-Soul Sunday** (Eb, 84): brush kit, sub, Rhodes Ebmaj9 / Cm11 / Fm9 / Bb13sus, tonewheel organ stab + shout chop, tape-textured drums / Rhodes changes / sub line / Sunday organ loops.
- **Stage FX Modern**: two impacts, sub drop, reverse swell, tape stop, 4 s and 8 s risers, downlifter, four formant-choir pads (ooh/aah), supersaw pad, reese bass, shimmer swell, choir stab.
- Mastering: true peak at or below −1.05 dBTP (WAV and decoded OGG, 4× oversampled). One-shots start with no leading silence. Loops are sample-exact with wrapped tails, and their BPM is in the manifest so they tempo-sync.
- Default slots on first run: G = Trap Sanctuary, H = Drill Pulpit (existing G/H choices are kept). ♫ Sounds shows a **Modern banks** section with NEW badges.
- Research notes: `docs/modern-sound-research.md`. Demo: `release/Sanctum-modern-banks-demo.mp3`.

### Pulpit
- New **Modern 808** band mode: electric piano + airy pad + distorted 808 bass, with a trap-gospel drum groove (half-time clap, 1/32 and triplet hat rolls).

### Tests / packaging
- `npm run smoke` adds 7 checks: the modern banks are present, all 80 decode and none are silent or clipping, loops have BPM and an exact decoded length, G/H default, pad 1 of each bank plays, touch on 808 F plays, and Pulpit Modern plays. `SMOKE_PORT` env override.
- versionName 0.3.1 / versionCode 4. The APK ships OGG only.

## v0.3.0 — 2026-11-05 (America/Los_Angeles)

### Sanctum Pulpit (new)
- New **Pulpit** screen for backing a preacher or singer from a phone or tablet: big Easy Play button (each tap = next chord), 12-key selector, live key change that lands on the next beat, tempo, Shout 1–4 and Worship 1–4, drums/music mute, stop/fade, HIT stab, Full Band or Organ + Drums.
- Original synthesized organ / Rhodes / bass / pad chords and drum grooves (any key). Organ runs and slides.
- Starter library of gospel progressions (preaching holds, 2–5–1s, shout vamps, altar call) plus public-domain hymn cue words. Build and autosave your own sequence.
- Hold a key ~1 second to listen with the mic and highlight the detected key (tap to lock). Works without mic permission (manual key pick).
- **Follow Voice**: on-device listening (no cloud). Syllable onsets drive phrase-end hits and shout/worship level (with hysteresis); pitch picks fitting chords; tempo hint when Link is off. Manual controls always win. Warns about speaker bleed.

### Pads / sequencer / stage
- Velocity feel presets (Soft / Linear / Hard / Punch) on top of the curve slider.
- Per-pad **Decay** (worklet envelope) alongside tune/pan/level.
- **Song mode**: chain patterns (e.g. 1 1 2 3) so the sequencer plays them in order.
- **Stage Mode** lock on Pulpit: blocks accidental navigation mid-service.
- Six colour themes (including high-contrast and neon). Share / Post panel. Latency chip still reports the honest WebView path.

### Link / sounds / packaging
- Pulpit tempo follows Ableton Link when Link is connected.
- Signed Android APK `Sanctum-v0.3.0.apk`. License gate unchanged (Ed25519 tokens).

## v0.2.0 — 2026-11-01 (America/Los_Angeles)

- First signed Android release (Capacitor 8): license gate with invite/admin tokens, neon hardware skin, haptics, native USB/BLE MIDI + clock, Link bridge address, Timing Lab, church shout banks, a11y pass. See PROGRESS.md for the full Nov 1 notes.
