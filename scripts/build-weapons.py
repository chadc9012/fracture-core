"""
Builds the first-person sidearm, shotgun, heavy, launcher and sword GLBs (public/models/weapons/<name>.glb) in the
same worn-gunmetal / black-polymer style as the rifle (scripts/build-rifle.py) and the operator reference art.

    pip install bpy && python3 scripts/build-weapons.py pistol|shotgun|heavy|launcher|sword|all [outdir]

Layouts follow the procedural stand-ins in src/components/game/ViewWeapon.tsx so the hands (SUPPORT), muzzle flash
(MUZZLE) and reload rig pivots line up: origin at the firing-hand grip, barrel toward -Z (three.js weapon space).
"""
import math
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import weapon_kit as k  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, "..", "public", "models", "weapons")
POLY = 0.0


def pistol():
    body = []
    frame = k.box("frame", (0.036, 0.03, 0.17), (0, 0.042, -0.085), bevel=0.004, mask=POLY)
    body.append(frame)
    body.append(k.box("dustcover_rail", (0.03, 0.008, 0.06), (0, 0.024, -0.14), bevel=0.0015, mask=POLY))
    for i in range(3):
        body.append(k.box(f"rail_slot{i}", (0.032, 0.004, 0.006), (0, 0.019, -0.125 - i * 0.015), bevel=0.0008, mask=POLY))
    # trigger guard: a closed loop, bottom bar plus a front post up into the frame
    body.append(k.box("guard_bar", (0.012, 0.008, 0.062), (0, 0.006, -0.038), bevel=0.003, mask=POLY))
    body.append(k.box("guard_post", (0.012, 0.03, 0.01), (0, 0.018, -0.068), bevel=0.003, mask=POLY))
    body.append(k.box("trigger", (0.006, 0.022, 0.008), (0, 0.018, -0.03), bevel=0.0015))
    grip = k.box("grip", (0.034, 0.105, 0.048), (0, -0.022, 0.004), bevel=0.007, rot=(-0.28, 0, 0), mask=POLY)
    # finger grooves on the front strap, like the rifle grip
    for i in range(3):
        k.cut(grip, k.cyl(f"groove{i}", 0.008, 0.06, (0, -0.002 - i * 0.026, -0.03 + i * 0.008), axis="x", verts=12, bevel=0))
    body.append(grip)
    body.append(k.box("beavertail", (0.03, 0.012, 0.03), (0, 0.04, 0.02), bevel=0.004, mask=POLY))
    body.append(k.cyl("barrel_tip", 0.0085, 0.03, (0, 0.077, -0.2), verts=16, bevel=0))
    # slide (Action): long chamfered block, ejection port, rear serrations, front sight + rear sight
    slide = k.box("slide", (0.038, 0.04, 0.21), (0, 0.077, -0.085), bevel=0.005)
    k.cut(slide, k.box("eject", (0.03, 0.02, 0.045), (0.02, 0.085, -0.07), bevel=0))
    k.cut(slide, k.cyl("bore", 0.006, 0.05, (0, 0.077, -0.19), verts=14, bevel=0))
    for i in range(5):
        k.cut(slide, k.box(f"serr{i}", (0.05, 0.03, 0.003), (0, 0.08, 0.0 - i * 0.008), bevel=0))
    action = [slide,
              k.box("front_sight", (0.006, 0.008, 0.008), (0, 0.1, -0.18), bevel=0.001),
              k.box("rear_sight", (0.03, 0.009, 0.01), (0, 0.1, 0.006), bevel=0.0015)]
    # magazine (pivot at the grip's mag well): floorplate below the grip
    mag = [k.box("mag", (0.026, 0.09, 0.036), (0, -0.04, 0.004), bevel=0.002, rot=(-0.28, 0, 0)),
           k.box("floorplate", (0.034, 0.012, 0.05), (0, -0.083, 0.018), bevel=0.003, rot=(-0.28, 0, 0), mask=POLY)]
    accent = [k.box("strip_l", (0.003, 0.004, 0.13), (0.0195, 0.07, -0.1), bevel=0.0008),
              k.box("strip_r", (0.003, 0.004, 0.13), (-0.0195, 0.07, -0.1), bevel=0.0008),
              k.box("dot_front", (0.003, 0.003, 0.002), (0, 0.104, -0.18), bevel=0)]
    k.assemble("Pistol", {"Body": body, "Action": action, "Mag": mag}, accent, mag_pivot=(0, -0.01, 0.005))


