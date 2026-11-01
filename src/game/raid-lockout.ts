/** The weekly raid loop, the way Destiny runs it (pure). A raid is a chain of encounters and every one of them is its own reward:
 *  - WEEKLY LOCKOUT: encounters reset every Monday (`weekIndex`). Clear one and it is locked for you until reset, on that tier, as that
 *    operator. Progress is saved the same way, so you resume at the first encounter you have not cleared this week.
 *  - ENCOUNTER REWARDS: each encounter pays its share of the raid's Nex the first time you clear it in a week (bigger for the boss), and
 *    rolls for its own named gear piece. Higher tiers roll more often and drop higher-power pieces. A wipe keeps everything you cleared.
 *  - WEEKLY CHALLENGE: one encounter each week is the featured one; taking the week's challenge doubles its Nex share and guarantees its drop.
 *  - NO PAYOUT PREVIEW: the UI never shows what a raid pays; the reward is what drops.
 * Keys live in earnedRewards (`raid-enc:<raid>:<tier>:<stage>#<operator>:W<week>`, union-merged by the cloud save) and the payout ledger, so
 * a merge can never double-pay. The first-ever clear extras (Starbreaker, regalia, blueprint) stay with hollow-star-raid.ts. */
import { MAW_PERK } from "./maw-collapse";
import { REFRAIN_PERK } from "./ashen-refrain";
import { HOLLOW_STAR, HOLLOW_STAR_ID } from "./hollow-star-data";
import { ASHEN_CHOIR, ASHEN_CHOIR_ID } from "./ashen-choir-data";
import type { GearItem, GearSlot } from "./inventory";
import type { PlayerProgression } from "./progression";
import { mulberry32 } from "./rng";
import { ARMOR_LEVEL_MAX, makeSetPiece, setPieceId, type SetSlot } from "./armor-sets";
import { RAID_TIERS, tierById, tierTarget, weekIndex } from "./difficulty-ladder";
import { payoutFor } from "./activity-payouts";

type Save = Pick<PlayerProgression, "earnedRewards" | "nexLedger" | "inventory" | "materials"> & Partial<Pick<PlayerProgression, "pocketClass">>;

type Drop = { kind: "set"; slot: SetSlot } | { kind: "weapon"; id: string; name: string; slot: GearSlot; element: GearItem["element"]; perk?: GearItem["perk"] };
type Encounter = { share: number; drop: Drop };
/** a raid on the weekly loop: its armor set, its encounters in order (each: share of the raid's Nex, and what it drops) and where its gear comes from */
export type RaidRoster = { id: string; setId: string; source: string; stageIds: readonly string[]; encounters: Record<string, Encounter> };

