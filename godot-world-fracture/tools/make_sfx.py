#!/usr/bin/env python3
"""World Fracture's sound effects, rebuilt (owner's phone test, Nov 9: "audio sucks").

The first set were single synthesized tones: the guns rang like a "pew", the engine was a bare sawtooth buzz and the
explosion a ringing note. These are layered the way recorded effects are: a gunshot is a supersonic crack, the powder's
body, a low thump in the chest and the street's slapback echo; an explosion is a crack over a long low rumble; the engine
is a firing pulse with its harmonics, intake noise and a little wander, looped seamlessly.

Writes audio/sfx/<name>.wav (mono, 24 kHz, 16-bit) for every sound in SOUNDS; the .import files stay as they are.
Usage: python3 tools/make_sfx.py [name ...]
"""
import os, sys, wave
import numpy as np

SR = 24000
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "audio", "sfx")
rng = np.random.default_rng(7)


def t(d):
    return np.arange(int(d * SR)) / SR


def noise(d):
    return rng.standard_normal(int(d * SR))


def onepole_lp(x, fc):
    from scipy.signal import lfilter
    a = np.exp(-2 * np.pi * fc / SR)
    return lfilter([1 - a], [1, -a], x)


def lp(x, fc, order=2):
    for _ in range(order):
        x = onepole_lp(x, fc)
    return x


def hp(x, fc, order=1):
    return x - lp(x, fc, order)


def bp(x, lo, hi):
    return lp(hp(x, lo, 2), hi, 2)


def env(d, attack, decay, curve=1.0):
    tt = t(d)
    a = np.clip(tt / max(attack, 1e-4), 0, 1)
    return a * np.exp(-tt / decay) ** curve


def pad(x, d):
    n = int(d * SR)
    return np.pad(x, (0, max(0, n - len(x))))[:n]


def mix(d, *parts):
    out = np.zeros(int(d * SR))
    for start, x, g in parts:
        s = int(start * SR)
        e = min(len(out), s + len(x))
        out[s:e] += x[: e - s] * g
    return out


def sweep(d, f0, f1, decay):
    tt = t(d)
    f = f1 + (f0 - f1) * np.exp(-tt / (d * 0.25))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt / decay)


def echo(x, delays, gains, damp=2500):
    y = x.copy()
    for dl, g in zip(delays, gains):
        s = int(dl * SR)
        if s < len(y):
            y[s:] += lp(x, damp)[: len(y) - s] * g
    return y


def finish(x, peak=0.89, drive=1.6):
    x = x / (np.max(np.abs(x)) + 1e-9)
    x = np.tanh(x * drive) / np.tanh(drive)
    fade = min(len(x), int(0.01 * SR))
    x[-fade:] *= np.linspace(1, 0, fade)
    return x * peak


def gun(d, crack=1.0, body=1.0, body_decay=0.045, thump=1.0, thump_f=(140, 48), thump_decay=0.09, tail=0.5,
        tail_decay=0.25, bright=6000, slap=(0.09, 0.19)):
    c = hp(noise(0.012), 2500) * env(0.012, 0.0003, 0.0025)
    b = bp(noise(d), 180, bright) * env(d, 0.0008, body_decay)
    th = sweep(d, thump_f[0], thump_f[1], thump_decay)
    tl = lp(noise(d), 1800) * env(d, 0.01, tail_decay) * 0.6
    x = mix(d, (0, c, crack), (0, b, body), (0, th, thump), (0.004, tl, tail))
    return echo(x, slap, [0.32, 0.16], 2200)


def zap(d, f0, f1, buzz=0.4):
    tt = t(d)
    f = f1 + (f0 - f1) * np.exp(-tt / (d * 0.3))
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sign(np.sin(ph)) * 0.35 + np.sin(ph * 2.01) * 0.4
    tone = lp(tone, 5000) * env(d, 0.002, d * 0.35)
    return tone + bp(noise(d), 800, 7000) * env(d, 0.001, 0.03) * buzz


def engine_loop(d=2.0, rpm_hz=46.0):
    # a whole number of firing cycles so the loop has no seam; harmonics with a slow wander, a growl, intake hiss
    cycles = round(d * rpm_hz)
    f = cycles / d
    tt = t(d)
    wob = 1 + 0.012 * np.sin(2 * np.pi * (1 / d) * tt) + 0.006 * np.sin(2 * np.pi * (3 / d) * tt)
    ph = 2 * np.pi * f * np.cumsum(wob) / SR
    ph *= (2 * np.pi * cycles) / ph[-1] if ph[-1] else 1
    x = np.zeros_like(tt)
    for k, g in [(0.5, 0.55), (1, 1.0), (1.5, 0.35), (2, 0.6), (3, 0.35), (4, 0.22), (6, 0.12)]:
        x += g * np.sin(ph * k + k)
    pulse = 0.5 + 0.5 * np.sin(ph) ** 8          # each firing a little punch
    x *= 0.65 + 0.35 * pulse
    hiss = bp(np.tile(noise(d / 4), 4)[: len(tt)], 300, 2400) * 0.18
    x = lp(x, 1600, 2) + hiss
    return x


def step(d=0.16):
    thud = sweep(d, 160, 70, 0.025)
    grit = bp(noise(d), 600, 4500) * env(d, 0.0005, 0.012)
    scuff = bp(noise(d), 1500, 6000) * env(d, 0.02, 0.03) * 0.25
    return mix(d, (0, thud, 1.0), (0, grit, 0.55), (0.01, scuff, 1.0))


def hit(d=0.18, ping=0.0):
    thw = bp(noise(d), 400, 3500) * env(d, 0.0005, 0.02)
    punch = sweep(d, 220, 90, 0.035)
    x = mix(d, (0, thw, 1.0), (0, punch, 0.8))
    if ping:
        x += np.sin(2 * np.pi * 2400 * t(d)) * env(d, 0.001, 0.06) * ping
    return x


