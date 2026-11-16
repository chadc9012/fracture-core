"""Put a Meshy character's textures onto its Meshy rig (Blender, background).

Meshy's auto-rig works on a remeshed copy of the character and hands it back untextured (a fresh UV layout, no images).
This bakes the textured original (high) onto the rigged copy (low): base colour, tangent normal, roughness and metallic,
at 2048 px, then writes the rigged copy with its animations and the new PBR material as one GLB.

  blender -b -P tools/meshy_bake_rig.py -- HIGH.glb RIG.glb OUT.glb [SIZE]
  (or BAKE_ARGS="HIGH.glb RIG.glb OUT.glb SIZE" when the blender wrapper drops the arguments)

The rig is baked in its rest pose; the high model is scaled and moved onto the rig's bounds first (Meshy rigs at 1.7 m by
default while the original keeps its own height).
"""
import bpy, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else os.environ["BAKE_ARGS"].split()
HIGH, RIG, OUT = argv[0], argv[1], argv[2]
SIZE = int(argv[3]) if len(argv) > 3 else 2048
TMP = os.path.dirname(os.path.abspath(OUT))

bpy.ops.wm.read_factory_settings(use_empty=True)


def meshes(objs):
    return [o for o in objs if o.type == "MESH"]


def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


# the rig, in rest pose
bpy.ops.import_scene.gltf(filepath=RIG)
rig_objs = list(bpy.context.selected_objects)
arm = [o for o in rig_objs if o.type == "ARMATURE"][0]
actions = [a for a in bpy.data.actions]
arm.animation_data_create()
arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location = (0, 0, 0)
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.scale = (1, 1, 1)
bpy.context.view_layer.update()
low = meshes(rig_objs)[0]

# the textured original, fitted onto the rig's rest bounds
bpy.ops.import_scene.gltf(filepath=HIGH)
high_objs = [o for o in bpy.context.selected_objects]
highs = meshes(high_objs)
src_mat = highs[0].active_material
llo, lhi = bounds([low])
hlo, hhi = bounds(highs)
s = (lhi.z - llo.z) / max(1e-6, (hhi.z - hlo.z))
roots = [o for o in high_objs if o.parent is None]
for r in roots:
    r.scale = r.scale * s
bpy.context.view_layer.update()
hlo, hhi = bounds(highs)
d = Vector(((llo.x + lhi.x - hlo.x - hhi.x) / 2, (llo.y + lhi.y - hlo.y - hhi.y) / 2, llo.z - hlo.z))
for r in roots:
    r.location = r.location + d
bpy.context.view_layer.update()
print("fit scale %.4f offset %s" % (s, tuple(round(v, 3) for v in d)))

# bake targets
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 4
bake = scene.render.bake
bake.use_selected_to_active = True
bake.use_cage = False
bake.cage_extrusion = 0.03
bake.max_ray_distance = 0.08
bake.margin = 8

mat = bpy.data.materials.new("Body")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes.get("Principled BSDF")
low.data.materials.clear()
low.data.materials.append(mat)


def image(name, color):
    img = bpy.data.images.new(name, SIZE, SIZE, alpha=False, float_buffer=False)
    if not color:
        img.colorspace_settings.name = "Non-Color"
    return img


def bake_pass(kind, img, **kw):
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    nt.nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    for h in highs:
        h.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.ops.object.bake(type=kind, **kw)
    return node


col = image("basecolor", True)
n_col = bake_pass("DIFFUSE", col, pass_filter={"COLOR"})
nor = image("normal", False)
n_nor = bake_pass("NORMAL", nor, normal_space="TANGENT")
rough = image("roughness", False)
n_rough = bake_pass("ROUGHNESS", rough)

# metallic: route the original's metallic into its emission for one EMIT bake
metal = image("metallic", False)
for h in highs:
    for m in h.data.materials:
        if not m or not m.use_nodes:
            continue
        p = m.node_tree.nodes.get("Principled BSDF")
        if not p:
            continue
        mi = p.inputs["Metallic"]
        if mi.is_linked:
            m.node_tree.links.new(mi.links[0].from_socket, p.inputs["Emission Color"])
        else:
            v = mi.default_value
            p.inputs["Emission Color"].default_value = (v, v, v, 1)
        p.inputs["Emission Strength"].default_value = 1.0
n_metal = bake_pass("EMIT", metal)

# wire the baked maps into the rig's material
links = nt.links
links.new(n_col.outputs["Color"], bsdf.inputs["Base Color"])
nm = nt.nodes.new("ShaderNodeNormalMap")
links.new(n_nor.outputs["Color"], nm.inputs["Color"])
links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
links.new(n_rough.outputs["Color"], bsdf.inputs["Roughness"])
links.new(n_metal.outputs["Color"], bsdf.inputs["Metallic"])
for img in (col, nor, rough, metal):
    img.filepath_raw = os.path.join(TMP, "_bake_%s.png" % img.name)
    img.file_format = "PNG"
    img.save()
    img.pack()

# the game's clip names (operator_player.gd / mission player.gd play idle / walk / run / combat; stand_idle.gd rebuilds
# "idle" from the rest pose, so any clip will do as its seed)
NAMES = {"walking": "walk", "running": "run", "combat_stance": "combat", "idle": "idle"}
for a in list(bpy.data.actions):
    k = a.name.lower().split("|")[-1]
    if k in NAMES:
        a.name = NAMES[k]
        a.use_fake_user = True
if not bpy.data.actions.get("idle"):
    seed = bpy.data.actions.get("combat") or bpy.data.actions.get("walk")
    if seed:
        c = seed.copy()
        c.name = "idle"
        c.use_fake_user = True
actions = list(bpy.data.actions)

# drop the original and write the rig with its clips
for o in high_objs:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action="DESELECT")
for o in rig_objs:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_animations=True,
                          export_animation_mode="ACTIONS", export_image_format="JPEG", export_jpeg_quality=92,
                          export_skins=True, export_yup=True)
print("wrote", OUT, "actions", [a.name for a in actions])
