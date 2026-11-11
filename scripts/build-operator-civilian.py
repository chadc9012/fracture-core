"""
Operator civilian bodies (offline tool; Blender bpy). Every authored body is armour; Mission 01 opens with the operator
waking up at home, and the owner asked for them in regular clothes there (Nov 10: "have on regular clothes instead of
armor"). This builds a clothed body from a rigged game body, keeping its skeleton, skin weights and idle/walk/run/combat
clips:

  1. the armour is remeshed into one closed surface (voxel remesh), its plates smoothed away and the surface pulled in
     to a body's width (less at the hands, so the fingers survive)
  2. the skin weights come back from the authored body (nearest-face interpolated)
  3. it is dressed in urban streetwear by the bone each vertex follows and where it sits on the body: an oversized hoodie
     (hood down, kangaroo pocket, drawstrings, chest logo, ribbed hem and cuffs), joggers with side stripes, cargo pockets
     and ankle cuffs (cargos for the female cut), chunky trainers with a midsole, side flash and heel tab; painted as
     vertex colour with a little weave noise

The result is headless like every game body (the face chosen in character creation is skinned on at load).

usage: blender -b -P scripts/build-operator-civilian.py -- BASE.glb OUT.glb male|female [LANDMARKS.json]
(the bundled blender wrapper passes the arguments without "--"; both forms work)
"""
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
base_path, out_path, sex = argv[0], argv[1], argv[2]

