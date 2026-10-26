"""Fit a downloaded car model into the game's fleet contract (offline tool; Blender bpy).

The fleet GLBs (public/models/fleet/*.glb, read by AuthoredVehicle.tsx) are real metres, nose toward three.js +Z (Blender -Y),
ground at y = 0, with SteerFL/SteerFR pivots holding WheelFL/WheelFR, plain WheelRL/WheelRR, each wheel spinning about X with a
`wheelRadius` extra, a material named "Paint" (the garage recolours it) and one named "Glass". A model from Sketchfab or a store
is none of that: tiny or huge, any orientation, wheels mixed in with the body, dozens of materials and 2-4K textures. This:

  1. imports it, flattens the hierarchy and applies every transform;
  2. drops the faces of the --drop materials (decals and logo sheets: real brands come off);
  3. turns it so its long axis runs along Y and its nose (--nose=+y|-y in the source frame after import) points to -Y, scales it to
     --length metres, centres it and stands it on the ground;
  4. finds the four wheels from the parts that use the --wheel materials, groups each corner's parts (with anything else inside
     that wheel, such as discs and calipers), and makes WheelFL/FR/RL/RR with their origin at the hub (fronts under SteerFL/FR);
  5. joins the rest into Body, renames the --paint materials to Paint (with --flatpaint the livery texture is removed so only the
     garage colour shows) and the --glass materials to Glass;
  6. decimates the body to about --tris triangles and shrinks every texture to --tex pixels, then writes the GLB.

usage: blender -b -P scripts/fit-fleet-model.py -- SRC.glb OUT.glb --length=4.6 --nose=+y --paint=PAINT --glass=GLASS
       --wheel=WHEEL,TYRE [--drop=phong5] [--dropobj=Object_12,...] [--tailobj=...] [--headobj=...] [--flatpaint=#rrggbb] [--tris=60000] [--tex=1024] [--wheeltris=400]
"""
import math
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
src, out = argv[0], argv[1]
opts = dict(a[2:].split("=", 1) if "=" in a else (a[2:], "1") for a in argv[2:] if a.startswith("--"))
lst = lambda k: [s for s in opts.get(k, "").split(",") if s]
LENGTH = float(opts.get("length", "4.6")); NOSE = opts.get("nose", "-y")
PAINT, GLASS, WHEEL, DROP, DROPOBJ = lst("paint"), lst("glass"), lst("wheel"), lst("drop"), lst("dropobj")
TAILOBJ, HEADOBJ = lst("tailobj"), lst("headobj")
TRIS = int(opts.get("tris", "60000")); TEX = int(opts.get("tex", "1024")); FLAT = opts.get("flatpaint")
WHEEL_TRIS = int(opts.get("wheeltris", "0"))  # >0: decimate each wheel too (the light traffic copy)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene


def select(objs, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or (objs[0] if objs else None)


# 1. flatten: every mesh in world space, no parents, transforms applied (--dropobj: badges that are their own meshes go first)
for o in [o for o in scene.objects if o.type == "MESH" and o.name in DROPOBJ]:
    bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in scene.objects if o.type == "MESH"]
# lamps (--tailobj / --headobj): their surfaces become the game's Taillight / Headlight materials (AuthoredVehicle brightens the
# tails on braking and the heads at night), keeping the lamp's own texture under a red or white glow
def lamp_material(name, emit):
    made = None  # one material per lamp kind (the game finds it by its exact name), from the first lamp's own material
    for o in meshes:
        if o.name not in (TAILOBJ if name == "Taillight" else HEADOBJ):
            continue
        for i, m in enumerate(o.data.materials):
            if m is None or m is made:
                continue
            if made is None:
                made = m.copy(); made.name = name
                b = next(n for n in made.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
                b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = 1.0
            o.data.materials[i] = made
lamp_material("Taillight", (1.0, 0.03, 0.01))
lamp_material("Headlight", (0.85, 0.93, 1.0))
for o in meshes:
    if o.data.users > 1:
        o.data = o.data.copy()
select(meshes)
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in scene.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o, do_unlink=True)

# 2. drop decal / logo materials
def mat_names(o):
    return [m.name if m else "" for m in o.data.materials]
if DROP:
    for o in list(meshes):
        names = mat_names(o)
        bad = {i for i, n in enumerate(names) if any(d.lower() == n.lower() for d in DROP)}
        if not bad:
            continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in bad], context="FACES")
        bm.to_mesh(o.data); bm.free()
        if not o.data.polygons:
            meshes.remove(o); bpy.data.objects.remove(o, do_unlink=True)


def bounds(objs):
    mn = Vector((1e18,) * 3); mx = Vector((-1e18,) * 3)
    for o in objs:
        for v in o.data.vertices:
            mn = Vector(map(min, mn, v.co)); mx = Vector(map(max, mx, v.co))
    return mn, mx


def transform_all(m):
    for o in meshes:
        o.data.transform(m)
        o.data.update()


# 3. orient, scale, centre, ground
mn, mx = bounds(meshes)
size = mx - mn
if size.x > size.y:  # long axis on X: turn it onto Y
    transform_all(Matrix.Rotation(math.pi / 2, 4, "Z"))
    NOSE = {"+x": "-y", "-x": "+y"}.get(NOSE, NOSE)
