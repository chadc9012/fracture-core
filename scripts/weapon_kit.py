"""
Shared hard-surface kit for the first-person weapon GLBs (scripts/build-weapons.py). Same frame, materials and bake
as scripts/build-rifle.py: metres, origin at the firing-hand grip, barrel toward -Z in glTF, up +Y.

Each weapon exports up to four nodes named <Prefix>Body, <Prefix>Mag, <Prefix>Action and <Prefix>Accent:
Body, Mag and Action share one baked worn-metal/polymer texture set; Mag is pivoted where ViewWeapon's reload rig
expects it; Action (slide, pump, charging handle) stays at the grip origin and is moved by the cycle animation;
Accent carries a placeholder emissive material that ViewWeapon recolours per operator.
"""
import math
import os

import bpy
import numpy as np
from mathutils import Vector

TEX = 1024


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = 16
    return s


def three(x, y, z):
    """three.js weapon space (x, y up, z back) -> Blender (x, y forward, z up)."""
    return Vector((x, -z, y))


def finish(obj, bevel=0.0, segments=2, angle=35):
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


def tag(o, mask):
    """Vertex colour 'mask': 1 = bare gunmetal, 0 = polymer. Drives the baked material."""
    me = o.data
    if "mask" not in me.color_attributes:
        me.color_attributes.new("mask", "FLOAT_COLOR", "POINT")
    for d in me.color_attributes["mask"].data:
        d.color = (mask, mask, mask, 1)


def box(name, size, at, bevel=0.003, rot=(0, 0, 0), mask=1.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=three(*at))
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[2], size[1])
    o.rotation_euler = (-rot[0], rot[2], rot[1])
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    tag(o, mask)
    return finish(o, bevel)


def cyl(name, r, length, at, axis="z", verts=24, bevel=0.0015, mask=1.0, r2=None):
    """Cylinder (or cone with r2) along the weapon axis z, or across x / up y."""
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=length, location=three(*at))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=length, location=three(*at))
    o = bpy.context.active_object
    o.name = name
    if axis == "z":
        o.rotation_euler = (math.radians(90), 0, 0)
    elif axis == "x":
        o.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    tag(o, mask)
    return finish(o, bevel, segments=1, angle=60)


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


def set_origin(obj, at):
    scene = bpy.context.scene
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    scene.cursor.location = at
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    scene.cursor.location = (0, 0, 0)


def _sock(node, ident, out=False):
    coll = node.outputs if out else node.inputs
    return next(x for x in coll if x.identifier == ident)


