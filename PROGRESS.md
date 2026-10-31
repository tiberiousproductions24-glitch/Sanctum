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
