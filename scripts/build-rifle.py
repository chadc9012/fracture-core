"""
Builds public/models/weapons/rifle.glb: the first-person auto rifle, hard-surface modelled to the operator
reference art (worn dark gunmetal, black polymer, glowing accent strips). Run with Blender as a module:

    pip install bpy && python3 scripts/build-rifle.py [out.glb]

Frame (matches ViewWeapon.tsx): metres, origin at the firing-hand grip, barrel toward -Z in glTF
(+Y in Blender), up +Y in glTF (+Z in Blender). Muzzle at 0.80 m, magazine pivot at 0.18 m, foregrip 0.40 m.
Nodes: RifleBody (static), RifleMag (pivot at the mag well, drops on reload), RifleBolt (cycles after shots),
RifleAccent (emissive strips; ViewWeapon recolours them per operator).
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

OUT = sys.argv[-1] if sys.argv[-1].endswith(".glb") else os.path.join(os.path.dirname(__file__), "..", "public", "models", "weapons", "rifle.glb")
TEX = 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 16


def three(x, y, z):
    """three.js weapon-space (x, y up, z back) -> Blender (x, y forward, z up)."""
    return Vector((x, -z, y))


def finish(obj, bevel=0.0, segments=2, angle=35):
    """Apply a bevel (chamfered hard-surface edges) and weighted-normal style smoothing."""
    bpy.context.view_layer.objects.active = obj
    if bevel > 0:
        m = obj.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = segments
        m.limit_method = "ANGLE"
        m.angle_limit = math.radians(angle)
        m.harden_normals = True
        bpy.ops.object.modifier_apply(modifier=m.name)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def box(name, size, at, bevel=0.003, rot=(0, 0, 0), mask=1.0):
    """size/at in three.js weapon space (x, y, z extents)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=three(*at))
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[2], size[1])
    o.rotation_euler = (-rot[0], rot[2], rot[1])
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    tag(o, mask)
    return finish(o, bevel)


def cyl(name, r, length, at, axis="z", verts=24, bevel=0.0015, mask=1.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=length, location=three(*at))
    o = bpy.context.active_object
    o.name = name
    if axis == "z":
        o.rotation_euler = (math.radians(90), 0, 0)
    elif axis == "x":
        o.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    tag(o, mask)
    return finish(o, bevel, segments=1, angle=60)


def tag(o, mask):
    """Vertex colour 'mask': 1 = bare gunmetal, 0 = polymer. Drives the baked material."""
    me = o.data
    if "mask" not in me.color_attributes:
        me.color_attributes.new("mask", "FLOAT_COLOR", "POINT")
    attr = me.color_attributes["mask"]
    for d in attr.data:
        d.color = (mask, mask, mask, 1)


def cut(target, cutter):
    m = target.modifiers.new("cut", "BOOLEAN")
    m.object = cutter
    m.operation = "DIFFERENCE"
    m.solver = "EXACT"
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


# ---------------------------------------------------------------- body
parts = []
# upper receiver: long chamfered block with an ejection port and a stepped top
upper = box("upper", (0.058, 0.05, 0.40), (0, 0.092, -0.13), bevel=0.006)
port = box("port_cut", (0.03, 0.022, 0.07), (0.03, 0.09, -0.07), bevel=0)
cut(upper, port)
parts.append(upper)
# lower receiver with a flared mag well and trigger guard
lower = box("lower", (0.054, 0.045, 0.24), (0, 0.048, -0.08), bevel=0.005)
parts.append(lower)
parts.append(box("magwell", (0.06, 0.04, 0.085), (0, 0.035, -0.18), bevel=0.006))
guard = box("guard", (0.012, 0.008, 0.075), (0, 0.004, -0.045), bevel=0.003)
parts.append(guard)
# picatinny rail on top: base plus 14 cross-slots
parts.append(box("rail", (0.03, 0.012, 0.38), (0, 0.123, -0.17), bevel=0.0015))
for i in range(14):
    parts.append(box(f"slot{i}", (0.034, 0.006, 0.012), (0, 0.131, -0.02 - i * 0.025), bevel=0.001))
# handguard: octagonal shroud with vent windows cut through the sides
hg = cyl("handguard", 0.038, 0.30, (0, 0.075, -0.43), verts=8, bevel=0.004)
hg.rotation_euler = (0, math.radians(22.5), 0)
bpy.context.view_layer.objects.active = hg
bpy.ops.object.transform_apply(rotation=True)
for i in range(5):
    v = box(f"vent{i}", (0.1, 0.018, 0.034), (0, 0.075, -0.33 - i * 0.05), bevel=0)
    cut(hg, v)
