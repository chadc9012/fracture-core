import { resolveSynergyEffects } from "./combat-engine";
import type { ActiveBuild } from "./ability-network";
import type { ClassId } from "./loadout";
import type { DungeonDefinition } from "./dungeons";

export type DungeonModifier = { name: string; effect: string; hazardShift: number; enemyResponse: string; rewardTag: string };
export function dungeonModifiers(dungeon: DungeonDefinition, classId: ClassId, build: ActiveBuild): DungeonModifier[] {
  const mods: DungeonModifier[] = [
    classId === "TITAN" ? { name: "Siege Protocol", effect: "Cover anchors absorb hazard pressure; defenders advance in groups.", hazardShift: -2, enemyResponse: "Melee pressure and shield timing feints", rewardTag: "DEFENSE" }
      : classId === "HUNTER" ? { name: "Velocity Protocol", effect: "Timed routes open; hazards pulse more often and flankers spread out.", hazardShift: 2, enemyResponse: "Predictive tracking and flank routes", rewardTag: "MOBILITY" }
        : { name: "System Override", effect: "Hidden nodes and hack routes appear; corruption can be stabilized.", hazardShift: 1, enemyResponse: "Node guards and anti-hack pulses", rewardTag: "SYSTEM" },
  ];
  const synergy = resolveSynergyEffects(Object.values(build.slots));
  if (synergy.damageMultiplier > 1.1) mods.push({ name: "Cross-Class Resonance", effect: "Linked abilities expose alternate paths and stagger windows.", hazardShift: -1, enemyResponse: "Mixed counter patterns", rewardTag: "CONTROL" });
  if (dungeon.region.includes("Frost")) mods.push({ name: "Frost Shock", effect: "Exposure slows movement; shield recovery increases.", hazardShift: 1, enemyResponse: "Thermal vent denial", rewardTag: "STABILITY" });
  if (dungeon.region.includes("Solara")) mods.push({ name: "Sand Entombment", effect: "Buried paths shift as pressure rises.", hazardShift: 1, enemyResponse: "Sightline suppression", rewardTag: "BURST" });
  return mods;
}