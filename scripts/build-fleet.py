"""
Builds the authored vehicle fleet into public/models/fleet/*.glb with scripts/fleet_kit.py.

    pip install bpy && python3 scripts/build-fleet.py [outdir] [only-id ...]

Every model is in real metres, nose toward three.js +Z, ground at y = 0, with wheels as named nodes
(SteerFL/SteerFR pivots, WheelFL/FR/RL/RR spin about X). AuthoredVehicle.tsx reads those names.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fleet_kit as K  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else os.path.join(os.path.dirname(__file__), "..", "public", "models", "fleet")
ONLY = set(sys.argv[2:])


def stick(body, x, z, front=True, y_from=None):
    """Ray-cast toward the body along Y to find the surface point at (x, z); returns (location, normal)."""
    bb = [body.matrix_world @ Vector(c) for c in body.bound_box]
    ymin = min(v.y for v in bb) - 1; ymax = max(v.y for v in bb) + 1
    o = Vector((x, ymin if front else ymax, z)); d = Vector((0, 1 if front else -1, 0))
    dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, nrm, *_ = body.ray_cast(body.matrix_world.inverted() @ o, d)
    if not hit:
        return None, None
    return body.matrix_world @ loc, (body.matrix_world.to_3x3() @ nrm).normalized()


def stick_down(body, x, y):
    bb = [body.matrix_world @ Vector(c) for c in body.bound_box]
    o = Vector((x, y, max(v.z for v in bb) + 1))
    hit, loc, nrm, *_ = body.ray_cast(body.matrix_world.inverted() @ o, Vector((0, 0, -1)))
    return (body.matrix_world @ loc, nrm) if hit else (None, None)


def stick_side(body, y, z, side=1):
    bb = [body.matrix_world @ Vector(c) for c in body.bound_box]
    o = Vector((side * (max(abs(v.x) for v in bb) + 1), y, z))
    hit, loc, nrm, *_ = body.ray_cast(body.matrix_world.inverted() @ o, Vector((-side, 0, 0)))
    return (body.matrix_world @ loc, nrm) if hit else (None, None)


def lamp(body, x, z, size, m, front=True, name="Lamp", sink=0.012):
    loc, nrm = stick(body, x, z, front)
    if loc is None:
        return None
    o = K.box(size, (0, 0, 0), m, bevel=min(size) * 0.45, name=name)
    rot = nrm.to_track_quat("Y" if not front else "-Y", "Z")
    # the box's thin axis is Y; align it with the surface normal
    q = Vector((0, -1 if front else 1, 0)).rotation_difference(nrm)
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = q
    o.location = loc - nrm * sink
    return o



# ---------------------------------------------------------------- panel detail (owner, Oct 26 2026: "start rebuild")
# The lofted shells were one smooth skin: no shut lines, so every car read as a toy. cut_panels carves real panel gaps (doors,
# hood, boot, fuel flap) a few millimetres deep into the body with one exact boolean, the gap walls taking the dark trim
# material, and side intakes on the supercar. panel_dressing adds the hardware that sits on those panels: door handles,
# window trim, projector headlight lenses and number plates.

GAP = 0.0065     # shut-line width
DEPTH = 0.007    # how far a gap is cut into the skin


def _surface_fns(spec, prof):
    us, hw, zb, zbelt, zroof = prof
    n = len(us)
    cr = spec.get("crown", 0.05)
    _, crown = K.profile(cr if isinstance(cr, list) else [(0, cr), (1, cr)], n)
    at = lambda arr, u: float(np.interp(u, us, arr))
    def top(u, x):
        """z of the hood / deck skin at station u and |x| (below the glasshouse)"""
        w = at(hw, u); sfr = 1 - min(1.0, abs(x) / (0.93 * w))
        return at(zbelt, u) + at(crown, u) * (1 - (1 - sfr) ** 2)
    return at, top


def cut_panels(body, spec, prof, M, L, recesses=False):
    us, hw, zb, zbelt, zroof = prof
    at, top = _surface_fns(spec, prof)
    Y = lambda u: -L / 2 + u * L
    cutters = []
    def blk(size, center):
        cutters.append(K.box(size, center, M["trim"], bevel=0, name="Cut"))
    g0, g1 = spec.get("side_glass", (spec["ws"][0] + 0.05, spec["rw"][1] - 0.07))
    pillars = list(spec.get("pillars", []))
    doors = [g0 - 0.004] + pillars[:2]
    if len(pillars) >= 2:
        doors.append(pillars[-1] + 0.035)
    for side in (-1, 1):
        # door shut lines: vertical, from just above the sill to the window line
        for u in doors:
            w = at(hw, u); z0, z1 = at(zb, u) + 0.13, at(zbelt, u) - 0.012
            if z1 - z0 < 0.12:
                continue
            blk((0.3, GAP, z1 - z0), (side * (w + 0.15 - DEPTH), Y(u), (z0 + z1) / 2))
        # the door bottoms: a horizontal line along the rocker between the first and last door line
        u0, u1 = doors[0], doors[-1]
        zr = at(zb, (u0 + u1) / 2) + 0.13
        w = min(at(hw, u0), at(hw, u1))
        blk((0.3, (u1 - u0) * L, GAP), (side * (w * 0.985 + 0.15 - DEPTH), Y((u0 + u1) / 2), zr))
        # hood and boot side lines, following the hood crown in short steps
        for ua, ub in ((0.03, spec["ws"][0] - 0.012), (spec["rw"][1] + 0.012, 0.975)):
            if ub - ua < 0.04:
                continue
            steps = max(2, int((ub - ua) * L / 0.18))
            for k in range(steps):
                uu0, uu1 = ua + (ub - ua) * k / steps, ua + (ub - ua) * (k + 1) / steps
                um = (uu0 + uu1) / 2; x = side * 0.62 * at(hw, um)
                blk((GAP, (uu1 - uu0) * L + 0.03, 0.3), (x, Y(um), top(um, x) + 0.15 - DEPTH))
    # cowl and boot lines across the top, in short steps following the crown
    for u in (spec["ws"][0] - 0.012, spec["rw"][1] + 0.012):
        if u > 0.975:
            continue
        w = at(hw, u)
        for k in range(10):
            x0, x1 = -0.62 * w + 1.24 * w * k / 10, -0.62 * w + 1.24 * w * (k + 1) / 10
            xm = (x0 + x1) / 2
            blk((x1 - x0 + 0.02, GAP, 0.3), (xm, Y(u), top(u, xm) + 0.15 - DEPTH))
    # fuel flap on the right rear quarter
    uf = min(0.9, (spec["rw"][0] + spec["rw"][1]) / 2 + 0.02)
    zf = at(zbelt, uf) - 0.14
    for dz, dy, sz in ((0.07, 0, (0.3, 0.15, GAP)), (-0.07, 0, (0.3, 0.15, GAP)), (0, 0.075, (0.3, GAP, 0.14)), (0, -0.075, (0.3, GAP, 0.14))):
        blk(sz, (at(hw, uf) + 0.15 - DEPTH, Y(uf) + dy, zf + dz))
    if recesses:
        # supercar side intakes behind the doors: a deep scoop in each flank
        ui = doors[-1] + 0.07
        for side in (-1, 1):
            w = at(hw, ui)
            blk((0.3, 0.42, 0.17), (side * (w + 0.15 - 0.05), Y(ui) + 0.05, at(zb, ui) + 0.32))
    cutter = K.join(cutters, "PanelCutters")
    before = len(body.data.polygons)
    mod = body.modifiers.new("panels", "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.object = cutter; mod.solver = "EXACT"
    # the cutters overlap one another (door lines meet the rocker line): the exact solver needs self-intersection on, and a
    # tolerance for the loft's end caps
    mod.use_self = True
    mod.use_hole_tolerant = True
    try:
        mod.material_mode = "TRANSFER"
    except Exception:
        pass
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    if len(body.data.polygons) < before * 0.8:
        raise RuntimeError(f"panel cut lost the body ({before} -> {len(body.data.polygons)} faces)")


def panel_dressing(body, spec, prof, M, L, maxw, nose_z, tail_z, heads, style):
    """door handles, window trim, projector lenses, plates, and the intake slats; returns the parts"""
    us, hw, zb, zbelt, zroof = prof
    at, top = _surface_fns(spec, prof)
    Y = lambda u: -L / 2 + u * L
    out = []
    pillars = list(spec.get("pillars", []))
    g0, g1 = spec.get("side_glass", (spec["ws"][0] + 0.05, spec["rw"][1] - 0.07))
    door_ends = pillars[:2] if pillars else [g1]
    if len(pillars) >= 2:
        door_ends = [pillars[0], pillars[-1] + 0.035]
    handle_m = M["chrome"] if style == "sedan" else M["satin"]
    for side in (-1, 1):
        for ue in door_ends:
            uh = ue - 0.035
            loc, n = stick_side(body, Y(uh), at(zbelt, uh) - 0.1, side)
            if loc is not None:
                out.append(K.box((0.03, 0.17, 0.035), (loc.x + side * 0.012, loc.y, loc.z), handle_m, bevel=0.012, name="DoorHandle"))
        # window line trim: a strip along the sill of the side glass
        pts = []
        for k in range(9):
            u = g0 + (g1 - g0) * k / 8
            loc, n = stick_side(body, Y(u), at(zbelt, u) + 0.012, side)
            if loc is not None:
                pts.append((loc.x + side * 0.004, loc.y, loc.z))
        if len(pts) >= 2:
            out.append(K.tube(pts, 0.009, M["chrome"] if style == "sedan" else M["trim"], "WindowTrim", verts=8))
    # projector lenses inside each headlight: a chrome bezel and a bright lens
    for h in heads:
        if h is None:
            continue
        c = h.location
        for dx in (-0.07, 0.07) if h.dimensions.x > 0.25 else (0,):
            out.append(K.cyl(0.042, 0.03, (c.x + dx, c.y - 0.012, c.z), M["chrome"], rot=(math.pi / 2, 0, 0), verts=20, name="LensBezel"))
            out.append(K.sphere(0.03, (c.x + dx, c.y - 0.03, c.z), M["head"], scale=(1, 0.5, 1), name="Lens", seg=16, rings=8))
    # number plates front and rear
    plate = K.mat("Plate", "#d6dbe0", 0.1, 0.45)
    for front, z in ((True, max(at(zb, 0.03) + 0.16, nose_z - 0.28)), (False, max(at(zb, 0.97) + 0.18, tail_z - 0.24))):
        loc, n = stick(body, 0, z, front)
        if loc is not None:
            out.append(K.box((0.52, 0.02, 0.12), (0, loc.y + (-0.008 if front else 0.008), loc.z), plate, bevel=0.006, name="Plate"))
            out.append(K.box((0.55, 0.012, 0.15), (0, loc.y + (0.002 if front else -0.002), loc.z), M["trim"], bevel=0.004, name="PlateFrame"))
    return out


def rugged_kit(body, M, d):
    """off-roader extras: snorkel, spare wheel, side steps, fender flares, tow hooks, skid plate"""
    L, maxw, R, fy, ry, zbelt, roof_top = d["L"], d["maxw"], d["R"], d["fy"], d["ry"], d["zbelt"], d["roof_top"]
    out = []
    belt = float(np.median(zbelt))
    # snorkel up the right A-pillar
    out.append(K.tube([(maxw + 0.06, fy + R + 0.1, belt - 0.25), (maxw + 0.08, fy + R + 0.25, belt + 0.05), (maxw * 0.92, fy + R + 0.5, roof_top - 0.05)], 0.055, M["satin"], "Snorkel", verts=14))
    out.append(K.box((0.16, 0.2, 0.12), (maxw * 0.92, fy + R + 0.58, roof_top + 0.02), M["satin"], bevel=0.03, name="SnorkelHead"))
    # spare wheel on the tailgate
    out.append(K.cyl(R * 0.92, 0.26, (0, L / 2 + 0.16, belt + 0.05), M["rubber"], rot=(math.pi / 2, 0, 0), verts=32, name="Spare", bevel=0.03))
    out.append(K.cyl(R * 0.55, 0.28, (0, L / 2 + 0.16, belt + 0.05), M["rim"], rot=(math.pi / 2, 0, 0), verts=24, name="SpareRim"))
    for s in (-1, 1):
        # side steps between the wheels
        out.append(K.box((0.22, abs(ry - fy) - 2 * R - 0.15, 0.05), (s * (maxw + 0.06), (fy + ry) / 2, R * 0.75), M["steel"], bevel=0.01, name="SideStep"))
        # bolt-on fender flares over each arch
        for y in (fy, ry):
            out.append(K.tube([(s * (maxw + 0.03), y - R - 0.06, R * 0.95), (s * (maxw + 0.07), y - R * 0.55, R * 1.65), (s * (maxw + 0.08), y, R * 1.88), (s * (maxw + 0.07), y + R * 0.55, R * 1.65), (s * (maxw + 0.03), y + R + 0.06, R * 0.95)], 0.05, M["trim"], "Flare", verts=8))
        # red tow hooks
        out.append(K.box((0.06, 0.12, 0.06), (s * maxw * 0.55, -L / 2 - 0.1, R * 0.62), K.mat("TowHook", "#c41e1e", 0.4, 0.4), bevel=0.012, name="TowHook"))
    out.append(K.box((maxw * 1.3, 0.6, 0.03), (0, -L / 2 + 0.45, R * 0.55), M["steel"], bevel=0.01, name="SkidPlate"))
    return out


# ---------------------------------------------------------------- cars

BODIES = {
    # supercar / street racer: low glasshouse, sculpted fenders, fastback
    "racer": dict(length=4.55, n=80,
                  halfw=[(0, .62), (.04, .84), (.14, .95), (.3, .96), (.5, .93), (.72, .98), (.88, .97), (.97, .88), (1, .74)],
                  bottom=[(0, .24), (.05, .14), (.18, .11), (.82, .11), (.95, .18), (1, .28)],
                  belt=[(0, .42), (.04, .58), (.12, .74), (.2, .82), (.28, .78), (.4, .78), (.6, .82), (.79, .9), (.9, .88), (.97, .8), (1, .64)],
                  roof=[(0, .42), (.25, .78), (.31, .86), (.43, 1.15), (.55, 1.17), (.67, 1.05), (.82, .92), (.9, .88), (1, .64)],
                  ghw=[(0, .7), (.35, .72), (.5, .74), (.7, .62), (.9, .52), (1, .5)],
                  crown=[(0, -.02), (.12, -.1), (.22, -.12), (.3, -.05), (.45, .03), (.7, -.03), (.8, -.06), (1, 0)],
                  ws=(.27, .43), rw=(.6, .84), pillars=[.545], body_pillars=True, side_glass=(.33, .7),
                  axles=(.93, .88), R=.36, W=.29),
    # muscle: long flat hood, upright screen, short deck, squared tail
    "muscle": dict(length=4.85, n=80,
                   halfw=[(0, .8), (.03, .92), (.12, .97), (.5, .96), (.85, .98), (.97, .96), (1, .9)],
                   bottom=[(0, .3), (.04, .2), (.15, .16), (.85, .16), (.96, .22), (1, .34)],
                   belt=[(0, .66), (.03, .76), (.1, .84), (.22, .88), (.38, .88), (.6, .9), (.8, .94), (.95, .94), (1, .86)],
                   roof=[(0, .66), (.36, .88), (.42, 1.08), (.5, 1.3), (.66, 1.31), (.76, 1.12), (.84, .94), (1, .86)],
                   ghw=[(0, .75), (.45, .76), (.6, .75), (.8, .7), (1, .65)],
                   crown=[(0, .02), (.1, -.03), (.25, .05), (.35, .06), (.5, .03), (.85, -.02), (1, 0)],
                   ws=(.37, .5), rw=(.68, .83), pillars=[.6], body_pillars=True, side_glass=(.41, .76),
                   axles=(.98, .95), R=.37, W=.3),
    # luxury four-door sedan
    "sedan": dict(length=5.05, n=84,
                  halfw=[(0, .78), (.03, .9), (.12, .95), (.5, .95), (.85, .95), (.97, .9), (1, .82)],
                  bottom=[(0, .3), (.04, .2), (.15, .17), (.85, .17), (.96, .24), (1, .34)],
                  belt=[(0, .66), (.03, .76), (.12, .84), (.26, .88), (.5, .92), (.75, .95), (.92, .95), (1, .86)],
                  roof=[(0, .66), (.27, .88), (.33, 1.06), (.42, 1.42), (.66, 1.44), (.74, 1.3), (.84, 1.0), (.9, .95), (1, .86)],
                  ghw=[(0, .78), (.4, .78), (.6, .78), (.8, .72), (1, .66)],
                  crown=[(0, .02), (.12, .03), (.3, .05), (.5, .04), (.9, .03), (1, 0)],
                  ws=(.285, .41), rw=(.7, .84), pillars=[.54, .7], body_pillars=False, side_glass=(.33, .78),
                  axles=(.98, 1.05), R=.37, W=.27),
    # tuner hatch / wagon
    "tuner": dict(length=4.45, n=80,
                  halfw=[(0, .78), (.03, .9), (.14, .95), (.5, .94), (.85, .96), (.97, .93), (1, .88)],
                  bottom=[(0, .26), (.04, .17), (.15, .14), (.85, .14), (.97, .2), (1, .3)],
                  belt=[(0, .58), (.03, .7), (.12, .78), (.28, .84), (.5, .88), (.8, .92), (.96, .92), (1, .82)],
                  roof=[(0, .58), (.27, .84), (.33, 1.0), (.43, 1.36), (.85, 1.36), (.93, 1.24), (.97, .96), (1, .82)],
                  ghw=[(0, .76), (.45, .78), (.85, .76), (1, .72)],
                  crown=[(0, .0), (.15, .02), (.3, .05), (.6, .03), (1, 0)],
                  ws=(.275, .42), rw=(.88, .965), pillars=[.56, .78], body_pillars=False, side_glass=(.32, .86),
                  axles=(.88, .78), R=.35, W=.28),
    # SUV / off-roader: tall, boxy, short overhangs
    "suv": dict(length=4.75, n=80,
                halfw=[(0, .86), (.03, .96), (.1, 1.0), (.9, 1.0), (.98, .98), (1, .94)],
                bottom=[(0, .52), (.05, .42), (.15, .4), (.85, .4), (.96, .44), (1, .54)],
                belt=[(0, .96), (.03, 1.08), (.1, 1.14), (.25, 1.18), (.6, 1.2), (.97, 1.2), (1, 1.12)],
                roof=[(0, .96), (.24, 1.18), (.3, 1.4), (.37, 1.86), (.92, 1.88), (.97, 1.7), (.99, 1.2), (1, 1.12)],
                ghw=[(0, .84), (.4, .86), (.95, .86), (1, .84)],
                crown=[(0, .0), (.2, .03), (.5, .03), (1, 0)],
                ws=(.235, .37), rw=(.93, .99), pillars=[.55, .76], body_pillars=False, side_glass=(.28, .9),
                axles=(.85, .85), R=.46, W=.34),
    # city pod: bubble cabin
    "pod": dict(length=3.3, n=72,
                halfw=[(0, .62), (.06, .8), (.2, .86), (.8, .86), (.94, .8), (1, .66)],
                bottom=[(0, .32), (.08, .22), (.2, .2), (.8, .2), (.92, .22), (1, .32)],
                belt=[(0, .5), (.06, .66), (.2, .74), (.8, .76), (.94, .7), (1, .56)],
                roof=[(0, .5), (.1, .9), (.24, 1.5), (.5, 1.66), (.78, 1.56), (.92, 1.2), (1, .56)],
                ghw=[(0, .7), (.3, .78), (.7, .78), (1, .7)],
                crown=0.04, ws=(.08, .3), rw=(.86, .97), pillars=[], body_pillars=False, side_glass=(.2, .8), glass_roof=True,
                axles=(.62, .62), R=.3, W=.22),
    # hover car: no wheels, low wedge
    "hover": dict(length=4.7, n=84,
                  halfw=[(0, .35), (.06, .7), (.2, .92), (.5, .98), (.8, 1.0), (.95, .95), (1, .82)],
                  bottom=[(0, .4), (.1, .3), (.3, .28), (.8, .28), (1, .36)],
                  belt=[(0, .44), (.08, .56), (.25, .7), (.5, .78), (.8, .82), (.95, .8), (1, .66)],
                  roof=[(0, .44), (.25, .7), (.38, 1.06), (.55, 1.12), (.72, 1.0), (.88, .84), (1, .66)],
                  ghw=[(0, .5), (.4, .64), (.6, .62), (1, .4)],
                  crown=[(0, -.02), (.2, -.06), (.4, .02), (.8, -.04), (1, 0)],
                  ws=(.24, .47), rw=(.62, .86), pillars=[], body_pillars=True, side_glass=(.34, .7), glass_roof=True,
                  axles=(1.0, 1.0), R=.3, W=.25),
}


def car(oid, body_key, paint, accent="#38e8ff", metal=0.8, rough=0.22, rim_style="split", spokes=5, tread="street",
        wing=False, skirts=False, splitter=False, diffuser=False, exhausts=2, seats=1, roof_rack=False, lightbar=None,
        bullbar=False, armor=False, spikes=False, rollcage=False, underglow=True, hover=False, rim_color=None,
        caliper="#c8202a", glass="#0d1218", lamps="slim", extra=None):
    K.reset(); M = K.standard_mats(paint, metal, rough, accent, glass)
    if rim_color:
        M["rim"] = K.mat("Rim", rim_color, 1.0, 0.25)
    M["caliper"] = K.mat("Caliper", caliper, 0.3, 0.35, coat=0.6)
    spec = dict(BODIES[body_key])
    L = spec["length"]; R = spec.pop("R"); W = spec.pop("W"); fa, ra = spec.pop("axles")
    body, prof = K.loft_body(spec, M)
    us, hw, zb, zbelt, zroof = prof
    maxw = float(max(hw))
    hx = maxw - W / 2 + 0.02
    fy, ry = -L / 2 + fa, L / 2 - ra
    wheels = {"FL": (-hx, fy, R), "FR": (hx, fy, R), "RL": (-hx, ry, R), "RR": (hx, ry, R)}
    if not hover:
        K.cut_arches(body, list(wheels.values()), R, W, flare=0.035)
        cut_panels(body, spec, prof, M, L, recesses=body_key == "racer")
    K.shade_auto(body, 50)
    parts = []
    if not hover:
        parts.append(K.arch_liners(list(wheels.values()), R, W, M["trim"]))
    nose_z = float(zbelt[3]); tail_z = float(zbelt[-4])
    heads = []
    # lamps
    if lamps == "slim":
        for s in (-1, 1):
            hl = lamp(body, s * maxw * 0.66, nose_z - 0.06, (0.4, 0.05, 0.06), M["head"], True, "Headlight"); parts.append(hl); heads.append(hl)
            parts.append(lamp(body, s * maxw * 0.72, nose_z - 0.14, (0.2, 0.04, 0.03), M["accent"], True, "DRL"))
            parts.append(lamp(body, s * maxw * 0.64, tail_z - 0.06, (0.42, 0.04, 0.06), M["tail"], False, "Tail"))
        parts.append(lamp(body, 0, tail_z - 0.04, (maxw * 1.0, 0.03, 0.025), M["tail"], False, "TailBar"))
    elif lamps == "round":
        for s in (-1, 1):
            for dx in (0.6, 0.78):
                l = lamp(body, s * maxw * dx, nose_z - 0.1, (0.13, 0.05, 0.13), M["head"], True, "Headlight")
                parts.append(l)
            parts.append(lamp(body, s * maxw * 0.68, tail_z - 0.1, (0.36, 0.04, 0.1), M["tail"], False, "Tail"))
    elif lamps == "square":
        for s in (-1, 1):
            hl = lamp(body, s * maxw * 0.7, nose_z - 0.12, (0.3, 0.05, 0.16), M["head"], True, "Headlight"); parts.append(hl); heads.append(hl)
            parts.append(lamp(body, s * maxw * 0.8, tail_z - 0.12, (0.14, 0.04, 0.34), M["tail"], False, "Tail"))
    if not hover:
        parts.extend(panel_dressing(body, spec, prof, M, L, maxw, nose_z, tail_z, heads, body_key))
    # grille
    gl, gn = stick(body, 0, nose_z - 0.12, True)
    if gl is not None and not hover:
        parts.append(K.box((maxw * 0.9, 0.06, 0.16), (0, gl.y + 0.02, gl.z - 0.02), M["trim"], bevel=0.02, name="Grille"))
        for k in range(4):
            parts.append(K.box((maxw * 0.86, 0.02, 0.012), (0, gl.y - 0.012, gl.z - 0.08 + k * 0.04), M["satin"], bevel=0, name="Slat"))
    if splitter:
        parts.append(K.box((maxw * 1.76, 0.22, 0.03), (0, -L / 2 + 0.2, float(zb[3]) - 0.02), M["trim"], bevel=0.012, name="Splitter"))
    if skirts:
        for s in (-1, 1):
            parts.append(K.box((0.07, abs(ry - fy) - 2 * R - 0.1, 0.09), (s * (maxw - 0.04), (fy + ry) / 2, float(zb[len(zb) // 2]) + 0.05), M["trim"], bevel=0.02, name="Skirt"))
    if diffuser:
        parts.append(K.box((maxw * 1.5, 0.3, 0.1), (0, L / 2 - 0.12, float(zb[-4]) + 0.06), M["trim"], bevel=0.02, name="Diffuser"))
    for k in range(exhausts):
        x = (k - (exhausts - 1) / 2) * 0.28 if exhausts > 1 else maxw * 0.5
        parts.append(K.cyl(0.045, 0.18, (x, L / 2 - 0.02, float(zb[-4]) + 0.08), M["chrome"], rot=(math.pi / 2, 0, 0), verts=20, name="Exhaust"))
    # mirrors
    for s in (-1, 1):
        u = spec["ws"][1] - 0.04
        loc, n = stick_side(body, -L / 2 + u * L, float(np.interp(u, us, zbelt)) + 0.12, s)
        if loc is not None:
            parts.append(K.box((0.17, 0.12, 0.09), (loc.x + s * 0.1, loc.y, loc.z), M["paint"], bevel=0.035, name="Mirror"))
            parts.append(K.box((0.1, 0.03, 0.03), (loc.x + s * 0.03, loc.y + 0.02, loc.z - 0.02), M["satin"], bevel=0.008, name="MirrorArm"))
    # cabin interior
    floor = float(zb[len(zb) // 2]) + 0.2
    cab_y = -L / 2 + (spec["ws"][1] + 0.06) * L
    rows = [] if hover else [cab_y + 0.55] + ([cab_y + 1.45] if seats > 1 else [])
    for ry_ in rows:
        for s in (-1, 1):
            parts.append(K.box((0.44, 0.5, 0.14), (s * maxw * 0.38, ry_, floor + 0.12), M["interior"], bevel=0.05, name="Seat"))
            parts.append(K.box((0.44, 0.14, 0.62), (s * maxw * 0.38, ry_ + 0.28, floor + 0.42), M["interior"], bevel=0.06, rot=(math.radians(-14), 0, 0), name="SeatBack"))
    parts.append(K.box((maxw * 1.6, 0.36, 0.16), (0, cab_y - 0.15, floor + 0.45), M["interior"], bevel=0.05, name="Dash"))
    parts.append(K.cyl(0.16, 0.03, (-maxw * 0.38, cab_y + 0.08, floor + 0.55), M["satin"], rot=(math.radians(70), 0, 0), verts=24, name="SteeringWheel"))
    parts.append(K.box((maxw * 1.7, L * 0.6, 0.05), (0, (fy + ry) / 2, floor - 0.04), M["interior"], bevel=0, name="Floor"))
    roof_top = float(max(zroof))
    if roof_rack:
        y0, y1 = -L / 2 + (spec["ws"][1] + 0.05) * L, -L / 2 + (spec["rw"][0] - 0.02) * L
        for s in (-1, 1):
            parts.append(K.tube([(s * maxw * 0.7, y0, roof_top + 0.1), (s * maxw * 0.7, y1, roof_top + 0.1)], 0.022, M["satin"], "Rail"))
        for k in range(4):
            y = y0 + (y1 - y0) * k / 3
            parts.append(K.tube([(-maxw * 0.7, y, roof_top + 0.1), (maxw * 0.7, y, roof_top + 0.1)], 0.018, M["satin"], "Bar"))
    if lightbar:
        y = -L / 2 + (spec["ws"][1] + 0.03) * L
        parts.append(K.box((maxw * 1.3, 0.12, 0.1), (0, y, roof_top + 0.12), M["satin"], bevel=0.02, name="LightBarBox"))
        if lightbar == "police":
            parts.append(K.box((maxw * 0.6, 0.1, 0.08), (-maxw * 0.32, y, roof_top + 0.13), K.mat("LightRed", "#ff2030", 0, .2, emit="#ff1020", strength=6), bevel=0.01, name="LB"))
            parts.append(K.box((maxw * 0.6, 0.1, 0.08), (maxw * 0.32, y, roof_top + 0.13), K.mat("LightBlue", "#2060ff", 0, .2, emit="#2050ff", strength=6), bevel=0.01, name="LB"))
        else:
            for k in range(6):
                parts.append(K.box((0.16, 0.04, 0.06), (-maxw * 0.55 + k * maxw * 0.22, y - 0.065, roof_top + 0.12), M["head"], bevel=0.01, name="LB"))
    if bullbar:
        fz = float(zbelt[2])
        for s in (-1, 1):
            parts.append(K.tube([(s * maxw * 0.7, -L / 2 + 0.05, R * 0.6), (s * maxw * 0.7, -L / 2 - 0.16, R * 0.7), (s * maxw * 0.62, -L / 2 - 0.2, fz + 0.12)], 0.045, M["satin"], "Bull"))
        parts.append(K.tube([(-maxw * 0.62, -L / 2 - 0.2, fz + 0.12), (maxw * 0.62, -L / 2 - 0.2, fz + 0.12)], 0.045, M["satin"], "BullTop"))
        parts.append(K.tube([(-maxw * 0.78, -L / 2 - 0.17, R * 0.72), (maxw * 0.78, -L / 2 - 0.17, R * 0.72)], 0.05, M["satin"], "BullLow"))
    if armor:
        for s in (-1, 1):
            loc, n = stick_side(body, (fy + ry) / 2, float(zbelt[len(zbelt) // 2]) - 0.25, s)
            if loc is not None:
                parts.append(K.box((0.05, abs(ry - fy) - 2 * R - 0.05, 0.42), (loc.x + s * 0.03, (fy + ry) / 2, loc.z), M["rust"], bevel=0.015, name="ArmorPlate"))
                for k in range(5):
                    y = fy + R + 0.15 + k * (abs(ry - fy) - 2 * R - 0.3) / 4
                    parts.append(K.cyl(0.022, 0.03, (loc.x + s * 0.06, y, loc.z + 0.15), M["steel"], rot=(0, math.pi / 2, 0), verts=8, name="Rivet"))
                    parts.append(K.cyl(0.022, 0.03, (loc.x + s * 0.06, y, loc.z - 0.15), M["steel"], rot=(0, math.pi / 2, 0), verts=8, name="Rivet"))
        # window mesh guards over the side glass
        u0, u1 = spec["side_glass"]
        for s in (-1, 1):
            loc, n = stick_side(body, -L / 2 + (u0 + u1) / 2 * L, float(zbelt[len(zbelt) // 2]) + 0.2, s)
            if loc is not None:
                for k in range(6):
                    y = -L / 2 + (u0 + (u1 - u0) * (k + 0.5) / 6) * L
                    parts.append(K.box((0.02, 0.025, 0.3), (loc.x + s * 0.03, y, loc.z), M["steel"], bevel=0, name="Guard"))
    if spikes:
        for s in (-1, 1):
            for k in range(3):
                parts.append(K.cyl(0.05, 0.22, (s * (maxw * 0.4 + k * 0.17), -L / 2 - 0.12, R * 0.9), M["steel"], rot=(math.pi / 2, 0, 0), verts=10, name="Spike", r2=0.0))
    if rollcage:
        y0, y1 = cab_y + 0.2, cab_y + 1.3
        for s in (-1, 1):
            parts.append(K.tube([(s * maxw * 0.62, y0, floor + 0.3), (s * maxw * 0.55, y0 + 0.1, roof_top + 0.05), (s * maxw * 0.55, y1, roof_top + 0.05), (s * maxw * 0.62, y1 + 0.2, floor + 0.3)], 0.035, M["satin"], "Cage"))
    if extra:
        parts.extend(extra(body, M, dict(L=L, R=R, W=W, maxw=maxw, fy=fy, ry=ry, zbelt=zbelt, zroof=zroof, roof_top=roof_top, floor=floor)))
    ty = L / 2 - 0.22
    loc, n = stick_down(body, 0.45, ty)
    top = loc.z if loc is not None else tail_z
    K.join([body] + [p for p in parts if p], "Body")
    # detachable cosmetic parts stay separate nodes
    if wing:
        w_parts = [K.box((0.03, 0.12, 0.2), (s * 0.45, ty, top + 0.09), M["satin"], bevel=0.008, name="WingPost") for s in (-1, 1)]
        w_parts.append(K.box((maxw * 1.75, 0.3, 0.035), (0, ty + 0.02, top + 0.2), M["satin"], bevel=0.012, rot=(math.radians(-8), 0, 0), name="WingBlade"))
        w_parts += [K.box((0.02, 0.34, 0.14), (s * maxw * 0.88, ty + 0.02, top + 0.21), M["satin"], bevel=0.006, name="Endplate") for s in (-1, 1)]
        K.join(w_parts, "Wing")
    if underglow:
        ug = K.box((maxw * 1.4, L * 0.58, 0.012), (0, (fy + ry) / 2, float(zb[len(zb) // 2]) - 0.01), M["accent"], bevel=0, name="Underglow")
    if hover:
        pods = []
        for (x, y, z) in wheels.values():
            pods.append(K.cyl(R * 1.05, 0.16, (x * 0.92, y, float(zb[len(zb) // 2]) + 0.02), M["satin"], verts=32, name="Pod", bevel=0.02))
            pods.append(K.cyl(R * 0.82, 0.03, (x * 0.92, y, float(zb[len(zb) // 2]) - 0.07), M["accent"], verts=32, name="PodGlow"))
        K.join(pods, "HoverPods")
    else:
        K.mount_wheels(wheels, R, W, M, tread, spokes, rim_style)
    export_model(oid)


def K_front(body, x, z):
    return stick(body, x, z, True)


def export_model(oid):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, oid + ".glb")
    K.export(path)
    print("WROTE", path, os.path.getsize(path))



# ---------------------------------------------------------------- specials

def finish_model(oid, parts, name="Body"):
    K.join([p for p in parts if p], name)
    export_model(oid)


def buggy(oid, paint="#6d3a22", accent="#ff6a2a"):
    K.reset(); M = K.standard_mats(paint, 0.35, 0.6, accent)
    P = []
    L = 3.9; R1, R2 = 0.4, 0.5
    floor = 0.55
    # tub
    P.append(K.loft_shell("Tub", 2.6, M["paint"], hw=[(0, .5), (.3, .72), (1, .7)], zc=[(0, .62), (1, .7)], hh=[(0, .12), (.3, .2), (1, .22)], sq=[(0, 3.5), (1, 4)], n=24, ring=24))
    P.append(K.loft_shell("Nose", 1.0, M["paint"], hw=[(0, .3), (1, .5)], zc=[(0, .6), (1, .62)], hh=[(0, .08), (1, .12)], sq=[(0, 3), (1, 3.5)], n=12, ring=24, y0=-1.3 - 1.0 + 0.05))
    # tube frame / cage
    T = lambda pts, r=0.04: P.append(K.tube(pts, r, M["satin"], "Frame"))
    for s in (-1, 1):
        T([(s * .55, -1.0, floor + .1), (s * .5, -0.5, 1.55), (s * .5, 0.5, 1.55), (s * .62, 1.25, floor + .25)])
        T([(s * .5, -0.5, 1.55), (s * .66, -2.0, floor + .2)])
        T([(s * .72, 1.25, floor + .25), (s * .72, -1.2, floor + .1)], 0.035)
        T([(s * .72, 1.25, floor + .25), (s * .5, 0.5, 1.55)], 0.03)
    T([(-.5, -0.5, 1.55), (.5, -0.5, 1.55)]); T([(-.5, 0.5, 1.55), (.5, 0.5, 1.55)])
    T([(-.5, -0.5, 1.55), (.5, 0.5, 1.55)], 0.03)
    # engine + stacks + fuel cell
    P.append(K.box((0.8, 0.7, 0.45), (0, 1.25, floor + .35), M["steel"], bevel=0.04, name="Engine"))
    for s in (-1, 1):
        P.append(K.tube([(s * .3, 1.5, floor + .5), (s * .32, 1.65, 1.3), (s * .34, 1.75, 1.55)], 0.05, M["rust"], "Stack"))
    P.append(K.cyl(0.18, 0.6, (0, 1.6, floor + .75), M["accent"], rot=(0, math.pi / 2, 0), verts=20, name="FuelCell"))
    # seats
    for s in (-1, 1):
        P.append(K.box((0.42, 0.45, 0.14), (s * .26, -0.05, floor + .25), M["interior"], bevel=0.05))
        P.append(K.box((0.42, 0.12, 0.6), (s * .26, 0.2, floor + .55), M["interior"], bevel=0.05, rot=(math.radians(-12), 0, 0)))
    # spiked ram, lights
    T([(-.8, -2.05, .55), (.8, -2.05, .55)], 0.06)
    for k in range(5):
        P.append(K.cyl(0.05, 0.3, (-0.7 + k * 0.35, -2.2, .55), M["steel"], rot=(math.pi / 2, 0, 0), verts=10, r2=0.0, name="Spike"))
    for s in (-1, 1):
        P.append(K.cyl(0.11, 0.12, (s * .35, -0.45, 1.66), M["head"], rot=(math.pi / 2, 0, 0), verts=20, name="Headlight"))
        P.append(K.box((0.14, 0.04, 0.08), (s * .55, 1.95, floor + .4), M["tail"], bevel=0.01, name="Tail"))
    finish_model_wheels = {"FL": (-.95, -1.25, R1), "FR": (.95, -1.25, R1), "RL": (-1.0, 1.15, R2), "RR": (1.0, 1.15, R2)}
    K.join([p for p in P if p], "Body")
    for key, pos in finish_model_wheels.items():
        r = R1 if key[0] == "F" else R2
        K.mount_wheels({key: pos}, r, 0.36 if key[0] == "R" else 0.28, M, "offroad", 6, "solid", caliper=False)
    export_model(oid)


def bike(oid, paint="#0b0d14", accent="#16e8ff", hover=True):
    K.reset(); M = K.standard_mats(paint, 0.8, 0.18, accent)
    P = []
    P.append(K.loft_shell("Fairing", 2.5, M["paint"], hw=[(0, .05), (.15, .22), (.45, .3), (.7, .26), (1, .1)],
                          zc=[(0, .62), (.2, .72), (.5, .8), (.8, .82), (1, .86)], hh=[(0, .06), (.2, .22), (.5, .3), (.8, .2), (1, .06)],
                          sq=[(0, 2.2), (.5, 2.6), (1, 2.2)], n=40, ring=28))
    P.append(K.loft_shell("Canopy", 0.7, M["glass"], hw=[(0, .04), (.5, .2), (1, .12)], zc=[(0, 1.0), (1, 1.06)], hh=[(0, .02), (.5, .1), (1, .04)], n=14, ring=20, y0=-0.85))
    P.append(K.box((0.4, 0.7, 0.12), (0, 0.45, 1.08), M["interior"], bevel=0.05, name="Seat"))
    P.append(K.tube([(-.38, -0.55, 1.12), (0, -0.62, 1.04), (.38, -0.55, 1.12)], 0.025, M["satin"], "Bars"))
    for s in (-1, 1):
        P.append(K.box((0.025, 2.0, 0.03), (s * .29, 0.0, .78), M["accent"], bevel=0, name="GlowLine"))
    P.append(K.box((0.22, 0.04, 0.05), (0, -1.27, .7), M["head"], bevel=0.01, name="Headlight"))
    P.append(K.box((0.3, 0.04, 0.04), (0, 1.25, .86), M["tail"], bevel=0.01, name="Tail"))
    K.join(P, "Body")
    for key, y in (("WheelF", -0.95), ("WheelR", 0.95)):
        ring = []
        bpy.ops.mesh.primitive_torus_add(major_radius=0.48, minor_radius=0.09, major_segments=48, minor_segments=12, location=(0, 0, 0), rotation=(0, math.pi / 2, 0))
        t = bpy.context.object; t.data.materials.append(M["rubber"]); ring.append(t)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.43, minor_radius=0.025, major_segments=48, minor_segments=8, location=(0.1, 0, 0), rotation=(0, math.pi / 2, 0))
        g = bpy.context.object; g.data.materials.append(M["accent"]); ring.append(g)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.43, minor_radius=0.025, major_segments=48, minor_segments=8, location=(-0.1, 0, 0), rotation=(0, math.pi / 2, 0))
        g2 = bpy.context.object; g2.data.materials.append(M["accent"]); ring.append(g2)
        ring.append(K.cyl(0.36, 0.06, (0, 0, 0), M["satin"], rot=(0, math.pi / 2, 0), verts=40))
        w = K.join(ring, key); w.location = (0, y, 0.57); w["wheelRadius"] = 0.57
    export_model(oid)


def tank(oid, paint="#4f5a4c", accent="#ffb040", big=False):
    K.reset(); M = K.standard_mats(paint, 0.4, 0.62, accent)
    sc = 1.35 if big else 1.0
    P = []
    L, Wd = 6.6 * sc, 1.7 * sc
    P.append(K.loft_shell("Hull", L, M["paint"], hw=[(0, Wd * .8), (.08, Wd), (.92, Wd), (1, Wd * .9)], zc=[(0, 1.05 * sc), (1, 1.1 * sc)],
                          hh=[(0, .25 * sc), (.1, .42 * sc), (.9, .45 * sc), (1, .35 * sc)], sq=[(0, 5), (1, 5)], n=20, ring=32))
    # tracks: belt of pads around a stadium, road wheels inside
    for s in (-1, 1):
        x = s * (Wd + 0.32 * sc)
        r = 0.42 * sc; ya, yb = -L / 2 + 0.6 * sc, L / 2 - 0.6 * sc
        pts = []
        n = 70
        per = 2 * (yb - ya) + 2 * math.pi * r
        for k in range(n):
            d = per * k / n
            if d < yb - ya: y, z, a = ya + d, 0.08 * sc, 0
            elif d < yb - ya + math.pi * r:
                t = (d - (yb - ya)) / r; y, z, a = yb + r * math.sin(t), r - r * math.cos(t) + 0.08 * sc, t
            elif d < 2 * (yb - ya) + math.pi * r:
                y, z, a = yb - (d - (yb - ya) - math.pi * r), 2 * r + 0.08 * sc, math.pi
            else:
                t = (d - 2 * (yb - ya) - math.pi * r) / r; y, z, a = ya - r * math.sin(t), r + r * math.cos(t) + 0.08 * sc, math.pi + t
            P.append(K.box((0.62 * sc, per / n * 0.86, 0.09 * sc), (x, y, z), M["steel"], bevel=0.01, rot=(-a, 0, 0), name="Pad"))
        for k in range(7):
            y = ya + (yb - ya) * k / 6
            P.append(K.cyl(0.36 * sc, 0.5 * sc, (x, y, 0.5 * sc), M["satin"], rot=(0, math.pi / 2, 0), verts=24, name="RoadWheel", bevel=0.02))
        P.append(K.box((0.12 * sc, L * 0.95, 0.5 * sc), (s * (Wd + 0.68 * sc), 0, 0.95 * sc), M["paint"], bevel=0.03, name="Skirt"))
    turret = [K.loft_shell("Turret", 3.2 * sc, M["paint"], hw=[(0, .8 * sc), (.2, 1.25 * sc), (.85, 1.3 * sc), (1, 1.1 * sc)],
                           zc=[(0, 1.85 * sc), (1, 1.9 * sc)], hh=[(0, .25 * sc), (.3, .4 * sc), (1, .38 * sc)], sq=[(0, 3.5), (1, 4)], n=16, ring=32, y0=-1.4 * sc)]
    turret.append(K.cyl(0.16 * sc, 4.2 * sc, (0, -3.4 * sc, 1.9 * sc), M["satin"], rot=(math.pi / 2, 0, 0), verts=24, name="Barrel"))
    turret.append(K.cyl(0.24 * sc, 0.6 * sc, (0, -5.2 * sc, 1.9 * sc), M["satin"], rot=(math.pi / 2, 0, 0), verts=24, name="Muzzle"))
    turret.append(K.cyl(0.3 * sc, 0.2 * sc, (0.5 * sc, 0.3 * sc, 2.35 * sc), M["steel"], verts=20, name="Hatch"))
    turret.append(K.box((0.4 * sc, 0.5 * sc, 0.3 * sc), (-.6 * sc, 0.2 * sc, 2.35 * sc), M["satin"], bevel=0.03, name="Optic"))
    turret.append(K.box((0.3 * sc, 0.05, 0.1 * sc), (-.6 * sc, -0.06 * sc, 2.38 * sc), M["accent"], bevel=0.0, name="OpticGlow"))
    if big:
        for k in range(9):
            a = k * 0.7
            P.append(K.cyl(0.35, 1.6 + (k % 3) * 0.6, (math.cos(a) * 1.4, -2 + k * 0.5, 1.9 + (k % 2) * 0.3), K.mat("Crystal", "#ff6a1a", 0.0, 0.1, emit="#ff4a10", strength=5), rot=(0.3 * math.sin(a), 0.3 * math.cos(a), 0), verts=6, r2=0.02, name="Crystal"))
    for s in (-1, 1):
        P.append(K.box((0.25 * sc, 0.05, 0.12 * sc), (s * Wd * 0.75, -L / 2 + 0.02, 1.2 * sc), M["head"], bevel=0.01, name="Headlight"))
        P.append(K.box((0.2 * sc, 0.05, 0.1 * sc), (s * Wd * 0.75, L / 2 - 0.02, 1.25 * sc), M["tail"], bevel=0.01, name="Tail"))
    K.join(P, "Body"); K.join(turret, "Turret")
    export_model(oid)


def transport(oid, paint="#344a5a", accent="#35e7f1", rig=False):
    K.reset(); M = K.standard_mats(paint, 0.5, 0.5, accent)
    P = []; R = 0.55
    # cab
    P.append(K.loft_shell("Cab", 2.4, M["paint"], hw=[(0, 1.05), (.2, 1.2), (1, 1.2)], zc=[(0, 1.45), (.3, 1.75), (1, 1.8)], hh=[(0, .5), (.3, .85), (1, .9)], sq=[(0, 4), (1, 5)], n=16, ring=32, y0=-4.4))
    P.append(K.box((2.1, 0.08, 0.6), (0, -4.38, 2.15), M["glass"], bevel=0.02, rot=(math.radians(-18), 0, 0), name="Windscreen"))
    for s in (-1, 1):
        P.append(K.box((0.05, 0.9, 0.5), (s * 1.21, -3.4, 2.2), M["glass"], bevel=0.01, name="SideWin"))
    # box / armored cargo
    if rig:
        P.append(K.box((2.5, 6.0, 2.4), (0, 1.4, 2.0), M["rust"], bevel=0.06, name="Container"))
        for k in range(8):
            P.append(K.box((2.56, 0.08, 2.3), (0, -1.4 + k * 0.8, 2.0), M["steel"], bevel=0.0, name="Rib"))
        for k in range(7):
            P.append(K.cyl(0.07, 0.6, (-1.0 + k * 0.33, -4.95, 0.9), M["steel"], rot=(math.pi / 2, 0, 0), verts=8, r2=0.0, name="Spike"))
        P.append(K.box((2.6, 0.2, 0.9), (0, -4.7, 0.95), M["steel"], bevel=0.03, name="Ram"))
    else:
        P.append(K.loft_shell("Hold", 6.2, M["paint"], hw=[(0, 1.2), (1, 1.2)], zc=[(0, 2.0), (1, 2.0)], hh=[(0, 1.2), (1, 1.15)], sq=[(0, 6), (1, 6)], n=8, ring=40, y0=-2.0))
        for s in (-1, 1):
            P.append(K.box((0.04, 5.6, 0.06), (s * 1.22, 1.1, 2.6), M["accent"], bevel=0.0, name="GlowStrip"))
        P.append(K.cyl(0.6, 0.4, (0, 1.6, 3.35), M["satin"], verts=28, name="TurretBase"))
        P.append(K.cyl(0.08, 1.6, (0, 0.8, 3.55), M["satin"], rot=(math.pi / 2, 0, 0), verts=12, name="Gun"))
        P.append(K.box((0.7, 0.5, 0.35), (0, 1.75, 3.7), M["satin"], bevel=0.04, name="Mantlet"))
        # armoured detailing: vision slits, storage bins, roof rails and hatch, rear door with ladder, push bar, mirrors
        for sx in (-1, 1):
            for k in range(3):
                P.append(K.box((0.04, 0.55, 0.12), (sx * 1.215, -0.6 + k * 1.3, 2.55), M["glass"], bevel=0.005, name="VisionSlit"))
            P.append(K.box((0.28, 1.6, 0.5), (sx * 1.32, 1.2, 1.35), M["satin"], bevel=0.04, name="StowBin"))
            P.append(K.tube([(sx * 0.95, -1.6, 3.27), (sx * 0.95, 3.8, 3.27)], 0.03, M["steel"], "RoofRail"))
            P.append(K.tube([(sx * 1.2, -3.25, 2.3), (sx * 1.48, -3.35, 2.4), (sx * 1.5, -3.35, 2.65)], 0.022, M["chrome"], "MirrorArm"))
            P.append(K.box((0.06, 0.18, 0.4), (sx * 1.52, -3.35, 2.55), M["satin"], bevel=0.02, name="Mirror"))
            P.append(K.box((0.42, 0.4, 0.05), (sx * 1.12, -3.0, 0.62), M["steel"], bevel=0.01, name="Step"))
            P.append(K.tube([(sx * 0.4, 4.25, 1.0), (sx * 0.4, 4.25, 3.0)], 0.025, M["steel"], "Ladder"))
        for k in range(6):
            P.append(K.tube([(-0.4, 4.25, 1.15 + k * 0.33), (0.4, 4.25, 1.15 + k * 0.33)], 0.02, M["steel"], "Rung"))
        P.append(K.box((1.5, 0.06, 1.9), (0, 4.2, 2.05), M["paint"], bevel=0.03, name="RearDoor"))
        P.append(K.cyl(0.38, 0.1, (0, -0.6, 3.27), M["satin"], verts=20, name="Hatch"))
        P.append(K.tube([(0.9, 3.5, 3.3), (0.9, 3.5, 5.1)], 0.012, M["satin"], "Antenna"))
        P.append(K.tube([(-1.15, -4.75, 0.7), (-1.15, -4.95, 1.3), (1.15, -4.95, 1.3), (1.15, -4.75, 0.7)], 0.06, M["steel"], "PushBar"))
        for k in range(6):
            P.append(K.box((1.6, 0.05, 0.05), (0, -4.43, 1.45 + k * 0.09), M["trim"], bevel=0.0, name="GrilleSlat"))
        for k in range(4):
            P.append(K.box((0.16, 0.08, 0.06), (-0.36 + k * 0.24, -3.2, 3.02), M["accent"], bevel=0.01, name="LightBar"))
    P.append(K.box((2.3, 9.0, 0.35), (0, 0.0, 0.85), M["satin"], bevel=0.03, name="Chassis"))
    for s in (-1, 1):
        P.append(K.box((0.4, 0.05, 0.2), (s * 0.8, -4.42, 1.25), M["head"], bevel=0.02, name="Headlight"))
        P.append(K.box((0.3, 0.05, 0.15), (s * 1.0, 4.42, 1.2), M["tail"], bevel=0.02, name="Tail"))
        P.append(K.tube([(s * 1.15, -2.9, 1.2), (s * 1.2, -2.9, 3.2)], 0.08, M["chrome"], "Stack"))
    K.join(P, "Body")
    K.mount_wheels({"FL": (-1.15, -3.3, R), "FR": (1.15, -3.3, R), "ML": (-1.15, 1.6, R), "MR": (1.15, 1.6, R), "RL": (-1.15, 2.9, R), "RR": (1.15, 2.9, R)}, R, 0.48, M, "offroad", 8, "solid", caliper=False)
    export_model(oid)


def war_rig(oid, paint="#4a2e22", accent="#ff7a2e"):
    """Wasteland convoy semi: long-nose tractor (hood, grille, bumper ram, sleeper cab, chrome stacks, fuel tanks, mirrors,
    steps, roof markers, a grated windscreen) on twin chassis rails with a tandem drive axle, hauling a corrugated box
    trailer (ribbed sides, top/bottom rails, rear doors with lock bars, underride guard, landing gear, side armour,
    amber side markers, tail-lamp cluster, mud flaps) on its own tandem. Front is -Y (three.js +Z); 10.9 m long."""
    K.reset(); M = K.standard_mats(paint, 0.35, 0.6, accent)
    amber = K.mat("Marker", "#ffb02e", 0.0, 0.2, emit="#ff9a12", strength=4.0)
    P = []; R = 0.55
    # --- tractor
    P.append(K.loft_shell("Hood", 2.0, M["paint"], hw=[(0, 0.92), (.5, 1.02), (1, 1.06)], zc=[(0, 1.32), (1, 1.46)], hh=[(0, 0.42), (.4, 0.55), (1, 0.62)], sq=[(0, 4.5), (1, 5.5)], n=14, ring=36, y0=-5.25))
    P.append(K.loft_shell("Cab", 2.25, M["paint"], hw=[(0, 1.16), (1, 1.2)], zc=[(0, 2.02), (1, 2.06)], hh=[(0, 0.98), (1, 1.02)], sq=[(0, 6), (1, 6)], n=10, ring=36, y0=-3.3))
    P.append(K.box((2.28, 1.05, 0.55), (0, -1.6, 3.28), M["paint"], bevel=0.12, name="Sleeper"))
    for sx in (-1, 1):
        P.append(K.box((1.02, 0.06, 0.78), (sx * 0.53, -3.33, 2.48), M["glass"], bevel=0.02, rot=(math.radians(-10), 0, 0), name="Windscreen"))
        P.append(K.box((0.05, 1.1, 0.6), (sx * 1.21, -2.6, 2.5), M["glass"], bevel=0.01, name="SideWin"))
        # mirrors on arms
        P.append(K.tube([(sx * 1.18, -3.15, 2.35), (sx * 1.5, -3.3, 2.45), (sx * 1.55, -3.3, 2.75)], 0.025, M["chrome"], "MirrorArm"))
        P.append(K.box((0.07, 0.2, 0.46), (sx * 1.57, -3.3, 2.62), M["satin"], bevel=0.02, name="Mirror"))
        # front fenders over the steer axle, quarter fenders over the drive tandem
        P.append(K.box((0.52, 1.5, 0.1), (sx * 1.08, -3.75, 1.2), M["paint"], bevel=0.03, name="Fender"))
        P.append(K.box((0.5, 0.9, 0.08), (sx * 1.1, -0.38, 1.25), M["steel"], bevel=0.02, name="QuarterFender"))
        # fuel tank with straps, cab steps
        P.append(K.cyl(0.34, 1.2, (sx * 1.02, -2.35, 0.82), M["chrome"], rot=(math.pi / 2, 0, 0), verts=24, name="FuelTank"))
        for dy in (-0.4, 0.4):
            P.append(K.cyl(0.355, 0.05, (sx * 1.02, -2.35 + dy, 0.82), M["satin"], rot=(math.pi / 2, 0, 0), verts=24, name="TankStrap"))
        P.append(K.box((0.42, 0.42, 0.05), (sx * 1.12, -3.0, 0.45), M["steel"], bevel=0.01, name="Step"))
        # exhaust stacks with caps
        P.append(K.tube([(sx * 1.2, -1.95, 1.0), (sx * 1.2, -1.95, 3.95)], 0.09, M["chrome"], "Stack"))
        P.append(K.cyl(0.11, 0.12, (sx * 1.2, -1.95, 3.98), M["satin"], verts=14, name="StackCap"))
        # air horn
        P.append(K.cyl(0.05, 0.5, (sx * 0.35, -2.7, 3.12), M["chrome"], rot=(math.pi / 2, 0, 0), verts=10, r2=0.09, name="Horn"))
        P.append(K.box((0.36, 0.05, 0.22), (sx * 0.82, -5.27, 1.02), M["head"], bevel=0.02, name="Headlight"))
    # grille, slats, bumper ram with spikes, grated windscreen
    P.append(K.box((1.5, 0.05, 0.78), (0, -5.27, 1.4), M["chrome"], bevel=0.02, name="Grille"))
    for k in range(8):
        P.append(K.box((1.42, 0.06, 0.035), (0, -5.3, 1.1 + k * 0.085), M["trim"], bevel=0.0, name="Slat"))
    P.append(K.box((2.5, 0.34, 0.42), (0, -5.48, 0.75), M["steel"], bevel=0.04, name="Bumper"))
    P.append(K.box((2.3, 0.12, 0.7), (0, -5.68, 0.9), M["rust"], bevel=0.03, rot=(math.radians(14), 0, 0), name="Ram"))
    for k in range(7):
        P.append(K.cyl(0.06, 0.5, (-0.96 + k * 0.32, -5.92, 0.95), M["steel"], rot=(math.pi / 2, 0, 0), verts=8, r2=0.0, name="Spike"))
    for k in range(5):
        P.append(K.tube([(-1.0, -3.42, 2.15 + k * 0.17), (1.0, -3.42, 2.15 + k * 0.17)], 0.018, M["satin"], "Grate"))
    for k in range(5):
        P.append(K.box((0.14, 0.08, 0.06), (-0.5 + k * 0.25, -3.25, 3.07), amber, bevel=0.01, name="RoofMarker"))
    # chassis rails and fifth wheel
    for sx in (-1, 1):
        P.append(K.box((0.22, 10.3, 0.3), (sx * 0.55, -0.15, 0.92), M["satin"], bevel=0.02, name="Rail"))
    P.append(K.box((1.5, 1.05, 0.12), (0, -0.4, 1.12), M["satin"], bevel=0.02, name="FifthWheel"))
    # --- trailer: y -1.15 .. 5.45, floor z 1.25, roof z 3.7
    y0, y1, zb, zt = -1.15, 5.45, 1.25, 3.7
    L, yc, zc, H = y1 - y0, (y0 + y1) / 2, (zb + zt) / 2, zt - zb
    P.append(K.box((2.44, L, H), (0, yc, zc), M["rust"], bevel=0.04, name="Container"))
    P.append(K.box((2.32, L, 0.2), (0, yc, zb - 0.08), M["satin"], bevel=0.02, name="TrailerFloor"))
    n = 34
    for sx in (-1, 1):
        for k in range(n):
            P.append(K.box((0.05, 0.07, H - 0.18), (sx * 1.235, y0 + 0.15 + k * (L - 0.3) / (n - 1), zc), M["steel"], bevel=0.0, name="Rib"))
        for z in (zb + 0.04, zt - 0.05):
            P.append(K.box((0.09, L + 0.04, 0.12), (sx * 1.255, yc, z), M["steel"], bevel=0.01, name="SideRail"))
        P.append(K.box((0.05, 3.1, 0.55), (sx * 1.2, 1.55, 0.88), M["steel"], bevel=0.02, name="SideArmour"))
        for k, yy in enumerate((-0.8, 0.95, 2.7, 4.45)):
            P.append(K.box((0.04, 0.12, 0.08), (sx * 1.29, yy, zt - 0.14), amber, bevel=0.005, name="SideMarker"))
        P.append(K.box((0.5, 0.03, 0.55), (sx * 1.1, 5.12, 0.42), M["rubber"], bevel=0.0, name="MudFlap"))
        P.append(K.box((0.5, 0.03, 0.5), (sx * 1.1, 0.85, 0.45), M["rubber"], bevel=0.0, name="MudFlap"))
        P.append(K.cyl(0.06, 0.85, (sx * 0.9, 0.35, 0.72), M["steel"], verts=10, name="LandingLeg"))
        P.append(K.box((0.25, 0.25, 0.05), (sx * 0.9, 0.35, 0.3), M["steel"], bevel=0.0, name="LandingPad"))
        # rear doors: panel, hinges, two lock bars each
        P.append(K.box((1.17, 0.05, H - 0.12), (sx * 0.6, y1 + 0.02, zc), M["rust"], bevel=0.015, name="Door"))
        for bx in (0.3, 0.9):
            P.append(K.cyl(0.028, H - 0.25, (sx * bx, y1 + 0.07, zc), M["chrome"], verts=8, name="LockBar"))
            P.append(K.box((0.1, 0.05, 0.05), (sx * bx, y1 + 0.09, zc - 0.25), M["chrome"], bevel=0.0, name="Handle"))
        for z in (zb + 0.35, zc, zt - 0.35):
            P.append(K.box((0.12, 0.06, 0.16), (sx * 1.2, y1 + 0.04, z), M["steel"], bevel=0.0, name="Hinge"))
        P.append(K.box((0.36, 0.05, 0.14), (sx * 0.95, y1 + 0.06, zb + 0.15), M["tail"], bevel=0.01, name="Tail"))
        P.append(K.box((0.05, 0.06, 0.08), (sx * 1.22, y1 + 0.05, zt - 0.1), M["tail"], bevel=0.005, name="Tail"))
    P.append(K.box((2.3, 0.12, 0.14), (0, y1 - 0.1, 0.62), M["steel"], bevel=0.02, name="Underride"))
    for sx in (-1, 1):
        P.append(K.box((0.08, 0.08, 0.5), (sx * 0.7, y1 - 0.15, 0.9), M["steel"], bevel=0.0, name="UnderrideStrut"))
    P.append(K.box((2.2, 0.02, 0.22), (0, y0 - 0.01, zt - 0.4), M["paint"], bevel=0.0, name="FrontBand"))
    K.join(P, "Body")
    K.mount_wheels({"FL": (-1.08, -3.75, R), "FR": (1.08, -3.75, R),
                    "D1L": (-1.08, -0.95, R), "D1R": (1.08, -0.95, R), "D2L": (-1.08, 0.2, R), "D2R": (1.08, 0.2, R),
                    "T1L": (-1.08, 3.6, R), "T1R": (1.08, 3.6, R), "T2L": (-1.08, 4.72, R), "T2R": (1.08, 4.72, R)},
                   R, 0.5, M, "offroad", 8, "solid", caliper=False)
    export_model(oid)


def helicopter(oid, paint="#39465a", accent="#59e7f9"):
    K.reset(); M = K.standard_mats(paint, 0.5, 0.45, accent)
    P = []
    P.append(K.loft_shell("Fuselage", 7.0, M["paint"], hw=[(0, .15), (.08, .55), (.25, .8), (.45, .85), (.6, .6), (.75, .22), (1, .14)],
                          zc=[(0, 1.4), (.2, 1.5), (.5, 1.65), (.75, 1.95), (1, 2.05)], hh=[(0, .15), (.1, .55), (.3, .78), (.5, .72), (.65, .4), (.8, .16), (1, .12)],
                          sq=[(0, 2.3), (.4, 2.8), (1, 2.3)], n=48, ring=32, y0=-3.0))
    P.append(K.loft_shell("Canopy", 2.1, M["glass"], hw=[(0, .2), (.4, .6), (1, .55)], zc=[(0, 1.9), (.5, 2.15), (1, 2.25)], hh=[(0, .1), (.5, .45), (1, .35)], n=20, ring=28, y0=-2.6))
    for s in (-1, 1):
        P.append(K.box((1.4, 0.7, 0.08), (s * 1.3, 0.2, 1.3), M["paint"], bevel=0.02, name="StubWing"))
        P.append(K.cyl(0.18, 1.2, (s * 1.8, 0.1, 1.12), M["satin"], rot=(math.pi / 2, 0, 0), verts=16, name="RocketPod"))
        P.append(K.tube([(s * .7, -1.6, .05), (s * .7, 1.2, .05)], 0.05, M["satin"], "Skid"))
        P.append(K.tube([(s * .7, -0.9, .05), (s * .55, -0.9, .95)], 0.04, M["satin"], "Strut"))
        P.append(K.tube([(s * .7, 0.6, .05), (s * .55, 0.6, .95)], 0.04, M["satin"], "Strut"))
    P.append(K.box((0.08, 0.9, 0.9), (0, 3.8, 2.4), M["paint"], bevel=0.02, name="Fin"))
    P.append(K.box((1.4, 0.5, 0.06), (0, 3.5, 2.05), M["paint"], bevel=0.02, name="Stab"))
    P.append(K.cyl(0.35, 0.5, (0, 0.3, 2.45), M["satin"], verts=24, name="Mast"))
    P.append(K.box((0.2, 0.05, 0.08), (0, -3.0, 1.35), M["head"], bevel=0.01, name="Headlight"))
    P.append(K.box((0.12, 0.05, 0.06), (0, 4.0, 2.05), M["tail"], bevel=0.01, name="Tail"))
    P.append(K.cyl(0.18, 0.4, (0, -2.95, 1.05), M["satin"], rot=(math.pi / 2, 0, 0), verts=16, name="ChinGun"))
    K.join(P, "Body")
    blades = [K.cyl(0.25, 0.15, (0, 0, 0), M["satin"], verts=20)]
    for k in range(4):
        b = K.box((5.4, 0.32, 0.04), (2.7, 0, 0), M["satin"], bevel=0.01, name="Blade")
        b.rotation_euler = (0, 0, k * math.pi / 2); b.location = (2.7 * math.cos(k * math.pi / 2), 2.7 * math.sin(k * math.pi / 2), 0)
        bpy.context.view_layer.objects.active = b; bpy.ops.object.transform_apply(location=True, rotation=True)
        blades.append(b)
    r = K.join(blades, "Rotor"); r.location = (0, 0.3, 2.75)
    tail = [K.cyl(0.08, 0.1, (0, 0, 0), M["satin"], rot=(0, math.pi / 2, 0), verts=12)]
    for k in range(3):
        a = k * 2 * math.pi / 3
        b = K.box((0.03, 0.1, 0.65), (0, 0, 0.32), M["satin"], bevel=0.0)
        b.location = (0, 0.32 * math.sin(a), 0.32 * math.cos(a)); b.rotation_euler = (-a, 0, 0)
        bpy.context.view_layer.objects.active = b; bpy.ops.object.transform_apply(location=True, rotation=True)
        tail.append(b)
    t = K.join(tail, "RotorTail"); t.location = (0.12, 3.9, 2.45)
    export_model(oid)


def jet(oid, paint="#384a6b", accent="#64bdfc"):
    K.reset(); M = K.standard_mats(paint, 0.7, 0.35, accent)
    P = []
    P.append(K.loft_shell("Fuselage", 11.0, M["paint"], hw=[(0, .02), (.12, .45), (.3, .75), (.6, .95), (.9, .9), (1, .75)],
                          zc=[(0, 1.6), (.3, 1.75), (1, 1.75)], hh=[(0, .02), (.12, .38), (.3, .58), (.6, .55), (1, .45)],
                          sq=[(0, 2.2), (.5, 2.8), (1, 3)], n=56, ring=32, y0=-5.5))
    P.append(K.loft_shell("Canopy", 2.6, M["glass"], hw=[(0, .05), (.4, .42), (1, .2)], zc=[(0, 2.1), (.5, 2.35), (1, 2.25)], hh=[(0, .03), (.5, .32), (1, .1)], n=20, ring=24, y0=-3.3))
    for s in (-1, 1):
        P.append(K.wing_panel(4.6, 4.4, 0.8, 3.2, 0.14, (s * 0.7, 1.4, 1.6), M["paint"], side=s))
        P.append(K.wing_panel(1.6, 1.6, 0.6, 1.0, 0.08, (s * 0.6, 4.6, 1.8), M["paint"], side=s))
        fin = K.wing_panel(1.5, 1.9, 0.7, 1.0, 0.08, (s * 0.55, 4.3, 2.1), M["paint"], side=s, dihedral=math.radians(62))
        P.append(fin)
        P.append(K.box((0.6, 3.2, 0.4), (s * 0.95, 0.0, 1.4), M["satin"], bevel=0.08, name="Intake"))
        P.append(K.cyl(0.42, 0.25, (s * 0.45, 5.5, 1.7), M["accent"], rot=(math.pi / 2, 0, 0), verts=24, name="Afterburner"))
    P.append(K.box((0.2, 0.05, 0.05), (0, -5.0, 1.45), M["head"], bevel=0.01, name="Headlight"))
    for s in (-1, 1):
        P.append(K.box((0.15, 0.3, 0.05), (s * 5.25, 4.1, 1.62), M["tail"] if s < 0 else K.mat("NavGreen", "#20ff60", 0, .2, emit="#20ff60", strength=5), bevel=0.01, name="Nav"))
    finish_model(oid, P)


def skimmer(oid, paint="#241d45", accent="#b877ff"):
    K.reset(); M = K.standard_mats(paint, 0.85, 0.2, accent)
    P = []
    v = [(0, -5.2, 1.6), (-4.6, 3.2, 1.3), (4.6, 3.2, 1.3), (0, 2.6, 2.4), (0, 2.4, 0.9)]
    P.append(K.wedge(v, [(0, 3, 1), (0, 2, 3), (0, 1, 4), (0, 4, 2), (1, 3, 2), (1, 2, 4)], M["paint"], "Hull"))
    P.append(K.loft_shell("Canopy", 2.4, M["glass"], hw=[(0, .05), (.5, .5), (1, .3)], zc=[(0, 1.9), (.5, 2.15), (1, 2.2)], hh=[(0, .02), (.5, .3), (1, .15)], n=16, ring=24, y0=-2.6))
    for s in (-1, 1):
        P.append(K.box((0.06, 6.0, 0.05), (s * 2.0, 0.0, 1.62), M["accent"], bevel=0.0, rot=(0, 0, s * -0.42), name="GlowLine"))
        P.append(K.cyl(0.45, 0.3, (s * 1.5, 3.1, 1.5), M["accent"], rot=(math.pi / 2, 0, 0), verts=24, name="Thruster"))
    P.append(K.box((0.3, 0.05, 0.06), (0, -5.0, 1.62), M["head"], bevel=0.01, name="Headlight"))
    finish_model(oid, P)


def drone(oid, paint="#1d2439", accent="#e15bff"):
    K.reset(); M = K.standard_mats(paint, 0.85, 0.25, accent)
    P = [K.sphere(0.9, (0, 0, 1.6), M["paint"], scale=(1, 1.4, 0.6), seg=32, rings=16)]
    P.append(K.sphere(0.25, (0, -1.15, 1.6), K.mat("Eye", "#ff2030", 0, .1, emit="#ff1020", strength=8), seg=20, rings=10))
    fans = []
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        x, y = math.cos(a) * 1.8, math.sin(a) * 1.8
        P.append(K.tube([(math.cos(a) * 0.7, math.sin(a) * 0.7, 1.6), (x, y, 1.6)], 0.08, M["satin"], "Arm"))
        bpy.ops.mesh.primitive_torus_add(major_radius=0.75, minor_radius=0.1, major_segments=40, minor_segments=10, location=(x, y, 1.6))
        t = bpy.context.object; t.data.materials.append(M["paint"]); P.append(t)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.68, minor_radius=0.03, major_segments=40, minor_segments=6, location=(x, y, 1.52))
        g = bpy.context.object; g.data.materials.append(M["accent"]); P.append(g)
        blades = [K.box((1.3, 0.12, 0.02), (0, 0, 0), M["satin"], bevel=0.0), K.box((0.12, 1.3, 0.02), (0, 0, 0), M["satin"], bevel=0.0)]
        r = K.join(blades, f"Rotor{k}"); r.location = (x, y, 1.62); fans.append(r)
    finish_model(oid, P)


def boat(oid, kind="patrol", paint="#6b6252", accent="#e2a568"):
    K.reset(); M = K.standard_mats(paint, 0.4, 0.55, accent)
    P = []
    if kind == "patrol":
        P.append(K.loft_shell("Hull", 7.2, M["paint"], hw=[(0, .1), (.15, .9), (.4, 1.3), (1, 1.25)], zc=[(0, .95), (.2, .7), (1, .6)], hh=[(0, .15), (.2, .45), (1, .5)],
                              sq=[(0, 3), (1, 4)], vee=[(0, .9), (.3, .8), (1, .4)], n=40, ring=32))
        # wheelhouse: tapered cabin with a raked window band, overhanging roof, radar mast and searchlight
        P.append(K.loft_shell("Wheelhouse", 2.4, M["rust"], hw=[(0, .9), (.3, 1.02), (1, 1.05)], zc=[(0, 1.55), (1, 1.62)], hh=[(0, .45), (.3, .58), (1, .62)], sq=[(0, 5), (1, 6)], n=10, ring=32, y0=-0.8))
        for sx in (-1, 1):
            P.append(K.box((0.86, 0.06, 0.42), (sx * 0.46, -0.78, 1.82), M["glass"], bevel=0.01, rot=(math.radians(-22), 0, math.radians(sx * 8)), name="Windscreen"))
            P.append(K.box((0.05, 1.3, 0.36), (sx * 1.03, 0.35, 1.84), M["glass"], bevel=0.01, name="SideWin"))
            for k in range(4):  # fenders hung along the gunwale
                P.append(K.cyl(0.16, 0.14, (sx * 1.3, -0.6 + k * 1.2, 0.8), M["rubber"], rot=(0, math.pi / 2, 0), verts=14, name="Fender"))
            P.append(K.box((0.35, 0.6, 0.9), (sx * 0.45, 3.85, 0.75), M["satin"], bevel=0.05, name="Outboard"))
            P.append(K.box((0.2, 0.25, 0.08), (sx * 0.55, -3.0, 1.1), M["steel"], bevel=0.01, name="Cleat"))
        P.append(K.box((2.3, 2.7, 0.1), (0, 0.3, 2.24), M["satin"], bevel=0.03, name="Roof"))
        P.append(K.tube([(0, 1.0, 2.3), (0, 1.0, 3.4)], 0.04, M["steel"], "Mast"))
        P.append(K.box((0.9, 0.12, 0.06), (0, 1.0, 3.25), M["satin"], bevel=0.01, name="Radar"))
        P.append(K.cyl(0.14, 0.22, (0.7, -0.6, 2.4), M["chrome"], rot=(math.pi / 2, 0, 0), verts=16, name="Searchlight"))
        for sx in (-1, 1):
            P.append(K.box((0.06, 4.4, 0.08), (sx * 1.27, 1.3, 1.02), M["steel"], bevel=0.0, name="RubRail"))
        P.append(K.cyl(0.4, 0.3, (0, -2.3, 1.25), M["steel"], verts=20, name="GunRing"))
        P.append(K.cyl(0.07, 1.4, (0, -3.0, 1.55), M["satin"], rot=(math.pi / 2, 0, 0), verts=10, name="Gun"))
        for s in (-1, 1):
            P.append(K.tube([(s * 0.75, -2.6, 1.2), (s * 1.12, -1.0, 1.2), (s * 1.18, 3.4, 1.2)], 0.03, M["steel"], "Rail"))
        P.append(K.box((0.35, 0.06, 0.2), (0, -0.7, 2.25), M["head"], bevel=0.01, name="Headlight"))
        P.append(K.box((1.4, 0.8, 0.5), (0, 3.0, 1.1), M["steel"], bevel=0.05, name="EngineHatch"))
    elif kind == "sub":
        P.append(K.loft_shell("Hull", 6.5, M["paint"], hw=[(0, .05), (.15, .7), (.5, 1.0), (.85, .8), (1, .3)], zc=[(0, 1.0), (1, 1.1)], hh=[(0, .05), (.15, .5), (.5, .65), (.85, .5), (1, .2)], sq=[(0, 2.2), (1, 2.4)], n=40, ring=32))
        P.append(K.loft_shell("Canopy", 2.0, M["glass"], hw=[(0, .1), (.5, .55), (1, .3)], zc=[(0, 1.55), (.5, 1.75), (1, 1.7)], hh=[(0, .05), (.5, .35), (1, .15)], n=16, ring=24, y0=-1.8))
        for s in (-1, 1):
            P.append(K.wing_panel(1.4, 1.4, 0.6, 0.6, 0.06, (s * 0.9, 1.6, 1.0), M["paint"], side=s))
            P.append(K.box((0.04, 4.4, 0.04), (s * 0.98, 0.0, 1.15), M["accent"], bevel=0.0, name="GlowLine"))
            P.append(K.cyl(0.25, 0.6, (s * 0.7, 3.1, 0.9), M["accent"], rot=(math.pi / 2, 0, 0), verts=20, name="Thruster"))
        P.append(K.box((0.3, 0.05, 0.08), (0, -3.2, 1.0), M["head"], bevel=0.01, name="Headlight"))
    else:  # leviathan
        P.append(K.loft_shell("Hull", 18.0, M["paint"], hw=[(0, .2), (.15, 2.6), (.4, 3.4), (1, 3.2)], zc=[(0, 2.4), (.2, 1.8), (1, 1.7)], hh=[(0, .4), (.2, 1.4), (1, 1.6)],
                              sq=[(0, 3), (1, 5)], vee=[(0, .9), (.3, .6), (1, .3)], n=48, ring=36))
        P.append(K.box((5.0, 7.0, 2.0), (0, 2.5, 4.2), M["paint"], bevel=0.12, name="Deck"))
        P.append(K.box((3.2, 3.2, 3.0), (0, 3.5, 6.6), M["paint"], bevel=0.12, name="Tower"))
        P.append(K.box((3.0, 0.1, 0.5), (0, 1.88, 7.3), M["accent"], bevel=0.0, name="Bridge"))
        for k in range(3):
            P.append(K.cyl(0.9, 0.6, (0, -3.0 - k * 2.4, 3.5), M["satin"], verts=24, name="Turret"))
            P.append(K.cyl(0.14, 3.0, (0, -4.5 - k * 2.4, 3.7), M["satin"], rot=(math.pi / 2, 0, 0), verts=12, name="Gun"))
        for s in (-1, 1):
            P.append(K.box((0.08, 14.0, 0.12), (s * 3.3, 0.5, 3.1), M["accent"], bevel=0.0, name="GlowLine"))
        P.append(K.cyl(0.2, 4.0, (0, 3.5, 10.0), M["satin"], verts=12, name="Mast"))
    finish_model(oid, P)


BUILDS = {
    # Nexus City street cars
    "street-racer": lambda: car("street-racer", "racer", "#2a0a6e", "#c040ff", wing=True, skirts=True, splitter=True, diffuser=True, rim_color="#202226"),
    "muscle-car": lambda: car("muscle-car", "muscle", "#9aa3ad", "#3aa0ff", 0.9, 0.2, rim_style="solid", spokes=10, lamps="round", exhausts=2, rim_color="#1c1d20", caliper="#202020"),
    "luxury-sedan": lambda: car("luxury-sedan", "sedan", "#0c0d10", "#d8f0ff", 0.7, 0.16, rim_style="split", spokes=10, seats=2, rim_color="#c8ccd2", underglow=False, caliper="#3a3a3e"),
    "tuner": lambda: car("tuner", "tuner", "#1b2e66", "#38e8ff", 0.75, 0.25, rim_style="solid", spokes=6, roof_rack=True, skirts=True, rim_color="#2a2c30", seats=2),
    # Neon City
    "hover-car": lambda: car("hover-car", "hover", "#08090d", "#ff2bd6", 0.9, 0.12, hover=True, exhausts=0, lamps="slim"),
    "city-pod": lambda: car("city-pod", "pod", "#e8ecf2", "#38e8ff", 0.2, 0.3, rim_style="solid", spokes=8, exhausts=0, underglow=False, rim_color="#d0d4da", caliper="#808890"),
    "security-suv": lambda: car("security-suv", "suv", "#c9ced6", "#2a7bff", 0.8, 0.25, rim_style="solid", spokes=6, lightbar="police", seats=2, rim_color="#1e2024", tread="offroad", lamps="slim"),
    # Wastelands
    "offroad-truck": lambda: car("offroad-truck", "suv", "#3a3530", "#ffb040", 0.5, 0.55, rim_style="solid", spokes=8, tread="offroad", roof_rack=True, lightbar="lamps", bullbar=True, seats=2, rim_color="#2a2a2a", lamps="square", underglow=False, caliper="#3a3a3a", extra=rugged_kit),
    "raider-buggy": lambda: buggy("raider-buggy"),
    "aether-hoverbike": lambda: bike("aether-hoverbike"),
    "goliath-tank": lambda: tank("goliath-tank"),
    "fracture-behemoth": lambda: tank("fracture-behemoth", "#3b3b40", "#fa7c39", big=True),
    "tech-transport": lambda: transport("tech-transport"),
    "war-rig": lambda: war_rig("war-rig", "#4a2e22", "#ff7a2e"),
    "rift-helicopter": lambda: helicopter("rift-helicopter"),
    "vanguard-jet": lambda: jet("vanguard-jet"),
    "void-skimmer": lambda: skimmer("void-skimmer"),
    "ai-interceptor": lambda: drone("ai-interceptor"),
    "scrap-patrol-boat": lambda: boat("scrap-patrol-boat", "patrol"),
    "hydro-sub-skiff": lambda: boat("hydro-sub-skiff", "sub", "#204f62", "#55e4e9"),
    "leviathan": lambda: boat("leviathan", "leviathan", "#243f50", "#3ce5f3"),
    "armored-muscle": lambda: car("armored-muscle", "muscle", "#5e3a24", "#ff7a2e", 0.4, 0.62, rim_style="solid", spokes=6, tread="offroad", armor=True, spikes=True, lamps="round", rim_color="#2a2a2a", underglow=False, caliper="#3a3a3a"),
}

if __name__ == "__main__":
    for oid, fn in BUILDS.items():
        if ONLY and oid not in ONLY:
            continue
        fn()
