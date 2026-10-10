/** Signature rewards for Unique Scenarios. Reuses the existing inventory (GearItem), earnedRewards claim ledger and the
 * armor/attribute pipeline — no parallel inventory. Local single-player rules only: nothing here is server-authoritative or
 * cheat-proof, and the game has no fireteam layer yet (see grantScenarioReward for what "eligible" means today). */
import type { GearItem } from "./inventory";
import { ARMOR_LEVEL_MAX } from "./armor-sets";
import type { PlayerProgression } from "./progression";
import { NULL_PERK } from "./null-disruption";

/** Chance that a valid Dark Knight clear also drops the Mantle. Named config, balance after playtesting. */
export const DARK_KNIGHT_MANTLE_CHANCE = 0.25;
/** Player hits a scenario boss must have taken from the local player before its death can pay out. */
export const PARTICIPATION_HITS = 5;
/** When a duplicate would exceed the level cap, it converts to this many fracture shards instead. */
export const DUPLICATE_CAP_SHARDS = 250;
const DUPLICATE_POWER_PER_LEVEL = 15; // same step as upgradeGear / armor-set duplicates

export const NULL_SOVEREIGN: GearItem = {
  id: "null-sovereign", name: "Null Sovereign", slot: "primary", power: 320, level: 1, element: "ARC", rarity: "EXOTIC", perk: NULL_PERK, source: "The Dark Knight",
};
export const MANTLE_OF_THE_NULL_SOVEREIGN: GearItem = {
  id: "mantle-null-sovereign", name: "Mantle of the Null Sovereign", slot: "classItem", power: 240, level: 1, element: "ARC", rarity: "LEGENDARY", source: "The Dark Knight",
};

/** Chance that a valid Drowned Monarch / Hollow Saint clear also drops its chance item. Named config, balance after playtesting. */
export const DROWNED_MONARCH_TRIDENT_CHANCE = 0.2;
export const HOLLOW_SAINT_CENSER_CHANCE = 0.2;

// New scenario gear uses only systems that exist today: slot + power + element feed Defense/Mobility/Intellect or weapon
// power through the normal calculations. There is no new perk, and no dedicated 3D model or special armor look yet.
export const CROWN_OF_THE_DROWNED_COURT: GearItem = { id: "crown-drowned-court", name: "Crown of the Drowned Court", slot: "helmet", power: 235, level: 1, element: "CRYO", rarity: "LEGENDARY", source: "The Drowned Monarch" };
export const TIDECALLER_TRIDENT: GearItem = { id: "tidecaller-trident", name: "Tidecaller Trident", slot: "secondary", power: 300, level: 1, element: "CRYO", rarity: "LEGENDARY", source: "The Drowned Monarch" };
export const VEIL_OF_THE_HOLLOW_SAINT: GearItem = { id: "veil-hollow-saint", name: "Veil of the Hollow Saint", slot: "chest", power: 235, level: 1, element: "ARC", rarity: "LEGENDARY", source: "The Hollow Saint" };
export const CENSER_OF_THE_HOLLOW_SAINT: GearItem = { id: "censer-hollow-saint", name: "Censer of the Hollow Saint", slot: "heavy", power: 310, level: 1, element: "BIO", rarity: "LEGENDARY", source: "The Hollow Saint" };

// Vaelith (story reward, not a boss kill): granted by vaelith.ts through the same idempotent claim, never by defeating the dragon.
export const DRAGONHEART_PLATE: GearItem = { id: "dragonheart-plate", name: "Dragonheart Plate", slot: "chest", power: 245, level: 1, element: "THERMAL", rarity: "LEGENDARY", source: "Vaelith" };
export const EMBER_LANCE: GearItem = { id: "ember-lance", name: "Ember Lance", slot: "primary", power: 325, level: 1, element: "THERMAL", rarity: "EXOTIC", source: "Vaelith" };
export const DRAGON_SCALE_MANTLE: GearItem = { id: "dragon-scale-mantle", name: "Dragon-Scale Mantle", slot: "classItem", power: 245, level: 1, element: "THERMAL", rarity: "LEGENDARY", source: "Vaelith" };

export const ITEM_BLURB: Record<string, string> = {
  "null-sovereign": "Exotic staff. NULL DISRUPTION: well-timed hits (interrupting a wind-up, or striking an open weak point) build Null Charge; at 5 the next hit releases a pulse that stuns nearby enemies and breaks boss poise.",
  "crown-drowned-court": "Legendary helmet. A salt-crusted crown from the sunken court — strong Intellect and Defense; works with any other armor.",
  "tidecaller-trident": "Legendary secondary weapon from the Drowned Monarch. Plain power and CRYO element; no special perk.",
  "veil-hollow-saint": "Legendary chest piece woven from the Saint's shroud — strong Defense; works with any other armor.",
  "censer-hollow-saint": "Legendary heavy weapon from the Hollow Saint. Plain power and BIO element; no special perk.",
  "dragonheart-plate": "Legendary chest piece grown from a dragon's shed scale — strong Defense; works with any other armor.",
  "ember-lance": "Exotic primary weapon forged in Vaelith's fire. Plain power and THERMAL element; no special perk.",
  "dragon-scale-mantle": "Legendary class item woven with Vaelith's scales, given to those it calls Bonded. Strong Intellect, Mobility and Defense.",
  "mantle-null-sovereign": "Legendary class item — the Knight's black coat with cyan lining. Strong Intellect, Mobility and Defense; works with any other armor.",
};

