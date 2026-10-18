/**
 * Mantle and climb (pure). When an airborne Operator meets a surface higher than their feet, instead of being snapped
 * up they pull themselves over (MANTLE, rises up to 2.6) or, holding jump, scale it (CLIMB, rises up to 7.5, spending
 * climbing stamina that refills on the ground). Each class has its own feel, Destiny-style:
 *   Hunter  — quickest hands: fast mantle, brisk climb
 *   Titan   — strongest grip: the biggest stamina pool, steady climb
 *   Warlock — lightest: slower mantle, shortest stamina
 * Scene supplies the surface height; nothing here samples the world.
 */
import type { ClassId } from "./loadout";

export const MANTLE_MIN = 0.6;
export const MANTLE_MAX = 2.6;
export const CLIMB_MAX = 7.5;
export const MANTLE_SECONDS = 0.45;
export const CLIMB_SPEED = 3.6;
export const CLIMB_DRAIN = 22;
export const STAMINA_REGEN = 45;

export type TraversalProfile = { mantleSpeed: number; climbSpeed: number; stamina: number };
export const TRAVERSAL: Record<ClassId, TraversalProfile> = {
  HUNTER: { mantleSpeed: 1.25, climbSpeed: 1.15, stamina: 100 },
  TITAN: { mantleSpeed: 1.0, climbSpeed: 1.0, stamina: 130 },
  WARLOCK: { mantleSpeed: 0.9, climbSpeed: 0.95, stamina: 80 },
};

export type TravMode = "NONE" | "MANTLE" | "CLIMB";
export type Traversal = { mode: TravMode; fromY: number; t: number; stamina: number };
export const createTraversal = (classId: ClassId): Traversal => ({ mode: "NONE", fromY: 0, t: 0, stamina: TRAVERSAL[classId].stamina });

/** Begin a mantle or climb at feet height `feetY` against a surface whose top is `topY`. Returns the mode started. */
export function startTraversal(s: Traversal, classId: ClassId, feetY: number, topY: number, input: { forward: boolean; climbHeld: boolean }): TravMode {
  if (s.mode !== "NONE" || !input.forward) return "NONE";
  const rise = topY - feetY;
  if (rise > MANTLE_MIN && rise <= MANTLE_MAX) { s.mode = "MANTLE"; s.fromY = feetY; s.t = 0; return "MANTLE"; }
  if (rise > MANTLE_MAX && rise <= CLIMB_MAX && input.climbHeld && s.stamina > 8) { s.mode = "CLIMB"; s.fromY = feetY; s.t = 0; return "CLIMB"; }
  return "NONE";
}

export type TravStep = { y: number; done: boolean; /** 0..1 how much sideways input to honour (the body is on the wall) */ steer: number };
/** Advance one frame. A climb that runs out of stamina or is released drops back to normal falling (done, without reaching the top). */
export function stepTraversal(s: Traversal, classId: ClassId, dt: number, topY: number, climbHeld: boolean): TravStep & { fell?: boolean } {
  const p = TRAVERSAL[classId];
  if (s.mode === "NONE") return { y: s.fromY, done: true, steer: 1 };
  if (s.mode === "MANTLE") {
    s.t = Math.min(1, s.t + (dt * p.mantleSpeed) / MANTLE_SECONDS);
    const e = s.t * s.t * (3 - 2 * s.t);
    const y = s.fromY + (topY - s.fromY) * e + Math.sin(s.t * Math.PI) * 0.12; // small hop over the lip
    if (s.t >= 1) { s.mode = "NONE"; return { y: topY, done: true, steer: 1 }; }
    return { y, done: false, steer: 0.2 };
  }
  // CLIMB
  if (!climbHeld || s.stamina <= 0) { s.mode = "NONE"; return { y: s.fromY, done: true, steer: 1, fell: true }; }
  s.stamina = Math.max(0, s.stamina - CLIMB_DRAIN * dt);
  const nextY = s.fromY + CLIMB_SPEED * p.climbSpeed * dt;
  const remaining = topY - nextY;
  if (remaining <= MANTLE_MAX) { s.mode = "MANTLE"; s.fromY = nextY; s.t = 0; return { y: nextY, done: false, steer: 0.1 }; } // last stretch: pull over the lip
  s.fromY = nextY;
  return { y: nextY, done: false, steer: 0.1 };
}

/** Stamina comes back on the ground. */
export function restTraversal(s: Traversal, classId: ClassId, dt: number, grounded: boolean) {
  if (grounded && s.mode === "NONE") s.stamina = Math.min(TRAVERSAL[classId].stamina, s.stamina + STAMINA_REGEN * dt);
}