if NOSE == "+y":
    transform_all(Matrix.Rotation(math.pi, 4, "Z"))
mn, mx = bounds(meshes)
k = LENGTH / (mx.y - mn.y)
c = (mn + mx) / 2
transform_all(Matrix.Scale(k, 4) @ Matrix.Translation(Vector((-c.x, -c.y, -mn.z))))
mn, mx = bounds(meshes)
print("FIT bounds", tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))

# 4. wheels: split the wheel-material parts into loose parts, group them by corner
wheel_parts = []
for o in list(meshes):
    names = mat_names(o)
    idx = {i for i, n in enumerate(names) if any(w.lower() == n.lower() for w in WHEEL)}
    if not idx:
        continue
    if len(idx) == len(names):
        wheel_parts.append(o); meshes.remove(o); continue
    # a mixed mesh: split the wheel faces off
    select([o]); bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="DESELECT"); bpy.ops.object.mode_set(mode="OBJECT")
    for p in o.data.polygons:
        p.select = p.material_index in idx
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.separate(type="SELECTED"); bpy.ops.object.mode_set(mode="OBJECT")
    new = [x for x in bpy.context.selected_objects if x is not o]
    wheel_parts += new
corners = {"FL": [], "FR": [], "RL": [], "RR": []}
for o in wheel_parts:
    a, b = bounds([o]); cc = (a + b) / 2
    corners[("F" if cc.y < 0 else "R") + ("L" if cc.x < 0 else "R")].append(o)
hubs = {}
for key, parts in corners.items():
    if not parts:
        raise SystemExit(f"no wheel parts at {key}: check --wheel")
    a, b = bounds(parts)
    hubs[key] = ((a + b) / 2, (b.z - a.z) / 2, a, b)
# anything else sitting inside a wheel's box (discs, calipers, nuts) goes with it
for o in list(meshes):
    a, b = bounds([o])
    for key, (h, r, wa, wb) in hubs.items():
        pad = 0.03
        if all(wa[i] - pad <= a[i] and b[i] <= wb[i] + pad for i in range(3)):
            corners[key].append(o); meshes.remove(o); break
R = sum(h[1] for h in hubs.values()) / 4
for key, parts in corners.items():
    hub = hubs[key][0]
    select(parts); bpy.ops.object.join()
    w = bpy.context.view_layer.objects.active
    w.name = "Wheel" + key
    w.data.transform(Matrix.Translation(-hub)); w.location = hub
    w["wheelRadius"] = round(R, 3)
    if key.startswith("F"):
        steer = bpy.data.objects.new("Steer" + key, None); scene.collection.objects.link(steer); steer.location = hub
        w.parent = steer; w.location = (0, 0, 0)
print("FIT wheel radius", round(R, 3), {k: tuple(round(v, 3) for v in h[0]) for k, h in hubs.items()})

# 5. body and materials
select(meshes); bpy.ops.object.join()
body = bpy.context.view_layer.objects.active; body.name = "Body"
def merge_into(names, target_name):
    mats = [m for m in bpy.data.materials if any(m.name.lower() == n.lower() for n in names)]
    if not mats:
        return None
    keep = mats[0]; keep.name = target_name
    for o in [x for x in scene.objects if x.type == "MESH"]:
        for i, m in enumerate(o.data.materials):
            if m in mats:
                o.data.materials[i] = keep
    return keep
paint = merge_into(PAINT, "Paint")
glass = merge_into(GLASS, "Glass")
if paint is not None and FLAT:
    bsdf = next(n for n in paint.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    for l in list(bsdf.inputs["Base Color"].links):
        paint.node_tree.links.remove(l)
    h = FLAT.lstrip("#"); rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in rgb]
    bsdf.inputs["Base Color"].default_value = (*lin, 1)
    bsdf.inputs["Metallic"].default_value = 0.5; bsdf.inputs["Roughness"].default_value = 0.35

# 6. decimate the body, shrink textures
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
if tris > TRIS:
    d = body.modifiers.new("dec", "DECIMATE"); d.ratio = TRIS / tris; d.use_collapse_triangulate = True
    select([body]); bpy.ops.object.modifier_apply(modifier=d.name)
print("FIT body tris", tris, "->", sum(len(p.vertices) - 2 for p in body.data.polygons))
if WHEEL_TRIS:
    for w in [o for o in scene.objects if o.type == "MESH" and o.name.startswith("Wheel")]:
        wt = sum(len(p.vertices) - 2 for p in w.data.polygons)
        if wt > WHEEL_TRIS:
            d = w.modifiers.new("dec", "DECIMATE"); d.ratio = WHEEL_TRIS / wt
            select([w]); bpy.ops.object.modifier_apply(modifier=d.name)
for img in bpy.data.images:
    if img.size[0] > TEX or img.size[1] > TEX:
        s = TEX / max(img.size)
        img.scale(max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s)))
for m in bpy.data.materials:
    m.use_backface_culling = False
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_extras=True, export_image_format="AUTO", export_apply=True)
print("WROTE", out)
