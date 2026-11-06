#!/usr/bin/env python3
"""8x16 MIDI pad map, bass walks, organ runs, keys."""
from .theory import (
    KEY_NAMES, REL_CONVENTIONAL, VOICINGS, DEGREE_SEMITONES,
    mod12, uses_flats, pc_name, bass_note, midi_for_degree, walk_midi,
    resolve_token, resolved_voicing, pad,
)


def build_keys():
    keys = []
    for t, name in enumerate(KEY_NAMES):
        rel_t = mod12(t + 9)
        rel_name = KEY_NAMES[rel_t] + "m"
        entry = {
            "tonic": t, "name": name, "mode": "major", "usesFlats": uses_flats(t),
            "relativeMinor": {"name": rel_name, "tonic": rel_t},
            "circleFifthNext": KEY_NAMES[mod12(t + 7)],
            "tritone": pc_name(mod12(t + 6), uses_flats(t)),
        }
        if rel_t in REL_CONVENTIONAL:
            entry["relativeMinor"]["conventional"] = REL_CONVENTIONAL[rel_t]
            entry["relativeMinor"]["spellingNote"] = (
                f"KEY_NAMES gospel-flat spelling is {rel_name}; "
                f"conventional sharp-side name is {REL_CONVENTIONAL[rel_t]}."
            )
        keys.append(entry)
    return keys


def build_resolved_all_keys():
    tokens = ["I7", "IV7", "V7", "bVII7"]
    out = {}
    for t, name in enumerate(KEY_NAMES):
        chords = []
        for tok in tokens:
            ch = resolve_token(tok, t)
            rv = resolved_voicing(ch, "dom7")
            chords.append({
                "token": tok, "name": ch["name"], "root": ch["root"],
                "notesMidi": rv["notesMidi"], "bassMidi": rv["bassMidi"],
                "bassMidiOct": rv["bassMidiOct"],
            })
        out[name] = chords
    return out


