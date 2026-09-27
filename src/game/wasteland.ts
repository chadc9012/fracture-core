import type { PlayerProgression } from "./progression";
import { collectDrop } from "./inventory";

/**
 * The Wasteland playable loop: Surface (raid + gather fuel) -> Underground City
 * (safe hub, no combat) -> Northwest Vault Dungeons -> Northwest boss gate -> The Fuel King.
 *
 * This reuses the existing encounter catalog (src/game/dungeons.ts) and progression
 * fields rather than inventing a parallel save-schema: `dungeonClears` already tracks
 * per-encounter completion counts, and `materials.fuel` is the fuel-control resource.
 */

/** The three existing dungeons that count toward "dungeonsCleared" for the Wasteland boss gate. */
export const WASTELAND_GATE_DUNGEONS = ["arcology_vaults", "glacial-crevasse", "temple-echoes"] as const;

export const FUEL_KING_ENCOUNTER_ID = "wasteland-fuel-king";

/** Fuel control reads as a percentage against a fixed reserve target (matches the "fuelControl >= 70%" design spec). */
const FUEL_CONTROL_TARGET = 300;

export function fuelControlPercent(progression: PlayerProgression): number {
  const fuel = progression.materials.fuel ?? 0;
  return Math.max(0, Math.min(100, Math.round((fuel / FUEL_CONTROL_TARGET) * 100)));
}

export function dungeonsClearedForGate(progression: PlayerProgression): number {
  return WASTELAND_GATE_DUNGEONS.filter((id) => (progression.dungeonClears[id] ?? 0) > 0).length;
}

/** Northwest Exit — Boss Gate System: `IF fuelControl >= 70% AND dungeonsCleared >= 3 THEN openBossGate()`. */
export function canOpenFuelKingGate(progression: PlayerProgression): boolean {
  return fuelControlPercent(progression) >= 70 && dungeonsClearedForGate(progression) >= WASTELAND_GATE_DUNGEONS.length;
}

export function fuelKingGateStatus(progression: PlayerProgression): { open: boolean; fuelControl: number; dungeonsCleared: number; dungeonsRequired: number } {
  return {
    open: canOpenFuelKingGate(progression),
    fuelControl: fuelControlPercent(progression),
    dungeonsCleared: dungeonsClearedForGate(progression),
    dungeonsRequired: WASTELAND_GATE_DUNGEONS.length,
  };
}

/** Surface loop: convoy raids and resource gathering feed the fuel-control meter. */
export function gatherWastelandFuel(progression: PlayerProgression, amount: number): PlayerProgression {
  return collectDrop(progression, "fuel", amount);
}

/** Underground City Fuel Depot: `buyFuel` — spends scrap for fuel, refilling the control meter. */
export function buyFuelAtDepot(progression: PlayerProgression, fuelAmount: number): PlayerProgression {
  const scrapCost = fuelAmount * 2;
  const scrap = progression.materials.scrapMetal ?? 0;
  if (scrap < scrapCost) return progression;
  const spent: PlayerProgression = { ...progression, materials: { ...progression.materials, scrapMetal: scrap - scrapCost } };
  return collectDrop(spent, "fuel", fuelAmount);
}

export type WastelandWorldState = { factionControlReduced: boolean; fastTravelUnlocked: boolean; tradeValueMultiplier: number };

/**
 * Global impact once the Fuel King falls: `reduceFactionControl() / unlockFastTravel() /
 * increaseUndergroundTradeValue()`. Derived (not stored) from the existing dungeonClears
 * record so there's no new save field to migrate.
 */
export function wastelandWorldState(progression: PlayerProgression): WastelandWorldState {
  const defeated = (progression.dungeonClears[FUEL_KING_ENCOUNTER_ID] ?? 0) > 0;
  return { factionControlReduced: defeated, fastTravelUnlocked: defeated, tradeValueMultiplier: defeated ? 1.35 : 1 };
}

/** Reward hook for claiming the Fuel King's encounter (mirrors the other named-boss core drops in inventory.ts). */
export function grantFuelKingVictoryRewards(progression: PlayerProgression): PlayerProgression {
  return collectDrop(collectDrop(progression, "fuelKingCore", 1), "reinforcedAlloy", 200);
}
