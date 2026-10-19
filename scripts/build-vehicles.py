"""
Builds public/models/vehicles/interceptor.glb (the Scrap-Built Interceptor body) and wheel-offroad.glb.

    pip install bpy && python3 scripts/build-vehicles.py [outdir]

Frame matches Vehicle.tsx <Car>: car units (scaled by the fleet's modelScale), front toward +Z (three.js), up +Y,
ground at y = -0.3, wheels supplied separately at (+-0.62, 0, +-0.9) with radius 0.3, so the body leaves the wheel
arches open. Materials: InterceptorPaint (worn primer-orange paint with rust, clear-coat sheen), Glass (dark
reflective), Chrome, Rubber, Steel, Headlight (emissive), Taillight (emissive).
"""
import math
import os
import random
import sys
import tempfile

import bpy
import numpy as np
from mathutils import Vector
from PIL import Image

OUTDIR = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith(".py") else os.path.join(os.path.dirname(__file__), "..", "public", "models", "vehicles")
os.makedirs(OUTDIR, exist_ok=True)
TMP = tempfile.mkdtemp(prefix="wf-veh-")


def three(x, y, z):
    return Vector((x, -z, y))


def noise(h, w, octaves, seed, base=4):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w)); amp = 1.0
    for o in range(octaves):
        g = rng.random((base * 2 ** o + 1, base * 2 ** o + 1))
        out += np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), dtype=np.float64) / 255 * amp
        amp *= 0.5
    return (out - out.min()) / (out.max() - out.min())


