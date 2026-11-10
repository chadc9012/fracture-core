#!/usr/bin/env python3
"""The opening cinematic's score cues and sound effects, synthesized (numpy + scipy), written as Ogg Vorbis to
audio/cinema/. Run from anywhere: python3 tools/make_cinema_audio.py

Score (in the manner of a big sci-fi score: choir pads, low brass swells, timpani, a bell motif, built on D minor):
  dawn      the ordinary world — warm major pad, slow piano-like plucks, air
  disturb   the first disturbance — a low drone and a dissonant swell under a sub rumble
  fracture  reality splits — a rising tension ramp into an impact and a choir cluster
  nova      NOVA awakens — a calm, cold shimmer pad
  power     the first power — a riser, a hit, a driving pulse
  title     the new world — the main theme (Dm – Bb – F – C, twice), choir, brass, timpani, bells
Effects: phone_alarm, rumble, glass_rattle, static, tv_cut, blast, door_buckle, siren, flicker, surge, crowd, whoosh, title_hit
"""
import os, subprocess, tempfile
import numpy as np
from scipy import signal

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "audio", "cinema")
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def hz(n):  # midi note -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a, d, s, r, total):
    """ADSR over `total` seconds, n samples"""
    t = np.arange(n) / SR
    e = np.ones(n) * s
    e = np.where(t < a, t / max(a, 1e-4), e)
    e = np.where((t >= a) & (t < a + d), 1 - (1 - s) * (t - a) / max(d, 1e-4), e)
    rel = total - r
    e = np.where(t > rel, e * np.clip(1 - (t - rel) / max(r, 1e-4), 0, 1), e)
    return e


def lp(x, f, order=2):
    b, a = signal.butter(order, min(f / (SR / 2), 0.99), "low")
    return signal.lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = signal.butter(order, min(f / (SR / 2), 0.99), "high")
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], "band")
    return signal.lfilter(b, a, x)


def reverb(x, secs=3.0, wet=0.35, bright=4000):
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * secs / 6.0))
    ir = lp(ir, bright)
    ir /= np.sqrt(np.sum(ir ** 2))
    out = signal.fftconvolve(x, ir)[: len(x)]
    return x * (1 - wet) + out * wet * 1.4


def stereo(x, width=0.0):
    if width <= 0:
        return np.stack([x, x], 1)
    d = int(0.012 * SR * width)
    y = np.concatenate([np.zeros(d), x])[: len(x)]
    return np.stack([x, y * 0.9 + x * 0.1], 1)


def saw(f, t, detune=0.0, voices=1):
    out = np.zeros_like(t)
    for k in range(voices):
        df = f * (1 + detune * (k - (voices - 1) / 2) / max(voices - 1, 1))
        ph = rng.random()
        out += 2 * ((df * t + ph) % 1.0) - 1
    return out / voices


def pad(notes, dur, bright=1800, detune=0.012, voices=5, a=2.0, r=2.5):
    """a string/choir-like pad: detuned saws through a soft lowpass with a slow swell"""
    t = t_(dur)
    x = np.zeros_like(t)
    for n in notes:
        x += saw(hz(n), t, detune, voices)
    x = lp(x, bright, 2)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t)
    return x * env(len(t), a, 0.5, 1.0, r, dur) * vib / max(len(notes), 1)


def choir(notes, dur, a=2.5, r=3.0):
    """'aah': saw voices through two vowel formants"""
    t = t_(dur)
    src = np.zeros_like(t)
    for n in notes:
        src += saw(hz(n), t, 0.008, 6)
    x = bp(src, 650, 1200, 2) * 1.0 + bp(src, 250, 700, 2) * 0.8 + bp(src, 2400, 3200, 2) * 0.25
    return x * env(len(t), a, 0.5, 1.0, r, dur) / max(len(notes), 1) * 1.6


def brass(notes, dur, a=0.8, r=1.2):
    t = t_(dur)
    x = np.zeros_like(t)
    for n in notes:
        x += saw(hz(n), t, 0.004, 3)
    e = env(len(t), a, 0.6, 0.8, r, dur)
    # the brass brightens as it swells
    x = lp(x, 500, 2) * (1 - e) + lp(x, 2200, 2) * e
    return x * e / max(len(notes), 1) * 1.3


def bell(n, dur=4.0, amp=0.5):
    t = t_(dur)
    f = hz(n)
    x = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 2.0)
         + 0.3 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 4.0))
    return x * np.exp(-t * 1.1) * amp


def pluck(n, dur=2.5, amp=0.4):
    t = t_(dur)
    f = hz(n)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    return x * np.exp(-t * 2.4) * amp * np.minimum(1, t * 200)


