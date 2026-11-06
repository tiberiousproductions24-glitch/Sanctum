#!/usr/bin/env python3
"""Theory math mirroring src/pulpit/theory.ts."""
from __future__ import annotations

KEY_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
REL_CONVENTIONAL = {1: "C#m", 3: "D#m", 8: "G#m"}

VOICINGS = {
    "dom7": {"intervals": [0, 4, 7, 10], "label": "7", "description": "Close dominant 7 — shout backbone"},
    "dom9": {"intervals": [0, 4, 7, 10, 14], "label": "9", "description": "Dominant 9 (adds 9 above close 7)"},
    "dom13": {"intervals": [0, 4, 10, 14, 21], "label": "13", "description": "Dominant 13 (root, 3, b7, 9, 13; 5 often omitted)"},
    "dom7sharp9": {"intervals": [0, 4, 10, 15], "label": "7#9", "description": "Shout 7#9 (root, 3, b7, #9)"},
    "dom7flat9": {"intervals": [0, 4, 10, 13], "label": "7b9", "description": "Dominant 7b9 — tension into a resolve"},
    "organ-close": {"intervals": [0, 4, 7, 10], "label": "7", "registerMidi": 60, "description": "Close organ 7 around C4"},
    "organ-open": {"intervals": [0, 7, 10, 16], "label": "7open", "registerMidi": 48, "description": "Open organ 7: root-5-b7-10 (3rd up an octave)"},
    "shell79": {"intervals": [0, 10, 14], "label": "7(no3)/9", "description": "Gospel shell: root, b7, 9"},
    "gospel9": {"intervals": [0, 4, 10, 14], "label": "9(no5)", "description": "Gospel 9 without the 5"},
    "7sus": {"intervals": [0, 5, 7, 10], "label": "7sus4", "description": "Suspended dominant — setup into a 7"},
    "dim7": {"intervals": [0, 3, 6, 9], "label": "dim7", "description": "Fully diminished 7 — passing #ivdim7"},
}

DEGREE_SEMITONES = {
    "1": 0, "2": 2, "#2": 3, "b3": 3, "3": 4, "4": 5, "#4": 6, "b5": 6,
    "5": 7, "#5": 8, "b6": 8, "6": 9, "b7": 10, "7": 11, "8": 12,
}

QUALITY = {
    "":    ([0, 4, 7], [0, 3, 7], ["", "m"]),
    "7":   ([0, 4, 7, 10], [0, 3, 7, 10], ["7", "m7"]),
    "9":   ([0, 4, 7, 10, 14], [0, 3, 7, 10, 14], ["9", "m9"]),
    "13":  ([0, 4, 10, 14, 21], [0, 3, 10, 14, 21], ["13", "m13"]),
    "7#9": ([0, 4, 10, 15], [0, 3, 10, 15], ["7#9", "m7#9"]),
    "dim7": ([0, 3, 6, 9], [0, 3, 6, 9], ["dim7", "dim7"]),
    "maj7": ([0, 4, 7, 11], [0, 3, 7, 11], ["maj7", "m(maj7)"]),
}


def mod12(n: int) -> int:
    return ((n % 12) + 12) % 12


def uses_flats(tonic: int, mode: str = "major") -> bool:
    rel = mod12(tonic + 3) if mode == "minor" else tonic
    return rel in (0, 5, 10, 3, 8, 1)


def pc_name(pc: int, flats: bool = True) -> str:
    return (FLAT_NAMES if flats else SHARP_NAMES)[mod12(pc)]


def voice(root: int, intervals: list, low: int = 48, max_notes: int = 5) -> list:
    r = low + mod12(root - low)
    notes = [r + i for i in intervals[:max_notes]]
    notes = [n - 12 if (n - r) > 16 else n for n in notes]
    return sorted(set(notes))


def bass_note(pc: int, low: int = 28) -> int:
    return low + mod12(pc - low)


def midi_for_degree(tonic: int, degree: str, low: int = 28) -> int:
    semis = DEGREE_SEMITONES[degree]
    pc = mod12(tonic + semis)
    n = bass_note(pc, low)
    if degree == "8":
        n = bass_note(tonic, low) + 12
    return n


