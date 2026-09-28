/** Global Balance Controller — a damage-scaling, reward-pacing, and difficulty-curve model tied to
 * the player's own power, instead of every system tuning its numbers independently. Without this,
 * a player either snowballs (too strong too fast, nothing left to challenge them) or hits a wall
 * where late-game costs and enemy output outrun what they can realistically earn. Pure functions;
 * Scene.tsx sets the resulting scales into sim.mods each frame, and inventory.ts applies the reward
 * pacing multiplier where material drops are claimed. */
import type { PlayerProgression } from "./progression";

/** A rough 0..~300 "how strong is this loadout + how much have they cleared" score. Not meant to be
 * precise — just enough of a signal to place the player on the curve below. */
export function playerPowerScore(progression: PlayerProgression): number {
  const equippedIds = Object.values(progression.equippedGear).filter((id): id is string => Boolean(id));
  const equippedItems = progression.inventory.filter((item) => equippedIds.includes(item.id));
  const avgPower = equippedItems.length ? equippedItems.reduce((sum, item) => sum + item.power, 0) / equippedItems.length : 90;
  const clearScore = Object.values(progression.dungeonClears).reduce((sum, count) => sum + count, 0) * 6;
  const missionScore = progression.completedMissions.length * 4;
  return Math.max(0, avgPower * 0.6 + clearScore + missionScore);
}

/** Piecewise-linear curve through control points, clamped at the ends — a simple, readable way to
 * express "forgiving early, neutral in the middle, capped late" without a black-box formula. */
function lerpCurve(x: number, points: readonly [number, number][]): number {
  if (x <= points[0]![0]) return points[0]![1];
  const last = points[points.length - 1]!;
  if (x >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

export type DifficultyCurve = { incomingDamageScale: number; outgoingDamageScale: number };

/** power 0 (fresh start) -> enemies hit softer, player hits harder (forgiving onboarding).
 *  power ~150 (mid-game, roughly T3 gear + a few clears) -> parity, 1:1.
 *  power ~300+ (deep endgame) -> enemies scale up and player damage eases off, both capped so the
 *  late game stays a real fight without becoming punishing. */
export function difficultyCurve(power: number): DifficultyCurve {
  return {
    incomingDamageScale: lerpCurve(power, [[0, 0.82], [150, 1], [300, 1.28]]),
    outgoingDamageScale: lerpCurve(power, [[0, 1.18], [150, 1], [300, 0.9]]),
  };
}

/** Reward pacing: a slight boost while under-geared (helps a new player close the gap to the next
 * upgrade tier), settling to 1x at the midpoint, then easing down late-game so material income
 * doesn't outrun what upgrade/vendor costs (economy.ts, vendors.ts) assume — never below a floor,
 * so grinding never feels pointless. */
export function rewardPacing(power: number): number {
  return lerpCurve(power, [[0, 1.35], [150, 1], [300, 0.75]]);
}
