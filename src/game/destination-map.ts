/** Destination Map (pure): the painted planet the Director opens on, from the owner's reference art
 * (docs/reference/destination-map, built by scripts/build-destination-art.py).
 *
 * The art is a 1536x1024 "stage". It is illustrative, like Destiny's director: a destination's place on the art is where
 * its label is painted, not its world position. Deployment always uses the live world (destinations.ts dropPoint), and
 * the geographic terrain atlas stays one click away. The tab bar, destination list and bottom bar painted into the art are
 * covered 1:1 by live UI (STAGE_PANELS), so the screen looks like the reference and every control on it is real.
 * What a destination offers (story, bosses, activities) comes from map-activities.ts; nothing here is stored. */
import { REGIONS, type ZoneKind } from "./world";
import { CITY_DESTINATIONS, dropPoint } from "./destinations";
import { regionActivities, type Activity } from "./map-activities";
import { cityAt } from "./living-world";
import { nextActivity } from "./retention";
import type { PlayerProgression } from "./progression";

export const STAGE = { w: 1536, h: 1024 } as const;
export type Rect = { x: number; y: number; w: number; h: number };

/** the reference's own UI chrome, painted into the art; live panels sit exactly on these */
export const STAGE_PANELS = {
  title: { x: 22, y: 12, w: 330, h: 104 },
  tabs: { x: 378, y: 0, w: 738, h: 54 },
  list: { x: 12, y: 124, w: 242, h: 526 },
  bottom: { x: 0, y: 946, w: 1536, h: 78 },
  status: { x: 1130, y: 10, w: 392, h: 44 },
} as const satisfies Record<string, Rect>;
/** where the selected destination's card sits (the reference's second frame) */
export const CARD_RECT: Rect = { x: 22, y: 656, w: 340, h: 284 };
/** where activities / landing zones open (right edge of the planet) */
export const DRAWER_RECT: Rect = { x: 1166, y: 70, w: 352, h: 866 };
/** the destination close-up (between the card column and the drawer) */
export const CLOSEUP_RECT: Rect = { x: 374, y: 70, w: 782, h: 866 };
/** phone layout: only this window of the art is shown (no painted chrome), the controls flow below it */
export const MAP_WINDOW: Rect = { x: 256, y: 56, w: 1280, h: 888 };

export type DestinationId = "nexus" | "neon-city" | "thalassia" | "veridan" | "frostspire" | "ember" | "wastelands" | "solara" | "swamps";

export type DestinationPin = {
  id: DestinationId;
  /** painted label + emblem on the art: the hotspot */
  label: Rect;
  /** emblem centre on the art (selection ring, markers) */
  icon: { x: number; y: number };
  /** emblem cropped from the art's own destination list (src/assets/destination/emblem-<id>.png) */
  tagline: string;
  blurb: string;
  accent: string;
};

/** list order of the reference's destination list */
export const DESTINATION_PINS: readonly DestinationPin[] = [
  { id: "nexus", label: { x: 760, y: 290, w: 212, h: 56 }, icon: { x: 790, y: 318 }, tagline: "City hub", accent: "#7fd8ff",
    blurb: "The heart of World Fracture. Trade, missions, factions and new beginnings converge in Nexus City." },
  { id: "neon-city", label: { x: 850, y: 504, w: 182, h: 58 }, icon: { x: 880, y: 532 }, tagline: "Cyber metropolis", accent: "#ff5fd2",
    blurb: "Neon towers over a lawless Undercity. The Syndicate and the Aegis Directorate fight for every street." },
  { id: "thalassia", label: { x: 288, y: 506, w: 128, h: 96 }, icon: { x: 333, y: 540 }, tagline: "Underwater city", accent: "#38e8ff",
    blurb: "A drowned arcology beneath the waves. Arrive by submersible at the Sentry Dock and descend into the Abyssal Ring." },
  { id: "veridan", label: { x: 428, y: 390, w: 244, h: 58 }, icon: { x: 457, y: 418 }, tagline: "Living wilderness", accent: "#8be36a",
    blurb: "Where every Operator wakes: ancient canopy, a crashed hull and the first echoes of the Fracture." },
  { id: "frostspire", label: { x: 500, y: 128, w: 206, h: 86 }, icon: { x: 530, y: 160 }, tagline: "Glacial heights", accent: "#bfe4ff",
    blurb: "Frozen peaks and survey camps at the top of the world. Cold exposure punishes anyone caught outside." },
  { id: "ember", label: { x: 1012, y: 184, w: 216, h: 54 }, icon: { x: 1040, y: 210 }, tagline: "Volcanic region", accent: "#ff6a3d",
    blurb: "A living volcano where the Breakers harvest molten power: lava flows, basalt spires and shifting gravity." },
  { id: "wastelands", label: { x: 1196, y: 396, w: 252, h: 56 }, icon: { x: 1225, y: 423 }, tagline: "Scarred lands", accent: "#e8c39a",
    blurb: "Rust, dust and raider warbands. The Sub-Terra Legion holds the vault gates; the Rust Run decides who rules the roads." },
  { id: "solara", label: { x: 1114, y: 632, w: 242, h: 62 }, icon: { x: 1145, y: 663 }, tagline: "Sunken kingdoms", accent: "#ffc23d",
    blurb: "Sun-scorched mesas over buried arcologies. Solar flares burn any hull caught in the open." },
  { id: "swamps", label: { x: 432, y: 742, w: 312, h: 58 }, icon: { x: 463, y: 770 }, tagline: "Toxic lowlands", accent: "#b7f04a",
    blurb: "Moss-hung cypress and toxic mire. Aberrations breed in the fog." },
];
export const pinById = (id: string) => DESTINATION_PINS.find((p) => p.id === id);

