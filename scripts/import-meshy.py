#!/usr/bin/env python3
"""Bring a Meshy GLB into the game (owner, Nov 15: the Meshy full upgrade, docs/reference/MESHY_UPGRADE.md).

  - textures: resized with Lanczos to --tex (2048 by default; 4096 for buildings and big things) and stored as JPEG
    (quality 92; the normal map 95) instead of Meshy's 4K PNGs, so a model is a few MB and not 45
  - placement, one of:
      --match OLD.glb   the new model takes the old model's place: its longest axis along the old one's, the same
                        length, the same centre; for weapons (--weapon) the slim end (the muzzle) goes where the old
                        model's slim end was
      --height H        metres tall, base on y=0, centred on x/z (props, trees, animals)
  - then the pixelation gate (check-meshy-textures.py) runs on the result; a fail deletes the output and exits 1

Usage: import-meshy.py SRC.glb DST.glb [--match OLD.glb [--weapon] | --height H] [--tex 2048] [--yaw DEG]
"""
import argparse, io, json, os, struct, subprocess, sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def read_glb(path):
    b = open(path, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    off = 20 + n
    m = struct.unpack("<I", b[off:off + 4])[0]
    return j, bytearray(b[off + 8:off + 8 + m])


def write_glb(path, j, bin_):
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    bin_ = bytes(bin_) + b"\0" * (-len(bin_) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942) + bin_)


def node_matrix(n):
    if "matrix" in n:
        return np.array(n["matrix"], dtype=np.float64).reshape(4, 4).T
    t = np.array(n.get("translation", [0, 0, 0]), dtype=np.float64)
    q = n.get("rotation", [0, 0, 0, 1])
    s = np.array(n.get("scale", [1, 1, 1]), dtype=np.float64)
    x, y, z, w = q
    r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    m = np.eye(4)
    m[:3, :3] = r * s
    m[:3, 3] = t
    return m


def positions(j, bin_):
    """every vertex of every mesh in world space (scene 0)"""
    out = []

    def accessor(i):
        a = j["accessors"][i]
        bv = j["bufferViews"][a["bufferView"]]
        o = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = bv.get("byteStride", 12)
        raw = np.frombuffer(bytes(bin_[o:o + stride * a["count"]]), dtype=np.uint8).reshape(a["count"], stride)
        return raw[:, :12].copy().view(np.float32).reshape(a["count"], 3).astype(np.float64)

    def walk(ni, parent):
        n = j["nodes"][ni]
        m = parent @ node_matrix(n)
        if "mesh" in n:
            for p in j["meshes"][n["mesh"]]["primitives"]:
                v = accessor(p["attributes"]["POSITION"])
                out.append((np.c_[v, np.ones(len(v))] @ m.T)[:, :3])
        for c in n.get("children", []):
            walk(c, m)

    for ni in j["scenes"][j.get("scene", 0)]["nodes"]:
        walk(ni, np.eye(4))
    return np.vstack(out)


def slim_end(v, axis):
    """+1 if the slimmer end (a muzzle, a blade tip) is at the + end of `axis`, else -1"""
    lo, hi = v[:, axis].min(), v[:, axis].max()
    span = hi - lo
    other = [a for a in range(3) if a != axis]

    def girth(sel):
        p = v[sel][:, other]
        return float(np.ptp(p[:, 0]) * np.ptp(p[:, 1])) if len(p) > 3 else 0.0

    a = girth(v[:, axis] > hi - span * 0.15)
    b = girth(v[:, axis] < lo + span * 0.15)
    return 1 if a < b else -1


def rot_to(src_axis, src_sign, dst_axis, dst_sign):
    """a rotation (3x3) taking the src axis (signed) onto the dst axis (signed), keeping +y up when possible"""
    e = np.eye(3)
    a = e[src_axis] * src_sign
    b = e[dst_axis] * dst_sign
    if np.allclose(a, b):
        return np.eye(3)
    if np.allclose(a, -b):
        # half turn about up (or about x if the axis is up itself)
        ax = np.array([0, 1, 0]) if abs(a[1]) < 0.5 else np.array([1, 0, 0])
    else:
        ax = np.cross(a, b)
    ax = ax / np.linalg.norm(ax)
    ang = np.arccos(np.clip(np.dot(a, b), -1, 1))
    k = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
    return np.eye(3) + np.sin(ang) * k + (1 - np.cos(ang)) * k @ k


def quat(r):
    w = np.sqrt(max(0.0, 1 + r[0, 0] + r[1, 1] + r[2, 2])) / 2
    x = np.sqrt(max(0.0, 1 + r[0, 0] - r[1, 1] - r[2, 2])) / 2
    y = np.sqrt(max(0.0, 1 - r[0, 0] + r[1, 1] - r[2, 2])) / 2
    z = np.sqrt(max(0.0, 1 - r[0, 0] - r[1, 1] + r[2, 2])) / 2
    x = np.copysign(x, r[2, 1] - r[1, 2])
    y = np.copysign(y, r[0, 2] - r[2, 0])
    z = np.copysign(z, r[1, 0] - r[0, 1])
    return [float(x), float(y), float(z), float(w)]


