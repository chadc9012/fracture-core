/* Texture-space paint for the authored operator models (pure: bytes in, bytes out, no rendering).
 * The bodies are low-resolution, so painting per vertex gave chunky colour patches that ignored the armor shapes. Here every
 * texel is painted from the *interpolated* region weights, so plate boundaries are as sharp as the texture, and the pass adds what
 * a flat colour cannot: seams between armor pieces, panel lines, paint wear, cloth weave, and a visor + glowing slit on the face.
 * OperatorModel.tsx uploads the result as `map` + `emissiveMap`. */
import { boneRegion, hexToRgb, regionWeights, type Palette, type Region } from "./operator-paint";

export const REGION_ORDER: readonly Region[] = ["helmet", "chest", "pauldron", "gauntlet", "thigh", "shin", "boot", "suit", "gear"];
const R = REGION_ORDER.length;

export type PaintMesh = {
  position: ArrayLike<number>; normal: ArrayLike<number>; uv: ArrayLike<number>; index: ArrayLike<number>;
  /** REGION_ORDER.length weights per vertex (see regionWeightArray) */
  regionWeights: ArrayLike<number>;
  /** signed curvature per vertex, + convex / - concave (operator-mesh.ts vertexCurvature) */
  curvature: ArrayLike<number>;
};
export type TextureOptions = { size?: number; accent?: string; robot?: boolean; /** which way the face looks along z (glTF default +1) */ forward?: 1 | -1 };
export type PaintResult = { size: number; color: Uint8Array; emissive: Uint8Array; covered: number; visorTexels: number };

/** Per-vertex region weights as one flat array (REGION_ORDER), from skin influences and bone names. */
export function regionWeightArray(boneNames: readonly string[], joints: ArrayLike<number>, weights: ArrayLike<number>, count: number): Float32Array {
  const out = new Float32Array(count * R);
  const j: number[] = [0, 0, 0, 0], w: number[] = [0, 0, 0, 0];
  for (let v = 0; v < count; v++) {
    for (let k = 0; k < 4; k++) { j[k] = joints[v * 4 + k]!; w[k] = weights[v * 4 + k]!; }
    const parts = regionWeights(boneNames, j, w);
    REGION_ORDER.forEach((r, i) => { out[v * R + i] = parts[r] ?? 0; });
  }
  return out;
}

const smooth01 = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** Where the head sits in the rest pose (helmet-weighted vertices): the visor and slit are then evaluated per texel from the interpolated
 * position and normal, so their outline is smooth at texture resolution instead of following triangle edges. */
