/** The Destination Director (the world-map screen): every place you can pick — the seven regions plus the cities that
 * sit inside or beside them (Neon City beside Nexus, Thalassia offshore in the Swamps) — and, for one destination,
 * the activities and discovered dungeon sites that belong to it. Pure, so the screen and the tests agree.
 *
 * A city borrows its parent region's activity list (missions, patrols and bosses keep their real owner and rules) and
 * keeps only what stands inside the city; the parent region then leaves those out, so Neon City and Nexus never list
 * the same thing twice. Dungeon-like sites (ruins, hazards) appear only once discovered — no name, marker or "?" before. */
import { SITE_STYLE, sitesIn } from "./region-atlas";
import { REGIONS, NEON_FLAT, type ZoneKind } from "./world";
import { CITY_DESTINATIONS } from "./destinations";
import { CITY_RADIUS } from "./thalassia-sectors";
import { LANDMARKS, isLandmarkKnown, type Landmark } from "./landmarks";
import { regionActivities, type Activity, type ActivityKind } from "./map-activities";
import type { PlayerProgression } from "./progression";
import { NEON_DISTRICTS } from "./neon-districts";
import { NEON_SITE, NEXUS_SUBURB } from "./world";
import { NEXUS, CITY_INNER, CITY_OUTER } from "./nexus-districts";
import { THALASSIA_CENTER } from "./thalassia-site";
import { DOCK, RING, CORE } from "./thalassia-sectors";
import { REGIONAL_SHOPS, type RegionalShop } from "./regional-shops";
import { GARAGES, FLEET, type FleetEntry, type GarageId } from "./fleet";
import { HOMES, type HomeDef } from "./housing";
import { residences, type Residence } from "./residences";

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

/* ------------------------------------------------------------------ city services: districts, shops, homes, vehicles
 * Everything here is the game's real data — the walk-up shops (regional-shops.ts), the homes the property agent sells
 * (housing.ts, paid in Nex), the bases and fleet vehicles (fleet.ts, paid in materials) and the walk-in residences — so
 * what the Director lists is exactly what exists and can be bought in the world. */

export type CityDistrict = { id: string; name: string; tagline: string; x: number; z: number; r: number; color: string; /** map glyph (region-atlas.ts SITE_STYLE) */ glyph?: string };

/** the board's named places for this destination (region-atlas.ts), as map districts */
function atlasDistricts(regionId: string): CityDistrict[] {
  return sitesIn(regionId).map((s) => ({ id: `atlas-${s.id}`, name: s.name, tagline: s.blurb, x: s.x, z: s.z, r: s.radius, color: SITE_STYLE[s.kind].color, glyph: SITE_STYLE[s.kind].glyph }));
}

/** the named districts of a city destination (Nexus City is the nexus region's city) */
export function cityDistricts(d: Destination): CityDistrict[] {
  if (d.id === "neon-city") return [...NEON_DISTRICTS.map((n) => ({ id: n.id, name: n.name, tagline: n.tagline, x: NEON_SITE.x + n.dx, z: NEON_SITE.z + n.dz, r: n.radius, color: n.color })), ...atlasDistricts("neon")];
  if (d.id === "thalassia") {
    const c = THALASSIA_CENTER;
    return [
      { id: "sentry-dock", name: "Sentry Dock", tagline: "Airlock berth · the only dry deck", x: c.x + DOCK.dx, z: c.z + DOCK.dz, r: DOCK.r, color: "#7ef2ff" },
      { id: "abyssal-ring", name: "Abyssal Ring", tagline: "Containment · electrified coolant floor", x: c.x, z: c.z - (RING.inner + RING.outer) / 2, r: (RING.outer - RING.inner) / 2 + 4, color: "#b98cff" },
      { id: "sunk-core", name: "Sunk-Core", tagline: "The deep trench · crush depth", x: c.x, z: c.z, r: CORE.r * 0.6, color: "#ff6b8a" },
      ...atlasDistricts("thalassia"),
    ];
  }
  if (d.id === "nexus") {
    const mid = (CITY_INNER + CITY_OUTER) / 2;
    // districts are compass quarters of the city (nexus-districts.ts districtAt: north = world -z)
    const q = (id: string, name: string, tagline: string, ang: number, color: string): CityDistrict => ({ id, name, tagline, x: NEXUS.x + Math.sin(ang) * mid, z: NEXUS.z - Math.cos(ang) * mid, r: (CITY_OUTER - CITY_INNER) / 2, color });
    return [
      q("spire", "Capital District", "Council towers and the command core", 0, "#9fd4ff"),
      q("market", "Business District", "Trading floors, shops and vendors", Math.PI / 2, "#ffd166"),
      q("shipyard", "Harbor District", "Shipyards, freight yards and hangars", Math.PI, "#c9b089"),
      q("arcology", "Residential Heights", "Terraced housing and garden towers", -Math.PI / 2, "#7ef2b0"),
      { id: "residential", name: "Residential Street", tagline: "Walk-in homes south of the city", x: NEXUS_SUBURB.x, z: NEXUS_SUBURB.z, r: NEXUS_SUBURB.r, color: "#e8c39e" },
    ];
  }
  return d.city ? [] : atlasDistricts(d.id);
}

