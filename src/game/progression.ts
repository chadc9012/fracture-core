import { EMPTY_LIVING, normalizeLiving, type LivingState } from "./living-world";
import { normalizeNemeses, type Nemesis } from "./nemesis";
import { EMPTY_FLEET, normalizeFleet, type FleetState } from "./fleet";
import { normalizeRecords } from "./wasteland-activities";
import { profileKey } from "./save-profile";
import { EMPTY_STORY, normalizeStory, type StoryState } from "./story";
import { sanitizeActiveMissions, type ActiveMissions } from "./missions/persistence";
import { DEFAULT_BUILD, type ActiveBuild } from "./ability-network";
import type { PlayerCharacter } from "./deployment/deployCharacter";
import { bodyTypeOr, migrateAbilityIds, migrateBranches, migrateBuild } from "./operators";
import { sanitizeTutorial, type TutorialState } from "./onboarding";
import type { VehicleId } from "./vehicles";
import { STARTER_GEAR, STARTER_SLOTS, type GearItem, type GearSlot, type MaterialId } from "./inventory";
import { FIRST_QUEST_ID } from "./quests";
import { safeStorageRead, safeStorageWrite } from "./safe-state";
import { grantXP } from "./xp";
import { repeatRewardFactor, sideRewardFactor } from "./retention";
import { FIRST_CLEAR_SPECIAL, isSideContract } from "./upgrade-gates";
import { backfillCampaignExotics, grantCompletionWeapon } from "./weapon-loot";
import { grantSetPiece } from "./armor-sets";
import { collectionReward } from "./armor-collections";
import type { WeaponId } from "./weapons";
import { normalizeNex, type NexLedger } from "./nex";
import { EMPTY_HOUSING, normalizeHousing, type HousingState } from "./housing";
import { normalizeCondition, type VehicleCondition } from "./vehicle-condition";

export type ClassId = "TITAN" | "HUNTER" | "WARLOCK";
export type WeaponLoadout = { name: string; slots: [WeaponId, WeaponId, WeaponId] };
export type ClassArsenal = { loadouts: WeaponLoadout[]; active: number };
export const DEFAULT_ARSENAL: Record<ClassId, ClassArsenal> = {
  TITAN: { active: 0, loadouts: [{ name: "Breach", slots: ["AUTO", "SHOTGUN", "SWORD"] }, { name: "Bulwark", slots: ["PULSE", "AUTO", "HEAVY"] }] },
  HUNTER: { active: 0, loadouts: [{ name: "Skirmish", slots: ["PULSE", "SWORD", "AUTO"] }, { name: "Overwatch", slots: ["PULSE", "HEAVY", "SWORD"] }] },
  WARLOCK: { active: 0, loadouts: [{ name: "Resonance", slots: ["AUTO", "PULSE", "HEAVY"] }, { name: "Conduit", slots: ["PULSE", "AUTO", "SWORD"] }] },
};
export type MissionReward = { missionId: string; factor: number; firstClear: boolean; xp: number; materials: Partial<Record<MaterialId, number>>; box?: { rarity: "COMMON" | "RARE" | "EPIC"; materials: Partial<Record<MaterialId, number>> } };

/** every mission payout also cracks a loot box; fresher clears roll better boxes (no grind incentive) */
export function missionBox(firstClear: boolean, factor: number): NonNullable<MissionReward["box"]> {
  if (firstClear) return { rarity: "EPIC", materials: { scrapMetal: 8, dataShards: 2, dataChip: 3, relicFragment: 1 } };
  if (factor >= 1) return { rarity: "RARE", materials: { scrapMetal: 5, dataShards: 1, dataChip: 2 } };
  return { rarity: "COMMON", materials: { scrapMetal: 2, dataChip: 1 } };
}

