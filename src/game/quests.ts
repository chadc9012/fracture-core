/**
 * Cross-world quest engine — the persistent story spine tying every biome into one chain,
 * per the "Global quest engine" spec: a single Quest shape used identically everywhere,
 * a gameTick(event) that progresses the active quest and rolls world-state forward, and
 * unlockWorld()/updateWorldState() as the two mutators under it.
 *
 * This does NOT duplicate the AI Director (src/game/director.ts, which spawns and runs the
 * live, ephemeral combat missions you fight through each session) or the per-mission state
 * machines (src/game/missions/*, which drive a single scripted encounter). This sits above
 * both: it's the permanent, save-persisted progression thread, so — matching how Wasteland
 * and every other pass this session reused existing save infra — its state lives directly on
 * PlayerProgression rather than a parallel "GameState" object:
 *   - GameState.completedQuests  -> progression.completedMissions (quest ids are just strings,
 *     the same shape "awakening"/"broken-signal"/dungeon ids already use there)
 *   - GameState.activeQuest      -> progression.activeQuestId + QUESTS[id] lookup
 *   - GameState.unlockedWorlds / worldFlags -> progression.unlockedWorlds / worldFlags
 *   - GameState.playerStats.corruptionLevel -> progression.corruptionLevel
 *   - per-objective progress     -> progression.questObjectiveProgress
 * That also means it rides the existing cloud-save union/max merge for free (see cloud-save.ts).
 *
 * Two of this chain's worlds — Neon City and Thalassia — don't have their own physical region
 * yet (world.ts's REGIONS only has the older single "nexus" hub); until they do, their quests
 * are keyed to the real systems already built for them this session (the Neon heat/chase meter
 * in heat.ts, the Nexus stealth/hack meter in stealth.ts, and the underwater diving state in
 * underwater.ts) rather than a place on the map — which also happens to match the lore's own
 * framing of that progression as "descending through reality layers," not walking to a new zone.
 */

import type { MaterialId } from "./inventory";
import type { PlayerProgression } from "./progression";
import type { LockdownTier } from "./stealth";

export type QuestObjectiveType = "ENTER_WORLD" | "KILLS" | "SURVIVE" | "MISSION_COMPLETE" | "DUNGEON_CLEARED" | "BOSS_DEFEATED" | "HEAT_LEVEL" | "LOCKDOWN_TIER" | "HACK_COMPLETE";

export type QuestObjective = {
  type: QuestObjectiveType;
  label: string;
  /** world id / mission id / dungeon id / encounter id this objective keys off, when the type needs one */
  key?: string;
  amount: number;
};

export type Quest = {
  id: string;
  title: string;
  world: string;
  /** one-line narrative beat shown when this quest becomes active — the "Fracture War" story spine, delivered the same lightweight way AwakeningOverlay/BrokenSignalOverlay already show their mission lines */
  line: string;
  objectives: QuestObjective[];
  rewardShards: number;
  rewardMaterials: Partial<Record<MaterialId, number>>;
  /** flips a world flag true on completion — narrative reveal, not a movement gate (nothing in this game locks you out of a region physically) */
  unlocksWorld: string | null;
  nextQuestId: string | null;
  /** how much this quest's completion pushes the world toward its own collapse */
  corruption: number;
};

/** World events real systems already fire (or now fire) into the quest engine. */
export type QuestEvent =
  | { type: "ENTER_WORLD"; world: string }
  | { type: "KILL"; world: string }
  | { type: "SURVIVED"; world: string; seconds: number }
  | { type: "MISSION_COMPLETE"; missionId: string }
  | { type: "DUNGEON_CLEARED"; dungeonId: string }
  | { type: "BOSS_DEFEATED"; encounterId: string }
  | { type: "HEAT_LEVEL"; level: number }
  | { type: "LOCKDOWN_TIER"; tier: LockdownTier }
  | { type: "HACK_COMPLETE" };

export const FIRST_QUEST_ID = "fd-01";

/** "The Fracture Descent" — the named 20-mission arc from the spec, laid over the real order
 *  the lore settled on (Veridant -> Swamps -> Neon -> Solara -> Nexus -> Frostspire -> Ember ->
 *  Wastelands -> Thalassia). Connector-zone mini-arcs (Swamps/Solara/Frostspire) are collapsed
 *  into one gate quest each rather than four filler missions apiece. */
