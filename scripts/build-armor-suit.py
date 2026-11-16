"""
Worn armour from a generated suit (offline tool; Blender bpy). Owner, Nov 15: armour must look like the reference sheets
(docs/reference/armor/), not code-built plates, so a Meshy multi-view model of the armored-soldier turnaround is the
source. This fits that one static, textured suit onto every operator body so the game can wear it:

  1. the suit is scaled and placed on the body (feet on the floor, crown just over the body's head, centred)
  2. its arms are brought to the body's A-pose: the body's armature is posed so its arms lie where the suit's arms are,
     the suit is bound to that posed armature with the body's weights, and the armature is returned to rest — which
     carries the suit's arms down (or up) onto the body's
  3. skin weights are copied again from the body at rest (nearest face, interpolated), so the suit rides the game's
     skeleton through every clip
  4. it is reduced to a phone budget (collapse decimation keeps the UVs, so the 4K textures and normal map still apply)
  5. it is cut into the gear slots by the bone each face follows most — helmet (head, neck), chest (spine above the
     waist, shoulders, upper arms), gauntlets (forearms, hands), legs (thighs, shins, feet), classItem (hips: the belt)
     — one mesh each, all skinned to the body's armature, so each equipped piece shows on its own

usage: blender -b -P scripts/build-armor-suit.py -- SUIT.glb BODY.glb OUT.glb [target_tris]
"""
import math
import sys

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
suit_path, body_path, out_path = argv[0], argv[1], argv[2]
target_tris = int(argv[3]) if len(argv) > 3 else 36000
# "nohelmet": the suit's head is a bare head (the tactical character), not a helmet — drop it; the game puts another
# suit's helmet on that slot
NO_HELMET = "nohelmet" in argv[4:]

SLOTS = {
    "helmet": ["Head", "Neck", "HeadTop_End", "headfront"],
    "gauntlets": ["ForeArm", "Hand"],
    "legs": ["UpLeg", "Leg", "Foot", "Toe"],
    "classItem": ["Hips"],
    "chest": ["Spine", "Shoulder", "Arm"],
}


def slot_of(bone: str) -> str:
    b = bone.split("_")[-1].split(":")[-1]
    # order matters: "ForeArm" before "Arm", "UpLeg" before "Leg", "Hand..." fingers before anything
    if b.startswith(("Head", "Neck")) or b == "headfront":
        return "helmet"
    if "ForeArm" in b or "Hand" in b:
        return "gauntlets"
    if "UpLeg" in b or b.endswith("Leg") or "Foot" in b or "Toe" in b:
        return "legs"
    if b == "Hips":
        return "classItem"
    return "chest"


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