parts.append(hg)
# barrel, gas block, three-port muzzle brake
parts.append(cyl("barrel", 0.0115, 0.30, (0, 0.075, -0.64), bevel=0))
parts.append(box("gasblock", (0.03, 0.03, 0.03), (0, 0.083, -0.6), bevel=0.003))
brake = cyl("brake", 0.019, 0.085, (0, 0.075, -0.765), verts=20, bevel=0.003)
for i in range(3):
    h = cyl(f"bport{i}", 0.006, 0.08, (0, 0.075, -0.745 - i * 0.022), axis="x", verts=10, bevel=0)
    cut(brake, h)
parts.append(brake)
# pistol grip with finger grooves (polymer), raked back
grip = box("grip", (0.036, 0.115, 0.048), (0, -0.025, 0.004), bevel=0.008, rot=(-0.32, 0, 0), mask=0.0)
for i in range(3):
    g = cyl(f"groove{i}", 0.009, 0.06, (0, -0.005 - i * 0.03, -0.034 + i * 0.01), axis="x", verts=12, bevel=0)
    cut(grip, g)
parts.append(grip)
# vertical foregrip (polymer)
parts.append(cyl("foregrip", 0.017, 0.085, (0, 0.0, -0.40), axis="y", verts=16, bevel=0.003, mask=0.0))
parts.append(box("fg_mount", (0.026, 0.016, 0.04), (0, 0.04, -0.40), bevel=0.002))
# buffer tube and adjustable stock (polymer) with cheek riser and rubber pad
parts.append(cyl("buffer", 0.016, 0.16, (0, 0.075, 0.12), bevel=0.002))
parts.append(box("stock", (0.044, 0.07, 0.16), (0, 0.06, 0.19), bevel=0.01, mask=0.0))
parts.append(box("cheek", (0.04, 0.02, 0.1), (0, 0.105, 0.18), bevel=0.006, mask=0.0))
parts.append(box("pad", (0.046, 0.11, 0.022), (0, 0.035, 0.275), bevel=0.006, mask=0.0))
# optic: holographic sight housing with hood and battery cap
parts.append(box("optic_base", (0.036, 0.016, 0.06), (0, 0.138, -0.14), bevel=0.002))
optic = box("optic", (0.046, 0.044, 0.09), (0, 0.168, -0.14), bevel=0.006)
win = box("optic_window", (0.034, 0.03, 0.12), (0, 0.172, -0.14), bevel=0)
cut(optic, win)
parts.append(optic)
parts.append(cyl("optic_cap", 0.008, 0.012, (0.027, 0.162, -0.14), axis="x", verts=12, bevel=0.001))
# sling loop and side bolts for silhouette detail
for z in (-0.02, -0.21):
    parts.append(cyl(f"bolt{z}", 0.005, 0.064, (0, 0.06, z), axis="x", verts=10, bevel=0.0008))
parts.append(box("sling", (0.008, 0.02, 0.03), (-0.032, 0.05, 0.08), bevel=0.002))
body = join(parts, "RifleBody")

# ---------------------------------------------------------------- magazine (pivot at the mag well)
mag_body = box("mag_body", (0.034, 0.17, 0.066), (0, -0.065, -0.18), bevel=0)
bpy.context.view_layer.objects.active = mag_body
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.subdivide(number_cuts=10)
bpy.ops.object.mode_set(mode="OBJECT")
bend = mag_body.modifiers.new("bend", "SIMPLE_DEFORM")
bend.deform_method = "BEND"
bend.deform_axis = "X"
bend.angle = math.radians(-26)
bpy.ops.object.modifier_apply(modifier=bend.name)
finish(mag_body, 0.004)
# ribs along the mag body read as a stamped steel magazine
mag_parts = [mag_body]
mag_parts.append(box("magbase", (0.04, 0.014, 0.074), (0, -0.152, -0.215), bevel=0.003, rot=(0.25, 0, 0), mask=0.0))
mag = join(mag_parts, "RifleMag")

# ---------------------------------------------------------------- bolt / charging handle
bolt = join([box("handle", (0.022, 0.016, 0.04), (0.04, 0.09, -0.06), bevel=0.003),
             cyl("knob", 0.009, 0.02, (0.055, 0.09, -0.06), axis="x", verts=12, bevel=0.001)], "RifleBolt")

