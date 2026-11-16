# Bakes a Meshy tree into a leaf-card impostor for the forests (owner, Nov 16 "forestation"):
#   blender -b -P tools/tree_cards.py -- models/foliage/conifer.glb models/foliage/conifer-cards.glb 13.0
# Two orthographic side views (0 and 90 degrees) and one top view are rendered with alpha into one 2048x1024 atlas
# (side A | side B on the top row, the top view bottom-left), embedded in a GLB of three crossed vertical quads (0, 60, 120
# degrees; A, B, A) plus a horizontal crown quad is written beside it: 8 triangles a tree, alpha-masked, double
# sided, every normal straight up so a card shades like the ground instead of going black on its far side.
# region_flora.gd draws these past the near ring where the full Meshy tree stands (Flora.tree_lods).
import bpy, sys, os, math

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[-3:]
src, dst, height = args[0], args[1], float(args[2])
atlas = os.path.splitext(dst)[0] + "-atlas.png"
RES = 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
# fit: standing on y = 0 (Blender z), centred, `height` tall
lo = [min(min((o.matrix_world @ v.co)[i] for v in o.data.vertices) for o in meshes) for i in range(3)]
hi = [max(max((o.matrix_world @ v.co)[i] for v in o.data.vertices) for o in meshes) for i in range(3)]
k = height / max(hi[2] - lo[2], 1e-3)
root = bpy.data.objects.new("fit", None)
bpy.context.scene.collection.objects.link(root)
for o in list(bpy.data.objects):
    if o.parent is None and o is not root:   # the Meshy GLB nests its mesh under an empty
        o.parent = root
root.scale = (k, k, k)
root.location = (-(lo[0] + hi[0]) * 0.5 * k, -(lo[1] + hi[1]) * 0.5 * k, -lo[2] * k)
bpy.context.view_layer.update()
width = max(hi[0] - lo[0], hi[1] - lo[1]) * k
side = max(width, height) * 1.04  # the card's square covers the tree whichever way it is wider

# even light: the world alone, no sun, so the atlas carries the albedo and the forest takes the region's own light
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT" if hasattr(bpy.types, "SceneEEVEE") and "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
scene.render.film_transparent = True
scene.render.resolution_x = RES
scene.render.resolution_y = RES
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("w")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
bg.inputs[1].default_value = 1.0
scene.world = world

cam = bpy.data.cameras.new("cam")
cam.type = "ORTHO"
cam.ortho_scale = side
cam.clip_end = 1000.0
camo = bpy.data.objects.new("cam", cam)
scene.collection.objects.link(camo)
scene.camera = camo

def shoot(path, yaw, top=False):
    d = side * 3.0
    if top:
        camo.location = (0.0, 0.0, d)
        camo.rotation_euler = (0.0, 0.0, yaw)
    else:
        camo.location = (math.sin(yaw) * d, -math.cos(yaw) * d, height * 0.5)
        camo.rotation_euler = (math.pi / 2.0, 0.0, yaw)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

tmp = os.path.splitext(dst)[0]
shoot(tmp + "-a.png", 0.0)
shoot(tmp + "-b.png", math.pi / 2.0)
shoot(tmp + "-t.png", 0.0, top=True)

# the atlas: A | B over T | blank
a = bpy.data.images.load(tmp + "-a.png")
b = bpy.data.images.load(tmp + "-b.png")
t = bpy.data.images.load(tmp + "-t.png")
at = bpy.data.images.new("atlas", RES * 2, RES * 2, alpha=True)
px = [0.0] * (RES * 2 * RES * 2 * 4)
def blit(img, ox, oy):
    p = img.pixels[:]
    for y in range(RES):
        row = (y + oy) * RES * 2 * 4 + ox * 4
        srow = y * RES * 4
        px[row:row + RES * 4] = p[srow:srow + RES * 4]
blit(t, 0, 0)
blit(a, 0, RES)
blit(b, RES, RES)
at.pixels = px
at.filepath_raw = atlas
at.file_format = "PNG"
at.save()
for f in ("-a.png", "-b.png", "-t.png"):
    os.remove(tmp + f)

# the card mesh: three crossed quads and the crown top, in glTF's y-up written through Blender's z-up
bpy.ops.wm.read_factory_settings(use_empty=True)
verts, faces, uvs = [], [], []
def quad(corners, uv):
    i = len(verts)
    verts.extend(corners)
    faces.append((i, i + 1, i + 2, i + 3))
    uvs.append(uv)
hw = side * 0.5
# the vertical cards are only as wide as the tree, so a narrow pine does not drag a card of empty texels around
cw = min(side, width * 1.06) * 0.5
du = cw / side * 0.5   # half the card's u span within its half of the atlas
for n, (yaw, view) in enumerate([(0.0, "a"), (math.pi / 3.0, "b"), (2.0 * math.pi / 3.0, "a")]):
    dx, dy = math.cos(yaw) * cw, math.sin(yaw) * cw
    uc = 0.25 if view == "a" else 0.75
    quad([(-dx, -dy, 0.0), (dx, dy, 0.0), (dx, dy, side), (-dx, -dy, side)],
         [(uc - du, 0.5), (uc + du, 0.5), (uc + du, 1.0), (uc - du, 1.0)])
# the top card at two thirds up, where the crown is widest from above
tz = height * 0.62
quad([(-hw, -hw, tz), (hw, -hw, tz), (hw, hw, tz), (-hw, hw, tz)], [(0.0, 0.0), (0.5, 0.0), (0.5, 0.5), (0.0, 0.5)])
me = bpy.data.meshes.new("cards")
me.from_pydata(verts, [], faces)
uvl = me.uv_layers.new(name="UVMap")
for f, uv in zip(me.polygons, uvs):
    for li, u in zip(f.loop_indices, uv):
        uvl.data[li].uv = u
# every normal up: the cards take the sky's light evenly from any side
for p in me.polygons:
    p.use_smooth = True
me.normals_split_custom_set([(0.0, 0.0, 1.0)] * len(me.loops))
ob = bpy.data.objects.new("cards", me)
bpy.context.scene.collection.objects.link(ob)
mat = bpy.data.materials.new("cards")
mat.use_nodes = True
mat.blend_method = "CLIP"
if hasattr(mat, "alpha_threshold"):
    mat.alpha_threshold = 0.5
mat.use_backface_culling = False
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.95
tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(atlas)
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
mat.node_tree.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
ob.data.materials.append(mat)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_image_format="AUTO", export_apply=True, export_yup=True)
os.remove(atlas)   # embedded in the GLB; Godot extracts its own copy on import
print("cards", dst, "side", round(side, 2), "height", height)