export type PlayerProgression = {
  version: 5;
  completedMissions: string[];
  unlockedAbilities: string[];
  ownedVehicles: VehicleId[];
  selectedVehicle: VehicleId | null;
  garageLoadout: VehicleId[];
  activeBuild: ActiveBuild;
  abilityMastery: Record<string, { xp: number; level: number }>;
  abilityBranches: Record<string, string>;
  calibrationTokens: number;
  fractureShards: number;
  nexLedger: NexLedger;
  vehicleConditions: Record<string, VehicleCondition>;
  identityClass: "TITAN" | "HUNTER" | "WARLOCK" | null;
  /** the last confirmed Identity Forge result (operator, body type, colors, loadout); null on old saves */
  character: PlayerCharacter | null;
  tutorialComplete: boolean;
  /** the opening cinematic has played once for this save; Continue and re-deploys never replay it */
  introSeen: boolean;
  /** first-mission tutorial checkpoint (resumed instead of restarting); null once finished or never started */
  tutorialRun: TutorialState | null;
  /** scripted mission state machines in progress (src/game/missions/persistence.ts); absent in legacy saves */
  activeMissions: ActiveMissions;
  dungeonClears: Record<string, number>;
  earnedRewards: string[];
  /** shared story layer (story.ts): flags, decisions, trust, scenario stages, collected memories; absent in old saves */
  story: StoryState;
  /** Living World (living-world.ts): city faction standing, district outcomes, contracts, revealed intel; absent in old saves */
  living: LivingState;
  /** star-map pre-launch choice (map-activities.ts CHALLENGES); newer copy wins on merge */
  challenge: "STANDARD" | "HARD" | "VERY_HARD";
  /** the regional patrol in progress (map-activities.ts), null when none */
  patrol: { regionId: string; kills: number; need: number; day: string } | null;
  /** nemesis.ts: enemies that killed you and came back (merge by id, SLAIN wins) */
  nemeses: Nemesis[];
  /** fleet.ts: owned fleet builds, garages, tuning and paint */
  fleet: FleetState;
  /** housing.ts: placed decor per home (ownership lives in nexLedger) */
  housing: HousingState;
  /** wasteland-activities.ts: best rally times (lower wins) and arena scores (higher wins) */
  records: Record<string, number>;
  /** foundries.ts: the equipped monoblade (owned blades are `blade:<id>` in earnedRewards) */
  blade: string | null;
  inventory: GearItem[];
  /** stash.ts: ids of inventory gear stored in the vault */
  vaultIds: string[];
  equippedGear: Partial<Record<GearSlot, string>>;
  materials: Partial<Record<MaterialId, number>>;
  /** Cross-world quest engine (src/game/quests.ts) — the persistent story spine, distinct from the AI Director's live per-session missions. */
  activeQuestId: string | null;
  questObjectiveProgress: Record<string, number[]>;
  unlockedWorlds: string[];
  worldFlags: Partial<Record<string, boolean>>;
  currentWorld: string;
  corruptionLevel: number;
  /** has the fd-18 ending screen (EndingOverlay.tsx) already played once? Distinct from completedMissions
   * so a returning player who already finished the campaign never gets it replayed on load. */
  endingSeen: boolean;
  /** Loot + XP System v1 (xp.ts) — overall player level/XP, distinct from per-ability mastery
   * (abilityMastery above). Level-ups fund calibrationTokens directly rather than a separate
   * currency. novaLevel/novaUnlocks track the NOVA meta-progression layer. */
  level: number;
  xp: number;
  novaLevel: number;
  novaUnlocks: string[];
  /** per-mission clears today (repeat taper) */
  missionRuns: Record<string, { day: string; count: number; /** real-time ms of the last completion (activities.ts cooldowns) */ last?: number }>;
  lastMissionReward: MissionReward | null;
  arsenal: Record<ClassId, ClassArsenal>;
};

const STORAGE_KEY_BASE = "world-fracture.progression.v1";
const storageKey = () => profileKey(STORAGE_KEY_BASE); // save-profile.ts: ?dev=1 runs on a separate test profile

/** Every real, physically-walkable region is already open from the start — nothing in this game locks movement. "neon" and "thalassia" are the two narrative-only reveals the quest chain actually unlocks. */
const STARTING_UNLOCKED_WORLDS = ["veridan", "nexus", "wastelands", "solara", "swamps", "frostspire", "ember"];

