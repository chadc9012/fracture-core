/** The Director's one location registry (Stage 39–41, "one unified data system"). Every place the Director can show —
 * the nine destinations, their districts and named sites, every door that leads indoors, every landmark and every
 * activity — is one `Location` with a permanent id, its parent, its world position, its layer and, for places that must
 * be found first, the discovery key that reveals it. Nothing here is a second copy of the world: each entry is derived from
 * the module that owns it (destination-director.ts, destination-map.ts, interiors.ts, landmarks.ts, activities.ts), so the
 * planet map, the regional and street views, the mission system, navigation and the save all name the same place.
 * Pure and deterministic; built once on first use. */
import { DESTINATIONS, cityDistricts, destinationAt, type Destination } from "./destination-director";
import { DESTINATION_PINS, destinationInfo, type DestinationId, type Rect } from "./destination-map";
import { INTERIORS, type InteriorDef } from "./interiors";
import { LANDMARKS, isLandmarkKnown } from "./landmarks";
import { ACTIVITIES, AREAS, activityState, type ActivityDef } from "./activities";
import { STORM_ISLANDS_CENTER, STORM_ISLAND_SITES, stormSiteWorld } from "./storm-islands";
import { FOUND_KEY as STORM_FOUND } from "./storm-quests";
import type { PlayerProgression } from "./progression";
import "./venue-doors"; // the nightlife venues' doors join INTERIORS

export type LocationLevel = "destination" | "area" | "entrance" | "landmark" | "activity";
/** where the place is: the open surface, a submerged city, the undercity, or a pocket room behind a door */
export type LocationLayer = "surface" | "underwater" | "underground" | "interior";

export type Location = {
  /** permanent: never renamed, safe to store in saves and links (dest:, area:, door:, lm:, op:) */
  id: string;
  /** the destination (or area) this belongs to; null only for destinations */
  parentId: string | null;
  /** the destination it ultimately belongs to (its own id for a destination) */
  destinationId: DestinationId;
  level: LocationLevel;
  name: string;
  sub: string;
  /** playable-world position (y: arrival height for underwater places) */
  world: { x: number; z: number; y?: number };
  layer: LocationLayer;
  /** hidden until this landmark is discovered (landmarks.ts isLandmarkKnown) */
  discoverKey?: string;
  /** hidden until this earnedRewards key exists (secret areas such as the Storm Islands' `storm:found`) */
  revealKey?: string;
  /** destinations only: the hotspot on the painted planet (destination-map.ts) */
  art?: Rect;
  /** areas only: how far the district reaches (m) */
  radius?: number;
  /** activities only: activities.ts id, so detail and launch read the real definition */
  activityId?: string;
};

/** old and alternative names used by other modules → the registry's destination id */
export const DESTINATION_ALIAS: Readonly<Record<string, DestinationId>> = {
  neon: "neon-city", "neon-city": "neon-city", "neon-underground": "neon-city", "neon-core": "neon-city",
  thalassia: "thalassia", nexus: "nexus", veridan: "veridan", riverdale: "veridan", frostspire: "frostspire", ember: "ember", wastelands: "wastelands", solara: "solara", swamps: "swamps",
};
export const destKey = (id: DestinationId) => `dest:${id}`;
const isDestinationId = (id: string): id is DestinationId => DESTINATION_PINS.some((p) => p.id === id);

const UNDERGROUND_AREAS = new Set(["neon-underground"]);

let cache: { list: Location[]; byId: Map<string, Location>; children: Map<string, Location[]> } | null = null;

