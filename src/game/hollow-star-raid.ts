/** Raid 01 · The Hollow Star (pure data + rules). A multi-hour descent beneath Nexus City: six encounters, a four-phase final boss,
 * the monsters that fill the route between them, shortcuts that open at checkpoints, and rewards in three tiers (first clear,
 * repeat clear, secret objectives).
 *
 * It is a normal `DungeonDefinition` (type RAID), so the Operations hub, the stage engine (raid-stages.ts) and the daily clear
 * claim (dungeon-claims.ts) already handle it. Everything raid-specific on top of that lives here:
 *  - `claimHollowStarClear` pays through `claimDungeonClear` (the established pipeline) and then adds the raid's own extras;
 *  - the first clear sets the permanent Starbreaker title (`title:starbreaker` in earnedRewards);
 *  - `hollowStarNews` / `starbreakerRecognition` are the world-news line and NPC recognition for a game layer that shows them.
 * There is no live co-op in this build: the 6-player standard and 12-player challenge sizes are rules and data, and the Operations
 * hub runs the raid as a local fireteam simulation, like every other dungeon. */
import { HOLLOW_STAR, HOLLOW_STAR_ID } from "./hollow-star-data";
import type { PlayerProgression } from "./progression";
import { canClaimDungeon, claimDungeonClear, dungeonClaimKey } from "./dungeon-claims";
import { gameTick } from "./quests";
import { CHALLENGE_RAID_MULT } from "./activity-payouts";
import { RAID_TIERS, recordTierClear, tierById, tierUnlocked } from "./difficulty-ladder";
import { RAID_STAGE_IDS, claimEncounters, lockedOut, markCleared } from "./raid-lockout";
import type { GearItem } from "./inventory";

export { HOLLOW_STAR, HOLLOW_STAR_ID };
export const STARBREAKER_TITLE = "Starbreaker";
export const STARBREAKER_KEY = "title:starbreaker";
export const DIMENSIONAL_BLUEPRINT_KEY = "blueprint:dimensional-weapon-mod";

export type RaidVariant = "STANDARD" | "CHALLENGE";
/** Party sizes: the standard raid is built around six; twelve is an optional challenge with tougher scaling and a better repeat payout. */
export const RAID_VARIANTS: Record<RaidVariant, { party: number; enemyScale: number; bossHealthScale: number; repeatShards: number; label: string }> = {
  STANDARD: { party: 6, enemyScale: 1, bossHealthScale: 1, repeatShards: 40, label: "Standard · 6 players" },
  CHALLENGE: { party: 12, enemyScale: 1.6, bossHealthScale: 2.1, repeatShards: 75, label: "Challenge · 12 players" },
};
/** Solo or small groups can walk the entrance and the first sections; the team mechanics begin at the Seal Chambers. */
export const SOLO_ACCESS_STAGE_COUNT = 2;

/* ------------------------------------------------------------ Astravore ------------------------------------------------------------ */
export type RaidAttack = { id: string; name: string; summary: string; telegraphSeconds: number; damageTier: 1 | 2 | 3 | 4; counter: string; phases: readonly (1 | 2 | 3 | 4)[] };
export const ASTRAVORE = {
  name: "Astravore, the Hollow Star", title: "The Hollow Star", type: "Legendary Raid Boss",
  heightMeters: 150, depthKm: 3.8, quote: "Reality is just another layer.",
  /** reference scale for the model: player ~2 m, elite ~4 m, guardian ~10 m, Astravore 150+ m (upper body) */
  scaleMeters: { player: 2, elite: 4, guardian: 10, astravore: 150 },
  baseHealth: 3_600_000,
} as const;

export const ASTRAVORE_ATTACKS: readonly RaidAttack[] = [
  { id: "void-slam", name: "Void Slam", summary: "A massive area strike that sends shockwaves across the platform.", telegraphSeconds: 2.4, damageTier: 3, counter: "Jump the rings or leave the marked circle.", phases: [1, 2, 4] },
  { id: "star-beam", name: "Star Beam", summary: "A destructive beam that tracks players across the arena.", telegraphSeconds: 1.8, damageTier: 3, counter: "Keep moving and break line of sight behind the pylons.", phases: [1, 2, 3, 4] },
  { id: "gravity-pull", name: "Gravity Pull", summary: "Pulls players toward the core or off the platforms.", telegraphSeconds: 2.0, damageTier: 2, counter: "Anchor to a pylon or burn a mobility ability against the pull.", phases: [2, 3, 4] },
  { id: "dimensional-rifts", name: "Dimensional Rifts", summary: "Opens portals that spawn enemies or shift the arena.", telegraphSeconds: 3.0, damageTier: 1, counter: "Close the rifts before they finish opening.", phases: [1, 3] },
  { id: "summons", name: "Summons", summary: "Calls void constructs, elite guardians and lesser monsters.", telegraphSeconds: 2.6, damageTier: 1, counter: "Peel the elites to the edge and kill the casters first.", phases: [1, 2, 3, 4] },
  { id: "core-exposure", name: "Core Exposure", summary: "A vulnerable window that opens after the raid completes the phase mechanic.", telegraphSeconds: 0, damageTier: 1, counter: "Everything into the core; the window closes quickly.", phases: [2, 3, 4] },
];

