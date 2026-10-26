/** Civic security (owner's security stages 118-129, from the other chat's prototype, rebuilt on the live game): Neon City's
 * robot police and the World Government's Bastion Command base. Pure rules; Scene reports offences, NeonPolice.tsx moves the
 * patrol bots, GameCanvas takes the fine.
 *
 * - Offences raise heat (0..100) by severity; heat is the wanted level in fifths (1-5 stars). Firing a weapon in Neon City
 *   with no hostile nearby and no activity running is a "weapon discharge"; walking into Bastion Command's restricted core
 *   is trespass (heavier at the base).
 * - Police only know what they see: a bot that sees you (range, no x-ray) chases you; when it loses sight it searches your
 *   last-seen spot for a while; heat cools once nobody is searching.
 * - Getting caught is nonlethal: no damage, no reward, the wanted level clears and you pay a fine scaled by the stars
 *   (a citation at 1-2 stars, detainment above). The fine is taken from the Nex ledger and never below zero.
 * Defending yourself is never a crime: shots with a hostile close by, or during an activity, don't count. */
import { NEON_FLAT, NEON_SITE } from "./world";

export type Jurisdiction = "neon" | "base" | "none";
export type Offence = "weapon-discharge" | "trespass" | "vehicle-ram";
export const OFFENCE_HEAT: Record<Offence, number> = { "weapon-discharge": 15, trespass: 9, "vehicle-ram": 20 };
export const SECURITY = {
  /** heat per second lost once nobody is searching for you */
  cool: 2,
  /** seconds a bot searches the last-seen spot, and how long after an offence before heat cools */
  search: 12, calmAfter: 15,
  /** bot sight range (m), catch distance (m), patrol and chase speeds (m/s) */
  sight: 30, catchRange: 2.2, patrolSpeed: 2.2, chaseBase: 4.6, chasePerStar: 1.1,
  /** a hostile this close makes a shot self-defence */
  selfDefence: 40,
  /** the same offence can't stack faster than this (s) */
  repeat: 1.2,
} as const;

export type SecurityState = { heat: number; lastOffenceAt: number; lastOf: Partial<Record<Offence, number>>; seen: boolean; searchLeft: number };
export const CLEAR_SECURITY: SecurityState = { heat: 0, lastOffenceAt: -Infinity, lastOf: {}, seen: false, searchLeft: 0 };

export function wanted(heat: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(heat) || heat <= 0) return 0;
  return Math.min(5, Math.ceil(heat / 20)) as 1 | 2 | 3 | 4 | 5;
}

/** add an offence (in a jurisdiction; nothing happens outside one) */
export function report(st: SecurityState, o: Offence, where: Jurisdiction, now: number): SecurityState {
  if (where === "none" || !Number.isFinite(now)) return st;
  if (now - (st.lastOf[o] ?? -Infinity) < SECURITY.repeat) return st;
  const k = where === "base" ? 1.5 : 1;
  return { ...st, heat: Math.min(100, st.heat + OFFENCE_HEAT[o] * k), lastOffenceAt: now, lastOf: { ...st.lastOf, [o]: now }, searchLeft: SECURITY.search };
}

/** one frame: `seen` = any bot can see you now */
export function tick(st: SecurityState, seen: boolean, dt: number, now: number): SecurityState {
  if (st.heat <= 0 || dt <= 0) return st.heat <= 0 ? CLEAR_SECURITY : st;
  const searchLeft = seen ? SECURITY.search : Math.max(0, st.searchLeft - dt);
  const calm = !seen && searchLeft === 0 && now - st.lastOffenceAt > SECURITY.calmAfter;
  const heat = calm ? Math.max(0, st.heat - SECURITY.cool * dt) : st.heat;
  return heat <= 0 ? CLEAR_SECURITY : { ...st, heat, seen, searchLeft };
}

/** what getting caught costs */
export function arrestFine(heat: number): { status: "citation" | "detained"; fine: number } {
  const w = wanted(heat);
  return w <= 2 ? { status: "citation", fine: 150 * Math.max(1, w) } : { status: "detained", fine: 400 * w };
}

/** the ledger after a fine: one entry per arrest, never taking the balance below zero */
export function payFine(ledger: Record<string, number>, fine: number, balance: number, now: number): Record<string, number> {
  const take = Math.min(Math.max(0, balance), fine);
  return take > 0 ? { ...ledger, [`fine:${now}`]: -take } : ledger;
}

/** a self-defence or activity shot is no crime */
export function isDischargeOffence(hostileNear: number, activityRunning: boolean): boolean {
  return !activityRunning && !(hostileNear < SECURITY.selfDefence);
}

/** chase step for a bot: toward the target at `speed`, never past it */
export function step(from: { x: number; z: number }, to: { x: number; z: number }, speed: number, dt: number): { x: number; z: number } {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz);
  if (d < 1e-3) return from;
  const k = Math.min(d, speed * Math.min(dt, 0.1)) / d;
  return { x: from.x + dx * k, z: from.z + dz * k };
}

export const starsLabel = (heat: number) => { const w = wanted(heat); return w ? `WANTED ${"★".repeat(w)}${"☆".repeat(5 - w)}` : ""; };

/* ---------------- places ---------------- */

/** Bastion Command (World Government Defense Force): a walled forward base on the high ground north of Neon City, authored as
 * an offset from Neon's centre so it moves with the island. Its core is restricted; its training range is open to all. */
export const BASTION = { x: NEON_SITE.x + 15, z: NEON_SITE.z - 195, halfX: 40, halfZ: 34, restricted: 22, range: { dx: 16, dz: 9, r: 10 } } as const;

/** which force polices (x,z) */
export function jurisdictionAt(x: number, z: number): Jurisdiction {
  if (Math.abs(x - BASTION.x) < BASTION.halfX + 6 && Math.abs(z - BASTION.z) < BASTION.halfZ + 6) return "base";
  if (Math.hypot(x - NEON_SITE.x, z - NEON_SITE.z) < NEON_FLAT) return "neon";
  return "none";
}
/** inside the restricted core (the training range is exempt) */
export function inRestricted(x: number, z: number): boolean {
  const dx = x - BASTION.x, dz = z - BASTION.z;
  if (Math.hypot(dx - BASTION.range.dx, dz - BASTION.range.dz) < BASTION.range.r) return false;
  return Math.hypot(dx, dz) < BASTION.restricted;
}
