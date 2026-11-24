# Sanctum chord-maps

> **v0.3.4:** Follow Me loads [`lawrence/progressions.json`](lawrence/progressions.json), a shout reference transcription from a live stream, not Lawrence's own playing (served as `content/chord-maps/follow-me-shout-reference.json`). The Beat Theory files below are kept for rollback but are **unused** by Follow Me charts. See [`lawrence/ANALYSIS.md`](lawrence/ANALYSIS.md).

## Beat Theory (legacy)

Three JSON formats live side by side:

| File | Consumer | What it is |
|---|---|---|
| [`pulpit-12key-charts.json`](pulpit-12key-charts.json) | Follow Me (Preacher Assist) / Easy Play | 12-key charts for every library progression and shout vamp, hook chords, bass walks, organ-run cues, and Shout/Worship 1–4 intensity wiring. Official name is Follow Me, not PULPIT / Whoop Triggerz. |
| [`shout-iv-v-bvii.json`](shout-iv-v-bvii.json) | Trigger engine / sequencer | Full engine-facing shout library: 8×16 MIDI pad map, 12 keys, voicings, I7–IV7–V7–bVII7 in every key, bass walks, organ runs, 8 ever-changing patterns, anti-repetition, intensity 1–5. |
| [`../content/theory/beat-theory-maps.json`](../content/theory/beat-theory-maps.json) | `src/chords/theory-ext.ts` `loadBeatTheoryMaps()` | Drop-in `BeatTheoryMaps` shape: `version`, `source`, `diatonic`, `subs`, `progressions`, `markov`. Jazz defaults (ii–V–I, etc.) plus the shout progressions and Follow Me library ids (`whoop-14`, shout vamps, …). Markov leans on I / IV / V / bVII / V7. |

Schema stub for the drop-in: [`../content/theory/beat-theory-maps.schema.json`](../content/theory/beat-theory-maps.schema.json). This richer engine file is documented by example in `shout-iv-v-bvii.json` itself (`midiPadMap`, `patterns`, `bassWalks`, …).


Follow Me (Preacher Assist) writeup: [`PULPIT_NAMING.md`](PULPIT_NAMING.md), chart summary [`PULPIT_CHARTS.md`](PULPIT_CHARTS.md), Sanctum Build handoff [`HANDOFF_SANCTUM_BUILD.md`](HANDOFF_SANCTUM_BUILD.md), preview [`PREVIEW_PULPIT.txt`](PREVIEW_PULPIT.txt).

Service-moment writeup: [`SERVICE_MOMENTS.md`](SERVICE_MOMENTS.md).

Regenerate the JSON (after editing `_gen/`):

```bash
python3 chord-maps/_generate.py
python3 chord-maps/_generate_pulpit.py
python3 chord-maps/validate.py
```

`validate.py` asserts 12 keys, 8 shout patterns, MIDI 36–51 coverage on every pattern, Ab theory (I7=Ab7, IV7=Db7, V7=Eb7, bVII7=Gb7, relative Fm, walk-into-V = C Db D Eb), Follow Me charts (`pulpit-12key-charts.json`: official name Follow Me / Preacher Assist, 15 progressions, Ab I9=Ab9 / IV9=Db9), and that `beat-theory-maps.json` has `version` / `progressions` / `subs` / `markov` plus the Follow Me ids. It writes [`PREVIEW.txt`](PREVIEW.txt) (Ab `shout-full-break`). [`PREVIEW_PULPIT.txt`](PREVIEW_PULPIT.txt) is written by `_generate_pulpit.py`.

Theory math matches `src/pulpit/theory.ts` (KEY_NAMES, gospel flats, `voice()`, `bassNote()`). No runtime TypeScript was changed. No audio is generated or copied.
