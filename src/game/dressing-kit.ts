/** Shared placement rules for region dressing passes (pure). A region pass declares its keep-out circles once and gets a
 * seeded, gap-respecting scatter that never lands on roads, water (unless asked), or outside the region. */
import { REGIONS } from "./world";
import { STUNT_PARK } from "./stunt-park";
import { heightAt, riverAt, slopeAt, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { mulberry32 } from "./rng";
import { LANDMARKS } from "./landmarks";
import { HAZARD_ZONES } from "./hazard-zones";
import { isWet, lakeSurfaceAt } from "./wildlife-habitat";
import { SCENARIO_LAIRS } from "./waypoints";
import { ZONE_MISSIONS, zoneSite } from "./missions/zone-missions";

export type Prop = { x: number; z: number; s: number; r: number; tilt: number };
export type Circle = { x: number; z: number; r: number };

export const regionById = (id: string) => REGIONS.find((r) => r.id === id)!;
export const landmark = (id: string) => LANDMARKS.find((l) => l.id === id)!;
/** keep-out circle around a hazard zone's anchor (by kind), padded */
export function zoneCircle(kind: (typeof HAZARD_ZONES)[number]["kind"], pad = 6): Circle {
  const z = HAZARD_ZONES.find((h) => h.kind === kind)!, l = landmark(z.landmarkId);
  return { x: l.x, z: l.z, r: z.radius + pad };
}

export type PlaceRules = { region: string; keepOut: () => Circle[]; water?: "avoid" | "allow" | "require"; edge?: number };

export function placeable(rules: PlaceRules, x: number, z: number, clear = 3): boolean {
  const r = regionById(rules.region);
  if (Math.hypot(x - r.x, z - r.z) > r.radius * (rules.edge ?? 0.95)) return false;
  const wet = heightAt(x, z) < WATER_LEVEL + 0.4 || isWet(x, z);
  const water = rules.water ?? "avoid";
  if (water === "avoid" && wet) return false;
  if (water === "require" && waterSurface(x, z) === null) return false;
  if (distanceToRoad(x, z) < LANE_HALF_WIDTH + clear) return false;
  return rules.keepOut().every((k) => Math.hypot(x - k.x, z - k.z) > k.r + clear);
}

export type ScatterOpts = { inner: number; outer: number; maxSlope: number; gap: number; clear?: number; around?: { x: number; z: number }; minH?: number; maxH?: number };
export function scatter(rules: PlaceRules, count: number, seed: number, o: ScatterOpts): Prop[] {
  const r = regionById(rules.region), c = o.around ?? r, rnd = mulberry32(seed), out: Prop[] = [];
  for (let guard = count * 30; out.length < count && guard-- > 0;) {
    const a = rnd() * Math.PI * 2, d = o.inner + Math.sqrt(rnd()) * (o.outer - o.inner);
    const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    if (!placeable(rules, x, z, o.clear ?? 3) || slopeAt(x, z) > o.maxSlope) continue;
    const h = heightAt(x, z);
    if ((o.minH !== undefined && h < o.minH) || (o.maxH !== undefined && h > o.maxH)) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < o.gap)) continue;
    out.push({ x, z, s: 0.7 + rnd() * 0.8, r: rnd() * Math.PI * 2, tilt: (rnd() - 0.5) * 0.2 });
  }
  return out;
}

/** a few props clustered tightly around each anchor (camps, junk heaps, groves) */
export function clusters(rules: PlaceRules, anchors: readonly Prop[], per: number, radius: number, seed: number, gap = 1.5): Prop[][] {
  const rnd = mulberry32(seed);
  return anchors.map((a) => {
    const out: Prop[] = [];
    for (let guard = per * 20; out.length < per && guard-- > 0;) {
      const ang = rnd() * Math.PI * 2, d = rnd() * radius, x = a.x + Math.cos(ang) * d, z = a.z + Math.sin(ang) * d;
      if (!placeable(rules, x, z, 0)) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < gap)) continue;
      out.push({ x, z, s: 0.7 + rnd() * 0.6, r: rnd() * Math.PI * 2, tilt: (rnd() - 0.5) * 0.2 });
    }
    return out;
  });
}

/** fights happen at mission sites and boss lairs: keep their arenas open in every region */
export function arenaCircles(region: string, r = 30): Circle[] {
  const reg = regionById(region);
  const lairs = SCENARIO_LAIRS.filter((l) => l.regionId === region).map((l) => ({ x: l.x, z: l.z, r }));
  const sites = Object.values(ZONE_MISSIONS).filter((m) => m.regionId === region).map((m) => ({ ...zoneSite(m, reg), r }));
  // the Wastelands stunt park's yard (stunt-park.ts) stays clear of ruins, junk and rocks
  const park = region === "wastelands" ? [{ x: STUNT_PARK.x, z: STUNT_PARK.z, r: Math.hypot(STUNT_PARK.length, STUNT_PARK.width) / 2 + 8 }] : [];
  return [...lairs, ...sites, ...park];
}

/** the height of whatever water is at (x,z): a lake's level, a river's surface, or the sea; null on dry ground */
export function waterSurface(x: number, z: number): number | null {
  const lake = lakeSurfaceAt(x, z);
  if (lake !== null) return lake;
  const rv = riverAt(x, z);
  if (rv && rv.dist < rv.w) return rv.s;
  return heightAt(x, z) < WATER_LEVEL ? WATER_LEVEL : null;
}