export const QUESTS: Record<string, Quest> = {
  "fd-01": {
    id: "fd-01", title: "Awakening", world: "veridan",
    line: "You wake in a fractured forest with no memory of arriving — only a signal, pulling.",
    objectives: [{ type: "MISSION_COMPLETE", label: "Complete the Awakening sequence", key: "awakening", amount: 1 }],
    rewardShards: 150, rewardMaterials: { dataShards: 2 }, unlocksWorld: null, nextQuestId: "fd-02", corruption: 0.5,
  },
  "fd-02": {
    id: "fd-02", title: "First Resonance", world: "veridan",
    line: "The forest's wildlife is fractured too — corrupted, aggressive, and drawn to you specifically.",
    objectives: [{ type: "KILLS", label: "Clear the forest patrols", key: "veridan", amount: 5 }],
    rewardShards: 150, rewardMaterials: { sporeFiber: 3 }, unlocksWorld: null, nextQuestId: "fd-03", corruption: 0.5,
  },
  "fd-03": {
    id: "fd-03", title: "Broken Signal", world: "veridan",
    line: "The signal isn't natural. Something built it, and it wants you to find the source.",
    objectives: [{ type: "MISSION_COMPLETE", label: "Trace the corrupted signal", key: "broken-signal", amount: 1 }],
    rewardShards: 200, rewardMaterials: { dataShards: 3 }, unlocksWorld: null, nextQuestId: "fd-04", corruption: 1,
  },
  "fd-04": {
    id: "fd-04", title: "Into the Shrouded Swamps", world: "veridan",
    line: "The treeline ends where the fog begins — the Shrouded Swamps, the forest's corrupted twin.",
    objectives: [{ type: "ENTER_WORLD", label: "Leave the treeline behind", key: "swamps", amount: 1 }],
    rewardShards: 120, rewardMaterials: {}, unlocksWorld: null, nextQuestId: "fd-05", corruption: 0.5,
  },
  "fd-05": {
    id: "fd-05", title: "Crossing the Shrouded Swamps", world: "swamps",
    line: "Bio-tech mutation thick enough to breathe. Something in the reeds is watching you cross.",
    // index 0 stays the survive timer so saves already part-way through fd-05 keep their progress
    objectives: [
      { type: "SURVIVE", label: "Hold out in the fog (s)", key: "swamps", amount: 90 },
      { type: "MISSION_COMPLETE", label: "Purge the Drowned Relay", key: "drowned-relay", amount: 1 },
    ],
    rewardShards: 260, rewardMaterials: { bioCatalyst: 3 }, unlocksWorld: null, nextQuestId: "fd-06", corruption: 2,
  },
  "fd-06": {
    id: "fd-06", title: "Signals in the Static", world: "neon",
    line: "Neon City: the Syndicate's corporate war-machine, sold as civilization. You just tripped a wire.",
    objectives: [
      { type: "MISSION_COMPLETE", label: "Pull off the Blackout Protocol", key: "blackout-protocol", amount: 1 },
      { type: "HEAT_LEVEL", label: "Draw real heat for the first time", key: "3", amount: 1 },
    ],
    rewardShards: 220, rewardMaterials: { microCircuits: 4 }, unlocksWorld: null, nextQuestId: "fd-07", corruption: 2,
  },
  "fd-07": {
    id: "fd-07", title: "Full Lockdown", world: "neon",
    line: "Full lockdown. Every drone in the district is hunting one signature — a Resonant Carrier. You.",
    objectives: [
      { type: "MISSION_COMPLETE", label: "Breach the Stitched Neon Core", key: "stitched-neon-core", amount: 1 },
      { type: "HEAT_LEVEL", label: "Force the city into full lockdown", key: "5", amount: 1 },
    ],
    rewardShards: 320, rewardMaterials: { microCircuits: 6 }, unlocksWorld: "neon", nextQuestId: "fd-08", corruption: 3,
  },
  "fd-08": {
    id: "fd-08", title: "The Desert Approach", world: "solara",
    line: "Solara's Glass Flats — old energy-harvesting ruins baking under a sky that never cools.",
    objectives: [{ type: "SURVIVE", label: "Cross the Glass Flats (s)", key: "solara", amount: 90 }],
    rewardShards: 260, rewardMaterials: { anomalyCarbon: 3 }, unlocksWorld: null, nextQuestId: "fd-09", corruption: 2,
  },
  "fd-09": {
    id: "fd-09", title: "Protocol Breach", world: "nexus",
    line: "Nexus City — the Authority's control layer. They don't police chaos here. They erase it.",
    objectives: [{ type: "HACK_COMPLETE", label: "Breach the Core Node terminal", amount: 1 }],
    rewardShards: 280, rewardMaterials: { dataShards: 5 }, unlocksWorld: null, nextQuestId: "fd-10", corruption: 2,
  },
  "fd-10": {
    id: "fd-10", title: "Sector Lockdown", world: "nexus",
    line: "The Authority doesn't believe in coincidence. A full sector purge, just for you.",
    objectives: [{ type: "LOCKDOWN_TIER", label: "Survive a full sector lockdown", key: "LOCKDOWN_PURGE", amount: 1 }],
    rewardShards: 340, rewardMaterials: { dataShards: 6 }, unlocksWorld: null, nextQuestId: "fd-11", corruption: 3,
  },
  "fd-11": {
    id: "fd-11", title: "Ember's Warning", world: "frostspire",
    line: "Frostspire — the isolation zone. The cold here doesn't just kill you, it makes you forget why you came.",
    objectives: [{ type: "SURVIVE", label: "Traverse the high passes (s)", key: "frostspire", amount: 90 }],
    rewardShards: 260, rewardMaterials: { cryoCrystal: 3 }, unlocksWorld: null, nextQuestId: "fd-12", corruption: 2,
  },
  "fd-12": {
    id: "fd-12", title: "Core Fragment Recovery", world: "ember",
    line: "Ember Peaks: a reactor zone forged by war, still burning long after whatever it was built to stop.",
    objectives: [{ type: "KILLS", label: "Clear the caldera drones", key: "ember", amount: 8 }],
    rewardShards: 300, rewardMaterials: { thermalShards: 4 }, unlocksWorld: null, nextQuestId: "fd-13", corruption: 3,
  },
  "fd-13": {
    id: "fd-13", title: "The Failure Core", world: "ember",
    line: "This is where containment failed the first time. It's about to fail again, with you inside it.",
    objectives: [{ type: "SURVIVE", label: "Hold through a reality-breakdown spike (s)", key: "ember", amount: 60 }],
    rewardShards: 340, rewardMaterials: { thermalShards: 6 }, unlocksWorld: null, nextQuestId: "fd-14", corruption: 4,
  },
  "fd-14": {
    id: "fd-14", title: "Grid-Iron Highway", world: "wastelands",
    line: "The Wasteland Rebellion holds the highway — scavengers running stolen Fracture tech against everyone.",
    objectives: [{ type: "KILLS", label: "Break Raider control of the highway", key: "wastelands", amount: 10 }],
    rewardShards: 300, rewardMaterials: { scrapMetal: 6 }, unlocksWorld: null, nextQuestId: "fd-15", corruption: 3,
  },
  "fd-15": {
    id: "fd-15", title: "The Fuel King", world: "wastelands",
    line: "The Fuel King doesn't answer to the Rebellion or the Authority. He answers to whoever's still standing.",
    objectives: [{ type: "BOSS_DEFEATED", label: "Break the Fuel King", key: "wasteland-fuel-king", amount: 1 }],
    rewardShards: 500, rewardMaterials: { reinforcedAlloy: 10 }, unlocksWorld: null, nextQuestId: "fd-16", corruption: 5,
  },
  "fd-16": {
    id: "fd-16", title: "Descent Protocol", world: "thalassia",
    line: "Beneath the waves: Thalassia, the Deepmind's ark-city, sealed since before the Fracture had a name.",
    objectives: [
      { type: "MISSION_COMPLETE", label: "Trace the signal to the control core", key: "descent-protocol", amount: 1 },
      { type: "SURVIVE", label: "Time spent diving (s)", key: "thalassia-dive", amount: 60 },
    ],
    rewardShards: 320, rewardMaterials: {}, unlocksWorld: "thalassia", nextQuestId: "fd-17", corruption: 4,
  },
  "fd-17": {
    id: "fd-17", title: "Thalassia", world: "thalassia",
    line: "The Deepmind built the original Fracture tech. It wants to finish what it started — with or without you.",
    objectives: [{ type: "SURVIVE", label: "Deep-pressure dive time (s)", key: "thalassia-dive", amount: 180 }],
    rewardShards: 400, rewardMaterials: { abyssCore: 1 }, unlocksWorld: null, nextQuestId: "fd-18", corruption: 6,
  },
  "fd-18": {
    id: "fd-18", title: "The System Core", world: "thalassia",
    line: "Every layer of this broken reality answers to one system. You've finally reached it.",
    objectives: [{ type: "BOSS_DEFEATED", label: "Confront the System Core", key: "system-core", amount: 1 }],
    rewardShards: 1000, rewardMaterials: { zeroCore: 1 }, unlocksWorld: null, nextQuestId: null, corruption: 10,
  },
};

