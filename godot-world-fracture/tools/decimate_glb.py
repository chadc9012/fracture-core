# Collapse-decimate a Meshy GLB to a triangle budget, keeping its UVs and textures (Meshy 7 hulls come at a million
# faces; the game's bosses carry 60-80k). Then import-meshy.py sizes the textures and runs the pixelation gate.
#   blender -b -P tools/decimate_glb.py -- SRC.glb DST.glb TARGET_TRIS
import bpy, sys
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[-3:]
src, dst, target = args[0], args[1], int(args[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
tris = 0
for o in bpy.data.objects:
    if o.type == "MESH":
        tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
ratio = min(1.0, target / max(tris, 1))
for o in bpy.data.objects:
    if o.type == "MESH" and ratio < 1.0:
        m = o.modifiers.new("dec", "DECIMATE")
        m.ratio = ratio
        m.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier="dec")
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=92, export_apply=True)
print("decimated", tris, "->", int(tris * ratio), "tris")
