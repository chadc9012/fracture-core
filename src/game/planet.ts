/** The planet (Stages 148, 152 and 153, pure): World Fracture's Earth-sized world and how the playable world maps onto it.
 * Canon map (owner, Nov 1 2026: "12 Continents, 7 Oceans", the concept board sent Oct 27): twelve continents — Nexus City,
 * Neon City, Verdant Forest, Thalassia, Frost Spire, Scorched Plains, Wastelands, Crystal Badlands, Storm Islands, The
 * Shattered Reefs, Ember Peaks and Shrouded Swamps — and seven oceans (Aurora, Fracture, Solara, Silent, Obsidian, Tempest,
 * Echo). It replaces the Oct 26 board's ten lands (Aetheria, Kharos, Pyrrath...). Districts per continent come from the same
 * concept series' regional maps. Protected (design bible): Thalassia lies offshore from the Verdant Forest; Neon City is its
 * own continent, not Nexus; Vyrak's lair stays in the Solara Desert, which is part of the Scorched Plains.
 *
 * Continents are the map and lore. Walking is governed by the live map's WORLDS (continent-borders.ts anchors): the part of
 * the map closest (weighted) to a world's anchors. You cannot walk, drive, sail or fly from one world into another; you
 * travel between them from a transit terminal (travel.ts) or by deploying from the planet map. World ids are internal and
 * saved ("planet:visited:<world>"), so they keep their old names: "aetheria" holds the Nexus City, Neon City and Verdant
 * Forest continents (the bridge drive between them stays open), "kharos" the Scorched Plains and Wastelands, "frosthelm"
 * Frost Spire, "pyrrath" Ember Peaks, "sylvaris" Shrouded Swamps, "thalassia" the undersea city's water. Pure; tested in
 * planet.test.ts. */
import { WORLD_ANCHORS, worldOfAnchor } from "./continent-borders";
import { THALASSIA_CENTER } from "./thalassia-site";
import { CITY_RADIUS } from "./thalassia-sectors";

export const PLANET = {
  name: "Veyra",
  /** mean diameter (Earth's) */
  diameterKm: 12742,
  /** polar diameter: flattened like Earth's (1/298) */
  polarDiameterKm: Math.round(12742 * (1 - 1 / 298)),
  /** 4πr²: 510.1 million km² */
  surfaceKm2: Math.round(4 * Math.PI * (12742 / 2) ** 2),
  gravityG: 1,
  /** the canon board: "12 Continents, 7 Oceans" */
  majorContinents: 12,
  majorOceans: 7,
} as const;

export type ContinentId = "nexus-city" | "neon-city" | "verdant-forest" | "thalassia" | "frost-spire" | "scorched-plains" | "wastelands"
  | "crystal-badlands" | "storm-islands" | "shattered-reefs" | "ember-peaks" | "shrouded-swamps";
/** CORE: built and playable now; EXPANSION: one region at a time, later; BACKDROP: on the map (lore, events), not walkable yet */
export type PlayTier = "CORE" | "EXPANSION" | "BACKDROP";

/** a named place in a continent's list (capital, district, point of interest, airport, port) */
export type PlaceKind = "CAPITAL" | "CITY" | "POI" | "AIRPORT" | "PORT" | "BRIDGE" | "HUB";
export type Place = { name: string; kind: PlaceKind; /** the live terminal or game region it is, when it exists in the game */ live?: string };

/** a walkable world of the live map (internal ids, saved: see the header) */
export type WorldId = "aetheria" | "sylvaris" | "kharos" | "frosthelm" | "pyrrath" | "thalassia";

