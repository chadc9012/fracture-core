/** The planet (Stages 148 and 152, pure): World Fracture's Earth-sized world, its 7 major continents, 5 major oceans, the
 * archipelagos, nations and subregions between them, and how the playable world maps onto it.
 * Planet update (owner, Oct 25 2026): an Earth-sized oblate globe (12,756 km) with completely original continents; seven
 * major continents (Aetheria, Veyloria, Kharos, Pyrrath, Frosthelm, Sylvaris, Noctyra) and five major oceans; Elyndra,
 * Valdoria, Myrathis, Drakoria and Zephyria become archipelagos, nations or subregions. Nexus City and Neon City are both
 * Aetheria, on separate coastal landmasses across a gulf joined by the Celestial Bridge.
 * Earlier: "World Fracture — Planet Reconciliation" (owner decisions, Oct 25 2026): regions are
 * split onto separate continents with travel between them, the game starts on Veyloria (Verdant Forest), the Wastelands
 * sit on Kharos north of Solara, Aetheria's public capital is Meridian with Nexus City inside it, and Thalassia is NOT part
 * of any continent: it lies off Veyloria's east coast in the Meridian Ocean, reached by an offshore elevator or an underwater
 * vehicle.
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
  /** equatorial diameter (an oblate sphere, Earth-sized) */
  diameterKm: 12756,
  /** polar diameter: flattened like Earth's (1/298) */
  polarDiameterKm: Math.round(12756 * (1 - 1 / 298)),
  /** 4πr² for the equatorial diameter (the flattening changes it by under 0.3%) */
  surfaceKm2: Math.round(4 * Math.PI * (12756 / 2) ** 2),
  gravityG: 1,
  majorContinents: 7,
  majorOceans: 5,
} as const;

export type ContinentId = "aetheria" | "kharos" | "veyloria" | "noctyra" | "frosthelm" | "pyrrath" | "elyndra" | "valdoria" | "myrathis" | "drakoria" | "sylvaris" | "zephyria";
/** CORE: built and playable now; EXPANSION: one region at a time, later; BACKDROP: on the map (nations, lore, events), not walkable yet */
export type PlayTier = "CORE" | "EXPANSION" | "BACKDROP";
/** what a landmass on the board is: one of the seven major continents, or (planet update) an archipelago, nation or subregion */
export type LandKind = "CONTINENT" | "ARCHIPELAGO" | "NATION" | "SUBREGION";
export const LAND_KIND_LABEL: Record<LandKind, string> = { CONTINENT: "Continent", ARCHIPELAGO: "Archipelago", NATION: "Nation", SUBREGION: "Subregion" };

export type Continent = {
  id: ContinentId;
  name: string;
  epithet: string;
  kind: LandKind;
  /** globe position of its heart, degrees: read off the owner's planetary map board, so the in-game globe matches it */
  lat: number; lon: number;
  /** rough extent on the globe, degrees of arc */
  size: number;
  tier: PlayTier;
  /** the game's regions on it (world.ts REGIONS ids, plus "neon" for Neon City) */
  regions: readonly string[];
  capital: string;
  look: string;
  color: string;
  /** the info-panel facts on the owner's planetary map board (Aetheria: 6 nations, 8 major cities, large, temperate) */
  majorCities: number;
  scale: "Large" | "Medium" | "Small";
  climate: string;
  /** where its emblem sits on the planetary map board art (pixels in the 971×772 board) */
  pin: { x: number; y: number };
};

