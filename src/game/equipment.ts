import type { ClassId } from "./loadout";

export type WeaponTier = "T1" | "T2" | "T3" | "T4" | "T5" | "S";
export type ArmorTier = "T1-2" | "T3-4" | "T5" | "S";
export type DamageElement = "KINETIC" | "PLASMA" | "CRYO" | "ARC" | "THERMAL" | "VOID";
export type WeaponManifestItem = { id: string; name: string; tier: WeaponTier; archetype: string; element: DamageElement; durability: number; perk: string; source: string };
export type ArmorManifestItem = { id: string; name: string; tier: ArmorTier; slot: "HELM" | "CHEST" | "ARMS" | "LEGS" | "BACK" | "CORE"; classId: ClassId | "UNIVERSAL"; perk: string; source: string };

const WEAPON_COUNTS: ReadonlyArray<[WeaponTier, number]> = [["T1", 25], ["T2", 30], ["T3", 28], ["T4", 22], ["T5", 12], ["S", 5]];
const WEAPON_NAMES: Record<WeaponTier, readonly string[]> = {
  T1: ["Scrap-Slugger", "Pipe-Rail Pistol", "Rebar Crossbow", "Makeshift Sub-Carbine"],
  T2: ["Resonant MK-IV Assault Rifle", "Enforcer SMG", "Kinetic DMR", "Standard-Issue Sidearm"],
  T3: ["Magma-Core Heavy Repeater", "Cryo-Pulse Carbine", "Bio-Luminescent Arc-Caster"],
  T4: ["West Frontline MG", "Overclocked Phase-Disruptor", "Ash-Born Thermal-Blade Sword", "Ash-Born Thermal-Slade Maul", "Heavy Mag-Cannon"],
  T5: ["The Event Horizon", "Singularity-Core Minigun", "Void-Shard Blade"],
  S: ["The Anomaly's Grasp", "Eternity's Edge", "Genesis-Zero", "Hourglass Protocol", "Antiphon's Refrain"],
};
const ARCHETYPES = ["ASSAULT RIFLE", "SIDEARM", "SHOTGUN", "SMG", "DMR", "HEAVY", "BLADE", "CASTER"] as const;
const ELEMENTS: readonly DamageElement[] = ["KINETIC", "PLASMA", "CRYO", "ARC", "THERMAL", "VOID"];

export const WEAPON_MANIFEST: readonly WeaponManifestItem[] = WEAPON_COUNTS.flatMap(([tier, count], tierIndex) =>
  Array.from({ length: count }, (_, index) => {
    const roots = WEAPON_NAMES[tier];
    const root = roots[index % roots.length] ?? "Fracture Armament";
    const isNamed = index < roots.length;
    return {
      id: `weapon-${tier.toLowerCase()}-${String(index + 1).padStart(2, "0")}`,
      name: isNamed ? root : `${root} · Pattern ${String(index + 1).padStart(2, "0")}`,
      tier, archetype: ARCHETYPES[(index + tierIndex) % ARCHETYPES.length] ?? "RIFLE",
      element: ELEMENTS[(index + tierIndex) % ELEMENTS.length] ?? "KINETIC",
      durability: Math.min(100, 48 + tierIndex * 9 + (index % 8)),
      perk: ["Controlled recoil", "Armor breach", "Resonance chain", "Precision reserve", "Hazard adaptation"][index % 5] ?? "Field tuned",
      source: tier === "S" ? "Dungeon or apex signature" : tier === "T5" ? "Rift anomaly and apex core" : tier === "T4" ? "Faction prototype forge" : tier === "T3" ? "Biome overclocking" : "World salvage",
    };
  }),
);

const ARMOR_COUNTS: ReadonlyArray<[ArmorTier, number]> = [["T1-2", 24], ["T3-4", 36], ["T5", 20], ["S", 12]];
const ARMOR_SLOTS: readonly ArmorManifestItem["slot"][] = ["HELM", "CHEST", "ARMS", "LEGS", "BACK", "CORE"];
const ARMOR_CLASSES: readonly ArmorManifestItem["classId"][] = ["UNIVERSAL", "TITAN", "HUNTER", "WARLOCK"];
const ARMOR_ROOTS: Record<ArmorTier, readonly string[]> = {
  "T1-2": ["Scavenger Plate", "Outpost Harness", "Dustwalker Rig"],
  "T3-4": ["Faction Tactical", "Thermal Ward", "Cryogenic Weave", "Arc Conduit"],
  T5: ["Singularity-Woven", "Reality-Stable", "Gravitic Anchor"],
  S: ["Fracture Veteran", "System Breaker", "Reality Anchor", "Echo Master"],
};

export const ARMOR_MANIFEST: readonly ArmorManifestItem[] = ARMOR_COUNTS.flatMap(([tier, count], tierIndex) =>
  Array.from({ length: count }, (_, index) => {
    const roots = ARMOR_ROOTS[tier];
    const slot = ARMOR_SLOTS[index % ARMOR_SLOTS.length] ?? "CHEST";
    const classId = ARMOR_CLASSES[(index + tierIndex) % ARMOR_CLASSES.length] ?? "UNIVERSAL";
    return {
      id: `armor-${tier.toLowerCase().replace("-", "")}-${String(index + 1).padStart(2, "0")}`,
      name: `${roots[index % roots.length] ?? "Resonant"} ${slot.toLowerCase()} · ${String(index + 1).padStart(2, "0")}`,
      tier, slot, classId,
      perk: ["Ballistic resistance", "Thermal plating", "Fracture-core integration", "Reality warp", "Team resonance"][index % 5] ?? "Field protection",
      source: tier === "S" ? "Mastery, dungeon, or apex relic" : tier === "T5" ? "Raid and anomaly forge" : tier === "T3-4" ? "Faction district blueprint" : "Scrap-Market standardization",
    };
  }),
);

export const EQUIPMENT_COUNTS = { weapons: WEAPON_MANIFEST.length, armor: ARMOR_MANIFEST.length } as const;

if (EQUIPMENT_COUNTS.weapons !== 122 || EQUIPMENT_COUNTS.armor !== 92) throw new Error("Equipment manifest count mismatch");