export type Continent = {
  id: ContinentId;
  /** its number in the board's continent list (1-12) */
  n: number;
  name: string;
  /** the board list's tag under the name ("Unity · Progress") */
  tagline: string;
  /** the board's tile caption ("Unity · Progress · Opportunity") */
  epithet: string;
  tier: PlayTier;
  /** the game's regions on it (world.ts REGIONS ids, plus "neon", "riverdale", "thalassia" and "storm-islands") */
  regions: readonly string[];
  /** the live world it lies in, or null when it is not walkable yet */
  world: WorldId | null;
  capital: string;
  look: string;
  color: string;
  climate: string;
  /** districts and terminals, top to bottom */
  places: readonly Place[];
  /** the centre of its painted name on the board (pixels, BOARD space); its icon sits ~30 px above */
  pin: { x: number; y: number };
  /** its row in the board's continent list (pixels) */
  panel: { x: number; y: number; w: number; h: number };
};

const C = (name: string, kind: PlaceKind, live?: string): Place => (live ? { name, kind, live } : { name, kind });
/** the board's continent list: one row per continent, 37.6 px apart from y 26 */
const row = (n: number) => ({ x: 690, y: Math.round(26 + (n - 1) * 37.6), w: 198, h: 36 });
const T = (id: string) => [C(AIRPORT_NAMES[id]!, "AIRPORT", `terminal:${id}`), C(SEAPORT_NAMES[id]!, "PORT", `seaport:${id}`)];
/** terminal names (travel.ts reads them too) */
export const AIRPORT_NAMES: Readonly<Record<string, string>> = {
  nexus: "Nexus City Airport", neon: "Neon International Airport", veridan: "Verdant Airfield", frostspire: "Frost Spire Airport",
  ember: "Ember Peaks Airport", wastelands: "Wastelands Airstrip", solara: "Solara Airport", swamps: "Shrouded Swamps Airfield",
};
export const SEAPORT_NAMES: Readonly<Record<string, string>> = {
  nexus: "Nexus Harbour", neon: "Neon City Harbour", veridan: "Verdant Port", frostspire: "Whitegate Port",
  ember: "Lava Docks", wastelands: "Rust Harbour", solara: "Dune Port", swamps: "Mirewater Port",
};

