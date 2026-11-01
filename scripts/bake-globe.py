"""Bake the planet globe's texture (equirectangular, 2:1) from the canon "12 Continents, 7 Oceans" board.

The board's painted globe is an orthographic view of the near hemisphere centred on latitude 0, longitude 0 (centre and
radius: planet.ts GLOBE). Every texel of that hemisphere is read back off the painting; the far hemisphere, which the board
never shows, is open ocean in the painting's colours with a few small reef islands, polar ice and cloud. The seam between
them sits near the painted limb, where the painting is foreshortened, and is blended. src/game/globe.ts uses the same
projection to put the continents' pins and the ocean names on the sphere.

    python3 scripts/bake-globe.py            -> public/maps/globe/veyra.jpg
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOARD = os.path.join(ROOT, "src/assets/planet/planet-canon-board.jpg")
OUT = os.path.join(ROOT, "public/maps/globe/veyra.jpg")
GX, GY, GR = 345.0, 365.0, 345.0  # planet.ts GLOBE
SAMPLE_R = GR * 0.975               # inside the painted atmosphere rim
W, H = 2048, 1024

board_u8 = np.asarray(Image.open(BOARD).convert("RGB")).copy()
# the board's title and subtitle ("WORLD FRACTURE · ONE WORLD · MANY REALITIES") and the sun's flare overlap the globe's
# upper-left limb: paint them out of the sphere (inpainted from the surrounding globe)
try:
    import cv2
    mask = np.zeros(board_u8.shape[:2], np.uint8)
    mask[0:98, 0:268] = 255
    cv2.circle(mask, (128, 138), 40, 255, -1)
    board_u8 = cv2.inpaint(board_u8, mask, 9, cv2.INPAINT_TELEA)
except ImportError:
    print("opencv not installed: the board's title stays on the globe's limb", file=sys.stderr)
board = board_u8.astype(np.float32)
bh, bw, _ = board.shape

lon = (np.arange(W) + 0.5) / W * 2 * math.pi - math.pi          # -pi..pi, 0 at the board's centre
lat = math.pi / 2 - (np.arange(H) + 0.5) / H * math.pi          # +pi/2 (north) .. -pi/2
LON, LAT = np.meshgrid(lon, lat)
cosc = np.cos(LAT) * np.cos(LON)                                 # angular distance from the view centre
px = GX + SAMPLE_R * np.cos(LAT) * np.sin(LON)
py = GY - SAMPLE_R * np.sin(LAT)

def bilinear(img, x, y):
    x = np.clip(x, 0, img.shape[1] - 1.001); y = np.clip(y, 0, img.shape[0] - 1.001)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = (x - x0)[..., None]; fy = (y - y0)[..., None]
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy

front = bilinear(board, px, py)

# ---- the far side: the painting's ocean, reef islands, ice and cloud ----
rng = np.random.default_rng(7)
def value_noise(scale, seed):
    """tileable-in-longitude value noise on the sphere (3D lattice sampled at the unit vector)"""
    r = np.random.default_rng(seed)
    n = 64
    lattice = r.random((n, n, n)).astype(np.float32)
    X = np.cos(LAT) * np.cos(LON); Y = np.sin(LAT); Z = np.cos(LAT) * np.sin(LON)
    p = [(v + 1.5) * scale for v in (X, Y, Z)]
    i = [np.floor(v).astype(int) for v in p]; f = [v - np.floor(v) for v in p]; s = [t * t * (3 - 2 * t) for t in f]
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (s[0] if dx else 1 - s[0]) * (s[1] if dy else 1 - s[1]) * (s[2] if dz else 1 - s[2])
                out = out + w * lattice[(i[0] + dx) % n, (i[1] + dy) % n, (i[2] + dz) % n]
    return out
def fbm(scale, seed, octaves=5):
    t, amp, tot = 0, 1.0, 0
    for o in range(octaves):
        t = t + amp * value_noise(scale * 2 ** o, seed + o); tot += amp; amp *= 0.5
    return t / tot

deep = np.array([6, 40, 88], np.float32); mid = np.array([18, 74, 128], np.float32); shallow = np.array([70, 170, 210], np.float32)  # the painting's ocean (10th/50th/90th percentile)
sand = np.array([196, 178, 128], np.float32); green = np.array([74, 120, 58], np.float32); rock = np.array([118, 108, 96], np.float32)
ice = np.array([232, 240, 248], np.float32)

relief = fbm(1.6, 11)
depth = fbm(3.2, 23)
ocean = deep[None, None] * (1 - depth[..., None]) + mid[None, None] * depth[..., None]
back = ocean.copy()
# small reef islands and archipelagos (kept small: the twelve continents are all on the near side)
isl = relief + 0.18 * fbm(9, 31, 3)
shelf = np.clip((isl - 0.69) / 0.035, 0, 1)[..., None]
land = np.clip((isl - 0.725) / 0.015, 0, 1)[..., None]
back = back * (1 - shelf) + shallow * shelf
hills = fbm(14, 41, 3)[..., None]
landcol = green * (1 - hills) + rock * hills
beach = np.clip((isl - 0.725) / 0.008, 0, 1)[..., None]
landcol = sand * (1 - beach) + landcol * beach
back = back * (1 - land) + landcol * land
# polar ice: ragged caps
ragged = 0.08 * (fbm(6, 51, 3) - 0.5)
capN = np.clip((LAT - math.radians(74) + ragged) / math.radians(4), 0, 1)[..., None]
capS = np.clip((-LAT - math.radians(72) + ragged) / math.radians(4), 0, 1)[..., None]
back = back * (1 - np.maximum(capN, capS)) + ice * np.maximum(capN, capS)
# cloud wisps
cloud = np.clip((fbm(4.5, 61) - 0.56) / 0.2, 0, 1)[..., None] * 0.55
back = back * (1 - cloud) + np.array([240, 244, 250], np.float32) * cloud

# ---- blend: the painting where it is seen face-on, the far side beyond the limb ----
c = np.degrees(np.arccos(np.clip(cosc, -1, 1)))
t = np.clip((c - 64) / 14, 0, 1)
t = (t * t * (3 - 2 * t))[..., None]
# the poles of the near side too: the painting's top and bottom are foreshortened as well
img = front * (1 - t) + back * t
# the painting carries its own atmosphere glow at the limb; the far side gets the poles' ice under it too
img = np.clip(img, 0, 255).astype(np.uint8)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
Image.fromarray(img).filter(ImageFilter.SMOOTH).save(OUT, quality=88, optimize=True, progressive=True)
print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")
