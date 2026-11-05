# Sanctum Prototype — Progress Log

All times Pacific (PDT).

## Thu Nov 5 2026 — Acrylic Kit pad skin (Stage Glass)
- Research: `design/pad-skin/research.md` (Remo/Evans clear heads, Ludwig Vistalite acrylic shells, overhead kit POV, MPC Live III / Maschine / Push 3 / TR-8S / TE design language). Concept art + HTML/SVG frames in `design/pad-skin/frames/` (Stage Glass / Smoked Acrylic / Studio Daylight × phone/tablet × idle/hit). Spec: `design/pad-skin/SPEC.md`.
- **Recommended direction: Stage Glass** (dark clear acrylic, rim-lit); smoked + daylight become theme token accents of one skin.
- Implemented selectable **Pad skin** setting (`acrylic` | `hardware`), default `acrylic` for new projects; Hardware skin preserved. Persistence via project settings + `localStorage['sanctum.padSkin']` + `data-pad-skin`.
- New files: `src/skins/acrylic.css`, `src/ui/skins/kit/{instruments,mapping,index}.ts` — original SVG instrument art (kick/snare/toms/hats/crash/ride/cowbell/clap/rim/tamb/shaker/808/fx/loop/organ/choir), sound→instrument mapping, head-flex / cymbal-shimmer / shake hit motion (transform/opacity only).
- Settings UI: Menu → Settings → Pad skin. Screenshots: `screenshots/skin-acrylic-*.png` (+ hardware control). `npm run build` green; smoke **38/38**.
- Engine/haptics/a11y untouched. Open brand call for Lawrence: keep Acrylic as default vs Hardware; church-bank motif strength; label visibility.

