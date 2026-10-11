/** Health recovery (live playtest: health only came back with certain armor, so hazards that stop at 1 hp left the diver at 1 hp until
 * death). Rule: after REGEN_DELAY seconds without taking damage, health recovers at REGEN_RATE per second; safe zones (and the Nexus)
 * recover faster with no delay. Armor regen (sim.armorRegen / mods.regen) still adds on top at all times, so armor improves recovery
 * without being required. Pure; sim.ts steps it. */
export const MAX_HP = 100;
export const REGEN_DELAY = 5;
export const REGEN_RATE = 8;
export const SAFE_ZONE_RATE = 25;

export function stepHealth(hp: number, dt: number, secondsSinceDamage: number, opts: { bonusRate?: number; safe?: boolean } = {}): number {
  if (hp <= 0 || hp >= MAX_HP) return Math.min(hp, MAX_HP);
  let rate = opts.bonusRate ?? 0;
  if (opts.safe) rate += SAFE_ZONE_RATE;
  else if (secondsSinceDamage >= REGEN_DELAY) rate += REGEN_RATE;
  return Math.min(MAX_HP, hp + rate * dt);
}
