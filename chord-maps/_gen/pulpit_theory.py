#!/usr/bin/env python3
"""Mirror of src/pulpit/theory.ts for Follow Me chord-map generation.

voice() default here is low=48 and bassNote() default is low=28, as specified
for the chord-map library (the TypeScript defaults are 52 and 31).
"""
from __future__ import annotations

KEY_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]
ROMANS = ["VII", "III", "VI", "IV", "II", "V", "I"]
ROMAN_DEGREE = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7}
# relative-minor tonic -> conventional sharp-side spelling (gospel KEY_NAMES uses flats except F#)
REL_CONVENTIONAL = {1: "C#m", 3: "D#m", 8: "G#m"}

QUALITY = {
    "":     {"up": [0, 4, 7],          "low": [0, 3, 7],          "label": ["", "m"]},
    "7":    {"up": [0, 4, 7, 10],      "low": [0, 3, 7, 10],      "label": ["7", "m7"]},
    "maj7": {"up": [0, 4, 7, 11],      "low": [0, 3, 7, 11],      "label": ["maj7", "m(maj7)"]},
    "9":    {"up": [0, 4, 7, 10, 14],  "low": [0, 3, 7, 10, 14],  "label": ["9", "m9"]},
    "maj9": {"up": [0, 4, 7, 11, 14],  "low": [0, 3, 7, 11, 14],  "label": ["maj9", "m(maj9)"]},
    "11":   {"up": [0, 7, 10, 14, 17], "low": [0, 3, 7, 10, 17],  "label": ["11", "m11"]},
    "13":   {"up": [0, 4, 10, 14, 21], "low": [0, 3, 10, 14, 21], "label": ["13", "m13"]},
    "6":    {"up": [0, 4, 7, 9],       "low": [0, 3, 7, 9],       "label": ["6", "m6"]},
    "69":   {"up": [0, 4, 7, 9, 14],   "low": [0, 3, 7, 9, 14],   "label": ["6/9", "m6/9"]},
    "add9": {"up": [0, 4, 7, 14],      "low": [0, 3, 7, 14],      "label": ["add9", "m(add9)"]},
    "sus":  {"up": [0, 5, 7],          "low": [0, 5, 7],          "label": ["sus4", "sus4"]},
    "7sus": {"up": [0, 5, 7, 10],      "low": [0, 5, 7, 10],      "label": ["7sus4", "7sus4"]},
    "7#9":  {"up": [0, 4, 10, 15],     "low": [0, 3, 10, 15],     "label": ["7#9", "m7#9"]},
    "7b9":  {"up": [0, 4, 10, 13],     "low": [0, 3, 10, 13],     "label": ["7b9", "m7b9"]},
    "dim":  {"up": [0, 3, 6],          "low": [0, 3, 6],          "label": ["dim", "dim"]},
    "dim7": {"up": [0, 3, 6, 9],       "low": [0, 3, 6, 9],       "label": ["dim7", "dim7"]},
    "m7b5": {"up": [0, 3, 6, 10],      "low": [0, 3, 6, 10],      "label": ["m7b5", "m7b5"]},
    "aug":  {"up": [0, 4, 8],          "low": [0, 4, 8],          "label": ["+", "+"]},
    "m":    {"up": [0, 3, 7],          "low": [0, 3, 7],          "label": ["m", "m"]},
    "m7":   {"up": [0, 3, 7, 10],      "low": [0, 3, 7, 10],      "label": ["m7", "m7"]},
    "m9":   {"up": [0, 3, 7, 10, 14],  "low": [0, 3, 7, 10, 14],  "label": ["m9", "m9"]},
    "m11":  {"up": [0, 3, 7, 10, 17],  "low": [0, 3, 7, 10, 17],  "label": ["m11", "m11"]},
}

ALIASES = {
    "o": "dim", "°": "dim", "o7": "dim7", "°7": "dim7",
    "ø": "m7b5", "ø7": "m7b5", "+": "aug",
    "sus4": "sus", "7sus4": "7sus", "6/9": "69",
    "M7": "maj7", "Δ": "maj7", "Δ7": "maj7",
    "mi7": "m7", "min7": "m7",
    "(9)": "9", "(7)": "7", "(13)": "13", "(7#9)": "7#9", "m(9)": "m9",
}


def mod12(n: int) -> int:
    return ((n % 12) + 12) % 12


def uses_flats(tonic: int, mode: str = "major") -> bool:
    rel = mod12(tonic + 3) if mode == "minor" else tonic
    return rel in (0, 5, 10, 3, 8, 1)


def pc_name(pc: int, flats: bool = True) -> str:
    return (FLAT_NAMES if flats else SHARP_NAMES)[mod12(pc)]


def key_name(tonic: int, mode: str = "major") -> str:
    return KEY_NAMES[mod12(tonic)] + ("m" if mode == "minor" else "")


