/** The difficulty ladder (pure): how strikes and raids get harder, and pay more, the further you climb, the way Destiny's
 * Nightfall and raid difficulties do. Each ladder is a list of tiers; a tier scales the encounter (stage length, boss
 * toughness, hazard pressure, shared lives) and its payout multiplier. Tier N+1 unlocks once you have cleared tier N (strikes
 * count as one playlist: any strike clear at the tier opens the next; raids unlock per raid). Clears are remembered as
 * `tier-clear:<activityId>:<tierId>` keys in earnedRewards, union-merged by the cloud save. Every week one rotating feature
 * (the strike Ordeal, a raid challenge modifier) adds a bonus. The encounter engine itself (raid-stages.ts) is untouched:
 * `scaleEncounter` returns an ordinary definition. */
import { DEFAULT_HAZARD_GAIN, advanceEncounter, createEncounterRun, type EncounterDefinition, type EncounterRun, type EncounterStage } from "./raid-stages";

export type LadderKind = "strike" | "raid";
export type Tier = {
  id: string; name: string; rank: number;
  /** more enemies / longer fights */ enemyScale: number;
  /** tougher boss stages */ bossHealthScale: number;
  /** change to the shared life pool */ livesDelta: number;
  /** Nex payout multiplier */ payMult: number;
  /** how high hazard peaks under flawless play (0-100): the thinner the margin, the harder the tier. Scaling is calibrated to it. */ peak: number;
  /** recommended power, shown to the player (no hard gate) */ power: number;
  blurb: string;
};

export const STRIKE_TIERS: readonly Tier[] = [
  { id: "standard", name: "Standard", rank: 0, peak: 60, enemyScale: 1, bossHealthScale: 1, livesDelta: 0, payMult: 1, power: 100, blurb: "The strike as written." },
  { id: "hero", name: "Hero", rank: 1, peak: 72, enemyScale: 1.25, bossHealthScale: 1.4, livesDelta: 0, payMult: 1.5, power: 200, blurb: "Longer fights, a tougher boss." },
  { id: "legend", name: "Legend", rank: 2, peak: 84, enemyScale: 1.6, bossHealthScale: 2, livesDelta: -1, payMult: 2.5, power: 300, blurb: "Fewer shared lives. Mistakes cost." },
  { id: "master", name: "Master", rank: 3, peak: 94, enemyScale: 2, bossHealthScale: 3, livesDelta: -1, payMult: 4, power: 400, blurb: "The top of the playlist. Bring a plan." },
];
export const RAID_TIERS: readonly Tier[] = [
  { id: "normal", name: "Normal", rank: 0, peak: 80, enemyScale: 1, bossHealthScale: 1, livesDelta: 0, payMult: 1, power: 300, blurb: "The raid as written." },
  { id: "heroic", name: "Heroic", rank: 1, peak: 86, enemyScale: 1.3, bossHealthScale: 1.6, livesDelta: -1, payMult: 1.75, power: 400, blurb: "Every encounter is longer and the wipe margin is thinner." },
  { id: "mastery", name: "Mastery", rank: 2, peak: 91, enemyScale: 1.7, bossHealthScale: 2.4, livesDelta: -2, payMult: 3, power: 500, blurb: "Cleared Heroic? This is where the raid starts to fight back." },
  { id: "contest", name: "Contest", rank: 3, peak: 96, enemyScale: 2.2, bossHealthScale: 3.4, livesDelta: -3, payMult: 5, power: 600, blurb: "The hardest it goes. Few shared lives, long fights, the best payout in the game." },
];
export const tiersOf = (kind: LadderKind) => (kind === "strike" ? STRIKE_TIERS : RAID_TIERS);
export const tierById = (kind: LadderKind, id: string): Tier => tiersOf(kind).find((t) => t.id === id) ?? tiersOf(kind)[0]!;

type Save = { earnedRewards: readonly string[]; dungeonClears?: Record<string, number> };
export const tierClearKey = (activityId: string, tierId: string) => `tier-clear:${activityId}:${tierId}`;
/** record a clear of `tierId` on an activity */
export const recordTierClear = <P extends { earnedRewards: string[] }>(p: P, activityId: string, tierId: string): P => {
  const key = tierClearKey(activityId, tierId);
  return p.earnedRewards.includes(key) ? p : { ...p, earnedRewards: [...p.earnedRewards, key] };
};
/** has the player cleared this tier? `activityIds` is every activity that counts (all strikes for the playlist, one raid for a raid).
 * `legacyClears` lets players who cleared a raid before tiers existed count as having cleared its base tier. */
