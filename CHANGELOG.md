# Sanctum Changelog

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
