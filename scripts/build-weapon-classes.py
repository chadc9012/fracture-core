"""
Weapon-class models kitbashed from the authored rifle (offline tool; Blender bpy). weapon-classes.ts makes an equipped SMG,
sniper or fusion rifle fire as its class in the Auto Rifle's slot; these give each its own silhouette. They are built from
public/models/weapons/rifle.glb (the Meshy rifle, textured) so they keep its detail and materials, and they keep the rifle's
node contract (RifleBody, RifleMag with its origin at the reload pivot, optional RifleAccent) so the viewmodel rig, the reload
animation and the third-person hold work unchanged.

The rifle runs along -Z (muzzle at -0.685 m, stock end at +0.38 m) with the firing-hand grip at the origin. Each class remaps
the body's vertices along the barrel axis by region (front of the receiver, stock) and reshapes parts:
  smg     front x0.55, stock x0.6, magazine shortened: a compact close-quarters gun
  sniper  front x1.8, stock x1.12, the optic stretched into a long scope: a long-range rifle
  fusion  front x1.15 with three glowing coil rings on the barrel (RifleAccent, recoloured per operator)

usage: blender -b -P scripts/build-weapon-classes.py -- public/models/weapons [smg|sniper|fusion ...]
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_dir = argv[0] if argv else "public/models/weapons"
which = argv[1:] or ["smg", "sniper", "fusion"]
SRC = f"{out_dir}/rifle.glb"

# regions along the barrel, in glTF metres (Blender imports glTF -Z forward as +Y, so glTF z = -Blender y)
FRONT_START = -0.22   # receiver's front face: everything muzzle-ward of this is handguard / barrel
STOCK_START = 0.12    # everything behind this is the stock
OPTIC_FLOOR = 0.205   # the red-dot optic stands above the top rail


def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    body = bpy.data.objects["RifleBody"]
    mag = bpy.data.objects.get("RifleMag")
    return body, mag


def remap_axis(obj, f):
    """move each vertex's glTF z (Blender: -y in the object's frame) through f"""
    for v in obj.data.vertices:
        z = -v.co.y
        v.co.y = -f(z, v.co)
    obj.data.update()


def piecewise(front, stock):
    def f(z, co):
        if co.z > OPTIC_FLOOR and z > FRONT_START - 0.05:
            return z  # the optic straddles the receiver's front face: keep it whole (stretch_optic reshapes it on its own)
        if z < FRONT_START:
            return FRONT_START + (z - FRONT_START) * front
        if z > STOCK_START:
            return STOCK_START + (z - STOCK_START) * stock
        return z
    return f


def stretch_optic(obj, length, girth):
    """the red-dot optic sits on top of the receiver: stretch it along the barrel and fatten it into a scope"""
    # only the optic itself: above the top rail (which runs the whole gun at ~0.17-0.19 m and must not be stretched) and over
    # the receiver
    top = [v for v in obj.data.vertices if v.co.z > OPTIC_FLOOR and FRONT_START - 0.05 < -v.co.y < STOCK_START]
    if not top:
        return
    cz = sum(-v.co.y for v in top) / len(top)
    cy = sum(v.co.z for v in top) / len(top)
    cx = sum(v.co.x for v in top) / len(top)
    for v in top:
        z = -v.co.y
        v.co.y = -(cz + (z - cz) * length)
        v.co.z = cy + (v.co.z - cy) * girth
        v.co.x = cx + (v.co.x - cx) * girth
    obj.data.update()


def scope_tube(body, z0, z1, height, r):
    """a scope on the optic mount: a tube with flared objective and eyepiece bells, in the rifle's own (worn metal) material,
    joined into RifleBody. glTF z0 < z1 (z0 toward the muzzle), height above the grip (glTF y)"""
    mat = body.data.materials[0]
    xs = [v.co.x for v in body.data.vertices if v.co.z > OPTIC_FLOOR]
    cx = sum(xs) / len(xs)
    parts = []
    L = z1 - z0
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=L * 0.7, location=(cx, -(z0 + z1) / 2, height), rotation=(math.pi / 2, 0, 0))
    parts.append(bpy.context.object)
    for zc, rr in ((z0 + L * 0.1, r * 1.55), (z1 - L * 0.08, r * 1.3)):  # objective bell (front, wider), eyepiece (rear)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=rr, depth=L * 0.18, location=(cx, -zc, height), rotation=(math.pi / 2, 0, 0))
        parts.append(bpy.context.object)
    for zc in (z0 + L * 0.35, z1 - L * 0.35):  # two mount rings down to the rail
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, -zc, height - r * 1.2))
        c = bpy.context.object; c.scale = (r * 1.4, 0.018, r * 1.6)
        parts.append(c)
    for o in parts:
        o.data.materials.clear(); o.data.materials.append(mat)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
        bpy.ops.object.mode_set(mode="OBJECT")
        # sample a small, plain patch of the atlas (the receiver's dark metal) instead of the whole texture
        for loop in o.data.uv_layers.active.data:
            loop.uv = (0.645 + loop.uv[0] * 0.05, 0.442 + loop.uv[1] * 0.05)
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()


def shorten_mag(mag, k):
    """scale the magazine down toward its top (the mag well), keeping the pivot"""
    if not mag:
        return
    for v in mag.data.vertices:
        v.co.z = v.co.z * k  # the mag hangs below its origin (Blender z = glTF y, negative)
    mag.data.update()


def coil_rings(body, zs, radius, accent_name="RifleAccent"):
    """thin glowing rings around the barrel at glTF z positions; one RifleAccent object"""
    mat = bpy.data.materials.new(accent_name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.1, 0.6, 1.0, 1)
    bsdf.inputs["Emission Color"].default_value = (0.1, 0.6, 1.0, 1)
    bsdf.inputs["Emission Strength"].default_value = 3.0
    # barrel centre line: the median of the front-most vertices
    front = [v.co for v in body.data.vertices if -v.co.y < FRONT_START - 0.15]
    cx = sorted(c.x for c in front)[len(front) // 2]
    cy = sorted(c.z for c in front)[len(front) // 2]
    parts = []
    for z in zs:
        bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=radius * 0.16, major_segments=32, minor_segments=8,
                                         location=(cx, -z, cy), rotation=(math.pi / 2, 0, 0))
        parts.append(bpy.context.object)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ring = bpy.context.object
    ring.name = accent_name
    ring.data.materials.clear()
    ring.data.materials.append(mat)
    return ring


def export(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_image_format="JPEG", export_jpeg_quality=88, export_yup=True)


def build(kind):
    body, mag = load()
    if kind == "smg":
        remap_axis(body, piecewise(0.55, 0.6))
        shorten_mag(mag, 0.72)
    elif kind == "sniper":
        remap_axis(body, piecewise(1.8, 1.12))
        stretch_optic(body, 1.4, 1.0)
        scope_tube(body, -0.33, 0.03, 0.292, 0.027)
    elif kind == "fusion":
        remap_axis(body, piecewise(1.15, 1.0))
        tip = FRONT_START + (-0.685 - FRONT_START) * 1.15
        coil_rings(body, [tip * 0.45 + FRONT_START * 0.55, tip * 0.62 + FRONT_START * 0.38, tip * 0.8 + FRONT_START * 0.2], 0.05)
    export(f"{out_dir}/rifle-{kind}.glb")
    print("wrote", f"{out_dir}/rifle-{kind}.glb")


for k in which:
    build(k)
