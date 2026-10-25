/** The planet (Stage 148, pure): World Fracture's super-Earth, its 12 continents, 7 oceans and 48 nations, and how the
 * playable world maps onto it. Design: "World Fracture — Planet Reconciliation" (owner decisions, Oct 25 2026): regions are
 * split onto separate continents with travel between them, the game starts on Veyloria (Verdant Forest), the Wastelands
 * sit on Kharos north of Solara, Aetheria's public capital is Meridian with Nexus City inside it, and Thalassia is NOT part
 * of any continent: it lies off Veyloria's coast in the Obsidian Deep, reached by an offshore elevator or an underwater
 * vehicle.
 *
 * In the live game every continent is a "world": the part of the map closest (weighted) to that continent's anchors.
 * You cannot walk, drive, sail or fly from one continent world into another; you travel between them from a transit
 * terminal (travel.ts) or by deploying from the planet map. Thalassia, the Storm Islands, interiors and descents are free
 * spaces with their own ways in. Pure; tested in planet.test.ts. */
import { NEON_SITE, REGIONS } from "./world";
import { THALASSIA_CENTER } from "./thalassia-site";
import { CITY_RADIUS } from "./thalassia-sectors";

export const PLANET = {
  name: "Veyra",
  diameterKm: 16500,
  /** 4πr² for the stated diameter */
  surfaceKm2: Math.round(4 * Math.PI * (16500 / 2) ** 2),
  /** a real super-Earth of Earth density would pull ~1.3 g; the simulation holds it at 1 g, which is why Fracture zones can break it */
  gravityG: 1,
} as const;

export type ContinentId = "aetheria" | "kharos" | "veyloria" | "noctyra" | "frosthelm" | "pyrrath" | "elyndra" | "valdoria" | "myrathis" | "drakoria" | "sylvaris" | "zephyria";
/** CORE: built and playable now; EXPANSION: one region at a time, later; BACKDROP: on the map (nations, lore, events), not walkable yet */
export type PlayTier = "CORE" | "EXPANSION" | "BACKDROP";

export type Continent = {
  id: ContinentId;
  name: string;
  epithet: string;
  /** globe position of its heart, degrees (planet map) */
  lat: number; lon: number;
  /** rough extent on the globe, degrees of arc */
  size: number;
  tier: PlayTier;
  /** the game's regions on it (world.ts REGIONS ids, plus "neon" for Neon City) */
  regions: readonly string[];
  capital: string;
  look: string;
  color: string;
};

export const CONTINENTS: readonly Continent[] = [
  { id: "veyloria", name: "Veyloria", epithet: "The Living Wilds", lat: 4, lon: -38, size: 34, tier: "CORE", regions: ["veridan"], capital: "Rootholm", color: "#3f8f4e",
    look: "Real old-growth forest and rivers, grounded and damp; glow only at Fracture tears. The game starts here." },
  { id: "aetheria", name: "Aetheria", epithet: "The Central Civilization", lat: 18, lon: 8, size: 30, tier: "CORE", regions: ["nexus"], capital: "Meridian", color: "#5aa8d8",
    look: "A grounded modern metropolis on the surface. Meridian is the public capital; Nexus City sits inside it." },
  { id: "noctyra", name: "Noctyra", epithet: "The Neon Dominion", lat: 22, lon: 62, size: 26, tier: "CORE", regions: ["neon"], capital: "Neon City", color: "#b45cff",
    look: "The one place for full neon cyberpunk saturation: wet streets, signage, haze." },
  { id: "kharos", name: "Kharos", epithet: "The Burning Expanse", lat: -14, lon: 44, size: 36, tier: "CORE", regions: ["solara", "wastelands"], capital: "Sandreach", color: "#d9973f",
    look: "Sun-bleached sandstone in Solara to the south; rust, scrap and burned highways in the Wastelands to the north." },
  { id: "frosthelm", name: "Frosthelm", epithet: "The Frozen Crown", lat: 62, lon: 4, size: 30, tier: "CORE", regions: ["frostspire"], capital: "Hallowmere", color: "#a9d3ee",
    look: "Hard blue-grey ice, military outposts, whiteout storms." },
  { id: "pyrrath", name: "Pyrrath", epithet: "The Molten Frontier", lat: -40, lon: 58, size: 26, tier: "CORE", regions: ["ember"], capital: "Cinderforge", color: "#e0522a",
    look: "Black basalt, ash fall, lava glow as the only warm light." },
  { id: "sylvaris", name: "Sylvaris", epithet: "The Emerald Depths", lat: -44, lon: -16, size: 24, tier: "CORE", regions: ["swamps"], capital: "Mirewatch", color: "#2f9c86",
    look: "Murky, fog-heavy wetlands; faint, sickly bioluminescence, not neon." },
  { id: "zephyria", name: "Zephyria", epithet: "The Storm Frontier", lat: 52, lon: 70, size: 22, tier: "EXPANSION", regions: ["storm-islands"], capital: "Skyhold", color: "#7f8fd8",
    look: "Real storm plateaus first; the floating Storm Islands are its first playable ground." },
  { id: "elyndra", name: "Elyndra", epithet: "The Sapphire Coast", lat: -24, lon: -66, size: 22, tier: "BACKDROP", regions: [], capital: "Port Azure", color: "#3fb6c9",
    look: "Realistic tropical coast and working harbours." },
  { id: "valdoria", name: "Valdoria", epithet: "The Great Plains", lat: 40, lon: 38, size: 28, tier: "BACKDROP", regions: [], capital: "Harrowfield", color: "#9cbf52",
    look: "Open grassland under big skies; the cracked moon reads clearly here." },
  { id: "myrathis", name: "Myrathis", epithet: "The Forgotten Lands", lat: 30, lon: -56, size: 24, tier: "BACKDROP", regions: [], capital: "Vel'Sora", color: "#8a9a7a",
    look: "Weathered stone and mist; the most mythic look, still photographic." },
  { id: "drakoria", name: "Drakoria", epithet: "The Shattered Peaks", lat: 54, lon: -40, size: 26, tier: "BACKDROP", regions: [], capital: "Cragmouth", color: "#8e8a86",
    look: "Raw rock faces, industrial scaffolding, rough weather." },
];

