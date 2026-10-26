/** Weather wind speed (world units/s, ~1 fog .. ~14 storm) → foliage bend strength 0.15..1.4. Pure. */
export function windStrength(speed: number): number {
  return Math.min(1.4, Math.max(0.15, 0.2 + (Math.max(0, speed) / 14) * 1.1));
}

/**
 * Gust field: a slow value-noise pattern of strong and calm patches that the wind carries across the land, so a gust is seen
 * rolling through a meadow and then the tree line instead of every plant pulsing in place. The pattern is advected by an
 * accumulated drift offset (not time x direction), so it never jumps when the weather turns the wind. wind-sway.ts holds the
 * GLSL twin of `gustAt`; keep the two in step.
 */
export const GUST = {
  /** noise lattice cell (m): roughly the width of one gust patch */
  cell: 26,
  /** lattice period in cells; the drift wraps at cell * period so float precision holds over hours of play */
  period: 64,
  /** gusts travel at base + per-wind x wind speed (m/s) */
  speedBase: 2.5,
  speedPerWind: 0.85,
} as const;

export const GUST_WRAP = GUST.cell * GUST.period;

/** 0.35 (fog, still air: gentle, even sway) .. 1 (storm: hard gusts and lulls) */
export function gustiness(speed: number): number {
  const t = Math.min(1, Math.max(0, (speed - 2) / 12));
  return 0.35 + 0.65 * t * t * (3 - 2 * t);
}

export function gustSpeed(speed: number): number {
  return GUST.speedBase + Math.max(0, speed) * GUST.speedPerWind;
}

const wrap = (v: number) => ((v % GUST_WRAP) + GUST_WRAP) % GUST_WRAP;

/** carries the gust pattern downwind for `dt` seconds; returns the new drift offset (wrapped) */
export function stepGustDrift(off: { x: number; z: number }, dirX: number, dirZ: number, speed: number, dt: number): { x: number; z: number } {
  const len = Math.hypot(dirX, dirZ) || 1;
  const d = gustSpeed(speed) * Math.max(0, dt);
  return { x: wrap(off.x + (dirX / len) * d), z: wrap(off.z + (dirZ / len) * d) };
}

const fract = (v: number) => v - Math.floor(v);
const mod = (v: number, m: number) => ((v % m) + m) % m;
function hash(cx: number, cz: number): number {
  return fract(Math.sin(mod(cx, GUST.period) * 127.1 + mod(cz, GUST.period) * 311.7) * 43758.5453);
}
function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** gust strength 0..1 at world (x, z) given the drift offset. Sharpened so most ground is in a lull and gusts are distinct patches. */
export function gustAt(x: number, z: number, offX: number, offZ: number): number {
  const px = (x - offX) / GUST.cell, pz = (z - offZ) / GUST.cell;
  // second octave on a doubled lattice (period stays a whole number of cells, so the field still tiles at GUST_WRAP)
  const n = noise(px, pz) * 0.7 + noise(px * 2 + 17, pz * 2 + 31) * 0.3;
  const t = Math.min(1, Math.max(0, (n - 0.38) / 0.42));
  return t * t * (3 - 2 * t);
}