export type DestinationInfo = {
  id: DestinationId; name: string; sub: string; kind: ZoneKind;
  /** region whose activities, hazard and threat apply */
  regionId: string;
  threat: number;
  deployable: boolean; blockedReason: string | null;
  /** live world drop for "primary landing zone" */
  drop: { x: number; z: number; y?: number };
};

export function destinationInfo(id: DestinationId): DestinationInfo {
  const city = CITY_DESTINATIONS.find((c) => c.id === id);
  if (city) {
    const region = REGIONS.find((r) => r.id === city.regionId)!;
    return { id, name: city.name, sub: city.sub, kind: city.kind, regionId: city.regionId, threat: region.difficulty, deployable: city.deployable, blockedReason: city.blockedReason ?? null, drop: dropPoint(city) };
  }
  const r = REGIONS.find((x) => x.id === id)!;
  return { id, name: r.name, sub: r.sub, kind: r.kind, regionId: r.id, threat: r.difficulty, deployable: true, blockedReason: null, drop: dropPoint(r) };
}

const NEAR_THALASSIA = 250;
/** what a destination offers: a region's own activities, or the slice of its host region that belongs to the city */
export function destinationActivities(p: PlayerProgression, id: DestinationId, now = Date.now()): Activity[] {
  const info = destinationInfo(id);
  const all = regionActivities(p, info.regionId, now);
  if (id === "neon-city") return all.filter((a) => cityAt(a.x, a.z) === "neon" || a.id === "city:neon-city");
  if (id === "thalassia") { const c = CITY_DESTINATIONS.find((x) => x.id === "thalassia")!; return all.filter((a) => Math.hypot(a.x - c.x, a.z - c.z) < NEAR_THALASSIA || a.id === "city:thalassia"); }
  if (id === "nexus") return all.filter((a) => cityAt(a.x, a.z) !== "neon" && a.id !== "city:neon-city");
  if (id === "swamps") { const c = CITY_DESTINATIONS.find((x) => x.id === "thalassia")!; return all.filter((a) => Math.hypot(a.x - c.x, a.z - c.z) >= NEAR_THALASSIA && a.id !== "city:thalassia"); }
  return all;
}

export type DestinationStatus = {
  recommended: boolean; story: boolean; bosses: number; open: number; done: number;
};
export function destinationStatus(p: PlayerProgression, id: DestinationId, now = Date.now()): DestinationStatus {
  const acts = destinationActivities(p, id, now);
  const next = nextActivity(p);
  const info = destinationInfo(id);
  const regionName = REGIONS.find((r) => r.id === info.regionId)?.name;
  const story = acts.some((a) => a.kind === "STORY" && a.status === "NEXT");
  return {
    // cities never take the region's recommendation; the region itself does
    recommended: story || (!CITY_DESTINATIONS.some((c) => c.id === id) && next.region === regionName && !acts.some((a) => a.kind === "STORY")),
    story,
    bosses: acts.filter((a) => (a.kind === "BOSS" || a.kind === "NEMESIS") && a.status !== "LOCKED").length,
    open: acts.filter((a) => a.status === "AVAILABLE" || a.status === "NEXT").length,
    done: acts.filter((a) => a.status === "DONE").length,
  };
}

export const THREAT_LABEL = ["Minimal", "Low", "Moderate", "High", "Severe", "Extreme"] as const;
export const threatLabel = (n: number) => THREAT_LABEL[Math.max(0, Math.min(THREAT_LABEL.length - 1, n))]!;

/** list navigation (keyboard / d-pad): wraps */
export function stepDestination(id: DestinationId, dir: 1 | -1): DestinationId {
  const i = DESTINATION_PINS.findIndex((p) => p.id === id);
  return DESTINATION_PINS[(i + dir + DESTINATION_PINS.length) % DESTINATION_PINS.length]!.id;
}

/** percentage helpers so the live UI scales with the art */
export const pct = (r: Rect) => ({ left: `${(r.x / STAGE.w) * 100}%`, top: `${(r.y / STAGE.h) * 100}%`, width: `${(r.w / STAGE.w) * 100}%`, height: `${(r.h / STAGE.h) * 100}%` });
