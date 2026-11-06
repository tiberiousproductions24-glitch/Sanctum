#!/usr/bin/env python3
"""Generate Follow Me (Preacher Assist) 12-key charts and companion docs.

Data files only. Theory and patterns — no audio. Internal module path remains src/pulpit/.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from _gen.pulpit_theory import (  # noqa: E402
    KEY_NAMES, chord_in, resolve_voiced, relative_minor_name, parse_key, key_name,
)
from _gen.theory import walk_midi, bass_note as bass_pc, midi_for_degree  # noqa: E402

ROOT = HERE.parent
OUT_CHARTS = HERE / "pulpit-12key-charts.json"
OUT_BT = ROOT / "content" / "theory" / "beat-theory-maps.json"
OUT_NAMING = HERE / "PULPIT_NAMING.md"
OUT_CHARTS_MD = HERE / "PULPIT_CHARTS.md"
OUT_HANDOFF = HERE / "HANDOFF_SANCTUM_BUILD.md"
OUT_PREVIEW = HERE / "PREVIEW_PULPIT.txt"
OUT_README = HERE / "README.md"

CREATED = "2026-11-05"
FEATURE = "Follow Me"
SUBTITLE = "Preacher Assist"

# Display names for library feel ids. `whoop` stays an internal id only.
FEEL_DISPLAY = {
    "whoop": "Preaching hold",
    "tuneup": "Tuning up",
    "ballad": "Ballad / hymn",
    "worship": "Worship / altar",
    "praise": "Praise (medium)",
    "shout": "Shout",
    "fastshout": "Fast shout",
}

PROGRESSION_DEFS = [
    {
        "id": "whoop-14", "name": "Preaching 1–4", "mode": "major", "feelId": "whoop",
        "serviceMoment": "preaching", "tokens": ["I9", "IV9", "I9", "IV9"],
        "defaultKey": "Ab", "kind": "progression",
        "desc": "The basic preacher back-and-forth. Easy Play taps one chord per phrase.",
        "tags": ["preaching"],
    },
    {
        "id": "whoop-145", "name": "Preaching 1–4–1–5", "mode": "major", "feelId": "whoop",
        "serviceMoment": "preaching", "tokens": ["I", "IV9", "I", "V7sus", "V7"],
        "defaultKey": "Ab", "kind": "progression",
        "desc": "Home, lift, home, and set up the turnaround.",
        "tags": ["preaching"],
    },
    {
        "id": "two-five-one", "name": "2–5–1 resolve", "mode": "major", "feelId": "whoop",
        "serviceMoment": "preaching", "tokens": ["ii9", "V13", "Imaj9", "I7"],
        "defaultKey": "Eb", "kind": "progression",
        "desc": "The jazz-gospel resolve. The I7 leads back to IV.",
        "tags": ["preaching", "turnaround"],
    },
    {
        "id": "one-six-two-five", "name": "1–6–2–5 turnaround", "mode": "major", "feelId": "whoop",
        "serviceMoment": "preaching", "tokens": ["1(9)", "6(7#9)", "2m9", "5(13)"],
        "defaultKey": "Bb", "kind": "progression",
        "desc": "The classic turnaround. Loops back to 1.",
        "tags": ["preaching", "turnaround"],
    },
    {
        "id": "passing-walk", "name": "Passing walk 1–4–#4°–1/5", "mode": "major", "feelId": "whoop",
        "serviceMoment": "preaching", "tokens": ["I9", "IV13", "#ivdim7", "I/5", "VI7#9", "ii9", "V13"],
        "defaultKey": "G", "kind": "progression",
        "desc": "Church walk-up from 1 to 4 and back home through 6–2–5.",
        "tags": ["preaching", "walk"],
    },
    {
        "id": "minor-whoop", "name": "Minor preaching i–iv", "mode": "minor", "feelId": "whoop",
        "serviceMoment": "preaching", "tokens": ["i9", "iv9", "i9", "V7#9"],
        "defaultKey": "Fm", "kind": "progression",
        "desc": "Dark, heavy preaching hold for the minor preacher.",
        "tags": ["preaching", "minor"],
    },
    {
        "id": "minor-walk", "name": "Minor 1–6–5", "mode": "minor", "feelId": "whoop",
        "serviceMoment": "preaching", "tokens": ["i9", "bVImaj7", "V7#9", "i9"],
        "defaultKey": "Cm", "kind": "progression",
        "desc": "Minor preaching hold with a bVI lift.",
        "tags": ["preaching", "minor"],
    },
    {
        "id": "band-hits", "name": "Band hits (stabs)", "mode": "major", "feelId": "praise",
        "serviceMoment": "hits", "tokens": ["I", "IV", "I", "V7"],
        "defaultKey": "Ab", "kind": "progression",
        "desc": "Short, punched band hits that answer the preacher.",
        "tags": ["hits"], "hit": True,
    },
    {
        "id": "tune-up", "name": "Tuning up", "mode": "major", "feelId": "tuneup",
        "serviceMoment": "intro", "tokens": ["I", "IV/1", "I", "V7sus", "V7"],
        "defaultKey": "Eb", "kind": "progression",
        "desc": "Pre-sermon organ tune-up with a run into the 5 (last step is a run in the library).",
        "tags": ["preaching", "intro"], "runOn": ["V7"],
    },
    {
        "id": "altar-call", "name": "Altar call", "mode": "major", "feelId": "worship",
        "serviceMoment": "worship", "tokens": ["Imaj9", "iii7", "vi9", "ii9", "IVmaj7/5", "V7sus"],
        "defaultKey": "Db", "kind": "progression",
        "desc": "Soft worship changes for prayer and altar call.",
        "tags": ["worship"],
    },
    {
        "id": "shout-14", "name": "Shout 1–4 vamp", "mode": "major", "feelId": "shout",
        "serviceMoment": "shout", "tokens": ["I7", "IV9"],
        "defaultKey": "Ab", "kind": "shout",
        "desc": "Primary shout vamp. Ending: IV9 #ivdim7 I/5 V7#9 I9.",
        "tags": ["shout"], "bpm": 132, "beatsPerChord": 4,
        "ending": ["IV9", "#ivdim7", "I/5", "V7#9", "I9"],
        "endingBeats": [2, 2, 2, 2, 8],
        "calls": ["SHOUT!", "GIVE HIM PRAISE", "HALLELUJAH", "COME ON!"],
    },
    {
        "id": "shout-1415", "name": "Shout 1–4–1–5", "mode": "major", "feelId": "shout",
        "serviceMoment": "shout", "tokens": ["I7", "IV9", "I7", "V7#9"],
        "defaultKey": "C", "kind": "shout",
        "desc": "Shout vamp with a 5 turnaround. Ending: IV9 V7#9 I9.",
        "tags": ["shout"], "bpm": 120, "beatsPerChord": 4,
        "ending": ["IV9", "V7#9", "I9"], "endingBeats": [4, 4, 8],
        "calls": ["PRAISE HIM", "YES LORD", "THANK YOU JESUS"],
    },
    {
        "id": "shout-minor", "name": "Minor shout i–iv", "mode": "minor", "feelId": "shout",
        "serviceMoment": "shout", "tokens": ["i7", "iv9"],
        "defaultKey": "Fm", "kind": "shout",
        "desc": "Minor shout vamp. Ending: bVI7 V7#9 i9.",
        "tags": ["shout", "minor"], "bpm": 140, "beatsPerChord": 4,
        "ending": ["bVI7", "V7#9", "i9"], "endingBeats": [4, 4, 8],
        "calls": ["SHOUT!", "GLORY!", "HALLELUJAH"],
    },
    {
        "id": "shout-fast-1625", "name": "Fast shout 1–6–2–5", "mode": "major", "feelId": "fastshout",
        "serviceMoment": "shout", "tokens": ["I7", "VI7#9", "ii9", "V13"],
        "defaultKey": "Bb", "kind": "shout",
        "desc": "Full-speed 1–6–2–5 praise break. Ending: ii9 V13 I9.",
        "tags": ["shout"], "bpm": 150, "beatsPerChord": 2,
        "ending": ["ii9", "V13", "I9"], "endingBeats": [4, 4, 8],
        "calls": ["RUN!", "PRAISE BREAK", "COME ON!"],
    },
    {
        "id": "i-iv-v-bvii", "name": "Shout I7–IV7–V7–bVII7", "mode": "major", "feelId": "shout",
        "serviceMoment": "shout", "tokens": ["I7", "IV7", "V7", "bVII7"],
        "defaultKey": "Ab", "kind": "progression",
        "desc": "Root shout progression (same tokens as shout-iv-v-bvii.json).",
        "tags": ["shout", "root"],
    },
]

HOOK_ROLES = [
    ("I", "I9"),
    ("IV", "IV9"),
    ("V", "V13"),
    ("bVII", "bVII7"),
    ("ii", "ii9"),
    ("vi", "vi9"),
    ("I7", "I7"),
    ("V7#9", "V7#9"),
    ("#ivdim7", "#ivdim7"),
    ("I/5", "I/5"),
]

SETUP_TOKENS = {"V7sus", "V7", "V13", "V7#9", "5(13)"}
PASS_TOKENS = {"#ivdim7"}
HOME_TOKENS = {"I/5", "IVmaj7/5", "IV/1"}


def intensity_cue(defn: dict, token: str, idx: int) -> str:
    if defn["id"] == "band-hits":
        return "stab"
    if defn["kind"] == "shout" or defn["id"] == "i-iv-v-bvii":
        return "vamp"
    if defn["id"] == "altar-call":
        return "swell"
    if defn["id"] == "tune-up":
        return "intro" if token != "V7" else "setup"
    if token in PASS_TOKENS or "dim" in token:
        return "pass"
    if token in HOME_TOKENS:
        return "home"
    if token in SETUP_TOKENS:
        return "setup"
    tags = defn.get("tags") or []
    if "turnaround" in tags and idx >= max(0, len(defn["tokens"]) - 2):
        return "turnaround"
    return "hold"


def chart_step(token: str, tonic: int, mode: str, defn: dict, idx: int) -> dict:
    rv = resolve_voiced(token, tonic, mode)
    step = {
        "token": token,
        "symbol": rv["symbol"],
        "root": rv["root"],
        "bass": rv["bass"],
        "notesMidi": rv["notesMidi"],
        "bassMidi": rv["bassMidi"],
        "intensityCue": intensity_cue(defn, token, idx),
    }
    if defn.get("hit"):
        step["hit"] = True
    if token in (defn.get("runOn") or []):
        step["run"] = True
    return step


def key_list_for(mode: str) -> list[tuple[str, int]]:
    if mode == "minor":
        return [(key_name(t, "minor"), t) for t in range(12)]
    return [(name, t) for t, name in enumerate(KEY_NAMES)]


def build_progression(defn: dict) -> dict:
    charts = {}
    for name, tonic in key_list_for(defn["mode"]):
        charts[name] = [chart_step(tok, tonic, defn["mode"], defn, i) for i, tok in enumerate(defn["tokens"])]
    out = {
        "id": defn["id"],
        "name": defn["name"],
        "mode": defn["mode"],
        "feel": FEEL_DISPLAY[defn["feelId"]],
        "feelId": defn["feelId"],
        "serviceMoment": defn["serviceMoment"],
        "tokens": list(defn["tokens"]),
        "defaultKey": defn["defaultKey"],
        "kind": defn["kind"],
        "desc": defn["desc"],
        "tags": list(defn.get("tags") or []),
        "charts": charts,
    }
    for extra in ("bpm", "beatsPerChord", "ending", "endingBeats", "calls"):
        if extra in defn:
            out[extra] = defn[extra]
    if defn.get("ending"):
        endings = {}
        for name, tonic in key_list_for(defn["mode"]):
            endings[name] = [chart_step(tok, tonic, defn["mode"], defn, i) for i, tok in enumerate(defn["ending"])]
        out["endingCharts"] = endings
    return out


def build_hook_chords() -> dict:
    by_key = {}
    for t, name in enumerate(KEY_NAMES):
        row = []
        for role, token in HOOK_ROLES:
            rv = resolve_voiced(token, t, "major")
            row.append({
                "role": role,
                "token": token,
                "symbol": rv["symbol"],
                "root": rv["root"],
                "bass": rv["bass"],
                "notesMidi": rv["notesMidi"],
                "bassMidi": rv["bassMidi"],
            })
        by_key[name] = row
    return {
        "description": (
            "Single-tap chord vocabulary for Easy Play / the pads sequence under Follow Me "
            "(Preacher Assist). Roles are functional; tokens resolve with the same theory.ts rules "
            "(voice low=48, bassNote low=28)."
        ),
        "roles": [r for r, _ in HOOK_ROLES],
        "byKey": by_key,
    }


def build_relative_pairs() -> list:
    pairs = []
    for t, name in enumerate(KEY_NAMES):
        p = relative_minor_name(t)
        entry = {"major": p["major"], "minor": p["minor"]}
        if "conventional" in p:
            entry["conventional"] = p["conventional"]
            entry["spellingNote"] = (
                f"KEY_NAMES gospel-flat spelling is {p['minor']}; "
                f"conventional sharp-side name is {p['conventional']}."
            )
        pairs.append(entry)
    return pairs


def build_bass_walks() -> dict:
    walks_spec = [
        {
            "id": "chrom-to-5",
            "degrees": ["3", "4", "#4", "5"],
            "description": "Chromatic walkup that lands on scale degree 5 (the V root). In Ab: C Db D Eb.",
        },
        {
            "id": "chrom-to-4",
            "degrees": ["2", "#2", "3", "4"],
            "description": "Chromatic walkup that lands on scale degree 4 (the IV root). In Ab: Bb B C Db.",
        },
        {
            "id": "octave-pops",
            "degrees": None,
            "description": "Shout bass octave pops: root on the beat, octave above on the off-beat.",
        },
        {
            "id": "ghost-shout",
            "degrees": ["1", "1", "1", "2", "1", "b7", "1", "2"],
            "description": "Dense shout bass: sounded roots on the 8ths, low-velocity ghost neighbors on the 16ths.",
        },
    ]
    out = []
    for spec in walks_spec:
        example = {}
        for t, name in enumerate(KEY_NAMES):
            if spec["id"] == "octave-pops":
                root = bass_pc(t, 28)
                example[name] = [root, root + 12, root, root + 12]
            elif spec["id"] == "ghost-shout":
                example[name] = [midi_for_degree(t, d) for d in spec["degrees"]]
            else:
                example[name] = walk_midi(t, spec["degrees"])
        item = {
            "id": spec["id"],
            "description": spec["description"],
            "source": "shout-iv-v-bvii.json",
            "exampleMidi": example,
        }
        if spec["degrees"] and spec["id"] != "octave-pops":
            item["degrees"] = spec["degrees"]
        out.append(item)
    return {
        "relativeTo": "key",
        "description": (
            "Degree numbers are of the current MAJOR key. Reused from shout-iv-v-bvii.json "
            "(chrom-to-5, chrom-to-4, octave-pops, ghost-shout) with MIDI examples in all 12 keys. "
            "bass floor 28, same algorithm as theory.ts bassNote(ch, 28)."
        ),
        "walks": out,
    }


def build_organ_run_cues() -> list:
    return [
        {
            "id": "mixo-down",
            "minLevel": 3,
            "lane": "shout",
            "description": "Descending Mixolydian run from the tonic (8 eighths). Use at Shout 3–4.",
        },
        {
            "id": "blues-fill",
            "minLevel": 4,
            "lane": "shout",
            "description": "Blues-scale fill (generic vocabulary, not a quoted lick). Peak shout only.",
        },
        {
            "id": "gliss-up",
            "minLevel": 3,
            "lane": "shout",
            "description": "Short chromatic gliss into the next downbeat. Shout 3–4.",
        },
        {
            "id": "talk-stab",
            "minLevel": 2,
            "lane": "shout",
            "description": "Organ-talk call-and-response stabs (I answers IV). Available from Shout 2 up.",
        },
    ]


def intensity_wiring() -> dict:
    return {
        "shoutLevel": {
            "1": {
                "name": "Light shout / breakdown floor",
                "chordDensity": "triads/add9",
                "bass": "roots",
                "drums": "light",
                "organ": "pads",
                "harmonicRhythm": "1/bar",
            },
            "2": {
                "name": "Call and lift",
                "chordDensity": "dom7/9",
                "bass": "quarters + light walk into 4",
                "drums": "hats and clap",
                "organ": "held stabs + talk-stab ok",
                "harmonicRhythm": "1/bar",
            },
            "3": {
                "name": "Build",
                "chordDensity": "dom7/9/13",
                "bass": "chromatic into 4 and 5",
                "drums": "snare in, 8ths",
                "organ": "comments; mixo-down / gliss-up every 8 bars",
                "harmonicRhythm": "1–2/bar",
            },
            "4": {
                "name": "Full shout / storefront",
                "chordDensity": "dom7/9/13/#9",
                "bass": "8ths+ghosts+chrom walks",
                "drums": "full shout storefront",
                "organ": "runs every 4 bars",
                "harmonicRhythm": "2/bar ok",
            },
        },
        "worshipLevel": {
            "1": {
                "name": "Prayer pad",
                "chordDensity": "triads / sparse maj9",
                "bass": "roots, long tones",
                "drums": "off or swell only",
                "organ": "pads",
                "harmonicRhythm": "1/bar or longer",
            },
            "2": {
                "name": "Soft altar",
                "chordDensity": "add9 / maj9",
                "bass": "gentle roots and fifths",
                "drums": "light kit, no shout snare",
                "organ": "pads, almost no runs",
                "harmonicRhythm": "1/bar",
            },
            "3": {
                "name": "Congregational worship",
                "chordDensity": "9ths and sus",
                "bass": "walking quarters",
                "drums": "praise kit, medium",
                "organ": "light comments",
                "harmonicRhythm": "1/bar",
            },
            "4": {
                "name": "Full worship lift",
                "chordDensity": "9/11/13, still not shout #9 density",
                "bass": "motion without ghost-shout density",
                "drums": "full worship band",
                "organ": "comments, reserved runs",
                "harmonicRhythm": "1/bar (2/bar only at cadence)",
            },
        },
        "playerNotes": {
            "shoutLevelRange": "0 = off, 1–4 active (PulpitPlayer.setShout)",
            "worshipLevelRange": "0 = off, 1–4 active (PulpitPlayer.setWorship)",
            "exclusive": "Setting shoutLevel > 0 clears worshipLevel, and vice versa.",
            "renderScale": "Math.max(shoutLevel, worshipLevel) / 4 feeds drumBar; chord samples use Math.max(shoutLevel, worshipLevel, 1) / 4.",
            "olderFiveLevelMap": (
                "chord-maps/shout-iv-v-bvii.json intensityMap used a design overlay of 1–5. "
                "Follow Me should ship Shout 1–4 and Worship 1–4 to match the player. Do not add a fifth detent unless Lawrence asks."
            ),
        },
        "howMapsFeedEngine": (
            "Easy Play advances progression.steps; setKey() re-resolves tokens via chordIn; "
            "shoutLevel/worshipLevel scale renderChord/drumBar intensity (level/4); "
            "Follow Voice may nudge shout/worship. Chord-map JSON supplies tokens + resolved MIDI "
            "for all 12 keys so Follow Me (module src/pulpit/PulpitPlayer) / the sequencer can skip "
            "live theory if desired. Look up progressions[id].charts[keyName] (minor progressions "
            "use parallel-minor names: Fm, Cm, …). Hook chords are hookChords.byKey[keyName]."
        ),
    }


def naming_block() -> dict:
    return {
        "official": FEATURE,
        "subtitle": SUBTITLE,
        "preachingFeel": "Preaching hold",
        "easyPlay": "Easy Play",
        "shoutLevels": "Shout 1–4",
        "worshipLevels": "Worship 1–4",
        "followVoice": "Follow Voice",
        "legacyCodeModule": "src/pulpit/",
        "legacyUiTitle": "PULPIT",
        "legacyInternalFeelId": "whoop",
        "legacyNote": (
            "The code module is still src/pulpit/ and the current UI title is PULPIT "
            "(see MANUAL.md and src/pulpit/ui.ts) until Sanctum Build renames the chrome to "
            "Follow Me with subtitle Preacher Assist. Internal library feel id `whoop` may remain; "
            "user-facing feel label is Preaching hold. Do not brand the feature Sanctum Pulpit "
            "in new UI copy."
        ),
        "doNotUseInUI": [
            "Whoop Triggerz",
            "Whoop Trigger",
            "Whoop Triggerz Plus",
            "Hook Trigger",
        ],
        "discouragedAlias": (
            "“Hook Trigger” is not an official name. Prefer Easy Play (tap-next-chord) "
            "plus Shout/Worship levels."
        ),
    }


def build_charts_json(progressions: list) -> dict:
    return {
        "version": 1,
        "source": "beat-theory",
        "feature": FEATURE,
        "featureSubtitle": SUBTITLE,
        "created": CREATED,
        "assumptions": [
            "No custom chord list attached; used src/pulpit/library.ts (Follow Me content) + shout I-IV-V-bVII",
            "Tokens and defaults copied from src/pulpit/library.ts PROGRESSIONS and SHOUT_SETS (generic gospel harmony, not song transcriptions).",
            "Voicings from src/pulpit/theory.ts chordIn + voice(low=48) + bassNote(low=28).",
            "Band-hits '!' and tune-up '~' are performance flags (hit/run), not chord qualities.",
            "Minor progressions are charted in the 12 parallel minor keys (Cm, Dbm, … Bm) using KEY_NAMES spelling.",
        ],
        "naming": naming_block(),
        "intensityWiring": intensity_wiring(),
        "relativePairs": build_relative_pairs(),
        "voicingRegister": {
            "closeVoicing": "voice(ch, 48) — notes sit ~48–72",
            "bass": "bassNote(ch, 28) — notes sit 28–39",
            "keyNames": KEY_NAMES,
            "gospelFlatSpelling": True,
        },
        "progressions": progressions,
        "hookChords": build_hook_chords(),
        "bassWalks": build_bass_walks(),
        "organRunCues": build_organ_run_cues(),
    }


def midi_name(n: int) -> str:
    pc = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
    return f"{pc[n % 12]}{n // 12 - 1}"


def example_line(prog: dict) -> str:
    preview_key = prog["defaultKey"]
    if preview_key not in prog["charts"]:
        preview_key = "Ab" if prog["mode"] == "major" else "Fm"
        if preview_key not in prog["charts"]:
            preview_key = next(iter(prog["charts"]))
    steps = prog["charts"][preview_key]
    spelled = " – ".join(f"{s['token']}={s['symbol']}" for s in steps)
    return spelled, preview_key


def write_charts_md(progressions: list) -> str:
    lines = []
    a = lines.append
    a("# Follow Me — 12-key chart summary")
    a("")
    a(f"**Feature:** {FEATURE}  ")
    a(f"**Subtitle:** {SUBTITLE}  ")
    a("**Preaching feel:** Preaching hold  ")
    a("**Tap-next-chord:** Easy Play  ")
    a("**Voice auto-follow:** Follow Voice  ")
    a("**Intensity:** Shout 1–4 and Worship 1–4")
    a("")
    a("Full MIDI for every key lives in [`pulpit-12key-charts.json`](pulpit-12key-charts.json).")
    a("The in-app module is still `src/pulpit/` and the current UI title is PULPIT until Sanctum Build")
    a("renames it to Follow Me / Preacher Assist. Do not ship Whoop Triggerz branding.")
    a("")
    a("## Relative major / minor pairs")
    a("")
    a("| Major | Relative minor | Conventional sharp-side name |")
    a("|---|---|---|")
    for p in build_relative_pairs():
        a(f"| {p['major']} | {p['minor']} | {p.get('conventional', '—')} |")
    a("")
    a("Every third stop around the circle of fifths is still just “a major and its relative minor”")
    a("(C/Am, G/Em, D/Bm, …). Gospel key spelling uses flats everywhere except F#.")
    a("")
    a("## Progressions")
    a("")
    a("| ID | Name | Moment | Feel | Tokens | Example (default key) |")
    a("|---|---|---|---|---|---|")
    for p in progressions:
        spelled, key = example_line(p)
        tokens = " ".join(p["tokens"])
        a(f"| `{p['id']}` | {p['name']} | {p['serviceMoment']} | {p['feel']} | `{tokens}` | {key}: {spelled} |")
    a("")
    a("Minor progressions (`minor-whoop`, `minor-walk`, `shout-minor`) chart all 12 parallel minored")
    a("KEY_NAMES (Cm, Dbm, Dm, … Bm). Major progressions chart C, Db, D, Eb, E, F, F#, G, Ab, A, Bb, B.")
    a("")
    a("### Ab Preaching 1–4 (`whoop-14`)")
    a("")
    whoop = next(p for p in progressions if p["id"] == "whoop-14")
    a("| Token | Symbol | notesMidi | bassMidi | Cue |")
    a("|---|---|---|---|---|")
    for s in whoop["charts"]["Ab"]:
        notes = ", ".join(f"{n}={midi_name(n)}" for n in s["notesMidi"])
        a(f"| {s['token']} | {s['symbol']} | {s['notesMidi']} ({notes}) | {s['bassMidi']} ({midi_name(s['bassMidi'])}) | {s['intensityCue']} |")
    a("")
    a("### Ab shout root (`i-iv-v-bvii`)")
    a("")
    root = next(p for p in progressions if p["id"] == "i-iv-v-bvii")
    a("| Token | Symbol | notesMidi | bassMidi | Cue |")
    a("|---|---|---|---|---|")
    for s in root["charts"]["Ab"]:
        notes = ", ".join(f"{n}={midi_name(n)}" for n in s["notesMidi"])
        a(f"| {s['token']} | {s['symbol']} | {s['notesMidi']} ({notes}) | {s['bassMidi']} ({midi_name(s['bassMidi'])}) | {s['intensityCue']} |")
    a("")
    a("## Intensity swell cues")
    a("")
    a("PulpitPlayer stores `shoutLevel` and `worshipLevel` as 0 (off) plus 1–4. Setting one lane")
    a("clears the other. Audio intensity is `level/4`.")
    a("")
    a("### Shout 1–4")
    a("")
    a("| Level | Chord density | Bass | Drums | Organ | Harmonic rhythm |")
    a("|---|---|---|---|---|---|")
    wiring = intensity_wiring()["shoutLevel"]
    for i in ("1", "2", "3", "4"):
        lv = wiring[i]
        a(f"| {i} {lv['name']} | {lv['chordDensity']} | {lv['bass']} | {lv['drums']} | {lv['organ']} | {lv['harmonicRhythm']} |")
    a("")
    a("### Worship 1–4")
    a("")
    a("| Level | Chord density | Bass | Drums | Organ | Harmonic rhythm |")
    a("|---|---|---|---|---|---|")
    wiring = intensity_wiring()["worshipLevel"]
    for i in ("1", "2", "3", "4"):
        lv = wiring[i]
        a(f"| {i} {lv['name']} | {lv['chordDensity']} | {lv['bass']} | {lv['drums']} | {lv['organ']} | {lv['harmonicRhythm']} |")
    a("")
    a("Organ-run minimum shout levels: talk-stab ≥ 2, mixo-down ≥ 3, gliss-up ≥ 3, blues-fill ≥ 4.")
    a("")
    a("## How this feeds Easy Play")
    a("")
    a("1. User picks a progression (or the pads sequence) and a key.")
    a("2. Easy Play advances `steps` and sounds `charts[key][stepIndex]` (or live `chordIn` if the engine prefers).")
    a("3. `setKey()` retargets the same Roman/Nashville tokens; MIDI in this file is the already-resolved form.")
    a("4. Shout/Worship 1–4 scale voicing density, bass motion, drums, and organ runs as in the tables above.")
    a("5. Follow Voice may nudge those levels; it does not replace Easy Play.")
    a("")
    return "\n".join(lines) + "\n"


def write_naming_md() -> str:
    return f"""# Follow Me naming (Preacher Assist)

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
"""


def write_handoff_md(progressions: list) -> str:
    ids = ", ".join(f"`{p['id']}`" for p in progressions)
    return f"""# Handoff — Sanctum Build: load Follow Me 12-key charts

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

