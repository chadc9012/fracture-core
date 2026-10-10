/** Authoritative gameplay for the equipped class abilities (Q / E / R). Scene.tsx only forwards the input edge and the
 * player's pose; everything that costs energy, changes enemy state or hurts anyone happens HERE, against the real WorldSim,
 * so it is testable and presentation (HUD, animation, VFX) can only read what this module records.
 *
 * Boundaries:
 *  - live-build.ts owns the build (equipped slots, branches, energy, cooldowns, timers) and its cost/cooldown rules.
 *  - sim.ts owns damage shaping (applyMachineDamageMods: Weaken/Marked, boss poise, scenario gimmicks, participation)
 *    and stun (stunMachine: bosses are capped, never hard-locked).
 *  - This module wires one to the other and appends AbilityEvents to sim.abilityEvents (stable ids, newest last). */
import { ABILITY_CONFIGS, type AbilityConfig, type EffectKind } from "./combat-engine";
import { activateLiveAbility, createLiveBuild, type LiveBuild } from "./live-build";
import { nodeById } from "./ability-network";
import { abilityCost, baseConfig } from "./ability-hud";
import type { AbilitySlot, SubclassId } from "./loadout";
import { VERB_LABEL } from "./subclass-verbs";
import { knockbackFrom, siegeDamageMult, strikeDamage, strikeLanding, veilSightMult } from "./operator-abilities";
import { queryObstacles } from "./obstacles";
import { INITIAL_POISE, hitPoise } from "./boss-poise";
import { alert, applyMachineDamageMods, applyVulnPulse, defeatMachine, placeRiftTurret, spawnVolatileZone, stunMachine, type Machine, type WorldSim } from "./sim";

export type RejectReason = "COOLDOWN" | "ENERGY" | "NO_TARGET" | "NO_ABILITY" | "IN_VEHICLE";
export type AbilityEventKind = "CAST" | "REJECTED" | "CANCELLED";
export type AbilityEvent = {
  id: number; kind: AbilityEventKind; abilityId: string; slot: AbilitySlot; effect: EffectKind | "NONE";
  /** where it happened (player position at cast, or where a dash/strike ended) and the REAL world radius it covered */
  x: number; z: number; radius: number; duration: number;
  /** enemies actually affected, how many were bosses, and how many died */
  hits: number; bossHits: number; kills: number;
  reason?: RejectReason; at: number;
};
export type Pose = { x: number; z: number; yaw: number };
export type CastContext = { environment: string; subclassId?: SubclassId | undefined; inVehicle: boolean };
export type CastResult =
  | { ok: true; config: AbilityConfig; pose: Pose; event: AbilityEvent }
  | { ok: false; reason: RejectReason; text: string; event: AbilityEvent };

/** Configured radii are in ability units; the world footprint has always been twice that (Scene's Kinetic Slam did `radius * 2`).
 * Kept so existing balance does not change, but now explicit and reported on the event for VFX. */
export const AREA_SCALE = 2;
/** Kinetic Slam / Shadow Strike interrupt: how long a hit enemy is held from attacking */
export const IMPACT_STUN_SECONDS = 1.2;
/** extra poise Disruption Pulse puts on a boss (on top of the capped stun) */
export const DISRUPT_BOSS_POISE = 15;
export const SLAM_KNOCKBACK = 6;
export const MAX_ABILITY_EVENTS = 24;

const NO_TARGET_TEXT = "Shadow Strike · no target in reach";

function record(sim: WorldSim, e: Omit<AbilityEvent, "id" | "at">): AbilityEvent {
  const event: AbilityEvent = { ...e, id: sim.nextAbilityEventId++, at: performance.now() / 1000 };
  sim.abilityEvents.push(event);
  if (sim.abilityEvents.length > MAX_ABILITY_EVENTS) sim.abilityEvents.splice(0, sim.abilityEvents.length - MAX_ABILITY_EVENTS);
  return event;
}


