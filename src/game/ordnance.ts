/** Rockets and missiles as pure rules: unguided rockets fly straight with gravity-free thrust; guided missiles steer toward a target with a
 * turn-rate limit; both detonate on proximity, ground or timeout with splash falloff. NOT YET WIRED into sim.ts or any vehicle: this is the
 * tested rules layer a rocket pod, launcher or aircraft hardpoint will call. No damage numbers here change existing weapons. */
export type OrdnanceKind = "ROCKET" | "MISSILE" | "TORPEDO";
export type OrdnanceDef = { id: string; kind: OrdnanceKind; name: string; speed: number; /** rad/s, 0 = unguided */ turnRate: number; life: number; splashRadius: number; damage: number; proximity: number; domain: "AIR" | "LAND" | "WATER" | "ANY"; fits: readonly string[] };

export const ORDNANCE: readonly OrdnanceDef[] = [
  { id: "rocket-pod", kind: "ROCKET", name: "Rocket pod (70mm)", speed: 90, turnRate: 0, life: 4, splashRadius: 5, damage: 18, proximity: 1.2, domain: "ANY", fits: ["rift-helicopter", "goliath-tank"] },
  { id: "launcher-rocket", kind: "ROCKET", name: "Shoulder launcher rocket", speed: 70, turnRate: 0, life: 4, splashRadius: 7, damage: 30, proximity: 1.4, domain: "ANY", fits: ["foot-heavy"] },
  { id: "air-missile", kind: "MISSILE", name: "Air-to-air missile", speed: 130, turnRate: 1.6, life: 6, splashRadius: 8, damage: 40, proximity: 3, domain: "AIR", fits: ["vanguard-jet", "ai-interceptor"] },
  { id: "guided-missile", kind: "MISSILE", name: "Guided anti-armor missile", speed: 85, turnRate: 1.2, life: 6, splashRadius: 6, damage: 45, proximity: 2, domain: "LAND", fits: ["rift-helicopter", "goliath-tank"] },
  { id: "phase-torpedo", kind: "TORPEDO", name: "Phase torpedo", speed: 30, turnRate: 0.8, life: 9, splashRadius: 9, damage: 38, proximity: 2.5, domain: "WATER", fits: ["hydro-sub-skiff", "leviathan"] },
];
export const ordnanceById = (id: string) => ORDNANCE.find((o) => o.id === id);

export type Round = { alive: boolean; def: OrdnanceDef; x: number; y: number; z: number; dx: number; dy: number; dz: number; age: number };
export type Target = { x: number; y: number; z: number };
const norm = (x: number, y: number, z: number): [number, number, number] => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };

export function fireRound(def: OrdnanceDef, from: Target, aim: [number, number, number]): Round {
  const [dx, dy, dz] = norm(...aim);
  return { alive: true, def, x: from.x, y: from.y, z: from.z, dx, dy, dz, age: 0 };
}
export type Burst = { x: number; y: number; z: number; radius: number; damage: number; reason: "PROXIMITY" | "GROUND" | "TIMEOUT" };

/** one step. Guided rounds rotate toward the target by at most turnRate*dt. Returns a burst when it detonates (the round is then dead). */
export function stepRound(r: Round, dt: number, target: Target | null, ground: (x: number, z: number) => number): Burst | null {
  if (!r.alive) return null;
  const d = r.def;
  if (d.turnRate > 0 && target) {
    const [tx, ty, tz] = norm(target.x - r.x, target.y - r.y, target.z - r.z);
    const dot = Math.min(1, Math.max(-1, r.dx * tx + r.dy * ty + r.dz * tz));
    const ang = Math.acos(dot), step = Math.min(ang, d.turnRate * dt), k = ang > 1e-6 ? step / ang : 0;
    [r.dx, r.dy, r.dz] = norm(r.dx + (tx - r.dx) * k, r.dy + (ty - r.dy) * k, r.dz + (tz - r.dz) * k);
  }
  r.x += r.dx * d.speed * dt; r.y += r.dy * d.speed * dt; r.z += r.dz * d.speed * dt; r.age += dt;
  const burst = (reason: Burst["reason"]): Burst => { r.alive = false; return { x: r.x, y: r.y, z: r.z, radius: d.splashRadius, damage: d.damage, reason }; };
  if (target && Math.hypot(target.x - r.x, target.y - r.y, target.z - r.z) <= d.proximity) return burst("PROXIMITY");
  if (d.domain !== "WATER" && r.y <= ground(r.x, r.z)) return burst("GROUND");
  if (r.age >= d.life) return burst("TIMEOUT");
  return null;
}
/** splash damage at distance: full at the centre, linear to zero at the radius */
export const splashDamage = (b: Burst, distance: number) => (distance >= b.radius ? 0 : Math.round(b.damage * (1 - distance / b.radius) * 100) / 100);