# ---------------------------------------------------------------- accent strips (emissive, recoloured per operator)
accent = join([box("strip_l", (0.004, 0.006, 0.24), (0.031, 0.1, -0.16), bevel=0.001),
               box("strip_r", (0.004, 0.006, 0.24), (-0.031, 0.1, -0.16), bevel=0.001),
               box("hg_strip", (0.004, 0.005, 0.2), (0.036, 0.075, -0.43), bevel=0.001),
               box("reticle", (0.012, 0.012, 0.002), (0, 0.172, -0.12), bevel=0)], "RifleAccent")

# pivot the magazine at the well so ViewWeapon can drop it straight down
mag_pivot = three(0, 0.02, -0.18)
bpy.context.view_layer.objects.active = mag
bpy.ops.object.select_all(action="DESELECT")
mag.select_set(True)
scene.cursor.location = mag_pivot
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
scene.cursor.location = (0, 0, 0)


# ---------------------------------------------------------------- worn-metal material, baked to textures

def sock(node, ident, out=False):
    """Mix node sockets share names across float/vector/colour variants; pick the colour one by identifier."""
    coll = node.outputs if out else node.inputs
    return next(x for x in coll if x.identifier == ident)

def worn_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    n = nt.nodes
    for x in list(n):
        n.remove(x)
    out = n.new("ShaderNodeOutputMaterial")
    bsdf = n.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    attr = n.new("ShaderNodeAttribute"); attr.attribute_name = "mask"
    geo = n.new("ShaderNodeNewGeometry")
    # edge wear: convex edges (pointiness) scrubbed back to bright steel, broken up by noise
    edge = n.new("ShaderNodeMapRange"); edge.inputs["From Min"].default_value = 0.56; edge.inputs["From Max"].default_value = 0.66
    nt.links.new(geo.outputs["Pointiness"], edge.inputs["Value"])
    noise = n.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 180; noise.inputs["Detail"].default_value = 8
    wear = n.new("ShaderNodeMath"); wear.operation = "MULTIPLY"
    nt.links.new(edge.outputs[0], wear.inputs[0]); nt.links.new(noise.outputs["Fac"], wear.inputs[1])
    wear2 = n.new("ShaderNodeMath"); wear2.operation = "MULTIPLY"; wear2.use_clamp = True; wear2.inputs[1].default_value = 1.4
    nt.links.new(wear.outputs[0], wear2.inputs[0])
    # grime: large blotches darken flat areas
    grime = n.new("ShaderNodeTexNoise"); grime.inputs["Scale"].default_value = 22; grime.inputs["Detail"].default_value = 4
    gr = n.new("ShaderNodeMapRange"); gr.inputs["From Min"].default_value = 0.4; gr.inputs["From Max"].default_value = 0.7
    gr.inputs["To Min"].default_value = 1.0; gr.inputs["To Max"].default_value = 0.72
    nt.links.new(grime.outputs["Fac"], gr.inputs["Value"])
    # base colours: parkerised gunmetal vs black polymer
    base = n.new("ShaderNodeMix"); base.data_type = "RGBA"
    sock(base, "A_Color").default_value = (0.018, 0.019, 0.021, 1)  # black polymer
    sock(base, "B_Color").default_value = (0.055, 0.057, 0.062, 1)  # dark parkerised gunmetal
    nt.links.new(attr.outputs["Fac"], base.inputs["Factor"])
    worn = n.new("ShaderNodeMix"); worn.data_type = "RGBA"
    sock(worn, "B_Color").default_value = (0.30, 0.29, 0.27, 1)  # scuffed bare steel
    nt.links.new(sock(base, "Result_Color", True), sock(worn, "A_Color"))
    wmask = n.new("ShaderNodeMath"); wmask.operation = "MULTIPLY"
    nt.links.new(wear2.outputs[0], wmask.inputs[0]); nt.links.new(attr.outputs["Fac"], wmask.inputs[1])
    nt.links.new(wmask.outputs[0], worn.inputs["Factor"])
    dirt = n.new("ShaderNodeMix"); dirt.data_type = "RGBA"; dirt.blend_type = "MULTIPLY"; dirt.inputs["Factor"].default_value = 1
    nt.links.new(sock(worn, "Result_Color", True), sock(dirt, "A_Color"))
    grc = n.new("ShaderNodeCombineColor")
    for i in range(3):
        nt.links.new(gr.outputs[0], grc.inputs[i])
    nt.links.new(grc.outputs[0], sock(dirt, "B_Color"))
    nt.links.new(sock(dirt, "Result_Color", True), bsdf.inputs["Base Color"])
    # metallic: gunmetal 0.9, polymer 0; roughness: polymer 0.78, metal 0.42, worn edges 0.25
    nt.links.new(attr.outputs["Fac"], bsdf.inputs["Metallic"])
    rough = n.new("ShaderNodeMapRange"); rough.inputs["To Min"].default_value = 0.86; rough.inputs["To Max"].default_value = 0.58
    nt.links.new(attr.outputs["Fac"], rough.inputs["Value"])
    rough2 = n.new("ShaderNodeMath"); rough2.operation = "SUBTRACT"; rough2.use_clamp = True
    rw = n.new("ShaderNodeMath"); rw.operation = "MULTIPLY"; rw.inputs[1].default_value = 0.2
    nt.links.new(wmask.outputs[0], rw.inputs[0])
    nt.links.new(rough.outputs[0], rough2.inputs[0]); nt.links.new(rw.outputs[0], rough2.inputs[1])
    nt.links.new(rough2.outputs[0], bsdf.inputs["Roughness"])
    # fine scratches + stipple on polymer into the normal map
    scr = n.new("ShaderNodeTexNoise"); scr.inputs["Scale"].default_value = 900; scr.inputs["Detail"].default_value = 2
    bump = n.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.08; bump.inputs["Distance"].default_value = 0.0005
    nt.links.new(scr.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def bake_object(obj, prefix):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.006)
    bpy.ops.object.mode_set(mode="OBJECT")
    mat = worn_material(f"{prefix}_src")
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    nt = mat.node_tree
    imgs = {}
    for kind in ("color", "rough", "metal", "normal"):
        img = bpy.data.images.new(f"{prefix}_{kind}", TEX, TEX, alpha=False, float_buffer=False)
        if kind in ("rough", "metal", "normal"):
            img.colorspace_settings.name = "Non-Color"
        imgs[kind] = img
    tex = nt.nodes.new("ShaderNodeTexImage")
    nt.nodes.active = tex
    bsdf = next(x for x in nt.nodes if x.type == "BSDF_PRINCIPLED")
    out = next(x for x in nt.nodes if x.type == "OUTPUT_MATERIAL")
    scene.render.bake.margin = 8
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    # every value channel is baked through an emission swap: DIFFUSE/COLOR returns black on metallic surfaces
    emit = nt.nodes.new("ShaderNodeEmission")
    def bake_value(socket_name, img):
        src = bsdf.inputs[socket_name]
        if src.links:
            nt.links.new(src.links[0].from_socket, emit.inputs["Color"])
        else:
            v = src.default_value
            emit.inputs["Color"].default_value = (v, v, v, 1) if isinstance(v, float) else tuple(v)
        nt.links.new(emit.outputs[0], out.inputs[0])
        tex.image = img
        bpy.ops.object.bake(type="EMIT")
    bake_value("Base Color", imgs["color"])
    bake_value("Roughness", imgs["rough"])
    bake_value("Metallic", imgs["metal"])
    # normal (tangent space, OpenGL / glTF convention) from the real shader
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    tex.image = imgs["normal"]
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT")
    # pack glTF metallicRoughness (G = roughness, B = metallic)
    r = np.array(imgs["rough"].pixels[:]).reshape(TEX, TEX, 4)
    m = np.array(imgs["metal"].pixels[:]).reshape(TEX, TEX, 4)
    orm = np.ones((TEX, TEX, 4), dtype=np.float32)
    orm[..., 1] = r[..., 0]
    orm[..., 2] = m[..., 0]
    packed = bpy.data.images.new(f"{prefix}_orm", TEX, TEX, alpha=False)
    packed.colorspace_settings.name = "Non-Color"
    packed.pixels[:] = orm.ravel()
    # final export material: plain textures the glTF exporter understands
    final = bpy.data.materials.new(prefix)
    final.use_nodes = True
    fn = final.node_tree
    fb = next(x for x in fn.nodes if x.type == "BSDF_PRINCIPLED")
    for img in (imgs["color"], packed, imgs["normal"]):
        img.pack()
    tc = fn.nodes.new("ShaderNodeTexImage"); tc.image = imgs["color"]
    fn.links.new(tc.outputs["Color"], fb.inputs["Base Color"])
    to = fn.nodes.new("ShaderNodeTexImage"); to.image = packed
    sep = fn.nodes.new("ShaderNodeSeparateColor")
    fn.links.new(to.outputs["Color"], sep.inputs["Color"])
    fn.links.new(sep.outputs["Green"], fb.inputs["Roughness"])
    fn.links.new(sep.outputs["Blue"], fb.inputs["Metallic"])
    tn = fn.nodes.new("ShaderNodeTexImage"); tn.image = imgs["normal"]
    nm = fn.nodes.new("ShaderNodeNormalMap")
    fn.links.new(tn.outputs["Color"], nm.inputs["Color"])
    fn.links.new(nm.outputs["Normal"], fb.inputs["Normal"])
    obj.data.materials.clear()
    obj.data.materials.append(final)
    # the vertex mask was only a bake input
    obj.data.color_attributes.remove(obj.data.color_attributes["mask"])


