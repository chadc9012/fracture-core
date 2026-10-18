"""
Builds the forest trees used by PolyFoliage: public/models/foliage/broadleaf.glb and conifer.glb.
Each file holds three variants side by side (PolyFoliage's `variants` picks one per instance).

    pip install bpy && python3 scripts/build-trees.py [outdir]

Light enough for the LOW tier: ~1.5-3k triangles per tree. Trunk/branches are tapered tubes with a
tiling bark texture; the canopy is alpha-cut leaf-cluster cards (painted here with numpy/PIL) placed
along the outer branches, so the silhouette is ragged and lit like foliage instead of faceted blobs.
"""
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector
from PIL import Image, ImageDraw, ImageFilter

OUTDIR = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith(".py") else os.path.join(os.path.dirname(__file__), "..", "public", "models", "foliage")
os.makedirs(OUTDIR, exist_ok=True)
TMP = os.path.join(OUTDIR, "_tex")
os.makedirs(TMP, exist_ok=True)


# ------------------------------------------------------------------ textures
def fbm(h, w, octaves, seed, base=4):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp = 1.0
    for o in range(octaves):
        gh, gw = base * 2 ** o, base * 2 ** o
        g = rng.random((gh + 1, gw + 1))
        g[-1, :] = g[0, :]
        g[:, -1] = g[:, 0]
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += np.asarray(img, dtype=np.float64) / 255 * amp
        amp *= 0.5
    return (out - out.min()) / (out.max() - out.min())


