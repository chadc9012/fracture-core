#!/usr/bin/env python3
"""
Builds the eight regional ambience beds (public/audio/ambience/<name>.mp3) that audio.ts loops per region.

Oct 25: the wind floor is now low (under ~500 Hz) and quiet; places read through their creatures and objects, not a gale.
Why: the bundled ambience WAVs were 12 s of flat filtered noise (no events, envelope variation under 12%) that clicked
at every loop seam, which players heard as "static". These beds are designed sound: gusting wind with leaf rustle,
birds, frogs and crickets, city traffic and murmur, underwater bubbles and moans, ice wind and creaks, desert wind and a
hawk, wasteland gusts with metal and distant thunder, lava rumble with bubbling and crackle.

Every bed is built circularly (FFT-shaped noise, integer-cycle modulators, events wrapped modulo the length, circular
reverb), so the file loops with no seam at all. Deterministic: a fixed seed per region.

    python3 scripts/build-ambience.py            # writes public/audio/ambience/*.mp3 (needs numpy, scipy, ffmpeg with libmp3lame)
"""
import os, subprocess, sys, tempfile
import numpy as np
from scipy.io import wavfile

SR = 32000
SECONDS = 30
N = SR * SECONDS
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio", "ambience")
T = np.arange(N) / SR

# ---------------------------------------------------------------- building blocks (all circular in N)

def shaped(rng, gain_fn):
    """white noise shaped in the frequency domain; periodic in N by construction"""
    spec = np.fft.rfft(rng.standard_normal(N))
    f = np.fft.rfftfreq(N, 1 / SR)
    spec *= gain_fn(np.maximum(f, 1.0))
    x = np.fft.irfft(spec, N)
    return x / (np.std(x) + 1e-12)

def band(lo, hi, slope=4):
    """smooth band-pass magnitude response"""
    return lambda f: 1 / (1 + (lo / f) ** slope) / (1 + (f / hi) ** slope)

def pink_band(lo, hi, slope=4):
    return lambda f: band(lo, hi, slope)(f) / np.sqrt(f)

def lfo(cycles, phase=0.0):
    """0..1 sine with an integer number of cycles over the loop"""
    return 0.5 + 0.5 * np.sin(2 * np.pi * cycles * T / SECONDS + phase)

def gusts(rng, cycles=(2, 3, 5, 8), power=1.6):
    e = sum(lfo(c, rng.uniform(0, 2 * np.pi)) * w for c, w in zip(cycles, (1.0, 0.7, 0.45, 0.3)))
    e = (e - e.min()) / (e.max() - e.min())
    return 0.25 + 0.75 * e ** power

def place(buf, ev, at, pan=0.0):
    """add a (stereo) event at sample `at`, wrapping round the loop; equal-power pan"""
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    idx = (at + np.arange(len(ev))) % N
    np.add.at(buf[0], idx, ev * l)
    np.add.at(buf[1], idx, ev * r)

def env(n, attack=0.01, release=0.2):
    a, rl = max(1, int(attack * SR)), max(1, int(release * SR))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    e[-rl:] *= np.exp(-np.linspace(0, 5, rl))
    return e

def glide(f0, f1, dur, kind="exp"):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    f = f0 * (f1 / f0) ** t if kind == "exp" else f0 + (f1 - f0) * t
    return np.cumsum(2 * np.pi * f / SR), n

def reverb(stereo, seconds=1.6, mix=0.25, damp=3500, rng=None):
    """circular convolution with a decaying-noise impulse response (keeps the loop seamless)"""
    rng = rng or np.random.default_rng(0)
    n = int(seconds * SR)
    out = []
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
        irs = np.fft.rfft(ir, N) * band(80, damp, 2)(np.maximum(np.fft.rfftfreq(N, 1 / SR), 1))
        wet = np.fft.irfft(np.fft.rfft(stereo[ch]) * irs, N)
        wet *= np.std(stereo[ch]) / (np.std(wet) + 1e-12)
        out.append(stereo[ch] * (1 - mix) + wet * mix)
    return np.array(out)

def lowpass(stereo, hi, slope=4):
    f = np.maximum(np.fft.rfftfreq(N, 1 / SR), 1)
    g = 1 / (1 + (f / hi) ** slope)
    return np.array([np.fft.irfft(np.fft.rfft(c) * g, N) for c in stereo])

def bed(rng, gain_fn, level, envelope=None, width=1.0):
    """a decorrelated stereo noise bed"""
    a, b = shaped(rng, gain_fn), shaped(rng, gain_fn)
    l, r = a, a * (1 - width) + b * width
    e = 1.0 if envelope is None else envelope
    return np.array([l, r]) * level * e