# body + magazine + bolt share one texture set: join, bake, then split back out by name-tagged vertex groups
for o, g in ((body, "body"), (mag, "mag"), (bolt, "bolt")):
    vg = o.vertex_groups.new(name=g)
    vg.add([v.index for v in o.data.vertices], 1.0, "REPLACE")
mag_origin = mag.location.copy()
bpy.context.view_layer.objects.active = mag
mag.select_set(True)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")  # cursor at world origin -> all three share one frame for the bake
merged = join([body, mag, bolt], "RifleMerged")
_m = np.array([d.color[0] for d in merged.data.color_attributes["mask"].data])
print("mask polymer verts", int((_m < 0.5).sum()), "metal verts", int((_m >= 0.5).sum()))
bake_object(merged, "RifleWorn")
# split
bpy.ops.object.mode_set(mode="EDIT")
for g, name in (("mag", "RifleMag"), ("bolt", "RifleBolt")):
    bpy.ops.mesh.select_all(action="DESELECT")
    merged.vertex_groups.active_index = merged.vertex_groups[g].index
    bpy.ops.object.vertex_group_select()
    bpy.ops.mesh.separate(type="SELECTED")
bpy.ops.object.mode_set(mode="OBJECT")
merged.name = "RifleBody"
for o in list(bpy.data.objects):
    if o is merged or o.type != "MESH" or o.name in ("RifleAccent",):
        continue
    if o.name.startswith("RifleMerged"):
        # identify by which group has weights
        names = {o.vertex_groups[g.group].name for v in o.data.vertices for g in v.groups}
        o.name = "RifleMag" if "mag" in names else "RifleBolt"