export const CONTINENTS: readonly Continent[] = [
  { id: "veyloria", name: "Veyloria", epithet: "The Living Wilds", kind: "CONTINENT", lat: -4, lon: -27, size: 30, tier: "CORE", regions: ["veridan"], capital: "Rootholm", color: "#3f8f4e", majorCities: 4, scale: "Large", climate: "Tropical", pin: { x: 305, y: 405 },
    look: "Verdant Forest, river networks and jungle coastlines; Thalassia lies offshore. The game starts here." },
  { id: "aetheria", name: "Aetheria", epithet: "The Central Civilization", kind: "CONTINENT", lat: 16, lon: -8, size: 28, tier: "CORE", regions: ["nexus", "neon"], capital: "Meridian", color: "#5aa8d8", majorCities: 8, scale: "Large", climate: "Temperate", pin: { x: 432, y: 285 },
    look: "Nexus City and Neon City on opposing shores of a great gulf, joined by the Celestial Bridge; each has its own airport and seaport. Meridian is the public capital." },
  { id: "noctyra", name: "Noctyra", epithet: "The Veiled Dominion", kind: "CONTINENT", lat: 6, lon: 74, size: 22, tier: "BACKDROP", regions: [], capital: "Voidspire", color: "#b45cff", majorCities: 5, scale: "Medium", climate: "Temperate · rain", pin: { x: 862, y: 348 },
    look: "A mysterious, technologically advanced landmass of isolated territories and dimensional anomalies." },
  { id: "kharos", name: "Kharos", epithet: "The Burning Expanse", kind: "CONTINENT", lat: 0, lon: 34, size: 28, tier: "CORE", regions: ["solara", "wastelands"], capital: "Sandreach", color: "#d9973f", majorCities: 6, scale: "Large", climate: "Arid", pin: { x: 703, y: 393 },
    look: "Solara Desert, canyons, ancient ruins and a vast dry interior; rust, scrap and burned highways in the Wastelands." },
  { id: "frosthelm", name: "Frosthelm", epithet: "The Frozen Crown", kind: "CONTINENT", lat: 60, lon: 0, size: 30, tier: "CORE", regions: ["frostspire"], capital: "Hallowmere", color: "#a9d3ee", majorCities: 3, scale: "Large", climate: "Polar", pin: { x: 490, y: 78 },
    look: "Frost Spire, glaciers, frozen coastlines and polar settlements." },
  { id: "pyrrath", name: "Pyrrath", epithet: "The Molten Frontier", kind: "CONTINENT", lat: -25, lon: 30, size: 26, tier: "CORE", regions: ["ember"], capital: "Cinderforge", color: "#e0522a", majorCities: 3, scale: "Medium", climate: "Volcanic", pin: { x: 657, y: 565 },
    look: "Ember Peaks: volcanic mountains, lava fields and industrial settlements." },
  { id: "sylvaris", name: "Sylvaris", epithet: "The Emerald Depths", kind: "CONTINENT", lat: -28, lon: -28, size: 24, tier: "CORE", regions: ["swamps"], capital: "Mirewatch", color: "#2f9c86", majorCities: 3, scale: "Medium", climate: "Wetland", pin: { x: 315, y: 580 },
    look: "The Shrouded Swamps, bioluminescent wetlands and ancient forests." },
  { id: "zephyria", name: "Zephyria", epithet: "The Storm Archipelago", kind: "ARCHIPELAGO", lat: 48, lon: 70, size: 20, tier: "EXPANSION", regions: ["storm-islands"], capital: "Skyhold", color: "#7f8fd8", majorCities: 2, scale: "Small", climate: "Storm · alpine", pin: { x: 762, y: 128 },
    look: "Floating islands and stormfronts; the Storm Islands are its first playable ground." },
  { id: "elyndra", name: "Elyndra", epithet: "The Sapphire Isles", kind: "ARCHIPELAGO", lat: -16, lon: -74, size: 18, tier: "BACKDROP", regions: [], capital: "Port Azure", color: "#3fb6c9", majorCities: 5, scale: "Small", climate: "Tropical", pin: { x: 113, y: 500 },
    look: "Tropical islands, crystal waters and working harbours." },
  { id: "valdoria", name: "Valdoria", epithet: "The Great Plains", kind: "NATION", lat: 28, lon: 35, size: 26, tier: "BACKDROP", regions: [], capital: "Harrowfield", color: "#9cbf52", majorCities: 5, scale: "Large", climate: "Continental", pin: { x: 686, y: 225 },
    look: "A plains nation of open grassland, rivers and ancient ruins under big skies." },
  { id: "myrathis", name: "Myrathis", epithet: "The Forgotten Lands", kind: "SUBREGION", lat: 14, lon: -50, size: 20, tier: "BACKDROP", regions: [], capital: "Vel'Sora", color: "#8a9a7a", majorCities: 2, scale: "Medium", climate: "Highland mist", pin: { x: 191, y: 305 },
    look: "Ancient lands and forgotten realms: weathered stone and mist." },
  { id: "drakoria", name: "Drakoria", epithet: "The Shattered Peaks", kind: "NATION", lat: 38, lon: -48, size: 22, tier: "BACKDROP", regions: [], capital: "Cragmouth", color: "#8e8a86", majorCities: 3, scale: "Medium", climate: "Alpine", pin: { x: 250, y: 185 },
    look: "A highland nation of raw rock faces, industrial scaffolding and rough weather." },
];

/** the seven major continents (the rest of CONTINENTS are archipelagos, nations and subregions on the board) */
export const MAJOR_CONTINENTS = (): readonly Continent[] => CONTINENTS.filter((c) => c.kind === "CONTINENT");

export type OceanId = "azure-expanse" | "meridian-ocean" | "emerald-basin" | "tempest-sea" | "glacial-reach" | "obsidian-deep" | "fractured-abyss";
/** five major oceans; the Emerald Basin and the Fractured Abyss are seas within them (planet update) */
export const OCEANS: readonly { id: OceanId; name: string; lat: number; lon: number; character: string; major: boolean }[] = [
  { id: "azure-expanse", name: "Azure Expanse", lat: 2, lon: -82, character: "Main shipping and passenger routes along the western coasts", major: true },
  { id: "meridian-ocean", name: "Meridian Ocean", lat: -6, lon: 2, character: "Central trade routes; Thalassia lies in its waters off Veyloria's coast", major: true },
  { id: "emerald-basin", name: "Emerald Sea", lat: -46, lon: -46, character: "Tropical islands and reefs off Elyndra and Sylvaris", major: false },
  { id: "tempest-sea", name: "Tempest Ocean", lat: 36, lon: 80, character: "Storms and hard navigation around Zephyria", major: true },
  { id: "glacial-reach", name: "Glacial Reach", lat: 54, lon: -66, character: "Polar seas and drifting ice", major: true },
  { id: "obsidian-deep", name: "Obsidian Deep", lat: -50, lon: 6, character: "Deep trenches and dangerous water south of Pyrrath", major: true },
  { id: "fractured-abyss", name: "Fractured Abyss", lat: -24, lon: 82, character: "Underwater anomalies and late-game mysteries", major: false },
];

