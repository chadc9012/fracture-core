/** The planet (Stages 148, 152 and 153, pure): World Fracture's Earth-sized world and how the playable world maps onto it.
 * Global map board (owner, Oct 26 2026): ten lands on an Earth-like globe — Aetheria (Atlantic Region: Nexus City, the
 * capital, Neon City, the Verdant Forest, Riverdale and the Celestial Bridge), Valdoria (North America), Frosthelm (Arctic),
 * Zephyria (North Asia), Noctyra (Europe/Asia), Myrathis (Asia), Elyndra (South America), Kharos (Africa), Pyrrath (Southern
 * Continent) and Sylvaris; the Arctic, Pacific, Atlantic, Indian and Southern Oceans; a 12,742 km planet. Veyloria is retired:
 * the Verdant Forest is Aetheria's, across the Nexus Strait from Nexus City. Thalassia is on no continent: it lies in the
 * Atlantic off Aetheria's Verdant shore, reached by an offshore elevator or an underwater vehicle.
 *
 * In the live game every continent is a "world": the part of the map closest (weighted) to that continent's anchors.
 * You cannot walk, drive, sail or fly from one continent world into another; you travel between them from a transit
 * terminal (travel.ts) or by deploying from the planet map. Thalassia, the Storm Islands, interiors and descents are free
 * spaces with their own ways in. Pure; tested in planet.test.ts. */
import { WORLD_ANCHORS, worldOfAnchor } from "./continent-borders";
import { THALASSIA_CENTER } from "./thalassia-site";
import { CITY_RADIUS } from "./thalassia-sectors";

export const PLANET = {
  name: "Veyra",
  /** mean diameter, as on the owner's global map board (Earth's) */
  diameterKm: 12742,
  /** polar diameter: flattened like Earth's (1/298) */
  polarDiameterKm: Math.round(12742 * (1 - 1 / 298)),
  /** 4πr²: 510.1 million km², as on the board */
  surfaceKm2: Math.round(4 * Math.PI * (12742 / 2) ** 2),
  gravityG: 1,
  majorContinents: 7,
  majorOceans: 5,
  /** the board's planet info: 8 major regions, 40+ cities, 20+ airports, 20+ ports, 100+ discoverable locations */
  majorRegions: 8,
  cities: "40+",
  airports: "20+",
  ports: "20+",
  discoverable: "100+",
} as const;

export type ContinentId = "aetheria" | "valdoria" | "frosthelm" | "zephyria" | "noctyra" | "myrathis" | "elyndra" | "kharos" | "pyrrath" | "sylvaris";
/** CORE: built and playable now; EXPANSION: one region at a time, later; BACKDROP: on the map (nations, lore, events), not walkable yet */
export type PlayTier = "CORE" | "EXPANSION" | "BACKDROP";
/** what a land on the board is: one of the seven continents, or an archipelago or subregion */
export type LandKind = "CONTINENT" | "ARCHIPELAGO" | "NATION" | "SUBREGION";
export const LAND_KIND_LABEL: Record<LandKind, string> = { CONTINENT: "Continent", ARCHIPELAGO: "Archipelago", NATION: "Nation", SUBREGION: "Subregion" };

/** a named place in a land's panel on the board (the board's legend: capital, major city, point of interest, airport, port) */
export type PlaceKind = "CAPITAL" | "CITY" | "POI" | "AIRPORT" | "PORT" | "BRIDGE" | "HUB";
export type Place = { name: string; kind: PlaceKind; /** the live terminal or game region it is, when it exists in the game */ live?: string };

export type Continent = {
  id: ContinentId;
  name: string;
  /** the board's tag under the name (Aetheria: "Atlantic Region") */
  region: string;
  /** the board's one-line description in the land's panel */
  epithet: string;
  kind: LandKind;
  /** globe position of its heart, degrees: read off the owner's global map board */
  lat: number; lon: number;
  /** rough extent on the globe, degrees of arc */
  size: number;
  tier: PlayTier;
  /** the game's regions on it (world.ts REGIONS ids, plus "neon" for Neon City and "storm-islands") */
  regions: readonly string[];
  capital: string;
  look: string;
  color: string;
  majorCities: number;
  scale: "Large" | "Medium" | "Small";
  climate: string;
  /** the board panel's list, top to bottom */
  places: readonly Place[];
  /** where its name is painted on the global map board (pixels in the 1536×1024 board) */
  pin: { x: number; y: number };
  /** its panel on the board (pixels) */
  panel: { x: number; y: number; w: number; h: number };
};

