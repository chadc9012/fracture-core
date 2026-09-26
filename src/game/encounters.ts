
export type EnemyKind = "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD";
export type EnemyProfile = { name: string; kind: EnemyKind; role: string; drop: string };
export type RegionalEncounter = { regionId: string; troops: readonly EnemyProfile[]; boss?: { name: string; lair: string; drop: string; tell: string } };

export const ENCOUNTERS: readonly RegionalEncounter[] = [
  { regionId: "veridan", troops: [
    { name: "Goliath-Root Sporeling", kind: "ABERRATION", role: "Rooted bruiser", drop: "sporeFiber" },
    { name: "Feral Forest Predator", kind: "ABERRATION", role: "Flanking hunter", drop: "sporeFiber" },
    { name: "Veridan Corruptor", kind: "ABERRATION", role: "Spore support", drop: "bioCatalyst" },
  ], boss: { name: "Veridan Effigy", lair: "Corrupted Spore-Grove", drop: "bioCatalyst", tell: "Roots spread before a ground slam" } },
  { regionId: "ember", troops: [
    { name: "Magma-Architect", kind: "OVERCLOCKED", role: "Thermal controller", drop: "thermalShards" },
    { name: "Volcanic Drone", kind: "OVERCLOCKED", role: "Aerial harrier", drop: "microCircuits" },
    { name: "Lava-Born Berserker", kind: "RAIDER", role: "Charging frontline", drop: "thermalShards" },
  ], boss: { name: "Overseer Kael", lair: "Ember Peaks Volcanic", drop: "magmaCore", tell: "Hammer glows before the shockwave" } },
  { regionId: "wastelands", troops: [
    { name: "Wasteland Warlord", kind: "RAIDER", role: "Armored commander", drop: "reinforcedAlloy" },
    { name: "Nomad Sniper", kind: "RAIDER", role: "Long-range marksman", drop: "scrapMetal" },
    { name: "Rust-Runner Buggy", kind: "RAIDER", role: "Mobile skirmisher", drop: "vehicleParts" },
  ], boss: { name: "Rust-King ‘Gant’", lair: "Junkyard Citadel", drop: "vehicleParts", tell: "Crane arm locks its landing lane" } },
  { regionId: "frostspire", troops: [
    { name: "Ice-Stalker Drone", kind: "OVERCLOCKED", role: "Cryo pursuit", drop: "cryoCrystal" },
    { name: "Frost-Corrupted Ravager", kind: "ABERRATION", role: "Pouncing beast", drop: "cryoCrystal" },
    { name: "Spore-Corrupted Glacial Wolf", kind: "ABERRATION", role: "Pack flanker", drop: "sporeFiber" },
  ], boss: { name: "Subject Zero", lair: "Glacial Crevasse", drop: "zeroCore", tell: "Ice blades fan outward before the lunge" } },
  { regionId: "swamps", troops: [
    { name: "Spore-Walker", kind: "ABERRATION", role: "Ambush brute", drop: "sporeFiber" },
    { name: "Naga-Siren Hybrid", kind: "ABERRATION", role: "Waterborne lure", drop: "bioCatalyst" },
    { name: "Hacked Vanguard Drone", kind: "OVERCLOCKED", role: "Disruption support", drop: "microCircuits" },
  ], boss: { name: "The Kraken-Vanguard (KV-Unit)", lair: "Shrouded Effigy", drop: "abyssCore", tell: "Tentacles rise before the sweep" } },
  { regionId: "nexus", troops: [
    { name: "Vanguard Enforcer", kind: "VANGUARD", role: "Perimeter defender", drop: "microCircuits" },
    { name: "Automated Sentry Turret", kind: "VANGUARD", role: "Defensive emplacement", drop: "reinforcedAlloy" },
    { name: "Cyber-Corrupted Riot Squad", kind: "OVERCLOCKED", role: "Breach team", drop: "microCircuits" },
  ], boss: { name: "Aegis-Prime", lair: "High-Tech Interior", drop: "aegisCore", tell: "Shield panels open before the pulse" } },
  { regionId: "solara", troops: [
    { name: "Ash-Born Stalker", kind: "RAIDER", role: "Dune ambusher", drop: "scrapMetal" },
    { name: "Silicon-Fused Viper", kind: "ABERRATION", role: "Burrowing hunter", drop: "anomalyCarbon" },
    { name: "Augmented Soldier", kind: "OVERCLOCKED", role: "Ranged patrol", drop: "microCircuits" },
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