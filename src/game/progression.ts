import { DEFAULT_BUILD, type ActiveBuild } from "./ability-network";
import type { VehicleId } from "./vehicles";
import { STARTER_GEAR, STARTER_SLOTS, type GearItem, type GearSlot, type MaterialId } from "./inventory";

export type PlayerProgression = {
  version: 4;
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
};

const STORAGE_KEY = "world-fracture.progression.v1";

export const DEFAULT_PROGRESSION: PlayerProgression = {
  version: 4,
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
};

export function loadProgression(): PlayerProgression {
  if (typeof window === "undefined") return DEFAULT_PROGRESSION;
  try {
    return normalizeProgression(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return DEFAULT_PROGRESSION;
  }
}

/** Migrates any stored save (v1–v3, local or cloud) into the current shape. */
export function normalizeProgression(raw: unknown): PlayerProgression {
  try {
    const parsed = raw as (Partial<Omit<PlayerProgression, "version">> & { version?: number }) | null;
     if (!parsed || (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4)) return DEFAULT_PROGRESSION;
    return {
      ...DEFAULT_PROGRESSION,
      ...parsed,
      completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
      unlockedAbilities: Array.isArray(parsed.unlockedAbilities) ? parsed.unlockedAbilities : DEFAULT_PROGRESSION.unlockedAbilities,
      ownedVehicles: Array.isArray(parsed.ownedVehicles) ? parsed.ownedVehicles : [],
      garageLoadout: Array.isArray(parsed.garageLoadout) ? parsed.garageLoadout : [],
       version: 4,
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
  if (typeof window !== "undefined") { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progression)); window.localStorage.setItem("world-fracture.progression.savedAt", new Date().toISOString()); }
}

export function completeMission(progression: PlayerProgression, missionId: string): PlayerProgression {
  if (progression.completedMissions.includes(missionId)) return progression;
  return { ...progression, completedMissions: [...progression.completedMissions, missionId] };
}

export function rewardVehicle(progression: PlayerProgression, vehicleId: VehicleId): PlayerProgression {
  const ownedVehicles = progression.ownedVehicles.includes(vehicleId) ? progression.ownedVehicles : [...progression.ownedVehicles, vehicleId];
  const garageLoadout = progression.garageLoadout.includes(vehicleId) ? progression.garageLoadout : [...progression.garageLoadout, vehicleId].slice(-3);
  return { ...progression, ownedVehicles, garageLoadout, selectedVehicle: vehicleId };
}