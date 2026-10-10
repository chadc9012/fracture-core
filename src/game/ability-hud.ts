/** HUD view of the live ability state. No sim dependency: it only reads the LiveBuild, so the HUD shows exactly what the
 * simulation will accept (usable = off cooldown AND enough energy), never a separate copy of the rules. */
import { ABILITY_CONFIGS } from "./combat-engine";
import { classBuild, createLiveBuild, type LiveBuild } from "./live-build";
import { nodeById } from "./ability-network";
import { branchTier, costMult } from "./branch-effects";
import type { AbilitySlot, ClassId } from "./loadout";

export const baseConfig = (live: LiveBuild, slot: AbilitySlot) => ABILITY_CONFIGS.find((c) => c.id === live.equipped.slots[slot]);

const KEYS: Record<AbilitySlot, string> = { PRIMARY: "Q", TACTICAL: "E", ULTIMATE: "R" };

/** Energy this slot costs right now (base cost, Utility branch discount). */
export function abilityCost(live: LiveBuild, slot: AbilitySlot): number {
  const base = baseConfig(live, slot);
  if (!base) return 0;
  return base.resourceCost * costMult(branchTier(base.id, live.branches[base.id]));
}

export type AbilityHudState = "READY" | "ACTIVE" | "COOLDOWN" | "NO_ENERGY";
export type AbilityHud = { slot: AbilitySlot; key: string; id: string; name: string; state: AbilityHudState; ready: boolean; cooldown: number; cooldownMax: number; cost: number };

/** What the HUD shows, read straight off the live build: usable means off cooldown AND enough energy. */
export function abilityHud(live: LiveBuild): AbilityHud[] {
  return (["PRIMARY", "TACTICAL", "ULTIMATE"] as const).map((slot) => {
    const id = live.equipped.slots[slot];
    const cfg = ABILITY_CONFIGS.find((c) => c.id === id);
    const rt = live.runtime[slot];
    const cost = abilityCost(live, slot);
    const cooling = (rt?.cooldown ?? 0) > 0;
    const state: AbilityHudState = (rt?.activeFor ?? 0) > 0 ? "ACTIVE" : cooling ? "COOLDOWN" : live.energy < cost ? "NO_ENERGY" : "READY";
    return { slot, key: KEYS[slot], id, name: nodeById(id)?.name ?? id, state, ready: !cooling && live.energy >= cost, cooldown: Math.round((rt?.cooldown ?? 0) * 10) / 10, cooldownMax: cfg?.cooldown ?? 0, cost: Math.round(cost) };
  });
}

/** Placeholder HUD row before the world mounts: the class's own default build, all ready. */
export const idleAbilityHud = (classId: ClassId): AbilityHud[] => abilityHud(createLiveBuild(classBuild(classId)));