export const DEFAULT_PROGRESSION: PlayerProgression = {
  version: 5,
  completedMissions: [],
  unlockedAbilities: ["siege-mode", "phase-veil", "recon-swarm"],
  ownedVehicles: [],
  selectedVehicle: null,
  garageLoadout: [],
  activeBuild: DEFAULT_BUILD,
  abilityMastery: {},
  abilityBranches: {},
  calibrationTokens: 3,
  fractureShards: 120,
  nexLedger: {},
  vehicleConditions: {},
  identityClass: null,
  character: null,
  tutorialComplete: false,
  introSeen: false,
  tutorialRun: null,
  activeMissions: {},
  dungeonClears: {},
  earnedRewards: [],
  story: EMPTY_STORY,
  living: EMPTY_LIVING,
  challenge: "STANDARD",
  patrol: null,
  nemeses: [],
  fleet: EMPTY_FLEET,
  housing: EMPTY_HOUSING,
  records: {},
  blade: null,
  inventory: STARTER_GEAR,
  vaultIds: [],
  equippedGear: STARTER_SLOTS,
  materials: {},
  activeQuestId: FIRST_QUEST_ID,
  questObjectiveProgress: {},
  unlockedWorlds: STARTING_UNLOCKED_WORLDS,
  worldFlags: {},
  currentWorld: "veridan",
  corruptionLevel: 0,
  endingSeen: false,
  level: 1,
  xp: 0,
  novaLevel: 0,
  novaUnlocks: [],
  missionRuns: {},
  lastMissionReward: null,
  arsenal: DEFAULT_ARSENAL,
};

export function loadProgression(): PlayerProgression {
  if (typeof window === "undefined") return DEFAULT_PROGRESSION;
  try {
    return normalizeProgression(JSON.parse(safeStorageRead(storageKey()) ?? "null"));
  } catch {
    return DEFAULT_PROGRESSION;
  }
}

/** Migrates any stored save (v1–v4, local or cloud) into the current shape. */
export function normalizeProgression(raw: unknown): PlayerProgression {
  try {
    const parsed = raw as (Partial<Omit<PlayerProgression, "version">> & { version?: number }) | null;
     if (!parsed || (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4 && parsed.version !== 5)) return DEFAULT_PROGRESSION;
    return {
      ...DEFAULT_PROGRESSION,
      ...parsed,
      completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
      unlockedAbilities: Array.isArray(parsed.unlockedAbilities) ? migrateAbilityIds(parsed.unlockedAbilities) : DEFAULT_PROGRESSION.unlockedAbilities,
      activeBuild: parsed.activeBuild && parsed.activeBuild.slots ? migrateBuild(parsed.activeBuild) : DEFAULT_PROGRESSION.activeBuild,
      ownedVehicles: Array.isArray(parsed.ownedVehicles) ? parsed.ownedVehicles : [],
      garageLoadout: Array.isArray(parsed.garageLoadout) ? parsed.garageLoadout : [],
       version: 5,
       inventory: Array.isArray(parsed.inventory) ? parsed.inventory : STARTER_GEAR,
       vaultIds: Array.isArray(parsed.vaultIds) ? parsed.vaultIds : [],
       equippedGear: parsed.equippedGear && typeof parsed.equippedGear === "object" ? parsed.equippedGear : STARTER_SLOTS,
       materials: parsed.materials && typeof parsed.materials === "object" ? parsed.materials : {},
      identityClass: parsed.identityClass === "TITAN" || parsed.identityClass === "HUNTER" || parsed.identityClass === "WARLOCK" ? parsed.identityClass : null,
      character: parsed.character && typeof parsed.character === "object" && typeof parsed.character.operatorId === "string" ? { ...parsed.character, bodyType: bodyTypeOr(parsed.character.bodyType) } : null,
      tutorialComplete: parsed.tutorialComplete === true,
      // saves from before this flag that already progressed have obviously seen the intro
      introSeen: parsed.introSeen === true || parsed.tutorialComplete === true || (Array.isArray(parsed.completedMissions) && parsed.completedMissions.length > 0),
      tutorialRun: parsed.tutorialComplete === true ? null : sanitizeTutorial(parsed.tutorialRun),
      activeMissions: sanitizeActiveMissions(parsed.activeMissions),
      dungeonClears: parsed.dungeonClears && typeof parsed.dungeonClears === "object" ? parsed.dungeonClears : {},
      earnedRewards: Array.isArray(parsed.earnedRewards) ? parsed.earnedRewards : [],
      story: normalizeStory(parsed.story),
      living: normalizeLiving(parsed.living),
      nemeses: normalizeNemeses(parsed.nemeses),
      fleet: normalizeFleet(parsed.fleet),
      housing: normalizeHousing(parsed.housing),
      records: normalizeRecords(parsed.records),
      blade: typeof parsed.blade === "string" ? parsed.blade : null,
      challenge: parsed.challenge === "HARD" || parsed.challenge === "VERY_HARD" ? parsed.challenge : "STANDARD",
      patrol: parsed.patrol && typeof parsed.patrol === "object" && typeof parsed.patrol.regionId === "string" && typeof parsed.patrol.kills === "number" && typeof parsed.patrol.need === "number" && typeof parsed.patrol.day === "string" ? { regionId: parsed.patrol.regionId, kills: parsed.patrol.kills, need: parsed.patrol.need, day: parsed.patrol.day } : null,
      abilityMastery: parsed.abilityMastery && typeof parsed.abilityMastery === "object" ? parsed.abilityMastery : {},
      abilityBranches: parsed.abilityBranches && typeof parsed.abilityBranches === "object" ? migrateBranches(parsed.abilityBranches) : {},
      calibrationTokens: typeof parsed.calibrationTokens === "number" ? parsed.calibrationTokens : 3,
      fractureShards: typeof parsed.fractureShards === "number" ? parsed.fractureShards : 120,
      nexLedger: normalizeNex(parsed.nexLedger),
      vehicleConditions: Object.fromEntries(Object.entries(parsed.vehicleConditions ?? {}).map(([id, c]) => [id, normalizeCondition(c)])),
      activeQuestId: typeof parsed.activeQuestId === "string" || parsed.activeQuestId === null ? parsed.activeQuestId : FIRST_QUEST_ID,
      questObjectiveProgress: parsed.questObjectiveProgress && typeof parsed.questObjectiveProgress === "object" ? parsed.questObjectiveProgress : {},
      unlockedWorlds: Array.isArray(parsed.unlockedWorlds) ? parsed.unlockedWorlds : DEFAULT_PROGRESSION.unlockedWorlds,
      worldFlags: parsed.worldFlags && typeof parsed.worldFlags === "object" ? parsed.worldFlags : {},
      currentWorld: typeof parsed.currentWorld === "string" ? parsed.currentWorld : "veridan",
      corruptionLevel: typeof parsed.corruptionLevel === "number" ? parsed.corruptionLevel : 0,
      endingSeen: parsed.endingSeen === true,
      level: typeof parsed.level === "number" && parsed.level >= 1 ? parsed.level : 1,
      xp: typeof parsed.xp === "number" && parsed.xp >= 0 ? parsed.xp : 0,
      novaLevel: typeof parsed.novaLevel === "number" && parsed.novaLevel >= 0 ? parsed.novaLevel : 0,
      novaUnlocks: Array.isArray(parsed.novaUnlocks) ? parsed.novaUnlocks : [],
      missionRuns: parsed.missionRuns && typeof parsed.missionRuns === "object" ? parsed.missionRuns : {},
      lastMissionReward: parsed.lastMissionReward ?? null,
      arsenal: parsed.arsenal && typeof parsed.arsenal === "object" ? { ...DEFAULT_ARSENAL, ...parsed.arsenal } : DEFAULT_ARSENAL,
    };
  } catch {
    return DEFAULT_PROGRESSION;
  }
}

