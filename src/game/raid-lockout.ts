/** The weekly raid loop, the way Destiny runs it (pure). A raid is a chain of encounters and every one of them is its own reward:
 *  - WEEKLY LOCKOUT: encounters reset every Monday (`weekIndex`). Clear one and it is locked for you until reset, on that tier, as that
 *    operator. Progress is saved the same way, so you resume at the first encounter you have not cleared this week.
 *  - ENCOUNTER REWARDS: each encounter pays its share of the raid's Nex the first time you clear it in a week (bigger for the boss), and
 *    rolls for its own named gear piece. Higher tiers roll more often and drop higher-power pieces. A wipe keeps everything you cleared.
 *  - WEEKLY CHALLENGE: one encounter each week is the featured one; taking the week's challenge doubles its Nex share and guarantees its drop.
 *  - NO PAYOUT PREVIEW: the UI never shows what a raid pays; the reward is what drops.
 * Keys live in earnedRewards (`raid-enc:<raid>:<tier>:<stage>#<operator>:W<week>`, union-merged by the cloud save) and the payout ledger, so
 * a merge can never double-pay. The first-ever clear extras (Starbreaker, regalia, blueprint) stay with hollow-star-raid.ts. */
import { HOLLOW_STAR, HOLLOW_STAR_ID } from "./hollow-star-data";
import type { GearItem, GearSlot } from "./inventory";
import type { PlayerProgression } from "./progression";
import { mulberry32 } from "./rng";
import { ARMOR_LEVEL_MAX, makeSetPiece, setPieceId, type SetSlot } from "./armor-sets";
import { RAID_TIERS, tierById, tierTarget, weekIndex } from "./difficulty-ladder";
import { payoutFor } from "./activity-payouts";

type Save = Pick<PlayerProgression, "earnedRewards" | "nexLedger" | "inventory" | "materials"> & Partial<Pick<PlayerProgression, "pocketClass">>;

/** the raid's armor set (armor-sets.ts "hollow-star"): five encounters each drop one piece, the boss drops a weapon */
export const RAID_SET_ID = "hollow-star";
type Drop = { kind: "set"; slot: SetSlot } | { kind: "weapon"; id: string; name: string; slot: GearSlot; element: GearItem["element"] };
/** each encounter's share of the raid's Nex (sums to 1) and what it drops */
export const ENCOUNTERS: Record<string, { share: number; drop: Drop }> = {
  "broken-gate": { share: 0.08, drop: { kind: "set", slot: "helmet" } },
  "fallen-bridge": { share: 0.10, drop: { kind: "set", slot: "gauntlets" } },
  "seal-chambers": { share: 0.15, drop: { kind: "set", slot: "legs" } },
  "chrono-core": { share: 0.15, drop: { kind: "set", slot: "classItem" } },
  "echo-realm": { share: 0.17, drop: { kind: "set", slot: "chest" } },
  "hollow-star-boss": { share: 0.35, drop: { kind: "weapon", id: "hs-astravore-fang", name: "Astravore's Fang", slot: "heavy", element: "ARC" } },
};
/** the item id an encounter drops */
export const dropIdFor = (stageId: string) => { const d = ENCOUNTERS[stageId]!.drop; return d.kind === "set" ? setPieceId(RAID_SET_ID, d.slot) : d.id; };
export const RAID_STAGE_IDS: readonly string[] = HOLLOW_STAR.stages.map((s) => s.id);
/** chance a cleared encounter drops its piece, by tier rank; duplicates come back as gear parts */
export const DROP_CHANCE = [0.35, 0.5, 0.65, 0.8] as const;
export const DUPLICATE_PARTS = 3;
/** weapon power by tier; set pieces start at a level by tier instead (1, 4, 7, 10), and a duplicate levels the piece */
export const piecePower = (tierRank: number) => 300 + tierRank * 40;
export const pieceLevel = (tierRank: number) => Math.min(ARMOR_LEVEL_MAX, 1 + 3 * tierRank);

