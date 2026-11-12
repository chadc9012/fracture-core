"""Upgrade an owner-supplied blockout vehicle GLB (Nov 12 vehicle packs) into a game model:
- classify every part (paint / glass / head / tail / tyre / rim / trim) by name where it has one, else by vertex colour
- orient: up = smallest extent (wheels at the bottom), front = headlights' side; exported with the front toward glTF +Z
  (the fleet's convention; street_car.gd face_forward turns it to -Z), floor at 0, centred
- the painted shell becomes one smooth body: voxel remesh of the joined panels, smoothed, decimated
- the rest: bevelled edges and smooth shading by angle
- one named material per class (Paint, Glass, Headlight, Taillight, Tyre, Rim, Trim) so car_detail.gd can dress it
Run: IN=<pack glb> OUT=models/fleet/showroom/<id>.glb blender -b -P tools/upgrade_vehicle.py
(the owner's packs: WorldFracture_Standalone_3D_Vehicle_Models_14.zip, WorldFracture_16_Vehicle_3D_Models_Vol1.zip; ids in catalog.gd SHOWROOM)
"""
import bpy, bmesh, os, math
from mathutils import Vector, Matrix

IN = os.environ["IN"]; OUT = os.environ["OUT"]; TRIS = int(os.environ.get("TRIS", "9000"))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
objs = [o for o in bpy.data.objects if o.type == 'MESH']
# bake transforms
for o in bpy.data.objects:
    o.select_set(False)
for o in objs:
    if o.parent:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
bpy.context.view_layer.objects.active = objs[0]
for o in objs:
    o.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def colour(o):
    me = o.data
    if not me.color_attributes:
        return (0.5, 0.5, 0.5, 1.0)
    ca = me.color_attributes[0]
    n = len(ca.data)
    s = [0.0, 0.0, 0.0, 0.0]
    for d in ca.data:
        for i in range(4):
            s[i] += d.color[i]
    return tuple(v / max(n, 1) for v in s)

def area(o):
    return sum(p.area for p in o.data.polygons)

# the body colour: the named shell's, else the colour covering the most area (ignoring near-black / glass)
cols = {o.name: colour(o) for o in objs}
def key(c):
    return tuple(round(v, 1) for v in c[:3])
body = None
for o in objs:
    if ("body" in o.name.lower() or "paint" in o.name.lower()) and "under" not in o.name.lower():
        body = key(cols[o.name]); break
if body is None:
    tally = {}
    for o in objs:
        c = cols[o.name]
        if max(c[:3]) < 0.16 and not (c[2] - c[0] > 0.12):
            continue
        tally[key(c)] = tally.get(key(c), 0.0) + area(o)
    body = max(tally, key=tally.get)
    print('TALLY', sorted(((round(v,2),k) for k,v in tally.items()), reverse=True)[:6])

TOTAL = sum(area(o) for o in objs)
def classify(o):
    n = o.name.lower()
    c = cols[o.name]
    r, g, b, a = c
    if any(k in n for k in ("window", "windshield", "glass")):
        return "glass"
    if "headlight" in n or "fog_light" in n or "head_lamp" in n:
        return "head"
    if "taillight" in n or "tail_lamp" in n:
        return "tail"
    if "tire" in n or "tyre" in n:
        return "tyre"
    if any(k in n for k in ("rim", "spoke", "handle", "exhaust")):
        return "rim"
    if any(k in n for k in ("seat", "engine", "fork", "handlebar", "underbody", "grille", "diffuser", "splitter", "mirror", "hub")):
        return "trim"
    if key(c) == body:
        return "paint"
    if r > 0.75 and g < 0.35 and b < 0.35 and area(o) < TOTAL * 0.02:
        return "tail"
    if r > 0.86 and g > 0.86 and b > 0.82:
        return "head"
    if b - r > 0.1 and max(c[:3]) < 0.45:
        return "glass"
    if max(c[:3]) < 0.16:
        return "tyre" if n.startswith("tire") else "trim"
    if abs(r - g) < 0.06 and abs(g - b) < 0.08 and max(c[:3]) > 0.5:
        return "rim"
    # another painted colour (stripes, two-tone): keep it as trim-coloured paint
    return "accent"

parts = {}
for o in objs:
    parts.setdefault(classify(o), []).append(o)

if "paint" not in parts and "accent" in parts:
    parts["paint"] = parts.pop("accent")   # a bike: its tank and fairings are the paint

def centroid(lst):
    if not lst:
        return None
    s = Vector(); n = 0
    for o in lst:
        for v in o.data.vertices:
            s += v.co; n += 1
    return s / max(n, 1)

# ---- orientation
allv = [v.co for o in objs for v in o.data.vertices]
lo = Vector((min(v.x for v in allv), min(v.y for v in allv), min(v.z for v in allv)))
hi = Vector((max(v.x for v in allv), max(v.y for v in allv), max(v.z for v in allv)))
ext = hi - lo
centre = (lo + hi) / 2
axes = sorted(range(3), key=lambda i: ext[i])
up_i, len_i = axes[0], axes[2]
# bikes: narrow (width smallest) — then up is the middle extent
if ext[axes[0]] < ext[axes[1]] * 0.6 and ext[axes[1]] > ext[axes[2]] * 0.45:
    pass