export function selectAbilityBranch(progression: PlayerProgression, abilityId: string, branchId: string): PlayerProgression {
  if (progression.calibrationTokens < 1) return progression;
  return { ...progression, calibrationTokens: progression.calibrationTokens - 1, abilityBranches: { ...progression.abilityBranches, [abilityId]: branchId } };
}

export function grantAbilityMastery(progression: PlayerProgression, abilityId: string, xp: number): PlayerProgression {
  const current = progression.abilityMastery[abilityId] ?? { xp: 0, level: 1 };
  const nextXp = current.xp + Math.max(0, xp);
  return { ...progression, abilityMastery: { ...progression.abilityMastery, [abilityId]: { xp: nextXp, level: Math.min(5, 1 + Math.floor(nextXp / 250)) } } };
}

export function saveProgression(progression: PlayerProgression) {
  if (typeof window === "undefined") return;
  // Soft-fail: a full quota or a blocked storage API (private-browsing Safari) should mean
  // "this session's progress isn't persisted," never an uncaught throw wherever saveProgression
  // happened to be called from mid-gameplay.
  if (safeStorageWrite(storageKey(), JSON.stringify(progression))) safeStorageWrite(profileKey("world-fracture.progression.savedAt"), new Date().toISOString());
}

export function completeMission(progression: PlayerProgression, missionId: string): PlayerProgression {
  if (progression.completedMissions.includes(missionId)) return progression;
  const { progression: withXp } = grantXP({ ...progression, completedMissions: [...progression.completedMissions, missionId] }, "MISSION");
  return withXp;
}

