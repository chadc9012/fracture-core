/**
 * Region atlas: the named districts and sites of every city and region, laid out after the owner's map boards
 * (Neon City · Nexus City · Thalassia · Verdant Forest · Wastelands · Frost Peaks · Scorched Plains · Crystal Badlands ·
 * Storm Islands). Pure data + lookups shared by the map (district labels and site icons with a legend), the HUD
 * ("Entering Casino Row") and the world (each site stands a set piece of its kind, SiteMarkers.tsx).
 *
 * The game's regions keep their ids; the boards' names map onto them: Frostspire = Frost Peaks, Ember = Scorched Plains,
 * Solara = Crystal Badlands. Cities use metre offsets from their centre; wilderness sites use fractions of the region
 * radius and are pulled toward the centre until they stand on dry ground, so nothing sits in the sea.
 */
import { REGIONS, NEON_OFFSET } from "./world";
import { THALASSIA_CENTER } from "./thalassia-site";
import { heightAt, WATER_LEVEL } from "./terrain";
import { venueLots } from "./nightlife";
import { STORM_ISLAND_SITES, stormSiteWorld } from "./storm-islands";
import { neonTowersWorld } from "./neon-layout";
import { neonKeepOut } from "./residences";

export type SiteKind =
  | "district" | "shop" | "nightclub" | "lounge" | "casino" | "mall" | "metro" | "dock" | "garage" | "plaza" | "palace" | "campus" | "government" | "farm" | "research"
  | "camp" | "outpost" | "cave" | "temple" | "ruins" | "village" | "spire" | "lake" | "falls" | "field" | "highway" | "crater" | "scrapyard" | "station" | "grove" | "forge";

export type Site = {
  id: string; name: string; regionId: string; kind: SiteKind;
  x: number; z: number; radius: number;
  /** one line for the map card and the arrival toast */
  blurb: string;
};

/** board-style glyph and colour per kind (legend and pins draw from this one table) */
export const SITE_STYLE: Record<SiteKind, { glyph: string; color: string; label: string }> = {
  district: { glyph: "▦", color: "#9fe8ff", label: "District" }, shop: { glyph: "¤", color: "#ffcf3a", label: "Shop" },
  nightclub: { glyph: "♫", color: "#b968ff", label: "Nightclub" }, lounge: { glyph: "✧", color: "#ff3b9d", label: "Lounge (21+)" },
  casino: { glyph: "♠", color: "#ffb347", label: "Casino" }, mall: { glyph: "▤", color: "#ff6a6a", label: "Mall" },
  metro: { glyph: "Ⓜ", color: "#38e8ff", label: "Metro station" }, dock: { glyph: "⚓", color: "#7fd8ff", label: "Dock / harbor" },
  garage: { glyph: "⛽", color: "#9aa3ad", label: "Garage" }, plaza: { glyph: "◎", color: "#ffd27a", label: "Plaza" },
  palace: { glyph: "♛", color: "#ffd27a", label: "Palace" }, campus: { glyph: "✎", color: "#b0d8ff", label: "University" },
  government: { glyph: "⌂", color: "#e8e6df", label: "Government" }, farm: { glyph: "❀", color: "#7ce07a", label: "Farms" },
  research: { glyph: "⚗", color: "#7ae8d8", label: "Research" }, camp: { glyph: "⛺", color: "#ff7a2e", label: "Camp" },
  outpost: { glyph: "▣", color: "#d7b9a2", label: "Outpost" }, cave: { glyph: "◖", color: "#a0a8b8", label: "Cave entrance" },
  temple: { glyph: "⛩", color: "#e0c070", label: "Temple" }, ruins: { glyph: "⌂", color: "#c8b48a", label: "Ruins" },
  village: { glyph: "⌂", color: "#9be78a", label: "Village" }, spire: { glyph: "▲", color: "#c79bff", label: "Spire" },
  lake: { glyph: "◒", color: "#7fc8ff", label: "Lake" }, falls: { glyph: "≋", color: "#7fd8ff", label: "Falls" },
  field: { glyph: "∴", color: "#e0b070", label: "Fields" }, highway: { glyph: "═", color: "#f3e2b0", label: "Highway" },
  crater: { glyph: "◌", color: "#ff946d", label: "Crater" }, scrapyard: { glyph: "⚙", color: "#b8a080", label: "Scrapyard" },
  station: { glyph: "⌖", color: "#c2e7ff", label: "Station" }, grove: { glyph: "♣", color: "#6fd36a", label: "Grove" },
  forge: { glyph: "⚒", color: "#ff7a3a", label: "Forge" },
};