def grains(rng, src_fn, rate_env, mean_rate, dur=(0.02, 0.08), level=1.0):
    """leaf rustle / sand hiss: short band-limited grains whose density follows rate_env"""
    out = np.zeros((2, N))
    src = shaped(rng, src_fn)
    t = 0.0
    while t < SECONDS:
        r = mean_rate * rate_env[int(t * SR) % N]
        t += rng.exponential(1 / max(r, 0.2))
        n = int(rng.uniform(*dur) * SR)
        at = int(t * SR) % N
        idx = (at + np.arange(n)) % N
        g = src[idx] * np.hanning(n) * rng.uniform(0.4, 1.0)
        place(out, g, at, rng.uniform(-0.9, 0.9))
    return out * level

# ---------------------------------------------------------------- creatures and things

def bird_song(rng):
    base = rng.uniform(2200, 3800)
    notes, out = rng.integers(3, 8), []
    for _ in range(notes):
        f0 = base * rng.uniform(0.85, 1.25)
        ph, n = glide(f0, f0 * rng.uniform(0.75, 1.45), rng.uniform(0.05, 0.14))
        vib = 1 + 0.03 * np.sin(np.linspace(0, rng.uniform(6, 14) * np.pi, n))
        out.append(np.sin(ph * vib) * env(n, 0.006, 0.04))
        out.append(np.zeros(int(rng.uniform(0.03, 0.09) * SR)))
    return np.concatenate(out)

def frog(rng):
    f = rng.uniform(260, 520)
    pulses, out = rng.integers(4, 11), []
    for _ in range(pulses):
        n = int(0.022 * SR)
        t = np.arange(n) / SR
        out.append((np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t)) * np.hanning(n))
        out.append(np.zeros(int(rng.uniform(0.012, 0.02) * SR)))
    return np.concatenate(out)

def cricket(rng, f):
    out = []
    for _ in range(3):
        n = int(0.018 * SR)
        out.append(np.sin(2 * np.pi * f * np.arange(n) / SR) * np.hanning(n))
        out.append(np.zeros(int(0.014 * SR)))
    return np.concatenate(out)

def bubble(rng, lo=500, hi=1600):
    f0 = rng.uniform(lo, hi)
    ph, n = glide(f0, f0 * rng.uniform(1.6, 2.4), rng.uniform(0.02, 0.05))
    return np.sin(ph) * np.exp(-np.linspace(0, 6, n))

def drip(rng):
    return bubble(rng, 900, 2200) * 0.8

def moan(rng):
    f0 = rng.uniform(90, 150)
    ph, n = glide(f0, f0 * rng.uniform(0.6, 0.85), rng.uniform(2.5, 4.5), "lin")
    sig = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)
    return sig * np.hanning(n)

def creak(rng, lo=380, hi=900, dur=(0.4, 1.0)):
    f0 = rng.uniform(lo, hi)
    n = int(rng.uniform(*dur) * SR)
    wob = f0 * (1 + 0.06 * np.sin(np.linspace(0, rng.uniform(4, 9) * np.pi, n)) + np.linspace(0, rng.uniform(-0.15, 0.15), n))
    ph = np.cumsum(2 * np.pi * wob / SR)
    sig = np.sign(np.sin(ph)) * 0.35 + np.sin(ph) * 0.65  # a little buzz, like strained metal or ice
    return sig * env(n, 0.05, 0.3) * (0.6 + 0.4 * np.sin(np.linspace(0, 23 * np.pi, n)) ** 2)

def thunder(rng):
    n = int(rng.uniform(3.0, 5.0) * SR)
    x = np.cumsum(rng.standard_normal(n)); x -= np.convolve(x, np.ones(800) / 800, "same")
    rumble = x / (np.std(x) + 1e-9)
    e = np.exp(-np.linspace(0, 4, n)) * (1 + 0.6 * np.sin(np.linspace(0, rng.uniform(5, 9) * np.pi, n)) ** 2)
    e[: int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))
    return rumble * e

def hawk(rng):
    ph, n = glide(rng.uniform(2600, 3000), rng.uniform(1500, 1800), rng.uniform(0.7, 1.0))
    return (np.sin(ph) + 0.3 * np.sin(2 * ph)) * env(n, 0.04, 0.35) * (1 + 0.15 * np.sin(np.linspace(0, 40 * np.pi, n)))

def car_pass(rng):
    n = int(rng.uniform(2.5, 4.5) * SR)
    x = np.fft.irfft(np.fft.rfft(rng.standard_normal(n)) * pink_band(80, 700, 6)(np.maximum(np.fft.rfftfreq(n, 1 / SR), 1)), n)
    x /= np.std(x) + 1e-9
    e = np.exp(-((np.linspace(-1, 1, n)) ** 2) * 5)
    return x * e

