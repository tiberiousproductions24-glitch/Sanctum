# SANCTUM — Promo Treatment (first pass, for tone approval)
**Client / Producer:** Tiberious Productions (Lawrence Davis Sr)  
**Product:** Sanctum — MPC-style touch drum machine / sampler for church and stage musicians (v0.2.0, Android APK + PWA; iOS pending)  
**Deliverables (this pass):** treatment, script, VO casting notes, 3 style frames, real app captures. **No video rendered yet.**  
**Date:** Mon Nov 2, 2026  
**VO requirement (firm):** All narration performed by a **Black male voiceover artist** — presence, grit, authenticity. Punchy, confident, aggressive, rhythmic. Not soft, not overly scriptural. See `casting_notes.md`.

---

## Concept: **"PRESSURE"**
Velocity is pressure. The stage is pressure. Sunday morning and Saturday night are both pressure. Sanctum is the instrument that answers it.

### Logline
In a pitch-black steel sanctuary cut by one hard beam of light, a player's hands come down on sixteen pads — and every strike detonates in neon: a velocity flash, a ripple off the fingertip, a sequencer locking the groove, a whole band snapping to one clock.

### Concept summary
"PRESSURE" treats Sanctum like a weapon reveal, not a welcome mat. We open in silence and darkness, and from the first kick every cut lands on a beat, every pad hit is a light source, and the voice rides the gaps between drops like a hype man who already knows he's won. The app is the star: real Sanctum UI (pads, banks A–H, the 960-PPQ step grid, swing, note repeat, the Ableton Link panel, the Timing Lab latency readout) is composited into dark industrial / neon stage plates. It ends on the gold Arch Pad mark and one line: **"Hit like you mean it."**

---

## Visual language

### Palette (pulled from the app's real "Neon flagship" dark theme, `src/hardware.css`)
| Role | Hex | Use |
|---|---|---|
| Obsidian (bg) | `#07070C` | 70%+ of every frame. Crushed blacks, no lifted shadows |
| Surface | `#0E0E16` / `#12121C` | Steel, concrete, chassis |
| Zone 0 — electric orange | `#FF6A13` | Pads 1–4 / kicks, first hit flash |
| Zone 1 — hot magenta | `#FF2D95` | Pads 5–8, app accent, step-on, REC energy |
| Zone 2 — violet | `#9B5CFF` | Pads 9–12, loops |
| Zone 3 — cyan | `#19E3FF` | Pads 13–16, LCD/tempo readout, HUD text, Link |
| Arch gold | `#E8B931` | Arch Pad logo, end card ONLY (keeps it precious) |
| Ivory | `#F4F1EA` | Type |
| Signal green / warn / bad | `#3DDC84` / `#F5B400` / `#FF4D4F` | Link "in sync" LED, latency chip states |

Rule: pads are the light sources. Practical light comes from the pad zones, the LCD, and one hard white top beam. No warm amber "golden hour" wash anywhere.

### Lighting
- Single hard top-down spot through haze (the "sanctuary beam"), everything else falls off to black.
- Colored rim lights (magenta stage-left, cyan stage-right) on hands, shoulders, gear.
- Pad hits = interactive light: each strike pops a 2–4 frame exposure spike on skin and smoke in the zone color.
- Strobes on 1/8 notes in the peak section only. Anamorphic flares, heavy grain, slight chromatic split on type.

### Locations / plates
- Dark industrial sanctuary: steel truss, concrete, gothic arch silhouette (the arch echoes the Arch Pad mark), haze.
- Stage: LED wall built as a 4×4 grid that mirrors the pad layout; panels fire with the pads.
- Inserts: macro hands on phone and tablet (Black hands, rings, sweat sheen), Hammond/organ keys under neon, drum kit silhouette, laptop running Ableton Live for the Link moment.

### Typography
- Headline: **Anton** (condensed, all caps, tight tracking) with a 4–6 px magenta/cyan RGB-split. Slams on the beat, holds 6–12 frames, hard cuts off. No fades on type.
- HUD / data: **JetBrains Mono** in cyan/orange (VEL 127 · PAD 1 · BANK A, BPM, LINK, latency).
- Wordmark: the app's own spaced serif SANCTUM + gold Arch Pad (from the app's lock screen), end card only.
- Banned: Cinzel, Cormorant, Playfair italics, Montserrat-on-gold-bars (all Prayer Garden).