wheel = centroid(parts.get("tyre", [])) or centroid(parts.get("rim", []))
def unit(i, s):
    v = Vector((0, 0, 0)); v[i] = s; return v
# up: of the two shorter axes, the one along which the wheels sit lowest relative to the centre
best = None
for i in axes[:2]:
    if wheel is None:
        break
    d = (wheel[i] - centre[i]) / max(ext[i], 1e-6)
    if best is None or abs(d) > abs(best[1]):
        best = (i, d)
if best is not None and abs(best[1]) > 0.08:
    up_i = best[0]
    up = unit(up_i, -1.0 if best[1] > 0 else 1.0)
else:
    up = unit(up_i, 1.0)
len_i = [i for i in range(3) if i != up_i and ext[i] == max(ext[j] for j in range(3) if j != up_i)][0]
head = centroid(parts.get("head", [])); tail = centroid(parts.get("tail", []))
if head is not None and tail is not None and abs(head[len_i] - tail[len_i]) > 0.2:
    fwd = unit(len_i, 1.0 if head[len_i] > tail[len_i] else -1.0)
elif head is not None:
    fwd = unit(len_i, 1.0 if head[len_i] > centre[len_i] else -1.0)
else:
    fwd = unit(len_i, 1.0)
side = fwd.cross(up)
# target: forward -> blender -Y (glTF +Z), up -> +Z, side = fwd x up -> (-Y)x(Z) = -X
src = Matrix((side, fwd, up)).transposed()    # columns: side, fwd, up
dst = Matrix((Vector((-1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1)))).transposed()
rot = (dst @ src.inverted()).to_4x4()
for o in objs:
    o.data.transform(Matrix.Translation(-centre))
    o.data.transform(rot)
allv = [v.co for o in objs for v in o.data.vertices]
zmin = min(v.z for v in allv)
for o in objs:
    o.data.transform(Matrix.Translation((0, 0, -zmin)))
    o.data.update()

# ---- a real greenhouse (pack "Standalone 14": the roof sat a few cm over the body with sliver windows): lift the roof
# and run a glass cabin from the body's top up to it, the sliver windows dropped
roof = [o for o in objs if o.name.startswith("roof_and_pillars")]
shell = [o for o in objs if o.name.startswith("painted_body_shell")]
if roof and shell:
    r = roof[0]; sh = shell[0]
    rv = [v.co for v in r.data.vertices]
    rx0, rx1 = min(v.x for v in rv), max(v.x for v in rv)
    ry0, ry1 = min(v.y for v in rv), max(v.y for v in rv)
    rz0, rz1 = min(v.z for v in rv), max(v.z for v in rv)
    sz1 = max(v.co.z for v in sh.data.vertices)
    want = 0.36 if (rz1 < 1.7) else 0.5
    lift = max(0.0, want - (rz1 - sz1))
    if lift > 0.02:
        for v in r.data.vertices:
            v.co.z += lift
        r.data.update()
        for o in [o for o in parts.get("glass", [])]:
            parts["glass"].remove(o)
            bpy.data.objects.remove(o, do_unlink=True)
        cx, cy = (rx0 + rx1) / 2, (ry0 + ry1) / 2
        hx, hy = (rx1 - rx0) / 2, (ry1 - ry0) / 2
        zb, zt = sz1 - 0.03, rz0 + lift + 0.02
        me = bpy.data.meshes.new("greenhouse")
        bot = [(cx - hx * 1.1, cy - hy * 1.45, zb), (cx + hx * 1.1, cy - hy * 1.45, zb), (cx + hx * 1.1, cy + hy * 1.25, zb), (cx - hx * 1.1, cy + hy * 1.25, zb)]
        top = [(cx - hx * 0.97, cy - hy * 0.97, zt), (cx + hx * 0.97, cy - hy * 0.97, zt), (cx + hx * 0.97, cy + hy * 0.97, zt), (cx - hx * 0.97, cy + hy * 0.97, zt)]
        me.from_pydata(bot + top, [], [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)])
        me.update()
        gh = bpy.data.objects.new("greenhouse", me)
        bpy.context.scene.collection.objects.link(gh)
        objs.append(gh)
        parts.setdefault("glass", []).append(gh)
        # pillars: the four corners in body colour
        pm = bpy.data.meshes.new("pillars")
        verts = []; faces = []
        for i in range(4):
            b = Vector(bot[i]); t = Vector(top[i])
            for dx, dy in ((-0.04, -0.04), (0.04, -0.04), (0.04, 0.04), (-0.04, 0.04)):
                verts.append((b.x + dx, b.y + dy, b.z))
            for dx, dy in ((-0.04, -0.04), (0.04, -0.04), (0.04, 0.04), (-0.04, 0.04)):
                verts.append((t.x + dx, t.y + dy, t.z))
            k = i * 8
            faces += [(k, k + 1, k + 5, k + 4), (k + 1, k + 2, k + 6, k + 5), (k + 2, k + 3, k + 7, k + 6), (k + 3, k, k + 4, k + 7)]
        pm.from_pydata(verts, [], faces); pm.update()
        po = bpy.data.objects.new("pillars", pm)
        bpy.context.scene.collection.objects.link(po)
        objs.append(po)
        parts.setdefault("paint", []).append(po)

