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
];