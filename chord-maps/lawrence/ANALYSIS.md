# Follow Me (Preacher Assist): reference shout chord analysis, Phase 1

Status: **live Follow Me chart source from v0.3.4.** Lawrence chose to replace the Beat Theory charts with this set. It is served as `content/chord-maps/follow-me-shout-reference.json`. Two progressions carry `checkByEar: true` (`lw-walkup-low`, `lw-two-chromatic-low`) and are shown as "check by ear" in the UI. Created Nov 23, 2026.

## Source (read this first)
- File: `projects/sanctum-chord-src/shout-chords-1.mp4`. It runs 138.9 s, is 540×1204 portrait, and has 44.1 kHz audio.
- It is a **phone screen recording of a Facebook Live**: the "Steven S Golden Jr." stream titled "Devin Watkins closing the Inspirational speake…".
- The organist is **likely Montrell James**, going by a stream comment. He's on a blonde Hammond B3. **This is reference playing from that stream, not Lawrence's own playing.** Label it as a reference transcription in the app.
- A preacher talks over the PA for the whole clip.
- **The stream audio drops out twice, with digital silence at 9.5–14.0 s and 20.5–23.5 s.**
- The video frames were checked every 10 s. The hands and keys are too blocked to read, and no chord names appear on screen, so **this analysis is audio-only.**

