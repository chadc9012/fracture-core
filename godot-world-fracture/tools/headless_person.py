"""A Meshy city person with their own head taken off, as an everyday body for the operator (Blender, background).

The operator's everyday bodies were a basic human figure with the clothes painted on: a bodysuit, boxy shoulders, no
cloth of their own (owner, Nov 18: "I dont like what your doing fix it make it work the way I want it", with a GTA-style
reference). The city's Meshy people are real people in real clothes, rigged on the same Mixamo skeleton with idle, walk
and run. This keeps one of them from the neck down — everything above a cut just over the base of the neck, and
everything the Head bone mostly moves (long hair down the back), goes — so the face made in the creator is skinned on
at load like on every other body.

  BAKE_ARGS="PERSON.glb OUT.glb" blender -b -P tools/headless_person.py
"""
import bpy, bmesh, os

SRC, OUT = os.environ["BAKE_ARGS"].split()[:2]
HAIR_LINE = os.environ.get("HAIR_LINE", "") == "1"   # the person had long hair down over their shoulders
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
body = max((o for o in bpy.data.objects if o.type == "MESH" and o.parent == arm), key=lambda o: len(o.data.vertices))
for o in list(bpy.data.objects):
    if o not in (arm, body):
        bpy.data.objects.remove(o, do_unlink=True)

neck = arm.data.bones["mixamorig:Neck"]
n0 = arm.matrix_world @ neck.head_local
n1 = arm.matrix_world @ neck.tail_local
cut_z = n1.z - 0.012   # the whole neck up to the skull: the face's jaw comes down over its top (cut lower, a gap showed under the chin; Nov 18)
head_g = body.vertex_groups.get("mixamorig:Head")
top_g = body.vertex_groups.get("mixamorig:HeadTop_End")
gi = {g.index for g in (head_g, top_g) if g}
neck_i = body.vertex_groups["mixamorig:Neck"].index

bm = bmesh.new()
bm.from_mesh(body.data)
dl = bm.verts.layers.deform.active
mw = body.matrix_world
gone = []
for v in bm.verts:
    p = mw @ v.co
    hw = sum(w for g, w in v[dl].items() if g in gi) if dl else 0.0
    nw = v[dl].get(neck_i, 0.0) if dl else 0.0
    # long hair falls on the shoulders: what the head and neck move together, above the base of the neck and out
    # beside or behind it, goes too (the woman's hair stood in black spikes on her jacket)
    side = (p.xy - n0.xy).length
    hair = (hw + nw) > 0.55 and p.z > n0.z - 0.06 and (side > 0.075 or p.y > n0.y + 0.04)
    if HAIR_LINE:
        # hair fused into the jacket over the shoulders and down the back: everything standing above a line falling
        # from the base of the neck out over the shoulders, behind the front of the neck
        hair = hair or (p.y > n0.y - 0.035 and p.z > n0.z - 0.012 - 0.55 * abs(p.x - n0.x))
    if p.z > cut_z or (hw > 0.5 and p.z > n0.z + (n1.z - n0.z) * 0.85) or hair:
        gone.append(v)
print("cut at", round(cut_z, 3), "removing", len(gone), "of", len(bm.verts))
bmesh.ops.delete(bm, geom=gone, context="VERTS")
# what is left of long hair: loose islands that sit up on the shoulders, cut off from the body (the glTF's vertices are
# split along every UV seam, so they are welded first or every patch of cloth is an island)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
bm.verts.ensure_lookup_table()
seen = set()
loose = []
for v in bm.verts:
    if v.index in seen:
        continue
    isl = [v]
    seen.add(v.index)
    k = 0
    while k < len(isl):
        for e in isl[k].link_edges:
            o = e.other_vert(isl[k])
            if o.index not in seen:
                seen.add(o.index)
                isl.append(o)
        k += 1
    zs = [(mw @ u.co).z for u in isl]
    if len(isl) < 0.05 * len(bm.verts) and sum(zs) / len(zs) > cut_z - 0.2:
        loose.extend(isl)
print("loose pieces up top", len(loose))
bmesh.ops.delete(bm, geom=loose, context="VERTS")
bm.to_mesh(body.data)
bm.free()

bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_animations=True,
                          export_animation_mode="ACTIONS", export_image_format="JPEG", export_jpeg_quality=92,
                          export_skins=True, export_yup=True)
print("wrote", OUT, [a.name for a in bpy.data.actions])
