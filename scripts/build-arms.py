"""
Builds public/models/weapons/arms.glb: the first-person armoured hand and gauntlet (right hand; the left is a
mirror). Run with Blender as a module:  pip install bpy && python3 scripts/build-arms.py [out.glb]

Frame (matches Arm in ViewWeapon.tsx):
  ArmHand    - gloved fist closed around a grip at the origin, knuckles up (+Y), fingers toward -Z.
  ArmForearm - gauntlet + sleeve in the forearm's own frame: runs from z=0.03 to z=0.27 along +Z; ViewWeapon
               rotates it down toward the bottom of the screen exactly like the old cylinder.
Materials are named so ViewWeapon can tint them per operator: ArmArmor (armour colour), ArmSleeve (cloth
colour), ArmAccent (emissive accent); Glove keeps its own dark leather/polymer look.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

OUT = sys.argv[-1] if sys.argv[-1].endswith(".glb") else os.path.join(os.path.dirname(__file__), "..", "public", "models", "weapons", "arms.glb")
bpy.ops.wm.read_factory_settings(use_empty=True)


def three(x, y, z):
    return Vector((x, -z, y))


def mat(name, color, metal, rough, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = 2
    return m


GLOVE = mat("Glove", (0.03, 0.03, 0.032), 0.0, 0.78)
ARMOR = mat("ArmArmor", (0.18, 0.17, 0.16), 0.75, 0.42)
SLEEVE = mat("ArmSleeve", (0.06, 0.06, 0.065), 0.0, 0.92)
ACCENT = mat("ArmAccent", (1.0, 0.45, 0.1), 0.0, 0.4, (1.0, 0.45, 0.1))


def finish(o, bevel, segments=2, angle=40):
    bpy.context.view_layer.objects.active = o
    if bevel > 0:
        m = o.modifiers.new("bevel", "BEVEL")
        m.width = bevel; m.segments = segments; m.limit_method = "ANGLE"; m.angle_limit = math.radians(angle); m.harden_normals = True
        bpy.ops.object.modifier_apply(modifier=m.name)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def box(size, at, material, bevel=0.004, rot=(0, 0, 0), taper=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=three(*at))
    o = bpy.context.active_object
    o.scale = (size[0], size[2], size[1])
    o.rotation_euler = (-rot[0], rot[2], rot[1])
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if taper:  # shrink the far (-Z in three space -> +Y in Blender) end for a tapered plate
        for v in o.data.vertices:
            if v.co.y > 0:
                v.co.x *= taper; v.co.z *= taper
    o.data.materials.append(material)
    return finish(o, bevel)


def cyl(r, length, at, material, axis="z", verts=16, bevel=0.002, r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2 if r2 is not None else r, depth=length, location=three(*at))
    o = bpy.context.active_object
    if axis == "z":
        o.rotation_euler = (math.radians(-90), 0, 0)
    elif axis == "x":
        o.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(material)
    return finish(o, bevel, 1, 60)


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return o


# ------------------------------------------------------------- hand: a fist closed around a vertical grip
hand = []
# palm block (back of hand faces +X/up-ish), wraps the grip from the right side
hand.append(box((0.05, 0.075, 0.07), (0.012, 0.0, 0.008), GLOVE, bevel=0.014))
# four curled fingers wrapped round the front of the grip (-Z side), stacked down the grip
for i in range(4):
    y = 0.028 - i * 0.02
    w = 0.019 if i < 3 else 0.016
    hand.append(box((0.054, w, 0.024), (-0.004, y, -0.028), GLOVE, bevel=0.008))
    # fingertips curl back on the far side of the grip
    hand.append(box((0.018, w * 0.9, 0.02), (-0.03, y, -0.012), GLOVE, bevel=0.007))
# thumb laid along the top, toward the trigger/receiver
hand.append(box((0.02, 0.02, 0.055), (0.022, 0.04, -0.02), GLOVE, bevel=0.008, rot=(0.25, 0, -0.3)))
# armoured knuckle plate and back-of-hand plate
hand.append(box((0.012, 0.064, 0.03), (0.034, 0.012, -0.024), ARMOR, bevel=0.004))
hand.append(box((0.01, 0.06, 0.05), (0.038, 0.004, 0.02), ARMOR, bevel=0.004))
hand.append(box((0.003, 0.03, 0.004), (0.044, 0.006, 0.02), ACCENT, bevel=0.0008))
# cuff
hand.append(cyl(0.032, 0.03, (0.006, 0.0, 0.052), GLOVE, verts=18, bevel=0.004))
hand_obj = join(hand, "ArmHand")

# ------------------------------------------------------------- forearm (own frame, along +Z)
fore = []
# sleeve under the gauntlet, tapering toward the wrist
fore.append(cyl(0.036, 0.26, (0, -0.008, 0.15), SLEEVE, verts=18, bevel=0.0, r2=0.03))
# gauntlet: top and side plates with a raised ridge, layered like the GOLIATH reference
fore.append(box((0.07, 0.03, 0.16), (0, 0.022, 0.12), ARMOR, bevel=0.008, taper=0.9))
fore.append(box((0.03, 0.012, 0.14), (0, 0.041, 0.12), ARMOR, bevel=0.004))
for side in (-1, 1):
    fore.append(box((0.012, 0.05, 0.14), (side * 0.037, 0.0, 0.12), ARMOR, bevel=0.004))
# overlapping wrist lames
for i in range(2):
    fore.append(box((0.074, 0.028, 0.03), (0, 0.016, 0.035 + i * 0.022), ARMOR, bevel=0.005, rot=(-0.1, 0, 0)))
# rivets and an accent line along the ridge
for z in (0.07, 0.12, 0.17):
    for side in (-1, 1):
        fore.append(cyl(0.004, 0.006, (side * 0.044, 0.012, z), ARMOR, axis="x", verts=8, bevel=0.0))
fore.append(box((0.004, 0.004, 0.12), (0, 0.048, 0.12), ACCENT, bevel=0.0008))
# elbow pad edge at the far end
fore.append(box((0.08, 0.05, 0.03), (0, 0.006, 0.225), ARMOR, bevel=0.009))
fore_obj = join(fore, "ArmForearm")

for o in (hand_obj, fore_obj):
    o.data.calc_loop_triangles()
    print(o.name, "tris", len(o.data.loop_triangles))
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", export_yup=True, export_apply=True,
                          export_materials="EXPORT", export_normals=True, use_selection=False)
print("wrote", os.path.abspath(OUT), os.path.getsize(OUT))
