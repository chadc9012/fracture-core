/** Authored city buildings (scripts/build-buildings.py → public/models/buildings/*.glb). Metres, ground at y = 0, front
 * (lobby canopy) toward +Z, origin at the footprint centre. `radius` is the footprint's half-diagonal, used for
 * obstacles and spacing. Pure data so placement is testable. */
export type BuildingModelId =
  | "nexus-civic-a" | "nexus-civic-b" | "nexus-civic-c" | "nexus-terrace-a" | "nexus-terrace-b" | "nexus-spire"
  | "neon-tower-a" | "neon-tower-b" | "neon-tower-c" | "neon-block-a" | "neon-block-b";

export type BuildingModel = { id: BuildingModelId; url: string; w: number; d: number; height: number };

const b = (id: BuildingModelId, w: number, d: number, height: number): BuildingModel => ({ id, url: `/models/buildings/${id}.glb`, w, d, height });

export const BUILDING_MODELS: Record<BuildingModelId, BuildingModel> = {
  "nexus-civic-a": b("nexus-civic-a", 14, 12, 28),
  "nexus-civic-b": b("nexus-civic-b", 12, 12, 23),
  "nexus-civic-c": b("nexus-civic-c", 12, 10, 38),
  "nexus-terrace-a": b("nexus-terrace-a", 12, 9, 15),
  "nexus-terrace-b": b("nexus-terrace-b", 10, 10, 15),
  "nexus-spire": b("nexus-spire", 10, 10, 36),
  "neon-tower-a": b("neon-tower-a", 18, 16, 96),
  "neon-tower-b": b("neon-tower-b", 16, 16, 95),
  "neon-tower-c": b("neon-tower-c", 14, 12, 81),
  "neon-block-a": b("neon-block-a", 16, 12, 29),
  "neon-block-b": b("neon-block-b", 14, 14, 47),
};

export const footprintRadius = (m: BuildingModel) => Math.hypot(m.w, m.d) / 2;

/** The Nexus hub (October 2026 scale pass): one ring of civic towers round a life-size plaza. Inside it, from the centre out:
 * the walk-in storefronts (r about 7, regional-shops.ts), a pedestrian promenade (r 12.8-13.8) and the hub ring road (r 17, two lanes);
 * the towers stand at r 27 with their lobbies facing in, clear of the road and of the district blocks (from r 35). Evenly
 * spaced so no two footprints touch (the old three jittered rings overlapped each other, the shops and the road). */
export const NEXUS_HUB_RING = { r: 27, count: 9, models: ["nexus-civic-a", "nexus-spire", "nexus-civic-c", "nexus-civic-b", "nexus-terrace-b"] as BuildingModelId[] } as const;
export const NEXUS_HUB_ROAD_R = 17;
export const NEXUS_HUB_PROMENADE: readonly [number, number] = [12.8, 13.8];
/** spawn pad offset from the hub centre (Scene SPAWN): the tower in front of it is left out so the pad opens onto the plaza */
export const NEXUS_HUB_SPAWN = { x: 0, z: 22 } as const;

export type HubTower = { model: BuildingModelId; x: number; z: number; a: number; rot: number };
/** the hub towers in world coordinates around `c` (pure) */
export function nexusHubTowers(c: { x: number; z: number }): HubTower[] {
  const out: HubTower[] = [];
  const { r, count, models } = NEXUS_HUB_RING;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.17;
    const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
    if (Math.hypot(x - (c.x + NEXUS_HUB_SPAWN.x), z - (c.z + NEXUS_HUB_SPAWN.z)) < 14) continue;
    out.push({ model: models[i % models.length]!, x, z, a, rot: Math.atan2(-Math.cos(a), -Math.sin(a)) });
  }
  return out;
}
/** a lobby door on the plaza face of the hub tower nearest `bearing` (radians, atan2(z, x) from the centre) */
export function nexusHubLobby(c: { x: number; z: number }, bearing: number): { x: number; z: number } {
  const towers = nexusHubTowers(c);
  const ang = (t: HubTower) => Math.abs(Math.atan2(Math.sin(t.a - bearing), Math.cos(t.a - bearing)));
  const t = towers.reduce((best, q) => (ang(q) < ang(best) ? q : best), towers[0]!);
  const m = BUILDING_MODELS[t.model], rr = NEXUS_HUB_RING.r - Math.max(m.w, m.d) / 2 - 1.2;
  return { x: c.x + Math.cos(t.a) * rr, z: c.z + Math.sin(t.a) * rr };
}