const C = (name: string, kind: PlaceKind, live?: string): Place => (live ? { name, kind, live } : { name, kind });
/** the ten lands of the owner's global map board (Oct 26 2026). Verdant Forest is Aetheria's, beside Nexus City and Neon City. */
export const CONTINENTS: readonly Continent[] = [
  { id: "aetheria", name: "Aetheria", region: "Atlantic Region", epithet: "Advanced cities, forests, mountains, and innovation.", kind: "CONTINENT", lat: 22, lon: -4, size: 26, tier: "CORE",
    regions: ["nexus", "neon", "veridan", "riverdale"], capital: "Nexus City", color: "#5aa8d8", majorCities: 4, scale: "Large", climate: "Temperate",
    places: [C("Nexus City", "CAPITAL", "nexus"), C("Neon City", "CITY", "neon"), C("Verdant Forest", "POI", "veridan"), C("Riverdale", "CITY", "riverdale"), C("Celestial Bridge", "BRIDGE"), C("Aetheria Airport (Nexus)", "AIRPORT", "terminal:nexus"), C("Neon International Airport", "AIRPORT", "terminal:neon")],
    look: "Nexus City and Neon City on opposite shores of a great gulf, joined by the Celestial Bridge; the Verdant Forest across the Nexus Strait. Thalassia lies offshore in the Atlantic. The game starts here.",
    pin: { x: 705, y: 350 }, panel: { x: 12, y: 102, w: 336, h: 172 } },
  { id: "valdoria", name: "Valdoria", region: "North America", epithet: "Lush forests, rivers, and ancient ruins.", kind: "CONTINENT", lat: 40, lon: -70, size: 30, tier: "BACKDROP",
    regions: [], capital: "Valdoria City", color: "#7fbf5a", majorCities: 2, scale: "Large", climate: "Temperate · forest",
    places: [C("Valdoria City", "CAPITAL"), C("Eldergrove", "CITY"), C("The Great Plains", "POI"), C("Silver River", "POI"), C("Valdoria Airport", "AIRPORT"), C("East Port", "PORT")],
    look: "Forests, river valleys and the Great Plains, with ancient ruins along the Silver River.", pin: { x: 510, y: 224 }, panel: { x: 12, y: 282, w: 336, h: 152 } },
  { id: "frosthelm", name: "Frosthelm", region: "Arctic Continent", epithet: "Frozen lands and towering peaks.", kind: "CONTINENT", lat: 72, lon: -10, size: 26, tier: "CORE",
    regions: ["frostspire"], capital: "Frost Spire", color: "#a9d3ee", majorCities: 2, scale: "Large", climate: "Polar",
    places: [C("Frost Spire", "CAPITAL", "frostspire"), C("Whitegate Port", "PORT", "seaport:frostspire"), C("Glacier Pass", "POI"), C("Northreach", "CITY"), C("Frosthelm Airport", "AIRPORT", "terminal:frostspire")],
    look: "Frost Spire, glaciers, frozen coastlines and polar settlements.", pin: { x: 718, y: 140 }, panel: { x: 12, y: 440, w: 336, h: 144 } },
  { id: "kharos", name: "Kharos", region: "Africa", epithet: "Vast deserts, ancient tombs, and lost civilizations.", kind: "CONTINENT", lat: 2, lon: 22, size: 30, tier: "CORE",
    regions: ["solara", "wastelands"], capital: "Solara City", color: "#d9973f", majorCities: 2, scale: "Large", climate: "Arid",
    places: [C("Solara City", "CAPITAL", "solara"), C("Solara Desert", "POI"), C("Sunspire", "CITY"), C("The Hollow Sun", "POI"), C("Kharos Airport", "AIRPORT", "terminal:solara"), C("Dune Port", "PORT", "seaport:solara")],
    look: "Solara Desert, canyons, ancient tombs and a vast dry interior; rust, scrap and burned highways in the Wastelands north of Solara.", pin: { x: 880, y: 480 }, panel: { x: 12, y: 590, w: 336, h: 144 } },
  { id: "pyrrath", name: "Pyrrath", region: "Southern Continent", epithet: "Volcanic mountains and molten frontiers.", kind: "CONTINENT", lat: -24, lon: 38, size: 24, tier: "CORE",
    regions: ["ember"], capital: "Pyrrath Keep", color: "#e0522a", majorCities: 2, scale: "Medium", climate: "Volcanic",
    places: [C("Ember Peaks", "CITY", "ember"), C("Magma Core", "POI"), C("Pyrrath Keep", "CAPITAL"), C("Ashen Coast", "POI"), C("Pyrrath Airport", "AIRPORT", "terminal:ember"), C("Blackrock Port", "PORT", "seaport:ember")],
    look: "Ember Peaks: volcanic mountains, lava fields and industrial settlements.", pin: { x: 963, y: 574 }, panel: { x: 12, y: 740, w: 336, h: 132 } },
  { id: "noctyra", name: "Noctyra", region: "Europe / Asia", epithet: "Neon metropolises and digital frontiers.", kind: "CONTINENT", lat: 42, lon: 40, size: 26, tier: "BACKDROP",
    regions: [], capital: "Noctyra City", color: "#b45cff", majorCities: 2, scale: "Large", climate: "Temperate · rain",
    places: [C("Noctyra City", "CAPITAL"), C("Voidspire", "CITY"), C("The Neon Dominion", "POI"), C("Nightreach Port", "PORT"), C("Noctyra International", "AIRPORT"), C("Skyrail Hub", "HUB")],
    look: "Neon metropolises, isolated territories and dimensional anomalies.", pin: { x: 913, y: 275 }, panel: { x: 1228, y: 8, w: 300, h: 156 } },
  { id: "elyndra", name: "Elyndra", region: "South America", epithet: "Tropical islands and crystal waters.", kind: "CONTINENT", lat: -10, lon: -58, size: 26, tier: "BACKDROP",
    regions: [], capital: "Sapphire City", color: "#3fb6c9", majorCities: 1, scale: "Large", climate: "Tropical",
    places: [C("Sapphire City", "CAPITAL"), C("Coral Expanse", "POI"), C("Azure Port", "PORT"), C("The Sapphire Coast", "POI"), C("Elyndra Airport", "AIRPORT")],
    look: "Tropical islands, crystal waters and working harbours.", pin: { x: 551, y: 497 }, panel: { x: 1228, y: 168, w: 300, h: 156 } },
  { id: "sylvaris", name: "Sylvaris", region: "Southern wetlands", epithet: "Wetlands, jungles, and living ecosystems.", kind: "SUBREGION", lat: -38, lon: -52, size: 18, tier: "CORE",
    regions: ["swamps"], capital: "Sylva City", color: "#2f9c86", majorCities: 1, scale: "Medium", climate: "Wetland",
    places: [C("Sylva City", "CAPITAL", "swamps"), C("Emerald Basin", "POI"), C("The Living Reef", "POI"), C("Sylvaris Port", "PORT", "seaport:swamps"), C("Sylvaris Airport", "AIRPORT", "terminal:swamps")],
    look: "The Shrouded Swamps, bioluminescent wetlands and ancient forests at the southern end of Elyndra's landmass.", pin: { x: 574, y: 640 }, panel: { x: 1228, y: 328, w: 300, h: 152 } },
  { id: "myrathis", name: "Myrathis", region: "Asia", epithet: "Ancient lands and forgotten realms.", kind: "SUBREGION", lat: 28, lon: 78, size: 20, tier: "BACKDROP",
    regions: [], capital: "Stonecrest", color: "#8a9a7a", majorCities: 1, scale: "Medium", climate: "Highland mist",
    places: [C("Stonecrest", "CAPITAL"), C("Eclipse Ruins", "POI"), C("The Forgotten Lands", "POI"), C("Myrathis Airport", "AIRPORT"), C("West Port", "PORT")],
    look: "Ancient lands and forgotten realms: weathered stone, waterfalls and mist, east of Noctyra.", pin: { x: 1112, y: 330 }, panel: { x: 1228, y: 486, w: 300, h: 152 } },
  { id: "zephyria", name: "Zephyria", region: "North Asia", epithet: "Floating islands and stormfronts.", kind: "ARCHIPELAGO", lat: 66, lon: 60, size: 20, tier: "EXPANSION",
    regions: ["storm-islands"], capital: "Zephyr Gate", color: "#7f8fd8", majorCities: 1, scale: "Small", climate: "Storm · alpine",
    places: [C("Zephyr Gate", "CAPITAL"), C("Stormspire", "POI"), C("Skyreach", "POI"), C("Zephyria Airport", "AIRPORT"), C("Tempest Port", "PORT")],
    look: "Floating islands and stormfronts; the Storm Islands are its first playable ground.", pin: { x: 957, y: 143 }, panel: { x: 1228, y: 642, w: 300, h: 152 } },
];

