#!/usr/bin/env python3
"""Validate Sanctum shout chord-maps and print a one-page Ab shout-full-break preview."""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MAP = HERE / "shout-iv-v-bvii.json"
BT = HERE.parent / "content" / "theory" / "beat-theory-maps.json"
PREVIEW = HERE / "PREVIEW.txt"
EXPECTED_IDS = [
    "shout-call-response", "shout-build", "shout-full-break", "shout-breakdown",
    "shout-storefront", "shout-walk-home", "shout-modulate-up", "shout-relative-flip",
]
PULPIT_CHARTS = HERE / "pulpit-12key-charts.json"
PREVIEW_PULPIT = HERE / "PREVIEW_PULPIT.txt"
PULPIT_IDS = [
    "whoop-14", "whoop-145", "two-five-one", "one-six-two-five", "passing-walk",
    "minor-whoop", "minor-walk", "band-hits", "tune-up", "altar-call",
    "shout-14", "shout-1415", "shout-minor", "shout-fast-1625", "i-iv-v-bvii",
]
RELATIVE_PAIRS = [
    ("C", "Am"), ("Db", "Bbm"), ("D", "Bm"), ("Eb", "Cm"), ("E", "Dbm"), ("F", "Dm"),
    ("F#", "Ebm"), ("G", "Em"), ("Ab", "Fm"), ("A", "F#m"), ("Bb", "Gm"), ("B", "Abm"),
]
KEY_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
PC = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]


def midi_name(n: int) -> str:
    return f"{PC[n % 12]}{n // 12 - 1}"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def validate_shout(data: dict) -> list[str]:
    notes = []
    keys = data.get("keys") or []
    if len(keys) != 12:
        fail(f"expected 12 keys, got {len(keys)}")
    names = [k["name"] for k in keys]
    if names != KEY_NAMES:
        fail(f"key names {names} != {KEY_NAMES}")
    for i, k in enumerate(keys):
        if k["tonic"] != i:
            fail(f"{k['name']} tonic {k['tonic']} != {i}")
        if k["relativeMinor"]["tonic"] != (i + 9) % 12:
            fail(f"{k['name']} relative tonic wrong")
    notes.append("12 keys with relative minors: OK")

    ab = next(k for k in keys if k["name"] == "Ab")
    if ab["relativeMinor"]["name"] != "Fm":
        fail(f"Ab relative is {ab['relativeMinor']}, expected Fm")
    notes.append("Ab relative minor = Fm: OK")

    resolved = data.get("resolvedAllKeys") or data["progressionRoot"]["resolved"]
    abch = resolved["Ab"]
    got = [(c["token"], c["name"]) for c in abch]
    want = [("I7", "Ab7"), ("IV7", "Db7"), ("V7", "Eb7"), ("bVII7", "Gb7")]
    if got != want:
        fail(f"Ab resolution {got} != {want}")
    if (abch[2]["root"] + 6) % 12 != 9:
        fail("tritone of Eb7 should be A (pc 9)")
    notes.append("Ab I7=Ab7 IV7=Db7 V7=Eb7 bVII7=Gb7; tritone of V7 = A7: OK")

    walk = data["theoryNotes"]["abCheck"]["walkIntoV"]
    if walk["midi"] != [36, 37, 38, 39] or walk["names"] != ["C", "Db", "D", "Eb"]:
        fail(f"walk into V in Ab unexpected: {walk}")
    notes.append("Walk into V in Ab (3-4-#4-5) = C Db D Eb MIDI [36,37,38,39]: OK")

    patterns = data.get("patterns") or []
    if len(patterns) != 8:
        fail(f"expected 8 patterns, got {len(patterns)}")
    ids = [p["id"] for p in patterns]
    if ids != EXPECTED_IDS:
        fail(f"pattern ids {ids} != {EXPECTED_IDS}")
    for p in patterns:
        for field in ("id", "name", "serviceMoment", "bpmRange", "defaultKey",
                      "tokens", "bars", "beatsPerBar", "padTriggers", "variationRules",
                      "resolvedPreview", "intensity"):
            if field not in p:
                fail(f"{p.get('id')} missing {field}")
        if p["beatsPerBar"] != 4:
            fail(f"{p['id']} beatsPerBar != 4")
        trigs = p["padTriggers"]
        midi = {t["midiNote"] for t in trigs}
        missing = set(range(36, 52)) - midi
        if missing:
            fail(f"{p['id']} padTriggers missing MIDI notes {sorted(missing)}")
        for t in trigs:
            for f in ("pad", "midiNote", "globalPad", "label", "role", "triggers"):
                if f not in t:
                    fail(f"{p['id']} padTrigger missing {f}")
            if not (36 <= t["midiNote"] <= 51):
                fail(f"{p['id']} midiNote {t['midiNote']} outside 36-51")
            if "bank" in t:
                bi = t.get("bankIndex", "ABCDEFGH".index(t["bank"]))
                expect = bi * 16 + (t["pad"] - 1)
                if t["globalPad"] != expect:
                    fail(f"{p['id']} globalPad {t['globalPad']} != {expect}")
        prev = p["resolvedPreview"]
        if not prev.get("variationA") or not prev.get("variationB"):
            fail(f"{p['id']} preview needs variationA and variationB")
    notes.append("8 patterns, each with padTriggers covering MIDI 36-51 and two preview variations: OK")

    if len(data.get("voicings") or {}) < 6:
        fail("expected at least the specified voicings")
    if len(data.get("bassWalks") or []) != 5:
        fail(f"expected 5 bass walks, got {len(data.get('bassWalks') or [])}")
    if len(data.get("organRuns") or []) < 4:
        fail("expected at least 4 organ runs")
    banks = data["midiPadMap"]["banks"]
    if len(banks) != 8:
        fail(f"expected 8 banks, got {len(banks)}")
    for i, b in enumerate(banks):
        if len(b["pads"]) != 16:
            fail(f"bank {b.get('letter')} has {len(b['pads'])} pads")
        if b["index"] != i or b["letter"] != "ABCDEFGH"[i]:
            fail(f"bank index/letter mismatch {b}")
        for j, pad in enumerate(b["pads"]):
            if pad["midiNote"] != 36 + j or pad["globalPad"] != i * 16 + j:
                fail(f"bank {b['letter']} pad {pad} indexing wrong")
    notes.append("8 banks x 16 pads, MIDI 36-51, globalPad = bank*16+padIndex: OK")
    return notes


