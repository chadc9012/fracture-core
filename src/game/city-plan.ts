/** The plan of a city for its destination map (reference: the city maps' lit street blocks): every footprint the game
 * builds there, from the same layout the world uses, so the map always matches the streets you walk. Pure.
 *  - Nexus City: the four districts' tower blocks (nexus-districts.ts), plus the residential street to the south
 *  - Neon City: the tower grid (neon-layout.ts) and its walk-in homes
 *  - both: shop counters and the garages of the walk-in homes
 *  - Thalassia: the dome rings and the dock (thalassia-sectors.ts), drawn as rings */
import { buildings } from "./nexus-districts";
import { neonLayoutWorld, TOWER_FOOTPRINT } from "./neon-layout";
import { footprint, garageRect, neonKeepOut, residences } from "./residences";
import { REGIONAL_SHOPS } from "./regional-shops";
import { THALASSIA_CENTER } from "./thalassia-site";
import { CITY_RADIUS, CORE, DOCK, RING } from "./thalassia-sectors";
import type { Destination } from "./destination-director";

export type PlanKind = "tower" | "home" | "garage" | "shop";
export type PlanRect = { x: number; z: number; hx: number; hz: number; kind: PlanKind; /** 0..1 how tall, for the shading */ h: number; /** turned this much (radians, like the world: about +y) */ yaw?: number };
export type PlanRing = { x: number; z: number; r: number; kind: "dome" | "ring" | "dock" };
export type CityPlan = { rects: PlanRect[]; rings: PlanRing[] };

const within = (d: Destination, x: number, z: number, reach: number) => Math.hypot(x - d.x, z - d.z) <= reach;

const cache = new Map<string, CityPlan>();
/** the plan of everything built inside `reach` metres of the destination (empty for open regions) */
export function cityPlan(d: Destination, reach: number): CityPlan {
  const key = `${d.id}@${Math.round(reach)}`, hit = cache.get(key);
  if (hit) return hit;
  const rects: PlanRect[] = [], rings: PlanRing[] = [];
  if (d.id === "nexus") for (const b of buildings()) rects.push({ x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2, kind: "tower", h: Math.min(1, (b.top - b.base) / 120), yaw: b.yaw });
  if (d.id === "neon-city") for (const t of neonLayoutWorld(neonKeepOut()).towers) { const [hx, hz] = TOWER_FOOTPRINT[t.variant]; rects.push({ x: t.x, z: t.z, hx: t.rot % 2 ? hz : hx, hz: t.rot % 2 ? hx : hz, kind: "tower", h: 0.8 }); }
  if (d.id === "thalassia") {
    const c = THALASSIA_CENTER;
    rings.push({ x: c.x, z: c.z, r: CITY_RADIUS, kind: "dome" }, { x: c.x, z: c.z, r: RING.outer, kind: "ring" }, { x: c.x, z: c.z, r: RING.inner, kind: "ring" }, { x: c.x, z: c.z, r: CORE.r * 0.6, kind: "ring" }, { x: c.x + DOCK.dx, z: c.z + DOCK.dz, r: DOCK.r, kind: "dock" });
  }
  if (d.id === "nexus" || d.id === "neon-city") {
    for (const r of residences()) {
      if (!within(d, r.x, r.z, reach)) continue;
      rects.push({ x: r.x, z: r.z, ...footprint(r), kind: "home", h: 0.3 });
      if (r.garage) rects.push({ ...garageRect(r.garage), kind: "garage", h: 0.15 });
    }
    for (const s of REGIONAL_SHOPS) if (within(d, s.x, s.z, reach)) rects.push({ x: s.x, z: s.z, hx: 2.2, hz: 2.2, kind: "shop", h: 0.1 });
  }
  const plan = { rects: rects.filter((r) => within(d, r.x, r.z, reach)), rings };
  cache.set(key, plan);
  return plan;
}
