import type { ClassId } from "./loadout";
import type { ActiveBuild } from "./ability-network";

export const FRACTURE_RAID = { id: "fracture-core", name: "The Fracture Core", players: { min: 6, max: 12 }, phases: ["System Entry Collapse", "AI Defense Reaction", "Fracture Puzzle Core", "Core Sentinel"], roles: { TITAN: "Anchor unstable nodes", HUNTER: "Disrupt spawn pressure", WARLOCK: "Stabilize system logic" }, reward: "Class-aligned system core", privateInstance: true, finalBoss: { name: "The Anomaly Prime", lair: "The Fracture — between the Nexus City perimeter gate and the Solara desert border", tell: "Reality fractures outward before the collapse", drop: "anomalyCore" } } as const;
export const WORLD_LAYERS = ["SURFACE", "ACTIVE", "FRACTURE"] as const;
export const BIOMES = [
  { id: "solara", name: "Solara Arc", layer: "ACTIVE", weather: "Sandstorm", mechanic: "Visibility and heat pressure", content: "Sunken Arcology Vaults", loot: "Mobility / precision" },
  { id: "frostspire", name: "Frostspire Range", layer: "ACTIVE", weather: "Frost shock", mechanic: "Exposure and ice collapse", content: "Glacial Crevasse", loot: "Stability / system" },
  { id: "echo-veil", name: "Echo Veil", layer: "ACTIVE", weather: "Memory fog", mechanic: "Delayed echo events", content: "Temple of Echoes", loot: "Control / stealth" },
  { id: "fracture-core", name: "Fracture Core", layer: "FRACTURE", weather: "Fracture surge", mechanic: "Shifting gravity and adaptive AI", content: "The Fracture Core raid", loot: "Adaptive cores" },
] as const;
export type DirectorSnapshot = { skill: number; buildStrength: number; engagement: number; fatigue: number; classId: ClassId; shieldUses: number; dashes: number; hacks: number; chaos: number };
export function directWorld(s: DirectorSnapshot) {
  const difficulty = Math.max(1, Math.min(10, Math.round((s.skill + s.buildStrength + s.engagement - s.fatigue) / 4)));
  const pressure = s.chaos > 7 || s.fatigue > 6 ? "STABILIZE" : s.engagement < 3 ? "EVENT" : "ESCALATE";
  const event = pressure === "STABILIZE" ? "Safe route and recovery window" : s.classId === "TITAN" && s.shieldUses > 3 ? "Telegraphed shield-breaker wave" : s.classId === "HUNTER" && s.dashes > 3 ? "Predictive trap lanes" : s.classId === "WARLOCK" && s.hacks > 3 ? "Anti-hack node defense" : "Fracture surge warning";
  return { difficulty, pressure, event, counterWindow: true };
}
export const COSMETIC_CATEGORIES = ["Armor forms", "Weapon visuals", "Identity auras", "Interface themes", "Emotes", "Seasonal visuals"] as const;
export const PVP_MODES = ["1v1 Duels", "3v3 Strike Teams", "6v6 Arena Control"] as const;
export const PVP_RANKS = ["Bronze", "Silver", "Gold", "Platinum", "Ascendant"] as const;
export type BuildBlueprint = { name: string; classId: ClassId; build: ActiveBuild; branchIds: Record<string, string>; modules: string[]; playstyle: string; bonded: boolean };
export function bondBlueprint(blueprint: BuildBlueprint): BuildBlueprint { return { ...blueprint, bonded: true, modules: blueprint.modules.slice(0, 3) }; }
export function guildLevel(xp: number) { return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1); }
export function guildUnlocks(level: number) { return ["Shared stash", "Guild buffs", "Shared builds", "Raid access", "Territory control"].filter((_, i) => level >= ([1, 3, 5, 10, 15][i] ?? 999)); }