function mergeMaterials(base: Partial<Record<MaterialId, number>>, add: Partial<Record<MaterialId, number>>): Partial<Record<MaterialId, number>> {
  const out: Partial<Record<MaterialId, number>> = { ...base };
  for (const key of Object.keys(add) as MaterialId[]) out[key] = (out[key] ?? 0) + (add[key] ?? 0);
  return out;
}

/** How much a single QuestEvent advances one objective, 0 if it doesn't match at all. */
function objectiveDelta(objective: QuestObjective, event: QuestEvent): number {
  switch (objective.type) {
    case "ENTER_WORLD": return event.type === "ENTER_WORLD" && event.world === objective.key ? 1 : 0;
    case "KILLS": return event.type === "KILL" && event.world === objective.key ? 1 : 0;
    case "SURVIVE": return event.type === "SURVIVED" && event.world === objective.key ? event.seconds : 0;
    case "MISSION_COMPLETE": return event.type === "MISSION_COMPLETE" && event.missionId === objective.key ? objective.amount : 0;
    case "DUNGEON_CLEARED": return event.type === "DUNGEON_CLEARED" && event.dungeonId === objective.key ? objective.amount : 0;
    case "BOSS_DEFEATED": return event.type === "BOSS_DEFEATED" && event.encounterId === objective.key ? objective.amount : 0;
    case "HEAT_LEVEL": return event.type === "HEAT_LEVEL" && event.level >= Number(objective.key ?? 0) ? objective.amount : 0;
    case "LOCKDOWN_TIER": return event.type === "LOCKDOWN_TIER" && event.tier === objective.key ? objective.amount : 0;
    case "HACK_COMPLETE": return event.type === "HACK_COMPLETE" ? objective.amount : 0;
    default: return 0;
  }
}