def explosion(d=1.8):
    crack = hp(noise(0.03), 1500) * env(0.03, 0.0005, 0.006)
    boom = sweep(d, 90, 32, 0.35)
    rumble = lp(noise(d), 260, 3) * env(d, 0.004, 0.5)
    debris = bp(noise(d), 1500, 6000) * env(d, 0.05, 0.25) * (0.4 + 0.6 * (rng.random(int(d * SR)) > 0.985))
    x = mix(d, (0, crack, 1.0), (0, boom, 1.4), (0, rumble, 2.2), (0.06, debris, 0.35))
    return echo(x, (0.21, 0.43), (0.25, 0.12), 900)


def reload(d=0.65):
    def clack(f, dec=0.012):
        return bp(noise(0.08), f * 0.6, f * 1.8) * env(0.08, 0.0003, dec) + np.sin(2 * np.pi * f * t(0.08)) * env(0.08, 0.0003, 0.02) * 0.3
    return mix(d, (0.0, clack(2600), 1.0), (0.24, clack(1500, 0.02), 0.7), (0.48, clack(3200), 1.0), (0.5, clack(1900), 0.6))


def dry(d=0.12):
    return bp(noise(d), 2000, 7000) * env(d, 0.0003, 0.008)


def land(d=0.25):
    return mix(d, (0, sweep(d, 120, 50, 0.05), 1.0), (0, bp(noise(d), 400, 3000) * env(d, 0.001, 0.03), 0.6))


SOUNDS = {
    "rifle": lambda: finish(gun(0.55)),
    "smg": lambda: finish(gun(0.4, crack=0.9, body=0.9, body_decay=0.03, thump=0.7, thump_f=(170, 60), tail=0.35, tail_decay=0.16)),
    "lmg": lambda: finish(gun(0.6, body=1.1, body_decay=0.05, thump=1.2, thump_f=(130, 45), tail=0.55)),
    "sidearm": lambda: finish(gun(0.5, crack=1.2, body=0.9, body_decay=0.035, thump=0.9, thump_f=(180, 70), tail=0.45, bright=7000)),
    "sniper": lambda: finish(gun(1.2, crack=1.4, body=1.2, body_decay=0.07, thump=1.6, thump_f=(110, 38), thump_decay=0.16, tail=0.9, tail_decay=0.45, slap=(0.14, 0.31))),
    "shotgun": lambda: finish(gun(0.9, crack=0.8, body=1.5, body_decay=0.09, thump=1.5, thump_f=(120, 40), thump_decay=0.14, tail=0.8, tail_decay=0.35, bright=4500)),
    "heavy": lambda: finish(gun(1.1, crack=1.0, body=1.4, body_decay=0.1, thump=2.0, thump_f=(90, 30), thump_decay=0.2, tail=1.0, tail_decay=0.5, bright=3500)),
    "launcher": lambda: finish(mix(1.0, (0, bp(noise(1.0), 300, 3000) * env(1.0, 0.02, 0.25), 0.8), (0, gun(1.0, crack=0.5, body=0.8, thump=1.2, thump_f=(100, 40), tail=0.6), 1.0))),
    "fusion": lambda: finish(mix(0.5, (0, zap(0.5, 1800, 300), 1.0), (0, gun(0.5, crack=0.4, body=0.5, thump=0.8, tail=0.4), 0.6)), drive=1.3),
    "explosion": lambda: finish(explosion(), drive=2.0),
    "step": lambda: finish(step(), peak=0.7, drive=1.2),
    "land": lambda: finish(land(), peak=0.75),
    "hit": lambda: finish(hit(), peak=0.8),
    "headshot": lambda: finish(hit(0.3, ping=0.6), peak=0.85),
    "reload": lambda: finish(reload(), peak=0.75, drive=1.2),
    "dry": lambda: finish(dry(), peak=0.6),
    "engine": lambda: finish(engine_loop(), peak=0.8, drive=1.4),
    # combat details (asset catalog §5, Nov 10): a bolt on an energy shield, the shield collapsing, cover breaking up
    "shield": lambda: finish(mix(0.22, (0, zap(0.22, 2400, 1600, buzz=0.2), 0.8), (0, hit(0.12, ping=0.8), 0.5)), peak=0.7),
    "shield_break": lambda: finish(mix(0.7, (0, zap(0.7, 2600, 180, buzz=0.7), 1.0), (0, bp(noise(0.7), 2000, 8000) * env(0.7, 0.003, 0.18), 0.6)), peak=0.85, drive=1.5),
    # the nitrous firing: a hiss that swells into a rushing roar (Nov 11, the garage's nitrous)
    "nitro": lambda: finish(mix(1.2, (0, bp(noise(1.2), 1200, 9000) * env(1.2, 0.05, 0.5), 1.0), (0, lp(noise(1.2), 600) * env(1.2, 0.15, 0.6), 0.8)), peak=0.8, drive=1.3),
    "debris": lambda: finish(mix(0.9, (0, lp(noise(0.9), 1800) * env(0.9, 0.004, 0.35), 1.0), (0, hit(0.2), 0.8), (0.08, lp(noise(0.5), 900) * env(0.5, 0.01, 0.2), 0.6), (0.21, bp(noise(0.3), 300, 2500) * env(0.3, 0.002, 0.08), 0.5)), peak=0.85, drive=1.4),
}


def write(name, x):
    x = np.clip(x, -1, 1)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    names = sys.argv[1:] or list(SOUNDS)
    for n in names:
        write(n, SOUNDS[n]())
        print("sfx", n)
