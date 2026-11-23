#!/usr/bin/env python3
"""The radio's loudness (Nov 22 audio pass): ads, station idents and the talk show sat 10–18 dB under the songs, so every
break dropped away. Measures each recording's integrated loudness (EBU R128, ffmpeg ebur128) and writes
data/radio_gain.json — {res path: dB} that brings each to TARGET LUFS — which audio.gd adds at playback. The recordings
themselves (the owner's masters among them) are not re-encoded.

    python3 tools/radio_gain.py
"""
import glob, json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = -18.0      # LUFS (audio.gd plays the radio 2 dB hotter than before to match)
MAX_BOOST = 12.0
HEADROOM = -1.0     # dBFS: a boost never pushes a recording's peak past this


def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else None


def peak(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"max_volume: (-?[\d.]+) dB", r.stderr)
    return float(m.group(1)) if m else 0.0


def main():
    out = {}
    for p in sorted(glob.glob(os.path.join(ROOT, "audio", "radio", "**", "*"), recursive=True)):
        if p.split(".")[-1] not in ("ogg", "mp3", "wav"):
            continue
        l = lufs(p)
        if l is None:
            continue
        g = max(-12.0, min(MAX_BOOST, TARGET - l, HEADROOM - peak(p)))
        out["res://" + os.path.relpath(p, ROOT)] = round(g, 1)
        print("%-60s %6.1f LUFS  %+5.1f dB" % (os.path.relpath(p, ROOT), l, g))
    json.dump(out, open(os.path.join(ROOT, "data", "radio_gain.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