def validate_beat_theory(bt: dict) -> list[str]:
    notes = []
    for key in ("version", "source", "progressions", "subs", "markov"):
        if key not in bt:
            fail(f"beat-theory-maps.json missing {key}")
    if bt["source"] != "beat-theory":
        fail(f"source {bt['source']!r} != 'beat-theory'")
    if not isinstance(bt["version"], int):
        fail("version must be int")
    if not bt["progressions"]:
        fail("progressions empty")
    if not bt["subs"]:
        fail("subs empty")
    if not bt["markov"]:
        fail("markov empty")
    for p in bt["progressions"]:
        for f in ("id", "tokens", "mode"):
            if f not in p:
                fail(f"progression {p} missing {f}")
    for s in bt["subs"]:
        for f in ("id", "from", "to", "label"):
            if f not in s:
                fail(f"sub {s} missing {f}")
    shout_ids = set(EXPECTED_IDS) | {"i-iv-v-bvii", "2-5-1", "1-6-2-5"}
    pulpit_ids = set(PULPIT_IDS)
    have = {p["id"] for p in bt["progressions"]}
    missing = (shout_ids | pulpit_ids) - have
    if missing:
        fail(f"beat-theory progressions missing {missing}")
    notes.append(
        f"beat-theory-maps.json loadable: version={bt['version']} source={bt['source']} "
        f"progressions={len(bt['progressions'])} subs={len(bt['subs'])} markov_rows={len(bt['markov'])}"
    )
    return notes