export type ScenarioLootEntry = { guaranteed: GearItem[]; chance: { item: GearItem; chance: number }[] };
export const SCENARIO_LOOT: Readonly<Record<string, ScenarioLootEntry>> = {
  "dark-knight": { guaranteed: [NULL_SOVEREIGN], chance: [{ item: MANTLE_OF_THE_NULL_SOVEREIGN, chance: DARK_KNIGHT_MANTLE_CHANCE }] },
  "drowned-monarch": { guaranteed: [CROWN_OF_THE_DROWNED_COURT], chance: [{ item: TIDECALLER_TRIDENT, chance: DROWNED_MONARCH_TRIDENT_CHANCE }] },
  "vaelith-alliance": { guaranteed: [DRAGONHEART_PLATE, EMBER_LANCE], chance: [] },
  "vaelith-bond": { guaranteed: [DRAGON_SCALE_MANTLE], chance: [] },
  "hollow-saint": { guaranteed: [VEIL_OF_THE_HOLLOW_SAINT], chance: [{ item: CENSER_OF_THE_HOLLOW_SAINT, chance: HOLLOW_SAINT_CENSER_CHANCE }] },
};

/** What sim.defeatMachine attaches to a scenario kill. `rolls` are pre-drawn uniform [0,1) numbers (one per chance entry)
 * so the grant itself is deterministic; `participated` is the sim's own hit count check, never a client message. */
export type ScenarioClaim = { scenarioId: string; runId: string; participated: boolean; rolls: number[] };
export type RewardCard = { itemId: string; name: string; rarity: string; slot: string; guaranteed: boolean; outcome: "NEW" | "DUPLICATE_LEVEL" | "DUPLICATE_SHARDS"; level: number; blurb: string };
export type RewardResult = { progress: PlayerProgression; cards: RewardCard[]; status: "granted" | "already-claimed" | "invalid" | "ineligible" };

export const claimKey = (runId: string) => `scenario-run:${runId}`;

function grantOne(progress: PlayerProgression, template: GearItem, guaranteed: boolean): { progress: PlayerProgression; card: RewardCard } {
  const owned = progress.inventory.find((item) => item.id === template.id);
  const base = { itemId: template.id, name: template.name, rarity: template.rarity ?? "COMMON", slot: template.slot, guaranteed, blurb: ITEM_BLURB[template.id] ?? "" };
  if (!owned) return { progress: { ...progress, inventory: [...progress.inventory, { ...template }] }, card: { ...base, outcome: "NEW", level: 1 } };
  if (owned.level < ARMOR_LEVEL_MAX) {
    const level = owned.level + 1;
    return { progress: { ...progress, inventory: progress.inventory.map((item) => (item.id === owned.id ? { ...item, level, power: item.power + DUPLICATE_POWER_PER_LEVEL } : item)) }, card: { ...base, outcome: "DUPLICATE_LEVEL", level } };
  }
  return { progress: { ...progress, fractureShards: progress.fractureShards + DUPLICATE_CAP_SHARDS }, card: { ...base, outcome: "DUPLICATE_SHARDS", level: owned.level } };
}

/** Grants a scenario's signature rewards for one valid clear. Never grants twice for the same runId (the claim is stored in
 * the saved, cloud-merged earnedRewards list). Unknown scenarios, empty run ids and kills without participation pay nothing.
 * A duplicate guaranteed weapon levels the copy you own (cap: ARMOR_LEVEL_MAX), then converts to fracture shards. */
export function grantScenarioReward(progress: PlayerProgression, claim: ScenarioClaim): RewardResult {
  const table = SCENARIO_LOOT[claim.scenarioId];
  if (!table || typeof claim.runId !== "string" || !claim.runId) return { progress, cards: [], status: "invalid" };
  if (progress.earnedRewards.includes(claimKey(claim.runId))) return { progress, cards: [], status: "already-claimed" };
  if (!claim.participated) return { progress, cards: [], status: "ineligible" };
  let next: PlayerProgression = { ...progress, earnedRewards: [...progress.earnedRewards, claimKey(claim.runId)] };
  const cards: RewardCard[] = [];
  for (const item of table.guaranteed) { const r = grantOne(next, item, true); next = r.progress; cards.push(r.card); }
  table.chance.forEach((entry, i) => {
    const roll = claim.rolls[i];
    if (typeof roll === "number" && roll >= 0 && roll < entry.chance) { const r = grantOne(next, entry.item, false); next = r.progress; cards.push(r.card); }
  });
  return { progress: next, cards, status: "granted" };
}

/** Pre-draws the chance rolls for a scenario (injectable RNG for tests). */
export const rollScenario = (scenarioId: string, rng: () => number = Math.random): number[] => (SCENARIO_LOOT[scenarioId]?.chance ?? []).map(() => rng());

/** What the reward screen should show for a batch of drops: only claims that really granted something, each run at most
 * once per session (`shown` is a caller-owned set of run ids, so a repeated onDrops delivery or a render that has not yet
 * caught up with the save can never show the same cards twice). A failed chance roll produces no card. */
export function planScenarioRewardCards(progress: PlayerProgression, drops: { scenarioClaim?: ScenarioClaim }[], shown: Set<string>): { scenarioId: string; cards: RewardCard[] }[] {
  const out: { scenarioId: string; cards: RewardCard[] }[] = [];
  for (const drop of drops) {
    const claim = drop.scenarioClaim;
    if (!claim || shown.has(claim.runId)) continue;
    const result = grantScenarioReward(progress, claim);
    if (result.status !== "granted" || !result.cards.length) continue;
    shown.add(claim.runId);
    out.push({ scenarioId: claim.scenarioId, cards: result.cards });
  }
  return out;
}
