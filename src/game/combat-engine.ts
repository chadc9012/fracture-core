import type { AbilitySlot, ClassId } from "./loadout";

export type CombatState = "READY" | "CASTING" | "ACTIVE" | "RECOVERY" | "COOLDOWN";
export type EffectKind = "BLOCK" | "DAMAGE" | "DASH" | "MARK" | "SILENCE" | "FIELD" | "DOME" | "COOLDOWN_SHIFT" | "SIEGE" | "VEIL" | "STRIKE" | "TURRET";
export type AbilityEffect = { kind: EffectKind; value: number; duration?: number; radius?: number; tags?: readonly string[] };
export type AbilityConfig = {
  id: string; classId: ClassId; slot: AbilitySlot; input: "Q" | "E" | "R"; cooldown: number; resourceCost: number;
  castTime: number; recovery: number; effects: readonly AbilityEffect[];
};
export type AbilityRuntime = { state: CombatState; cooldown: number; activeFor: number };

export const ABILITY_CONFIGS: readonly AbilityConfig[] = [
  // GOLIATH
  { id: "siege-mode", classId: "TITAN", slot: "PRIMARY", input: "Q", cooldown: 25, resourceCost: 25, castTime: 0.2, recovery: 0.3, effects: [{ kind: "SIEGE", value: 1.3, duration: 8, tags: ["stability", "firepower"] }] },
  { id: "kinetic-slam", classId: "TITAN", slot: "TACTICAL", input: "E", cooldown: 18, resourceCost: 20, castTime: 0.25, recovery: 0.45, effects: [{ kind: "DAMAGE", value: 60, radius: 7, tags: ["shockwave", "knockback", "interrupt"] }] },
  { id: "bastion-shield", classId: "TITAN", slot: "ULTIMATE", input: "R", cooldown: 24, resourceCost: 40, castTime: 0.4, recovery: 0.5, effects: [{ kind: "DOME", value: 100, radius: 5, duration: 10 }] },
  // NYX
  { id: "phase-veil", classId: "HUNTER", slot: "PRIMARY", input: "Q", cooldown: 18, resourceCost: 15, castTime: 0, recovery: 0.15, effects: [{ kind: "VEIL", value: 0.15, duration: 6, tags: ["stealth"] }] },
  { id: "rift-dash", classId: "HUNTER", slot: "TACTICAL", input: "E", cooldown: 10, resourceCost: 12, castTime: 0, recovery: 0.12, effects: [{ kind: "DASH", value: 11, duration: 0.28, tags: ["invulnerable", "teleport"] }] },
  { id: "shadow-strike", classId: "HUNTER", slot: "ULTIMATE", input: "R", cooldown: 22, resourceCost: 35, castTime: 0.15, recovery: 0.4, effects: [{ kind: "STRIKE", value: 4, radius: 16, tags: ["close-range", "veil-bonus"] }] },
  // CIPHER
  { id: "recon-swarm", classId: "WARLOCK", slot: "PRIMARY", input: "Q", cooldown: 20, resourceCost: 18, castTime: 0.15, recovery: 0.25, effects: [{ kind: "MARK", value: 1.25, radius: 30, duration: 8, tags: ["reveal", "swarm"] }] },
  { id: "disruption-pulse", classId: "WARLOCK", slot: "TACTICAL", input: "E", cooldown: 18, resourceCost: 24, castTime: 0.3, recovery: 0.4, effects: [{ kind: "SILENCE", value: 1, radius: 14, duration: 5, tags: ["emp", "disable-tech"] }] },
  { id: "rift-turret", classId: "WARLOCK", slot: "ULTIMATE", input: "R", cooldown: 30, resourceCost: 45, castTime: 0.4, recovery: 0.5, effects: [{ kind: "TURRET", value: 1, radius: 34, duration: 20, tags: ["deployable"] }] },
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