# urban streetwear (owner, Nov 10: "regular civilian clothing, urban style"): an oversized hoodie with the hood down, a
# kangaroo pocket, drawstrings and a chest logo; joggers or cargos; chunky trainers
OUTFIT = {
    "male": {"top": (0.075, 0.075, 0.085), "top2": (0.05, 0.05, 0.058), "logo": (0.86, 0.13, 0.12), "logo2": (0.95, 0.95, 0.93),
             "string": (0.92, 0.92, 0.9), "legs": (0.24, 0.24, 0.26), "legs2": (0.17, 0.17, 0.19), "stripe": (0.93, 0.93, 0.91),
             "shoes": (0.94, 0.94, 0.92), "accent": (0.86, 0.13, 0.12), "sole": (0.96, 0.96, 0.94), "mid": (0.06, 0.06, 0.07),
             "toe": (0.8, 0.8, 0.8), "stripes": True},
    "female": {"top": (0.8, 0.74, 0.64), "top2": (0.69, 0.63, 0.54), "logo": (0.08, 0.08, 0.09), "logo2": (0.8, 0.74, 0.64),
               "string": (0.12, 0.12, 0.12), "legs": (0.27, 0.29, 0.19), "legs2": (0.21, 0.23, 0.15), "stripe": (0.27, 0.29, 0.19),
               "shoes": (0.95, 0.95, 0.93), "accent": (0.09, 0.09, 0.1), "sole": (0.97, 0.97, 0.95), "mid": (0.86, 0.66, 0.42),
               "toe": (0.85, 0.85, 0.84), "stripes": False},
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
mb_data.resolution = height * 0.0075
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
        # streetwear cut: a roomy hoodie and baggy sleeves, relaxed thighs, joggers gathered at the ankle, chunky trainers
        if "Spine" in n or ("Hips" in n and s > 0.4):
            r *= 1.08
        elif "Arm" in n and "ForeArm" not in n:
            r *= 1.12
        elif "ForeArm" in n:
            r *= 1.1 if s < 0.8 else 0.92
        elif "UpLeg" in n:
            r *= 1.06
        elif "Leg" in n and s > 0.85:
            r = min(r, height * 0.031)
        if "Foot" in n or "Toe" in n:
            r = max(r, height * 0.04)
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
# which way the body faces (heel to toe) and its side axis
UPV = np.array([0.0, 0.0, 1.0])
ft = arm.data.bones["mixamorig:LeftFoot"]
tt = arm.data.bones["mixamorig:LeftToeBase"]
F = np.array((AW @ tt.head_local - AW @ ft.head_local)[:])
F[2] = 0.0
F /= np.linalg.norm(F)
LAT = np.cross(UPV, F)
neck0 = np.array((AW @ nk.head_local)[:])
# the hood, down, lying on the upper back
HOOD = []
for off, rad in (((0.0, -0.085, -0.02), 0.06), ((0.07, -0.065, -0.03), 0.048), ((-0.07, -0.065, -0.03), 0.048), ((0.0, -0.095, -0.065), 0.052)):
    e = mb_data.elements.new()
    e.co = Vector(neck0 + LAT * off[0] * height + F * off[1] * height + UPV * off[2] * height)
    e.radius = rad * height * K
    HOOD.append((np.array(e.co[:]), rad * height))
# chunky soles under each foot
for side in ("Left", "Right"):
    fb = arm.data.bones["mixamorig:%sFoot" % side]
    tb = arm.data.bones["mixamorig:%sToeBase" % side]
    for q in (np.array((AW @ fb.head_local)[:]), np.array((AW @ tb.head_local)[:])):
        e = mb_data.elements.new()
        e.co = Vector(q - UPV * height * 0.012)
        e.radius = height * 0.036 * K
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
dec.ratio = min(1.0, 26000.0 / max(1, len(new.data.polygons)))   # enough vertices to paint seams and logos on
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
rot = new.matrix_world.to_3x3()
nrm = np.array([(rot @ v.normal).normalized()[:] for v in new.data.vertices])
up = 2
rng = np.random.default_rng(3)
m = arm.matrix_world
hips = arm.data.bones["mixamorig:Hips"]
hip_line = (m @ hips.head_local)[up] + height * 0.015
mid_x = float(np.array((m @ hips.head_local)[:]) @ LAT)
neck_z = neck0[2]
chest_z = (m @ arm.data.bones["mixamorig:Spine2"].head_local)[up] + height * 0.03
feet = [c[up] for c, n in zip(co, dom) if "Foot" in n or "Toe" in n]
floor = min(feet) if feet else -1e9
knee = {s_: np.array((m @ arm.data.bones["mixamorig:%sLeg" % s_].head_local)[:]) for s_ in ("Left", "Right")}
ankle = {s_: np.array((m @ arm.data.bones["mixamorig:%sFoot" % s_].head_local)[:]) for s_ in ("Left", "Right")}
wrist = [m @ arm.data.bones["mixamorig:%sHand" % s_].head_local for s_ in ("Left", "Right")]
wrist_near = [min((Vector(c) - w).length for w in wrist) < height * 0.05 for c in co]
H = height
O = OUTFIT


# The clothes are drawn by the game's outfit shader (scripts/character/outfit.gdshader), from the outfit the player picks
# (owner, Nov 11: more clothes). Every vertex carries one smooth set of rest-pose coordinates, so the seams the shader
# cuts (hem, cuffs, zip line, stripes, pockets, prints, a tee's sleeve, the hem of shorts) are clean lines wherever they
# fall, across triangles of different body zones:
#   UV   (across the body, height above the hip line)          in body heights
#   UV2  (normal toward the front, normal toward the outside)
#   colour red: the body zone * 20 / 255 (0 skin, 1 foot, 2 hood, 3 upper arm, 4 forearm, 5 leg, 6 torso);
#          green: a little per-vertex weave jitter; blue: distance ahead of the ankle (feet: the toe cap)
# and the body's landmarks (knee, ankle, floor, neck, shoulder, elbow, wrist, in the same units) go to
# data/outfit_landmarks.json under the body's name, for the shader's uniforms.
wrist_p = {s_: np.array((m @ arm.data.bones["mixamorig:%sHand" % s_].head_local)[:]) for s_ in ("Left", "Right")}


def zone_of(i, n):
    p = co[i]
    z = p[up]
    if is_hand(n):
        return 0
    hood = float((p - neck0) @ F) < -0.01 * H and any(np.linalg.norm(p - hc) < hr * 1.3 for hc, hr in HOOD)
    if ("Neck" in n or "Head" in n) and not hood:
        return 0
    if "Foot" in n or "Toe" in n:
        return 1
    if hood:
        return 2
    if ("Arm" in n or "Shoulder" in n) and "ForeArm" not in n:
        return 3
    if "ForeArm" in n:
        return 4
    return 5 if z < hip_line else 6


cols = np.zeros((len(co), 4))
uvs = np.zeros((len(co), 4))
for i, n in enumerate(dom):
    p, nv = co[i], nrm[i]
    lat = float(p @ LAT) - mid_x
    side = "Left" if ("Left" in n or (lat > 0) == (float(np.array((m @ arm.data.bones["mixamorig:LeftUpLeg"].head_local)[:]) @ LAT) - mid_x > 0)) else "Right"
    out = float(nv @ LAT) * (1 if lat > 0 else -1)
    fwd = float((p - ankle[side]) @ F) / H
    cols[i] = (zone_of(i, n) * 20 / 255.0, rng.random(), float(np.clip(fwd * 2.0 + 0.5, 0, 1)), 1.0)
    uvs[i] = (lat / H, (p[up] - hip_line) / H, float(nv @ F), out)
while len(new.data.uv_layers):          # the joined hands bring their own texture map; the clothes need only these two
    new.data.uv_layers.remove(new.data.uv_layers[0])
uv0 = new.data.uv_layers.new(name="UVMap")
uv1 = new.data.uv_layers.new(name="UV2")
for loop in new.data.loops:
    u = uvs[loop.vertex_index]
    uv0.data[loop.index].uv = (u[0], u[1])
    uv1.data[loop.index].uv = (u[2], u[3])


def rel(v):
    return round((float(v) - hip_line) / H, 4)


bone_z = lambda nm: (m @ arm.data.bones[nm].head_local)[up]
LANDMARKS = {
    "knee": rel((knee["Left"][up] + knee["Right"][up]) / 2), "ankle": rel((ankle["Left"][up] + ankle["Right"][up]) / 2),
    "floor": rel(floor), "neck": rel(neck_z), "shoulder": rel(bone_z("mixamorig:LeftArm")),
    "elbow": rel(bone_z("mixamorig:LeftForeArm")), "wrist": rel(bone_z("mixamorig:LeftHand")),
}
attr = new.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
for i, c in enumerate(cols):
    attr.data[i].color = c
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
import json, os
lm_path = argv[3] if len(argv) > 3 else ""
if lm_path:
    allm = json.load(open(lm_path)) if os.path.exists(lm_path) else {}
    allm[os.path.splitext(os.path.basename(out_path))[0]] = LANDMARKS
    json.dump(allm, open(lm_path, "w"), indent=1, sort_keys=True)
print("wrote", out_path, len(new.data.vertices), "verts", LANDMARKS)