def bark_texture(path_col, path_nrm, seed, tint):
    h, w = 1024, 512
    # vertical fissures: stretched noise, sharpened into ridges
    fiss = fbm(h // 8, w, 5, seed, base=6)
    fiss = np.asarray(Image.fromarray((fiss * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), dtype=np.float64) / 255
    ridge = 1 - np.abs(fiss * 2 - 1)
    ridge = ridge ** 2.2
    detail = fbm(h, w, 6, seed + 1, base=8)
    height = np.clip(0.7 * ridge + 0.3 * detail, 0, 1)
    moss = np.clip((fbm(h, w, 4, seed + 2, base=3) - 0.55) * 4, 0, 1) * (1 - ridge) * 0.8
    base = np.array(tint)[None, None, :] * (0.45 + 0.75 * height[..., None])
    mosscol = np.array([0.09, 0.13, 0.045])[None, None, :] * (0.6 + 0.6 * detail[..., None])
    col = base * (1 - moss[..., None]) + mosscol * moss[..., None]
    Image.fromarray((np.clip(col, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)).save(path_col)
    gy, gx = np.gradient(height * 3)
    n = np.dstack([-gx, -gy, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(path_nrm)


def leaf_cluster_texture(path, seed, conifer=False):
    """RGBA atlas of one leaf/needle cluster filling the card, transparent background."""
    rng = random.Random(seed)
    s = 1024
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if conifer:
        # a drooping fir spray: central twig with dense needles both sides, side twigs
        def spray(x0, y0, ang, length, width):
            steps = 60
            for i in range(steps):
                t = i / steps
                x = x0 + math.cos(ang) * length * t
                y = y0 + math.sin(ang) * length * t + (t ** 2) * length * 0.15
                nl = width * (1 - t * 0.6)
                for side in (-1, 1):
                    a = ang + side * (1.0 + rng.uniform(-0.2, 0.2))
                    g = rng.uniform(0.55, 1.0)
                    c = (int(28 * g), int(70 * g + rng.randint(0, 12)), int(32 * g), 255)
                    d.line([(x, y), (x + math.cos(a) * nl, y + math.sin(a) * nl)], fill=c, width=5)
            d.line([(x0, y0), (x0 + math.cos(ang) * length, y0 + math.sin(ang) * length)], fill=(60, 45, 30, 255), width=7)
        spray(80, s * 0.15, math.radians(40), s * 1.05, 120)
        for k in range(7):
            t = 0.12 + k * 0.11
            bx, by = 80 + math.cos(math.radians(40)) * s * 1.05 * t, s * 0.15 + math.sin(math.radians(40)) * s * 1.05 * t
            for side in (-1, 1):
                spray(bx, by, math.radians(40 + side * 55), s * 0.38 * (1 - t * 0.5), 70)
    else:
        # broadleaf: ~260 overlapping ovate leaves on short stems, clustered toward the centre
        cx, cy = s / 2, s / 2
        for i in range(340):
            r = abs(rng.gauss(0, 0.26)) * s
            a = rng.uniform(0, math.tau)
            x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * 0.85
            if not (60 < x < s - 60 and 60 < y < s - 60):
                continue
            L = rng.uniform(55, 95)
            W = L * rng.uniform(0.42, 0.55)
            ang = a + rng.uniform(-0.6, 0.6)
            g = rng.uniform(0.6, 1.1)
            hue = rng.uniform(-1, 1)
            col = (int((40 + 14 * hue) * g), int((82 + 20 * hue) * g), int((26 + 6 * hue) * g), 255)
            leaf = Image.new("RGBA", (int(L * 2), int(L * 2)), (0, 0, 0, 0))
            ld = ImageDraw.Draw(leaf)
            shade = 0.55 + 0.45 * min(1.0, r / (s * 0.3))  # inner leaves sit in the cluster's own shade
            col = (int(col[0] * shade), int(col[1] * shade), int(col[2] * shade), 255)
            pts = [(L - L * 0.5 + L * u, L + side * W / 2 * math.sin(math.pi * u) ** 0.8 * (1 - 0.35 * u)) for side in (-1, 1) for u in ([i / 12 for i in range(13)] if side < 0 else [1 - i / 12 for i in range(13)])]
            ld.polygon(pts, fill=col)
            ld.line([L - L * 0.5, L, L + L * 0.5, L], fill=(int(col[0] * 1.3), int(col[1] * 1.25), int(col[2] * 1.2), 255), width=3)
            leaf = leaf.rotate(math.degrees(-ang), resample=Image.BICUBIC, expand=False)
            img.alpha_composite(leaf, (int(x - L), int(y - L)))
        # twigs underneath read through the gaps
        for i in range(4):
            a = rng.uniform(0, math.tau)
            d.line([(cx, cy), (cx + math.cos(a) * s * 0.35, cy + math.sin(a) * s * 0.3)], fill=(55, 42, 30, 255), width=6)
        img = Image.alpha_composite(Image.new("RGBA", (s, s), (0, 0, 0, 0)), img)
    # soften alpha edge slightly so mip levels keep the canopy dense
    a = img.getchannel("A").filter(ImageFilter.GaussianBlur(1.2))
    img.putalpha(a)
    # bleed colour into transparent pixels to avoid dark fringes on mipmaps
    rgb = np.asarray(img.convert("RGB"), dtype=np.float64)
    al = np.asarray(a, dtype=np.float64) / 255
    blur = np.asarray(img.convert("RGB").filter(ImageFilter.GaussianBlur(24)), dtype=np.float64)
    wb = np.asarray(Image.fromarray((al * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(24)), dtype=np.float64)[..., None] / 255 + 1e-4
    fill = blur / wb
    out = rgb * al[..., None] + np.clip(fill, 0, 255) * (1 - al[..., None])
    img = Image.fromarray(np.dstack([out.astype(np.uint8), np.asarray(a)]), "RGBA")
    img.save(path)


bark_texture(f"{TMP}/bark_col.png", f"{TMP}/bark_nrm.png", 3, (0.15, 0.115, 0.085))
leaf_cluster_texture(f"{TMP}/leaf.png", 7)
leaf_cluster_texture(f"{TMP}/needle.png", 11, conifer=True)


# ------------------------------------------------------------------ materials
def image(path, noncolor=False):
    img = bpy.data.images.load(os.path.abspath(path))
    if noncolor:
        img.colorspace_settings.name = "Non-Color"
    img.pack()
    return img


def bark_material():
    m = bpy.data.materials.new("Bark")
    nt = m.node_tree if m.node_tree else None
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = image(f"{TMP}/bark_col.png")
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = image(f"{TMP}/bark_nrm.png", True)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = 0.92
    return m


def leaf_material(name, path):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = image(path)
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    # alpha clip for glTF: alpha -> "greater than" -> BSDF alpha exports as alphaMode MASK
    gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = 0.5
    nt.links.new(t.outputs["Alpha"], gt.inputs[0]); nt.links.new(gt.outputs[0], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = 0.75
    m.use_backface_culling = False
    return m


BARK = bark_material()
LEAF = leaf_material("Leaves", f"{TMP}/leaf.png")
NEEDLE = leaf_material("Needles", f"{TMP}/needle.png")


# ------------------------------------------------------------------ geometry helpers
def tube(points, radii, sides, verts, faces, uvs, v_scale=1.0):
    """Tapered tube along a polyline; appends to shared buffers. UV v runs along length (tiling bark)."""
    start = len(verts)
    up = Vector((0, 0, 1))
    length = 0.0
    for i, p in enumerate(points):
        if i:
            length += (p - points[i - 1]).length
        d = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        side = d.cross(up if abs(d.dot(up)) < 0.95 else Vector((1, 0, 0))).normalized()
        fwd = d.cross(side).normalized()
        for k in range(sides + 1):
            a = k / sides * math.tau
            verts.append(p + (side * math.cos(a) + fwd * math.sin(a)) * radii[i])
            uvs.append((k / sides, length * v_scale))
    ring = sides + 1
    for i in range(len(points) - 1):
        for k in range(sides):
            a = start + i * ring + k
            faces.append((a, a + 1, a + ring + 1, a + ring))


def make_mesh(name, verts, faces, uvs, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    uvl = me.uv_layers.new(name="UVMap")
    if len(uvs) == len(verts):
        for poly in me.polygons:
            for li in poly.loop_indices:
                uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    else:  # per-loop uvs
        for li, uv in enumerate(uvs):
            uvl.data[li].uv = uv
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    if mat is BARK:  # tubes: make sure every face points out of the wood
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        o.select_set(False)
    return o


def card(center, normal_hint, size, rng, quads, loop_uvs, upright=False, tilt_down=0.0):
    """Two crossed quads at `center`, randomly rolled, for a leaf cluster."""
    yaw = rng.uniform(0, math.tau)
    pitch = rng.uniform(-0.5, 0.5) - tilt_down
    for k in range(2):
        rot = Matrix.Rotation(yaw + k * math.pi / 2, 4, "Z") @ Matrix.Rotation(pitch if not upright else 0, 4, "X")
        hx, hz = size * 0.5, size * 0.5
        corners = [Vector((-hx, 0, -hz)), Vector((hx, 0, -hz)), Vector((hx, 0, hz)), Vector((-hx, 0, hz))]
        quads.append([center + (rot @ c) for c in corners])
        loop_uvs.extend([(0, 0), (1, 0), (1, 1), (0, 1)])


def cards_mesh(name, quads, loop_uvs, mat, canopy_center):
    verts, faces = [], []
    for q in quads:
        b = len(verts)
        verts.extend(q)
        faces.append((b, b + 1, b + 2, b + 3))
    o = make_mesh(name, verts, faces, loop_uvs, mat)
    # canopy-shaped normals (pointing out from the crown centre) make card foliage light as one soft volume
    me = o.data
    normals = []
    for loop in me.loops:
        v = me.vertices[loop.vertex_index].co
        normals.append(((v - canopy_center) * Vector((1, 1, 0.6))).normalized() * 0.7 + Vector((0, 0, 0.3)))
    me.normals_split_custom_set([n.normalized() for n in normals])
    return o


# ------------------------------------------------------------------ species
def broadleaf(seed, offset):
    rng = random.Random(seed)
    verts, faces, uvs = [], [], []
    quads, luv = [], []
    H = rng.uniform(9, 11.5)
    lean = Vector((rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), 0))
    trunk = [offset + Vector((0, 0, 0)) + lean * (t ** 2) + Vector((0, 0, H * 0.55 * t)) for t in np.linspace(0, 1, 7)]
    base_r = H * 0.035
    tube(trunk, [base_r * (1.25 - 0.55 * t) for t in np.linspace(0, 1, 7)], 9, verts, faces, uvs, 0.5)
    crown_c = offset + lean + Vector((0, 0, H * 0.72))

    def branch(p0, direction, length, r0, depth):
        pts, rad = [p0], [r0]
        d = direction.normalized()
        for i in range(1, 5):
            d = (d + Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), rng.uniform(-0.05, 0.18)))).normalized()
            pts.append(pts[-1] + d * length / 4)
            rad.append(r0 * (1 - i / 5) + 0.01)
        tube(pts, rad, 6 if depth == 0 else 4, verts, faces, uvs, 0.5)
        if depth < 1:
            for j in range(3):
                t = rng.uniform(0.45, 0.9)
                q = pts[int(t * 4)]
                nd = (d + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.1, 0.8)))).normalized()
                branch(q, nd, length * rng.uniform(0.45, 0.65), rad[int(t * 4)] * 0.6, depth + 1)
        # leaf clusters along the outer half and at the tip
        for i in (2, 3, 4):
            for _ in range(2 if depth else 1):
                c = pts[i] + Vector((rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), rng.uniform(-0.2, 0.6)))
                card(c, d, rng.uniform(1.8, 2.8), rng, quads, luv)

    n_main = rng.randint(5, 7)
    for i in range(n_main):
        a = i / n_main * math.tau + rng.uniform(-0.3, 0.3)
        h = rng.uniform(0.42, 0.62)
        p0 = trunk[int(h * 6)]
        dirn = Vector((math.cos(a), math.sin(a), rng.uniform(0.35, 0.9)))
        branch(p0, dirn, H * rng.uniform(0.32, 0.45), base_r * 0.55, 0)
    # leader continues up through the crown
    branch(trunk[-1], Vector((0, 0, 1)) + lean * 0.1, H * 0.4, base_r * 0.5, 0)
    # fill the crown interior so it never reads see-through
    for _ in range(26):
        c = crown_c + Vector((rng.gauss(0, H * 0.16), rng.gauss(0, H * 0.16), rng.gauss(0, H * 0.1)))
        card(c, Vector((0, 0, 1)), rng.uniform(2.2, 3.2), rng, quads, luv)
    wood = make_mesh(f"broadleaf_wood_{seed}", verts, faces, uvs, BARK)
    leaves = cards_mesh(f"broadleaf_leaves_{seed}", quads, luv, LEAF, crown_c)
    return [wood, leaves]


