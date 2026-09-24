import type { AbilitySlot, ClassId, PlaystyleMode } from "./loadout";

export type MasteryStream = "COMBAT" | "SYSTEMS" | "EXPLORATION";
export type AbilityNode = { id: string; name: string; classId: ClassId; slot: AbilitySlot; stream: MasteryStream; cost: number; description: string; links: readonly string[] };
export type ActiveBuild = { mode: PlaystyleMode; slots: Record<AbilitySlot, string> };

export const ABILITY_NODES: readonly AbilityNode[] = [
  { id: "fracture-shield", name: "Fracture Shield", classId: "TITAN", slot: "PRIMARY", stream: "COMBAT", cost: 0, description: "Carry a hard-light barrier through incoming fire.", links: ["phase-dash", "reality-field"] },
  { id: "ground-breaker", name: "Ground Breaker", classId: "TITAN", slot: "TACTICAL", stream: "COMBAT", cost: 12, description: "Interrupt enemies and destabilize cover.", links: ["mark-target"] },
  { id: "reality-bulwark", name: "Reality Bulwark", classId: "TITAN", slot: "ULTIMATE", stream: "SYSTEMS", cost: 28, description: "Raise a regenerating projectile-reflecting dome.", links: ["system-override"] },
  { id: "phase-dash", name: "Phase Dash", classId: "HUNTER", slot: "PRIMARY", stream: "EXPLORATION", cost: 0, description: "Pass through danger and amplify a timed follow-up.", links: ["fracture-shield", "code-pulse"] },
  { id: "mark-target", name: "Mark Target", classId: "HUNTER", slot: "TACTICAL", stream: "COMBAT", cost: 10, description: "Expose movement paths and shared critical zones.", links: ["ground-breaker"] },
  { id: "time-split", name: "Time Split Assault", classId: "HUNTER", slot: "ULTIMATE", stream: "EXPLORATION", cost: 30, description: "Afterimages repeat attacks inside a burst window.", links: ["system-override"] },
  { id: "code-pulse", name: "Code Pulse", classId: "WARLOCK", slot: "PRIMARY", stream: "SYSTEMS", cost: 0, description: "Reveal systems and silence hostile abilities.", links: ["phase-dash"] },
  { id: "reality-field", name: "Reality Tweak", classId: "WARLOCK", slot: "TACTICAL", stream: "SYSTEMS", cost: 14, description: "Create a gravity, slow, or suppression field.", links: ["fracture-shield"] },
  { id: "system-override", name: "System Override", classId: "WARLOCK", slot: "ULTIMATE", stream: "SYSTEMS", cost: 32, description: "Reduce cooldowns and disrupt hostile coordination.", links: ["reality-bulwark", "time-split"] },
];

export const DEFAULT_BUILD: ActiveBuild = { mode: "HYBRID", slots: { PRIMARY: "fracture-shield", TACTICAL: "mark-target", ULTIMATE: "system-override" } };

export function nodeById(id: string) { return ABILITY_NODES.find((node) => node.id === id) ?? ABILITY_NODES[0]; }
export function buildSynergy(build: ActiveBuild) {
  const classes = new Set(Object.values(build.slots).map((id) => nodeById(id)?.classId));
  const bonus = classes.size === 3 ? 18 : classes.size === 2 ? 12 : 8;
  const archetype = classes.size === 3 ? "Adaptive Fighter" : classes.has("TITAN") && classes.has("WARLOCK") ? "Defender" : classes.has("HUNTER") ? "Striker" : "Strategist";
  return { bonus, archetype };
}