/** the twelve continents of the canon board, in its list order */
export const CONTINENTS: readonly Continent[] = [
  { id: "nexus-city", n: 1, name: "Nexus City", tagline: "Unity · Progress", epithet: "Unity · Progress · Opportunity", tier: "CORE", regions: ["nexus"], world: "aetheria",
    capital: "Nexus City", color: "#9fd6ff", climate: "Temperate",
    places: [C("Nexus City", "CAPITAL", "nexus"), C("Nexus Hall", "POI"), C("Government District", "CITY"), C("Capital District", "CITY"), C("University", "POI"), C("Residential", "CITY"), C("Harbor District", "CITY"), ...T("nexus")],
    look: "The capital of a new world: towers, the State Capitol and the elevated highway loop. The game starts here, and the bridge drive runs on to Neon City and the Verdant Forest.",
    pin: { x: 320, y: 311 }, panel: row(1) },
  { id: "neon-city", n: 2, name: "Neon City", tagline: "Lights · Power · Freedom", epithet: "Lights · Money · Power", tier: "CORE", regions: ["neon"], world: "aetheria",
    capital: "Neon City", color: "#c86bff", climate: "Temperate · rain",
    places: [C("Neon City", "CAPITAL", "neon"), C("Luxury District", "CITY"), C("Aegis Spire", "POI"), C("Crown Casino", "POI"), C("Casino Row", "CITY"), C("The Strip", "CITY"), C("Shopping Mall", "POI"), C("Nightlife District", "CITY"), C("Metro Station", "HUB"), C("Harbor & Docks", "CITY"), C("Industrial", "CITY"), ...T("neon")],
    look: "The Velvet Circuit: casinos, clubs and penthouses under the neon, its own city across the gulf from Nexus.",
    pin: { x: 486, y: 349 }, panel: row(2) },
  { id: "verdant-forest", n: 3, name: "Verdant Forest", tagline: "Life · Mystery", epithet: "Life · Mystery · Ancient Secrets", tier: "CORE", regions: ["veridan", "riverdale"], world: "aetheria",
    capital: "Riverdale", color: "#59d07a", climate: "Temperate rainforest",
    places: [C("Verdant Grove", "POI", "veridan"), C("Riverdale", "CITY", "riverdale"), C("The Canopy", "POI"), C("Mistwood", "POI"), C("Emerald Lakes", "POI"), C("Spirit Falls", "POI"), C("Rooted Hollow", "POI"), ...T("veridan")],
    look: "Old-growth forest, rivers and the town of Riverdale. Thalassia lies offshore: take the elevator platform off the Verdant shore.",
    pin: { x: 630, y: 330 }, panel: row(3) },
  { id: "thalassia", n: 4, name: "Thalassia", tagline: "Beauty · Below", epithet: "Beauty · Below · Life Together", tier: "CORE", regions: ["thalassia"], world: "thalassia",
    capital: "Royal Palace", color: "#4fd6e8", climate: "Undersea",
    places: [C("Thalassia", "CAPITAL", "thalassia"), C("Coral District", "CITY"), C("Central Plaza", "CITY"), C("Royal Palace", "POI"), C("Research Dome", "POI"), C("Trench Gates", "POI"), C("Living Reef", "POI")],
    look: "The sunken kingdom, offshore from the Verdant Forest: reached by the elevator platform off the Verdant shore or an underwater vehicle.",
    pin: { x: 578, y: 521 }, panel: row(4) },
  { id: "frost-spire", n: 5, name: "Frost Spire", tagline: "Isolation · Strength", epithet: "Isolation · Strength · Ancient Power", tier: "CORE", regions: ["frostspire"], world: "frosthelm",
    capital: "Frostspire Keep", color: "#cfe8ff", climate: "Polar",
    places: [C("Frostspire Mountains", "CAPITAL", "frostspire"), C("Frostspire Keep", "POI"), C("Glacier Pass", "POI"), C("The White Expanse", "POI"), C("Icegate", "POI"), C("Avalanche Basin", "POI"), C("Skyreach", "POI"), C("Nomad Camp", "CITY"), ...T("frostspire")],
    look: "The cold remembers: glaciers, frozen passes and polar settlements under the Spire.",
    pin: { x: 400, y: 100 }, panel: row(5) },
  { id: "scorched-plains", n: 6, name: "Scorched Plains", tagline: "Heat · Conflict", epithet: "Heat · Conflict · Hidden Truths", tier: "CORE", regions: ["solara"], world: "kharos",
    capital: "Solara", color: "#f2b63c", climate: "Arid",
    places: [C("Solara Desert", "CAPITAL", "solara"), C("Sunken Arcology Vaults", "POI"), C("Glass Dunes", "POI"), ...T("solara")],
    look: "Sun-baked plains around the Solara Desert, with canyons and ancient tombs; the Wastelands lie north across the dunes.",
    pin: { x: 137, y: 407 }, panel: row(6) },
  { id: "wastelands", n: 7, name: "Wastelands", tagline: "Survival · Opportunity", epithet: "Survival · Danger · Opportunity", tier: "CORE", regions: ["wastelands"], world: "kharos",
    capital: "Outlander Camp", color: "#c9a36a", climate: "Arid · dust",
    places: [C("The Wastelands", "CAPITAL", "wastelands"), C("Warlord's Ridge", "POI"), C("The Dust Sea", "POI"), C("The Maw", "POI"), C("Scrapwall", "CITY"), C("Sunken Convoy", "POI"), C("Outlander Camp", "CITY"), C("Ravager Dunes", "POI"), C("Salvage Yards", "POI"), ...T("wastelands")],
    look: "Survive, adapt, conquer: rust, scrap and burned highways.",
    pin: { x: 338, y: 473 }, panel: row(7) },
  { id: "crystal-badlands", n: 8, name: "Crystal Badlands", tagline: "Resources · Mysteries", epithet: "Beauty · Resources · Mysteries", tier: "BACKDROP", regions: [], world: null,
    capital: "The Crystal Spire", color: "#9b6bff", climate: "Crystalline badlands",
    places: [C("The Crystal Spire", "CAPITAL"), C("Shattered Fields", "POI"), C("Echo Canyons", "POI"), C("Refraction Valley", "POI"), C("The Prism", "POI"), C("Void Rifts", "POI"), C("Crystal Mines", "POI"), C("Scavenger's Rest", "CITY")],
    look: "Beauty in ruin: crystal spires, mines and void rifts. On the map, not explorable yet.",
    pin: { x: 147, y: 287 }, panel: row(8) },
  { id: "storm-islands", n: 9, name: "Storm Islands", tagline: "Chaos · Discovery", epithet: "Chaos · Discovery · Sky High", tier: "EXPANSION", regions: ["storm-islands"], world: null,
    capital: "Storm Citadel", color: "#7fb2ff", climate: "Storm · alpine",
    places: [C("Storm Citadel", "CAPITAL"), C("Thunder Cliffs", "POI"), C("Cyclone Pass", "POI"), C("Shattered Isles", "POI"), C("Windshear Village", "CITY"), C("Tempest Docks", "PORT"), C("Eye of the Storm", "POI")],
    look: "Where chaos lives: floating islands and stormfronts, reached by air drop.",
    pin: { x: 557, y: 189 }, panel: row(9) },
  { id: "shattered-reefs", n: 10, name: "The Shattered Reefs", tagline: "Islands · Secrets", epithet: "Islands · Secrets · War's Remnants", tier: "BACKDROP", regions: [], world: null,
    capital: "Echo Isles", color: "#5ec8e0", climate: "Maritime",
    places: [C("Echo Isles", "CAPITAL"), C("The Fracture", "POI"), C("Echo Ruins", "POI"), C("Ancient Vault", "POI"), C("Driftmarker", "POI"), C("Sunken Spire", "POI"), C("The Deep", "POI")],
    look: "Remnants of another time: broken islands and sunken vaults. On the map, not explorable yet.",
    pin: { x: 220, y: 173 }, panel: row(10) },
  { id: "ember-peaks", n: 11, name: "Ember Peaks", tagline: "Fire · Power", epithet: "Fire · Power · Forgotten Kings", tier: "CORE", regions: ["ember"], world: "pyrrath",
    capital: "Forgemaster's Keep", color: "#ff6a3a", climate: "Volcanic",
    places: [C("Ember Peaks", "CAPITAL", "ember"), C("Ashen Summit", "POI"), C("Magma Flow", "POI"), C("Forgemaster's Keep", "POI"), C("Ember Pass", "POI"), C("Sulfur Fields", "POI"), C("The Crucible", "POI"), C("Obsidian Canyons", "POI"), ...T("ember")],
    look: "Fire shapes destiny: volcanic mountains, lava fields and the forges.",
    pin: { x: 162, y: 576 }, panel: row(11) },
  { id: "shrouded-swamps", n: 12, name: "Shrouded Swamps", tagline: "Danger · Hidden Truths", epithet: "Danger · Hidden Truths · Lost History", tier: "CORE", regions: ["swamps"], world: "sylvaris",
    capital: "The Shrouded Swamps", color: "#8bc34a", climate: "Wetland",
    places: [C("The Shrouded Swamps", "CAPITAL", "swamps"), C("Sunken Temple of Echoes", "POI"), C("Drowned Causeway", "POI"), ...T("swamps")],
    look: "Fog, bioluminescent wetlands and drowned ruins.",
    pin: { x: 427, y: 624 }, panel: row(12) },
];