def shotgun():
    body = []
    rec = k.box("receiver", (0.062, 0.085, 0.28), (0, 0.07, -0.1), bevel=0.006)
    k.cut(rec, k.box("port", (0.03, 0.03, 0.08), (0.03, 0.075, -0.1), bevel=0))
    k.cut(rec, k.box("load_port", (0.03, 0.02, 0.08), (0, 0.025, -0.13), bevel=0))
    body.append(rec)
    body.append(k.box("rail", (0.028, 0.01, 0.2), (0, 0.117, -0.12), bevel=0.0015))
    body.append(k.cyl("barrel", 0.019, 0.52, (0, 0.096, -0.49), verts=20, bevel=0))
    # ventilated heat shield over the barrel
    shield = k.box("heatshield", (0.05, 0.03, 0.34), (0, 0.11, -0.44), bevel=0.004)
    k.cut(shield, k.box("shield_hollow", (0.04, 0.03, 0.36), (0, 0.097, -0.44), bevel=0))
    for i in range(6):
        k.cut(shield, k.box(f"vent{i}", (0.07, 0.012, 0.03), (0, 0.118, -0.31 - i * 0.05), bevel=0))
    body.append(shield)
    body.append(k.cyl("mag_tube", 0.017, 0.42, (0, 0.055, -0.45), verts=18, bevel=0.001))
    body.append(k.cyl("tube_cap", 0.02, 0.03, (0, 0.055, -0.675), verts=18, bevel=0.002))
    body.append(k.cyl("bead", 0.004, 0.006, (0, 0.118, -0.74), axis="y", verts=8, bevel=0))
    body.append(k.box("guard", (0.012, 0.008, 0.07), (0, 0.004, -0.04), bevel=0.003))
    body.append(k.box("grip", (0.04, 0.11, 0.05), (0, -0.022, 0.004), bevel=0.008, rot=(-0.3, 0, 0), mask=POLY))
    body.append(k.box("stock", (0.048, 0.07, 0.22), (0, 0.05, 0.15), bevel=0.01, mask=POLY))
    body.append(k.box("pad", (0.052, 0.12, 0.028), (0, 0.03, 0.27), bevel=0.008, mask=POLY))
    for z in (-0.03, -0.17):
        body.append(k.cyl(f"pin{z}", 0.005, 0.068, (0, 0.06, z), axis="x", verts=10, bevel=0.0008))
    # pump (Action): ribbed polymer forend on the mag tube
    pump = k.box("pump", (0.058, 0.05, 0.14), (0, 0.05, -0.38), bevel=0.008, mask=POLY)
    for i in range(5):
        k.cut(pump, k.box(f"rib{i}", (0.07, 0.006, 0.008), (0, 0.035 - (i % 2) * 0.012, -0.33 - i * 0.022), bevel=0))
    action = [pump]
    # shell (Mag): the one being thumbed into the loading port on reload
    shell = [k.cyl("hull", 0.0105, 0.052, (0, 0.008, -0.12), verts=16, bevel=0, mask=POLY),
             k.cyl("brass", 0.0112, 0.014, (0, 0.008, -0.096), verts=16, bevel=0.001)]
    accent = [k.box("strip_l", (0.003, 0.005, 0.2), (0.032, 0.098, -0.11), bevel=0.0008),
              k.box("strip_r", (0.003, 0.005, 0.2), (-0.032, 0.098, -0.11), bevel=0.0008),
              k.box("pump_strip", (0.003, 0.004, 0.1), (0.03, 0.06, -0.38), bevel=0.0008)]
    k.assemble("Shotgun", {"Body": body, "Action": action, "Mag": shell}, accent, mag_pivot=(0, 0.02, -0.12))