## Method
1. **Audio prep.** I extracted the audio with ffmpeg. I then split it with Demucs (htdemucs, CPU) to remove the preacher's voice. Harmony was read from the `other` + `bass` stems, and the `vocals` stem was used only to spot frames where speech dominates.
2. **Method A, librosa 0.11.**
   - Chroma: CQT chroma at 36 bins per octave over C2–C7, plus bass chroma over C1–C4. The tuning offset is about 0 cents.
   - Chord matching: one chroma reading per beat, matched against 16 chord types × 12 roots (maj, m, 7, maj7, m7, 9, m9, 7#9, 7b9, dim7, m7b5, sus4, 7sus4, sus2, 6, aug). Viterbi smoothing then cleans up the sequence.
   - Bass line: pYIN pitch tracking on the bass stem.
   - Key: Krumhansl key profiles, run on the whole clip and on 10 s windows.
3. **Method B, Sanctum's own engine.** `src/chords/detect.ts analyseChords` (fft 4096, hop 2048, stay 0.75 and 0.4) ran under Node on the same de-vocalled audio and on the full mix.
   - It smooths very heavily, giving 8–9 segments for 139 s. So it confirms **key centres and tempo**, not bar-by-bar chords.
   - **Phase 2 finding:** the in-app offline detector cannot resolve one chord per bar on this kind of recording.
4. **Visual check.** See the Source section above: nothing on screen could be used to confirm chords.

Scripts are in `_analysis/`. They expect the working files in `/workspace/lawrence-work/` (audio.wav, inst.wav and the Demucs stems). The 12-key generator is `_generate_lawrence.mjs`, which uses the app's own `src/pulpit/theory.ts` (voice low=48, bassNote low=28).

## Key and tempo
| | Value | Confidence |
|---|---|---|
| Key 0–90.6 s | **Gb major**, played as a blues shout (both b3 and 3 are present) | medium-high. Both engines put the tonal centre on Gb/F#. Krumhansl leans **Gb minor** (0.80 vs 0.71 for major), but the chords themselves (Ebm7, Abm, Dbsus) point to major with a blue 3rd. |
| Key 90.6–139 s | **G major**: a **half-step lift**, Gb → G | high. Both engines agree, and the change lands at 90.2–90.7 s. |
| Tempo | **136 BPM** | high. Sanctum and librosa give the same value on the de-vocalled mix. The full mix tracks at 117.5 because the speech confuses it, so ignore that figure. |
| Harmonic rhythm | about 1 chord per bar (4 beats ≈ 1.76 s), with 1-beat passing chords | medium |

## Timeline summary
The full per-segment and per-beat data is in `timeline.json`: 72 segments, of which 28 high, 30 medium, 12 low and 2 dropout.

| Time (s) | Gb section: chord (Roman) |
|---|---|
| 0–6.4 | Gbsus4 (Isus) → Fmaj7 (VIImaj7, 1 beat) → Gb+ (I+) → Asus2 (bIIIsus2) |
| 6.4–24 | **unreliable**: two dropouts plus low-confidence frames |
| 24–30.5 | Gb → Gbm7b5 → Gbsus4 |
| 30.9–41.9 | **Ebm7 → Dbsus4 → Gbm → Gb** (vi7 → Vsus → i → I) |
| 41.9–48.3 | Ab7sus4 → C9 → A → Gbsus4 (low), with the bass walking down F Eb D Db |
| 48.3–57.4 | **Eb7 → Ebm → Dbsus4 → Gbm → Gb** |
| 57.4–69.4 | Bm9 → E7b9 → Cdim7 → Dmaj7 → Csus2 → Gbsus4 (low), with the bass walking up Db Eb E F |
| 69.4–76.0 | Gb7 → Fmaj7 (1 beat) → **Gb+ → Asus2** (the same lick as at 2 s) |
| 76.0–90.6 | Abm → Gmaj7 → (Dbm9?, low) → **Ebm7 → Dbsus4 → Gbmaj7 → Gbsus4 → Cdim7 → key up** |

| Time (s) | G section: chord (Roman) |
|---|---|
| 90.6–100.4 | **G → Csus2 → C#m7b5 → Dsus4** (I → IVsus2 → #ivø7 → Vsus) |
| 100.4–111.8 | G → C9 → A → G7sus4 → C#m → Dsus4 |
| 111.8–118.3 | G → Csus2 → C#m → Csus2 |
| 119.6–129.2 | G7#9 → C → A7 → Csus2 → Gmaj7 |
| 129.2–136.1 | **Csus2 → C#m7b5 → Dsus2/4** |
| 136.1–138.8 | Bm (the clip cuts off) |

## Progressions found
These are in `progressions.json`, with all 12 keys under `progressions[].charts[keyName]`. Numbers are relative to the key centre at that moment.

| id | Roman numerals | Original key | Times heard | Confidence |
|---|---|---|---|---|
| lw-shout-cadence | vi7 → Vsus → i → I | Ebm7 Dbsus4 Gbm Gb | 3 | **medium-high** |
| lw-shout-cadence-vi7 | VI7 → vi → Vsus → i → I | Eb7 Ebm Dbsus4 Gbm Gb | 1 | medium |
| lw-aug-lick | VIImaj7 (pickup) → I+ → bIIIsus2 | Fmaj7 Gb+ Asus2 | 2, identical | medium |
| lw-turnaround-lift | I+ → bIIIsus2 → ii → bIImaj7 → vi7 → Vsus → Imaj7 → Isus → #ivdim7 → bII (= new I) | Gb+ Asus2 Abm Gmaj7 Ebm7 Dbsus4 Gbmaj7 Gbsus4 Cdim7 → G | 1 | medium |
| lw-half-step-lift | Isus → #ivdim7 → bII (new I, key +1) | Gbsus4 Cdim7 G | 1 | medium-high (the key change is certain; the pivot chord lasts 1 beat) |
| lw-walkup-low | iv9 → bVII7b9 → #ivdim7 → bVImaj7 → #IVsus2 → Isus | Bm9 E7b9 Cdim7 Dmaj7 Csus2 Gbsus4 | 1 | **low** |
| lw-two-chromatic-low | II7sus → #IV9 → bIII → Isus | Ab7sus4 C9 A Gbsus4 | 1 | **low** |
| lw-lift-shout | I → IVsus2 → #ivø7 → Vsus | G Csus2 C#m7b5 Dsus4 | 3 | **medium-high** |
| lw-lift-shout-ext | IV9 → II → I7sus → #ivø7 → Vsus → I | C9 A G7sus4 C#m7b5 Dsus4 G | 1 | medium |
| lw-lift-tag | I7#9 → IV → II7 → IVsus2 → Imaj7 | G7#9 C A7 Csus2 Gmaj7 | 1 | medium |

**Bass lines.** Both are chromatic walks, medium-low confidence:
- **Walk down into V:** 7–6–b6–5 (F Eb D Db in Gb), around 42–48 s, and again around 78–81 s.
- **Walk up into I:** 5–6–b7–7–1 (Db Eb E F → Gb), around 59–62 s.

## Uncertain spots (do not treat as fact)
- **Major vs minor I.** The b3 and natural 3 both sound, which is typical shout/blues colour. I charted the minor-to-major bend (i → I) because that order fits best, but it is not certain.
- **The 6.4–24 s stretch.** Two stream dropouts plus weak frames. Both engines report "F" there, and that is an artefact of the silence.
- **"sus" chords.** The detector can't tell 5sus4 from 5(7sus4) or 5(9sus4); organ drawbar harmonics hide 7ths and 9ths. Vsus may really be V9sus.
- **sus2 tokens.** Csus2, Asus2 and similar are stored as same-pitch theory.ts tokens (`Isus/4`, `bVIIsus/b3`, `bIIsus/#4`) and shown as "sus2", because theory.ts has no sus2 quality. Phase 2 could add one.
- **#iv in the G section.** It was heard twice as a C#m triad and once as C#m7b5. It's charted as ø7 everywhere, which is a judgement call.
- **One-beat chords.** The Fmaj7 pickup, Cdim7 pivot, Eb7 and a dropped bIIImaj7 at 123 s each last about 1 beat (0.44 s), so their quality is a best guess.
- **Long Gb turnaround.** The Dbm9 at 78.6–81.3 s (c=0.19) was left out.
- **lw-walkup-low and lw-two-chromatic-low** need an ear check before shipping. Their chord labels and bass lines don't fully agree.
- **Overall:** this is a noisy phone capture of a livestream with a preacher over the top. Expect roughly 60–70% of bar-level chord labels to be right, and higher for roots and key centres. Have a player check by ear before anything replaces the Beat Theory set.

## Format notes for Phase 2
- **Schema.** It matches `pulpit-12key-charts.json`: `progressions[]` with `id, name, mode, feel, feelId, serviceMoment, tokens, defaultKey, kind, desc, tags, charts{key: [{token, symbol, root, bass, notesMidi, bassMidi, intensityCue}]}`. The extras are `bpm`, `beatsPerChord`, `analysis{confidence, heardAtSec, uncertain, bassWalk}` and `modulation`.
- **Key names.** These are C Db D Eb E F **Gb** G Ab A Bb B. `F#` is mirrored to the same data, because `normalizeKeyName()` maps Gb → F#.
- **Spelling.** Flat keys (C F Bb Eb Ab Db Gb) use flats, and sharp keys (G D A E B) use sharps. A degree written with b or # keeps that spelling, so it's F#dim7 in C and Bb in G.
- **Not a drop-in for `assertChartsShape()`.** That check expects exactly 15 progressions, including `whoop-14` and `i-iv-v-bvii`. Phase 2 has to change the check or merge the files.
