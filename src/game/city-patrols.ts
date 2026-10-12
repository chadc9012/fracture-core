/** City patrols (pure): faction guards walking fixed beats in Nexus City and Neon City. They fight anything hostile that
 * comes into their city (support-sized damage, never a boss kill, the same floor as squad.ts), and how they treat the
 * PLAYER comes from standing (living-world.ts TIER_RULES): allies ignore you, a hostile faction's patrols warn once and
 * then open fire. Scene applies the returned hits through the sim (applyMachineDamageMods / hurtPlayer); LivingCity.tsx
 * only draws guards and tracers. Guards cannot be hurt (no ally damage model exists). */
import { CITIES, type CityId, type FactionId } from "./living-world";
import { squadDamage, type SquadTarget } from "./squad";

export type GuardState = "PATROL" | "ENGAGE" | "WARN" | "HOSTILE";
export type Guard = {
  id: string; faction: FactionId; city: CityId;
  /** city-local beat (closed loop) */
  route: readonly [number, number][];
  wp: number; x: number; z: number; yaw: number; speed: number;
  state: GuardState; cool: number; target: number;
  /** seconds left on the warning before a hostile patrol fires on the player */
  warn: number;
  /** >0 while drawing a muzzle flash */
  flash: number;
  shotTo: { x: number; z: number } | null;
};

export const GUARD_RANGE = 28, GUARD_PURSUE = 18, GUARD_WALK = 2.2, GUARD_RUN = 4.6;
export const GUARD_FIRE_INTERVAL = 0.85, GUARD_DAMAGE = 0.5, GUARD_PLAYER_DAMAGE = 3, WARN_SECONDS = 2.5, HOSTILE_SIGHT = 22;
/** guards never chase this far from their beat */
export const GUARD_LEASH = 30;

type Beat = { id: string; faction: FactionId; city: CityId; route: [number, number][] };
const square = (cx: number, cz: number, h: number): [number, number][] => [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]];
export const BEATS: readonly Beat[] = [
  // Nexus beats run on the district street grid (streets at ±12/±36/±60 m from the hub, nexus-districts.ts)
  { id: "warden-north", faction: "wardens", city: "nexus", route: [[-12, -36], [12, -36], [12, -60], [-12, -60]] },
  { id: "warden-west", faction: "wardens", city: "nexus", route: [[-36, -12], [-60, -12], [-60, 12], [-36, 12]] },
  { id: "warden-east", faction: "wardens", city: "nexus", route: [[36, -12], [60, -12], [60, 12], [36, 12]] },
  { id: "warden-south", faction: "wardens", city: "nexus", route: [[-12, 36], [12, 36], [12, 60], [-12, 60]] },
  { id: "aegis-gate", faction: "aegis", city: "neon", route: [[-6, -30], [6, -30], [6, -26], [-6, -26]] },
  { id: "aegis-grid", faction: "aegis", city: "neon", route: square(28, 14, 6) },
  { id: "aegis-avenue", faction: "aegis", city: "neon", route: [[0, -24], [0, 26]] },
  { id: "syndicate-street", faction: "syndicate", city: "neon", route: [[-36, 7], [-6, 7]] },
  { id: "syndicate-alley", faction: "syndicate", city: "neon", route: [[-34, 14], [-34, 28], [-20, 28]] },
];

export function createGuards(): Guard[] {
  return BEATS.map((b) => {
    const c = CITIES[b.city];
    const [lx, lz] = b.route[0]!;
    return { id: b.id, faction: b.faction, city: b.city, route: b.route, wp: 1 % b.route.length, x: c.x + lx, z: c.z + lz, yaw: 0, speed: 0, state: "PATROL", cool: 0, target: -1, warn: 0, flash: 0, shotTo: null };
  });
}

export type GuardInput = {
  dt: number; px: number; pz: number; playerAlive: boolean;
  /** each faction's stance toward the player */
  stance: (f: FactionId) => "hostile" | "neutral" | "ally";
  rand: () => number;
};
export type GuardHit = { index: number; damage: number };
export type GuardStep = { hits: GuardHit[]; playerDamage: number; warnings: FactionId[] };

const beatHome = (g: Guard) => { const c = CITIES[g.city]; const [lx, lz] = g.route[g.wp]!; return { x: c.x + lx, z: c.z + lz }; };

