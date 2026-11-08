"""
Fit the Godot build's models to the phone (owner, Nov 8: "upgrade game and rigged images to fit android").

Every GLB under godot-world-fracture/models is held to a triangle cap by category and its textures to a pixel cap; rigged
bodies and heads keep their armature, skin weights, shape keys and animation clips (Decimate's Collapse keeps vertex
groups; meshes with shape keys are left alone). Results overwrite in place and a budget report is printed, so the pass is
idempotent: a model already under its caps is skipped.

    blender -b -P scripts/fit-godot-android.py -- godot-world-fracture/models [--dry] [--only=substring]

Caps (triangles / texture px):  city props 6k/512 · buildings 14k/1024 · furniture 5k/512 · fleet 12k/1024 (…-lod files
kept) · weapons 8k/1024 · operator bodies 12k/1024 · heads 4k/512 · foliage 2k/512. Why: the street slice places
87k-triangle planters and 20k palms every few metres across three streamed blocks, and the phone has a budget of ~1 M
triangles a frame.
"""
import sys, os, struct, json, glob, random
import bpy
import bmesh

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
root = argv[0]
dry = "--dry" in argv
only = next((a.split("=", 1)[1] for a in argv if a.startswith("--only=")), "")

CAPS = [  # (path substring, tris, tex)
    ("operators/heads", 4000, 512),
    ("operators/bodies", 12000, 1024),
    ("weapons/", 8000, 1024),
    ("fleet/", 12000, 1024),
    ("foliage/", 2500, 512),
    ("buildings/", 14000, 1024),
]
CITY_BUILDINGS = {"apartment", "brick", "office", "deco", "villa", "casino", "garage", "shopfront", "tower"}
CITY_FURNITURE = {"bed", "sofa", "table", "chair", "lamp-floor", "desk", "shelf", "kitchen", "tv", "rug", "plant", "wardrobe"}


def caps_for(path):
    rel = path.replace("\\", "/")
    for sub, t, x in CAPS:
        if sub in rel:
            return t, x
    stem = os.path.basename(rel)[:-4]
    if "/city/" in rel:
        if any(stem.startswith(b) for b in CITY_BUILDINGS):
            return 14000, 1024
        if any(stem.startswith(f) for f in CITY_FURNITURE):
            return 5000, 512
        if stem in ("man", "woman", "echo", "concierge", "wreck", "police-car"):
            return 10000, 1024
        return 6000, 512
    return 10000, 1024


def tri_count(path):
    d = open(path, "rb").read()
    if d[:4] != b"glTF":
        return 0
    ln = struct.unpack("<I", d[12:16])[0]
    js = json.loads(d[20:20 + ln])
    n = 0
    for m in js.get("meshes", []):
        for pr in m.get("primitives", []):
            acc = js["accessors"][pr["indices"]] if "indices" in pr else js["accessors"][pr["attributes"]["POSITION"]]
            n += acc["count"] // 3
    return n


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def shrink_images(cap):
    for img in bpy.data.images:
        if img.size[0] > cap or img.size[1] > cap:
            s = cap / max(img.size[0], img.size[1])
            img.scale(max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s)))


def is_foliage(o):
    """many tiny disconnected pieces (leaves, petals, grass cards): islands small relative to the face count"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    seen = set()
    islands = 0
    for v in bm.verts:
        if v.index in seen:
            continue
        islands += 1
        stack = [v]
        seen.add(v.index)
        while stack:
            cur = stack.pop()
            for e in cur.link_edges:
                w = e.other_vert(cur)
                if w.index not in seen:
                    seen.add(w.index)
                    stack.append(w)
        if islands > 400:
            break
    faces = len(bm.faces)
    bm.free()
    return islands >= 60 and faces / max(islands, 1) < 60


def thin_faces(o, keep):
    rng = random.Random(7)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    # drop whole islands rather than faces, so no leaf is left half-drawn
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    seen = set()
    drop = []
    for f in bm.faces:
        if f.index in seen:
            continue
        island = []
        stack = [f]
        seen.add(f.index)
        while stack:
            cur = stack.pop()
            island.append(cur)
            for e in cur.edges:
                for g in e.link_faces:
                    if g.index not in seen:
                        seen.add(g.index)
                        stack.append(g)
        if rng.random() > keep:
            drop.extend(island)
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    bm.to_mesh(o.data)
    bm.free()


def fit(path):
    tris_cap, tex_cap = caps_for(path)
    before = tri_count(path)
    if before <= tris_cap and not dry:
        # still shrink oversized textures
        pass
    clear()
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    total = sum(len(o.data.polygons) for o in meshes)
    changed = False
    if total > tris_cap * 1.02:
        # the budget comes out of the big meshes; small ones (under 800 faces) keep every face
        big_meshes = [o for o in meshes if len(o.data.polygons) >= 800 and o.data.shape_keys is None]
        small = total - sum(len(o.data.polygons) for o in big_meshes)
        want = max(tris_cap - small, 0)
        big_total = max(sum(len(o.data.polygons) for o in big_meshes), 1)
        ratio = want / big_total
        for o in big_meshes:
            n = len(o.data.polygons)
            if is_foliage(o):
                # leaf clouds: dropping whole faces keeps every leaf's shape, collapse would shred them
                keep = max(ratio, 0.12)
                thin_faces(o, keep)
            else:
                m = o.modifiers.new("fit", "DECIMATE")
                m.decimate_type = "COLLAPSE"
                m.ratio = max(ratio, 0.15)
                m.use_collapse_triangulate = True
                bpy.context.view_layer.objects.active = o
                bpy.ops.object.modifier_apply(modifier=m.name)
            changed = True
    big = [i for i in bpy.data.images if i.size[0] > tex_cap or i.size[1] > tex_cap]
    if big:
        shrink_images(tex_cap)
        changed = True
    after = sum(len(o.data.polygons) for o in meshes)
    if changed and not dry:
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_image_format="AUTO", export_jpeg_quality=82,
                                  export_apply=False, export_animations=True, export_skins=True, export_morph=True,
                                  export_yup=True)
    return before, after, tris_cap, tex_cap, len(big), changed


files = sorted(glob.glob(os.path.join(root, "**", "*.glb"), recursive=True))
total_before = total_after = 0
for f in files:
    if only and only not in f:
        continue
    b, a, tc, xc, imgs, ch = fit(f)
    total_before += b
    total_after += a
    mark = "FIT " if ch else "ok  "
    print(f"{mark}{b:>7} -> {a:>7} tris (cap {tc:>5}, tex {xc}, {imgs} big tex)  {os.path.relpath(f, root)}", flush=True)
print(f"total {total_before} -> {total_after} triangles over {len(files)} models{' (dry run)' if dry else ''}")