def timpani(dur=3.0, amp=0.9, f=55.0):
    t = t_(dur)
    x = np.sin(2 * np.pi * f * t * (1 + 0.15 * np.exp(-t * 8))) * np.exp(-t * 1.6)
    x += lp(rng.standard_normal(len(t)), 300) * np.exp(-t * 18) * 0.6
    return x * amp


def boom(dur=5.0, amp=1.0):
    t = t_(dur)
    x = np.sin(2 * np.pi * 42 * t * (1 + 1.2 * np.exp(-t * 6))) * np.exp(-t * 0.9)
    x += lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 3) * 0.8
    x += lp(rng.standard_normal(len(t)), 120) * np.exp(-t * 0.6) * 0.6
    return x * amp


def noise(d):
    return rng.standard_normal(len(t_(d)))


def place(buf, x, at):
    i = int(at * SR)
    j = min(len(buf), i + len(x))
    if j > i:
        buf[i:j] += x[: j - i]


def finish(x, name, width=0.7, rv=(2.8, 0.3), gain_db=-1.5):
    if rv:
        x = reverb(x, rv[0], rv[1])
    x = x / (np.max(np.abs(x)) + 1e-9) * 10 ** (gain_db / 20)
    st = stereo(x, width)
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        tmp = f.name
    from scipy.io import wavfile
    wavfile.write(tmp, SR, (st * 32767).astype(np.int16))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "libvorbis", "-q:a", "4", os.path.join(OUT, name + ".ogg")], check=True)
    os.remove(tmp)
    print("wrote", name, round(len(x) / SR, 1), "s")


# ---------------------------------------------------------------- score

def dawn():
    d = 44.0
    buf = np.zeros(len(t_(d)))
    chords = [[62, 66, 69, 74], [59, 62, 66, 71], [55, 59, 62, 67], [57, 61, 64, 69]]  # D Bm G A
    for i, c in enumerate(chords * 2):
        place(buf, pad(c, 6.5, bright=1400, a=2.5, r=2.0) * 0.5, i * 5.5)
        place(buf, pad([c[0] - 12], 6.5, bright=400, a=2.0, r=2.0) * 0.35, i * 5.5)
    motif = [74, 76, 78, 81, 78, 76, 74, 71]
    for i, n in enumerate(motif * 2):
        place(buf, pluck(n, 2.4, 0.22), 3.0 + i * 2.1)
    place(buf, lp(noise(d), 3000) * 0.015, 0)
    buf *= env(len(buf), 4.0, 0.1, 1.0, 5.0, d)
    finish(buf, "dawn", rv=(3.5, 0.4))


def disturb():
    d = 22.0
    t = t_(d)
    buf = np.zeros(len(t))
    buf += np.sin(2 * np.pi * 36.7 * t) * 0.5 * np.minimum(1, t / 3)
    buf += pad([50, 51, 57], d, bright=700, a=6.0, r=3.0) * 0.6     # D, Eb, A: the wrong note grinding
    buf += pad([74, 75], d, bright=2500, a=10.0, r=3.0) * 0.25 * np.linspace(0, 1, len(t))
    buf += lp(noise(d), 80) * 0.5 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.3 * t)) * np.minimum(1, t / 5)
    finish(buf, "disturb", rv=(3.0, 0.35))


def fracture():
    d = 26.0
    t = t_(d)
    buf = np.zeros(len(t))
    # a 9 s rising ramp: strings climbing in semitones with a tremolo, a riser of noise, then the split
    ramp = 9.0
    for k in range(8):
        n = 50 + k
        seg = pad([n, n + 7, n + 12], 1.6, bright=1500 + k * 300, a=0.3, r=0.6) * (0.4 + k * 0.08)
        seg *= 0.75 + 0.25 * np.sign(np.sin(2 * np.pi * 12 * t_(1.6)))
        place(buf, seg, k * 1.1)
    rz = bp(noise(ramp), 800, 9000) * np.linspace(0, 1, len(t_(ramp))) ** 2 * 0.5
    place(buf, rz, 0)
    place(buf, boom(8.0, 1.8), ramp)
    place(buf, timpani(4.0, 1.2, 49), ramp)
    place(buf, choir([62, 63, 65, 68, 70, 74], 14.0, a=0.2, r=6.0) * 1.1, ramp)     # a cluster: something is wrong
    place(buf, brass([38, 45, 50], 12.0, a=0.3, r=5.0) * 1.2, ramp)
    for k in range(4):
        place(buf, timpani(2.5, 0.7, 49), ramp + 3.0 + k * 1.5)
    finish(buf, "fracture", rv=(3.5, 0.32))