/** damage taken by Astravore only counts at full value while the core is exposed; outside that it is heavily reduced */
export const CORE_CLOSED_DAMAGE = 0.15;
export function astravoreHealth(variant: RaidVariant): number { return Math.round(ASTRAVORE.baseHealth * RAID_VARIANTS[variant].bossHealthScale); }
/** the phase for a fraction of health remaining (1 = full): thresholds are the HP% where each phase begins */
export function astravorePhase(healthFraction: number): 1 | 2 | 3 | 4 {
  const f = Math.max(0, Math.min(1, healthFraction)) * 100;
  const phases = HOLLOW_STAR.stages[5]!.bossPhases!;
  let phase: 1 | 2 | 3 | 4 = 1;
  phases.forEach((p, i) => { if (f <= p.threshold && i < 4 && i > 0) phase = (i + 1) as 1 | 2 | 3 | 4; });
  return phase;
}
export const attacksForPhase = (phase: 1 | 2 | 3 | 4) => ASTRAVORE_ATTACKS.filter((a) => a.phases.includes(phase));

/* ------------------------------------------------------------ the monsters between encounters ------------------------------------------------------------ */
export type RaidMinion = { id: string; name: string; role: "RUSHER" | "ELITE_MELEE" | "RANGED_CASTER" | "ANCHOR"; height: number; summary: string; healthMult: number };
export const RAID_MINIONS: readonly RaidMinion[] = [
  { id: "void-reaver", name: "Void Reaver", role: "RUSHER", height: 1.2, summary: "Fast, aggressive units that flank and swarm.", healthMult: 0.6 },
  { id: "void-vanguard", name: "Void Vanguard", role: "ELITE_MELEE", height: 4, summary: "Elite melee units with a phase-step charge.", healthMult: 3 },
  { id: "void-arcanist", name: "Void Arcanist", role: "RANGED_CASTER", height: 2.2, summary: "Ranged attackers that teleport between volleys.", healthMult: 1.2 },
  { id: "void-sentinel", name: "Void Sentinel", role: "ANCHOR", height: 10, summary: "Large constructs that guard the conduits and the seals.", healthMult: 6 },
];
export function minionCount(stageId: string, variant: RaidVariant, partySize: number): number {
  const stage = HOLLOW_STAR.stages.find((s) => s.id === stageId);
  if (!stage) return 0;
  const base = 4 + stage.target;
  const size = Math.max(1, Math.min(RAID_VARIANTS[variant].party, Math.floor(partySize)));
  return Math.ceil(base * RAID_VARIANTS[variant].enemyScale * (0.5 + size / (2 * RAID_VARIANTS[variant].party)));
}

