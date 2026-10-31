# Sanctum — playable prototype (PWA)

Sanctum is Lawrence Davis Sr's MPC-style touch drum machine. This is the overnight prototype from Oct 30–31, 2026.
It is a touch-first web app (PWA) that installs on phones and tablets, plus a small Node **Ableton Link bridge**.
The spec is `/workspace/projects/mpc-research/`. Progress log: [PROGRESS.md](PROGRESS.md).

## Why a PWA, and the native path later
- This box has Node 24 and no Flutter or Android SDK. A PWA builds here, runs in any modern mobile browser, and opens from a URL on Lawrence's phone or tablet.
- Audio: Web Audio API with an **AudioWorklet** engine (`public/sanctum-worklet.js`). Every pad hit and sequenced note carries an absolute frame number, so it starts on that exact sample inside the 128-frame render quantum. There's a BufferSource fallback for non-secure (plain `http://` LAN) pages.
- **Native wrapper later (Capacitor):** `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android && npx cap init Sanctum app.sanctum --web-dir dist && npx cap add ios && npx cap add android`, then `npm run build && npx cap sync`. This prototype's web UI and sequencer carry over as they are. The native work is:
  1. a Capacitor plugin for a low-latency engine: Oboe on Android, AVAudioEngine with 64–128-frame IO buffers on iOS. The worklet message protocol (`trig/stop/rate/sample`) is the contract.
  2. CoreMIDI / android.media.midi (iOS Safari has no Web MIDI).
  3. the Ableton Link SDK in-process, so the WebSocket bridge isn't needed.
  4. Keychain/Keystore entitlement tokens for access gating.

## Run it

```bash
cd /workspace/projects/sanctum
npm install                      # app deps (vite, typescript, puppeteer-core for the smoke test)
npm run bridge:setup             # bridge deps + builds bridge/native/sanctum-link-relay (needs g++/make; clones Ableton Link SDK if missing)

# Development (hot reload) — http://localhost:5173
npm run dev
# Development over HTTPS for phones/tablets (AudioWorklet, Web MIDI, mic and service worker need a secure context)
npm run dev:https                # https://<this-computer-LAN-IP>:5173  (self-signed cert: accept the warning once)

# Production build + preview
npm run build                    # tsc --noEmit && vite build  → dist/
npm run preview                  # http://localhost:4173
npm run preview:https            # build + https://<LAN-IP>:4173

# Ableton Link bridge (separate terminal; the dev/preview servers proxy /link → ws://127.0.0.1:20809)
npm run bridge                   # node bridge/server.js  [--port 20809 --quantum 4 --bpm 120 --backend relay|addon]
npm run bridge:peer -- --bpm 97  # optional 2nd Link peer for testing on one machine

# Checks
npm run smoke                    # headless Chrome smoke test + screenshots → screenshots/
npm run zip                      # build + ../sanctum-build.zip
```

### Open it on a phone or tablet (same Wi-Fi)
1. On the computer, run `npm run preview:https` (or `npm run dev:https`) and, in another terminal, `npm run bridge`.
2. Find the computer's LAN IP. Vite prints it as `Network: https://192.168.x.y:4173/`.
3. On the phone or tablet, open `https://192.168.x.y:4173/`. Accept the self-signed certificate warning once, tap **Tap to start**, then play.
4. Install: iOS Safari → Share → **Add to Home Screen**. Android Chrome → ⋮ → **Install app**. It opens full-screen with the Keystone S icon.
5. Link: tap **LINK** (or Menu → Link & MIDI) and turn Link on. The app connects to `wss://<same host>/link`, which the preview server proxies to the bridge, so it works from the phone with no extra setup. Ableton Live, or any other Link app on the same network, then shows the extra peer.

Plain `http://<LAN-IP>` still plays, through the BufferSource fallback engine. AudioWorklet, Web MIDI, the Timing Lab loopback test and offline install all need HTTPS. Nothing is deployed publicly.