export function tierCleared(p: Save, kind: LadderKind, activityIds: readonly string[], tierId: string): boolean {
  if (activityIds.some((id) => p.earnedRewards.includes(tierClearKey(id, tierId)))) return true;
  return kind === "raid" && tierId === RAID_TIERS[0]!.id && activityIds.some((id) => (p.dungeonClears?.[id] ?? 0) > 0);
}
export function tierUnlocked(p: Save, kind: LadderKind, activityIds: readonly string[], tierId: string): boolean {
  const tier = tierById(kind, tierId);
  if (tier.rank === 0) return true;
  return tierCleared(p, kind, activityIds, tiersOf(kind)[tier.rank - 1]!.id);
}
/** the highest tier the player may play right now */
export const highestUnlocked = (p: Save, kind: LadderKind, activityIds: readonly string[]): Tier =>
  [...tiersOf(kind)].reverse().find((t) => tierUnlocked(p, kind, activityIds, t.id))!;

/** the id a tier's payout and daily claim are recorded under: the base tier keeps the activity's own id (so older saves keep their
 * history), higher tiers get their own `<id>@<tier>` so each tier pays its own first clear and its own daily repeat */
export const tierTarget = (kind: LadderKind, activityId: string, tierId: string) => (tierById(kind, tierId).rank === 0 ? activityId : `${activityId}@${tierId}`);

const DEFAULT_GAIN = DEFAULT_HAZARD_GAIN;
const stageGain = (s: EncounterStage) => s.hazardPerStep ?? DEFAULT_GAIN[s.type];

/** how high hazard goes when every objective is hit with no mistakes (100 means even flawless play wipes) */
export function flawlessPeak(def: EncounterDefinition, searches: readonly string[] = []): number {
  let run: EncounterRun = { ...createEncounterRun(def), status: "ACTIVE" };
  let peak = 0;
  for (let i = 0; i < 2000 && run.status === "ACTIVE"; i++) {
    // a secret search costs SEARCH_HAZARD in the stage it is done (OperationsHub "Investigate"), at the start of that stage
    if (run.progress === 0 && searches.includes(def.stages[run.stageIndex]?.id ?? "")) run = { ...run, hazard: Math.min(100, run.hazard + SEARCH_HAZARD) };
    run = advanceEncounter(def, run); peak = Math.max(peak, run.hazard);
  }
  return run.status === "WIPED" ? 100 : peak;
}
/** hazard a secret search costs, and the stages whose searches every tier must leave room for */
export const SEARCH_HAZARD = 8;
/** only the base tier (and no weekly challenge) guarantees room for every secret search; every harder tier is tuned to its limit, so a search there is a gamble that can wipe the run */
export const SEARCH_ROOM_RANK = 0;
export const SEARCH_STAGES: Record<string, readonly string[]> = { "hollow-star": ["broken-gate", "seal-chambers", "echo-realm"] };
/** integer hazard steps cannot always land exactly on a target, so the result may overshoot it by this much */
export const TUNE_SLACK = 3;
const tuned = new Map<string, EncounterDefinition>();
/** Set every stage's hazard per step (all scaled by one factor) so flawless play peaks as close to `target` as possible without going
 * over it. This is what makes a tier winnable by design: the target is the margin for mistakes. */
export function tuneHazard<D extends EncounterDefinition>(def: D, target: number, searchRoom = true): D {
  const cacheKey = `${searchRoom ? 1 : 0}|${def.id}|${def.name}|${def.maxLives}|${def.noCheckpointRelief ? 1 : 0}|${def.stages.map((s) => s.target).join(",")}|${target}`;
  const hit = tuned.get(cacheKey);
  if (hit) return hit as D;
  const searches = searchRoom ? SEARCH_STAGES[def.id] ?? [] : [];
  // flawless play must peak at or under the target, and doing every secret search on top must still not wipe the run
  const limit = Math.min(CHALLENGE_PEAK_CAP, target + TUNE_SLACK);
  const ok = (d: D) => flawlessPeak(d) <= limit && flawlessPeak(d, searches) < 100;
  const closer = (peak: number, than: number) => Math.abs(peak - target) < Math.abs(than - target);
  const build = (k: number): D => ({ ...def, stages: def.stages.map((s) => ({ ...s, hazardPerStep: Math.max(1, Math.round(stageGain(s) * k)) })) });
  let best: D = build(0.2), bestPeak = flawlessPeak(best);
  for (let k = 0.2; k <= 4; k += 0.01) {
    const cand = build(k), peak = flawlessPeak(cand);
    if (ok(cand) && (closer(peak, bestPeak) || (peak === bestPeak && cand === best))) { best = cand; bestPeak = peak; }
    if (peak >= 100) break;
  }
  // integer steps jump in coarse increments (a boss stage of 29 steps moves the peak 29 at a time), so finish by nudging single stages
  // (last first): one more hazard per step, or one objective more or fewer, whichever lands the peak closer to the target
  const moves: ((s: EncounterStage) => EncounterStage)[] = [
    (s) => ({ ...s, hazardPerStep: (s.hazardPerStep ?? 0) + 1 }),
    (s) => ({ ...s, target: s.target + 1 }),
    (s) => ({ ...s, target: Math.max(1, s.target - 1) }),
    (s) => ({ ...s, hazardPerStep: Math.max(1, (s.hazardPerStep ?? 2) - 1) }),
  ];
  for (let improved = true, guard = 0; improved && guard < 300; guard++) {
    improved = false;
    search: for (let i = best.stages.length - 1; i >= 0; i--) for (const move of moves) {
      const cand: D = { ...best, stages: best.stages.map((s, j) => (j === i ? move(s) : s)) };
      const peak = flawlessPeak(cand);
      if (ok(cand) && closer(peak, bestPeak)) { best = cand; bestPeak = peak; improved = true; break search; }
    }
  }
  tuned.set(cacheKey, best);
  return best;
}