def heavy():
    body = []
    rec = k.box("receiver", (0.1, 0.12, 0.44), (0, 0.08, -0.15), bevel=0.008)
    k.cut(rec, k.box("eject", (0.04, 0.03, 0.09), (0.05, 0.085, -0.1), bevel=0))
    body.append(rec)
    body.append(k.box("top_cover", (0.09, 0.05, 0.16), (0, 0.16, -0.1), bevel=0.008))
    body.append(k.box("cover_hinge", (0.096, 0.014, 0.02), (0, 0.145, -0.02), bevel=0.003))
    body.append(k.box("rail", (0.03, 0.01, 0.2), (0, 0.19, -0.2), bevel=0.0015))
    for i in range(7):
        body.append(k.box(f"slot{i}", (0.034, 0.006, 0.01), (0, 0.197, -0.11 - i * 0.025), bevel=0.0008))
    # barrel shroud with cooling cut-outs, then the bare barrel and a flash hider
    shroud = k.cyl("shroud", 0.046, 0.3, (0, 0.08, -0.52), verts=24, bevel=0.003)
    for i in range(5):
        k.cut(shroud, k.box(f"cool{i}", (0.12, 0.03, 0.028), (0, 0.08, -0.4 - i * 0.055), bevel=0))
    body.append(shroud)
    body.append(k.cyl("barrel", 0.016, 0.42, (0, 0.08, -0.52), verts=18, bevel=0))
    hider = k.cyl("hider", 0.024, 0.06, (0, 0.08, -0.71), verts=18, bevel=0.002)
    for i in range(4):
        k.cut(hider, k.box(f"prong{i}", (0.008, 0.08, 0.05), (0, 0.08, -0.73), bevel=0, rot=(0, 0, i * math.pi / 4)))
    body.append(hider)
    body.append(k.box("carry", (0.024, 0.03, 0.14), (0, 0.13, -0.42), bevel=0.006, mask=POLY))
    body.append(k.box("bipod_mount", (0.04, 0.02, 0.04), (0, 0.03, -0.6), bevel=0.003))
    body.append(k.box("guard", (0.014, 0.01, 0.08), (0, -0.002, -0.045), bevel=0.003))
    body.append(k.box("grip", (0.044, 0.12, 0.052), (0, -0.03, 0.004), bevel=0.008, rot=(-0.25, 0, 0), mask=POLY))
    body.append(k.cyl("foregrip", 0.019, 0.1, (0, -0.012, -0.36), axis="y", verts=16, bevel=0.003, mask=POLY))
    body.append(k.box("stock", (0.05, 0.09, 0.2), (0, 0.06, 0.16), bevel=0.012, mask=POLY))
    body.append(k.box("pad", (0.056, 0.13, 0.03), (0, 0.045, 0.27), bevel=0.008, mask=POLY))
    # drum (Mag), pivot under the receiver
    drum = [k.cyl("drum", 0.062, 0.07, (0, -0.06, -0.2), axis="x", verts=28, bevel=0.004),
            k.cyl("drum_hub", 0.024, 0.08, (0, -0.06, -0.2), axis="x", verts=16, bevel=0.002, mask=POLY),
            k.box("drum_neck", (0.05, 0.04, 0.05), (0, -0.005, -0.2), bevel=0.004)]
    action = [k.box("charge", (0.03, 0.03, 0.06), (0.068, 0.1, -0.05), bevel=0.004),
              k.cyl("charge_knob", 0.012, 0.02, (0.088, 0.1, -0.05), axis="x", verts=12, bevel=0.001)]
    accent = [k.cyl(f"ring{i}", 0.049, 0.012, (0, 0.08, -0.43 - i * 0.08), verts=24, bevel=0) for i in range(3)]
    accent += [k.box("strip_l", (0.004, 0.006, 0.3), (0.051, 0.11, -0.16), bevel=0.001),
               k.box("strip_r", (0.004, 0.006, 0.3), (-0.051, 0.11, -0.16), bevel=0.001)]
    k.assemble("Heavy", {"Body": body, "Action": action, "Mag": drum}, accent, mag_pivot=(0, 0, -0.2))


