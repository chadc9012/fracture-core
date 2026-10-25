/**
 * Enemies getting out of the way of the player's explosives (pure; sim.ts applies, Actors/EnemyModel draw the dive).
 *
 *  - ROCKETS (launcher and vehicle ordnance rounds): each step a trooper works out where an incoming round will burst — where
 *    its straight path meets the ground, or where it passes closest to the trooper if that is within its proximity fuse —
 *    and whether it is inside the splash. With enough warning (`REACT_MIN`..) and a reaction roll (elites read it better),
 *    it dives sideways out of the blast: a short burst of speed away from the burst point, low to the ground, no shooting.
 *    A round already on top of it (less than its reaction time away) can't be dodged, so rockets still land.
 *  - ORBITAL STRIKE beacons: an alert trooper standing in the marked circle has a chance to notice and run out of it
 *    before the strike lands. Only about half do, so the call-in still pays.
 * Bosses, scripted encounter bosses, decoys and rivals never evade.
 */
export const REACT_MIN = 0.28;
export const DIVE = { seconds: 0.6, speed: 7.5, cooldown: 2.2 } as const;
export const FLEE = { notice: 0.5, seconds: 1.8, pad: 2 } as const;

type RoundLike = { x: number; y: number; z: number; dx: number; dy: number; dz: number; def: { speed: number; splashRadius: number; proximity: number; life: number }; age: number };

/** where and when (s) a straight-flying round bursts relative to a body at (mx, mz), or null if it never threatens it */
export function roundThreat(r: RoundLike, mx: number, mz: number, ground: (x: number, z: number) => number, body = 1.5): { x: number; z: number; t: number } | null {
  const v = Math.max(1, r.def.speed), left = Math.max(0, r.def.life - r.age);
  // closest approach in the plane
  const rx = mx - r.x, rz = mz - r.z, hl = Math.hypot(r.dx, r.dz) || 1e-6;
  const along = (rx * r.dx + rz * r.dz) / (hl * hl); // distance along the (unit 3D) direction, in metres
  // ground hit: march the ray (coarse then exact enough at 1 m steps)
  let tGround = Infinity;
  for (let s = 1; s <= Math.min(left * v, 120); s += 1) {
    const x = r.x + r.dx * s, y = r.y + r.dy * s, z = r.z + r.dz * s;
    if (y <= ground(x, z)) { tGround = s / v; break; }
  }
  let tBurst = tGround, bx = r.x + r.dx * tGround * v, bz = r.z + r.dz * tGround * v;
  if (along > 0) {
    const cx = r.x + r.dx * along, cz = r.z + r.dz * along;
    const miss = Math.hypot(mx - cx, mz - cz);
    // the proximity fuse goes off beside the body before the round reaches the ground
    if (miss <= r.def.proximity + body && along / v < tGround) { tBurst = along / v; bx = cx; bz = cz; }
  }
  if (!Number.isFinite(tBurst) || tBurst > left) return null;
  if (Math.hypot(mx - bx, mz - bz) > r.def.splashRadius + body * 0.5) return null;
  return { x: bx, z: bz, t: tBurst };
}

/** which way to dive: straight away from the burst, or sideways off the round's line when the burst is on top of the body */
export function diveDirection(mx: number, mz: number, burst: { x: number; z: number }, roundDx: number, roundDz: number, side: 1 | -1): { x: number; z: number } {
  const ax = mx - burst.x, az = mz - burst.z, al = Math.hypot(ax, az);
  if (al > 0.8) return { x: ax / al, z: az / al };
  const l = Math.hypot(roundDx, roundDz) || 1;
  return { x: (-roundDz / l) * side, z: (roundDx / l) * side };
}

/** does this trooper react in time? Elites read it better; a stunned or winding-up body can't */
export function reactsInTime(timeToBurst: number, elite: boolean, roll: number): boolean {
  if (timeToBurst < REACT_MIN) return false;
  return roll < (elite ? 0.75 : 0.5);
}

/** a dive's pose: crouched low and pitched into the dive, easing in and out over the dive (additive bones, same axes as
 * death-animations.ts), plus how far the whole body dips and leans (0..1) */
export function diveBones(progress: number): { bones: Record<string, [number, number, number]>; dip: number } {
  const k = Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);
  return {
    dip: k,
    bones: {
      Spine: [0.45 * k, 0, 0], Spine1: [0.25 * k, 0, 0], Neck: [-0.2 * k, 0, 0],
      LeftUpLeg: [0.8 * k, 0, 0], RightUpLeg: [0.5 * k, 0, 0], LeftLeg: [1.1 * k, 0, 0], RightLeg: [0.9 * k, 0, 0],
      LeftArm: [0.6 * k, 0, -0.2 * k], RightArm: [0.6 * k, 0, 0.2 * k],
    },
  };
}

/** the way out of a strike circle: straight out from its centre (any way out if standing at the centre) */
export function fleeDirection(mx: number, mz: number, cx: number, cz: number, seed: number): { x: number; z: number } {
  const ax = mx - cx, az = mz - cz, al = Math.hypot(ax, az);
  if (al > 0.5) return { x: ax / al, z: az / al };
  const a = seed * Math.PI * 2;
  return { x: Math.sin(a), z: Math.cos(a) };
}
