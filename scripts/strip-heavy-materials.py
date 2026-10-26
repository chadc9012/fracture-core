"""Strip glTF material extensions that are too heavy for phones from imported fleet GLBs (offline tool; Python 3 only).

- KHR_materials_transmission (every file): three.js renders the whole scene a second time per frame for refraction; on phone GPUs
  it doubled the frame cost and could blank the frame (owner's phone, Nexus City traffic, Oct 26 2026). The glass stays
  alpha-blended at its authored alpha.
- KHR_materials_specular / KHR_materials_clearcoat (`--lite`, the traffic LOD files): each forces MeshPhysicalMaterial, a much
  bigger shader, on every material of every traffic car. A low specular factor is approximated by a slightly rougher surface.

usage: python3 scripts/strip-heavy-materials.py [--lite] file.glb ...   (rewrites in place; only the JSON chunk changes)
"""
import json, struct, sys

lite = "--lite" in sys.argv
for path in [a for a in sys.argv[1:] if a != "--lite"]:
    data = open(path, "rb").read()
    jlen = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + jlen])
    rest = data[20 + jlen:]
    drop = {"KHR_materials_transmission"} | ({"KHR_materials_specular", "KHR_materials_clearcoat"} if lite else set())
    for m in gltf.get("materials", []):
        ext = m.get("extensions", {})
        spec = ext.get("KHR_materials_specular", {}).get("specularFactor")
        if "KHR_materials_transmission" in ext:
            m["alphaMode"] = "BLEND"
        if lite and spec is not None:
            pbr = m.setdefault("pbrMetallicRoughness", {})
            pbr["roughnessFactor"] = min(1.0, pbr.get("roughnessFactor", 1.0) + 0.15 * (1 - spec))
        for k in drop: ext.pop(k, None)
        if not ext: m.pop("extensions", None)
    used = {k for m in gltf.get("materials", []) for k in m.get("extensions", {})}
    for key in ("extensionsUsed", "extensionsRequired"):
        if key in gltf:
            gltf[key] = [e for e in gltf[key] if not (e.startswith("KHR_materials_") and e not in used)]
            if not gltf[key]: gltf.pop(key)
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + len(rest)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total)); f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js); f.write(rest)
    print(path, "->", gltf.get("extensionsUsed", []))
