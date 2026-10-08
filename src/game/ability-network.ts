import type { AbilitySlot, ClassId, PlaystyleMode } from "./loadout";

export type MasteryStream = "COMBAT" | "SYSTEMS" | "EXPLORATION";
export type EvolutionBranch = { id: string; name: string; role: string; modifier: string; synergy: string };
export type AbilityNode = { id: string; name: string; classId: ClassId; slot: AbilitySlot; stream: MasteryStream; cost: number; cooldown: number; resource: number; description: string; links: readonly string[]; branches: readonly EvolutionBranch[] };
export type ActiveBuild = { mode: PlaystyleMode; slots: Record<AbilitySlot, string> };

export const ABILITY_NODES: readonly AbilityNode[] = [
  // GOLIATH · Destroyer (TITAN)
  { id: "siege-mode", name: "Siege Mode", classId: "TITAN", slot: "PRIMARY", stream: "COMBAT", cost: 0, cooldown: 25, resource: 25, description: "Increase weapon stability and firepower.", links: ["rift-dash", "kinetic-slam"], branches: branchSet("Hold Fast", "Suppressor", "Shared Stance") },
  { id: "kinetic-slam", name: "Kinetic Slam", classId: "TITAN", slot: "TACTICAL", stream: "COMBAT", cost: 12, cooldown: 18, resource: 20, description: "Release a shockwave around you.", links: ["disruption-pulse"], branches: branchSet("Fault Line", "Aftershock", "Safeguard") },
  { id: "bastion-shield", name: "Bastion Shield", classId: "TITAN", slot: "ULTIMATE", stream: "SYSTEMS", cost: 28, cooldown: 24, resource: 40, description: "Deploy temporary defensive protection.", links: ["rift-turret"], branches: branchSet("Citadel", "Mirror Plate", "Sanctuary") },
  // NYX · Assassin (HUNTER)
  { id: "phase-veil", name: "Phase Veil", classId: "HUNTER", slot: "PRIMARY", stream: "EXPLORATION", cost: 0, cooldown: 18, resource: 15, description: "Briefly conceal yourself.", links: ["rift-dash", "recon-swarm"], branches: branchSet("Deep Cover", "Afterglow", "Shared Veil") },
  { id: "rift-dash", name: "Rift Dash", classId: "HUNTER", slot: "TACTICAL", stream: "EXPLORATION", cost: 10, cooldown: 10, resource: 12, description: "Quickly teleport a short distance.", links: ["siege-mode"], branches: branchSet("Kinetic Edge", "Ghost Step", "Slipstream") },
  { id: "shadow-strike", name: "Shadow Strike", classId: "HUNTER", slot: "ULTIMATE", stream: "COMBAT", cost: 30, cooldown: 22, resource: 35, description: "Deliver a powerful close-range attack.", links: ["rift-turret"], branches: branchSet("Killing Edge", "Echo Blade", "Zero Hour") },
  // CIPHER · Tech (WARLOCK)
  { id: "recon-swarm", name: "Recon Swarm", classId: "WARLOCK", slot: "PRIMARY", stream: "SYSTEMS", cost: 0, cooldown: 20, resource: 18, description: "Reveal nearby enemies.", links: ["phase-veil"], branches: branchSet("Deep Scan", "Hunter Swarm", "Relay") },
  { id: "disruption-pulse", name: "Disruption Pulse", classId: "WARLOCK", slot: "TACTICAL", stream: "SYSTEMS", cost: 14, cooldown: 18, resource: 24, description: "Temporarily disable enemy technology.", links: ["kinetic-slam"], branches: branchSet("Blackout", "Null Zone", "Feedback") },
  { id: "rift-turret", name: "Rift Turret", classId: "WARLOCK", slot: "ULTIMATE", stream: "SYSTEMS", cost: 32, cooldown: 30, resource: 45, description: "Deploy an automated combat device.", links: ["bastion-shield", "shadow-strike"], branches: branchSet("Overclock", "Twin Mount", "Shared Clock") },
];

function branchSet(first: string, second: string, third: string): readonly EvolutionBranch[] {
  return [
    { id: first.toLowerCase().replaceAll(" ", "-"), name: first, role: "Power", modifier: "+18% primary effect", synergy: "Amplifies matching class effects" },
    { id: second.toLowerCase().replaceAll(" ", "-"), name: second, role: "Control", modifier: "+25% effect duration", synergy: "Extends linked status effects" },
    { id: third.toLowerCase().replaceAll(" ", "-"), name: third, role: "Utility", modifier: "−15% resource cost", synergy: "Shares part of the benefit with allies" },
  ];
}

export const DEFAULT_BUILD: ActiveBuild = { mode: "HYBRID", slots: { PRIMARY: "siege-mode", TACTICAL: "rift-dash", ULTIMATE: "rift-turret" } };

export function nodeById(id: string) { return ABILITY_NODES.find((node) => node.id === id) ?? ABILITY_NODES[0]; }
export function buildSynergy(build: ActiveBuild) {
  const classes = new Set(Object.values(build.slots).map((id) => nodeById(id)?.classId));
  const bonus = classes.size === 3 ? 18 : classes.size === 2 ? 12 : 8;
  const archetype = classes.size === 3 ? "Adaptive Fighter" : classes.has("TITAN") && classes.has("WARLOCK") ? "Defender" : classes.has("HUNTER") ? "Striker" : "Strategist";
  return { bonus, archetype };
}