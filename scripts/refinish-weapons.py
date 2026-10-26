"""Refinish the weapon GLBs' materials (offline tool; Python 3 + numpy + Pillow, no Blender).

The authored weapons (public/models/weapons/*.glb, Meshy image-to-3D fitted by fit-weapon-meshy.py) carry Meshy's texture atlas:
a noisy, speckled base colour and a metal/roughness map that makes most of the gun near-mirror chrome (metal ~1, roughness
~0.1-0.3). In game that read as a glossy black blob with white sky blotches (owner phone shots, Oct 26 2026). This keeps the
geometry and UVs and rebuilds the surface as a real weapon finish, classified per texel from the old base colour:

  - polymer (the darkest texels): near-black matte furniture, metal 0.05, roughness ~0.6
  - gunmetal (the middle): dark Cerakote-style gunmetal, metal 0.8, roughness ~0.38, a little of the old detail kept as wear
  - worn edges (the brightest): bare steel showing through, metal 1, roughness ~0.24
  - accents (orange/amber texels): kept as colour and written to an emissive map, so seams and vents glow

The base colour is median-filtered first, which removes Meshy's speckle while keeping panel lines. The normal map is kept.
Every image that is no longer used is dropped and the binary chunk is compacted, so the file doesn't grow.

usage: python3 scripts/refinish-weapons.py [names...]   (default: rifle pistol shotgun heavy launcher; it skips files already done)
"""
import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "models", "weapons")
NAMES = sys.argv[1:] or ["rifle", "pistol", "shotgun", "heavy", "launcher"]  # the sword keeps its bright steel blade

POLYMER = np.array([0.11, 0.115, 0.12])   # linear-ish display values, the finish's base colours
GUNMETAL = np.array([0.30, 0.315, 0.34])
STEEL = np.array([0.58, 0.6, 0.62])


def read_glb(path):
    data = open(path, "rb").read()
    jlen = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + jlen])
    boff = 20 + jlen
    blen = struct.unpack("<I", data[boff:boff + 4])[0]
    return gltf, bytearray(data[boff + 8:boff + 8 + blen])


def view_bytes(gltf, binary, index):
    v = gltf["bufferViews"][index]
    o = v.get("byteOffset", 0)
    return bytes(binary[o:o + v["byteLength"]])


def image_of(gltf, binary, tex_index):
    img = gltf["images"][gltf["textures"][tex_index]["source"]]
    return Image.open(io.BytesIO(view_bytes(gltf, binary, img["bufferView"]))).convert("RGB")


def add_image(gltf, pending, im, name):
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=90, optimize=True)
    pending.append(buf.getvalue())
    gltf["bufferViews"].append({"buffer": 0, "byteLength": len(pending[-1]), "__pending": len(pending) - 1})
    gltf["images"].append({"mimeType": "image/jpeg", "bufferView": len(gltf["bufferViews"]) - 1, "name": name})
    gltf.setdefault("samplers", [{"magFilter": 9729, "minFilter": 9987}])
    gltf["textures"].append({"source": len(gltf["images"]) - 1, "sampler": 0})
    return len(gltf["textures"]) - 1


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def refinish(base: Image.Image):
    clean = base.filter(ImageFilter.MedianFilter(7))
    c = np.asarray(clean).astype(np.float32) / 255.0
    o = np.asarray(base).astype(np.float32) / 255.0
    lum = c @ np.array([0.2126, 0.7152, 0.0722])
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    # accents: warm, saturated texels (Meshy paints the glowing seams orange)
    accent = smoothstep(0.12, 0.3, r - b) * smoothstep(0.3, 0.5, r)
    # classes by brightness of the cleaned colour, with soft borders
    lo, hi = np.percentile(lum, 35), np.percentile(lum, 97)
    steel = smoothstep(hi - 0.04, hi + 0.08, lum) * (1 - accent)
    poly = (1 - smoothstep(lo - 0.05, lo + 0.05, lum)) * (1 - accent) * (1 - steel)
    metal_w = np.clip(1 - steel - poly - accent, 0, 1)
    # a little of the original detail survives as wear and grime (centred around its own mean)
    detail = (o @ np.array([0.2126, 0.7152, 0.0722])) - lum
    col = (poly[..., None] * POLYMER + metal_w[..., None] * GUNMETAL + steel[..., None] * STEEL + accent[..., None] * c)
    col = np.clip(col + detail[..., None] * 0.18, 0, 1)
    rough = poly * 0.62 + metal_w * 0.5 + steel * 0.3 + accent * 0.4 + np.abs(detail) * 0.35
    metal = poly * 0.05 + metal_w * 0.8 + steel * 1.0 + accent * 0.1
    mr = np.zeros_like(c)
    mr[..., 0] = 1.0                       # occlusion channel unused: white
    mr[..., 1] = np.clip(rough, 0.18, 0.85)
    mr[..., 2] = np.clip(metal, 0, 1)
    # accents glow amber whatever shade Meshy painted them
    emis = np.array([1.0, 0.55, 0.18]) * accent[..., None]
    col = col * (1 - accent[..., None]) + np.array([1.0, 0.6, 0.25]) * accent[..., None]
    to_im = lambda a: Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
    return to_im(col), to_im(mr), to_im(emis), float(accent.mean())


