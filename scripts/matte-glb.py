#!/usr/bin/env python3
"""Make a GLB's materials matte in place: metallicFactor 0, roughnessFactor at least ROUGH, normal map strength NORMAL.

The Meshy city buildings (office, brick, apartment, villa, casino, shopfront) come out of Meshy with bumpy, faceted
facades, a metal channel in their textures and a strong normal map. Under the city's lights every facet flashed like
crumpled foil (bug sweep, Nov 9: "the buildings look crumpled"). Only the glTF JSON chunk changes; the meshes and
textures are untouched.

Usage: python3 scripts/matte-glb.py [--rough 0.85] [--normal 0.35] file.glb ...
"""
import json, struct, sys


def matte(path, rough, normal):
    d = bytearray(open(path, "rb").read())
    magic, ver, total = struct.unpack("<III", d[:12])
    jlen, jtype = struct.unpack("<II", d[12:20])
    j = json.loads(d[20:20 + jlen])
    rest = d[20 + jlen:]
    for m in j.get("materials", []):
        pbr = m.setdefault("pbrMetallicRoughness", {})
        pbr["metallicFactor"] = 0.0
        pbr["roughnessFactor"] = max(float(pbr.get("roughnessFactor", 1.0)), rough)
        if "normalTexture" in m:
            m["normalTexture"]["scale"] = normal
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    out = struct.pack("<III", magic, ver, 12 + 8 + len(js) + len(rest)) + struct.pack("<II", len(js), jtype) + js + rest
    open(path, "wb").write(out)
    print("matte", path, len(j.get("materials", [])), "materials")


if __name__ == "__main__":
    a = sys.argv[1:]
    rough, normal = 0.85, 0.35
    if "--rough" in a:
        i = a.index("--rough"); rough = float(a[i + 1]); del a[i:i + 2]
    if "--normal" in a:
        i = a.index("--normal"); normal = float(a[i + 1]); del a[i:i + 2]
    for p in a:
        matte(p, rough, normal)