# ------------------------------------------------------------ paint texture: primer orange, sun-faded, rust blooms
S = 1024
n1, n2, n3 = noise(S, S, 6, 1, 6), noise(S, S, 7, 2, 14), noise(S, S, 5, 3, 3)
paint = np.array([0.24, 0.07, 0.022])[None, None, :] * (0.85 + 0.3 * n3[..., None])
rust_mask = np.clip((n1 * 0.7 + n2 * 0.3 - 0.58) * 6, 0, 1)
rust = np.array([0.16, 0.06, 0.025])[None, None, :] * (0.6 + 0.8 * n2[..., None])
bare = (np.clip((n2 - 0.8) * 8, 0, 1) * (1 - rust_mask))[..., None]
col = paint * (1 - rust_mask[..., None]) + rust * rust_mask[..., None]
col = col * (1 - bare) + np.array([0.35, 0.34, 0.32]) * bare
Image.fromarray((np.clip(col, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)).save(f"{TMP}/paint_col.png")
rough = 0.35 + 0.5 * rust_mask + 0.1 * n2
Image.fromarray((np.dstack([np.ones_like(rough), rough, bare[..., 0] * 0.9]) * 255).astype(np.uint8)).save(f"{TMP}/paint_orm.png")
hgt = rust_mask * 0.6 + n2 * 0.4
gy, gx = np.gradient(hgt * 2.5)
nrm = np.dstack([-gx, -gy, np.ones_like(hgt)]); nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
Image.fromarray(((nrm * 0.5 + 0.5) * 255).astype(np.uint8)).save(f"{TMP}/paint_nrm.png")


def tex(path, noncolor=False):
    img = bpy.data.images.load(path)
    if noncolor:
        img.colorspace_settings.name = "Non-Color"
    img.pack()
    return img


def plain(name, color, metal, rough, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = strength
    return m


def paint_material():
    m = bpy.data.materials.new("InterceptorPaint"); m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tc = nt.nodes.new("ShaderNodeTexImage"); tc.image = tex(f"{TMP}/paint_col.png")
    nt.links.new(tc.outputs["Color"], b.inputs["Base Color"])
    to = nt.nodes.new("ShaderNodeTexImage"); to.image = tex(f"{TMP}/paint_orm.png", True)
    sep = nt.nodes.new("ShaderNodeSeparateColor"); nt.links.new(to.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], b.inputs["Roughness"]); nt.links.new(sep.outputs["Blue"], b.inputs["Metallic"])
    tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = tex(f"{TMP}/paint_nrm.png", True)
    nm = nt.nodes.new("ShaderNodeNormalMap"); nt.links.new(tn.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    # clear-coat sheen survives as KHR_materials_clearcoat
    b.inputs["Coat Weight"].default_value = 0.35
    b.inputs["Coat Roughness"].default_value = 0.25
    return m


def finish(o, bevel, segments=2, angle=35):
    bpy.context.view_layer.objects.active = o
    if bevel > 0:
        m = o.modifiers.new("b", "BEVEL"); m.width = bevel; m.segments = segments; m.limit_method = "ANGLE"; m.angle_limit = math.radians(angle); m.harden_normals = True
        bpy.ops.object.modifier_apply(modifier=m.name)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def box(size, at, mat, bevel=0.02, rot=(0, 0, 0), taper_top=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=three(*at))
    o = bpy.context.active_object
    o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(scale=True)
    if taper_top:  # pull the top face in (x, z) for sloped cab glass / hood
        for v in o.data.vertices:
            if v.co.z > 0:
                v.co.x *= taper_top[0]
                v.co.y = v.co.y * taper_top[1] + taper_top[2]
    o.rotation_euler = (-rot[0], rot[2], rot[1])
    bpy.ops.object.transform_apply(rotation=True)
    o.data.materials.append(mat)
    return finish(o, bevel)


def cyl(r, length, at, mat, axis="z", verts=20, bevel=0.005, r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r if r2 is None else r2, depth=length, location=three(*at))
    o = bpy.context.active_object
    o.rotation_euler = (math.radians(-90), 0, 0) if axis == "z" else (0, math.radians(90), 0) if axis == "x" else (0, 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    o.data.materials.append(mat)
    return finish(o, bevel, 1, 60)


def cut(target, cutter):
    m = target.modifiers.new("cut", "BOOLEAN"); m.object = cutter; m.operation = "DIFFERENCE"; m.solver = "EXACT"
    bpy.context.view_layer.objects.active = target; bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object; o.name = name
    bpy.context.scene.cursor.location = (0, 0, 0); bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return o


def uv_box(o, size):
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.cube_project(cube_size=size); bpy.ops.object.mode_set(mode="OBJECT")


def export(name):
    path = os.path.abspath(os.path.join(OUTDIR, name))
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_apply=True, export_image_format="JPEG",
                              export_jpeg_quality=86, export_materials="EXPORT", use_selection=False)
    tris = 0
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
    print(name, "tris", tris, "bytes", os.path.getsize(path))


# ============================================================ body
bpy.ops.wm.read_factory_settings(use_empty=True)
PAINT = paint_material()
GLASS = plain("Glass", (0.01, 0.012, 0.015), 0.0, 0.04)
CHROME = plain("Chrome", (0.75, 0.75, 0.75), 1.0, 0.12)
STEEL = plain("Steel", (0.06, 0.06, 0.065), 0.85, 0.5)
RUBBER = plain("Rubber", (0.02, 0.02, 0.02), 0.0, 0.85)
HEAD = plain("Headlight", (1.0, 0.95, 0.85), 0.0, 0.2, (1.0, 0.92, 0.75), 6.0)
TAIL = plain("Taillight", (0.6, 0.02, 0.02), 0.0, 0.3, (1.0, 0.05, 0.03), 4.0)

paint_parts, other = [], []
# lower tub: long, low, open wheel arches
tub = box((1.06, 0.34, 2.56), (0, 0.27, 0), PAINT, bevel=0.04)
for sx in (-1, 1):
    for sz in (-1, 1):
        arch = cyl(0.36, 0.5, (sx * 0.62, 0.0, sz * 0.9), PAINT, axis="x", verts=24, bevel=0)
        cut(tub, arch)
paint_parts.append(tub)
# long hood with a raised power bulge, short deck at the back
paint_parts.append(box((0.98, 0.1, 1.05), (0, 0.49, 0.68), PAINT, bevel=0.03))
paint_parts.append(box((0.42, 0.08, 0.8), (0, 0.56, 0.62), PAINT, bevel=0.025))
paint_parts.append(box((0.98, 0.1, 0.6), (0, 0.49, -0.95), PAINT, bevel=0.03))
# flared, arched fenders over each wheel: a thick half-ring shell
for sx in (-1, 1):
    for sz in (-1, 1):
        outer = cyl(0.42, 0.26, (sx * 0.6, 0.0, sz * 0.9), PAINT, axis="x", verts=28, bevel=0)
        inner = cyl(0.36, 0.4, (sx * 0.6, 0.0, sz * 0.9), PAINT, axis="x", verts=28, bevel=0)
        cut(outer, inner)
        lower = box((0.6, 1.0, 1.1), (sx * 0.6, -0.37, sz * 0.9), PAINT, bevel=0)
        cut(outer, lower)
        paint_parts.append(finish(outer, 0.01))
# cab: a raked glass greenhouse under a chopped painted roof, with painted pillars
other.append(box((0.88, 0.26, 1.0), (0, 0.67, -0.18), GLASS, bevel=0.015, taper_top=(0.86, 0.66, -0.06)))
paint_parts.append(box((0.78, 0.05, 0.64), (0, 0.825, -0.26), PAINT, bevel=0.02))
# armour: bolted plates on the doors, slatted window guards
for sx in (-1, 1):
    other.append(box((0.03, 0.2, 0.7), (sx * 0.545, 0.3, -0.12), STEEL, bevel=0.01))
    for i in range(4):
        other.append(cyl(0.012, 0.012, (sx * 0.565, 0.38 - (i % 2) * 0.16, -0.38 + (i // 2) * 0.52), CHROME, axis="x", verts=8, bevel=0))
for i in range(4):
    other.append(box((0.8, 0.012, 0.02), (0, 0.66 + i * 0.035, 0.26 - i * 0.03), STEEL, bevel=0.003, rot=(0.75, 0, 0)))
# roll cage over the roof, roof lamp bar
for sx in (-1, 1):
    other.append(cyl(0.022, 0.95, (sx * 0.36, 0.88, -0.18), STEEL, axis="z", verts=10))
for z in (0.2, -0.6):
    other.append(cyl(0.022, 0.74, (0, 0.88, z), STEEL, axis="x", verts=10))
for sx in (-0.24, -0.08, 0.08, 0.24):
    other.append(box((0.1, 0.06, 0.05), (sx, 0.92, 0.18), STEEL, bevel=0.01))
    other.append(box((0.08, 0.045, 0.01), (sx, 0.92, 0.207), HEAD, bevel=0.003))
# front: steel ram bumper with teeth, grille, headlights
other.append(box((1.12, 0.16, 0.1), (0, 0.18, 1.33), STEEL, bevel=0.02))
for i in range(5):
    other.append(cyl(0.035, 0.16, (-0.4 + i * 0.2, 0.18, 1.43), STEEL, axis="z", verts=8, r2=0.0, bevel=0))
other.append(box((0.6, 0.14, 0.03), (0, 0.38, 1.29), STEEL, bevel=0.01))
for i in range(6):
    other.append(box((0.56, 0.01, 0.02), (0, 0.33 + i * 0.022, 1.305), CHROME, bevel=0.002))
for sx in (-1, 1):
    other.append(cyl(0.06, 0.04, (sx * 0.38, 0.4, 1.29), CHROME, axis="z", verts=16))
    other.append(cyl(0.048, 0.02, (sx * 0.38, 0.4, 1.31), HEAD, axis="z", verts=16))
# rear: tail lights, steel bumper, twin exhausts and a spare wheel strapped on the deck
other.append(box((1.08, 0.14, 0.08), (0, 0.18, -1.32), STEEL, bevel=0.02))
for sx in (-1, 1):
    other.append(box((0.22, 0.06, 0.02), (sx * 0.34, 0.42, -1.29), TAIL, bevel=0.005))
    other.append(cyl(0.04, 0.3, (sx * 0.3, 0.1, -1.3), CHROME, axis="z", verts=12))
spare = cyl(0.22, 0.14, (0, 0.62, -0.95), RUBBER, axis="y", verts=20)
other.append(spare)
# side pipes and mirrors
for sx in (-1, 1):
    other.append(cyl(0.035, 1.0, (sx * 0.57, 0.12, 0.0), CHROME, axis="z", verts=12))
    other.append(box((0.08, 0.05, 0.03), (sx * 0.52, 0.66, 0.2), STEEL, bevel=0.01))

for p in paint_parts:
    uv_box(p, 1.2)
body = join(paint_parts + other, "InterceptorBody")
export("interceptor.glb")

# ============================================================ off-road wheel: radius 0.3, width 0.4, axle along X
bpy.ops.wm.read_factory_settings(use_empty=True)
RUBBER = plain("Rubber", (0.025, 0.025, 0.025), 0.0, 0.9)
RIM = plain("Rim", (0.08, 0.08, 0.085), 0.8, 0.4)
HUB = plain("Hub", (0.6, 0.6, 0.6), 1.0, 0.2)
parts = [cyl(0.255, 0.36, (0, 0, 0), RUBBER, axis="x", verts=32, bevel=0.03)]
# chunky tread blocks around the circumference, alternating offset
for i in range(24):
    a = i / 24 * math.tau
    off = 0.08 if i % 2 else -0.08
    # built in Blender axes: thin along the radius, rotated about the axle (Blender X) so it lies flat on the tyre
    bpy.ops.mesh.primitive_cube_add(size=1, location=(off, -math.sin(a) * 0.275, math.cos(a) * 0.275))
    blk = bpy.context.active_object
    blk.scale = (0.15, 0.07, 0.05)
    blk.rotation_euler = (a, 0, 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    blk.data.materials.append(RUBBER)
    parts.append(finish(blk, 0.01))
# beadlock rim with bolts, both faces
for sx in (-1, 1):
    parts.append(cyl(0.17, 0.03, (sx * 0.17, 0, 0), RIM, axis="x", verts=24, bevel=0.008))
    parts.append(cyl(0.06, 0.04, (sx * 0.185, 0, 0), HUB, axis="x", verts=16, bevel=0.004))
    for i in range(8):
        a = i / 8 * math.tau
        parts.append(cyl(0.012, 0.03, (sx * 0.19, math.cos(a) * 0.13, math.sin(a) * 0.13), HUB, axis="x", verts=6, bevel=0))
join(parts, "WheelOffroad")
export("wheel-offroad.glb")