/** the seven continents (the rest of CONTINENTS are archipelagos and subregions on the board) */
export const MAJOR_CONTINENTS = (): readonly Continent[] => CONTINENTS.filter((c) => c.kind === "CONTINENT");

export type OceanId = "arctic" | "pacific" | "atlantic" | "indian" | "southern";
/** the board's five major oceans */
export const OCEANS: readonly { id: OceanId; name: string; lat: number; lon: number; character: string; major: boolean; pin: { x: number; y: number } }[] = [
  { id: "arctic", name: "Arctic Ocean", lat: 84, lon: 0, character: "Polar seas and drifting ice around Frosthelm and Zephyria", major: true, pin: { x: 795, y: 66 } },
  { id: "pacific", name: "Pacific Ocean", lat: 10, lon: -110, character: "Main shipping and passenger routes along Valdoria's and Elyndra's western coasts", major: true, pin: { x: 396, y: 398 } },
  { id: "atlantic", name: "Atlantic Ocean", lat: -8, lon: -20, character: "Central trade routes between Aetheria, Elyndra and Kharos; Thalassia lies in its waters off Aetheria", major: true, pin: { x: 720, y: 548 } },
  { id: "indian", name: "Indian Ocean", lat: -6, lon: 80, character: "Between Kharos, Pyrrath and Myrathis", major: true, pin: { x: 1098, y: 512 } },
  { id: "southern", name: "Southern Ocean", lat: -62, lon: 0, character: "Deep trenches and dangerous water south of Pyrrath and Sylvaris", major: true, pin: { x: 776, y: 718 } },
];