export type HeadFrame = { y0: number; h: number; cx: number; hw: number };
export function headFrame(mesh: Pick<PaintMesh, "position" | "regionWeights">): HeadFrame | null {
  const n = mesh.position.length / 3, hi = REGION_ORDER.indexOf("helmet");
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (let v = 0; v < n; v++) if (mesh.regionWeights[v * R + hi]! > 0.5) { const y = mesh.position[v * 3 + 1]!, x = mesh.position[v * 3]!; y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  return y1 > y0 ? { y0, h: y1 - y0, cx: (x0 + x1) / 2, hw: Math.max(1e-4, (x1 - x0) / 2) } : null;
}
/** visor band and inner slit strength (0..1) at a point of the head */
export function faceAt(head: HeadFrame, helmetWeight: number, x: number, y: number, nz: number, forward: 1 | -1 = 1): { visor: number; slit: number } {
  // gate on the head's *position* (and only loosely on its skin weight): hood and cloth vertices carry mixed weights, and gating on those made ragged edges
  const wHelm = smooth01((helmetWeight - 0.03) / 0.2);
  if (wHelm <= 0) return { visor: 0, slit: 0 };
  const vy = (y - head.y0) / head.h;
  const facing = smooth01((nz * forward - 0.2) / 0.35) * smooth01((1 - Math.abs(x - head.cx) / (head.hw * 0.78)) * 2.5);
  const band = (half: number) => smooth01((1 - Math.abs(vy - 0.5) / half) * 2.2);
  return { visor: wHelm * facing * band(0.12), slit: wHelm * facing * band(0.04) };
}

/* ---- small deterministic value noise (3D), used for grunge and wear ---- */
function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

/** Everything about a texel that depends only on the model (not on the palette), baked once per model + resolution. Colour changes then only
 * re-run `paintBaked`, which is a cheap per-texel loop. Fields are quantised to bytes to keep a 1024 bake near 18 MB. */
export type Baked = {
  size: number; covered: number;
  mask: Uint8Array; rw: Uint8Array; nx: Int8Array; ny: Int8Array; curv: Int8Array;
  visor: Uint8Array; slit: Uint8Array; y: Uint8Array; grunge: Uint8Array; wear: Uint8Array; edge: Uint8Array;
};
const Y_RANGE = 2.0;

export function bakeTexels(mesh: PaintMesh, size = 512, forward: 1 | -1 = 1): Baked {
  const N = size * size;
  const b: Baked = { size, covered: 0, mask: new Uint8Array(N), rw: new Uint8Array(N * R), nx: new Int8Array(N), ny: new Int8Array(N), curv: new Int8Array(N), visor: new Uint8Array(N), slit: new Uint8Array(N), y: new Uint8Array(N), grunge: new Uint8Array(N), wear: new Uint8Array(N), edge: new Uint8Array(N) };
  const head = headFrame(mesh), hIdx = REGION_ORDER.indexOf("helmet");
  const { position, normal, uv, index } = mesh;
  const rw = new Float64Array(R);
  for (let t = 0; t < index.length; t += 3) {
    const ia = index[t]!, ib = index[t + 1]!, ic = index[t + 2]!;
    const ax = uv[ia * 2]! * size, ay = uv[ia * 2 + 1]! * size, bx = uv[ib * 2]! * size, by = uv[ib * 2 + 1]! * size, cx = uv[ic * 2]! * size, cy = uv[ic * 2 + 1]! * size;
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5)), x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx) + 0.5));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5)), y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy) + 0.5));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const sx = x + 0.5, sy = y + 0.5;
      const la = ((by - cy) * (sx - cx) + (cx - bx) * (sy - cy)) / det, lb = ((cy - ay) * (sx - cx) + (ax - cx) * (sy - cy)) / det, lc = 1 - la - lb;
      if (la < -0.02 || lb < -0.02 || lc < -0.02) continue; // a hair of overdraw closes cracks between triangles
      const i = y * size + x;
      b.mask[i] = 1;
      for (let r = 0; r < R; r++) { const w = la * mesh.regionWeights[ia * R + r]! + lb * mesh.regionWeights[ib * R + r]! + lc * mesh.regionWeights[ic * R + r]!; rw[r] = w; b.rw[i * R + r] = Math.max(0, Math.min(255, Math.round(w * 255))); }
      const px = la * position[ia * 3]! + lb * position[ib * 3]! + lc * position[ic * 3]!;
      const py = la * position[ia * 3 + 1]! + lb * position[ib * 3 + 1]! + lc * position[ic * 3 + 1]!;
      const pz = la * position[ia * 3 + 2]! + lb * position[ib * 3 + 2]! + lc * position[ic * 3 + 2]!;
      let nxx = la * normal[ia * 3]! + lb * normal[ib * 3]! + lc * normal[ic * 3]!, nyy = la * normal[ia * 3 + 1]! + lb * normal[ib * 3 + 1]! + lc * normal[ic * 3 + 1]!, nzz = la * normal[ia * 3 + 2]! + lb * normal[ib * 3 + 2]! + lc * normal[ic * 3 + 2]!;
      const nl = Math.hypot(nxx, nyy, nzz) || 1; nxx /= nl; nyy /= nl; nzz /= nl;
      b.nx[i] = Math.round(nxx * 127); b.ny[i] = Math.round(nyy * 127);
      b.curv[i] = Math.round(Math.max(-1, Math.min(1, la * mesh.curvature[ia]! + lb * mesh.curvature[ib]! + lc * mesh.curvature[ic]!)) * 127);
      b.y[i] = Math.max(0, Math.min(255, Math.round((py / Y_RANGE) * 255)));
      if (head) { const f = faceAt(head, rw[hIdx]!, px, py, nzz, forward); b.visor[i] = Math.round(f.visor * 255); b.slit[i] = Math.round(f.slit * 255); }
      b.grunge[i] = Math.round((vnoise(px * 14, py * 14, pz * 14) * 0.6 + vnoise(px * 52, py * 52, pz * 52) * 0.4) * 255);
      b.wear[i] = Math.round(vnoise(px * 40 + 3, py * 40, pz * 40) * 255);
      b.edge[i] = Math.round(vnoise(px * 33 + 7, py * 33, pz * 33) * 255);
    }
  }
  let covered = 0;
  for (let i = 0; i < N; i++) if (b.mask[i]) covered++;
  b.covered = covered / N;
  return b;
}

