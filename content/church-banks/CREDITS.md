# Credits: Church Banks

**Non-synthesized (third-party) sounds: none.**

All 64 sounds in this folder were synthesized from scratch for Sanctum (Lawrence Davis Sr) with `_build/synth.py`.
They contain no Freesound, Pixabay, Splice, Loopmasters or other commercial or third-party audio, and need no attribution.

Sourcing notes (2026-10-31): the Freesound API returned HTTP 401 without an API key, and original-quality downloads need an account.
Per the brief, no account was created. Pixabay audio was excluded on licensing grounds.
If CC0/CC-BY Freesound sounds are added later, list each one here as: name, author, URL, license (CC0 / CC-BY 4.0), and the attribution text.
Also set the pad's `source`, `author`, `license` and `attribution` fields in `manifest.json`.

## Modern banks (v0.3.1, 2026-11-05)
**Synthesized by Tiberious Productions / Sanctum.** 80 sounds in 5 banks (`wav/modern/`, `ogg/modern/`), made with
`_build/synth_modern.py` (numpy + scipy, 48 kHz). The banks are Trap Sanctuary, Drill Pulpit, Amapiano Praise, Neo-Soul Sunday and Stage FX Modern.
- Third-party / CC0 audio: **none**. Recorded voices: **none** (the choir pads are formant synthesis).
- Nothing was downloaded or ripped from YouTube or any other site. `docs/modern-sound-research.md` lists the
  articles used as functional/sonic reference only (techniques, tempos, synthesis recipes).
- Each pad in `manifest.json` has `author: "Tiberious Productions / Sanctum (original synthesis)"`, `source: "synthesized"`, `attribution: ""`.
- Rebuild: `python3 _build/synth_modern.py && python3 _build/make_manifest.py`. The demo is `python3 _build/demo_modern.py`, which writes `release/Sanctum-modern-banks-demo.mp3`.