/** The tier applied to an encounter definition: longer stages, fewer shared lives, and hazard calibrated so flawless play peaks at the
 * tier's `peak`. Strikes are tuned at every tier (their authored hazards vary a lot); the raid's authored tier is left as written.
 * `mod` is a weekly raid challenge (applyChallenge): its structure applies first and it adds a little to the peak (`challengeBump`). */
export function scaleEncounter<D extends EncounterDefinition>(def: D, tier: Tier, mod?: string): D {
  const structural: D = tier.rank === 0 ? def : {
    ...def, name: `${def.name} · ${tier.name}`, maxLives: Math.max(1, def.maxLives + tier.livesDelta),
    stages: def.stages.map((s) => {
      const scale = s.type === "BOSS_FIGHT" ? 1 + (tier.bossHealthScale - 1) * 0.35 : 1 + (tier.enemyScale - 1) * 0.5;
      return { ...s, target: Math.max(s.target, Math.round(s.target * scale)) };
    }),
  };
  const withMod = mod ? applyChallenge(structural, mod) : structural;
  if (def.activity === "RAID" && tier.rank === 0 && !mod) return def;
  return tuneHazard(withMod, Math.min(CHALLENGE_PEAK_CAP, tier.peak + (mod ? challengeBump(mod) : 0)), tier.rank <= SEARCH_ROOM_RANK && !mod);
}
export const CHALLENGE_PEAK_CAP = 98;
const BUMPS: Record<string, number> = { "no-revive": 4, "short-fuse": 4, "iron-boss": 3, swarm: 3, glass: 0, blackout: 0 };
export const challengeBump = (modId: string) => BUMPS[modId] ?? 0;

/* ------------------------------------------------------------------ weekly rotation */
const WEEK = 7 * 86_400_000, WEEK_ZERO = Date.UTC(2026, 0, 5); // a Monday
export const weekIndex = (now: number) => Math.floor((now - WEEK_ZERO) / WEEK);
export const WEEKLY_STRIKE_BONUS = 1.5;
export type WeeklyModifier = { id: string; name: string; effect: string };
export const RAID_CHALLENGES: readonly WeeklyModifier[] = [
  { id: "no-revive", name: "Last Light", effect: "No shared-life recovery between encounters." },
  { id: "short-fuse", name: "Short Fuse", effect: "Hazard builds faster in every encounter." },
  { id: "iron-boss", name: "Iron Boss", effect: "The final boss has extra armor in every phase." },
  { id: "blackout", name: "Blackout", effect: "Beacons and the minimap are dark inside the raid." },
  { id: "swarm", name: "Swarm", effect: "Adds arrive in larger groups." },
  { id: "glass", name: "Glass Cannons", effect: "Everyone deals more damage and takes much more." },
];
/** the modifier's actual rules on an encounter definition (taking the challenge applies it; it never changes the base tier) */
export function applyChallenge<D extends EncounterDefinition>(def: D, modId: string): D {
  const stages = (f: (s: EncounterStage) => EncounterStage) => def.stages.map(f);
  switch (modId) {
    case "no-revive": return { ...def, noCheckpointRelief: true };
    case "short-fuse": return def; // hazard builds faster: scaleEncounter raises the flawless peak by challengeBump instead (a flat multiplier would make some tiers unwinnable)
    case "iron-boss": return { ...def, stages: stages((s) => (s.type === "BOSS_FIGHT" ? { ...s, target: Math.round(s.target * 1.4) } : s)) };
    case "blackout": return { ...def, blackout: true };
    case "swarm": return { ...def, stages: stages((s) => (s.type === "BOSS_FIGHT" ? s : { ...s, target: Math.round(s.target * 1.3) })) };
    case "glass": return { ...def, damageMult: 1.5, maxLives: Math.max(1, def.maxLives - 2) };
    default: return def;
  }
}
export const weeklyRaidChallenge = (now: number): WeeklyModifier => RAID_CHALLENGES[((weekIndex(now) % RAID_CHALLENGES.length) + RAID_CHALLENGES.length) % RAID_CHALLENGES.length]!;
/** the Nex multiplier from this week's feature: the Ordeal strike pays extra from Hero up; the raid challenge pays extra when taken */
export function weeklyMult(kind: LadderKind, tier: Tier, featured: boolean, challengeTaken: boolean): number {
  if (kind === "strike") return featured && tier.rank >= 1 ? WEEKLY_STRIKE_BONUS : 1;
  void challengeTaken; // the raid's weekly challenge pays on its featured encounter (raid-lockout.ts), not on the whole raid
  return 1;
}
