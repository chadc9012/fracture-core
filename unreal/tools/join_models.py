"""Prepares the web build's GLB models for Unreal: every mesh part of a model is joined into one mesh (transforms applied,
materials kept as slots), so Unreal's importer makes exactly one static mesh per model, named after the file.

    blender -b -P unreal/tools/join_models.py -- <out_dir> <model.glb>...

(or any Python with the `bpy` module: python unreal/tools/join_models.py <out_dir> <model.glb>...). Run from the repo
root; scripts/setup-blender.sh installs Blender. The Unreal workflows run this before unreal/tools/setup_assets.py.
"""
import os
import sys

import bpy


def args():
    a = sys.argv
    a = a[a.index("--") + 1:] if "--" in a else a[1:]
    if len(a) < 2:
        raise SystemExit("usage: join_models.py <out_dir> <model.glb>...")
    return a[0], a[1:]


def join_one(src, out_dir):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        print(f"skip {src}: no meshes")
        return None
    # skinned or animated parts would lose their rig: keep those models out (operators, enemies, bosses)
    if any(o.find_armature() for o in meshes):
        print(f"skip {src}: rigged")
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    # bake every parent / node transform into the vertices, then merge into one object at the world origin
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    name = os.path.splitext(os.path.basename(src))[0]
    joined.name = name
    joined.data.name = name
    # drop empties and anything else, so the file holds one node
    for o in list(bpy.context.scene.objects):
        if o != joined:
            bpy.data.objects.remove(o, do_unlink=True)
    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, os.path.basename(src))
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=False, export_apply=True)
    tris = sum(len(p.vertices) - 2 for p in joined.data.polygons)
    print(f"joined {name}: {len(meshes)} parts -> 1 mesh, {tris} triangles, {len(joined.data.materials)} materials")
    return dst


def main():
    out_dir, files = args()
    done = [d for d in (join_one(f, out_dir) for f in files) if d]
    print(f"{len(done)} of {len(files)} models joined into {out_dir}")


main()
