
/** Faction per region follows the owner's faction sheet (public/refs/factions-sheet.png): Raiders = Wastelands, Overclocked = Nexus,
 * Vanguard = Frostspire, Aberrations = Swamps; the Skyborn sheet adds the Skyborn to Ember Peaks' troops (its region boss, Overseer
 * Kael, is a human reactor operator and keeps the Raider boss body). Regions the sheets do not cover keep their themed mix. */
export type EnemyKind = "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD" | "SKYBORN" | "GUARDIAN" | "ABYSSAL";
export type EnemyProfile = { name: string; kind: EnemyKind; role: string; drop: string };
export type RegionalEncounter = { regionId: string; troops: readonly EnemyProfile[]; boss?: { name: string; lair: string; drop: string; tell: string } };

export const ENCOUNTERS: readonly RegionalEncounter[] = [
  { regionId: "veridan", troops: [
    { name: "Spore-Stalker Tracker", kind: "ABERRATION", role: "Four-legged heat tracker", drop: "sporeFiber" },
    // Ancient Guardians (owner's enemies sheet) wake to defend the forest ruins; elites of this troop are Arc Wardens
    { name: "Ruin Sentinel", kind: "GUARDIAN", role: "Moss-grown guardian construct, core-fired energy bolts", drop: "sporeFiber" },
    { name: "Veridan Corruptor", kind: "ABERRATION", role: "Spore support", drop: "bioCatalyst" },
  ], boss: { name: "Veridan Effigy", lair: "Corrupted Spore-Grove", drop: "bioCatalyst", tell: "Roots spread before a ground slam" } },
  { regionId: "ember", troops: [
    // the Skyborn hold the peaks (owner's Skyborn sheet): ambient spawns draw from the first three
    { name: "Skyborn Legionary", kind: "SKYBORN", role: "Armored frontline infantry", drop: "thermalShards" },
    { name: "Breaker Magma Berserker", kind: "RAIDER", role: "Thermal blade frontline", drop: "thermalShards" },
    { name: "Skyborn Axiom", kind: "SKYBORN", role: "Elite blade enforcer", drop: "thermalShards" },
    { name: "Crater Crawler", kind: "ABERRATION", role: "Lava-wading arachnid mech", drop: "thermalShards" },
    { name: "Breaker Slag-Thrower", kind: "OVERCLOCKED", role: "Area-denial lava bombs", drop: "microCircuits" },
  ], boss: { name: "Overseer Kael", lair: "Ember Peaks Volcanic", drop: "magmaCore", tell: "Hammer glows before the shockwave" } },
  { regionId: "wastelands", troops: [
    { name: "Badlands Marauder", kind: "RAIDER", role: "Swarming scrap-fighter", drop: "reinforcedAlloy" },
    { name: "Nomad Sniper", kind: "RAIDER", role: "Long-range marksman", drop: "scrapMetal" },
    { name: "Rust-Runner Buggy", kind: "RAIDER", role: "Mobile skirmisher", drop: "vehicleParts" },
  ], boss: { name: "Rust-King ‘Gant’", lair: "Junkyard Citadel", drop: "vehicleParts", tell: "Crane arm locks its landing lane" } },
  { regionId: "frostspire", troops: [
    { name: "Vanguard Enforcer", kind: "VANGUARD", role: "Perimeter defender", drop: "cryoCrystal" },
    { name: "Chrono-Stalker", kind: "VANGUARD", role: "Phase-shifting assassin", drop: "cryoCrystal" },
    { name: "Glacial Sentinel", kind: "VANGUARD", role: "Gauss-cannon construct", drop: "reinforcedAlloy" },
  ], boss: { name: "Subject Zero", lair: "Glacial Crevasse", drop: "zeroCore", tell: "Ice blades fan outward before the lunge" } },
  { regionId: "swamps", troops: [
    { name: "Spore-Walker", kind: "ABERRATION", role: "Ambush brute", drop: "sporeFiber" },
    { name: "Naga-Siren Hybrid", kind: "ABERRATION", role: "Waterborne lure", drop: "bioCatalyst" },
    { name: "Bog Crawler", kind: "ABERRATION", role: "Swarming ambusher", drop: "bioCatalyst" },
  ], boss: { name: "The Kraken-Vanguard (KV-Unit)", lair: "Shrouded Effigy", drop: "abyssCore", tell: "Tentacles rise before the sweep" } },
  { regionId: "nexus", troops: [
    { name: "Overclocked Operative", kind: "OVERCLOCKED", role: "Perimeter trooper", drop: "microCircuits" },
    { name: "Overclocked Augmented", kind: "OVERCLOCKED", role: "Augmented heavy", drop: "reinforcedAlloy" },
    // a robot squad: machine profiles in a faction of armoured people wear a robot chassis (robots.ts)
    { name: "Nexus Sentry Frame", kind: "OVERCLOCKED", role: "Robotic breach squad", drop: "microCircuits" },
  ], boss: { name: "Aegis-Prime", lair: "High-Tech Interior", drop: "aegisCore", tell: "Shield panels open before the pulse" } },
  { regionId: "solara", troops: [
    { name: "Ash-Born Stalker", kind: "RAIDER", role: "Dune ambusher", drop: "scrapMetal" },
    { name: "Silicon-Fused Viper", kind: "ABERRATION", role: "Burrowing hunter", drop: "anomalyCarbon" },
    { name: "Augmented Soldier", kind: "OVERCLOCKED", role: "Ranged patrol", drop: "microCircuits" },
  ] },
  // not map regions: troop rosters for places inside one (owner's regional roster). Neon City's Controllers guard the Aegis Spire;
  // Thalassia's Abyssal units hold the drowned city (descent-protocol spawns use them, machines keep the swamps zone).
  { regionId: "neon", troops: [
    { name: "Controller Enforcer", kind: "OVERCLOCKED", role: "Railgun carbine + hard-light shield", drop: "microCircuits" },
    { name: "Spire Interceptor Drone", kind: "OVERCLOCKED", role: "Target-lock spotter", drop: "dataShards" },
  ] },
  { regionId: "thalassia", troops: [
    // the Abyssal (owner's enemies sheet) hunt Thalassia's waters; they swim (abyssal-swim.ts), elites are Siren Stalkers
    { name: "Reef Hunter", kind: "ABYSSAL", role: "Fast eel-shark ambusher", drop: "bioCatalyst" },
    { name: "Abyssal Drowner", kind: "ABYSSAL", role: "Phasing sonic attacker", drop: "bioCatalyst" },
    { name: "Sub-Surface Guardian", kind: "VANGUARD", role: "Waterjet plasma-arc mech", drop: "reinforcedAlloy" },
  ] },
];

