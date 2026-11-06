#!/usr/bin/env python3
"""Generate Sanctum Beat Theory shout chord-maps. Theory and patterns only — no audio."""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from _gen.theory import KEY_NAMES, VOICINGS, mod12, walk_midi  # noqa: E402
from _gen.pads import (  # noqa: E402
    build_keys, build_resolved_all_keys, build_bass_walks,
    build_organ_runs, build_midi_pad_map,
)
from _gen.patterns import build_patterns, build_service_moments, build_intensity_map  # noqa: E402

ROOT = HERE.parent
OUT_MAP = HERE / "shout-iv-v-bvii.json"
OUT_BT = ROOT / "content" / "theory" / "beat-theory-maps.json"


def build_shout_json() -> dict:
    walks, walk_convention = build_bass_walks()
    resolved = build_resolved_all_keys()
    return {
        "version": 1,
        "source": "beat-theory",
        "style": "gospel-shout",
        "created": "2026-11-05",
        "description": (
            "I7-IV7-V7-bVII7 shout library in all 12 keys, dominant-7 voicings, chromatic bass walks, "
            "organ-run variations, and 8 ever-changing loop patterns mapped to Sanctum's 8x16 pad grid "
            "(MIDI 36-51 per bank; globalPad = bankIndex*16 + padIndex). Theory and patterns only — no audio."
        ),
        "theoryNotes": {
            "keyNames": KEY_NAMES,
            "gospelFlatSpelling": True,
            "romanAccidentals": "Relative to the major scale of the tonic (same as src/pulpit/theory.ts).",
            "closeVoicingRegister": "theory.ts voice(ch, 48) — notes sit ~48-72",
            "bassRegister": "theory.ts bassNote(ch, 28) — notes sit 28-39; bassMidiOct is +12 when the line should stay high (e.g. Gb2=42 after Eb2=39)",
            "abCheck": {
                "I7": "Ab7", "IV7": "Db7", "V7": "Eb7", "bVII7": "Gb7",
                "relativeMinor": "Fm", "tritoneOfV7": "A7",
                "walkIntoV": {
                    "degrees": ["3", "4", "#4", "5"],
                    "names": ["C", "Db", "D", "Eb"],
                    "midi": walk_midi(8, ["3", "4", "#4", "5"]),
                },
            },
        },
        "keyTempoMap": {"G": 132, "C": 120, "D": 140, "A": 150},
        "midiPadMap": build_midi_pad_map(),
        "keys": build_keys(),
        "voicings": VOICINGS,
        "progressionRoot": {
            "id": "i-iv-v-bvii",
            "tokens": ["I7", "IV7", "V7", "bVII7"],
            "beatsPerChord": 4,
            "bars": 4,
            "resolved": resolved,
        },
        "resolvedAllKeys": resolved,
        "bassWalkConvention": walk_convention,
        "bassWalks": walks,
        "organRuns": build_organ_runs(),
        "patterns": build_patterns(),
        "antiRepetition": {
            "noIdenticalBarWithin": 4,
            "voicingRotate": True,
            "bassWalkRotate": True,
            "organRunEveryBars": [4, 8],
            "allowMidLoopModulate": True,
            "modulationOptions": ["relativeMinor", "upHalf", "upWhole", "circleFifth"],
            "how": (
                "On each re-trigger or each new 4-bar window the engine picks a voicing, bass walk, "
                "and (every 4 or 8 bars) an organ run from variationRules, weighted, skipping any choice "
                "that would reprint the previous bar's (token, voicing, bassWalk, organRun) tuple. "
                "Mid-loop modulate uses the listed options without stopping the groove: relativeMinor "
                "flips mode, upHalf/upWhole are truck-driver lifts, circleFifth moves to the key a fifth up."
            ),
        },
        "intensityMap": build_intensity_map(),
        "serviceMoments": build_service_moments(),
    }


def markov_ok(m: dict) -> None:
    for k, row in m.items():
        s = round(sum(row.values()), 10)
        if abs(s - 1.0) > 1e-6:
            raise SystemExit(f"Markov row {k} sums to {s}, not 1")