/* ------------------------------------------------------------ route, landmarks and shortcuts ------------------------------------------------------------ */
/** There is no map: each section has a landmark you can see from the one before it, and the lighting warms toward the bottom. */
export const RAID_LANDMARKS: readonly { stageId: string; landmark: string; light: string; depthKm: number }[] = [
  { stageId: "broken-gate", landmark: "A torn subway arch with a pale beam shining down the shaft", light: "cold white", depthKm: 0.2 },
  { stageId: "fallen-bridge", landmark: "A chain of ruined spans over a lit chasm", light: "blue-violet", depthKm: 0.9 },
  { stageId: "seal-chambers", landmark: "Three great doors, each glowing a different colour", light: "triple tint", depthKm: 1.7 },
  { stageId: "chrono-core", landmark: "A hall of humming conduits around a stilled clock-engine", light: "amber pulses", depthKm: 2.6 },
  { stageId: "echo-realm", landmark: "A mirror wall that shows another version of the hall", light: "split cyan/magenta", depthKm: 3.3 },
  { stageId: "hollow-star-boss", landmark: "The Hollow Star itself, burning in the floor of the world", light: "violet-white core", depthKm: 3.8 },
];
export type RaidShortcut = { id: string; opensAfter: string; from: string; to: string; label: string };
/** Shortcuts open once their checkpoint stage is complete, and stay open for the rest of the run (and for wipes: a wipe restarts at a checkpoint). */
export const RAID_SHORTCUTS: readonly RaidShortcut[] = [
  { id: "gate-lift", opensAfter: "broken-gate", from: "surface", to: "fallen-bridge", label: "Maintenance lift from the surface to the bridge head" },
  { id: "bridge-cable", opensAfter: "fallen-bridge", from: "fallen-bridge", to: "seal-chambers", label: "Cable run under the last span" },
  { id: "seal-stair", opensAfter: "seal-chambers", from: "seal-chambers", to: "chrono-core", label: "Servicing stair past the vault doors" },
  { id: "conduit-shaft", opensAfter: "chrono-core", from: "chrono-core", to: "echo-realm", label: "Conduit shaft through the dead engine" },
  { id: "mirror-drop", opensAfter: "echo-realm", from: "echo-realm", to: "hollow-star-boss", label: "The mirror drop to the final chamber" },
];
export const openShortcuts = (completedStageIds: readonly string[]): RaidShortcut[] => RAID_SHORTCUTS.filter((s) => completedStageIds.includes(s.opensAfter));
/** which stages a returning team can skip straight to: the furthest stage reachable by chaining open shortcuts from the surface */
export function furthestStartStage(completedStageIds: readonly string[]): string {
  const open = openShortcuts(completedStageIds);
  let at = "surface";
  for (;;) {
    const next = open.find((s) => s.from === at);
    if (!next) break;
    at = next.to;
  }
  return at === "surface" ? HOLLOW_STAR.stages[0]!.id : at;
}

/* ------------------------------------------------------------ rewards ------------------------------------------------------------ */
export type SecretObjective = { id: string; stageId: string; name: string; hint: string; reward: { dataShards?: number; fractureShards?: number; anomalyCarbon?: number; appearance?: string } };
export const SECRET_OBJECTIVES: readonly SecretObjective[] = [
  { id: "star-glass", stageId: "broken-gate", name: "Star-glass shards", hint: "Three shards of pale glass are lodged high in the broken arch; shoot them down before the pylons finish.", reward: { anomalyCarbon: 30, appearance: "appearance:starglass-visor" } },
  { id: "sixth-seal", stageId: "seal-chambers", name: "The sixth seal", hint: "The vault wall behind the middle door has one more seal than the machine says.", reward: { fractureShards: 40, appearance: "appearance:seal-keeper-mantle" } },
  { id: "mirror-vault", stageId: "echo-realm", name: "The mirror vault", hint: "Leave one team member standing in each reflection at once and a door opens that exists in neither.", reward: { fractureShards: 60, dataShards: 40, appearance: "appearance:echo-weave-cloak" } },
];
/** armor appearances: one for the first clear, the rest from secrets; repeat clears never re-pay an owned appearance */
export const FIRST_CLEAR_APPEARANCE = "appearance:hollow-star-regalia";
export const secretKey = (id: string) => `secret:${HOLLOW_STAR_ID}:${id}`;

export type RaidRewards = { firstClear: boolean; fractureShards: number; anomalyCarbon: number; dataShards: number; appearances: string[]; blueprint: boolean; title: boolean; secrets: string[] };
/** what a clear pays on top of the standard dungeon claim. Pure; `earned` is the player's earnedRewards list. */
export function hollowStarExtras(earned: readonly string[], dungeonClears: number, variant: RaidVariant, secretsFound: readonly string[]): RaidRewards {
  const first = dungeonClears === 0;
  const newSecrets = SECRET_OBJECTIVES.filter((s) => secretsFound.includes(s.id) && !earned.includes(secretKey(s.id)));
  const appearances = [...(first && !earned.includes(FIRST_CLEAR_APPEARANCE) ? [FIRST_CLEAR_APPEARANCE] : []), ...newSecrets.map((s) => s.reward.appearance).filter((a): a is string => !!a && !earned.includes(a))];
  return {
    firstClear: first,
    fractureShards: (first ? 250 : RAID_VARIANTS[variant].repeatShards) + newSecrets.reduce((n, s) => n + (s.reward.fractureShards ?? 0), 0),
    anomalyCarbon: (first ? 60 : 15) + newSecrets.reduce((n, s) => n + (s.reward.anomalyCarbon ?? 0), 0),
    dataShards: newSecrets.reduce((n, s) => n + (s.reward.dataShards ?? 0), 0),
    appearances,
    blueprint: first && !earned.includes(DIMENSIONAL_BLUEPRINT_KEY),
    title: first && !earned.includes(STARBREAKER_KEY),
    secrets: newSecrets.map((s) => s.id),
  };
}

