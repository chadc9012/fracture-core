/** Authored vehicle models (scripts/build-fleet.py → public/models/fleet/*.glb) and which one each vehicle shows.
 *
 * Every model is built in real metres, nose toward +Z, ground at y = 0, wheels as named nodes (SteerFL/SteerFR pivots,
 * Wheel* spin about X, Rotor* spin about Y, RotorTail about X), paint as the material named "Paint", tail lamps as
 * "Taillight", the spoiler as the node "Wing" and the underglow strip as "Underglow". AuthoredVehicle.tsx reads those
 * names; this file stays pure so the mapping and the paint colours are testable without three.js.
 *
 * A fleet build (fleet.ts) drives on its base chassis's physics but shows its own body where one fits the build,
 * so a Neon Drift is a street racer and a War Rig is a war rig, not another copy of the chassis it tunes. */
import type { VehicleId } from "./vehicles";

export type FleetModelId =
  | "street-racer" | "muscle-car" | "luxury-sedan" | "tuner" | "hover-car" | "city-pod" | "security-suv"
  | "offroad-truck" | "armored-muscle" | "raider-buggy" | "aether-hoverbike" | "goliath-tank" | "fracture-behemoth"
  | "tech-transport" | "war-rig" | "rift-helicopter" | "vanguard-jet" | "void-skimmer" | "ai-interceptor"
  | "scrap-patrol-boat" | "hydro-sub-skiff" | "leviathan";

export type FleetModel = { id: FleetModelId; url: string; /** world scale on top of real metres */ scale: number; kind: "car" | "bike" | "heavy" | "air" | "boat"; label: string };

/** cars read a touch larger than life next to armoured operators; everything else is built at its own size */
export const VEHICLE_WORLD_SCALE = 1.15;

const m = (id: FleetModelId, kind: FleetModel["kind"], label: string, scale = VEHICLE_WORLD_SCALE): FleetModel => ({ id, url: `/models/fleet/${id}.glb`, scale, kind, label });

export const FLEET_MODELS: Record<FleetModelId, FleetModel> = {
  "street-racer": m("street-racer", "car", "Street racer"),
  "muscle-car": m("muscle-car", "car", "Muscle car"),
  "luxury-sedan": m("luxury-sedan", "car", "Luxury sedan"),
  "tuner": m("tuner", "car", "Tuner"),
  "hover-car": m("hover-car", "car", "Hover car"),
  "city-pod": m("city-pod", "car", "City pod"),
  "security-suv": m("security-suv", "car", "Security vehicle"),
  "offroad-truck": m("offroad-truck", "car", "Off-road truck"),
  "armored-muscle": m("armored-muscle", "car", "Armored muscle"),
  "raider-buggy": m("raider-buggy", "car", "Buggy"),
  "aether-hoverbike": m("aether-hoverbike", "bike", "Lightcycle"),
  "goliath-tank": m("goliath-tank", "heavy", "Battle tank", 1),
  "fracture-behemoth": m("fracture-behemoth", "heavy", "Crawler", 1),
  "tech-transport": m("tech-transport", "heavy", "Armored transport", 1),
  "war-rig": m("war-rig", "heavy", "War rig", 1),
  "rift-helicopter": m("rift-helicopter", "air", "Gunship", 1),
  "vanguard-jet": m("vanguard-jet", "air", "Strike jet", 1),
  "void-skimmer": m("void-skimmer", "air", "Shuttle", 1),
  "ai-interceptor": m("ai-interceptor", "air", "Drone", 1),
  "scrap-patrol-boat": m("scrap-patrol-boat", "boat", "Patrol boat", 1),
  "hydro-sub-skiff": m("hydro-sub-skiff", "boat", "Sub-skiff", 1),
  "leviathan": m("leviathan", "boat", "Dreadnought", 1),
};

/** the body each chassis shows when no fleet build overrides it */
export const BASE_MODEL: Record<VehicleId, FleetModelId> = {
  "scrap-interceptor": "armored-muscle",
  "goliath-tank": "goliath-tank",
  "wasteland-jeep": "offroad-truck",
  "aether-hoverbike": "aether-hoverbike",
  "tech-transport": "tech-transport",
  "rift-helicopter": "rift-helicopter",
  "vanguard-jet": "vanguard-jet",
  "void-skimmer": "void-skimmer",
  "scrap-patrol-boat": "scrap-patrol-boat",
  "hydro-sub-skiff": "hydro-sub-skiff",
  "leviathan": "leviathan",
  "raider-buggy": "raider-buggy",
  "ai-interceptor": "ai-interceptor",
  "fracture-behemoth": "fracture-behemoth",
};

/** fleet builds whose look differs from their chassis (fleet.ts ids) */
export const BUILD_MODEL: Record<string, FleetModelId> = {
  "goliath-4x4": "offroad-truck",
  "behemoth-v16": "raider-buggy",
  "rift-runner": "muscle-car",
  "neon-drift": "street-racer",
  "civic-rover": "city-pod",
  "sandstalker-atv": "raider-buggy",
  "void-chaser": "hover-car",
  "war-rig": "war-rig",
  "apex-hauler": "tech-transport",
};

export function vehicleModelFor(vehicleId: VehicleId, activeBuild?: string | null): FleetModel {
  const id = (activeBuild && BUILD_MODEL[activeBuild]) || BASE_MODEL[vehicleId];
  return FLEET_MODELS[id];
}

/** Paint names from the garage (fleet.ts `paints`) → body colour. Unknown names keep the model's own paint (null). */
const PAINT_WORDS: [RegExp, string][] = [
  [/black|obsidian|shadow|night|void|carbon|stealth/i, "#121318"],
  [/white|pearl|ivory|bone|frost|glacier|noise/i, "#d9dfe6"],
  [/red|crimson|scarlet|rust king/i, "#a8202a"],
  [/blue|azure|cobalt|navy|civic/i, "#1f4fa8"],
  [/gold|amber|sun/i, "#b8862f"],
  [/green|olive|canal/i, "#3f6648"],
  [/purple|violet|rift/i, "#5a1fb0"],
  [/magenta|pink/i, "#c0208f"],
  [/teal|cyan/i, "#108c99"],
  [/yellow|taxi|industrial/i, "#d6a817"],
  [/orange|hazard|rescue/i, "#d0561c"],
  [/silver|chrome|grey|gray|gunmetal|harbour|picket|tech/i, "#8d96a1"],
  [/sand|desert|dust|camo|scorpion/i, "#a48a5c"],
  [/rust|ash/i, "#6a3e26"],
];
export function paintColor(label: string | undefined | null): string | null {
  if (!label) return null;
  for (const [re, hex] of PAINT_WORDS) if (re.test(label)) return hex;
  return null;
}
