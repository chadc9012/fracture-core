"""Fit a Meshy weapon into the game's weapon frame (offline tool; Blender bpy).

The game's weapon GLBs follow a node contract (heldModels.ts / ViewWeapon.tsx): <Prefix>Body, <Prefix>Mag (origin at the reload
pivot), optional <Prefix>Action / <Prefix>Accent / <Prefix>Blade, with the firing-hand grip at the origin and the barrel (or blade)
along glTF -Z. A Meshy image-to-3D model is one textured mesh in its own frame. This script:

  1. reads the CURRENT weapon GLB for its frame: overall bounds and the Mag node's bounds and pivot;
  2. turns the Meshy mesh so its long axis runs along the old barrel axis (the concept images show the muzzle on the left, i.e.
     Meshy -X; pass --muzzle=+x when it points right), scales it to the old length and centres it on the old bounds, so the grip
     lands where the old grip was;
  3. cuts the vertices inside the old magazine's bounds into <Prefix>Mag (origin at the old pivot) so reloads still drop the mag;
  4. decimates to --tris and writes <Prefix>Body + <Prefix>Mag with the Meshy textures (JPEG, --tex px).

  5. --grip=Y,Z moves the measured hand point (top of the pistol grip, or the wrist of a stocked gun) to the origin, since a
     Meshy gun's grip rarely sits where the old one's did; --magbox=Y0,Y1,Z0,Z1 gives the new magazine's box instead of the
     old one's. Both are in the fitted frame before the grip shift (Blender metres, Y along the barrel, Z up): run once with
     --nomag, render it against a grid, read them off.

usage: blender -b -P scripts/fit-weapon-meshy.py -- MESHY.glb OLD.glb OUT.glb Prefix [--muzzle=-x|+x] [--tris=12000] [--tex=1024]
       [--nomag] [--grip=Y,Z] [--magbox=Y0,Y1,Z0,Z1]
"""
import sys, math, bpy, bmesh
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
meshy, old, out, prefix = argv[:4]
opts = dict(a[2:].split("=", 1) if "=" in a else (a[2:], "1") for a in argv[4:] if a.startswith("--"))
muzzle = opts.get("muzzle", "-x"); tris = int(opts.get("tris", "12000")); tex = int(opts.get("tex", "1024")); nomag = "nomag" in opts

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def world_bounds(objs):
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in objs:
        if o.type != "MESH": continue
        for v in o.data.vertices:
            p = o.matrix_world @ v.co; mn = Vector(map(min, mn, p)); mx = Vector(map(max, mx, p))
    return mn, mx

# 1. the old frame (Blender space: glTF -Z barrel = Blender +Y, up = +Z)
clear(); bpy.ops.import_scene.gltf(filepath=old)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
omn, omx = world_bounds(objs)
mag_node = bpy.data.objects.get(prefix + "Mag")
mag_box = world_bounds([o for o in mag_node.children_recursive if o.type == "MESH"] + ([mag_node] if mag_node.type == "MESH" else [])) if mag_node else None
mag_pivot = mag_node.matrix_world.translation.copy() if mag_node else None
print("OLD bounds", tuple(omn), tuple(omx), "mag", mag_box and (tuple(mag_box[0]), tuple(mag_box[1])), "pivot", mag_pivot and tuple(mag_pivot))

# 2. the Meshy mesh, joined, turned, scaled and centred
clear(); bpy.ops.import_scene.gltf(filepath=meshy)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.context.scene.objects):
    if o != body: bpy.data.objects.remove(o, do_unlink=True)
# muzzle at Meshy -X (Blender -X) -> Blender +Y: rotate -90 deg about Z; +X -> +Y: +90
ang = -math.pi / 2 if muzzle == "-x" else math.pi / 2
body.data.transform(Matrix.Rotation(ang, 4, "Z"))
mn, mx = world_bounds([body])
old_len, new_len = omx.y - omn.y, mx.y - mn.y
k = old_len / max(new_len, 1e-6)
body.data.transform(Matrix.Scale(k, 4))
mn, mx = world_bounds([body])
oc, nc = (omn + omx) / 2, (mn + mx) / 2
body.data.transform(Matrix.Translation(Vector((oc.x - nc.x, oc.y - nc.y, oc.z - nc.z))))
body.name = prefix + "Body"; body.data.name = prefix + "Body"
print("NEW scale", k, "len", old_len)
grip = [float(v) for v in opts["grip"].split(",")] if "grip" in opts else None
if "magbox" in opts and mag_box:
    y0, y1, z0, z1 = (float(v) for v in opts["magbox"].split(","))
    mag_box = (Vector((-1, y0, z0)), Vector((1, y1, z1)))

# 4a. decimate before the cut so the mag edge stays clean
if len(body.data.polygons) > tris:
    m = body.modifiers.new("dec", "DECIMATE"); m.ratio = tris / len(body.data.polygons)
    bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier="dec")

# 3. cut the magazine
mag_obj = None
if mag_box and not nomag:
    lo, hi = mag_box[0].copy(), mag_box[1].copy()
    pad = (hi - lo) * (0.0 if "magbox" in opts else 0.12)
    lo -= pad; hi += pad
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(body.data)
    for f in bm.faces:
        c = f.calc_center_median()
        f.select = all(lo[i] <= c[i] <= hi[i] for i in range(3))
    sel = sum(1 for f in bm.faces if f.select)
    bmesh.update_edit_mesh(body.data)
    if sel:
        bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    others = [o for o in bpy.context.scene.objects if o.type == "MESH" and o != body]
    if others:
        mag_obj = others[0]; mag_obj.name = prefix + "Mag"; mag_obj.data.name = prefix + "Mag"
        # origin at the old reload pivot, so the rig drops it from the mag well
        mag_obj.data.transform(Matrix.Translation(-mag_pivot)); mag_obj.location = mag_pivot
    print("MAG faces", sel)

# 5. grip to the origin (the mag keeps the pivot ViewWeapon.tsx hard-codes; only its mesh moves)
if grip:
    shift = Matrix.Translation(Vector((0, -grip[0], -grip[1])))
    body.data.transform(shift)
    if mag_obj: mag_obj.data.transform(shift)
    print("GRIP shift", grip)

# 4b. textures to JPEG at web size
for img in bpy.data.images:
    if img.size[0] > tex: img.scale(tex, tex)
    img.file_format = "JPEG"
for m in bpy.data.materials: m.name = prefix + "Mat"  # Body and Mag share the one Meshy material

bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=85, export_apply=True)
print("WROTE", out, "faces", sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH"))
