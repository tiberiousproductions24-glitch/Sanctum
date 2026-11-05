# Sanctum Pad Skin Research — Acrylic Kit

**Brand:** Tiberious Productions · Sanctum (Lawrence Davis Sr)  
**Date:** Thu Nov 5 2026 (America/Los_Angeles)  
**Goal:** Pads that look like real drum-kit instruments viewed from directly above through clear acrylic/plexiglass stage heads — recognizable at a glance, edgy, GPU-friendly, theme-aware.

> No copyrighted product photos or third-party raster art are shipped in the app. This document links public references only. All SVG instrument art in `src/ui/skins/kit/` is original.

---

## 1. Clear / acrylic drum language

### Film heads (clear batter / resonant)
- **Remo Ambassador Clear** — 1-ply 10-mil clear film; bright, open, industry-standard tom resonant. Visual cues: near-transparent film, faint concentric manufacturing rings, chrome hoop and claw-hook lugs around the circumference.  
  Source: https://remo.com/product/ambassador-clear
- **Evans G1 / Genera clear** — similar single-ply clear aesthetic; slightly different collar/hoop silhouette. Useful for “studio daylight” clarity without coated-white head texture.  
  Source: https://drumhelper.com/accessories/remo-vs-evans-drumheads/

### Acrylic shells (stage glass)
- **Ludwig Vistalite** — 6 mm acrylic shells (clear, amber, blue, yellow…); designed so stage light passes through the drum. Overhead / drummer-POV shots show hoop → head → shell depth → hardware as layered glass.  
  Sources:  
  - https://www.ludwig-drums.com/en-us/ludwig/products/drumkits/vistalite  
  - https://drummagazine.com/ludwig-vistalites-the-difference-was-clear/
- **Fibes / modern acrylic kits** — same “crystalline” language: rim light on the hoop, shell refraction, head reflections.

### Design takeaways for Sanctum pads
1. **Layers, not fills.** Shell → under-texture (wires / port / beads) → clear head film → specular reflection → chrome hoop + lugs → rim light.
2. **Transparency first.** Background of the pad well shows through; avoid opaque colored squares.
3. **Chrome + glass rim light** sells physicality more than flat gradients.
4. **Instrument silhouette** must read at ~72–96 CSS px on phones.

---

## 2. Overhead / drummer-POV kit photography

Reference search terms used (not copied into the app):
- “overhead drum kit photography clear heads”
- “drummer POV acrylic kit”
- “cymbal lathing grooves from above”
- “snare wires through clear resonant head”

Typical cues:
- **Snare:** circular head, 8–10 lugs, strainer lever hint at 6-o’clock, snare wires as faint parallel lines under the clear head.
- **Toms:** fewer lugs at small sizes, deeper shell shading for floor tom vs rack tom.
- **Kick:** often shown as front resonant with a port; batter-from-above is rarer on phones — we use a hybrid: circular head + port disc for instant “kick” recognition.
- **Cymbals:** concentric lathing grooves, raised bell, cup nut; closed hats = stacked pair with slim gap; open hats = larger gap / two rings; ride = larger bell; crash = thinner profile, wider bow.
- **Cowbell:** trapezoid / truncated pyramid from above.
- **Tambourine:** ring + jingle discs; **shaker:** capsule / egg with fill granules.

---

## 3. Modern MPC / drum-machine UI language (2025–26)

