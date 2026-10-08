import type { AbilitySlot, ClassId, PlaystyleMode } from "./loadout";

export type MasteryStream = "COMBAT" | "SYSTEMS" | "EXPLORATION";
export type EvolutionBranch = { id: string; name: string; role: string; modifier: string; synergy: string };
export type AbilityNode = { id: string; name: string; classId: ClassId; slot: AbilitySlot; stream: MasteryStream; cost: number; cooldown: number; resource: number; description: string; links: readonly string[]; branches: readonly EvolutionBranch[] };
export type ActiveBuild = { mode: PlaystyleMode; slots: Record<AbilitySlot, string> };

export const ABILITY_NODES: readonly AbilityNode[] = [
  { id: "fracture-shield", name: "Fracture Shield", classId: "TITAN", slot: "PRIMARY", stream: "COMBAT", cost: 0, cooldown: 0, resource: 0, description: "Carry a hard-light barrier through incoming fire.", links: ["phase-dash", "reality-field"], branches: branchSet("Bastion", "Reflector", "Vanguard") },
  { id: "ground-breaker", name: "Ground Breaker", classId: "TITAN", slot: "TACTICAL", stream: "COMBAT", cost: 12, cooldown: 4, resource: 20, description: "Interrupt enemies and destabilize cover.", links: ["mark-target"], branches: branchSet("Fault Line", "Aftershock", "Safeguard") },
  { id: "reality-bulwark", name: "Reality Bulwark", classId: "TITAN", slot: "ULTIMATE", stream: "SYSTEMS", cost: 28, cooldown: 18, resource: 45, description: "Raise a regenerating projectile-reflecting dome.", links: ["system-override"], branches: branchSet("Citadel", "Mirror", "Sanctuary") },
  { id: "phase-dash", name: "Phase Dash", classId: "HUNTER", slot: "PRIMARY", stream: "EXPLORATION", cost: 0, cooldown: 3.5, resource: 15, description: "Pass through danger and amplify a timed follow-up.", links: ["fracture-shield", "code-pulse"], branches: branchSet("Slipstream", "Ghost Step", "Kinetic Edge") },
  { id: "mark-target", name: "Mark Target", classId: "HUNTER", slot: "TACTICAL", stream: "COMBAT", cost: 10, cooldown: 9, resource: 20, description: "Expose movement paths and shared critical zones.", links: ["ground-breaker"], branches: branchSet("Predator", "Relay", "Fault Finder") },
  { id: "time-split", name: "Time Split Assault", classId: "HUNTER", slot: "ULTIMATE", stream: "EXPLORATION", cost: 30, cooldown: 24, resource: 50, description: "Afterimages repeat attacks inside a burst window.", links: ["system-override"], branches: branchSet("Echo Volley", "Second Self", "Zero Hour") },
  { id: "code-pulse", name: "Code Pulse", classId: "WARLOCK", slot: "PRIMARY", stream: "SYSTEMS", cost: 0, cooldown: 5, resource: 12, description: "Reveal systems and silence hostile abilities.", links: ["phase-dash"], branches: branchSet("Blackout", "Deep Scan", "Feedback") },
  { id: "reality-field", name: "Reality Tweak", classId: "WARLOCK", slot: "TACTICAL", stream: "SYSTEMS", cost: 14, cooldown: 11, resource: 24, description: "Create a gravity, slow, or suppression field.", links: ["fracture-shield"], branches: branchSet("Gravity Well", "Null Zone", "Drift Field") },
  { id: "system-override", name: "System Override", classId: "WARLOCK", slot: "ULTIMATE", stream: "SYSTEMS", cost: 32, cooldown: 26, resource: 55, description: "Reduce cooldowns and disrupt hostile coordination.", links: ["reality-bulwark", "time-split"], branches: branchSet("Synthesis", "Command Breach", "Shared Clock") },
];

function branchSet(first: string, second: string, third: string): readonly EvolutionBranch[] {
  return [
    { id: first.toLowerCase().replaceAll(" ", "-"), name: first, role: "Power", modifier: "+18% primary effect", synergy: "Amplifies matching class effects" },
    { id: second.toLowerCase().replaceAll(" ", "-"), name: second, role: "Control", modifier: "+25% effect duration", synergy: "Extends linked status effects" },
    { id: third.toLowerCase().replaceAll(" ", "-"), name: third, role: "Utility", modifier: "−15% resource cost", synergy: "Shares part of the benefit with allies" },
  ];
}

export const DEFAULT_BUILD: ActiveBuild = { mode: "HYBRID", slots: { PRIMARY: "fracture-shield", TACTICAL: "mark-target", ULTIMATE: "system-override" } };

export function nodeById(id: string) { return ABILITY_NODES.find((node) => node.id === id) ?? ABILITY_NODES[0]; }
export function buildSynergy(build: ActiveBuild) {
  const classes = new Set(Object.values(build.slots).map((id) => nodeById(id)?.classId));
  const bonus = classes.size === 3 ? 18 : classes.size === 2 ? 12 : 8;
  const archetype = classes.size === 3 ? "Adaptive Fighter" : classes.has("TITAN") && classes.has("WARLOCK") ? "Defender" : classes.has("HUNTER") ? "Striker" : "Strategist";
  return { bonus, archetype };
}