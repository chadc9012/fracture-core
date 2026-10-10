/**
 * Interior building system — enterable rooms inside city buildings, adapted from the pasted
 * "World-to-Interior Streaming System" spec to this project's real architecture. That spec's
 * own DoorTrigger/InteriorManager code contradicts its stated goal ("the city stays loaded,
 * you transition through doors seamlessly") by mounting a whole separate <Canvas> per interior
 * — a second WebGL context, camera and control rig, which is a scene *swap*, not a seamless
 * transition, and this codebase only ever has the one <Canvas> (GameCanvas.tsx) and one
 * continuous Scene/useFrame loop (see AGENTS.md). The seamless version of the same idea:
 * interiors are ordinary geometry in the SAME scene, parked as small rooms at a shared high
 * altitude far from the open world, and entering one is a position teleport, not a remount.
 * Door-proximity checks run inside Scene's existing per-frame loop rather than each interior
 * getting its own useFrame hook (the pasted DoorTrigger.tsx pattern) — one world, one loop.
 */
import { hourOf, scaleSite } from "./world";

export const INTERIOR_ALTITUDE = 600;
export const DOOR_RADIUS = 2.2;

export type InteriorKind = "APARTMENT" | "SHOP";

export type InteriorDef = {
  id: string;
  name: string;
  kind: InteriorKind;
  /** the open-world region this building sits in, for HUD/flavor only */
  regionId: string;
  /** real-world door position the player walks up to */
  doorPos: { x: number; z: number };
  /** this interior's room, parked at INTERIOR_ALTITUDE, far from every other interior and the open world */
  origin: { x: number; z: number };
  /** where the player lands just inside the door, relative to origin */
  spawnOffset: { x: number; z: number };
  /** the exit door's position inside the room, relative to origin — walk up to it to leave */
  exitOffset: { x: number; z: number };
  npcName?: string;
  /** SHOP only: vendor id from economy.ts's VENDORS, and the hours (0-24) it's actually open */
  vendorId?: string;
  openHour?: number;
  closeHour?: number;
};

export const INTERIORS: readonly InteriorDef[] = [
  {
    id: "nexus-apartment",
    name: "Warrens Apartment 4B",
    kind: "APARTMENT",
    regionId: "nexus",
    doorPos: scaleSite(62, -4),
    origin: { x: 2000, z: 0 },
    spawnOffset: { x: 0, z: -2.5 },
    exitOffset: { x: 0, z: 4 },
    npcName: "Mara, off-shift Vanguard tech",
  },
  {
    id: "nexus-scrap-market",
    name: "Scrap-Market Storefront",
    kind: "SHOP",
    regionId: "nexus",
    doorPos: scaleSite(98, 0),
    origin: { x: 2000, z: 60 },
    spawnOffset: { x: 0, z: -2.5 },
    exitOffset: { x: 0, z: 4 },
    npcName: "Scrap-Market broker",
    vendorId: "scrap",
    openHour: 7,
    closeHour: 23,
  },
  {
    id: "veridan-outpost",
    name: "Vanguard Outpost Alpha",
    kind: "APARTMENT",
    regionId: "veridan",
    doorPos: scaleSite(-40, -50),
    origin: { x: 2000, z: 120 },
    spawnOffset: { x: 0, z: -2.5 },
    exitOffset: { x: 0, z: 4 },
    npcName: "Vanguard field medic",
  },
  {
    id: "frostspire-shelter",
    name: "Summit Array Shelter",
    kind: "APARTMENT",
    regionId: "frostspire",
    doorPos: scaleSite(30, -110),
    origin: { x: 2000, z: 180 },
    spawnOffset: { x: 0, z: -2.5 },
    exitOffset: { x: 0, z: 4 },
    npcName: "Relay technician, half-frozen",
  },
  {
    id: "ember-bunker",
    name: "Caldera Survey Bunker",
    kind: "APARTMENT",
    regionId: "ember",
    doorPos: scaleSite(-40, 30),
    origin: { x: 2000, z: 240 },
    spawnOffset: { x: 0, z: -2.5 },
    exitOffset: { x: 0, z: 4 },
    npcName: "Survey engineer, off the caldera clock",
  },
  {
    id: "wastelands-tradepost",
    name: "Scrap-Outpost Alpha",
    kind: "SHOP",
    regionId: "wastelands",
    doorPos: scaleSite(25, 10),
    origin: { x: 2000, z: 300 },
    spawnOffset: { x: 0, z: -2.5 },
    exitOffset: { x: 0, z: 4 },
    npcName: "Black-Market runner",
    vendorId: "black",
    openHour: 6,
    closeHour: 22,
  },
  {
    id: "solara-waystation",
    name: "Solar Array Waystation",
    kind: "SHOP",
    regionId: "solara",
    doorPos: scaleSite(-5, 90),
    origin: { x: 2000, z: 360 },
    spawnOffset: { x: 0, z: -2.5 },
    exitOffset: { x: 0, z: 4 },
    npcName: "Faction Quarter liaison",
    vendorId: "faction",
    openHour: 6,
    closeHour: 20,
  },
  {
    id: "swamps-scavenger-hub",
    name: "Airboat Transit Hub",
    kind: "SHOP",
    regionId: "swamps",
    doorPos: scaleSite(75, 95),
    origin: { x: 2000, z: 420 },
    spawnOffset: { x: 0, z: -2.5 },
    exitOffset: { x: 0, z: 4 },
    npcName: "Scavenger settlement trader",
    vendorId: "singularity",
    openHour: 0,
    closeHour: 24,
  },
];

export function interiorById(id: string | null): InteriorDef | null {
  return id ? INTERIORS.find((i) => i.id === id) ?? null : null;
}

/** The interior whose door the player is standing in, if any (nearest within DOOR_RADIUS). */
export function doorAt(x: number, z: number): InteriorDef | null {
  let best: InteriorDef | null = null;
  let bestDist = DOOR_RADIUS;
  for (const interior of INTERIORS) {
    const d = Math.hypot(x - interior.doorPos.x, z - interior.doorPos.z);
    if (d < bestDist) { bestDist = d; best = interior; }
  }
  return best;
}

/** True while standing at the interior-side exit marker (relative to the interior's own origin). */
export function atExitMarker(interior: InteriorDef, localX: number, localZ: number): boolean {
  return Math.hypot(localX - interior.exitOffset.x, localZ - interior.exitOffset.z) < DOOR_RADIUS;
}

/** SHOP interiors keep real hours off the same day-cycle clock the HUD already shows; APARTMENTs are always open. */
export function isInteriorOpen(interior: InteriorDef, worldTime: number): boolean {
  if (interior.kind !== "SHOP" || interior.openHour === undefined || interior.closeHour === undefined) return true;
  const hour = hourOf(worldTime);
  return interior.openHour < interior.closeHour ? hour >= interior.openHour && hour < interior.closeHour : hour >= interior.openHour || hour < interior.closeHour;
}
