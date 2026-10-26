/**
 * Kill time (pure; sim.ts applies, Scene feeds the operator's power and class). How fast a gun drops an enemy comes from
 * three things, in the spirit of Call of Duty's weapon classes and Destiny's power level:
 *
 *  - WEAPON CLASS (CoD meta): every gun has a role and a range band. Inside its band it hits at full damage; past the
 *    band the damage falls off linearly to the class's floor. Shotguns own close range, auto and pulse rifles the middle,
 *    hand cannons hit hard out to mid range, the heavy cannon reaches furthest.
 *  - PRECISION (aim skill): a hit in the head band (enemy-reactions.ts hitPart) multiplies by the class's precision
 *    multiplier. Hand cannons and the heavy cannon reward it most, shotgun pellets least. Precision hits flash a gold
 *    hit marker and tick.
 *  - POWER LEVEL (Destiny): the operator's power (average equipped gear power + `LEVEL_POWER` per level) against the
 *    enemy's (its region's difficulty, elites a little higher). Over-levelled: up to `OVER_MAX` more damage. Under-levelled:
 *    a gentle penalty that never drops below `UNDER_FLOOR`. Applies to every source of player damage (bullets,
 *    launchers, abilities, turrets, strikes) through applyMachineDamageMods.
 *  - CLASS AFFINITY (Destiny classes x CoD loadouts): each Operator class has two signature weapons that hit harder and
 *    reward precision more: Titan the Auto Rifle and Shotgun, Hunter the Hand Cannon and Pulse Rifle, Warlock the Heavy
 *    Cannon and the launchers.
 * `shotsToKill` / `timeToKill` turn the rules into numbers (the tests hold the bands; a weapon card can show them).
 */
import type { ClassId } from "./loadout";
import { WEAPONS, type WeaponId } from "./weapons";

export type WeaponRole = "CLOSE" | "MID" | "LONG" | "ANY";
export type WeaponMeta = {
  role: WeaponRole;
  /** one line for the weapon card / selector */
  label: string;
  /** full damage out to this range (m) */
  rangeFull: number;
  /** damage reaches `rangeFloor` here (m) */
  rangeEnd: number;
  rangeFloor: number;
  /** head-band hit multiplier */
  precision: number;
};

export const WEAPON_META: Record<WeaponId, WeaponMeta> = {
  SHOTGUN: { role: "CLOSE", label: "Close quarters · one-shot inside 8 m", rangeFull: 8, rangeEnd: 20, rangeFloor: 0.2, precision: 1.15 },
  AUTO: { role: "MID", label: "Rapid-fire · mid range", rangeFull: 28, rangeEnd: 55, rangeFloor: 0.7, precision: 1.5 },
  PULSE: { role: "MID", label: "Burst · mid range", rangeFull: 38, rangeEnd: 70, rangeFloor: 0.65, precision: 1.6 },
  SIDEARM: { role: "MID", label: "Precision · rewards headshots", rangeFull: 26, rangeEnd: 48, rangeFloor: 0.6, precision: 2.0 },
  HEAVY: { role: "LONG", label: "High impact · long range", rangeFull: 100, rangeEnd: 160, rangeFloor: 0.85, precision: 1.8 },
  SWORD: { role: "CLOSE", label: "Melee", rangeFull: Infinity, rangeEnd: Infinity, rangeFloor: 1, precision: 1 },
  ROCKET: { role: "ANY", label: "Explosive", rangeFull: Infinity, rangeEnd: Infinity, rangeFloor: 1, precision: 1 },
  CINDER: { role: "ANY", label: "Explosive · burns", rangeFull: Infinity, rangeEnd: Infinity, rangeFloor: 1, precision: 1 },
  FROSTBITE: { role: "ANY", label: "Explosive · chills", rangeFull: Infinity, rangeEnd: Infinity, rangeFloor: 1, precision: 1 },
  VITRIOL: { role: "ANY", label: "Explosive · corrodes", rangeFull: Infinity, rangeEnd: Infinity, rangeFloor: 1, precision: 1 },
};

/** damage multiplier at `distance` metres for this class */
export function rangeFalloff(id: WeaponId, distance: number): number {
  const m = WEAPON_META[id];
  if (!(distance > m.rangeFull)) return 1;
  if (distance >= m.rangeEnd) return m.rangeFloor;
  return 1 - (1 - m.rangeFloor) * ((distance - m.rangeFull) / (m.rangeEnd - m.rangeFull));
}