def retexture(j, bin_, size):
    """every image resized to `size` (never up) and re-encoded as JPEG; returns a new binary buffer"""
    normals = {j["textures"][m["normalTexture"]["index"]]["source"] for m in j.get("materials", []) if "normalTexture" in m}
    blobs = {}
    for i, im in enumerate(j.get("images", [])):
        if "bufferView" not in im:
            continue
        bv = j["bufferViews"][im["bufferView"]]
        o = bv.get("byteOffset", 0)
        img = Image.open(io.BytesIO(bytes(bin_[o:o + bv["byteLength"]])))
        has_alpha = img.mode in ("RGBA", "LA") and np.asarray(img.convert("RGBA"))[:, :, 3].min() < 250
        img = img.convert("RGBA" if has_alpha else "RGB")
        if max(img.size) > size:
            k = size / max(img.size)
            img = img.resize((max(1, round(img.size[0] * k)), max(1, round(img.size[1] * k))), Image.LANCZOS)
        buf = io.BytesIO()
        if has_alpha:
            img.save(buf, "PNG", optimize=True)
            im["mimeType"] = "image/png"
        else:
            img.save(buf, "JPEG", quality=95 if i in normals else 92, subsampling=0 if i in normals else 2, optimize=True)
            im["mimeType"] = "image/jpeg"
        blobs[im["bufferView"]] = buf.getvalue()
    # rebuild the buffer: every buffer view in order, image views replaced
    out = bytearray()
    for k, bv in enumerate(j["bufferViews"]):
        o = bv.get("byteOffset", 0)
        data = blobs.get(k, bytes(bin_[o:o + bv["byteLength"]]))
        out += b"\0" * (-len(out) % 4)
        bv["byteOffset"] = len(out)
        bv["byteLength"] = len(data)
        out += data
    j["buffers"] = [{"byteLength": len(out)}]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--match")
    ap.add_argument("--weapon", action="store_true")
    ap.add_argument("--height", type=float)
    ap.add_argument("--length", type=float, help="metres along the longest axis instead of --match's")
    ap.add_argument("--tex", type=int, default=2048)
    ap.add_argument("--yaw", type=float, default=0.0, help="extra turn about up, degrees")
    ap.add_argument("--flip", action="store_true", help="--weapon: the slim-end guess was wrong (a bipod at the muzzle)")
    ap.add_argument("--min-tex", type=int, default=0, help="the gate's minimum base colour size (default: --tex)")
    a = ap.parse_args()

    j, bin_ = read_glb(a.src)
    v = positions(j, bin_)
    r = np.eye(3)
    if a.match:
        jo, bo = read_glb(a.match)
        vo = positions(jo, bo)
        ext_n, ext_o = np.ptp(v, axis=0), np.ptp(vo, axis=0)
        an, ao = int(np.argmax(ext_n)), int(np.argmax(ext_o))
        sn = (slim_end(v, an) * (-1 if a.flip else 1)) if a.weapon else 1
        so = slim_end(vo, ao) if a.weapon else 1
        r = rot_to(an, sn, ao, so)
        v2 = v @ r.T
        length = a.length or float(np.ptp(vo[:, ao]))
        s = length / float(np.ptp(v2[:, ao]))
        centre = (vo.min(0) + vo.max(0)) / 2
        t = centre - s * (v2.min(0) + v2.max(0)) / 2
    elif a.height:
        if a.yaw:
            c, si = np.cos(np.radians(a.yaw)), np.sin(np.radians(a.yaw))
            r = np.array([[c, 0, si], [0, 1, 0], [-si, 0, c]])
        v2 = v @ r.T
        s = a.height / float(np.ptp(v2[:, 1]))
        lo, hi = v2.min(0), v2.max(0)
        t = -s * np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    else:
        sys.exit("give --match OLD.glb or --height H")

    # a plain root (game code sets the instance root's transform freely) over a node that scales, turns and moves
    fit = {"name": "MeshyFit", "children": list(j["scenes"][j.get("scene", 0)]["nodes"]),
           "rotation": quat(r), "scale": [s, s, s], "translation": [float(x) for x in t]}
    j["nodes"].append(fit)
    j["nodes"].append({"name": os.path.splitext(os.path.basename(a.dst))[0], "children": [len(j["nodes"]) - 1]})
    j["scenes"][j.get("scene", 0)]["nodes"] = [len(j["nodes"]) - 1]
    bin_ = retexture(j, bin_, a.tex)
    j.setdefault("asset", {})["generator"] = "Meshy 7.1 via import-meshy.py"
    write_glb(a.dst, j, bin_)
    vf = positions(*read_glb(a.dst))
    size = np.ptp(vf, axis=0)
    print(f"{a.dst}: {os.path.getsize(a.dst) / 1e6:.1f} MB, size {size[0]:.2f} x {size[1]:.2f} x {size[2]:.2f} m")
    gate = [sys.executable, os.path.join(HERE, "check-meshy-textures.py"), "--min", str(a.min_tex or min(a.tex, 2048)),
            "--real-size", f"{float(size.max()):.3f}", "--min-ppm", "0", a.dst]
    if subprocess.call(gate) != 0:
        os.remove(a.dst)
        sys.exit(f"REJECTED {a.src}: failed the pixelation gate")


if __name__ == "__main__":
    main()