Progressions in the JSON ({len(progressions)}): {ids}.

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
"""


def write_preview(progressions: list, charts: dict) -> str:
    whoop = next(p for p in progressions if p["id"] == "whoop-14")
    root = next(p for p in progressions if p["id"] == "i-iv-v-bvii")
    lines = []
    a = lines.append
    a("FOLLOW ME / PREACHER ASSIST — Ab preview")
    a("=" * 56)
    a("Official: Follow Me    Subtitle: Preacher Assist")
    a("Feel: Preaching hold    Control: Easy Play    Voice: Follow Voice")
    a("Intensity: Shout 1–4 / Worship 1–4")
    a("Do not use in UI: Whoop Triggerz, Whoop Trigger, Hook Trigger")
    a("Legacy code: src/pulpit/   Legacy UI title: PULPIT (rename pending)")
    a("")
    a("1) whoop-14  Preaching 1–4  in Ab")
    a(f"   Tokens: {' – '.join(whoop['tokens'])}")
    for s in whoop["charts"]["Ab"]:
        notes = " ".join(f"{n}={midi_name(n)}" for n in s["notesMidi"])
        a(f"   {s['token']:<6} {s['symbol']:<6}  notes [{notes}]")
        a(f"          bass {s['bassMidi']} ({midi_name(s['bassMidi'])})  cue={s['intensityCue']}")
    a("")
    a("2) i-iv-v-bvii  I7–IV7–V7–bVII7  in Ab")
    a(f"   Tokens: {' – '.join(root['tokens'])}")
    for s in root["charts"]["Ab"]:
        notes = " ".join(f"{n}={midi_name(n)}" for n in s["notesMidi"])
        a(f"   {s['token']:<6} {s['symbol']:<6}  notes [{notes}]")
        a(f"          bass {s['bassMidi']} ({midi_name(s['bassMidi'])})  cue={s['intensityCue']}")
    a("   Relative minor of Ab = Fm")
    walk = charts["bassWalks"]["walks"][0]["exampleMidi"]["Ab"]
    a(f"   Walk into V (3-4-#4-5): C Db D Eb  MIDI {walk}")
    a("")
    a("3) Intensity map (shoutLevel / worshipLevel → substance)")
    a("   Shout 1: triads/add9, roots, light drums, pads, 1/bar")
    a("   Shout 2: dom7/9, quarters + light walk into 4, hats/clap, talk-stab ok, 1/bar")
    a("   Shout 3: dom7/9/13, chrom into 4 and 5, snare in, organ comments, 1–2/bar")
    a("   Shout 4: dom7/9/13/#9, 8ths+ghosts+chrom walks, full storefront, runs / 4 bars, 2/bar ok")
    a("   Worship 1: sparse maj9 / triads, long-tone roots, drums off or swell, pads")
    a("   Worship 2: add9/maj9, gentle fifths, light kit, pads")
    a("   Worship 3: 9ths and sus, walking quarters, praise kit, light organ")
    a("   Worship 4: 9/11/13 (not shout #9 density), motion without ghost-shout, full worship band")
    a("   Player scale: intensity = level/4. Shout and worship lanes are exclusive.")
    a("=" * 56)
    return "\n".join(lines) + "\n"


PULPIT_BT_EXTRAS = [
    {"id": "whoop-14", "tokens": ["I9", "IV9", "I9", "IV9"], "mode": "major", "label": "Preaching 1–4 (Follow Me)"},
    {"id": "whoop-145", "tokens": ["I", "IV9", "I", "V7sus", "V7"], "mode": "major", "label": "Preaching 1–4–1–5"},
    {"id": "two-five-one", "tokens": ["ii9", "V13", "Imaj9", "I7"], "mode": "major", "label": "2–5–1 resolve"},
    {"id": "one-six-two-five", "tokens": ["1(9)", "6(7#9)", "2m9", "5(13)"], "mode": "major", "label": "1–6–2–5 turnaround"},
    {"id": "passing-walk", "tokens": ["I9", "IV13", "#ivdim7", "I/5", "VI7#9", "ii9", "V13"], "mode": "major", "label": "Passing walk 1–4–#4°–1/5"},
    {"id": "minor-whoop", "tokens": ["i9", "iv9", "i9", "V7#9"], "mode": "minor", "label": "Minor preaching i–iv"},
    {"id": "minor-walk", "tokens": ["i9", "bVImaj7", "V7#9", "i9"], "mode": "minor", "label": "Minor 1–6–5"},
    {"id": "band-hits", "tokens": ["I", "IV", "I", "V7"], "mode": "major", "label": "Band hits (stabs)"},
    {"id": "tune-up", "tokens": ["I", "IV/1", "I", "V7sus", "V7"], "mode": "major", "label": "Tuning up"},
    {"id": "altar-call", "tokens": ["Imaj9", "iii7", "vi9", "ii9", "IVmaj7/5", "V7sus"], "mode": "major", "label": "Altar call"},
    {"id": "shout-14", "tokens": ["I7", "IV9"], "mode": "major", "label": "Shout 1–4 vamp"},
    {"id": "shout-1415", "tokens": ["I7", "IV9", "I7", "V7#9"], "mode": "major", "label": "Shout 1–4–1–5"},
    {"id": "shout-minor", "tokens": ["i7", "iv9"], "mode": "minor", "label": "Minor shout i–iv"},
    {"id": "shout-fast-1625", "tokens": ["I7", "VI7#9", "ii9", "V13"], "mode": "major", "label": "Fast shout 1–6–2–5"},
]


def update_beat_theory_maps() -> tuple[int, int]:
    if not OUT_BT.exists():
        raise SystemExit(f"missing {OUT_BT}")
    bt = json.loads(OUT_BT.read_text())
    have = {p["id"] for p in bt["progressions"]}
    added = 0
    for extra in PULPIT_BT_EXTRAS:
        if extra["id"] not in have:
            bt["progressions"].append(extra)
            have.add(extra["id"])
            added += 1
    # i-iv-v-bvii should already exist; ensure it does
    if "i-iv-v-bvii" not in have:
        bt["progressions"].append({
            "id": "i-iv-v-bvii",
            "tokens": ["I7", "IV7", "V7", "bVII7"],
            "mode": "major",
            "label": "Shout I7–IV7–V7–bVII7",
        })
        added += 1
    bt["note"] = (
        "Chords / Follow Me drop-in consumed by src/chords/theory-ext.ts loadBeatTheoryMaps(). "
        "Richer engine-facing maps: chord-maps/shout-iv-v-bvii.json (shout patterns) and "
        "chord-maps/pulpit-12key-charts.json (Follow Me / Preacher Assist 12-key charts). "
        "User-facing name is Follow Me (subtitle Preacher Assist); module path remains src/pulpit/."
    )
    OUT_BT.write_text(json.dumps(bt, indent=2) + "\n")
    return added, len(bt["progressions"])


def patch_readme() -> None:
    if not OUT_README.exists():
        return
    text = OUT_README.read_text()
    marker = "[`shout-iv-v-bvii.json`]"
    inject = (
        "| [`pulpit-12key-charts.json`](pulpit-12key-charts.json) | Follow Me (Preacher Assist) / Easy Play | "
        "12-key charts for every library progression and shout vamp, hook chords, bass walks, "
        "organ-run cues, and Shout/Worship 1–4 intensity wiring. Official name is Follow Me, not PULPIT / Whoop Triggerz. |\n"
    )
    if "pulpit-12key-charts.json" in text:
        return
    # Insert a row after the table header block — specifically before shout row or after it
    needle = "| [`shout-iv-v-bvii.json`]"
    if needle in text:
        text = text.replace(needle, inject.rstrip() + "\n" + needle, 1)
        # Mention companion docs
        extra = (
            "\nFollow Me (Preacher Assist) writeup: [`PULPIT_NAMING.md`](PULPIT_NAMING.md), "
            "chart summary [`PULPIT_CHARTS.md`](PULPIT_CHARTS.md), "
            "Sanctum Build handoff [`HANDOFF_SANCTUM_BUILD.md`](HANDOFF_SANCTUM_BUILD.md), "
            "preview [`PREVIEW_PULPIT.txt`](PREVIEW_PULPIT.txt).\n"
        )
        if "PULPIT_NAMING.md" not in text:
            text = text.replace("Service-moment writeup:", extra + "\nService-moment writeup:")
        OUT_README.write_text(text)


def main() -> None:
    # Guard: every library token must parse
    for defn in PROGRESSION_DEFS:
        mode = defn["mode"]
        tonic = parse_key(defn["defaultKey"])["tonic"]
        for tok in defn["tokens"] + list(defn.get("ending") or []):
            chord_in(tok, tonic, mode)

    progressions = [build_progression(d) for d in PROGRESSION_DEFS]
    charts = build_charts_json(progressions)

    # Built-in sanity
    ab14 = next(p for p in progressions if p["id"] == "whoop-14")["charts"]["Ab"]
    assert [s["symbol"] for s in ab14] == ["Ab9", "Db9", "Ab9", "Db9"], [s["symbol"] for s in ab14]
    ab_root = next(p for p in progressions if p["id"] == "i-iv-v-bvii")["charts"]["Ab"]
    assert [s["symbol"] for s in ab_root] == ["Ab7", "Db7", "Eb7", "Gb7"]
    assert charts["naming"]["official"] == FEATURE
    assert FEATURE == "Follow Me"
    assert charts["featureSubtitle"] == "Preacher Assist"
    majors = [p for p in progressions if p["mode"] == "major"]
    minors = [p for p in progressions if p["mode"] == "minor"]
    for p in majors:
        missing = [k for k in KEY_NAMES if k not in p["charts"]]
        assert not missing, (p["id"], missing)
    for p in minors:
        expect = [key_name(t, "minor") for t in range(12)]
        missing = [k for k in expect if k not in p["charts"]]
        assert not missing, (p["id"], missing)
    assert len(progressions) == 15

    OUT_CHARTS.write_text(json.dumps(charts, indent=2) + "\n")
    OUT_NAMING.write_text(write_naming_md())
    OUT_CHARTS_MD.write_text(write_charts_md(progressions))
    OUT_HANDOFF.write_text(write_handoff_md(progressions))
    OUT_PREVIEW.write_text(write_preview(progressions, charts))
    added, total = update_beat_theory_maps()
    patch_readme()

    print(f"Wrote {OUT_CHARTS} ({OUT_CHARTS.stat().st_size} bytes)")
    print(f"Wrote {OUT_NAMING}")
    print(f"Wrote {OUT_CHARTS_MD}")
    print(f"Wrote {OUT_HANDOFF}")
    print(f"Wrote {OUT_PREVIEW}")
    print(f"Updated {OUT_BT} (added {added} progressions, now {total})")
    print(f"progressions={len(progressions)} major={len(majors)} minor={len(minors)}")
    print("Ab whoop-14:", " – ".join(f"{s['token']}={s['symbol']}" for s in ab14))
    print("Ab i-iv-v-bvii:", " – ".join(f"{s['token']}={s['symbol']}" for s in ab_root))
    print("naming:", charts["naming"]["official"], "/", charts["featureSubtitle"])


if __name__ == "__main__":
    main()
