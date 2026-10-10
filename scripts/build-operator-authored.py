#!/usr/bin/env python3
"""Builds a web-sized authored operator GLB from Meshy exports (offline tool; pure Pillow + stdlib).

Meshy's "withSkin" animation exports each carry the same mesh, skeleton and 4K PNG textures (~50 MB) plus ONE clip. This tool takes one export
as the base (mesh + skin + textures + its clip), copies the clips of the other exports onto the same skeleton (node names must match), renames
them to the game's locomotion names (walk / run), and re-encodes the textures to web size (base colour 2048 JPEG, normal + metal/rough 1024 JPEG).

usage: build-operator-authored.py OUT.glb BASE.glb[:clipname] OTHER.glb:clipname ...
   e.g. build-operator-authored.py public/models/operators/cipher-authored.glb Walking.glb:walk Running.glb:run
"""
import io, json, struct, sys
from PIL import Image

def load(path):
    b = open(path, "rb").read()
    cl, _ = struct.unpack("<II", b[12:20]); j = json.loads(b[20:20 + cl])
    bl, _ = struct.unpack("<II", b[20 + cl:28 + cl]); return j, b[28 + cl:28 + cl + bl]

def view_bytes(j, bin_, i):
    v = j["bufferViews"][i]; o = v.get("byteOffset", 0); return bin_[o:o + v["byteLength"]]

def encode(img, size, quality):
    im = img.convert("RGB")
    if im.size[0] > size: im = im.resize((size, size), Image.LANCZOS)
    out = io.BytesIO(); im.save(out, "JPEG", quality=quality, optimize=True, progressive=True); return out.getvalue()

def main(out_path, specs):
    parsed = []
    for s in specs:
        path, _, name = s.partition(":"); j, b = load(path); parsed.append((j, b, name))
    base, base_bin, base_name = parsed[0]
    names = [n.get("name") for n in base["nodes"]]
    # re-encode textures; role comes from the material that references the image
    mat = base["materials"][0]; tex = base["textures"]
    role = {}
    role[tex[mat["normalTexture"]["index"]]["source"]] = ("normal", 1024, 90)
    pbr = mat["pbrMetallicRoughness"]
    role[tex[pbr["baseColorTexture"]["index"]]["source"]] = ("base", 2048, 86)
    role[tex[pbr["metallicRoughnessTexture"]["index"]]["source"]] = ("mr", 1024, 88)
    new_img = {}
    for i, im in enumerate(base["images"]):
        _, size, q = role[i]
        data = encode(Image.open(io.BytesIO(view_bytes(base, base_bin, im["bufferView"]))), size, q)
        new_img[im["bufferView"]] = data; im["mimeType"] = "image/jpeg"
    # collect the clips: the base's own clip first, then the others, remapped onto the base's accessors/bufferViews
    extra_views = []  # (bytes, target)
    anims = []
    for k, (j, b, name) in enumerate(parsed):
        assert [n.get("name") for n in j["nodes"]] == names, "skeleton mismatch in " + specs[k]
        a = j["animations"][0]
        if k == 0:
            a["name"] = name or a.get("name"); anims.append(a); continue
        acc_map = {}
        def copy_acc(ai):
            if ai in acc_map: return acc_map[ai]
            acc = dict(j["accessors"][ai]); bv = j["bufferViews"][acc["bufferView"]]
            data = b[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
            base["bufferViews"].append({"buffer": 0, "byteOffset": 0, "byteLength": len(data), **({"target": bv["target"]} if "target" in bv else {})})
            extra_views.append((len(base["bufferViews"]) - 1, data))
            acc["bufferView"] = len(base["bufferViews"]) - 1; acc.pop("byteOffset", None) if acc.get("byteOffset") == 0 else None
            if "byteOffset" in dict(j["accessors"][ai]): acc["byteOffset"] = j["accessors"][ai]["byteOffset"]
            base["accessors"].append(acc); acc_map[ai] = len(base["accessors"]) - 1; return acc_map[ai]
        samplers = [{**s, "input": copy_acc(s["input"]), "output": copy_acc(s["output"])} for s in a["samplers"]]
        anims.append({"name": name or a.get("name"), "samplers": samplers, "channels": a["channels"]})
    base["animations"] = anims
    # rebuild the binary: every view in order, images swapped for the re-encoded bytes
    extra = dict(extra_views); out = bytearray(); 
    for i, v in enumerate(base["bufferViews"]):
        if i in new_img: data = new_img[i]
        elif i in extra: data = extra[i]
        else: data = view_bytes(base, base_bin, i)
        while len(out) % 4: out.append(0)
        v["byteOffset"] = len(out); v["byteLength"] = len(data); out += data
    while len(out) % 4: out.append(0)
    base["buffers"] = [{"byteLength": len(out)}]
    js = json.dumps(base, separators=(",", ":")).encode()
    while len(js) % 4: js += b" "
    glb = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack("<I4s", len(js), b"JSON") + js + struct.pack("<I4s", len(out), b"BIN\0") + bytes(out)
    open(out_path, "wb").write(glb)
    print(out_path, round(len(glb) / 1024), "KB;", len(anims), "clips:", [a["name"] for a in anims])

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
