"""
Robots for the cities and for combat (offline tool; Blender bpy). World Fracture is sci-fi and had no robots walking around
(owner, October 2026). Each robot is built from rigid, bevelled plates and joint balls, every part skinned 100% to ONE bone
of an authored operator's Mixamo skeleton, so it is a jointed machine that plays that rig's walk / run / idle / combat clips
unchanged (a real robot doesn't bend its plates; the joints do the moving).

    blender -b -P scripts/build-robots.py -- RIG.glb OUT.glb VARIANT [--shoot]

RIG is an authored operator GLB (its body mesh is dropped, its armature and clips kept). --shoot renames the "combat" stance
clip to "shoot" (EnemyModel.tsx blends idle / walk / run / shoot). VARIANT is one of VARIANTS below:
  civilians  service (slim white-and-blue helper), hauler (heavy yellow labour frame), courier (dark, fast, green trim)
  enemies    sentry (gunmetal trooper, red optic), enforcer (armoured heavy with pauldrons), warden (big command frame,
             reactor core in the chest)
Writes OUT.glb and OUT.jpg (a three-quarter preview render).
"""
import math
import sys

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
rig_path, out_path, variant = argv[0], argv[1], argv[2]
shoot = "--shoot" in argv[3:]

VARIANTS = {
    "service": dict(plate=(0.78, 0.8, 0.82), frame=(0.16, 0.18, 0.21), glow=(0.25, 0.75, 1.0), bulk=0.9, head="dome", chest="light", extras=[]),
    "hauler": dict(plate=(0.85, 0.6, 0.12), frame=(0.13, 0.13, 0.14), glow=(1.0, 0.55, 0.15), bulk=1.25, head="mono", chest="vents", extras=["backpack", "hazard"]),
    "courier": dict(plate=(0.17, 0.19, 0.22), frame=(0.07, 0.08, 0.09), glow=(0.35, 1.0, 0.55), bulk=0.82, head="slit", chest="light", extras=["antenna"]),
    "sentry": dict(plate=(0.2, 0.215, 0.235), frame=(0.08, 0.085, 0.09), glow=(1.0, 0.16, 0.12), bulk=1.0, head="slit", chest="vents", extras=["backpack"]),
    "enforcer": dict(plate=(0.22, 0.24, 0.27), frame=(0.06, 0.06, 0.07), glow=(1.0, 0.2, 0.1), bulk=1.22, head="mono", chest="plate", extras=["pauldrons", "backpack"]),
    "warden": dict(plate=(0.5, 0.12, 0.1), frame=(0.07, 0.07, 0.08), glow=(1.0, 0.45, 0.1), bulk=1.35, head="crest", chest="core", extras=["pauldrons", "antenna", "backpack"]),
}
V = VARIANTS[variant]
B = V["bulk"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=rig_path)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    bpy.data.objects.remove(o, do_unlink=True)
if arm.animation_data:
    arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
bpy.context.view_layer.update()
W = arm.matrix_world


def P(name):
    """a bone's rest head in world space"""
    return W @ arm.data.bones["mixamorig:" + name].head_local


def material(name, rgb, metal, rough, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1); b.inputs["Emission Strength"].default_value = emit
    return m


PLATE = material("RobotPlate", V["plate"], 0.55, 0.38)
FRAME = material("RobotFrame", V["frame"], 0.8, 0.45)
GLOW = material("RobotOptic", V["glow"], 0.0, 0.2, emit=5.0)
HAZ = material("RobotHazard", (0.05, 0.05, 0.05), 0.3, 0.6)
parts = []


def finish(o, mat, bone, bevel=0.0, seg=3):
    if bevel:
        md = o.modifiers.new("b", "BEVEL"); md.width = bevel; md.segments = seg; md.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=md.name)
    o.data.materials.clear(); o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    g = o.vertex_groups.new(name="mixamorig:" + bone); g.add(range(len(o.data.vertices)), 1.0, "REPLACE")
    parts.append(o)
    return o


def align(o, a, b):
    """orient an object made along its local +Z to run from a to b"""
    d = b - a
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.location = (a + b) / 2


def limb(bone, a, b, r0, r1, mat=None, verts=12, shrink=0.06):
    """a tapered cylinder from a to b (pulled in from both joints so the joint balls show)"""
    d = (b - a); L = d.length
    a2, b2 = a + d * shrink, b - d * shrink
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r0 * B, radius2=r1 * B, depth=(b2 - a2).length)
    o = bpy.context.object; align(o, a2, b2)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return finish(o, mat or PLATE, bone, bevel=0.006)


