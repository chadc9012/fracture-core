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
import { REGIONS, hourOf, scaleSite } from "./world";
import { HOMES } from "./housing";
import { REGIONAL_SHOPS } from "./regional-shops";
import { shopAccessKind } from "./shop-access";

export const INTERIOR_ALTITUDE = 600;
export const DOOR_RADIUS = 2.2;

export type InteriorKind = "APARTMENT" | "SHOP" | "HOME";
/** HOME interiors: one 10m room per entry in the home's rooms list, laid side by side along +X with doorways */
export const HOME_ROOM_SIZE = 10;

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
  /** HOME only: housing.ts home id; the door only opens for its owner */
  homeId?: string;
  /** SHOP only: vendor id from economy.ts's VENDORS, and the hours (0-24) it's actually open */
  vendorId?: string;
  /** Existing regional stock identity; never a new economy. */
  shopId?: string;
  openHour?: number;
  closeHour?: number;
};

export const INTERIORS: InteriorDef[] = [
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
  {
    id: "neon-property-office",
    name: "Veyra Realty Office",
    kind: "APARTMENT",
    regionId: "nexus",
    doorPos: scaleSite(80, -14),
    origin: { x: 2000, z: 480 },
    spawnOffset: { x: 0, z: -2.5 },
    exitOffset: { x: 0, z: 4 },
    npcName: "Veyra Realty agent",
  },
];

/** Regional storefronts share their original stock and price gates. */
export const SHOP_INTERIORS: readonly InteriorDef[] = REGIONAL_SHOPS.filter((s) => shopAccessKind(s.id) === "interior").map((s, i) => ({
  id: `store-${s.id}`, name: s.name, kind: "SHOP" as const,
  regionId: s.id.startsWith("neon") || s.id.startsWith("nexus") ? "nexus" : s.id.startsWith("frost") ? "frostspire" : s.id.startsWith("ember") ? "ember" : s.id.startsWith("veridan") ? "veridan" : s.id.startsWith("swamp") ? "swamps" : s.id.startsWith("solara") ? "solara" : "wastelands",
  doorPos: { x: s.x, z: s.z + 3 }, origin: { x: 2800, z: i * 60 },
  spawnOffset: { x: 0, z: 1.5 }, exitOffset: { x: 0, z: 4 },
  npcName: `${s.name} specialist`, shopId: s.id,
}));
INTERIORS.push(...SHOP_INTERIORS);

/** Where each buyable home's front door sits in the open world (Neon homes by district, others near their region). */
const HOME_DOORS: Record<string, { x: number; z: number }> = {
  "rustmuck-capsule": scaleSite(-70, -6),
  "grid-loft": scaleSite(70, 30),
  "aegis-penthouse": scaleSite(10, -70),
};
function homeDoor(id: string, regionId: string, i: number) {
  if (HOME_DOORS[id]) return HOME_DOORS[id];
  const r = REGIONS.find((x) => x.id === regionId) ?? REGIONS[0]!;
  return { x: r.x + 18 + i * 3, z: r.z + 14 };
}
export const HOME_INTERIORS: readonly InteriorDef[] = HOMES.map((h, i) => ({
  id: `home-${h.id}`,
  name: h.name,
  kind: "HOME" as const,
  regionId: h.regionId,
  doorPos: homeDoor(h.id, h.regionId, i),
  origin: { x: 2400, z: i * 80 },
  spawnOffset: { x: 0, z: 2 },
  exitOffset: { x: 0, z: 4 },
  homeId: h.id,
}));
INTERIORS.push(...HOME_INTERIORS);

/** Keeps the player inside a HOME's rooms: outer walls, and internal walls crossable only through the doorway (|z| < 1.2). */
export function clampHomeLocal(interior: InteriorDef, rooms: number, x: number, z: number, prevX: number): { x: number; z: number } {
  const half = HOME_ROOM_SIZE / 2 - 0.4;
  let nx = Math.max(-half, Math.min((rooms - 1) * HOME_ROOM_SIZE + half, x));
  const nz = Math.max(-half, Math.min(half, z));
  if (Math.abs(nz) > 1.2) {
    // crossing an internal wall at x = k*10 + 5 outside the doorway snaps back to the previous room
    const wall = (v: number) => Math.floor((v + HOME_ROOM_SIZE / 2) / HOME_ROOM_SIZE);
    if (wall(nx) !== wall(prevX)) nx = prevX;
  }
  void interior;
  return { x: nx, z: nz };
}

export function interiorById(id: string | null): InteriorDef | null {
  return id ? INTERIORS.find((i) => i.id === id) ?? null : null;
}

/** The interior whose door the player is standing in, if any (nearest within DOOR_RADIUS). */
export function doorAt(x: number, z: number, canEnter: (i: InteriorDef) => boolean = () => true): InteriorDef | null {
  let best: InteriorDef | null = null;
  let bestDist = DOOR_RADIUS;
  for (const interior of INTERIORS) {
    const d = Math.hypot(x - interior.doorPos.x, z - interior.doorPos.z);
    if (d < bestDist && canEnter(interior)) { bestDist = d; best = interior; }
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

/** Where the player stands after leaving: the spot they entered from, pushed just outside the door radius. Without this the
 * return position is inside the door trigger and the next frame walks the player straight back in. */
export function exitPosition(doorPos: { x: number; z: number }, back: { x: number; z: number }, margin = 1): { x: number; z: number } {
  const dx = back.x - doorPos.x, dz = back.z - doorPos.z;
  const d = Math.hypot(dx, dz);
  const need = DOOR_RADIUS + margin;
  if (d >= need) return { x: back.x, z: back.z };
  if (d < 1e-6) return { x: doorPos.x, z: doorPos.z + need };
  return { x: doorPos.x + (dx / d) * need, z: doorPos.z + (dz / d) * need };
}