def worn_material(name, metal=(0.085, 0.088, 0.095), polymer=(0.018, 0.019, 0.021), bare=(0.30, 0.29, 0.27)):
    """Parkerised gunmetal (mask 1) vs black polymer (mask 0): pointiness edge wear, grime blotches, fine scratches."""
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
    edge = n.new("ShaderNodeMapRange"); edge.inputs["From Min"].default_value = 0.56; edge.inputs["From Max"].default_value = 0.66
    nt.links.new(geo.outputs["Pointiness"], edge.inputs["Value"])
    noise = n.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 180; noise.inputs["Detail"].default_value = 8
    wear = n.new("ShaderNodeMath"); wear.operation = "MULTIPLY"
    nt.links.new(edge.outputs[0], wear.inputs[0]); nt.links.new(noise.outputs["Fac"], wear.inputs[1])
    wear2 = n.new("ShaderNodeMath"); wear2.operation = "MULTIPLY"; wear2.use_clamp = True; wear2.inputs[1].default_value = 1.4
    nt.links.new(wear.outputs[0], wear2.inputs[0])
    grime = n.new("ShaderNodeTexNoise"); grime.inputs["Scale"].default_value = 22; grime.inputs["Detail"].default_value = 4
    gr = n.new("ShaderNodeMapRange"); gr.inputs["From Min"].default_value = 0.4; gr.inputs["From Max"].default_value = 0.7
    gr.inputs["To Min"].default_value = 1.0; gr.inputs["To Max"].default_value = 0.72
    nt.links.new(grime.outputs["Fac"], gr.inputs["Value"])
    base = n.new("ShaderNodeMix"); base.data_type = "RGBA"
    _sock(base, "A_Color").default_value = (*polymer, 1)
    _sock(base, "B_Color").default_value = (*metal, 1)
    nt.links.new(attr.outputs["Fac"], base.inputs["Factor"])
    worn = n.new("ShaderNodeMix"); worn.data_type = "RGBA"
    _sock(worn, "B_Color").default_value = (*bare, 1)
    nt.links.new(_sock(base, "Result_Color", True), _sock(worn, "A_Color"))
    wmask = n.new("ShaderNodeMath"); wmask.operation = "MULTIPLY"
    nt.links.new(wear2.outputs[0], wmask.inputs[0]); nt.links.new(attr.outputs["Fac"], wmask.inputs[1])
    nt.links.new(wmask.outputs[0], worn.inputs["Factor"])
    dirt = n.new("ShaderNodeMix"); dirt.data_type = "RGBA"; dirt.blend_type = "MULTIPLY"; dirt.inputs["Factor"].default_value = 1
    nt.links.new(_sock(worn, "Result_Color", True), _sock(dirt, "A_Color"))
    grc = n.new("ShaderNodeCombineColor")
    for i in range(3):
        nt.links.new(gr.outputs[0], grc.inputs[i])
    nt.links.new(grc.outputs[0], _sock(dirt, "B_Color"))
    nt.links.new(_sock(dirt, "Result_Color", True), bsdf.inputs["Base Color"])
    nt.links.new(attr.outputs["Fac"], bsdf.inputs["Metallic"])
    rough = n.new("ShaderNodeMapRange"); rough.inputs["To Min"].default_value = 0.86; rough.inputs["To Max"].default_value = 0.58
    nt.links.new(attr.outputs["Fac"], rough.inputs["Value"])
    rough2 = n.new("ShaderNodeMath"); rough2.operation = "SUBTRACT"; rough2.use_clamp = True
    rw = n.new("ShaderNodeMath"); rw.operation = "MULTIPLY"; rw.inputs[1].default_value = 0.2
    nt.links.new(wmask.outputs[0], rw.inputs[0])
    nt.links.new(rough.outputs[0], rough2.inputs[0]); nt.links.new(rw.outputs[0], rough2.inputs[1])
    nt.links.new(rough2.outputs[0], bsdf.inputs["Roughness"])
    scr = n.new("ShaderNodeTexNoise"); scr.inputs["Scale"].default_value = 900; scr.inputs["Detail"].default_value = 2
    bump = n.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.08; bump.inputs["Distance"].default_value = 0.0005
    nt.links.new(scr.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def _bake(obj, prefix, **colors):
    scene = bpy.context.scene
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.006)
    bpy.ops.object.mode_set(mode="OBJECT")
    mat = worn_material(f"{prefix}_src", **colors)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    nt = mat.node_tree
    imgs = {}
    for kind in ("color", "rough", "metal", "normal"):
        img = bpy.data.images.new(f"{prefix}_{kind}", TEX, TEX, alpha=False, float_buffer=False)
        if kind != "color":
            img.colorspace_settings.name = "Non-Color"
        imgs[kind] = img
    tex = nt.nodes.new("ShaderNodeTexImage")
    nt.nodes.active = tex
    bsdf = next(x for x in nt.nodes if x.type == "BSDF_PRINCIPLED")
    out = next(x for x in nt.nodes if x.type == "OUTPUT_MATERIAL")
    scene.render.bake.margin = 8
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
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
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    tex.image = imgs["normal"]
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT")
    r = np.array(imgs["rough"].pixels[:]).reshape(TEX, TEX, 4)
    m = np.array(imgs["metal"].pixels[:]).reshape(TEX, TEX, 4)
    orm = np.ones((TEX, TEX, 4), dtype=np.float32)
    orm[..., 1] = r[..., 0]
    orm[..., 2] = m[..., 0]
    packed = bpy.data.images.new(f"{prefix}_orm", TEX, TEX, alpha=False)
    packed.colorspace_settings.name = "Non-Color"
    packed.pixels[:] = orm.ravel()
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
    obj.data.color_attributes.remove(obj.data.color_attributes["mask"])


