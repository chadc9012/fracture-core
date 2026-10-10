/** Ejected bullet casings for BALLISTIC weapons only. Energy weapons that fire light (the Pulse Rifle, laser and arc weapons) eject
 * nothing. Pure pooled physics: eject, fall, bounce once or twice, settle, fade. Visual only: it never touches ammo or damage. */
export type CasingSize = "small" | "large";
/** AUTO is a ballistic rifle and HEAVY a cannon (shell casing); PULSE and SWORD shoot light or nothing */
export const CASING_OF: Readonly<Record<string, CasingSize | undefined>> = { AUTO: "small", HEAVY: "large", PULSE: undefined, SWORD: undefined };
export const casingFor = (weaponId: string): CasingSize | null => CASING_OF[weaponId] ?? null;

export type Casing = { alive: boolean; size: CasingSize; x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; rx: number; rz: number; age: number; bounces: number };
export const GRAVITY = 14, LIFE = 3.2, MAX_BOUNCES = 2;
export const createCasings = (n: number): Casing[] => Array.from({ length: n }, () => ({ alive: false, size: "small" as CasingSize, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, rx: 0, rz: 0, age: 0, bounces: 0 }));

/** eject to the shooter's right and slightly up/back; `rnd` supplies [0,1) so tests are deterministic. Recycles the oldest slot when full. */
export function ejectCasing(pool: Casing[], weaponId: string, x: number, y: number, z: number, yaw: number, rnd: () => number = Math.random): Casing | null {
  const size = casingFor(weaponId);
  if (!size) return null;
  const slot = pool.find((c) => !c.alive) ?? pool.reduce((a, b) => (b.age > a.age ? b : a));
  const right = yaw + Math.PI / 2, kick = (size === "large" ? 2.6 : 3.6) * (0.7 + rnd() * 0.6);
  Object.assign(slot, { alive: true, size, x, y, z, vx: Math.sin(right) * kick - Math.sin(yaw) * 0.6, vy: 2.2 + rnd() * 1.6, vz: Math.cos(right) * kick - Math.cos(yaw) * 0.6, spin: (rnd() - 0.5) * 30, rx: rnd() * 6, rz: rnd() * 6, age: 0, bounces: 0 });
  return slot;
}
/** advance all casings; `ground(x,z)` gives the terrain height */
export function stepCasings(pool: Casing[], dt: number, ground: (x: number, z: number) => number) {
  for (const c of pool) {
    if (!c.alive) continue;
    c.age += dt;
    if (c.age >= LIFE) { c.alive = false; continue; }
    c.vy -= GRAVITY * dt;
    c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
    c.rx += c.spin * dt; c.rz += c.spin * 0.6 * dt;
    const g = ground(c.x, c.z) + 0.03;
    if (c.y <= g) {
      c.y = g;
      if (c.bounces < MAX_BOUNCES && Math.abs(c.vy) > 1) { c.vy = -c.vy * 0.35; c.vx *= 0.5; c.vz *= 0.5; c.bounces++; }
      else { c.vy = 0; c.vx = 0; c.vz = 0; c.spin = 0; }
    }
  }
}