export type OceanId = "aurora" | "fracture" | "solara" | "silent" | "obsidian" | "tempest" | "echo";
/** the board's seven oceans, in its list order, each with its row in the list (pixels) */
export const OCEANS: readonly { id: OceanId; n: number; name: string; character: string; panel: { x: number; y: number; w: number; h: number } }[] = (
  [["aurora", "Aurora Ocean", "The Northern Expanse"], ["fracture", "Fracture Ocean", "The Central Deep"], ["solara", "Solara Ocean", "The Southern Reach"],
   ["silent", "Silent Ocean", "The Eastern Expanse"], ["obsidian", "Obsidian Ocean", "The Western Deep"], ["tempest", "Tempest Ocean", "The Storm Belt"],
   ["echo", "Echo Ocean", "The Shattered Depths"]] as const
).map(([id, name, character], i) => ({ id, n: i + 1, name, character, panel: { x: 690, y: Math.round(508 + i * 28.8), w: 198, h: 28 } }));

/** small deterministic string hash (FNV-1a), for seeded map shapes */
export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const continentById = (id: string): Continent | null => CONTINENTS.find((c) => c.id === id) ?? null;
/** the continent a game region (REGIONS id, "neon", "riverdale", "thalassia") lies on */
export const continentOfRegion = (regionId: string | null | undefined): Continent | null => (regionId ? CONTINENTS.find((c) => c.regions.includes(regionId)) ?? null : null);
/** the continents inside a live world, in board order */
export const continentsOfWorld = (w: WorldId): readonly Continent[] => CONTINENTS.filter((c) => c.world === w);