## What's in it
| Area | Details |
|---|---|
| Pads | 16 velocity-sensitive pads × 8 banks (A–H) = 128 pads, in MPC order (pad 1 bottom-left). Multi-touch through Pointer Events, `touch-action:none`, no scroll, zoom, double-tap delay or callouts. Velocity modes: **Auto** (stylus or 3D-touch force where reported, otherwise contact size + vertical position), Position, Pressure, Fixed, plus a velocity curve. **FULL LVL** and **16 LVL**. Keyboard: `1-4 / Q-R / A-F / Z-V` (Shift = 127), Space = play/stop, Enter = rec, `[ ]` = bank, `N` = note repeat, ↑/↓ = tempo. |
| Visuals | A flash at velocity brightness fires on raw touch-down, before the audio (pre-light). There's also a pad ring (1.0→1.15 in 180 ms) and a ripple from the touch point. Sequenced notes light **pre-light ms** before they're audible, using `getOutputTimestamp`. Reduce Motion is respected. |
| Sounds | **Sanctum Foundation Kit** and **Sanctum Stage FX & 808**: two starter banks of 32 sounds, all synthesized in-app (no samples). Church shout banks come from `content/church-banks/manifest.json` (Shout Guitar, Organ, Bass, Percussion → banks C–F). **Coming soon** slots: Sanctuary Tonewheel A-100, Choir Loft, Hymn Roots, Prayer Garden Sessions. Credits screen lists every sound with author, license and source. |
| Loops | Manifest `type: loop` pads start on the **next bar** (or the next beat, set in Settings). They loop sample-exactly with `playbackRate = projectBPM / loopBPM`. Pads in the same `chokeGroup` replace each other at the bar line, and tapping again stops a loop at the next bar. The first loop played while stopped sets the project tempo to the loop's key tempo (G 132 · C 120 · D 140 · A 150). OGG is tried first. WAV is used if decoding fails or the decoded length differs from the manifest's sample count. MP3 is never used. |
| Sequencer | 960 PPQ, 8 patterns, 1/2/3/4/8 bars, step grid plus real-time record, quantize (off, 1/8, 1/8T, 1/16, 1/16T, 1/32, 1/32T), swing 50–75 % on 1/16 or 1/8 (non-destructive, MPC-style), metronome, 1-bar count-in, tap tempo. |
| Note repeat | Rates from 1/4 to 1/32T, locked to the tempo grid and following swing. Works with the transport stopped, and records while REC is on. Holding pressure updates the velocity where the device reports it. |
| Timing Lab | Live baseLatency, outputLatency, render quantum and estimated touch-to-sound / MIDI-to-sound. A **buffer slider** sets `latencyHint` and recreates the AudioContext. **Loopback round-trip test** (impulse → mic/line in the same audio clock; median and jitter). **Tap test** measures touch input latency and sets the recording correction automatically. Manual touch-comp and pre-light sliders. A hard-limit table from latency-spec.md shows OK / OVER TARGET / OVER CEILING, with a **NOT STAGE-CERTIFIED** badge, a warning toast, and a Bluetooth-route warning when outputLatency > 80 ms. |
| Timing correction | Recorded hits are stored at the audible time the performer heard: the touch `timeStamp` goes through `getOutputTimestamp` to context time, minus touch compensation. They're then un-swung and quantized. Sequenced playback is sample-offset scheduled (0-sample error). MIDI-in hits skip touch compensation. |
| Link | `bridge/server.js` with WebSocket relay of tempo, beat, phase, peers and start/stop. The app phase-locks its clock to the session (snaps on tempo change or a big jump, otherwise slews). Play starts on the next quantum (2/4/8), local tempo changes are proposed to the session, start/stop sync works both ways, and the UI shows the peer count. |
| MIDI | Web MIDI clock **out** (24 PPQN + Start/Stop, timestamped ahead from the audio clock, with a ±ms offset) and clock **in** (tempo follow, Start/Continue/Stop). Omni note input (36–51 → pads 1–16) and port pickers. Where Web MIDI is missing (iOS/iPadOS Safari) or the page isn't secure, the app shows a fallback message. No MIDI 2.0. |
| Themes | **Dark**, **Light**, and **Warm**: an MPC60-style beige chassis, grey rubber pads, orange accents, keycap buttons and a green-yellow LCD. The theme is saved with the project. |
| Brand | **Arch Pad** mark in the header, splash and lock screens. **Keystone S** is the PWA icon set (192, 512, maskable 512, apple-touch, favicon, SVG), rendered from `branding/02-keystone-s.svg` by `npm run icons`. |
| Layouts | Phone portrait: status strip, bank row, step lane + mini drum grid, 4×4 pads in the thumb zone, action bar, left-hand mirroring. Phone landscape "Studio": pads left, editor right. Tablet landscape "Studio": browser | grid editor | inspector over pads + side actions | macro strip. Tablet portrait "Pad wall": grid above, pads in the lower ~55 %. The layout can be overridden in Settings. |
| Autosave | Every change is saved to localStorage (debounced), and also on page hide or when the app goes to the background. This covers patterns, bank assignments, per-pad level/pan/tune/mute, tempo, swing, quantize, theme, settings and Timing Lab results. Rolling snapshots keep the last 5, taken at most every 2 minutes, with restore. Projects export as JSON. |
| Access gating (mock) | UI only, following access-control.md: Locked → "I have an invite" (link entry; a link containing `expired` shows the expired state) → invite redemption (scope, expiry, seats, sign-in mock, "Device registered ✓"). Also Subscribe paywall, Expired, Revoked and the Grace banner. Open it from Menu → **Access preview (dev)** or with `?access=locked\|invite\|paywall\|expired\|revoked\|grace`. Nothing is sent. |

