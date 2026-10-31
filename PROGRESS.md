# Sanctum Prototype — Progress Log

All times Pacific (PDT).

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
