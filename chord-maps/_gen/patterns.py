#!/usr/bin/env python3
"""Eight ever-changing shout loop patterns."""
from .theory import walk_midi, make_preview_row, pad_trig
from .pads import KEY_NAMES


E_ROLES = [
    (1, "Kick", "kick", ["kick"]),
    (2, "Snare (backbeat)", "snare", ["snare"]),
    (3, "Second / storefront snare", "snare", ["snare-storefront"]),
    (4, "Handclap (upbeats)", "clap", ["clap"]),
    (5, "Closed hat", "hat", ["hat"]),
    (6, "Open hat", "hat", ["hat-open"]),
    (7, "Tambourine hit", "perc", ["tamb"]),
    (8, "Shaker", "perc", ["shaker"]),
    (9, "Layered clap", "clap", ["clap-layer"]),
    (10, "Congregation clap", "clap", ["clap-congregation"]),
    (11, "Finger snap", "perc", ["snap"]),
    (12, "Tamb+Shaker loop", "perc", ["perc-groove"]),
    (13, "Shout claps loop", "clap", ["perc-claps"]),
    (14, "Perc fill", "perc", ["perc-fill"]),
    (15, "Hats-only (breakdown)", "hat", ["shout-breakdown"]),
    (16, "Snare return", "snare", ["snare-return"]),
]


def pattern_surface(pattern_id, emphasis):
    """Bank E 16 pads cover MIDI 36-51; plus organ (C), bass (D), runs (G), launcher (A)."""
    out = []
    hot = emphasis.get("hot", {})
    for n, lab, role, trig in E_ROLES:
        out.append(pad_trig(4, n, lab, role, trig + [pattern_id],
                            active=True, hot=hot.get(f"E{n}", False)))
    organ_pads = emphasis.get("organPads", [1, 2, 3, 4])
    organ_meta = {
        1: ("I7 stab", "chord", ["I7"]),
        2: ("IV7 stab", "chord", ["IV7"]),
        3: ("V7 stab", "chord", ["V7"]),
        4: ("bVII7 stab", "chord", ["bVII7"]),
        14: ("Talk stab", "organ-run", ["talk-stab"]),
        15: ("#ivdim7 passing", "chord", ["#ivdim7"]),
        16: ("I/5 (bass 5)", "chord", ["I/5"]),
    }
    for n in organ_pads:
        lab, role, trig = organ_meta[n]
        out.append(pad_trig(2, n, lab, role, trig + [pattern_id], hot=True))
    for n, lab, role, trig in emphasis.get("extraOrgan", []):
        out.append(pad_trig(2, n, lab, role, trig + [pattern_id], hot=True))
    for n, lab, role, walk in emphasis.get("bassPads", [
        (1, "Pedal 1", "bass", "pedal-1"),
        (2, "Octave pops", "bass", "octave-pops"),
        (3, "Chromatic into 4", "bass", "chrom-to-4"),
        (4, "Chromatic into 5", "bass", "chrom-to-5"),
        (5, "Ghost shout", "bass", "ghost-shout"),
    ]):
        out.append(pad_trig(3, n, lab, role, [walk, pattern_id], hot=True))
    for n, run_id in emphasis.get("runs", [(1, "mixo-down"), (2, "blues-fill"), (3, "gliss-up"), (4, "talk-stab")]):
        out.append(pad_trig(6, n, run_id.replace("-", " ").title(), "organ-run", [run_id, pattern_id], hot=True))
    launch = emphasis.get("launchPad")
    if launch:
        out.append(pad_trig(0, launch, pattern_id, "pattern", [pattern_id], hot=True))
    return out


