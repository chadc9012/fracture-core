"""
The operator's civilian body from the MakeHuman base mesh (offline tool; system Python with numpy). Called by
scripts/build-operator-civilian.py, which hands over the rig's rest-pose bones and gets the surface back — the same
interface as scripts/civ_body_sdf.py, which it replaces for the body (the SDF still makes the hood piece).

The SDF bodies were ellipsoids and round cones blended together: they read as bulky and boxy (owner, Nov 16: "Operators
body's still look bulky and boxy"). This is a real human body: MakeHuman's base mesh (CC0, via MPFB2 on GitHub) shaped
by its macro targets — the three ethnic targets for the cut (male / female, young), and the universal muscle × weight
targets for the build (slim / athletic / heavy) — then fitted to our skeleton bone by bone: MakeHuman's own Mixamo rig
says where each joint sits on its mesh and its Mixamo weights say which bones move each vertex, so every bone's piece
of the body is carried rigidly onto our bone (linear blend), and the body lands on our rig in our rest pose. The head
is cut off at the neck (the creator's head is skinned on at load) and the feet are smoothed into a trainer's shape (the
trainers are painted on). Units: MakeHuman's OBJ is decimetres, Y up, facing +Z.

usage: python3 scripts/civ_body_mh.py BONES.json OUT.npz MPFB_DATA_DIR
  MPFB_DATA_DIR: mpfb2's src/mpfb/data (3dobjs/base.obj, targets/macrodetails, rigs/standard/{rig,weights}.mixamo.json)
BONES.json: as civ_body_sdf.py ({"bones": {name: [head, tail]}, "F", "LAT", "UP", "H", "floor", "sex", "build"})
OUT.npz: body_v, body_f (world space, Z up); hands_v, hands_f, hood_v, hood_f empty (the hands are part of the body)
"""
import gzip
import json
import os
import sys

import numpy as np

cfg = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
DATA = sys.argv[3]
B = {k: (np.array(v[0], float), np.array(v[1], float)) for k, v in cfg["bones"].items()}
F, UP = np.array(cfg["F"], float), np.array(cfg["UP"], float)
H = float(cfg["H"])
FLOOR = float(cfg["floor"])
SEX, BUILD = cfg["sex"], cfg["build"]

# ------------------------------------------------------------------------------------------------ the base mesh
V, groups, faces = [], {}, []
g = None
for line in open(os.path.join(DATA, "3dobjs", "base.obj")):
    if line.startswith("v "):
        V.append([float(x) for x in line.split()[1:4]])
    elif line.startswith("g "):
        g = line.split()[1]
    elif line.startswith("f "):
        idx = [int(t.split("/")[0]) - 1 for t in line.split()[1:]]
        groups.setdefault(g, set()).update(idx)
        if g == "body":
            faces.append(idx)
V = np.array(V)


def target(name):
    d = np.zeros_like(V)
    p = os.path.join(DATA, "targets", "macrodetails", name + ".target.gz")
    with gzip.open(p, "rt") as fh:
        for line in fh:
            if line.startswith("#") or not line.strip():
                continue
            i, x, y, z = line.split()
            d[int(i)] = (float(x), float(y), float(z))
    return d


def three(v):
    """MakeHuman's min / average / max weights for a 0..1 macro value (0.5 is average)"""
    if v < 0.5:
        return {"min": 1.0 - 2.0 * v, "average": 2.0 * v, "max": 0.0}
    return {"min": 0.0, "average": 2.0 - 2.0 * v, "max": 2.0 * v - 1.0}


# the cut: an even mix of the three young ethnic targets for the sex
shape = V.copy()
for race in ("african", "asian", "caucasian"):
    shape += target("%s-%s-young" % (race, SEX)) / 3.0
# the build: muscle and weight (0..1, 0.5 average)
MUSCLE, WEIGHT = {"slim": (0.5, 0.12), "athletic": (0.78, 0.42), "heavy": (0.62, 0.88)}.get(BUILD, (0.6, 0.45))
for mk, mw in three(MUSCLE).items():
    for wk, ww in three(WEIGHT).items():
        k = mw * ww
        if k > 1e-6 and not (mk == "average" and wk == "average"):
            shape += target("universal-%s-young-%smuscle-%sweight" % (SEX, mk, wk)) * k

# ------------------------------------------------------------------------------------------------ the joints
rig = json.load(open(os.path.join(DATA, "rigs", "standard", "rig.mixamo.json")))["bones"]
wts = json.load(open(os.path.join(DATA, "rigs", "standard", "weights.mixamo.json")))["weights"]


