"""
Parametric vehicle kit for Blender (bpy). Shared by scripts/build-fleet.py.

Car bodies are lofted: a cross-section (rocker, door bulge, shoulder, glasshouse with tumblehome, roof crown) is swept
along the length, with every dimension a smooth profile of u (0 = nose, 1 = tail). The glasshouse collapses into a
crowned hood/deck where the roof profile meets the beltline, so one continuous surface carries hood, windscreen, roof
and boot. Faces are tagged paint / glass / trim while lofting, wheel arches are cut with booleans, and real wheels
(lathed tyre with tread blocks, spoked rim, brake disc, caliper) hang under named nodes the game spins and steers.

Frame: metres, Blender Z up, nose toward -Y (the glTF exporter turns this into three.js +Z forward, Y up),
ground at z = 0. Node names the game relies on: SteerFL/SteerFR (front wheel pivots), WheelFL/FR/RL/RR (spin about X),
materials named Headlight / Taillight / Glass / Paint*.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- scene / materials

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()


_mats: dict = {}


def mat(name, color, metal=0.0, rough=0.5, coat=0.0, coat_rough=0.03, emit=None, strength=0.0, alpha=1.0, spec=0.5):
    key = name
    if key in _mats and _mats[key].name in bpy.data.materials:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb_to_linear(color), 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = spec
    if coat:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = coat_rough
    if emit:
        b.inputs["Emission Color"].default_value = (*srgb_to_linear(emit), 1)
        b.inputs["Emission Strength"].default_value = strength
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    _mats[key] = m
    return m


def srgb_to_linear(hexcol):
    h = hexcol.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def standard_mats(paint_hex, paint_metal=0.55, paint_rough=0.32, accent="#38e8ff", glass_tint="#0d1218"):
    _mats.clear()
    return {
        "paint": mat("Paint", paint_hex, paint_metal, paint_rough, coat=1.0, coat_rough=0.04),
        "glass": mat("Glass", glass_tint, 0.0, 0.03, alpha=0.8, spec=1.0),
        "trim": mat("Trim", "#0b0c0e", 0.2, 0.55),
        "satin": mat("SatinBlack", "#141518", 0.6, 0.38),
        "chrome": mat("Chrome", "#e8ecf0", 1.0, 0.08),
        "rubber": mat("Rubber", "#1a1a1c", 0.0, 0.86, spec=0.3),
        "rim": mat("Rim", "#a9b0b8", 1.0, 0.22),
        "disc": mat("BrakeDisc", "#6e7072", 1.0, 0.35),
        "caliper": mat("Caliper", "#c8202a", 0.3, 0.35, coat=0.6),
        "head": mat("Headlight", "#f4fbff", 0.0, 0.1, emit="#e8f6ff", strength=6.0),
        "tail": mat("Taillight", "#ff1a12", 0.0, 0.15, emit="#ff1a0d", strength=3.0),
        "accent": mat("Accent", accent, 0.0, 0.2, emit=accent, strength=4.0),
        "interior": mat("Interior", "#1c1d21", 0.0, 0.8),
        "steel": mat("Steel", "#5b6066", 0.9, 0.45),
        "rust": mat("RustSteel", "#5a3b2a", 0.6, 0.75),
    }


# ---------------------------------------------------------------- profiles

def profile(points, n):
    """Smooth profile through (u, value) control points sampled at n stations (Catmull-Rom in u)."""
    pts = sorted(points)
    us = np.linspace(0, 1, n)
    xs = np.array([p[0] for p in pts]); ys = np.array([p[1] for p in pts])
    out = np.interp(us, xs, ys)
    # light smoothing keeps the control silhouette while removing kinks
    k = np.array([1, 4, 6, 4, 1], float); k /= k.sum()
    for _ in range(3):
        pad = np.pad(out, 2, mode="edge")
        out = np.convolve(pad, k, mode="valid")
    return us, out


# ---------------------------------------------------------------- lofted body

def loft_body(spec, mats, name="Body"):
    """spec keys: length, n (stations), halfw, bottom, belt, roof, ghw (glasshouse half-width at the roof as a fraction of
    halfw), crown (hood crown), ws (u where windscreen starts, u where roof starts), rw (u roof ends, u rear glass ends),
    pillars (list of u for B/C pillars), glass_roof (bool)."""
    L = spec["length"]; n = spec.get("n", 72)
    us, hw = profile(spec["halfw"], n)
    _, zb = profile(spec["bottom"], n)
    _, zbelt = profile(spec["belt"], n)
    _, zroof = profile(spec["roof"], n)
    _, ghw = profile(spec["ghw"], n)
    cr = spec.get("crown", 0.05)
    _, crown_p = profile(cr if isinstance(cr, list) else [(0, cr), (1, cr)], n)
    hmax = max(1e-3, float(np.max(zroof - zbelt)))
    lower = [(0.0, 0.0), (0.84, 0.0), (0.95, 0.04), (0.985, 0.3), (1.0, 0.62), (0.995, 0.8), (0.975, 0.93), (0.93, 1.0)]  # (x frac, z frac of belt-bottom)
    UPPER = 7  # points in the upper arc, excluding the shoulder point
    verts = []
    upper_start = len(lower)
    for i, u in enumerate(us):
        y = -L / 2 + u * L
        w = hw[i]; b = zb[i]; t = zbelt[i]; h = max(0.0, zroof[i] - t)
        g = min(1.0, h / (0.55 * hmax))
        sec = [(x * w, b + z * (t - b)) for x, z in lower]
        gw = ghw[i] * w
        for k in range(1, UPPER + 1):
            s = k / UPPER  # 0 at shoulder -> 1 at centre
            # hood / deck: crowned surface from shoulder to centre
            hx = 0.93 * w * (1 - s)
            hz = t + crown_p[i] * (1 - (1 - s) ** 2)
            # glasshouse: up the side glass with tumblehome, round over the roof
            if s <= 0.55:
                q = s / 0.55
                gx = 0.9 * w + (gw - 0.9 * w) * q - 0.03 * w * math.sin(q * math.pi)
                gz = t + 0.02 + h * (0.88 * (1 - (1 - q) ** 1.6))
            else:
                q = (s - 0.55) / 0.45
                gx = gw * math.cos(q * math.pi / 2) ** 0.7 * (1 - q * 0.02)
                gz = t + h * (0.88 + 0.12 * math.sin(q * math.pi / 2))
            sec.append((hx + (gx - hx) * g, hz + (gz - hz) * g))
        verts.append([(x, y, z) for x, z in sec])
    m = len(verts[0])  # points per half section, centre-bottom first, centre-top last
    # mirror into a full ring: right half (x>=0) then left half reversed, skipping the shared centre points
    rings = []
    for sec in verts:
        right = sec
        left = [(-x, y, z) for x, y, z in reversed(sec[1:-1])]
        rings.append(right + left)
    R = len(rings[0])
    bm = bmesh.new()
    vv = [[bm.verts.new(p) for p in ring] for ring in rings]
    tags = []

    def tag(i, j):
        """material for the quad between station i..i+1 and ring point j..j+1"""
        j2 = (j + 1) % R
        jj = j if j < m else R - j  # mirror index into half-section numbering (0..m-1)
        jj2 = j2 if j2 < m else R - j2
        top_idx = min(jj, jj2)
        u0, u1 = us[i], us[i + 1]; uc = (u0 + u1) / 2
        h = max(0.0, (zroof[i] + zroof[i + 1]) / 2 - (zbelt[i] + zbelt[i + 1]) / 2)
        if top_idx < upper_start or h < 0.22 * hmax:
            return "paint"
        side = top_idx < upper_start + 3  # side glass band (shoulder sill .. top of the side glass)
        ws0, ws1 = spec["ws"]; rw0, rw1 = spec["rw"]
        if side:
            if top_idx == upper_start:  # window sill line
                return "trim"
            for p in spec.get("pillars", []):
                if abs(uc - p) < 0.018:
                    return "paint" if spec.get("body_pillars") else "trim"
            g0, g1 = spec.get("side_glass", (ws0 + 0.05, rw1 - 0.07))
            return "glass" if g0 < uc < g1 else "paint"
        a_pillar = top_idx == upper_start + 3
        if ws0 + 0.01 < uc < ws1 or rw0 < uc < rw1 - 0.01:
            return "paint" if a_pillar else "glass"
        if spec.get("glass_roof") and ws1 + 0.03 < uc < rw0 - 0.03 and not a_pillar:
            return "glass"
        return "paint"

    for i in range(n - 1):
        for j in range(R):
            a, b2 = vv[i][j], vv[i][(j + 1) % R]
            c, d = vv[i + 1][(j + 1) % R], vv[i + 1][j]
            f = bm.faces.new((a, d, c, b2))
            tags.append(tag(i, j))
    # end caps
    for idx in (0, n - 1):
        ring = vv[idx]
        cx = sum(v.co.x for v in ring) / R; cy = ring[0].co.y + (-0.05 if idx == 0 else 0.05); cz = sum(v.co.z for v in ring) / R
        c = bm.verts.new((cx, cy, cz))
        for j in range(R):
            v1, v2 = ring[j], ring[(j + 1) % R]
            f = bm.faces.new((v1, v2, c) if idx == n - 1 else (v2, v1, c))
            tags.append("paint")
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    order = ["paint", "glass", "trim"]
    for k in order:
        me.materials.append(mats[k])
    for p, t in zip(me.polygons, tags):
        p.material_index = order.index(t)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    fix_normals(ob)
    return ob, (us, hw, zb, zbelt, zroof)


def fix_normals(ob):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def shade_auto(ob, angle=40):
    try:
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        for p in ob.data.polygons:
            p.use_smooth = True


def cut_arches(body, wheels, radius, width, flare=0.05):
    """Boolean the wheel arches out of the body (cylinders along X through each hub)."""
    for (x, y, z) in wheels:
        bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=radius + flare, depth=width + 0.6, location=(math.copysign(abs(x) + 0.2, x), y, z), rotation=(0, math.pi / 2, 0))
        cutter = bpy.context.object
        mod = body.modifiers.new("arch", "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.object = cutter; mod.solver = "EXACT"
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)


def arch_liners(wheels, radius, width, m, name="ArchLiner"):
    """Dark half-tube liners inside the cut arches so you never see through the body."""
    obs = []
    for (x, y, z) in wheels:
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius + 0.03, depth=width * 0.8, location=(x * 0.78, y, z), rotation=(0, math.pi / 2, 0), end_fill_type="NOTHING")
        o = bpy.context.object
        bm = bmesh.new(); bm.from_mesh(o.data)
        for f in list(bm.faces):
            if f.calc_center_median().z < 0.0:
                bm.faces.remove(f)
        bm.to_mesh(o.data); bm.free()
        o.data.materials.append(m)
        obs.append(o)
    return join(obs, name)


# ---------------------------------------------------------------- primitives

def box(size, at, m, bevel=0.01, rot=(0, 0, 0), name="Box", segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = bpy.context.object; o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new("bev", "BEVEL"); b.width = bevel; b.segments = segments; b.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=b.name)
    o.data.materials.append(m)
    shade_auto(o, 35)
    return o


def cyl(r, depth, at, m, rot=(0, 0, 0), verts=24, name="Cyl", r2=None, bevel=0.0):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=at, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=at, rotation=rot)
    o = bpy.context.object; o.name = name
    if bevel:
        b = o.modifiers.new("bev", "BEVEL"); b.width = bevel; b.segments = 2; b.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=b.name)
    o.data.materials.append(m)
    shade_auto(o, 35)
    return o


def sphere(r, at, m, scale=(1, 1, 1), name="Sph", seg=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=at)
    o = bpy.context.object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def tube(points, r, m, name="Tube", verts=10):
    """Round bar along a polyline (roll cages, bull bars, exhausts)."""
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"
    sp = cu.splines.new("POLY"); sp.points.add(len(points) - 1)
    for p, c in zip(sp.points, points):
        p.co = (*c, 1)
    cu.bevel_depth = r; cu.bevel_resolution = 2; cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    for s in bpy.context.selected_objects:
        s.select_set(False)
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.object
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def join(objs, name):
    objs = [o for o in objs if o]
    if not objs:
        return None
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.object; o.name = name
    return o


def lathe(profile_pts, segments, m, name="Lathe", axis_x=True):
    """Revolve (radius, x) profile points around the X axis."""
    bm = bmesh.new()
    rings = []
    for k in range(segments):
        a = 2 * math.pi * k / segments
        ring = [bm.verts.new((x, r * math.cos(a), r * math.sin(a))) for r, x in profile_pts]
        rings.append(ring)
    for k in range(segments):
        r0, r1 = rings[k], rings[(k + 1) % segments]
        for j in range(len(profile_pts) - 1):
            bm.faces.new((r0[j], r0[j + 1], r1[j + 1], r1[j]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    fix_normals(o)
    return o


# ---------------------------------------------------------------- wheels

def tyre(radius, width, mats, tread="street", segments=56):
    """Tyre with a rounded sidewall and tread blocks cut into the crown (geometry, not texture)."""
    side_r = radius * 0.62 if tread == "street" else radius * 0.56
    hw = width / 2
    prof = [(side_r, -hw * 0.92), (side_r + (radius - side_r) * 0.35, -hw), (radius * 0.97, -hw * 0.96), (radius, -hw * 0.8),
            (radius, hw * 0.8), (radius * 0.97, hw * 0.96), (side_r + (radius - side_r) * 0.35, hw), (side_r, hw * 0.92)]
    o = lathe(prof, segments, mats["rubber"], "Tyre")
    # tread: push alternate crown vertices in to make blocks / grooves
    bm = bmesh.new(); bm.from_mesh(o.data)
    depth = 0.012 if tread == "street" else 0.03
    for v in bm.verts:
        r = math.hypot(v.co.y, v.co.z)
        if r > radius * 0.995:
            a = math.atan2(v.co.z, v.co.y)
            blk = int((a + math.pi) / (2 * math.pi) * segments)
            groove = (blk % 2 == 0) if tread != "street" else (blk % 4 == 0)
            if groove:
                s = (r - depth) / r
                v.co.y *= s; v.co.z *= s
    bm.to_mesh(o.data); bm.free()
    return o


def rim(radius, width, mats, spokes=5, style="split"):
    parts = []
    inner = radius * 0.62
    barrel = lathe([(inner * 0.96, -width * 0.42), (inner, -width * 0.38), (inner, width * 0.36), (inner * 1.03, width * 0.42), (inner * 0.92, width * 0.44)], 40, mats["rim"], "Barrel")
    parts.append(barrel)
    hub = cyl(inner * 0.2, width * 0.3, (width * 0.28, 0, 0), mats["rim"], rot=(0, math.pi / 2, 0), verts=20)
    parts.append(hub)
    cap = cyl(inner * 0.1, width * 0.05, (width * 0.44, 0, 0), mats["satin"], rot=(0, math.pi / 2, 0), verts=16)
    parts.append(cap)
    n = spokes * (2 if style == "split" else 1)
    for k in range(n):
        a = 2 * math.pi * k / n + (0.12 if style == "split" and k % 2 else 0)
        s = box((width * 0.12, inner * 0.82, inner * 0.13), (width * 0.33, 0, 0), mats["rim"], bevel=0.006, name="Spoke")
        s.location = (width * 0.33, math.cos(a) * inner * 0.52, math.sin(a) * inner * 0.52)
        s.rotation_euler = (a + math.pi / 2, 0, 0)
        bpy.context.view_layer.objects.active = s
        bpy.ops.object.transform_apply(location=True, rotation=True)
        parts.append(s)
    # lug nuts
    for k in range(5):
        a = 2 * math.pi * k / 5
        parts.append(cyl(inner * 0.035, width * 0.08, (width * 0.4, math.cos(a) * inner * 0.13, math.sin(a) * inner * 0.13), mats["chrome"], rot=(0, math.pi / 2, 0), verts=6))
    return join(parts, "Rim")


def wheel(name, radius, width, mats, side, tread="street", spokes=5, style="split", caliper=True):
    """Returns (pivot empty, spin object). Wheel centred at origin; outside face toward +X for side=+1."""
    t = tyre(radius, width, mats, tread)
    r = rim(radius, width, mats, spokes, style)
    disc = cyl(radius * 0.5, width * 0.08, (-width * 0.05, 0, 0), mats["disc"], rot=(0, math.pi / 2, 0), verts=32)
    spin = join([t, r, disc], name)
    if side < 0:
        spin.scale.x = -1
        bpy.context.view_layer.objects.active = spin
        for o in bpy.context.selected_objects:
            o.select_set(False)
        spin.select_set(True)
        bpy.ops.object.transform_apply(scale=True)
        fix_normals(spin)
    cal = None
    if caliper:
        cal = box((width * 0.16, radius * 0.22, radius * 0.38), (side * width * 0.02, radius * 0.12, radius * 0.28), mats["caliper"], bevel=0.01, name=name.replace("Wheel", "Caliper"))
    return spin, cal


def mount_wheels(positions, radius, width, mats, tread="street", spokes=5, style="split", caliper=True):
    """positions: dict FL/FR/RL/RR -> (x, y, z). Front wheels get a Steer pivot."""
    nodes = []
    for key, (x, y, z) in positions.items():
        side = 1 if x > 0 else -1
        spin, cal = wheel("Wheel" + key, radius, width, mats, side, tread, spokes, style, caliper)
        if key[0] == "F":
            piv = bpy.data.objects.new("Steer" + key, None); bpy.context.collection.objects.link(piv)
            piv.location = (x, y, z)
            spin.parent = piv; spin.location = (0, 0, 0)
            if cal:
                cal.parent = piv
            nodes.append(piv)
        else:
            spin.location = (x, y, z)
            if cal:
                cal.location = Vector(cal.location) + Vector((x, y, z))
        spin["wheelRadius"] = radius
    return nodes


# ---------------------------------------------------------------- export

def export(path):
    for o in bpy.context.scene.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_apply=True,
                              export_image_format="JPEG", export_jpeg_quality=88, export_materials="EXPORT",
                              export_extras=True, use_selection=False)


# ---------------------------------------------------------------- generic lofted hulls (fuselages, boat hulls, bike fairings)

def loft_shell(name, length, m, hw, zc, hh, n=64, ring=32, sq=None, vee=None, y0=None):
    """Closed superellipse loft along -Y..+Y. hw/zc/hh are (u, value) profiles: half width, centre height, half height.
    sq: squareness profile (2 = ellipse, 4+ = boxy). vee: 0..1 pulls the bottom into a V (boat keels)."""
    us, HW = profile(hw, n); _, ZC = profile(zc, n); _, HH = profile(hh, n)
    _, SQ = profile(sq or [(0, 2.4), (1, 2.4)], n); _, VE = profile(vee or [(0, 0), (1, 0)], n)
    y0 = -length / 2 if y0 is None else y0
    bm = bmesh.new(); rings = []
    for i, u in enumerate(us):
        y = y0 + u * length; p = 2 / SQ[i]
        rr = []
        for k in range(ring):
            a = 2 * math.pi * k / ring
            c, s = math.cos(a), math.sin(a)
            x = HW[i] * math.copysign(abs(c) ** p, c)
            z = HH[i] * math.copysign(abs(s) ** p, s)
            if s < 0 and VE[i] > 0:  # keel: bottom becomes a V, deepest on the centreline, chines at the sides
                zv = -HH[i] * (0.25 + 0.75 * (1 - abs(x) / max(HW[i], 1e-4)))
                z = z * (1 - VE[i]) + zv * VE[i]
            rr.append(bm.verts.new((x, y, ZC[i] + z)))
        rings.append(rr)
    for i in range(n - 1):
        for k in range(ring):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % ring], rings[i + 1][(k + 1) % ring], rings[i + 1][k]))
    for idx in (0, n - 1):
        r = rings[idx]
        c = bm.verts.new((0, r[0].co.y, sum(v.co.z for v in r) / ring))
        for k in range(ring):
            bm.faces.new((r[k], r[(k + 1) % ring], c))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    fix_normals(o)
    shade_auto(o, 45)
    return o


def wedge(verts_xyz, faces, m, name="Wedge"):
    me = bpy.data.meshes.new(name); me.from_pydata(verts_xyz, [], faces); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    me.materials.append(m); fix_normals(o)
    return o


def wing_panel(span, root_chord, tip_chord, sweep, thick, at, m, name="WingPanel", dihedral=0.0, side=1):
    """Tapered swept wing (one side), root at `at`, extending along +X*side."""
    x0, y0, z0 = at
    rc, tc = root_chord, tip_chord
    tz = z0 + span * math.tan(dihedral)
    v = [(x0, y0 - rc / 2, z0 + thick), (x0, y0 + rc / 2, z0), (x0, y0 - rc / 2, z0 - thick * 0.4),
         (x0 + side * span, y0 - tc / 2 + sweep, tz + thick * 0.4), (x0 + side * span, y0 + tc / 2 + sweep, tz), (x0 + side * span, y0 - tc / 2 + sweep, tz - thick * 0.2)]
    f = [(0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5), (0, 2, 1), (3, 4, 5)]
    return wedge(v, f, m, name)