/** One step for every guard. Mutates guards (position, state, cooldowns) and returns hits for Scene to apply. */
export function stepGuards(guards: Guard[], targets: readonly SquadTarget[], inp: GuardInput): GuardStep {
  const out: GuardStep = { hits: [], playerDamage: 0, warnings: [] };
  for (const g of guards) {
    g.cool = Math.max(0, g.cool - inp.dt);
    g.flash = Math.max(0, g.flash - inp.dt);
    const c = CITIES[g.city];
    // 1) hostile machines in range (the city's own defence comes first)
    let best = -1, bestD = GUARD_RANGE;
    targets.forEach((t, i) => {
      if (!t.alive || t.decoy || Math.hypot(t.x - c.x, t.z - c.z) > c.radius + 10) return;
      const d = Math.hypot(t.x - g.x, t.z - g.z);
      if (d < bestD) { bestD = d; best = i; }
    });
    const stance = inp.stance(g.faction);
    const dp = Math.hypot(inp.px - g.x, inp.pz - g.z);
    const playerInCity = Math.hypot(inp.px - c.x, inp.pz - c.z) <= c.radius;
    let aimX: number | null = null, aimZ = 0, firing = false;

    if (best >= 0) {
      const t = targets[best]!;
      g.state = "ENGAGE"; g.target = best; aimX = t.x; aimZ = t.z;
      if (bestD > GUARD_PURSUE) moveToward(g, t.x, t.z, GUARD_RUN, inp.dt, c);
      else g.speed = 0;
      if (g.cool <= 0) {
        g.cool = GUARD_FIRE_INTERVAL * (0.8 + inp.rand() * 0.4); firing = true;
        const dmg = squadDamage(t, GUARD_DAMAGE);
        if (dmg > 0 && inp.rand() < 0.7) out.hits.push({ index: best, damage: dmg });
      }
    } else if (stance === "hostile" && inp.playerAlive && playerInCity && dp < HOSTILE_SIGHT) {
      // 2) a faction that hates you: one warning, then open fire
      if (g.state !== "WARN" && g.state !== "HOSTILE") { g.state = "WARN"; g.warn = WARN_SECONDS; out.warnings.push(g.faction); }
      g.target = -1; aimX = inp.px; aimZ = inp.pz;
      if (g.state === "WARN") { g.warn -= inp.dt; if (g.warn <= 0) g.state = "HOSTILE"; g.speed = 0; }
      else {
        if (dp > GUARD_PURSUE) moveToward(g, inp.px, inp.pz, GUARD_RUN, inp.dt, c); else g.speed = 0;
        if (g.cool <= 0) { g.cool = GUARD_FIRE_INTERVAL * 1.4; firing = true; if (inp.rand() < 0.55) out.playerDamage += GUARD_PLAYER_DAMAGE; }
      }
    } else {
      // 3) walk the beat
      if (g.state === "HOSTILE" || g.state === "WARN") g.state = "PATROL";
      if (g.state === "ENGAGE") g.state = "PATROL";
      g.target = -1;
      const h = beatHome(g);
      if (Math.hypot(h.x - g.x, h.z - g.z) < 0.6) g.wp = (g.wp + 1) % g.route.length;
      else moveToward(g, h.x, h.z, GUARD_WALK, inp.dt, c);
    }
    if (aimX !== null) g.yaw = Math.atan2(aimX - g.x, aimZ - g.z);
    if (firing && aimX !== null) { g.flash = 0.08; g.shotTo = { x: aimX, z: aimZ }; }
  }
  return out;
}

function moveToward(g: Guard, x: number, z: number, speed: number, dt: number, c: { x: number; z: number; radius: number }) {
  const dx = x - g.x, dz = z - g.z, d = Math.hypot(dx, dz);
  if (d < 1e-3) { g.speed = 0; return; }
  const step = Math.min(d, speed * dt);
  let nx = g.x + (dx / d) * step, nz = g.z + (dz / d) * step;
  // stay inside the city and near the beat
  const home = beatHome(g);
  if (Math.hypot(nx - c.x, nz - c.z) > c.radius || Math.hypot(nx - home.x, nz - home.z) > GUARD_LEASH) { nx = g.x; nz = g.z; }
  g.speed = Math.hypot(nx - g.x, nz - g.z) / Math.max(dt, 1e-3);
  g.x = nx; g.z = nz;
  g.yaw = Math.atan2(dx, dz);
}
