/** Rocket launcher weapons: four distinct types built on the ordnance rules (ordnance.ts). Every launcher has a real splash burst, no self
 * damage, a small magazine and a long reload. Damage is in the same hp units as bullets (grunt 3, elite 6, boss 28+) and is scaled by the
 * weapon multiplier and gear power at fire time. Elements flow through the sim's single damage path, so scenario gimmicks react to them. */
import type { DamageElement } from "./scenario-gimmicks";
import type { OrdnanceDef } from "./ordnance";
import type { Element } from "./combat-fx";

export type LauncherId = "ROCKET" | "CINDER" | "FROSTBITE" | "VITRIOL";
export type LauncherDef = { id: LauncherId; ordnance: OrdnanceDef; element: DamageElement; fx: Element; guided: boolean; /** lock cone half-angle, radians */ lockCone: number; lockRange: number };

const rocket = (id: string, name: string, o: Partial<OrdnanceDef>): OrdnanceDef => ({ id, kind: "ROCKET", name, speed: 70, turnRate: 0, life: 4, splashRadius: 6, damage: 1, proximity: 1.4, domain: "ANY", fits: ["foot-heavy"], ...o });

export const LAUNCHERS: Record<LauncherId, LauncherDef> = {
  ROCKET: { id: "ROCKET", element: "KINETIC", fx: "BALLISTIC", guided: false, lockCone: 0, lockRange: 0, ordnance: rocket("launcher-rocket", "Breacher rocket", { speed: 75, splashRadius: 7 }) },
  CINDER: { id: "CINDER", element: "THERMAL", fx: "FIRE", guided: false, lockCone: 0, lockRange: 0, ordnance: rocket("launcher-cinder", "Cinder incendiary rocket", { speed: 62, splashRadius: 8 }) },
  FROSTBITE: { id: "FROSTBITE", element: "CRYO", fx: "ICE", guided: true, lockCone: 0.45, lockRange: 90, ordnance: { ...rocket("launcher-frostbite", "Frostbite guided missile", { speed: 58, splashRadius: 6, life: 6, proximity: 2 }), kind: "MISSILE", turnRate: 1.3 } },
  VITRIOL: { id: "VITRIOL", element: "BIO", fx: "ACID", guided: false, lockCone: 0, lockRange: 0, ordnance: rocket("launcher-vitriol", "Vitriol corrosive rocket", { speed: 55, splashRadius: 9, life: 4.5 }) },
};
export const isLauncherId = (id: string): id is LauncherId => id in LAUNCHERS;

/** nearest candidate inside the forward cone and range, or -1. Candidates are positions only, so this stays pure. */
export function pickLockTarget(from: { x: number; z: number }, yaw: number, cands: readonly { x: number; z: number; alive: boolean }[], cone: number, range: number): number {
  let best = -1, bestD = Infinity;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  cands.forEach((c, i) => {
    if (!c.alive) return;
    const dx = c.x - from.x, dz = c.z - from.z, d = Math.hypot(dx, dz);
    if (d < 4 || d > range) return;
    const ang = Math.acos(Math.min(1, Math.max(-1, (dx * fx + dz * fz) / d)));
    if (ang <= cone && d < bestD) { best = i; bestD = d; }
  });
  return best;
}