def conifer(seed, offset):
    rng = random.Random(seed)
    verts, faces, uvs = [], [], []
    quads, luv = [], []
    H = rng.uniform(13, 17)
    trunk = [offset + Vector((rng.uniform(-0.05, 0.05) * t, 0, H * t)) for t in np.linspace(0, 1, 8)]
    base_r = H * 0.022
    tube(trunk, [base_r * (1.2 - 1.12 * t) + 0.01 for t in np.linspace(0, 1, 8)], 8, verts, faces, uvs, 0.5)
    crown_c = offset + Vector((0, 0, H * 0.55))
    # whorls of drooping branches, longest near the bottom of the crown
    whorls = 11
    for w in range(whorls):
        t = 0.18 + 0.8 * w / whorls
        z = H * t
        reach = H * 0.26 * (1 - t) ** 0.9 + 0.5
        n = 5 + int(3 * (1 - t))
        for i in range(n):
            a = i / n * math.tau + w * 0.7 + rng.uniform(-0.2, 0.2)
            p0 = offset + Vector((0, 0, z))
            tip = p0 + Vector((math.cos(a) * reach, math.sin(a) * reach, -reach * 0.25))
            pts = [p0, p0.lerp(tip, 0.5) + Vector((0, 0, reach * 0.06)), tip]
            tube(pts, [base_r * 0.25 * (1 - t) + 0.015, 0.02, 0.008], 3, verts, faces, uvs, 0.5)
            # sprays laid along the branch, drooping outward
            for k in range(2 if reach > 1.5 else 1):
                c = p0.lerp(tip, 0.45 + 0.4 * k) + Vector((0, 0, -0.05))
                card(c, tip - p0, reach * rng.uniform(0.8, 1.05) + 0.6, rng, quads, luv, tilt_down=0.35)
    # tip
    for _ in range(3):
        card(offset + Vector((0, 0, H * 0.97)), Vector((0, 0, 1)), 1.4, rng, quads, luv, upright=True)
    wood = make_mesh(f"conifer_wood_{seed}", verts, faces, uvs, BARK)
    needles = cards_mesh(f"conifer_needles_{seed}", quads, luv, NEEDLE, crown_c)
    return [wood, needles]


