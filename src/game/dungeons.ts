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
    id: "sunken-arcology", name: "Sunken Arcology Vaults", activity: "DUNGEON", region: "Solara Desert", privateInstance: true,
    squad: { min: 1, max: 3 }, duration: "25–35 min", maxLives: 3,
    identity: "A pre-Fracture city buried beneath a moving desert.", hazard: "Sand-fill pressure", boss: "Aegis-Prime, Architect Security",
    signature: { name: "Hourglass Protocol", type: "WEAPON", perk: "Final shots suspend nearby targets in compressed sand-time.", repeatTraits: ["Chamber Pressure", "Architect's Patience", "Sifted Payload"] },
    stages: [
      { id: "descent", name: "Buried Descent", type: "SYNC_TRAVERSAL", objective: "Seal flood gates before chambers fill", target: 3, checkpoint: true, hazardLabel: "SAND FILL" },
      { id: "archive", name: "Optimization Archive", type: "SYNC_TRAVERSAL", objective: "Synchronize dormant Architect terminals", target: 4, checkpoint: true, hazardLabel: "SAND FILL" },
      { id: "aegis", name: "The Vanished Creator", type: "BOSS_FIGHT", objective: "Break Aegis-Prime's security phases", target: 5, checkpoint: false, hazardLabel: "LOCKDOWN" },
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