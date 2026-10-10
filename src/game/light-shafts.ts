/* Forest light shafts: soft sunbeams slanting through the canopy. Pure placement + strength rules; LightShafts.tsx only draws them.
 * Shafts live on a world grid (one candidate per cell), so they stay where they are as the player moves and every client sees the
 * same ones. Presentation only: nothing here reads or changes combat, AI or save state. */

export const SHAFT_CELL = 38;
export const SHAFT_POOL = 14;

export interface Shaft { id: string; x: number; z: number; width: number; height: number; phase: number }

function hash(ix: number, iz: number, salt: number): number {
  let n = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(salt, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Shafts in the (2*ring+1)^2 grid cells around (cx, cz), nearest first, at most `max`. `ok` rejects spots (outside the forest, on water). */
export function shaftsAround(cx: number, cz: number, ok: (x: number, z: number) => boolean, ring = 2, max = SHAFT_POOL, density = 0.62): Shaft[] {
  const ci = Math.floor(cx / SHAFT_CELL), cj = Math.floor(cz / SHAFT_CELL);
  const out: (Shaft & { d: number })[] = [];
  for (let i = ci - ring; i <= ci + ring; i++) for (let j = cj - ring; j <= cj + ring; j++) {
    if (hash(i, j, 1) > density) continue;
    const x = (i + 0.15 + hash(i, j, 2) * 0.7) * SHAFT_CELL, z = (j + 0.15 + hash(i, j, 3) * 0.7) * SHAFT_CELL;
    if (!ok(x, z)) continue;
    out.push({ id: `${i},${j}`, x, z, width: 5 + hash(i, j, 4) * 7, height: 24 + hash(i, j, 5) * 14, phase: hash(i, j, 6) * 6.283, d: Math.hypot(x - cx, z - cz) });
  }
  return out.sort((a, b) => a.d - b.d).slice(0, max).map(({ d: _d, ...s }) => s);
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** 0..1 beam strength: needs the sun up (best at a low-to-mid angle), fades with cloud/overcast, and only inside the forest. */
export function shaftStrength(sunElevation: number, overcast: number, forestPresence: number): number {
  const sun = smooth(0.05, 0.3, sunElevation) * (1 - smooth(0.78, 1, sunElevation) * 0.5);
  return Math.max(0, sun * (1 - Math.min(1, Math.max(0, overcast)) * 0.85) * Math.min(1, Math.max(0, forestPresence)));
}

/** 1 deep in the forest, easing to 0 at its rim */
export const forestPresence = (distFromCentre: number, radius: number) => 1 - smooth(radius * 0.7, radius * 1.0, distFromCentre);