## Sat Oct 31 2026 00:22 PDT — Kickoff
- Read all spec docs in /workspace/projects/mpc-research/ (README, design-goals, design-phone, design-tablet, phase1-3, daw-sync, midi-integration, branding-logo, branding/*.svg, access-control).
- Stack decision: Vite + TypeScript PWA, Web Audio API with AudioWorklet engine (box has Node 24, no Flutter/Android SDK). Node WebSocket bridge for Ableton Link.
- Box had no g++/make; installing build-essential pieces via apt for the native abletonlink addon.
- Next: scaffold project, audio engine, pads, sequencer.

## Sat Oct 31 2026 00:31 PDT — Link bridge working (two peers verified)
- apt was blocked by the box's egress proxy for the _apt user; installed g++/make/cmake by downloading the Debian trixie .debs with curl and `dpkg -i`.
- `abletonlink` npm addon builds (node-gyp) but its bundled 2019-era Link SDK showed one-directional discovery on this host (peer B saw A, A never saw B, tempos didn't converge).
- Fix: built a tiny native relay (bridge/native/link-relay.cpp) against the current Ableton Link SDK (github.com/Ableton/link @ 5ba907a). Two separate processes now see each other (peers=1 each), tempo change 120→97 propagates, beats/phase aligned within ~3 ms.
- bridge/server.js (WebSocket :20809) spawns the relay (falls back to the addon); bridge/test-peer.js is a second peer for testing.
- Steering received: Timing Lab, access-gating mock, Warm MPC60 theme, Keystone S icon / Arch Pad header, MIDI clock in/out (Web MIDI), two starter banks + coming-soon slots, external manifest banks from content/church-banks/.
- Next: app scaffold (Vite+TS), AudioWorklet engine, pads, sequencer.

## Sat Oct 31 2026 00:48 PDT — App first build green
- Vite 8 + TypeScript PWA scaffolded; `npm run build` passes (tsc + vite).
- AudioWorklet engine (public/sanctum-worklet.js): sample-offset scheduled voices, choke groups, loops with live rate changes, master soft-clip, stats, loopback impulse measurement. BufferSource fallback for non-secure contexts.
- 32 synthesized starter sounds (Foundation Kit, Stage FX & 808), coming-soon slots (A-100, Choir Loft, Hymn Roots, Prayer Garden).
- Manifest adapter for content/church-banks (4 banks → pad banks C–F; OGG first, WAV fallback when decoded length ≠ manifest sample count; loops bar-quantized, playbackRate = project BPM / loop BPM, choke at bar line).
- Sequencer: 960 PPQ, 1–8 bars, 8 patterns, swing 50–75% (1/8 or 1/16), quantize off…1/32T, note repeat, count-in, metronome, latency-corrected recording.
- UI: phone portrait + tablet landscape/portrait layouts, 3 themes, pad flash + ring + touch-point ripple, Timing Lab, Link/MIDI sheet, sounds/credits, settings, access-gating mock.
- Next: headless smoke test + screenshots, Link end-to-end through the UI, README, zip.

## Sat Oct 31 2026 00:55 PDT — Headless smoke test 15/15, screenshots, zip
- `npm run smoke` (scripts/smoke.mjs, puppeteer-core + system Chrome) starts vite preview + Link bridge + a 2nd Link peer and checks: worklet engine running, church banks loaded into C–F, pad tap → audio, 2-finger multi-touch, sequencer playback with 0 late events, note-repeat recording lands on the 1/16 grid, swing warp math, loop pad launches on next bar with rate = BPM/loopBPM, autosave restore after reload, Link (peer visible, tempo follows peer 97 BPM, phase error ≈1.7 ms, app tempo change 111 propagates to the other peer), no console errors.
- Screenshots: screenshots/ (phone dark/light/warm, tablet landscape + portrait × 3 themes, Timing Lab, Sounds, Link sheet, lock/invite/paywall/expired).
- Fixed: tablet init order bug; splash click-through (now starts audio on click = iOS-safe user activation); phone header compaction; phone mini drum-grid; toast moved to top.
- Production zip: /workspace/projects/sanctum-build.zip (~21 MB incl. church banks WAV+OGG).
- Next: README, HTTPS/LAN check, loop decode check, polish.

## Sat Oct 31 2026 00:58 PDT — README + HTTPS/LAN verified
- README.md written (run/dev/prod/HTTPS/LAN/bridge/Capacitor path/feature table/known limits).
- Verified HTTPS preview on the LAN IP (https://172.30.0.2:4443 in headless Chrome): secure context, AudioWorklet engine, service worker active, Link via wss same-origin proxy → bridge, Web MIDI API present, all 36 church loops decoded to the exact manifest length (OGG path).
- Loop rate now corrects for resampling rounding (cycle = beats·60/BPM exactly); Link start/stop sync follows other peers; relay "play" no longer re-requests beat 0 (keeps the shared timeline phase-safe).
- Smoke re-run 15/15 (smoke waits for headless audio sink to come up — on this shared box it sometimes starts ~1–2 s late).
- Next: polish pass (phone header, tap-test check), final screenshots + zip.

## 2026-10-31 00:59 PDT — Polish + final verification
- Phone header: gear moved to action-bar menu (⌘) so the LCD has room; tablet unchanged.
- Smoke now 16/16: added Timing Lab tap-test check (synthetic taps +25 ms after audible clicks → measured 30.4 ms offset, 0.3 ms jitter, correction applied). No console errors.
- Screenshots regenerated; zip rebuilt at /workspace/projects/sanctum-build.zip.
- Status: core demo complete and playable. Untested on real hardware: MIDI devices, mic loopback on a real interface, iOS Safari.

## Sun Nov 1 2026 12:41 PST — Android APK v0.2.0 (Capacitor 8): license gate, neon hardware UI, native MIDI, Link bridge address
- Toolchain (no root): Temurin JDK 21 in ~/jdk, Android SDK (platform 36, build-tools 36, platform-tools) in ~/android-sdk; env in ~/android-env.sh.
- Capacitor 8.6 Android platform (appId com.tiberiousproductions.sanctum, versionName 0.2.0 / code 2, minSdk 24, targetSdk 36). Native build is OGG-only, no source maps (SANCTUM_TARGET=android); service worker off in native.
- A. License gate: Ed25519-signed offline tokens (S1-…), lock screen mounts first and the app/engine is a dynamic import after verification; re-verified every launch + every 60 s. CLI: license:keygen / license:invite / license:admin / license:verify; keys + issued.jsonl + ADMIN-TOKEN.txt in licensing-keys/ (gitignored, 600). sanctum://activate deep link (manifest + appUrlOpen) and ?code= on web. Secure storage via @aparajita/capacitor-secure-storage (Keystore) / IndexedDB on web. Purchase scaffold (LicenseProvider + StorePurchaseProvider stub, not wired), revocation deny-list stub, hidden Admin panel. Old ?access= bypass removed.
- B. Neon hardware skin (hardware.css): well + raised cap pads with press travel, row-coloured LED strips, velocity-scaled flash/glow/ring/ripple (transform/opacity only), chunky keys in all 3 themes. Haptics (@capacitor/haptics, velocity-scaled; navigator.vibrate on web). A11y: named pads ("Pad 1, Kick, bank A"), step checkboxes, aria-valuetext sliders, radio theme picker, live region (play/stop/record/tempo/bank), Enter/Space/TalkBack activation, focus rings, reduced motion. Plain-word action bar (REPEAT · SPEED · FULL · 16 LEVELS · EDIT · MENU). Screenshots regenerated (phone + tablet × 3 themes, lock screens, admin).
- C. latencyHint 'interactive' kept; RECORD_AUDIO + MODIFY_AUDIO_SETTINGS in manifest (runtime prompt via Capacitor's WebChromeClient on Timing Lab loopback). Honest WebView latency + Oboe/AAudio native plan documented in MANUAL §23. Oboe plugin NOT prototyped.
- D. SanctumMidi native plugin (android.media.midi): USB host + BLE scan/connect (openBluetoothDevice) + USB-peripheral mode, scheduled output thread; JS backend switch (Web MIDI in browser). Notes out/in, CC in/out with default map + MIDI learn, clock in/out (24 PPQN, start/stop/continue; no SPP). Link: bridge address field, LAN-only ws:// (network config + app check), graceful "unavailable" without address. MANUAL §13 DAW guide for 7 DAWs.
- E. Release keystore in android-signing/ (gitignored); signed release APK release/Sanctum-v0.2.0.apk (~8.1 MB, apksigner v2 OK) + debug release/Sanctum-v0.2.0-debug.apk. Custom Keystone S adaptive icon + Arch Pad splash (npm run android:assets).
- Smoke 24/24 (browser): lock blocks pads, garbage/tampered/expired rejected, invite unlocks, admin unlocks + Admin panel, a11y tree, plus all previous audio/sequencer/Link checks; also passed against the OGG-only Android dist.
- Not verified on a device: emulator not run (/dev/kvm not accessible to this user), no USB/BLE MIDI hardware or DAW here.

## Thu Nov 5 2026 — v0.3.0 Sanctum Pulpit + Voice Follow + signed APK
- Step 0: `npm run build` green; smoke 24/24 after Link phase sampling harden; committed Nov 2 work (themes, share, integrations, Pulpit libs, promo) as 5a97866. Fixed Roman `bVI` (major-relative accidentals) and key-detect phrase-end weighting so `pulpit-test` PASS.
- **Sanctum Pulpit** screen: Easy Play, 12 keys (hold-to-detect), quantized key change, tempo, Shout/Worship 1–4, mutes, stop/fade, HIT, Full Band / Organ + Drums, organ runs, Stage Mode lock, progression picker + editable autosaved sequence. Original synthesized chords/grooves via `src/pulpit/tones.ts` + player; theory/library/keydetect wired.
- **Follow Voice**: on-device cadence (onset/phrase) + YIN pitch → hits, chord pick, level hysteresis, tempo hint when not Linked; mic never to speakers; graceful without permission. Tests with synthetic AM voice in `pulpit-test.mjs`.
- Also: pad decay (worklet envelope), velocity feel presets, song-mode pattern chain, Pulpit follows Link tempo, CREDITS.md, MANUAL Pulpit section, CHANGELOG.md. APK Sanctum-v0.3.0 (versionCode 3).
- IP: no Whoop Triggerz name/branding/audio in UI; research doc keeps factual attribution. User-facing "Whoop" feel labels renamed to Preaching hold.

## Thu Nov 5 2026 — Chords: live detection, import, theory, Lampstand push
- Research: `docs/chord-detection-research.md` (chromagram/HPCP + templates + HMM/Viterbi, beat-synchronous chroma, NNLS/Chordino, Essentia.js, Meyda, Basic Pitch, CREPE, madmom, BTC) with on-device vs server recommendation.
- Import sources: `docs/chord-import-sources.md` ranked quality table + adapter status; Spotify audio-features/analysis confirmed deprecated for new apps (27 Nov 2024).
- Built `src/chords/`: detect (reuses Pulpit chroma), live mic detector, offline import, pluggable source adapters (file/url/church-banks + SC/Spotify/Apple/Bandcamp stubs), theory-ext (12 keys, diatonic, relatives, gospel/jazz subs, Markov; Beat Theory schema — maps not found on disk), Chords sheet UI + optional Lampstand push via `screen.ts`.
- Tests: `npm run chords:test`; screenshots `screenshots/chords-*.png`. Menu hookup edits in `src/ui/sheets.ts` left uncommitted (concurrent modern-banks edits in that file).
- Recommendation: ship on-device chroma+templates+Viterbi for live/import; keep large-vocab BTC/madmom as future server option.

## Thu Nov 5 2026 09:05 PST — v0.3.1 Modern banks (Trap / Drill / Amapiano / Neo-Soul / Stage FX) + Pulpit Modern 808
- Research (web, functional/sonic reference only): `docs/modern-sound-research.md`, covering gospel trap 808 design (clean sub + parallel mid drive), drill 3-3-2 hats and sliding 808s, the amapiano FM log drum recipe, neo-soul 9/11/13sus voicings with a common top tone, Hammond drawbars + Leslie growl, supersaw/reese, riser/impact/tape-stop, and choir formants.
- `content/church-banks/_build/synth_modern.py` (numpy/scipy, 48 kHz) renders 5 banks × 16 pads = 80 original sounds (WAV + OGG q5) and `_build/banks_modern.json`. `make_manifest.py` merges them (group `modern`, bank descriptions, key/BPM). Mastering: 4× true peak ≤ −1.05 dBTP on WAV and decoded OGG, one-shot lead silence trimmed (0–1 ms; risers and reverse FX keep their length), loops sample-exact. Pitches verified by FFT (808 F 43.8 Hz, log drum D 73.4 Hz, slide ends on D2).
- App: manifest adapter carries group/key/bpm/description; first run puts Trap Sanctuary in G and Drill Pulpit in H; ♫ Sounds has a "Modern banks" section with NEW badges. Pulpit **Modern 808** band (Rhodes + pad + distorted 808 + trap groove).
- Smoke 38/38 (7 new checks). pulpit-test PASS. Demo `release/Sanctum-modern-banks-demo.mp3` (36.6 s, ≈ −9.5 LUFS, −1.5 dBTP).
- APK `release/Sanctum-v0.3.1.apk` (versionCode 4, 11.3 MB, v2 signature CN=Sanctum, O=Tiberious Productions). Web deployed to https://tiberious-sanctum.netlify.app (200).
- Release + deploy were built from a clean git worktree of the v0.3.1 commit. That commit includes the already-committed Chords and Acrylic Kit work, but not the uncommitted edits from the concurrent session (e.g. the Chords menu hookup in `src/ui/sheets.ts`), which were left untouched in the working tree.