export function rewardVehicle(progression: PlayerProgression, vehicleId: VehicleId): PlayerProgression {
  const ownedVehicles = progression.ownedVehicles.includes(vehicleId) ? progression.ownedVehicles : [...progression.ownedVehicles, vehicleId];
  const garageLoadout = progression.garageLoadout.includes(vehicleId) ? progression.garageLoadout : [...progression.garageLoadout, vehicleId].slice(-3);
  return { ...progression, ownedVehicles, garageLoadout, selectedVehicle: vehicleId };
}

const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Mission payout: first-ever clear pays 1.5x, repeats pay full for 10 runs a day then taper to 25%. */
/** story missions pay NΞ 1,000 (×1.5 on the first clear): at 100 the whole campaign paid NΞ 1,950 against homes from NΞ 14,000.
 * Now finishing the story affords a first apartment; houses and condos stay longer goals. Replays of story missions never repay
 * (applyMissionCompletion), so this cannot be farmed. */
export const STORY_NEX = 1000;
const STORY_MISSIONS = new Set(["mission-01", "awakening", "broken-signal", "drowned-relay", "blackout-protocol", "stitched-neon-core", "solar-array", "core-node", "frozen-beacon", "failure-core", "convoy-breaker", "descent-protocol", "system-core"]);
export function rewardMission(progression: PlayerProgression, missionId: string, materials: Partial<Record<MaterialId, number>>, now = Date.now()): PlayerProgression {
  const firstClear = !progression.completedMissions.includes(missionId);
  const day = dayKey(now);
  const prev = progression.missionRuns[missionId];
  const runsToday = prev && prev.day === day ? prev.count : 0;
  const factor = isSideContract(missionId) ? sideRewardFactor(runsToday, firstClear) : repeatRewardFactor(runsToday, firstClear);
  const { progression: withXp, gained } = grantXP(progression, "MISSION", { scale: factor });
  const paid: Partial<Record<MaterialId, number>> = {};
  const nextMaterials = { ...withXp.materials };
  for (const [id, n] of Object.entries(materials) as [MaterialId, number][]) {
    const amount = Math.max(1, Math.round(n * factor));
    paid[id] = amount;
    nextMaterials[id] = (nextMaterials[id] ?? 0) + amount;
  }
  // first clear only: the earned upgrade material (and, for main missions, one guaranteed weapon) - repeats never pay these
  if (firstClear) for (const [id, n] of Object.entries(FIRST_CLEAR_SPECIAL(missionId)) as [MaterialId, number][]) nextMaterials[id] = (nextMaterials[id] ?? 0) + n;
  const box = missionBox(firstClear, factor);
  for (const [id, n] of Object.entries(box.materials) as [MaterialId, number][]) nextMaterials[id] = (nextMaterials[id] ?? 0) + n;
  const inventory0 = firstClear && !isSideContract(missionId) && missionId !== "mission-01" ? grantCompletionWeapon(withXp, "mission", missionId).inventory : withXp.inventory;
  // campaign exotics (weapon-loot.ts CAMPAIGN_EXOTIC): this mission's on its first clear, plus any earlier clear's that is missing
  const inventory = backfillCampaignExotics({ inventory: inventory0, completedMissions: firstClear ? [...withXp.completedMissions, missionId] : withXp.completedMissions }).inventory;
  // armor collections: first clear always, repeats every PITY_RUNS-th run (bad-luck protection, never endless grind)
  const drop = collectionReward(isSideContract(missionId) ? "patrol" : "story", missionId, runsToday + 1, firstClear);
  const granted = drop ? grantSetPiece({ ...withXp, inventory }, drop) : null;
  return {
    ...withXp,
    inventory: granted ? granted.progress.inventory : inventory,
    completedMissions: firstClear ? [...withXp.completedMissions, missionId] : withXp.completedMissions,
    materials: nextMaterials,
    nexLedger: { ...withXp.nexLedger, [`mission:${missionId}:${day}:${runsToday + 1}`]: Math.round((STORY_MISSIONS.has(missionId) ? STORY_NEX : 100) * factor) },
    missionRuns: { ...withXp.missionRuns, [missionId]: { day, count: runsToday + 1 } },
    lastMissionReward: { missionId, factor, firstClear, xp: gained, materials: paid, box },
  };
}

export function activeLoadout(progression: PlayerProgression, cls: ClassId | null): WeaponLoadout {
  const a = progression.arsenal[cls ?? "TITAN"] ?? DEFAULT_ARSENAL.TITAN;
  return a.loadouts[a.active] ?? a.loadouts[0]!;
}