/** Claim a finished raid run on Normal. Every encounter you have not cleared this week pays its share and rolls its drop (raid-lockout.ts);
 * the standard dungeon pipeline (first-clear weapon, catalyst, quest events) and the raid's own extras follow. Locked out until Monday
 * once all six encounters are cleared: the player comes back unchanged. */
export function claimHollowStarClear(p: PlayerProgression, variant: RaidVariant, secretsFound: readonly string[], now = Date.now(), challenge = false): PlayerProgression {
  if (lockedOut(p, RAID_TIERS[0]!.id, now)) return p;
  const enc = claimEncounters(p, RAID_TIERS[0]!.id, RAID_STAGE_IDS, { mult: variant === "CHALLENGE" ? CHALLENGE_RAID_MULT : 1, challenge }, now); // anything the run has not already collected encounter by encounter
  const extras = hollowStarExtras(p.earnedRewards, p.dungeonClears[HOLLOW_STAR_ID] ?? 0, variant, secretsFound);
  const base = markCleared(claimDungeonClear(enc.progression, HOLLOW_STAR_ID, HOLLOW_STAR.signature.name, now), RAID_TIERS[0]!.id, now);
  const earned = Array.from(new Set([
    ...base.earnedRewards,
    ...extras.appearances,
    ...extras.secrets.map(secretKey),
    ...(extras.blueprint ? [DIMENSIONAL_BLUEPRINT_KEY] : []),
    ...(extras.title ? [STARBREAKER_KEY] : []),
  ]));
  return {
    ...base,
    earnedRewards: earned,
    fractureShards: base.fractureShards + extras.fractureShards,
    materials: {
      ...base.materials,
      anomalyCarbon: (base.materials.anomalyCarbon ?? 0) + extras.anomalyCarbon,
      dataShards: (base.materials.dataShards ?? 0) + extras.dataShards,
    },
  };
}

/* ------------------------------------------------------------ difficulty tiers ------------------------------------------------------------
 * Normal is the raid as written (`claimHollowStarClear`). Heroic, Mastery and Contest replay it harder (difficulty-ladder.ts
 * `scaleEncounter`) and unlock one after another. Every tier has its own weekly lockout and its own encounter rewards (raid-lockout.ts):
 * higher tiers pay more Nex per encounter and roll more often for higher-power pieces. The first-clear gear, title and blueprint stay
 * with the first Normal clear: harder tiers pay currency, gear, shards and carbon. */
export const hollowStarTierUnlocked = (p: Pick<PlayerProgression, "earnedRewards" | "dungeonClears">, tierId: string) => tierUnlocked(p, "raid", [HOLLOW_STAR_ID], tierId);
/** can this tier still pay this week (unlocked, and not every encounter cleared yet) */
export const canClaimHollowStarTier = (p: Pick<PlayerProgression, "earnedRewards" | "dungeonClears"> & Partial<Pick<PlayerProgression, "pocketClass">>, tierId: string, now = Date.now()) =>
  hollowStarTierUnlocked(p, tierId) && !lockedOut(p, tierId, now);
export type RaidCollect = { progression: PlayerProgression; stages: string[]; drops: GearItem[]; parts: number };
/** Collect encounter rewards for the encounters a run cleared before it wiped: a wipe keeps everything cleared (no tier clear, no extras). */
export function collectHollowStarEncounters(p: PlayerProgression, variant: RaidVariant, tierId: string, stageIds: readonly string[], challenge = false, now = Date.now()): RaidCollect {
  if (!hollowStarTierUnlocked(p, tierId)) return { progression: p, stages: [], drops: [], parts: 0 };
  const r = claimEncounters(p, tierId, stageIds, { mult: variant === "CHALLENGE" ? CHALLENGE_RAID_MULT : 1, challenge }, now);
  return { progression: r.progression, stages: r.stages, drops: r.drops, parts: r.parts };
}
export function claimHollowStarTierClear(p: PlayerProgression, variant: RaidVariant, secretsFound: readonly string[], tierId: string, challenge = false, now = Date.now()): PlayerProgression {
  const tier = tierById("raid", tierId);
  if (!canClaimHollowStarTier(p, tierId, now)) return p;
  if (tier.rank === 0) {
    const base = claimHollowStarClear(p, variant, secretsFound, now, challenge);
    return base === p ? p : recordTierClear(base, HOLLOW_STAR_ID, tier.id);
  }
  const enc = claimEncounters(p, tierId, RAID_STAGE_IDS, { mult: variant === "CHALLENGE" ? CHALLENGE_RAID_MULT : 1, challenge }, now);
  const withExtras: PlayerProgression = {
    ...markCleared(enc.progression, tierId, now),
    fractureShards: enc.progression.fractureShards + RAID_VARIANTS[variant].repeatShards * (1 + tier.rank),
    materials: { ...enc.progression.materials, anomalyCarbon: (enc.progression.materials.anomalyCarbon ?? 0) + 2 * tier.rank },
  };
  return recordTierClear(withExtras, HOLLOW_STAR_ID, tier.id);
}
export { RAID_TIERS };

