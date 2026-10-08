import type { AbilitySlot, ClassId } from "./loadout";

export type CombatState = "READY" | "CASTING" | "ACTIVE" | "RECOVERY" | "COOLDOWN";
export type EffectKind = "BLOCK" | "DAMAGE" | "DASH" | "MARK" | "SILENCE" | "FIELD" | "DOME" | "COOLDOWN_SHIFT";
export type AbilityEffect = { kind: EffectKind; value: number; duration?: number; radius?: number; tags?: readonly string[] };
export type AbilityConfig = {
  id: string; classId: ClassId; slot: AbilitySlot; input: "Q" | "E" | "R"; cooldown: number; resourceCost: number;
  castTime: number; recovery: number; effects: readonly AbilityEffect[];
};
export type AbilityRuntime = { state: CombatState; cooldown: number; activeFor: number };

export const ABILITY_CONFIGS: readonly AbilityConfig[] = [
  { id: "fracture-shield", classId: "TITAN", slot: "PRIMARY", input: "Q", cooldown: 0, resourceCost: 0, castTime: 0, recovery: 0.15, effects: [{ kind: "BLOCK", value: 0.72, duration: 0.3 }] },
  { id: "ground-breaker", classId: "TITAN", slot: "TACTICAL", input: "E", cooldown: 4, resourceCost: 20, castTime: 0.2, recovery: 0.45, effects: [{ kind: "DAMAGE", value: 42, radius: 4, tags: ["interrupt", "cover-break"] }] },
  { id: "reality-bulwark", classId: "TITAN", slot: "ULTIMATE", input: "R", cooldown: 18, resourceCost: 45, castTime: 0.5, recovery: 0.6, effects: [{ kind: "DOME", value: 100, radius: 6, duration: 8 }] },
  { id: "phase-dash", classId: "HUNTER", slot: "PRIMARY", input: "Q", cooldown: 3.5, resourceCost: 15, castTime: 0, recovery: 0.12, effects: [{ kind: "DASH", value: 8, duration: 0.28, tags: ["invulnerable", "momentum"] }] },
  { id: "mark-target", classId: "HUNTER", slot: "TACTICAL", input: "E", cooldown: 9, resourceCost: 20, castTime: 0.18, recovery: 0.3, effects: [{ kind: "MARK", value: 1.25, radius: 24, duration: 8 }] },
  { id: "time-split", classId: "HUNTER", slot: "ULTIMATE", input: "R", cooldown: 24, resourceCost: 50, castTime: 0.35, recovery: 0.4, effects: [{ kind: "DAMAGE", value: 0.65, duration: 6, tags: ["echo-fire", "afterimage"] }] },
  { id: "code-pulse", classId: "WARLOCK", slot: "PRIMARY", input: "Q", cooldown: 5, resourceCost: 12, castTime: 0.15, recovery: 0.25, effects: [{ kind: "SILENCE", value: 1, radius: 12, duration: 4 }] },
  { id: "reality-field", classId: "WARLOCK", slot: "TACTICAL", input: "E", cooldown: 11, resourceCost: 24, castTime: 0.35, recovery: 0.4, effects: [{ kind: "FIELD", value: 0.55, radius: 7, duration: 8, tags: ["gravity", "slow"] }] },
  { id: "system-override", classId: "WARLOCK", slot: "ULTIMATE", input: "R", cooldown: 26, resourceCost: 55, castTime: 0.55, recovery: 0.5, effects: [{ kind: "COOLDOWN_SHIFT", value: 0.45, radius: 14, duration: 10, tags: ["ally-buff", "enemy-disrupt"] }] },
];

export function createAbilityRuntime(): Record<AbilitySlot, AbilityRuntime> {
  return { PRIMARY: { state: "READY", cooldown: 0, activeFor: 0 }, TACTICAL: { state: "READY", cooldown: 0, activeFor: 0 }, ULTIMATE: { state: "READY", cooldown: 0, activeFor: 0 } };
}

export function tickAbilityRuntime(runtime: Record<AbilitySlot, AbilityRuntime>, dt: number) {
  return Object.fromEntries(Object.entries(runtime).map(([slot, value]) => {
    const cooldown = Math.max(0, value.cooldown - dt);
    const activeFor = Math.max(0, value.activeFor - dt);
    const state: CombatState = activeFor > 0 ? "ACTIVE" : cooldown > 0 ? "COOLDOWN" : "READY";
    return [slot, { state, cooldown, activeFor }];
  })) as Record<AbilitySlot, AbilityRuntime>;
}

export function resolveSynergyEffects(abilityIds: readonly string[]) {
  const abilities = abilityIds.map((id) => ABILITY_CONFIGS.find((ability) => ability.id === id)).filter((ability): ability is AbilityConfig => Boolean(ability));
  const classes = new Set(abilities.map((ability) => ability.classId));
  return { damageMultiplier: classes.size === 3 ? 1.18 : classes.size === 2 ? 1.12 : 1.08, cooldownMultiplier: classes.has("WARLOCK") ? 0.9 : 1, stabilityBonus: classes.has("TITAN") ? 12 : 0, momentumBonus: classes.has("HUNTER") ? 0.15 : 0 };
}