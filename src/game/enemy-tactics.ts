/**
 * Enemy tactics against a player in cover (pure). Line of sight (line-of-sight.ts) made cover real: a player behind a wall
 * can no longer be hit. Without answers to that, enemies stood still shooting the wall. Two answers:
 *
 *  - FLANKING: once the player has been out of a trooper's sight for `FLANK_AFTER` seconds, up to `MAX_FLANKERS` troopers pick
 *    a spot on a ring round the player, swung out to one side of where they stand, that does see the player (checked with
 *    sightLine), and move there; they fire as soon as they have a line, and give up after `FLANK_GIVE_UP` seconds.
 *  - GRENADES: Raiders and Vanguard (not the cyber troopers or creatures) lob a grenade at where the player was last seen once
 *    they have been hidden for `GRENADE_AFTER` seconds: a high arc that clears cover, bounces and rolls, then goes off after
 *    its fuse. It is telegraphed (a danger ring on the ground the size of the blast, a beeping fuse that speeds up, a call-out)
 *    and cover between the blast and the player softens it to `COVER_SOAK`. Only one squad grenade at a time, with a squad
 *    cooldown, so it flushes a camper instead of spamming.
 */
import { sightLine, type Point3, type SightWorld } from "./line-of-sight";

export const FLANK_AFTER = 3;
/** a trooper that was fighting keeps the player pinned (stays ALERT) this long after they duck out of sight behind cover
 * within `PIN_RANGE`: long enough to grenade (`GRENADE_AFTER`) and run a flank (`FLANK_AFTER`..`FLANK_GIVE_UP`), then it
 * falls back to searching. Without it awareness decayed below ALERT about a second after the player vanished. */
export const STAY_ALERT_HIDDEN = 12;
export const PIN_RANGE = 60;
export const FLANK_GIVE_UP = 8;
export const MAX_FLANKERS = 2;
export const FLANK_RING = [11, 15, 19] as const;

export const GRENADE_AFTER = 2.5;
export const GRENADE = {
  fuse: 2.4,
  radius: 6,
  /** player damage at the centre (hull points), falling to 0 at the edge */
  damage: 34,
  /** cover between the blast and the player leaves this much */
  coverSoak: 0.3,
  gravity: 14,
  bounce: 0.35,
  friction: 0.55,
  /** at most this many squad grenades alive, and this long between throws (s) */
  maxLive: 1,
  squadCooldown: 7,
  /** a thrower waits this long before its next grenade (s) */
  ownCooldown: 16,
  minRange: 7,
  maxRange: 32,
} as const;

export type Grenade = { x: number; y: number; z: number; vx: number; vy: number; vz: number; fuse: number; id: number; rest: boolean };

/** Kinds that carry grenades (enemy-visuals EnemyKind); cyber troopers and creatures don't */
export const throwsGrenades = (kind: string) => kind === "RAIDER" || kind === "VANGUARD";

/**
 * A flank spot: on a ring round the player, swung out to `side` (+1 left, -1 right of the line from player to trooper) by
 * 55..110°, that sees the player's chest from a standing eye. Nearest to the trooper wins; null when no spot sees the player.
 */
export function findFlankSpot(mx: number, mz: number, player: Point3, side: 1 | -1, world: SightWorld, eyeHeight = 1.55): { x: number; z: number } | null {
  const base = Math.atan2(mx - player.x, mz - player.z);
  let best: { x: number; z: number } | null = null, bestD = Infinity;
  for (const r of FLANK_RING) {
    for (const swing of [55, 80, 110]) {
      const a = base + side * (swing * Math.PI) / 180;
      const x = player.x + Math.sin(a) * r, z = player.z + Math.cos(a) * r;
      const from = { x, y: world.ground(x, z) + eyeHeight, z };
      if (sightLine(from, { x: player.x, y: player.y - 0.35, z: player.z }, world).blocked) continue;
      const d = Math.hypot(x - mx, z - mz);
      if (d < bestD) { bestD = d; best = { x, z }; }
    }
  }
  return best;
}

/** launch velocity for a lob from `from` that lands at `to` after a flight time that grows with range (a high arc that
 * clears cover: apex at least ~3 m above the throw) */
export function lobVelocity(from: Point3, to: Point3, g: number = GRENADE.gravity): { vx: number; vy: number; vz: number; t: number } {
  const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y, d = Math.hypot(dx, dz);
  const t = Math.min(1.9, Math.max(0.9, d / 13));
  return { vx: dx / t, vz: dz / t, vy: (dy + 0.5 * g * t * t) / t, t };
}

/** one step of a grenade in flight: gravity, a bounce on the ground, rolling friction, then rest; the fuse runs down */
export function stepGrenade(gr: Grenade, dt: number, ground: (x: number, z: number) => number) {
  gr.fuse -= dt;
  if (gr.rest) return;
  gr.vy -= GRENADE.gravity * dt;
  gr.x += gr.vx * dt; gr.y += gr.vy * dt; gr.z += gr.vz * dt;
  const floor = ground(gr.x, gr.z) + 0.08;
  if (gr.y <= floor) {
    gr.y = floor;
    if (Math.abs(gr.vy) < 1.5) { gr.vy = 0; gr.vx *= Math.pow(GRENADE.friction, dt * 8); gr.vz *= Math.pow(GRENADE.friction, dt * 8); if (Math.hypot(gr.vx, gr.vz) < 0.3) gr.rest = true; }
    else { gr.vy = -gr.vy * GRENADE.bounce; gr.vx *= 0.6; gr.vz *= 0.6; }
  }
}

/** damage to a player at `dist` from the blast: linear falloff to the edge, softened when cover stands between them */
export const grenadeDamage = (dist: number, covered: boolean) => (dist >= GRENADE.radius ? 0 : GRENADE.damage * (1 - dist / GRENADE.radius) * (covered ? GRENADE.coverSoak : 1));

/** the fuse beep interval (s): slow at first, frantic near the end */
export const beepEvery = (fuse: number) => Math.max(0.08, Math.min(0.5, fuse * 0.2));
