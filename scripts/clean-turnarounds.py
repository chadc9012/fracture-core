"""
Clean up character turnaround sheets before they go into the reference set (owner, Nov 8: "clean up images before
adding, some look pixelated").

A sheet is a grid of three views per row (front / side / back) on a flat or softly graded dark background. For every
figure the pass: cuts the cell, lifts the figure off the background (flood fill from the cell's border with a colour
tolerance, then a feathered alpha), denoises softly (edge-preserving bilateral filter, so the armour panel lines stay),
resamples to a common 1024 px height with Lanczos and a light unsharp mask, and writes a transparent PNG. It also writes a
cleaned sheet per source (the figures re-laid on one flat background) and one contact sheet of everything for a check.

    python3 -I scripts/clean-turnarounds.py <out_dir> <name>=<image> [<name>=<image> …]

Rows are detected from the sheet's shape (three columns, rows of roughly 1 : 1.5 cells) and refined by the empty bands
between figures. Names are given per sheet; rows get `-r1`, `-r2`…, views `-front`, `-side`, `-back`.
"""
import sys, os
import numpy as np
import cv2
from PIL import Image, ImageFilter

HEIGHT = 1024


def load(path):
    im = Image.open(path).convert("RGB")
    return np.array(im)


def background_mask(cell, tol):
    """True where the pixel is background: close in colour to the border's median AND connected to the border; anything
    enclosed by the figure is figure (so dark seams in dark armour never punch holes)"""
    h, w = cell.shape[:2]
    lab = cv2.cvtColor(cell, cv2.COLOR_RGB2LAB).astype(np.int16)
    border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    bg = np.median(border, axis=0)
    near = (np.abs(lab - bg).max(axis=2) <= tol).astype(np.uint8)
    # the figure: not near the background colour, sealed with a close so thin gaps between plates don't let the fill in
    fg = cv2.morphologyEx(1 - near, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    # background = the near pixels reachable from the border through other near pixels
    free = (1 - fg).astype(np.uint8)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    reach = np.zeros_like(free)
    for sx, sy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2), (w - 1, h // 2), (w // 2, h - 1)]:
        if free[sy, sx] and not reach[sy, sx]:
            m = np.zeros((h + 2, w + 2), np.uint8)
            cv2.floodFill(free.copy(), m, (sx, sy), 2, 0, 0, 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8))
            reach |= m[1:-1, 1:-1] > 0
    return reach > 0


def row_bands(img, tol):
    """split rows by horizontal bands that are entirely background"""
    h, w = img.shape[:2]
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.int16)
    border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    bg = np.median(border, axis=0)
    diff = np.abs(lab - bg).max(axis=2)
    busy = (diff > tol).mean(axis=1) > 0.004
    rows = []
    start = None
    for y, b in enumerate(list(busy) + [False]):
        if b and start is None:
            start = y
        elif not b and start is not None:
            if y - start > h * 0.08:
                rows.append((start, y))
            start = None
    if not rows:
        rows = [(0, h)]
    # merge rows that the shape says belong together (a figure split by a thin empty band)
    expect = max(1, round(h / (w / 3.0 * 1.5)))
    # a band twice the height of the others holds two figures that touch: split it evenly
    while len(rows) < expect:
        i = max(range(len(rows)), key=lambda k: rows[k][1] - rows[k][0])
        y0, y1 = rows[i]
        mid = (y0 + y1) // 2
        rows[i:i + 1] = [(y0, mid), (mid, y1)]
    while len(rows) > expect:
        gaps = [(rows[i + 1][0] - rows[i][1], i) for i in range(len(rows) - 1)]
        g, i = min(gaps)
        rows[i] = (rows[i][0], rows[i + 1][1])
        del rows[i + 1]
    return rows


def col_bands(strip, tol, n=3):
    h, w = strip.shape[:2]
    lab = cv2.cvtColor(strip, cv2.COLOR_RGB2LAB).astype(np.int16)
    border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    bg = np.median(border, axis=0)
    diff = np.abs(lab - bg).max(axis=2)
    busy = (diff > tol).mean(axis=0) > 0.004
    cols = []
    start = None
    for x, b in enumerate(list(busy) + [False]):
        if b and start is None:
            start = x
        elif not b and start is not None:
            if x - start > w * 0.03:
                cols.append((start, x))
            start = None
    while len(cols) > n:
        gaps = [(cols[i + 1][0] - cols[i][1], i) for i in range(len(cols) - 1)]
        g, i = min(gaps)
        cols[i] = (cols[i][0], cols[i + 1][1])
        del cols[i + 1]
    if len(cols) < n:
        cols = [(int(w * i / n), int(w * (i + 1) / n)) for i in range(n)]
    return cols