/* ------------------------------------------------------------ recognition ------------------------------------------------------------ */
export const hasStarbreaker = (p: Pick<PlayerProgression, "earnedRewards">) => p.earnedRewards.includes(STARBREAKER_KEY);
/** the world-news line for the first clear (the news layer owns delivery) */
export const hollowStarNews = (operatorName: string) => `HOLLOW STAR SILENT — ${operatorName.trim() || "An operator"} and their fireteam broke Astravore beneath Nexus City. The tremors have stopped. The city is calling them Starbreaker.`;
/** a line an NPC says to a Starbreaker; null for everyone else so ordinary dialogue is untouched */
export function starbreakerRecognition(p: Pick<PlayerProgression, "earnedRewards">, npcName: string): string | null {
  return hasStarbreaker(p) ? `${npcName}: "Starbreaker. The ground's been still since you went down. Whatever you need, it's yours."` : null;
}

/* ------------------------------------------------------------ the 3D fight ------------------------------------------------------------ */
export const ASTRAVORE_SCENARIO_ID = "astravore";
/** Killing Astravore in the world (the unique-scenario fight, scenario-encounters.ts) pays the raid's own extras on top of its
 * signature gear: Starbreaker, the blueprint and the regalia on the first kill, a smaller repeat payout after. Call it once per
 * confirmed kill (the reward plan already guarantees one call per run id). */
export function applyAstravoreKill(p: PlayerProgression, now = Date.now(), tierId: string = RAID_TIERS[0]!.id): { progress: PlayerProgression; firstKill: boolean } {
  // a harder tier pays its own encounters; one the player has not opened counts as Normal
  const tier = tierById("raid", tierId);
  if (tier.rank > 0 && hollowStarTierUnlocked(p, tier.id)) return { progress: claimHollowStarTierClear(p, "STANDARD", [], tier.id, false, now), firstKill: false };
  const firstKill = !p.earnedRewards.includes(STARBREAKER_KEY);
  // the live arena is the whole raid: killing Astravore claims every encounter you have not cleared this week, and once all six are
  // cleared a second kill pays nothing until Monday (the arena resets when you leave, so it must not be farmable)
  if (lockedOut(p, RAID_TIERS[0]!.id, now)) return { progress: p, firstKill: false };
  const enc = claimEncounters(p, RAID_TIERS[0]!.id, RAID_STAGE_IDS, {}, now);
  const extras = hollowStarExtras(p.earnedRewards, firstKill ? 0 : 1, "STANDARD", []);
  const earned = Array.from(new Set([
    ...markCleared(enc.progression, RAID_TIERS[0]!.id, now).earnedRewards, dungeonClaimKey(HOLLOW_STAR_ID, now, p.pocketClass), ...extras.appearances,
    ...(extras.blueprint ? [DIMENSIONAL_BLUEPRINT_KEY] : []), ...(extras.title ? [STARBREAKER_KEY] : []),
  ]));
  const kept: PlayerProgression = {
    ...enc.progression, earnedRewards: earned, fractureShards: p.fractureShards + extras.fractureShards,
    materials: { ...enc.progression.materials, anomalyCarbon: (enc.progression.materials.anomalyCarbon ?? 0) + extras.anomalyCarbon },
    // the real kill is a raid clear: it counts for the brief ("cleared") and unlocks Heroic
    dungeonClears: { ...p.dungeonClears, [HOLLOW_STAR_ID]: (p.dungeonClears[HOLLOW_STAR_ID] ?? 0) + 1 },
  };
  return { progress: gameTick(recordTierClear(kept, HOLLOW_STAR_ID, RAID_TIERS[0]!.id), { type: "DUNGEON_CLEARED", dungeonId: HOLLOW_STAR_ID }), firstKill };
}
