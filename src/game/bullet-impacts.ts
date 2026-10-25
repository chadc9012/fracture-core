/** Bullet impact particles (presentation only): each logged impact (sim.ts logImpact) becomes a few sparks or grit
 * flecks plus one puff, from a fixed pool so a firefight never allocates. What a hit looks like depends on what it hit:
 * dust and grit off the ground, hot sparks off cover and vehicles, an energy flash and sparks off a machine. */
import type { BulletHit } from "./sim";

export type ImpactStyle = { sparks: number; speed: number; life: number; gravity: number; spark: string; puff: string; puffSize: number; puffLife: number; additivePuff: boolean; /** spray goes up in a column instead of back against the shot */ up?: boolean };

export const IMPACT_STYLE: Record<BulletHit, ImpactStyle> = {
  ground: { sparks: 4, speed: 3.2, life: 0.45, gravity: 9.8, spark: "#8a7a62", puff: "#a39780", puffSize: 0.9, puffLife: 0.6, additivePuff: false },
  cover: { sparks: 6, speed: 6, life: 0.32, gravity: 9.8, spark: "#ffc46a", puff: "#8d8d88", puffSize: 0.6, puffLife: 0.45, additivePuff: false },
  truck: { sparks: 7, speed: 6.5, life: 0.3, gravity: 9.8, spark: "#ffd27a", puff: "#ff9a40", puffSize: 0.45, puffLife: 0.12, additivePuff: true },
  machine: { sparks: 5, speed: 5, life: 0.28, gravity: 4, spark: "#9ff2ff", puff: "#5fd8ff", puffSize: 0.8, puffLife: 0.16, additivePuff: true },
  // a round into the sea: a column of white spray thrown up (not back) and a foam puff that lingers on the surface
  water: { sparks: 8, speed: 5.5, life: 0.7, gravity: 9.8, spark: "#d7ecf2", puff: "#e8f3f5", puffSize: 1.1, puffLife: 0.9, additivePuff: false, up: true },
};

export const SPARK_POOL = 96;
export const PUFF_POOL = 24;

export type Spark = { age: number; life: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; g: number; kind: BulletHit };
export type Puff = { age: number; life: number; x: number; y: number; z: number; size: number; kind: BulletHit };

export const makeSparks = (): Spark[] => Array.from({ length: SPARK_POOL }, () => ({ age: 1, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, kind: "ground" }));
export const makePuffs = (): Puff[] => Array.from({ length: PUFF_POOL }, () => ({ age: 1, life: 0, x: 0, y: 0, z: 0, size: 0, kind: "ground" }));
export const sparkAlive = (s: Spark) => s.age < s.life;
export const puffAlive = (p: Puff) => p.age < p.life;

/** spawn one impact into the pools: sparks fly back out of the surface (against the bullet's travel) in a cone.
 * Recycles the oldest particles when the pool is full, so the newest hit always shows. `rnd` is injectable for tests. */
export function spawnImpact(sparks: Spark[], puffs: Puff[], e: { x: number; y: number; z: number; kind: BulletHit; vx: number; vz: number }, rnd: () => number = Math.random) {
  const st = IMPACT_STYLE[e.kind];
  const sp = Math.hypot(e.vx, e.vz) || 1, bx = -e.vx / sp, bz = -e.vz / sp;
  for (let n = 0; n < st.sparks; n++) {
    const s = oldest(sparks, sparkAlive);
    const a = (rnd() - 0.5) * 2.2, v = st.speed * (0.5 + rnd() * 0.7);
    // a splash throws mostly straight up with a little scatter; everything else flies back out of the surface it hit
    const up = st.up ? 1.6 + rnd() * 1.2 : 0.4 + rnd() * 0.9, spread = st.up ? 0.25 : 1;
    const dx = (bx * Math.cos(a) - bz * Math.sin(a)) * spread, dz = (bx * Math.sin(a) + bz * Math.cos(a)) * spread;
    s.age = 0; s.life = st.life * (0.6 + rnd() * 0.6); s.kind = e.kind; s.g = st.gravity;
    s.x = e.x; s.y = e.y; s.z = e.z; s.vx = dx * v; s.vy = up * v; s.vz = dz * v;
  }
  const p = oldest(puffs, puffAlive);
  p.age = 0; p.life = st.puffLife; p.kind = e.kind; p.size = st.puffSize * (0.8 + rnd() * 0.4);
  p.x = e.x + bx * 0.15; p.y = e.y + 0.05; p.z = e.z + bz * 0.15;
}

/** a free slot, else the next one round a cursor: slots refill in the order they were used, so the oldest goes first */
const cursor = new WeakMap<object, number>();
function oldest<T extends { age: number; life: number }>(pool: T[], alive: (t: T) => boolean): T {
  const start = cursor.get(pool) ?? 0;
  for (let i = 0; i < pool.length; i++) {
    const j = (start + i) % pool.length, t = pool[j]!;
    if (!alive(t)) { cursor.set(pool, (j + 1) % pool.length); return t; }
  }
  cursor.set(pool, (start + 1) % pool.length);
  return pool[start]!;
}

export function stepImpacts(sparks: Spark[], puffs: Puff[], dt: number) {
  for (const s of sparks) {
    if (!sparkAlive(s)) continue;
    s.age += dt; s.vy -= s.g * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
  }
  for (const p of puffs) if (puffAlive(p)) { p.age += dt; p.y += dt * 0.5; }
}