/** the boards' names for the game's regions */
export const BOARD_NAME: Record<string, string> = { nexus: "Nexus City", neon: "Neon City", thalassia: "Thalassia", veridan: "Verdant Forest", wastelands: "Wastelands", frostspire: "Frost Peaks", ember: "Scorched Plains", solara: "Crystal Badlands", swamps: "Shrouded Swamps", storm: "Storm Islands" };

const R = (id: string) => REGIONS.find((r) => r.id === id)!;
const NEXUS = R("nexus");
export const NEON_CENTER = { x: NEXUS.x + NEON_OFFSET.x, z: NEXUS.z + NEON_OFFSET.z };

type CitySpec = [id: string, name: string, kind: SiteKind, dx: number, dz: number, radius: number, blurb: string];
type WildSpec = [id: string, name: string, kind: SiteKind, fx: number, fz: number, blurb: string];

const NEON: CitySpec[] = [
  ["neon-downtown", "Downtown", "district", 0, -62, 34, "Corporate towers around the Aegis Spire; the city's money lives here."],
  ["neon-luxury", "Luxury District", "district", -78, -74, 30, "Penthouses, private elevators and a skyline you pay to look at."],
  ["neon-residential", "Residential", "district", 76, -72, 30, "Stacked apartments and the corner stores that keep them fed."],
  ["neon-casino-row", "Casino Row", "casino", -92, -6, 28, "Crown Casino's lights over the street; the Undercity runs beneath it."],
  ["neon-strip", "The Strip", "district", 88, 6, 30, "Billboards, transit decks and traffic that never sleeps."],
  ["neon-nightlife", "Nightlife District", "nightclub", -4, 58, 30, "Pulse Array, Afterglow and Velvet Circuit share one loud block."],
  ["neon-industrial", "Industrial", "scrapyard", 82, 82, 30, "Fabricators and power plants humming behind the neon."],
  ["neon-harbor", "Harbor & Docks", "dock", -84, 84, 30, "Cargo cranes, yachts and the coast road out of town."],
  ["neon-mall", "Shopping Mall", "mall", 40, -24, 16, "Three levels of storefronts under one glass roof."],
  ["neon-metro", "Metro Station", "metro", -36, 18, 12, "Maglev lines to every district."],
  ["neon-pulse-array", "Pulse Array", "nightclub", 16, 46, 10, "Electronic nightclub: the main floor shakes the street."],
  ["neon-afterglow", "Afterglow", "nightclub", -28, 46, 10, "Underground nightclub in red and gold."],
  ["neon-velvet-circuit", "Velvet Circuit", "lounge", 30, 70, 10, "21+ cabaret lounge."],
  ["neon-crown-casino", "Crown Casino", "casino", -96, -26, 12, "Gold doors, high tables and higher debts."],
];

const NEXUS_SITES: CitySpec[] = [
  ["nexus-capital", "Capital District", "government", 0, -64, 34, "The Director's council towers; the city is governed from here."],
  ["nexus-government", "Government District", "government", -48, -46, 26, "Ministries and archives along the north boulevard."],
  ["nexus-university", "University District", "campus", 48, -46, 26, "Lecture towers, labs and the old library."],
  ["nexus-business", "Business District", "district", 66, 4, 30, "Trading floors and corporate lobbies."],
  ["nexus-residential", "Residential Heights", "district", -66, 4, 30, "Terraced homes and garden towers."],
  ["nexus-mall", "Nexus Mall", "mall", 46, 50, 22, "The city's shopping galleria."],
  ["nexus-harbor", "Harbor District", "dock", 0, 72, 30, "Shipyards and the coast road."],
  ["nexus-central-plaza", "Central Plaza", "plaza", 0, 0, 14, "The safe zone's heart, under the stability dome."],
];