clear()
body_objs = import_glb(body_path)
arm = next(o for o in body_objs if o.type == "ARMATURE")
body = max((o for o in body_objs if o.type == "MESH"), key=lambda o: len(o.data.vertices))
suit_objs = import_glb(suit_path)
suit_meshes = [o for o in suit_objs if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in suit_meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = suit_meshes[0]
if len(suit_meshes) > 1:
    bpy.ops.object.join()
suit = bpy.context.view_layer.objects.active
# drop the suit's own empties / parents, keep its world transform
mw = suit.matrix_world.copy()
suit.parent = None
suit.matrix_world = mw
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def bone_head(name):
    for b in arm.data.bones:
        if b.name.endswith(name) and not b.name.endswith("Top_End"):
            return arm.matrix_world @ b.head_local
    return None

# ---------------------------------------------------------------- 1. scale and place
sv = [suit.matrix_world @ v.co for v in suit.data.vertices]
smin = Vector((min(v.x for v in sv), min(v.y for v in sv), min(v.z for v in sv)))
smax = Vector((max(v.x for v in sv), max(v.y for v in sv), max(v.z for v in sv)))
top = None
for b in arm.data.bones:
    if b.name.endswith("HeadTop_End"):
        top = (arm.matrix_world @ b.head_local).z
if top is None:
    top = bone_head("Head").z + 0.2
want_h = top + 0.035          # the helmet sits a little over the crown
s = want_h / (smax.z - smin.z)
suit.scale = (s, s, s)
bpy.ops.object.transform_apply(scale=True)
sv = [suit.matrix_world @ v.co for v in suit.data.vertices]
cx = (min(v.x for v in sv) + max(v.x for v in sv)) / 2
# centre front-to-back on the torso: the suit's verts at chest height vs the body's
def depth_mid(verts, z0, z1):
    ys = [v.y for v in verts if z0 < v.z < z1 and abs(v.x) < 0.12]
    return (min(ys) + max(ys)) / 2 if ys else 0.0
bv = [body.matrix_world @ v.co for v in body.data.vertices]
sh = bone_head("Spine1").z
dy = depth_mid(bv, sh - 0.05, sh + 0.1) - depth_mid(sv, sh - 0.05, sh + 0.1)
suit.location = (-cx, dy, -min(v.z for v in sv))
bpy.ops.object.transform_apply(location=True)
print("ARMOR scale %.4f  height %.3f  dy %.3f" % (s, want_h, dy))

# ---------------------------------------------------------------- 2. arms onto the body's A-pose
sv = [suit.matrix_world @ v.co for v in suit.data.vertices]
def suit_hand(side):
    # the suit's hand: the outermost cluster of verts on that side
    xs = [v for v in sv if (v.x > 0) == (side > 0)]
    far = max(xs, key=lambda v: abs(v.x))
    near = [v for v in xs if (Vector((v.x, v.z)) - Vector((far.x, far.z))).length < 0.08]
    return sum(near, Vector()) / len(near)
def body_hand(side):
    n = "LeftHand" if side > 0 else "RightHand"
    # +x is the body's left in Blender (glTF +x → Blender +x, characters face -y)
    h = bone_head(n)
    if (h.x > 0) != (side > 0):
        n = "RightHand" if side > 0 else "LeftHand"
        h = bone_head(n)
    return n, h
# measure first: when the suit's arms already lie within a few degrees of the body's, skip the re-pose entirely
diffs = []
for side in (1, -1):
    hname, bh = body_hand(side)
    sh_ = suit_hand(side)
    upper = next(b for b in arm.data.bones if b.name.endswith(hname.replace("Hand", "Arm")) and "Fore" not in b.name)
    sho = arm.matrix_world @ upper.head_local
    diffs.append(math.atan2(sh_.z - sho.z, abs(sh_.x - sho.x)) - math.atan2(bh.z - sho.z, abs(bh.x - sho.x)))
REPOSE = max(abs(d) for d in diffs) > math.radians(12.0)
print("ARMOR arm offsets %s → %s" % (["%.1f°" % math.degrees(d) for d in diffs], "re-pose" if REPOSE else "already matching"))
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for side in ((1, -1) if REPOSE else ()):
    hname, bh = body_hand(side)
    sh_ = suit_hand(side)
    upper = next(pb for pb in arm.pose.bones if pb.name.endswith(hname.replace("Hand", "Arm")) and "Fore" not in pb.name)
    sho = arm.matrix_world @ upper.bone.head_local
    a_body = math.atan2(bh.z - sho.z, abs(bh.x - sho.x))
    a_suit = math.atan2(sh_.z - sho.z, abs(sh_.x - sho.x))
    d = a_suit - a_body          # + : the suit's arm is higher
    print("ARMOR arm %s body %.1f° suit %.1f° → %.1f°" % (hname, math.degrees(a_body), math.degrees(a_suit), math.degrees(d)))
    # rotate the upper arm about the body's forward axis (world -y / +y) so the hand rises/falls by d
    axis = Vector((0, 1, 0)) if side > 0 else Vector((0, -1, 0))
    rot_world = Matrix.Rotation(-d, 4, axis)
    bm = upper.bone.matrix_local.to_3x3()
    local = (bm.inverted() @ rot_world.to_3x3() @ bm).to_quaternion()
    upper.rotation_mode = "QUATERNION"
    upper.rotation_quaternion = local
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode="OBJECT")

def transfer_weights(src, dst):
    for g in src.vertex_groups:
        if g.name not in dst.vertex_groups:
            dst.vertex_groups.new(name=g.name)
    mod = dst.modifiers.new("dt", "DATA_TRANSFER")
    mod.object = src
    mod.use_vert_data = True
    mod.data_types_verts = {"VGROUP_WEIGHTS"}
    mod.vert_mapping = "POLYINTERP_NEAREST"
    mod.layers_vgroup_select_src = "ALL"
    mod.layers_vgroup_select_dst = "NAME"
    bpy.context.view_layer.objects.active = dst
    bpy.ops.object.modifier_apply(modifier=mod.name)