export function activeQuest(progression: PlayerProgression): Quest | null {
  return progression.activeQuestId ? QUESTS[progression.activeQuestId] ?? null : null;
}

export function objectiveProgress(progression: PlayerProgression, questId: string, index: number): number {
  return progression.questObjectiveProgress[questId]?.[index] ?? 0;
}

export function unlockWorld(progression: PlayerProgression, world: string): PlayerProgression {
  if (progression.unlockedWorlds.includes(world)) return progression;
  return { ...progression, unlockedWorlds: [...progression.unlockedWorlds, world], worldFlags: { ...progression.worldFlags, [world]: true } };
}

const CORRUPTION_PER_KILL = 0.1;
const CORRUPTION_PER_BOSS = 5;
const WASTELAND_CORRUPTION_THRESHOLD = 45;

/** Raises world corruption off live events (independent of quest completion — see gameTick's own corruption bump) and auto-unlocks the Wastelands once corruption is high enough, per the spec's "runaway system" framing. */
export function updateWorldState(progression: PlayerProgression, event: QuestEvent): PlayerProgression {
  let corruptionLevel = progression.corruptionLevel;
  if (event.type === "KILL") corruptionLevel += CORRUPTION_PER_KILL;
  if (event.type === "BOSS_DEFEATED") corruptionLevel += CORRUPTION_PER_BOSS;
  corruptionLevel = Math.min(100, corruptionLevel);
  let next: PlayerProgression = corruptionLevel === progression.corruptionLevel ? progression : { ...progression, corruptionLevel };
  if (corruptionLevel >= WASTELAND_CORRUPTION_THRESHOLD && !next.unlockedWorlds.includes("wastelands")) next = unlockWorld(next, "wastelands");
  return next;
}

