"""Fit a Meshy image-to-3D model (an animal, a boat, any single prop) for the Godot build (offline tool; Blender bpy).

Meshy delivers one textured mesh at an arbitrary scale (about 2 m across) with the subject facing glTF +Z when the source
image showed it side-on (checked on the Abyssal bodies, scripts/fit-creature-meshy.py). This script:
  1. joins the meshes and applies their transforms;
  2. turns it by --turn degrees about the vertical axis if it does not face glTF +Z (Blender -Y);
  3. scales it so its longest horizontal extent is --length metres (or its height is --height metres);
  4. stands it on the origin: centred in plan, lowest point at y = 0 (a boat with --waterline=f sinks f of its height);
  5. decimates to --tris and writes JPEG textures at --tex px (the phone caps: scripts/fit-godot-android.py).

usage: blender -b -P scripts/fit-meshy-asset.py -- MESHY.glb OUT.glb (--length=1.9 | --height=1.2) [--turn=0] [--tris=8000]
       [--tex=1024] [--waterline=0] [--name=Deer]

Wildlife lengths (the species `body` z in godot-world-fracture/scripts/wildlife/wildlife.gd; out to models/wildlife/<id>.glb):
deer 1.7, boar 1.3, wolf 1.4, bear 2.1, panther 1.6, shark 3.4, crocodile 3.2, reptile 0.9.
"""
import sys, math, bpy
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
src, out = argv[:2]
opts = dict(a[2:].split("=", 1) if "=" in a else (a[2:], "1") for a in argv[2:] if a.startswith("--"))
turn = float(opts.get("turn", "0")); tris = int(opts.get("tris", "8000")); tex = int(opts.get("tex", "1024"))
waterline = float(opts.get("waterline", "0")); name = opts.get("name", "Body")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
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

if turn: body.data.transform(Matrix.Rotation(math.radians(turn), 4, "Z"))

def bounds():
    mn = Vector((min(v.co[i] for v in body.data.vertices) for i in range(3)))
    mx = Vector((max(v.co[i] for v in body.data.vertices) for i in range(3)))
    return mn, mx

mn, mx = bounds(); size = mx - mn
if "length" in opts: s = float(opts["length"]) / max(size.x, size.y)
elif "height" in opts: s = float(opts["height"]) / size.z
else: s = 1.0
body.data.transform(Matrix.Scale(s, 4))
mn, mx = bounds()
body.data.transform(Matrix.Translation(Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z - waterline * (mx.z - mn.z)))))
mn, mx = bounds()
print("SIZE (x,y,z) m:", tuple(round(v, 2) for v in (mx - mn)), "| longer along", "Y (good: glTF Z)" if (mx - mn).y >= (mx - mn).x else "X (check --turn)")

if len(body.data.polygons) > tris:
    m = body.modifiers.new("dec", "DECIMATE"); m.ratio = tris / len(body.data.polygons)
    bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier="dec")
body.name = name; body.data.name = name
for img in bpy.data.images:
    if img.size[0] > tex: img.scale(tex, tex)
    img.file_format = "JPEG"
for mat in bpy.data.materials: mat.name = name + "Mat"
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=85, export_apply=True)
print("WROTE", out, "faces", len(body.data.polygons))
