#!/usr/bin/env python3
"""The game's audio, checked (Nov 22 audio pass, owner: "Check all audio in game voices sounds vehicles walking running
everything"). Exits non-zero on a problem:
  * every cue the code names (Sound.sfx / sfx_at / loop, gunplay's SHOT_CUES, the footstep surfaces) has its file
  * every loop wraps without a click (its last sample meets its first)
  * every story / side-mission / people line has its recording(s) — the player's in all three voices — and every
    recording is audible (no silent take) and listed in data/dialogue/voices.json
  * the radio's gain table covers every recording

    python3 tools/check_audio.py
"""
import glob, json, os, re, sys
import numpy as np, soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = os.path.join(ROOT, "audio", "sfx")
LINES = os.path.join(ROOT, "audio", "voices", "lines")
LOOPS = ["engine", "hover", "jet", "rotor", "siren", "wind", "water", "fire"]
STEPS = ["step", "step_grass", "step_dirt", "step_sand", "step_snow", "step_water"]
problems = []


def code_cues():
    code = "".join(open(f).read() for f in glob.glob(os.path.join(ROOT, "scripts", "**", "*.gd"), recursive=True))
    names = set(re.findall(r'Sound\.(?:sfx|sfx_at)\(\s*"([^"]+)"', code))
    names |= set(re.findall(r'Sound\.loop\(\s*"[^"]+"\s*,\s*"([^"]+)"', code))
    m = re.search(r"SHOT_CUES := \{([^}]*)\}", code)
    if m:
        names |= {v for v in re.findall(r':\s*"([^"]*)"', m.group(1)) if v}
    m = re.search(r"const ENGINE := \{([^}]*)\}", code)
    if m:
        names |= set(re.findall(r':\s*"([^"]*)"', m.group(1)))
    return names | set(STEPS)


def main():
    have = {os.path.splitext(f)[0] for f in os.listdir(SFX) if f.endswith(".wav")}
    cinema = {os.path.splitext(f)[0] for f in os.listdir(os.path.join(ROOT, "audio", "cinema"))}
    for n in sorted(code_cues()):
        if n not in have and n not in cinema:
            problems.append("missing cue " + n)
    for n in LOOPS:
        y, sr = sf.read(os.path.join(SFX, n + ".wav"))
        typical = np.abs(np.diff(y)).mean()
        if abs(y[0] - y[-1]) > max(0.05, typical * 3):
            problems.append("loop %s clicks at its seam (%.3f)" % (n, abs(y[0] - y[-1])))
    idx = json.load(open(os.path.join(ROOT, "data", "dialogue", "voices.json")))["lines"]
    for name in ("aftershock.json", "side_missions.json", "people.json"):
        p = os.path.join(ROOT, "data", "dialogue", name)
        if not os.path.exists(p):
            continue
        for l in json.load(open(p))["lines"]:
            if not l.get("speaker"):
                continue
            for v in (["_m", "_f", "_r"] if l["speaker"] == "PLAYER" else [""]):
                f = os.path.join(LINES, l["id"] + v + ".ogg")
                if not os.path.exists(f):
                    problems.append("unvoiced %s%s" % (l["id"], v))
                    continue
                y, _ = sf.read(f)
                if len(y) == 0 or np.abs(y).max() < 0.05:
                    problems.append("silent take %s%s" % (l["id"], v))
            if l["id"] not in idx:
                problems.append("not in voices.json " + l["id"])
    gain = json.load(open(os.path.join(ROOT, "data", "radio_gain.json")))
    for p in glob.glob(os.path.join(ROOT, "audio", "radio", "**", "*.*"), recursive=True):
        if p.split(".")[-1] in ("ogg", "mp3") and "res://" + os.path.relpath(p, ROOT) not in gain:
            problems.append("radio gain missing " + os.path.relpath(p, ROOT))
    for p in problems[:40]:
        print("PROBLEM", p)
    print("audio check: %d problem%s" % (len(problems), "" if len(problems) == 1 else "s"))
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
