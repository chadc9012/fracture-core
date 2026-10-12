
/** Faction per region follows the owner's faction sheet (public/refs/factions-sheet.png): Raiders = Wastelands, Overclocked = Nexus,
 * Vanguard = Frostspire, Aberrations = Swamps. Regions the sheet does not cover keep their themed mix. */
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
    { name: "Vanguard Enforcer", kind: "VANGUARD", role: "Perimeter defender", drop: "cryoCrystal" },
    { name: "Vanguard Cryo-Lancer", kind: "VANGUARD", role: "Long-range cryo marksman", drop: "cryoCrystal" },
    { name: "Vanguard Juggernaut", kind: "VANGUARD", role: "Shielded heavy", drop: "reinforcedAlloy" },
  ], boss: { name: "Subject Zero", lair: "Glacial Crevasse", drop: "zeroCore", tell: "Ice blades fan outward before the lunge" } },
  { regionId: "swamps", troops: [
    { name: "Spore-Walker", kind: "ABERRATION", role: "Ambush brute", drop: "sporeFiber" },
    { name: "Naga-Siren Hybrid", kind: "ABERRATION", role: "Waterborne lure", drop: "bioCatalyst" },
    { name: "Bog Crawler", kind: "ABERRATION", role: "Swarming ambusher", drop: "bioCatalyst" },
  ], boss: { name: "The Kraken-Vanguard (KV-Unit)", lair: "Shrouded Effigy", drop: "abyssCore", tell: "Tentacles rise before the sweep" } },
  { regionId: "nexus", troops: [
    { name: "Overclocked Operative", kind: "OVERCLOCKED", role: "Perimeter trooper", drop: "microCircuits" },
    { name: "Overclocked Augmented", kind: "OVERCLOCKED", role: "Augmented heavy", drop: "reinforcedAlloy" },
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
/** the faction a region's bosses (and boss models) belong to, from the faction sheet; uncovered regions use their main troop faction */
export const REGION_FACTION: Record<string, EnemyKind> = { wastelands: "RAIDER", nexus: "OVERCLOCKED", frostspire: "VANGUARD", swamps: "ABERRATION", veridan: "ABERRATION", ember: "RAIDER", solara: "RAIDER" };
export const factionOf = (regionId: string | undefined): EnemyKind => REGION_FACTION[regionId ?? ""] ?? "OVERCLOCKED";
