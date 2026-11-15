"""Fit a Meshy vehicle GLB for the game (owner's vehicle boards, Nov 15): one mesh, real-world length, origin on the
ground at the centre, nose towards +Z like the rest of the fleet, a triangle budget for the phone and textures at a set size.

    blender -b -P tools/fit_meshy_vehicle.py -- in.glb out.glb LENGTH_M [TRIS] [TEX] [--nose +x|-x|+z|-z] [--render out.png]

LENGTH_M is the vehicle's length along its nose axis. TRIS defaults to 60000, TEX (base-colour edge in px) to 4096.
Meshy lays vehicles along glTF X; `--nose` (+x default) says which end is the front.
`--render` also writes a 4-view check sheet (front 3/4, rear 3/4, side, close-up) for the texture check.
"""
import bpy, bmesh, sys, math, os
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
flags = {}
pos = []
i = 0
while i < len(argv):
    if argv[i].startswith("--"):
        flags[argv[i][2:]] = argv[i + 1]
        i += 2
    else:
        pos.append(argv[i])
        i += 1
src, dst, length = pos[0], pos[1], float(pos[2])
tris = int(pos[3]) if len(pos) > 3 else 60000
tex = int(pos[4]) if len(pos) > 4 else 4096

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in bpy.context.scene.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
# bake parent transforms into the mesh, drop empties
mw = ob.matrix_world.copy()
ob.parent = None
ob.matrix_world = mw
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.context.scene.objects):
    if o != ob:
        bpy.data.objects.remove(o)

def bounds():
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return mn, mx

# The fleet faces glTF +Z (Blender -Y): every fleet model and the drive / traffic code agree on that.
mn, mx = bounds()
size = mx - mn
nose = flags.get("nose", "+x")   # Meshy lays a vehicle along glTF X; which end is the nose differs per model
# rotation (about Blender Z) taking the glTF nose direction to glTF +Z (Blender -Y)
rot = {"+z": 0.0, "-z": math.pi, "+x": -math.pi / 2, "-x": math.pi / 2}[nose]
ob.data.transform(Matrix.Rotation(rot, 4, "Z"))
mn, mx = bounds()
k = length / (mx.y - mn.y)
ob.data.transform(Matrix.Scale(k, 4))
mn, mx = bounds()
c = (mn + mx) / 2
ob.data.transform(Matrix.Translation(Vector((-c.x, -c.y, -mn.z))))
ob.data.update()

# triangle budget (collapse; Meshy meshes are one welded shell, so this keeps panels whole)
n = sum(len(p.vertices) - 2 for p in ob.data.polygons)
if n > tris:
    m = ob.modifiers.new("dec", "DECIMATE")
    m.ratio = tris / n
    m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="dec")
n2 = sum(len(p.vertices) - 2 for p in ob.data.polygons)

# textures: base colour at TEX (4096 keeps paint lines and decals crisp up close), normal at half, metal/rough at a quarter
mat = ob.data.materials[0]
role = {}
for node in mat.node_tree.nodes:
    if node.type == "TEX_IMAGE" and node.image:
        for l in node.outputs["Color"].links:
            sock = l.to_socket.name.lower()
            role[node.image.name] = "base" if "base color" in sock else ("normal" if l.to_node.type == "NORMAL_MAP" else "mr")
for img in bpy.data.images:
    r = role.get(img.name, "mr")
    edge = tex if r == "base" else (tex // 2 if r == "normal" else tex // 4)
    if img.size[0] > edge:
        img.scale(edge, edge)

ob.name = os.path.splitext(os.path.basename(dst))[0]
for o in bpy.context.scene.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=True, export_image_format="AUTO",
                          export_jpeg_quality=95, export_apply=True)
mn, mx = bounds()
print("FIT", os.path.basename(dst), "tris", n, "->", n2, "size", [round(v, 2) for v in (mx - mn)], "nose", nose)

if "render" in flags:
    scn = bpy.context.scene
    scn.render.engine = "BLENDER_WORKBENCH"   # quick: flat-lit texture colour, enough to judge texture sharpness
    scn.display.shading.light = "STUDIO"
    scn.display.shading.color_type = "TEXTURE"
    scn.render.resolution_x, scn.render.resolution_y = 960, 640
    w = bpy.data.worlds.new("w"); scn.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.57, 0.6, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 1.2
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(30)); scn.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scn.collection.objects.link(cam); scn.camera = cam
    L = mx.y - mn.y; H = mx.z - mn.z
    shots = [((L * 0.9, -L * 0.9, H * 1.2), 40), ((-L * 0.9, L * 0.9, H * 1.2), 40), ((L * 1.4, 0, H * 0.6), 40), ((L * 0.35, -L * 0.45, H * 0.9), 40)]
    base = flags["render"][:-4]
    outs = []
    for si, (p, fov) in enumerate(shots):
        cam.location = Vector(p)
        tgt = Vector((0, -L * 0.25 if si == 3 else 0, H * 0.45))
        cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.angle = math.radians(fov)
        scn.render.filepath = f"{base}_{si}.png"
        bpy.ops.render.render(write_still=True)
        outs.append(scn.render.filepath)
    print("RENDERS", " ".join(outs))
