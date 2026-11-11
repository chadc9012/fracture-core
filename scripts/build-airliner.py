"""
Builds the airports' airliner: godot-world-fracture/models/fleet/airliner.glb (Nov 10; the terminals used box-and-capsule
stand-ins). A twin-engine narrow-body ~40 m long, in real metres, nose toward glTF -Z (Blender +Y), wheels on y = 0.

    blender -b -P scripts/build-airliner.py -- [out.glb]

Materials, by name, so the game can repaint it per airline:
  Body     white paint with the windows, doors and panel lines painted into a generated texture
  Livery   the airline's colour: the tail fin, the cheat line under the windows, winglets, engine bands (airport_view.gd
           replaces this one with the airline's colour)
  Glass    the cockpit windows
  Metal    nacelle lips, gear legs, leading edges
  Dark     the fan faces, tyres, the wing walkway
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "godot-world-fracture", "models", "fleet", "airliner.glb")

L = 40.0          # fuselage length (Blender Y: 0 at the tail, L at the nose)
R = 2.05          # cabin radius
ZC = 3.55         # cabin centre height above the ground
RING = 36         # verts round the fuselage
STATIONS = 84


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, rough=0.4, metal=0.0, image=None, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if image is not None:
        t = m.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = image
        m.node_tree.links.new(t.outputs["Color"], b.inputs["Base Color"])
    return m


# ------------------------------------------------------------------------------------------- the body texture
def body_image():
    """u runs nose (u=1) to tail (u=0) along the fuselage, v round it (0 = bottom, 0.5 = top, through the right side at
    0.25). White paint, a row of windows each side, doors, faint panel seams."""
    W, H = 2048, 512
    img = np.ones((H, W, 4), dtype=np.float32)
    img[..., :3] = 0.95
    def px(u):
        return int(u * (W - 1))
    def py(v):
        return int(v * (H - 1))
    # panel seams round the body every ~2.4 m
    for k in range(1, 17):
        x = px(k / 17.0)
        img[:, x:x + 1, :3] *= 0.93
    # the window rows: just above the cabin's widest line on each side (v 0.29 right, 0.71 left)
    for vc in (0.295, 0.705):
        y0, y1 = py(vc - 0.012), py(vc + 0.012)
        u = 0.18
        while u < 0.86:
            if not (0.40 < u < 0.43):   # the gap over the wing exits
                x0 = px(u)
                img[y0:y1, x0:x0 + 9, :3] = (0.08, 0.1, 0.14)
            u += 0.0105
        # doors: front, over-wing, rear
        for ud in (0.86, 0.415, 0.165):
            x0 = px(ud)
            img[py(vc - 0.07):py(vc + 0.03), x0:x0 + 3, :3] = 0.55
            img[py(vc - 0.07):py(vc + 0.03), x0 + 34:x0 + 37, :3] = 0.55
            img[py(vc + 0.03):py(vc + 0.03) + 3, x0:x0 + 37, :3] = 0.55
    im = bpy.data.images.new("airliner_body", W, H, alpha=True)
    im.pixels = img[::-1].ravel()   # Blender images start at the bottom row
    im.file_format = "PNG"
    im.pack()
    return im


# ------------------------------------------------------------------------------------------- the fuselage
def profile(t):
    """radius and centre-line height at t (0 tail .. 1 nose)"""
    if t > 0.86:                       # the nose: an ogive down to a rounded tip
        s = (t - 0.86) / 0.14
        r = R * math.sqrt(max(0.0, 1.0 - s ** 2.2)) * (1.0 - 0.06 * s)
        z = ZC - 0.35 * s ** 1.6       # the nose droops a little, as real ones do
        return max(r, 0.02), z
    if t < 0.3:                        # the tail cone: tapers and sweeps up
        s = (0.3 - t) / 0.3
        r = R * (1.0 - 0.86 * s ** 1.15)
        z = ZC + 1.25 * s ** 1.4
        return r, z
    return R, ZC


def fuselage(mats):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    rings = []
    for i in range(STATIONS + 1):
        t = i / STATIONS
        r, z = profile(t)
        y = t * L
        ring = []
        for k in range(RING):
            a = k / RING * math.tau                      # 0 at the bottom, going up the right side
            x = math.sin(a) * r
            zz = z - math.cos(a) * r * (1.0 if math.cos(a) > 0 else 0.97)   # a slightly fuller crown
            ring.append(bm.verts.new((x, y, zz)))
        rings.append((t, ring))
    for i in range(STATIONS):
        t0, a = rings[i]
        t1, b = rings[i + 1]
        for k in range(RING):
            k2 = (k + 1) % RING
            f = bm.faces.new((a[k], a[k2], b[k2], b[k]))
            v0, v1 = k / RING, (k + 1) / RING
            for loop, (uu, vv) in zip(f.loops, ((t0, v0), (t0, v1), (t1, v1), (t1, v0))):
                loop[uv].uv = (uu, vv)
            tc = (t0 + t1) * 0.5
            vc = (v0 + v1) * 0.5
            # cockpit windows: a band across the top of the nose
            if 0.893 < tc < 0.925 and (0.345 < vc < 0.425 or 0.575 < vc < 0.655):
                f.material_index = 2
            # the cheat line below the windows, both sides, along the cabin
            elif 0.12 < tc < 0.9 and (0.255 < vc < 0.27 or 0.73 < vc < 0.745):
                f.material_index = 1
            else:
                f.material_index = 0
    # cap the tail end
    bm.faces.new(list(reversed(rings[0][1]))).material_index = 0
    me = bpy.data.meshes.new("Fuselage")
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("Fuselage", me)
    bpy.context.collection.objects.link(ob)
    return ob


# ------------------------------------------------------------------------------------------- lifting surfaces
def airfoil(n=14, thick=0.12):
    """a symmetric NACA-00xx section: points round from the trailing edge over the top and back under"""
    pts = []
    for i in range(n + 1):
        x = 0.5 - 0.5 * math.cos(math.pi * i / n)
        yt = 5 * thick * (0.2969 * math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4)
        pts.append((x, yt))
    top = list(reversed(pts))
    bot = [(x, -y) for x, y in pts[1:-1]]
    return top + bot


def surface(name, root, tip, span, sweep, dihedral, chord_root, chord_tip, mat, vertical=False, thick=0.12, side=1, sections=10, twist=0.0):
    """a wing-like surface from `root` (x, y, z of the root leading edge) out `span` metres; chords along -Y (back)"""
    sec = airfoil(14, thick)
    bm = bmesh.new()
    rings = []
    for i in range(sections + 1):
        s = i / sections
        c = chord_root + (chord_tip - chord_root) * s
        out = span * s
        back = math.tan(math.radians(sweep)) * out
        ring = []
        for (fx, fy) in sec:
            if vertical:
                x = root[0] + fy * c
                z = root[2] + out
                y = root[1] - back - fx * c
            else:
                x = root[0] + side * out * math.cos(math.radians(dihedral))
                z = root[2] + out * math.sin(math.radians(dihedral)) + fy * c
                y = root[1] - back - fx * c
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    n = len(sec)
    for i in range(sections):
        a, b = rings[i], rings[i + 1]
        for k in range(n):
            k2 = (k + 1) % n
            q = (a[k], a[k2], b[k2], b[k]) if (side > 0 or vertical) else (b[k], b[k2], a[k2], a[k])
            bm.faces.new(q)
    tipface = rings[-1] if (side > 0 or vertical) else list(reversed(rings[-1]))
    bm.faces.new(tipface)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def lathe(name, prof, at, mats_by_seg, axis_back=True, seg=28):
    """a body of revolution round an axis along Y: prof = [(dy, r, mat_index)], going back from `at`"""
    bm = bmesh.new()
    rings = []
    for (dy, r, mi) in prof:
        ring = []
        for k in range(seg):
            a = k / seg * math.tau
            ring.append(bm.verts.new((at[0] + math.cos(a) * r, at[1] - dy, at[2] + math.sin(a) * r)))
        rings.append((ring, mi))
    for i in range(len(rings) - 1):
        a, mi = rings[i]
        b, _ = rings[i + 1]
        for k in range(seg):
            k2 = (k + 1) % seg
            f = bm.faces.new((a[k], b[k], b[k2], a[k2]))
            f.material_index = mi
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats_by_seg:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def box(name, size, at, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    ob.data.materials.append(mat)
    return ob


def cylinder(name, r, depth, at, mat, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=at, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return ob


def build():
    reset()
    img = body_image()
    body = material("Body", (0.95, 0.95, 0.96), 0.35, 0.05, image=img)
    livery = material("Livery", (0.2, 0.45, 0.9), 0.35, 0.1)
    glass = material("Glass", (0.03, 0.05, 0.08), 0.05, 0.6)
    metal = material("Metal", (0.72, 0.74, 0.77), 0.25, 0.9)
    dark = material("Dark", (0.06, 0.06, 0.07), 0.6, 0.2)
    grey = material("Wing", (0.86, 0.87, 0.89), 0.4, 0.15)

    fuselage([body, livery, glass])
    # wings: low-mounted at ~40% from the tail, swept 27°, 5° dihedral
    wy = L * 0.56
    for side in (1, -1):
        surface("Wing" + ("R" if side > 0 else "L"), (side * 1.2, wy, ZC - 1.35), None, 16.5, 27.0, 5.5, 7.2, 1.6, grey, side=side, thick=0.13, sections=8)
        # winglet: up from the tip, in the airline colour
        tip_x = side * (1.2 + 16.5 * math.cos(math.radians(5.5)))
        tip_y = wy - math.tan(math.radians(27.0)) * 16.5
        tip_z = ZC - 1.35 + 16.5 * math.sin(math.radians(5.5))
        surface("Winglet" + ("R" if side > 0 else "L"), (tip_x, tip_y, tip_z + 0.05), None, 2.2, 38.0, 0, 1.5, 0.55, livery, vertical=True, thick=0.1, sections=3)
        # horizontal stabiliser at the tail
        surface("Stab" + ("R" if side > 0 else "L"), (side * 0.35, L * 0.11, ZC + 1.0), None, 6.2, 32.0, 6.0, 3.6, 1.2, grey, side=side, thick=0.1, sections=5)
        # the engine: a nacelle slung under the wing on a pylon, ~35% out
        ex = side * 5.6
        ey = wy + 2.6 - math.tan(math.radians(27.0)) * 4.4
        ez = ZC - 2.4
        lathe("Engine" + ("R" if side > 0 else "L"), [
            (-0.05, 1.0, 1), (0.0, 1.18, 1), (0.25, 1.24, 0), (1.6, 1.22, 2), (2.4, 1.18, 0), (3.6, 0.92, 0), (4.3, 0.62, 1), (4.5, 0.42, 3)],
            (ex, ey, ez), [body, metal, livery, dark])
        # the fan face inside the intake, and the exhaust cone
        cylinder("Fan" + ("R" if side > 0 else "L"), 1.0, 0.1, (ex, ey - 0.35, ez), dark, rot=(math.pi / 2, 0, 0), verts=24)
        lathe("Cone" + ("R" if side > 0 else "L"), [(4.4, 0.4, 0), (5.0, 0.05, 0)], (ex, ey, ez), [metal], seg=14)
        box("Pylon" + ("R" if side > 0 else "L"), (0.32, 3.6, 1.2), (ex, ey - 1.6, ez + 1.25), grey)
        # main gear: two legs, four wheels each side
        gx = side * 3.1
        gy = wy - 3.9
        cylinder("GearLeg" + ("R" if side > 0 else "L"), 0.16, 2.4, (gx, gy, 1.65), metal)
        for dy in (-0.55, 0.55):
            for dx in (-0.32, 0.32):
                cylinder("Tyre", 0.58, 0.36, (gx + dx, gy + dy, 0.58), dark, rot=(0, math.pi / 2, 0), verts=18)
    # the fin, swept 38°, in the airline colour
    surface("Fin", (0.0, L * 0.16, ZC + 1.6), None, 7.4, 38.0, 0, 6.2, 2.2, livery, vertical=True, thick=0.11, sections=6)
    # nose gear
    cylinder("NoseLeg", 0.12, 2.1, (0, L * 0.9, 1.35), metal)
    for dx in (-0.22, 0.22):
        cylinder("NoseTyre", 0.42, 0.26, (dx, L * 0.9, 0.42), dark, rot=(0, math.pi / 2, 0), verts=16)
    # the wing-to-body fairing
    lathe("Fairing", [(0, 0.2, 0), (1.5, 1.6, 0), (7.5, 1.7, 0), (10.5, 0.2, 0)], (0, wy + 2.0, ZC - 1.55), [grey], seg=20).scale = (1.25, 1.0, 0.45)

    # one object, centred on the cabin, for a clean import
    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = bpy.data.objects["Fuselage"]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = "Airliner"
    # centre the length on the origin (the game positions it by its middle)
    for v in ob.data.vertices:
        v.co.y -= L * 0.5
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", use_selection=False, export_apply=True)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print("airliner:", OUT, "triangles", tris)


build()
