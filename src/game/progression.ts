import { DEFAULT_BUILD, type ActiveBuild } from "./ability-network";
import type { VehicleId } from "./vehicles";
import { STARTER_GEAR, STARTER_SLOTS, type GearItem, type GearSlot, type MaterialId } from "./inventory";
import { FIRST_QUEST_ID } from "./quests";
import { safeStorageRead, safeStorageWrite } from "./safe-state";
import { grantXP } from "./xp";

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
  identityClass: "TITAN" | "HUNTER" | "WARLOCK" | null;
  tutorialComplete: boolean;
  dungeonClears: Record<string, number>;
  earnedRewards: string[];
  inventory: GearItem[];
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
};

const STORAGE_KEY = "world-fracture.progression.v1";

/** Every real, physically-walkable region is already open from the start — nothing in this game locks movement. "neon" and "thalassia" are the two narrative-only reveals the quest chain actually unlocks. */
const STARTING_UNLOCKED_WORLDS = ["veridan", "nexus", "wastelands", "solara", "swamps", "frostspire", "ember"];

export const DEFAULT_PROGRESSION: PlayerProgression = {
  version: 5,
  completedMissions: [],
  unlockedAbilities: ["fracture-shield", "phase-dash", "code-pulse"],
  ownedVehicles: [],
  selectedVehicle: null,
  garageLoadout: [],
  activeBuild: DEFAULT_BUILD,
  abilityMastery: {},
  abilityBranches: {},
  calibrationTokens: 3,
  fractureShards: 120,
  identityClass: null,
  tutorialComplete: false,
  dungeonClears: {},
  earnedRewards: [],
  inventory: STARTER_GEAR,
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
};

export function loadProgression(): PlayerProgression {
  if (typeof window === "undefined") return DEFAULT_PROGRESSION;
  try {
    return normalizeProgression(JSON.parse(safeStorageRead(STORAGE_KEY) ?? "null"));
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
      unlockedAbilities: Array.isArray(parsed.unlockedAbilities) ? parsed.unlockedAbilities : DEFAULT_PROGRESSION.unlockedAbilities,
      ownedVehicles: Array.isArray(parsed.ownedVehicles) ? parsed.ownedVehicles : [],
      garageLoadout: Array.isArray(parsed.garageLoadout) ? parsed.garageLoadout : [],
       version: 5,
       inventory: Array.isArray(parsed.inventory) ? parsed.inventory : STARTER_GEAR,
       equippedGear: parsed.equippedGear && typeof parsed.equippedGear === "object" ? parsed.equippedGear : STARTER_SLOTS,
       materials: parsed.materials && typeof parsed.materials === "object" ? parsed.materials : {},
      identityClass: parsed.identityClass === "TITAN" || parsed.identityClass === "HUNTER" || parsed.identityClass === "WARLOCK" ? parsed.identityClass : null,
      tutorialComplete: parsed.tutorialComplete === true,
      dungeonClears: parsed.dungeonClears && typeof parsed.dungeonClears === "object" ? parsed.dungeonClears : {},
      earnedRewards: Array.isArray(parsed.earnedRewards) ? parsed.earnedRewards : [],
      abilityMastery: parsed.abilityMastery && typeof parsed.abilityMastery === "object" ? parsed.abilityMastery : {},
      abilityBranches: parsed.abilityBranches && typeof parsed.abilityBranches === "object" ? parsed.abilityBranches : {},
      calibrationTokens: typeof parsed.calibrationTokens === "number" ? parsed.calibrationTokens : 3,
      fractureShards: typeof parsed.fractureShards === "number" ? parsed.fractureShards : 120,
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
  if (safeStorageWrite(STORAGE_KEY, JSON.stringify(progression))) safeStorageWrite("world-fracture.progression.savedAt", new Date().toISOString());
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