/** World landmarks: the tent poles of each region. Pure data + helpers shared by the compass, minimap, atlas and
 * discovery. Positions are offsets from the region centre (fractions of its radius), so they follow REGIONS and
 * every probed spot sits above WATER_LEVEL. Discovery is stored in the existing claim ledger
 * (progression.earnedRewards, cloud-merged by union) as `landmark-seen:<id>`; it grants nothing but map knowledge
 * and story text, so it can never farm rewards. */
import { REGIONS, NEON_OFFSET, WORLD_SCALE } from "./world";
import { THALASSIA_CENTER } from "./thalassia-site";
import type { PlayerProgression } from "./progression";

export type LandmarkType = "hub" | "outpost" | "ruin" | "mountain" | "volcano" | "lake" | "river" | "forest" | "desert" | "ocean" | "hazard" | "resource";

export interface Landmark {
  id: string;
  name: string;
  regionId: string | "neon" | "thalassia";
  type: LandmarkType;
  x: number;
  z: number;
  /** one line shown on discovery and in the atlas: what stands here and what happened before the story began */
  history: string;
}

type Spec = { id: string; name: string; regionId: string; type: LandmarkType; dx: number; dz: number; history: string };

const SPECS: Spec[] = [
  { id: "vanguard-outpost", name: "Vanguard Outpost Alpha", regionId: "veridan", type: "outpost", dx: 0.35, dz: 0.55, history: "The first survey camp raised after the Fracture. Its crew went into the canopy to map the tears and the radio has only carried birdsong since." },
  { id: "whispering-canopies", name: "Whispering Canopies", regionId: "veridan", type: "forest", dx: -0.55, dz: -0.2, history: "Old growth that kept growing while the sky broke. Hunters say the leaves repeat the last words spoken beneath them." },
  { id: "fracture-grottos", name: "Fracture-Tear Grottos", regionId: "veridan", type: "hazard", dx: 0.1, dz: -0.6, history: "Where the ground split cleanly and the caves inside do not match the hill above them." },
  { id: "magma-forge", name: "Magma-Forge Caldera", regionId: "ember", type: "volcano", dx: 0, dz: 0, history: "The Foundry Guild forged the first Anchor plating here before the mountain woke. The forges still run; nobody is left to stoke them." },
  { id: "obsidian-ridge", name: "Obsidian Ridge", regionId: "ember", type: "mountain", dx: -0.55, dz: 0.35, history: "A black glass spine cooled in a single night. Scavengers cut blades from it and do not say what the blades remember." },
  { id: "smoldering-trench", name: "Smoldering Trench", regionId: "ember", type: "hazard", dx: 0.5, dz: -0.4, history: "A fault line that never stopped burning. Convoys detour a day's drive around it." },
  { id: "summit-array", name: "Summit Communication Array", regionId: "frostspire", type: "outpost", dx: 0, dz: -0.1, history: "The last tower to answer the Fracture signal. It still transmits, on a frequency no one assigned." },
  { id: "glacial-crevasse", name: "Glacial Crevasse Network", regionId: "frostspire", type: "hazard", dx: -0.5, dz: 0.4, history: "Ice that split along the Fracture lines and froze open. The blue depths hold wrecked expedition sleds." },
  { id: "avalanche-run", name: "Avalanche Danger Zone", regionId: "frostspire", type: "hazard", dx: 0.45, dz: 0.35, history: "A slope loosened by the array's pulses. It lets go without warning to anyone not listening for it." },
  { id: "aether-lift", name: "Aether-Lift Station", regionId: "frostspire", type: "outpost", dx: 0.3, dz: -0.5, history: "A cable lift built to carry cargo to the summit. It now carries only the cold." },
  { id: "scrap-outpost", name: "Scrap-Outpost Alpha", regionId: "wastelands", type: "outpost", dx: -0.3, dz: 0.3, history: "Raiders and honest salvagers share this wall under an uneasy truce, and both sell the same scrap back to the Nexus." },
  { id: "grid-iron-highway", name: "Grid-Iron Highway", regionId: "wastelands", type: "river", dx: 0.4, dz: 0.1, history: "The old trunk road, flattened by the Fracture and re-laid by whoever needed it most." },
  { id: "convoy-sprint", name: "The Convoy Sprint", regionId: "wastelands", type: "resource", dx: 0, dz: -0.5, history: "A long straight where supply runs race the dust storms. The wrecks along it mark the runs that lost." },
  { id: "solar-array", name: "Solar Array Alpha", regionId: "solara", type: "resource", dx: 0.1, dz: -0.3, history: "Mirror fields that once powered half the coast. They still gather light, and now they aim it." },
  { id: "glass-flats", name: "The Glass Flats", regionId: "solara", type: "desert", dx: -0.5, dz: 0.4, history: "Sand fused by a single flare. Footprints from before the Fracture are still pressed into it." },
  { id: "sunken-arcology", name: "Sunken Arcology Vaults", regionId: "solara", type: "ruin", dx: 0.5, dz: 0.35, history: "A habitat tower that sank in the dunes, vault doors still sealed from inside." },
  { id: "quicksand-basin", name: "Moving Quicksand Basin", regionId: "solara", type: "hazard", dx: -0.2, dz: 0.6, history: "Dunes that shift on a schedule nobody has worked out. Maps of it go stale within a day." },
  { id: "airboat-hub", name: "Airboat Transit Hub", regionId: "swamps", type: "outpost", dx: -0.5, dz: -0.3, history: "Boardwalk stations strung across the bog. The boats still run to a timetable written before the water rose." },
  { id: "weeping-mangroves", name: "Weeping Mangroves", regionId: "swamps", type: "forest", dx: 0.3, dz: 0.4, history: "Roots that bleed amber sap into the mire. The sap is a catalyst, and it is also a lure." },
  { id: "temple-of-echoes", name: "Sunken Temple of Echoes", regionId: "swamps", type: "ruin", dx: 0.1, dz: -0.5, history: "A shrine that predates the Fracture and answers questions no one asked aloud." },
  { id: "spatial-sink", name: "Spatial Sink", regionId: "swamps", type: "hazard", dx: 0.5, dz: -0.1, history: "A place where distance folds. Things dropped in arrive somewhere else, usually somewhere worse." },
  { id: "transit-plaza", name: "Central Transit Plaza", regionId: "nexus", type: "hub", dx: 0, dz: 0, history: "The first place the Fracture refugees gathered. Every route out of the safe zone starts under its clock." },
  { id: "spire-district", name: "Spire District", regionId: "nexus", type: "hub", dx: 0.3, dz: -0.4, history: "Tower blocks of the old council. The Director governs from the top floor." },
  { id: "scrapyard-bazaar", name: "Scrapyard Bazaar", regionId: "nexus", type: "resource", dx: -0.4, dz: 0.5, history: "A market built on whatever the Wastelands send back. Everything has a price and a story." },
  { id: "aqua-shipyard", name: "Aqua-Tech Shipyard", regionId: "nexus", type: "outpost", dx: 0.2, dz: 0.7, history: "Hulls laid down for a sea that moved. The slipways face a coast that is no longer there." },
];