/** Palette pass: colours, cavity/edge shading, seams, cloth and the visor, from baked texel data. No allocation per texel. */
export function paintBaked(b: Baked, palette: Palette, opts: { accent?: string } = {}): PaintResult {
  const size = b.size, N = size * size;
  const accent = hexToRgb(opts.accent ?? "#4fd8ff");
  const base = REGION_ORDER.map((r) => hexToRgb(palette[r].color));
  const plate = REGION_ORDER.map((r) => palette[r].plate);
  const metal = [196, 202, 212], glass = [8, 12, 18], floor = [28, 40, 54];
  const color = new Uint8Array(N * 4), emissive = new Uint8Array(N * 4);
  const done = new Uint8Array(b.mask);
  let visorTexels = 0;
  for (let i = 0; i < N; i++) {
    if (!b.mask[i]) continue;
    const o = i * 4, ro = i * R;
    let i1 = 0, i2 = -1, w1 = -1, w2 = -1, tw = 0, cr = 0, cg = 0, cb = 0, pl = 0;
    for (let r = 0; r < R; r++) {
      const w = b.rw[ro + r]! / 255;
      if (w > w1) { w2 = w1; i2 = i1; w1 = w; i1 = r; } else if (w > w2) { w2 = w; i2 = r; }
      if (w > 0) { const c = base[r]!; cr += c[0]! * w; cg += c[1]! * w; cb += c[2]! * w; pl += plate[r]! * w; tw += w; }
    }
    if (tw > 0) { cr /= tw; cg /= tw; cb /= tw; pl /= tw; }
    const sharp = smooth01((w1 - 0.5) / 0.35); // plates stay clean; only genuine borders blend
    cr += (base[i1]![0]! - cr) * sharp; cg += (base[i1]![1]! - cg) * sharp; cb += (base[i1]![2]! - cb) * sharp;
    const curv = b.curv[i]! / 127, grunge = b.grunge[i]! / 255, ny = b.ny[i]! / 127, nx = b.nx[i]! / 127, py = (b.y[i]! / 255) * Y_RANGE;
    let k = 1;
    if (pl > 0.5) {
      k *= 0.92 + grunge * 0.16;
      // baked cavity: creases darken; only the sharpest ridges show bare metal, tinted by the plate colour so it reads as worn paint
      if (curv < 0) k *= 1 + curv * 0.6;
      else if (curv > 0.4) { const t = smooth01((curv - 0.4) / 0.4) * (0.4 + 0.6 * (b.wear[i]! / 255)) * 0.6; cr += (metal[0]! * 0.8 + cr * 0.2 - cr) * t; cg += (metal[1]! * 0.8 + cg * 0.2 - cg) * t; cb += (metal[2]! * 0.8 + cb * 0.2 - cb) * t; }
    } else {
      const x = i % size, y = (i / size) | 0;
      const weave = 0.5 + 0.5 * Math.sin(x * 1.9) * Math.sin(y * 1.9);
      k *= 0.93 + weave * 0.07 + (grunge - 0.5) * 0.14 + Math.min(0, curv) * 0.4;
    }
    if (i2 >= 0 && i1 !== i2 && REGION_ORDER[i1] !== REGION_ORDER[i2]) { const q = w1 - w2; if (q < 0.2) k *= 1 - 0.5 * (1 - q / 0.2); } // seam between armor pieces
    k *= (0.92 + 0.1 * Math.min(1, Math.max(-1, ny))) * (0.86 + 0.22 * smooth01(py / 1.7));
    let r = cr * k, g = cg * k, bl = cb * k, er = floor[0]!, eg = floor[1]!, eb = floor[2]!;
    const tv = smooth01((b.visor[i]! / 255 - 0.26) / 0.12);
    if (tv > 0) {
      const refl = 0.5 + 0.5 * Math.sin(py * 38 + nx * 3), ts = smooth01((b.slit[i]! / 255 - 0.4) / 0.12);
      const gr = glass[0]! + accent[0] * 0.12 * refl, gg = glass[1]! + accent[1] * 0.12 * refl, gb = glass[2]! + accent[2] * 0.12 * refl;
      r += (gr + (accent[0] - gr) * ts - r) * tv; g += (gg + (accent[1] - gg) * ts - g) * tv; bl += (gb + (accent[2] - gb) * ts - bl) * tv;
      er += (floor[0]! * 0.4 + (accent[0] - floor[0]! * 0.4) * ts - er) * tv; eg += (floor[1]! * 0.4 + (accent[1] - floor[1]! * 0.4) * ts - eg) * tv; eb += (floor[2]! * 0.4 + (accent[2] - floor[2]! * 0.4) * ts - eb) * tv;
      if (tv > 0.5) visorTexels++;
    }
    color[o] = r; color[o + 1] = g; color[o + 2] = bl; color[o + 3] = 255;
    emissive[o] = er; emissive[o + 1] = eg; emissive[o + 2] = eb; emissive[o + 3] = 255;
  }
  // dilate 3 texels into the gutter so bilinear/mip sampling at island borders never pulls in unpainted colour
  const fill = base[REGION_ORDER.indexOf("suit")]!;
  for (let pass = 0; pass < 3; pass++) {
    const add: number[] = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (done[y * size + x]) continue;
      for (let d = 0; d < 4; d++) {
        const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= size || ny >= size || !done[ny * size + nx]) continue;
        add.push(y * size + x, (ny * size + nx) * 4); break;
      }
    }
    for (let i = 0; i < add.length; i += 2) { const dst = add[i]!, src = add[i + 1]!, o = dst * 4; for (let c = 0; c < 4; c++) { color[o + c] = color[src + c]!; emissive[o + c] = emissive[src + c]!; } done[dst] = 1; }
  }
  for (let i = 0; i < N; i++) if (!done[i]) { const o = i * 4; color[o] = fill[0]!; color[o + 1] = fill[1]!; color[o + 2] = fill[2]!; color[o + 3] = 255; emissive[o] = floor[0]!; emissive[o + 1] = floor[1]!; emissive[o + 2] = floor[2]!; emissive[o + 3] = 255; }
  return { size, color, emissive, covered: b.covered, visorTexels };
}

/** bake + paint in one call (tests, offline previews) */
export function paintOperatorTexture(mesh: PaintMesh, palette: Palette, opts: TextureOptions = {}): PaintResult {
  return paintBaked(bakeTexels(mesh, opts.size ?? 512, opts.forward ?? 1), palette, opts.accent !== undefined ? { accent: opts.accent } : {});
}

/** convenience for callers that only have bone names: which region a bone paints (re-exported so tests need one import) */
export { boneRegion };
