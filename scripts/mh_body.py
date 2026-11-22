"""
A real human body for the operators in regular clothes (owner, Nov 22: "You're still using this bullshit body type"):
the MakeHuman base mesh (MPFB2, CC0: makehumancommunity/mpfb2 src/mpfb/data) shaped by its macro targets for the cut and
the build, fitted bone by bone onto the frame's own rig and skinned with MakeHuman's Mixamo weights. It replaces the
ellipsoid anatomy of scripts/civ_body_sdf.py as the body of scripts/build-operator-civilian.py (the hood still comes
from there). The head is cut away at the neck: the game skins the chosen catalog head on at load.

usage: python3 scripts/mh_body.py MPFB_DATA bones.json out.npz
  bones.json: {"bones": {"mixamorig:Hips": [head, tail], ...} in the rig's world space (Z up), "F": forward, "UP",
               "sex": "male"|"female", "build": "slim"|"athletic"|"heavy", "floor": z, "H": standing height}
  out.npz:    body_v (N,3), body_f (M,3) triangles, weights (N,B), bones (B,) names
"""
import gzip
import json
import os
import sys

import numpy as np

data_dir, bones_path, out_path = sys.argv[1:4]
J = json.load(open(bones_path))
SEX = J["sex"]
BUILD = J["build"]

# ---------------------------------------------------------------------------------------------- the base mesh
verts, faces, fgroup, groups = [], [], [], {}
cur = ""
for line in open(os.path.join(data_dir, "3dobjs", "base.obj")):
    if line.startswith("v "):
        verts.append([float(x) for x in line.split()[1:4]])
    elif line.startswith("g "):
        cur = line.split(None, 1)[1].strip()
    elif line.startswith("f "):
        f = [int(t.split("/")[0]) - 1 for t in line.split()[1:]]
        faces.append(f)
        fgroup.append(cur)
        groups.setdefault(cur, set()).update(f)
V0 = np.array(verts)

# ---------------------------------------------------------------------------------------------- the macro shape
# MakeHuman's macro modifiers as it blends them: gender x age x muscle x weight over the universal targets, plus the
# three race targets. A young adult (25), races in thirds; the build picks muscle and weight.
MUSCLE_WEIGHT = {
    ("male", "slim"): (0.55, 0.3), ("male", "athletic"): (0.85, 0.5), ("male", "heavy"): (1.0, 0.8),
    ("female", "slim"): (0.5, 0.3), ("female", "athletic"): (0.8, 0.45), ("female", "heavy"): (0.85, 0.75),
}[(SEX, BUILD)]


def tri(x):
    """MakeHuman's three-way split of a 0..1 slider into min / average / max weights"""
    if x < 0.5:
        return {"min": (0.5 - x) * 2.0, "average": 1.0 - (0.5 - x) * 2.0, "max": 0.0}
    return {"min": 0.0, "average": 1.0 - (x - 0.5) * 2.0, "max": (x - 0.5) * 2.0}


def target(rel):
    d = np.zeros_like(V0)
    with gzip.open(os.path.join(data_dir, "targets", rel), "rt") as fh:
        for line in fh:
            p = line.split()
            if len(p) == 4 and not line.startswith("#"):
                d[int(p[0])] = (float(p[1]), float(p[2]), float(p[3]))
    return d


V = V0.copy()
mw, ww = tri(MUSCLE_WEIGHT[0]), tri(MUSCLE_WEIGHT[1])
for mk, mv in mw.items():
    for wk, wv in ww.items():
        if mv * wv > 1e-4:
            V += mv * wv * target("macrodetails/universal-%s-young-%smuscle-%sweight.target.gz" % (SEX, mk, wk))
for race in ("african", "asian", "caucasian"):
    V += target("macrodetails/%s-%s-young.target.gz" % (race, SEX)) / 3.0

# MakeHuman is Y up in decimetres, facing +Z; Blender's frame is Z up in metres, facing -Y (MPFB's conversion)
V = np.stack([V[:, 0], -V[:, 2], V[:, 1]], axis=1) * 0.1

