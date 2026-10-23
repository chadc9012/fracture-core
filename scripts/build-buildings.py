"""
Builds authored city buildings into public/models/buildings/*.glb (Blender bpy):

  Nexus (white stone, blue glass, gold trim, terraces):  nexus-civic-a/b/c, nexus-terrace-a/b, nexus-spire
  Neon  (black glass, neon edge strips, holo panels):    neon-tower-a/b/c, neon-block-a/b

    pip install bpy && python3 scripts/build-buildings.py [outdir] [only ...]

Each tower is real architecture rather than a box: stacked tiers with setbacks, a glass curtain wall carrying a lit-window
emissive map (material "WindowsLit"; the game scales its glow with the night), a floor slab every 3.6 m, mullions every
1.6 m, a podium with a lobby canopy, and a crown (gold ring, antenna, garden or neon frame). Metres, ground at 0, +Y up in
three.js, origin at the footprint centre.
"""
import math
import os
import random
import sys

import bpy  # noqa: I001  (bpy must load before bmesh)
import bmesh
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fleet_kit as K  # noqa: E402  (materials, primitives, export)

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else os.path.join(os.path.dirname(__file__), "..", "public", "models", "buildings")
ONLY = set(sys.argv[2:])
FLOOR = 3.6
CELL = 1.6
TEX = "/tmp/wf-window-lit.png"


def window_texture(path=TEX, n=512, cells=16, seed=7, lit=0.34):
    """Lit-window emissive map: a grid of rooms, a share lit warm or cool, with blinds and dark frames."""
    r = random.Random(seed)
    img = np.zeros((n, n, 3))
    c = n // cells
    for j in range(cells):
        for i in range(cells):
            if r.random() > lit:
                continue
            warm = r.random() < 0.75
            col = np.array([1.0, 0.78, 0.5]) if warm else np.array([0.72, 0.86, 1.0])
            col *= 0.55 + r.random() * 0.45
            y0, x0 = j * c, i * c
            blind = int(c * r.choice([0, 0, 0.3, 0.55]))
            img[y0 + 3 + blind:y0 + c - 4, x0 + 3:x0 + c - 3] = col
            # a lamp gradient inside the room
            yy = np.linspace(1.0, 0.7, max(1, c - 7 - blind))[:, None, None]
            img[y0 + 3 + blind:y0 + c - 4, x0 + 3:x0 + c - 3] *= yy
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(path)
    return path


def footprint(kind, w, d, segs=24, chamfer=0.18):
    if kind == "rect":
        return [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    if kind == "chamfer":
        cx, cy = w * chamfer, d * chamfer
        return [(-w / 2 + cx, -d / 2), (w / 2 - cx, -d / 2), (w / 2, -d / 2 + cy), (w / 2, d / 2 - cy), (w / 2 - cx, d / 2), (-w / 2 + cx, d / 2), (-w / 2, d / 2 - cy), (-w / 2, -d / 2 + cy)]
    if kind == "oct":
        return [(w / 2 * math.cos(a), d / 2 * math.sin(a)) for a in [math.pi / 8 + k * math.pi / 4 for k in range(8)]]
    if kind == "round":
        return [(w / 2 * math.cos(a), d / 2 * math.sin(a)) for a in [2 * math.pi * k / segs for k in range(segs)]]
    raise ValueError(kind)


def scale_fp(fp, s):
    return [(x * s, y * s) for x, y in fp]


def offset_fp(fp, o):
    """grow a convex footprint outward by o metres (approx: scale by (r+o)/r per vertex)"""
    out = []
    for x, y in fp:
        r = math.hypot(x, y) or 1
        out.append((x * (r + o) / r, y * (r + o) / r))
    return out


def prism(name, fp, z0, z1, m, uv_cells=False, cap=True):
    """Extruded footprint; side faces get world-scale UVs (u along the wall, v up) when uv_cells."""
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in fp]
    hi = [bm.verts.new((x, y, z1)) for x, y in fp]
    n = len(fp)
    uvl = bm.loops.layers.uv.new("UVMap")
    run = 0.0
    for k in range(n):
        a, b = k, (k + 1) % n
        f = bm.faces.new((lo[a], lo[b], hi[b], hi[a]))
        seg = math.dist(fp[a], fp[b])
        if uv_cells:
            span_u, span_v = CELL * 16, FLOOR * 16
            for loop, (u, v) in zip(f.loops, [(run, z0), (run + seg, z0), (run + seg, z1), (run, z1)]):
                loop[uvl].uv = (u / span_u, v / span_v)
        run += seg
    if cap:
        bm.faces.new(list(reversed(lo)))
        bm.faces.new(hi)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    me.materials.append(m)
    return o