def slab(bone, a, b, w, t, mat=None, off=Vector((0, 0, 0)), bevel=0.012):
    """a flat plate running a->b, w wide and t thick, offset sideways (armour over a limb)"""
    d = b - a
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object; o.scale = (w * B, t * B, d.length * 0.78)
    bpy.ops.object.transform_apply(scale=True)
    align(o, a + off, b + off)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return finish(o, mat or PLATE, bone, bevel=bevel)


def ball(bone, c, r, mat=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=r * B, location=c)
    return finish(bpy.context.object, mat or FRAME, bone)


def box(bone, c, size, mat=None, bevel=0.015, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c, rotation=rot)
    o = bpy.context.object; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(o, mat or PLATE, bone, bevel=bevel)


def cyl(bone, c, r, depth, rot, mat=None, verts=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=c, rotation=rot)
    return finish(bpy.context.object, mat or FRAME, bone)


FWD = Vector((0, -1, 0))  # glTF import: the body faces -Y, up +Z, its left is +X
hips, sp, sp1, sp2, neck, head = P("Hips"), P("Spine"), P("Spine1"), P("Spine2"), P("Neck"), P("Head")
H = head.z - P("LeftFoot").z  # rough stature to size the torso parts

# ---- torso: pelvis block, spine column, chest shell, back
box("Hips", hips + Vector((0, 0, -0.02)), (0.3 * B, 0.18 * B, 0.13), FRAME)
box("Hips", hips + Vector((0, 0.0, 0.05)), (0.22 * B, 0.15 * B, 0.06), PLATE, bevel=0.02)
cyl("Spine", (sp + sp1) / 2, 0.07 * B, (sp1 - sp).length * 1.05, (0, 0, 0), FRAME)
for k in range(3):  # ribbed abdomen
    cyl("Spine", sp + (sp1 - sp) * (0.15 + 0.3 * k), 0.12 * B, 0.03, (0, 0, 0), FRAME, verts=16)
box("Spine", (sp + sp1) / 2 + FWD * 0.09 * B, (0.16 * B, 0.03, (sp1 - sp).length * 0.9), PLATE, bevel=0.012)  # abdomen plate
chest_c = (sp1 + sp2) / 2 + Vector((0, -0.01, 0.06))
box("Spine1", chest_c, (0.38 * B, 0.24 * B, 0.29), PLATE, bevel=0.045)
box("Spine2", sp2 + Vector((0, -0.005, 0.15)), (0.16, 0.14, 0.05), FRAME, bevel=0.015)  # collar
box("Spine2", sp2 + Vector((0, 0.0, 0.07)), (0.4 * B, 0.2 * B, 0.12), PLATE, bevel=0.03)  # shoulder yoke
if V["chest"] == "light":
    box("Spine1", chest_c + FWD * 0.115 * B + Vector((0, 0, 0.03)), (0.12 * B, 0.01, 0.025), GLOW, bevel=0.004)
elif V["chest"] == "vents":
    for k in range(3):
        box("Spine1", chest_c + FWD * 0.112 * B + Vector((0, 0, 0.06 - k * 0.035)), (0.2 * B, 0.012, 0.012), FRAME, bevel=0.003)
elif V["chest"] == "plate":
    box("Spine1", chest_c + FWD * 0.11 * B, (0.3 * B, 0.03, 0.22), PLATE, bevel=0.03)
    box("Spine1", chest_c + FWD * 0.128 * B + Vector((0, 0, 0.07)), (0.1 * B, 0.01, 0.02), GLOW, bevel=0.004)
elif V["chest"] == "core":
    cyl("Spine1", chest_c + FWD * 0.112 * B, 0.06 * B, 0.03, (math.pi / 2, 0, 0), FRAME, verts=24)
    cyl("Spine1", chest_c + FWD * 0.125 * B, 0.042 * B, 0.02, (math.pi / 2, 0, 0), GLOW, verts=24)
if "backpack" in V["extras"]:
    box("Spine1", chest_c - FWD * 0.15 * B, (0.26 * B, 0.1 * B, 0.24), FRAME, bevel=0.025)
    for sx in (-1, 1):
        cyl("Spine1", chest_c - FWD * 0.205 * B + Vector((sx * 0.07 * B, 0, 0.02)), 0.025, 0.16, (0, 0, 0), PLATE, verts=12)
if "hazard" in V["extras"]:
    for k in range(4):
        box("Spine1", chest_c + FWD * 0.112 * B + Vector((-0.12 * B + k * 0.08 * B, 0, -0.1)), (0.035 * B, 0.008, 0.04), HAZ, bevel=0.0, rot=(0, 0.5, 0))