def nova():
    d = 34.0
    t = t_(d)
    buf = pad([62, 69, 76, 81], d, bright=3200, detune=0.006, a=5.0, r=4.0) * 0.45
    buf += choir([74, 81], d, a=7.0, r=5.0) * 0.35
    # glassy arpeggio: the interface thinking
    for i in range(36):
        n = [81, 86, 88, 93, 88, 86][i % 6]
        place(buf, bell(n, 2.5, 0.12), 2.0 + i * 0.85)
    buf += np.sin(2 * np.pi * 36.7 * t) * 0.18
    finish(buf, "nova", rv=(4.0, 0.45))


def power():
    d = 16.0
    t = t_(d)
    buf = np.zeros(len(t))
    rise = 3.5
    tt = t_(rise)
    f = 60 * 2 ** (tt * 3.0 / rise)
    place(buf, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.linspace(0, 1, len(tt)) ** 2 * 0.7, 0)
    place(buf, bp(noise(rise), 1200, 12000) * np.linspace(0, 1, len(tt)) ** 3 * 0.6, 0)
    place(buf, boom(5.0, 1.6), rise)
    place(buf, brass([38, 45, 50, 57], 8.0, a=0.15, r=3.0) * 1.3, rise)
    # the pulse: low eighths in D under a choir
    for k in range(20):
        place(buf, timpani(0.5, 0.5, 73.4) if k % 4 else timpani(0.8, 0.9, 55), rise + 0.4 + k * 0.28)
    place(buf, choir([62, 65, 69, 74], 10.0, a=0.8, r=3.0) * 0.7, rise + 0.5)
    finish(buf, "power", rv=(2.5, 0.28))


def title():
    d = 40.0
    buf = np.zeros(len(t_(d)))
    bar = 4.5
    prog = [[50, 57, 62, 65], [46, 53, 58, 62], [41, 48, 53, 57], [48, 55, 60, 64]]  # Dm Bb F C
    for i, c in enumerate(prog * 2):
        at = 1.0 + i * bar
        loud = 0.6 if i < 4 else 1.0
        place(buf, choir([n + 12 for n in c[1:]], bar + 2.5, a=1.2, r=2.0) * 0.55 * loud, at)
        place(buf, pad(c, bar + 2.5, bright=1600, a=1.0, r=2.0) * 0.5 * loud, at)
        place(buf, brass([c[0] - 12, c[0]], bar + 1.0, a=0.5, r=1.5) * 0.9 * loud, at)
        place(buf, timpani(3.0, 0.8 * loud, hz(c[0] - 12) if hz(c[0] - 12) > 40 else 55), at)
    # the theme on bells, then doubled by brass the second time round
    theme = [(74, 0), (72, 1.5), (69, 2.25), (77, 4.5), (76, 6.0), (74, 6.75), (72, 9.0), (69, 10.5), (72, 11.25), (74, 13.5)]
    for n, b in theme:
        place(buf, bell(n, 4.0, 0.3), 1.0 + b)
        place(buf, bell(n, 4.0, 0.3), 1.0 + 18 + b)
        place(buf, brass([n - 12], 1.4, a=0.08, r=0.6) * 0.7, 1.0 + 18 + b)
    place(buf, boom(6.0, 1.3), 19.0)
    place(buf, boom(8.0, 1.5), 37.0 - 4.0)
    buf *= env(len(buf), 0.5, 0.1, 1.0, 5.0, d)
    finish(buf, "title", rv=(3.8, 0.35))


# ---------------------------------------------------------------- effects

def fx_phone_alarm():
    d = 6.0
    buf = np.zeros(len(t_(d)))
    pat = [76, 83, 79, 83, 76, 83, 79, 83]
    for r in range(3):
        for i, n in enumerate(pat):
            place(buf, pluck(n, 0.5, 0.5) + pluck(n + 12, 0.5, 0.15), r * 2.0 + i * 0.2)
    finish(bp(buf, 300, 6000), "phone_alarm", width=0.0, rv=(0.6, 0.15))


def fx_rumble():
    d = 6.0
    t = t_(d)
    x = lp(noise(d), 70, 4) * 3 + np.sin(2 * np.pi * 31 * t) * 0.4
    x *= env(len(t), 1.5, 0.5, 1.0, 2.5, d) * (0.7 + 0.3 * np.sin(2 * np.pi * 1.3 * t))
    finish(x, "rumble", width=0.4, rv=(1.5, 0.2))


def fx_glass_rattle():
    d = 3.5
    t = t_(d)
    x = np.zeros(len(t))
    for k in range(70):
        at = rng.random() * (d - 0.2)
        place(x, bp(noise(0.06), 3000, 9000) * np.exp(-t_(0.06) * 60) * rng.random(), at)
    x *= env(len(t), 0.8, 0.2, 1.0, 1.2, d)
    finish(x, "glass_rattle", width=0.6, rv=(0.8, 0.2))


