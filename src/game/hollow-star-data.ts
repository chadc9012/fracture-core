/** Raid 01 · The Hollow Star: the raid as a dungeon-engine definition (data only, so dungeons.ts can list it without an import cycle).
 * Rules, bosses, rewards and recognition are in hollow-star-raid.ts. */
import type { DungeonDefinition } from "./dungeons";

export const HOLLOW_STAR_ID = "hollow-star";

export const HOLLOW_STAR: DungeonDefinition = {
  id: HOLLOW_STAR_ID, name: "Raid 01 · The Hollow Star", activity: "RAID", region: "Nexus City · Underground Fracture", privateInstance: true,
  squad: { min: 1, max: 6 }, duration: "90–150 min", maxLives: 8,
  identity: "Beneath Nexus City lies an ancient machine that once held the boundaries between dimensions steady. Something inside it has woken: it is breeding monsters, corrupting the tunnels above it and pulling the city toward another reality. Descend 3.8 km, shut the machine down, and break the intelligence that runs it.",
  hazard: "Dimensional bleed", boss: "Astravore, the Hollow Star",
  signature: { name: "Hollow Star Lens", type: "WEAPON", perk: "Precision finishers collapse a short-lived singularity that drags nearby targets inward.", repeatTraits: ["Event Horizon", "Starfall Cadence", "Hollow Rounds"] },
  stages: [
    { id: "broken-gate", hazardPerStep: 5, name: "The Broken Gate", room: "Nexus Subway Gate", type: "COMBAT", objective: "Hold the gate against the invading army while three stabilizer pylons come online", target: 6, checkpoint: true, hazardLabel: "BLEED",
      enemies: ["Void Reaver", "Void Vanguard"], triggers: ["Pylon 1 online", "Pylon 2 online", "Gate stabilized"] },
    { id: "fallen-bridge", hazardPerStep: 6, name: "The Fallen Bridge", room: "Collapsing Spans", type: "TRAVERSAL_COMBAT", objective: "Cross the failing structures while enemies attack from the spans above and below", target: 6, checkpoint: true, hazardLabel: "COLLAPSE",
      enemies: ["Void Reaver", "Void Arcanist"], triggers: ["Span falls", "High ground cleared", "Far anchor reached"],
      routes: [
        { id: "high-spans", name: "High spans", tradeoff: "Fewer hounds, but mages hold the upper ledges and spans fall behind you." },
        { id: "under-girders", name: "Under-girders", tradeoff: "Cover from the mages, but a steady stream of hounds and slower footing." },
      ] },
    { id: "seal-chambers", hazardPerStep: 5, name: "The Seal Chambers", room: "Three Sealed Vaults", type: "PUZZLE_COMBAT", objective: "Split into teams, activate the three seal mechanisms and defend each against elites", target: 9, checkpoint: true, hazardLabel: "BLEED",
      enemies: ["Void Vanguard", "Void Sentinel"], triggers: ["Team A seal", "Team B seal", "Team C seal", "Vault door opens"] },
    { id: "chrono-core", hazardPerStep: 5, name: "The Chrono Core", room: "Conduit Hall", type: "PUZZLE_COMBAT", objective: "Redirect energy conduits, drop the core shields and survive the escalating waves", target: 8, checkpoint: true, hazardLabel: "TIME DRIFT",
      enemies: ["Void Sentinel", "Void Arcanist", "Void Reaver"], triggers: ["Conduit routed", "Shield down", "Wave cleared", "Core quiet"] },
    { id: "echo-realm", hazardPerStep: 5, name: "The Echo Realm", room: "Mirror Dimensions", type: "SYNC_TRAVERSAL", objective: "Teams enter separate dimensional spaces, solve their halves and escape together", target: 7, checkpoint: true, hazardLabel: "DESYNC",
      enemies: ["Void Arcanist", "Void Vanguard"], triggers: ["Team enters", "Mirror solved", "Teams reunite"] },
    { id: "hollow-star-boss", hazardPerStep: 4, name: "The Hollow Star", room: "Final Chamber · 3.8 km", type: "BOSS_FIGHT", objective: "Descend to the final chamber and break Astravore before the machine overloads", target: 16, checkpoint: false, hazardLabel: "OVERLOAD",
      enemies: ["Astravore", "Void Reaver", "Void Vanguard", "Void Arcanist", "Void Sentinel"], triggers: ["Awakening", "Conduits stable", "Realities split", "Core exposed"],
      bossPhases: [
        { name: "Phase I · Awakening", threshold: 100, mechanic: "Astravore tests the intruders with sweeping strikes, energy beams and summoned guardians.", counter: "Spread out for the beams, stay off the shockwave rings, and kill the elite guardians before the next summon." },
        { name: "Phase II · Star Collapse", threshold: 70, mechanic: "The star destabilizes: energy conduits around the arena must be stabilized or the whole raid is annihilated.", counter: "Assign a team to each conduit, defend them from the waves and watch the overload gauge." },
        { name: "Phase III · Fractured Reality", threshold: 40, mechanic: "Gravity shifts, platforms move and teams stand in different versions of the arena.", counter: "Call what you see: each reality has its own mechanic, and the teams must realign them together." },
        { name: "Phase IV · Final Stand", threshold: 15, mechanic: "The arena starts to collapse and the core is exposed while the machine races to overload.", counter: "Survive the hazards, strip the armor and focus the exposed core before the timer ends." },
      ], reward: "Hollow Star Lens" },
  ],
};

