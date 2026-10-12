/** Trooper pressure tuning (pure), read by sim.ts. Owner play-test: "enemies seem really aggressive". Before this, troopers noticed
 * you from 70 m (130 m at night, x1.6 for elites), sprinted at 10-16 m/s and opened fire from 55 m, and the adaptation system
 * multiplied the detection radius twice with no ceiling, so long sessions got steadily worse.
 * Now: shorter notice range, jogging pace, a longer visible wind-up before ranged shots, slower melee, and one capped multiplier. */
export const ENEMY_TUNING = {
  aggroBase: 48, aggroNight: 22, aggroElite: 1.25,
  /** adaptation (combat skill / elite mutation / stealth) may move the notice radius between these */
  aggroMultMin: 0.7, aggroMultMax: 1.3,
  speedBase: 6.5, speedNight: 1.5, speedElite: 1.1,
  rangedRange: 40,
  windup: { regular: 0.6, elite: 0.42, boss: 0.25 },
  rangedCooldown: { regular: 2.6, elite: 1.9, boss: 1.3 },
  meleeCooldown: 1.4,
} as const;

export const clampAggroMult = (radiusMod: number, aggression: number) => Math.min(ENEMY_TUNING.aggroMultMax, Math.max(ENEMY_TUNING.aggroMultMin, radiusMod * aggression));

/** radius at which an idle trooper is pulled into a fight */
export function aggroRadius(night: number, elite: boolean, radiusMod: number, aggression: number): number {
  const t = ENEMY_TUNING;
  return (t.aggroBase + night * t.aggroNight) * (elite ? t.aggroElite : 1) * clampAggroMult(radiusMod, aggression);
}

export function trooperSpeed(night: number, elite: boolean): number {
  const t = ENEMY_TUNING;
  return (t.speedBase + night * t.speedNight) * (elite ? t.speedElite : 1);
}

const tier = (m: { boss: boolean; elite: boolean }) => (m.boss ? "boss" : m.elite ? "elite" : "regular") as "boss" | "elite" | "regular";
export const windupFor = (m: { boss: boolean; elite: boolean }) => ENEMY_TUNING.windup[tier(m)];
export const rangedCooldownFor = (m: { boss: boolean; elite: boolean }) => ENEMY_TUNING.rangedCooldown[tier(m)];