def build_bass_walks():
    convention = {
        "relativeTo": "key",
        "description": (
            "Degree numbers are of the current MAJOR key (I=1 ... VII=7). "
            "Accidentals (#2, #4, b7) are chromatic alterations of those degrees. "
            "A walk named chrom-to-N LANDS on scale degree N (the last step is the target root). "
            "MIDI examples use bass floor 28 (E1), same algorithm as theory.ts bassNote(ch, 28). "
            "In Ab: 1=Ab 2=Bb #2=B 3=C 4=Db #4=D 5=Eb 6=F b7=Gb 7=G."
        ),
        "degreeToSemitones": DEGREE_SEMITONES,
        "noteOnStub": (
            "A 1-2-#2-3 walk (C D D#/Eb E in C, MIDI [36,38,39,40]) approaches degree 3, "
            "the leading tone into IV — it does NOT walk into V. "
            "Walk INTO V in Ab (target Eb) is 3-4-#4-5 = C Db D Eb = [36,37,38,39]. "
            "An alternate 4-note approach from further below (2-#2-3-4 = Bb B C Db) "
            "arrives at Db and lands on Eb on the following downbeat."
        ),
    }
    c, ab = 0, 8
    walks = [
        {
            "id": "chrom-to-5",
            "description": "3-note chromatic walkup that lands on scale degree 5 (the V root). Degrees 3-4-#4-5. In Ab (into Eb): C Db D Eb.",
            "relativeTo": "key", "targetDegree": "5",
            "steps": [{"beat": 0, "degree": "3"}, {"beat": 1, "degree": "4"}, {"beat": 2, "degree": "#4"}, {"beat": 3, "degree": "5"}],
            "grid": "8th-or-16th pickup into the V downbeat; last step is the V root",
            "exampleInC": walk_midi(c, ["3", "4", "#4", "5"]),
            "exampleInAb": walk_midi(ab, ["3", "4", "#4", "5"]),
        },
        {
            "id": "chrom-to-4",
            "description": "3-note chromatic walkup that lands on scale degree 4 (the IV root). Degrees 2-#2-3-4. In Ab (into Db): Bb B C Db. Pickup-only variant 1-2-#2-3 (Ab Bb B C / C D D# E) leads to 4 but does not include it.",
            "relativeTo": "key", "targetDegree": "4",
            "steps": [{"beat": 0, "degree": "2"}, {"beat": 1, "degree": "#2"}, {"beat": 2, "degree": "3"}, {"beat": 3, "degree": "4"}],
            "grid": "8th-or-16th pickup into the IV downbeat; last step is the IV root",
            "exampleInC": walk_midi(c, ["2", "#2", "3", "4"]),
            "exampleInAb": walk_midi(ab, ["2", "#2", "3", "4"]),
            "pickupOnlyVariant": {
                "degrees": ["1", "2", "#2", "3"],
                "exampleInC": walk_midi(c, ["1", "2", "#2", "3"]),
                "exampleInAb": walk_midi(ab, ["1", "2", "#2", "3"]),
                "note": "Matches the common C2 figure [36,38,39,40]. Next downbeat is degree 4.",
            },
        },
        {
            "id": "octave-pops",
            "description": "Shout bass octave pops: root on the beat, octave above on the off-beat.",
            "relativeTo": "key", "targetDegree": "1",
            "steps": [
                {"beat": 0, "degree": "1", "octave": 0}, {"beat": 0.5, "degree": "1", "octave": 1},
                {"beat": 1, "degree": "1", "octave": 0}, {"beat": 1.5, "degree": "1", "octave": 1},
            ],
            "grid": "8th",
            "exampleInC": [bass_note(0), bass_note(0) + 12, bass_note(0), bass_note(0) + 12],
            "exampleInAb": [bass_note(8), bass_note(8) + 12, bass_note(8), bass_note(8) + 12],
        },
        {
            "id": "ghost-shout",
            "description": "Dense shout bass: sounded roots on the 8ths, low-velocity ghost neighbors (degree 2 or b7) on the 16ths.",
            "relativeTo": "key", "targetDegree": "1",
            "steps": [
                {"beat": 0.00, "degree": "1", "velocity": 110, "ghost": False},
                {"beat": 0.25, "degree": "1", "velocity": 32, "ghost": True},
                {"beat": 0.50, "degree": "1", "velocity": 85, "ghost": False},
                {"beat": 0.75, "degree": "2", "velocity": 28, "ghost": True},
                {"beat": 1.00, "degree": "1", "velocity": 110, "ghost": False},
                {"beat": 1.25, "degree": "b7", "velocity": 30, "ghost": True},
                {"beat": 1.50, "degree": "1", "velocity": 85, "ghost": False},
                {"beat": 1.75, "degree": "2", "velocity": 28, "ghost": True},
            ],
            "grid": "16th",
            "exampleInC": [bass_note(0), bass_note(0), bass_note(0), midi_for_degree(0, "2")],
            "exampleInAb": [bass_note(8), bass_note(8), bass_note(8), midi_for_degree(8, "2")],
            "exampleInCFull16ths": [midi_for_degree(0, d) for d in ["1", "1", "1", "2", "1", "b7", "1", "2"]],
            "exampleInAbFull16ths": [midi_for_degree(8, d) for d in ["1", "1", "1", "2", "1", "b7", "1", "2"]],
        },
        {
            "id": "pedal-1",
            "description": "Pedal the tonic. Breakdowns and talking-preacher holds sit on degree 1.",
            "relativeTo": "key", "targetDegree": "1",
            "steps": [{"beat": i, "degree": "1"} for i in range(4)],
            "grid": "quarter",
            "exampleInC": [bass_note(0)] * 4,
            "exampleInAb": [bass_note(8)] * 4,
        },
    ]
    return walks, convention


def build_organ_runs():
    mixo_c = [72, 70, 69, 67, 65, 64, 62, 60]
    blues_c = [67, 66, 65, 63, 60, 58, 60, 63]
    gliss_c = list(range(48, 61))
    talk_c = [60, 64, 70, 65, 69, 75]

    def trans(notes, semis):
        return [n + semis for n in notes]

    return [
        {"id": "mixo-down", "scale": "mixolydian", "direction": "down",
         "description": "One-bar descending Mixolydian run from the tonic (8 eighths).",
         "exampleMidiC": mixo_c, "exampleMidiAb": trans(mixo_c, 8), "bars": 1, "grid": "8th"},
        {"id": "blues-fill", "scale": "blues", "direction": "mixed",
         "description": "One-bar blues-scale fill (root pentatonic plus #4). Generic vocabulary, not a quoted lick.",
         "exampleMidiC": blues_c, "exampleMidiAb": trans(blues_c, 8), "bars": 1, "grid": "8th"},
        {"id": "gliss-up", "scale": "chromatic", "direction": "up",
         "description": "Short chromatic gliss into the next downbeat (one octave).",
         "exampleMidiC": gliss_c, "exampleMidiAb": trans(gliss_c, 8), "bars": 1, "grid": "16th"},
        {"id": "talk-stab", "scale": "mixolydian", "direction": "stab",
         "description": "Short call-and-response organ-talk stabs: I7 on the upbeat, IV7 answers on the next upbeat.",
         "exampleMidiC": talk_c, "exampleMidiAb": trans(talk_c, 8),
         "events": [
             {"beat": 0.5, "notesMidiC": [60, 64, 70], "durBeats": 0.5, "label": "call I7"},
             {"beat": 2.5, "notesMidiC": [65, 69, 75], "durBeats": 0.5, "label": "answer IV7"},
         ],
         "bars": 1, "grid": "upbeat stabs"},
    ]