# ---- neck and head
cyl("Neck", (neck + head) / 2, 0.045, (head - neck).length * 1.2, (0, 0, 0), FRAME, verts=14)
hc = head + Vector((0, 0, 0.1))
style = V["head"]
if style == "dome":
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=14, radius=0.115, location=hc)
    o = bpy.context.object; o.scale = (0.92, 1.0, 1.05); bpy.ops.object.transform_apply(scale=True); finish(o, PLATE, "Head")
    box("Head", hc + FWD * 0.085 + Vector((0, 0, 0.01)), (0.15, 0.05, 0.05), FRAME, bevel=0.02)
    box("Head", hc + FWD * 0.108 + Vector((0, 0, 0.012)), (0.12, 0.01, 0.018), GLOW, bevel=0.006)
elif style == "mono":
    box("Head", hc, (0.17, 0.19, 0.17), PLATE, bevel=0.05)
    cyl("Head", hc + FWD * 0.096, 0.04, 0.02, (math.pi / 2, 0, 0), FRAME, verts=24)
    cyl("Head", hc + FWD * 0.106, 0.026, 0.012, (math.pi / 2, 0, 0), GLOW, verts=24)
    box("Head", hc + FWD * 0.07 + Vector((0, 0, -0.07)), (0.12, 0.06, 0.04), FRAME, bevel=0.012)
elif style == "slit":
    box("Head", hc, (0.15, 0.19, 0.2), PLATE, bevel=0.055)
    box("Head", hc + FWD * 0.093 + Vector((0, 0, 0.01)), (0.13, 0.02, 0.045), FRAME, bevel=0.008)
    box("Head", hc + FWD * 0.1 + Vector((0, 0, 0.013)), (0.11, 0.012, 0.011), GLOW, bevel=0.004)
    box("Head", hc + FWD * 0.066 + Vector((0, 0, -0.075)), (0.09, 0.05, 0.06), PLATE, bevel=0.018, rot=(0.3, 0, 0))
else:  # crest: a heavy helm with a raised crest and twin optics
    box("Head", hc, (0.18, 0.2, 0.19), PLATE, bevel=0.05)
    box("Head", hc + Vector((0, 0.01, 0.105)), (0.035, 0.2, 0.06), FRAME, bevel=0.012)
    for sx in (-1, 1):
        box("Head", hc + FWD * 0.1 + Vector((sx * 0.04, 0, 0.015)), (0.045, 0.012, 0.016), GLOW, bevel=0.004)
    box("Head", hc + FWD * 0.075 + Vector((0, 0, -0.07)), (0.13, 0.06, 0.05), FRAME, bevel=0.015)
for sx in (-1, 1):  # ear pods
    cyl("Head", hc + Vector((sx * 0.09, 0.0, 0.0)), 0.03, 0.03, (0, math.pi / 2, 0), FRAME, verts=16)
if "antenna" in V["extras"]:
    cyl("Head", hc + Vector((0.07, 0.03, 0.17)), 0.006, 0.18, (0, 0, 0), FRAME, verts=8)
    ball("Head", hc + Vector((0.07, 0.03, 0.265)), 0.014, GLOW)

# ---- arms and legs
def piston(bone, a, b, off, r=0.012):
    """a hydraulic rod alongside a limb"""
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r, depth=(b - a).length * 0.7)
    o = bpy.context.object; align(o, a + off, b + off)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return finish(o, FRAME, bone)


def along(a, b):
    return Vector((0, 0, 1)).rotation_difference((b - a).normalized()).to_euler()


