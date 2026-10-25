/** A descent run (Stages 60–61, pure): what each tier spawns, when its drop opens, lives, the boss's enrage clock, the rare
 * nested depths under the boss room, and what the run pays. descent-runtime.ts applies it to the live sim; GameCanvas
 * applies the reward reducers to the save. Nothing here touches the scene or the sim. */
import { RANKS, RANK_ORDER, buildDescent, dungeonById, hash, type DescentLayout, type FractureGate, type OpenWays, type RiftRank, type Tier } from "./fracture-gates";
import { rewardMission, type PlayerProgression } from "./progression";
import type { MaterialId } from "./inventory";

/* ---------------- what each tier spawns ---------------- */

export type ChampionType = "BULWARK" | "SURGE" | "JUGGERNAUT";
export const CHAMPION_TYPES: readonly ChampionType[] = ["BULWARK", "SURGE", "JUGGERNAUT"];
export const CHAMPION_NAME: Record<ChampionType, string> = { BULWARK: "Bulwark Champion", SURGE: "Surge Champion", JUGGERNAUT: "Juggernaut Champion" };

/** one wave: `count` troops of the region, the first `elites` of them elites (heavies and elite variants), plus named extras */
export type Wave = { count: number; elites: number; champions: ChampionType[]; gatekeeper: boolean };
export type TierPlan = { waves: Wave[]; boss: boolean };

/** a 1–3 player fireteam: more bodies per wave, never fewer waves */
export const squadScale = (squad: number) => 1 + 0.4 * (Math.max(1, Math.min(3, squad)) - 1);
/** troops per wave: the sim's whole machine pool is 18 (sim.ts MACHINE_POOL), so a wave leaves room for a boss and adds */
export const WAVE_CAP = 14;

export function tierPlan(tier: Tier, rank: RiftRank, squad = 1): TierPlan {
  const k = RANKS[rank].enemyScale * squadScale(squad);
  const champs = (count: number): ChampionType[] => CHAMPION_TYPES.slice(0, RANKS[rank].champions).slice(0, count);
  /** `base` troops with `share` of them elite; whatever the pool cap cuts off comes back as extra elites instead */
  const wave = (base: number, share: number, champions: ChampionType[] = [], gatekeeper = false, minElites = 0): Wave => {
    const raw = Math.max(1, Math.round(base * k));
    const count = Math.min(WAVE_CAP, raw);
    const elites = Math.min(count, Math.max(minElites, Math.round(count * share) + Math.ceil((raw - count) / 2)));
    return { count, elites, champions, gatekeeper };
  };
  switch (tier.kind) {
    case "THRESHOLD": return { waves: [wave(8, 0)], boss: false };
    case "CHAMBER": return { waves: [wave(12, 0.15)], boss: false };
    case "ENCOUNTER": return { waves: [wave(14, 0.2, champs(1)), wave(16, 0.25, champs(2))], boss: false };
    case "GATEKEEPER": return { waves: [wave(8, 0, champs(1), true, 1)], boss: false };
    case "BOSS": return { waves: [wave(6, 0)], boss: true };
    case "NESTED": return { waves: [wave(8, 0, champs(3), false, 2)], boss: true };
  }
}

/* ---------------- the run ---------------- */

export type RunStatus = "ACTIVE" | "CLEARED" | "FAILED" | "LEFT";
export type DescentRun = {
  gateId: string;
  dungeonId: string;
  day: string;
  shownRank: RiftRank;
  rank: RiftRank;
  squad: number;
  layout: DescentLayout;
  /** the tier you are on */
  tier: number;
  /** waves already sent on the current tier */
  wave: number;
  cleared: number[];
  lives: number;
  deaths: number;
  startedAt: number;
  bossStartedAt: number | null;
  bossDown: boolean;
  /** the floor of the boss room cracked: a hidden tier and a hidden boss under it */
  nested: boolean;
  nestedDown: boolean;
  status: RunStatus;
  /** the player crossed the shown rank's depth: the gate lied */
  rankRevealed: boolean;
  /** why the run ended, for the HUD */
  reason?: string;
};

/** shared lives per run: one more for a fireteam */
export const LIVES = (squad: number) => (squad > 1 ? 4 : 3);

export function startDescent(gate: FractureGate, now: number, squad = 1): DescentRun {
  const layout = buildDescent(gate.dungeonId, gate.trueRank);
  return {
    gateId: gate.id, dungeonId: gate.dungeonId, day: gate.day, shownRank: gate.shownRank, rank: gate.trueRank, squad, layout,
    tier: 0, wave: 0, cleared: [], lives: LIVES(squad), deaths: 0, startedAt: now, bossStartedAt: null, bossDown: false,
    nested: false, nestedDown: false, status: "ACTIVE", rankRevealed: false,
  };
}

