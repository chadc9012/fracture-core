"""Point a street variant's images at the full model's extracted textures (no second copy in the APK or in memory).

    python3 tools/street_variant_share.py models/fleet/street/<id>.glb models/fleet/[showroom/]<id>.glb

The street variant (gltfpack -si 0.3 of the full model) carries the same jpgs; Godot extracts the full model's as
<id>_Image_N.jpg next to it, so each embedded image is matched by content and replaced by a relative uri.
"""
import glob, hashlib, json, os, struct, sys

street, full = sys.argv[1], sys.argv[2]
d = open(street, "rb").read()
jl = struct.unpack("<I", d[12:16])[0]
j = json.loads(d[20:20 + jl])
bin_ = d[20 + jl + 8:]
base = os.path.splitext(full)[0]
by_md5 = {hashlib.md5(open(f, "rb").read()).hexdigest(): f for f in glob.glob(base + "_Image_*.jpg")}
drop = set()
for im in j["images"]:
    bv = j["bufferViews"][im["bufferView"]]
    o = bv.get("byteOffset", 0)
    h = hashlib.md5(bin_[o:o + bv["byteLength"]]).hexdigest()
    if h not in by_md5:
        sys.exit("no extracted texture matches an image of " + street)
    drop.add(im.pop("bufferView"))
    im.pop("mimeType", None)
    im["uri"] = os.path.relpath(by_md5[h], os.path.dirname(street))
# repack the binary chunk without the image views
keep = [i for i in range(len(j["bufferViews"])) if i not in drop]
remap = {old: new for new, old in enumerate(keep)}
out = bytearray()
views = []
for old in keep:
    bv = j["bufferViews"][old]
    o = bv.get("byteOffset", 0)
    while len(out) % 4:
        out.append(0)
    nb = dict(bv, byteOffset=len(out))
    out += bin_[o:o + bv["byteLength"]]
    views.append(nb)
j["bufferViews"] = views
for a in j.get("accessors", []):
    if "bufferView" in a:
        a["bufferView"] = remap[a["bufferView"]]
while len(out) % 4:
    out.append(0)
j["buffers"] = [{"byteLength": len(out)}]
js = json.dumps(j, separators=(",", ":")).encode()
js += b" " * (-len(js) % 4)
glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out))
glb += struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(out), 0x004E4942) + out
open(street, "wb").write(glb)
print(street, len(glb), [im["uri"] for im in j["images"]])
