/** Pure rules for the NYX / GOLIATH / CIPHER signature abilities, stepped by Scene and sim.ts. */

export const SIEGE_DAMAGE_MULT = 1.3;
export const SIEGE_MOVE_MULT = 0.8;
export const SIEGE_BLOOM_MULT = 0.5;
export const VEIL_SIGHT_MULT = 0.15;
/** attacking breaks the veil down to this many seconds */
export const VEIL_BREAK_TIME = 0.4;
export const SHADOW_STRIKE_BASE = 4;
export const MAX_RIFT_TURRETS = 2;
export const RIFT_TURRET_RANGE = 34;
export const RIFT_TURRET_INTERVAL = 0.45;
export const RIFT_TURRET_DAMAGE = 1;

export const veilSightMult = (veilTime: number) => (veilTime > 0 ? VEIL_SIGHT_MULT : 1);
export const siegeDamageMult = (siegeTime: number) => (siegeTime > 0 ? SIEGE_DAMAGE_MULT : 1);
export const siegeMoveMult = (siegeTime: number) => (siegeTime > 0 ? SIEGE_MOVE_MULT : 1);
/** Shadow Strike doubles while the veil is up. */
export const strikeDamage = (veilTime: number) => SHADOW_STRIKE_BASE * (veilTime > 0 ? 2 : 1);

/** Where the player lands after Shadow Strike: just behind the target, on the far side from where they came. */
export function strikeLanding(px: number, pz: number, ex: number, ez: number, behind = 1.8) {
  const dx = ex - px, dz = ez - pz, d = Math.hypot(dx, dz) || 1;
  return { x: ex + (dx / d) * behind, z: ez + (dz / d) * behind };
}

/** Kinetic Slam pushes an enemy straight away from the player by `dist`. */
export function knockbackFrom(px: number, pz: number, ex: number, ez: number, dist: number) {
  const dx = ex - px, dz = ez - pz, d = Math.hypot(dx, dz) || 1;
  return { x: ex + (dx / d) * dist, z: ez + (dz / d) * dist };
}

export type RiftTurret = { x: number; z: number; until: number; cool: number; rot: number; flash: number };

/** Deploys a turret; beyond MAX_RIFT_TURRETS the oldest is replaced. Returns a new list. */
export function deployRiftTurret(list: readonly RiftTurret[], x: number, z: number, now: number, duration: number): RiftTurret[] {
  const live = list.filter((t) => t.until > now);
  const next = [...live, { x, z, until: now + duration, cool: 0.4, rot: 0, flash: 0 }];
  return next.slice(-MAX_RIFT_TURRETS);
}

/** Steps one turret: returns the index of the target it fired at this tick, or -1. */
export function stepRiftTurret(t: RiftTurret, targets: readonly { x: number; z: number; alive: boolean }[], dt: number): number {
  t.flash = Math.max(0, t.flash - dt * 4);
  t.cool -= dt;
  let best = -1, bestD = RIFT_TURRET_RANGE;
  for (let i = 0; i < targets.length; i++) {
    const m = targets[i]!;
    if (!m.alive) continue;
    const d = Math.hypot(m.x - t.x, m.z - t.z);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best < 0) return -1;
  const m = targets[best]!;
  t.rot = Math.atan2(m.x - t.x, m.z - t.z);
  if (t.cool > 0) return -1;
  t.cool = RIFT_TURRET_INTERVAL;
  t.flash = 1;
  return best;
}
