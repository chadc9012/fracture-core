"""
Builds public/models/city/neon-towers.glb: six original Neon City tower variants (dark curtain-wall shafts with setbacks,
lit window grid, storefront podium, rooftop plant and masts, neon edge trims), authored for the game's gritty neo-war
look instead of the generic hosted city kit.

    pip install bpy pillow && python3 scripts/build-city.py [out.glb]

Frame: metres, glTF Y-up, each variant is a root node NeonTower<A-F> with its origin at the centre of its footprint on
the ground. Materials: Facade (window grid: albedo + emissive windows + roughness/metal), Podium (storefront glass and
lit shop strip), Roof (dark metal), NeonTrim (emissive; the game recolours it per building).
"""
import math
import os
import random
import sys
import tempfile

import bpy  # noqa: I001 (bpy must load before bmesh)
import bmesh
import numpy as np
from mathutils import Vector
from PIL import Image

OUT = sys.argv[-1] if sys.argv[-1].endswith(".glb") else os.path.join(os.path.dirname(__file__), "..", "public", "models", "city", "neon-towers.glb")
BAY, FLOOR = 2.5, 3.5          # one window cell, metres
TILE_BAYS, TILE_FLOORS = 8, 8  # the facade texture repeats every 20 m x 28 m
TEX = 1024
TMP = tempfile.mkdtemp()
rng = random.Random(7)

bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------- textures (numpy -> PNG -> Blender image)
def save(name, arr, srgb=True):
    path = os.path.join(TMP, f"{name}.png")
    Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8)).save(path)
    img = bpy.data.images.load(path)
    img.name = name
    if not srgb:
        img.colorspace_settings.name = "Non-Color"
    img.pack()
    return img


