/** Where each region sits on the illustrated "Fractured Earth" map (src/assets/fractured-earth-map-v2.jpg), as percentages of the image.
 * The art is a painting, not the terrain: it is used for the destination picker, where only the *region* matters. The in-game tactical map
 * (player position, mission markers) stays on the real terrain raster so it can never disagree with the world. */
import { REGIONS } from "./world";

export const MAP_ART_ASPECT = 1158 / 791;
export const MAP_ART_SPOTS: Readonly<Record<string, { x: number; y: number }>> = {
  veridan: { x: 19.7, y: 26.9 }, frostspire: { x: 55.1, y: 11.5 }, ember: { x: 19.9, y: 48.2 }, wastelands: { x: 45.4, y: 45.6 },
  solara: { x: 26.6, y: 72.2 }, swamps: { x: 64.3, y: 75 }, nexus: { x: 72.4, y: 51.2 },
};

/** Optional high-resolution master of the same painting. Drop a file at public/maps/fractured-earth-map-4096.jpg (same aspect as the bundled
 * 1158 x 791 art; 4096 px wide is the target) and the hub map uses it automatically; without it the bundled art is shown unchanged.
 * Nothing is upscaled: a missing or wrongly shaped file is simply ignored. */
export const MAP_ART_HIRES_URL = "/maps/fractured-earth-map-4096.jpg";
export const MAP_ART_HIRES_MIN_WIDTH = 2048;
/** A candidate replaces the bundled art only when it is genuinely larger and the same shape (within 1%), so nothing is stretched. */
export function hiresArtUsable(width: number, height: number): boolean {
  if (!(width >= MAP_ART_HIRES_MIN_WIDTH) || !(height > 0)) return false;
  return Math.abs(width / height / MAP_ART_ASPECT - 1) <= 0.01;
}

/** World -> picture transform. The painting is geographically consistent with the world (an affine fit of the seven region hotspots to their world
 * centres is within about 3% of the picture everywhere), so a world position can be placed on it without hand-picking. Least squares, derived from
 * REGIONS so it follows WORLD_SCALE. */
function fitAffine(): { cx: [number, number, number]; cy: [number, number, number] } {
  const rows = REGIONS.map((r) => [1, r.x, r.z] as const);
  const solve = (ys: number[]): [number, number, number] => {
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
    rows.forEach((r, i) => { for (let j = 0; j < 3; j++) { b[j]! += r[j]! * ys[i]!; for (let k = 0; k < 3; k++) A[j]![k]! += r[j]! * r[k]!; } });
    const M = A.map((r, i) => [...r, b[i]!]);
    for (let i = 0; i < 3; i++) {
      let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(M[r]![i]!) > Math.abs(M[p]![i]!)) p = r;
      [M[i], M[p]] = [M[p]!, M[i]!];
      for (let r = 0; r < 3; r++) if (r !== i) { const f = M[r]![i]! / M[i]![i]!; for (let c = i; c < 4; c++) M[r]![c]! -= f * M[i]![c]!; }
    }
    return [M[0]![3]! / M[0]![0]!, M[1]![3]! / M[1]![1]!, M[2]![3]! / M[2]![2]!];
  };
  return { cx: solve(REGIONS.map((r) => MAP_ART_SPOTS[r.id]!.x)), cy: solve(REGIONS.map((r) => MAP_ART_SPOTS[r.id]!.y)) };
}
const FIT = fitAffine();

/** Unclamped world -> painting position (percent). Used to sample the painting itself (coastline.ts); `artSpotForWorld` is the clamped marker version. */
export function artRawForWorld(x: number, z: number): { x: number; y: number } {
  return { x: FIT.cx[0] + FIT.cx[1] * x + FIT.cx[2] * z, y: FIT.cy[0] + FIT.cy[1] * x + FIT.cy[2] * z };
}
/** Inverse of artRawForWorld: where a painting position (percent) is in the world. */
export function worldForArt(ax: number, ay: number): { x: number; z: number } {
  const a = FIT.cx[1], b = FIT.cx[2], c = FIT.cy[1], d = FIT.cy[2], det = a * d - b * c;
  const u = ax - FIT.cx[0], v = ay - FIT.cy[0];
  return { x: (d * u - b * v) / det, z: (-c * u + a * v) / det };
}
/** Metres of world per painting percent along each picture axis (the painting is stretched: the same width is about 1.7x fewer metres than height). */
export function metresPerArtPercent(): { x: number; y: number } {
  return { x: 1 / Math.hypot(FIT.cx[1], FIT.cy[1]), y: 1 / Math.hypot(FIT.cx[2], FIT.cy[2]) };
}

/** Parts of the picture that are not map: the legend panel down the right edge and the title block in the top-left corner. */
export const MAP_ART_LEGEND_LEFT = 82;
export const MAP_ART_TITLE_BOTTOM = 13;

/** Where a world position lands on the painting (percent). `clamped` is true when the real spot is off the picture or under the legend/title,
 * in which case the marker is pinned to the nearest free edge of the map and must be labelled "off chart" rather than presented as exact. */
export function artSpotForWorld(x: number, z: number): { x: number; y: number; clamped: boolean } {
  const rx = FIT.cx[0] + FIT.cx[1] * x + FIT.cx[2] * z, ry = FIT.cy[0] + FIT.cy[1] * x + FIT.cy[2] * z;
  const cx = Math.min(MAP_ART_LEGEND_LEFT - 2, Math.max(3, rx)), cy = Math.min(95, Math.max(MAP_ART_TITLE_BOTTOM, ry));
  return { x: cx, y: cy, clamped: Math.abs(cx - rx) > 0.01 || Math.abs(cy - ry) > 0.01 };
}