const WILD: Record<string, WildSpec[]> = {
  wastelands: [
    ["wl-scrapyard", "Scrapyard", "scrapyard", -0.55, -0.35, "Mountains of wrecks, picked over by everyone."],
    ["wl-dust-rose", "Dust Rose", "lounge", 0.45, 0.4, "21+ wasteland cabaret: rope lights and rust."],
    ["wl-raider-camps", "Raider Camps", "camp", -0.45, 0.25, "Spiked walls and burning barrels."],
    ["wl-crater", "The Crater", "crater", 0.15, 0.6, "Where something fell before the Fracture."],
    ["wl-old-highway", "Old Highway", "highway", 0.55, -0.15, "Broken lanes and abandoned convoys."],
    ["wl-ancient-site", "Ancient Site", "ruins", -0.1, -0.62, "Arches older than any map."],
    ["wl-town", "Wasteland Town", "village", 0.1, -0.25, "A trading town behind sheet-metal walls."],
  ],
  veridan: [
    ["vf-north-grove", "North Grove", "grove", 0.05, -0.62, "The oldest stand of trees in the forest."],
    ["vf-elder-tree", "Elder Tree", "grove", 0.45, -0.35, "A trunk wide as a house, roots in every story."],
    ["vf-village", "Forest Village", "village", -0.4, -0.15, "Tree homes and rope bridges."],
    ["vf-lumina-falls", "Lumina Falls", "falls", 0.55, 0.15, "Water that glows at dusk."],
    ["vf-ruins", "Ancient Ruins", "ruins", 0.15, 0.3, "Moss-eaten stones from before the trees."],
    ["vf-canopy", "The Canopy", "grove", -0.55, 0.35, "Walkways high in the branches."],
    ["vf-sanctuary", "Wildlife Sanctuary", "field", 0.3, 0.6, "Meadows the animals still trust."],
    ["vf-grotto", "Hidden Grotto", "cave", -0.2, 0.62, "A cave behind a curtain of vines."],
  ],
  frostspire: [
    ["fp-summit", "Summit", "spire", 0.05, -0.25, "The top of the world, wind and silence."],
    ["fp-frosthold", "Frosthold", "village", -0.45, -0.3, "A stone fortress-town in the pass."],
    ["fp-ice-caverns", "Ice Caverns", "cave", 0.55, -0.2, "Blue light through a mile of ice."],
    ["fp-glacial-lake", "Glacial Lake", "lake", -0.15, 0.5, "Black water under a white lid."],
    ["fp-research", "Research Station", "research", 0.4, 0.3, "Domes and antennas studying the cold."],
    ["fp-snowfields", "Snowfields", "field", -0.55, 0.15, "Open snow; tracks fill in by morning."],
    ["fp-temple", "Ancient Temple", "temple", 0.15, 0.68, "Carved doors the frost never covers."],
  ],
  ember: [
    ["sp-fire-spire", "Fire Spire", "spire", 0.1, -0.5, "A black needle venting flame."],
    ["sp-obsidian-ruins", "Obsidian Ruins", "ruins", -0.5, 0.1, "A glass city, half melted."],
    ["sp-magma-fields", "Magma Fields", "field", 0.35, 0.15, "Crust over fire; step lightly."],
    ["sp-lava-caverns", "Lava Caverns", "cave", -0.2, -0.3, "Tunnels lit from below."],
    ["sp-basalt-canyons", "Basalt Canyons", "field", 0.45, 0.5, "Hexagon cliffs and hot wind."],
    ["sp-ash-outpost", "Ash Outpost", "outpost", -0.45, 0.5, "Traders who sell water and lies."],
    ["sp-ancient-forge", "Ancient Forge", "forge", 0.05, 0.2, "An anvil the size of a hall."],
  ],
  solara: [
    ["cb-crystal-spire", "Crystal Spire", "spire", 0.0, -0.5, "A tower of violet crystal humming in the sun."],
    ["cb-shattered-fields", "Shattered Fields", "field", 0.45, -0.2, "Crystal shards across the dunes."],
    ["cb-refraction-city", "Refraction City", "village", -0.4, -0.2, "Houses cut from crystal; light bends in the streets."],
    ["cb-mirage-dunes", "Mirage Dunes", "field", 0.3, 0.45, "Dunes that show you things that are not there."],
    ["cb-crystal-caverns", "Crystal Caverns", "cave", -0.45, 0.35, "Glowing geodes under the sand."],
    ["cb-sinkhole", "The Sinkhole", "crater", 0.05, 0.62, "The desert falling into itself."],
  ],
  swamps: [
    ["ss-boardwalks", "Boardwalk Town", "village", -0.35, -0.3, "Houses on stilts over black water."],
    ["ss-drowned-ruins", "Drowned Ruins", "ruins", 0.3, -0.25, "Columns standing in the mire."],
    ["ss-mangrove-maze", "Mangrove Maze", "grove", 0.4, 0.35, "Roots that move when you don't watch."],
    ["ss-ferry-dock", "Ferry Dock", "dock", -0.5, 0.3, "Airboats to the coast and back."],
  ],
};

