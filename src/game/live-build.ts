import { ABILITY_CONFIGS, createAbilityRuntime, resolveSynergyEffects, tickAbilityRuntime, type AbilityRuntime } from "./combat-engine";
import type { ActiveBuild } from "./ability-network";
import type { AbilitySlot, ClassId, SubclassId } from "./loadout";
import { nodeById } from "./ability-network";
import { migrateBuild } from "./operators";
import { verbForActivation, VERB_LABEL, type StatusVerb, type SubclassVerbDef } from "./subclass-verbs";

export type { StatusVerb } from "./subclass-verbs";

/** An enemy-targeted verb pulse an activation just produced, waiting for Scene.tsx to apply it to
 * the live WorldSim (which LiveBuild has no access to) at the player's position, then clear it. */
export type PendingVerb = { verb: StatusVerb; magnitude: number; duration: number; radius: number };

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
  /** GOLIATH Siege Mode / NYX Phase Veil remaining seconds (Scene bridges them into sim + stealth) */
  siegeTime: number;
  veilTime: number;
  /** self-targeted subclass verb currently active (RAGE/OVERSHIELD/HASTE) — Scene.tsx reads
   * verbKind+verbTime+verbMagnitude each frame to drive sim.verbDamageMult/verbIncomingMult and
   * ability-energy haste; ticks down and clears itself in tickLiveBuild. */
  verbKind: StatusVerb | "";
  verbTime: number;
  verbMagnitude: number;
  /** enemy-targeted subclass verb (WEAKEN/MARKED/VOLATILE/SUPPRESS) waiting to be applied to the
   * world at the player's position by Scene.tsx right after activation, then cleared. */
  pendingVerb: PendingVerb | null;
};

export const classBuild = (classId: ClassId): ActiveBuild => ({ mode: "SOLO", slots: classId === "TITAN"
  ? { PRIMARY: "siege-mode", TACTICAL: "kinetic-slam", ULTIMATE: "bastion-shield" }
  : classId === "HUNTER" ? { PRIMARY: "phase-veil", TACTICAL: "rift-dash", ULTIMATE: "shadow-strike" }
    : { PRIMARY: "recon-swarm", TACTICAL: "disruption-pulse", ULTIMATE: "rift-turret" } });

export function createLiveBuild(equipped: ActiveBuild, branches: Record<string, string> = {}): LiveBuild {
  equipped = migrateBuild(equipped);
  return { equipped, branches, runtime: createAbilityRuntime(), energy: 100, effect: "", effectTime: 0, threat: "Scanning loadout", damageMultiplier: 1, shieldReflect: 0, dashTime: 0, hackTime: 0, fieldTime: 0, momentum: 0, siegeTime: 0, veilTime: 0, verbKind: "", verbTime: 0, verbMagnitude: 1, pendingVerb: null };
}

export function rebindLiveBuild(live: LiveBuild, equipped: ActiveBuild, branches: Record<string, string>): LiveBuild {
  equipped = migrateBuild(equipped);
  const changed = Object.values(equipped.slots).some((id, i) => id !== Object.values(live.equipped.slots)[i]) || Object.keys(branches).some((id) => branches[id] !== live.branches[id]) || Object.keys(live.branches).some((id) => !(id in branches));
  if (!changed) return live;
  const synergy = resolveSynergyEffects(Object.values(equipped.slots));
  const shieldReflect = branches["bastion-shield"] === "mirror-plate" ? 0.4 : 0;
  return { ...live, equipped, branches, runtime: createAbilityRuntime(), damageMultiplier: synergy.damageMultiplier, shieldReflect,
    threat: shieldReflect ? "Ranged units holding fire · melee pressure incoming" : equipped.slots.PRIMARY === "phase-veil" ? "Trackers predicting movement lanes" : equipped.slots.PRIMARY === "recon-swarm" ? "Defenders guarding system nodes" : "Hostiles closing on shield position",
    effect: "Loadout synchronized · combat rules updated", effectTime: 3 };
}

export function tickLiveBuild(live: LiveBuild, dt: number) {
  const hasteActive = live.verbKind === "HASTE" && live.verbTime > 0;
  const hasteRate = hasteActive ? live.verbMagnitude : 1;
  live.runtime = tickAbilityRuntime(live.runtime, dt * hasteRate);
  live.energy = Math.min(100, live.energy + dt * 9 * hasteRate);
  live.effectTime = Math.max(0, live.effectTime - dt);
  live.dashTime = Math.max(0, live.dashTime - dt);
  live.hackTime = Math.max(0, live.hackTime - dt);
  live.fieldTime = Math.max(0, live.fieldTime - dt);
  live.siegeTime = Math.max(0, live.siegeTime - dt);
  live.veilTime = Math.max(0, live.veilTime - dt);
  live.momentum = Math.max(0, live.momentum - dt * 0.05);
  live.verbTime = Math.max(0, live.verbTime - dt);
  if (live.verbTime === 0 && live.verbKind) { live.verbKind = ""; live.verbMagnitude = 1; }
}

/** `subclassId` is optional so callers that haven't wired identity through yet (and existing
 * callers/tests) keep working with plain class abilities and no verb attached. */
export function activateLiveAbility(live: LiveBuild, slot: AbilitySlot, environment: string, subclassId?: SubclassId) {
  const config = ABILITY_CONFIGS.find((item) => item.id === live.equipped.slots[slot]);
  const runtime = live.runtime[slot];
  if (!config || !runtime || runtime.cooldown > 0 || live.energy < config.resourceCost) return null;
  const branch = live.branches[config.id];
  const utility = Boolean(branch) && branch === nodeById(config.id)?.branches[2]?.id;
  const synergy = resolveSynergyEffects(Object.values(live.equipped.slots));
  live.energy -= config.resourceCost * (utility ? 0.85 : 1);
  live.runtime[slot] = { state: "ACTIVE", cooldown: config.cooldown * synergy.cooldownMultiplier, activeFor: Math.max(0.25, config.castTime + config.recovery) };
  const first = config.effects[0];
  if (config.id === "rift-dash") { live.dashTime = 0.45; live.momentum = Math.min(1, live.momentum + 0.4); }
  if (config.id === "disruption-pulse") live.hackTime = first?.duration ?? 5;
  if (config.id === "siege-mode") live.siegeTime = first?.duration ?? 8;
  if (config.id === "phase-veil") live.veilTime = first?.duration ?? 6;
  if (config.id === "bastion-shield") live.shieldReflect = branch === "mirror-plate" ? 0.4 : 0;
  const verbDef: SubclassVerbDef | null = subclassId ? verbForActivation(subclassId, slot) : null;
  if (verbDef) {
    if (verbDef.target === "self") { live.verbKind = verbDef.verb; live.verbTime = verbDef.duration; live.verbMagnitude = verbDef.magnitude; }
    else live.pendingVerb = { verb: verbDef.verb, magnitude: verbDef.magnitude, duration: verbDef.duration, radius: verbDef.radius };
  }
  live.effect = `${config.id.replaceAll("-", " ")} · ${verbDef ? `${VERB_LABEL[verbDef.verb]} applied` : environment === "fracture" && config.classId === "WARLOCK" ? "fracture amplified" : branch ? `${branch.replaceAll("-", " ")} active` : "effect active"}`;
  live.effectTime = 3;
  return config;
}