/** the Hollow Star's armor set (armor-sets.ts "hollow-star"): five encounters each drop one piece, the boss drops a weapon */
export const RAID_SET_ID = "hollow-star";
/** each Hollow Star encounter's share of the raid's Nex (sums to 1) and what it drops */
export const ENCOUNTERS: Record<string, Encounter> = {
  "broken-gate": { share: 0.08, drop: { kind: "set", slot: "helmet" } },
  "fallen-bridge": { share: 0.10, drop: { kind: "set", slot: "gauntlets" } },
  "seal-chambers": { share: 0.15, drop: { kind: "set", slot: "legs" } },
  "chrono-core": { share: 0.15, drop: { kind: "set", slot: "classItem" } },
  "echo-realm": { share: 0.17, drop: { kind: "set", slot: "chest" } },
  "hollow-star-boss": { share: 0.35, drop: { kind: "weapon", id: "hs-astravore-fang", name: "Astravore's Fang", slot: "heavy", element: "ARC", perk: MAW_PERK } },
};
export const RAID_STAGE_IDS: readonly string[] = HOLLOW_STAR.stages.map((s) => s.id);
const ASHEN_ENCOUNTERS: Record<string, Encounter> = {
  "cinder-nave": { share: 0.08, drop: { kind: "set", slot: "helmet" } },
  "bellwright-gallery": { share: 0.10, drop: { kind: "set", slot: "gauntlets" } },
  "pyre-crypts": { share: 0.15, drop: { kind: "set", slot: "legs" } },
  "organ-vault": { share: 0.15, drop: { kind: "set", slot: "classItem" } },
  "choir-loft": { share: 0.17, drop: { kind: "set", slot: "chest" } },
  "cantor-boss": { share: 0.35, drop: { kind: "weapon", id: "ac-cantors-dirge", name: "Cantor's Dirge", slot: "heavy", element: "THERMAL", perk: REFRAIN_PERK } },
};
/** every raid on the weekly loop (stage ids are unique across raids, so an encounter always names its raid) */
export const RAIDS: Readonly<Record<string, RaidRoster>> = {
  [HOLLOW_STAR_ID]: { id: HOLLOW_STAR_ID, setId: RAID_SET_ID, source: "The Hollow Star", stageIds: RAID_STAGE_IDS, encounters: ENCOUNTERS },
  [ASHEN_CHOIR_ID]: { id: ASHEN_CHOIR_ID, setId: "ashen-choir", source: "The Ashen Choir", stageIds: ASHEN_CHOIR.stages.map((s) => s.id), encounters: ASHEN_ENCOUNTERS },
};
export const raidRoster = (raidId: string = HOLLOW_STAR_ID): RaidRoster => RAIDS[raidId] ?? RAIDS[HOLLOW_STAR_ID]!;
/** the raid an encounter belongs to (the Hollow Star for an unknown id) */
export const raidOfStage = (stageId: string): RaidRoster => Object.values(RAIDS).find((r) => stageId in r.encounters) ?? RAIDS[HOLLOW_STAR_ID]!;
export const isRaidId = (id: string) => id in RAIDS;
/** the item id an encounter drops */
export const dropIdFor = (stageId: string) => { const r = raidOfStage(stageId), d = r.encounters[stageId]!.drop; return d.kind === "set" ? setPieceId(r.setId, d.slot) : d.id; };
/** chance a cleared encounter drops its piece, by tier rank; duplicates come back as gear parts */
export const DROP_CHANCE = [0.35, 0.5, 0.65, 0.8] as const;
export const DUPLICATE_PARTS = 3;
/** weapon power by tier; set pieces start at a level by tier instead (1, 4, 7, 10), and a duplicate levels the piece */
export const piecePower = (tierRank: number) => 300 + tierRank * 40;
export const pieceLevel = (tierRank: number) => Math.min(ARMOR_LEVEL_MAX, 1 + 3 * tierRank);