def murmur(rng, level):
    """crowd babble: noise through moving vowel formants with syllable-rate gating"""
    out = np.zeros((2, N))
    for v in range(10):
        f1, f2 = rng.uniform(350, 750), rng.uniform(1000, 2200)
        src = shaped(rng, lambda f: (np.exp(-((f - f1) / 120) ** 2) + 0.6 * np.exp(-((f - f2) / 220) ** 2)))
        syl = np.clip(np.sin(2 * np.pi * np.cumsum(rng.uniform(3, 6) + 0 * T) / SR + rng.uniform(0, 6)), 0, None) ** 1.5
        talk = lfo(rng.integers(2, 6), rng.uniform(0, 6)) ** 3  # people pause
        place(out, src * syl * talk, 0, rng.uniform(-0.8, 0.8))
    return out * level / 10

def scatter(rng, buf, make, per_minute, level, pan=0.9, jitter=None):
    count = max(1, int(round(per_minute * SECONDS / 60)))
    for _ in range(count):
        ev = make(rng)
        place(buf, ev * level * rng.uniform(0.5, 1.0), int(rng.uniform(0, N)), rng.uniform(-pan, pan))

# ---------------------------------------------------------------- the regions

def forest(rng):
    g = gusts(rng)
    out = bed(rng, pink_band(40, 420), 0.05, 0.6 + 0.4 * g)                          # a low breath of air, not a gale
    out += grains(rng, band(1200, 3200, 4), g ** 3, 10, (0.03, 0.09), level=0.008)  # leaves stir on the odd gust
    birds = np.zeros((2, N)); scatter(rng, birds, bird_song, 16, 0.16)             # songbirds, mostly distant
    out += reverb(lowpass(birds, 6000), 1.8, 0.45, 5000, rng)
    bugs = np.zeros((2, N)); scatter(rng, bugs, lambda r: cricket(r, r.uniform(4200, 4800)), 20, 0.008)
    out += bugs                                                                     # a few insects (chirps, not a hiss band)
    return out

def swamp(rng):
    out = bed(rng, pink_band(30, 320), 0.05, gusts(rng, (2, 3, 5)))                # heavy still air
    frogs = np.zeros((2, N)); scatter(rng, frogs, frog, 70, 0.10)
    out += reverb(frogs, 1.4, 0.35, 3000, rng)
    crick = np.zeros((2, N))
    for f, pan in ((4400, -0.6), (4750, 0.5), (5100, 0.1)):
        period = rng.uniform(0.45, 0.7)
        for k in range(int(SECONDS / period)):
            place(crick, cricket(rng, f) * 0.03, int((k * period + rng.uniform(0, 0.02)) * SR), pan)
    out += crick * np.array([lfo(2, 0.3), lfo(3, 2.2)]) ** 2 * 0.7
    drips = np.zeros((2, N)); scatter(rng, drips, drip, 20, 0.05)
    out += reverb(drips, 1.0, 0.4, 4000, rng)
    return out

def nexus(rng):
    out = bed(rng, pink_band(30, 450), 0.12, gusts(rng, (2, 3, 4), 1.0))           # traffic and city rumble
    hum = sum(np.sin(2 * np.pi * h * 60 * T) / h for h in (2, 3, 4, 6))             # mains hum from the towers
    out += np.array([hum, hum]) * 0.012 * lfo(1, 0.5)
    cars = np.zeros((2, N))
    for _ in range(9):
        c = car_pass(rng); at = int(rng.uniform(0, N)); n = len(c)
        sweep = np.linspace(-0.9, 0.9, n) * rng.choice([-1, 1])
        for ch, s in ((0, np.cos((sweep + 1) * np.pi / 4)), (1, np.sin((sweep + 1) * np.pi / 4))):
            idx = (at + np.arange(n)) % N
            np.add.at(cars[ch], idx, c * s * 0.07)
    out += cars
    out += lowpass(murmur(rng, 0.09), 2400)
    return reverb(out, 2.2, 0.25, 3000, rng)

def underwater(rng):
    out = bed(rng, pink_band(20, 260), 0.30, gusts(rng, (1, 2, 3), 1.2))           # pressure and current
    bub = np.zeros((2, N)); scatter(rng, bub, bubble, 80, 0.05)
    out += bub
    moans = np.zeros((2, N)); scatter(rng, moans, moan, 4, 0.10, pan=0.6)
    out += reverb(moans, 3.0, 0.6, 1200, rng)
    return lowpass(out, 1500, 3)