const THAL: CitySpec[] = [
  ["th-royal-palace", "Royal Palace", "palace", 0, -40, 16, "Golden spires under the sea."],
  ["th-central-plaza", "Central Plaza", "plaza", 0, 0, 12, "Fountains of light at the city's heart."],
  ["th-market", "Market District", "shop", -34, 14, 14, "Stalls under glass domes."],
  ["th-residential", "Residential District", "district", -36, -22, 14, "Bubble homes and coral gardens."],
  ["th-garden", "Garden District", "grove", -18, -30, 12, "Kelp and flower terraces."],
  ["th-entertainment", "Entertainment District", "nightclub", 34, 12, 14, "Siren nightclub, Poseidon's Play casino and the Pearl."],
  ["th-research", "Research District", "research", 36, -22, 14, "Labs at the edge of the Abyssal Gate."],
  ["th-aqua-farms", "Aqua Farms", "farm", 40, 34, 14, "Kelp rows and fish pens."],
  ["th-arcadia", "Arcadia Mall", "mall", 16, 36, 12, "Shops under a jellyfish chandelier."],
  ["th-port", "Nexus Port", "dock", -10, 44, 14, "Submarines and transit to the surface."],
];

function dry(x: number, z: number, cx: number, cz: number): { x: number; z: number } {
  let px = x, pz = z;
  for (let i = 0; i < 12 && heightAt(px, pz) < WATER_LEVEL + 1; i++) { px += (cx - px) * 0.15; pz += (cz - pz) * 0.15; }
  return { x: px, z: pz };
}

function build(): Site[] {
  const out: Site[] = [];
  // the nightlife venues stand on the tower lots they take over (nightlife.ts), so the map pin is on the building
  const lots = new Map(venueLots(neonTowersWorld(neonKeepOut())).map((l) => [`neon-${l.venue.id}`, l]));
  for (const [id, name, kind, dx, dz, radius, blurb] of NEON) {
    const lot = lots.get(id);
    out.push({ id, name, kind, regionId: "neon", x: lot ? lot.x : NEON_CENTER.x + dx, z: lot ? lot.z : NEON_CENTER.z + dz, radius, blurb });
  }
  for (const [id, name, kind, dx, dz, radius, blurb] of NEXUS_SITES) out.push({ id, name, kind, regionId: "nexus", x: NEXUS.x + dx, z: NEXUS.z + dz, radius, blurb });
  for (const [id, name, kind, dx, dz, radius, blurb] of THAL) out.push({ id, name, kind, regionId: "thalassia", x: THALASSIA_CENTER.x + dx, z: THALASSIA_CENTER.z + dz, radius, blurb });
  for (const [rid, list] of Object.entries(WILD)) {
    const r = R(rid);
    for (const [id, name, kind, fx, fz, blurb] of list) {
      const p = dry(r.x + fx * r.radius, r.z + fz * r.radius, r.x, r.z);
      out.push({ id, name, kind, regionId: rid, x: p.x, z: p.z, radius: Math.max(24, r.radius * 0.12), blurb });
    }
  }
  const STORM_KIND: Record<string, SiteKind> = { landing: "dock", outpost: "station", ruins: "ruins", nest: "camp", temple: "temple", "storm-core": "spire" };
  for (const st of STORM_ISLAND_SITES) { const w = stormSiteWorld(st); out.push({ id: `storm-${st.id}`, name: st.name, kind: STORM_KIND[st.kind] ?? "ruins", regionId: "storm", x: w.x, z: w.z, radius: 40, blurb: st.description }); }
  return out;
}

export const SITES: readonly Site[] = build();
export const sitesIn = (regionId: string) => SITES.filter((s) => s.regionId === regionId);
export const siteById = (id: string) => SITES.find((s) => s.id === id);

/** the named place the player stands in: the smallest site whose radius covers the point (a venue inside a district wins) */
export function siteAt(x: number, z: number): Site | null {
  let best: Site | null = null;
  for (const s of SITES) if (Math.hypot(x - s.x, z - s.z) <= s.radius && (!best || s.radius < best.radius)) best = s;
  return best;
}

/** kinds that actually appear, in a stable legend order */
export function legendKinds(sites: readonly Site[] = SITES): SiteKind[] {
  const used = new Set(sites.map((s) => s.kind));
  return (Object.keys(SITE_STYLE) as SiteKind[]).filter((k) => used.has(k));
}
