"""
The operator's civilian body as a shape (offline tool; system Python with numpy + scikit-image). Called by
scripts/build-operator-civilian.py, which hands over the rig's rest-pose bones and gets surfaces back.

The first civ bodies were grown from the armour (metaballs sized by how far the armour stood off each bone): plate bulk
came through as a pot belly on the slim frame, balloon knees and calves on the athletic one, and the female cuts read
as the male ones (owner, Nov 11: "Fix body types and models"). This builds the body from anatomy instead: round cones
along the limbs and ellipsoids for the torso, sized in body heights for each build (slim / athletic / heavy) and each
cut (male / female: shoulders, waist, hips, bust), blended with a smooth union and meshed by marching cubes. Hands are
meshed apart at a finer grid (a palm and the four fingers and thumb along their bones); the hood (for hoodies) is a
piece of its own.

usage: python3 scripts/civ_body_sdf.py BONES.json OUT.npz
BONES.json: {"bones": {name: [[hx,hy,hz],[tx,ty,tz]]}, "F": [..], "LAT": [..], "UP": [..], "H": h, "floor": z,
             "sex": "male"|"female", "build": "slim"|"athletic"|"heavy"}
OUT.npz: body_v, body_f, hands_v, hands_f, hood_v, hood_f (world space, Z up)
"""
import json
import sys

import numpy as np
from skimage.measure import marching_cubes

cfg = json.load(open(sys.argv[1]))
B = {k: (np.array(v[0], float), np.array(v[1], float)) for k, v in cfg["bones"].items()}
F, LAT, UP = (np.array(cfg[k], float) for k in ("F", "LAT", "UP"))
H = float(cfg["H"])
FLOOR = float(cfg["floor"])
SEX, BUILD = cfg["sex"], cfg["build"]
fem = SEX == "female"


def head(n):
    return B[n][0]


def tail(n):
    return B[n][1]


# ------------------------------------------------------------------------------------------------ proportions
# radii in body heights for an athletic male, then the build's and the cut's scales
P = {
    "neck": 0.031, "pelvis": (0.098, 0.066, 0.07), "waist": (0.083, 0.058, 0.06), "ribs": (0.093, 0.064, 0.065),
    "chest": (0.104, 0.068, 0.072), "trap": (0.07, 0.05, 0.04), "delt": 0.035, "clav": 0.026,
    "uarm": (0.03, 0.022), "farm": (0.023, 0.0165), "elbow": 0.02,
    "thigh": (0.055, 0.035), "knee": 0.031, "calf": 0.034, "ankle": 0.02, "glute": (0.052, 0.048, 0.058),
}
torso_w, torso_d, limb, neck_k, delt_k, waist_k = 1.0, 1.0, 1.0, 1.0, 1.0, 1.0
if BUILD == "slim":
    torso_w, torso_d, limb, neck_k, delt_k, waist_k = 0.9, 0.9, 0.86, 0.94, 0.88, 0.94
elif BUILD == "athletic":
    delt_k, waist_k = 1.06, 0.94
elif BUILD == "heavy":
    torso_w, torso_d, limb, neck_k, delt_k, waist_k = 1.2, 1.28, 1.24, 1.24, 1.12, 1.12
# the cut: a woman's narrower shoulders and waist, wider hips, lighter arms; the bust below
shoulder_k, hip_k, arm_k, thigh_k = 1.0, 1.0, 1.0, 1.0
if fem:
    shoulder_k, hip_k, arm_k, thigh_k = 0.88, 1.1, 0.84, 1.04
    waist_k *= 0.86
    neck_k *= 0.86
    delt_k *= 0.84
# clothing ease: the painted clothes sit on this surface, a little roomier than skin
EASE = 1.04


def ell(name, k_w=1.0, k_d=1.0, k_h=1.0):
    w, d, h = P[name]
    return np.array([w * torso_w * k_w, d * torso_d * k_d, h * k_h]) * H * EASE


# ------------------------------------------------------------------------------------------------ SDF primitives
def round_cone(p, a, b, r1, r2):
    """distance to a cone with spherical caps, radius r1 at a and r2 at b (Inigo Quilez)"""
    ba = b - a
    l2 = ba @ ba
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = p - a
    y = pa @ ba
    z = y - l2
    xv = pa * l2 - np.outer(y, ba)
    x2 = np.einsum("ij,ij->i", xv, xv)
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    out = np.empty(len(p))
    m1 = np.sign(z) * a2 * z2 > k
    m2 = np.sign(y) * a2 * y2 < k
    out[m1] = np.sqrt(x2[m1] + z2[m1]) * il2 - r2
    out[m2 & ~m1] = np.sqrt(x2[m2 & ~m1] + y2[m2 & ~m1]) * il2 - r1
    m3 = ~m1 & ~m2
    out[m3] = (np.sqrt(x2[m3] * a2 * il2) + y[m3] * rr) * il2 - r1
    return out


