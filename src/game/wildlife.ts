/**
 * Pure wildlife simulation logic — no React/three.js here so it can run in a plain Node smoke test.
 * Wildlife.tsx (the render component) owns spawning geometry and animation; this module owns where
 * each critter is and what it's doing (wander around a home point, flee the player, or idle).
 *
 * Species list matches the user's ask: deer, birds, fish, dogs, cats, snakes — each confined to the
 * region(s) that make sense for it (deer/dogs on land in the forest/city, fish only underwater, etc).
 */

export type Species = "DEER" | "BIRD" | "FISH" | "DOG" | "CAT" | "SNAKE";
export type CritterState = "WANDER" | "FLEE" | "IDLE";

export type Critter = {
  id: string;
  species: Species;
  homeX: number;
  homeZ: number;
  homeRadius: number;
  x: number;
  z: number;
  /** facing angle, radians */
  heading: number;
  speed: number;
  state: CritterState;
  /** current wander/flee target */
  targetX: number;
  targetZ: number;
  /** seconds until this critter re-evaluates its idle/wander choice */
  timer: number;
  /** animation phase for legs/wings/fins — advances every tick regardless of state */
  phase: number;
};

export const SPECIES_PROFILE: Record<Species, { speed: number; fleeSpeed: number; fleeRadius: number; homeRadius: number; wanderPause: [number, number] }> = {
  DEER: { speed: 1.4, fleeSpeed: 6.5, fleeRadius: 16, homeRadius: 20, wanderPause: [1.5, 4] },
  BIRD: { speed: 2.2, fleeSpeed: 9, fleeRadius: 12, homeRadius: 30, wanderPause: [0.5, 2] },
  FISH: { speed: 0.9, fleeSpeed: 4, fleeRadius: 8, homeRadius: 12, wanderPause: [1, 3] },
  DOG: { speed: 1.1, fleeSpeed: 5, fleeRadius: 10, homeRadius: 14, wanderPause: [2, 5] },
  CAT: { speed: 1, fleeSpeed: 5.5, fleeRadius: 9, homeRadius: 12, wanderPause: [2, 6] },
  SNAKE: { speed: 0.5, fleeSpeed: 3, fleeRadius: 7, homeRadius: 8, wanderPause: [2, 5] },
};

function hash2(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** deterministic per-critter RNG seeded from its index, so a given spawn list is stable across reloads */
function seededRnd(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function spawnCritter(id: string, species: Species, homeX: number, homeZ: number, index: number): Critter {
  const rnd = seededRnd(hash2(index, species.length) * 1e6);
  const profile = SPECIES_PROFILE[species];
  return {
    id,
    species,
    homeX,
    homeZ,
    homeRadius: profile.homeRadius,
    x: homeX,
    z: homeZ,
    heading: rnd() * Math.PI * 2,
    speed: profile.speed,
    state: "IDLE",
    targetX: homeX,
    targetZ: homeZ,
    timer: rnd() * 2,
    phase: rnd() * Math.PI * 2,
  };
}

function pickWanderTarget(c: Critter, rnd: () => number) {
  const a = rnd() * Math.PI * 2;
  const d = rnd() * c.homeRadius;
  c.targetX = c.homeX + Math.cos(a) * d;
  c.targetZ = c.homeZ + Math.sin(a) * d;
}

/**
 * Advance one critter by dt seconds. playerX/playerZ/playerMoving decide whether it flees —
 * a stationary player never spooks anything, matching how real wildlife reacts to motion, not
 * mere presence. Mutates and returns the same object (call site owns the array).
 */
export function stepCritter(c: Critter, dt: number, playerX: number, playerZ: number, playerMoving: boolean, rnd: () => number): Critter {
  const profile = SPECIES_PROFILE[c.species];
  const distToPlayer = Math.hypot(playerX - c.x, playerZ - c.z);
  c.phase += dt * (c.state === "FLEE" ? 9 : 3.2);

  if (playerMoving && distToPlayer < profile.fleeRadius) {
    c.state = "FLEE";
    // run straight away from the player, clamped back toward home so critters don't stream off-map
    const awayX = c.x - playerX;
    const awayZ = c.z - playerZ;
    const len = Math.hypot(awayX, awayZ) || 1;
    c.targetX = c.x + (awayX / len) * 10;
    c.targetZ = c.z + (awayZ / len) * 10;
    const homeDist = Math.hypot(c.targetX - c.homeX, c.targetZ - c.homeZ);
    if (homeDist > c.homeRadius * 1.6) {
      c.targetX = c.homeX + (c.targetX - c.homeX) * ((c.homeRadius * 1.6) / homeDist);
      c.targetZ = c.homeZ + (c.targetZ - c.homeZ) * ((c.homeRadius * 1.6) / homeDist);
    }
  } else if (c.state === "FLEE") {
    // just left flee range — settle back to idle rather than snapping straight to wander
    c.state = "IDLE";
    c.timer = 0.6 + rnd() * 0.8;
  } else {
    c.timer -= dt;
    if (c.timer <= 0) {
      if (c.state === "IDLE") {
        c.state = "WANDER";
        pickWanderTarget(c, rnd);
      } else {
        c.state = "IDLE";
        const [lo, hi] = profile.wanderPause;
        c.timer = lo + rnd() * (hi - lo);
      }
    }
  }

  if (c.state !== "IDLE") {
    const dx = c.targetX - c.x;
    const dz = c.targetZ - c.z;
    const dist = Math.hypot(dx, dz);
    const speed = c.state === "FLEE" ? profile.fleeSpeed : profile.speed;
    if (dist > 0.15) {
      const step = Math.min(dist, speed * dt);
      c.x += (dx / dist) * step;
      c.z += (dz / dist) * step;
      c.heading = Math.atan2(dx, dz);
    } else if (c.state === "WANDER") {
      c.state = "IDLE";
      const [lo, hi] = profile.wanderPause;
      c.timer = lo + rnd() * (hi - lo);
    }
  }

  return c;
}