# ---------------------------------------------------------------------------------------------- MakeHuman's joints
rig = json.load(open(os.path.join(data_dir, "rigs", "standard", "rig.mixamo.json")))["bones"]


def joint(spec):
    if spec["strategy"] == "CUBE":
        ids = sorted(groups[spec["cube_name"]])
    else:
        ids = spec["vertex_indices"]
    return V[ids].mean(axis=0)


mh = {n: (joint(b["head"]), joint(b["tail"])) for n, b in rig.items()}
game = {n: (np.array(h), np.array(t)) for n, (h, t) in J["bones"].items()}

# global fit first: face the rig's forward, stand on its floor, its stature
F = np.array(J["F"], float)
F[2] = 0.0
F /= np.linalg.norm(F)
ang = np.arctan2(F[1], F[0]) - np.arctan2(-1.0, 0.0)
c_, s_ = np.cos(ang), np.sin(ang)
RZ = np.array([[c_, -s_, 0], [s_, c_, 0], [0, 0, 1]])
mh_floor = V[sorted(groups["body"])][:, 2].min()
mh_top = mh["mixamorig:Head"][1][2]
g_top = game["mixamorig:HeadTop_End"][0][2] if "mixamorig:HeadTop_End" in game else game["mixamorig:Head"][1][2]
scale = (g_top - J["floor"]) / (mh_top - mh_floor)
hip_mh = mh["mixamorig:Hips"][0]
hip_g = game["mixamorig:Hips"][0]


def glob(p):
    q = RZ @ ((p - hip_mh) * scale)
    return q + np.array([hip_g[0], hip_g[1], J["floor"] + (hip_mh[2] - mh_floor) * scale])


V = np.array([glob(p) for p in V])
mh = {n: (glob(h), glob(t)) for n, (h, t) in mh.items()}


def rot_between(a, b):
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(a @ b)
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3) if c > 0 else -np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx * (1.0 / (1.0 + c))


# then bone by bone: each MakeHuman bone's frame onto the rig's (turned, moved, stretched along its length), blended by
# MakeHuman's own weights, so knees, elbows and knuckles land on the rig's joints
wj = json.load(open(os.path.join(data_dir, "rigs", "standard", "weights.mixamo.json")))["weights"]
names = [n for n in rig if n in game]
W = np.zeros((len(V), len(names)))
for j, n in enumerate(names):
    for vid, w in wj.get(n, []):
        W[vid, j] = w
missing = [n for n in rig if n not in game]
if missing:
    print("rig lacks", missing)
tot = W.sum(axis=1, keepdims=True)
W = np.where(tot > 1e-8, W / np.maximum(tot, 1e-8), 0.0)

out = np.zeros_like(V)
for j, n in enumerate(names):
    h0, t0 = mh[n]
    h1, t1 = game[n]
    a0 = (t0 - h0) / np.linalg.norm(t0 - h0)
    k = np.linalg.norm(t1 - h1) / np.linalg.norm(t0 - h0)
    R = rot_between(t0 - h0, t1 - h1)
    d = V - h0
    d = d + (k - 1.0) * np.outer(d @ a0, a0)
    out += W[:, j:j + 1] * ((d @ R.T) + h1)
unweighted = tot[:, 0] <= 1e-8
out[unweighted] = V[unweighted]

# ---------------------------------------------------------------------------------------------- keep the body, cut the head
body = groups["body"]
hi = names.index("mixamorig:Head")
keep = np.zeros(len(V), bool)
keep[list(body)] = True
keep &= W[:, hi] < 0.5
tris = []
for f, g in zip(faces, fgroup):
    if g != "body" or not all(keep[i] for i in f):
        continue
    for k_ in range(1, len(f) - 1):
        tris.append((f[0], f[k_], f[k_ + 1]))
used = sorted({i for t in tris for i in t})
remap = -np.ones(len(V), int)
remap[used] = np.arange(len(used))
np.savez(out_path, body_v=out[used], body_f=remap[np.array(tris)], weights=W[used], bones=np.array(names))
print("MakeHuman body: %d verts, %d tris, scale %.3f, %s %s" % (len(used), len(tris), scale, SEX, BUILD))
