"""
Operator civilian bodies (offline tool; Blender bpy). Every authored body is armour; Mission 01 opens with the operator
waking up at home, and the owner asked for them in regular clothes there (Nov 10: "have on regular clothes instead of
armor"). This builds a clothed body from a rigged game body, keeping its skeleton, skin weights and idle/walk/run/combat
clips:

  1. the armour is remeshed into one closed surface (voxel remesh), its plates smoothed away and the surface pulled in
     to a body's width (less at the hands, so the fingers survive)
  2. the skin weights come back from the authored body (nearest-face interpolated)
  3. it is dressed by the bone each vertex follows: a hoodie or sweater over the torso and arms, jeans or leggings on the
     legs, trainers, bare hands and neck, painted as vertex colour with a little weave noise

The result is headless like every game body (the face chosen in character creation is skinned on at load).

usage: blender -b -P scripts/build-operator-civilian.py -- BASE.glb OUT.glb male|female
(the bundled blender wrapper passes the arguments without "--"; both forms work)
"""
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
base_path, out_path, sex = argv[0], argv[1], argv[2]

OUTFIT = {
    # region: (r, g, b) linear-ish sRGB
    "male": {"top": (0.13, 0.14, 0.16), "cuff": (0.1, 0.11, 0.12), "legs": (0.16, 0.24, 0.38), "shoes": (0.86, 0.86, 0.84),
             "sole": (0.95, 0.95, 0.93), "skin": None},
    "female": {"top": (0.52, 0.5, 0.47), "cuff": (0.44, 0.42, 0.4), "legs": (0.07, 0.07, 0.08), "shoes": (0.9, 0.9, 0.88),
               "sole": (0.96, 0.96, 0.94), "skin": None},
}[sex]
SKIN = (0.55, 0.38, 0.28)   # the hands; the game tints them with the chosen skin tone through the head's material


def body_of(objs):
    meshes = [o for o in objs if o.type == "MESH"]
    return max(meshes, key=lambda o: len(o.data.vertices)), next(o for o in objs if o.type == "ARMATURE")


bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=base_path)
objs = [o for o in bpy.data.objects if o not in before]
src, arm = body_of(objs)
arm.data.pose_position = "REST"
bpy.context.view_layer.update()

# ------------------------------------------------------------------------------------------------ 1. one smooth surface
# a closed body grown from metaballs along each bone, each sized from how far the authored body's surface sits from that
# bone there (a little inside it: the armour is thicker than cloth). Remeshing the armour itself left holes: its plates
# are open shells, with no inside to fill.
names_src = {g.index: g.name for g in src.vertex_groups}
W = src.matrix_world
P = np.array([(W @ v.co)[:] for v in src.data.vertices])
dom_src = [names_src[max(v.groups, key=lambda g: g.weight).group] if v.groups else "" for v in src.data.vertices]
height = float(P[:, 2].max() - P[:, 2].min())
AW = arm.matrix_world
SKIP = ("Hand", "HeadTop", "headfront", "Bone_", "Head")


def seg_dist(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / max(ab @ ab, 1e-9), 0, 1)
    return np.linalg.norm(p - (a + np.outer(t, ab)), axis=1), t


mb_data = bpy.data.metaballs.new("body")
mb_data.resolution = height * 0.012
mb_data.threshold = 0.6
mb = bpy.data.objects.new("body", mb_data)
bpy.context.collection.objects.link(mb)
K = 1.0 / 0.63                 # a lone ball's surface sits at about 0.63 of its radius at this threshold
INSET = {"male": 0.84, "female": 0.86}[sex]
for bone in arm.data.bones:
    n = bone.name
    if any(k in n for k in SKIP) or not bone.use_deform:
        continue
    idx = np.array([i for i, d in enumerate(dom_src) if d == n])
    a = np.array((AW @ bone.head_local)[:])
    b = np.array((AW @ bone.tail_local)[:])
    L = np.linalg.norm(b - a)
    if len(idx) < 12 or L < 1e-4:
        continue
    d, t = seg_dist(P[idx], a, b)
    steps = max(2, int(L / (height * 0.03)) + 1)
    for s in np.linspace(0.0, 1.0, steps):
        near = np.abs(t - s) < (0.6 / steps + 0.05)
        if near.sum() < 5:
            continue
        # the boots and greaves stand well off the shin: the lower leg and foot take a tighter fit (no bell-bottoms)
        lower = ("Leg" in n and "UpLeg" not in n) or "Foot" in n or "Toe" in n
        r = float(np.percentile(d[near], 45 if lower else 55)) * INSET * (0.9 if lower else 1.0)
        if "Leg" in n and "UpLeg" not in n:
            r = min(r, height * (0.05 - 0.012 * s))      # calf to ankle
        if "Foot" in n or "Toe" in n:
            r = min(r, height * 0.036)
        r = max(r, height * 0.018)
        e = mb_data.elements.new()
        e.co = Vector(a + (b - a) * s)
        e.radius = r * K
        e.stiffness = 2.0