| Product | Pad language | What Sanctum can steal (legally: ideas, not assets) |
|---|---|---|
| **Akai MPC Live III / MPC 3** | Classic 4×4 rubber pads; new MPCe multi-axis expression (velocity, pressure, X/Y, quadrants). Colour feedback still zone-based. | Keep 4×4 MPC order; velocity-scaled hit feedback; optional future quadrant articulations — skin stays visual-only. Sources: [MusicRadar](https://www.musicradar.com/music-tech/akai-mpc-live-3-review), [CDM](https://cdm.link/akai-mpc-live-iii-preview/) |
| **NI Maschine** | Soft rubber pads, strong colour coding per group, LCD + pads as one instrument. | Group/row colour as rim light (already in hardware skin `--z0…z3`). |
| **Ableton Push 3 / Note** | Expressive MPE pads, white grid, Live colour language, raised button ridges for a11y. | Focus rings + tactile “proud” travel; colour = state not decoration. Source: [SOS Push 3](https://www.soundonsound.com/reviews/ableton-push-3) |
| **Roland TR-8S / TR-1000 editor** | Per-instrument colour bands, hardware→software consistency, subtle gradients not flat Material. | Instrument identity > generic pad tile. Source: [Plugmon TR-1000](https://plugmon.jp/2025/10/designing-the-tr-1000-editor/) |
| **Teenage Engineering** | Radical silhouette recognition, sparse chrome/plastic, playful but precise. | Make each pad a *thing*, not a labelled square. |

Cross-cutting UX patterns (dadamachines TBD analysis of TR-808, MPC 3000, Push 3, Digitakt II): WYSIWYG physical state, minimal ornament that still invites touch.  
Source: https://dadamachines.github.io/ctag-tbd/ux-hardware-patterns.html

---

## 4. Hit feedback physics (visual)

| Instrument class | Hit motion (GPU: transform/opacity only) |
|---|---|
| Heads (kick/snare/tom/808) | Radial ripple from touch point + slight head “flex” scale (0.97→1) |
| Cymbals | Shimmer: rotate ±1.5° + opacity pulse on lathing layer |
| Cowbell / metal | Fast rim-light flash, short travel |
| Shaker / tamb | Jiggle translate ±2px + bead opacity flicker |
| Clap / snap | Dual-flash (two palms) |
| FX / loops / organ | Soft bloom + ring; keep readable silhouette |

Velocity maps: opacity of rim light/flash ≈ `0.25 + 0.75*(vel/127)`; ripple max scale and duration also scale with velocity. Respect `prefers-reduced-motion` / Settings → Reduce motion (flash only).

---

## 5. Three style directions (see `frames/`)

| Direction | Mood | Key traits | Concept file |
|---|---|---|---|
| **A · Stage Glass** | Dark stage, clear glass, rim-lit | Transparent heads, chrome, subtle neon edge from theme zones, black well | `frames/concept-stage-glass.png` |
| **B · Smoked Acrylic** | Tinted plexi + neon edge-glow | Smoked film, stronger cyan/magenta/lime rim, cyber stage | `frames/concept-smoked-acrylic.png` |
| **C · Studio Daylight** | Bright realistic studio | Softbox reflections, natural brass/chrome, white chassis harmony | `frames/concept-studio-daylight.png` |

**Recommendation: Stage Glass (A)** as the default Acrylic Kit look, with theme tokens that shift toward smoked (neon/dark) or daylight (light/minimal) and high-contrast outlines for `contrast`. Reasons:
1. Matches Sanctum’s existing dark/neon flagship brand (Tiberious stage energy).
2. Clear-head transparency differentiates from the Hardware rubber-cap skin without fighting Warm MPC60 or Light themes.
3. Instrument silhouettes read better on dark wells than on bright studio tiles at phone sizes.
4. Rim-light velocity feedback is free “stage LED” storytelling for church/shout performance contexts.

Smoked Acrylic becomes the **neon/dark theme accent** (CSS tokens), Studio Daylight the **light/minimal accent** — one skin, three lighting modes — rather than three separate skins.

---

## 6. Accessibility & performance constraints (from current Sanctum)

- Keep ARIA names (`Pad N, Sound, bank X`), keyboard/TalkBack activation, focus rings.
- Labels optional/small for a11y — silhouette is primary; high-contrast theme enlarges labels.
- Animations: **transform + opacity only**; static SVG gradients/filters; no per-frame CSS `filter` or layout thrash.
- Budget: ≤16 SVG nodes average per pad; one shared symbol sheet; 60 fps on mid phones with 16 simultaneous ripples worst-case.

---

## 7. Open brand decisions for Lawrence
1. Default skin: Acrylic Kit vs keep Hardware as default?
2. How loud should neon edge-glow be in church/sanctuary daylight?
3. Should church-bank pads use pipe-organ / guitar / choir motifs or stay “kit-only”?
4. Label visibility: always faint, on-select only, or Settings toggle?
