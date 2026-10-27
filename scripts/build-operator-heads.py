"""
Operator heads for character creation's face choice (offline tool; Blender bpy). The authored operators each carry their own
head; this cuts a head out of one of them as its own small GLB, so any body can wear any face of its body type. The game's
bodies are exported headless (scripts/build-operator-variants.py) and OperatorModel.tsx skins the chosen head onto the body's
own Head/Neck bones at load (operator-faces.ts lists the heads).

A head GLB holds the donor's armature (so the head keeps its skin weights and bind matrices) and one mesh, "FaceHead": the
vertices the Head bone owns, minus any collar or hood lining that is also skinned to the Head but sits below the jaw outside
the neck. Its textures are cropped to the head's own UV islands, so a head is a few hundred KB instead of the body's atlas.

    blender -b -P scripts/build-operator-heads.py -- DONOR.glb OUT.glb [neck-radius-m] [jaw-drop-m]
    blender -b -P scripts/build-operator-heads.py -- RIG.glb OUT.glb robot mono|twin|slit|mask

A robot head is modelled here (plates, optics) on RIG's Head bone and skinned fully to it; its optics material is named
"RobotOptic" and its plating "RobotPlate" so the game can tint them. Writes OUT.glb and OUT.jpg (a portrait thumbnail).
"""
import math
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
src, out = argv[0], argv[1]
robot = len(argv) > 2 and argv[2] == "robot"
style = argv[3] if robot else None
NECK_R = float(argv[2]) if len(argv) > 2 and not robot else 0.075
JAW_DROP = float(argv[3]) if len(argv) > 3 and not robot else 0.03
HEAD = "mixamorig:Head"
MOUTH_Z = float(argv[4]) if len(argv) > 4 and not robot else 0.05  # the mouth sits this far above the Head bone

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
mesh = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
if arm.animation_data:
    arm.animation_data.action = None
for o in [o for o in bpy.data.objects if o.type == "MESH" and o is not mesh]:
    bpy.data.objects.remove(o, do_unlink=True)
inv = mesh.matrix_world.inverted() @ arm.matrix_world
hb = inv @ arm.data.bones[HEAD].head_local  # Head bone in the mesh's bind space (Z up, -Y forward)


def keep_only(obj, keep):
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep[v.index]], context="VERTS")
    bm.to_mesh(obj.data); bm.free(); obj.data.update()