def write_glb(path, gltf, binary, pending):
    used = set()
    for a in gltf.get("accessors", []):
        if "bufferView" in a: used.add(a["bufferView"])
    for im in gltf.get("images", []):
        if "bufferView" in im: used.add(im["bufferView"])
    out = bytearray()
    remap = {}
    views = []
    for i, v in enumerate(gltf["bufferViews"]):
        if i not in used:
            continue
        chunk = pending[v["__pending"]] if "__pending" in v else view_bytes(gltf, binary, i)
        while len(out) % 4:
            out.append(0)
        nv = {k: val for k, val in v.items() if k != "__pending"}
        nv["byteOffset"] = len(out)
        nv["byteLength"] = len(chunk)
        out.extend(chunk)
        remap[i] = len(views)
        views.append(nv)
    gltf["bufferViews"] = views
    for a in gltf.get("accessors", []):
        if "bufferView" in a: a["bufferView"] = remap[a["bufferView"]]
    for im in gltf.get("images", []):
        if "bufferView" in im: im["bufferView"] = remap[im["bufferView"]]
    while len(out) % 4:
        out.append(0)
    gltf["buffers"] = [{"byteLength": len(out)}]
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(out), 0x004E4942)); f.write(out)


def drop_unused_images(gltf):
    used_tex = set()
    for m in gltf.get("materials", []):
        for key in ("normalTexture", "occlusionTexture", "emissiveTexture"):
            if key in m: used_tex.add(m[key]["index"])
        pbr = m.get("pbrMetallicRoughness", {})
        for key in ("baseColorTexture", "metallicRoughnessTexture"):
            if key in pbr: used_tex.add(pbr[key]["index"])
    tex_map, textures = {}, []
    for i, t in enumerate(gltf.get("textures", [])):
        if i in used_tex:
            tex_map[i] = len(textures); textures.append(t)
    img_used = sorted({t["source"] for t in textures})
    img_map = {old: new for new, old in enumerate(img_used)}
    gltf["images"] = [gltf["images"][i] for i in img_used]
    for t in textures: t["source"] = img_map[t["source"]]
    gltf["textures"] = textures
    for m in gltf.get("materials", []):
        for key in ("normalTexture", "occlusionTexture", "emissiveTexture"):
            if key in m: m[key]["index"] = tex_map[m[key]["index"]]
        pbr = m.get("pbrMetallicRoughness", {})
        for key in ("baseColorTexture", "metallicRoughnessTexture"):
            if key in pbr: pbr[key]["index"] = tex_map[pbr[key]["index"]]


for name in NAMES:
    path = os.path.join(ROOT, f"{name}.glb")
    gltf, binary = read_glb(path)
    if any(m.get("extras", {}).get("wfFinish") for m in gltf.get("materials", [])):
        print(f"{name}: already refinished, skipped"); continue
    pending = []
    for m in gltf["materials"]:
        pbr = m.get("pbrMetallicRoughness", {})
        if "baseColorTexture" not in pbr:
            continue
        col, mr, emis, accent = refinish(image_of(gltf, binary, pbr["baseColorTexture"]["index"]))
        pbr["baseColorTexture"] = {"index": add_image(gltf, pending, col, f"{m.get('name')}_finish")}
        pbr["metallicRoughnessTexture"] = {"index": add_image(gltf, pending, mr, f"{m.get('name')}_mr")}
        pbr.pop("metallicFactor", None); pbr.pop("roughnessFactor", None)
        if accent > 0.0005:
            m["emissiveTexture"] = {"index": add_image(gltf, pending, emis, f"{m.get('name')}_glow")}
            m["emissiveFactor"] = [1.6, 1.6, 1.6]
        # Meshy's normal map is mostly noise at this scale: at full strength every bump catches a white highlight
        if "normalTexture" in m: m["normalTexture"]["scale"] = 0.35
        m.setdefault("extras", {})["wfFinish"] = "refinish-weapons.py v5"
    drop_unused_images(gltf)
    before = os.path.getsize(path)
    write_glb(path, gltf, binary, pending)
    print(f"{name}: {before // 1024} KB -> {os.path.getsize(path) // 1024} KB")
