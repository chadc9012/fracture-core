"""
Baked ambient occlusion for the authored fleet (offline tool; Blender bpy). The fleet models (scripts/build-fleet.py) are
built from flat-coloured parts with no textures, so in game every crease, wheel arch, grille and panel gap was lit as brightly as
the open panels around it: the "1998 graphics" look the owner called out (Nov 2026). This bakes a soft occlusion pass for the
whole model into one small texture on a second UV layout and wires it in as the glTF occlusion texture, so three.js darkens the
creases (aoMap) and the runtime surface shader (vehicle-surface.ts) also uses it to gather dust in them.

The node tree (names the game drives: wheels, pivots, rotors, lamps, kit) is left exactly as it was; only a UV layer, an
occlusion texture and a glTF output node are added.

    blender -b -P scripts/bake-fleet-ao.py -- IN.glb OUT.glb [size=1024] [distance=0.6] [bevel-m=0.012, 0 = none]
"""
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
src, out = argv[0], argv[1]
size = int(argv[2]) if len(argv) > 2 else 1024
dist = float(argv[3]) if len(argv) > 3 else 0.6
AO_UV = "AO"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and len(o.data.polygons)]
print("meshes", len(meshes))

# soften the hard box edges first: a narrow bevel on sharp edges and smooth shading by angle, so edges catch a highlight
# instead of the knife-edged look of untreated low-poly parts (lamps and glass included: they read as moulded parts too)
BEVEL = float(argv[4]) if len(argv) > 4 else 0.012
if BEVEL > 0:
    for o in meshes:
        if o.data.users > 1:
            o.data = o.data.copy()
        dims = max(o.dimensions) if max(o.dimensions) > 0 else 1.0
        md = o.modifiers.new("soft", "BEVEL")
        md.width = min(BEVEL, dims * 0.04); md.segments = 2; md.limit_method = "ANGLE"; md.angle_limit = 0.6
        md.use_clamp_overlap = True; md.harden_normals = False
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.select_all(action="DESELECT"); o.select_set(True)
        bpy.ops.object.modifier_apply(modifier=md.name)
        bpy.ops.object.shade_smooth_by_angle(angle=0.62)
    print("bevelled", len(meshes))

# one shared second UV layout for the whole model
for o in meshes:
    if o.data.users > 1:  # instanced data (wheels) gets its own copy so its UVs can differ per placement
        o.data = o.data.copy()
    if AO_UV not in o.data.uv_layers:
        o.data.uv_layers.new(name=AO_UV)
    o.data.uv_layers.active = o.data.uv_layers[AO_UV]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.006, scale_to_bounds=False)
bpy.ops.uv.pack_islands(margin=0.006)
bpy.ops.object.mode_set(mode="OBJECT")

img = bpy.data.images.new("fleet_ao", size, size, alpha=False)
img.colorspace_settings.name = "Non-Color"
mats = {m for o in meshes for m in o.data.materials if m}
for o in meshes:
    if not o.data.materials:
        m = bpy.data.materials.new("Plain"); m.use_nodes = True; o.data.materials.append(m); mats.add(m)
for m in mats:
    m.use_nodes = True
    nt = m.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.name = "AOBake"; tex.image = img
    uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = AO_UV; nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
    for n in nt.nodes:
        n.select = False
    tex.select = True; nt.nodes.active = tex

sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 48
w = bpy.data.worlds.new("w"); sc.world = w
w.light_settings.distance = dist
sc.render.bake.margin = 6
bpy.ops.object.bake(type="AO", uv_layer=AO_UV)
img.pack()
print("baked ao", size)

# glTF occlusion: a "glTF Material Output" group with an Occlusion input, fed from the baked image's red channel
grp = bpy.data.node_groups.get("glTF Material Output")
if grp is None:
    grp = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
    grp.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
for m in mats:
    nt = m.node_tree
    tex = nt.nodes["AOBake"]
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(tex.outputs["Color"], sep.inputs["Color"])
    g = nt.nodes.new("ShaderNodeGroup"); g.node_tree = grp
    nt.links.new(sep.outputs["Red"], g.inputs["Occlusion"])

bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=86, export_yup=True,
                          export_animations=True, export_extras=True)
print("wrote", out)
