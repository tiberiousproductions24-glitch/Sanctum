# Follow Me — 12-key chart summary

**Feature:** Follow Me  
**Subtitle:** Preacher Assist  
**Preaching feel:** Preaching hold  
**Tap-next-chord:** Easy Play  
**Voice auto-follow:** Follow Voice  
**Intensity:** Shout 1–4 and Worship 1–4

Full MIDI for every key lives in [`pulpit-12key-charts.json`](pulpit-12key-charts.json).
The in-app module is still `src/pulpit/` and the current UI title is PULPIT until Sanctum Build
renames it to Follow Me / Preacher Assist. Do not ship Whoop Triggerz branding.

## Relative major / minor pairs

| Major | Relative minor | Conventional sharp-side name |
|---|---|---|
| C | Am | — |
| Db | Bbm | — |
| D | Bm | — |
| Eb | Cm | — |
| E | Dbm | C#m |
| F | Dm | — |
| F# | Ebm | D#m |
| G | Em | — |
| Ab | Fm | — |
| A | F#m | — |
| Bb | Gm | — |
| B | Abm | G#m |

Every third stop around the circle of fifths is still just “a major and its relative minor”
(C/Am, G/Em, D/Bm, …). Gospel key spelling uses flats everywhere except F#.

## Progressions

