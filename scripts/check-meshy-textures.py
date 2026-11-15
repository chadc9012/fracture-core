#!/usr/bin/env python3
"""Pixelation gate for Meshy models (owner, Nov 15: "triple check every model for pixelization we dont need any shit
quality anymore"). For every GLB given, every embedded texture is measured:

  size     the shortest side; base colour must be >= --min (2048 by default; --hero 4096 for vehicles and buildings)
  detail   how much of the image survives a 2x down-up resample (0 = all of it, i.e. an upscaled or blurry texture)
  blocky   share of 2x2 pixel blocks that are one flat colour (nearest-neighbour upscales and pixel mush)
  ppm      texels per metre of the model's largest side (how sharp it looks on screen at its real size)

A model passes only when its base colour texture passes all of them. Exit 1 if any model fails.
Usage: check-meshy-textures.py [--min 2048] [--real-size METRES] model.glb ...
"""
import argparse, io, json, struct, sys

import numpy as np
from PIL import Image


def glb(path):
    b = open(path, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    return j, b[20 + n + 8:]


def images(j, bin_):
    """(role, PIL image) for every embedded texture; role from the material slot it feeds"""
    role = {}
    for m in j.get("materials", []):
        pbr = m.get("pbrMetallicRoughness", {})
        for slot, key in (("base", pbr.get("baseColorTexture")), ("mr", pbr.get("metallicRoughnessTexture")),
                          ("normal", m.get("normalTexture")), ("emissive", m.get("emissiveTexture"))):
            if key is not None:
                role[j["textures"][key["index"]]["source"]] = slot
    out = []
    for i, im in enumerate(j.get("images", [])):
        if "bufferView" not in im:
            continue
        bv = j["bufferViews"][im["bufferView"]]
        o = bv.get("byteOffset", 0)
        out.append((role.get(i, "other"), Image.open(io.BytesIO(bin_[o:o + bv["byteLength"]])).convert("RGB")))
    return out


def extent(j, bin_):
    lo = np.full(3, np.inf)
    hi = -lo
    for m in j.get("meshes", []):
        for p in m["primitives"]:
            a = j["accessors"][p["attributes"]["POSITION"]]
            if "min" in a:
                lo = np.minimum(lo, a["min"])
                hi = np.maximum(hi, a["max"])
    return float(np.max(hi - lo)) if np.all(np.isfinite(lo)) else 0.0


def measure(img):
    a = np.asarray(img, dtype=np.float32) / 255.0
    w, h = img.size
    half = img.resize((max(1, w // 2), max(1, h // 2)), Image.BILINEAR).resize((w, h), Image.BILINEAR)
    b = np.asarray(half, dtype=np.float32) / 255.0
    # only where there is content (UV islands), not the empty atlas background
    mask = a.std(axis=2) + np.abs(a - a.mean(axis=(0, 1))).sum(axis=2) > 0.02
    if mask.sum() < 100:
        mask = np.ones(a.shape[:2], bool)
    detail = float(np.abs(a - b).sum(axis=2)[mask].mean())
    g = a[: h // 2 * 2, : w // 2 * 2]
    flat = (np.abs(g[0::2, 0::2] - g[1::2, 0::2]).sum(-1) + np.abs(g[0::2, 0::2] - g[0::2, 1::2]).sum(-1)
            + np.abs(g[0::2, 0::2] - g[1::2, 1::2]).sum(-1)) < 1e-6
    m2 = mask[: h // 2 * 2 : 2, : w // 2 * 2 : 2]
    blocky = float(flat[m2].mean()) if m2.any() else 0.0
    return min(w, h), detail, blocky


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min", type=int, default=2048)
    ap.add_argument("--min-detail", type=float, default=0.012)
    ap.add_argument("--max-blocky", type=float, default=0.25)
    ap.add_argument("--min-ppm", type=float, default=300.0, help="base colour texels per metre at --real-size")
    ap.add_argument("--real-size", type=float, default=0.0, help="the object's real largest side in metres")
    ap.add_argument("models", nargs="+")
    a = ap.parse_args()
    bad = 0
    for path in a.models:
        j, bin_ = glb(path)
        texs = images(j, bin_)
        size_m = a.real_size or extent(j, bin_) or 1.0
        fails = []
        if texs and not any(t[0] == "base" for t in texs):
            # no slot names (textures behind an extension): judge every texture as if it were the base colour
            texs = [("base", t[1]) for t in texs]
        if not texs:
            fails.append("no texture at all")
        for roleid, img in texs:
            s, d, k = measure(img)
            ppm = s / size_m
            line = f"  {roleid:8s} {img.size[0]}x{img.size[1]}  detail {d:.4f}  blocky {k:.3f}  {ppm:.0f} px/m"
            if roleid == "base":
                if s < a.min:
                    fails.append(f"base colour {s}px < {a.min}")
                if d < a.min_detail:
                    fails.append(f"base colour soft/upscaled (detail {d:.4f} < {a.min_detail})")
                if k > a.max_blocky:
                    fails.append(f"base colour blocky ({k:.0%} flat 2x2 blocks)")
                if ppm < a.min_ppm:
                    fails.append(f"base colour {ppm:.0f} px/m < {a.min_ppm:.0f} at {size_m:.1f} m")
            print(line)
        verdict = "PASS" if not fails else "FAIL " + "; ".join(fails)
        print(f"{verdict}  {path}")
        bad += bool(fails)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