def noise(h, w, scale, seed):
    r = np.random.default_rng(seed)
    small = r.random((h // scale + 2, w // scale + 2))
    big = np.kron(small, np.ones((scale, scale)))[:h, :w]
    return big


def facade_textures():
    h = w = TEX
    cw, ch = w // TILE_BAYS, h // TILE_FLOORS
    albedo = np.zeros((h, w, 3)); emit = np.zeros((h, w, 3)); orm = np.ones((h, w, 3))
    grime = 0.75 + 0.25 * noise(h, w, 16, 1) * noise(h, w, 4, 2)
    concrete = np.array([0.055, 0.058, 0.064])  # dark weathered panels, the gritty curtain wall of the reference art
    glass = np.array([0.02, 0.03, 0.042])
    warm, cool, magenta = np.array([1.0, 0.72, 0.42]), np.array([0.55, 0.85, 1.0]), np.array([1.0, 0.35, 0.8])
    r = np.random.default_rng(11)
    for fy in range(TILE_FLOORS):
        for bx in range(TILE_BAYS):
            y0, x0 = fy * ch, bx * cw
            # mullions and the spandrel band are concrete/metal; the rest is glass
            m, sp = 7, int(ch * 0.22)
            albedo[y0:y0 + ch, x0:x0 + cw] = concrete
            orm[y0:y0 + ch, x0:x0 + cw, 1] = 0.82; orm[y0:y0 + ch, x0:x0 + cw, 2] = 0.1
            gy0, gy1, gx0, gx1 = y0 + m, y0 + ch - sp, x0 + m, x0 + cw - m
            grad = np.linspace(1.15, 0.85, gy1 - gy0)[:, None, None]
            albedo[gy0:gy1, gx0:gx1] = glass * grad
            orm[gy0:gy1, gx0:gx1, 1] = 0.1; orm[gy0:gy1, gx0:gx1, 2] = 0.65
            roll = r.random()
            if roll < 0.32:  # lit window, sometimes with the blind half down
                col = warm if roll < 0.2 else cool if roll < 0.29 else magenta
                k = 0.25 + 0.5 * r.random() ** 2
                blind = gy0 + int((gy1 - gy0) * (0.5 if r.random() < 0.3 else 0.0))
                emit[blind:gy1, gx0:gx1] = col * k
                albedo[blind:gy1, gx0:gx1] = albedo[blind:gy1, gx0:gx1] * 0.5 + col * 0.08
            # horizontal sill shadow line
            albedo[gy1:gy1 + 3, x0:x0 + cw] *= 0.55
    albedo *= grime[..., None]
    # streaks of rain-wash down the facade
    streak = noise(h, w, 2, 5)[:1].repeat(h, 0) * noise(h, w, 64, 6)
    albedo *= (1 - 0.18 * (streak > 0.55))[..., None]
    orm[..., 0] = 1
    return save("facade_color", albedo[::-1]), save("facade_emit", emit[::-1]), save("facade_orm", orm[::-1], srgb=False)


def podium_textures():
    h, w = 256, 1024  # one storefront band: 4 shops over 20 m, 5 m tall
    albedo = np.zeros((h, w, 3)) + np.array([0.06, 0.06, 0.07]); emit = np.zeros((h, w, 3)); orm = np.ones((h, w, 3))
    orm[..., 1] = 0.75; orm[..., 2] = 0.2
    cols = [np.array(c) for c in ([1.0, 0.25, 0.75], [0.25, 0.9, 1.0], [1.0, 0.8, 0.3], [0.35, 1.0, 0.5])]
    for i in range(4):
        x0, x1 = i * 256 + 14, i * 256 + 242
        albedo[40:200, x0:x1] = [0.05, 0.08, 0.1]
        orm[40:200, x0:x1, 1] = 0.08; orm[40:200, x0:x1, 2] = 0.7
        emit[60:200, x0:x1] = np.array([1.0, 0.85, 0.65]) * 0.35  # shop interior glow
        emit[205:230, x0:x1] = cols[i] * 1.0  # sign band
        albedo[205:230, x0:x1] = cols[i] * 0.3
    albedo *= (0.8 + 0.2 * noise(h, w, 8, 9))[..., None]
    return save("podium_color", albedo[::-1]), save("podium_emit", emit[::-1]), save("podium_orm", orm[::-1], srgb=False)


def material(name, color_img=None, emit_img=None, orm_img=None, base=(0.1, 0.1, 0.1), rough=0.6, metal=0.3, emission=None, strength=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    b = next(x for x in nt.nodes if x.type == "BSDF_PRINCIPLED")
    if color_img:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = color_img
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    else:
        b.inputs["Base Color"].default_value = (*base, 1)
    if orm_img:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = orm_img
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(t.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
        nt.links.new(sep.outputs["Blue"], b.inputs["Metallic"])
    else:
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
    if emit_img:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = emit_img
        nt.links.new(t.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = strength
    elif emission:
        b.inputs["Emission Color"].default_value = (*emission, 1)
        b.inputs["Emission Strength"].default_value = strength
    return mat


fc, fe, fo = facade_textures()
pc, pe, po = podium_textures()
MATS = {
    "Facade": material("Facade", fc, fe, fo, strength=1.3),
    "Podium": material("Podium", pc, pe, po, strength=2.0),
    "Roof": material("Roof", base=(0.045, 0.048, 0.052), rough=0.7, metal=0.6),
    "NeonTrim": material("NeonTrim", base=(1.0, 0.2, 0.7), rough=0.3, metal=0.0, emission=(1.0, 0.2, 0.7), strength=4.0),
}
SLOT = {name: i for i, name in enumerate(MATS)}


# ---------------------------------------------------------------- geometry (bmesh boxes with metric facade UVs)
class Builder:
    def __init__(self, name):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.name = name

    def box(self, cx, cy, z0, sx, sy, sz, mat, uv_w=BAY * TILE_BAYS, uv_h=FLOOR * TILE_FLOORS, v_off=0.0):
        """axis-aligned box; Blender coords (x, y ground plane, z up). Side faces get metric UVs so windows stay square."""
        bm = self.bm
        xs, ys, zs = (cx - sx / 2, cx + sx / 2), (cy - sy / 2, cy + sy / 2), (z0, z0 + sz)
        v = {(i, j, k): bm.verts.new((xs[i], ys[j], zs[k])) for i in (0, 1) for j in (0, 1) for k in (0, 1)}
        faces = [((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)), ((1, 1, 0), (0, 1, 0), (0, 1, 1), (1, 1, 1)),
                 ((0, 1, 0), (0, 0, 0), (0, 0, 1), (0, 1, 1)), ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)),
                 ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)), ((0, 1, 0), (1, 1, 0), (1, 0, 0), (0, 0, 0))]
        for f in faces:
            face = bm.faces.new([v[c] for c in f])
            face.material_index = SLOT[mat]
            face.normal_update()  # a new bmesh face has no normal yet; the UV projection below depends on it
            n = face.normal
            for loop in face.loops:
                p = loop.vert.co
                if abs(n.z) > 0.5:
                    loop[self.uv].uv = (p.x / uv_w, p.y / uv_w)
                else:
                    along = p.x if abs(n.y) > 0.5 else p.y
                    loop[self.uv].uv = (along / uv_w, (p.z - z0) / uv_h + v_off)

    def cyl(self, cx, cy, z0, r, h, mat, seg=10):
        ret = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=h)
        for vert in ret["verts"]:
            vert.co += Vector((cx, cy, z0 + h / 2))
        faces = {f for vert in ret["verts"] for f in vert.link_faces}
        for f in faces:
            f.material_index = SLOT[mat]

    def finish(self, x_off=0.0):
        me = bpy.data.meshes.new(self.name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        for m in MATS.values():
            me.materials.append(m)
        o = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(o)
        o.location.x = x_off  # spread out only for previews; the game picks each root by name
        return o


def trims(b, cx, cy, z0, sx, sy, sz, every=0):
    """neon on the vertical corners, plus a band at the top edge (and every n floors if asked)."""
    t = 0.18
    for dx in (-1, 1):
        for dy in (-1, 1):
            b.box(cx + dx * (sx / 2 + t / 2), cy + dy * (sy / 2 + t / 2), z0, t, t, sz, "NeonTrim")
    bands = [z0 + sz - 0.3] + ([z0 + k * FLOOR * every for k in range(1, int(sz / (FLOOR * every)))] if every else [])
    for z in bands:
        b.box(cx, cy - sy / 2 - t / 2, z, sx, t, 0.22, "NeonTrim")
        b.box(cx, cy + sy / 2 + t / 2, z, sx, t, 0.22, "NeonTrim")


def roof_plant(b, cx, cy, z, sx, sy, mast=0.0):
    b.box(cx, cy, z, sx, sy, 0.6, "Roof")  # parapet cap
    for _ in range(3):
        ux, uy = cx + rng.uniform(-sx * 0.3, sx * 0.3), cy + rng.uniform(-sy * 0.3, sy * 0.3)
        b.box(ux, uy, z + 0.6, rng.uniform(1.4, 2.6), rng.uniform(1.4, 2.6), rng.uniform(1.0, 2.2), "Roof")
    if mast:
        b.cyl(cx + sx * 0.2, cy - sy * 0.2, z + 0.6, 0.22, mast, "Roof", seg=8)
        b.box(cx + sx * 0.2, cy - sy * 0.2, z + 0.6 + mast - 0.6, 0.3, 0.3, 0.6, "NeonTrim")


def podium(b, sx, sy, h=5.0):
    b.box(0, 0, 0, sx, sy, h, "Podium", uv_w=20.0, uv_h=5.0)
    b.box(0, 0, h, sx + 0.8, sy + 0.8, 0.5, "Roof")  # canopy ledge over the shops


def tower(name, sx, sy, stages, mast=0.0, band_every=0, sign=False, x_off=0.0):
    """stages: list of (width, depth, height) stacked with setbacks above a 5 m storefront podium."""
    b = Builder(name)
    podium(b, sx, sy)
    z = 5.5
    for i, (w, d, h) in enumerate(stages):
        b.box(0, 0, z, w, d, h, "Facade", v_off=rng.random())
        trims(b, 0, 0, z, w, d, h, every=band_every if i == 0 else 0)
        z += h
        if i < len(stages) - 1:
            b.box(0, 0, z, w + 0.4, d + 0.4, 0.5, "Roof")  # setback ledge
            z += 0.5
    last = stages[-1]
    roof_plant(b, 0, 0, z, last[0], last[1], mast)
    if sign:
        # a tall blade sign off one face of the lower shaft
        b.box(stages[0][0] / 2 + 0.6, 0, 9, 0.35, 2.2, min(16, stages[0][2] * 0.7), "NeonTrim")
    return b.finish(x_off)


VARIANTS = [
    ("NeonTowerA", 12, 12, [(11, 11, 42)], 8, 4, True),
    ("NeonTowerB", 14, 12, [(13, 11, 24), (9, 8, 22)], 12, 0, False),
    ("NeonTowerC", 10, 10, [(9, 9, 30), (7, 7, 18), (5, 5, 10)], 16, 0, True),
    ("NeonTowerD", 16, 10, [(15, 9, 18)], 0, 2, True),
    ("NeonTowerE", 12, 14, [(11, 13, 54), (8, 9, 12)], 20, 5, False),
    ("NeonTowerF", 18, 14, [(17, 13, 12), (12, 10, 26)], 6, 0, True),
]
for i, (name, sx, sy, stages, mast, band, sign) in enumerate(VARIANTS):
    tower(name, sx, sy, stages, mast, band, sign, x_off=i * 24.0)

tris = 0
for o in bpy.data.objects:
    o.data.calc_loop_triangles()
    print(f"{o.name:12s} tris={len(o.data.loop_triangles)} height={max(v.co.z for v in o.data.vertices):.1f}")
    tris += len(o.data.loop_triangles)
print("total tris", tris)
PREVIEW = os.environ.get("CITY_PREVIEW")
if PREVIEW:  # a side-by-side line-up for a studio render
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(PREVIEW), export_format="GLB", export_yup=True, export_apply=True, export_image_format="JPEG")
for o in bpy.data.objects:
    o.location.x = 0
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", export_yup=True, export_apply=True,
                          export_image_format="JPEG", export_jpeg_quality=86, export_texcoords=True, export_normals=True,
                          export_tangents=False, export_materials="EXPORT", export_attributes=False, use_selection=False)
print("wrote", os.path.abspath(OUT), os.path.getsize(OUT))