export const openWays = (run: DescentRun): OpenWays => ({
  drops: new Set(run.layout.tiers.filter((t) => !t.gated || run.cleared.includes(t.index)).map((t) => t.index)),
  nested: run.nested && run.bossDown,
});

export const currentTier = (run: DescentRun): Tier => (run.tier >= run.layout.tiers.length ? run.layout.nested : run.layout.tiers[run.tier]!);

/** you landed on a lower floor: the new tier starts with its first wave unsent */
export function arrive(run: DescentRun, tierIndex: number): DescentRun {
  if (run.status !== "ACTIVE" || tierIndex <= run.tier) return run;
  const shownDepth = RANKS[run.shownRank].depth;
  const floor = tierIndex >= run.layout.tiers.length ? run.layout.nested.floorY : run.layout.tiers[tierIndex]!.floorY;
  const deep = run.layout.tiers[0]!.floorY - floor;
  return { ...run, tier: tierIndex, wave: 0, rankRevealed: run.rankRevealed || (run.rank !== run.shownRank && deep > shownDepth) };
}

/** one wave was sent */
export const waveSent = (run: DescentRun): DescentRun => ({ ...run, wave: run.wave + 1 });

/** the tier's last wave is down: mark it cleared (opens a gated drop) */
export function clearTier(run: DescentRun): DescentRun {
  if (run.status !== "ACTIVE" || run.cleared.includes(run.tier)) return run;
  return { ...run, cleared: [...run.cleared, run.tier] };
}

export function bossEngaged(run: DescentRun, now: number): DescentRun {
  return run.bossStartedAt === null ? { ...run, bossStartedAt: now } : run;
}

/** the boss falls: the run is won once you take the exit (the run stays ACTIVE so the room's way out, and the crack, can be
 * used). About one clear in five the boss room's floor cracks onto a hidden tier with a hidden boss. */
export function bossDefeated(run: DescentRun, now: number): DescentRun {
  if (run.status !== "ACTIVE") return run;
  if (run.tier >= run.layout.tiers.length) return { ...run, nestedDown: true, status: "CLEARED", reason: "Hidden depths cleared" };
  const cracks = hash(`${run.gateId}:${run.startedAt}:nested`) % 5 === 0;
  return { ...run, bossDown: true, nested: cracks, reason: "Boss defeated", cleared: [...run.cleared, run.tier], bossStartedAt: run.bossStartedAt ?? now };
}

/** the floor cracked and you walked away from it: the run still counts as cleared */
export const takeExit = (run: DescentRun): DescentRun => (run.bossDown ? { ...run, status: "CLEARED", reason: run.reason ?? "Boss defeated" } : { ...run, status: "LEFT", reason: "Left the descent" });

/** seconds left before the descent collapses on a boss that is still standing */
export function enrageLeft(run: DescentRun, now: number): number | null {
  if (run.bossStartedAt === null || run.bossDown || run.status !== "ACTIVE") return null;
  return Math.max(0, RANKS[run.rank].enrage - (now - run.bossStartedAt) / 1000);
}
export function checkEnrage(run: DescentRun, now: number): DescentRun {
  const left = enrageLeft(run, now);
  return left === 0 ? { ...run, status: "FAILED", reason: "The descent collapsed on you" } : run;
}

/** a death spends a shared life; the last one ends the run */
export function died(run: DescentRun): DescentRun {
  if (run.status !== "ACTIVE") return run;
  const lives = run.lives - 1;
  // once the boss is down the clear is banked: running out of lives after that still counts it
  if (lives <= 0 && run.bossDown) return { ...run, lives: 0, deaths: run.deaths + 1, status: "CLEARED" };
  return lives <= 0 ? { ...run, lives, deaths: run.deaths + 1, status: "FAILED", reason: "Shared lives spent" } : { ...run, lives, deaths: run.deaths + 1 };
}

/* ---------------- rewards (Stage 61) ---------------- */

