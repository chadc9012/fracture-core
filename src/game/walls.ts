/** Thin solid walls (building shells with real doorways), as line segments in a spatial hash. The obstacle grid
 * (obstacles.ts) only knows circles, which can't leave a gap for a door; a wall here is a segment with a half
 * thickness and a top, and a body is pushed out sideways along the segment's normal. Pure data, no three.js. */

export type Wall = { ax: number; az: number; bx: number; bz: number; half: number; base: number; top: number };

const CELL = 16;
const grid = new Map<string, Wall[]>();
const owners = new Map<string, Wall[]>();
const key = (cx: number, cz: number) => `${cx}_${cz}`;

function cellsOf(w: Wall, pad: number, fn: (k: string) => void) {
  const x0 = Math.floor((Math.min(w.ax, w.bx) - pad) / CELL), x1 = Math.floor((Math.max(w.ax, w.bx) + pad) / CELL);
  const z0 = Math.floor((Math.min(w.az, w.bz) - pad) / CELL), z1 = Math.floor((Math.max(w.az, w.bz) + pad) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) fn(key(cx, cz));
}

/** registers (or replaces) a named set of walls, e.g. one building's shell */
export function setWalls(owner: string, walls: readonly Wall[]) {
  clearWalls(owner);
  owners.set(owner, [...walls]);
  for (const w of walls) cellsOf(w, w.half + 4, (k) => { const c = grid.get(k); if (c) c.push(w); else grid.set(k, [w]); });
}

export function clearWalls(owner?: string) {
  if (owner === undefined) { grid.clear(); owners.clear(); return; }
  const old = owners.get(owner);
  if (!old) return;
  owners.delete(owner);
  const gone = new Set(old);
  for (const [k, list] of grid) { const kept = list.filter((w) => !gone.has(w)); if (kept.length) grid.set(k, kept); else grid.delete(k); }
}

export function wallsNear(x: number, z: number): readonly Wall[] {
  return grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? [];
}

/** closest point on the wall's centre line to (x,z) */
function closest(w: Wall, x: number, z: number) {
  const ex = w.bx - w.ax, ez = w.bz - w.az, l2 = ex * ex + ez * ez || 1;
  const t = Math.max(0, Math.min(1, ((x - w.ax) * ex + (z - w.az) * ez) / l2));
  return { x: w.ax + ex * t, z: w.az + ez * t };
}

/** pushes a body of `radius` out of every wall it overlaps (feet at `y`, if known: a body above a wall's top or
 * below its base passes). Returns whether anything was hit. Two passes settle corners where two walls meet. */
export function collideWalls(body: { x: number; z: number }, radius: number, y?: number): boolean {
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    for (const w of wallsNear(body.x, body.z)) {
      if (y !== undefined && (y > w.top - 0.2 || y + 1.6 < w.base)) continue;
      const c = closest(w, body.x, body.z);
      const dx = body.x - c.x, dz = body.z - c.z, d = Math.hypot(dx, dz), min = radius + w.half;
      if (d >= min) continue;
      hit = true;
      if (d > 1e-4) { body.x += (dx / d) * (min - d); body.z += (dz / d) * (min - d); }
      else {
        // exactly on the centre line: push along the wall's normal
        const ex = w.bx - w.ax, ez = w.bz - w.az, l = Math.hypot(ex, ez) || 1;
        body.x += (-ez / l) * min; body.z += (ex / l) * min;
      }
    }
  }
  return hit;
}
