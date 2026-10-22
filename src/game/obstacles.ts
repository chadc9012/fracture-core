/* Solid world objects (trees, rocks, wrecks, city towers) kept in a spatial
 * hash grid so collision queries stay O(1) per body instead of O(n²).
 * Anything that hits them takes damage; heavy hits break them. */

export type ObstacleKind = "tree" | "rock" | "wreck" | "cactus" | "tower";

export type Obstacle = {
  id: number;
  kind: ObstacleKind;
  x: number;
  z: number;
  /** collision radius */
  r: number;
  hp: number;
  /** how hard it hits back (damage multiplier on impact) */
  solidity: number;
  broken: boolean;
};

const CELL = 24;
const grid = new Map<string, Obstacle[]>();
const all: Obstacle[] = [];
let nextId = 1;

const listeners = new Set<() => void>();
export let obstacleVersion = 0;

function key(x: number, z: number) {
  return `${Math.floor(x / CELL)}_${Math.floor(z / CELL)}`;
}

export function subscribeObstacles(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  obstacleVersion++;
  for (const fn of listeners) fn();
}

export function resetObstacles() {
  grid.clear();
  all.length = 0;
  nextId = 1;
}

export function addObstacle(kind: ObstacleKind, x: number, z: number, r: number, hp: number, solidity: number) {
  const o: Obstacle = { id: nextId++, kind, x, z, r, hp, solidity, broken: false };
  all.push(o);
  const k = key(x, z);
  const cell = grid.get(k);
  if (cell) cell.push(o);
  else grid.set(k, [o]);
  return o;
}

/** obstacles in the 3x3 cell neighbourhood around a point */
export function queryObstacles(x: number, z: number) {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  const out: Obstacle[] = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const cell = grid.get(`${cx + i}_${cz + j}`);
      if (cell) for (const o of cell) if (!o.broken) out.push(o);
    }
  }
  return out;
}

export function allObstacles() {
  return all;
}

/** returns true when the obstacle was destroyed by this hit */
export function damageObstacle(o: Obstacle, dmg: number) {
  o.hp -= dmg;
  if (o.hp <= 0) {
    o.broken = true;
    notify();
    return true;
  }
  return false;
}

export type Impact = { hit: boolean; damage: number; broke: boolean; kind?: ObstacleKind };

/**
 * Push a moving body out of any obstacle it overlaps and report the impact.
 * `speed` is the body's forward speed in units/s, `mass` scales the punch.
 */
export function collideBody(
  body: { x: number; z: number },
  radius: number,
  speed: number,
  mass = 1,
): Impact {
  let result: Impact = { hit: false, damage: 0, broke: false };
  for (const o of queryObstacles(body.x, body.z)) {
    const dx = body.x - o.x;
    const dz = body.z - o.z;
    const dist = Math.hypot(dx, dz);
    const min = radius + o.r;
    if (dist >= min) continue;

    // separate (exact-center overlap pushes along +x instead of leaving the body embedded)
    const push = (min - dist) + 0.05;
    body.x += (dist > 0 ? dx / dist : 1) * push;
    body.z += (dist > 0 ? dz / dist : 0) * push;

    const force = Math.abs(speed) * mass;
    const broke = damageObstacle(o, force * 0.06);
    const damage = broke ? force * 0.05 * o.solidity : force * 0.12 * o.solidity;
    if (damage > result.damage) result = { hit: true, damage, broke, kind: o.kind };
  }
  return result;
}

/** Follow the whole motion path, including crossed spatial cells. Stop on solid contact.
 * Impacts retain the existing damage/break rules and are applied once per movement. */
export function collideBodySwept(body: { x: number; z: number }, from: { x: number; z: number }, radius: number, speed: number, mass = 1): Impact {
  const dx = body.x - from.x, dz = body.z - from.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / Math.min(0.25, radius * 0.25)));
  body.x = from.x; body.z = from.z;
  const initial = collideBody(body, radius, speed, mass);
  if (initial.hit) return initial;
  for (let i = 0; i < steps; i++) {
    body.x += dx / steps; body.z += dz / steps;
    const impact = collideBody(body, radius, speed, mass);
    if (impact.hit) return impact;
  }
  return { hit: false, damage: 0, broke: false };
}