if REPOSE:
    # the body in the suit's pose: a copy with its armature modifier applied
    if not REPOSE:
        pass
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    posed = bpy.context.view_layer.objects.active
    for m in list(posed.modifiers):
        if m.type == "ARMATURE":
            bpy.ops.object.modifier_apply(modifier=m.name)
    posed.parent = None
    transfer_weights(posed, suit)
    am = suit.modifiers.new("arm", "ARMATURE")
    am.object = arm
    # the suit was made in the posed state: bind it there, then return the armature to rest and bake the result
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    # record pose, compute rest-space deformation by inverting: pose→rest = apply inverse pose. Simplest: make the posed
    # state the bind by applying the pose as rest on a temporary copy of the armature.
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.duplicate()
    tmp = bpy.context.view_layer.objects.active
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.armature_apply(selected=False)       # tmp's rest = the suit's pose
    # tmp now rests in the suit's pose; pose it back to the body's rest: each bone gets the inverse of the original pose
    for pb in tmp.pose.bones:
        src = arm.pose.bones[pb.name]
        pb.rotation_mode = "QUATERNION"
        q = src.rotation_quaternion.copy() if src.rotation_mode == "QUATERNION" else src.matrix_basis.to_quaternion()
        pb.rotation_quaternion = q.inverted()
    bpy.ops.object.mode_set(mode="OBJECT")
    am.object = tmp
    bpy.context.view_layer.objects.active = suit
    bpy.ops.object.modifier_apply(modifier=am.name)
    bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.data.objects.remove(posed, do_unlink=True)
    # the real armature back at rest
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- 3. weights from the body at rest
for g in list(suit.vertex_groups):
    suit.vertex_groups.remove(g)
# by part: in the A-pose the hands hang beside the thigh pouches and holsters, and a plain nearest-face copy hands those
# to the arm (they then tear away from the hip when the arms move). So the body is split into left arm, right arm and
# core, each suit vertex is given to whichever part's skin is nearest, and weights are copied from that part only.
from mathutils.kdtree import KDTree
def body_part(gname):
    b = gname.split("_")[-1].split(":")[-1]
    for side in ("Left", "Right"):
        if b.startswith(side + "Arm") or b.startswith(side + "ForeArm") or b.startswith(side + "Hand"):
            return side
    return "core"
bg = {g.index: g.name for g in body.vertex_groups}
bclass = []
for v in body.data.vertices:
    best = max(v.groups, key=lambda g: g.weight, default=None)
    bclass.append(body_part(bg[best.group]) if best else "core")
parts = {}
for cls in ("Left", "Right", "core"):
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    part = bpy.context.view_layer.objects.active
    for m in list(part.modifiers):
        part.modifiers.remove(m)
    import bmesh as _bm
    bm = _bm.new()
    bm.from_mesh(part.data)
    bm.verts.ensure_lookup_table()
    _bm.ops.delete(bm, geom=[bm.verts[i] for i, c in enumerate(bclass) if c != cls], context="VERTS")
    bm.to_mesh(part.data)
    bm.free()
    kd = KDTree(len(part.data.vertices))
    for i, v in enumerate(part.data.vertices):
        kd.insert(part.matrix_world @ v.co, i)
    kd.balance()
    parts[cls] = (part, kd)
for cls in parts:
    suit.vertex_groups.new(name="__cls_" + cls)
for v in suit.data.vertices:
    p = suit.matrix_world @ v.co
    # the core wins ties within 2 cm: pouches and belts belong to the hips
    d = {cls: parts[cls][1].find(p)[2] if len(parts[cls][0].data.vertices) else 1e9 for cls in parts}
    d["core"] -= 0.02
    cls = min(d, key=d.get)
    suit.vertex_groups["__cls_" + cls].add([v.index], 1.0, "REPLACE")
for cls, (part, _) in parts.items():
    for g in part.vertex_groups:
        if g.name not in suit.vertex_groups:
            suit.vertex_groups.new(name=g.name)
    mod = suit.modifiers.new("dt_" + cls, "DATA_TRANSFER")
    mod.object = part
    mod.use_vert_data = True
    mod.data_types_verts = {"VGROUP_WEIGHTS"}
    mod.vert_mapping = "POLYINTERP_NEAREST"
    mod.layers_vgroup_select_src = "ALL"
    mod.layers_vgroup_select_dst = "NAME"
    mod.vertex_group = "__cls_" + cls
    bpy.context.view_layer.objects.active = suit
    bpy.ops.object.modifier_apply(modifier=mod.name)
for cls, (part, _) in parts.items():
    suit.vertex_groups.remove(suit.vertex_groups["__cls_" + cls])
    bpy.data.objects.remove(part, do_unlink=True)
