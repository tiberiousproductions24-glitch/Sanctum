# Sanctum app captures (real UI)

| File | What | Source |
|---|---|---|
| live-lock-phone-1080x1920.png | Lock screen (Arch Pad, SANCTUM wordmark, "A private instrument.") at 1080×1920 | **Captured live today** (Nov 2, 2026, ~6:22 PM PT) from `dist/` via `vite preview` + headless Chromium (Playwright) |
| live-lock-tablet-landscape.png | Same, tablet landscape 2048×1536 | Captured live today, same method |
| smoke-phone-dark.png, smoke-phone-dark-playing-loop.png, smoke-phone-dark-sounds.png, smoke-phone-dark-timing-lab.png, smoke-phone-warm-link-sync.png, smoke-tablet-landscape-dark.png, smoke-tablet-portrait-dark.png, smoke-tablet-landscape-warm-timing-lab.png | Unlocked app: pads + banks, loop playing, sound browser, Timing Lab readout, Ableton Link "In sync with 1 Link peer", tablet Studio layout with step grid | Copied from `/workspace/projects/sanctum/screenshots/` (real headless-Chrome renders from the Sanctum Build bot's `npm run smoke`, Sun Nov 1 2026 8:03 PM PT) |

## Can we capture real app footage? Yes, with one gate
- The build runs: `cd /workspace/projects/sanctum && npx vite preview --port 4173` (or `npm run preview`), then any headless Chromium/Playwright script can screenshot or screencast it (Playwright + Chromium are installed on the box; Chrome at `/usr/bin/google-chrome`).
- **The app is license-gated** (Ed25519-signed access code). Without a code, only the lock screen mounts — that's all I captured live. I did **not** mint an access code: that uses the private signing key in `licensing-keys/`, which needs Lawrence's OK.
- To capture pads/sequencer/Link/Timing Lab in motion, either (a) Lawrence approves using an invite code (e.g. `npm run license:invite -- --name "Promo capture" --days 7`), then a Playwright screencast script plays a pattern and records at 1080×1920 / 2560×1600, or (b) screen-record the real APK on Lawrence's phone/tablet (best for the latency shot — see below).
- **Latency caution:** headless/desktop readouts show touch→sound ≈ 53 ms and "NOT STAGE-CERTIFIED". The Timing Lab / latency shot must be recorded on a real device that passes the limits, or the number is left off screen.