def _bank(index, letter, role, suggested, note, specs):
    return {
        "index": index, "letter": letter, "role": role,
        "suggestedSoundbank": suggested, "note": note,
        "pads": [pad(index, n, lab, role_, trig) for n, lab, role_, trig in specs],
    }


def build_midi_pad_map():
    a = [
        (1, "Call & Response", "pattern", ["shout-call-response"]),
        (2, "Shout Build", "pattern", ["shout-build"]),
        (3, "Full Praise Break", "pattern", ["shout-full-break"]),
        (4, "Breakdown", "pattern", ["shout-breakdown"]),
        (5, "Storefront", "pattern", ["shout-storefront"]),
        (6, "Walk Home", "pattern", ["shout-walk-home"]),
        (7, "Modulate Up", "pattern", ["shout-modulate-up"]),
        (8, "Relative Flip", "pattern", ["shout-relative-flip"]),
        (9, "Intensity Down", "fx", ["intensity-down"]),
        (10, "Intensity Up", "fx", ["intensity-up"]),
        (11, "Truck-Driver +1/2", "fx", ["transpose", "upHalf"]),
        (12, "Flip Relative", "fx", ["transpose", "relativeMinor"]),
        (13, "Organ Talk", "organ-run", ["talk-stab"]),
        (14, "Cycle Variation", "fx", ["antiRepetition"]),
        (15, "Hats-Only Hold", "hat", ["shout-breakdown"]),
        (16, "Full Shout Alias", "pattern", ["shout-full-break"]),
    ]
    b = [
        (1, "G Chicken Scratch", "guitar", ["gtr-scratch-G"]), (2, "C Chicken Scratch", "guitar", ["gtr-scratch-C"]),
        (3, "D Chicken Scratch", "guitar", ["gtr-scratch-D"]), (4, "A Chicken Scratch", "guitar", ["gtr-scratch-A"]),
        (5, "G Passing Chords", "guitar", ["gtr-pass-G"]), (6, "C Passing Chords", "guitar", ["gtr-pass-C"]),
        (7, "D Passing Chords", "guitar", ["gtr-pass-D"]), (8, "A Passing Chords", "guitar", ["gtr-pass-A"]),
        (9, "G Shout Lick", "guitar", ["gtr-lick-G"]), (10, "C Shout Lick", "guitar", ["gtr-lick-C"]),
        (11, "D Shout Lick", "guitar", ["gtr-lick-D"]), (12, "A Shout Lick", "guitar", ["gtr-lick-A"]),
        (13, "G9 Stab", "chord", ["G9", "I9@G"]), (14, "C13 Stab", "chord", ["C13"]),
        (15, "D7#9 Stab", "chord", ["D7#9"]), (16, "Muted Scratch", "fx", ["gtr-hit-scratch"]),
    ]
    c = [
        (1, "I7 stab", "chord", ["I7"]), (2, "IV7 stab", "chord", ["IV7"]),
        (3, "V7 stab", "chord", ["V7"]), (4, "bVII7 stab", "chord", ["bVII7"]),
        (5, "I9 stab", "chord", ["I9"]), (6, "IV9 stab", "chord", ["IV9"]),
        (7, "V7#9 stab", "chord", ["V7#9"]), (8, "bVII13 stab", "chord", ["bVII13"]),
        (9, "I7 vamp hold", "chord", ["I7", "shout-full-break"]), (10, "IV7 vamp hold", "chord", ["IV7"]),
        (11, "Organ-close voicing", "chord", ["organ-close"]), (12, "Organ-open voicing", "chord", ["organ-open"]),
        (13, "6/9 swell", "chord", ["I69"]), (14, "Talk stab", "organ-run", ["talk-stab"]),
        (15, "#ivdim7 passing", "chord", ["#ivdim7"]), (16, "I/5 (bass 5)", "chord", ["I/5"]),
    ]
    d = [
        (1, "Pedal 1 / root hit", "bass", ["pedal-1"]), (2, "Octave pops", "bass", ["octave-pops"]),
        (3, "Chromatic into 4", "bass", ["chrom-to-4"]), (4, "Chromatic into 5", "bass", ["chrom-to-5"]),
        (5, "Ghost shout line", "bass", ["ghost-shout"]), (6, "Walk-home line", "bass", ["shout-walk-home"]),
        (7, "Low octave root", "bass", ["pedal-1"]), (8, "V root hit", "bass", ["V7", "chrom-to-5"]),
        (9, "G Passing Walk", "bass", ["bass-walk-G"]), (10, "C Passing Walk", "bass", ["bass-walk-C"]),
        (11, "D Passing Walk", "bass", ["bass-walk-D"]), (12, "A Passing Walk", "bass", ["bass-walk-A"]),
        (13, "G Bass Hit", "bass", ["bass-hit-G"]), (14, "C Bass Hit", "bass", ["bass-hit-C"]),
        (15, "D Bass Hit", "bass", ["bass-hit-D"]), (16, "A Bass Hit", "bass", ["bass-hit-A"]),
    ]
    e = [
        (1, "Kick", "kick", ["kick"]), (2, "Snare (backbeat)", "snare", ["snare"]),
        (3, "Second / storefront snare", "snare", ["snare-storefront"]), (4, "Handclap (upbeats)", "clap", ["clap"]),
        (5, "Closed hat", "hat", ["hat"]), (6, "Open hat", "hat", ["hat-open"]),
        (7, "Tambourine hit", "perc", ["tamb"]), (8, "Shaker", "perc", ["shaker"]),
        (9, "Layered clap", "clap", ["clap-layer"]), (10, "Congregation clap", "clap", ["clap-congregation"]),
        (11, "Finger snap", "perc", ["snap"]), (12, "Tamb+Shaker loop", "perc", ["perc-groove"]),
        (13, "Shout claps loop", "clap", ["perc-claps"]), (14, "Perc fill", "perc", ["perc-fill"]),
        (15, "Hats-only (breakdown)", "hat", ["shout-breakdown"]), (16, "Snare return", "snare", ["snare-return"]),
    ]
    f = [
        (1, "I7", "chord", ["I7"]), (2, "IV7", "chord", ["IV7"]), (3, "V7", "chord", ["V7"]), (4, "bVII7", "chord", ["bVII7"]),
        (5, "i7 (relative)", "chord", ["i7"]), (6, "iv7 (relative)", "chord", ["iv7"]),
        (7, "bVI7 (relative)", "chord", ["bVI7"]), (8, "bVII7 (relative)", "chord", ["bVII7"]),
        (9, "I7/3", "chord", ["I7/3"]), (10, "I/5", "chord", ["I/5"]), (11, "#ivdim7", "chord", ["#ivdim7"]),
        (12, "bII7 (tritone of V)", "chord", ["bII7"]), (13, "vi7", "chord", ["vi7"]), (14, "ii7", "chord", ["ii7"]),
        (15, "V13", "chord", ["V13"]), (16, "I9", "chord", ["I9"]),
    ]
    g = [
        (1, "Mixo down", "organ-run", ["mixo-down"]), (2, "Blues fill", "organ-run", ["blues-fill"]),
        (3, "Gliss up", "organ-run", ["gliss-up"]), (4, "Talk stab", "organ-run", ["talk-stab"]),
        (5, "Mixo down (8ve up)", "organ-run", ["mixo-down"]), (6, "Blues fill long", "organ-run", ["blues-fill"]),
        (7, "Chromatic cascade", "organ-run", ["gliss-up"]), (8, "Organ talk loop", "organ-run", ["talk-stab"]),
        (9, "G Shout Organ loop", "organ-run", ["org-shout-G"]), (10, "C Shout Organ loop", "organ-run", ["org-shout-C"]),
        (11, "D Shout Organ loop", "organ-run", ["org-shout-D"]), (12, "A Shout Organ loop", "organ-run", ["org-shout-A"]),
        (13, "G6/9 swell", "chord", ["org-swell-G"]), (14, "C6/9 swell", "chord", ["org-swell-C"]),
        (15, "D6/9 swell", "chord", ["org-swell-D"]), (16, "A6/9 swell", "chord", ["org-swell-A"]),
    ]
    h = [
        (1, "Impact boom", "fx", ["impact-boom"]), (2, "Impact crack", "fx", ["impact-crack"]),
        (3, "Sub drop", "fx", ["sub-drop"]), (4, "Reverse swell", "fx", ["reverse-swell"]),
        (5, "Tape stop", "fx", ["tape-stop"]), (6, "Riser 4s", "fx", ["riser-4"]),
        (7, "Riser 8s", "fx", ["riser-8"]), (8, "Downlifter", "fx", ["downlifter"]),
        (9, "Choir ooh", "fx", ["choir-ooh"]), (10, "Choir aah", "fx", ["choir-aah"]),
        (11, "Choir stab", "fx", ["choir-stab"]), (12, "Shimmer swell", "fx", ["shimmer"]),
        (13, "Supersaw pad", "fx", ["supersaw"]), (14, "Reese / sub", "bass", ["reese"]),
        (15, "Congregation rise", "fx", ["congregation"]), (16, "Stop / mute hit", "fx", ["stop"]),
    ]
    banks = [
        _bank(0, "A", "pattern-launch", None,
              "Performance launchers for the 8 shout loops plus intensity / modulate / variation.", a),
        _bank(1, "B", "shout-guitar", "shout-guitar",
              "Existing church-bank guitar loops/stabs (G/C/D/A). Sample keys follow keyTempoMap: G=132, C=120, D=140, A=150.", b),
        _bank(2, "C", "organ-chords", "shout-organ",
              "Theory pads resolve in the session key (all 12). The shipped shout-organ bank is sample-based in G/C/D/A only — Lawrence to decide MIDI-rendered organ vs sample pads.", c),
        _bank(3, "D", "shout-bass", "shout-bass",
              "Pads 1-8 are theory walks (all 12 keys). Pads 9-16 overlay the shipped G/C/D/A bass samples.", d),
        _bank(4, "E", "shout-percussion", "shout-percussion",
              "Roles include kick/snare for the trigger engine. The shipped shout-percussion bank is tamb/shaker/claps — no kick/snare. Kick/snare may come from Foundation or a future kit; Lawrence to assign.", e),
        _bank(5, "F", "harmonic-tokens", None,
              "Live MIDI chord triggers in the session key. Tritone of V7 is bII7 (in Ab: Eb7 -> A7).", f),
        _bank(6, "G", "organ-runs", "shout-organ",
              "Pads 1-8 are theory runs (all 12 keys). Pads 9-16 overlay shipped G/C/D/A organ loops and swells.", g),
        _bank(7, "H", "stage-fx", "stage-fx-modern",
              "Suggested overlay: stage-fx-modern. Open question — 9 shipped banks vs 8 pad banks A-H.", h),
    ]
    return {
        "convention": (
            "MPC: note 36 = bank pad 1 (bottom-left), note 51 = pad 16 (top-right). "
            "In-bank notes 36-51 map to pads 0-15. globalPad = bankIndex*16 + padIndex (0..15). "
            "NoteEvent.p is 0..127. Sending 36-51 while Bank C is selected hits organ pads; "
            "the same notes while Bank E is selected hit percussion."
        ),
        "grid": {
            "rowsTopToBottom": [
                {"pads": [13, 14, 15, 16], "midi": [48, 49, 50, 51]},
                {"pads": [9, 10, 11, 12], "midi": [44, 45, 46, 47]},
                {"pads": [5, 6, 7, 8], "midi": [40, 41, 42, 43]},
                {"pads": [1, 2, 3, 4], "midi": [36, 37, 38, 39]},
            ]
        },
        "suggestedAssignment": {
            "A": "pattern launchers (engine)", "B": "shout-guitar",
            "C": "shout-organ / live organ chords", "D": "shout-bass / live bass walks",
            "E": "shout-percussion + kick/snare source TBD", "F": "live harmonic tokens (engine)",
            "G": "organ runs (theory + shout-organ loops)", "H": "stage-fx-modern",
            "unassignedSoundbanks": ["trap-sanctuary", "drill-pulpit", "amapiano-praise", "neo-soul-sunday"],
        },
        "banks": banks,
    }