def mullions(fp, z0, z1, m, step=CELL, depth=0.22, width=0.12):
    """Vertical fins along every wall of the footprint, one per `step` metres plus one per corner."""
    parts = []
    n = len(fp)
    for k in range(n):
        (ax, ay), (bx, by) = fp[k], fp[(k + 1) % n]
        seg = math.dist((ax, ay), (bx, by)); cnt = max(1, int(seg / step))
        nx, ny = (by - ay) / seg, -(bx - ax) / seg  # outward normal for a CCW footprint
        ang = math.atan2(by - ay, bx - ax)
        for i in range(cnt):
            t = i / cnt
            x, y = ax + (bx - ax) * t + nx * depth / 2, ay + (by - ay) * t + ny * depth / 2
            o = K.box((width, depth, z1 - z0), (x, y, (z0 + z1) / 2), m, bevel=0, rot=(0, 0, ang), name="Mullion")
            parts.append(o)
    return parts


def lit_glass_material(tint="#0f2338", lit_strength=2.2):
    m = bpy.data.materials.new("WindowsLit"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*K.srgb_to_linear(tint), 1)
    b.inputs["Metallic"].default_value = 0.9; b.inputs["Roughness"].default_value = 0.08
    img = bpy.data.images.load(window_texture()); tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = img
    nt.links.new(tx.outputs["Color"], b.inputs["Emission Color"]); b.inputs["Emission Strength"].default_value = lit_strength
    return m