def plain_material(name, color, metallic, roughness, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = next(x for x in mat.node_tree.nodes if x.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    if emission:
        b.inputs["Emission Color"].default_value = (*emission, 1)
        b.inputs["Emission Strength"].default_value = strength
    return mat


def assemble(prefix, groups, accent_parts, mag_pivot=None, plain=None, colors=None):
    """groups: {"Body": [objs], "Mag": [objs], "Action": [objs]} (Mag/Action optional). Body/Mag/Action are joined,
    baked to one texture set and split back out; Mag is re-pivoted at mag_pivot (three.js weapon space). plain:
    {"Name": (objs, material)} for parts with their own untextured material (e.g. a polished blade)."""
    joined = {}
    for key, objs in groups.items():
        if objs:
            joined[key] = join(objs, f"{prefix}{key}")
    for key, o in joined.items():
        vg = o.vertex_groups.new(name=key)
        vg.add([v.index for v in o.data.vertices], 1.0, "REPLACE")
        set_origin(o, (0, 0, 0))
    merged = join(list(joined.values()), f"{prefix}Merged")
    _bake(merged, f"{prefix}Worn", **(colors or {}))
    bpy.ops.object.mode_set(mode="EDIT")
    for key in joined:
        if key == "Body":
            continue
        bpy.ops.mesh.select_all(action="DESELECT")
        merged.vertex_groups.active_index = merged.vertex_groups[key].index
        bpy.ops.object.vertex_group_select()
        bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    merged.name = f"{prefix}Body"
    for o in list(bpy.data.objects):
        if o is merged or o.type != "MESH" or not o.name.startswith(f"{prefix}Merged"):
            continue
        names = {o.vertex_groups[g.group].name for v in o.data.vertices for g in v.groups}
        o.name = f"{prefix}{next(iter(names))}"
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.vertex_groups.clear()
    if mag_pivot and f"{prefix}Mag" in bpy.data.objects:
        set_origin(bpy.data.objects[f"{prefix}Mag"], three(*mag_pivot))
    if accent_parts:
        acc = join(accent_parts, f"{prefix}Accent")
        acc.data.materials.clear()
        acc.data.materials.append(plain_material(f"{prefix}Accent", (1.0, 0.45, 0.1), 0.2, 0.3, (1.0, 0.45, 0.1), 2.0))
        if "mask" in acc.data.color_attributes:
            acc.data.color_attributes.remove(acc.data.color_attributes["mask"])
        set_origin(acc, (0, 0, 0))
    for name, (objs, mat) in (plain or {}).items():
        o = join(objs, f"{prefix}{name}")
        o.data.materials.clear()
        o.data.materials.append(mat)
        if "mask" in o.data.color_attributes:
            o.data.color_attributes.remove(o.data.color_attributes["mask"])
        set_origin(o, (0, 0, 0))


def export(out):
    tris = 0
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            print(f"{o.name:16s} tris={len(o.data.loop_triangles)} origin={tuple(round(c, 3) for c in o.location)}")
            tris += len(o.data.loop_triangles)
    print("total tris", tris)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format="GLB", export_yup=True, export_apply=True,
                              export_image_format="JPEG", export_jpeg_quality=88, export_texcoords=True, export_normals=True,
                              export_tangents=False, export_materials="EXPORT", export_attributes=False, use_selection=False)
    print("wrote", os.path.abspath(out), os.path.getsize(out))
