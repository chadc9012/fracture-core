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
# the body's own surface, before the hands join (the garment pieces in part 4 are measured against it)
from mathutils.bvhtree import BVHTree
_bw = new.matrix_world
BVH = BVHTree.FromPolygons([_bw @ v.co for v in new.data.vertices], [tuple(p_.vertices) for p_ in new.data.polygons])
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
    # how far out the shoulder joints sit: an upper-arm vertex nearer the middle than this is the side of the chest
    "armpit": round(abs(float(np.array((m @ arm.data.bones["mixamorig:LeftArm"].head_local)[:]) @ LAT) - mid_x) / H, 4),
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

# ------------------------------------------------------------------------------------------------ 4. 3D garment pieces
# (owner, Nov 11: "Yes" to modelled clothes.) Real geometry over the painted clothes, each its own mesh named Piece_<kind>,
# skinned like the body so it moves with it; the game shows the pieces an outfit has and colours them from its palette
# (scripts/character/outfits.gd PIECES): rib collars, fold-down shirt collars, waistbands, sleeve cuffs, jogger ankle cuffs,
# a tee's sleeve hems, the hems of shorts, hoodie drawstrings with aglets, a kangaroo pocket and cargo pockets with flaps.
# Every piece sits where the outfit shader draws the same seam, from the same landmarks.
import math

LM = {k: float(v) for k, v in LANDMARKS.items()}
FV, LV, UV_ = (Vector(F.tolist()), Vector(LAT.tolist()), Vector(UPV.tolist()))
hips_p = np.array((m @ hips.head_local)[:])
hips_f = float(hips_p @ F)


def zat(hh):
    return hip_line + hh * H


def world(lat, f, z):
    return LV * (mid_x + lat) + FV * f + UV_ * z


def bone_at_z(head_bone, tail_bone, z):
    a_ = np.array((m @ arm.data.bones[head_bone].head_local)[:])
    b_ = np.array((m @ arm.data.bones[tail_bone].head_local)[:])
    s_ = float(np.clip((z - a_[2]) / (b_[2] - a_[2]) if abs(b_[2] - a_[2]) > 1e-6 else 0.5, 0.0, 1.0))
    ax = b_ - a_
    return Vector((a_ + ax * s_).tolist()), Vector((ax / np.linalg.norm(ax)).tolist())


def frame(ax):
    u = FV - ax * FV.dot(ax)
    if u.length < 1e-3:
        u = UV_ - ax * UV_.dot(ax)
    u.normalize()
    return u, ax.cross(u).normalized()


def cast_r(c, d, maxd, rmax):
    hit = BVH.ray_cast(c, d, maxd)
    return min(hit[3], rmax) if hit[0] is not None else None


def ring_r(c, ax, n, maxd, rmax):
    u, v = frame(ax)
    dirs = [(u * math.cos(2 * math.pi * k / n) + v * math.sin(2 * math.pi * k / n)).normalized() for k in range(n)]
    rs = [cast_r(c, d, maxd, rmax) for d in dirs]
    ok = [r for r in rs if r is not None]
    fill = float(np.median(ok)) if ok else rmax * 0.5
    rs = [r if r is not None else fill for r in rs]
    # a light smoothing round the ring, so one stray hit cannot dent the band
    rs = [0.25 * rs[k - 1] + 0.5 * rs[k] + 0.25 * rs[(k + 1) % n] for k in range(n)]
    return rs, dirs


