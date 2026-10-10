/** Elemental on-hit statuses for the weapons that carry an element (Pulse = ARC, Heavy = THERMAL, and the elemental launchers).
 * Pure rules: sim.ts owns a Map of MachineStatuses and calls these. Design limits, all enforced here and tested:
 *  - BURN is a small damage-over-time on regular enemies only. It never touches bosses, and it is applied by the sim directly
 *    to hp (not through applyMachineDamageMods), so it can never count as scenario participation or raise boss poise.
 *  - CHILL slows regular enemies; bosses are not slowed (only the weaker boss "stagger" they already have).
 *  - CORRODE is a short vulnerability window that reuses Machine.vulnUntil/vulnMult; it never replaces a stronger active one.
 *  - SHOCK is a short stun with a per-machine cooldown, so repeated hits cannot stun-lock; bosses are capped by stunMachine as well.
 * KINETIC (and the sword) apply no status. */
import type { DamageElement } from "./scenario-gimmicks";

export type StatusKind = "BURN" | "CHILL" | "CORRODE" | "SHOCK";
export const STATUS_OF: Partial<Record<DamageElement, StatusKind>> = { THERMAL: "BURN", CRYO: "CHILL", BIO: "CORRODE", ARC: "SHOCK" };

export const STATUS_RULES = {
  BURN: { seconds: 3, dps: 0.5 },
  CHILL: { seconds: 3, speedMult: 0.55 },
  CORRODE: { seconds: 4, vulnMult: 1.25, bossVulnMult: 1.1 },
  SHOCK: { stunSeconds: 0.7, cooldown: 3.5 },
} as const;

export type MachineStatuses = { burnUntil: number; chillUntil: number; shockReadyAt: number };
export const freshStatuses = (): MachineStatuses => ({ burnUntil: 0, chillUntil: 0, shockReadyAt: 0 });

export type ElementEffect = { status: StatusKind | null; stun: number; vuln: { mult: number; until: number } | null };

/** register one elemental hit. Mutates timers on `st` and returns what the sim must additionally apply (stun / vulnerability). */
export function applyElementHit(st: MachineStatuses, element: DamageElement, now: number, boss: boolean): ElementEffect {
  const status = STATUS_OF[element] ?? null;
  const out: ElementEffect = { status, stun: 0, vuln: null };
  if (!status) return out;
  if (status === "BURN") { if (boss) return { ...out, status: null }; st.burnUntil = now + STATUS_RULES.BURN.seconds; }
  else if (status === "CHILL") { if (boss) return { ...out, status: null }; st.chillUntil = now + STATUS_RULES.CHILL.seconds; }
  else if (status === "CORRODE") out.vuln = { mult: boss ? STATUS_RULES.CORRODE.bossVulnMult : STATUS_RULES.CORRODE.vulnMult, until: now + STATUS_RULES.CORRODE.seconds };
  else if (now >= st.shockReadyAt) { st.shockReadyAt = now + STATUS_RULES.SHOCK.cooldown; out.stun = STATUS_RULES.SHOCK.stunSeconds; }
  else out.status = null; // shock on cooldown: no effect, honest result
  return out;
}

/** merge a vulnerability window without ever weakening or shortening one that is already active */
export function mergeVuln(cur: { mult: number; until: number }, add: { mult: number; until: number }, now: number): { mult: number; until: number } {
  if (cur.until <= now) return { ...add };
  return { mult: Math.max(cur.mult, add.mult), until: Math.max(cur.until, add.until) };
}

export const isChilled = (st: MachineStatuses, now: number) => st.chillUntil > now;
export const isBurning = (st: MachineStatuses, now: number) => st.burnUntil > now;
export const statusSpeedMult = (st: MachineStatuses | undefined, now: number) => (st && isChilled(st, now) ? STATUS_RULES.CHILL.speedMult : 1);
/** damage-over-time for this step; zero once expired */
export const burnDamage = (st: MachineStatuses | undefined, now: number, dt: number) => (st && isBurning(st, now) ? STATUS_RULES.BURN.dps * dt : 0);