/** Rewards a finished quest and advances the chain. Guarded so a quest can never pay out twice. */
function completeQuest(progression: PlayerProgression, quest: Quest): PlayerProgression {
  if (progression.completedMissions.includes(quest.id)) return progression;
  let next: PlayerProgression = {
    ...progression,
    completedMissions: [...progression.completedMissions, quest.id],
    fractureShards: progression.fractureShards + quest.rewardShards,
    materials: mergeMaterials(progression.materials, quest.rewardMaterials),
    corruptionLevel: Math.min(100, progression.corruptionLevel + quest.corruption),
    activeQuestId: quest.nextQuestId,
    currentWorld: quest.world,
  };
  if (quest.unlocksWorld) next = unlockWorld(next, quest.unlocksWorld);
  return next;
}

/** Has the game already persisted proof that this objective's one-off event happened? Missions are
 * recorded in `completedMissions`; dungeon/raid clears in `dungeonClears`. Counters (kills, survive
 * time) and region entry have no such record and are never back-filled. */
export function objectiveAlreadyDone(progression: PlayerProgression, objective: QuestObjective): boolean {
  const key = objective.key;
  if (!key) return false;
  switch (objective.type) {
    case "MISSION_COMPLETE": return progression.completedMissions.includes(key);
    case "DUNGEON_CLEARED":
    case "BOSS_DEFEATED": return (progression.dungeonClears?.[key] ?? 0) > 0 || progression.completedMissions.includes(key);
    default: return false;
  }
}

/** Event ledger: credits the active quest with scripted missions / clears the player already finished
 * before the quest became active (missions are gated by each other, not by the quest chain, so their
 * one-time completion event can arrive early and used to be dropped). Cascades down the chain, never
 * pays twice, and repairs saves that are already stuck. */
export function reconcileQuests(progression: PlayerProgression): PlayerProgression {
  let next = progression;
  for (let guard = 0; guard <= Object.keys(QUESTS).length; guard++) {
    const quest = activeQuest(next);
    if (!quest) break;
    const prior = next.questObjectiveProgress[quest.id] ?? quest.objectives.map(() => 0);
    const updated = quest.objectives.map((o, i) => (objectiveAlreadyDone(next, o) ? o.amount : prior[i] ?? 0));
    if (updated.some((v, i) => v !== (prior[i] ?? 0))) next = { ...next, questObjectiveProgress: { ...next.questObjectiveProgress, [quest.id]: updated } };
    if (!quest.objectives.every((o, i) => (updated[i] ?? 0) >= o.amount)) break;
    next = completeQuest(next, quest);
  }
  return next;
}

/**
 * The single loop: progress the active quest off this event, and on completion reward it,
 * advance to nextQuestId, unlock a world if flagged — then reconcile against persisted completions
 * and always let updateWorldState run.
 */
export function gameTick(progression: PlayerProgression, event: QuestEvent): PlayerProgression {
  let next = progression;
  const quest = activeQuest(next);
  if (quest) {
    const prior = next.questObjectiveProgress[quest.id] ?? quest.objectives.map(() => 0);
    const updated = quest.objectives.map((objective, i) => Math.min(objective.amount, (prior[i] ?? 0) + objectiveDelta(objective, event)));
    if (updated.some((value, i) => value !== (prior[i] ?? 0))) {
      next = { ...next, questObjectiveProgress: { ...next.questObjectiveProgress, [quest.id]: updated } };
    }
    if (quest.objectives.every((objective, i) => (updated[i] ?? 0) >= objective.amount)) next = completeQuest(next, quest);
  }
  return updateWorldState(reconcileQuests(next), event);
}

/** True when applying `events` would change nothing AND every event is the continuous SURVIVED slice. GameCanvas skips the setState in that case:
 * calling setProgression with an updater that returns the same object still makes React re-render GameCanvas (and Scene) before bailing out, and the
 * survive slice fires on every HUD snapshot. One-shot events (KILL, HACK, ENTER_WORLD, ...) are never skipped, so no quest event can be lost. */
export function survivalTickIsNoop(progression: PlayerProgression, events: readonly QuestEvent[]): boolean {
  if (!events.length || !events.every((e) => e.type === "SURVIVED")) return false;
  return events.reduce((p, e) => gameTick(p, e), progression) === progression;
}
