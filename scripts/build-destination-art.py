"""Build the Destination Map art from the owner's reference images (docs/reference/destination-map/).

  python3 scripts/build-destination-art.py

planet.png    -> src/assets/destination/planet.jpg   (title + tagline erased; the tab bar, destination list and bottom
                                                      bar stay in the art and are covered 1:1 by live UI, see
                                                      src/game/destination-map.ts STAGE_PANELS)
closeups.png  -> src/assets/destination/<id>.jpg     (each destination's close-up panel without its header and legend)
planet.png    -> src/assets/destination/emblem-<id>.png (the list's destination emblems, background keyed out)
"""
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, "docs", "reference", "destination-map")
OUT = os.path.join(ROOT, "src", "assets", "destination")

# rectangles of baked-in text that sits over dark space (x0, y0, x1, y1) in the 1536x1024 planet art
ERASE = [(22, 12, 352, 116), (1190, 22, 1512, 52)]
# close-up panels in the 1536x1024 collage: art only (no title strip, no legend column)
CLOSEUPS = {
    "nexus": (780, 80, 1035, 445), "neon-city": (1158, 85, 1430, 445),
    "thalassia": (10, 520, 392, 765), "veridan": (515, 520, 915, 765), "frostspire": (1037, 520, 1425, 765),
    "ember": (10, 828, 278, 1020), "wastelands": (375, 828, 670, 1020), "solara": (770, 828, 1038, 1020),
    "swamps": (1137, 828, 1430, 1020),
}

# list rows (y centre) of the painted destination list, in list order
EMBLEM_ROWS = {"nexus": 197, "neon-city": 248, "thalassia": 299, "veridan": 351, "frostspire": 404, "ember": 456, "wastelands": 508, "solara": 560, "swamps": 612}


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    planet = cv2.imread(os.path.join(REF, "planet.png"))
    if planet is None:
        print("missing docs/reference/destination-map/planet.png", file=sys.stderr)
        return 1
    mask = np.zeros(planet.shape[:2], np.uint8)
    for x0, y0, x1, y1 in ERASE:
        mask[y0:y1, x0:x1] = 255
    clean = cv2.inpaint(planet, mask, 9, cv2.INPAINT_TELEA)
    # the erased corners are deep space: settle them into a soft dark gradient so no smear shows
    for x0, y0, x1, y1 in ERASE:
        region = clean[y0:y1, x0:x1].astype(np.float32)
        clean[y0:y1, x0:x1] = cv2.GaussianBlur(region, (0, 0), 6).astype(np.uint8)
    cv2.imwrite(os.path.join(OUT, "planet.jpg"), clean, [cv2.IMWRITE_JPEG_QUALITY, 88])

    collage = cv2.imread(os.path.join(REF, "closeups.png"))
    if collage is None:
        print("missing docs/reference/destination-map/closeups.png", file=sys.stderr)
        return 1
    for name, (x0, y0, x1, y1) in CLOSEUPS.items():
        # the collage panels are small (~260-400 px): upscale 2.5x with Lanczos and a gentle unsharp mask for the close-up view
        panel = collage[y0:y1, x0:x1]
        big = cv2.resize(panel, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_LANCZOS4)
        blur = cv2.GaussianBlur(big, (0, 0), 2.2)
        big = cv2.addWeighted(big, 1.45, blur, -0.45, 0)
        cv2.imwrite(os.path.join(OUT, f"{name}.jpg"), big, [cv2.IMWRITE_JPEG_QUALITY, 86])
    # destination emblems from the art's own list (transparent PNG): background keyed out by its darkest tone
    for name, cy in EMBLEM_ROWS.items():
        crop = planet[cy - 19:cy + 19, 32:70].astype(np.float32)
        flat = crop.reshape(-1, 3)
        luma = flat.mean(axis=1)
        bg = np.median(flat[luma <= np.percentile(luma, 25)], axis=0)
        alpha = np.clip((np.linalg.norm(crop - bg, axis=2) - 22) / 38, 0, 1)
        rgba = np.dstack([crop, alpha * 255]).astype(np.uint8)
        rgba = cv2.resize(rgba, (76, 76), interpolation=cv2.INTER_CUBIC)
        cv2.imwrite(os.path.join(OUT, f"emblem-{name}.png"), rgba)
    print("wrote", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
