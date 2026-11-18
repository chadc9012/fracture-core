"""Skin the Meshy echo (a static T-pose mesh) to the city people's Mixamo rig, so it runs instead of sliding (Blender, bg).

The echo came from Meshy unrigged and stood in a T the whole time it chased you (owner, Nov 18: "Enemies running in a T
position fix that"). This fits it to civ-tee's skeleton and keeps that skeleton's own rest pose (an A-pose) and clips
(idle, walk, run), so the clips play on it unchanged:

  1. a copy of the rig is posed into a T that meets the echo's arms, and that pose made its rest;
  2. the echo is bound to the copy with automatic (heat) weights;
  3. the copy is posed back into the original A rest, and that pose applied to the echo, so the echo's mesh now stands
     in the A-pose with the weights it got in the T;
  4. the echo is bound to the original rig with those weights, and written with the rig's clips.

  BAKE_ARGS="PEOPLE.glb ECHO.glb OUT.glb" blender -b -P tools/rig_echo.py
"""
import bpy, os
from mathutils import Vector

PEOPLE, ECHO, OUT = os.environ["BAKE_ARGS"].split()[:3]
bpy.ops.wm.read_factory_settings(use_empty=True)


def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def select(objs, active):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


# the rig and its clips; the person's own mesh only gives the height and middle to fit the echo to
bpy.ops.import_scene.gltf(filepath=PEOPLE)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
body = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == arm or (o.type == "MESH" and o.find_armature() == arm)]
blo, bhi = bounds(body)
for o in list(bpy.data.objects):
    if o != arm:
        bpy.data.objects.remove(o, do_unlink=True)
arm.animation_data_create()
arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.matrix_basis.identity()

# the echo, scaled to the person's height on the same spot
bpy.ops.import_scene.gltf(filepath=ECHO)
echo = [o for o in bpy.data.objects if o.type == "MESH"][0]
bpy.ops.object.select_all(action="DESELECT")
echo.select_set(True)
bpy.context.view_layer.objects.active = echo
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
elo, ehi = bounds([echo])
k = (bhi.z - blo.z) / (ehi.z - elo.z)
echo.scale = (k, k, k)
bpy.ops.object.transform_apply(scale=True)
elo, ehi = bounds([echo])
mid_b = (blo + bhi) * 0.5
mid_e = (elo + ehi) * 0.5
echo.location = Vector((mid_b.x - mid_e.x, mid_b.y - mid_e.y, blo.z - elo.z))
bpy.ops.object.transform_apply(location=True)
vs = [echo.matrix_world @ v.co for v in echo.data.vertices]
xmax = max(v.x for v in vs)
xmin = min(v.x for v in vs)


def hand_tip(side):
    """the echo's outstretched hand: the middle of its last 8 cm of arm"""
    edge = xmax if side > 0 else xmin
    pts = [v for v in vs if (v.x - (edge - side * 0.08)) * side > 0.0]
    return sum(pts, Vector()) / len(pts)


# 1. a copy of the rig, its arms raised straight out to the echo's hands, made its rest
armT = arm.copy()
armT.data = arm.data.copy()
armT.animation_data_clear()
bpy.context.scene.collection.objects.link(armT)
select([armT], armT)
bpy.ops.object.mode_set(mode="POSE")
for side, pre in ((1, "Left"), (-1, "Right")):
    tip = hand_tip(side)
    for name in ("Arm", "ForeArm", "Hand"):
        pb = armT.pose.bones.get("mixamorig:%s%s" % (pre, name))
        if pb is None:
            continue
        bpy.context.view_layer.update()
        head = pb.head.copy()
        cur = (pb.tail - pb.head).normalized()
        want = (tip - head).normalized()
        q = cur.rotation_difference(want)
        m = pb.matrix.copy()
        loc = m.to_translation()
        rot = q.to_matrix().to_4x4() @ m.to_3x3().to_4x4()
        rot.translation = loc
        pb.matrix = rot
bpy.context.view_layer.update()
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode="OBJECT")

# 2. weights in the T. Meshy's mesh is many loose shells (crystals, plates) and Blender's heat weighting finds no
# solution on it (nor on a voxel copy), so each vertex goes to its nearest bones: inverse distance to the bone segments,
# the nearest three, normalised; fingers fold into the hand and the end bones carry nothing
from mathutils.geometry import intersect_point_line


def seg_dist(p, a, b):
    q, t = intersect_point_line(p, a, b)
    t = min(1.0, max(0.0, t))
    return (p - (a + (b - a) * t)).length


bones = []
for bn in armT.data.bones:
    n = bn.name
    if n.endswith("_End") or "HeadTop" in n or not bn.use_deform:
        continue
    if any(f in n for f in ("Thumb", "Index", "Middle", "Ring", "Pinky")):
        continue
    bones.append((n, armT.matrix_world @ bn.head_local, armT.matrix_world @ bn.tail_local))
groups = {n: echo.vertex_groups.new(name=n) for n, _, _ in bones}
for v in echo.data.vertices:
    p = echo.matrix_world @ v.co
    ds = sorted(((seg_dist(p, h, t), n) for n, h, t in bones))[:3]
    w = [1.0 / max(d, 0.01) ** 4 for d, _ in ds]
    tot = sum(w)
    for (d, n), wi in zip(ds, w):
        if wi / tot > 0.02:
            groups[n].add([v.index], wi / tot, "REPLACE")
print("groups", len(echo.vertex_groups), "unweighted", sum(1 for v in echo.data.vertices if sum(g.weight for g in v.groups) < 0.01), "of", len(echo.data.vertices))
echo.parent = armT
amod = echo.modifiers.new("rig", "ARMATURE")
amod.object = armT

# 3. pose the copy back into the original rest and keep the echo's mesh that way
select([armT], armT)
bpy.ops.object.mode_set(mode="POSE")
order = sorted(armT.pose.bones, key=lambda b: len(b.parent_recursive))
for pb in order:
    pb.matrix = arm.data.bones[pb.name].matrix_local.copy()
    bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode="OBJECT")
select([echo], echo)
for md in echo.modifiers:
    if md.type == "ARMATURE":
        bpy.ops.object.modifier_apply(modifier=md.name)
echo.parent = None
print("echo in the A-pose", tuple(round(x, 3) for x in echo.dimensions))
bpy.data.objects.remove(armT, do_unlink=True)

# 4. on the original rig, with its clips
select([echo, arm], arm)
bpy.ops.object.parent_set(type="ARMATURE_NAME")   # an Armature modifier; the vertex groups already carry the weights
for md in echo.modifiers:
    if md.type == "ARMATURE":
        md.object = arm
for g in list(echo.vertex_groups):
    if g.name not in arm.data.bones:
        echo.vertex_groups.remove(g)
print("export", [(o.name, o.type, o.select_get(), o.hide_get()) for o in bpy.data.objects])
select([echo, arm], arm)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_animations=True,
                          export_animation_mode="ACTIONS", export_image_format="JPEG", export_jpeg_quality=92,
                          export_skins=True, export_yup=True)
print("wrote", OUT, "actions", [a.name for a in bpy.data.actions])