def preview_full_break(data: dict) -> str:
    p = next(x for x in data["patterns"] if x["id"] == "shout-full-break")
    ab = data["resolvedAllKeys"]["Ab"]
    walk = data["theoryNotes"]["abCheck"]["walkIntoV"]
    lines = []
    a = lines.append
    a("SANCTUM / BEAT THEORY — shout-full-break in Ab")
    a("=" * 56)
    a(f"Pattern:    {p['name']}  ({p['id']})")
    a(f"Moment:     {p['serviceMoment']}            Intensity: {p['intensity']}")
    a(f"BPM:        {p['bpmRange'][0]}–{p['bpmRange'][1]} (default {p.get('defaultBpm', p['bpmRange'][0])})")
    a(f"Key:        Ab major   relative minor: Fm")
    a(f"Tokens:     {' – '.join(p['tokens'])}")
    a(f"Form:       {p['form']}")
    a("")
    a("Resolved close dom7 (voice() low=48, ~48–72) and bass (bassNote() low=28):")
    for c in ab:
        notes = " ".join(f"{n}={midi_name(n)}" for n in c["notesMidi"])
        alt = c.get("bassMidiOct")
        extra = f"   alt +12 = {alt} ({midi_name(alt)})" if alt else ""
        a(f"  {c['token']:<6} {c['name']:<5}  root {c['root']:>2}   notes [{notes}]")
        a(f"         bass {c['bassMidi']} ({midi_name(c['bassMidi'])}){extra}")
    a("  Tritone of V7 (Eb7) = A7")
    a(f"  Walk into V (key degrees { '-'.join(walk['degrees']) }): "
      f"{' '.join(walk['names'])}  MIDI {walk['midi']}")
    a("")
    a("8-bar cycle — variation A (bars 1–4) is not variation B (bars 5–8):")

    def dump(label, rows):
        a(f"  {label}")
        for r in rows:
            run = f"  organ:{r['organRun']}" if r.get("organRun") else ""
            walk_s = f"  walk:{r['walkMidi']}" if r.get("walkMidi") else ""
            a(f"    bar {r['bar']} ({r['beats']} beats)  {r['token']:<7} {r['name']:<7}  "
              f"voicing={r['voicing']:<12} bass={r['bassMidi']} ({midi_name(r['bassMidi'])})  "
              f"{r['bassWalk']}{walk_s}{run}")
            a(f"      notesMidi {r['notesMidi']}  ({', '.join(midi_name(n) for n in r['notesMidi'])})")

    dump("Variation A", p["resolvedPreview"]["variationA"])
    dump("Variation B", p["resolvedPreview"]["variationB"])
    a("")
    a("Anti-repetition: close organ 7 vs 9/13/7#9; octave-pops vs ghost-shout;")
    a("organ mixo-down on bar 4, blues-fill on bar 8. Engine also rotates voicing,")
    a("bass walk, and (every 4/8 bars) organ run so no identical bar reprints inside 4 bars.")
    a("")
    a("Pad surface: Bank E perc covers MIDI 36–51 (kick/snare/storefront snare/clap/hats…).")
    a("Bank C pads 1–4 = I7 IV7 V7 bVII7 organ stabs (in-bank notes 36–39, globalPad 32–35).")
    a("Bank D = bass walks. Bank G = organ runs. Bank A pad 3 launches this pattern.")
    a("=" * 56)
    return "\n".join(lines) + "\n"


