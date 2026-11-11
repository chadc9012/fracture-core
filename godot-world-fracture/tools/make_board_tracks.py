"""The racing board's three tracks beyond Track Pack 01 (owner's Racing Expansion board, Nov 11): Eldergrove Circuit
(36.8 km, forest), Obsidian Volcano Run (67.4 km, volcanic) and Shattered Expanse GP (59.7 km, the Fracture). The owner
sent no route data for these, so their loops are laid out here: a closed curve of a few harmonics, scaled to the board's
length, with the board's character in the climb (the volcano run climbs its cone and back, the Expanse rises and drops).
Writes data/track_pack_board.json in the shape of data/track_pack_01.json; track_pack.gd reads both.
    python3 tools/make_board_tracks.py
"""
import json, math, os

TRACKS = [
    # id, name, km, environment, seed harmonics [(k, amp, phase)], aspect, climb (amplitude m, waves)
    ("Eldergrove_Circuit", "Eldergrove Circuit", 36.8, "forest", [(2, 0.18, 0.4), (3, 0.10, 1.9), (5, 0.04, 0.7)], 0.8, (14.0, 3)),
    ("Obsidian_Volcano_Run", "Obsidian Volcano Run", 67.4, "volcanic", [(2, 0.22, 2.2), (3, 0.08, 0.3), (4, 0.05, 1.1)], 0.7, (45.0, 1)),
    ("Shattered_Expanse_GP", "Shattered Expanse GP", 59.7, "fracture", [(3, 0.16, 0.9), (2, 0.12, 2.8), (6, 0.03, 0.2)], 0.9, (28.0, 4)),
]
N = 240

def loop(harm, aspect, climb):
    pts = []
    for i in range(N):
        t = 2 * math.pi * i / N
        r = 1.0 + sum(a * math.cos(k * t + p) for k, a, p in harm)
        amp, waves = climb
        y = amp * (0.5 - 0.5 * math.cos(waves * t)) + 1.0
        pts.append([r * math.cos(t), y, r * math.sin(t) * aspect])
    return pts

def length(pts):
    return sum(math.dist((pts[i][0], pts[i][2]), (pts[(i + 1) % len(pts)][0], pts[(i + 1) % len(pts)][2])) for i in range(len(pts)))

def min_radius(pts):
    best = 1e9
    for i in range(len(pts)):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % len(pts)]
        A = math.dist((a[0], a[2]), (b[0], b[2])); B = math.dist((b[0], b[2]), (c[0], c[2])); C = math.dist((a[0], a[2]), (c[0], c[2]))
        s = (A + B + C) / 2
        ar = max(s * (s - A) * (s - B) * (s - C), 1e-12) ** 0.5
        best = min(best, A * B * C / (4 * ar))
    return best

import random

def shaped(tid, km, harm, aspect, climb):
    """the board's harmonics plus tighter ones picked (seeded by the track) until the tightest corner is a real corner,
    150-350 m, and the loop never crosses back over itself"""
    rng = random.Random(tid)
    for attempt in range(4000):
        extra = [(k, rng.uniform(0.01, 0.045), rng.uniform(0, 6.28)) for k in rng.sample([5, 6, 7, 8, 9, 10, 11], 3)]
        p = loop(harm + extra, aspect, climb)
        if min(1.0 + sum(a * math.cos(k * 2 * math.pi * i / N + ph) for k, a, ph in harm + extra) for i in range(N)) < 0.35:
            continue
        sc = km * 1000.0 / length(p)
        q = [[x * sc, y, z * sc] for x, y, z in p]
        r = min_radius(q)
        if 150.0 <= r <= 350.0:
            return q
    raise SystemExit("no shape for " + tid)

out = []
for tid, name, km, env, harm, aspect, climb in TRACKS:
    p = shaped(tid, km, harm, aspect, climb)
    p = [[round(q[0], 1), round(q[1], 2), round(q[2], 1)] for q in p]
    cps = [[p[i * N // 12][0], p[i * N // 12][1], p[i * N // 12][2]] for i in range(12)]
    print(f"{name}: {length(p) / 1000:.2f} km, tightest corner {min_radius(p):.0f} m")
    out.append({"id": tid, "name": name, "target_km": km, "environment": env, "road_width_m": 18.0, "centerline_xyz": p, "checkpoints": cps})
here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, "..", "data", "track_pack_board.json"), "w") as f:
    json.dump({"source": "tools/make_board_tracks.py (the owner's Racing Expansion board, Nov 11: the three tracks beyond Track Pack 01)", "tracks": out}, f, separators=(",", ":"))
