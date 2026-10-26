/** The difficulty ladder (pure): how strikes and raids get harder, and pay more, the further you climb, the way Destiny's
 * Nightfall and raid difficulties do. Each ladder is a list of tiers; a tier scales the encounter (stage length, boss
 * toughness, hazard pressure, shared lives) and its payout multiplier. Tier N+1 unlocks once you have cleared tier N (strikes
 * count as one playlist: any strike clear at the tier opens the next; raids unlock per raid). Clears are remembered as
 * `tier-clear:<activityId>:<tierId>` keys in earnedRewards, union-merged by the cloud save. Every week one rotating feature
 * (the strike Ordeal, a raid challenge modifier) adds a bonus. The encounter engine itself (raid-stages.ts) is untouched:
 * `scaleEncounter` returns an ordinary definition. */
import { DEFAULT_HAZARD_GAIN, type EncounterDefinition, type EncounterStage } from "./raid-stages";

export type LadderKind = "strike" | "raid";
export type Tier = {
  id: string; name: string; rank: number;
  /** more enemies / longer fights */ enemyScale: number;
  /** tougher boss stages */ bossHealthScale: number;
  /** hazard pressure per step */ hazardScale: number;
  /** change to the shared life pool */ livesDelta: number;
  /** Nex payout multiplier */ payMult: number;
  /** recommended power, shown to the player (no hard gate) */ power: number;
  blurb: string;
};

export const STRIKE_TIERS: readonly Tier[] = [
  { id: "standard", name: "Standard", rank: 0, enemyScale: 1, bossHealthScale: 1, hazardScale: 1, livesDelta: 0, payMult: 1, power: 100, blurb: "The strike as written." },
  { id: "hero", name: "Hero", rank: 1, enemyScale: 1.25, bossHealthScale: 1.4, hazardScale: 1.2, livesDelta: 0, payMult: 1.5, power: 200, blurb: "Longer fights, a tougher boss." },
  { id: "legend", name: "Legend", rank: 2, enemyScale: 1.6, bossHealthScale: 2, hazardScale: 1.45, livesDelta: -1, payMult: 2.5, power: 300, blurb: "Fewer shared lives. Mistakes cost." },
  { id: "master", name: "Master", rank: 3, enemyScale: 2, bossHealthScale: 3, hazardScale: 1.8, livesDelta: -1, payMult: 4, power: 400, blurb: "The top of the playlist. Bring a plan." },
];
export const RAID_TIERS: readonly Tier[] = [
  { id: "normal", name: "Normal", rank: 0, enemyScale: 1, bossHealthScale: 1, hazardScale: 1, livesDelta: 0, payMult: 1, power: 300, blurb: "The raid as written." },
  { id: "heroic", name: "Heroic", rank: 1, enemyScale: 1.3, bossHealthScale: 1.6, hazardScale: 1.15, livesDelta: -1, payMult: 1.75, power: 400, blurb: "Every encounter is longer and the wipe margin is thinner." },
  { id: "mastery", name: "Mastery", rank: 2, enemyScale: 1.7, bossHealthScale: 2.4, hazardScale: 1.35, livesDelta: -2, payMult: 3, power: 500, blurb: "Cleared Heroic? This is where the raid starts to fight back." },
  { id: "contest", name: "Contest", rank: 3, enemyScale: 2.2, bossHealthScale: 3.4, hazardScale: 1.6, livesDelta: -3, payMult: 5, power: 600, blurb: "The hardest it goes. Few shared lives, long fights, the best payout in the game." },
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
/** the tier applied to an encounter definition: longer stages, a tougher boss, more hazard per step and fewer shared lives */
export function scaleEncounter<D extends EncounterDefinition>(def: D, tier: Tier): D {
  if (tier.rank === 0) return def;
  const stages: EncounterStage[] = def.stages.map((s) => {
    const scale = s.type === "BOSS_FIGHT" ? 1 + (tier.bossHealthScale - 1) * 0.35 : 1 + (tier.enemyScale - 1) * 0.5;
    return { ...s, target: Math.max(s.target, Math.round(s.target * scale)), hazardPerStep: Math.max(1, Math.round((s.hazardPerStep ?? DEFAULT_GAIN[s.type]) * tier.hazardScale)) };
  });
  return { ...def, name: `${def.name} · ${tier.name}`, maxLives: Math.max(1, def.maxLives + tier.livesDelta), stages };
}

/* ------------------------------------------------------------------ weekly rotation */
const WEEK = 7 * 86_400_000, WEEK_ZERO = Date.UTC(2026, 0, 5); // a Monday
export const weekIndex = (now: number) => Math.floor((now - WEEK_ZERO) / WEEK);
export const WEEKLY_STRIKE_BONUS = 1.5, WEEKLY_RAID_BONUS = 1.25;
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
  const gain = (s: EncounterStage) => s.hazardPerStep ?? DEFAULT_GAIN[s.type];
  switch (modId) {
    case "no-revive": return { ...def, noCheckpointRelief: true };
    case "short-fuse": return { ...def, stages: stages((s) => ({ ...s, hazardPerStep: Math.max(1, Math.round(gain(s) * 1.35)) })) };
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
  return challengeTaken ? WEEKLY_RAID_BONUS : 1;
}