def ellipsoid(p, c, r, axes=None):
    """approximate distance to an ellipsoid at c with radii r along the axes (LAT, F, UP by default)"""
    ax = axes if axes is not None else (LAT, F, UP)
    q = np.stack([(p - c) @ ax[0], (p - c) @ ax[1], (p - c) @ ax[2]], axis=1)
    k0 = np.linalg.norm(q / r, axis=1)
    k1 = np.linalg.norm(q / (r * r), axis=1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def round_box(p, c, half, rad, axes):
    q = np.stack([(p - c) @ axes[0], (p - c) @ axes[1], (p - c) @ axes[2]], axis=1)
    d = np.abs(q) - (np.array(half) - rad)
    return np.linalg.norm(np.maximum(d, 0.0), axis=1) + np.minimum(np.max(d, axis=1), 0.0) - rad


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)


def mesh(prims, lo, hi, step, k):
    nx, ny, nz = (np.ceil((hi - lo) / step).astype(int) + 1)
    xs, ys, zs = (lo[0] + np.arange(nx) * step, lo[1] + np.arange(ny) * step, lo[2] + np.arange(nz) * step)
    g = np.stack(np.meshgrid(xs, ys, zs, indexing="ij"), axis=-1).reshape(-1, 3)
    d = np.full(len(g), 1e9)
    for f in prims:
        d = smin(d, f(g), k)
    vol = d.reshape(nx, ny, nz)
    v, fc, _n, _vals = marching_cubes(vol, 0.0, spacing=(step, step, step))
    return v + lo, fc[:, ::-1]   # outward faces


def lerp(a, b, t):
    return a + (b - a) * t


# ------------------------------------------------------------------------------------------------ the body
prims = []
hips, sp, sp1, sp2 = head("Hips"), head("Spine"), head("Spine1"), head("Spine2")
neck_a, neck_b = head("Neck"), tail("Neck")
up_ofs = lambda p, u: p + UP * u * H
# the torso: one continuous shape through pelvis, waist, ribs, chest and trapezius. The spine's joints sit far apart on
# some frames, so ellipsoids at the joints alone read as a stack of lumps: thin slices are swept between them, their
# width and depth eased from one key to the next, closed by the full pelvis and trapezius at the ends.
KEYS = [(up_ofs(hips, 0.012), ell("pelvis", hip_k)), (sp, ell("waist", waist_k, waist_k)),
        (sp1, ell("ribs", (shoulder_k + waist_k) * 0.5)), (up_ofs(sp2, 0.02), ell("chest", shoulder_k)),
        (lerp(tail("Spine2"), neck_a, 0.5) - F * 0.01 * H, ell("trap", shoulder_k))]
prims.append(lambda p, c=KEYS[0][0], r=KEYS[0][1]: ellipsoid(p, c, r))
prims.append(lambda p, c=KEYS[-1][0], r=KEYS[-1][1]: ellipsoid(p, c, r))
STEP = 0.014 * H
for (c0, r0), (c1, r1) in zip(KEYS[:-1], KEYS[1:]):
    n_ = max(2, int(np.linalg.norm(c1 - c0) / STEP))
    for j in range(n_ + 1):
        t_ = j / n_
        e_ = t_ * t_ * (3 - 2 * t_)          # eased, so each key's girth holds a little before the next
        c_ = lerp(c0, c1, t_)
        r_ = lerp(r0, r1, e_)
        r_ = np.array([r_[0], r_[1], STEP * 1.6])
        prims.append(lambda p, c=c_, r=r_: ellipsoid(p, c, r))
if BUILD == "heavy":
    prims.append(lambda p: ellipsoid(p, sp + F * 0.03 * H - UP * 0.01 * H, np.array([0.092, 0.07, 0.075]) * H * EASE))