const regionOf = (id: string) => REGIONS.find((r) => r.id === id)!;
const nexus = regionOf("nexus");
const thalassia = THALASSIA_CENTER;

export const LANDMARKS: Landmark[] = [
  ...SPECS.map((s): Landmark => { const r = regionOf(s.regionId); return { id: s.id, name: s.name, regionId: s.regionId, type: s.type, x: r.x + s.dx * r.radius, z: r.z + s.dz * r.radius, history: s.history }; }),
  { id: "neon-city", name: "Neon City", regionId: "neon", type: "hub", x: nexus.x + NEON_OFFSET.x, z: nexus.z + NEON_OFFSET.z, history: "The district that kept its lights on through the Fracture, for reasons its owners will not explain." },
  { id: "thalassia", name: "Thalassia", regionId: "thalassia", type: "ocean", x: thalassia.x, z: thalassia.z, history: "A drowned city below the surface, still lit. Whatever keeps it lit does not want visitors." },
];

export const landmarkById = (id: string) => LANDMARKS.find((l) => l.id === id);
export const landmarksIn = (regionId: string) => LANDMARKS.filter((l) => l.regionId === regionId);

/** Landmark-to-landmark trails (the backbone). Edges only; Atlas draws them, the compass can point along them. */
export const LANDMARK_ROUTES: [string, string][] = [
  ["transit-plaza", "spire-district"], ["transit-plaza", "scrapyard-bazaar"], ["transit-plaza", "aqua-shipyard"], ["spire-district", "neon-city"],
  ["scrapyard-bazaar", "scrap-outpost"], ["scrap-outpost", "grid-iron-highway"], ["grid-iron-highway", "convoy-sprint"], ["convoy-sprint", "summit-array"],
  ["summit-array", "aether-lift"], ["summit-array", "glacial-crevasse"], ["aether-lift", "avalanche-run"],
  ["glass-flats", "quicksand-basin"], ["temple-of-echoes", "spatial-sink"],
  ["scrap-outpost", "solar-array"], ["solar-array", "glass-flats"], ["solar-array", "sunken-arcology"],
  ["aqua-shipyard", "airboat-hub"], ["airboat-hub", "weeping-mangroves"], ["airboat-hub", "temple-of-echoes"],
  ["transit-plaza", "vanguard-outpost"], ["vanguard-outpost", "whispering-canopies"], ["whispering-canopies", "fracture-grottos"],
  ["scrap-outpost", "obsidian-ridge"], ["obsidian-ridge", "magma-forge"], ["magma-forge", "smoldering-trench"],
];