def clean_figure(cell, tol):
    pad = 6
    cell = cv2.copyMakeBorder(cell, pad, pad, pad, pad, cv2.BORDER_REPLICATE)
    bg = background_mask(cell, tol)
    fg = (~bg).astype(np.uint8) * 255
    ys, xs = np.where(fg > 0)
    if len(ys) == 0:
        return None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    cell = cell[y0:y1, x0:x1]
    fg = fg[y0:y1, x0:x1]
    # soft edge, then the colour is denoised but edges kept
    alpha = cv2.GaussianBlur(fg, (0, 0), 0.8)
    rgb = cv2.bilateralFilter(cell, 5, 18, 5)
    # resample to the common height; small sources get a two-step upscale which keeps panel lines crisper
    scale = HEIGHT / rgb.shape[0]
    if scale > 1.6:
        mid = cv2.resize(rgb, None, fx=min(scale, 2.0), fy=min(scale, 2.0), interpolation=cv2.INTER_CUBIC)
        a_mid = cv2.resize(alpha, None, fx=min(scale, 2.0), fy=min(scale, 2.0), interpolation=cv2.INTER_CUBIC)
        rgb = cv2.resize(mid, (max(1, int(round(rgb.shape[1] * scale))), HEIGHT), interpolation=cv2.INTER_LANCZOS4)
        alpha = cv2.resize(a_mid, (rgb.shape[1], HEIGHT), interpolation=cv2.INTER_LANCZOS4)
    else:
        rgb = cv2.resize(rgb, (max(1, int(round(rgb.shape[1] * scale))), HEIGHT), interpolation=cv2.INTER_LANCZOS4 if scale < 1 else cv2.INTER_CUBIC)
        alpha = cv2.resize(alpha, (rgb.shape[1], HEIGHT), interpolation=cv2.INTER_LANCZOS4)
    out = Image.fromarray(rgb).filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=3))
    out.putalpha(Image.fromarray(alpha))
    return out


def main():
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    jobs = [a.split("=", 1) for a in sys.argv[2:]]
    contact = []
    for name, path in jobs:
        img = load(path)
        h, w = img.shape[:2]
        # the hi-res concept sheets have a graded floor: a wider tolerance; the flat renders a tight one
        border = np.concatenate([img[0], img[-1], img[:, 0], img[:, -1]]).astype(np.int16)
        tol = 9 if border.std(axis=0).max() < 6 else 24
        rows = row_bands(img, tol)
        figs = []
        for ri, (y0, y1) in enumerate(rows):
            strip = img[y0:y1]
            cols = col_bands(strip, tol)
            for ci, (x0, x1) in enumerate(cols[:3]):
                fig = clean_figure(strip[:, x0:x1], tol)
                if fig is None:
                    continue
                view = ["front", "side", "back"][ci]
                row_tag = f"-r{ri + 1}" if len(rows) > 1 else ""
                fn = f"{name}{row_tag}-{view}.png"
                fig.save(os.path.join(out_dir, fn), optimize=True)
                figs.append((ri, fig))
                print(f"{fn}: {x1 - x0}x{y1 - y0} -> {fig.width}x{fig.height}")
        # the cleaned sheet: rows of three on a flat slate
        if figs:
            nrows = len(rows)
            tile_w = max(f.width for _, f in figs) + 40
            sheet = Image.new("RGB", (tile_w * 3, (HEIGHT + 40) * nrows), (26, 28, 36))
            counts = {}
            for ri, f in figs:
                ci = counts.get(ri, 0)
                counts[ri] = ci + 1
                x = ci * tile_w + (tile_w - f.width) // 2
                y = ri * (HEIGHT + 40) + 20
                sheet.paste(f, (x, y), f)
            sheet.save(os.path.join(out_dir, f"{name}-sheet.png"), optimize=True)
            contact.append(sheet)
    if contact:
        thumbs = [c.resize((int(c.width * 360 / c.height), 360)) for c in contact]
        cs = Image.new("RGB", (sum(t.width for t in thumbs) + 10 * (len(thumbs) + 1), 380), (16, 16, 20))
        x = 10
        for t in thumbs:
            cs.paste(t, (x, 10))
            x += t.width + 10
        cs.save(os.path.join(out_dir, "_contact.png"))


if __name__ == "__main__":
    main()
