# Follow Me naming (Preacher Assist)

**Official product feature name:** Follow Me  
**Subtitle / alternate:** Preacher Assist  
**Preaching feel (user-facing):** Preaching hold  
**Tap-next-chord control:** Easy Play  
**Voice auto-follow:** Follow Voice  
**Intensity lanes:** Shout 1–4 and Worship 1–4 (0 = off in the player)

## What this feature does

Follow Me (Preacher Assist) is the preacher-band accompaniment engine inside Sanctum. The musician
holds chords under a preacher or singer, taps Easy Play to move to the next change, swells Shout or
Worship intensity, and optionally lets Follow Voice ride the room. The 12-key charts in
`pulpit-12key-charts.json` give the trigger engine ready MIDI so it does not have to call theory live
on every tap.

## How the maps wire in

- Easy Play advances `progression.steps` (or the autosaved pads sequence).
- `setKey()` re-resolves the same Roman / Nashville tokens through `chordIn` in `src/pulpit/theory.ts`.
  This JSON already stores `charts[key]` with `symbol`, `notesMidi` (`voice` low=48), and `bassMidi`
  (`bassNote` low=28).
- `shoutLevel` / `worshipLevel` scale `renderChord` and `drumBar` by `level/4`. They are exclusive:
  turning one on zeros the other.
- Follow Voice may nudge shout or worship. It is not a separate “hook” product.
- Bass walks and organ-run cues in the JSON tell the sequencer when to thicken the line as intensity climbs.

## Code vs. UI (until Sanctum Build renames it)

- Module path remains `src/pulpit/` (`library.ts`, `player.ts`, `ui.ts`, `theory.ts`).
- The current overlay title / aria-label is still **PULPIT**. Sanctum Build should change user-facing
  chrome to **Follow Me** with subtitle **Preacher Assist**.
- Internal feel id `whoop` in `library.ts` may stay; never show “whoop” or “Whoop” as a product label.
  The shipped feel name is **Preaching hold**.
- Do not brand new UI copy as “Sanctum Pulpit”. That was an internal/module name, not the locked
  customer-facing name.

## Intellectual property

Whoop Triggerz (and related marks) are trademarks of Carlton Whitfield. They are a **functional
reference only** in research notes. Never copy the name, branding, or audio into Sanctum UI, docs
shipped with the app, soundbanks, or marketing.

**Do not use in UI:** Whoop Triggerz, Whoop Trigger, Whoop Triggerz Plus.

**Discouraged:** “Hook Trigger” is not an official Sanctum name. Prefer Easy Play + Shout/Worship
levels.

## Recommendation for Lawrence

Ship the feature as **Follow Me**, with **Preacher Assist** as the subtitle on the panel and in the
manual. Keep Easy Play, Follow Voice, Preaching hold, Shout 1–4, and Worship 1–4 as the control
names. Leave `src/pulpit/` and the `whoop` feel id alone unless a later refactor is worth the diff.
Ask Sanctum Build to rename the current PULPIT chrome only.

These charts assume no custom chord list was attached, so the vocabulary is the existing Follow Me
library progressions plus the shout I7–IV7–V7–bVII7 root map.
