/** Distant mountain ridges on the horizon (owner's wilds target frame and sky board: ranges of mountains stand between the land and the
 * sky; the game's horizon was a flat line where the terrain ends). Two rings of ridgeline travel with the player like the sky dome, so
 * they are scenery that's never reached: a nearer, taller, darker range and a farther, paler one, both hazed toward the live horizon
 * colour. Pure profile data (tested); HorizonRidges.tsx draws it. */

export const RIDGES = {
  /** ring radii (m): inside the camera far plane (1800) */
  near: 1300, far: 1620,
  /** profile samples round the ring */
  samples: 360,
  /** ridge top heights above the base, metres: [min, max] per ring */
  nearHeight: [70, 260] as const, farHeight: [110, 380] as const,
  /** base height (world y) the ridges rise from, below the sea so no gap shows */
  base: -30,
} as const;

const hash = (n: number, seed: number) => { const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return v - Math.floor(v); };
/** smooth periodic value noise round the ring: `cells` lattice points per turn, so the profile wraps seamlessly */
function ringNoise(t: number, cells: number, seed: number): number {
  const x = t * cells, i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const a = hash(((i % cells) + cells) % cells, seed), b = hash((((i + 1) % cells) + cells) % cells, seed);
  return a + (b - a) * u;
}
/** ridged: sharp crests where the noise folds, the look of eroded mountain ridgelines rather than rolling hills */
function ridged(t: number, seed: number): number {
  let s = 0, amp = 0.55, cells = 7, norm = 0;
  for (let o = 0; o < 5; o++) { s += amp * (1 - Math.abs(ringNoise(t, cells, seed + o * 13) * 2 - 1)); norm += amp; amp *= 0.5; cells *= 2; }
  return s / norm;
}

/** the ridgeline heights (metres above the base) round one ring, `samples` values for angles 0..2π */
export function ridgeProfile(ring: "near" | "far", samples: number = RIDGES.samples): number[] {
  const [lo, hi] = ring === "near" ? RIDGES.nearHeight : RIDGES.farHeight, seed = ring === "near" ? 3 : 9;
  return Array.from({ length: samples }, (_, k) => {
    const t = k / samples;
    // a slow swell decides where the big massifs stand; the ridged term carves the crests
    const massif = ringNoise(t, 4, seed + 101);
    const h = Math.pow(ridged(t, seed), 1.6) * (0.45 + 0.55 * massif);
    return lo + (hi - lo) * Math.min(1, h * 1.25);
  });
}
