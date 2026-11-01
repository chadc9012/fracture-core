/** What a dungeon clear is worth beyond materials, for every dungeon in the game (pure). The nine walkable descents (fracture-gates.ts,
 * played in the world) and the four hub dungeons (dungeons.ts) share one rule set, the way Destiny's dungeons do:
 *  - NEX BOUNTY: a descent clear pays the dungeon bounty (activity-payouts.ts, first clear then the daily repeat, per operator), scaled by
 *    the gate's TRUE rank (F ×0.7 … S ×1.6) and +25% for a flawless clear. The hub dungeons already pay the base bounty (dungeon-claims.ts).
 *  - WEEKLY GEAR: the boss clear rolls once per dungeon, per operator, per week for a piece of the dungeon's region armor set (a seeded
 *    roll, so reloading cannot reroll). Higher ranks and a flawless clear raise the chance; a duplicate levels the piece you own.
 * Keys live in earnedRewards (`dungeon-gear:<id>#<operator>:W<week>`), so a cloud-save merge can never roll twice. */
import type { PlayerProgression } from "./progression";
import type { GearItem } from "./inventory";
import { RANK_ORDER, type RiftRank } from "./fracture-gates";
import { grantSetPiece, setForRegion } from "./armor-sets";
import { weekIndex } from "./difficulty-ladder";
import { mulberry32 } from "./rng";
import { payInto } from "./activity-payouts";

/** Nex multiplier by rank: F 0.7, E 0.85, D 1, C 1.15, B 1.3, A 1.45, S 1.6 */
export const rankPayMult = (rank: RiftRank) => 0.7 + 0.15 * RANK_ORDER.indexOf(rank);
export const FLAWLESS_PAY_BONUS = 1.25;
/** the weekly chance a boss clear drops a set piece: 40% at F rising 5% a rank to 70% at S, and +20% (cap 95%) for a flawless clear */
export const gearChance = (rank: RiftRank, flawless = false) => Math.min(0.95, 0.4 + 0.05 * RANK_ORDER.indexOf(rank) + (flawless ? 0.2 : 0));
/** the region whose armor set a hub dungeon drops (the descents carry their own regionId) */
export const HUB_DUNGEON_REGION: Record<string, string> = { arcology_vaults: "solara", "glacial-crevasse": "frostspire", "temple-echoes": "swamps", "wasteland-fuel-king": "wastelands" };

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const week = (now: number) => `W${weekIndex(now)}`;
export const gearKey = (dungeonId: string, now: number, operator?: string) => `dungeon-gear:${dungeonId}${operator ? `#${operator}` : ""}:${week(now)}`;
/** the seeded roll for one dungeon this week: the same operator, week and dungeon always roll the same */
export const gearRoll = (operator: string | undefined, dungeonId: string, now: number) => mulberry32(hash(`${operator ?? ""}|${week(now)}|${dungeonId}`))();

export type GearResult = { progression: PlayerProgression; item: GearItem | null; result: "NEW" | "UPGRADED" | "MAXED" | null };
/** the weekly set-piece roll for a boss clear in `regionId` (once per dungeon per week; no armor set in the region, no roll) */
export function rollDungeonGear(p: PlayerProgression, dungeonId: string, regionId: string | null | undefined, rank: RiftRank, flawless: boolean, now = Date.now()): GearResult {
  const none: GearResult = { progression: p, item: null, result: null };
  const set = regionId ? setForRegion(regionId) : undefined;
  if (!set) return none;
  const key = gearKey(dungeonId, now, p.pocketClass);
  if (p.earnedRewards.includes(key)) return none;
  const marked: PlayerProgression = { ...p, earnedRewards: [...p.earnedRewards, key] };
  const chance = gearChance(rank, flawless), roll = gearRoll(p.pocketClass, dungeonId, now);
  if (roll >= chance) return { progression: marked, item: null, result: null };
  const slot = (["helmet", "gauntlets", "chest", "legs", "classItem"] as const)[Math.min(4, Math.floor((roll / chance) * 5))]!;
  const granted = grantSetPiece(marked, { setId: set.id, slot });
  return granted ? { progression: granted.progress, item: granted.item, result: granted.result } : { progression: marked, item: null, result: null };
}

/** a descent's Nex bounty: the dungeon class, scaled by the gate's true rank and a flawless clear (unchanged if already paid today) */
export function payDescent(p: PlayerProgression, dungeonId: string, rank: RiftRank, flawless: boolean, now = Date.now()): { progression: PlayerProgression; paid: number } {
  const r = payInto(p, "dungeon", dungeonId, now, rankPayMult(rank) * (flawless ? FLAWLESS_PAY_BONUS : 1));
  return { progression: r.progression, paid: r.paid };
}