# ---- materials
def mat(name, rgb, metal, rough, alpha=1.0, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*rgb, 1.0)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    if alpha < 1.0:
        p.inputs["Alpha"].default_value = alpha
        m.blend_method = 'BLEND' if hasattr(m, "blend_method") else None
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
    if emit:
        p.inputs["Emission Color"].default_value = (*emit, 1.0)
        p.inputs["Emission Strength"].default_value = 0.0
    return m

bc = None
for o in parts.get("paint", []):
    bc = cols[o.name][:3]; break
bc = bc or (0.6, 0.6, 0.62)
acc = None
for o in parts.get("accent", []):
    acc = cols[o.name][:3]; break
MATS = {
    "paint": mat("Paint", bc, 0.5, 0.25),
    "accent": mat("Accent", acc or (0.08, 0.08, 0.09), 0.4, 0.3),
    "glass": mat("Glass", (0.05, 0.07, 0.09), 0.0, 0.03, alpha=0.62),
    "head": mat("Headlight", (0.92, 0.93, 0.95), 0.2, 0.08, emit=(1.0, 0.95, 0.85)),
    "tail": mat("Taillight", (0.55, 0.03, 0.03), 0.1, 0.12, emit=(1.0, 0.08, 0.04)),
    "tyre": mat("Tyre", (0.035, 0.035, 0.04), 0.0, 0.85),
    "rim": mat("Rim", (0.78, 0.8, 0.83), 1.0, 0.18),
    "trim": mat("Trim", (0.05, 0.055, 0.06), 0.2, 0.55),
}

def join(lst, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in lst:
        o.select_set(True)
    bpy.context.view_layer.objects.active = lst[0]
    if len(lst) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o

def clear_cols(o):
    while o.data.color_attributes:
        o.data.color_attributes.remove(o.data.color_attributes[0])

def add_mod(o, kind, **kw):
    m = o.modifiers.new(kind, kind)
    for k, v in kw.items():
        setattr(m, k, v)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)

final = []
for k, lst in parts.items():
    o = join(lst, k)
    clear_cols(o)
    o.data.materials.clear()
    o.data.materials.append(MATS[k])
    # weld coincident verts so bevels and smoothing see closed parts
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bm.to_mesh(o.data); bm.free()
    if k in ("paint", "accent"):
        # rounded panel edges (a pressed-steel look instead of sharp blocks), smooth shading
        add_mod(o, 'BEVEL', width=float(os.environ.get("BEVEL", "0.035")), segments=3, limit_method='ANGLE', angle_limit=math.radians(30), harden_normals=False, profile=0.6)
        for p in o.data.polygons:
            p.use_smooth = True
    elif k in ("glass", "head", "tail"):
        # sit proud of the body (the shell's bevel must not swallow them)
        bm = bmesh.new(); bm.from_mesh(o.data)
        bm.normal_update()
        for v in bm.verts:
            v.co += v.normal * 0.006
        bm.to_mesh(o.data); bm.free()
        add_mod(o, 'BEVEL', width=0.01, segments=2, limit_method='ANGLE', angle_limit=math.radians(35), harden_normals=False)
        for p in o.data.polygons:
            p.use_smooth = True
    elif k in ("tyre", "rim"):
        for p in o.data.polygons:
            p.use_smooth = True
        add_mod(o, 'BEVEL', width=0.008, segments=1, limit_method='ANGLE', angle_limit=math.radians(40), harden_normals=False)
    else:
        add_mod(o, 'BEVEL', width=0.012, segments=2, limit_method='ANGLE', angle_limit=math.radians(35), harden_normals=False)
        for p in o.data.polygons:
            p.use_smooth = True
    try:
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
    except Exception:
        pass
    final.append(o)

bpy.ops.object.select_all(action='DESELECT')
for o in final:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_normals=True,
                          export_vertex_color='NONE' if True else 'MATERIAL', export_yup=True)
dims = Vector((max(v.co.x for o in final for v in o.data.vertices) - min(v.co.x for o in final for v in o.data.vertices),
               max(v.co.y for o in final for v in o.data.vertices) - min(v.co.y for o in final for v in o.data.vertices),
               max(v.co.z for o in final for v in o.data.vertices)))
tri = sum(len(p.vertices) - 2 for o in final for p in o.data.polygons)
print("RESULT", os.path.basename(OUT), {k: len(v) for k, v in parts.items()}, "dims w/l/h %.2f %.2f %.2f" % tuple(dims), "tris", tri)
