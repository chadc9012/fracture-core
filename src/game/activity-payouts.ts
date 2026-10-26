/** Nex payouts for the three big activity classes (pure). Bosses pay well, dungeons pay a bit better, raids pay best, and the gap is
 * wide enough that a raid day is worth several dungeon days:
 *   boss     first kill 800    repeat 350   (x1.0-2.0 by boss rank)
 *   strike   first clear 700   repeat 300   (x1-4 by difficulty tier: difficulty-ladder.ts)
 *   dungeon  first clear 1,500 repeat 600
 *   raid     first clear 12,000 repeat 4,000 (challenge variant x1.5)
 * First pays once per target (the ledger remembers it); repeats pay once per day per target, the same daily guard dungeons already
 * use, so a menu "run again" can never farm it. Every payout is one ledger entry (`payout:<class>:<id>#<OPERATOR>:<first:YYYY-MM-DD|YYYY-MM-DD>`), so cloud
 * merge (ledger union) never double-pays or loses one. Prices elsewhere (market-prices.ts) are on the same scale: a raid day buys a
 * mid-tier car in a few runs.
 * Each operator (Titan, Hunter, Warlock) earns these on their own: the operator is part of the target (`#TITAN`), so a first clear
 * pays every operator once and the daily repeat is per operator too. Saves from before that carry untagged keys, which
 * tagLegacyPayouts gives to the operator who was being played (operator-pockets.ts). */
import type { NexLedger } from "./nex";
import { HOLLOW_STAR_ID } from "./hollow-star-data";
import { weekIndex } from "./difficulty-ladder";

export type PayoutClass = "boss" | "strike" | "dungeon" | "raid";
export const PAYOUTS: Record<PayoutClass, { first: number; repeat: number }> = {
  boss: { first: 800, repeat: 350 },
  strike: { first: 700, repeat: 300 },
  dungeon: { first: 1_500, repeat: 600 },
  raid: { first: 12_000, repeat: 4_000 },
};
/** the dungeon ids that are raids (everything else in dungeons.ts is a dungeon) */
export const RAID_IDS: readonly string[] = [HOLLOW_STAR_ID];
/** later campaign bosses pay more */
export const BOSS_RANK: Record<string, number> = { "dark-knight": 1, "rime-alpha": 1.25, "drowned-monarch": 1.5, "hollow-saint": 1.75, vyrak: 2 };
export const CHALLENGE_RAID_MULT = 1.5;

export const payoutClassOfDungeon = (id: string): PayoutClass => (RAID_IDS.includes(id) ? "raid" : "dungeon");
const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
const keyOf = (cls: PayoutClass, id: string, tail: string) => `payout:${cls}:${id}:${tail}`;
/** the payout target of one operator (none given: the untagged, shared target) */
const targetOf = (id: string, operator?: string) => (operator ? `${id}#${operator}` : id);
/** older saves recorded payouts untagged: they belong to the operator who was played then */
export function tagLegacyPayouts(ledger: NexLedger, operator: string): NexLedger {
  let changed = false;
  const out: NexLedger = {};
  for (const [k, v] of Object.entries(ledger)) {
    const m = /^payout:(boss|strike|dungeon|raid):([^:#]+):(.+)$/.exec(k);
    const key = m ? `payout:${m[1]}:${m[2]}#${operator}:${m[3]}` : k;
    if (key !== k) changed = true;
    out[key] = (out[key] ?? 0) + v;
  }
  return changed ? out : ledger;
}
const everPaid = (ledger: NexLedger, cls: PayoutClass, id: string) => Object.keys(ledger).some((k) => k.startsWith(`payout:${cls}:${id}:`));

/** what a clear pays right now, and the ledger key it would be recorded under; null when today's payout is already taken */
export function payoutFor(ledger: NexLedger, cls: PayoutClass, rawId: string, now: number, mult = 1, operator?: string): { key: string; nex: number; first: boolean } | null {
  const id = targetOf(rawId, operator);
  const first = !everPaid(ledger, cls, id);
  const day = cls === "raid" ? `W${weekIndex(now)}` : dayOf(now); // raids reset weekly (Monday), everything else daily
  // the first clear is recorded with its period, so it also uses up that day's repeat (no double-dip on day one)
  const key = first ? keyOf(cls, id, `first:${day}`) : keyOf(cls, id, day);
  if (key in ledger || keyOf(cls, id, `first:${day}`) in ledger) return null;
  const base = first ? PAYOUTS[cls].first : PAYOUTS[cls].repeat;
  return { key, nex: Math.round(base * mult * (cls === "boss" ? BOSS_RANK[rawId] ?? 1 : 1)), first };
}
/** pay it into the ledger (unchanged if already taken today) */
export function payInto<P extends { nexLedger: NexLedger; pocketClass?: string }>(p: P, cls: PayoutClass, id: string, now = Date.now(), mult = 1): { progression: P; paid: number; first: boolean } {
  const pay = payoutFor(p.nexLedger, cls, id, now, mult, p.pocketClass);
  if (!pay) return { progression: p, paid: 0, first: false };
  return { progression: { ...p, nexLedger: { ...p.nexLedger, [pay.key]: pay.nex } }, paid: pay.nex, first: pay.first };
}
/** raid bosses pay through the raid clear (hollow-star-raid.ts), never as a separate boss bounty */
export const NO_BOUNTY: readonly string[] = ["astravore"];
export const claimBossBounty = <P extends { nexLedger: NexLedger; pocketClass?: string }>(p: P, scenarioId: string, now = Date.now()) => (NO_BOUNTY.includes(scenarioId) ? { progression: p, paid: 0, first: false } : payInto(p, "boss", scenarioId, now));

/** exploration pays too, smaller than the three big classes: a hidden secret once (400), a loot cache once per cache per day (60) */
export const EXPLORE_PAYOUTS = { secret: 400, cache: 60 } as const;
/** record one flat Nex payout under `key` (unchanged if the key is already in the ledger) */
export function payFlat<P extends { nexLedger?: NexLedger }>(p: P, key: string, nex: number): P {
  const ledger = p.nexLedger ?? {};
  return key in ledger ? p : { ...p, nexLedger: { ...ledger, [key]: nex } };
}
