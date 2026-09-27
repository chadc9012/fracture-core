import type { EncounterDefinition } from "./raid-stages";

export type DungeonDefinition = EncounterDefinition & {
  region: string;
  identity: string;
  hazard: string;
  boss: string;
  signature: { name: string; type: "WEAPON" | "ARMOR"; perk: string; repeatTraits: readonly string[] };
};

export const DUNGEONS: readonly DungeonDefinition[] = [
  {
    id: "arcology_vaults", name: "Sunken Arcology Vaults", activity: "DUNGEON", region: "Solara Desert", privateInstance: true,
    squad: { min: 1, max: 3 }, duration: "20–40 min", maxLives: 3,
    identity: "A pre-Fracture city sinking through a live sand-entombment protocol. Two revives share one fireteam life pool; enemy pressure scales with squad size.", hazard: "Sand-fill pressure", boss: "Archive Guardian",
    signature: { name: "Hourglass Protocol", type: "WEAPON", perk: "Final shots suspend nearby targets in compressed sand-time.", repeatTraits: ["Chamber Pressure", "Architect's Patience", "Sifted Payload"] },
    stages: [
      { id: "entry_burial_gates", name: "Burial Gates", room: "Entombed Causeway", type: "SYNC_TRAVERSAL", objective: "Seal three flood gates before the causeway fills", target: 3, checkpoint: true, hazardLabel: "SAND PRESSURE", enemies: ["Tracker scouts"], triggers: ["Gate seal", "Sand surge", "Safe ledge"], routes: [{ id: "upper-aqueduct", name: "Upper Aqueduct", tradeoff: "Lower pressure, exposed sightlines" }, { id: "buried-conduit", name: "Buried Conduit", tradeoff: "More enemies, bonus cache" }] },
      { id: "archive_corridors", name: "Archive Corridors", room: "Memory Stacks", type: "COMBAT", objective: "Clear defenders and secure the memory relay", target: 4, checkpoint: true, hazardLabel: "SAND PRESSURE", enemies: ["Brute", "Tracker", "Suppressor"], triggers: ["Ambush shutters", "Relay breach"], reward: "Data Shards ×40" },
      { id: "data_flood_chambers", name: "Data Flood Chambers", room: "Synthesis Reservoir", type: "PUZZLE_COMBAT", objective: "Defend and synchronize three submerged nodes", target: 3, checkpoint: true, hazardLabel: "DATA FLOOD", enemies: ["Suppressor pair", "Adaptive elite"], triggers: ["Node defense", "False sequence", "Pressure vent"], reward: "Arcology calibration token" },
      { id: "core_shaft_descent", name: "Core Shaft Descent", room: "Vertical Transit Core", type: "TRAVERSAL_COMBAT", objective: "Descend through moving lifts and break two anchor locks", target: 4, checkpoint: true, hazardLabel: "SHAFT COLLAPSE", enemies: ["Tracker swarm", "Brute anchor guard"], triggers: ["Falling platform", "Lift reversal", "Anchor break"], reward: "Spatial Core ×1" },
      { id: "archive_guardian_boss", name: "Archive Guardian", room: "Buried Index", type: "BOSS_FIGHT", objective: "Read, expose, and dismantle the Guardian", target: 8, checkpoint: false, hazardLabel: "ENTOMBMENT", enemies: ["Archive Guardian"], triggers: ["Index lock", "Sand wall", "Core exposure"], bossPhases: [
        { name: "Phase I · Index", threshold: 100, mechanic: "Guardian scans and fires readable archive lances.", counter: "Use cover and strike after the scan." },
        { name: "Phase II · Redaction", threshold: 75, mechanic: "Sand walls erase lanes in a marked sequence.", counter: "Rotate through the highlighted escape lane." },
        { name: "Phase III · Revision", threshold: 45, mechanic: "The Guardian adapts once to the fireteam’s dominant tactic.", counter: "Swap ability rhythm after the visible calibration tell." },
        { name: "Phase IV · Final Record", threshold: 15, mechanic: "The core opens while entombment accelerates.", counter: "Break anchors, then focus the exposed index." },
      ], reward: "Hourglass Protocol" },
    ],
  },
  {
    id: "glacial-crevasse", name: "Glacial Crevasse Network", activity: "DUNGEON", region: "Frostspire Mountains", privateInstance: true,
    squad: { min: 1, max: 3 }, duration: "20–30 min", maxLives: 2,
    identity: "A thermal network trapped beneath the endgame stronghold.", hazard: "Shared cold exposure", boss: "Rimeheart, the Cold-Adapted",
    signature: { name: "Rimeheart Covenant", type: "ARMOR", perk: "Ability chains generate a moving thermal sanctuary.", repeatTraits: ["Vent Walker", "Whiteout Guard", "Shared Warmth"] },
    stages: [
      { id: "heatline", name: "The Last Heatline", type: "SYNC_TRAVERSAL", objective: "Activate thermal vents in sequence", target: 4, checkpoint: true, hazardLabel: "EXPOSURE" },
      { id: "rimeheart", name: "Absolute Zero", type: "BOSS_FIGHT", objective: "Interrupt Rimeheart's cold vents", target: 6, checkpoint: false, hazardLabel: "EXPOSURE" },
    ],
  },
  {
    id: "temple-echoes", name: "Sunken Temple of Echoes", activity: "DUNGEON", region: "Shrouded Swamps", privateInstance: true,
    squad: { min: 1, max: 3 }, duration: "30–40 min", maxLives: 3,
    identity: "A drowned sanctuary replaying memories from before the Collapse.", hazard: "Temporal echo sequence", boss: "The Antiphon, One Beat Apart",
    signature: { name: "Antiphon's Refrain", type: "WEAPON", perk: "Precision chains replay the final hit one beat later.", repeatTraits: ["Memory Mark", "Delayed Verdict", "Echo Chamber"] },
    stages: [
      { id: "memory", name: "What the Temple Remembers", type: "SYNC_TRAVERSAL", objective: "Reproduce the recorded switch sequence", target: 4, checkpoint: true, hazardLabel: "ECHO DRIFT" },
      { id: "procession", name: "Drowned Procession", type: "SYNC_TRAVERSAL", objective: "Follow the safe path one beat behind", target: 3, checkpoint: true, hazardLabel: "ECHO DRIFT" },
      { id: "antiphon", name: "Before and After", type: "BOSS_FIGHT", objective: "Damage the Antiphon during synchronization", target: 5, checkpoint: false, hazardLabel: "DESYNC" },
    ],
  },
  {
    id: "wasteland-fuel-king", name: "The Fuel King", activity: "RAID", region: "The Wastelands", privateInstance: true,
    squad: { min: 1, max: 3 }, duration: "35–50 min", maxLives: 3,
    identity: "A convoy raid down through the Wasteland's Underground City and into a sealed Northwest vault, ending on the armored warlord who controls the region's entire fuel supply. The gate only opens once the fireteam has proven it can hold the surface routes and clear the vault dungeons beneath it.",
    hazard: "Fuel-control siege", boss: "The Fuel King",
    signature: { name: "King's Ransom", type: "WEAPON", perk: "Kills refund a fraction of spent fuel as bonus reserve ammo.", repeatTraits: ["Convoy Tithe", "Scrap Momentum", "Last Reserve"] },
    stages: [
      { id: "surface-convoy-raid", name: "Convoy Raid", room: "Grid-Iron Highway", type: "TRAVERSAL_COMBAT", objective: "Raid three fuel convoys and break Raider control of the highway", target: 3, checkpoint: true, hazardLabel: "FUEL CONTROL", enemies: ["Raider buggies", "Convoy gunners"], triggers: ["Convoy ambush", "Roadblock", "Tanker breach"], reward: "Fuel ×120 · Scrap ×80" },
      { id: "underground-access", name: "Underground City Access", room: "Fuel Depot Checkpoint", type: "PUZZLE_COMBAT", objective: "Trade proof of convoy kills for depot clearance into the sealed vaults", target: 2, checkpoint: true, hazardLabel: "CLEARANCE", enemies: ["Depot sentries"], triggers: ["Safe-zone handshake", "Vault seal cycling"], reward: "Vault access token" },
      { id: "northwest-vaults", name: "Northwest Vault Dungeons", room: "Sealed Reserve Wing", type: "COMBAT", objective: "Clear the vault dungeons guarding the Northwest boss gate", target: 3, checkpoint: true, hazardLabel: "VAULT LOCKDOWN", enemies: ["Vault constructs", "Fuel King loyalists"], triggers: ["Gate seal break", "Reserve flood"], reward: "Reinforced Alloy ×150" },
      { id: "fuel-king-boss", name: "The Fuel King", room: "Northwest Boss Gate", type: "BOSS_FIGHT", objective: "Break the Fuel King across all three of his forms", target: 9, checkpoint: false, hazardLabel: "SIEGE", enemies: ["The Fuel King"], triggers: ["Gate opens", "Rig disabled", "Core exposed"], bossPhases: [
        { name: "Phase I · Vehicle War", threshold: 100, mechanic: "The Fuel King fights from a massive armored rig across the open desert arena, alternating projectile volleys with turret sweeps.", counter: "Use terrain cover and disable the rig's turret mounts before it can lock on." },
        { name: "Phase II · Mech Form", threshold: 60, mechanic: "The rig is abandoned; he fights on foot in a scrap-limbed mech, firing fuel cannons as the arena floor destabilizes.", counter: "Bait fuel-cannon overheats, then punish the vented cooldown window." },
        { name: "Phase III · Core Entity", threshold: 25, mechanic: "The fight drops into the underground arena; his energy core is exposed and its weak points open and close on a rotating cycle.", counter: "Track the weak-point rotation and commit damage only when it's exposed." },
      ], reward: "King's Ransom" },
    ],
  },
];