/** The Destination Director (the world-map screen): every place you can pick — the seven regions plus the cities that
 * sit inside or beside them (Neon City beside Nexus, Thalassia offshore in the Swamps) — and, for one destination,
 * the activities and discovered dungeon sites that belong to it. Pure, so the screen and the tests agree.
 *
 * A city borrows its parent region's activity list (missions, patrols and bosses keep their real owner and rules) and
 * keeps only what stands inside the city; the parent region then leaves those out, so Neon City and Nexus never list
 * the same thing twice. Dungeon-like sites (ruins, hazards) appear only once discovered — no name, marker or "?" before. */
import { REGIONS, NEON_FLAT, type ZoneKind } from "./world";
import { CITY_DESTINATIONS } from "./destinations";
import { CITY_RADIUS } from "./thalassia-sectors";
import { LANDMARKS, isLandmarkKnown, type Landmark } from "./landmarks";
import { regionActivities, type Activity, type ActivityKind } from "./map-activities";
import type { PlayerProgression } from "./progression";

export type Destination = {
  id: string; name: string; sub: string; kind: ZoneKind; x: number; z: number;
  /** region whose activities and rules apply */
  regionId: string;
  /** cities only: how far the city reaches (m) */
  reach?: number;
  city: boolean; difficulty?: number; accent?: string;
};

const CITY_REACH: Record<string, () => number> = { "neon-city": () => NEON_FLAT + 25, thalassia: () => CITY_RADIUS + 40 };

export const DESTINATIONS: readonly Destination[] = [
  ...REGIONS.map((r) => ({ id: r.id, name: r.name, sub: r.sub, kind: r.kind, x: r.x, z: r.z, regionId: r.id, city: false, difficulty: r.difficulty, accent: r.accent })),
  ...CITY_DESTINATIONS.map((c) => ({ id: c.id, name: c.name, sub: c.sub, kind: c.kind, x: c.x, z: c.z, regionId: c.regionId, city: true, reach: CITY_REACH[c.id]?.() ?? 100 })),
];

export const destinationById = (id: string) => DESTINATIONS.find((d) => d.id === id);
const inside = (d: Destination, x: number, z: number) => d.reach !== undefined && Math.hypot(x - d.x, z - d.z) <= d.reach;
const citiesOf = (regionId: string) => DESTINATIONS.filter((d) => d.city && d.regionId === regionId);

/** the activities of one destination: a city keeps its parent region's activities inside it; a region drops those */
export function destinationActivities(p: PlayerProgression, d: Destination, now = Date.now()): Activity[] {
  const all = regionActivities(p, d.regionId, now);
  if (d.city) return all.filter((a) => inside(d, a.x, a.z));
  const cities = citiesOf(d.id);
  return all.filter((a) => !cities.some((c) => inside(c, a.x, a.z)));
}

/** filter chips, in display order; BOSS also covers nemeses, OTHER whatever is left (contracts, stashes, resources...) */
export const DIRECTOR_FILTERS = ["ALL", "STORY", "PATROL", "SAFE_ZONE", "BOSS", "OTHER"] as const;
export type DirectorFilter = (typeof DIRECTOR_FILTERS)[number];
export const FILTER_LABEL: Record<DirectorFilter, string> = { ALL: "All", STORY: "Story", PATROL: "Patrols", SAFE_ZONE: "Safe zones", BOSS: "Bosses", OTHER: "Other" };
const NAMED: ActivityKind[] = ["STORY", "PATROL", "SAFE_ZONE", "BOSS", "NEMESIS"];
export function matchesFilter(a: Activity, f: DirectorFilter): boolean {
  if (f === "ALL") return true;
  if (f === "BOSS") return a.kind === "BOSS" || a.kind === "NEMESIS";
  if (f === "OTHER") return !NAMED.includes(a.kind);
  return a.kind === f;
}

const DUNGEON_TYPES = new Set<Landmark["type"]>(["ruin", "hazard"]);
/** ruins and hazards of this destination that the player has discovered (cities: those inside it; regions: the rest) */
export function discoveredSites(p: Pick<PlayerProgression, "earnedRewards">, d: Destination): Landmark[] {
  return LANDMARKS.filter((l) => {
    if (!DUNGEON_TYPES.has(l.type) || !isLandmarkKnown(p, l.id)) return false;
    if (d.city) return inside(d, l.x, l.z);
    return l.regionId === d.id && !citiesOf(d.id).some((c) => inside(c, l.x, l.z));
  });
}