export interface Route { a: Landmark; b: Landmark; length: number }
export function landmarkRoutes(): Route[] {
  return LANDMARK_ROUTES.flatMap(([ia, ib]) => { const a = landmarkById(ia), b = landmarkById(ib); return a && b ? [{ a, b, length: Math.hypot(a.x - b.x, a.z - b.z) }] : []; });
}

export const LANDMARK_DISCOVER_RADIUS = 45 * Math.max(1, WORLD_SCALE / 2); // spotted from further away on a bigger map
export const landmarkKey = (id: string) => `landmark-seen:${id}`;
export const isLandmarkSeen = (p: Pick<PlayerProgression, "earnedRewards">, id: string) => p.earnedRewards.includes(landmarkKey(id));
/** hubs of the safe zone are known from the start so the map is never empty */
export const KNOWN_FROM_START = new Set(["transit-plaza", "spire-district", "scrapyard-bazaar", "aqua-shipyard"]);
export const isLandmarkKnown = (p: Pick<PlayerProgression, "earnedRewards">, id: string) => KNOWN_FROM_START.has(id) || isLandmarkSeen(p, id);

/** Landmarks within range that the player has not seen yet. */
export function undiscoveredNear(p: Pick<PlayerProgression, "earnedRewards">, x: number, z: number): Landmark[] {
  return LANDMARKS.filter((l) => !isLandmarkKnown(p, l.id) && Math.hypot(l.x - x, l.z - z) <= LANDMARK_DISCOVER_RADIUS);
}

/** Idempotent: returns the same object when nothing new is in range. */
export function discoverLandmarks<T extends Pick<PlayerProgression, "earnedRewards">>(p: T, x: number, z: number): T {
  const found = undiscoveredNear(p, x, z);
  return found.length ? { ...p, earnedRewards: [...p.earnedRewards, ...found.map((l) => landmarkKey(l.id))] } : p;
}

export function nearestLandmark(x: number, z: number, filter?: (l: Landmark) => boolean): { landmark: Landmark; dist: number } | null {
  let best: { landmark: Landmark; dist: number } | null = null;
  for (const l of LANDMARKS) { if (filter && !filter(l)) continue; const d = Math.hypot(l.x - x, l.z - z); if (!best || d < best.dist) best = { landmark: l, dist: d }; }
  return best;
}