def joint(spec):
    s = spec.get("strategy")
    if s == "CUBE":
        return shape[sorted(groups[spec["cube_name"]])].mean(axis=0)
    if s == "VERTEX":
        return shape[int(spec["vertex_index"])]
    if s == "MEAN":
        return shape[[int(i) for i in spec["vertex_indices"]]].mean(axis=0)
    # a fixed default position (Blender, Z up, metres) back to the OBJ's decimetres
    x, y, z = spec["default_position"]
    return np.array([x, z, -y]) * 10.0


MH = {n.replace("mixamorig:", ""): (joint(b["head"]), joint(b["tail"])) for n, b in rig.items()}

# ------------------------------------------------------------------------------------------------ onto our rig
# axes: the OBJ's +X is the body's left, +Y up, +Z front; ours are LEFT (from the shoulders), UP and F
LEFT = B["LeftArm"][0] - B["RightArm"][0]
LEFT -= UP * (LEFT @ UP)
LEFT /= np.linalg.norm(LEFT)
Fh = F - UP * (F @ UP)
Fh /= np.linalg.norm(Fh)
body_idx = sorted(groups["body"])
mh_floor = shape[body_idx, 1].min()
mh_top = shape[body_idx, 1].max()
scale = H / (mh_top - mh_floor)


def to_world(p):
    p = np.atleast_2d(p)
    return (np.outer(p[:, 0], LEFT) + np.outer(p[:, 1] - mh_floor, UP) + np.outer(p[:, 2], Fh)) * scale


Wv = to_world(shape)
MHw = {n: (to_world(h)[0], to_world(t)[0]) for n, (h, t) in MH.items()}
# the whole body first onto our hips (feet to our floor)
off = B["Hips"][0] - MHw["Hips"][0]
Wv = Wv + off
MHw = {n: (h + off, t + off) for n, (h, t) in MHw.items()}


def rot_between(a, b):
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(a @ b)
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3) if c > 0 else -np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx * (1.0 / (1.0 + c))


# a leg shortened to our rig keeps its proportions: narrower across in step with the length (a squat thick thigh otherwise)
GIRTH_BONES = ("LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg")


def bone_xform(bn, head_to, tail_to):
    """MakeHuman's bone piece onto (head_to, tail_to): rotated onto the bone and stretched along it to the bone's length
    (across it keeps MakeHuman's girth)"""
    hm, tm = MHw[bn]
    lm, lo = np.linalg.norm(tm - hm), np.linalg.norm(tail_to - head_to)
    R = rot_between(tm - hm, tail_to - head_to) if lm > 1e-6 and lo > 1e-6 else np.eye(3)
    am = (tm - hm) / max(lm, 1e-9)
    k = lo / lm if lm > 1e-6 and lo > 1e-6 else 1.0

    def apply(pts):
        d = pts - hm
        # stretched only between the ends: past the tail it is carried along, before the head left as it is
        along = d @ am
        if bn in GIRTH_BONES and k < 1.0:
            d = np.outer(along, am) + (d - np.outer(along, am)) * (k ** 0.6)
        d = d + np.outer(np.clip(along, 0.0, lm) * (k - 1.0), am)
        return d @ R.T + head_to
    return apply


# our rig's hip joints sit low (it was rigged on armour: the thigh is 55% of MakeHuman's), so a thigh carried onto
# them squashed into a bulge with the knees turned in: the thighs hang from where the pelvis puts MakeHuman's hip joint
# and run down to our knee instead
TARGET = {bn: B[bn] for bn in B}
hips_x = bone_xform("Hips", *B["Hips"])
for side in ("Left", "Right"):
    ul = side + "UpLeg"
    if ul in MHw and ul in B:
        TARGET[ul] = (hips_x(MHw[ul][0][None, :])[0], B[side + "Leg"][0])

# each bone carries its share of the body onto our bone (linear blend by MakeHuman's Mixamo weights)
acc = np.zeros_like(Wv)
wsum = np.zeros(len(Wv))
for name, pairs in wts.items():
    bn = name.replace("mixamorig:", "")
    if bn not in B or bn not in MHw:
        continue
    idx = np.array([int(p[0]) for p in pairs])
    w = np.array([float(p[1]) for p in pairs])
    moved = bone_xform(bn, *TARGET[bn])(Wv[idx])
    acc[idx] += moved * w[:, None]
    wsum[idx] += w
ok = wsum > 1e-6
Wv[ok] = acc[ok] / wsum[ok][:, None]

# ------------------------------------------------------------------------------------------------ the cut and the feet
# MakeHuman's weights are not normalised per vertex: shares are of each vertex's total
total = np.zeros(len(Wv))
for name, pairs in wts.items():
    for i, w in pairs:
        total[int(i)] += float(w)
