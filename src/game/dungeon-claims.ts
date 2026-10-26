/** Dungeon clear payouts from the Operations hub. One claim per dungeon per day (an `earnedRewards` key), so "Run again" can no
 * longer pay again and again: the menu run used to be an unlimited tap (Fuel King ~1,200 alloy a minute). The first ever clear pays
 * in full (stable weapon, forge catalyst, 35 shards, the dungeon's own material); later days pay the repeat rate. The quest events
 * fire on every claimed clear, as before. Pure. */
import type { PlayerProgression } from "./progression";
import { grantDungeonFirstClear } from "./weapon-loot";
import { FUEL_KING_ENCOUNTER_ID, WASTELAND_GATE_DUNGEONS, gatherWastelandFuel, grantFuelKingVictoryRewards } from "./wasteland";
import { gameTick } from "./quests";
import { payInto, payoutClassOfDungeon } from "./activity-payouts";

export const DUNGEON_REPEAT = { shards: 10, fuel: 25, alloy: 20 } as const;
const day = (now: number) => new Date(now).toISOString().slice(0, 10);
/** one claim per dungeon per day per operator (each operator earns their own clears' bounties: activity-payouts.ts) */
export const dungeonClaimKey = (dungeonId: string, now: number, operator?: string) => `dungeon-claim:${dungeonId}${operator ? `#${operator}` : ""}:${day(now)}`;
export const canClaimDungeon = (p: Pick<PlayerProgression, "earnedRewards"> & Partial<Pick<PlayerProgression, "pocketClass">>, dungeonId: string, now = Date.now()) => !p.earnedRewards.includes(dungeonClaimKey(dungeonId, now, p.pocketClass));

export function claimDungeonClear(p: PlayerProgression, dungeonId: string, signatureName: string, now = Date.now()): PlayerProgression {
  if (!canClaimDungeon(p, dungeonId, now)) return p;
  const first = (p.dungeonClears[dungeonId] ?? 0) === 0;
  const earned = Array.from(new Set([...p.earnedRewards, signatureName, dungeonClaimKey(dungeonId, now, p.pocketClass)]));
  const cleared: PlayerProgression = { ...grantDungeonFirstClear(p, dungeonId), dungeonClears: { ...p.dungeonClears, [dungeonId]: (p.dungeonClears[dungeonId] ?? 0) + 1 }, fractureShards: p.fractureShards + (first ? 35 : DUNGEON_REPEAT.shards), earnedRewards: earned };
  const fuelKing = dungeonId === FUEL_KING_ENCOUNTER_ID;
  const rewarded = fuelKing
    ? (first ? grantFuelKingVictoryRewards(cleared) : { ...cleared, materials: { ...cleared.materials, reinforcedAlloy: (cleared.materials.reinforcedAlloy ?? 0) + DUNGEON_REPEAT.alloy } })
    : (WASTELAND_GATE_DUNGEONS as readonly string[]).includes(dungeonId) ? gatherWastelandFuel(cleared, first ? 100 : DUNGEON_REPEAT.fuel) : cleared;
  const paid = payInto(rewarded, payoutClassOfDungeon(dungeonId), dungeonId, now).progression; // Nex: dungeons pay well, raids pay best (activity-payouts.ts)
  const ticked = gameTick(paid, { type: "DUNGEON_CLEARED", dungeonId });
  return fuelKing ? gameTick(ticked, { type: "BOSS_DEFEATED", encounterId: dungeonId }) : ticked;
}
