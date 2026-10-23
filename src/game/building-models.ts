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

/** the Nexus hub's three rings (inner civic towers, mid terraces and civic blocks, outer terraces), replacing the old kit blocks */
export const NEXUS_HUB_RINGS: { r: number; count: number; models: BuildingModelId[] }[] = [
  { r: 13, count: 6, models: ["nexus-civic-a", "nexus-spire", "nexus-civic-c"] },
  { r: 19.5, count: 9, models: ["nexus-civic-b", "nexus-terrace-b", "nexus-civic-a"] },
  { r: 25, count: 12, models: ["nexus-terrace-a", "nexus-terrace-b", "nexus-civic-b"] },
];
