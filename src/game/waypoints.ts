/** Map + HUD tracking: resource gathering sites, boss lairs and mission targets share one marker model. */
import { REGIONS } from "./world";
import { ENCOUNTERS } from "./encounters";
import type { MaterialId } from "./inventory";

export type MarkerKind = "MISSION" | "RESOURCE" | "BOSS";
export type Marker = { id: string; kind: MarkerKind; label: string; x: number; z: number; regionId: string; ready?: boolean };
export type TrackedMarker = Marker & { dist: number; bearing: number };

export const MARKER_COLOR: Record<MarkerKind, string> = { MISSION: "#ffd166", RESOURCE: "#4de3b0", BOSS: "#ff4d5e" };

const RESOURCE_BY_REGION: Record<string, MaterialId> = {
  veridan: "sporeFiber", ember: "thermalShards", wastelands: "scrapMetal", frostspire: "cryoCrystal",
  swamps: "bioCatalyst", nexus: "microCircuits", solara: "anomalyCarbon",
};
const RESOURCE_NAME: Partial<Record<MaterialId, string>> = {
  sporeFiber: "Spore bloom", thermalShards: "Thermal vent", scrapMetal: "Salvage pile", cryoCrystal: "Cryo geode",
  bioCatalyst: "Catalyst pod", microCircuits: "Circuit cache", anomalyCarbon: "Carbon seam",
};

export type ResourceSite = Marker & { material: MaterialId; amount: number };

/** Two deterministic gathering sites per region, placed on a ring inside the region. */
export const RESOURCE_SITES: ResourceSite[] = REGIONS.flatMap((region, index) => {
  const material = RESOURCE_BY_REGION[region.id] ?? "scrapMetal";
  return [0, 1].map((k) => {
    const a = index * 1.7 + k * Math.PI * 0.9;
    const r = region.radius * (0.45 + k * 0.2);
    return { id: `res-${region.id}-${k}`, kind: "RESOURCE" as const, label: RESOURCE_NAME[material] ?? "Resource node", x: region.x + Math.cos(a) * r, z: region.z + Math.sin(a) * r, regionId: region.id, material, amount: 2 };
  });
});

/** One boss lair per hostile region; entering the lair triggers the encounter (or press B inside the region). */
export const BOSS_LAIRS: Marker[] = ENCOUNTERS.flatMap((entry) => {
  const region = REGIONS.find((r) => r.id === entry.regionId);
  if (!entry.boss || !region || region.kind === "safe") return [];
  return [{ id: `boss-${region.id}`, kind: "BOSS" as const, label: entry.boss.name, x: region.x - region.radius * 0.35, z: region.z + region.radius * 0.3, regionId: region.id }];
});

export const GATHER_RADIUS = 4.5;
export const RESPAWN_SECONDS = 90;
export const LAIR_RADIUS = 10;

/** Distance + bearing relative to the player's facing (radians, 0 = straight ahead, + = right). */
export function track(markers: Marker[], x: number, z: number, yaw: number): TrackedMarker[] {
  return markers.map((m) => {
    const dx = m.x - x, dz = m.z - z;
    let bearing = Math.atan2(dx, dz) - yaw;
    bearing = Math.atan2(Math.sin(bearing), Math.cos(bearing));
    return { ...m, dist: Math.hypot(dx, dz), bearing: -bearing };
  }).sort((a, b) => a.dist - b.dist);
}

export const regionCenter = (id: string) => { const r = REGIONS.find((entry) => entry.id === id); return r ? { x: r.x, z: r.z } : null; };