total = np.maximum(total, 1e-9)
head_w = np.zeros(len(Wv))
for name in ("mixamorig:Head", "mixamorig:HeadTop_End"):
    for i, w in wts.get(name, []):
        head_w[int(i)] += float(w)
foot_w = np.zeros(len(Wv))
for name, pairs in wts.items():
    if "Toe" in name or "Foot" in name:
        for i, w in pairs:
            foot_w[int(i)] += float(w)
head_w /= total
foot_w /= total
# the neck runs up into the head (the creator's head sits on the Head bone and its own neck stub is short): cut at a
# height just over the skull's base, not by weight (that left a gap under the jaw and the head floated; Nov 16)
cut_z = float(B["Head"][0][2]) + 0.03 * H
# the head-weighted faces (the jaw and skull) go, except just over the Head bone round the neck's axis: those are the
# top of the neck, and dropping them left a ring of nothing between the collar and the creator head's jaw (owner's
# video, Nov 17). Further out they are MakeHuman's chin and jaw, which stood out under the beard as a brown lump
jaw_z = float(B["Head"][0][2]) + 0.012 * H
neck_xy = np.array(B["Head"][0][:2], float)
neck_r = 0.036 * H


def _round_neck(f):
    c = Wv[list(f)].mean(axis=0)
    return np.linalg.norm(c[:2] - neck_xy) < neck_r and c[2] <= jaw_z


keep_faces = [f for f in faces if not all(Wv[i][2] > cut_z for i in f) and not (all(head_w[i] > 0.97 for i in f) and not _round_neck(f))]
tris = []
for f in keep_faces:
    for k in range(1, len(f) - 1):
        tris.append((f[0], f[k], f[k + 1]))
tris = np.array(tris)
used = np.unique(tris)
remap = -np.ones(len(Wv), int)
remap[used] = np.arange(len(used))
P = Wv[used].copy()
T = remap[tris]
fw = foot_w[used]

# neighbours for smoothing
nb = [[] for _ in range(len(P))]
for a, b, c in T:
    nb[a] += [b, c]
    nb[b] += [a, c]
    nb[c] += [a, b]
nb = [np.unique(n) for n in nb]
# the toes and the sole smoothed into one rounded trainer shape (the trainers are painted on the foot)
feet = np.where(fw > 0.5)[0]
for _ in range(25):
    P[feet] = 0.5 * P[feet] + 0.5 * np.array([P[nb[i]].mean(axis=0) for i in feet])


def normals(P, T):
    n = np.zeros_like(P)
    fn = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
    for k in range(3):
        np.add.at(n, T[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


# clothing ease: the painted clothes sit a little off the skin (less on the hands, more on the feet for the shoe)
N = normals(P, T)
hand_w = np.zeros(len(Wv))
for name, pairs in wts.items():
    if "Hand" in name:
        for i, w in pairs:
            hand_w[int(i)] += float(w)
hw = (hand_w / total)[used]
ease = H * (0.006 * (1.0 - np.clip(hw, 0, 1)) + 0.006 * np.clip(fw, 0, 1))
P += N * ease[:, None]
# the soles flat on the floor
P[:, 2] = np.maximum(P[:, 2], FLOOR)

e = np.zeros((0, 3))
# where the thighs now hang from: the builder moves the civ skeleton's hip joints there, so the stance and the walk
# turn the thighs about the same point the body bends at
UPLEGS = np.array([TARGET["LeftUpLeg"][0], TARGET["RightUpLeg"][0]])
# MakeHuman's own skin weights for our bones (the four largest per vertex, normalised): Blender's bone heat solve
# failed on some of these bodies (half the slim man bound to the head and the thumbs; Nov 16)
names = sorted(n for n in wts if n.replace("mixamorig:", "") in B)
col = {n: k for k, n in enumerate(names)}
dense = np.zeros((len(Wv), len(names)))
for n in names:
    for i, w in wts[n]:
        dense[int(i), col[n]] += float(w)
dense = dense[used]
top = np.argsort(-dense, axis=1)[:, :4]
val = np.take_along_axis(dense, top, axis=1)
val = val / np.maximum(val.sum(axis=1, keepdims=True), 1e-9)
np.savez(OUT, upleg_heads=UPLEGS, w_names=np.array(names), w_idx=top, w_val=val, body_v=P, body_f=T, hands_v=e, hands_f=np.zeros((0, 3), int), hood_v=e, hood_f=np.zeros((0, 3), int))
print("mh body", len(P), "verts", len(T), "tris; build", BUILD, SEX, "muscle", MUSCLE, "weight", WEIGHT)
