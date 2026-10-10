/* Local mesh refinement. The world ground mesh is a 2.5 m grid, which cannot draw features smaller than ~5 m, so the
 * 6.5 m impact pit (see forest-relief.ts) drew up to 1.6 m away from the height the player actually walks on. Instead of
 * raising the whole world's resolution, a few coarse cells around the crash site are replaced by a finer patch.
 * The patch is aligned to coarse grid lines, and its border vertices lie on the coarse edges (linear between the two
 * coarse corner heights), so the patch meets the surrounding mesh with no cracks. Pure and testable; Terrain.tsx only
 * turns the result into triangles. */

export type RefineVertex = { x: number; z: number; h: number; /** plane uv, matching PlaneGeometry */ u: number; v: number };
export type RefinePatch = {
  /** coarse cells replaced: ix0..ix1-1, iz0..iz1-1 (grid lines ix0..ix1) */
  ix0: number; ix1: number; iz0: number; iz1: number;
  sub: number; cols: number; rows: number;
  vertices: RefineVertex[];
  /** triangle indices into `vertices`, same winding as THREE.PlaneGeometry */
  indices: number[];
};

/** Replace the coarse cells overlapping a circle of `radius` around (cx, cz) with `sub`×`sub` finer cells each. */
export function refinePatch(size: number, seg: number, cx: number, cz: number, radius: number, sub: number, height: (x: number, z: number) => number): RefinePatch {
  const cell = size / seg, half = size / 2;
  const ix0 = Math.max(0, Math.floor((cx - radius + half) / cell)), ix1 = Math.min(seg, Math.ceil((cx + radius + half) / cell));
  const iz0 = Math.max(0, Math.floor((cz - radius + half) / cell)), iz1 = Math.min(seg, Math.ceil((cz + radius + half) / cell));
  const cols = (ix1 - ix0) * sub, rows = (iz1 - iz0) * sub;
  const fine = cell / sub;
  const coarse = (ix: number, iz: number) => height(ix * cell - half, iz * cell - half);
  const vertices: RefineVertex[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const x = (ix0 * sub + i) * fine - half, z = (iz0 * sub + j) * fine - half;
    const onX = i === 0 || i === cols, onZ = j === 0 || j === rows;
    let h: number;
    if (onX || onZ) {
      // border: stay on the coarse edge (linear between its two coarse vertices)
      const gx = (x + half) / cell, gz = (z + half) / cell;
      const bx = Math.floor(gx + 1e-9), bz = Math.floor(gz + 1e-9);
      const fx = gx - bx, fz = gz - bz;
      if (onX && onZ) h = coarse(Math.round(gx), Math.round(gz));
      else if (onX) h = coarse(Math.round(gx), bz) * (1 - fz) + coarse(Math.round(gx), bz + 1) * fz;
      else h = coarse(bx, Math.round(gz)) * (1 - fx) + coarse(bx + 1, Math.round(gz)) * fx;
    } else {
      h = height(x, z);
      // one ring in from the border, ease from the edge-linear height toward the true height
      const nearEdge = i === 1 || i === cols - 1 || j === 1 || j === rows - 1;
      if (nearEdge) {
        const gx = (x + half) / cell, gz = (z + half) / cell, bx = Math.floor(gx + 1e-9), bz = Math.floor(gz + 1e-9), fx = gx - bx, fz = gz - bz;
        const lin = coarse(bx, bz) * (1 - fx) * (1 - fz) + coarse(bx + 1, bz) * fx * (1 - fz) + coarse(bx, bz + 1) * (1 - fx) * fz + coarse(bx + 1, bz + 1) * fx * fz;
        h = lin + (h - lin) * 0.5;
      }
    }
    vertices.push({ x, z, h, u: (x + half) / size, v: 1 - (z + half) / size });
  }
  const indices: number[] = [];
  const w = cols + 1;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = i + w * j, b = i + w * (j + 1), c = i + 1 + w * (j + 1), d = i + 1 + w * j;
    indices.push(a, b, d, b, c, d);
  }
  return { ix0, ix1, iz0, iz1, sub, cols, rows, vertices, indices };
}

/** index of the first of the two triangles PlaneGeometry emits for coarse cell (ix, iz) */
export const coarseCellStart = (seg: number, ix: number, iz: number) => 6 * (iz * seg + ix);

/** the coarse index list with every cell in the patch removed */
export function carveCells(index: ArrayLike<number>, seg: number, p: RefinePatch): number[] {
  const out: number[] = [];
  for (let iz = 0; iz < seg; iz++) for (let ix = 0; ix < seg; ix++) {
    if (ix >= p.ix0 && ix < p.ix1 && iz >= p.iz0 && iz < p.iz1) continue;
    const s = coarseCellStart(seg, ix, iz);
    for (let k = 0; k < 6; k++) out.push(index[s + k]!);
  }
  return out;
}