for s in ("Left", "Right"):
    sx = 1 if s == "Left" else -1
    sh, ar, fa, hd = P(s + "Shoulder"), P(s + "Arm"), P(s + "ForeArm"), P(s + "Hand")
    mid = P(s + "HandMiddle1") if ("mixamorig:" + s + "HandMiddle1") in arm.data.bones else hd + (hd - fa).normalized() * 0.09
    hand_dir = (mid - hd).normalized()
    ball(s + "Arm", ar, 0.08)                                    # shoulder joint
    limb(s + "Arm", ar, fa, 0.07, 0.058)                          # upper arm
    slab(s + "Arm", ar, fa, 0.1, 0.035, off=Vector((0, 0, 0.04)))  # armour plate on top
    ball(s + "ForeArm", fa, 0.058)                                # elbow
    limb(s + "ForeArm", fa, hd, 0.066, 0.05)                       # forearm
    slab(s + "ForeArm", fa, hd, 0.085, 0.03, off=Vector((0, 0, 0.035)))
    piston(s + "ForeArm", fa, hd, Vector((0, 0.03, -0.035)))
    ball(s + "Hand", hd, 0.04)                                    # wrist
    box(s + "Hand", hd + hand_dir * 0.055, (0.09, 0.05, 0.11), FRAME, bevel=0.014, rot=along(hd, mid))          # palm
    box(s + "Hand", hd + hand_dir * 0.14, (0.082, 0.04, 0.075), PLATE, bevel=0.012, rot=along(hd, mid))         # fingers
    box(s + "Hand", hd + hand_dir * 0.04 + FWD * 0.04, (0.025, 0.025, 0.06), PLATE, bevel=0.008, rot=along(hd, mid))  # thumb
    if "pauldrons" in V["extras"]:
        box(s + "Arm", ar + Vector((0, 0, 0.07)) + (fa - ar).normalized() * 0.03, (0.19 * B, 0.19 * B, 0.08), PLATE, bevel=0.04)
    else:
        box(s + "Arm", ar + Vector((0, 0, 0.05)), (0.13 * B, 0.14 * B, 0.05), PLATE, bevel=0.025)   # shoulder cap
    up, lg, ft, toe = P(s + "UpLeg"), P(s + "Leg"), P(s + "Foot"), P(s + "ToeBase")
    box("Hips", up + Vector((sx * 0.06 * B, 0, -0.02)), (0.05, 0.16 * B, 0.16), PLATE, bevel=0.02)  # hip skirt plate
    ball(s + "UpLeg", up, 0.085)                                  # hip joint
    limb(s + "UpLeg", up, lg, 0.1, 0.075)                          # thigh
    slab(s + "UpLeg", up, lg, 0.14, 0.04, off=FWD * 0.07 * B)      # thigh plate
    ball(s + "Leg", lg, 0.07)                                     # knee
    box(s + "Leg", lg + FWD * 0.065 * B, (0.1 * B, 0.04, 0.11), PLATE, bevel=0.02)  # knee cap
    limb(s + "Leg", lg, ft, 0.08, 0.06)                            # shin
    slab(s + "Leg", lg, ft, 0.12, 0.035, off=FWD * 0.06 * B)       # shin guard
    piston(s + "Leg", lg, ft, -FWD * 0.06 * B, r=0.016)            # calf piston
    ball(s + "Foot", ft, 0.055)                                   # ankle
    # foot: a sole from the heel to the toe joint, flat on the ground, an ankle guard, and a toe cap that bends with the toe bone
    floor = toe.z - 0.035
    heel_y, toe_y = ft.y + 0.06, toe.y
    box(s + "Foot", Vector(((ft.x + toe.x) / 2, (heel_y + toe_y) / 2, floor + 0.03)), (0.11 * B, abs(heel_y - toe_y) + 0.02, 0.065), FRAME, bevel=0.02)
    box(s + "Foot", ft + Vector((0, 0.0, -0.03)) + FWD * 0.02, (0.1 * B, 0.12, 0.09), PLATE, bevel=0.025)  # ankle guard
    box(s + "ToeBase", Vector((toe.x, toe.y - 0.04, floor + 0.028)), (0.105 * B, 0.08, 0.055), PLATE, bevel=0.018)

# ---- one mesh, skinned to the armature
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
robot = bpy.context.object; robot.name = f"Robot_{variant}"
robot.parent = arm; robot.matrix_parent_inverse = arm.matrix_world.inverted()
md = robot.modifiers.new("Armature", "ARMATURE"); md.object = arm
if shoot:
    for a in bpy.data.actions:
        if a.name.lower().startswith("combat"):
            a.name = "shoot"
    if arm.animation_data:
        for t in arm.animation_data.nla_tracks:
            if t.name.lower().startswith("combat"):
                t.name = "shoot"
                for s in t.strips:
                    s.name = "shoot"
print("robot verts", len(robot.data.vertices))
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True); robot.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", use_selection=True, export_animations=True, export_skins=True, export_yup=True)
print("wrote", out_path)

# preview (bind pose: the imported clips sit in NLA tracks, which would otherwise pose the render)
if arm.animation_data:
    for t in arm.animation_data.nla_tracks:
        t.mute = True
    arm.animation_data.action = None
bpy.context.view_layer.update()
sc = bpy.context.scene
c = (hips + head) / 2
bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam; cam.data.lens = 50
cam.location = c + Vector((-1.6, -3.2, 0.3))
bpy.ops.object.empty_add(location=c); t = cam.constraints.new("TRACK_TO"); t.target = bpy.context.object
bpy.ops.object.light_add(type="SUN", location=(3, -5, 8)); s = bpy.context.object; s.data.energy = 3.5; s.rotation_euler = (0.7, 0.1, -0.5)
bpy.ops.object.light_add(type="AREA", location=c + Vector((2, 2, 1.5))); l = bpy.context.object; l.data.energy = 200; l.data.size = 2
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.3, 0.33, 0.38, 1)
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 24
sc.render.resolution_x, sc.render.resolution_y = 400, 600
sc.render.image_settings.file_format = "JPEG"
sc.render.filepath = out_path[:-4] + ".jpg"
bpy.ops.render.render(write_still=True)
