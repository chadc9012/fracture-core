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
