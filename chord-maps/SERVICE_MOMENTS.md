# Shout patterns × service moments

Eight ever-changing I7–IV7–V7–bVII7 loops for Sanctum’s trigger engine. Theory and MIDI only — no audio, no quoted songs.

Default keys lean gospel (Ab, Bb). Church sample loops still live in G / C / D / A at 132 / 120 / 140 / 150 BPM (`keyTempoMap`).

## Which pattern for which moment

| Moment | Patterns | What it does | Intensity |
|---|---|---|---|
| **Call-and-response** | `shout-call-response` | I7 call, IV7 answer, two bars each. Organ stabs on the upbeats (`talk-stab`). Light clap, not a full backbeat. | 2 |
| **Build** | `shout-build` | I7–IV7–V7–bVII7, one chord per bar, then two per bar in the last four. Chromatic walk **3–4–#4–5** into every V. | 3 |
| **Build / turnaround** | `shout-walk-home` | I7 – I7/3 – IV7 – #iv°7 – I/5 – V7 – I7. In Ab: Ab7 – Ab7/C – Db7 – Ddim7 – Ab/Eb – Eb7 – Ab7. Walks chromatically into the shout. | 3 |
| **Shout** | `shout-full-break` | Full vamp at 132–150. Dense 8ths + ghost bass. Organ run every four bars. The peak praise-break loop. | 5 |
| **Shout / praise** | `shout-storefront` | I7–bVII7–IV7–I7. Second / backbeat snare (Bank E pad 3) in front; handclaps on the upbeats (E pad 4). Default key **Bb**. | 4 |
| **Shout peak** | `shout-modulate-up` | Same vamp, truck-driver half-step up every 8 bars: Ab → A → Bb → B → C → Db → D → Eb → E → F → F# → G → Ab. | 5 |
| **Breakdown** | `shout-breakdown` | I7 pedal, sparse IV7. Hats only, then the snare returns. | 1 |
| **Breakdown → rebuild** | `shout-relative-flip` | 4 bars major I7–IV7–V7–bVII7 (Ab7 Db7 Eb7 Gb7), 4 bars relative minor i7–iv7–bVI7–bVII7 (Fm7 Bbm7 Db7 Eb7). Flip back to major to rebuild. | 2 |

Typical Sunday flow: call-response (or walk-home) → build → full-break → storefront if the room is bouncing → modulate-up at the peak → breakdown or relative-flip → rebuild into the vamp.

## Suggested bank / pad layout (A–H)

MIDI in the current bank: **36 = pad 1** (bottom left) … **51 = pad 16** (top right). `globalPad = bankIndex * 16 + padIndex`.

| Bank | Role | Suggested soundbank | Pads (short) |
|---|---|---|---|
| **A** | Pattern launch | *(engine)* | 1–8 = the eight patterns; 9–10 intensity; 11 +½ step; 12 relative flip; 13 organ talk; 14 cycle variation |
| **B** | Guitar | `shout-guitar` | Existing G/C/D/A scratches, passing chords, licks, stabs |
| **C** | Organ chords | `shout-organ` | 1–4 I7 IV7 V7 bVII7 (session key); 5–8 9 / 7#9 / 13; 14 talk-stab; 15 #iv°7; 16 I/5 |
| **D** | Bass | `shout-bass` | 1–5 theory walks (pedal, octaves, into-4, into-5, ghosts); 9–16 shipped G/C/D/A samples |
| **E** | Perc / storefront | `shout-percussion` + kick/snare TBD | 1 kick, 2 snare, 3 second snare, 4 upbeat clap, 5–6 hats, 7–8 tamb/shaker, 15 hats-only, 16 snare return |
| **F** | Harmonic tokens | *(engine MIDI)* | Live I7 IV7 V7 bVII7, relative-minor set, I7/3, I/5, #iv°7, bII7 (tritone of V) |
| **G** | Organ runs | `shout-organ` | 1 mixo-down, 2 blues-fill, 3 gliss-up, 4 talk-stab, plus G/C/D/A loops |
| **H** | FX | `stage-fx-modern` | Impacts, risers, choir, tape stop |

Shipped content is **9** soundbanks (4 shout + 5 modern) into **8** pad banks — see open questions.

## How anti-repetition works

Each pattern carries `variationRules` (voicing, bassWalk, organRun, substitute, transpose) with weights. The engine, on every re-trigger or new 4-bar window:

1. Picks a voicing (close 7, 9, 13, 7#9, organ-open, shell…) and a bass walk.
2. Fires an organ run every 4 or 8 bars.
3. Rejects any choice that would reprint the last bar’s `(token, voicing, bassWalk, organRun)` tuple (`noIdenticalBarWithin: 4`).
4. May modulate mid-loop without breaking the groove: `relativeMinor`, `upHalf`, `upWhole`, `circleFifth`.

Resolved previews show two variations of one 8-bar cycle so this is visible in the data (for `shout-full-break` in Ab, bars 1–4 are close organ 7 + octave-pops + mixo-down; bars 5–8 are 9/13/7#9 + ghosts + blues-fill).

Walks are **key-relative**. `chrom-to-5` is degrees **3–4–#4–5** and *lands on* the 5. In Ab that is C Db D Eb (MIDI 36 37 38 39), not Ab Bb B C (that 1–2–#2–3 figure is the pickup into IV / into I7/3).

## Open questions for Lawrence

1. **Soundbanks on A–H.** Nine shipped banks (shout guitar / organ / bass / perc + trap, drill, amapiano, neo-soul, stage-fx) and only eight pad banks. This file suggests B/C/D/E/H as guitar, organ, bass, perc, FX, with A/F/G as engine launchers, tokens, and runs. Which modern banks stay on the grid?
2. **Kick and snare.** `shout-percussion` is tamb / shaker / claps — no kick or snare. Bank E pads 1–3 assume a kit source (Foundation, or a future shout kit). Where should those come from?
3. **Organ and bass: MIDI or samples?** Theory pads work in all 12 keys. Shipped organ/bass samples are G/C/D/A only. Render live MIDI in the session key, or keep sample pads and transpose/time-stretch?
4. **Default keys.** Library and this map prefer Ab and Bb. Sample loops are G, C, D, A. What keys do the musicians actually start in?
5. **BPM for Ab / Bb / Eb / F.** `keyTempoMap` only lists G=132, C=120, D=140, A=150. What are the house tempos for the other gospel keys?
6. **Intensity detents.** Whoop-style shout is 4 levels; this map uses 1–5 so breakdown has its own floor. Map 1–5 onto the existing 0–4 shout/worship control, or add a fifth detent?
7. **Which services / song-shapes to model next** (still patterns only — no copyrighted audio): more whoop holds, 12/8 tune-up, minor shout, 1–6–2–5 fast shout already sketched in `src/pulpit/library.ts`.

Engine-facing file: `chord-maps/shout-iv-v-bvii.json`.  
Chords / Pulpit drop-in: `content/theory/beat-theory-maps.json`.