# the bodies are headless (the face is skinned on in game), so the helmet found no head to copy from: everything above
# the neck rides the Head bone, blended over the neck so the collar bends with it
head_b = next(b for b in arm.data.bones if b.name.endswith("Head") and "Top" not in b.name)
neck_b = next(b for b in arm.data.bones if b.name.endswith("Neck"))
hz = (arm.matrix_world @ head_b.head_local).z
nz = (arm.matrix_world @ neck_b.head_local).z
hg = suit.vertex_groups.get(head_b.name) or suit.vertex_groups.new(name=head_b.name)
for v in suit.data.vertices:
    z = (suit.matrix_world @ v.co).z
    k = min(1.0, max(0.0, (z - nz) / max(hz - nz, 1e-3)))
    if k <= 0.0:
        continue
    for g in v.groups:
        g.weight *= (1.0 - k)
    hg.add([v.index], k, "ADD")

# a bare-headed suit: everything above the neck is the generated character's own face and hair, not armour — cut it
# away before decimating (the collar and hood behind the neck stay)
if NO_HELMET:
    import bmesh as _bmh
    hp_ = arm.matrix_world @ head_b.head_local
    np_ = arm.matrix_world @ neck_b.head_local
    bmh = _bmh.new()
    bmh.from_mesh(suit.data)
    mw_ = suit.matrix_world
    drop = []
    for f in bmh.faces:
        c = mw_ @ f.calc_center_median()
        r = Vector((c.x - hp_.x, c.y - hp_.y)).length
        # well above the neck: all of it (face, hair, the hood's crown)
        if c.z > hp_.z + 0.06:
            drop.append(f)
        # from just above the collar up: anything close round the neck/head axis — the generated face, jaw, beard and
        # throat — while the hood and collar further out stay
        elif c.z > np_.z + 0.015 and r < 0.115:
            drop.append(f)
    _bmh.ops.delete(bmh, geom=drop, context="FACES")
    bmh.to_mesh(suit.data)
    bmh.free()
    print("ARMOR head cut: %d faces" % len(drop))

# ---------------------------------------------------------------- 4. phone budget
tris = sum(len(p.vertices) - 2 for p in suit.data.polygons)
if tris > target_tris:
    dm = suit.modifiers.new("dec", "DECIMATE")
    dm.decimate_type = "COLLAPSE"
    dm.ratio = target_tris / tris
    dm.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = suit
    bpy.ops.object.modifier_apply(modifier=dm.name)
print("ARMOR tris %d → %d" % (tris, sum(len(p.vertices) - 2 for p in suit.data.polygons)))
# keep at most 4 influences, normalised
bpy.context.view_layer.objects.active = suit
bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- 5. cut into slots
gname = {g.index: g.name for g in suit.vertex_groups}
vslot = []
for v in suit.data.vertices:
    best = max(v.groups, key=lambda g: g.weight, default=None)
    vslot.append(slot_of(gname[best.group]) if best else "chest")
import bmesh
pieces = {}
for slot in [s_ for s_ in SLOTS if not (NO_HELMET and s_ == "helmet")]:
    bpy.ops.object.select_all(action="DESELECT")
    suit.select_set(True)
    bpy.context.view_layer.objects.active = suit
    bpy.ops.object.duplicate()
    part = bpy.context.view_layer.objects.active
    part.name = "armor_" + slot
    bm = bmesh.new()
    bm.from_mesh(part.data)
    drop = []
    for f in bm.faces:
        votes = {}
        for v in f.verts:
            votes[vslot[v.index]] = votes.get(vslot[v.index], 0) + 1
        if max(votes, key=votes.get) != slot:
            drop.append(f)
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    bm.to_mesh(part.data)
    bm.free()
    if len(part.data.polygons) == 0:
        bpy.data.objects.remove(part, do_unlink=True)
        continue
    part.parent = arm
    for m in list(part.modifiers):
        part.modifiers.remove(m)
    mm = part.modifiers.new("Armature", "ARMATURE")
    mm.object = arm
    pieces[slot] = len(part.data.polygons)
bpy.data.objects.remove(suit, do_unlink=True)
print("ARMOR pieces", pieces)

# export only the armature and the pieces (no body)
for o in list(bpy.data.objects):
    if o.type == "MESH" and not o.name.startswith("armor_"):
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action="SELECT")
# geometry only: every body's fit shares one material (the suit's 4K maps, extracted once into the suit's folder and
# applied in game by scripts/gear/armor_look.gd), so the textures ship once, not once per body
bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", use_selection=True, export_animations=False,
                          export_skins=True, export_materials="NONE")
print("ARMOR wrote", out_path)