/** ISO week (UTC), so tier loot pays once a week like a Destiny dungeon's encounter chests */
export function weekOf(now: number): string {
  const d = new Date(now);
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = (new Date(t).getUTCDay() + 6) % 7;
  const thursday = new Date(t - day * 86400000 + 3 * 86400000);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = 1 + Math.floor((thursday.getTime() - yearStart) / (7 * 86400000));
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
export const tierLootKey = (dungeonId: string, tierIndex: number, now: number) => `rift-loot:${dungeonId}:${tierIndex}:${weekOf(now)}`;
export const riftMissionId = (dungeonId: string) => `side-rift-${dungeonId}`;
export const clearedTodayKey = (dungeonId: string, day: string) => `rift-cleared:${dungeonId}:${day}`;
export type Seal = "FLAWLESS" | "SOLO" | "SOLO_FLAWLESS";
export const sealKey = (dungeonId: string, seal: Seal) => `rift-seal:${dungeonId}:${seal}`;

/** the region's materials a tier's loot pays (encounters and gatekeepers pay more than a chamber) */
const REGION_MATS: Record<string, MaterialId> = { veridan: "sporeFiber", swamps: "bioCatalyst", solara: "thermalShards", wastelands: "scrapMetal", frostspire: "cryoCrystal", ember: "magmaCore" };
export function tierLoot(dungeonId: string, tier: Tier, rank: RiftRank): Partial<Record<MaterialId, number>> {
  const d = dungeonById(dungeonId);
  const mat = REGION_MATS[d?.regionId ?? ""] ?? "anomalyCarbon";
  const r = 1 + RANK_ORDER.indexOf(rank) * 0.25;
  if (tier.kind === "ENCOUNTER") return { [mat]: Math.round(6 * r), dataShards: Math.round(3 * r) };
  if (tier.kind === "GATEKEEPER") return { [mat]: Math.round(8 * r), relicFragment: 1 };
  return {};
}

/** pay a cleared tier's chest, once per tier per week */
export function claimTierLoot(p: PlayerProgression, run: DescentRun, tierIndex: number, now: number): { progression: PlayerProgression; paid: Partial<Record<MaterialId, number>> } {
  const tier = run.layout.tiers[tierIndex];
  if (!tier) return { progression: p, paid: {} };
  const key = tierLootKey(run.dungeonId, tierIndex, now);
  const loot = tierLoot(run.dungeonId, tier, run.rank);
  if (p.earnedRewards.includes(key) || Object.keys(loot).length === 0) return { progression: p, paid: {} };
  const materials = { ...p.materials };
  for (const [id, n] of Object.entries(loot) as [MaterialId, number][]) materials[id] = (materials[id] ?? 0) + n;
  return { progression: { ...p, materials, earnedRewards: [...p.earnedRewards, key] }, paid: loot };
}

/** what a clear's boss chest holds, before rewardMission's first-clear bonus and repeat taper */
export function clearLoot(run: DescentRun): Partial<Record<MaterialId, number>> {
  const d = dungeonById(run.dungeonId);
  const mat = REGION_MATS[d?.regionId ?? ""] ?? "anomalyCarbon";
  const r = 1 + RANK_ORDER.indexOf(run.rank) * 0.3;
  return { [mat]: Math.round(12 * r), relicFragment: Math.round(2 * r), anomalyCarbon: Math.round(4 * r), ...(run.nestedDown ? { fractureCore: 1 } : {}) };
}

/** seals earned by this clear */
export function sealsFor(run: DescentRun): Seal[] {
  if (run.status !== "CLEARED") return [];
  const out: Seal[] = [];
  if (run.deaths === 0) out.push("FLAWLESS");
  if (run.squad === 1) out.push("SOLO");
  if (run.squad === 1 && run.deaths === 0) out.push("SOLO_FLAWLESS");
  return out;
}

/** a cleared run pays through the one mission reward path (side-contract taper, first-clear tuning core), records the day's
 * clear (so the gate stops threatening a break) and any new seals. Returns the new seals for the Legendary Recognition line. */
export function claimDescentClear(p: PlayerProgression, run: DescentRun, now: number): { progression: PlayerProgression; seals: Seal[] } {
  if (run.status !== "CLEARED") return { progression: p, seals: [] };
  const today = clearedTodayKey(run.dungeonId, run.day);
  if (p.earnedRewards.includes(today) && !run.nestedDown) return { progression: p, seals: [] };
  const paid = rewardMission(p, riftMissionId(run.dungeonId), clearLoot(run), now);
  const newSeals = sealsFor(run).filter((s) => !paid.earnedRewards.includes(sealKey(run.dungeonId, s)));
  const earned = Array.from(new Set([...paid.earnedRewards, today, ...newSeals.map((s) => sealKey(run.dungeonId, s))]));
  return { progression: { ...paid, earnedRewards: earned }, seals: newSeals };
}

/* ---------------- dungeon breaks ---------------- */

/** a gate nobody has closed by 18:00 UTC breaks: its monsters spill out around it until someone clears it */
export const BREAK_HOUR = 18;
export function gateBreaking(gate: FractureGate, now: number, earnedRewards: readonly string[]): boolean {
  return new Date(now).getUTCHours() >= BREAK_HOUR && !earnedRewards.includes(clearedTodayKey(gate.dungeonId, gate.day));
}
