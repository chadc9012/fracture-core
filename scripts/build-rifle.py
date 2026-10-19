"""
Builds public/models/weapons/rifle.glb: the first-person auto rifle, modelled to the operator reference art
(public/refs/nyx.jpg: a compact, boxy armoured carbine with glowing seams; public/refs/goliath.jpg: battered dark
gunmetal, exposed bolt heads, heat glowing out of the vents). Same worn kit as the other viewmodels (weapon_kit.py).

    pip install bpy && python3 scripts/build-rifle.py [out.glb]

Frame (matches ViewWeapon.tsx): metres, origin at the firing-hand grip, barrel toward -Z (three.js weapon space), up +Y.
Muzzle at 0.80 m, magazine pivot at (0, 0.02, -0.18), foregrip at 0.40 m.
Nodes: RifleBody (static), RifleMag (pivot at the mag well, drops on reload), RifleBolt (charging block, cycles after
shots), RifleAccent (seams, vent glow, optic lens, ammo readout; ViewWeapon recolours them per operator).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import weapon_kit as k  # noqa: E402

OUT = sys.argv[-1] if sys.argv[-1].endswith(".glb") else os.path.join(os.path.dirname(__file__), "..", "public", "models", "weapons", "rifle.glb")
POLY = 0.0

k.reset()
body = []

# ---------------------------------------------------------------- receiver: a heavy armoured box with bolted side plates
upper = k.box("upper", (0.072, 0.07, 0.36), (0, 0.088, -0.14), bevel=0.009)
k.cut(upper, k.box("eject", (0.03, 0.026, 0.07), (0.036, 0.094, -0.07), bevel=0))
body.append(upper)
body.append(k.box("top_spine", (0.05, 0.016, 0.3), (0, 0.128, -0.16), bevel=0.004))
for side in (-1, 1):
    # proud armour plates on each flank, split in two, with bolt heads at the corners
    for z0, length in ((-0.05, 0.12), (-0.21, 0.14)):
        body.append(k.box(f"plate{side}{z0}", (0.006, 0.05, length), (side * 0.038, 0.088, z0), bevel=0.003))
        for dz in (-length / 2 + 0.014, length / 2 - 0.014):
            for dy in (-0.017, 0.017):
                body.append(k.cyl(f"bolt{side}{z0}{dz}{dy}", 0.0045, 0.006, (side * 0.0425, 0.088 + dy, z0 + dz), axis="x", verts=6, bevel=0.0008))
# lower receiver, flared mag well and trigger guard
body.append(k.box("lower", (0.064, 0.05, 0.22), (0, 0.035, -0.1), bevel=0.007))
body.append(k.box("magwell", (0.07, 0.04, 0.09), (0, 0.025, -0.18), bevel=0.008))
body.append(k.box("guard_bar", (0.014, 0.01, 0.07), (0, 0.0, -0.045), bevel=0.003))
body.append(k.box("guard_post", (0.014, 0.03, 0.012), (0, 0.012, -0.08), bevel=0.003))
body.append(k.box("trigger", (0.007, 0.024, 0.009), (0, 0.012, -0.035), bevel=0.0015))

# ---------------------------------------------------------------- front: rectangular vented shroud, short barrel, block brake
shroud = k.box("shroud", (0.078, 0.066, 0.31), (0, 0.082, -0.475), bevel=0.008)
for side in (-1, 1):
    for i in range(3):
        k.cut(shroud, k.box(f"vent{side}{i}", (0.03, 0.022, 0.05), (side * 0.04, 0.086, -0.37 - i * 0.07), bevel=0))
k.cut(shroud, k.box("shroud_bore", (0.05, 0.04, 0.35), (0, 0.082, -0.475), bevel=0))
body.append(k.box("shroud_cap", (0.07, 0.058, 0.02), (0, 0.082, -0.632), bevel=0.005))
body.append(shroud)
body.append(k.cyl("barrel", 0.016, 0.24, (0, 0.082, -0.6), verts=16, bevel=0))
brake = k.box("brake", (0.054, 0.052, 0.12), (0, 0.082, -0.74), bevel=0.008)
for i in range(3):
    k.cut(brake, k.box(f"port{i}", (0.07, 0.014, 0.016), (0, 0.082, -0.705 - i * 0.03), bevel=0))
k.cut(brake, k.cyl("muzzle_bore", 0.01, 0.14, (0, 0.082, -0.76), verts=14, bevel=0))
body.append(brake)

# ---------------------------------------------------------------- optic: boxy housing with a hood over a glowing lens
body.append(k.box("rail", (0.03, 0.01, 0.2), (0, 0.141, -0.17), bevel=0.0015))
optic = k.box("optic", (0.054, 0.048, 0.1), (0, 0.17, -0.15), bevel=0.008)
k.cut(optic, k.box("optic_window", (0.038, 0.03, 0.14), (0, 0.174, -0.15), bevel=0))
body.append(optic)
body.append(k.box("hood", (0.058, 0.012, 0.03), (0, 0.197, -0.205), bevel=0.003))
body.append(k.cyl("optic_knob", 0.008, 0.014, (0.033, 0.165, -0.14), axis="x", verts=10, bevel=0.001))

# ---------------------------------------------------------------- grip, foregrip, stock (polymer)
grip = k.box("grip", (0.038, 0.115, 0.05), (0, -0.03, 0.004), bevel=0.009, rot=(-0.3, 0, 0), mask=POLY)
for i in range(3):
    k.cut(grip, k.cyl(f"groove{i}", 0.009, 0.06, (0, -0.008 - i * 0.03, -0.032 + i * 0.009), axis="x", verts=12, bevel=0))
body.append(grip)
body.append(k.box("fg_mount", (0.034, 0.02, 0.05), (0, 0.042, -0.40), bevel=0.003))
body.append(k.box("foregrip", (0.03, 0.085, 0.034), (0, -0.005, -0.40), bevel=0.007, rot=(0.12, 0, 0), mask=POLY))
# skeletal stock: upper bar, a sloped lower strut, a thick butt plate and a cheek pad
body.append(k.box("stock_bar", (0.04, 0.034, 0.2), (0, 0.096, 0.13), bevel=0.006))
body.append(k.box("stock_strut", (0.034, 0.026, 0.22), (0, 0.045, 0.14), bevel=0.006, rot=(0.25, 0, 0), mask=POLY))
body.append(k.box("cheek", (0.042, 0.02, 0.12), (0, 0.12, 0.15), bevel=0.007, mask=POLY))
body.append(k.box("butt", (0.052, 0.13, 0.028), (0, 0.06, 0.25), bevel=0.009, mask=POLY))
body.append(k.box("sling", (0.008, 0.02, 0.03), (-0.035, 0.06, 0.06), bevel=0.002))

# ---------------------------------------------------------------- magazine (pivot at the well): a ribbed box mag
mag = [k.box("mag", (0.038, 0.17, 0.072), (0, -0.07, -0.18), bevel=0.006, rot=(0.12, 0, 0))]
for i in range(3):
    mag.append(k.box(f"rib{i}", (0.041, 0.008, 0.06), (0, -0.03 - i * 0.04, -0.18 + 0.004 * i), bevel=0.002, rot=(0.12, 0, 0)))
mag.append(k.box("magbase", (0.044, 0.016, 0.082), (0, -0.157, -0.19), bevel=0.004, rot=(0.12, 0, 0), mask=POLY))

# ---------------------------------------------------------------- charging block (cycles after shots)
bolt = [k.box("charge", (0.02, 0.026, 0.05), (0.045, 0.1, -0.05), bevel=0.004),
        k.cyl("charge_knob", 0.01, 0.022, (0.062, 0.1, -0.05), axis="x", verts=10, bevel=0.0015)]

# ---------------------------------------------------------------- glow: plate seams, hot vents, lens, ammo readout
accent = []
for side in (-1, 1):
    accent.append(k.box(f"seam{side}", (0.003, 0.004, 0.32), (side * 0.0365, 0.059, -0.13), bevel=0.0006))
    for i in range(3):
        accent.append(k.box(f"ventglow{side}{i}", (0.004, 0.016, 0.044), (side * 0.024, 0.086, -0.37 - i * 0.07), bevel=0))
accent.append(k.box("lens", (0.036, 0.028, 0.002), (0, 0.174, -0.096), bevel=0))
accent.append(k.box("readout", (0.002, 0.018, 0.04), (-0.0415, 0.1, -0.03), bevel=0))

k.assemble("Rifle", {"Body": body, "Mag": mag, "Bolt": bolt}, accent, mag_pivot=(0, 0.02, -0.18),
           colors={"metal": (0.07, 0.072, 0.078), "bare": (0.34, 0.32, 0.29)})
k.export(OUT)
