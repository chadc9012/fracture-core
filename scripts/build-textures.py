"""
Builds the tileable PBR texture library in public/textures/ (numpy + Pillow, no network):

  ground/<surface>_nrm.jpg   normal maps for the six Poly Haven ground albedos (derived from their own detail, high-passed)
  asphalt_{col,nrm,rough}.jpg  city asphalt: aggregate, tar seams, patch repairs, hairline cracks, oil stains
  pavers_{col,nrm,rough}.jpg   sidewalk pavers: offset concrete slabs, grout, chips, grime
  facade_nrm.jpg             fine concrete/panel relief for building facades

    python3 scripts/build-textures.py [path-to-__l5e-ground-albedos-root]

Every map is periodic (FFT noise, wrapped distances, rolled gradients) so it tiles without seams.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "public", "textures")
N = 1024
rng = np.random.default_rng(20261023)


def fbm(n=N, beta=2.0, lo=1.0, seed=None):
    """Periodic 1/f^beta noise in [0,1]."""
    r = np.random.default_rng(seed) if seed is not None else rng
    w = r.standard_normal((n, n))
    F = np.fft.fft2(w)
    fx = np.fft.fftfreq(n)[:, None] * n; fy = np.fft.fftfreq(n)[None, :] * n
    f = np.sqrt(fx ** 2 + fy ** 2); f[0, 0] = 1
    F *= 1 / np.maximum(f, lo) ** (beta / 2)
    F[0, 0] = 0
    out = np.real(np.fft.ifft2(F))
    out -= out.min(); out /= out.max()
    return out


def blur(a, s):
    """Periodic gaussian blur via FFT."""
    n = a.shape[0]
    fx = np.fft.fftfreq(n)[:, None]; fy = np.fft.fftfreq(n)[None, :]
    g = np.exp(-2 * (np.pi * s) ** 2 * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nz = np.ones_like(h)
    l = np.sqrt(dx * dx + dy * dy + nz * nz)
    # OpenGL convention (+Y up in the image), what three.js expects
    return np.stack([(-dx / l) * 0.5 + 0.5, (dy / l) * 0.5 + 0.5, (nz / l) * 0.5 + 0.5], -1)


def save(arr, path, mode="RGB"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    a = np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(a, mode if a.ndim == 3 else "L").save(path, quality=90, optimize=True)
    print("wrote", os.path.relpath(path, ROOT), os.path.getsize(path))


def cracks(n, count, seed, steps=120, width=1):
    """Thin periodic crack lines by random walks."""
    r = np.random.default_rng(seed)
    m = np.zeros((n, n))
    for _ in range(count):
        x, y = r.uniform(0, n, 2); a = r.uniform(0, 2 * np.pi)
        for _ in range(steps):
            a += r.normal(0, 0.35); x = (x + np.cos(a) * 2) % n; y = (y + np.sin(a) * 2) % n
            m[int(y), int(x)] = 1
            if width > 1:
                m[int(y), int(x + 1) % n] = 1
            if r.random() < 0.02:  # branch
                a += r.choice([-1, 1]) * 0.9
    return np.clip(blur(m, 0.7) * 3, 0, 1)


def speckle(n, density, seed, size=1.2):
    r = np.random.default_rng(seed)
    m = (r.random((n, n)) < density).astype(float)
    return np.clip(blur(m, size) * (3 + size * 2), 0, 1)


def asphalt():
    base = 0.17 + 0.05 * (fbm(beta=2.2, seed=1) - 0.5)
    agg_hi = speckle(N, 0.012, 2, 0.8); agg_lo = speckle(N, 0.02, 3, 0.6)
    tar = (fbm(beta=3.0, seed=4) > 0.62).astype(float); tar = np.clip(blur(tar, 3), 0, 1)
    patch = (fbm(beta=3.4, seed=5) > 0.7).astype(float); patch = np.clip(blur(patch, 1.5), 0, 1)
    cr = cracks(N, 9, 6)
    oil = np.clip((fbm(beta=3.2, seed=7) - 0.72) * 5, 0, 1)
    v = base + agg_hi * 0.16 - agg_lo * 0.06 - tar * 0.05 + patch * 0.04 - cr * 0.1 - oil * 0.07
    col = np.stack([v * 0.98, v, v * 1.04], -1)
    h = fbm(beta=1.2, seed=8) * 0.4 + agg_hi * 0.8 - agg_lo * 0.3 - cr * 1.6 - tar * 0.3 + patch * 0.25
    nrm = normal_from_height(h, 2.4)
    rough = np.clip(0.88 - tar * 0.18 - oil * 0.35 + agg_hi * 0.06 - patch * 0.05, 0.3, 1)
    save(col, f"{OUT}/asphalt_col.jpg"); save(nrm, f"{OUT}/asphalt_nrm.jpg"); save(rough, f"{OUT}/asphalt_rough.jpg")


def pavers():
    """Offset rectangular slabs 4 x 8 per tile (tile = 4 m -> 1 m x 0.5 m slabs) with grout and per-slab tone."""
    y, x = np.mgrid[0:N, 0:N] / N
    rows, cols = 8, 4
    ry = y * rows; row = np.floor(ry)
    rx = x * cols + (row % 2) * 0.5
    fx, fy = rx % 1, ry % 1
    gx = np.minimum(fx, 1 - fx) * (N / cols); gy = np.minimum(fy, 1 - fy) * (N / rows)
    edge = np.minimum(gx, gy)
    grout = np.clip(1 - edge / 3.5, 0, 1)
    sid = (np.floor(rx) % cols) * 13 + row * 7
    tone = (np.sin(sid * 12.9898) * 43758.5453) % 1
    base = 0.36 + tone * 0.07 + (fbm(beta=1.8, seed=11) - 0.5) * 0.08
    grime = np.clip((fbm(beta=2.6, seed=12) - 0.45) * 1.6, 0, 1)
    chips = speckle(N, 0.002, 13, 1.5)
    v = base * (1 - grout * 0.55) - grime * 0.12 - chips * 0.08 + speckle(N, 0.03, 14, 0.5) * 0.04
    col = np.stack([v * 1.02, v * 0.99, v * 0.95], -1)
    bevel = np.clip(edge / 6, 0, 1) ** 0.6
    h = bevel * 1.0 + fbm(beta=1.5, seed=15) * 0.15 - chips * 0.6 + tone[..., None][..., 0] * 0.08
    nrm = normal_from_height(h, 5.0)
    rough = np.clip(0.82 + grout * 0.12 - grime * 0.1, 0.3, 1)
    save(col, f"{OUT}/pavers_col.jpg"); save(nrm, f"{OUT}/pavers_nrm.jpg"); save(rough, f"{OUT}/pavers_rough.jpg")


def facade():
    h = fbm(beta=1.6, seed=21) * 0.5 + speckle(N, 0.006, 22, 1.0) * 0.4 - cracks(N, 5, 23, 80) * 0.8
    save(normal_from_height(h, 1.6), f"{OUT}/facade_nrm.jpg")


def ground_normals(src_root):
    names = ["forest_ground_04", "aerial_rocks_02", "coast_sand_01", "snow_02", "burned_ground_01", "brown_mud_02"]
    strength = {"forest_ground_04": 5, "aerial_rocks_02": 7, "coast_sand_01": 3, "snow_02": 2.5, "burned_ground_01": 5, "brown_mud_02": 4}
    for nm in names:
        url = json.load(open(os.path.join(ROOT, "src", "assets", "polyhaven", f"{nm}.jpg.asset.json")))["url"]
        p = os.path.join(src_root, url.lstrip("/"))
        if not os.path.exists(p):
            print("missing albedo", p); continue
        im = Image.open(p).convert("RGB")
        if im.size[0] > N:
            im = im.resize((N, N), Image.LANCZOS)
        a = np.asarray(im).astype(float) / 255
        lum = a @ np.array([0.299, 0.587, 0.114])
        h = lum - blur(lum, 18)  # high-pass: keep stones, roots, ripples; drop lighting gradients
        h = h / (np.abs(h).max() + 1e-6)
        save(normal_from_height(h, strength[nm]), f"{OUT}/ground/{nm}_nrm.jpg")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "public")
    ground_normals(src)
    asphalt(); pavers(); facade()
