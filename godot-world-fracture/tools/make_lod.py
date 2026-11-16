# A distance LOD for a Meshy model (street_slice.gd prop(): `<name>-lod.glb` beside `<name>.glb`):
#   blender -b -P tools/make_lod.py -- models/buildings/neon-tower-a.glb 7000
# Blender's collapse decimate to the target triangle count (it keeps the UVs; gltfpack stops at ~50% on Meshy's
# seam-heavy unwraps and its aggressive mode garbles them), exported with no images, so the LOD carries no second
# copy of the 4K textures: materials are kept in order, emptied, and the game gives surface n of the LOD the full
# model's surface n material at load (street_slice.gd `_lod_materials`).
import bpy, sys

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[-2:]
src = args[0]
target = int(args[1]) if len(args) > 1 else 7000
dst = src[:-4] + "-lod.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
tot = sum(len(o.data.polygons) for o in meshes)
ratio = min(1.0, target / max(tot, 1))
for o in meshes:
    m = o.modifiers.new("dec", "DECIMATE")
    m.ratio = ratio
    m.use_collapse_triangulate = True
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_image_format="NONE", export_apply=True, export_yup=True)
print("lod", dst, tot, "->", target, "tris")
