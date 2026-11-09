"""Paint a real face from photos onto an operator head's texture (owner's Ronin sheet, Nov 9: "that's not the face").
Meshy (image-to-3D) is not reachable from the sandbox, so a new face is made on an existing cut head (build-operator-heads.py):

    python scripts/paint-operator-face.py HEAD.glb OUT_TEX.png      (run from the folder holding the PASSES images)

then put OUT_TEX.png into a copy of the head with a diffuse swap and list it in operators.ts FACES.
Needs mediapipe 0.10.14 (its bundled face mesh model; a Python 3.11 venv), opencv, scikit-image, scipy, trimesh.

1. rasterise the head (z-buffer, per-pixel UV and facing) over a yaw/pitch range
2. face landmarks (mediapipe) on each render and on the photo; the pose whose landmark layout best matches wins
3. warp the photo onto that render with a piecewise-affine map over the landmark mesh; hair over the forehead is painted out
4. write each face pixel into the texture at its UV, weighted by how squarely it faces the camera; the head keeps its own eyes
5. PASSES: the straight-on headshot, the same mirrored for the far side (its scar painted out first), a three-quarter portrait
6. feather into the head's own texture (skin tone matched, its brows painted out), and lift shaded skin by the ears and jaw
   past the line where operator-skin-shader.ts would cut it away as hair
Source photos for Ronin: docs/reference/characters/ronin/.
"""
import sys, math
import numpy as np, cv2, trimesh, mediapipe as mp
from skimage.transform import PiecewiseAffineTransform, warp
from scipy.spatial import Delaunay

head_path, out_path = sys.argv[1], sys.argv[2]
# passes: image path, yaw range (deg), weight, mirrored, scar circle to paint out (x, y, r in the unmirrored image) or None
PASSES = [
    ("headshot.png", (5, 25), 1.0, False, None, -0.09),
    ("headshot.png", (-25, -5), 0.3, True, (90, 138, 24), -0.09),
    ("portrait2.png", (30, 50), 0.45, False, None, 0.12),
]
scene = trimesh.load(head_path)
g = scene.geometry["FaceHead"]
V = np.asarray(g.vertices, float); F = np.asarray(g.faces); UV = np.asarray(g.visual.uv, float)
tex = np.asarray(g.visual.material.baseColorTexture.convert("RGB"), np.float32) / 255.0
TH, TW = tex.shape[:2]
c = (V.min(0) + V.max(0)) / 2
fm = mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=False, min_detection_confidence=0.2)
N = 640

def landmarks(img_rgb):
    r = fm.process(img_rgb)
    if not r.multi_face_landmarks: return None
    h, w = img_rgb.shape[:2]
    return np.array([(l.x * w, l.y * h) for l in r.multi_face_landmarks[0].landmark])