def launcher():
    body = []
    tube = k.cyl("tube", 0.075, 0.8, (0, 0.12, -0.2), verts=32, bevel=0.003)
    k.cut(tube, k.cyl("bore", 0.062, 0.84, (0, 0.12, -0.2), verts=32, bevel=0))
    body.append(tube)
    body.append(k.cyl("muzzle_ring", 0.086, 0.07, (0, 0.12, -0.6), verts=32, bevel=0.004))
    body.append(k.cyl("breech_ring", 0.09, 0.09, (0, 0.12, 0.2), verts=32, bevel=0.004))
    for i in range(4):
        body.append(k.cyl(f"band{i}", 0.079, 0.018, (0, 0.12, -0.42 + i * 0.16), verts=32, bevel=0.002, mask=POLY))
    body.append(k.box("sight_mount", (0.02, 0.05, 0.06), (0.06, 0.16, -0.15), bevel=0.003))
    sight = k.box("sight", (0.05, 0.06, 0.12), (0.085, 0.18, -0.15), bevel=0.006)
    k.cut(sight, k.box("sight_window", (0.036, 0.04, 0.14), (0.085, 0.183, -0.15), bevel=0))
    body.append(sight)
    body.append(k.box("cheek", (0.03, 0.04, 0.14), (-0.07, 0.15, 0.08), bevel=0.008, mask=POLY))
    body.append(k.box("grip_mount", (0.04, 0.04, 0.08), (0, 0.04, -0.01), bevel=0.004))
    body.append(k.box("grip", (0.044, 0.12, 0.05), (0, -0.012, 0.004), bevel=0.008, rot=(-0.25, 0, 0), mask=POLY))
    body.append(k.box("guard", (0.012, 0.008, 0.07), (0, 0.004, -0.04), bevel=0.003))
    body.append(k.box("fore_mount", (0.036, 0.04, 0.05), (0, 0.04, -0.3), bevel=0.004))
    body.append(k.cyl("foregrip", 0.018, 0.08, (0, 0.0, -0.3), axis="y", verts=16, bevel=0.003, mask=POLY))
    # rocket cell (Mag), loaded at the breech
    cell = [k.cyl("cell", 0.06, 0.12, (0, 0.12, 0.25), verts=28, bevel=0.004),
            k.cyl("cell_cap", 0.05, 0.02, (0, 0.12, 0.315), verts=28, bevel=0.002, mask=POLY)]
    accent = [k.box("sight_glass", (0.03, 0.026, 0.004), (0.085, 0.183, -0.088), bevel=0),
              k.cyl("cell_band", 0.0615, 0.02, (0, 0.12, 0.25), verts=28, bevel=0),
              k.box("tube_strip", (0.006, 0.005, 0.5), (0.074, 0.12, -0.2), bevel=0.001)]
    k.assemble("Launcher", {"Body": body, "Mag": cell}, accent, mag_pivot=(0, 0.12, 0.25),
               colors={"metal": (0.11, 0.105, 0.1)})


def sword():
    body = []
    # wrapped grip with ridges, a pommel and a cross-guard (the hilt bakes in the worn kit)
    grip = k.cyl("grip", 0.016, 0.16, (0, 0, 0.04), verts=16, bevel=0.002, mask=POLY)
    for i in range(6):
        body.append(k.cyl(f"wrap{i}", 0.0175, 0.008, (0, 0, -0.025 + i * 0.026), verts=16, bevel=0.001, mask=POLY))
    body.append(grip)
    body.append(k.cyl("pommel", 0.022, 0.03, (0, 0, 0.13), verts=8, bevel=0.004))
    guard = k.box("guard", (0.15, 0.03, 0.035), (0, 0, -0.05), bevel=0.006)
    body.append(guard)
    body.append(k.box("collar", (0.05, 0.026, 0.04), (0, 0, -0.08), bevel=0.004))
    # blade: tapered, with a fuller cut down each side; polished steel, not the worn kit
    blade = k.box("blade", (0.046, 0.009, 0.82), (0, 0, -0.5), bevel=0.0015)
    import bpy
    bpy.context.view_layer.objects.active = blade
    # taper to a point: pull the far end vertices toward the centre line
    for v in blade.data.vertices:
        t = max(0.0, min(1.0, (v.co.y + 0.41) / 0.82))  # object-local; Blender +Y = weapon -Z, the tip end
        if t > 0.8:
            v.co.x *= max(0.05, 1 - (t - 0.8) / 0.2)
    k.cut(blade, k.box("fuller_l", (0.012, 0.004, 0.55), (0, 0.0055, -0.42), bevel=0))
    k.cut(blade, k.box("fuller_r", (0.012, 0.004, 0.55), (0, -0.0055, -0.42), bevel=0))
    k.finish(blade)
    steel = k.plain_material("SwordBlade", (0.62, 0.64, 0.68), 0.95, 0.16)
    accent = [k.box("edge", (0.004, 0.006, 0.6), (0.025, 0, -0.44), bevel=0),
              k.box("guard_gem", (0.02, 0.02, 0.02), (0, 0, -0.05), bevel=0.003)]
    k.assemble("Sword", {"Body": body}, accent, plain={"Blade": ([blade], steel)})


BUILDS = {"pistol": pistol, "shotgun": shotgun, "heavy": heavy, "launcher": launcher, "sword": sword}

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    outdir = sys.argv[2] if len(sys.argv) > 2 else OUTDIR
    if which == "all":
        # one fresh Blender per weapon: the factory reset keeps image/material names from colliding
        for name in BUILDS:
            subprocess.run([sys.executable, os.path.abspath(__file__), name, outdir], check=True)
    else:
        k.reset()
        BUILDS[which]()
        k.export(os.path.join(outdir, f"{which}.glb"))