/** Nearest living machine within `range` of the player — the Shadow Strike target. */
export function nearestTarget(sim: WorldSim, x: number, z: number, range: number): Machine | null {
  let best: Machine | null = null, bestD = range;
  for (const m of sim.machines) {
    if (!m.alive) continue;
    const d = Math.hypot(m.x - x, m.z - z);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

/** Why this cast would be refused right now, or null. Never spends or changes anything. */
export function rejectionFor(sim: WorldSim, live: LiveBuild, slot: AbilitySlot, pose: Pose, inVehicle = false): RejectReason | null {
  const base = baseConfig(live, slot);
  if (!base) return "NO_ABILITY";
  if (inVehicle) return "IN_VEHICLE";
  if ((live.runtime[slot]?.cooldown ?? 0) > 0) return "COOLDOWN";
  if (live.energy < abilityCost(live, slot)) return "ENERGY";
  if (base.effects[0]?.kind === "STRIKE" && !nearestTarget(sim, pose.x, pose.z, base.effects[0].radius ?? 16)) return "NO_TARGET";
  return null;
}

const REJECT_TEXT: Record<RejectReason, (name: string) => string> = {
  COOLDOWN: (n) => `${n} · recharging`,
  ENERGY: (n) => `${n} · not enough energy`,
  NO_TARGET: () => NO_TARGET_TEXT,
  NO_ABILITY: () => "No ability equipped",
  IN_VEHICLE: (n) => `${n} · unavailable in a vehicle`,
};

/** Rift Dash: slide up to `distance` along the facing, stopping before the first solid obstacle. */
export function dashLanding(x: number, z: number, yaw: number, distance: number): { x: number; z: number } {
  let last = { x, z };
  for (let d = 0.5; d <= distance + 1e-6; d += 0.5) {
    const probe = { x: x + Math.sin(yaw) * d, z: z + Math.cos(yaw) * d };
    // read-only overlap test (collideBody reports nothing at zero speed and would nudge/damage props)
    if (queryObstacles(probe.x, probe.z).some((o) => Math.hypot(probe.x - o.x, probe.z - o.z) < 1.0 + o.r)) break;
    last = probe;
  }
  return last;
}

/** Apply a subclass verb pulse (Weaken / Marked / Volatile / Suppress) that activateLiveAbility queued. Returns enemies in range. */
function applyPendingVerb(sim: WorldSim, live: LiveBuild, pose: Pose): number {
  const verb = live.pendingVerb;
  if (!verb) return 0;
  live.pendingVerb = null;
  const inRange = sim.machines.filter((m) => m.alive && Math.hypot(m.x - pose.x, m.z - pose.z) <= verb.radius).length;
  if (verb.verb === "VOLATILE") spawnVolatileZone(sim, pose.x, pose.z, verb.radius, verb.magnitude, verb.duration);
  else if (verb.verb === "SUPPRESS") {
    // same mechanism as CRYO/ARC (extend fire-cooldown); stunMachine caps it on bosses
    for (const m of sim.machines) if (m.alive && Math.hypot(m.x - pose.x, m.z - pose.z) <= verb.radius) stunMachine(m, verb.magnitude);
  } else applyVulnPulse(sim, pose.x, pose.z, verb.radius, verb.magnitude, verb.duration);
  alert(sim, `${VERB_LABEL[verb.verb]} applied to nearby hostiles`);
  return inRange;
}

/** The only entry point for casting. Spends energy/cooldown only on success. */
export function castAbility(sim: WorldSim, live: LiveBuild, slot: AbilitySlot, pose: Pose, ctx: CastContext): CastResult {
  const base = baseConfig(live, slot);
  const name = base ? nodeById(base.id)?.name ?? base.id : "";
  const reason = rejectionFor(sim, live, slot, pose, ctx.inVehicle);
  if (reason) {
    const text = REJECT_TEXT[reason](name);
    live.effect = text; live.effectTime = 1.5;
    const event = record(sim, { kind: "REJECTED", abilityId: base?.id ?? "", slot, effect: "NONE", x: pose.x, z: pose.z, radius: 0, duration: 0, hits: 0, bossHits: 0, kills: 0, reason });
    return { ok: false, reason, text, event };
  }
  const config = activateLiveAbility(live, slot, ctx.environment, ctx.subclassId);
  if (!config) { // activateLiveAbility is the final authority on cooldown/energy; a mismatch must never be silent
    const event = record(sim, { kind: "REJECTED", abilityId: base!.id, slot, effect: "NONE", x: pose.x, z: pose.z, radius: 0, duration: 0, hits: 0, bossHits: 0, kills: 0, reason: "ENERGY" });
    return { ok: false, reason: "ENERGY", text: REJECT_TEXT.ENERGY(name), event };
  }
  const effect = config.effects[0];
  const out: Pose = { ...pose };
  let hits = 0, bossHits = 0, kills = 0, radius = 0;
  const duration = effect?.duration ?? 0;
  const px = pose.x, pz = pose.z;
  const hurt = (m: Machine, dmg: number, stun: number, interrupt: boolean) => {
    m.hp -= applyMachineDamageMods(sim, m, dmg, "KINETIC", px, pz);
    stunMachine(m, stun);
    if (interrupt && !m.boss) m.aim = 0;
    hits++; if (m.boss) bossHits++;
    sim.lastHit = performance.now();
    sim.combatHeat += 1.5;
    if (m.hp <= 0) { const was = m.alive; defeatMachine(sim, m); if (was && !m.alive) kills++; }
  };

  const verbHits = applyPendingVerb(sim, live, pose);
  switch (effect?.kind) {
    case "DASH": {
      const to = dashLanding(pose.x, pose.z, pose.yaw, effect.value);
      out.x = to.x; out.z = to.z;
      sim.iframes = Math.max(sim.iframes, effect.duration ?? 0.28);
      alert(sim, "RIFT DASH · incoming damage negated");
      break;
    }
    case "DAMAGE": {
      radius = (effect.radius ?? 6) * AREA_SCALE;
      sim.playerNoise = 1;
      for (const m of sim.machines) {
        if (!m.alive || Math.hypot(m.x - px, m.z - pz) >= radius) continue;
        if (effect.tags?.includes("knockback") && !m.boss) { const pushed = knockbackFrom(px, pz, m.x, m.z, SLAM_KNOCKBACK); m.x = pushed.x; m.z = pushed.z; }
        hurt(m, effect.value / 20, IMPACT_STUN_SECONDS, true);
      }
      break;
    }
    case "DOME": {
      sim.barrierTime = Math.max(sim.barrierTime, effect.duration ?? 5);
      sim.titan.domeTime = Math.max(sim.titan.domeTime, effect.duration ?? 5);
      radius = (effect.radius ?? 5);
      alert(sim, "Barrier projected");
      break;
    }
    case "MARK": {
      radius = effect.radius ?? 24;
      hits = sim.machines.filter((m) => m.alive && Math.hypot(m.x - px, m.z - pz) <= radius).length;
      bossHits = sim.machines.filter((m) => m.alive && m.boss && Math.hypot(m.x - px, m.z - pz) <= radius).length;
      applyVulnPulse(sim, px, pz, radius, effect.value, effect.duration ?? 8);
      alert(sim, "Recon swarm deployed · hostiles revealed");
      break;
    }
    case "SILENCE": {
      radius = effect.radius ?? 12;
      const now = performance.now() / 1000;
      for (const m of sim.machines) {
        if (!m.alive || Math.hypot(m.x - px, m.z - pz) >= radius) continue;
        stunMachine(m, effect.duration ?? 3);
        if (m.boss) m.poiseState = hitPoise(m.poiseState ?? INITIAL_POISE, DISRUPT_BOSS_POISE, now).state;
        if (!m.boss) m.aim = 0;
        hits++; if (m.boss) bossHits++;
      }
      alert(sim, "Hostile systems disrupted · environment recalibrated");
      break;
    }
    case "SIEGE": alert(sim, "SIEGE MODE · stability and firepower up"); break;
    case "VEIL": alert(sim, "PHASE VEIL · concealed until you attack"); break;
    case "TURRET": {
      placeRiftTurret(sim, px + Math.sin(pose.yaw) * 2.5, pz + Math.cos(pose.yaw) * 2.5, effect.duration ?? 20);
      alert(sim, "Rift Turret deployed");
      break;
    }
    case "STRIKE": {
      const target = nearestTarget(sim, px, pz, effect.radius ?? 16)!; // rejectionFor guaranteed one
      const land = strikeLanding(px, pz, target.x, target.z);
      out.x = land.x; out.z = land.z; out.yaw = Math.atan2(target.x - land.x, target.z - land.z);
      sim.playerNoise = 1;
      hurt(target, strikeDamage(live.veilTime) * live.strikeBoost, IMPACT_STUN_SECONDS, true);
      live.veilTime = 0;
      radius = Math.hypot(target.x - px, target.z - pz);
      alert(sim, "SHADOW STRIKE");
      break;
    }
    default: break;
  }
  if (!hits && verbHits) hits = verbHits;
  const event = record(sim, { kind: "CAST", abilityId: config.id, slot, effect: effect?.kind ?? "NONE", x: out.x, z: out.z, radius, duration, hits, bossHits, kills });
  return { ok: true, config, pose: out, event };
}

/** Disruption Pulse keeps hostile tech offline for its duration. Ordinary enemies within range hold fire; bosses are NOT
 * held (the opening stun is capped and they keep fighting), so the field can never lock an encounter. */
export function holdDisabledField(sim: WorldSim, live: LiveBuild, pose: Pose, radius = 12) {
  if (live.hackTime <= 0) return;
  for (const m of sim.machines) if (m.alive && !m.boss && Math.hypot(m.x - pose.x, m.z - pose.z) < radius) m.cool = Math.max(m.cool, 0.3);
}

/** Death / respawn / forced recovery: cancel everything in flight so no timer, barrier, i-frame, queued verb, deployable or
 * cooldown survives into the next life. Equipped build and branches are kept. Emits one CANCELLED event per active slot. */
export function cancelAbilities(sim: WorldSim, live: LiveBuild, pose: Pose): LiveBuild {
  const activeSlots = (Object.keys(live.runtime) as AbilitySlot[]).filter((s) => live.runtime[s].state === "ACTIVE" || live.runtime[s].cooldown > 0);
  for (const slot of activeSlots) record(sim, { kind: "CANCELLED", abilityId: live.equipped.slots[slot], slot, effect: "NONE", x: pose.x, z: pose.z, radius: 0, duration: 0, hits: 0, bossHits: 0, kills: 0 });
  sim.iframes = 0; sim.barrierTime = 0; sim.riftTurrets = []; sim.titan.domeTime = 0;
  const fresh = createLiveBuild(live.equipped, live.branches);
  // keep the posture/synergy state rebindLiveBuild derived for this loadout
  return { ...fresh, damageMultiplier: live.damageMultiplier, shieldReflect: live.shieldReflect, threat: live.threat };
}

export { abilityCost, abilityHud, idleAbilityHud, type AbilityHud, type AbilityHudState } from "./ability-hud";

/** The per-frame bridge from the live build into the sim (LiveBuild has no sim reference): Rage / Siege scale outgoing damage,
 * Phase Veil scales how far enemies see you, Overshield scales incoming damage. */
export function syncSimFromLive(sim: WorldSim, live: LiveBuild) {
  sim.verbDamageMult = (live.verbKind === "RAGE" && live.verbTime > 0 ? live.verbMagnitude : 1) * (live.siegeTime > 0 ? live.siegeBoost : 1) * siegeDamageMult(live.siegeTime);
  sim.stealthMult = veilSightMult(live.veilTime);
  sim.verbIncomingMult = live.verbKind === "OVERSHIELD" && live.verbTime > 0 ? 1 - live.verbMagnitude : 1;
}
