import { ABILITY_CONFIGS, createAbilityRuntime, resolveSynergyEffects, tickAbilityRuntime, type AbilityRuntime } from "./combat-engine";
import type { ActiveBuild } from "./ability-network";
import type { AbilitySlot, ClassId } from "./loadout";

export type LiveBuild = {
  equipped: ActiveBuild;
  branches: Record<string, string>;
  runtime: Record<AbilitySlot, AbilityRuntime>;
  energy: number;
  effect: string;
  effectTime: number;
  threat: string;
  damageMultiplier: number;
  shieldReflect: number;
  dashTime: number;
  hackTime: number;
  fieldTime: number;
  momentum: number;
};

export const classBuild = (classId: ClassId): ActiveBuild => ({ mode: "SOLO", slots: classId === "TITAN"
  ? { PRIMARY: "fracture-shield", TACTICAL: "ground-breaker", ULTIMATE: "reality-bulwark" }
  : classId === "HUNTER" ? { PRIMARY: "phase-dash", TACTICAL: "mark-target", ULTIMATE: "time-split" }
    : { PRIMARY: "code-pulse", TACTICAL: "reality-field", ULTIMATE: "system-override" } });

export function createLiveBuild(equipped: ActiveBuild, branches: Record<string, string> = {}): LiveBuild {
  return { equipped, branches, runtime: createAbilityRuntime(), energy: 100, effect: "", effectTime: 0, threat: "Scanning loadout", damageMultiplier: 1, shieldReflect: 0, dashTime: 0, hackTime: 0, fieldTime: 0, momentum: 0 };
}

export function rebindLiveBuild(live: LiveBuild, equipped: ActiveBuild, branches: Record<string, string>): LiveBuild {
  const changed = Object.values(equipped.slots).some((id, i) => id !== Object.values(live.equipped.slots)[i]) || Object.keys(branches).some((id) => branches[id] !== live.branches[id]);
  if (!changed) return live;
  const synergy = resolveSynergyEffects(Object.values(equipped.slots));
  const shieldReflect = branches["fracture-shield"] === "reflector" || branches["reality-bulwark"] === "mirror" ? 0.4 : 0;
  return { ...live, equipped, branches, runtime: createAbilityRuntime(), damageMultiplier: synergy.damageMultiplier, shieldReflect,
    threat: shieldReflect ? "Ranged units holding fire · melee pressure incoming" : equipped.slots.PRIMARY === "phase-dash" ? "Trackers predicting movement lanes" : equipped.slots.PRIMARY === "code-pulse" ? "Defenders guarding system nodes" : "Hostiles closing on shield position",
    effect: "Loadout synchronized · combat rules updated", effectTime: 3 };
}

export function tickLiveBuild(live: LiveBuild, dt: number) {
  live.runtime = tickAbilityRuntime(live.runtime, dt);
  live.energy = Math.min(100, live.energy + dt * 9);
  live.effectTime = Math.max(0, live.effectTime - dt);
  live.dashTime = Math.max(0, live.dashTime - dt);
  live.hackTime = Math.max(0, live.hackTime - dt);
  live.fieldTime = Math.max(0, live.fieldTime - dt);
  live.momentum = Math.max(0, live.momentum - dt * 0.05);
}

export function activateLiveAbility(live: LiveBuild, slot: AbilitySlot, environment: string) {
  const config = ABILITY_CONFIGS.find((item) => item.id === live.equipped.slots[slot]);
  const runtime = live.runtime[slot];
  if (!config || !runtime || runtime.cooldown > 0 || live.energy < config.resourceCost) return null;
  const branch = live.branches[config.id];
  const utility = branch === "vanguard" || branch === "safeguard" || branch === "sanctuary" || branch === "slipstream" || branch === "relay" || branch === "zero-hour" || branch === "feedback" || branch === "drift-field" || branch === "shared-clock";
  const synergy = resolveSynergyEffects(Object.values(live.equipped.slots));
  live.energy -= config.resourceCost * (utility ? 0.85 : 1);
  live.runtime[slot] = { state: "ACTIVE", cooldown: config.cooldown * synergy.cooldownMultiplier, activeFor: Math.max(0.25, config.castTime + config.recovery) };
  if (config.id === "phase-dash") { live.dashTime = 0.45; live.momentum = Math.min(1, live.momentum + 0.4); }
  if (config.id === "code-pulse" || config.id === "system-override") live.hackTime = config.id === "code-pulse" ? 4 : 10;
  if (config.id === "reality-field") live.fieldTime = 8;
  if (config.id === "fracture-shield") live.shieldReflect = branch === "reflector" ? 0.4 : 0;
  live.effect = `${config.id.replaceAll("-", " ")} · ${environment === "fracture" && config.classId === "WARLOCK" ? "fracture amplified" : branch ? `${branch.replaceAll("-", " ")} active` : "effect active"}`;
  live.effectTime = 3;
  return config;
}