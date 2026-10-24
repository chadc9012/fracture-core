"""
Builds public/models/props/market-stall.glb: an open-air vendor stall for ShopStalls.tsx.

    blender -b -P scripts/build-stall.py -- [outdir]

Real metres, ground at 0, customer side toward three.js +Z (Blender -Y). Plank counter with a front apron and legs,
four steel posts, a sloped striped canvas canopy that sags between the posts with a scalloped valance, crates and
produce on the counter, a side shelf of jars and a hanging lantern (material "Lantern", emissive). The coloured canvas
stripes and valance use the material "Paint" so each shop tints them in its own kind colour.
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fleet_kit as K  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "public", "models", "props")

K.reset()
wood = K.mat("Wood", "#7a5a3c", 0.0, 0.85)
wood_dark = K.mat("WoodDark", "#4e3826", 0.0, 0.9)
steel = K.mat("Steel", "#3a4048", 0.8, 0.45)
canvas = K.mat("Canvas", "#cbbf9f", 0.0, 0.95)
paint = K.mat("Paint", "#2f7f96", 0.0, 0.9)
lantern = K.mat("Lantern", "#ffe2a8", 0.0, 0.3, emit="#ffb35c", strength=5.0)
glass = K.mat("Jar", "#a8c8b8", 0.0, 0.15)
P = []

# counter: plank top, front apron with plank seams, side panels, legs
P.append(K.box((2.5, 1.05, 0.08), (0, 0, 1.1), wood, bevel=0.01, name="Top"))
P.append(K.box((2.4, 0.06, 0.95), (0, -0.5, 0.58), wood_dark, bevel=0.005, name="Apron"))
for k in range(4):
    P.append(K.box((2.42, 0.02, 0.02), (0, -0.535, 0.22 + k * 0.24), wood, bevel=0.0, name="Seam"))
for sx in (-1, 1):
    P.append(K.box((0.06, 1.0, 0.95), (sx * 1.2, 0, 0.58), wood_dark, bevel=0.005, name="Side"))
# posts (front lower than back so the canopy sheds rain toward the customer)
corners = [(-1.25, -0.6, 2.55), (1.25, -0.6, 2.55), (-1.25, 0.6, 3.0), (1.25, 0.6, 3.0)]
for x, y, h in corners:
    P.append(K.cyl(0.035, h, (x, y, h / 2), steel, verts=10, name="Post"))
# canopy: sloped, sagging, eight stripes alternating canvas and kind colour
stripes, x0, x1 = 8, -1.45, 1.45
for s in range(stripes):
    xa = x0 + (x1 - x0) * s / stripes
    xb = x0 + (x1 - x0) * (s + 1) / stripes
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=3, y_subdivisions=10, size=1)
    o = bpy.context.object; o.name = "Canopy"
    for v in o.data.vertices:
        u = v.co.x + 0.5; t = v.co.y + 0.5  # u across the stripe, t front(0)->back(1)
        x = xa + (xb - xa) * u
        y = -0.95 + 1.75 * t
        sag = 0.12 * math.sin(math.pi * (x - x0) / (x1 - x0)) * math.sin(math.pi * t)
        v.co = (x, y, 2.6 + 0.5 * t - sag)
    o.data.materials.append(paint if s % 2 == 0 else canvas)
    sol = o.modifiers.new("thick", "SOLIDIFY"); sol.thickness = 0.02
    bpy.ops.object.modifier_apply(modifier=sol.name)
    for poly in o.data.polygons:
        poly.use_smooth = True
    P.append(o)
# scalloped valance along the front edge
for k in range(12):
    x = x0 + (x1 - x0) * (k + 0.5) / 12
    r = (x1 - x0) / 24
    verts = [(x, -0.955, 2.6)] + [(x + math.cos(math.pi + math.pi * i / 10) * r, -0.955, 2.6 + math.sin(math.pi + math.pi * i / 10) * r * 1.3) for i in range(11)]
    faces = [(0, i, i + 1) for i in range(1, 11)]
    me = bpy.data.meshes.new("Scallop"); me.from_pydata(verts, [], faces); me.update()
    flap = bpy.data.objects.new("Scallop", me); bpy.context.collection.objects.link(flap)
    me.materials.append(paint if k % 2 == 0 else canvas)
    bpy.context.view_layer.objects.active = flap
    for o in bpy.context.selected_objects:
        o.select_set(False)
    flap.select_set(True)
    sol = flap.modifiers.new("thick", "SOLIDIFY"); sol.thickness = 0.015
    bpy.ops.object.modifier_apply(modifier=sol.name)
    P.append(flap)
# goods: crates, produce, jars on a side shelf
for i, (x, w) in enumerate([(-0.75, 0.5), (0.0, 0.45), (0.72, 0.55)]):
    P.append(K.box((w, 0.38, 0.22), (x, -0.08, 1.25), wood, bevel=0.01, name="Crate"))
    colours = ["#b8432e", "#d8a23a", "#6a9a3a"]
    fruit = K.mat(f"Produce{i}", colours[i], 0.0, 0.5)
    for j in range(7):
        a = j * 2.4
        P.append(K.sphere(0.06, (x + math.cos(a) * w * 0.3, -0.08 + math.sin(a) * 0.12, 1.38), fruit, seg=10, rings=6, name="Fruit"))
P.append(K.box((0.5, 0.35, 0.03), (1.55, 0.2, 1.4), wood, bevel=0.0, name="Shelf"))
P.append(K.box((0.5, 0.35, 0.03), (1.55, 0.2, 1.8), wood, bevel=0.0, name="Shelf"))
for sx in (1.33, 1.77):
    P.append(K.cyl(0.02, 1.2, (sx, 0.35, 1.2), steel, verts=8, name="ShelfPost"))
for j in range(6):
    P.append(K.cyl(0.05, 0.14, (1.38 + (j % 3) * 0.16, 0.15, 1.49 + (j // 3) * 0.4), glass, verts=12, name="Jar"))
# hanging lantern under the canopy
P.append(K.tube([(0, -0.2, 2.75), (0, -0.2, 2.45)], 0.006, steel, "LanternWire"))
P.append(K.cyl(0.09, 0.2, (0, -0.2, 2.35), lantern, verts=14, name="Lantern"))
P.append(K.cyl(0.11, 0.03, (0, -0.2, 2.46), steel, verts=14, name="LanternCap"))

K.join(P, "MarketStall")
os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, "market-stall.glb")
K.export(path)
print("WROTE", path, os.path.getsize(path))