/** nations on each land (the first nation of each CORE land holds its playable ground) */
const NATIONS_BY: Record<ContinentId, readonly string[]> = {
  aetheria: ["Nexus Republic", "Aether Concord", "Neon Free State", "Verdant Wilds", "Riverdale Compact", "Skyline Accord"],
  valdoria: ["Valdorian Commonwealth", "Eldergrove March", "Great Plains League", "Silver River Freehold"],
  frosthelm: ["Crown of Frosthelm", "Rimeguard", "Northreach Pact"],
  kharos: ["Kharosi Sun Dominion", "Wasteland Free Clans", "Dune Gate Emirates", "Canyon Accord", "Ashen Caravans"],
  pyrrath: ["Pyrrathi Forge Union", "Cinder Marches", "Basalt Thanes"],
  noctyra: ["Noctyran Directorate", "Neon Dominion", "Nightreach Free Port", "Voltmarch"],
  elyndra: ["Sapphire Coast Federation", "Isle Kingdoms of Elyndra", "Coralport", "Tidewell"],
  sylvaris: ["Sylvari Mire Council", "Mangrove Leagues", "Lantern Delta"],
  myrathis: ["Remnant of Myrathis", "Mistveil", "Temple Cantons"],
  zephyria: ["Zephyrian Highcourt", "Stormward Isles", "Thunderhold"],
};
export type Nation = { id: string; name: string; continent: ContinentId; playable: boolean };
export const NATIONS: readonly Nation[] = CONTINENTS.flatMap((c) =>
  NATIONS_BY[c.id].map((name, i) => ({ id: `${c.id}-${i + 1}`, name, continent: c.id, playable: i === 0 && c.tier === "CORE" })),
);
/** small deterministic string hash (FNV-1a), for seeded map shapes */
export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const continentById = (id: string): Continent | null => CONTINENTS.find((c) => c.id === id) ?? null;

/* ---------------- continent worlds in the live map ---------------- */

export { WORLD_ANCHORS };
/** a continent world in the live map (Neon City's landmass is Aetheria's), or Thalassia's own water */
export type WorldId = "aetheria" | "sylvaris" | "kharos" | "frosthelm" | "pyrrath" | "thalassia";

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
export const continentOfWorld = (w: WorldId): ContinentId => (w === "thalassia" ? "aetheria" : (w as ContinentId));

/** May you move from one world straight into another without a terminal? Only between Aetheria's coast and Thalassia's
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

/** the region ids (REGIONS + "neon") inside a world, for UI */
export const worldName = (w: WorldId): string => (w === "thalassia" ? "Thalassia · off Aetheria" : continentById(w)?.name ?? w);

/* ---------------- the planetary map board ---------------- */

/** the board art's size; pins and routes are drawn in its pixel space */
export const BOARD = { w: 1536, h: 1024 } as const;
/** the painted globe on the board (centre and radius, pixels) */
export const GLOBE = { x: 778, y: 436, r: 432 } as const;
/** Thalassia's marker on the board: in the Atlantic just off Aetheria's southern coast */
export const THALASSIA_PIN = { x: 712, y: 462 } as const;
/** the board's own legend box, where the live legend is drawn */
export const LEGEND_RECT = { x: 362, y: 680, w: 146, h: 182 } as const;
/** air routes drawn on the planet map: every playable continent to its neighbours, Aetheria as the hub (as on the worldbuild board) */
export const AIR_ROUTES: readonly (readonly [ContinentId, ContinentId])[] = [
  ["aetheria", "frosthelm"], ["aetheria", "kharos"], ["aetheria", "pyrrath"], ["aetheria", "sylvaris"], ["aetheria", "zephyria"],
  ["kharos", "pyrrath"], ["kharos", "sylvaris"],
];
