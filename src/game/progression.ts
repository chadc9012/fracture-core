import { DEFAULT_BUILD, type ActiveBuild } from "./ability-network";
import type { VehicleId } from "./vehicles";

export type PlayerProgression = {
  version: 2;
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
};

const STORAGE_KEY = "world-fracture.progression.v1";

export const DEFAULT_PROGRESSION: PlayerProgression = {
  version: 2,
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
};

export function loadProgression(): PlayerProgression {
  if (typeof window === "undefined") return DEFAULT_PROGRESSION;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<PlayerProgression> | null;
    if (!parsed || (parsed.version !== 1 && parsed.version !== 2)) return DEFAULT_PROGRESSION;
    return {
      ...DEFAULT_PROGRESSION,
      ...parsed,
      completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
      unlockedAbilities: Array.isArray(parsed.unlockedAbilities) ? parsed.unlockedAbilities : DEFAULT_PROGRESSION.unlockedAbilities,
      ownedVehicles: Array.isArray(parsed.ownedVehicles) ? parsed.ownedVehicles : [],
      garageLoadout: Array.isArray(parsed.garageLoadout) ? parsed.garageLoadout : [],
      version: 2,
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
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progression));
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