URL helpers: `?theme=dark|light|warm`, `?layout=phone|tablet|auto`, `?access=…`.

## Link bridge notes
- `bridge/native/link-relay.cpp` is a small native Link peer built against the **current Ableton Link SDK** (cloned to `bridge/native/link`, which is git-ignored). It prints session state as JSON lines and reads commands on stdin, and `bridge/server.js` spawns it.
- The `abletonlink` npm addon (0.2.0-beta.0) also builds, and the bridge falls back to it with `--backend addon`. Its bundled 2019 Link had **one-way discovery** on this Linux box: peer B saw A, A never saw B, and tempo didn't converge. That's why the relay is the default.
- Verified on this box: two separate Link processes see each other (peers = 1), a tempo change goes both ways (97 from the test peer → app, 111 from the app → test peer), and the app's phase error is about 1–3 ms over a localhost WebSocket.
- Linux hosts: if peers don't appear, check that multicast is allowed on the LAN interface. On this box `sudo ip link set lo multicast on` was set while testing.
- License: the Link SDK is GPLv2+ or under a proprietary license from Ableton. Shipping Link inside a closed-source native app needs Ableton's license.

## Layout of the repo
```
index.html, src/            app (TypeScript): main.ts, app.ts, audio/{engine,synth,kits}.ts, seq/transport.ts, sync/{link,midi}.ts, ui/*.ts, styles.css
public/                     sanctum-worklet.js (audio engine), manifest.webmanifest, sw.js, icons/
content/church-banks/       external shout banks (produced separately; served at /content, copied into dist/)
bridge/                     server.js, link-backend.js, test-peer.js, native/{link-relay.cpp,build.sh}
scripts/                    smoke.mjs (headless test + screenshots), icons.mjs, zip.py
screenshots/                phone/tablet × Dark/Light/Warm + Timing Lab, Sounds, Link, lock screens; smoke-results.json
```

## Known limits (prototype)
- Browsers ignore some `latencyHint` values, so the readout shows what you actually got. `outputLatency` is 0 on some browsers (Safari reports little).
- Web pages can't detect the audio route (Bluetooth vs wired), so the Bluetooth warning is a heuristic.
- iOS Safari exposes no touch force on current iPhones, so Auto velocity uses position + contact size.
- Loops are tempo-synced by resampling, which changes pitch away from the loop's native BPM. Time-stretching is v1.
- No sampler, recording or chopping, mixer/FX, song mode, MIDI learn or controller profiles yet (MVP roadmap). MIDI 2.0, stems, plugin hosting and DAW import are out of scope.