def frost(rng):
    g = gusts(rng, (2, 3, 5, 7), 2.0)
    out = bed(rng, pink_band(50, 520), 0.06, 0.5 + 0.5 * g)                         # cold air, low
    for c, cyc in ((700, 3), (1050, 5)):                                            # a faint whistle over the ridges now and then
        whistle = bed(rng, lambda f, c=c: np.exp(-((f - c) / 35) ** 2), 0.012, lfo(cyc, rng.uniform(0, 6)) ** 5 * g)
        out += whistle
    ice = np.zeros((2, N)); scatter(rng, ice, lambda r: creak(r, 140, 320, (0.6, 1.4)), 5, 0.05, 0.5)
    out += reverb(ice, 2.0, 0.5, 2000, rng)
    return out

def dunes(rng):
    g = gusts(rng, (2, 3, 5), 1.4)
    out = bed(rng, pink_band(40, 420), 0.06, 0.5 + 0.5 * g)                        # warm, still air
    crick = np.zeros((2, N)); scatter(rng, crick, lambda r: cricket(r, r.uniform(3600, 4200)), 14, 0.012)
    out += crick                                                                    # a few desert insects
    hk = np.zeros((2, N)); scatter(rng, hk, hawk, 3, 0.05, 0.7)
    out += reverb(hk, 2.5, 0.55, 4500, rng)
    return out

def wasteland(rng):
    g = gusts(rng, (2, 3, 5, 9), 2.2)
    out = bed(rng, pink_band(40, 480), 0.07, 0.5 + 0.5 * g)                        # dry air, low
    metal = np.zeros((2, N)); scatter(rng, metal, creak, 7, 0.035, 0.8)
    out += reverb(metal, 1.6, 0.4, 3000, rng)
    rattle = grains(rng, band(1200, 3000, 4), g ** 3, 4, (0.01, 0.02), level=0.02)  # loose debris in the odd gust
    out += rattle
    th = np.zeros((2, N)); scatter(rng, th, thunder, 2, 0.12, 0.5)
    out += lowpass(th, 180)
    return out

def ember(rng):
    out = bed(rng, pink_band(18, 140), 0.40, gusts(rng, (1, 2, 3), 1.0))           # the mountain's rumble
    blurps = np.zeros((2, N))
    for _ in range(int(40 * SECONDS / 60)):
        ph, n = glide(rng.uniform(60, 90), rng.uniform(120, 180), rng.uniform(0.12, 0.25))
        place(blurps, np.sin(ph) * np.exp(-np.linspace(0, 5, n)) * 0.10, int(rng.uniform(0, N)), rng.uniform(-0.7, 0.7))
    out += reverb(blurps, 1.2, 0.3, 1500, rng)
    out += grains(rng, band(2000, 6000, 3), np.ones(N), 5, (0.002, 0.006), level=0.05)  # crackling rock
    out += bed(rng, band(400, 1400, 4), 0.003, lfo(2, 0.7) ** 8)                    # a vent breathing now and then
    return out

REGIONS = {
    "forest-wilds": (forest, 11), "swamp-marsh": (swamp, 12), "nexus-hum": (nexus, 13), "underwater-city": (underwater, 14),
    "frost-spire": (frost, 15), "solara-dunes": (dunes, 16), "wasteland-wind": (wasteland, 17), "ember-peaks": (ember, 18),
}
# Oct 25: the wind/noise layer used to be most of every outdoor bed and mastering pushed it to -21 dBFS, which players heard as
# constant wind. Beds are now mostly their events over a quiet low floor, mastered a little lower.
TARGET_RMS_DB = -24.0

def master(x):
    x = x - x.mean(axis=1, keepdims=True)
    rms = np.sqrt(np.mean(x ** 2))
    x *= 10 ** (TARGET_RMS_DB / 20) / (rms + 1e-12)
    peak = np.abs(x).max()
    if peak > 0.89:  # soft limit the odd loud event rather than turning the whole bed down
        x = np.tanh(x / 0.89) * 0.89
    return x

def main():
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    for name, (fn, seed) in REGIONS.items():
        if only and name not in only:
            continue
        x = master(fn(np.random.default_rng(seed)))
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wavfile.write(tmp.name, SR, (x.T * 32767).astype(np.int16))
        dest = os.path.join(OUT, f"{name}.mp3")  # MP3: decodes in every browser (open Chromium builds cannot decode AAC)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-c:a", "libmp3lame", "-b:a", "128k", dest], check=True)
        os.unlink(tmp.name)
        print(f"{name}: {os.path.getsize(dest) // 1024} KB, rms {20 * np.log10(np.sqrt(np.mean(x ** 2))):.1f} dBFS, peak {np.abs(x).max():.2f}")

if __name__ == "__main__":
    main()