type Who = Pick<Save, "earnedRewards"> & Partial<Pick<Save, "pocketClass">>;
export const weekKey = (now: number) => `W${weekIndex(now)}`;
export const encounterKey = (tierId: string, stageId: string, now: number, operator?: string) => `raid-enc:${raidOfStage(stageId).id}:${tierId}:${stageId}${operator ? `#${operator}` : ""}:${weekKey(now)}`;
export const encounterCleared = (p: Who, tierId: string, stageId: string, now = Date.now()) => p.earnedRewards.includes(encounterKey(tierId, stageId, now, p.pocketClass));
/** stage ids this operator has cleared this week on a tier, in raid order */
export const clearedStages = (p: Who, tierId: string, now = Date.now(), raidId: string = HOLLOW_STAR_ID) => raidRoster(raidId).stageIds.filter((id) => encounterCleared(p, tierId, id, now));
export const remainingStages = (p: Who, tierId: string, now = Date.now(), raidId: string = HOLLOW_STAR_ID) => raidRoster(raidId).stageIds.filter((id) => !encounterCleared(p, tierId, id, now));
/** the whole raid finished this week on a tier (the run's completion claim, or a kill in the live arena) */
export const clearKey = (tierId: string, now: number, operator?: string, raidId: string = HOLLOW_STAR_ID) => `raid-clear:${raidId}:${tierId}${operator ? `#${operator}` : ""}:${weekKey(now)}`;
/** locked out: this tier's raid was finished this week, nothing more to earn on it until Monday */
export const lockedOut = (p: Who, tierId: string, now = Date.now(), raidId: string = HOLLOW_STAR_ID) => p.earnedRewards.includes(clearKey(tierId, now, p.pocketClass, raidId));
/** mark the raid finished for the week */
export const markCleared = <P extends Who>(p: P, tierId: string, now = Date.now(), raidId: string = HOLLOW_STAR_ID): P => ({ ...p, earnedRewards: [...p.earnedRewards, clearKey(tierId, now, p.pocketClass, raidId)] });
/** the stage a run resumes at: the first encounter not yet cleared this week (the last when all are) */
export const resumeStageIndex = (p: Who, tierId: string, now = Date.now(), raidId: string = HOLLOW_STAR_ID) => {
  const ids = raidRoster(raidId).stageIds, i = ids.findIndex((id) => !encounterCleared(p, tierId, id, now));
  return i < 0 ? ids.length - 1 : i;
};
/** this week's featured encounter (the weekly challenge's); each raid rotates through its own */
export const featuredStage = (now: number, raidId: string = HOLLOW_STAR_ID) => { const ids = raidRoster(raidId).stageIds; return ids[((weekIndex(now) % ids.length) + ids.length) % ids.length]!; };

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
/** the seeded drop roll for one encounter this week: the same operator, week, tier and encounter always roll the same */
export const dropRoll = (operator: string | undefined, tierId: string, stageId: string, now: number) => mulberry32(hash(`${operator ?? ""}|${weekKey(now)}|${tierId}|${stageId}`))();
export function pieceFor(stageId: string, tierId: string): GearItem {
  const r = raidOfStage(stageId), d = r.encounters[stageId]!.drop, tier = tierById("raid", tierId);
  if (d.kind === "set") return makeSetPiece(r.setId, d.slot, pieceLevel(tier.rank))!;
  return { id: d.id, name: d.name, slot: d.slot, power: piecePower(tier.rank), level: 1, element: d.element, rarity: "LEGENDARY", source: r.source, ...(d.perk ? { perk: d.perk } : {}) };
}

export type EncounterClaim<P> = { progression: P; stages: string[]; paid: number; drops: GearItem[]; parts: number };
/** Claim encounters (`stageIds`, default all of the raid) that this operator has not cleared this week on `tierId`: their Nex shares and drop rolls.
 * `mult` is everything on the whole raid's Nex besides the tier (the 12-player variant), `challenge` the weekly challenge taken, `raidId` the raid (default Hollow Star). */
export function claimEncounters<P extends Save>(p: P, tierId: string, stageIds?: readonly string[], opts: { mult?: number; challenge?: boolean; raidId?: string } = {}, now = Date.now()): EncounterClaim<P> {
  const raid = raidRoster(opts.raidId ?? (stageIds?.length ? raidOfStage(stageIds[0]!).id : HOLLOW_STAR_ID));
  const tier = tierById("raid", tierId), featured = featuredStage(now, raid.id), only = stageIds ?? raid.stageIds;
  let cur = p;
  const stages: string[] = [], drops: GearItem[] = [];
  let paid = 0, parts = 0;
  for (const id of raid.stageIds) {
    if (!only.includes(id) || encounterCleared(cur, tier.id, id, now)) continue;
    const bonus = opts.challenge && id === featured;
    const pay = payoutFor(cur.nexLedger, "raid", `${tierTarget("raid", raid.id, tier.id)}~${id}`, now, tier.payMult * (opts.mult ?? 1) * raid.encounters[id]!.share * (bonus ? 2 : 1), cur.pocketClass);
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
