# Acrylic Kit Pad Skin — Component Spec

**Status:** Implemented as selectable Pad skin (`acrylic` | `hardware`)  
**Recommended default candidate:** Acrylic Kit (Stage Glass lighting)  
**Brand:** Tiberious Productions · Sanctum

---

## 1. Pad anatomy (layers, back → front)

| z | Layer | Element | Notes |
|---|---|---|---|
| 0 | Well | `.pad` | Recessed chassis pocket; theme `--ak-well` |
| 0 | Glow | `.glow` | Velocity rim bloom (opacity/scale only) |
| 1 | Cap / glass | `.cap` | Clear acrylic face; press travel via `translateY` |
| 1 | Instrument | `.kit > svg.kit-art` | Original SVG silhouette |
| 1 | Flash | `.flash` | Velocity radial flash (screen/multiply) |
| 2 | Labels | `.num` `.name` `.tag` | Small; optional for a11y; high-contrast enlarges |
| 3 | Ring | `.ring` | Expand on hit |
| 3 | Ripple | `.ripple` | From touch point |

Hardware skin LED strip (`.led`) is hidden in acrylic.

---

## 2. Per-instrument visuals

| Instrument | Key cues | Motion class |
|---|---|---|
| kick | Clear head, port, badge, 8 lugs | head flex |
| snare | Wires under film, strainer, 10 lugs | head flex |
| tom | Depth shell, 6 lugs (size via same art) | head flex |
| rim | Hoop + stick tip | head flex |
| hat-closed | Stacked pair, slim gap, bell | cymbal shimmer |
| hat-open | Separated pair | cymbal shimmer |
| crash | Wide bow, small bell, dense lathing | cymbal shimmer |
| ride | Large bell | cymbal shimmer |
| cowbell | Trapezoid body + mount | metal pop |
| clap | Dual palms | soft bloom |
| tambourine | Ring + jingles + head | shake |
| shaker | Capsule + beads | shake |
| bass808 | Speaker cone + “808” | head flex |
| fx | Orb + bolt | soft |
| loop | Cycle arrows + frets | soft |
| organ | Keys + pipes | soft |
| choir | Three voices + waves | soft |
| empty | Dashed ring | none |

Mapping: `src/ui/skins/kit/mapping.ts` (synth `gen`, then name heuristics, loops → loop/organ/choir/guitar).

---

## 3. Sizing / aspect (phone & tablet)

- Pads remain square inside the existing `--grid` layout (phone portrait thumb zone, phone landscape Studio, tablet Studio / Pad wall).
- Kit art inset: `10% 8% 18% 8%` (extra bottom for label); phones ≤420px use slightly tighter inset.
- Cap radius 13px inside 16px well; travel `--travel: 3px`.
- Do not change pad hit targets or Pointer Events behaviour.

---

## 4. Color tokens per theme

CSS vars on `[data-pad-skin="acrylic"]` (see `src/skins/acrylic.css`):

| Token | Stage Glass (dark/neon) | Studio Daylight (light/minimal) | Warm | Contrast |
|---|---|---|---|---|
| `--ak-well` | near-black | warm grey | putty dark | `#000` |
| `--ak-film` | cool translucent | white film | amber film | `#111` + white stroke |
| `--ak-chrome` | silver | graphite | warm silver | `#FFF` |
| `--ak-brass` | stage brass | stage brass | MPC orange-brass | `#FFD400` |
| `--ak-rim` | row `--zc` | row `--zc` | orange | zone / gold |

Neon theme boosts inset rim glow; contrast forces 3–4px borders and full-opacity labels.

---

## 5. Motion specs

| Effect | Duration | Easing | Velocity mapping |
|---|---|---|---|
| Cap press | 0 ms down / ~45 ms up | cubic-bezier(.2,.8,.3,1) | — |
| Flash opacity | 120–240 ms | cubic-bezier(.2,.7,.3,1) | `a = 0.25+0.75k` |
| Glow | 220–480 ms | cubic-bezier(.15,.7,.3,1) | opacity + scale `1+0.06k` |
| Ring | 200 ms | ease-out | scale `1.04+0.12k` |
| Ripple | 300–520 ms | cubic-bezier(.1,.6,.3,1) | radius × `(0.6+0.4k)` |
| Head flex | 160–240 ms | cubic-bezier(.2,.8,.3,1) | scale down `0.965–0.02k` |
| Cymbal shimmer | 280–440 ms | cubic-bezier(.15,.7,.3,1) | ±(1.2+1.4k)° |
| Shake | 180–240 ms | ease-out | ±(2+2k) px |

`k = vel/127`. Reduce motion: flash (+ glow short) only; no ring/ripple/kit motion.

---

## 6. Accessibility

- ARIA: unchanged (`Pad N, name, bank…`).
- Focus-visible: gold (or cyan in contrast) 3px outline.
- Labels remain in DOM; acrylic makes them smaller but present; contrast theme enlarges.
- Instrument SVG `aria-hidden="true"`.
- Haptics untouched (engine/settings).

---

## 7. Performance budget

- Paint: static SVG + CSS variables; **no** animated `box-shadow` / `filter`.
- Runtime hit: Web Animations on opacity/transform only (existing flash path + optional `.kit` WAAPI).
- DOM: one `.kit` span + ≤1 SVG per pad (≤16); SVG node count ~15–40 per instrument.
- Target: 60 fps on mid-range phones with multi-touch.

---

## 8. Asset formats

- **SVG** inline from TypeScript (`instruments.ts`) — original art, crisp at any DPI, themeable via CSS.
- No PNG/WebP instrument rasters in the app (concept frames live only under `design/pad-skin/frames/` for review).
- Skin CSS: `src/skins/acrylic.css`, gated by `data-pad-skin`.

---

## 9. Settings & persistence

- `Project.settings.padSkin`: `'acrylic' | 'hardware'` (default `'acrylic'` for new projects; existing saves without the key fall back via load merge — see state.ts).
- Mirrored to `localStorage['sanctum.padSkin']` and `document.documentElement.dataset.padSkin` for pre-paint.
- UI: Settings → **Pad skin** segmented control.