function build() {
  const list: Location[] = [];
  const dests = DESTINATIONS.filter((d) => isDestinationId(d.id)) as (Destination & { id: DestinationId })[];
  const areasOf = new Map<DestinationId, Location[]>();
  for (const d of dests) {
    const info = destinationInfo(d.id), pin = DESTINATION_PINS.find((p) => p.id === d.id)!;
    list.push({ id: destKey(d.id), parentId: null, destinationId: d.id, level: "destination", name: info.name, sub: info.sub, world: info.drop, layer: d.id === "thalassia" ? "underwater" : "surface", art: pin.label });
    const areas = cityDistricts(d).map((k): Location => ({ id: `area:${d.id}:${k.id}`, parentId: destKey(d.id), destinationId: d.id, level: "area", name: k.name, sub: k.tagline, world: { x: k.x, z: k.z }, layer: d.id === "thalassia" ? "underwater" : "surface", radius: k.r }));
    // the activity system's own sub-areas (Neon's undercity and core) are real districts too
    for (const [aid, a] of Object.entries(AREAS)) if (DESTINATION_ALIAS[aid] === d.id && aid !== "neon" && aid !== d.id && !areas.some((x) => x.id === `area:${d.id}:${aid}`))
      areas.push({ id: `area:${d.id}:${aid}`, parentId: destKey(d.id), destinationId: d.id, level: "area", name: a.name, sub: UNDERGROUND_AREAS.has(aid) ? "Below the streets" : "District", world: { x: a.x, z: a.z }, layer: UNDERGROUND_AREAS.has(aid) ? "underground" : "surface", radius: a.radius });
    areasOf.set(d.id, areas);
    list.push(...areas);
  }
  /** the destination a world point belongs to, and the area inside it that holds the point (smallest that does) */
  const owner = (x: number, z: number, hint?: string): { dest: DestinationId; parentId: string } | null => {
    const d = destinationAt(x, z) ?? (hint ? DESTINATIONS.find((q) => q.id === DESTINATION_ALIAS[hint]) : undefined);
    if (!d || !isDestinationId(d.id)) return null;
    const area = (areasOf.get(d.id) ?? []).filter((a) => a.layer !== "underground" && Math.hypot(a.world.x - x, a.world.z - z) <= (a.radius ?? 0)).sort((a, b) => (a.radius ?? 0) - (b.radius ?? 0))[0];
    return { dest: d.id, parentId: area?.id ?? destKey(d.id) };
  };
  for (const i of INTERIORS) {
    const o = owner(i.doorPos.x, i.doorPos.z, i.regionId);
    if (!o) continue;
    list.push({ id: `door:${i.id}`, parentId: o.parentId, destinationId: o.dest, level: "entrance", name: i.name, sub: entranceSub(i), world: { x: i.doorPos.x, z: i.doorPos.z }, layer: "interior" });
  }
  for (const l of LANDMARKS) {
    const o = owner(l.x, l.z, l.regionId);
    if (!o) continue;
    list.push({ id: `lm:${l.id}`, parentId: o.parentId, destinationId: o.dest, level: "landmark", name: l.name, sub: l.type, world: { x: l.x, z: l.z }, layer: o.dest === "thalassia" ? "underwater" : "surface", discoverKey: l.id });
  }
  // the Storm Islands: a secret sub-area of Nexus (never a tenth destination), hidden until the chain is sighted
  list.push({ id: "area:nexus:storm-islands", parentId: destKey("nexus"), destinationId: "nexus", level: "area", name: "Storm Islands", sub: "Floating islands past the north-east rim", world: { x: STORM_ISLANDS_CENTER.x, z: STORM_ISLANDS_CENTER.z }, layer: "surface", radius: 520, revealKey: STORM_FOUND });
  for (const st of STORM_ISLAND_SITES) { const w = stormSiteWorld(st); list.push({ id: `lm:storm-${st.id}`, parentId: "area:nexus:storm-islands", destinationId: "nexus", level: "landmark", name: st.name, sub: st.description, world: { x: w.x, z: w.z, y: w.y + 4.5 }, layer: "surface", revealKey: STORM_FOUND }); }
  for (const a of ACTIVITIES) {
    const dest = DESTINATION_ALIAS[a.area], area = AREAS[a.area];
    if (!dest || !area) continue;
    const sub = `area:${dest}:${a.area}`;
    list.push({ id: `op:${a.id}`, parentId: list.some((x) => x.id === sub) ? sub : destKey(dest), destinationId: dest, level: "activity", name: a.name, sub: a.brief, world: { x: area.x, z: area.z }, layer: a.submerged || dest === "thalassia" ? "underwater" : UNDERGROUND_AREAS.has(a.area) ? "underground" : "surface", activityId: a.id });
  }
  const byId = new Map(list.map((l) => [l.id, l]));
  const children = new Map<string, Location[]>();
  for (const l of list) if (l.parentId) children.set(l.parentId, [...(children.get(l.parentId) ?? []), l]);
  return { list, byId, children };
}
const reg = () => (cache ??= build());

function entranceSub(i: InteriorDef): string {
  if (i.kind === "HOME") return "Home · owners only";
  if (i.kind === "SHOP") return i.npcName ? `Walk-in shop · ${i.npcName}` : "Walk-in shop";
  if (i.kind === "VENUE") return `Nightlife · ${i.openHour === 0 && i.closeHour === 24 ? "open all hours" : `${fmtHour(i.openHour ?? 0)}–${fmtHour(i.closeHour ?? 24)}`}${i.npcName ? ` · ${i.npcName}` : ""}`;
  return i.npcName ? `Indoors · ${i.npcName}` : "Indoors";
}

export const allLocations = (): readonly Location[] => reg().list;
export const locationById = (id: string): Location | undefined => reg().byId.get(id);
export const childrenOf = (id: string): readonly Location[] => reg().children.get(id) ?? [];
/** every location under a destination (any depth) */
export const locationsIn = (dest: DestinationId): readonly Location[] => reg().list.filter((l) => l.destinationId === dest && l.level !== "destination");
/** the chain from the destination down to this location (for breadcrumbs) */
export function locationPath(id: string): Location[] {
  const out: Location[] = [];
  for (let l = locationById(id); l; l = l.parentId ? locationById(l.parentId) : undefined) out.unshift(l);
  return out;
}

/** Discovery: a place with a discovery key does not exist on any map until it is found — no name, marker or "?". */
export function isLocationVisible(p: Pick<PlayerProgression, "earnedRewards">, l: Location): boolean {
  return (!l.discoverKey || isLandmarkKnown(p, l.discoverKey)) && (!l.revealKey || p.earnedRewards.includes(l.revealKey));
}

/** What an activity location asks for and pays, read from its real definition (activities.ts) and the save. */
export type ActivityBrief = { def: ActivityDef; available: boolean; reason: string | null; attemptsLeft: number; difficulty: number };
export function activityBrief(p: Pick<PlayerProgression, "missionRuns" | "earnedRewards">, l: Location, now = Date.now()): ActivityBrief | null {
  const def = l.activityId ? ACTIVITIES.find((a) => a.id === l.activityId) : undefined;
  if (!def) return null;
  const st = activityState(p, def, now);
  return { def, available: st.available, reason: st.reason ?? null, attemptsLeft: st.attemptsLeft, difficulty: def.difficulty };
}

const fmtHour = (h: number) => (h === 24 || h === 0 ? (h === 0 ? "00:00" : "24:00") : `${String(h).padStart(2, "0")}:00`);
