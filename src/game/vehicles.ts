import type { ModelKey } from "./models";

export type VehicleId =
  | "scrap-interceptor"
  | "goliath-tank"
  | "wasteland-jeep"
  | "aether-hoverbike"
  | "tech-transport"
  | "rift-helicopter"
  | "vanguard-jet"
  | "void-skimmer"
  | "scrap-patrol-boat"
  | "hydro-sub-skiff"
  | "leviathan"
  | "raider-buggy"
  | "ai-interceptor"
  | "fracture-behemoth";

export type VehicleRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "EXOTIC" | "BOSS";
export type VehicleDomain = "LAND" | "AIR" | "WATER" | "AMPHIBIOUS" | "SPACE";
export type VehicleAllegiance = "RESONANT" | "TECH" | "RAIDER" | "FRACTURE";
export type VehicleAcquisition = "FIRST_MISSION" | "STORE" | "PARTS" | "FACTION" | "BOSS";

export type VehicleDefinition = {
  id: VehicleId;
  name: string;
  type: string;
  rarity: VehicleRarity;
  domain: VehicleDomain;
  allegiance: VehicleAllegiance;
  lore: string;
  role: string;
  weapon: string;
  seats: number;
  speed: number;
  hull: number;
  handling: number;
  ram: number;
  collisionRadius: number;
  terrainGrip: number;
  model: ModelKey;
  modelScale: number;
  starter: boolean;
  acquisition?: VehicleAcquisition;
};