| ID | Name | Moment | Feel | Tokens | Example (default key) |
|---|---|---|---|---|---|
| `whoop-14` | Preaching 1–4 | preaching | Preaching hold | `I9 IV9 I9 IV9` | Ab: I9=Ab9 – IV9=Db9 – I9=Ab9 – IV9=Db9 |
| `whoop-145` | Preaching 1–4–1–5 | preaching | Preaching hold | `I IV9 I V7sus V7` | Ab: I=Ab – IV9=Db9 – I=Ab – V7sus=Eb7sus4 – V7=Eb7 |
| `two-five-one` | 2–5–1 resolve | preaching | Preaching hold | `ii9 V13 Imaj9 I7` | Eb: ii9=Fm9 – V13=Bb13 – Imaj9=Ebmaj9 – I7=Eb7 |
| `one-six-two-five` | 1–6–2–5 turnaround | preaching | Preaching hold | `1(9) 6(7#9) 2m9 5(13)` | Bb: 1(9)=Bb9 – 6(7#9)=G7#9 – 2m9=Cm9 – 5(13)=F13 |
| `passing-walk` | Passing walk 1–4–#4°–1/5 | preaching | Preaching hold | `I9 IV13 #ivdim7 I/5 VI7#9 ii9 V13` | G: I9=G9 – IV13=C13 – #ivdim7=C#dim7 – I/5=G/D – VI7#9=E7#9 – ii9=Am9 – V13=D13 |
| `minor-whoop` | Minor preaching i–iv | preaching | Preaching hold | `i9 iv9 i9 V7#9` | Fm: i9=Fm9 – iv9=Bbm9 – i9=Fm9 – V7#9=C7#9 |
| `minor-walk` | Minor 1–6–5 | preaching | Preaching hold | `i9 bVImaj7 V7#9 i9` | Cm: i9=Cm9 – bVImaj7=Abmaj7 – V7#9=G7#9 – i9=Cm9 |
| `band-hits` | Band hits (stabs) | hits | Praise (medium) | `I IV I V7` | Ab: I=Ab – IV=Db – I=Ab – V7=Eb7 |
| `tune-up` | Tuning up | intro | Tuning up | `I IV/1 I V7sus V7` | Eb: I=Eb – IV/1=Ab/Eb – I=Eb – V7sus=Bb7sus4 – V7=Bb7 |
| `altar-call` | Altar call | worship | Worship / altar | `Imaj9 iii7 vi9 ii9 IVmaj7/5 V7sus` | Db: Imaj9=Dbmaj9 – iii7=Fm7 – vi9=Bbm9 – ii9=Ebm9 – IVmaj7/5=Gbmaj7/Ab – V7sus=Ab7sus4 |
| `shout-14` | Shout 1–4 vamp | shout | Shout | `I7 IV9` | Ab: I7=Ab7 – IV9=Db9 |
| `shout-1415` | Shout 1–4–1–5 | shout | Shout | `I7 IV9 I7 V7#9` | C: I7=C7 – IV9=F9 – I7=C7 – V7#9=G7#9 |
| `shout-minor` | Minor shout i–iv | shout | Shout | `i7 iv9` | Fm: i7=Fm7 – iv9=Bbm9 |
| `shout-fast-1625` | Fast shout 1–6–2–5 | shout | Fast shout | `I7 VI7#9 ii9 V13` | Bb: I7=Bb7 – VI7#9=G7#9 – ii9=Cm9 – V13=F13 |
| `i-iv-v-bvii` | Shout I7–IV7–V7–bVII7 | shout | Shout | `I7 IV7 V7 bVII7` | Ab: I7=Ab7 – IV7=Db7 – V7=Eb7 – bVII7=Gb7 |

Minor progressions (`minor-whoop`, `minor-walk`, `shout-minor`) chart all 12 parallel minored
KEY_NAMES (Cm, Dbm, Dm, … Bm). Major progressions chart C, Db, D, Eb, E, F, F#, G, Ab, A, Bb, B.

### Ab Preaching 1–4 (`whoop-14`)

| Token | Symbol | notesMidi | bassMidi | Cue |
|---|---|---|---|---|
| I9 | Ab9 | [56, 60, 63, 66, 70] (56=Ab3, 60=C4, 63=Eb4, 66=Gb4, 70=Bb4) | 32 (Ab1) | hold |
| IV9 | Db9 | [49, 53, 56, 59, 63] (49=Db3, 53=F3, 56=Ab3, 59=B3, 63=Eb4) | 37 (Db2) | hold |
| I9 | Ab9 | [56, 60, 63, 66, 70] (56=Ab3, 60=C4, 63=Eb4, 66=Gb4, 70=Bb4) | 32 (Ab1) | hold |
| IV9 | Db9 | [49, 53, 56, 59, 63] (49=Db3, 53=F3, 56=Ab3, 59=B3, 63=Eb4) | 37 (Db2) | hold |

### Ab shout root (`i-iv-v-bvii`)

| Token | Symbol | notesMidi | bassMidi | Cue |
|---|---|---|---|---|
| I7 | Ab7 | [56, 60, 63, 66] (56=Ab3, 60=C4, 63=Eb4, 66=Gb4) | 32 (Ab1) | vamp |
| IV7 | Db7 | [49, 53, 56, 59] (49=Db3, 53=F3, 56=Ab3, 59=B3) | 37 (Db2) | vamp |
| V7 | Eb7 | [51, 55, 58, 61] (51=Eb3, 55=G3, 58=Bb3, 61=Db4) | 39 (Eb2) | vamp |
| bVII7 | Gb7 | [54, 58, 61, 64] (54=Gb3, 58=Bb3, 61=Db4, 64=E4) | 30 (Gb1) | vamp |

## Intensity swell cues

PulpitPlayer stores `shoutLevel` and `worshipLevel` as 0 (off) plus 1–4. Setting one lane
clears the other. Audio intensity is `level/4`.

### Shout 1–4

| Level | Chord density | Bass | Drums | Organ | Harmonic rhythm |
|---|---|---|---|---|---|
| 1 Light shout / breakdown floor | triads/add9 | roots | light | pads | 1/bar |
| 2 Call and lift | dom7/9 | quarters + light walk into 4 | hats and clap | held stabs + talk-stab ok | 1/bar |
| 3 Build | dom7/9/13 | chromatic into 4 and 5 | snare in, 8ths | comments; mixo-down / gliss-up every 8 bars | 1–2/bar |
| 4 Full shout / storefront | dom7/9/13/#9 | 8ths+ghosts+chrom walks | full shout storefront | runs every 4 bars | 2/bar ok |

### Worship 1–4

| Level | Chord density | Bass | Drums | Organ | Harmonic rhythm |
|---|---|---|---|---|---|
| 1 Prayer pad | triads / sparse maj9 | roots, long tones | off or swell only | pads | 1/bar or longer |
| 2 Soft altar | add9 / maj9 | gentle roots and fifths | light kit, no shout snare | pads, almost no runs | 1/bar |
| 3 Congregational worship | 9ths and sus | walking quarters | praise kit, medium | light comments | 1/bar |
| 4 Full worship lift | 9/11/13, still not shout #9 density | motion without ghost-shout density | full worship band | comments, reserved runs | 1/bar (2/bar only at cadence) |

Organ-run minimum shout levels: talk-stab ≥ 2, mixo-down ≥ 3, gliss-up ≥ 3, blues-fill ≥ 4.

## How this feeds Easy Play

1. User picks a progression (or the pads sequence) and a key.
2. Easy Play advances `steps` and sounds `charts[key][stepIndex]` (or live `chordIn` if the engine prefers).
3. `setKey()` retargets the same Roman/Nashville tokens; MIDI in this file is the already-resolved form.
4. Shout/Worship 1–4 scale voicing density, bass motion, drums, and organ runs as in the tables above.
5. Follow Voice may nudge those levels; it does not replace Easy Play.