export const weekKey = (now: number) => `W${weekIndex(now)}`;
export const encounterKey = (tierId: string, stageId: string, now: number, operator?: string) => `raid-enc:${HOLLOW_STAR_ID}:${tierId}:${stageId}${operator ? `#${operator}` : ""}:${weekKey(now)}`;
export const encounterCleared = (p: Pick<Save, "earnedRewards"> & Partial<Pick<Save, "pocketClass">>, tierId: string, stageId: string, now = Date.now()) => p.earnedRewards.includes(encounterKey(tierId, stageId, now, p.pocketClass));
/** stage ids this operator has cleared this week on a tier, in raid order */
export const clearedStages = (p: Pick<Save, "earnedRewards"> & Partial<Pick<Save, "pocketClass">>, tierId: string, now = Date.now()) => RAID_STAGE_IDS.filter((id) => encounterCleared(p, tierId, id, now));
export const remainingStages = (p: Pick<Save, "earnedRewards"> & Partial<Pick<Save, "pocketClass">>, tierId: string, now = Date.now()) => RAID_STAGE_IDS.filter((id) => !encounterCleared(p, tierId, id, now));
/** the whole raid finished this week on a tier (the run's completion claim, or a kill in the live arena) */
export const clearKey = (tierId: string, now: number, operator?: string) => `raid-clear:${HOLLOW_STAR_ID}:${tierId}${operator ? `#${operator}` : ""}:${weekKey(now)}`;
/** locked out: this tier's raid was finished this week, nothing more to earn on it until Monday */
export const lockedOut = (p: Pick<Save, "earnedRewards"> & Partial<Pick<Save, "pocketClass">>, tierId: string, now = Date.now()) => p.earnedRewards.includes(clearKey(tierId, now, p.pocketClass));
/** mark the raid finished for the week */
export const markCleared = <P extends Pick<Save, "earnedRewards"> & Partial<Pick<Save, "pocketClass">>>(p: P, tierId: string, now = Date.now()): P => ({ ...p, earnedRewards: [...p.earnedRewards, clearKey(tierId, now, p.pocketClass)] });
/** the stage a run resumes at: the first encounter not yet cleared this week (0 when none are) */
export const resumeStageIndex = (p: Pick<Save, "earnedRewards"> & Partial<Pick<Save, "pocketClass">>, tierId: string, now = Date.now()) => {
  const i = RAID_STAGE_IDS.findIndex((id) => !encounterCleared(p, tierId, id, now));
  return i < 0 ? RAID_STAGE_IDS.length - 1 : i;
};
/** this week's featured encounter (the weekly challenge's) */
export const featuredStage = (now: number) => RAID_STAGE_IDS[((weekIndex(now) % RAID_STAGE_IDS.length) + RAID_STAGE_IDS.length) % RAID_STAGE_IDS.length]!;

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
/** the seeded drop roll for one encounter this week: the same operator, week, tier and encounter always roll the same */
export const dropRoll = (operator: string | undefined, tierId: string, stageId: string, now: number) => mulberry32(hash(`${operator ?? ""}|${weekKey(now)}|${tierId}|${stageId}`))();
export function pieceFor(stageId: string, tierId: string): GearItem {
  const d = ENCOUNTERS[stageId]!.drop, tier = tierById("raid", tierId);
  if (d.kind === "set") return makeSetPiece(RAID_SET_ID, d.slot, pieceLevel(tier.rank))!;
  return { id: d.id, name: d.name, slot: d.slot, power: piecePower(tier.rank), level: 1, element: d.element, rarity: "LEGENDARY", source: "The Hollow Star" };
}

export type EncounterClaim<P> = { progression: P; stages: string[]; paid: number; drops: GearItem[]; parts: number };
/** Claim encounters (`stageIds`, default all) that this operator has not cleared this week on `tierId`: their Nex shares and drop rolls.
 * `mult` is everything on the whole raid's Nex besides the tier (the 12-player variant), `challenge` the weekly challenge taken. */
export function claimEncounters<P extends Save>(p: P, tierId: string, stageIds: readonly string[] = RAID_STAGE_IDS, opts: { mult?: number; challenge?: boolean } = {}, now = Date.now()): EncounterClaim<P> {
  const tier = tierById("raid", tierId), featured = featuredStage(now);
  let cur = p;
  const stages: string[] = [], drops: GearItem[] = [];
  let paid = 0, parts = 0;
  for (const id of RAID_STAGE_IDS) {
    if (!stageIds.includes(id) || encounterCleared(cur, tier.id, id, now)) continue;
    const bonus = opts.challenge && id === featured;
    const pay = payoutFor(cur.nexLedger, "raid", `${tierTarget("raid", HOLLOW_STAR_ID, tier.id)}~${id}`, now, tier.payMult * (opts.mult ?? 1) * ENCOUNTERS[id]!.share * (bonus ? 2 : 1), cur.pocketClass);
    let next: P = { ...cur, earnedRewards: [...cur.earnedRewards, encounterKey(tier.id, id, now, cur.pocketClass)] };
    if (pay) { next = { ...next, nexLedger: { ...next.nexLedger, [pay.key]: pay.nex } }; paid += pay.nex; }
    const drop = bonus || dropRoll(cur.pocketClass, tier.id, id, now) < DROP_CHANCE[tier.rank]!;
    if (drop) {
      const item = pieceFor(id, tier.id);
      const owned = next.inventory.find((g) => g.id === item.id);
      const rank = (g: GearItem) => (g.setId ? g.level : g.power);
      if (!owned) { next = { ...next, inventory: [...next.inventory, item] }; drops.push(item); }
      else if (rank(owned) < rank(item)) { next = { ...next, inventory: next.inventory.map((g) => (g.id === item.id ? { ...item, favorite: g.favorite } : g)) }; drops.push(item); } // a higher tier upgrades the piece you own
      else if (owned.setId && owned.level < ARMOR_LEVEL_MAX) { // a duplicate set piece levels up (the armor system's rule: nothing is wasted)
        const up = { ...owned, level: owned.level + 1, power: owned.power + 15 };
        next = { ...next, inventory: next.inventory.map((g) => (g.id === item.id ? up : g)) }; drops.push(up);
      } else { next = { ...next, materials: { ...next.materials, gearParts: (next.materials.gearParts ?? 0) + DUPLICATE_PARTS } }; parts += DUPLICATE_PARTS; }
    }
    cur = next; stages.push(id);
  }
  return { progression: cur, stages, paid, drops, parts };
}
export { RAID_TIERS };
