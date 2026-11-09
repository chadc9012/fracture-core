#!/usr/bin/env python3
"""Builds the Godot build's sound effects as short 24 kHz mono WAVs (godot-world-fracture/audio/sfx). The web build's
authored SFX live on the Lovable asset CDN (src/assets/audio/*.asset.json), which the build sandbox cannot reach, and the
web falls back to procedural sound while a file loads — these are that fallback, designed: layered noise bursts and tones
shaped by envelopes, one file per cue. Replace any of them by dropping an authored WAV of the same name.

    python3 scripts/build-sfx.py            # writes every cue
    python3 scripts/build-sfx.py rifle      # one cue
"""
import os
import struct
import sys

import numpy as np

SR = 24000
OUT = os.path.join(os.path.dirname(__file__), "..", "godot-world-fracture", "audio", "sfx")
rng = np.random.default_rng(7)


def t(seconds: float) -> np.ndarray:
    return np.arange(int(SR * seconds)) / SR


def env(n: int, attack: float, decay: float, curve: float = 3.0) -> np.ndarray:
    x = np.arange(n) / SR
    a = np.clip(x / max(attack, 1e-4), 0, 1)
    d = np.exp(-x / max(decay, 1e-4) * curve)
    return a * d


def noise(seconds: float) -> np.ndarray:
    return rng.standard_normal(int(SR * seconds))


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    # one-pole, run twice for a steeper roll-off
    k = 1.0 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    for _ in range(2):
        acc = 0.0
        for i, v in enumerate(x):
            acc += k * (v - acc)
            y[i] = acc
        x = y.copy()
    return y


def highpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    return x - lowpass(x, cutoff)


def tone(seconds: float, f0: float, f1: float | None = None, wave: str = "sine") -> np.ndarray:
    tt = t(seconds)
    f1 = f0 if f1 is None else f1
    freq = f0 + (f1 - f0) * (tt / max(seconds, 1e-4))
    ph = 2 * np.pi * np.cumsum(freq) / SR
    if wave == "saw":
        return 2 * ((ph / (2 * np.pi)) % 1.0) - 1
    if wave == "square":
        return np.sign(np.sin(ph))
    return np.sin(ph)


def mix(*parts: np.ndarray) -> np.ndarray:
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def norm(x: np.ndarray, peak: float = 0.9) -> np.ndarray:
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def gunshot(body_s: float, crack_cut: float, boom_f: float, tail_s: float, punch: float) -> np.ndarray:
    n = int(SR * body_s)
    crack = highpass(noise(body_s), crack_cut) * env(n, 0.0005, 0.012, 4)
    body = lowpass(noise(body_s), 1800) * env(n, 0.001, 0.05, 3) * punch
    boom = tone(body_s, boom_f * 1.6, boom_f * 0.6) * env(n, 0.002, 0.08, 3) * 0.8
    tail = lowpass(noise(tail_s), 900) * env(int(SR * tail_s), 0.01, tail_s * 0.5, 3) * 0.35
    return norm(mix(crack, body, boom, tail))