### Motion & edit
- Hard cuts only, on kicks/snares. Zero cross-dissolves. Speed ramps (240 fps → real time) into hits.
- 1-frame white flash frames on drops; 2-frame black "breath" frames before the VO lands.
- UI moves are real app behavior: pad flash at velocity brightness on touch-down (pre-light), ring scale 1.0→1.15 in 180 ms, ripple from the touch point, step-grid playhead, LINK chip going green.
- Camera: locked-off macros and slow push-ins; handheld only in the peak montage.

---

## Music / sound direction
- **Tempo:** 140 BPM (half-time feel, bar = 1.714 s). Script timecodes are built on this grid.
- **Genre:** dark trap / industrial hip-hop with church DNA: distorted 808s with glide, metallic claps, clanging industrial percussion, tape-saturated Hammond organ stabs, a gated choir chop used as a riser. Minor key (C or F minor).
- **Shape:** silence + sub hum → first kick → build in 2-bar blocks → **DROP at 0:12** → sequencer groove → breakdown (kick + organ only) at 0:20.6 → Link/latency section rebuilds → peak strobe 0:32.6 → hard stop, logo hit, tail.
- **Space for VO:** music ducks only 4–6 dB under VO (VO sits *on* the beat, not floating over pads). 1–2 beat dropouts before key lines ("…it answers.", "One clock.", "Sanctum.").
- **Sound design:** real Sanctum sounds on screen hits (Sanctum Foundation Kit, Sanctum Stage FX & 808, Shout Organ/Percussion banks — all synthesized in-app or from Lawrence's own banks), so what you see is what you hear.
- **Recommended source (pending Lawrence):** (a) an original 140 BPM cue built in Sanctum itself ("the promo was made on the product" — strongest story, zero licensing risk), or (b) Tiberious Beat Pack Vol. 1 #08 *Neon Marina* (155 BPM, C minor, used in the Nov 1 v1 cut) with the vocal-tag stem muted and darkened; at 155 BPM all timecodes compress ~10% (hero ≈ 35.6 s).

---

## What we're NOT doing (vs. the Prayer Garden promo)
Reference: `/workspace/prayer-garden/prayer-garden-promo-v1.mp4`, `prayer-garden-promo-overlay.mp4` and builds v2–v7 in `/workspace/artifacts/` (`overlay_build_v7.py`). That piece is a 55 s, 1280×720 church invitation, and it works for what it is. Sanctum is the opposite brief.

| Prayer Garden did | Sanctum does instead |
|---|---|
| Warm sepia/amber footage of the sanctuary, pews, choir, pastor, historic 1945 building photos | Pitch-black industrial plates; the only warmth is a pad flash |
| Soft crossfades (`fade`, `smoothleft`, `smoothup`, `fadeblack`), ~0.6 s dissolves | Hard cuts on the beat, flash frames, speed ramps |
| Invitation copy: "You're Invited", "Come As You Are", "Join Us This Sunday", "How to Save You? / Deliver You?" | Product copy with swagger: "Hit it hard — it answers.", "One clock." |
| Scripture read as VO (Matthew / Isaiah passages) | Zero scripture quoted; faith shows up as setting (arch, organ, choir chop), not sermon |
| Gentle TTS narrator (edge-tts en-US-AndrewMultilingualNeural, slowed −10%) | A real Black male VO artist with grit, presence and rhythm (TTS only as a scratch, matching voice) |
| Gold lower-thirds, Montserrat ExtraBold on colored bars, Playfair/Cinzel serif titles | Anton slam type with RGB split + mono HUD data |
| Gospel mashup bed under narration, slow build | 140 BPM dark trap/industrial cue, cuts locked to it |
| Address / phone / "this Sunday" call to action | Product end card: Arch Pad, SANCTUM, tagline, platforms |

Also not doing: stock "worship hands raised" shots, sunrise/dove/cross imagery, lens-flare-on-stained-glass, piano-pad underscore, "blessed"/"anointed" copy.

---

## Honesty guardrails (product claims)
- All UI shown must be real Sanctum UI (captures in `app_captures/`) or a faithful composite of it. No invented features.
- **Latency:** the only readouts on the box are from a headless desktop run (touch→sound est. 53.3 ms, Timing Lab shows "NOT STAGE-CERTIFIED"). Do not show or say a low-latency number until it is captured on a real phone/tablet that passes the Timing Lab limits. Script copy for that beat ("Every millisecond, on the screen.") sells the *readout*, not a number.
- Link: show real "In sync with N Link peer(s)" state; the bridge + Ableton Live capture must be real.