export type OceanId = "azure-expanse" | "meridian-ocean" | "emerald-basin" | "tempest-sea" | "glacial-reach" | "obsidian-deep" | "fractured-abyss";
export const OCEANS: readonly { id: OceanId; name: string; lat: number; lon: number; character: string }[] = [
  { id: "azure-expanse", name: "Azure Expanse", lat: -6, lon: -62, character: "Main shipping and passenger routes" },
  { id: "meridian-ocean", name: "Meridian Ocean", lat: 2, lon: 28, character: "Central trade routes around Aetheria" },
  { id: "emerald-basin", name: "Emerald Basin", lat: -38, lon: -48, character: "Tropical islands and reefs" },
  { id: "tempest-sea", name: "Tempest Sea", lat: 40, lon: 86, character: "Storms and hard navigation around Zephyria" },
  { id: "glacial-reach", name: "Glacial Reach", lat: 74, lon: -20, character: "Polar seas and drifting ice off Frosthelm" },
  { id: "obsidian-deep", name: "Obsidian Deep", lat: -6, lon: -14, character: "Trenches off Veyloria's coast; Thalassia lies in its depths" },
  { id: "fractured-abyss", name: "Fractured Abyss", lat: -58, lon: 84, character: "Underwater anomalies and late-game mysteries" },
];

/** 48 nations, four per continent. The first nation of each CORE continent holds its playable ground. */
const NATIONS_BY: Record<ContinentId, readonly string[]> = {
  veyloria: ["Free Wilds of Veyloria", "Thornmarch", "Riverhold Compact", "Greenmantle"],
  aetheria: ["Meridian Republic", "Aether Concord", "Lumen Provinces", "Halcyon Reach"],
  noctyra: ["Neon Syndicate Charter", "Noctyran Directorate", "Blacklight Free Port", "Voltmarch"],
  kharos: ["Kharosi Sun Dominion", "Wasteland Free Clans", "Dune Gate Emirates", "Canyon Accord"],
  frosthelm: ["Crown of Frosthelm", "Rimeguard", "Northern Ice Pact", "Hallow Steppes"],
  pyrrath: ["Pyrrathi Forge Union", "Cinder Marches", "Basalt Thanes", "Emberline"],
  sylvaris: ["Sylvari Mire Council", "Mangrove Leagues", "Lantern Delta", "Fenreach"],
  zephyria: ["Zephyrian Highcourt", "Stormward Isles", "Thunderhold", "Gale Reaches"],
  elyndra: ["Sapphire Coast Federation", "Isle Kingdoms of Elyndra", "Coralport", "Tidewell"],
  valdoria: ["Valdorian Commonwealth", "Grainmarch", "Ironrail Freehold", "Sweeping Steppe"],
  myrathis: ["Remnant of Myrathis", "Mistveil", "Temple Cantons", "Old Sora"],
  drakoria: ["Drakorian Highlands", "Shatterpeak Holds", "Miner's Guildlands", "Cragwatch"],
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

/** a continent's pull on the map: the map point belongs to the anchor with the least (distance − weight) */
type Anchor = { x: number; z: number; w: number };
const R = (id: string) => REGIONS.find((r) => r.id === id)!;
const at = (id: string, w: number): Anchor => ({ x: R(id).x, z: R(id).z, w });
/** Weights are tuned so every border runs through open country between cities, never through one (planet.test.ts checks
 * every region centre, Neon City's whole plateau, the Nexus hub and its suburb, and every landmark). */
export const WORLD_ANCHORS: Readonly<Record<string, readonly Anchor[]>> = {
  aetheria: [at("nexus", 194), { x: R("nexus").x, z: R("nexus").z + 155, w: 175 }],
  noctyra: [{ x: NEON_SITE.x, z: NEON_SITE.z, w: 275 }],
  veyloria: [at("veridan", 204)],
  sylvaris: [at("swamps", 180)],
  kharos: [at("solara", 264), at("wastelands", 252)],
  frosthelm: [at("frostspire", 240)],
  pyrrath: [at("ember", 180)],
};
export type WorldId = keyof typeof WORLD_ANCHORS | "thalassia";

/** Thalassia's own water: the city and the sea around it, plus the approach lane from Veyloria's elevator platform */
export const THALASSIA_ZONE_RADIUS = CITY_RADIUS + 140;

/** which continent world (x, z) belongs to; "thalassia" for the city's own water */
export function worldAt(x: number, z: number): WorldId {
  if (Math.hypot(x - THALASSIA_CENTER.x, z - THALASSIA_CENTER.z) < THALASSIA_ZONE_RADIUS) return "thalassia";
  let best: WorldId = "veyloria", score = Infinity;
  for (const [id, anchors] of Object.entries(WORLD_ANCHORS)) for (const a of anchors) {
    const s = Math.hypot(x - a.x, z - a.z) - a.w;
    if (s < score) { score = s; best = id as WorldId; }
  }
  return best;
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
export const worldName = (w: WorldId): string => (w === "thalassia" ? "Thalassia · Obsidian Deep" : continentById(w)?.name ?? w);
