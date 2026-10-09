import { nodeById } from "./ability-network";
import type { AbilityConfig, AbilityEffect } from "./combat-engine";

/**
 * Evolution branches (ability-network.ts branchSet) are always [Power, Control, Utility]:
 *   Power   +18% primary effect   · Control +25% effect duration   · Utility −15% resource cost.
 * This module is the single place those numbers become live combat rules (pure, so it is testable
 * apart from Scene). Scene reads the already-scaled effects that activateLiveAbility returns.
 */
export type BranchTier = "POWER" | "CONTROL" | "UTILITY";

export const POWER_MULT = 1.18;
export const CONTROL_DURATION_MULT = 1.25;
export const UTILITY_COST_MULT = 0.85;

const TIERS: readonly BranchTier[] = ["POWER", "CONTROL", "UTILITY"];

export function branchTier(abilityId: string, branchId: string | undefined): BranchTier | null {
  if (!branchId) return null;
  const idx = nodeById(abilityId)?.branches.findIndex((branch) => branch.id === branchId) ?? -1;
  return idx >= 0 ? TIERS[idx]! : null;
}

export const powerMult = (tier: BranchTier | null) => (tier === "POWER" ? POWER_MULT : 1);
export const durationMult = (tier: BranchTier | null) => (tier === "CONTROL" ? CONTROL_DURATION_MULT : 1);
export const costMult = (tier: BranchTier | null) => (tier === "UTILITY" ? UTILITY_COST_MULT : 1);

/** Multiplier-style effects (MARK 1.25x, SIEGE 1.3x) scale their bonus part; flat effects scale whole. */
const MULTIPLIER_KINDS = new Set<AbilityEffect["kind"]>(["MARK", "SIEGE", "VEIL"]);

export function scaleEffect(effect: AbilityEffect, tier: BranchTier | null): AbilityEffect {
  if (!tier || tier === "UTILITY") return effect;
  if (tier === "POWER") {
    const value = MULTIPLIER_KINDS.has(effect.kind) ? 1 + (effect.value - 1) * POWER_MULT : effect.value * POWER_MULT;
    return { ...effect, value: effect.kind === "VEIL" ? effect.value : value };
  }
  return effect.duration ? { ...effect, duration: effect.duration * CONTROL_DURATION_MULT } : effect;
}

export function scaleConfig(config: AbilityConfig, branchId: string | undefined): AbilityConfig {
  const tier = branchTier(config.id, branchId);
  return tier ? { ...config, effects: config.effects.map((effect) => scaleEffect(effect, tier)) } : config;
}

export const BRANCH_LABEL: Record<BranchTier, string> = { POWER: "+18% power", CONTROL: "+25% duration", UTILITY: "−15% energy cost" };

/**
 * What the equipped branches tell enemy squads about how you fight. Two or more equipped abilities on
 * the same branch tier set a posture; otherwise enemies read you as unspecialised ("NONE").
 *   POWER   — burst damage: ranged units keep a longer standoff and leaders hang back out of your reach
 *   CONTROL — lingering fields: squads spread out instead of bunching inside your zones
 *   UTILITY — sustained rotation: flankers commit early and close tighter to punish the long game
 */
export type BranchPosture = "NONE" | BranchTier;

export function branchPosture(slots: Record<string, string>, branches: Record<string, string>): BranchPosture {
  const counts: Record<BranchTier, number> = { POWER: 0, CONTROL: 0, UTILITY: 0 };
  for (const abilityId of Object.values(slots)) {
    const tier = branchTier(abilityId, branches[abilityId]);
    if (tier) counts[tier]++;
  }
  const best = (Object.keys(counts) as BranchTier[]).sort((a, b) => counts[b] - counts[a])[0]!;
  return counts[best] >= 2 ? best : "NONE";
}

export const POSTURE_THREAT: Record<BranchPosture, string> = {
  NONE: "",
  POWER: "Ranged units keeping a long standoff from your burst damage",
  CONTROL: "Squads spreading out to avoid your lingering fields",
  UTILITY: "Flankers committing early against your sustained rotation",
};
