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
export type CivilianState = "WANDER" | "IDLE" | "GREET" | "FLEE" | "COWER";

export type CivilianSpec = { id: string; name: string; role: CivilianRole; title: string; lore: string; homeX: number; homeZ: number;
  /** a robot civilian's body (robots.ts RobotVariant); people have none */
  robot?: string };

export type Civilian = {
  id: string;
  name: string;
  /** robot body (robots.ts), or undefined for a person */
  robot?: string | undefined;
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
  /** seconds since the last threat was near; civilians stay in cover until it passes CALM_SECONDS */
  calm: number;
  /** set by the view layer when the player is far away: skip drawing and animation */
  hidden?: boolean;
  /** set by the view layer: past the detail distance, draw the cheap stand-in instead of the authored body */
  far?: boolean;
};

/** a threat (live enemy, blast) this close makes a civilian run; they cower once far enough away */
export const PANIC_RADIUS = 22;
export const SAFE_DISTANCE = 30;
export const FLEE_SPEED = 3.4;
export const CALM_SECONDS = 6;
/** how far from home a fleeing civilian may run */
export const FLEE_LEASH = 26;

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
    robot: spec.robot,
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
    calm: CALM_SECONDS,
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
export function stepCivilian(c: Civilian, dt: number, playerX: number, playerZ: number, rnd: () => number, threats: readonly { x: number; z: number }[] = []): Civilian {
  const profile = ROLE_PROFILE[c.role];
  const distToPlayer = Math.hypot(playerX - c.x, playerZ - c.z);
  c.phase += dt * (c.state === "GREET" ? 1.6 : c.state === "FLEE" ? 4.5 : 2.4);
  c.calm ??= CALM_SECONDS;

  // Living World: combat nearby beats everything else. Run directly away from the nearest threat (but never past the
  // flee leash from home), then cower until it has been quiet for CALM_SECONDS.
  let near: { x: number; z: number } | null = null, nearD = Infinity;
  for (const t of threats) { const d = Math.hypot(t.x - c.x, t.z - c.z); if (d < nearD) { nearD = d; near = t; } }
  if (near && nearD < PANIC_RADIUS) c.calm = 0; else c.calm += dt;
  if (c.calm < CALM_SECONDS) {
    if (near && nearD < SAFE_DISTANCE) {
      let ax = c.x - near.x, az = c.z - near.z;
      const len = Math.hypot(ax, az) || 1;
      ax /= len; az /= len;
      // bias back toward home when the leash is tight so they slide along it instead of stopping dead
      const hx = c.homeX - c.x, hz = c.homeZ - c.z, hd = Math.hypot(hx, hz);
      if (hd > FLEE_LEASH * 0.8) { ax += (hx / hd) * 0.8; az += (hz / hd) * 0.8; const l2 = Math.hypot(ax, az) || 1; ax /= l2; az /= l2; }
      const nx = c.x + ax * FLEE_SPEED * dt, nz = c.z + az * FLEE_SPEED * dt;
      if (Math.hypot(nx - c.homeX, nz - c.homeZ) <= FLEE_LEASH) { c.x = nx; c.z = nz; c.state = "FLEE"; c.heading = Math.atan2(ax, az); return c; }
    }
    c.state = "COWER";
    if (near) c.heading = Math.atan2(c.x - near.x, c.z - near.z);
    return c;
  }
  if (c.state === "FLEE" || c.state === "COWER") { c.state = "WANDER"; c.targetX = c.homeX; c.targetZ = c.homeZ; }

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