def tower(oid, style, tiers, podium=None, crown="ring", fp_kind="chamfer", accent="#38e8ff"):
    """tiers: list of (scale, floors). style: 'nexus' or 'neon'."""
    K.reset()
    if style == "nexus":
        M = dict(stone=K.mat("Stone", "#e9e6df", 0.0, 0.55), slab=K.mat("Slab", "#f2f0ea", 0.0, 0.45), frame=K.mat("Frame", "#c9ced4", 0.85, 0.3),
                 gold=K.mat("Gold", "#d4a94a", 1.0, 0.22), accent=K.mat("Accent", accent, 0.0, 0.2, emit=accent, strength=4.0), green=K.mat("Planter", "#3f6b35", 0.0, 0.9),
                 dark=K.mat("Lobby", "#1a2430", 0.6, 0.15))
        glass = lit_glass_material("#20425f", 1.6)
    else:
        M = dict(stone=K.mat("Stone", "#15171d", 0.3, 0.5), slab=K.mat("Slab", "#20232b", 0.4, 0.4), frame=K.mat("Frame", "#0b0c10", 0.8, 0.35),
                 gold=K.mat("Gold", "#ff2bd6", 0.0, 0.2, emit="#ff2bd6", strength=5.0), accent=K.mat("Accent", accent, 0.0, 0.2, emit=accent, strength=6.0),
                 green=K.mat("Planter", "#1e3326", 0.0, 0.9), dark=K.mat("Lobby", "#0a0d14", 0.6, 0.12))
        glass = lit_glass_material("#0a0f1c", 2.6)
    base_w, base_d = podium["w"], podium["d"]
    parts = []
    z = 0.0
    # podium: stone base with recessed lobby glass and a canopy
    ph = podium.get("h", 7.2)
    pfp = footprint("rect", base_w, base_d)
    parts.append(prism("Podium", pfp, 0, ph, M["stone"]))
    parts.append(prism("LobbyGlass", footprint("rect", base_w + 0.1, base_d * 0.6), 0.2, ph * 0.55, M["dark"]))
    parts.append(K.box((base_w * 0.5, 2.6, 0.25), (0, -base_d / 2 - 1.2, ph * 0.55), M["frame"], bevel=0.05, name="Canopy"))
    parts.append(K.box((base_w * 0.5, 0.06, 0.06), (0, -base_d / 2 - 2.45, ph * 0.55 - 0.1), M["accent"], bevel=0, name="CanopyGlow"))
    for s in (-1, 1):
        parts.append(K.box((1.2, 1.2, 0.9), (s * base_w * 0.32, -base_d / 2 - 1.0, 0.45), M["stone"], bevel=0.08, name="Planter"))
        parts.append(K.sphere(0.7, (s * base_w * 0.32, -base_d / 2 - 1.0, 1.3), M["green"], scale=(1, 1, 0.8), seg=12, rings=8))
    z = ph
    prev = None
    for ti, (sc, floors) in enumerate(tiers):
        fp = footprint(fp_kind, base_w * sc, base_d * sc)
        z1 = z + floors * FLOOR
        parts.append(prism(f"Glass{ti}", fp, z, z1, glass, uv_cells=True))
        parts += mullions(fp, z, z1, M["frame"])
        for f in range(floors + 1):
            zz = z + f * FLOOR
            parts.append(prism("SlabEdge", offset_fp(fp, 0.25), zz - 0.18, zz + 0.12, M["slab"]))
        # corner accent strips (Nexus: thin gold, Neon: neon edge)
        for (x, y) in fp[::max(1, len(fp) // 4)]:
            parts.append(K.box((0.18, 0.18, z1 - z), (x * 1.02, y * 1.02, (z + z1) / 2), M["gold"] if style == "nexus" else M["accent"], bevel=0, name="Edge"))
        if prev is not None and style == "nexus":
            # terrace garden on the setback roof
            parts.append(prism("Terrace", offset_fp(fp, 0.8), z - 0.05, z + 0.5, M["green"]))
        prev = fp
        z = z1
    top_fp = prev
    parts.append(prism("Roof", offset_fp(top_fp, 0.3), z, z + 0.8, M["slab"]))
    z += 0.8
    if crown == "ring":
        bpy.ops.mesh.primitive_torus_add(major_radius=max(abs(p[0]) for p in top_fp) * 0.8, minor_radius=0.35, major_segments=48, minor_segments=8, location=(0, 0, z + 3.2))
        t = bpy.context.object; t.data.materials.append(M["gold"]); parts.append(t)
        bpy.ops.mesh.primitive_torus_add(major_radius=max(abs(p[0]) for p in top_fp) * 0.8, minor_radius=0.08, major_segments=48, minor_segments=6, location=(0, 0, z + 3.2))
        t2 = bpy.context.object; t2.data.materials.append(M["accent"]); parts.append(t2)
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4; r = max(abs(p[0]) for p in top_fp) * 0.8
            parts.append(K.box((0.25, 0.25, 3.2), (math.cos(a) * r, math.sin(a) * r, z + 1.6), M["frame"], bevel=0, name="RingPost"))
    elif crown == "spire":
        parts.append(K.cyl(1.2, 10, (0, 0, z + 5), M["frame"], verts=12, r2=0.15, name="Spire"))
        parts.append(K.cyl(0.25, 3, (0, 0, z + 11), M["accent"], verts=8, name="SpireTip"))
    elif crown == "antenna":
        parts.append(K.box((3, 3, 2.2), (0, 0, z + 1.1), M["slab"], bevel=0.05, name="Plant"))
        parts.append(K.cyl(0.18, 14, (1.0, 0.5, z + 7), M["frame"], verts=8, name="Mast"))
        parts.append(K.sphere(0.3, (1.0, 0.5, z + 14.2), K.mat("Beacon", "#ff3030", 0, 0.2, emit="#ff2020", strength=8), seg=10, rings=6))
    elif crown == "neon-frame":
        w = max(abs(p[0]) for p in top_fp); d = max(abs(p[1]) for p in top_fp)
        for s in (-1, 1):
            parts.append(K.box((0.3, 0.3, 8), (s * w, -d, z + 4), M["accent"], bevel=0, name="FrameV"))
            parts.append(K.box((0.3, 0.3, 8), (s * w, d, z + 4), M["gold"], bevel=0, name="FrameV"))
        parts.append(K.box((2 * w, 0.3, 0.3), (0, -d, z + 8), M["accent"], bevel=0, name="FrameH"))
        parts.append(K.box((2 * w, 0.3, 0.3), (0, d, z + 8), M["gold"], bevel=0, name="FrameH"))
    elif crown == "garden":
        parts.append(prism("RoofGarden", scale_fp(top_fp, 0.85), z, z + 0.6, M["green"]))
        for k in range(6):
            a = k * math.pi / 3
            parts.append(K.sphere(1.0, (math.cos(a) * 3, math.sin(a) * 3, z + 1.6), M["green"], scale=(1, 1, 1.3), seg=12, rings=8))
    # holo panel on Neon towers
    if style == "neon":
        w = max(abs(p[0]) for p in prev)
        holo = K.mat("Holo", "#38e8ff", 0.0, 0.3, emit="#7a3cff", strength=3.5)
        parts.append(K.box((0.2, base_d * 0.5, 10), (w * 1.02 + 0.2, 0, z * 0.6), holo, bevel=0, name="HoloPanel"))
    K.join([p for p in parts if p], "Building")
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, oid + ".glb")
    K.export(path)
    print("WROTE", path, os.path.getsize(path))


BUILDS = {
    # Nexus hub: civic towers under the stability dome (<= ~24 m), terraces and a landmark spire
    "nexus-civic-a": lambda: tower("nexus-civic-a", "nexus", [(1.0, 3), (0.8, 2)], podium=dict(w=14, d=12, h=6.0), crown="ring", fp_kind="chamfer"),
    "nexus-civic-b": lambda: tower("nexus-civic-b", "nexus", [(0.9, 4)], podium=dict(w=12, d=12, h=5.0), crown="garden", fp_kind="oct"),
    "nexus-civic-c": lambda: tower("nexus-civic-c", "nexus", [(1.0, 2), (0.85, 2), (0.65, 1)], podium=dict(w=12, d=10, h=5.0), crown="antenna", fp_kind="rect"),
    "nexus-terrace-a": lambda: tower("nexus-terrace-a", "nexus", [(1.0, 1), (0.8, 1)], podium=dict(w=12, d=9, h=4.5), crown="garden", fp_kind="rect"),
    "nexus-terrace-b": lambda: tower("nexus-terrace-b", "nexus", [(0.95, 2)], podium=dict(w=10, d=10, h=4.5), crown="garden", fp_kind="round"),
    "nexus-spire": lambda: tower("nexus-spire", "nexus", [(1.0, 3), (0.75, 2)], podium=dict(w=10, d=10, h=5.0), crown="spire", fp_kind="round"),
    # Neon City
    "neon-tower-a": lambda: tower("neon-tower-a", "neon", [(1.0, 10), (0.8, 8), (0.6, 4)], podium=dict(w=18, d=16, h=8.0), crown="neon-frame", fp_kind="chamfer", accent="#38e8ff"),
    "neon-tower-b": lambda: tower("neon-tower-b", "neon", [(1.0, 14), (0.7, 6)], podium=dict(w=16, d=16, h=8.0), crown="antenna", fp_kind="oct", accent="#ff2bd6"),
    "neon-tower-c": lambda: tower("neon-tower-c", "neon", [(1.0, 18)], podium=dict(w=14, d=12, h=7.0), crown="neon-frame", fp_kind="rect", accent="#9d6bff"),
    "neon-block-a": lambda: tower("neon-block-a", "neon", [(1.0, 4)], podium=dict(w=16, d=12, h=6.0), crown="neon-frame", fp_kind="rect", accent="#ff2bd6"),
    "neon-block-b": lambda: tower("neon-block-b", "neon", [(1.0, 5), (0.7, 2)], podium=dict(w=14, d=14, h=6.0), crown="antenna", fp_kind="chamfer", accent="#38e8ff"),
}

# Neon City skyline variants on neon-layout.ts footprints (TOWER_FOOTPRINT half-extents) and heights
NEON_VARIANTS = {"A": (6, 6, 56, "chamfer", "#38e8ff", "neon-frame"), "B": (7, 6, 64, "rect", "#ff2bd6", "antenna"), "C": (5, 5, 80, "oct", "#9d6bff", "neon-frame"),
                 "D": (8, 5, 26, "rect", "#ff2bd6", "neon-frame"), "E": (6, 7, 92, "chamfer", "#38e8ff", "antenna"), "F": (9, 7, 50, "rect", "#ffb347", "neon-frame")}
for _v, (_hx, _hz, _h, _fp, _acc, _crown) in NEON_VARIANTS.items():
    _floors = max(3, round((_h - 16) / FLOOR))
    _tiers = [(1.0, _floors)] if _h < 40 else [(0.92, round(_floors * 0.6)), (0.72, _floors - round(_floors * 0.6))]
    BUILDS[f"neon-v-{_v}"] = (lambda v=_v, hx=_hx, hz=_hz, fp=_fp, acc=_acc, cr=_crown, tiers=_tiers:
                              tower(f"neon-v-{v}", "neon", tiers, podium=dict(w=hx * 2, d=hz * 2, h=7.0), crown=cr, fp_kind=fp, accent=acc))

if __name__ == "__main__":
    for oid, fn in BUILDS.items():
        if ONLY and oid not in ONLY:
            continue
        fn()
