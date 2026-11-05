# Sanctum User Manual

**Version 0.1.0 (prototype)** · Sanctum is a drum machine for phones, tablets and computers, built in the style of an MPC (a classic pad-based drum machine). You tap pads to play drums and church "shout" loops, record patterns, and keep time with a band.

This manual covers only what the app does today. Anything untested or unfinished is listed under [Known limitations](#20-known-limitations).

---

## Quick start (5 minutes)

1. **Open Sanctum** in your browser (see [Getting started](#1-getting-started-and-installation)).
2. Tap the big **Tap to start** button. Browsers stay silent until you tap something, so this button turns the sound on.
3. **Tap the pads.** Bank **A** loads the *Sanctum Foundation Kit* (kick, snare, hats and so on). On most phones, tapping nearer the **top** of a pad plays louder.
4. **Change banks** with the letter buttons **A–H** above the pads. Banks **C–F** hold the church shout banks (Guitar, Organ, Bass, Percussion).
5. **Start a loop:** go to bank **C**, tap pad **1** (*G Chicken Scratch*). It starts on the next bar. Tap it again and it stops at the next bar.
6. **Record a beat:** tap **REC** (the red dot). The sequencer starts, and the pads you play are recorded. Tap **▶/■** to stop.
7. **Check your timing:** the **⚡** chip at the top shows about how long it takes from your touch to the sound. Tap it to open the **Timing Lab**.

Everything saves automatically on your device.

---

## Words you'll see (plain definitions)

| Word | Meaning |
|---|---|
| **BPM** | Beats per minute: how fast the song goes. |
| **Velocity** | How hard a note is hit. Higher velocity means louder. Sanctum uses a scale of 1–127. |
| **Bank** | A set of 16 sounds on the 16 pads. Sanctum has 8 banks, lettered A–H. |
| **Pattern** | A short recorded drum part (1–8 bars long) that repeats. |
| **Bar** | One measure of music. In Sanctum, a bar is 4 beats (4/4 time). |
| **Quantize** | Automatically moves the notes you record onto the nearest grid line so they sound tight. |
| **Swing** | Delays every other small note slightly, so the groove shuffles instead of sounding stiff. |
| **Choke group** | Pads that cut each other off, like a closed hi-hat silencing an open one. |
| **Latency** | The small delay between your touch and the sound you hear. |
| **Buffer** | The chunk of audio the device prepares ahead of time. A smaller buffer means less latency but more risk of crackles. |
| **Ableton Link** | A Wi-Fi system that keeps the tempo and beat of music apps and computers in step. |
| **MIDI / MIDI clock** | MIDI is the standard way music gear talks. "MIDI clock" is a timing signal that lets one device set the tempo for another. |
| **Note repeat** | Hold a pad and it keeps re-triggering in time (for example, rolling 16th-note hi-hats). |

---

## 1. Getting started and installation

Sanctum is a **PWA** (Progressive Web App): a website that you can install so it opens like a regular app, full-screen with its own icon.

### 1a. Open the hosted version and install it
> There is **no public web address yet**. Sanctum hasn't been deployed to the web (Netlify) so far. When it is, these steps apply:

1. Open the Sanctum web address in your browser.
2. Tap **Tap to start**.
3. Install it:
   - **iPhone / iPad (Safari):** tap **Share → Add to Home Screen**.
   - **Android (Chrome):** tap **⋮ → Install app** (or **Add to Home screen**).
4. Open Sanctum from its home-screen icon (the "Keystone S"). It opens full-screen.

### 1b. Run it on your own computer
You need **Node.js** installed. In a terminal:

```bash
cd sanctum
npm install            # one-time setup
npm run dev            # opens at http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm run dev` | Development server at `http://localhost:5173` |
| `npm run dev:https` | Same, but over HTTPS so phones and tablets on your Wi-Fi can use it fully |
| `npm run build` | Builds the finished app into `dist/` |
| `npm run preview` | Serves the built app at `http://localhost:4173` |
| `npm run preview:https` | Builds, then serves over HTTPS on your network at port 4173 |
| `npm run bridge:setup` | One-time setup for the Ableton Link bridge (needs build tools: g++/make) |
| `npm run bridge` | Starts the Link bridge (see [section 12](#12-ableton-link-sync)) |
| `npm run bridge:peer -- --bpm 97` | Starts a pretend second Link device, for testing on one computer |
| `npm run smoke` | Automated self-test, which also takes screenshots |
| `npm run zip` | Builds and packages a zip file |

### 1c. Use it on a phone or tablet over your local Wi-Fi (HTTPS)
Phones need a **secure (HTTPS)** connection before they allow the best audio engine, MIDI, the microphone test and offline install.

1. On the computer, run `npm run preview:https` (or `npm run dev:https`).
2. The terminal shows a **Network** address such as `https://192.168.x.y:4173/`.
3. Open that address on the phone or tablet (it must be on the same Wi-Fi).
4. You'll see a security warning because the certificate is "self-signed" (made on your computer, not by an outside authority). Accept it **once**.
5. Tap **Tap to start**, then install it with Add to Home Screen as in 1a.

> A plain `http://` address on your network still plays sound, using a simpler backup audio engine. However, MIDI, the loopback test and offline install won't work there.

### 1d. Handy web-address options
You can add these to the end of the address:
- `?theme=dark`, `?theme=light` or `?theme=warm` (pick a theme)
- `?layout=phone`, `?layout=tablet` or `?layout=auto` (force a screen layout)
- `?code=…` (unlock with an access code; see [section 17](#17-access--licensing)). `?theme=` and `?layout=` only work in the developer build.

---

## 2. The screen at a glance

**Top strip (left to right):**
- **Arch Pad logo**
- **REC** (red dot): record
- **▶**: play/stop. On phones it changes to **■** while playing.
- **■**: stop (shown on larger layouts)
- **LCD display**: shows tempo (**BPM**), position (bar.beat.16th, or **COUNT** during a count-in), and on larger screens **SW** (swing), **Q** (quantize) and **4/4**. Tap the display to open **Tempo & Sequencer**.
- **⚡ chip**: estimated touch-to-sound latency in ms. Tap it to open the **Timing Lab**.
- **LINK chip**: Ableton Link status and peer count. Tap it to open **Link & MIDI**.
- **MIDI chip** (tablet/desktop only): opens **Link & MIDI**.
- **⚙** (tablet/desktop only): opens the menu.

**Bank row:** **PAT n** (the current pattern; tap to open Tempo & Sequencer), bank buttons **A–H** (a dot means the bank has sounds in it), an info line ("Bank A · Sanctum Foundation Kit · Pad 1: Kick Deep"), and **♫ Sounds**.

**Step editor:** the grid for entering beats (see [section 8](#8-the-sequencer)).

**Pads:** a 4×4 grid in MPC order, so **pad 1 is bottom-left** and pad 16 is top-right.

**Action bar:** **REPEAT**, **SPEED**, **FULL volume**, **16 levels**, **EDIT pad**, and **☰ MENU**.

**The menu (⌘ or ⚙)** has: Tempo & Sequencer · Note Repeat · Pad Editor · Sounds · Timing Lab · Link & MIDI · Settings & Theme · Credits · Help (plus **Admin** for the owner code).

Panels slide up from the bottom. Close one with **Done**, by tapping outside it, or by pressing **Esc** on a keyboard.

---

## 3. The pads and banks

### 3a. Playing
- There are **16 pads × 8 banks (A–H) = 128 pads**.
- You can play several pads at once with several fingers.
- The page won't scroll or zoom while you play.
- When you tap a pad, it becomes the **selected pad**, which is the one the Pad Editor and step lane work on.

### 3b. How velocity works on a touch screen
Choose a mode in **Menu → Settings & Theme → Velocity**:

| Mode | How loudness is decided |
|---|---|
| **Auto** (default) | Uses stylus or 3D-Touch pressure if the device reports it. Otherwise it combines **how big your fingertip contact is** with **where you hit** (top of the pad = loudest). |
| **Position** | Only where you hit: top = loud, bottom = soft. |
| **Pressure** | Pressure if the device reports it. If not, it falls back to position. |
| **Fixed** | Every touch plays at the **Fixed vel** slider value (1–127, default 110). |

- Touch velocities range from about **18 to 127**.
- **Curve** (0.6–3.0, default 1.6) shapes how velocity turns into loudness. Higher values make soft hits quieter.
- With a mouse, loudness depends on where you click. On a keyboard, keys play at 100, and holding **Shift** plays at **127**.
- Most current iPhones don't report pressure, so Auto uses position and contact size there.

### 3c. FULL and 16 LEVELS
(The action-bar buttons read **REPEAT · SPEED · FULL volume · 16 levels · EDIT pad · MENU**.)
- **FULL** (full volume): every hit plays at full velocity (127). Steps you enter by hand are also placed at 127.
- **16 LEVELS**: spreads the **selected pad's sound** across all 16 pads, each at a different velocity, from pad 1 (softest, about 8) to pad 16 (127). Each pad shows its level number. Use this to play soft ghost notes and loud accents of one sound.
- Only one of the two can be on at a time. Tap the button again to turn it off.

### 3d. Desktop keyboard map

| Keys | Pads |
|---|---|
| `1 2 3 4` | 13 14 15 16 (top row) |
| `Q W E R` | 9 10 11 12 |
| `A S D F` | 5 6 7 8 |
| `Z X C V` | 1 2 3 4 (bottom row) |

Keys follow the grid's shape on screen. Other keys are in the [quick-reference table](#19-quick-reference).

### 3e. Choke groups
Pads in the same choke group cut each other off:
- **Foundation Kit:** Closed Hat, Pedal Hat and Open Hat (marked **CHK** on the pad). A closed hat silences a ringing open hat.
- **Stage FX & 808:** the six 808 bass notes cut each other off.
- **Church banks:** the loops use choke groups too (see 4b).

Choking only happens within the same bank.

### 3f. Editing a pad
Tap a pad to select it, then tap **PAD edit** (or open **Menu → Pad Editor**):
- **Sound**: choose any sound from any bank, or **— empty —**.
- **Level**: 0–150%
- **Pan**: left to right (C = center)
- **Tune**: −12 to +12 semitones. This also works on loops.
- **Mute**: the pad dims and stays silent.
- **Preview**: play the pad.
- A credit line shows who made the sound and its license.

> **Heads-up:** loading a soundbank into a bank resets that bank's pads to their default level, pan and tune, and unmutes them.

---

## 4. Sounds and soundbanks

Open **♫ Sounds** (or **Menu → Sounds**). Tap a soundbank to load it into the **current** bank letter. The panel also lists which bank is loaded in each letter.

**Default setup:** A = Foundation Kit, B = Stage FX & 808, C–F = church shout banks, G and H = empty (load anything you like).

### 4a. Starter banks (built in)
- **Sanctum Foundation Kit:** Kick Deep, Kick Tight, Snare, Snare Fat, Clap, Rimshot, Closed Hat, Pedal Hat, Open Hat, Tom Low/Mid/High, Crash, Ride, Tambourine, Shaker.
- **Sanctum Stage FX & 808:** 808 C, D#, F, G, A#, C (hi), Finger Snap, Cowbell, Riser 2s, Riser 4s, Sub Drop, Impact, Reverse Cymbal, Noise Sweep Down, Swell C6/9, Laser Zap.

### 4b. Church shout banks (C–F)

| Bank | Pads |
|---|---|
| **Shout Guitar** | 1–4 Chicken Scratch G/C/D/A · 5–8 Passing Chords G/C/D/A · 9–12 Shout Lick G/C/D/A · 13 G9 stab · 14 C13 stab · 15 D7#9 stab · 16 muted scratch |
| **Shout Organ** | 1–8 I7 / IV9 stabs in G, C, D, A · 9–12 Shout Organ loops G/C/D/A · 13–16 6/9 swells G/C/D/A |
| **Shout Bass** | 1–4 Octave Pump G/C/D/A · 5–8 Passing Walk G/C/D/A · 9–12 Turnaround Run G/C/D/A · 13–16 bass hits G/C/D/A |
| **Shout Percussion** | 1–8 one-shots (shaker, tambourine, claps, congregation clap, snap) · 9–16 Tamb+Shaker and Shout Claps loops at 120/132/140/150 |

**Each key has its own tempo**, so every loop in a key lines up:

| Key | Tempo |
|---|---|
| **G** | 132 BPM |
| **C** | 120 BPM |
| **D** | 140 BPM |
| **A** | 150 BPM |

All loops are in 4/4 and are 1, 2 or 4 bars long. Some pairs are made to go together:
- Guitar **Passing Chords** goes with Bass **Passing Walk** (both 4 bars).
- Guitar **Chicken Scratch**, Organ **Shout** and Bass **Octave Pump** (2 bars) share the same chords.

**How loops behave:**
- Loop pads are marked **LOOP 2B** (or 1B or 4B). Other pads play a single hit right away.
- **Loops start on the next bar.** You can change this to the next beat in **Tempo & Sequencer → Loop launch → Next bar / Next beat**.
- A loop that is waiting to start shows as "queued", and it lights while playing.
- **Tap again to stop.** The loop stops at the next bar (or beat).
- **Choke groups:** starting another loop in the same group (for example, guitar) replaces the first one at the bar line. So switching from G Scratch to G Passing Chords is seamless.
- **Tempo is set for you:** if the sequencer is stopped, no other loop is playing and Link is off, the first loop you start changes the tempo to that loop's key tempo. A message pops up, for example "Tempo → 132 BPM to match G loops".
- **Loops follow the tempo:** if you change the tempo, running loops speed up or slow down to match.
- **Pitch shift warning:** loops follow the tempo by speeding up or slowing down the audio, like a tape machine, so the **pitch changes too**. Small changes are fine. Past about **8%** away from the loop's own tempo, the key will sound noticeably off (for example, a 132 BPM G loop played at 120 is about 9% slower and sounds flat). For the best sound, stay at the key's tempo.
- Loops always play at a fixed loudness. Velocity doesn't affect them.
- **REC doesn't record loop pads.** Only one-shots go into patterns.
- Pressing **Stop** stops all loops.
- Church banks load when they're first needed, and the info line shows "(loading…)". If you tap a loop before it has loaded, you'll see "Loading…". Tap again in a moment.

### 4c. Coming soon
These are listed in Sounds as **COMING SOON**. They can't be loaded yet:
- **Sanctuary Tonewheel A-100** (organ registrations, Leslie, keyclick, pedals)
- **Choir Loft** (SATB pads, oohs and aahs, ad-libs by key)
- **Hymn Roots** (public-domain hymn phrases on piano and organ)
- **Prayer Garden Sessions** (only after full rights clearance)

---

## 5. Themes

Open **Menu → Settings & Theme → Theme** and tap a swatch:
- **Neon (dark)**: the default flagship look for dark stages — black chassis, chunky raised pads with coloured light strips (orange, pink, violet, cyan rows) that glow when you hit them.
- **Light**: white keycaps for bright rooms, same chunky pads and coloured strips.
- **Warm · MPC60**: chunky grey rubber pads that press down, a beige body, grey rubber-look pads, orange accents and a green-yellow display, like a classic MPC60.

The theme is saved with your project. You can also add `?theme=warm` (or `dark` or `light`) to the address.

### 5b. Pad skin (Acrylic Kit / Hardware)

Open **Menu → Settings & Theme → Pad skin**:
- **Acrylic Kit** (default on new projects): each pad shows a **clear stage-head instrument** from above — snare with wires, kick with port, toms, hats, crash/ride, cowbell, clap, tambourine, shaker, 808 cone, plus motifs for FX, loops, organ and choir. Glass reflections and rim light follow the colour theme (Stage Glass on dark/neon, Studio Daylight on light/minimal, high-contrast outlines on Contrast).
- **Hardware**: the original raised neon rubber caps with LED strips.

The pad skin is saved with your project (separate from the colour theme). Hit feedback still scales with velocity: head flex, cymbal shimmer, rim light, flash and touch-point ripple — graphics-chip only, so sound timing stays unchanged.

---

## 6. Pad lights: flash and ripple

- Pads are raised keys: when you hit one it **presses down**, **flashes** and **glows** in its row colour, and **harder hits flash brighter, glow wider and ripple further**. With Acrylic Kit the instrument art also flexes or shimmers.
- On the Android app each hit also gives a small **vibration** (stronger for harder hits). Turn it off in Settings → Haptics.
- All of these effects use only the phone's graphics chip (no page re-layout), so they never delay the sound.
- The pad also shows a **ring** that grows outward and a **ripple** that spreads from where your finger touched.
- The flash happens the moment you touch, before the sound plays, so the light never lags behind your finger.
- Pads played by the sequencer light up slightly *before* you hear them, so the light and sound feel together. This is called **pre-light**, and you can adjust it in the Timing Lab (default 8 ms).
- **Reduce motion** (in Settings, or your device's own reduced-motion setting) keeps a short flash and turns off the ring and ripple.

---

## 7. Tempo

- **Range:** 30–300 BPM. A new project starts at 92 BPM.
- In **Tempo & Sequencer** you can use the **Tempo** slider, the **−1 / −0.1 / +0.1 / +1** buttons, or **TAP**. To use TAP, tap it 3 or more times in time with the music, with less than 2.5 seconds between taps.
- On a keyboard, **↑ / ↓** change the tempo by 1, and **Shift+↑ / Shift+↓** change it by 10.
- On tablets, the **Macro strip** also has a Tempo slider.

---

## 8. The sequencer

Open it from **Menu → Tempo & Sequencer**, by tapping the LCD display, or by tapping **PAT**.

### 8a. Patterns and bars
- There are **8 patterns**. Pick one with the **Pattern 1–8** buttons.
- **Length:** 1, 2, 3, 4 or 8 bars (the default is 2). Shortening a pattern deletes notes past the new end.
- **Clear pad** removes the selected pad's notes from the pattern. **Clear pattern** removes all notes (it asks first).

### 8b. Entering beats by hand (step editor)
- **Phone:** the lane shows the **selected pad** for one bar. Tap a step to add or remove a note. Use **BAR 1, BAR 2…** to change pages. **⇥** makes the page follow the playhead as it plays. Taller phones also show a mini grid of all 16 pads.
- **Tablet:** a full grid with one row per pad and all bars shown. Tap any cell to add or remove a note. Tap a row name to select that pad.
- Hand-entered notes have velocity 100, or 127 with FULL on.
- The grid's step size follows the **Quantize** setting (1/16 when quantize is Off).

### 8c. Recording live
1. If you like, turn on **Metronome** and/or **Count-in (1 bar)**.
2. Tap **REC** (or press **Enter**). If the sequencer is stopped, it starts.
3. With count-in on, you get one bar of clicks first, and the display shows **COUNT**.
4. Play the pads. Your hits are **added** to the pattern as it loops (overdub).
5. Tap **REC** again to stop recording but keep playing, or tap **▶/■** (or press **Space**) to stop.

### 8d. Play and stop
- **▶** (or **Space**) plays and stops. **■** stops.
- Stopping also stops all loops.
- If loops are already running when you press play, the pattern starts on the loops' next bar line so everything stays in step.

### 8e. Metronome and count-in
- **Metronome** clicks on every beat, with a higher click on beat 1.
- **Count-in** gives you one bar of clicks before recording. It only applies when you start by recording.

### 8f. Swing
- **Swing:** 50–75% (the default is 56%). 50% is straight, and about 66% feels like triplets.
- **Swing on:** **1/16** or **1/8** notes.
- Swing is applied as the pattern plays and doesn't change your recorded notes, so you can change it at any time.

### 8g. Quantize
Options: **OFF, 1/8, 1/8T, 1/16 (default), 1/16T, 1/32, 1/32T**. A "T" means triplet.
- Quantize snaps notes as you record them, and it also sets the step-editor grid.
- With **OFF**, notes are recorded exactly as you played them.

### 8h. Latency-corrected recording
Every touch has a small delay before you hear it. Sanctum records each hit at the moment you actually **heard** it, minus your **touch compensation** (measured in the Timing Lab), and then quantizes it. That means your recordings line up with what you played to. Hits from a MIDI keyboard or pad skip the touch compensation.

---

## 9. Note repeat

1. Tap **REPEAT** to turn it on (or press **N**).
2. **Hold** a pad. It repeats at the chosen rate, in time with the tempo and swing.
3. Tap **RATE** to step through **1/4, 1/8, 1/8T, 1/16, 1/16T, 1/32, 1/32T**. The current rate shows under the button.
4. **Long-press REPEAT** (or use **Menu → Note Repeat**) to open its panel, which has an on/off switch and a rate picker.

Notes:
- Note repeat works whether the sequencer is playing or stopped.
- With **REC** on, the repeats are recorded.
- On devices that report pressure, pressing harder or softer while holding changes the repeat loudness.

---

## 10. The audio engine and the latency readout

- On HTTPS or `localhost`, Sanctum uses a high-precision engine (AudioWorklet) that places every note on its exact sample. On plain `http://` it uses a simpler backup engine.
- The **⚡ chip** shows the *estimated* touch-to-sound time in ms. Its color shows whether it's within the target (OK), over the target, or over the ceiling.
- The estimate adds the device's reported audio delays to a touch delay. The touch delay is measured if you've done the tap test. Otherwise it's a guess: 8 ms for desktop, 12 ms for iOS, 20 ms for Android.

---

## 11. The Timing Lab

Open it by tapping **⚡**, from **Menu → Timing Lab**, or from **Timing Lab** on the tablet Macro strip.

### 11a. Live readout
Shows: engine type, sample rate, latencyHint, baseLatency, outputLatency, render quantum, touch input delay (measured or estimated), estimated **Touch → sound** and **MIDI-in → sound**, measured **round trip**, recording correction, pad pre-light, sequenced playback error (0 samples), and late events/voices.

### 11b. Hard limits table
Each measurement is labeled **OK**, **OVER TARGET** or **OVER CEILING**:

| Measurement | Target | Ceiling |
|---|---|---|
| Touch-to-sound (iOS / desktop) | ≤ 20 ms | 30 ms |
| Touch-to-sound (Android) | ≤ 30 ms | 40 ms |
| MIDI-in-to-sound | ≤ 10 ms | 15 ms |
| Audio round trip | ≤ 10 ms | 20 ms |
| Recorded-timing error (tap jitter) | ≤ 1 ms | 2 ms |
| Sequenced playback error | 0 | 0 |

If any measurement is over its ceiling, a red **NOT STAGE-CERTIFIED** banner appears and a warning message pops up. If everything is under, the banner reads "Within the hard ceilings".

### 11c. Buffer size slider
Steps: **Lowest (interactive)**, 128, 256, 512, 1024, 2048, 4096 frames (about 2.7 ms up to about 85 ms).
- **Smaller** buffers give less delay but carry more risk of clicks and dropouts on slow devices.
- **Larger** buffers are more stable but have more delay.
- Changing the buffer **restarts the audio engine** and stops playback.
- The browser treats your choice as a request and may give you something different. The readout shows what you actually got.

### 11d. Tap test (calibrating touch delay)
1. Tap **Start tap test**. After a short pause, Sanctum plays 16 clicks at 100 BPM.
2. Tap the box on **every click**. You need at least 8 taps.
3. Sanctum reports how late your taps land, for example "Your taps land 30.4 ms after the audible click", and sets the **recording correction** automatically (0–80 ms).

### 11e. Loopback test (measuring round trip)
1. Tap **Measure round trip (loopback)** and allow microphone access.
2. Sanctum plays 6 short clicks and listens for them. Either place the speaker near the mic, or connect a loopback cable or audio interface. **Headphones won't work** for this. Keep the room quiet.
3. It reports the median round trip and jitter. It needs at least 3 of the 6 clicks to be heard.

This test needs the HTTPS/AudioWorklet engine.

### 11f. Manual correction
- **Touch comp:** −20 to +80 ms (the tap test sets this for you).
- **Pre-light:** 0–40 ms (how early sequenced pads light up).

### 11g. Bluetooth warning
If the output delay is over **80 ms**, Sanctum warns that you're probably on Bluetooth or another slow route: "Bluetooth audio is not allowed for performance". **Use wired headphones, USB audio or the built-in speaker on stage.** Web pages can't actually see which output you're using, so this warning is a best guess.

---

## 12. Ableton Link sync

Link keeps Sanctum's tempo and beat in step with Ableton Live and other Link apps on the same Wi-Fi.

### Why you need the bridge
Browsers aren't allowed to join a Link session directly, because of the networking Link uses. A small helper program, the **Sanctum bridge**, runs on a computer on the same Wi-Fi, joins Link, and passes the information to Sanctum.

### Setup
1. On a computer on the same Wi-Fi, run once: `npm run bridge:setup`
2. Start the app server: `npm run preview:https` (or `npm run dev:https`)
3. In a **second terminal**, run: `npm run bridge`
   (options: `--port 20809 --quantum 4 --bpm 120 --backend relay|addon`)
4. On the phone, open Sanctum from that computer's HTTPS address.
5. Tap the **LINK** chip (or **Menu → Link & MIDI**) and turn on **Link (via Sanctum bridge)**.

The app server forwards the connection to the bridge, so the default **Bridge URL** works from phones with no extra setup. You can type a different URL in the **Bridge URL** box if needed.

### What you'll see
- **LINK chip:** the number of other Link devices ("peers"), or **×** if the bridge isn't connected. The color shows the state: green means peers are connected, amber means connected with no peers, red means not connected.
- **Messages:** "Bridge connected, no other Link peers yet…" or "In sync with N Link peers."
- **Phase bar:** one block per beat of the quantum, with the current beat lit.
- **Details:** Bridge status, Peers, Session tempo, Beat / phase, Bridge RTT, Phase error.
- **Quantum: 2 / 4 / 8**: how many beats make up a cycle. When you press play, Sanctum starts at the next cycle boundary.

### Tempo and start/stop
- Changing the tempo in Sanctum changes it for the whole Link session, and other devices' tempo changes reach Sanctum.
- **Start/stop sync works both ways:** pressing play or stop in Sanctum starts or stops the other devices, and they can start or stop Sanctum. Sanctum only follows a remote start after you've tapped **Tap to start**.
- While Link is on, starting a loop won't change the tempo automatically.
- **Linux computers:** if no peers show up, the network may be blocking "multicast" traffic.

---

## 13. MIDI — USB, Bluetooth and your DAW

Open **Menu → Link & MIDI**. Sanctum talks MIDI in two ways:
- **Android app:** built-in native MIDI (Android's own MIDI system). Works with **USB-C MIDI keyboards/pads/interfaces** (USB host, usually with a USB-C OTG adapter), **Bluetooth MIDI** devices, and the **phone itself as a USB MIDI device** plugged into your computer.
- **Browser version:** Web MIDI in **Chrome or Edge** (desktop, Android Chrome, Chromebook) over HTTPS/localhost. Not in iPhone/iPad Safari.

### 13a. Turning it on
1. Tap **Turn on MIDI** (later: **Look for MIDI devices again**). In the Android app, USB devices that are plugged in are opened automatically.
2. **Bluetooth (Android app):** tap **Find Bluetooth MIDI**, allow the Bluetooth permission, then tap **Connect** next to your device.
3. **Phone → computer over USB (Android app):** plug the phone into the computer with a USB-C cable, pull down the notification shade, tap **"Charging this device via USB"** (or "USB preferences"), and choose **MIDI**. The computer now sees a MIDI device called something like **"Android"** or your phone's name. (Menu wording varies by phone brand.)
4. **Send to / Listen to:** pick one device or leave **All**.

### 13b. What gets sent and received
| What | Out (Sanctum → DAW) | In (DAW/controller → Sanctum) |
|---|---|---|
| **Notes** | Turn on **Pads send notes to the computer**. Pad 1–16 = notes **36–51** (C1–D#2), with velocity, on the **MIDI channel** you pick (default 10). Sequencer notes are sent too. | **Notes from MIDI play the pads** (any channel). 36–51 = pads 1–16; other notes wrap onto the 16 pads. |
| **Knobs (CC)** | Moving Main volume, Swing, Pad level or Pad tune sends the mapped CC (turn off with **Send knob changes out**). | Mapped CCs move those controls. Defaults: **CC 7** main volume, **CC 9** swing, **CC 71** pad level, **CC 74** pad tune; Tempo is unmapped. |
| **MIDI learn** | — | Tap **Learn** next to a control, then move a knob on your controller or DAW. |
| **Clock** | **Send tempo clock + Start/Stop**: 24 pulses per beat, scheduled ahead from the audio clock. | **Follow the computer's clock**: tempo follows, Start/Continue/Stop control playback. If Link is on, Link wins. |
| **Clock offset** | −50…+50 ms to line up with your DAW. | |

Song Position Pointer isn't sent or followed yet (Start always means "from the top").

### 13c. DAW setup guide
The most reliable setup for every DAW: **let the DAW be the leader** — the DAW sends MIDI clock, Sanctum follows (**Follow the computer's clock** on), and Sanctum's pads send notes to a drum/instrument track. Connect by USB (phone in **MIDI** USB mode) or Bluetooth.

**Bluetooth on a computer:** on a **Mac**, open **Audio MIDI Setup → Window → Show MIDI Studio → Bluetooth** (the Bluetooth icon), find the phone and click **Connect**. On **Windows**, most DAWs can't see Bluetooth MIDI on their own; install a BLE-MIDI utility/driver (for example **KORG BLE-MIDI Driver** or **MIDIberry** + loopMIDI) first. USB is simpler and has less delay than Bluetooth.

- **Ableton Live** — Best: **Link** (see section 12; needs the Sanctum bridge on the computer). Or MIDI: *Settings → Link, Tempo & MIDI*: for the Sanctum/Android port turn on **Track** (notes in) and **Remote** (knobs) for Input; turn on **Sync** for Output to send clock to Sanctum (or Sync on Input to make Live follow Sanctum's clock). Arm a Drum Rack track with *MIDI From* = the Sanctum port.
- **FL Studio** — *Options → MIDI settings*: enable the Sanctum port under **Input** (pick a port number) and **Output** (same port number). Tick **Send master sync** on the output to send clock to Sanctum, or set *Sync* to **External** to make FL follow Sanctum. Map knobs with right-click → *Link to controller*.
- **Logic Pro (Mac)** — *Logic Pro → Settings → MIDI*: make sure the port is enabled; notes arrive on any armed software instrument (e.g. Drum Machine Designer). **Logic can't follow incoming MIDI clock**, so let Logic lead: *File → Project Settings → Synchronization → MIDI* → tick **Transmit MIDI Clock** to the Sanctum port, and turn on Sanctum's **Follow the computer's clock**. Use *Logic Pro → Control Surfaces → Learn Assignment* for knobs.
- **Pro Tools** — *Setup → MIDI → Input Devices*: tick the Sanctum port. Create a MIDI or instrument track with input = the port, record-enable it. Clock out: *Setup → Peripherals → Synchronization* / *Setup → MIDI → MIDI Beat Clock* → enable and tick the Sanctum port. Pro Tools doesn't follow MIDI clock, so Pro Tools leads.
- **Cubase** — *Studio → Studio Setup → MIDI Port Setup*: make sure the port is active and "In All MIDI Inputs" is ticked. Clock out: *Transport → Project Synchronization Setup* → **MIDI Clock Destinations** → tick the Sanctum port. Cubase leads (it doesn't follow external MIDI clock). Knobs: *Studio → Generic Remote* or Quick Controls.
- **REAPER** — *Options → Preferences → Audio → MIDI Devices*: enable the Sanctum input (**Enable input**, and *for control messages* if you want knobs) and output. Clock out: right-click the output → **Send clock/SPP**. REAPER leads. Arm a track with input = the Sanctum port.
- **Studio One** — *Studio One → Options → External Devices → Add…* → **New Keyboard** (for notes in) and/or **New Instrument** (to send clock): choose the Sanctum port; on the instrument tick **Send MIDI Clock**. Studio One leads.

If timing feels a bit early or late, adjust **Clock offset**. If two notes play for every hit, you have a loop: turn off **Pads send notes** or disable *MIDI Thru/echo* for that track in the DAW.

**Verified vs not verified (honest):** the MIDI byte handling, clock, note and CC logic is tested in the browser build. The Android native MIDI plugin compiles and is in the APK, but **no USB or Bluetooth MIDI hardware or DAW has been tested yet** (none was available while building). The DAW menu paths above come from each DAW's current documentation and may differ slightly by version.

---

## 14. Autosave, snapshots and export

- **Everything saves automatically** on this device about a third of a second after each change. It also saves immediately when you switch apps or close the page.
- What's saved: patterns, bank assignments, pad level/pan/tune/mute, tempo, swing, quantize, theme, settings and Timing Lab results.
- When you reopen the app, the start screen says "Project restored from autosave."
- **Snapshots:** Sanctum keeps the last **5** snapshots, taken at most once every **2 minutes**.
- **Menu → Settings & Theme → Project:**
  - Shows the last save time and the number of snapshots.
  - **Export project JSON**: downloads `sanctum-project.json`.
  - **Restore last snapshot**: goes back to the most recent snapshot. The app reloads.
  - **Reset project**: back to factory defaults (it asks first).
- Saves stay in this browser on this device. Clearing your browser data erases them, so export anything important.

---

## 15. Settings (other)

In **Menu → Settings & Theme**:
- **Layout:** Auto / Phone / Tablet
- **Dominant hand:** Right / Left (mirrors the phone layout)
- **Haptics (Android vibrate):** a small buzz on pad hits, stronger for harder hits
- **Reduce motion**
- **Master:** overall volume, 0–100% (default 85%)
- **Access**: shows how this device was unlocked and until when.

---

## 16. Phone and tablet layouts

Sanctum picks a layout from your screen size. Screens at least 600 px on the short side count as tablets. You can override this in Settings or with `?layout=`.

- **Phone, portrait:** status strip, bank row, step lane (plus a mini drum grid on tall phones), 4×4 pads in thumb reach, action bar at the bottom. Swing, quantize, MIDI and ⚙ are hidden from the top strip to save room. Use **⌘ menu**.
- **Phone, landscape ("Studio"):** pads on the left, editor on the right.
- **Tablet, landscape ("Studio"):** sound browser (with "Load into bank…" and Credits) | full grid editor | inspector (Pad and Sequencer controls) above the pads, with side action buttons, and a **Macro strip** with Tempo, Swing, Master, Pad level, Pad tune, plus **Timing Lab**, **Link / MIDI** and **Settings** buttons.
- **Tablet, portrait ("Pad wall"):** grid on top, pads filling the lower half or so.

---

## 17. Access & licensing

Sanctum is private. When it opens it checks for a valid **access code** before anything else loads — without one you only see the lock screen (no pads, sounds or settings are loaded at all).

**Getting in:** tap **I have a code** and paste the code (or just tap the link Lawrence sent — on an Android phone with Sanctum installed, a `sanctum://activate?code=…` link opens the app and unlocks it). The code is checked on the phone with a digital signature, so no internet is needed. After unlocking, the code is kept in the phone's secure storage (Android Keystore; iPhone Keychain later; in a web browser it's kept in the browser's storage, which is less secure) and is re-checked every time Sanctum opens.

- **Expired:** you'll see "Your access has expired" — ask Lawrence for a new code.
- **This code is for another device:** some invites only work on one phone. Help shows your **Device ID**; send it to Lawrence.
- **Subscribe:** shows the plan; store billing isn't connected yet.

**For Lawrence (owner)** — on the computer that holds the keys, in the Sanctum folder:
- `npm run license:invite -- --name "Alice" --days 30` makes an invite code plus a tap-to-open link. Add `--device XXXX-XXXX-XXXX-XXXX` (their Device ID) to lock it to one phone. Leave out `--days` for no end date.
- `npm run license:admin` makes your own owner code (saved to `licensing-keys/ADMIN-TOKEN.txt`). It unlocks everything plus the hidden **Menu → Admin** panel (license details, lock-screen previews, remove license).
- Every code you make is logged in `licensing-keys/issued.jsonl`.
- The signing key lives only in `licensing-keys/` on that computer. **Never share that folder or put it in the app** — anyone with it can make codes. Back it up somewhere safe.

**Limits today:** codes can't be taken back remotely yet (revoking means adding the code's id to the app's built-in deny list and shipping an update), a code without `--device` can be used on more than one phone, and subscriptions need a server that isn't built yet.

---

## 18. Credits and licensing

- **Every sound in Sanctum is synthesized.** The starter banks are generated inside the app, and the church shout banks are original synthesis made for Sanctum. **No third-party samples are used**, so no attribution is needed.
- **Menu → Credits** (or the **Credits & licenses** button in Sounds) lists every sound with its author and license, plus the software used: the Ableton Link SDK (bridge only; GPLv2+ or a commercial license from Ableton), ws (MIT), Vite (MIT) and TypeScript (Apache-2.0).

---

## 19. Quick reference

| Action | Touch | Keyboard |
|---|---|---|
| Start audio | **Tap to start** | (click) |
| Play a pad | Tap a pad | `Z X C V` / `A S D F` / `Q W E R` / `1 2 3 4` (bottom → top rows) |
| Full-velocity hit | **FULL** | Hold `Shift` |
| Play / stop | **▶** (■ on phone while playing) | `Space` |
| Stop | **■** | `Space` |
| Record | **REC** | `Enter` |
| Previous / next bank | **A–H** buttons | `[` / `]` |
| Note repeat on/off | **REPEAT** | `N` |
| Note repeat rate | **SPEED** (or long-press REPEAT) | – |
| Tempo ±1 / ±10 | Tempo & Sequencer | `↑` `↓` / `Shift+↑` `Shift+↓` |
| 16 Levels | **16 levels** | – |
| Edit pad | **PAD edit** | – |
| Load soundbank | **♫ Sounds** | – |
| Tempo, pattern, swing, quantize | Tap LCD or **PAT** | – |
| Timing Lab | **⚡** chip | – |
| Link & MIDI | **LINK** / **MIDI** chip | – |
| Menu | **⌘ menu** / **⚙** | – |
| Close panel | **Done** / tap outside | `Esc` |

| Setting | Range | Default |
|---|---|---|
| Tempo | 30–300 BPM | 92 |
| Swing | 50–75% (on 1/16 or 1/8) | 56%, 1/16 |
| Quantize | Off, 1/8, 1/8T, 1/16, 1/16T, 1/32, 1/32T | 1/16 |
| Note repeat rate | 1/4 … 1/32T | 1/16 |
| Pattern length | 1, 2, 3, 4, 8 bars | 2 |
| Pad level / tune | 0–150% / ±12 semitones | 100% / 0 |
| Fixed velocity / curve | 1–127 / 0.6–3.0 | 110 / 1.6 |
| Buffer | Lowest … 4096 frames | Lowest |
| Touch comp / pre-light | −20–80 ms / 0–40 ms | 0 / 8 ms |
| MIDI clock offset | ±50 ms | 0 |
| Link quantum | 2, 4, 8 | 4 |

---

## 20. Known limitations

Sanctum is a **prototype** (version 0.1.0). It has been tested only in desktop Chrome, including headless automated tests.
- **Not tested on real phones or tablets, or on iPhone/iPad Safari.** Touch velocity, timing, installing and the layouts have only been checked in simulated screens.
- **MIDI hardware is untested.** Web MIDI has only been checked to be present in the browser, not with real devices. There's **no MIDI in iOS/iPadOS Safari** at all, and no MIDI 2.0, MIDI learn or controller profiles.
- **The mic loopback test hasn't been tried on a real audio interface.**
- **Link** has been verified only between programs on one Linux computer over the local connection, not across real Wi-Fi with Ableton Live. It always needs the bridge running on a computer.
- **Latency numbers are estimates.** Some browsers report 0 or very little output latency (Safari in particular) or ignore the buffer request.
- The **Bluetooth warning is a guess** based on the reported delay.
- **Loops change pitch** when played away from their own tempo, because there's no time-stretching yet.
- **Not built yet:** sampling or recording your own sounds, chopping, a mixer or effects, song mode, a native iPhone or Android app, or deployment to a public web address.
- **Access screens are a mock.** There's no real sign-in, invites or billing.
- Your project is stored only in this browser on this device. There's no cloud sync, and **Export project JSON** has no matching import button.

---

## 21. Troubleshooting

| Problem | Try this |
|---|---|
| **No sound** | Tap **Tap to start**. Turn up the device volume and check the iPhone silent switch. Check **Master** in Settings. Check that the pad isn't **muted** or **— empty —**. |
| **"Audio failed to start"** | Reload the page and tap **Tap to start** again. Close other audio apps. |
| **Sound crackles or drops out** | In the Timing Lab, move the **Buffer** slider up one step. |
| **Sound feels late** | Use wired headphones or the speaker, not Bluetooth. Move the **Buffer** to "Lowest". Use HTTPS so the better engine runs. |
| **Recorded notes are early or late** | Run the **Tap test** in the Timing Lab, or adjust **Touch comp**. |
| **Bluetooth warning / NOT STAGE-CERTIFIED** | Switch to wired or USB output, lower the buffer, or play from an external MIDI pad (on supported browsers). |
| **Loop won't start** | It waits for the next bar. If you see "Loading…", wait a moment and tap again. |
| **Loop sounds out of tune** | You're far from its key tempo. Set the tempo to G=132, C=120, D=140 or A=150. |
| **The tempo jumped when I started a loop** | That's intended: the first loop sets the tempo to its key. Change it back with the Tempo controls. |
| **Church banks are missing or "failed to load"** | Make sure the server is serving the `content/church-banks/` folder, then reload. |
| **Phone shows a security warning** | That's normal for the local HTTPS self-signed certificate. Accept it once. |
| **Can't install to the home screen** | Use HTTPS. On iPhone, use Safari's **Share → Add to Home Screen**. |
| **LINK shows ×** | Start `npm run bridge` on the computer, use the HTTPS address from that same computer, and check that both devices are on the same Wi-Fi. |
| **LINK shows 0 peers** | Open Ableton Live or another Link app on the same network and turn its Link on. On Linux, allow multicast. |
| **"Web MIDI is not available"** | Use Chrome or Edge on Android or desktop. iPhone/iPad Safari has no Web MIDI. |
| **"Web MIDI needs a secure context"** | Open the app over HTTPS (`npm run dev:https`) or on `localhost`. |
| **Loopback test: "Only N/6 impulses detected"** | Turn the volume up, move the speaker closer to the mic, or use a loopback cable. Don't use headphones. |
| **The app is locked or shows a paywall** | You need an access code from Lawrence (see section 17). If you're the owner previewing lock screens from Admin, tap **CLOSE PREVIEW**. |
| **I lost my work** | **Settings → Restore last snapshot**. Export JSON regularly as a backup. |

---

## 22. The Android app (APK)

- Install `Sanctum-v0.2.0.apk` on Android 7.0 or newer (allow "Install unknown apps" for your file manager or browser when asked).
- It runs fully offline: all sounds (OGG), the sequencer, themes and the Timing Lab are inside the app. Only Link needs the bridge on a computer on the same Wi-Fi.
- The app goes full screen (swipe from an edge to see the system bars), keeps the screen awake while playing, and on phones stays in portrait (tablets can rotate).
- **Link in the app:** open **Link & MIDI**, type the address the bridge prints on the computer (for example `192.168.1.20`) into **Bridge address**, and turn Link on. If there's no address, Link shows "unavailable on this device" instead of an error. For safety only local-network addresses are allowed for unencrypted connections.
- **Microphone:** only asked for when you run the Timing Lab loopback test.

## 23. Latency on Android — honest numbers

Sanctum's sound engine runs in the phone's web engine (Android System WebView, the same engine as Chrome). Chrome on Android plays through AAudio with a low-latency buffer of about 256 frames (≈5 ms at 48 kHz), but the phone's own output path adds more on top. In practice, **touch-to-sound through the WebView is usually about 20–50 ms or more** depending on the phone, and Bluetooth headphones add 150–300 ms (Sanctum warns about Bluetooth). **A round trip under 10 ms is generally not reachable through the WebView.** The latency chip and the Timing Lab show the real numbers on your phone — trust those.

What we do now: request the lowest-latency audio mode (`latencyHint: "interactive"`, or the smallest buffer you choose on the slider), schedule sequencer notes ahead on the audio clock (so the beat itself doesn't jitter), and light pads instantly.

**The route to sub-10 ms (next step, not built yet):** a native Capacitor plugin that plays the pads through Google's **Oboe** library (AAudio, LowLatency performance mode, Exclusive sharing, 48 kHz, double-buffered callback — Google's *DrumThumper* sample is the model), triggered straight from the native touch event. On phones that report Android's **"Pro Audio"** feature (`android.hardware.audio.pro`, which promises a short round trip — about 20 ms or less in the Android compatibility rules) this can get output latency near 10 ms; on other phones it will still beat the WebView. Sources: Android low-latency audio guide (developer.android.com/games/sdk/oboe/low-latency-audio), Oboe DrumThumper sample (github.com/google/oboe/tree/main/samples/drumthumper).

## Sanctum Pulpit — backing a preacher or singer

Pulpit is for Sunday morning when you need a band behind the Word and you only have a phone.

1. Unlock Sanctum with your code, tap to start sound, then tap **PULPIT** (or Menu → Pulpit).
2. Pick the **key** the preacher or singer is in (big buttons across the top). Hold a key for about a second to let the mic listen — the guessed key lights green; tap it to lock. If the mic is blocked, just tap the key yourself.
3. Tap **EASY PLAY** on every phrase. Each tap plays the next chord of the progression. You do not need to know music theory.
4. Swipe or tap **SHOUT 1–4** when the room gets hot; swipe or tap **WORSHIP 1–4** for softer altar moments. **Drums** and **Music** mute buttons cut those layers without stopping.
5. **HIT** is a short stab for band hits. **STOP** cuts now; **FADE** softens out.
6. **Full Band** vs **Organ + Drums** changes the texture. Organ run buttons add a short fill.
7. **STAGE** locks the screen so a pocket bump cannot leave Pulpit mid-service. Hold/unlock Stage to go back.
8. **Follow Voice** (optional): turns the mic into an automatic trigger. It listens for syllables and pitch on the device only (nothing is uploaded). It will place hits on phrase pauses, nudge shout/worship level slowly, and suggest chords that fit the sung note. **Your taps always win.** Keep the phone away from the speakers — loud PA into the mic will confuse it and can feedback. In a very loud room, prefer Easy Play.

Edit sequence: **Edit sequence** lets you type your own chord list (Roman numerals like `I IV V7` or Nashville numbers like `1 4 5`). It autosaves on this device.

Pulpit tempo follows the project tempo and Ableton Link when Link is on.

### What Follow Voice can and cannot do
- It estimates speaking rate and pitch from the microphone. It is **not** a cloud transcription service and does not understand words.
- Accuracy drops with distant mics, heavy reverb, drums in the mic, or several people talking. Use the sensitivity slider; if it misbehaves, turn Follow Voice off and use Easy Play.


## Chords — live detection & import

Open **Menu → Chords** (Sanctum Chords sheet).

### Live
1. Tap **Start mic / line-in** (needs HTTPS / secure context and mic permission).
2. Sanctum listens with Web Audio analysis only — the mic is **never** routed to the speakers.
3. The big label shows the current chord (maj, min, 7, maj7, m7, sus2/4, dim, aug; slash bass when clear). Confidence, key, Roman numeral, scrolling history, and the top likely next chords update as you play.
4. Smoothing (causal HMM + hold frames) reduces flicker on stage.

### Import (legal sources only)
- **File upload:** MP3, WAV, AAC/M4A, FLAC (FLAC/AAC may fail on some Android WebViews — use WAV/MP3 then).
- **Direct audio URL:** must allow CORS download; blocked URLs show a clear error.
- **Church banks:** analyse Sanctum’s own royalty-cleared loops (key/BPM from the manifest).
- **Metadata adapters:** SoundCloud oEmbed, Spotify (metadata only — audio-features/analysis unavailable to new apps since Nov 2024), Apple Music (metadata), Bandcamp (info: use file upload for purchases you own).
- **Not available:** YouTube and ripping any streaming service.
- Offline analysis builds a timestamped chart (grouped by bar when tempo is detected), optional synced playback cursor, export to text/JSON.

### Theory
Shows key, relative major/minor, diatonic chords, Roman numeral for the current chord, Markov likely-next chords, and gospel/jazz moves (tritone sub, ii–V–I, I–vi–ii–V, passing dim, backdoor). Beat Theory maps can drop in via `content/theory/beat-theory-maps.json` (schema in `src/chords/theory-ext.ts`).

### Show chords on screen
Toggle **Show chords on screen** to push the current (+ next) chord to Lampstand through the existing screen bridge (`src/integrations/screen.ts`).
