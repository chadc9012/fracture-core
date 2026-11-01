/** Raid claims for every raid on the weekly loop (raid-lockout.ts `RAIDS`), pure. The Hollow Star keeps its own first-clear extras
 * (hollow-star-raid.ts); every other raid claims through the generic path here: encounter shares and drops, the dungeon pipeline on the
 * base tier, and a shard and carbon bonus on harder tiers. Harder tiers unlock one after another per raid, and each tier has its own
 * weekly lockout. */
import type { PlayerProgression } from "./progression";
import type { GearItem } from "./inventory";
import { DUNGEONS } from "./dungeons";
import { claimDungeonClear } from "./dungeon-claims";
import { RAID_TIERS, recordTierClear, tierById, tierUnlocked } from "./difficulty-ladder";
import { CHALLENGE_RAID_MULT } from "./activity-payouts";
import { HOLLOW_STAR_ID, RAID_VARIANTS, canClaimHollowStarTier, claimHollowStarTierClear, collectHollowStarEncounters, hollowStarTierUnlocked, type RaidVariant } from "./hollow-star-raid";
import { claimEncounters, clearedStages, lockedOut, markCleared, raidRoster } from "./raid-lockout";

type P = PlayerProgression;
export const raidTierUnlocked = (p: Pick<P, "earnedRewards" | "dungeonClears">, raidId: string, tierId: string) =>
  raidId === HOLLOW_STAR_ID ? hollowStarTierUnlocked(p, tierId) : tierUnlocked(p, "raid", [raidId], tierId);
/** can this tier still pay this week (unlocked, and not every encounter cleared yet) */
export const canClaimRaidTier = (p: Pick<P, "earnedRewards" | "dungeonClears"> & Partial<Pick<P, "pocketClass">>, raidId: string, tierId: string, now = Date.now()) =>
  raidId === HOLLOW_STAR_ID ? canClaimHollowStarTier(p, tierId, now) : raidTierUnlocked(p, raidId, tierId) && !lockedOut(p, tierId, now, raidId);

export type RaidCollect = { progression: P; stages: string[]; drops: GearItem[]; parts: number };
/** Collect the encounters a run cleared before it wiped: a wipe keeps everything cleared (no tier clear, no extras). */
export function collectRaidEncounters(p: P, raidId: string, variant: RaidVariant, tierId: string, stageIds: readonly string[], challenge = false, now = Date.now()): RaidCollect {
  if (raidId === HOLLOW_STAR_ID) return collectHollowStarEncounters(p, variant, tierId, stageIds, challenge, now);
  if (!raidTierUnlocked(p, raidId, tierId)) return { progression: p, stages: [], drops: [], parts: 0 };
  const r = claimEncounters(p, tierId, stageIds, { mult: variant === "CHALLENGE" ? CHALLENGE_RAID_MULT : 1, challenge, raidId }, now);
  return { progression: r.progression, stages: r.stages, drops: r.drops, parts: r.parts };
}

/** Claim a finished run on a tier: every encounter not yet cleared this week pays and rolls, the raid is locked until Monday, the tier is recorded. */
export function claimRaidTierClear(p: P, raidId: string, variant: RaidVariant, secretsFound: readonly string[], tierId: string, challenge = false, now = Date.now()): P {
  if (raidId === HOLLOW_STAR_ID) return claimHollowStarTierClear(p, variant, secretsFound, tierId, challenge, now);
  if (!canClaimRaidTier(p, raidId, tierId, now)) return p;
  const tier = tierById("raid", tierId), def = DUNGEONS.find((d) => d.id === raidId);
  const enc = claimEncounters(p, tierId, raidRoster(raidId).stageIds, { mult: variant === "CHALLENGE" ? CHALLENGE_RAID_MULT : 1, challenge, raidId }, now);
  let next: P = enc.progression;
  if (tier.rank === 0 && def) next = claimDungeonClear(next, raidId, def.signature.name, now);
  else next = {
    ...next,
    fractureShards: next.fractureShards + RAID_VARIANTS[variant].repeatShards * (1 + tier.rank),
    materials: { ...next.materials, anomalyCarbon: (next.materials.anomalyCarbon ?? 0) + 2 * tier.rank },
  };
  return recordTierClear(markCleared(next, tierId, now, raidId), raidId, tier.id);
}
export { RAID_TIERS, clearedStages };