CUES = {
    # the worn guns (weapons.gd frames)
    "rifle": lambda: gunshot(0.12, 2500, 140, 0.35, 1.0),
    "sniper": lambda: gunshot(0.2, 1800, 80, 0.9, 1.4),
    "fusion": lambda: norm(mix(tone(0.18, 900, 300, "saw") * env(int(SR * 0.18), 0.004, 0.08), highpass(noise(0.1), 3000) * env(int(SR * 0.1), 0.0005, 0.02))),
    "smg": lambda: gunshot(0.08, 3000, 170, 0.18, 0.8),
    "shotgun": lambda: gunshot(0.22, 1200, 70, 0.8, 1.6),
    "sidearm": lambda: gunshot(0.1, 2800, 180, 0.3, 0.9),
    "lmg": lambda: gunshot(0.11, 2200, 120, 0.4, 1.2),
    "heavy": lambda: gunshot(0.16, 1600, 90, 0.7, 1.5),
    "launcher": lambda: norm(mix(lowpass(noise(0.4), 600) * env(int(SR * 0.4), 0.01, 0.2), tone(0.4, 200, 60) * env(int(SR * 0.4), 0.005, 0.25))),
    "dry": lambda: norm(mix(highpass(noise(0.03), 2000) * env(int(SR * 0.03), 0.0005, 0.01), tone(0.04, 1800, 1200) * env(int(SR * 0.04), 0.001, 0.015) * 0.4), 0.5),
    "reload": lambda: norm(mix(
        highpass(noise(0.05), 1500) * env(int(SR * 0.05), 0.001, 0.02),
        np.concatenate([np.zeros(int(SR * 0.28)), tone(0.06, 1400, 900) * env(int(SR * 0.06), 0.001, 0.02) * 0.6]),
        np.concatenate([np.zeros(int(SR * 0.55)), highpass(noise(0.06), 1200) * env(int(SR * 0.06), 0.001, 0.025)]),
    ), 0.6),
    # hits
    "hit": lambda: norm(mix(lowpass(noise(0.08), 2500) * env(int(SR * 0.08), 0.001, 0.03), tone(0.08, 500, 250) * env(int(SR * 0.08), 0.001, 0.04) * 0.5), 0.7),
    "headshot": lambda: norm(mix(tone(0.12, 1800, 1200) * env(int(SR * 0.12), 0.001, 0.05), highpass(noise(0.06), 3500) * env(int(SR * 0.06), 0.0005, 0.02)), 0.7),
    "hurt": lambda: norm(mix(lowpass(noise(0.25), 500) * env(int(SR * 0.25), 0.002, 0.12), tone(0.25, 110, 70) * env(int(SR * 0.25), 0.002, 0.15) * 0.8)),
    "down": lambda: norm(mix(tone(0.9, 400, 90) * env(int(SR * 0.9), 0.01, 0.5), lowpass(noise(0.9), 400) * env(int(SR * 0.9), 0.01, 0.4) * 0.5)),
    "explosion": lambda: norm(mix(lowpass(noise(1.4), 350) * env(int(SR * 1.4), 0.005, 0.6, 2.5), tone(1.4, 90, 35) * env(int(SR * 1.4), 0.004, 0.5) * 0.9, highpass(noise(0.2), 2000) * env(int(SR * 0.2), 0.001, 0.05) * 0.6)),
    # movement
    "step": lambda: norm(lowpass(noise(0.09), 900) * env(int(SR * 0.09), 0.002, 0.03), 0.45),
    "jump": lambda: norm(lowpass(noise(0.12), 1200) * env(int(SR * 0.12), 0.002, 0.05), 0.5),
    "land": lambda: norm(mix(lowpass(noise(0.16), 600) * env(int(SR * 0.16), 0.001, 0.06), tone(0.16, 120, 60) * env(int(SR * 0.16), 0.001, 0.08) * 0.5), 0.6),
    # UI and world
    "click": lambda: norm(tone(0.05, 1500, 1100) * env(int(SR * 0.05), 0.001, 0.02), 0.5),
    "confirm": lambda: norm(mix(tone(0.18, 880) * env(int(SR * 0.18), 0.002, 0.08), np.concatenate([np.zeros(int(SR * 0.09)), tone(0.18, 1320) * env(int(SR * 0.18), 0.002, 0.1)])), 0.55),
    "door": lambda: norm(mix(lowpass(noise(0.5), 700) * env(int(SR * 0.5), 0.02, 0.25, 2), tone(0.5, 180, 220) * env(int(SR * 0.5), 0.05, 0.3) * 0.5), 0.6),
    "pickup": lambda: norm(mix(tone(0.25, 660, 990) * env(int(SR * 0.25), 0.002, 0.1), tone(0.25, 1320, 1980) * env(int(SR * 0.25), 0.03, 0.08) * 0.5), 0.55),
    "portal": lambda: norm(mix(tone(1.6, 60, 240) * env(int(SR * 1.6), 0.3, 0.9, 2), tone(1.6, 420, 1260) * env(int(SR * 1.6), 0.4, 0.8, 2) * 0.4, lowpass(noise(1.6), 1500) * env(int(SR * 1.6), 0.2, 0.9, 2) * 0.5)),
    "roar": lambda: norm(mix(tone(1.1, 70, 45, "saw") * env(int(SR * 1.1), 0.05, 0.6, 2), tone(1.1, 141, 90, "saw") * env(int(SR * 1.1), 0.05, 0.6, 2) * 0.5, lowpass(noise(1.1), 800) * env(int(SR * 1.1), 0.03, 0.5, 2) * 0.7)),
    "stagger": lambda: norm(mix(tone(0.8, 1200, 300) * env(int(SR * 0.8), 0.005, 0.4, 2), highpass(noise(0.3), 2500) * env(int(SR * 0.3), 0.001, 0.1))),
    "capture": lambda: norm(mix(tone(0.5, 523) * env(int(SR * 0.5), 0.002, 0.2), np.concatenate([np.zeros(int(SR * 0.12)), tone(0.5, 659) * env(int(SR * 0.5), 0.002, 0.2)]), np.concatenate([np.zeros(int(SR * 0.24)), tone(0.5, 784) * env(int(SR * 0.5), 0.002, 0.25)])), 0.55),
    "buzzer": lambda: norm(tone(0.6, 220, 220, "square") * env(int(SR * 0.6), 0.005, 0.5, 1.5) * (1 + 0.3 * np.sin(2 * np.pi * 30 * t(0.6))), 0.5),
    # engines: loops, cut at a zero crossing of the fundamental
    "engine": lambda: norm(mix(tone(2.0, 55, 55, "saw") * 0.6, tone(2.0, 110, 110, "saw") * 0.3, lowpass(noise(2.0), 300) * 0.3), 0.5),
    "hover": lambda: norm(mix(tone(2.0, 90) * 0.5, tone(2.0, 181) * 0.25, lowpass(noise(2.0), 2000) * 0.35 * (1 + 0.2 * np.sin(2 * np.pi * 7 * t(2.0)))), 0.45),
    "rotor": lambda: norm(lowpass(noise(2.0), 500) * (0.4 + 0.6 * np.clip(np.sin(2 * np.pi * 14 * t(2.0)) * 3, 0, 1)) + tone(2.0, 42, 42, "saw") * 0.3, 0.55),
    "jet": lambda: norm(mix(highpass(lowpass(noise(2.0), 4000), 300) * 0.6, tone(2.0, 160) * 0.2, tone(2.0, 1900) * 0.08), 0.5),
    "wind": lambda: norm(lowpass(noise(3.0), 600) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.4 * t(3.0))), 0.4),
    "water": lambda: norm(lowpass(noise(3.0), 1500) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.7 * t(3.0) + 1)), 0.4),
    "horn": lambda: norm(mix(tone(0.5, 349, 349, "saw") * env(int(SR * 0.5), 0.01, 0.6, 1.2), tone(0.5, 440, 440, "saw") * env(int(SR * 0.5), 0.01, 0.6, 1.2) * 0.7), 0.5),
}


def write(name: str, x: np.ndarray) -> None:
    os.makedirs(OUT, exist_ok=True)
    pcm = np.clip(x, -1, 1)
    data = (pcm * 32767).astype("<i2").tobytes()
    with open(os.path.join(OUT, name + ".wav"), "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE")
        f.write(b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, SR, SR * 2, 2, 16))
        f.write(b"data" + struct.pack("<I", len(data)) + data)


if __name__ == "__main__":
    names = sys.argv[1:] or list(CUES)
    for n in names:
        write(n, CUES[n]())
    print(f"{len(names)} cues → {os.path.relpath(OUT)}")