def mesh_obj(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm_ = bmesh.new()
    bm_.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    bm_.to_mesh(me)
    bm_.free()
    for p_ in me.polygons:
        p_.use_smooth = True
    return ob


def band(c, ax, hw, t, n=32, maxd=None, rmax=None, taper=0.0, flare=0.0):
    """a closed band round the body: rounded section, `hw` half-width along the axis, `t` proud of the surface"""
    maxd = maxd or 0.2 * H
    rmax = rmax or 0.12 * H
    rs, dirs = ring_r(c, ax, n, maxd, rmax)
    # section round the band (axial offset, radial offset): tucked under the surface, rounded on the outside
    prof = [(-hw, -0.4 * t), (-hw, 0.55 * t), (-0.7 * hw, t), (0.7 * hw, t + flare), (hw, 0.55 * t + flare), (hw, -0.4 * t)]
    verts, faces = [], []
    for s_, dr in prof:
        k_ = 1.0 - taper * (s_ + hw) / (2 * hw)
        for k in range(n):
            verts.append(c + ax * s_ + dirs[k] * (rs[k] * k_ + dr))
    P_ = len(prof)
    for pi_ in range(P_):
        for k in range(n):
            a0, a1 = pi_ * n + k, pi_ * n + (k + 1) % n
            b0, b1 = ((pi_ + 1) % P_) * n + k, ((pi_ + 1) % P_) * n + (k + 1) % n
            faces.append((a0, a1, b1, b0))
    return verts, faces


def solid_strip(rows, thick):
    """a grid of surface points (rows x cols) given thickness inward along each row's normal: a closed slab"""
    R, C = len(rows), len(rows[0])
    verts, faces = [], []
    for layer in (0.0, 1.0):
        for r_ in range(R):
            for c_ in range(C):
                p_, nrm_ = rows[r_][c_]
                verts.append(p_ - nrm_ * thick * layer)
    idx = lambda l, r_, c_: l * R * C + r_ * C + c_
    for r_ in range(R - 1):
        for c_ in range(C - 1):
            faces.append((idx(0, r_, c_), idx(0, r_, c_ + 1), idx(0, r_ + 1, c_ + 1), idx(0, r_ + 1, c_)))
            faces.append((idx(1, r_, c_), idx(1, r_ + 1, c_), idx(1, r_ + 1, c_ + 1), idx(1, r_, c_ + 1)))
    edge = [(0, c_) for c_ in range(C - 1)] + [(r_, C - 1) for r_ in range(R - 1)] + \
           [(R - 1, c_) for c_ in range(C - 1, 0, -1)] + [(r_, 0) for r_ in range(R - 1, 0, -1)]
    for i_ in range(len(edge)):
        (r0, c0), (r1, c1) = edge[i_], edge[(i_ + 1) % len(edge)]
        faces.append((idx(0, r0, c0), idx(1, r0, c0), idx(1, r1, c1), idx(0, r1, c1)))
    return verts, faces


def patch(origin_of, toward, us, vs, off):
    """surface points of the body under a grid: origin_of(u, v) cast along `toward`, lifted `off` off the surface"""
    rows = []
    for v_ in vs:
        row = []
        for u_ in us:
            o = origin_of(u_, v_)
            hit = BVH.ray_cast(o, toward, 2.0 * H)
            if hit[0] is None:
                return None
            nn = hit[1].normalized()
            if nn.dot(toward) > 0:
                nn = -nn
            row.append((hit[0] + nn * off, nn))
        rows.append(row)
    return rows


def sweep(pts, rad, sides=6):
    verts, faces = [], []
    for i_, p_ in enumerate(pts):
        d = (pts[min(i_ + 1, len(pts) - 1)] - pts[max(i_ - 1, 0)]).normalized()
        u = d.cross(FV)
        if u.length < 1e-4:
            u = d.cross(LV)
        u.normalize()
        w = d.cross(u).normalized()
        r_ = rad[i_] if isinstance(rad, list) else rad
        for k in range(sides):
            a_ = 2 * math.pi * k / sides
            verts.append(p_ + (u * math.cos(a_) + w * math.sin(a_)) * r_)
    for i_ in range(len(pts) - 1):
        for k in range(sides):
            faces.append((i_ * sides + k, i_ * sides + (k + 1) % sides, (i_ + 1) * sides + (k + 1) % sides, (i_ + 1) * sides + k))
    faces.append(tuple(range(sides))[::-1])
    faces.append(tuple((len(pts) - 1) * sides + k for k in range(sides)))
    return verts, faces


PIECES = {}


def add(kind, vf):
    if vf is None:
        return
    PIECES.setdefault(kind, []).append(vf)


SIDES = ("Left", "Right")
side_sign = {s_: (1.0 if float(np.array((m @ arm.data.bones["mixamorig:%sUpLeg" % s_].head_local)[:]) @ LAT) - mid_x > 0 else -1.0) for s_ in SIDES}
# sleeve cuffs (rib), over where the shader draws the wrist band
for s_ in SIDES:
    c, ax = bone_at_z("mixamorig:%sForeArm" % s_, "mixamorig:%sHand" % s_, zat(LM["wrist"] + 0.02))
    add("cuffs", band(c, ax, 0.015 * H, 0.0055 * H, rmax=0.05 * H))
# a tee's sleeve hems and the hems of shorts: a little turn-up just above the seam
for s_ in SIDES:
    c, ax = bone_at_z("mixamorig:%sArm" % s_, "mixamorig:%sForeArm" % s_, zat((LM["shoulder"] + LM["elbow"]) * 0.5 + 0.011))
    add("sleeve_hems", band(c, ax, 0.011 * H, 0.006 * H, rmax=0.07 * H, flare=0.002 * H))
    c, ax = bone_at_z("mixamorig:%sUpLeg" % s_, "mixamorig:%sLeg" % s_, zat(LM["knee"] + 0.045 + 0.011))
    add("shorts_hems", band(c, ax, 0.011 * H, 0.006 * H, rmax=0.09 * H, flare=0.002 * H))
    c, ax = bone_at_z("mixamorig:%sLeg" % s_, "mixamorig:%sFoot" % s_, zat(LM["ankle"] + 0.024))
    add("ankle_cuffs", band(c, ax, 0.018 * H, 0.005 * H, rmax=0.05 * H))
# the top's waistband on the hip line
hc = world(0.0, hips_f, zat(0.0125))
add("hem", band(hc, UV_, 0.0125 * H, 0.0055 * H, n=48, maxd=0.3 * H, rmax=0.25 * H))
# collars: round the base of the neck, over the hood's roll at the back
nk_a = np.array((m @ nk.head_local)[:])
nk_b = np.array((m @ nk.tail_local)[:])
nax = Vector(((nk_b - nk_a) / np.linalg.norm(nk_b - nk_a)).tolist())
ncen = Vector(nk_a.tolist()) + nax * (0.004 * H)
add("rib_collar", band(ncen + nax * (0.018 * H), nax, 0.02 * H, 0.006 * H, n=40, rmax=0.07 * H, taper=0.1))
# a fold-down shirt collar, open at the throat: a strip standing up the neck and turned down over itself
rs, dirs = ring_r(ncen + nax * (0.012 * H), nax, 40, 0.2 * H, 0.07 * H)
u0, _v0 = frame(nax)
rows = []
prof = [(-0.002, 0.0), (0.026, 0.002), (0.03, 0.008), (0.012, 0.03)]
for s_, dr in prof:
    row = []
    for k in range(40):
        ang = math.atan2(dirs[k].dot(_v0), dirs[k].dot(u0))
        if abs(ang) < 0.38:
            continue
        p_ = ncen + nax * (s_ * H) + dirs[k] * (rs[k] + dr * H + 0.003 * H)
        row.append((p_, dirs[k]))
    # in angle order from one side of the opening round the back to the other
    row.sort(key=lambda pn: math.atan2(pn[1].dot(_v0), pn[1].dot(u0)) % (2 * math.pi))
    rows.append(row)
add("shirt_collar", solid_strip(rows, 0.003 * H))
# drawstrings: from the neckline down the chest, resting on it, with metal-tipped ends
neck_rel = LM["neck"]
for sx in (-1.0, 1.0):
    pts, f_cord = [], -1e9
    steps = 12
    for j in range(steps + 1):
        z = zat(neck_rel - 0.035 - 0.095 * j / steps)
        o = world(sx * 0.03 * H, hips_f + 0.5 * H, z)
        hit = BVH.ray_cast(o, -FV, 2.0 * H)
        if hit[0] is None:
            break
        f_cord = max(f_cord, float(Vector(hit[0]).dot(FV)) + 0.005 * H)
        swing = sx * 0.004 * H * j / steps
        pts.append(world(sx * 0.03 * H + swing, f_cord, z))
    if len(pts) > 3:
        add("strings", sweep(pts, 0.0024 * H))
        tip_d = (pts[-1] - pts[-2]).normalized()
        add("strings", sweep([pts[-1], pts[-1] + tip_d * 0.012 * H], 0.0036 * H))
# the kangaroo pocket on the belly
rows = patch(lambda u_, v_: world(u_ * H, hips_f + 0.5 * H, zat(v_)), -FV,
             list(np.linspace(-0.085, 0.085, 15)), list(np.linspace(0.035, min(0.13, 0.6 * LM["neck"] - 0.045), 9)), 0.0035 * H)
if rows:
    add("pocket", solid_strip(rows, 0.004 * H))
# cargo pockets on the outside of each thigh, a flap over each
for s_ in SIDES:
    zc = zat(LM["knee"] + 0.1)
    c, ax = bone_at_z("mixamorig:%sUpLeg" % s_, "mixamorig:%sLeg" % s_, zc)
    out_d = (LV * side_sign[s_] * 0.9 + FV * 0.42).normalized()
    acr = UV_.cross(out_d).normalized()
    org = lambda u_, v_, c=c, out_d=out_d, acr=acr: c + out_d * (0.3 * H) + acr * (u_ * H) + UV_ * (v_ * H)
    rows = patch(org, -out_d, list(np.linspace(-0.032, 0.032, 9)), list(np.linspace(-0.05, 0.035, 9)), 0.003 * H)
    if rows:
        add("cargo", solid_strip(rows, 0.004 * H))
    rows = patch(org, -out_d, list(np.linspace(-0.036, 0.036, 9)), list(np.linspace(0.028, 0.05, 4)), 0.0075 * H)
    if rows:
        add("cargo", solid_strip(rows, 0.004 * H))

piece_objs = []
for kind, parts in PIECES.items():
    verts, faces = [], []
    for vs_, fs_ in parts:
        o_ = len(verts)
        verts += vs_
        faces += [tuple(i_ + o_ for i_ in f_) for f_ in fs_]
    ob = mesh_obj("Piece_" + kind, verts, faces)
    ob.data.materials.append(mat)
    # skinned like the body under it
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    for g in new.vertex_groups:
        ob.vertex_groups.new(name=g.name)
    dt = ob.modifiers.new("dt", "DATA_TRANSFER")
    dt.object = new
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"
    dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.modifier_apply(modifier="dt")
    ob.parent = arm
    am = ob.modifiers.new("Armature", "ARMATURE")
    am.object = arm
    piece_objs.append(ob)
    print("piece", kind, len(verts), "verts")

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
for ob in piece_objs:
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", use_selection=True, export_animations=True, export_skins=True,
                          export_vertex_color="ACTIVE", export_yup=True)
import json, os
lm_path = argv[3] if len(argv) > 3 else ""
if lm_path:
    allm = json.load(open(lm_path)) if os.path.exists(lm_path) else {}
    allm[os.path.splitext(os.path.basename(out_path))[0]] = LANDMARKS
    json.dump(allm, open(lm_path, "w"), indent=1, sort_keys=True)
print("wrote", out_path, len(new.data.vertices), "verts", LANDMARKS)
