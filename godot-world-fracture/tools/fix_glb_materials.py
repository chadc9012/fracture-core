"""Fit a glTF car's materials to Godot's renderer (no KHR_materials_transmission there): glass becomes tinted
alpha-blended glass, full-metal paints come down to `metal` so their colour shows without a sky to reflect, and lose
their flake normal maps.
    python3 tools/fix_glb_materials.py in.glb out.glb [metal] [--blank i,j]
`--blank` replaces those images (a logo, a branded tyre wall) with a plain dark 4x4 PNG and rebuilds the binary chunk.
"""
import io, json, struct, sys

src, dst = sys.argv[1], sys.argv[2]
args = [a for a in sys.argv[3:] if not a.startswith("--")]
metal = float(args[0]) if args and args[0].replace(".", "", 1).isdigit() else 0.6
blank = set()
if "--blank" in sys.argv:
    blank = {int(x) for x in sys.argv[sys.argv.index("--blank") + 1].split(",")}
b = open(src, "rb").read()
jl = struct.unpack("<I", b[12:16])[0]
j = json.loads(b[20:20 + jl])
rest = b[20 + jl:]
for m in j.get("materials", []):
    ext = m.get("extensions", {})
    name = (m.get("name") or "").lower()
    pbr = m.setdefault("pbrMetallicRoughness", {})
    if "KHR_materials_transmission" in ext or "glass" in name:
        ext.pop("KHR_materials_transmission", None)
        m["alphaMode"] = "BLEND"
        pbr["baseColorFactor"] = [0.04, 0.05, 0.06, 0.45]
        pbr["metallicFactor"] = 0.2
        pbr["roughnessFactor"] = 0.05
    elif name.startswith("paint"):
        if pbr.get("metallicFactor", 1.0) > metal:
            pbr["metallicFactor"] = metal
        # the metal-flake normal map tiles finely through KHR_texture_transform; stretched over the body it mottles
        m.pop("normalTexture", None)
    # a licence plate printed with someone's logo (the Khronos sample's) goes plain: logos aren't ours to use
    if "license" in name or "licence" in name:
        pbr.pop("baseColorTexture", None)
        pbr["baseColorFactor"] = [0.85, 0.85, 0.82, 1.0]
    # an occlusion map at strength 0 is off in glTF; Godot's importer applies it anyway
    occ = m.get("occlusionTexture")
    if occ is not None and float(occ.get("strength", 1.0)) <= 0.0:
        m.pop("occlusionTexture", None)
    if not ext:
        m.pop("extensions", None)
used = set()
for m in j.get("materials", []):
    used.update(m.get("extensions", {}).keys())
for key in ("extensionsUsed", "extensionsRequired"):
    if key in j:
        j[key] = [e for e in j[key] if not e.startswith("KHR_materials_") or e in used or e == "KHR_materials_variants"]
if blank:
    # rebuild the BIN chunk view by view, the blanked images swapped for a plain PNG
    from PIL import Image
    tiny = io.BytesIO()
    Image.new("RGB", (4, 4), (18, 18, 20)).save(tiny, "PNG")
    tiny = tiny.getvalue()
    bin_len = struct.unpack("<I", rest[0:4])[0]
    data = rest[8:8 + bin_len]
    swap = {j["images"][i]["bufferView"]: tiny for i in blank}
    for i in blank:
        j["images"][i]["mimeType"] = "image/png"
    out_bin = bytearray()
    for vi, bv in enumerate(j["bufferViews"]):
        chunk = swap.get(vi, data[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]])
        while len(out_bin) % 4:
            out_bin.append(0)
        bv["byteOffset"] = len(out_bin)
        bv["byteLength"] = len(chunk)
        out_bin += chunk
    while len(out_bin) % 4:
        out_bin.append(0)
    j["buffers"][0]["byteLength"] = len(out_bin)
    rest = struct.pack("<II", len(out_bin), 0x004E4942) + bytes(out_bin)
js = json.dumps(j, separators=(",", ":")).encode()
js += b" " * ((4 - len(js) % 4) % 4)
out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + len(rest)) + struct.pack("<II", len(js), 0x4E4F534A) + js + rest
open(dst, "wb").write(out)
print("wrote", dst)
