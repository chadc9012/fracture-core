"""
Builds public/models/props/crate.glb and cover-wall.glb with painted textures generated here.

    pip install bpy && python3 scripts/build-props.py [outdir]

crate.glb       - "PropCrate": military supply crate, unit size (-0.5..0.5 on every axis) so the crash-site
                  instancing can keep scaling it to each crate's w/h/d.
cover-wall.glb  - "PropCoverWall": fortified concrete cover slab, 4.5 x 3 x 1.3 m, centred like the box it replaces,
                  with chipped edges, exposed rebar and a worn hazard band.
"""
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Vector
from PIL import Image, ImageDraw

OUTDIR = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith(".py") else os.path.join(os.path.dirname(__file__), "..", "public", "models", "props")
os.makedirs(OUTDIR, exist_ok=True)
import tempfile
TMP = tempfile.mkdtemp(prefix="wf-tex-")
os.makedirs(TMP, exist_ok=True)


def noise(h, w, octaves, seed, base=4):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w)); amp = 1.0
    for o in range(octaves):
        g = rng.random((base * 2 ** o + 1, base * 2 ** o + 1))
        out += np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), dtype=np.float64) / 255 * amp
        amp *= 0.5
    return (out - out.min()) / (out.max() - out.min())


def save_rgb(arr, path):
    Image.fromarray((np.clip(arr, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)).save(path)


def save_normal(height, path, k=4):
    gy, gx = np.gradient(height * k)
    n = np.dstack([-gx, -gy, np.ones_like(height)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(path)


# ---------------------------------------------------------------- textures
S = 1024
# concrete: aggregate speckle, water stains running down, grime at the base, a worn yellow/black hazard band
agg = noise(S, S, 7, 1, base=16)
stain = noise(S // 8, S, 4, 2, base=8)
stain = np.asarray(Image.fromarray((stain * 255).astype(np.uint8)).resize((S, S), Image.BICUBIC), dtype=np.float64) / 255
yy = np.linspace(0, 1, S)[:, None]
conc = 0.20 + 0.09 * agg - 0.10 * np.clip(stain - 0.55, 0, 1) * 3 - 0.10 * np.clip(yy - 0.75, 0, 1) * 4
conc_rgb = np.dstack([conc * 0.98, conc * 0.97, conc * 0.93])
band = (yy > 0.62) & (yy < 0.72)
xs = np.arange(S)[None, :]
stripe = (((xs + (yy * S).astype(int)) // 48) % 2 == 0)
wear = noise(S, S, 5, 3, base=12) > 0.42
hz = np.where(stripe, 1, 0)
yellow = np.array([0.55, 0.40, 0.04]); black = np.array([0.03, 0.03, 0.03])
paint = np.where(hz[..., None] == 1, yellow, black)
mask = (band & wear)[..., None]
conc_rgb = np.where(mask, paint * (0.75 + 0.25 * agg[..., None]), conc_rgb)
save_rgb(conc_rgb, f"{TMP}/concrete_col.png")
save_normal(agg * 0.6 + noise(S, S, 3, 4, base=6) * 0.4, f"{TMP}/concrete_nrm.png", 3)

# crate: olive drab painted steel, chipped to bare metal on edges, stencilled ID and arrows
olive = np.array([0.11, 0.13, 0.07])
grain = noise(S, S, 6, 5, base=10)
chip = noise(S, S, 6, 6, base=20)
uv = np.linspace(0, 1, S)
edge = np.minimum(np.minimum(uv[None, :], 1 - uv[None, :]), np.minimum(uv[:, None], 1 - uv[:, None]))
edge_wear = (edge < 0.06) & (chip > 0.55)
crate = olive[None, None, :] * (0.8 + 0.4 * grain[..., None])
crate = np.where(edge_wear[..., None], np.array([0.32, 0.31, 0.29]) * (0.7 + 0.3 * grain[..., None]), crate)
img = Image.fromarray((np.clip(crate, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8))
d = ImageDraw.Draw(img)
# direction-free markings (box projection mirrors some faces, so no lettering): a stencilled chevron and ID bars
paint = (190, 182, 150)
d.polygon([(S * 0.30, S * 0.36), (S * 0.50, S * 0.24), (S * 0.70, S * 0.36), (S * 0.70, S * 0.44), (S * 0.50, S * 0.32), (S * 0.30, S * 0.44)], fill=paint)
for i, w in enumerate((0.40, 0.10, 0.22, 0.10, 0.30)):
    x0 = S * 0.18 + sum((0.40, 0.10, 0.22, 0.10, 0.30)[:i]) * S * 0.62 + i * 10
    d.rectangle([x0, S * 0.62, x0 + w * S * 0.62, S * 0.68], fill=paint)
for i in range(2):  # reinforcing frame lines
    o = 60 + i * 12
    d.rectangle([o, o, S - o, S - o], outline=(28, 32, 20))
img.save(f"{TMP}/crate_col.png")
save_normal(grain * 0.5 + (edge < 0.05) * 0.6, f"{TMP}/crate_nrm.png", 3)


# ---------------------------------------------------------------- blender helpers
def material(name, col, nrm, rough, metal):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(os.path.abspath(col)); t.image.pack()
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = bpy.data.images.load(os.path.abspath(nrm)); tn.image.colorspace_settings.name = "Non-Color"; tn.image.pack()
    nm = nt.nodes.new("ShaderNodeNormalMap"); nt.links.new(tn.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


def cube(size, loc, mat, bevel):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        m = o.modifiers.new("b", "BEVEL"); m.width = bevel; m.segments = 2; m.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.materials.append(mat)
    return o


def uv_box(o, scale):
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=scale)
    bpy.ops.object.mode_set(mode="OBJECT")
    o.select_set(False)


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
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def export(path):
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), export_format="GLB", export_yup=True, export_apply=True,
                              export_image_format="JPEG", export_jpeg_quality=86, export_materials="EXPORT", use_selection=False)
    tris = 0
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
    print(os.path.basename(path), "tris", tris, "bytes", os.path.getsize(path))


# ---------------------------------------------------------------- crate (unit size, Blender Z up)
bpy.ops.wm.read_factory_settings(use_empty=True)
CRATE = material("CrateOlive", f"{TMP}/crate_col.png", f"{TMP}/crate_nrm.png", 0.62, 0.35)
STEEL = bpy.data.materials.new("CrateSteel"); STEEL.use_nodes = True
sb = next(n for n in STEEL.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
sb.inputs["Base Color"].default_value = (0.09, 0.09, 0.09, 1); sb.inputs["Metallic"].default_value = 0.85; sb.inputs["Roughness"].default_value = 0.45
body = cube((0.96, 0.96, 0.9), (0, 0, -0.03), CRATE, 0.02)
uv_box(body, 1.0)
parts = [body]
# lid with a raised rim, steel corner caps and side handles
parts.append(cube((0.98, 0.98, 0.07), (0, 0, 0.44), CRATE, 0.015))
for sx in (-1, 1):
    for sy in (-1, 1):
        for sz in (-1, 1):
            parts.append(cube((0.12, 0.12, 0.12), (sx * 0.45, sy * 0.45, sz * 0.43), STEEL, 0.012))
for sx in (-1, 1):
    parts.append(cube((0.03, 0.22, 0.05), (sx * 0.5, 0, 0.16), STEEL, 0.008))
    parts.append(cube((0.02, 0.92, 0.04), (sx * 0.485, 0, -0.2), STEEL, 0.006))  # skid rails
for p in parts[1:]:
    uv_box(p, 1.0)
join(parts, "PropCrate")
export(os.path.join(OUTDIR, "crate.glb"))

# ---------------------------------------------------------------- cover wall: 4.5 (x) x 1.3 (y) x 3 (z), centred
bpy.ops.wm.read_factory_settings(use_empty=True)
CONC = material("Concrete", f"{TMP}/concrete_col.png", f"{TMP}/concrete_nrm.png", 0.9, 0.0)
REBAR = bpy.data.materials.new("Rebar"); REBAR.use_nodes = True
rb = next(n for n in REBAR.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
rb.inputs["Base Color"].default_value = (0.13, 0.07, 0.04, 1); rb.inputs["Metallic"].default_value = 0.7; rb.inputs["Roughness"].default_value = 0.8
rng = random.Random(4)
wall = cube((4.5, 1.1, 2.7), (0, 0, -0.15), CONC, 0.04)
# wider footing and a chamfered cap
foot = cube((4.6, 1.3, 0.35), (0, 0, -1.33), CONC, 0.03)
cap = cube((4.3, 0.9, 0.2), (0, 0, 1.3), CONC, 0.05)
# chips knocked out of the top edge (boolean cuts)
for i in range(6):
    cutter = cube((rng.uniform(0.25, 0.6), 2.0, rng.uniform(0.18, 0.4)), (rng.uniform(-2.0, 2.0), 0, 1.42), CONC, 0)
    cutter.rotation_euler = (rng.uniform(-0.3, 0.3), 0, rng.uniform(-0.4, 0.4))
    for t in (wall, cap):
        m = t.modifiers.new("chip", "BOOLEAN"); m.object = cutter; m.operation = "DIFFERENCE"; m.solver = "EXACT"
        bpy.context.view_layer.objects.active = t; bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
for o in (wall, foot, cap):
    uv_box(o, 3.0)
parts = [wall, foot, cap]
# exposed rebar poking out of the chipped top
for i in range(7):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.018, depth=rng.uniform(0.25, 0.55), location=(rng.uniform(-2.0, 2.0), rng.uniform(-0.3, 0.3), 1.35))
    r = bpy.context.active_object
    r.rotation_euler = (rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), 0)
    bpy.ops.object.transform_apply(rotation=True)
    r.data.materials.append(REBAR)
    uv_box(r, 1.0)
    parts.append(r)
join(parts, "PropCoverWall")
export(os.path.join(OUTDIR, "cover-wall.glb"))