def build_patterns():
    patterns = []
    ab, bb, fm = 8, 10, 5

    cr_a = [
        make_preview_row(1, 4, "I7", ab, "organ-close", "pedal-1", call="call"),
        make_preview_row(2, 4, "I7", ab, "organ-close", "pedal-1", call="call"),
        make_preview_row(3, 4, "IV7", ab, "organ-close", "chrom-to-4", call="response"),
        make_preview_row(4, 4, "IV7", ab, "organ-close", "octave-pops", call="response"),
    ]
    cr_b = [
        make_preview_row(5, 4, "I7", ab, "dom9", "octave-pops", call="call"),
        make_preview_row(6, 4, "I7", ab, "dom9", "octave-pops", call="call", organRun="talk-stab"),
        make_preview_row(7, 4, "IV7", ab, "gospel9", "chrom-to-4", call="response"),
        make_preview_row(8, 4, "IV7", ab, "dom13", "ghost-shout", call="response"),
    ]
    patterns.append({
        "id": "shout-call-response", "name": "Call & Response",
        "serviceMoment": "call-and-response", "bpmRange": [104, 132], "defaultBpm": 120,
        "defaultKey": "Ab", "tokens": ["I7", "IV7"], "bars": 8, "beatsPerBar": 4,
        "form": "2 bars call on I7, 2 bars response on IV7, twice — second half changes voicing and adds organ talk stabs on upbeats",
        "intensity": 2,
        "padTriggers": pattern_surface("shout-call-response", {
            "hot": {"E4": True, "E5": True, "E1": True},
            "organPads": [1, 2, 14],
            "bassPads": [(1, "Pedal 1", "bass", "pedal-1"), (2, "Octave pops", "bass", "octave-pops"), (3, "Chromatic into 4", "bass", "chrom-to-4")],
            "runs": [(4, "talk-stab")], "launchPad": 1,
        }),
        "variationRules": [
            {"type": "voicing", "options": ["organ-close", "dom7", "dom9", "gospel9", "dom13"], "weight": 0.35},
            {"type": "bassWalk", "options": ["pedal-1", "octave-pops", "chrom-to-4"], "weight": 0.25},
            {"type": "organRun", "options": ["talk-stab", None, None], "weight": 0.2},
            {"type": "substitute", "options": ["IV9", "IV13", "I7#9"], "weight": 0.15},
            {"type": "transpose", "options": ["relativeMinor"], "weight": 0.05},
        ],
        "resolvedPreview": {
            "defaultKey": "Ab", "cycleBars": 8,
            "note": "Bars 1-4 (var A) vs bars 5-8 (var B): same I7<->IV7 call/answer, different voicings and bass — not a copy-paste loop.",
            "variationA": cr_a, "variationB": cr_b,
        },
    })

    bd_a = [
        make_preview_row(1, 4, "I7", ab, "dom7", "octave-pops"),
        make_preview_row(2, 4, "IV7", ab, "dom7", "chrom-to-4"),
        make_preview_row(3, 4, "V7", ab, "dom7", "chrom-to-5", walkInto="V", walkMidi=walk_midi(ab, ["3", "4", "#4", "5"])),
        make_preview_row(4, 4, "bVII7", ab, "dom7", "octave-pops"),
    ]
    bd_b = [
        make_preview_row(5, 2, "I7", ab, "dom9", "ghost-shout"),
        make_preview_row(5, 2, "IV7", ab, "dom9", "chrom-to-4", slot="bar5-back"),
        make_preview_row(6, 2, "V7", ab, "dom7sharp9", "chrom-to-5", walkMidi=walk_midi(ab, ["3", "4", "#4", "5"])),
        make_preview_row(6, 2, "bVII7", ab, "dom13", "octave-pops", slot="bar6-back"),
        make_preview_row(7, 2, "I7", ab, "gospel9", "ghost-shout"),
        make_preview_row(7, 2, "IV7", ab, "dom13", "chrom-to-4", slot="bar7-back"),
        make_preview_row(8, 2, "V7", ab, "dom7sharp9", "chrom-to-5"),
        make_preview_row(8, 2, "bVII7", ab, "dom9", "ghost-shout", slot="bar8-back", organRun="gliss-up"),
    ]
    patterns.append({
        "id": "shout-build", "name": "Shout Build",
        "serviceMoment": "build", "bpmRange": [120, 140], "defaultBpm": 132,
        "defaultKey": "Ab", "tokens": ["I7", "IV7", "V7", "bVII7"], "bars": 8, "beatsPerBar": 4,
        "form": "Bars 1-4: one chord per bar. Bars 5-8: two chords per bar (harmonic rhythm doubles). Chromatic walk 3-4-#4-5 into every V.",
        "intensity": 3,
        "padTriggers": pattern_surface("shout-build", {
            "hot": {"E1": True, "E2": True, "E5": True, "E4": True},
            "organPads": [1, 2, 3, 4], "runs": [(3, "gliss-up"), (1, "mixo-down")], "launchPad": 2,
        }),
        "variationRules": [
            {"type": "voicing", "options": ["dom7", "dom9", "dom13", "dom7sharp9", "gospel9"], "weight": 0.3},
            {"type": "bassWalk", "options": ["chrom-to-5", "chrom-to-4", "octave-pops", "ghost-shout"], "weight": 0.3},
            {"type": "organRun", "options": ["gliss-up", "mixo-down", None], "weight": 0.15},
            {"type": "substitute", "options": ["bII7"], "weight": 0.1},
            {"type": "transpose", "options": ["upHalf"], "weight": 0.15},
        ],
        "resolvedPreview": {
            "defaultKey": "Ab", "cycleBars": 8,
            "note": "Harmonic rhythm 1/bar then 2/bar; voicings thicken in the second half so bar 5 is not a repeat of bar 1.",
            "variationA": bd_a, "variationB": bd_b,
        },
    })

    fb_a = [
        make_preview_row(1, 4, "I7", ab, "organ-close", "octave-pops"),
        make_preview_row(2, 4, "IV7", ab, "organ-close", "octave-pops"),
        make_preview_row(3, 4, "V7", ab, "organ-close", "chrom-to-5", walkInto="V", walkMidi=walk_midi(ab, ["3", "4", "#4", "5"])),
        make_preview_row(4, 4, "bVII7", ab, "organ-close", "ghost-shout", organRun="mixo-down"),
    ]
    fb_b = [
        make_preview_row(5, 4, "I7", ab, "dom9", "ghost-shout"),
        make_preview_row(6, 4, "IV7", ab, "dom13", "ghost-shout"),
        make_preview_row(7, 4, "V7", ab, "dom7sharp9", "chrom-to-5", walkInto="V", walkMidi=walk_midi(ab, ["3", "4", "#4", "5"])),
        make_preview_row(8, 4, "bVII7", ab, "gospel9", "octave-pops", organRun="blues-fill"),
    ]
    patterns.append({
        "id": "shout-full-break", "name": "Full Praise Break",
        "serviceMoment": "shout", "bpmRange": [132, 150], "defaultBpm": 140,
        "defaultKey": "Ab", "tokens": ["I7", "IV7", "V7", "bVII7"], "bars": 8, "beatsPerBar": 4,
        "form": "Full I7-IV7-V7-bVII7 vamp. Dense 8th-note bass with ghosts. Organ run every 4 bars (mixo-down then blues-fill).",
        "intensity": 5,
        "padTriggers": pattern_surface("shout-full-break", {
            "hot": {f"E{n}": True for n in range(1, 14)},
            "organPads": [1, 2, 3, 4, 14],
            "runs": [(1, "mixo-down"), (2, "blues-fill"), (3, "gliss-up")], "launchPad": 3,
        }),
        "variationRules": [
            {"type": "voicing", "options": ["organ-close", "organ-open", "dom9", "dom13", "dom7sharp9", "gospel9"], "weight": 0.3},
            {"type": "bassWalk", "options": ["octave-pops", "ghost-shout", "chrom-to-5", "chrom-to-4"], "weight": 0.3},
            {"type": "organRun", "options": ["mixo-down", "blues-fill", "gliss-up"], "weight": 0.25},
            {"type": "substitute", "options": ["bII7", "V7#9"], "weight": 0.1},
            {"type": "transpose", "options": ["upHalf", "upWhole", "circleFifth"], "weight": 0.05},
        ],
        "resolvedPreview": {
            "defaultKey": "Ab", "cycleBars": 8,
            "note": "In Ab: I7=Ab7, IV7=Db7, V7=Eb7, bVII7=Gb7. Relative minor = Fm. Tritone of V7 (Eb7) = A7. Walk into V: C Db D Eb (MIDI 36 37 38 39). Bars 1-4 vs 5-8 swap voicings (close 7 -> 9/13/7#9) and organ runs so the loop never reprints a bar.",
            "variationA": fb_a, "variationB": fb_b,
        },
    })

    br_a = [
        make_preview_row(1, 4, "I7", ab, "shell79", "pedal-1", drums="hats-only"),
        make_preview_row(2, 4, "I7", ab, "shell79", "pedal-1", drums="hats-only"),
        make_preview_row(3, 4, "I7", ab, "shell79", "pedal-1", drums="hats-only"),
        make_preview_row(4, 4, "IV7", ab, "dom7", "chrom-to-4", drums="hats-only", note="sparse IV7 hit"),
    ]
    br_b = [
        make_preview_row(5, 4, "I7", ab, "organ-close", "pedal-1", drums="snare-returns"),
        make_preview_row(6, 4, "I7", ab, "organ-close", "octave-pops", drums="snare-returns"),
        make_preview_row(7, 4, "IV7", ab, "dom9", "chrom-to-4", drums="snare-returns"),
        make_preview_row(8, 4, "I7", ab, "dom7", "pedal-1", drums="snare-returns", organRun="talk-stab"),
    ]
    patterns.append({
        "id": "shout-breakdown", "name": "Breakdown",
        "serviceMoment": "breakdown", "bpmRange": [120, 140], "defaultBpm": 132,
        "defaultKey": "Ab", "tokens": ["I7", "IV7"], "bars": 8, "beatsPerBar": 4,
        "form": "Bars 1-4: I7 pedal, hats only, one sparse IV7 hit. Bars 5-8: snare returns, more IV7, still lean.",
        "intensity": 1,
        "padTriggers": pattern_surface("shout-breakdown", {
            "hot": {"E5": True, "E6": True, "E15": True, "E16": True, "E1": True},
            "organPads": [1, 2],
            "bassPads": [(1, "Pedal 1", "bass", "pedal-1"), (3, "Chromatic into 4", "bass", "chrom-to-4")],
            "runs": [(4, "talk-stab")], "launchPad": 4,
        }),
        "variationRules": [
            {"type": "voicing", "options": ["shell79", "organ-close", "dom7"], "weight": 0.35},
            {"type": "bassWalk", "options": ["pedal-1", "octave-pops"], "weight": 0.3},
            {"type": "organRun", "options": [None, None, "talk-stab"], "weight": 0.15},
            {"type": "substitute", "options": ["I9", "IV9"], "weight": 0.1},
            {"type": "transpose", "options": ["relativeMinor"], "weight": 0.1},
        ],
        "resolvedPreview": {
            "defaultKey": "Ab", "cycleBars": 8,
            "note": "Texture change (hats-only -> snare return) plus a voicing change keeps bars 1 and 5 from matching.",
            "variationA": br_a, "variationB": br_b,
        },
    })

    st_a = [
        make_preview_row(1, 4, "I7", bb, "dom7", "octave-pops"),
        make_preview_row(2, 4, "bVII7", bb, "dom7", "octave-pops"),
        make_preview_row(3, 4, "IV7", bb, "dom7", "chrom-to-4"),
        make_preview_row(4, 4, "I7", bb, "dom7", "pedal-1"),
    ]
    st_b = [
        make_preview_row(5, 4, "I7", bb, "dom9", "ghost-shout"),
        make_preview_row(6, 4, "bVII7", bb, "dom13", "ghost-shout"),
        make_preview_row(7, 4, "IV7", bb, "dom7sharp9", "chrom-to-4"),
        make_preview_row(8, 4, "I7", bb, "gospel9", "octave-pops", organRun="talk-stab"),
    ]
    patterns.append({
        "id": "shout-storefront", "name": "Storefront",
        "serviceMoment": "shout", "serviceMomentTags": ["shout", "praise"],
        "bpmRange": [132, 150], "defaultBpm": 140, "defaultKey": "Bb",
        "tokens": ["I7", "bVII7", "IV7", "I7"], "bars": 8, "beatsPerBar": 4,
        "form": "I7-bVII7-IV7-I7 storefront vamp. Second/backbeat snare (pad E3) in front; handclaps on upbeats (pad E4).",
        "intensity": 4,
        "padTriggers": pattern_surface("shout-storefront", {
            "hot": {"E2": True, "E3": True, "E4": True, "E9": True, "E10": True, "E13": True},
            "organPads": [1, 2, 4], "runs": [(4, "talk-stab"), (1, "mixo-down")], "launchPad": 5,
        }),
        "variationRules": [
            {"type": "voicing", "options": ["dom7", "dom9", "dom13", "dom7sharp9", "organ-open"], "weight": 0.3},
            {"type": "bassWalk", "options": ["octave-pops", "ghost-shout", "chrom-to-4"], "weight": 0.25},
            {"type": "organRun", "options": ["talk-stab", "mixo-down", None], "weight": 0.2},
            {"type": "substitute", "options": ["IV9", "bVII13"], "weight": 0.15},
            {"type": "transpose", "options": ["upHalf", "circleFifth"], "weight": 0.1},
        ],
        "resolvedPreview": {
            "defaultKey": "Bb", "cycleBars": 8,
            "note": "In Bb: I7=Bb7, bVII7=Ab7, IV7=Eb7. Storefront feel is the backbeat snare + upbeat claps.",
            "variationA": st_a, "variationB": st_b,
        },
    })

    wh_a_spec = [
        (1, 2, "I7", "dom7", "pedal-1", {}),
        (1, 2, "I7/3", "dom7", "chrom-to-4", {"walkInto": "I7/3", "walkMidi": walk_midi(ab, ["1", "2", "#2", "3"]),
            "bassWalkNote": "1-2-#2-3 into the 3rd in the bass (Ab Bb B C = 32 34 35 36)"}),
        (2, 2, "IV7", "dom7", "chrom-to-4", {}),
        (2, 2, "#ivdim7", "dim7", "chrom-to-5", {}),
        (3, 2, "I/5", "dom7", "chrom-to-5", {"walkInto": "5", "walkMidi": walk_midi(ab, ["3", "4", "#4", "5"])}),
        (3, 2, "V7", "dom7", "pedal-1", {}),
        (4, 4, "I7", "dom7", "octave-pops", {}),
    ]
    wh_b_spec = [
        (5, 2, "I7", "dom9", "ghost-shout", {}),
        (5, 2, "I7/3", "dom9", "chrom-to-4", {"walkMidi": walk_midi(ab, ["1", "2", "#2", "3"])}),
        (6, 2, "IV7", "dom13", "chrom-to-4", {}),
        (6, 2, "#ivdim7", "dim7", "chrom-to-5", {}),
        (7, 2, "I/5", "organ-open", "chrom-to-5", {"walkMidi": walk_midi(ab, ["3", "4", "#4", "5"])}),
        (7, 2, "V7", "dom7sharp9", "pedal-1", {}),
        (8, 4, "I7", "gospel9", "octave-pops", {}),
    ]
    patterns.append({
        "id": "shout-walk-home", "name": "Walk Home",
        "serviceMoment": "build", "serviceMomentTags": ["build", "turnaround", "shout"],
        "bpmRange": [120, 140], "defaultBpm": 132, "defaultKey": "Ab",
        "tokens": ["I7", "I7/3", "IV7", "#ivdim7", "I/5", "V7", "I7"], "bars": 8, "beatsPerBar": 4,
        "form": "4-bar turnaround played twice (bars 1-4 / 5-8) with different voicings: I7 | I7/3 | IV7 | #ivdim7 | I/5 | V7 | I7. In Ab: Ab7 - Ab7/C - Db7 - Ddim7 - Ab/Eb - Eb7 - Ab7. Bass walks chromatically Ab-Bb-B-C into the /3, then Db-D-Eb into I/5 and V.",
        "intensity": 3,
        "padTriggers": pattern_surface("shout-walk-home", {
            "hot": {"E1": True, "E2": True, "E5": True},
            "organPads": [1, 2, 3, 15, 16],
            "bassPads": [
                (1, "Pedal 1", "bass", "pedal-1"), (3, "Chromatic into 4", "bass", "chrom-to-4"),
                (4, "Chromatic into 5", "bass", "chrom-to-5"), (6, "Walk-home line", "bass", "shout-walk-home"),
            ],
            "runs": [(3, "gliss-up")], "launchPad": 6,
        }),
        "variationRules": [
            {"type": "voicing", "options": ["dom7", "dom9", "dom13", "organ-open", "gospel9"], "weight": 0.3},
            {"type": "bassWalk", "options": ["chrom-to-4", "chrom-to-5", "ghost-shout", "octave-pops"], "weight": 0.35},
            {"type": "organRun", "options": [None, "gliss-up"], "weight": 0.1},
            {"type": "substitute", "options": ["V7#9", "bII7"], "weight": 0.15},
            {"type": "transpose", "options": ["upHalf"], "weight": 0.1},
        ],
        "resolvedPreview": {
            "defaultKey": "Ab", "cycleBars": 8,
            "note": "Chromatic bass spine in Ab: 32 (Ab) -> 34 35 36 (Bb B C) -> 37 (Db) -> 38 (D) -> 39 (Eb) -> 32/44 (Ab).",
            "variationA": [make_preview_row(b, bt, tok, ab, voi, w, **ex) for b, bt, tok, voi, w, ex in wh_a_spec],
            "variationB": [make_preview_row(b, bt, tok, ab, voi, w, **ex) for b, bt, tok, voi, w, ex in wh_b_spec],
        },
    })

    key_seq = KEY_NAMES[8:] + KEY_NAMES[:8]
    mu_a = [
        make_preview_row(1, 4, "I7", 8, "dom7", "octave-pops", keyName="Ab"),
        make_preview_row(2, 4, "IV7", 8, "dom7", "octave-pops", keyName="Ab"),
        make_preview_row(3, 4, "V7", 8, "dom7", "chrom-to-5", keyName="Ab", walkMidi=walk_midi(8, ["3", "4", "#4", "5"])),
        make_preview_row(4, 4, "bVII7", 8, "dom7", "ghost-shout", keyName="Ab"),
        make_preview_row(5, 4, "I7", 8, "dom9", "ghost-shout", keyName="Ab"),
        make_preview_row(6, 4, "IV7", 8, "dom9", "chrom-to-4", keyName="Ab"),
        make_preview_row(7, 4, "V7", 8, "dom7sharp9", "chrom-to-5", keyName="Ab"),
        make_preview_row(8, 4, "bVII7", 8, "dom13", "octave-pops", keyName="Ab", organRun="gliss-up", note="gliss into the truck-driver lift"),
    ]
    mu_b = [
        make_preview_row(1, 4, "I7", 9, "dom7", "octave-pops", keyName="A"),
        make_preview_row(2, 4, "IV7", 9, "dom7", "octave-pops", keyName="A"),
        make_preview_row(3, 4, "V7", 9, "dom7", "chrom-to-5", keyName="A", walkMidi=walk_midi(9, ["3", "4", "#4", "5"])),
        make_preview_row(4, 4, "bVII7", 9, "dom7", "ghost-shout", keyName="A"),
        make_preview_row(5, 4, "I7", 9, "dom9", "ghost-shout", keyName="A"),
        make_preview_row(6, 4, "IV7", 9, "dom9", "chrom-to-4", keyName="A"),
        make_preview_row(7, 4, "V7", 9, "dom7sharp9", "chrom-to-5", keyName="A"),
        make_preview_row(8, 4, "bVII7", 9, "dom13", "octave-pops", keyName="A"),
    ]
    patterns.append({
        "id": "shout-modulate-up", "name": "Truck-Driver Modulate Up",
        "serviceMoment": "shout", "serviceMomentTags": ["shout", "peak"],
        "bpmRange": [140, 150], "defaultBpm": 150, "defaultKey": "Ab",
        "tokens": ["I7", "IV7", "V7", "bVII7"], "bars": 8, "beatsPerBar": 4,
        "form": "Same I7-IV7-V7-bVII7 vamp; transpose up a half step every 8 bars (truck-driver).",
        "intensity": 5,
        "modulation": {
            "type": "truck-driver", "intervalSemitones": 1, "everyBars": 8, "startKey": "Ab",
            "keySequence": key_seq,
            "note": "After 12 lifts the vamp returns to Ab. Operators usually take 2-4 lifts at a peak, then settle or break down.",
        },
        "padTriggers": pattern_surface("shout-modulate-up", {
            "hot": {f"E{n}": True for n in range(1, 14)},
            "organPads": [1, 2, 3, 4], "runs": [(3, "gliss-up"), (1, "mixo-down")], "launchPad": 7,
        }),
        "variationRules": [
            {"type": "transpose", "options": ["upHalf"], "weight": 0.5},
            {"type": "voicing", "options": ["dom7", "dom9", "dom13", "dom7sharp9"], "weight": 0.2},
            {"type": "bassWalk", "options": ["octave-pops", "ghost-shout", "chrom-to-5"], "weight": 0.15},
            {"type": "organRun", "options": ["gliss-up", "mixo-down"], "weight": 0.1},
            {"type": "substitute", "options": ["bII7"], "weight": 0.05},
        ],
        "resolvedPreview": {
            "defaultKey": "Ab", "cycleBars": 8,
            "note": "Variation A = first 8 bars in Ab (Ab7 Db7 Eb7 Gb7). Variation B = next 8 bars in A (A7 D7 E7 G7). Not the same loop twice.",
            "variationA": mu_a, "variationB": mu_b,
        },
    })

    rf_a = [
        make_preview_row(1, 4, "I7", ab, "dom7", "octave-pops", keyName="Ab"),
        make_preview_row(2, 4, "IV7", ab, "dom7", "chrom-to-4", keyName="Ab"),
        make_preview_row(3, 4, "V7", ab, "dom7", "chrom-to-5", keyName="Ab", walkMidi=walk_midi(ab, ["3", "4", "#4", "5"])),
        make_preview_row(4, 4, "bVII7", ab, "dom7", "octave-pops", keyName="Ab"),
    ]
    rf_b = [
        make_preview_row(5, 4, "i7", fm, "dom7", "pedal-1", mode="minor", keyName="Fm"),
        make_preview_row(6, 4, "iv7", fm, "dom7", "chrom-to-4", mode="minor", keyName="Fm"),
        make_preview_row(7, 4, "bVI7", fm, "dom7", "octave-pops", mode="minor", keyName="Fm"),
        make_preview_row(8, 4, "bVII7", fm, "dom7", "chrom-to-5", mode="minor", keyName="Fm", organRun="talk-stab"),
    ]
    patterns.append({
        "id": "shout-relative-flip", "name": "Relative Flip",
        "serviceMoment": "breakdown", "serviceMomentTags": ["breakdown", "rebuild"],
        "bpmRange": [120, 140], "defaultBpm": 132, "defaultKey": "Ab", "relativeKey": "Fm",
        "tokens": ["I7", "IV7", "V7", "bVII7"], "tokensMinor": ["i7", "iv7", "bVI7", "bVII7"],
        "bars": 8, "beatsPerBar": 4,
        "form": "Bars 1-4 in major I7-IV7-V7-bVII7 (Ab7 Db7 Eb7 Gb7). Bars 5-8 in the relative minor i7-iv7-bVI7-bVII7 (Fm7 Bbm7 Db7 Eb7). Flip rebuilds by returning to major.",
        "intensity": 2,
        "padTriggers": pattern_surface("shout-relative-flip", {
            "hot": {"E5": True, "E1": True, "E2": True, "E4": True},
            "organPads": [1, 2, 3, 4], "runs": [(4, "talk-stab")], "launchPad": 8,
        }),
        "variationRules": [
            {"type": "transpose", "options": ["relativeMinor"], "weight": 0.4},
            {"type": "voicing", "options": ["dom7", "dom9", "organ-close", "shell79"], "weight": 0.25},
            {"type": "bassWalk", "options": ["pedal-1", "octave-pops", "chrom-to-4", "chrom-to-5"], "weight": 0.2},
            {"type": "organRun", "options": [None, "talk-stab"], "weight": 0.1},
            {"type": "substitute", "options": ["V7#9"], "weight": 0.05},
        ],
        "resolvedPreview": {
            "defaultKey": "Ab", "cycleBars": 8,
            "note": "Major side is the shout vamp; minor side is darker (breakdown color) and shares Db7/Eb7 with the major IV/V, so the flip is a mode change more than a new set of roots.",
            "variationA": rf_a, "variationB": rf_b,
        },
    })
    return patterns