// ---- class affinity ----
export const AFFINITY: Record<ClassId, readonly WeaponId[]> = {
  TITAN: ["AUTO", "SHOTGUN"],
  HUNTER: ["SIDEARM", "PULSE"],
  WARLOCK: ["HEAVY", "ROCKET", "CINDER", "FROSTBITE", "VITRIOL"],
};
export const AFFINITY_DAMAGE = 1.12;
export const AFFINITY_PRECISION = 0.25;
export const hasAffinity = (cls: ClassId | null | undefined, id: WeaponId) => !!cls && AFFINITY[cls].includes(id);

/** the precision multiplier this operator gets with this gun */
export const precisionFor = (id: WeaponId, cls?: ClassId | null) => (WEAPON_META[id].precision > 1 ? WEAPON_META[id].precision + (hasAffinity(cls, id) ? AFFINITY_PRECISION : 0) : 1);

// ---- power level ----
/** power each operator level adds on top of the average gear power (levels past the cap add nothing) */
export const LEVEL_POWER = 4;
export const LEVEL_CAP = 50;
/** an enemy's power: its region's difficulty (world.ts, 0..5); elites and bosses sit a little higher */
export const enemyPower = (difficulty: number, elite = false, boss = false) => 90 + 30 * Math.max(0, difficulty) + (boss ? 20 : elite ? 10 : 0);
/** the operator's power: the average power of the equipped gear (weapons and armor) plus the level bonus */
export function operatorPower(gearPowers: readonly number[], level: number): number {
  const avg = gearPowers.length ? gearPowers.reduce((a, b) => a + b, 0) / gearPowers.length : 90;
  return avg + LEVEL_POWER * (Math.min(LEVEL_CAP, Math.max(1, Math.floor(level))) - 1);
}
/** the most extra damage being over-levelled gives, reached `OVER_FULL` power above the enemy */
export const OVER_MAX = 0.4;
export const OVER_FULL = 100;
/** under-levelled: 1 point less damage per `UNDER_SLOPE` power below, never below `UNDER_FLOOR` */
export const UNDER_SLOPE = 500;
export const UNDER_FLOOR = 0.85;
export function powerScale(delta: number): number {
  if (!Number.isFinite(delta)) return 1;
  if (delta >= 0) return 1 + OVER_MAX * Math.min(1, delta / OVER_FULL);
  return Math.max(UNDER_FLOOR, 1 + delta / UNDER_SLOPE);
}

// ---- one hit, and kill time ----
export type HitContext = { distance: number; precision: boolean; cls?: ClassId | null };
/** the class-side multiplier on one bullet hit: range band x precision x affinity (power and build scale on top) */
export function hitMultiplier(id: WeaponId, hit: HitContext): number {
  return rangeFalloff(id, hit.distance) * (hit.precision ? precisionFor(id, hit.cls) : 1) * (hasAffinity(hit.cls, id) ? AFFINITY_DAMAGE : 1);
}

export type KillOpts = HitContext & { /** everything else multiplying a hit: build, skill tree, gear power, power level */ scale?: number };
/** projectile hits to kill an enemy with `hp` (each pellet counts) */
export function shotsToKill(id: WeaponId, hp: number, o: KillOpts): number {
  const w = WEAPONS[id];
  const perHit = w.damage * hitMultiplier(id, o) * (o.scale ?? 1);
  return perHit > 0 ? Math.ceil(hp / perHit - 1e-9) : Infinity;
}
/** seconds from the first trigger pull to the killing hit, every hit landing (reloads included) */
export function timeToKill(id: WeaponId, hp: number, o: KillOpts): number {
  const w = WEAPONS[id], n = shotsToKill(id, hp, o);
  if (!Number.isFinite(n)) return Infinity;
  const perPull = Math.max(1, w.burst) * (w.pellets ?? 1);
  const pulls = Math.ceil(n / perPull);
  // the hits of the last pull land after its burst gaps up to the killing round
  const lastBurst = Math.ceil((n - (pulls - 1) * perPull) / (w.pellets ?? 1));
  const reloads = w.mag > 0 ? Math.floor((Math.ceil(n / (w.pellets ?? 1)) - 1) / w.mag) : 0;
  return (pulls - 1) * w.fireRate + (lastBurst - 1) * w.burstGap + reloads * w.reload;
}