def fx_static():
    d = 2.5
    t = t_(d)
    x = bp(noise(d), 400, 7000) * (0.6 + 0.4 * (rng.random(len(t)) > 0.97))
    x += np.sin(2 * np.pi * 1000 * t) * 0.1 * (np.sin(2 * np.pi * 7 * t) > 0)
    finish(x * env(len(t), 0.02, 0.1, 1.0, 0.4, d), "static", width=0.0, rv=None)


def fx_tv_cut():
    d = 1.2
    t = t_(d)
    x = bp(noise(d), 200, 8000) * np.exp(-t * 3)
    x += np.sin(2 * np.pi * 15734 * t) * 0.05 * np.exp(-t * 6)
    place(x, -np.sin(2 * np.pi * 80 * t_(0.08)) * np.exp(-t_(0.08) * 50), 0)
    finish(x, "tv_cut", width=0.0, rv=None)


def fx_blast():
    d = 6.0
    x = boom(d, 1.0)
    x += bp(noise(d), 1500, 9000) * np.exp(-t_(d) * 2.5) * 0.4
    finish(x, "blast", width=0.8, rv=(2.5, 0.3), gain_db=-0.5)


def fx_door_buckle():
    d = 2.6
    t = t_(d)
    creak = signal.sawtooth(2 * np.pi * (90 + 40 * np.sin(2 * np.pi * 1.7 * t)) * t) * env(len(t), 0.3, 0.2, 0.8, 0.5, 1.2)
    x = bp(creak, 150, 2500) * 0.5
    place(x, lp(noise(0.5), 1500) * np.exp(-t_(0.5) * 9) * 1.4 + np.sin(2 * np.pi * 70 * t_(0.5)) * np.exp(-t_(0.5) * 6), 1.2)
    finish(x, "door_buckle", width=0.4, rv=(1.2, 0.25))


def fx_siren():
    d = 8.0
    t = t_(d)
    f = 650 + 350 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.5 * t))
    x = signal.square(2 * np.pi * np.cumsum(f) / SR) * 0.3
    finish(bp(x, 400, 3000), "siren", width=0.3, rv=(1.8, 0.35))


def fx_flicker():
    d = 2.0
    t = t_(d)
    gate = (rng.random(int(d * 30)) > 0.4).repeat(SR // 30 + 1)[: len(t)]
    x = (signal.sawtooth(2 * np.pi * 120 * t) * 0.5 + bp(noise(d), 2000, 8000) * 0.3) * gate
    finish(x, "flicker", width=0.0, rv=(0.5, 0.15))


def fx_surge():
    d = 4.0
    tt = t_(d)
    f = 80 * 2 ** (tt * 2.5 / d)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.linspace(0.2, 1, len(tt))
    x += bp(noise(d), 2000, 12000) * np.linspace(0, 1, len(tt)) ** 2 * 0.5
    place(x, boom(1.5, 0.8), d - 0.6)
    finish(x, "surge", width=0.7, rv=(1.8, 0.3))


def fx_crowd():
    """panicked murmur under the shouts: many band-passed noise 'voices' rising and falling"""
    d = 10.0
    t = t_(d)
    x = np.zeros(len(t))
    for k in range(22):
        f = rng.uniform(300, 900)
        v = bp(noise(d), f * 0.7, f * 1.6) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(1.5, 4) * t + rng.random() * 6)) ** 3
        x += v * rng.uniform(0.3, 1.0)
    finish(x * env(len(t), 1.0, 0.2, 1.0, 1.5, d), "crowd", width=0.9, rv=(1.6, 0.3))


def fx_whoosh():
    d = 1.6
    t = t_(d)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    finish(bp(noise(d), 300, 5000) * e, "whoosh", width=0.8, rv=(0.8, 0.2))


def fx_title_hit():
    d = 7.0
    x = boom(d, 1.0) + timpani(d, 0.6, 41)
    place(x, choir([50, 57, 62, 65, 74], 6.0, a=0.05, r=3.0) * 0.6, 0)
    finish(x, "title_hit", width=0.8, rv=(3.5, 0.35), gain_db=-0.5)


if __name__ == "__main__":
    import sys
    todo = [dawn, disturb, fracture, nova, power, title, fx_phone_alarm, fx_rumble, fx_glass_rattle, fx_static, fx_tv_cut,
              fx_blast, fx_door_buckle, fx_siren, fx_flicker, fx_surge, fx_crowd, fx_whoosh, fx_title_hit]
    for f in todo:
        if len(sys.argv) < 2 or f.__name__ in sys.argv[1:]:
            f()