def build_beat_theory_maps() -> dict:
    markov = {
        "I": {"IV": 0.30, "V": 0.16, "bVII": 0.20, "V7": 0.12, "vi": 0.10, "ii": 0.07, "I": 0.05},
        "I7": {"IV7": 0.32, "IV": 0.10, "V7": 0.18, "bVII7": 0.22, "I7": 0.10, "V": 0.08},
        "ii": {"V": 0.40, "V7": 0.32, "I": 0.10, "iii": 0.08, "ii": 0.10},
        "ii7": {"V7": 0.45, "V": 0.25, "I": 0.10, "iii": 0.08, "ii7": 0.12},
        "iii": {"vi": 0.40, "IV": 0.30, "ii": 0.15, "iii": 0.15},
        "IV": {"I": 0.28, "V": 0.22, "bVII": 0.16, "V7": 0.16, "ii": 0.10, "IV": 0.08},
        "IV7": {"I7": 0.28, "V7": 0.24, "bVII7": 0.22, "I": 0.12, "IV7": 0.14},
        "V": {"I": 0.48, "vi": 0.12, "V7": 0.12, "bVII": 0.12, "IV": 0.08, "V": 0.08},
        "V7": {"I": 0.42, "I7": 0.16, "vi": 0.10, "bVII7": 0.12, "bII7": 0.10, "V7": 0.10},
        "vi": {"ii": 0.28, "IV": 0.24, "V": 0.16, "I": 0.12, "vi": 0.20},
        "vi7": {"ii7": 0.32, "IV": 0.22, "V7": 0.18, "I": 0.10, "vi7": 0.18},
        "vii°": {"I": 0.50, "iii": 0.20, "V": 0.15, "vii°": 0.15},
        "bVII": {"IV": 0.36, "I": 0.32, "V": 0.12, "bVII": 0.12, "IV7": 0.08},
        "bVII7": {"IV7": 0.32, "I7": 0.32, "IV": 0.12, "V7": 0.12, "bVII7": 0.12},
        "bII7": {"I": 0.55, "I7": 0.20, "bII7": 0.15, "V7": 0.10},
        "i": {"iv": 0.28, "bVI": 0.22, "bVII": 0.22, "V": 0.14, "i": 0.14},
        "i7": {"iv7": 0.30, "bVI7": 0.22, "bVII7": 0.22, "V7": 0.14, "i7": 0.12},
        "iv": {"i": 0.28, "V": 0.24, "bVII": 0.24, "iv": 0.24},
        "iv7": {"i7": 0.30, "bVII7": 0.24, "V7": 0.22, "iv7": 0.24},
        "bVI": {"bVII": 0.40, "i": 0.30, "bVI": 0.30},
        "bVI7": {"bVII7": 0.40, "i7": 0.30, "bVI7": 0.30},
    }
    markov_ok(markov)
    progressions = [
        {"id": "2-5-1", "tokens": ["ii7", "V7", "Imaj7"], "mode": "major", "label": "ii–V–I"},
        {"id": "1-6-2-5", "tokens": ["I", "vi7", "ii7", "V7"], "mode": "major", "label": "I–vi–ii–V"},
        {"id": "backdoor", "tokens": ["iv7", "bVII7", "Imaj7"], "mode": "major", "label": "Backdoor"},
        {"id": "minor-2-5-1", "tokens": ["iim7b5", "V7", "i"], "mode": "minor", "label": "Minor ii–V–i"},
        {"id": "gospel-145", "tokens": ["I", "IV", "V7", "I"], "mode": "major", "label": "Gospel I–IV–V"},
        {"id": "shout", "tokens": ["I", "bVII", "IV", "I"], "mode": "major", "label": "Shout vamp"},
        {"id": "andante", "tokens": ["i", "bVI", "bVII", "i"], "mode": "minor", "label": "Aeolian walkup"},
        {"id": "i-iv-v-bvii", "tokens": ["I7", "IV7", "V7", "bVII7"], "mode": "major", "label": "Shout I7–IV7–V7–bVII7"},
        {"id": "shout-call-response", "tokens": ["I7", "IV7"], "mode": "major", "label": "Call & response I7↔IV7"},
        {"id": "shout-build", "tokens": ["I7", "IV7", "V7", "bVII7"], "mode": "major", "label": "Shout build"},
        {"id": "shout-full-break", "tokens": ["I7", "IV7", "V7", "bVII7"], "mode": "major", "label": "Full praise break"},
        {"id": "shout-breakdown", "tokens": ["I7", "IV7"], "mode": "major", "label": "Shout breakdown"},
        {"id": "shout-storefront", "tokens": ["I7", "bVII7", "IV7", "I7"], "mode": "major", "label": "Storefront I–bVII–IV–I"},
        {"id": "shout-walk-home", "tokens": ["I7", "I7/3", "IV7", "#ivdim7", "I/5", "V7", "I7"], "mode": "major", "label": "Walk-home turnaround"},
        {"id": "shout-modulate-up", "tokens": ["I7", "IV7", "V7", "bVII7"], "mode": "major", "label": "Truck-driver vamp (lift ½ step / 8 bars)"},
        {"id": "shout-relative-flip", "tokens": ["I7", "IV7", "V7", "bVII7", "i7", "iv7", "bVI7", "bVII7"], "mode": "major", "label": "Major vamp then relative-minor i–iv–bVI–bVII"},
    ]
    subs = [
        {"id": "tritone", "from": "V7", "to": ["bII7"], "label": "Tritone substitution (in Ab: Eb7 → A7)"},
        {"id": "2-5-1", "from": "I", "to": ["ii7", "V7", "Imaj7"], "label": "ii–V–I approach"},
        {"id": "1-6-2-5", "from": "I", "to": ["I", "vi7", "ii7", "V7"], "label": "I–vi–ii–V rhythm changes turnaround"},
        {"id": "passing-dim", "from": "I", "to": ["I", "#idim7", "ii7"], "label": "Passing diminished"},
        {"id": "passing-sharp-iv", "from": "IV7", "to": ["IV7", "#ivdim7", "I/5"], "label": "Gospel #iv°7 walk-home"},
        {"id": "backdoor", "from": "Imaj7", "to": ["iv7", "bVII7", "Imaj7"], "label": "Backdoor ii–V (iv–bVII–I)"},
        {"id": "gospel-walk", "from": "I", "to": ["I", "IV", "I/V", "V7"], "label": "Gospel I–IV–I/V–V7"},
        {"id": "shout-bVII", "from": "I", "to": ["I", "bVII", "IV", "I"], "label": "Shout bVII vamp"},
        {"id": "shout-iv-v-bvii", "from": "I7", "to": ["I7", "IV7", "V7", "bVII7"], "label": "Shout I7–IV7–V7–bVII7"},
        {"id": "truck-driver", "from": "I7", "to": ["I7"], "label": "Truck-driver: same vamp up a half step"},
        {"id": "relative-flip", "from": "I7", "to": ["i7", "iv7", "bVI7", "bVII7"], "label": "Flip to relative-minor i–iv–bVI–bVII"},
    ]
    return {
        "version": 1,
        "source": "beat-theory",
        "diatonic": {
            "major": ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
            "minor": ["i", "ii°", "bIII", "iv", "v", "bVI", "bVII"],
        },
        "subs": subs,
        "progressions": progressions,
        "markov": markov,
        "note": (
            "Chords/Pulpit drop-in consumed by src/chords/theory-ext.ts loadBeatTheoryMaps(). "
            "Richer engine-facing maps live at chord-maps/shout-iv-v-bvii.json."
        ),
    }


def main() -> None:
    shout = build_shout_json()
    bt = build_beat_theory_maps()
    ab = shout["resolvedAllKeys"]["Ab"]
    names = [c["name"] for c in ab]
    assert names == ["Ab7", "Db7", "Eb7", "Gb7"], names
    assert shout["keys"][8]["relativeMinor"]["name"] == "Fm"
    assert len(shout["keys"]) == 12
    assert len(shout["patterns"]) == 8
    assert mod12(ab[2]["root"] + 6) == 9
    OUT_MAP.write_text(json.dumps(shout, indent=2) + "\n")
    OUT_BT.parent.mkdir(parents=True, exist_ok=True)
    OUT_BT.write_text(json.dumps(bt, indent=2) + "\n")
    print(f"Wrote {OUT_MAP} ({OUT_MAP.stat().st_size} bytes)")
    print(f"Wrote {OUT_BT} ({OUT_BT.stat().st_size} bytes)")
    print(
        f"keys={len(shout['keys'])} patterns={len(shout['patterns'])} "
        f"voicings={len(shout['voicings'])} bassWalks={len(shout['bassWalks'])} "
        f"organRuns={len(shout['organRuns'])}"
    )


if __name__ == "__main__":
    main()
