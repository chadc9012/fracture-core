#!/usr/bin/env python3
"""Removes a flat display pedestal that image-to-3D sometimes fuses under a creature's feet (offline tool, stdlib only).

Drops every triangle whose three vertices all sit within FRACTION of the model height above its lowest point, then
rewrites the index buffer in place (padded to keep the GLB layout). usage: strip-pedestal.py IN.glb OUT.glb [fraction=0.05]"""
import json, struct, sys

def main(src, dst, frac=0.05):
    b = open(src, "rb").read()
    cl = struct.unpack("<I", b[12:16])[0]; j = json.loads(b[20:20 + cl]); bin_off = 20 + cl + 8
    binb = bytearray(b[bin_off:])
    prim = j["meshes"][0]["primitives"][0]
    pa = j["accessors"][prim["attributes"]["POSITION"]]; pv = j["bufferViews"][pa["bufferView"]]
    po = pv.get("byteOffset", 0) + pa.get("byteOffset", 0); stride = pv.get("byteStride", 12)
    ys = [struct.unpack_from("<f", binb, po + i * stride + 4)[0] for i in range(pa["count"])]
    lo, hi = min(ys), max(ys); cut = lo + (hi - lo) * frac
    ia = j["accessors"][prim["indices"]]; iv = j["bufferViews"][ia["bufferView"]]
    io = iv.get("byteOffset", 0) + ia.get("byteOffset", 0)
    fmt, size = {5125: ("<I", 4), 5123: ("<H", 2)}[ia["componentType"]]
    idx = [struct.unpack_from(fmt, binb, io + k * size)[0] for k in range(ia["count"])]
    kept = []
    for t in range(0, len(idx), 3):
        tri = idx[t:t + 3]
        if all(ys[v] < cut for v in tri): continue
        kept += tri
    for k, v in enumerate(kept): struct.pack_into(fmt, binb, io + k * size, v)
    ia["count"] = len(kept)
    ia.pop("max", None); ia.pop("min", None)
    js = json.dumps(j, separators=(",", ":")).encode()
    while len(js) % 4: js += b" "
    out = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(binb)) + struct.pack("<I4s", len(js), b"JSON") + js + struct.pack("<I4s", len(binb), b"BIN\0") + bytes(binb)
    open(dst, "wb").write(out)
    print(dst, "kept", len(kept) // 3, "of", len(idx) // 3, "triangles")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 0.05)
