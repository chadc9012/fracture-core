/* RAID DROP SYSTEM v1 — bosses own their loot. Exotics are rule-breaking
 * mechanics tied to boss identity; performance (phases, deaths, speed)
 * scales which drops and variants unlock. Pure + testable. */
import type { LootItem } from "./loot";

export type RaidFamily = "VOID_TITAN" | "NEON_ARCHON" | "MECH_OVERSEER" | "REALITY_FRACTURE";
type Exotic = { name: string; slot: "WEAPON" | "ARMOR"; mechanic: string };

export const RAID_TABLES: Record<RaidFamily, { theme: string; exotics: Exotic[]; mythic: Exotic }> = {
  VOID_TITAN: {
    theme: "Gravity, collapse, space distortion",
    exotics: [
      { name: "Gravity Lance", slot: "WEAPON", mechanic: "Bullets pull enemies together; final shot triggers a collapse explosion" },
      { name: "Event Horizon Rifle", slot: "WEAPON", mechanic: "Black-hole rounds drag enemies to the impact center" },
      { name: "Null Core Cannon", slot: "WEAPON", mechanic: "Void zones erase shields and silence enemy abilities" },
    ],
    mythic: { name: "Entropy Shell", slot: "ARMOR", mechanic: "Resist gravity effects; bonus damage inside void zones" },
  },
  NEON_ARCHON: {
    theme: "Energy overload, light manipulation, cyber warfare",
    exotics: [
      { name: "Prism Breaker", slot: "WEAPON", mechanic: "Rounds split into light shards that ricochet between enemies" },
      { name: "Lumin Shift Carbine", slot: "WEAPON", mechanic: "Element cycles arc → fire → kinetic with each kill streak" },
      { name: "Neon God Hand", slot: "WEAPON", mechanic: "Melee swings fire energy pulses" },
    ],
    mythic: { name: "Photon Weave Suit", slot: "ARMOR", mechanic: "Taking damage raises move speed; reactive glow shield" },
  },
  MECH_OVERSEER: {
    theme: "Technology, drones, AI swarm control",
    exotics: [
      { name: "Swarm Commander", slot: "WEAPON", mechanic: "Each kill summons an allied drone" },
      { name: "Corelink Minigun", slot: "WEAPON", mechanic: "Damage climbs the longer you stay aimed" },
      { name: "Overclock Shotgun", slot: "WEAPON", mechanic: "Fire rate increases until you reload" },
    ],
    mythic: { name: "Titan Mesh Frame", slot: "ARMOR", mechanic: "Drone resistance and hacking immunity" },
  },
  REALITY_FRACTURE: {
    theme: "Time distortion, broken physics",
    exotics: [
      { name: "Broken Second Rifle", slot: "WEAPON", mechanic: "Hits rewind the target a moment in time" },
      { name: "Fracture Edge Blade", slot: "WEAPON", mechanic: "Melee attacks leave time echoes that strike again" },
      { name: "Null Memory", slot: "WEAPON", mechanic: "Hit enemies forget your location" },
    ],
    mythic: { name: "Temporal Drift Suit", slot: "ARMOR", mechanic: "Dodges leave time clones; less damage while moving" },
  },
};

/** Region bosses map onto the four raid loot families. */
const REGION_FAMILY: Record<string, RaidFamily> = {
  ember: "VOID_TITAN", wastelands: "MECH_OVERSEER", nexus: "NEON_ARCHON", swamps: "REALITY_FRACTURE", frostspire: "REALITY_FRACTURE", veridan: "VOID_TITAN", solara: "MECH_OVERSEER",
};
export const familyFor = (regionId: string): RaidFamily => REGION_FAMILY[regionId] ?? (Object.keys(REGION_FAMILY).find((k) => regionId.includes(k)) ? REGION_FAMILY[Object.keys(REGION_FAMILY).find((k) => regionId.includes(k))!]! : "REALITY_FRACTURE");

export type RaidPerformance = { phasesCleared: number; damageTaken: number; seconds: number };

/** Loot reacts to skill, not RNG alone. */
export function scaleLoot(p: RaidPerformance): number {
  let modifier = 1;
  if (p.damageTaken < 25) modifier += 0.5; // flawless-ish
  if (p.seconds < 60) modifier += 0.3; // high DPS
  return modifier;
}

const VARIANTS = ["Collapsed", "Overcharged", "Echoing"];

export function rollRaidDrop(family: RaidFamily, p: RaidPerformance, rng: () => number = Math.random): LootItem[] {
  const table = RAID_TABLES[family];
  const mod = scaleLoot(p);
  const exotic = table.exotics[Math.floor(rng() * table.exotics.length)]!;
  const variant = p.phasesCleared >= 3 && rng() < 0.35 * mod ? VARIANTS[Math.floor(rng() * VARIANTS.length)] : null;
  const perk = p.phasesCleared >= 2;
  const drops: LootItem[] = [{
    name: variant ? `${exotic.name} · ${variant}` : exotic.name,
    slot: exotic.slot, rarity: "EXOTIC", power: Math.round(820 * Math.min(1.2, mod)), life: 1,
    mods: [{ name: exotic.mechanic, effect: "Element", value: 1 }, ...(perk ? [{ name: "Phase perk unlocked", effect: "Utility" as const, value: 1 }] : [])],
    transformation: exotic.mechanic,
  }];
  if (rng() < 0.2 * mod) drops.push({ name: table.mythic.name, slot: "ARMOR", rarity: "LEGENDARY", power: 800, life: 1, mods: [{ name: table.mythic.mechanic, effect: "Utility", value: 1 }], transformation: table.mythic.mechanic });
  return drops;
}