def bake_textures(obj, size=1024):
    """the head's UV islands are scattered over the body's whole atlas, so instead of shipping that atlas the head gets its own
    UV layout and its colour (and normal detail) are baked onto a small texture of its own"""
    me = obj.data
    # the authored mesh is split at every UV seam (thousands of loose triangles): weld it first so the new layout gets whole
    # islands (UVs live per face corner, so the source mapping survives the weld)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me); bm.free(); me.update()
    src_name = me.uv_layers.active.name
    me.uv_layers.new(name="head")
    me.uv_layers.active = me.uv_layers["head"]
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT"); obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.2, island_margin=0.003)
    bpy.ops.uv.pack_islands(margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")
    me.uv_layers[src_name].active_render = True  # the source material keeps reading its own layout while baking
    mat = me.materials[0]; nt = mat.node_tree
    for n in nt.nodes:  # pin every image node of the source material to the source UVs
        if n.type == "TEX_IMAGE":
            uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = src_name
            nt.links.new(uvn.outputs["UV"], n.inputs["Vector"])
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 4
    out_imgs = {}
    for kind, res, cs in (("DIFFUSE", size, "sRGB"), ("NORMAL", size // 2, "Non-Color")):
        img = bpy.data.images.new(f"head_{kind.lower()}", res, res, alpha=False)
        img.colorspace_settings.name = cs
        tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = img
        tuv = nt.nodes.new("ShaderNodeUVMap"); tuv.uv_map = "head"; nt.links.new(tuv.outputs["UV"], tn.inputs["Vector"])
        for n in nt.nodes:
            n.select = False
        tn.select = True; nt.nodes.active = tn
        if kind == "DIFFUSE":
            sc.render.bake.use_pass_direct = False; sc.render.bake.use_pass_indirect = False; sc.render.bake.use_pass_color = True
        sc.render.bake.margin = 6
        bpy.ops.object.bake(type=kind, uv_layer="head")
        img.pack(); out_imgs[kind] = img
        nt.nodes.remove(tn); nt.nodes.remove(tuv)
    # a plain material on the new layout: baked colour + normal, skin-like roughness
    m = bpy.data.materials.new("FaceSkin"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    c = m.node_tree.nodes.new("ShaderNodeTexImage"); c.image = out_imgs["DIFFUSE"]
    m.node_tree.links.new(c.outputs["Color"], b.inputs["Base Color"])
    nimg = m.node_tree.nodes.new("ShaderNodeTexImage"); nimg.image = out_imgs["NORMAL"]
    nm = m.node_tree.nodes.new("ShaderNodeNormalMap")
    m.node_tree.links.new(nimg.outputs["Color"], nm.inputs["Color"]); m.node_tree.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = 0.62; b.inputs["Metallic"].default_value = 0.0
    me.materials.clear(); me.materials.append(m)
    me.uv_layers.remove(me.uv_layers[src_name])
    me.uv_layers.active = me.uv_layers["head"]; me.uv_layers["head"].active_render = True


def fold_head_bones():
    """some heads have their own face bones under the Head (CIPHER's jaw and eyes); a body only has the Mixamo skeleton, so
    their weights are folded into the Head"""
    sub = {b.name for b in arm.data.bones if b.parent and any(p.name == HEAD for p in b.parent_recursive + [b.parent])}
    head_g = mesh.vertex_groups.get(HEAD) or mesh.vertex_groups.new(name=HEAD)
    groups = [g for g in mesh.vertex_groups if g.name in sub]
    if not groups:
        return
    idx = {g.index for g in groups}
    for v in mesh.data.vertices:
        w = sum(g.weight for g in v.groups if g.group in idx)
        if w > 0:
            cur = next((g.weight for g in v.groups if g.group == head_g.index), 0.0)
            head_g.add([v.index], cur + w, "REPLACE")
    for g in groups:
        mesh.vertex_groups.remove(g)
    print("folded face bones into the Head:", sorted(sub))


def human_head():
    fold_head_bones()
    names = {g.index: g.name for g in mesh.vertex_groups}
    keep = []
    for v in mesh.data.vertices:
        dom = names[max(v.groups, key=lambda g: g.weight).group] if v.groups else ""
        if dom != HEAD:
            # the chin and the front of the neck above the jaw line belong to the head too (the headless bodies drop exactly these:
            # build-operator-variants.py face_clear), or the face would show a hole under the mouth
            near = (v.co.x - hb.x) ** 2 + (v.co.y - hb.y) ** 2 < 0.12 ** 2
            keep.append(dom in ("mixamorig:Neck", "mixamorig:Spine2") and v.co.z > hb.z - 0.035 and near); continue
        below_jaw = v.co.z < hb.z - JAW_DROP
        off_neck = (v.co.x - hb.x) ** 2 + (v.co.y - hb.y) ** 2 > NECK_R ** 2
        far = (v.co - (hb + Vector((0, 0, 0.09)))).length > 0.2  # shoulder gear / back weapons skinned to the Head
        keep.append(not (below_jaw and off_neck) and not far)  # collar / hood lining skinned to the Head
    keep_only(mesh, keep)
    drop_collar_parts(mesh)
    bake_textures(mesh)


def drop_collar_parts(obj):
    """a collar or face mask is usually its own loose piece wrapped round the jaw: drop loose pieces whose middle sits below the
    mouth (the face and the hair are kept: the largest piece, and anything centred above the mouth)"""
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
    # the mesh is split at every UV seam, so pieces are joined through shared edges AND through vertices at the same position
    parent = list(range(len(bm.verts)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    at = {}
    for v in bm.verts:
        k = (round(v.co.x, 4), round(v.co.y, 4), round(v.co.z, 4))
        if k in at:
            union(v.index, at[k])
        else:
            at[k] = v.index
    for e in bm.edges:
        union(e.verts[0].index, e.verts[1].index)
    groups = {}
    for v in bm.verts:
        groups.setdefault(find(v.index), []).append(v)
    parts = list(groups.values())
    parts.sort(key=len, reverse=True)
    mouth = hb.z + MOUTH_Z
    drop = []
    for comp in parts[1:]:
        cz = sum(v.co.z for v in comp) / len(comp)
        cy = sum(v.co.y for v in comp) / len(comp)
        if cz < mouth and cy < hb.y + 0.02:  # in front of the neck, below the mouth
            drop.extend(comp)
    print(f"loose parts {len(parts)}, largest {len(parts[0])}, dropped {len(drop)} collar verts")
    if drop:
        bmesh.ops.delete(bm, geom=drop, context="VERTS")
    bm.to_mesh(obj.data); bm.free(); obj.data.update()


def robot_parts():
    keep_only(mesh, [False] * len(mesh.data.vertices))
    world = mesh.matrix_world

    def material(name, base, metal, rough, emit=None, strength=0.0):
        m = bpy.data.materials.new(name); m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (*base, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
        if emit:
            b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = strength
        return m
    plate = material("RobotPlate", (0.42, 0.44, 0.48), 0.9, 0.3)
    dark = material("RobotDark", (0.05, 0.055, 0.06), 0.6, 0.5)
    optic = material("RobotOptic", (0.1, 0.7, 1.0), 0.0, 0.15, (0.25, 0.9, 1.0), 6.0)
    parts = []

    def add(o, mat):
        o.data.materials.clear(); o.data.materials.append(mat)
        bpy.ops.object.shade_smooth(); parts.append(o)

    def box(mat, size, loc, bevel=0.012, seg=4, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=world @ (hb + Vector(loc)), rotation=rot)
        o = bpy.context.object; o.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        if bevel:
            md = o.modifiers.new("b", "BEVEL"); md.width = bevel; md.segments = seg; md.limit_method = "NONE"
            bpy.ops.object.modifier_apply(modifier=md.name)
        add(o, mat)

    def sphere(mat, r, loc, scale=(1, 1, 1)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r, location=world @ (hb + Vector(loc)))
        o = bpy.context.object; o.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        add(o, mat)

    def cyl(mat, r, depth, loc, rot, verts=24):
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=world @ (hb + Vector(loc)), rotation=rot)
        add(bpy.context.object, mat)
    face_y = -0.095  # the face plane, forward of the Head bone (forward is -Y)
    if style == "mono":
        # rounded cranium, one big round lens in a dark socket, cheek vents
        sphere(plate, 0.105, (0, 0.0, 0.11), (0.86, 1.0, 1.05))
        box(plate, (0.12, 0.06, 0.07), (0, -0.055, 0.045), bevel=0.025, rot=(0.25, 0, 0))
        cyl(dark, 0.034, 0.03, (0, face_y + 0.004, 0.12), (math.pi / 2, 0, 0))
        cyl(optic, 0.024, 0.02, (0, face_y - 0.007, 0.12), (math.pi / 2, 0, 0))
        for sx in (-1, 1):
            for k in range(3):
                box(dark, (0.006, 0.02, 0.004), (sx * 0.05, -0.075, 0.06 - k * 0.012), bevel=0)
    elif style == "twin":
        # Exo-like: smooth skull plate, brow ridge, two round eyes, jointed jaw
        sphere(plate, 0.102, (0, 0.005, 0.115), (0.88, 1.0, 1.08))
        box(plate, (0.13, 0.03, 0.025), (0, -0.088, 0.145), bevel=0.01)
        for sx in (-1, 1):
            cyl(dark, 0.02, 0.02, (sx * 0.033, face_y + 0.006, 0.12), (math.pi / 2, 0, 0))
            cyl(optic, 0.013, 0.014, (sx * 0.033, face_y - 0.002, 0.12), (math.pi / 2, 0, 0))
        box(dark, (0.09, 0.07, 0.05), (0, -0.05, 0.05), bevel=0.02)
        box(plate, (0.085, 0.04, 0.03), (0, -0.07, 0.04), bevel=0.012)
        for sx in (-1, 1):
            cyl(dark, 0.016, 0.02, (sx * 0.06, -0.02, 0.07), (0, math.pi / 2, 0))
    elif style == "slit":
        # angular helmet with a narrow scanning visor band
        box(plate, (0.15, 0.19, 0.21), (0, 0.005, 0.11), bevel=0.06, seg=6)
        box(plate, (0.03, 0.16, 0.03), (0, 0.01, 0.215), bevel=0.012)
        box(dark, (0.13, 0.02, 0.05), (0, -0.093, 0.12), bevel=0.008)
        box(optic, (0.11, 0.012, 0.011), (0, -0.101, 0.124), bevel=0.005)
        box(plate, (0.09, 0.05, 0.07), (0, -0.07, 0.035), bevel=0.02, rot=(0.3, 0, 0))
        for sx in (-1, 1):
            cyl(dark, 0.03, 0.026, (sx * 0.079, 0.0, 0.11), (0, math.pi / 2, 0))
            cyl(optic, 0.012, 0.03, (sx * 0.082, 0.0, 0.11), (0, math.pi / 2, 0))
    else:  # mask
        # blank sculpted faceplate on a dark skull, glowing trim lines down the cheeks
        sphere(dark, 0.1, (0, 0.012, 0.115), (0.9, 1.0, 1.05))
        sphere(plate, 0.098, (0, -0.012, 0.105), (0.82, 0.75, 1.0))
        box(dark, (0.1, 0.03, 0.012), (0, -0.088, 0.122), bevel=0.005)
        for sx in (-1, 1):
            box(optic, (0.004, 0.006, 0.06), (sx * 0.045, -0.083, 0.08), bevel=0)
    cyl(dark, 0.04, 0.07, (0, 0.012, -0.01), (0, 0, 0), verts=16)  # neck actuator
    for o in parts:
        g = o.vertex_groups.new(name=HEAD); g.add(range(len(o.data.vertices)), 1.0, "REPLACE")
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
    # the emptied body keeps its material slots; drop them so only the robot materials remain
    mesh.data.materials.clear()
    bpy.ops.object.join()


if robot:
    robot_parts()
else:
    human_head()
mesh.name = "FaceHead"; mesh.data.name = "FaceHead"
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True); mesh.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_animations=False, export_skins=True,
                          export_image_format="JPEG", export_jpeg_quality=88, export_yup=True)
print("wrote", out, len(mesh.data.vertices), "verts")

# portrait thumbnail (bind pose, three-quarter front)
for b in arm.pose.bones:
    b.location = (0, 0, 0); b.rotation_quaternion = (1, 0, 0, 0); b.scale = (1, 1, 1)
bpy.context.view_layer.update()
c = arm.matrix_world @ arm.data.bones[HEAD].head_local + Vector((0, 0, 0.1))
sc = bpy.context.scene
bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam; cam.data.lens = 85
cam.location = c + Vector((-0.2, -0.78, 0.02))
bpy.ops.object.empty_add(location=c); t = cam.constraints.new("TRACK_TO"); t.target = bpy.context.object
bpy.ops.object.light_add(type="AREA", location=c + Vector((-0.8, -1.2, 0.6))); l = bpy.context.object; l.data.energy = 110; l.data.size = 1.5
l.rotation_euler = (1.0, 0, -0.6)
bpy.ops.object.light_add(type="AREA", location=c + Vector((0.9, 0.6, 0.3))); l = bpy.context.object; l.data.energy = 70; l.data.size = 1
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.07, 0.09, 1)
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 24
sc.render.film_transparent = False
sc.render.resolution_x = sc.render.resolution_y = 256
sc.render.image_settings.file_format = "JPEG"; sc.render.image_settings.quality = 86
sc.render.filepath = out[:-4] + ".jpg"
bpy.ops.render.render(write_still=True)
