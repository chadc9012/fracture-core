/** Dust kicked up by ground vehicles (owner's wilds target frame: the convoy truck trails a golden dust cloud down the road). Pure rules:
 * how much dust a vehicle raises where it is, and the colour of that region's dust. DustTrails.tsx runs the particles. */
import { distanceToRoad } from "./lanes";
import { ROAD_HALF } from "./road-ribbon";

/** dust colour per dry region (sRGB hex); other regions raise none */
export const DUST_TINT: Readonly<Record<string, string>> = { wastelands: "#e2c08c", solara: "#ecd6ad", ember: "#9a8e88" }; // sunlit dust reads lighter than the ground it rises from

export const DUST = {
  /** below this speed (m/s) nothing rises */
  minSpeed: 3,
  /** particles per second per m/s above the threshold, and the cap */
  perSpeed: 1.6, maxRate: 34,
  /** a paved road raises much less than dirt or open ground */
  pavedFactor: 0.25,
  /** particle life (s) and growth (m of diameter at birth and at death) */
  life: 3.2, sizeStart: 1.6, sizeEnd: 9,
} as const;

/** particles per second a vehicle at (x,z) moving at `speed` m/s raises, given the region it is in */
export function dustRate(regionId: string | undefined, speed: number, x: number, z: number, paved: (x: number, z: number) => boolean = onRoad): number {
  if (!regionId || !DUST_TINT[regionId] || speed < DUST.minSpeed) return 0;
  const r = Math.min(DUST.maxRate, (speed - DUST.minSpeed) * DUST.perSpeed + 2);
  return paved(x, z) ? r * DUST.pavedFactor : r;
}
const onRoad = (x: number, z: number) => distanceToRoad(x, z) < ROAD_HALF;

/** a particle's opacity over its life (0..1 of life): quick to appear, long soft fade */
export function dustAlpha(k: number): number {
  if (k <= 0 || k >= 1) return 0;
  return Math.min(1, k / 0.12) * Math.pow(1 - k, 1.4);
}