for sx in (-1.0, 1.0):
    side = "Left" if (head("LeftUpLeg") - hips) @ LAT * sx > 0 else "Right"
    # glutes, behind the hip joints
    gc = hips + LAT * sx * 0.042 * H - F * 0.022 * H - UP * 0.035 * H
    gr = np.array([0.046, 0.036, 0.05]) * H * EASE * (1.1 if fem else 1.0) * (torso_w ** 0.5)
    prims.append(lambda p, gc=gc, gr=gr: ellipsoid(p, gc, gr))
    if fem:
        # the bust
        cup = {"slim": 0.88, "athletic": 1.0, "heavy": 1.3}[BUILD]
        bc = sp2 + F * 0.045 * H * torso_d + LAT * sx * 0.042 * H * torso_w + UP * 0.0 * H
        prims.append(lambda p, bc=bc, cup=cup: ellipsoid(p, bc, np.array([0.037, 0.034, 0.033]) * H * cup * EASE))
for s in ("Left", "Right"):
    arm_a, el, wr = head(s + "Arm"), head(s + "ForeArm"), head(s + "Hand")
    sh = head(s + "Shoulder")
    L = limb * arm_k * EASE
    prims.append(lambda p, a=lerp(sh, neck_a, 0.3), b=arm_a, L=L: round_cone(p, a, b, P["clav"] * H * L, P["clav"] * H * L))
    prims.append(lambda p, c=arm_a - UP * 0.008 * H, L=L: ellipsoid(p, c, np.array([P["delt"]] * 3) * H * L * delt_k))
    prims.append(lambda p, a=arm_a, b=el, L=L: round_cone(p, a, b, P["uarm"][0] * H * L, P["uarm"][1] * H * L))
    fm = lerp(el, wr, 0.3)
    prims.append(lambda p, a=el, b=fm, L=L: round_cone(p, a, b, P["elbow"] * H * L, P["farm"][0] * H * L))
    prims.append(lambda p, a=fm, b=wr, L=L: round_cone(p, a, b, P["farm"][0] * H * L, P["farm"][1] * H * L))
    up_l, kn, an = head(s + "UpLeg"), head(s + "Leg"), head(s + "Foot")
    T = limb * thigh_k * EASE
    top = up_l + UP * 0.02 * H
    prims.append(lambda p, a=top, b=kn, T=T: round_cone(p, a, b, P["thigh"][0] * H * T * (hip_k ** 0.5), P["thigh"][1] * H * T))
    cm = lerp(kn, an, 0.3) - F * 0.006 * H
    prims.append(lambda p, a=kn, b=cm, T=T: round_cone(p, a, b, P["knee"] * H * T, P["calf"] * H * T))
    prims.append(lambda p, a=cm, b=an, T=T: round_cone(p, a, b, P["calf"] * H * T, P["ankle"] * H * T))
    # a chunky trainer: a rounded box heel to toe, flat on the floor, a lower toe box in front
    toe_tip = tail(s + "ToeBase")
    fwd = toe_tip - an
    fwd[2] = 0.0
    fwd /= np.linalg.norm(fwd)
    acr = np.cross(UP, fwd)
    heel = np.array([an[0], an[1], 0.0]) - fwd * 0.03 * H
    toe = np.array([toe_tip[0], toe_tip[1], 0.0]) + fwd * 0.012 * H
    shoe_h = 0.058 * H
    c1 = (heel + lerp(heel, toe, 0.62)) * 0.5
    c1[2] = FLOOR + shoe_h * 0.5
    l1 = np.linalg.norm(lerp(heel, toe, 0.62) - heel) * 0.5
    sw = 0.036 * H * (1.08 if BUILD == "heavy" else 1.0) * (0.92 if fem else 1.0)
    prims.append(lambda p, c=c1, l=l1, sw=sw, ax=(fwd, acr, UP): round_box(p, c, (l, sw, shoe_h * 0.5), 0.02 * H, ax))
    c2 = lerp(heel, toe, 0.68)
    c2[2] = FLOOR + 0.022 * H
    l2 = np.linalg.norm(toe - lerp(heel, toe, 0.38)) * 0.5
    c2 = (lerp(heel, toe, 0.38) + toe) * 0.5
    c2[2] = FLOOR + 0.021 * H
    prims.append(lambda p, c=c2, l=l2, sw=sw, ax=(fwd, acr, UP): round_box(p, c, (l, sw * 0.94, 0.021 * H), 0.017 * H, ax))
# the neck, up into the head's collar
nk = P["neck"] * H * neck_k * EASE
prims.append(lambda p: round_cone(p, neck_a - UP * 0.02 * H, neck_b, nk * 1.12, nk))

