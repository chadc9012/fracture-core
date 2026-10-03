/** Loot + XP System v1 — the progression core engine: every kill, mission, and milestone answers
 * "did I get stronger or closer to something valuable?" This module is the XP/level/NOVA-meta half;
 * loot itself already has a real generator (loot.ts's rollRarity/shapeLoot) that this connects to
 * rather than replaces. Pure, immutable functions — sim.ts queues the events, Scene.tsx drains them,
 * GameCanvas.tsx applies them to PlayerProgression and plays the level-up moment. */
import type { PlayerProgression } from "./progression";

export type XPEventType = "KILL" | "ELITE_KILL" | "BOSS_KILL" | "MISSION" | "OBJECTIVE" | "DISCOVERY";

/** Base XP per source, per the design spec's table (kill 10–100, elite 200, boss 1000+, mission
 * 500–2000, discovery 100). KILL scales with the fight's toughness via enemyLevel; the others are
 * flat because they aren't repeated the way kills are. */
export function baseXPFor(type: XPEventType, enemyLevel = 1): number {
  switch (type) {
    case "KILL": return Math.min(100, Math.max(10, enemyLevel * 10));
    case "ELITE_KILL": return 200;
    case "BOSS_KILL": return 1000;
    case "MISSION": return 800;
    case "OBJECTIVE": return 150;
    case "DISCOVERY": return 100;
  }
}

const TYPE_MULTIPLIER: Partial<Record<XPEventType, number>> = { MISSION: 1.5, DISCOVERY: 1.2 };

/** Encourages sustained skillful play without letting one heated fight snowball forever — reuses
 * sim.combatHeat (already tracks recent combat activity) instead of a brand-new combo counter. */
export function comboMultiplier(combatHeat: number): number {
  return 1 + Math.min(2, Math.max(0, combatHeat) / 40);
}

export const RARE_EVENT_MULTIPLIER: Record<string, number> = { CORRUPTION_ZONE_CLEAR: 3 };

/** Simple, readable power curve: level N needs N*100 XP to clear. */
export function xpRequiredForLevel(level: number): number {
  return level * 100;
}

export const NOVA_UNLOCK_THRESHOLDS: readonly { novaLevel: number; ability: string }[] = [
  { novaLevel: 10, ability: "CORRUPTION_CONTROL" },
  { novaLevel: 25, ability: "REALITY_SHIFT" },
];

export type GrantXPResult = { progression: PlayerProgression; gained: number; leveledUp: boolean; newLevel: number; novaUnlocked: string[] };

/** The XP+loot link, minus the loot half (that's rollRarity's job at the drop site). Applies type
 * and combo/rare-event multipliers, resolves any number of level-ups in one grant (a huge XP dump
 * can cross several thresholds at once), advances NOVA meta-progression, and reports what changed
 * so the caller can trigger the level-up moment and announce any new NOVA unlock. */
export function grantXP(progression: PlayerProgression, type: XPEventType, opts: { enemyLevel?: number; combatHeat?: number; rareEvent?: string } = {}): GrantXPResult {
  let amount = baseXPFor(type, opts.enemyLevel) * (TYPE_MULTIPLIER[type] ?? 1);
  if (opts.combatHeat !== undefined) amount *= comboMultiplier(opts.combatHeat);
  const rareMultiplier = opts.rareEvent ? RARE_EVENT_MULTIPLIER[opts.rareEvent] : undefined;
  if (rareMultiplier !== undefined) amount *= rareMultiplier;
  amount = Math.round(amount);

  let xp = progression.xp + amount;
  let level = progression.level;
  let calibrationTokens = progression.calibrationTokens;
  let leveledUp = false;
  while (xp >= xpRequiredForLevel(level)) {
    xp -= xpRequiredForLevel(level);
    level++;
    calibrationTokens++; // level-ups fund the existing ability-branch spend (build identity), no separate currency needed
    leveledUp = true;
  }

  const novaLevel = progression.novaLevel + amount * 0.01;
  const novaUnlocks = [...progression.novaUnlocks];
  const novaUnlocked: string[] = [];
  for (const threshold of NOVA_UNLOCK_THRESHOLDS) {
    if (novaLevel >= threshold.novaLevel && !novaUnlocks.includes(threshold.ability)) {
      novaUnlocks.push(threshold.ability);
      novaUnlocked.push(threshold.ability);
    }
  }

  return { progression: { ...progression, xp, level, calibrationTokens, novaLevel, novaUnlocks }, gained: amount, leveledUp, newLevel: level, novaUnlocked };
}