export const EXTRA_ENEMIES: readonly EnemyProfile[] = [
  { name: "Ash-Born Warlord", kind: "RAIDER", role: "Armored field leader", drop: "reinforcedAlloy" },
  { name: "Wasteland Grunt", kind: "RAIDER", role: "Frontline scavenger", drop: "scrapMetal" },
  { name: "Fracture Architect", kind: "OVERCLOCKED", role: "System manipulator", drop: "dataShards" },
  { name: "Cyber-Corrupted Drone", kind: "OVERCLOCKED", role: "Sensor swarm", drop: "microCircuits" },
  { name: "Fracture-Mutated Crawler", kind: "ABERRATION", role: "Ground ambush", drop: "bioCatalyst" },
];

export const encounterFor = (regionId: string) => ENCOUNTERS.find((entry) => entry.regionId === regionId);
export const troopFor = (regionId: string, index: number) => {
  const troops = encounterFor(regionId)?.troops;
  return troops?.[Math.abs(index) % troops.length] ?? EXTRA_ENEMIES[0];
};
/** the faction a region's bosses (and boss models) belong to, from the faction sheet; uncovered regions use their main troop faction */
export const REGION_FACTION: Record<string, EnemyKind> = { wastelands: "RAIDER", nexus: "OVERCLOCKED", frostspire: "VANGUARD", swamps: "ABERRATION", neon: "OVERCLOCKED", thalassia: "ABYSSAL", veridan: "ABERRATION", ember: "RAIDER", solara: "RAIDER" };
export const factionOf = (regionId: string | undefined): EnemyKind => REGION_FACTION[regionId ?? ""] ?? "OVERCLOCKED";