# the neck, up into the head's collar
nk = arm.data.bones["mixamorig:Neck"]
for s in (0.0, 0.5, 1.0):
    e = mb_data.elements.new()
    e.co = (AW @ nk.head_local).lerp(AW @ nk.tail_local, s)
    e.radius = height * 0.04 * K
bpy.context.view_layer.update()
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = mb
mb.select_set(True)
bpy.ops.object.convert(target="MESH")
new = bpy.context.view_layer.objects.active
new.name = "civilian"
# into the authored body's own space, so it binds like it
new.data.transform(src.matrix_world.inverted() @ new.matrix_world)
new.matrix_world = src.matrix_world.copy()
bm = bmesh.new()
bm.from_mesh(new.data)
for it in range(4):
    bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(new.data)
bm.free()
dec = new.modifiers.new("dec", "DECIMATE")
dec.ratio = min(1.0, 13000.0 / max(1, len(new.data.polygons)))
bpy.ops.object.modifier_apply(modifier="dec")

# the hands are the authored ones (gloves): fingers do not grow from metaballs
hands = src.copy()
hands.data = src.data.copy()
bpy.context.collection.objects.link(hands)
for m in list(hands.modifiers):
    hands.modifiers.remove(m)
bm = bmesh.new()
bm.from_mesh(hands.data)
bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[v for v in bm.verts if "Hand" not in dom_src[v.index]], context="VERTS")
bm.to_mesh(hands.data)
bm.free()


def transfer_weights():
    dt = new.modifiers.new("dt", "DATA_TRANSFER")
    dt.object = src
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"
    dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.datalayout_transfer(modifier="dt")
    bpy.ops.object.modifier_apply(modifier="dt")


bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = new
new.select_set(True)
transfer_weights()
# join the hands in (their own weights come with them, matched by group name)
hands.select_set(True)
bpy.ops.object.join()
new = bpy.context.view_layer.objects.active
names = {g.index: g.name for g in new.vertex_groups}


def regions():
    out = []
    for v in new.data.vertices:
        if not v.groups:
            out.append("")
            continue
        out.append(names[max(v.groups, key=lambda g: g.weight).group])
    return out


def is_hand(n):
    return "Hand" in n


dom = regions()

# ------------------------------------------------------------------------------------------------ 3. dressed by bone
co = np.array([(new.matrix_world @ v.co)[:] for v in new.data.vertices])   # world space, Z up
up = 2
rng = np.random.default_rng(3)


def colour_of(i, n):
    if is_hand(n):
        return SKIN
    if "Neck" in n or "Head" in n:
        return SKIN
    if "Foot" in n or "Toe" in n:
        return OUTFIT["sole"] if co[i][up] < foot_floor else OUTFIT["shoes"]
    if "Arm" in n or "Shoulder" in n:
        return OUTFIT["top"]
    # one straight hem: below the line is the trousers, above it the top
    if co[i][up] < hip_line:
        return OUTFIT["legs"]
    if "ForeArm" in n:
        return OUTFIT["cuff"] if wrist_near[i] else OUTFIT["top"]
    return OUTFIT["top"]


hips = arm.data.bones["mixamorig:Hips"]
m = arm.matrix_world
hip_line = (m @ hips.head_local)[up] + height * 0.015
feet = [c[up] for c, n in zip(co, dom) if "Foot" in n or "Toe" in n]
foot_floor = (min(feet) + height * 0.012) if feet else -1e9
wrist = [m @ arm.data.bones["mixamorig:%sHand" % s].head_local for s in ("Left", "Right")]
wrist_near = [min((Vector(c) - w).length for w in wrist) < height * 0.045 for c in co]

cols = np.zeros((len(co), 4))
for i, n in enumerate(dom):
    c = np.array(colour_of(i, n))
    cols[i, :3] = np.clip(c * (0.94 + rng.random() * 0.1), 0, 1)
    cols[i, 3] = 1.0
attr = new.data.color_attributes.new("Col", "BYTE_COLOR", "POINT")
for i, c in enumerate(cols):
    attr.data[i].color_srgb = c
new.data.color_attributes.active_color = attr
new.data.color_attributes.render_color_index = 0

mat = bpy.data.materials.new("civilian")
mat.use_nodes = True
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
vc = nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Col"
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.92
bsdf.inputs["Metallic"].default_value = 0.0
new.data.materials.clear()
new.data.materials.append(mat)
for p in new.data.polygons:
    p.use_smooth = True
    p.material_index = 0

# ------------------------------------------------------------------------------------------------ bind and export
new.parent = arm
mod = new.modifiers.new("Armature", "ARMATURE")
mod.object = arm
arm.data.pose_position = "POSE"
for o in objs:
    if o.type == "MESH":
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
new.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", use_selection=True, export_animations=True, export_skins=True,
                          export_vertex_color="ACTIVE", export_yup=True)
print("wrote", out_path, len(new.data.vertices), "verts")