/** the region a point is relatively nearest to (distance in units of each region's radius), so sites in the wilds
 * between regions are still listed once, under the region they lean toward */
const ownerRegion = (x: number, z: number) => REGIONS.reduce((best, r) => (Math.hypot(x - r.x, z - r.z) / r.radius < Math.hypot(x - best.x, z - best.z) / best.radius ? r : best), REGIONS[0]!).id;
/** a point belongs to a destination: a city by its reach; a region when it is that region's (and none of its cities') */
function belongs(d: Destination, x: number, z: number): boolean {
  if (d.city) return inside(d, x, z);
  if (DESTINATIONS.some((c) => c.city && inside(c, x, z))) return false;
  return ownerRegion(x, z) === d.id;
}

/** the destination a world point belongs to: a city when it stands inside one, otherwise the region it leans toward */
export function destinationAt(x: number, z: number): Destination | undefined {
  return DESTINATIONS.find((d) => d.city && inside(d, x, z)) ?? DESTINATIONS.find((d) => !d.city && d.id === ownerRegion(x, z));
}

export const destinationShops = (d: Destination): RegionalShop[] => REGIONAL_SHOPS.filter((s) => belongs(d, s.x, s.z));
export const destinationGarages = (d: Destination): GarageId[] => (Object.values(GARAGES)).filter((g) => belongs(d, g.x, g.z)).map((g) => g.id);
/** fleet vehicles sold at this destination's bases */
export const destinationFleet = (d: Destination): FleetEntry[] => { const gs = destinationGarages(d); return FLEET.filter((f) => gs.includes(f.garage)); };
/** homes the property agent sells here: Neon City's districts (housing.ts lists them under the nexus region) belong to Neon */
const NEON_HOME = /rust-muck|the grid|aegis/i;
export function destinationHomes(d: Destination): HomeDef[] {
  if (d.id === "neon-city") return HOMES.filter((h) => NEON_HOME.test(h.district));
  if (d.city) return [];
  return HOMES.filter((h) => h.regionId === d.id && !(d.id === "nexus" && NEON_HOME.test(h.district)));
}
/** the walk-in residences standing in this destination (residences.ts) */
export const destinationResidences = (d: Destination): Residence[] => residences().filter((r) => belongs(d, r.x, r.z));

/** the headline numbers for a destination card (reference: Destiny's destination summary) */
export type DestinationSummary = { story: number; patrols: number; safeZones: number; bosses: number; other: number; dungeonsFound: number; dungeonsTotal: number; shops: number; homes: number; vehicles: number };
export function destinationSummary(p: PlayerProgression, d: Destination): DestinationSummary {
  const acts = destinationActivities(p, d);
  const n = (f: DirectorFilter) => acts.filter((a) => matchesFilter(a, f)).length;
  const all = LANDMARKS.filter((l) => DUNGEON_TYPES.has(l.type) && (d.city ? inside(d, l.x, l.z) : l.regionId === d.id && !citiesOf(d.id).some((c) => inside(c, l.x, l.z))));
  return { story: n("STORY"), patrols: n("PATROL"), safeZones: n("SAFE_ZONE"), bosses: n("BOSS"), other: n("OTHER"), dungeonsFound: discoveredSites(p, d).length, dungeonsTotal: all.length,
    shops: destinationShops(d).length, homes: destinationHomes(d).length + destinationResidences(d).length, vehicles: destinationFleet(d).length };
}
