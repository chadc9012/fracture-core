"""
Builds public/models/foliage/palm-a/b/c.glb: three city palm variants, for Neon City's
boulevards and the Nexus plaza (the reference boards line every street with them).

    pip install bpy pillow && python3 scripts/build-palms.py [outdir]

Trunk: a gently curved tapered tube with ring scars (texture). Crown: 12-16 fronds, each a bent strip of alpha-cut frond
cards (a painted pinnate leaf on transparency), drooping with length, plus a few dead hanging fronds and a seed cluster.
About 2.5k triangles per palm.
"""
import math
import os
import random
import sys
import tempfile

import bpy  # noqa: I001
import bmesh
import numpy as np
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fleet_kit as K  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "public", "models", "foliage")
TMP = tempfile.mkdtemp(prefix="wf-palm-")


def frond_texture(path, seed=3, dead=False):
    """A pinnate palm leaf on transparency: central rachis, ~34 leaflets per side drooping outward."""
    W, H = 256, 1024
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    r = random.Random(seed)
    base = (46, 92, 34) if not dead else (120, 92, 54)
    cx = W // 2
    for i in range(36):
        y = int(H * 0.04 + i * H * 0.026)
        L = int(W * 0.47 * math.sin(math.pi * (0.12 + 0.88 * i / 36)) ** 0.7)
        for side in (-1, 1):
            tip = (cx + side * L, y + int(L * 0.55) + r.randint(-6, 6))
            shade = r.uniform(0.75, 1.15)
            col = tuple(int(min(255, c * shade)) for c in base) + (255,)
            d.polygon([(cx, y - 3), tip, (cx, y + 7)], fill=col)
            d.line([(cx, y + 2), tip], fill=tuple(int(c * 0.7) for c in base) + (255,), width=1)
    d.line([(cx, 0), (cx, H)], fill=(96, 92, 52, 255), width=5)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    img.save(path)
    return path


def bark_texture(path):
    W, H = 256, 512
    a = np.zeros((H, W, 3))
    y = np.arange(H)[:, None] / H
    rings = (np.sin(y * math.pi * 2 * 22) * 0.5 + 0.5) ** 6
    noise = np.random.default_rng(5).random((H, W)) * 0.12
    base = np.array([0.42, 0.35, 0.26])
    a[:] = base * (0.8 + noise[..., None]) * (1 - rings[..., None] * 0.45)
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(path)
    return path


def img_mat(name, path, alpha=False, rough=0.8):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = bpy.data.images.load(path)
    nt.links.new(tx.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    if alpha:
        nt.links.new(tx.outputs["Alpha"], b.inputs["Alpha"])
        try:
            m.blend_method = "CLIP"
        except Exception:
            pass
        m.use_backface_culling = False
    return m


def trunk(height, lean, r0, r1, m, segs=10, sides=10):
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
    rings = []
    for i in range(segs + 1):
        t = i / segs
        x = lean * height * t * t; z = height * t
        r = r0 + (r1 - r0) * t
        rings.append([bm.verts.new((x + r * math.cos(2 * math.pi * k / sides), r * math.sin(2 * math.pi * k / sides), z)) for k in range(sides)])
    for i in range(segs):
        for k in range(sides):
            f = bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
            for loop, (u, v) in zip(f.loops, [(k / sides, i / segs * 4), ((k + 1) / sides, i / segs * 4), ((k + 1) / sides, (i + 1) / segs * 4), (k / sides, (i + 1) / segs * 4)]):
                loop[uvl].uv = (u, v)
    me = bpy.data.meshes.new("Trunk"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("Trunk", me); bpy.context.collection.objects.link(o); me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    top = Vector((lean * height, 0, height))
    return o, top


def frond(top, yaw, length, droop, m, width=1.9, segs=6, name="Frond"):
    """A bent strip from the crown outward: each segment a card, UV running the leaf texture along its length."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
    d = Vector((math.cos(yaw), math.sin(yaw), 0))
    side = Vector((-d.y, d.x, 0))
    pts = []
    for i in range(segs + 1):
        t = i / segs
        p = top + d * (length * t) + Vector((0, 0, 0.6 * length * t - droop * length * t * t))
        w = width * math.sin(math.pi * min(1, 0.15 + t)) * (1 - 0.3 * t)
        pts.append((p, w, t))
    verts = [(bm.verts.new(p - side * w / 2 + Vector((0, 0, w * 0.15))), bm.verts.new(p + side * w / 2 + Vector((0, 0, w * 0.15)))) for p, w, _ in pts]
    for i in range(segs):
        a, b = verts[i]; c, e = verts[i + 1]
        f = bm.faces.new((a, b, e, c))
        t0, t1 = pts[i][2], pts[i + 1][2]
        for loop, uv in zip(f.loops, [(0, t0), (1, t0), (1, t1), (0, t1)]):
            loop[uvl].uv = uv
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); me.materials.append(m)
    return o


def palm(x_off, seed, height, lean, n_fronds):
    r = random.Random(seed)
    bark = img_mat("PalmBark", bark_texture(os.path.join(TMP, "bark.png")), rough=0.9)
    leaf = img_mat("PalmLeaf", frond_texture(os.path.join(TMP, f"frond{seed}.png"), seed), alpha=True, rough=0.6)
    dead = img_mat("PalmDead", frond_texture(os.path.join(TMP, f"dead{seed}.png"), seed + 9, dead=True), alpha=True, rough=0.85)
    t, top = trunk(height, lean, 0.26, 0.16, bark)
    parts = [t]
    for k in range(n_fronds):
        yaw = 2 * math.pi * k / n_fronds + r.uniform(-0.2, 0.2)
        parts.append(frond(top, yaw, r.uniform(3.4, 4.6), r.uniform(0.7, 1.25), leaf))
        if k % 2 == 0:
            parts.append(frond(top + Vector((0, 0, 0.25)), yaw + 0.25, r.uniform(2.4, 3.2), r.uniform(0.3, 0.6), leaf))
    for k in range(4):
        yaw = r.uniform(0, 2 * math.pi)
        parts.append(frond(top - Vector((0, 0, 0.4)), yaw, 2.6, 2.6, dead, width=0.8, name="DeadFrond"))
    parts.append(K.sphere(0.2, (top.x, top.y, top.z - 0.15), K.mat("Seeds", "#7a5a2a", 0, 0.8), scale=(1, 1, 0.8), seg=10, rings=6))
    tree = K.join(parts, f"Palm{seed}")
    tree.location.x += x_off
    return tree


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for i, (h, lean, n) in enumerate([(9.5, 0.08, 18), (12.0, 0.14, 20), (7.5, -0.05, 16)]):
        K.reset()
        palm(0, 11 + i, h, lean, n)
        path = os.path.join(OUT, f"palm-{'abc'[i]}.glb")
        K.export(path)
        print("WROTE", path, os.path.getsize(path))
