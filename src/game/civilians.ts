/**
 * Ambient civilian NPCs — friendly, non-hostile population that gives Nexus City and the outposts a
 * lived-in feel (per the "World Fracture Civilian Population" reference sheets). Pure logic only, no
 * React/three.js, so it can run in a plain Node smoke test — Civilians.tsx owns spawning geometry and
 * animation, this module owns where each NPC is and what it's doing.
 *
 * Unlike wildlife.ts, civilians never flee — they wander a small post, idle, and turn to face and
 * greet the player when approached, then go back to their business once the player moves on.
 */

export type CivilianRole = "ENGINEER" | "VENDOR" | "SCAVENGER" | "OBSERVER" | "MEDIC" | "ARTISAN";
export type CivilianState = "WANDER" | "IDLE" | "GREET";

export type CivilianSpec = { id: string; name: string; role: CivilianRole; title: string; lore: string; homeX: number; homeZ: number };

export type Civilian = {
  id: string;
  name: string;
  role: CivilianRole;
  homeX: number;
  homeZ: number;
  homeRadius: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  state: CivilianState;
  targetX: number;
  targetZ: number;
  timer: number;
  phase: number;
};

export const GREET_RADIUS = 7;

export const ROLE_PROFILE: Record<CivilianRole, { speed: number; homeRadius: number; wanderPause: [number, number] }> = {
  ENGINEER: { speed: 0.7, homeRadius: 7, wanderPause: [2.5, 5] },
  VENDOR: { speed: 0.5, homeRadius: 5, wanderPause: [3, 6] },
  SCAVENGER: { speed: 0.8, homeRadius: 10, wanderPause: [1.5, 4] },
  OBSERVER: { speed: 0.6, homeRadius: 9, wanderPause: [2, 5] },
  MEDIC: { speed: 0.6, homeRadius: 6, wanderPause: [2.5, 5.5] },
  ARTISAN: { speed: 0.6, homeRadius: 6, wanderPause: [2.5, 5] },
};

function hash2(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** deterministic per-NPC RNG seeded from its index, so a given spawn list is stable across reloads */
function seededRnd(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function spawnCivilian(spec: CivilianSpec, index: number): Civilian {
  const rnd = seededRnd(hash2(index, spec.id.length) * 1e6);
  const profile = ROLE_PROFILE[spec.role];
  return {
    id: spec.id,
    name: spec.name,
    role: spec.role,
    homeX: spec.homeX,
    homeZ: spec.homeZ,
    homeRadius: profile.homeRadius,
    x: spec.homeX,
    z: spec.homeZ,
    heading: rnd() * Math.PI * 2,
    speed: profile.speed,
    state: "IDLE",
    targetX: spec.homeX,
    targetZ: spec.homeZ,
    timer: rnd() * 2,
    phase: rnd() * Math.PI * 2,
  };
}

function pickWanderTarget(c: Civilian, rnd: () => number) {
  const a = rnd() * Math.PI * 2;
  const d = rnd() * c.homeRadius;
  c.targetX = c.homeX + Math.cos(a) * d;
  c.targetZ = c.homeZ + Math.sin(a) * d;
}

/**
 * Advance one civilian by dt seconds. A nearby player is greeted (faced, idle) rather than fled from;
 * otherwise the NPC wanders its home post on the usual wander/idle cycle. Mutates and returns the same
 * object (call site owns the array).
 */
export function stepCivilian(c: Civilian, dt: number, playerX: number, playerZ: number, rnd: () => number): Civilian {
  const profile = ROLE_PROFILE[c.role];
  const distToPlayer = Math.hypot(playerX - c.x, playerZ - c.z);
  c.phase += dt * (c.state === "GREET" ? 1.6 : 2.4);

  if (distToPlayer < GREET_RADIUS) {
    c.state = "GREET";
    c.heading = Math.atan2(playerX - c.x, playerZ - c.z);
    return c;
  }

  if (c.state === "GREET") {
    c.state = "IDLE";
    c.timer = 0.5 + rnd() * 0.8;
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

  if (c.state === "WANDER") {
    const dx = c.targetX - c.x;
    const dz = c.targetZ - c.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.15) {
      const step = Math.min(dist, profile.speed * dt);
      c.x += (dx / dist) * step;
      c.z += (dz / dist) * step;
      c.heading = Math.atan2(dx, dz);
    } else {
      c.state = "IDLE";
      const [lo, hi] = profile.wanderPause;
      c.timer = lo + rnd() * (hi - lo);
    }
  }

  return c;
}