def walk_midi(tonic: int, degrees: list, low: int = 28) -> list:
    """Voice-led walk: first note uses bass_note(); later notes move up (walkups) instead of re-wrapping into 28-39."""
    notes = []
    prev = None
    for d in degrees:
        if d == "8":
            n = bass_note(tonic, low) + 12
        else:
            pc = mod12(tonic + DEGREE_SEMITONES[d])
            base = bass_note(pc, low)
            cands = [base]
            if base + 12 <= 52:
                cands.append(base + 12)
            if prev is None:
                n = base
            else:
                up = [c for c in cands if c >= prev]
                n = min(up) if up else min(cands, key=lambda x: abs(x - prev))
        notes.append(n)
        prev = n
    return notes


def chord_name(root: int, label: str, tonic: int, bass=None, mode: str = "major") -> str:
    flats = uses_flats(tonic, mode)
    name = pc_name(root, flats) + label
    if bass is not None and bass != root:
        name += "/" + pc_name(bass, flats)
    return name


def resolve_token(token: str, tonic: int, mode: str = "major") -> dict:
    s = token.strip()
    bass_deg = None
    slash = s.rfind("/")
    if slash > 0:
        bpart = s[slash + 1:]
        if bpart.lstrip("b#").isdigit() and len(bpart) <= 2:
            acc, t = 0, bpart
            while t and t[0] in "b#":
                acc += 1 if t[0] == "#" else -1
                t = t[1:]
            bass_deg = mod12(MAJOR_SCALE[int(t) - 1] + acc)
            s = s[:slash]
    acc = 0
    while s and s[0] in "b#":
        acc += 1 if s[0] == "#" else -1
        s = s[1:]
    romans = ["VII", "III", "VI", "IV", "II", "V", "I"]
    up = s.upper()
    r = next(x for x in romans if up.startswith(x))
    deg = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7}[r]
    lower = s[:len(r)] == s[:len(r)].lower()
    rest = s[len(r):]
    quality = QUALITY[rest]
    intervals = quality[1] if lower else quality[0]
    label = quality[2][1] if lower else quality[2][0]
    degree = mod12(MAJOR_SCALE[deg - 1] + acc)
    root = mod12(tonic + degree)
    bass = root if bass_deg is None else mod12(tonic + bass_deg)
    return {
        "token": token, "root": root, "bass": bass, "intervals": intervals,
        "name": chord_name(root, label, tonic, bass, mode), "degree": degree,
    }


def resolved_voicing(ch: dict, voicing_id: str = "dom7", chord_low: int = 48, bass_low: int = 28) -> dict:
    v = VOICINGS[voicing_id]
    if "dim" in ch["token"]:
        intervals = VOICINGS["dim7"]["intervals"]
        used = "dim7"
    elif voicing_id == "dom7" and ch["intervals"] == [0, 4, 7]:
        intervals = ch["intervals"]
        used = "triad"
    elif ch["token"] and ch["token"][0].islower() and voicing_id == "dom7":
        intervals = ch["intervals"]
        used = voicing_id
    else:
        intervals = v["intervals"]
        used = voicing_id
    low = int(v.get("registerMidi", chord_low))
    notes = voice(ch["root"], intervals, low=low)
    return {
        "token": ch["token"], "name": ch["name"], "root": ch["root"], "bass": ch["bass"],
        "notesMidi": notes, "bassMidi": bass_note(ch["bass"], bass_low),
        "bassMidiOct": bass_note(ch["bass"], bass_low) + 12,
        "voicing": used, "intervals": intervals,
    }


def make_preview_row(bar, beats, token, tonic, voicing, bass_walk, **extra):
    mode = extra.pop("mode", "major")
    minor_tonic = extra.pop("minorTonic", None)
    ch = resolve_token(token, minor_tonic if minor_tonic is not None else tonic, mode)
    rv = resolved_voicing(ch, voicing)
    row = {
        "bar": bar, "beats": beats, "token": token, "name": ch["name"], "root": ch["root"],
        "bassMidi": rv["bassMidi"], "notesMidi": rv["notesMidi"],
        "voicing": voicing if "dim" not in token else "dim7", "bassWalk": bass_walk,
    }
    row.update(extra)
    return row


def pad(bank_index, pad_n, label, role, triggers, **extra):
    pad_index = pad_n - 1
    d = {
        "pad": pad_n, "midiNote": 36 + pad_index,
        "globalPad": bank_index * 16 + pad_index,
        "label": label, "role": role, "triggers": triggers,
    }
    d.update(extra)
    return d


def pad_trig(bank_index, pad_n, label, role, triggers, **extra):
    d = pad(bank_index, pad_n, label, role, triggers, **extra)
    d["bank"] = "ABCDEFGH"[bank_index]
    d["bankIndex"] = bank_index
    return d
