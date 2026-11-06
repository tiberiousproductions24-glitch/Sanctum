# Handoff — Sanctum Build: load Follow Me 12-key charts

This note is for the **Sanctum Build** bot (or whoever next touches the app). Beat Theory produced
data files only — no runtime TypeScript was changed.

## Feature naming (locked)

| Role | Name |
|---|---|
| Official / primary (UI, manual, marketing) | **Follow Me** |
| Subtitle / alternate | **Preacher Assist** |
| Preaching feel | **Preaching hold** |
| Tap-next-chord | **Easy Play** |
| Voice auto-follow | **Follow Voice** |
| Intensity | **Shout 1–4** and **Worship 1–4** |

Please rename user-facing chrome that currently says **PULPIT** / “Sanctum Pulpit”
(`src/pulpit/ui.ts` title `"PULPIT"`, overlay `aria-label`) to **Follow Me** with subtitle
**Preacher Assist**. The code module may stay `src/pulpit/`. Internal feel id `whoop` in
`library.ts` may stay; do not surface it.

**Never** ship “Whoop Triggerz”, “Whoop Trigger”, or “Whoop Triggerz Plus” as a product label
(trademarks of Carlton Whitfield; functional reference only). “Hook Trigger” is not official —
use Easy Play + Shout/Worship levels.

## Files to load

| Path | What to do |
|---|---|
| `projects/sanctum/chord-maps/pulpit-12key-charts.json` | Primary 12-key library for Follow Me. |
| `projects/sanctum/chord-maps/shout-iv-v-bvii.json` | Existing shout I7–IV7–V7–bVII7 patterns, 8×16 pad map, walks, organ runs. |
| `projects/sanctum/content/theory/beat-theory-maps.json` | Drop-in for `loadBeatTheoryMaps()`. Now includes Follow Me progression ids as well as the shout set. |
| `projects/sanctum/chord-maps/PULPIT_NAMING.md` | Naming + IP rules. |
| `projects/sanctum/chord-maps/PULPIT_CHARTS.md` | Readable chart summary. |
| `projects/sanctum/chord-maps/PREVIEW_PULPIT.txt` | Ab sanity preview. |

Progressions in the JSON (15): `whoop-14`, `whoop-145`, `two-five-one`, `one-six-two-five`, `passing-walk`, `minor-whoop`, `minor-walk`, `band-hits`, `tune-up`, `altar-call`, `shout-14`, `shout-1415`, `shout-minor`, `shout-fast-1625`, `i-iv-v-bvii`.

## Wiring

1. Easy Play already advances `progression.steps` and calls `chordIn(step.c, key)`. You can keep
   that, or look up `progressions[id].charts[keyName][stepIndex]` (`symbol`, `notesMidi`, `bassMidi`,
   `intensityCue`) to skip live theory.
2. `setKey()` should keep using the same tokens. Minor items (`minor-whoop`, `minor-walk`,
   `shout-minor`) are keyed by parallel-minor names (`Fm`, `Cm`, `Dbm`, …) matching `keyName()` in
   `theory.ts`.
3. Scale intensity by `shoutLevel/4` and `worshipLevel/4` as `PulpitPlayer` already does
   (`renderChord`, `drumBar`). Use `intensityWiring` in the JSON for harmonic substance at each detent
   (chord density, bass, drums, organ, harmonic rhythm). Do not invent a fifth shout detent.
4. Hook / single-tap vocabulary: `hookChords.byKey[key]`.
5. Bass walks: `bassWalks.walks[].exampleMidi[key]` (chrom-to-5, chrom-to-4, octave-pops, ghost-shout).
6. Organ runs: `organRunCues` with `minLevel` (talk-stab ≥ 2, mixo-down/gliss-up ≥ 3, blues-fill ≥ 4).
7. Shout sets include `ending` / `endingCharts` / `calls` / `beatsPerChord` / `bpm` from `library.ts`.

Schema reminders: `voice` register low=48, `bassNote` low=28, KEY_NAMES =
C Db D Eb E F F# G Ab A Bb B, gospel flats. Ab check: I9=Ab9, IV9=Db9, I7=Ab7, IV7=Db7, V7=Eb7,
bVII7=Gb7, relative minor Fm.

## Open questions still pending from Lawrence

These were flagged earlier and are still not decided in the repo:

1. Which soundbanks sit on banks A–H (9 shipped soundbanks, 8 pad banks).
2. Kick/snare source for Bank E (current shout-perc sketch is tamb/clap-forward).
3. Organ/bass as live MIDI in all 12 keys vs sampled G/C/D/A stems.
4. House keys and BPM defaults for Ab / Bb / Eb / F services.
5. Intensity 1–5 overlay vs the existing 0–4 shout/worship controls — **recommendation:** stay on
   Shout 1–4 and Worship 1–4 to match `PulpitPlayer`. The older `shout-iv-v-bvii.json` 1–5 map is a
   design overlay only.

No audio and no copyrighted songs were added. Hymn arrangements already in `library.ts` SONGS were
not expanded here.
