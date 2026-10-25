/** Raids are instances (pure). A raid is never on the world map and never starts by walking up to it: you launch it from the
 * director's Raid tab, the transit drops you into its arena (parked far outside the world disc), the boss wakes when you arrive,
 * and once it falls an exit pad sends you back to the transit terminal you would have used to leave the raid's home city.
 * Dying sends you to your last checkpoint in the world, as anywhere else; the raid resets when you leave it.
 * Future raids join RAID_INSTANCES with their own off-map site. */
import { HOLLOW_STAR_SITE } from "./hollow-star-site";
import { HOLLOW_STAR_ID } from "./hollow-star-data";
import { WORLD_RADIUS } from "./world";
import { TERMINALS, arrivalPoint } from "./travel";

export type RaidInstance = {
  id: string;
  name: string;
  /** the unique-scenarios.ts boss the arena wakes */
  scenarioId: string;
  site: { x: number; z: number; r: number };
  /** where the story says the raid is entered (shown in the Raid tab; never a place you can walk to) */
  entrance: string;
  /** the city whose transit terminal you come back out at */
  homeRegion: string;
};

export const RAID_INSTANCES: readonly RaidInstance[] = [
  { id: HOLLOW_STAR_ID, name: "The Hollow Star", scenarioId: "astravore", site: HOLLOW_STAR_SITE, entrance: "Nexus City · Subterranean Fracture", homeRegion: "nexus" },
];
export const raidById = (id: string) => RAID_INSTANCES.find((r) => r.id === id) ?? null;

/** the raid arena (x, z) is inside, if any: the whole arena disc plus a margin */
export const RAID_ZONE_MARGIN = 40;
export function raidAt(x: number, z: number): RaidInstance | null {
  return RAID_INSTANCES.find((r) => Math.hypot(x - r.site.x, z - r.site.z) < r.site.r + RAID_ZONE_MARGIN) ?? null;
}
/** you are held inside the arena's walkable disc (the pillars ring it; past them is open sea) */
export const ARENA_WALK_R = (r: RaidInstance) => r.site.r - 4;
export function clampToArena(r: RaidInstance, x: number, z: number): { x: number; z: number } {
  const dx = x - r.site.x, dz = z - r.site.z, d = Math.hypot(dx, dz), max = ARENA_WALK_R(r);
  return d <= max ? { x, z } : { x: r.site.x + (dx / d) * max, z: r.site.z + (dz / d) * max };
}
/** the transit drops you at the arena's edge, facing in */
export const raidArrival = (r: RaidInstance) => ({ x: r.site.x, z: r.site.z + r.site.r * 0.75 });
/** the exit pad (lit once the boss is down) beside where you arrived */
export const raidExitPad = (r: RaidInstance) => ({ x: r.site.x + 8, z: r.site.z + r.site.r * 0.75 });
export const EXIT_PAD_R = 3;
/** where the exit pad sends you: beside the home city's transit terminal */
export function raidReturn(r: RaidInstance): { x: number; z: number } {
  const t = TERMINALS.find((x) => x.regionId === r.homeRegion) ?? TERMINALS[0]!;
  return arrivalPoint(t);
}
/** every raid site lies outside the world disc (asserted in raid-instances.test.ts) */
export const offMap = (r: RaidInstance) => Math.hypot(r.site.x, r.site.z) - r.site.r - RAID_ZONE_MARGIN > WORLD_RADIUS * 1.5;