def relative_minor_name(major_tonic: int) -> dict:
    rel_t = mod12(major_tonic + 9)
    name = KEY_NAMES[rel_t] + "m"
    entry = {"major": KEY_NAMES[mod12(major_tonic)], "minor": name, "minorTonic": rel_t}
    if rel_t in REL_CONVENTIONAL:
        entry["conventional"] = REL_CONVENTIONAL[rel_t]
    return entry


def parse_key(s: str) -> dict:
    raw = s.strip()
    # Fm, Ab, F#m, C# minor, etc.
    import re
    m = re.match(r"^\s*([A-Ga-g])([#b♯♭]?)\s*(m|min|minor|maj|major)?\s*$", raw)
    if not m:
        raise ValueError(f"Bad key {s!r}")
    base = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[m.group(1).upper()]
    acc_ch = m.group(2) or ""
    acc = 1 if acc_ch in ("#", "♯") else -1 if acc_ch in ("b", "♭") else 0
    mode_tok = m.group(3)
    if mode_tok:
        minor = bool(__import__("re").match(r"^m(in(or)?)?$", mode_tok))
    else:
        minor = m.group(1) == m.group(1).lower()
    return {"tonic": mod12(base + acc), "mode": "minor" if minor else "major"}


def _degree_offset(s: str, mode: str) -> int:
    acc = 0
    t = s
    while t and t[0] in "b#":
        acc += 1 if t[0] == "#" else -1
        t = t[1:]
    scale = MINOR_SCALE if mode == "minor" else MAJOR_SCALE
    return mod12(scale[int(t) - 1] + acc)


def parse_token(token: str, mode: str = "major") -> dict:
    s = token.strip()
    bass_degree = None
    slash = s.rfind("/")
    if slash > 0:
        tail = s[slash + 1:]
        import re
        if re.match(r"^[b#]?[1-7]$", tail) and not s.endswith("6/9") and not s[slash - 1:slash + 2] == "6/9":
            # exclude 6/9 quality (already handled by not matching [1-7] after 6/9 well... 6/9 tail is "9")
            if not (s[:slash].endswith("6") and tail == "9"):
                bass_degree = _degree_offset(tail, mode)
                s = s[:slash]
    acc = 0
    while s and s[0] in "b#♭♯":
        acc += 1 if s[0] in "#♯" else -1
        s = s[1:]
    deg = 0
    lower = False
    rest = ""
    nash = None
    if s and s[0] in "1234567":
        deg = int(s[0])
        rest = s[1:]
        nash = True
        if rest.startswith("m") and not rest.startswith("maj"):
            lower = True
            rest = rest[1:]
    else:
        nash = False
        up = s.upper()
        r = next((x for x in ROMANS if up.startswith(x)), None)
        if not r:
            raise ValueError(f'Bad chord token "{token}"')
        deg = ROMAN_DEGREE[r]
        lower = s[:len(r)] == s[:len(r)].lower()
        rest = s[len(r):]
    q = rest
    if len(rest) >= 2 and rest[0] == "(" and rest[-1] == ")":
        q = rest[1:-1]
    q = ALIASES.get(rest, ALIASES.get(q, q))
    if lower and q in ("m", "m7", "m9", "m11"):
        q = q[1:]
    if q not in QUALITY:
        raise ValueError(f'Unknown chord quality "{rest}" in "{token}"')
    defn = QUALITY[q]
    scale = (MINOR_SCALE if mode == "minor" else MAJOR_SCALE) if nash else MAJOR_SCALE
    degree = mod12(scale[deg - 1] + acc)
    return {
        "degree": degree,
        "intervals": defn["low"] if lower else defn["up"],
        "label": defn["label"][1] if lower else defn["label"][0],
        "bassDegree": bass_degree,
    }


def chord_in(token: str, tonic: int, mode: str = "major") -> dict:
    p = parse_token(token, mode)
    root = mod12(tonic + p["degree"])
    bass = root if p["bassDegree"] is None else mod12(tonic + p["bassDegree"])
    flats = uses_flats(tonic, mode)
    name = pc_name(root, flats) + p["label"]
    if bass != root:
        name += "/" + pc_name(bass, flats)
    return {
        "token": token,
        "root": root,
        "bass": bass,
        "intervals": p["intervals"],
        "name": name,
        "degree": p["degree"],
    }


def voice(ch: dict, low: int = 48, max_notes: int = 5) -> list:
    r = low + mod12(ch["root"] - low)
    notes = [r + i for i in ch["intervals"][:max_notes]]
    notes = [n - 12 if (n - r) > 16 else n for n in notes]
    seen = set()
    out = []
    for n in sorted(notes):
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out


def bass_note(ch: dict, low: int = 28) -> int:
    return low + mod12(ch["bass"] - low)


def resolve_voiced(token: str, tonic: int, mode: str = "major") -> dict:
    ch = chord_in(token, tonic, mode)
    return {
        "token": token,
        "symbol": ch["name"],
        "root": ch["root"],
        "bass": ch["bass"],
        "intervals": ch["intervals"],
        "notesMidi": voice(ch, 48),
        "bassMidi": bass_note(ch, 28),
        "degree": ch["degree"],
    }