def validate_pulpit(data: dict) -> list[str]:
    notes = []
    naming = data.get("naming") or {}
    if data.get("feature") != "Follow Me":
        fail(f"feature {data.get('feature')!r} != 'Follow Me'")
    if data.get("featureSubtitle") != "Preacher Assist":
        fail(f"featureSubtitle {data.get('featureSubtitle')!r} != 'Preacher Assist'")
    if naming.get("official") != "Follow Me":
        fail(f"naming.official {naming.get('official')!r} != 'Follow Me'")
    if naming.get("subtitle") != "Preacher Assist":
        fail(f"naming.subtitle {naming.get('subtitle')!r} != 'Preacher Assist'")
    if naming.get("preachingFeel") != "Preaching hold":
        fail("preachingFeel must be Preaching hold")
    if naming.get("easyPlay") != "Easy Play":
        fail("easyPlay must be Easy Play")
    banned = ["Whoop Triggerz", "Whoop Trigger", "Whoop Triggerz Plus"]
    ui_ban = naming.get("doNotUseInUI") or []
    for b in banned:
        if b not in ui_ban:
            fail(f"doNotUseInUI missing {b}")
    notes.append("Follow Me / Preacher Assist naming (no Whoop Triggerz in official label): OK")

    pairs = data.get("relativePairs") or []
    got = [(p["major"], p["minor"]) for p in pairs]
    if got != list(RELATIVE_PAIRS):
        fail(f"relativePairs {got} != {list(RELATIVE_PAIRS)}")
    notes.append("12 relative major/minor pairs: OK")

    progs = data.get("progressions") or []
    ids = [p["id"] for p in progs]
    if ids != PULPIT_IDS:
        fail(f"pulpit progression ids {ids} != {PULPIT_IDS}")
    for p in progs:
        if p["mode"] == "major":
            missing = [k for k in KEY_NAMES if k not in (p.get("charts") or {})]
            if missing:
                fail(f"{p['id']} missing major keys {missing}")
            if len(p["charts"]) != 12:
                fail(f"{p['id']} expected 12 keys, got {len(p['charts'])}")
        else:
            expect = [k + "m" for k in KEY_NAMES]
            missing = [k for k in expect if k not in (p.get("charts") or {})]
            if missing:
                fail(f"{p['id']} missing minor keys {missing}")
        if p.get("tokens") != [s["token"] for s in next(iter(p["charts"].values()))]:
            # tokens should match first chart row length/order
            any_chart = next(iter(p["charts"].values()))
            if [s["token"] for s in any_chart] != p["tokens"]:
                fail(f"{p['id']} chart tokens != progression tokens")
    notes.append(f"12 keys x each major progression, parallel minors for minor items ({len(progs)} progressions): OK")

    whoop = next(p for p in progs if p["id"] == "whoop-14")
    ab = whoop["charts"]["Ab"]
    got_ab = [(s["token"], s["symbol"]) for s in ab]
    want_ab = [("I9", "Ab9"), ("IV9", "Db9"), ("I9", "Ab9"), ("IV9", "Db9")]
    if got_ab != want_ab:
        fail(f"Ab whoop-14 {got_ab} != {want_ab}")
    if ab[0]["notesMidi"] != [56, 60, 63, 66, 70] or ab[0]["bassMidi"] != 32:
        fail(f"Ab I9 voicing unexpected: {ab[0]}")
    if ab[1]["notesMidi"] != [49, 53, 56, 59, 63] or ab[1]["bassMidi"] != 37:
        fail(f"Ab IV9 voicing unexpected: {ab[1]}")
    notes.append("Ab whoop-14 I9=Ab9 IV9=Db9 (voice low=48, bassNote low=28): OK")

    root = next(p for p in progs if p["id"] == "i-iv-v-bvii")
    got_root = [(s["token"], s["symbol"]) for s in root["charts"]["Ab"]]
    want_root = [("I7", "Ab7"), ("IV7", "Db7"), ("V7", "Eb7"), ("bVII7", "Gb7")]
    if got_root != want_root:
        fail(f"Ab i-iv-v-bvii {got_root} != {want_root}")
    notes.append("Ab I7=Ab7 IV7=Db7 V7=Eb7 bVII7=Gb7: OK")

    hook = data.get("hookChords", {}).get("byKey", {})
    if set(hook.keys()) != set(KEY_NAMES):
        fail("hookChords.byKey must cover all 12 keys")
    roles = [h["role"] for h in hook["Ab"]]
    if "I" not in roles or "I7" not in roles or "#ivdim7" not in roles:
        fail(f"Ab hook roles incomplete: {roles}")
    notes.append("hookChords present for all 12 keys: OK")

    walks = {w["id"] for w in data.get("bassWalks", {}).get("walks") or []}
    if not {"chrom-to-5", "chrom-to-4", "octave-pops", "ghost-shout"} <= walks:
        fail(f"bassWalks missing required ids: {walks}")
    if data["bassWalks"]["walks"][0]["exampleMidi"].get("Ab") != [36, 37, 38, 39]:
        fail(f"Ab chrom-to-5 unexpected: {data['bassWalks']['walks'][0]['exampleMidi'].get('Ab')}")
    notes.append("Bass walks chrom-to-5 in Ab = [36,37,38,39]: OK")

    wiring = data.get("intensityWiring") or {}
    for lane in ("shoutLevel", "worshipLevel"):
        for lv in ("1", "2", "3", "4"):
            if lv not in wiring.get(lane, {}):
                fail(f"intensityWiring.{lane} missing {lv}")
    if "howMapsFeedEngine" not in wiring:
        fail("intensityWiring missing howMapsFeedEngine")
    notes.append("Shout 1–4 and Worship 1–4 intensity wiring: OK")
    return notes


def main() -> None:
    if not MAP.exists():
        fail(f"missing {MAP}")
    data = json.loads(MAP.read_text())
    msgs = validate_shout(data)
    if not BT.exists():
        fail(f"missing {BT}")
    bt = json.loads(BT.read_text())
    msgs += validate_beat_theory(bt)
    text = preview_full_break(data)
    PREVIEW.write_text(text)
    print(text)
    print("CHECKS:")
    for m in msgs:
        print(" -", m)
    print(f"Wrote {PREVIEW}")

    if not PULPIT_CHARTS.exists():
        fail(f"missing {PULPIT_CHARTS}")
    pulpit = json.loads(PULPIT_CHARTS.read_text())
    pmsgs = validate_pulpit(pulpit)
    for m in pmsgs:
        print(" -", m)
    print("ALL OK")


if __name__ == "__main__":
    main()