export const VEHICLES: readonly VehicleDefinition[] = [
  {
    id: "scrap-interceptor", name: "Scrap-Built Interceptor", type: "Post-Apocalyptic Muscle Car", rarity: "COMMON",
    domain: "LAND", allegiance: "RESONANT", lore: "A welded highway chassis with a supercharged fracture-fuel engine.",
    role: "Blazing acceleration, heavy drift and a barricade-clearing ram.", weapon: "Ram bar + roof repeater", seats: 2,
    speed: 1.16, hull: 0.88, handling: 1.12, ram: 1.45, collisionRadius: 3.2, terrainGrip: 0.92,
    model: "race_future", modelScale: 2.45, starter: true,
  },
  {
    id: "goliath-tank", name: "GOLIATH Heavy Armored Tank", type: "Military Tracked Vehicle", rarity: "EPIC",
    domain: "LAND", allegiance: "RESONANT", lore: "Reactive armor built to absorb ballistic and thermal punishment.",
    role: "Slow siege armor, limited turret arc and small-arms immunity.", weapon: "120mm fracture cannon", seats: 3,
    speed: 0.48, hull: 2.5, handling: 0.5, ram: 2.2, collisionRadius: 4.8, terrainGrip: 1.25,
    model: "truck", modelScale: 3.1, starter: false,
  },
  {
    id: "wasteland-jeep", name: "Wasteland Scout Jeep", type: "4×4 Off-Road Utility", rarity: "COMMON",
    domain: "LAND", allegiance: "RESONANT", lore: "A stripped utility frame tuned for dunes, forest tracks and broken roads.",
    role: "Four seats, strong off-road grip and a top-mounted gunner.", weapon: "Pintle machine gun", seats: 4,
    speed: 0.98, hull: 1.08, handling: 1.05, ram: 1, collisionRadius: 3.1, terrainGrip: 1.22,
    model: "suv", modelScale: 2.4, starter: true,
  },
  {
    id: "aether-hoverbike", name: "Aether-Glide Hoverbike", type: "Anti-Gravity Bike", rarity: "RARE",
    domain: "LAND", allegiance: "RESONANT", lore: "Compressed fracture crystals lift a razor-thin rider platform above terrain.",
    role: "Extreme agility and brief water skimming; the rider remains exposed.", weapon: "Twin pulse emitters", seats: 1,
    speed: 1.42, hull: 0.52, handling: 1.55, ram: 0.45, collisionRadius: 1.7, terrainGrip: 1.38,
    model: "race_future", modelScale: 1.5, starter: false,
  },
  {
    id: "tech-transport", name: "Tech-Faction Goliath Transport", type: "Heavy Troop Carrier", rarity: "EPIC",
    domain: "LAND", allegiance: "TECH", lore: "An automated carrier bristling with pulse defenses and shield projectors.",
    role: "Mobile squad spawn with automated defensive arcs when parked.", weapon: "Pulse-laser array", seats: 8,
    speed: 0.66, hull: 2.05, handling: 0.62, ram: 1.8, collisionRadius: 4.5, terrainGrip: 1.08,
    model: "van", modelScale: 3.1, starter: false,
  },
  {
    id: "rift-helicopter", name: "Rift-Jumper Attack Helicopter", type: "Close Air Support Chopper", rarity: "RARE",
    domain: "AIR", allegiance: "RESONANT", lore: "Gyro-stabilized gunship built to survive turbulent fracture weather.",
    role: "VTOL support with rockets and a pilot-controlled chain gun.", weapon: "Chain gun + rocket pods", seats: 2,
    speed: 1.12, hull: 1.1, handling: 1.15, ram: 0.7, collisionRadius: 4.1, terrainGrip: 1,
    model: "race_future", modelScale: 2.7, starter: false,
  },
  {
    id: "vanguard-jet", name: "Resonant Strike Jet", type: "Supersonic Fighter", rarity: "EPIC",
    domain: "AIR", allegiance: "RESONANT", lore: "A high-altitude interceptor guarding the volatile northern boundary.",
    role: "Extreme speed, wide turns and devastating strafing runs.", weapon: "Arc cannon + missiles", seats: 1,
    speed: 1.8, hull: 0.95, handling: 0.72, ram: 0.5, collisionRadius: 4.6, terrainGrip: 1,
    model: "race_future", modelScale: 2.9, starter: false,
  },
  {
    id: "void-skimmer", name: "Void-Skimmer Spacecraft", type: "Inter-Dimensional Shuttle", rarity: "EXOTIC",
    domain: "SPACE", allegiance: "RESONANT", lore: "A triangular shuttle able to breach the upper boundary between world layers.",
    role: "True 3D flight and sub-orbital boosts between distant biomes.", weapon: "Void lance", seats: 6,
    speed: 2, hull: 1.55, handling: 1.08, ram: 1.1, collisionRadius: 5.4, terrainGrip: 1,
    model: "race_future", modelScale: 3.5, starter: false,
  },
  {
    id: "scrap-patrol-boat", name: "Scrap-Iron Patrol Boat", type: "Armored River Skiff", rarity: "COMMON",
    domain: "WATER", allegiance: "RESONANT", lore: "A flat-bottomed steel skiff for swamp channels and shallow rivers.",
    role: "Fast shallow-water patrol craft with a mounted deck gun.", weapon: "Heavy deck gun", seats: 4,
    speed: 1.02, hull: 1.02, handling: 1.2, ram: 0.9, collisionRadius: 3.6, terrainGrip: 1,
    model: "van", modelScale: 2.5, starter: false,
  },
  {
    id: "hydro-sub-skiff", name: "Hydro-Phase Sub-Skiff", type: "Amphibious Submersible", rarity: "RARE",
    domain: "AMPHIBIOUS", allegiance: "RESONANT", lore: "Sealing panels transform a surface skiff into a deep-water craft.",
    role: "Transitions between high-speed surface travel and submerged evasion.", weapon: "Phase torpedoes", seats: 3,
    speed: 1.08, hull: 1.25, handling: 1.08, ram: 0.8, collisionRadius: 3.8, terrainGrip: 1.05,
    model: "race_future", modelScale: 2.5, starter: false,
  },
  {
    id: "leviathan", name: "Tech-Faction Leviathan", type: "Autonomous Dreadnought", rarity: "LEGENDARY",
    domain: "WATER", allegiance: "TECH", lore: "A hardlight command ship that controls whole ocean sectors.",
    role: "Cooperative floating fortress requiring a full crew to capture.", weapon: "Heavy energy batteries", seats: 12,
    speed: 0.42, hull: 3.2, handling: 0.38, ram: 2.4, collisionRadius: 8, terrainGrip: 1,
    model: "truck", modelScale: 4.2, starter: false,
  },
  {
    id: "raider-buggy", name: "Mutated Raider Buggy", type: "Open-Wheel Assault Car", rarity: "COMMON",
    domain: "LAND", allegiance: "RAIDER", lore: "A spiked assault frame piloted by outcasts warped by loose energy.",
    role: "Aggressive ramming and proximity-mine deployment.", weapon: "Side mines + ram spikes", seats: 3,
    speed: 1.08, hull: 0.82, handling: 1.2, ram: 1.5, collisionRadius: 2.8, terrainGrip: 1.08,
    model: "police", modelScale: 2.3, starter: false,
  },
  {
    id: "ai-interceptor", name: "AI-Net Automated Interceptor", type: "Unmanned Drone Craft", rarity: "EPIC",
    domain: "AIR", allegiance: "TECH", lore: "A geometric hunter directed by the conscious machine network.",
    role: "Fast tracking and continuous beams aimed at vehicle weak points.", weapon: "Continuous laser", seats: 0,
    speed: 1.55, hull: 1.18, handling: 1.4, ram: 0.7, collisionRadius: 2.7, terrainGrip: 1,
    model: "race_future", modelScale: 2, starter: false,
  },
  {
    id: "fracture-behemoth", name: "Fracture-Behemoth Crawler", type: "Mobile World Fortress", rarity: "BOSS",
    domain: "LAND", allegiance: "FRACTURE", lore: "Tank treads fused to living stone and thermal fracture nodes from Ember Peaks.",
    role: "World boss: disable exposed energy nodes while surviving crush and thermal pulses.", weapon: "Thermal pulse + crush field", seats: 0,
    speed: 0.26, hull: 5, handling: 0.22, ram: 4, collisionRadius: 10, terrainGrip: 1.5,
    model: "truck", modelScale: 5, starter: false,
  },
] as const;

export const STARTER_VEHICLES = VEHICLES.filter((vehicle) => vehicle.starter);

export function vehicleAcquisition(vehicle: VehicleDefinition): VehicleAcquisition {
  if (vehicle.starter) return "FIRST_MISSION";
  if (vehicle.rarity === "BOSS") return "BOSS";
  if (vehicle.allegiance === "TECH" || vehicle.allegiance === "RAIDER") return "FACTION";
  if (vehicle.rarity === "COMMON" || vehicle.rarity === "RARE") return "PARTS";
  return "STORE";
}

export function vehicleById(id: VehicleId): VehicleDefinition {
  const found = VEHICLES.find((vehicle) => vehicle.id === id);
  if (found) return found;
  return { ...VEHICLES[0] } as VehicleDefinition;
}