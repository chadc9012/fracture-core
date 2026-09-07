/* ------------------------------------------------------------------
 * WORLD SIMULATION OPTIMIZATION LAYER
 *
 * "Simulate everything — but not equally."
 * Every entity gets a simulation tier from its distance to the player.
 * Tier 0 keeps full fidelity (combat is never approximated), tiers 1–3
 * degrade to simplified AI, abstract movement and stubbed state.
 * ------------------------------------------------------------------ */

export type SimTier = 0 | 1 | 2 | 3;

/** tier radii in world units */
export const TIER_RADII = { full: 60, high: 220, low: 900 };

export function getSimulationTier(ex: number, ez: number, px: number, pz: number): SimTier {
  const dist = Math.hypot(ex - px, ez - pz);
  if (dist < TIER_RADII.full) return 0;
  if (dist < TIER_RADII.high) return 1;
  if (dist < TIER_RADII.low) return 2;
  return 3;
}

/** tier 0/1 run every tick; tier 2 every 4th; tier 3 every 16th */
export function shouldTick(tier: SimTier, frame: number): boolean {
  if (tier <= 1) return true;
  if (tier === 2) return frame % 4 === 0;
  return frame % 16 === 0;
}

/** accumulated dt for a throttled entity, so slow ticks still move correctly */
export function tierDt(tier: SimTier, dt: number): number {
  if (tier <= 1) return dt;
  return tier === 2 ? dt * 4 : dt * 16;
}

/** cheap dead-reckoning for entities we are not really simulating */
export function predictPosition(
  e: { x: number; z: number; rot: number },
  speed: number,
  timeDelta: number,
) {
  return {
    x: e.x + Math.sin(e.rot) * speed * timeDelta,
    z: e.z + Math.cos(e.rot) * speed * timeDelta,
  };
}

export type SimStats = {
  frame: number;
  /** entities counted per tier this frame */
  tiers: [number, number, number, number];
  /** entities that actually ran a tick this frame */
  ticked: number;
  /** entities skipped by throttling or dormancy */
  skipped: number;
  dormant: number;
  /** entities inside the player's interest set */
  relevant: number;
  /** ms spent in the last stepSim call */
  stepMs: number;
  /** rolling average of stepMs */
  avgMs: number;
  /** per-region entity load, used for the load-distribution readout */
  regionLoad: Record<string, number>;
  /** regions flagged for offload to a worker slice */
  offloaded: string[];
};

export function createStats(): SimStats {
  return {
    frame: 0,
    tiers: [0, 0, 0, 0],
    ticked: 0,
    skipped: 0,
    dormant: 0,
    relevant: 0,
    stepMs: 0,
    avgMs: 0,
    regionLoad: {},
    offloaded: [],
  };
}

export function beginStats(stats: SimStats) {
  stats.frame++;
  stats.tiers = [0, 0, 0, 0];
  stats.ticked = 0;
  stats.skipped = 0;
  stats.dormant = 0;
  stats.relevant = 0;
  stats.regionLoad = {};
}

export function countEntity(stats: SimStats, tier: SimTier, ticked: boolean, regionId?: string) {
  stats.tiers[tier]++;
  if (ticked) stats.ticked++;
  else stats.skipped++;
  if (tier <= 1) stats.relevant++;
  if (regionId) stats.regionLoad[regionId] = (stats.regionLoad[regionId] ?? 0) + 1;
}

/** region-based load distribution: flag the hottest regions for offload */
export function endStats(stats: SimStats, ms: number, offloadThreshold = 12) {
  stats.stepMs = ms;
  stats.avgMs = stats.avgMs === 0 ? ms : stats.avgMs * 0.9 + ms * 0.1;
  stats.offloaded = Object.entries(stats.regionLoad)
    .filter(([, load]) => load >= offloadThreshold)
    .map(([id]) => id);
}

/** compressed far-entity state — what the world keeps when it stops simulating */
export function compressEntity(e: { x: number; z: number }, id: string, state: string) {
  return { id, x: Math.round(e.x), z: Math.round(e.z), state };
}