def build_service_moments():
    return {
        "call-and-response": {
            "label": "Call and response", "patternIds": ["shout-call-response"], "also": [],
            "description": "Leader/congregation or preacher/band back-and-forth. Light clap, organ stabs on upbeats, I7 answering IV7.",
        },
        "build": {
            "label": "Build", "patternIds": ["shout-build", "shout-walk-home"], "also": [],
            "description": "Density rises: harmonic rhythm doubles, chromatic walk into V, or the walk-home turnaround that dumps into a shout.",
        },
        "shout": {
            "label": "Shout / praise break", "patternIds": ["shout-full-break", "shout-storefront", "shout-modulate-up"], "also": [],
            "description": "Full vamp, storefront backbeat + upbeat claps, or truck-driver half-step lifts at the peak.",
        },
        "breakdown": {
            "label": "Breakdown (and rebuild)", "patternIds": ["shout-breakdown", "shout-relative-flip"], "also": [],
            "description": "Strip to an I7 pedal and hats, or flip into the relative minor, then bring snare / major vamp back.",
        },
    }


def build_intensity_map():
    return {
        "description": "Sanctum intensity 1-5 puts harmonic substance under the Whoop-style shout/worship detents (their shout side is 4 levels; we use 5 so breakdown has its own floor).",
        "levels": {
            "1": {"name": "Breakdown", "chordDensity": "I7 pedal, sparse IV7", "bassMotion": "pedal-1", "rhythmicDensity": "hats only", "patterns": ["shout-breakdown"]},
            "2": {"name": "Call / flip", "chordDensity": "I7<->IV7 or major/relative-minor 4+4", "bassMotion": "pedal and light walks", "rhythmicDensity": "light clap, hats", "patterns": ["shout-call-response", "shout-relative-flip"]},
            "3": {"name": "Build", "chordDensity": "full I-IV-V-bVII, rhythm doubling or turnaround", "bassMotion": "chromatic into 4 and 5", "rhythmicDensity": "snare in, 8ths", "patterns": ["shout-build", "shout-walk-home"]},
            "4": {"name": "Storefront shout", "chordDensity": "I-bVII-IV-I variant", "bassMotion": "octave pops", "rhythmicDensity": "second snare + upbeat claps", "patterns": ["shout-storefront"]},
            "5": {"name": "Full break / peak", "chordDensity": "full vamp, 9/13/#9 voicings, optional truck-driver", "bassMotion": "8ths + ghosts + walks", "rhythmicDensity": "full kit, organ runs every 4 bars", "patterns": ["shout-full-break", "shout-modulate-up"]},
        },
    }