for o in bpy.data.objects:
    if o.type == "MESH":
        o.vertex_groups.clear()
# re-pivot the magazine at the well
m = bpy.data.objects["RifleMag"]
bpy.ops.object.select_all(action="DESELECT")
m.select_set(True)
bpy.context.view_layer.objects.active = m
scene.cursor.location = mag_pivot
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
scene.cursor.location = (0, 0, 0)

# accent material: emissive placeholder (ViewWeapon sets colour/intensity per operator)
am = bpy.data.materials.new("RifleAccent")
am.use_nodes = True
ab = next(x for x in am.node_tree.nodes if x.type == "BSDF_PRINCIPLED")
ab.inputs["Base Color"].default_value = (1.0, 0.45, 0.1, 1)
ab.inputs["Emission Color"].default_value = (1.0, 0.45, 0.1, 1)
ab.inputs["Emission Strength"].default_value = 2.0
accent.data.materials.clear()
accent.data.materials.append(am)

if "mask" in accent.data.color_attributes:
    accent.data.color_attributes.remove(accent.data.color_attributes["mask"])
# joined parts took the first part's origin; everything except the magazine pivots at the grip (world origin)
scene.cursor.location = (0, 0, 0)
for name in ("RifleBody", "RifleBolt", "RifleAccent"):
    o = bpy.data.objects[name]
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

# stats + export
tris = 0
for o in bpy.data.objects:
    if o.type == "MESH":
        o.data.calc_loop_triangles()
        print(f"{o.name:12s} tris={len(o.data.loop_triangles)} origin={tuple(round(c, 3) for c in o.location)}")
        tris += len(o.data.loop_triangles)
print("total tris", tris)
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", export_yup=True, export_apply=True,
                          export_image_format="JPEG", export_jpeg_quality=88, export_texcoords=True, export_normals=True,
                          export_tangents=False, export_materials="EXPORT", export_attributes=False, use_selection=False)
print("wrote", os.path.abspath(OUT), os.path.getsize(OUT))
