"""Fit a Meshy image-to-3D sea creature for the swimming enemies (offline tool; Blender bpy).

The Abyssal bodies are solid meshes that swim with a travelling wave bent in the vertex shader (src/game/abyssal-swim.ts),
which needs the body to run along model +Z with the head forward (+Z in glTF = Blender -Y). This script:
  1. joins the Meshy meshes and applies their transforms (one mesh, identity node, so geometry space = model space);
  2. keeps the body facing as Meshy delivered it: Meshy turns a side-view creature concept to face forward, which is
     already head along glTF +Z (Blender -Y) (checked on the three Abyssal bodies with a top-down render). --head=-x / +x
     turn a mesh whose head lies along Meshy -X / +X instead;
  3. centres it on the origin (EnemyModel.tsx sizes it by length and stands it on its own bounds anyway);
  4. decimates to --tris and writes JPEG textures at --tex px.

usage: blender -b -P scripts/fit-creature-meshy.py -- MESHY.glb OUT.glb [--head=keep|-x|+x] [--tris=15000] [--tex=1024] [--name=AbyssalBody]
"""
import sys, math, bpy
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
src, out = argv[:2]
opts = dict(a[2:].split("=", 1) if "=" in a else (a[2:], "1") for a in argv[2:] if a.startswith("--"))
head = opts.get("head", "keep"); tris = int(opts.get("tris", "15000")); tex = int(opts.get("tex", "1024")); name = opts.get("name", "AbyssalBody")

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

# head at Meshy -X (Blender -X) -> Blender -Y (glTF +Z): rotate +90 deg about Z; head at +X -> -Y: -90 deg
if head in ("-x", "+x"): body.data.transform(Matrix.Rotation(math.pi / 2 if head == "-x" else -math.pi / 2, 4, "Z"))
mn = Vector((min(v.co[i] for v in body.data.vertices) for i in range(3)))
mx = Vector((max(v.co[i] for v in body.data.vertices) for i in range(3)))
body.data.transform(Matrix.Translation(-(mn + mx) / 2))
print("SIZE (x,y,z) m:", tuple(round(v, 3) for v in (mx - mn)))

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