/* ---------------- continent worlds in the live map ---------------- */

export { WORLD_ANCHORS };

/** Thalassia's own water: the city and the sea around it, plus the approach lane from the Verdant shore's elevator platform */
export const THALASSIA_ZONE_RADIUS = CITY_RADIUS + 140;

/** which continent world (x, z) belongs to; "thalassia" for the city's own water */
export function worldAt(x: number, z: number): WorldId {
  if (Math.hypot(x - THALASSIA_CENTER.x, z - THALASSIA_CENTER.z) < THALASSIA_ZONE_RADIUS) return "thalassia";
  let best = "aetheria", score = Infinity;
  for (const [id, anchors] of Object.entries(WORLD_ANCHORS)) for (const a of anchors) {
    const s = Math.hypot(x - a.x, z - a.z) - a.w;
    if (s < score) { score = s; best = id; }
  }
  return worldOfAnchor(best) as WorldId;
}
/** the first continent of a world on the board (Nexus City for the Nexus world) */
export const continentOfWorld = (w: WorldId): ContinentId => continentsOfWorld(w)[0]!.id;

/** May you move from one world straight into another without a terminal? Only between the Nexus world's coast and Thalassia's
 * water (by boat, sub or swimming): the city lies off the Verdant shore. Every other pair is a continental border. */
export function crossingAllowed(from: WorldId, to: WorldId): boolean {
  if (from === to) return true;
  const pair = [from, to].sort().join("|");
  return pair === "aetheria|thalassia";
}

/** a step from (x0, z0) to (x1, z1): blocked when it crosses a continental border */
export function borderBlocks(x0: number, z0: number, x1: number, z1: number): { blocked: boolean; from: WorldId; to: WorldId } {
  const from = worldAt(x0, z0), to = worldAt(x1, z1);
  return { blocked: !crossingAllowed(from, to), from, to };
}

/** a world's name for the HUD and toasts: its continents ("Scorched Plains · Wastelands") */
export const worldName = (w: WorldId): string => continentsOfWorld(w).map((c) => c.name).join(" · ") || w;

/* ---------------- the planetary map board ---------------- */

/** the board art's size (the canon "12 Continents, 7 Oceans" globe with its continent and ocean lists); pins and routes are
 * drawn in its pixel space */
export const BOARD = { w: 890, h: 712 } as const;
/** the painted globe on the board (centre and radius, pixels) */
export const GLOBE = { x: 345, y: 365, r: 345 } as const;
/** where the live legend is drawn: over the board's "12 Continents / 7 Oceans" caption, bottom left */
export const LEGEND_RECT = { x: 6, y: 612, w: 132, h: 94 } as const;
/** air routes drawn on the planet map: Nexus City is the hub (every airport continent), plus the southern links */
export const AIR_ROUTES: readonly (readonly [ContinentId, ContinentId])[] = [
  ["nexus-city", "neon-city"], ["nexus-city", "verdant-forest"], ["nexus-city", "frost-spire"], ["nexus-city", "scorched-plains"],
  ["nexus-city", "wastelands"], ["nexus-city", "storm-islands"], ["wastelands", "ember-peaks"], ["wastelands", "shrouded-swamps"],
  ["scorched-plains", "ember-peaks"],
];