def render(yaw, pitch):
    cy, sy, cp, sp = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
    P = (V - c) @ (Rx @ Ry).T
    s = N * 0.92 / (V[:, 1].max() - V[:, 1].min())
    X = P[:, 0] * s + N / 2; Y = -P[:, 1] * s + N / 2; Z = P[:, 2]
    zb = np.full((N, N), -1e9); tid = np.full((N, N), -1, int); bw = np.zeros((N, N, 3))
    for t, (a, b, d) in enumerate(F):
        xs, ys = np.array([X[a], X[b], X[d]]), np.array([Y[a], Y[b], Y[d]])
        x0, x1 = max(int(xs.min()), 0), min(int(xs.max()) + 1, N - 1); y0, y1 = max(int(ys.min()), 0), min(int(ys.max()) + 1, N - 1)
        if x1 < x0 or y1 < y0: continue
        den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(den) < 1e-9: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / den
        l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / den
        l2 = 1 - l0 - l1
        inside = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
        z = l0 * Z[a] + l1 * Z[b] + l2 * Z[d]
        sub = zb[y0:y1 + 1, x0:x1 + 1]
        upd = inside & (z > sub)
        if not upd.any(): continue
        sub[upd] = z[upd]; tid[y0:y1 + 1, x0:x1 + 1][upd] = t
        bw[y0:y1 + 1, x0:x1 + 1][upd] = np.stack([l0[upd], l1[upd], l2[upd]], -1)
    hit = tid >= 0
    tri = F[np.where(hit, tid, 0)]
    uv = (UV[tri] * bw[..., :, None]).sum(-2)
    tx = np.clip((uv[..., 0] * TW).astype(int), 0, TW - 1); ty = np.clip(((1 - uv[..., 1]) * TH).astype(int), 0, TH - 1)
    img = np.where(hit[..., None], tex[ty, tx], 0.12)
    # facing: the triangle normal's toward-camera component
    p = np.stack([X, Y, Z * s], -1)
    n = np.cross(p[F[:, 1]] - p[F[:, 0]], p[F[:, 2]] - p[F[:, 0]]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    facing = np.where(hit, np.abs(n[np.where(hit, tid, 0), 2]), 0)
    return (img * 255).astype(np.uint8), hit, tx, ty, facing

def norm(L):
    L = L - L.mean(0); return L / np.sqrt((L ** 2).sum())

def procrustes(A, B):
    A, B = norm(A), norm(B)
    u, _, vt = np.linalg.svd(A.T @ B); R = u @ vt
    return ((A @ R - B) ** 2).sum()

acc = np.zeros((TH, TW, 3)); wsum = np.zeros((TH, TW)); eyes_tex = np.zeros((TH, TW), np.uint8); brow_tex = np.zeros((TH, TW), np.uint8)

BROW = [70, 63, 105, 66, 107, 336, 296, 334, 293, 300]
EYES = [[33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
        [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]]
def paint(src, yaws, weight, cut):
    Lp = landmarks(src)
    assert Lp is not None, "no face in the portrait"
    # hair hanging over the forehead (loc tips) is painted out of the source before it is used
    fh = Lp[:, 1].max() - Lp[:, 1].min(); brow_y = Lp[BROW, 1].min()
    hull = cv2.convexHull(Lp.astype(np.float32)).astype(np.int32)
    face_m = np.zeros(src.shape[:2], np.uint8); cv2.fillConvexPoly(face_m, hull, 255)
    band = np.zeros_like(face_m); band[max(0, int(brow_y - 0.3 * fh)): max(0, int(brow_y - 0.02 * fh)), :] = 255
    band &= face_m
    lum = src.astype(np.float32).mean(-1)
    ref = np.median(lum[band > 0]) if (band > 0).any() else 100
    hair = ((band > 0) & (lum < ref * 0.62)).astype(np.uint8) * 255
    hair = cv2.dilate(hair, np.ones((3, 3), np.uint8))
    if hair.any(): src = cv2.inpaint(src, hair, 5, cv2.INPAINT_TELEA)
    best = None
    for yaw in np.radians(np.arange(yaws[0], yaws[1] + 1, 5)):
        for pitch in np.radians(np.arange(-20, 11, 5)):
            img, *_ = render(yaw, pitch)
            Lh = landmarks(img)
            if Lh is None: continue
            e = procrustes(Lh, Lp)
            if best is None or e < best[0]: best = (e, yaw, pitch)
    e, yaw, pitch = best
    print(f"pose yaw {math.degrees(yaw):.0f} pitch {math.degrees(pitch):.0f} err {e:.4f}")
    img, hit, tx, ty, facing = render(yaw, pitch)
    Lh = landmarks(img)
    # extra anchors around the hull so the warp is defined just past the face
    tf = PiecewiseAffineTransform(); tf.estimate(Lh, Lp)
    warped = warp(src, tf, output_shape=(N, N), preserve_range=True).astype(np.float32) / 255.0
    hull = cv2.convexHull(Lh.astype(np.float32)).astype(np.int32)
    mask = np.zeros((N, N), np.uint8); cv2.fillConvexPoly(mask, hull, 255)
    mask = cv2.erode(mask, np.ones((9, 9), np.uint8))
    # nothing above the brows: the source's hair hangs over the forehead; the head's own forehead stays
    brow = Lh[BROW, 1].min(); face_h = Lh[:, 1].max() - Lh[:, 1].min()
    mask[: max(0, int(brow + cut * face_h)), :] = 0
    # the head keeps its own eyes: they sit on its eyeballs (painted ones from a squinting photo looked half shut)
    for eye in EYES:
        cv2.fillPoly(mask, [cv2.dilate(np.zeros(1), None) if False else Lh[eye].astype(np.int32)], 0)
    eyes = np.zeros((N, N), np.uint8)
    for eye in EYES: cv2.fillPoly(eyes, [Lh[eye].astype(np.int32)], 255)
    eyes = cv2.dilate(eyes, np.ones((13, 13), np.uint8))
    mask[eyes > 0] = 0
    sel_e = (eyes > 0) & hit
    eyes_tex[ty[sel_e], tx[sel_e]] = 1
    # where the base head's own brows may show: a band from just under the brows up the forehead, across the face's width
    bb = np.zeros((N, N), np.uint8)
    x0, x1 = int(Lh[:, 0].min()), int(Lh[:, 0].max())
    bb[max(0, int(brow - 0.28 * face_h)): int(brow + 0.08 * face_h), x0:x1] = 1
    sel_b = (bb > 0) & hit
    brow_tex[ty[sel_b], tx[sel_b]] = 1
    m = cv2.GaussianBlur(mask.astype(np.float32) / 255.0, (0, 0), 5) * hit
    w = weight * (m * np.clip((facing - 0.25) / 0.6, 0, 1) ** 1.5) ** 3
    ok = w > 1e-3
    np.add.at(acc, (ty[ok], tx[ok]), warped[ok] * w[ok, None]); np.add.at(wsum, (ty[ok], tx[ok]), w[ok])
    cv2.imwrite(out_path.replace(".png", f"-render{len(debug)}.png"), cv2.cvtColor((warped * 255 * m[..., None] + img * (1 - m[..., None])).astype(np.uint8), cv2.COLOR_RGB2BGR))
    debug.append(1)

debug = []
for path, yaws, weight, mirrored, scar, cut in PASSES:
    src = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
    if scar:
        sx, sy, sr = scar
        mm = np.zeros(src.shape[:2], np.uint8); cv2.circle(mm, (int(sx), int(sy)), int(sr), 255, -1)
        src = cv2.inpaint(src, mm, 7, cv2.INPAINT_TELEA)
    if mirrored: src = src[:, ::-1].copy()
    paint(src, yaws, weight, cut)

w = wsum
painted = acc / np.maximum(w, 1e-6)[..., None]
cover = np.clip(w / (np.percentile(w[w > 0], 40) + 1e-6), 0, 1)
# fill pinholes inside the painted islands, then feather
filled = cv2.dilate((painted * 255).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32) / 255
painted = np.where((w > 0)[..., None], painted, filled)
cover = cv2.GaussianBlur(cv2.dilate(cover.astype(np.float32), np.ones((3, 3))), (0, 0), 2.5)
# the rest of the head to the face's tone: match the mean of the original texels under the painted face
sel = cover > 0.6
gain = painted[sel].mean(0) / (tex[sel].mean(0) + 1e-6)
print("tone gain", gain.round(3))
# only the skin takes the gain (the hood lining and collar in the same texture keep their colour)
sat = (tex.max(-1) - tex.min(-1)) / (tex.max(-1) + 1e-6)
skin = ((tex[..., 0] > tex[..., 2] + 0.03) & (tex[..., 0] >= tex[..., 1]) & (tex.max(-1) < 0.7) & (sat > 0.22)).astype(np.float32)
skin = cv2.GaussianBlur(skin, (0, 0), 1.5)[..., None]
base = np.clip(tex * (1 + (gain - 1) * skin), 0, 1)
# the base head's own brows and lashes just outside the painted face would double his: paint out dark texels in a band
# around the painted region (skin from their surroundings)
from scipy.ndimage import binary_fill_holes
core = binary_fill_holes(cover > 0.5).astype(np.uint8)  # the eye holes count as inside, so the head's own eyes are kept
band = cv2.dilate(core, np.ones((41, 41), np.uint8)) - core
lum_b = 0.2126 * base[..., 0] + 0.7152 * base[..., 1] + 0.0722 * base[..., 2]
ref = np.median(lum_b[(band > 0) & (skin[..., 0] > 0.5)]) if ((band > 0) & (skin[..., 0] > 0.5)).any() else 0.2
dark = ((band > 0) & (lum_b < ref * 0.7) & (skin[..., 0] > 0.2) & (cv2.dilate(brow_tex, np.ones((9, 9), np.uint8)) > 0)).astype(np.uint8)
dark = cv2.dilate(dark, np.ones((5, 5), np.uint8))
dark[cv2.dilate(eyes_tex, np.ones((15, 15), np.uint8)) > 0] = 0  # never paint out the head's own eyes
base = cv2.inpaint((base * 255).astype(np.uint8), dark, 9, cv2.INPAINT_TELEA).astype(np.float32) / 255
out = base * (1 - cover[..., None]) + painted * cover[..., None]
# the game cuts a head's own hair away by colour (operator-skin-shader.ts: anything far darker than the head's skin, outside the
# eyes / mouth / beard box, is hair). Shaded skin by the ears and jaw is lifted just past that line, so it stays skin;
# near-black hair and the painted face itself are left alone.
def to_lin(a): return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
def to_srgb(a): return np.where(a <= 0.0031308, a * 12.92, 1.055 * np.clip(a, 0, None) ** (1 / 2.4) - 0.055)
lin = to_lin(np.clip(out, 0, 1)); L = lin @ np.array([0.3, 0.59, 0.11])
mx, mn = out.max(-1), out.min(-1); satv = (mx - mn) / (mx + 1e-4)
warm = (out[..., 0] > out[..., 2] + 0.02) & (satv > 0.15)
skinL = np.median(L[(cover > 0.6) & warm])
# each texel's place on the head (head-bone space, as the shader's p), by rasterising the triangles in UV space
headT, _ = scene.graph["mixamorig:Head"]; hb = headT[:3, 3]
P = np.full((TH, TW, 3), np.nan)
for a, b, d in F:
    us = np.array([UV[a, 0], UV[b, 0], UV[d, 0]]) * TW; vs = (1 - np.array([UV[a, 1], UV[b, 1], UV[d, 1]])) * TH
    x0, x1 = max(int(us.min()), 0), min(int(us.max()) + 1, TW - 1); y0, y1 = max(int(vs.min()), 0), min(int(vs.max()) + 1, TH - 1)
    den = (vs[1] - vs[2]) * (us[0] - us[2]) + (us[2] - us[1]) * (vs[0] - vs[2])
    if abs(den) < 1e-12 or x1 < x0 or y1 < y0: continue
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    l0 = ((vs[1] - vs[2]) * (gx - us[2]) + (us[2] - us[1]) * (gy - vs[2])) / den
    l1 = ((vs[2] - vs[0]) * (gx - us[2]) + (us[0] - us[2]) * (gy - vs[2])) / den
    l2 = 1 - l0 - l1
    ins = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
    pos = l0[..., None] * V[a] + l1[..., None] * V[b] + l2[..., None] * V[d]
    P[y0:y1 + 1, x0:x1 + 1][ins] = pos[ins] - hb
side_jaw = (np.abs(P[..., 0]) > 0.042) & (((P[..., 1] < 0.07) & (P[..., 2] > -0.035)) | ((P[..., 1] < 0.1) & (P[..., 2] > -0.005)))
side_jaw = np.nan_to_num(side_jaw.astype(np.float32)) > 0
low = warm & (((cover < 0.6) & (L > skinL * 0.18)) | (side_jaw & (L > skinL * 0.04))) & (L < skinL * 0.62)
lift = np.where(low, (skinL * 0.62) / np.maximum(L, 1e-5), 1.0)
lift = cv2.GaussianBlur(lift.astype(np.float32), (0, 0), 1.2)
out = to_srgb(lin * lift[..., None])
print("lifted texels", int(low.sum()), "skinL", round(float(skinL), 4))
cv2.imwrite(out_path, cv2.cvtColor((np.clip(out, 0, 1) * 255).astype(np.uint8), cv2.COLOR_RGB2BGR))
lum = lambda a: (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])
print("face skin luminance", float(np.median(lum(painted[sel]))))

# the finished head from three sides
tex = np.clip(out, 0, 1).astype(np.float32)
strip = np.concatenate([render(math.radians(a), math.radians(-5))[0] for a in (0, 35, -35)], 1)
cv2.imwrite(out_path.replace(".png", "-final.png"), cv2.cvtColor(strip, cv2.COLOR_RGB2BGR))