def export(name, builder, seeds, spacing):
    bpy.ops.object.select_all(action="DESELECT")
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    total = 0
    for i, s in enumerate(seeds):
        parts = builder(s, Vector((i * spacing, 0, 0)))
        # one top-level node per variant so PolyFoliage sees side-by-side variants
        root = bpy.data.objects.new(f"{name}_{i}", None)
        bpy.context.scene.collection.objects.link(root)
        root.location = (i * spacing, 0, 0)
        for p in parts:
            p.parent = root
            p.matrix_parent_inverse = root.matrix_world.inverted()
            p.data.calc_loop_triangles()
            total += len(p.data.loop_triangles)
    path = os.path.abspath(os.path.join(OUTDIR, f"{name}.glb"))
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_image_format="AUTO",
                              export_materials="EXPORT", export_normals=True, use_selection=False)
    print(f"{name}: {len(seeds)} variants, {total} tris total ({total // len(seeds)} per tree), {os.path.getsize(path)} bytes")


bpy.ops.wm.read_factory_settings(use_empty=True)
BARK = bark_material(); LEAF = leaf_material("Leaves", f"{TMP}/leaf.png"); NEEDLE = leaf_material("Needles", f"{TMP}/needle.png")
export("broadleaf", broadleaf, [3, 8, 21], 30)
BARK = bark_material(); LEAF = leaf_material("Leaves", f"{TMP}/leaf.png"); NEEDLE = leaf_material("Needles", f"{TMP}/needle.png")
export("conifer", conifer, [4, 9, 16], 30)