/** 48 nations (Aetheria's six as on the owner's board, three to five elsewhere). The first nation of each CORE continent holds its playable ground. */
const NATIONS_BY: Record<ContinentId, readonly string[]> = {
  aetheria: ["Meridian Republic", "Aether Concord", "Lumen Provinces", "Halcyon Reach", "Concord of Vale", "Skyline Accord"],
  veyloria: ["Free Wilds of Veyloria", "Thornmarch", "Riverhold Compact", "Greenmantle", "Canopy Kingdoms"],
  kharos: ["Kharosi Sun Dominion", "Wasteland Free Clans", "Dune Gate Emirates", "Canyon Accord", "Ashen Caravans"],
  elyndra: ["Sapphire Coast Federation", "Isle Kingdoms of Elyndra", "Coralport", "Tidewell", "Pearl Strand"],
  noctyra: ["Neon Syndicate Charter", "Noctyran Directorate", "Blacklight Free Port", "Voltmarch"],
  sylvaris: ["Sylvari Mire Council", "Mangrove Leagues", "Lantern Delta", "Fenreach"],
  valdoria: ["Valdorian Commonwealth", "Grainmarch", "Ironrail Freehold", "Sweeping Steppe"],
  frosthelm: ["Crown of Frosthelm", "Rimeguard", "Northern Ice Pact"],
  pyrrath: ["Pyrrathi Forge Union", "Cinder Marches", "Basalt Thanes"],
  zephyria: ["Zephyrian Highcourt", "Stormward Isles", "Thunderhold"],
  myrathis: ["Remnant of Myrathis", "Mistveil", "Temple Cantons"],
  drakoria: ["Drakorian Highlands", "Shatterpeak Holds", "Miner's Guildlands"],
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
export type WorldId = "aetheria" | "veyloria" | "sylvaris" | "kharos" | "frosthelm" | "pyrrath" | "thalassia";

/** Thalassia's own water: the city and the sea around it, plus the approach lane from Veyloria's elevator platform */
export const THALASSIA_ZONE_RADIUS = CITY_RADIUS + 140;

/** which continent world (x, z) belongs to; "thalassia" for the city's own water */
export function worldAt(x: number, z: number): WorldId {
  if (Math.hypot(x - THALASSIA_CENTER.x, z - THALASSIA_CENTER.z) < THALASSIA_ZONE_RADIUS) return "thalassia";
  let best = "veyloria", score = Infinity;
  for (const [id, anchors] of Object.entries(WORLD_ANCHORS)) for (const a of anchors) {
    const s = Math.hypot(x - a.x, z - a.z) - a.w;
    if (s < score) { score = s; best = id; }
  }
  return worldOfAnchor(best) as WorldId;
}
export const continentOfWorld = (w: WorldId): ContinentId => (w === "thalassia" ? "veyloria" : (w as ContinentId));

/** May you move from one world straight into another without a terminal? Only between Veyloria's coast and Thalassia's
 * water (by boat, sub or swimming): the city lies off that coast. Every other pair is a continental border. */
export function crossingAllowed(from: WorldId, to: WorldId): boolean {
  if (from === to) return true;
  const pair = [from, to].sort().join("|");
  return pair === "thalassia|veyloria";
}

/** a step from (x0, z0) to (x1, z1): blocked when it crosses a continental border */
export function borderBlocks(x0: number, z0: number, x1: number, z1: number): { blocked: boolean; from: WorldId; to: WorldId } {
  const from = worldAt(x0, z0), to = worldAt(x1, z1);
  return { blocked: !crossingAllowed(from, to), from, to };
}

/** the region ids (REGIONS + "neon") inside a world, for UI */
export const worldName = (w: WorldId): string => (w === "thalassia" ? "Thalassia · off Veyloria" : continentById(w)?.name ?? w);

/* ---------------- the planetary map board ---------------- */

/** the board art's size; pins and routes are drawn in its pixel space */
export const BOARD = { w: 971, h: 772 } as const;
/** Thalassia's marker on the board: in the sea just off Veyloria's east coast */
export const THALASSIA_PIN = { x: 392, y: 470 } as const;
/** air routes drawn on the planet map: every playable continent to its neighbours, Aetheria as the hub (as on the worldbuild board) */
export const AIR_ROUTES: readonly (readonly [ContinentId, ContinentId])[] = [
  ["aetheria", "veyloria"], ["aetheria", "frosthelm"], ["aetheria", "kharos"], ["aetheria", "pyrrath"], ["aetheria", "sylvaris"],
  ["veyloria", "sylvaris"], ["kharos", "pyrrath"],
];