pts = np.array([v[0] for v in B.values()] + [v[1] for v in B.values()])
lo = pts.min(axis=0) - 0.13 * H
hi = pts.max(axis=0) + 0.13 * H
lo[2] = FLOOR - 0.01 * H
hi[2] = neck_b[2] + 0.02 * H
body_v, body_f = mesh(prims, lo, hi, 0.0052 * H, 0.012 * H)


# ------------------------------------------------------------------------------------------------ the hands
def hand(s):
    hp = []
    wr = head(s + "Hand")
    mid = head(s + "HandMiddle1")
    ix, pk = head(s + "HandIndex1"), head(s + "HandPinky1")
    along = mid - wr
    along /= np.linalg.norm(along)
    across = ix - pk
    across -= along * (across @ along)
    across /= np.linalg.norm(across)
    nrm = np.cross(along, across)
    kk = limb * arm_k * (0.93 if fem else 1.0)
    palm_c = lerp(wr, (mid + lerp(ix, pk, 0.5)) * 0.5, 0.52)
    half_len = np.linalg.norm(mid - wr) * 0.5
    half_w = np.linalg.norm(ix - pk) * 0.5 + 0.0075 * H * kk
    hp.append(lambda p: round_box(p, palm_c, (half_len, half_w, 0.0115 * H * kk), 0.008 * H * kk, (along, across, nrm)))
    # the wrist, back into the sleeve
    hp.append(lambda p: round_cone(p, wr - along * 0.03 * H, wr + along * 0.01 * H, 0.0165 * H * kk, 0.016 * H * kk))
    radii = {"Thumb": (0.0098, 0.0078), "Index": (0.0083, 0.0066), "Middle": (0.0086, 0.0068), "Ring": (0.0082, 0.0064), "Pinky": (0.0072, 0.0056)}
    for fg, (r0, r1) in radii.items():
        chain = [head(s + "Hand%s%d" % (fg, i)) for i in (1, 2, 3, 4)] + [tail(s + "Hand%s4" % fg)]
        # the last joint's tail can sit right on the tip; keep segments that have length
        chain = [c for j, c in enumerate(chain) if j == 0 or np.linalg.norm(c - chain[j - 1]) > 1e-5]
        n = len(chain) - 1
        for j in range(n):
            ra = (r0 + (r1 - r0) * j / max(n, 1)) * H * kk
            rb = (r0 + (r1 - r0) * (j + 1) / max(n, 1)) * H * kk
            hp.append(lambda p, a=chain[j], b=chain[j + 1], ra=ra, rb=rb: round_cone(p, a, b, ra, rb))
    allp = np.array([wr - along * 0.035 * H] + [head(n) for n in B if n.startswith(s + "Hand")] + [tail(n) for n in B if n.startswith(s + "Hand")])
    return mesh(hp, allp.min(axis=0) - 0.025 * H, allp.max(axis=0) + 0.025 * H, 0.0017 * H, 0.0028 * H)


hv, hf = [], []
for s in ("Left", "Right"):
    v, f = hand(s)
    hf.append(f + sum(len(x) for x in hv))
    hv.append(v)
hands_v, hands_f = np.concatenate(hv), np.concatenate(hf)

# ------------------------------------------------------------------------------------------------ the hood, down
# a roll of fabric round the back of the neck and lying on the upper back (a piece: only hoodies wear it)
hood = []
base = neck_a + UP * 0.004 * H
nr = nk + 0.016 * H
for ang in np.linspace(-1.9, 1.9, 9):
    d = -F * np.cos(ang) + LAT * np.sin(ang)
    c = base + d * nr - UP * 0.004 * H * abs(ang)
    hood.append(lambda p, c=c, d=d: ellipsoid(p, c, np.array([0.02, 0.016, 0.022]) * H * torso_w,
                                              axes=(np.cross(UP, d), d, UP)))
hood.append(lambda p: ellipsoid(p, base - F * (nr + 0.012 * H) - UP * 0.05 * H, np.array([0.058, 0.02, 0.06]) * H * torso_w))
hp_ = np.array([base])
hood_v, hood_f = mesh(hood, base - 0.12 * H, base + 0.08 * H, 0.0035 * H, 0.012 * H)

np.savez(sys.argv[2], body_v=body_v, body_f=body_f, hands_v=hands_v, hands_f=hands_f, hood_v=hood_v, hood_f=hood_f)
print("sdf body", len(body_v), "verts; hands", len(hands_v), "; hood", len(hood_v))
