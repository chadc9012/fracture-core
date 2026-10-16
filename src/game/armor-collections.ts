import type { ArmorEffects, ArmorSet } from "./armor-sets";

/**
 * The five armor families (30 collections). They are ordinary ArmorSets with no region, so pieces mix
 * freely with any other gear and 2/4-piece synergies stay optional. Each collection names where it drops
 * (identifiable sources) and whether vendors may ever sell it (raid/dungeon/exotic gear never).
 */
export type ArmorFamily = "military" | "ninja" | "sentinel" | "street" | "exotic";
export type LootActivity = "public-event" | "patrol" | "story" | "elite" | "dungeon" | "raid" | "secret" | "race" | "parkour" | "black-market";
export type VendorTier = 1 | 2 | 3 | 4 | 5;
export type Collection = ArmorSet & { family: ArmorFamily; sources: LootActivity[]; vendorTier: VendorTier | null };

export const FAMILY_LABEL: Record<ArmorFamily, string> = {
  military: "Military & Tactical", ninja: "Ninja & Assassin", sentinel: "Resonance Guard", street: "Urban Street & Racing", exotic: "Exotic & Reality-Corrupted",
};

type Spec = [id: string, name: string, color: string, tagline: string, element: ArmorSet["element"], two: [string, Partial<ArmorEffects>], four: [string, Partial<ArmorEffects>], sources: LootActivity[], tier: VendorTier | null];

const describe = (e: Partial<ArmorEffects>) => Object.entries(e).map(([k, v]) => {
  const n = v ?? 0;
  const pct = `${Math.round(n * 100)}%`;
  return k === "resist" ? `Incoming damage −${pct}` : k === "weaponDamage" ? `Weapon damage +${pct}` : k === "moveSpeed" ? `Move ${pct} faster` : k === "slideBoost" ? `Slides ${pct} further` : k === "abilityRecharge" ? `Abilities recharge ${pct} faster` : `Regenerate ${n} hull/s`;
}).join(", ") + ".";

const FAMILIES: Record<ArmorFamily, { slots: [string, string, string, string, string]; specs: Spec[] }> = {
  military: { slots: ["Helmet", "Gauntlets", "Plate Carrier", "Fatigues", "Rig"], specs: [
    ["ironwatch", "Ironwatch", "#8a9aa6", "Ceramic plates and utility pouches.", "KINETIC", ["Steady Hands", { weaponDamage: 0.05, resist: 0.03 }], ["Hold the Line", { resist: 0.08 }], ["patrol", "public-event"], 1],
    ["ghost-recon", "Ghost Recon", "#3c4650", "Lightweight black suppressed-tech kit.", "KINETIC", ["Quiet Step", { moveSpeed: 0.06 }], ["Phantom Push", { moveSpeed: 0.05, slideBoost: 0.1 }], ["patrol", "elite"], 2],
    ["vanguard-siege", "Vanguard Siege", "#6d7b5a", "Heavy plated military armor.", "KINETIC", ["Siege Plating", { resist: 0.08 }], ["Unbroken", { resist: 0.1 }], ["elite", "public-event"], 3],
    ["wasteland-ranger", "Wasteland Ranger", "#a07a4a", "Scavenged armor and ammo belts.", "KINETIC", ["Make Do", { regen: 0.8 }], ["Long Haul", { regen: 1, moveSpeed: 0.04 }], ["patrol", "story"], 1],
    ["nightfall-operator", "Nightfall Operator", "#20262e", "Matte black with low-profile lighting.", "ARC", ["Dead Eye", { weaponDamage: 0.07 }], ["Lights Out", { weaponDamage: 0.08, moveSpeed: 0.03 }], ["elite", "secret"], 3],
    ["aegis-battalion", "Aegis Battalion", "#b0b8c0", "Advanced military exoskeleton.", "ARC", ["Battalion Shield", { resist: 0.06 }], ["Heavy Support", { resist: 0.06, weaponDamage: 0.08 }], ["public-event", "elite"], 4],
  ] },
  ninja: { slots: ["Mask", "Wraps", "Garb", "Leggings", "Sash"], specs: [
    ["shadow-veil", "Shadow Veil", "#1a1c24", "Layered black fabric, hidden plates.", "ARC", ["Unseen", { moveSpeed: 0.05 }], ["Veil Walk", { moveSpeed: 0.05, slideBoost: 0.12 }], ["secret", "patrol"], 2],
    ["crimson-ronin", "Crimson Ronin", "#b0222e", "Futuristic samurai plates and coat.", "THERMAL", ["Blade Discipline", { weaponDamage: 0.07 }], ["Ronin's Oath", { weaponDamage: 0.1, resist: 0.04 }], ["dungeon", "story"], null],
    ["phantom-circuit", "Phantom Circuit", "#29e0ff", "Flexible armor with energy channels.", "ARC", ["Energy Flow", { abilityRecharge: 0.08 }], ["Circuit Trail", { abilityRecharge: 0.08, moveSpeed: 0.05 }], ["elite", "parkour"], 3],
    ["void-serpent", "Void Serpent", "#5a2a8a", "Segmented armor, serpent motifs.", "ARC", ["Coil", { slideBoost: 0.12 }], ["Strike Back", { weaponDamage: 0.08, moveSpeed: 0.04 }], ["dungeon"], null],
    ["silent-lotus", "Silent Lotus", "#d8c8d0", "Light hood, armored wraps.", "BIO", ["Soft Step", { moveSpeed: 0.06 }], ["Bloom", { regen: 1, moveSpeed: 0.03 }], ["secret", "patrol"], 2],
    ["eclipse-stalker", "Eclipse Stalker", "#30303a", "Dark reflective angular armor.", "ARC", ["Precision", { weaponDamage: 0.08 }], ["Totality", { weaponDamage: 0.1 }], ["raid"], null],
  ] },
  sentinel: { slots: ["Visor Helm", "Gauntlets", "Core Plate", "Greaves", "Emblem"], specs: [
    ["solar-sentinel", "Solar Sentinel", "#ff4a2a", "Red and gold energy armor.", "THERMAL", ["Solar Charge", { weaponDamage: 0.08 }], ["Flare Burst", { weaponDamage: 0.1, abilityRecharge: 0.04 }], ["public-event", "story"], 4],
    ["frost-sentinel", "Frost Sentinel", "#4aa8ff", "Blue and silver control armor.", "CRYO", ["Chill Guard", { resist: 0.07 }], ["Permafrost", { resist: 0.06, abilityRecharge: 0.06 }], ["public-event", "elite"], 4],
    ["verdant-sentinel", "Verdant Sentinel", "#3ccf5a", "Green armor, organic details.", "BIO", ["Photosynthesis", { regen: 1 }], ["Overgrowth", { regen: 1.4 }], ["public-event", "patrol"], 4],
    ["eclipse-sentinel", "Eclipse Sentinel", "#7a3aff", "Black and violet void armor.", "ARC", ["Umbra", { weaponDamage: 0.06 }], ["Event Horizon", { weaponDamage: 0.06, resist: 0.06 }], ["elite", "dungeon"], null],
    ["nova-sentinel", "Nova Sentinel", "#d8faff", "White and cyan amplifier armor.", "ARC", ["Amplify", { abilityRecharge: 0.1 }], ["Supernova", { abilityRecharge: 0.12 }], ["story", "elite"], 4],
    ["prismatic-vanguard", "Prismatic Vanguard", "#ff7ad8", "Multicolor reactive plating.", "ARC", ["Spectrum", { abilityRecharge: 0.05, weaponDamage: 0.04 }], ["Full Spectrum", { abilityRecharge: 0.06, resist: 0.05, moveSpeed: 0.03 }], ["raid"], null],
  ] },
  street: { slots: ["Cap", "Gloves", "Jacket", "Joggers", "Bag"], specs: [
    ["neon-phantom", "Neon Phantom", "#ff2fd0", "Technical streetwear, luminous piping.", "ARC", ["Night Sprint", { moveSpeed: 0.07 }], ["Rooftop Flow", { moveSpeed: 0.06, slideBoost: 0.15 }], ["parkour", "patrol"], 2],
    ["blackmarket-runner", "Blackmarket Runner", "#4a4048", "Hoodies and concealed armor.", "KINETIC", ["Smuggler", { moveSpeed: 0.05 }], ["Clean Getaway", { moveSpeed: 0.05, resist: 0.05 }], ["black-market"], 5],
    ["overdrive", "Overdrive", "#ffb000", "Racing jacket and protective helmet.", "KINETIC", ["Pit Crew", { resist: 0.05 }], ["Redline", { moveSpeed: 0.07, resist: 0.04 }], ["race"], null],
    ["chrome-rebel", "Chrome Rebel", "#c8d0dc", "Metallic streetwear, custom plates.", "KINETIC", ["Quick Draw", { weaponDamage: 0.05, moveSpeed: 0.03 }], ["Rebel Yell", { weaponDamage: 0.07, moveSpeed: 0.04 }], ["patrol", "race"], 2],
    ["ghostline", "Ghostline", "#9aa4b0", "Minimalist urban tactical clothing.", "ARC", ["Blend In", { slideBoost: 0.1 }], ["Gone", { moveSpeed: 0.06, slideBoost: 0.1 }], ["parkour", "secret"], 3],
    ["aftershock", "Aftershock", "#e0502a", "Heavy streetwear, impact protection.", "KINETIC", ["Brace", { resist: 0.07 }], ["Shockwave", { resist: 0.06, weaponDamage: 0.06 }], ["public-event", "black-market"], 5],
  ] },
  exotic: { slots: ["Crown", "Grasps", "Core", "Striders", "Relic"], specs: [
    ["null-sovereign", "Null Sovereign", "#00e0ff", "Black armor, cyan reactor.", "ARC", ["Null Field", { abilityRecharge: 0.08 }], ["Sovereign Stun", { abilityRecharge: 0.08, resist: 0.06 }], ["raid"], null],
    ["rime-alpha", "Rime Alpha", "#a8eaff", "Frost-covered crystalline plating.", "CRYO", ["Crystal Skin", { resist: 0.09 }], ["Absolute Zero", { resist: 0.08, abilityRecharge: 0.06 }], ["dungeon"], null],
    ["fractureborn", "Fractureborn", "#ff3aa0", "Armor splitting between realities.", "ARC", ["Phase Shift", { moveSpeed: 0.06 }], ["Reality Tear", { weaponDamage: 0.1, abilityRecharge: 0.05 }], ["secret", "raid"], null],
    ["starfall-monarch", "Starfall Monarch", "#ffe08a", "Cosmic metal and floating fragments.", "ARC", ["Starlight", { abilityRecharge: 0.1 }], ["Monarch's Fall", { abilityRecharge: 0.12, weaponDamage: 0.05 }], ["raid"], null],
    ["abyssal-warden", "Abyssal Warden", "#1a5a7a", "Pressure-resistant deep-sea armor.", "CRYO", ["Pressure Seal", { resist: 0.08 }], ["Abyss Hunter", { resist: 0.06, regen: 1 }], ["dungeon", "secret"], null],
    ["chrono-revenant", "Chrono Revenant", "#b0ff6a", "Time-distorted armor with trails.", "ARC", ["Borrowed Time", { abilityRecharge: 0.1 }], ["Rewind", { abilityRecharge: 0.1, regen: 1 }], ["raid", "secret"], null],
  ] },
};

export const COLLECTIONS: readonly Collection[] = (Object.entries(FAMILIES) as [ArmorFamily, (typeof FAMILIES)[ArmorFamily]][]).flatMap(([family, { slots, specs }]) =>
  specs.map(([id, name, color, tagline, element, two, four, sources, tier]) => ({
    id, name, regionId: "", element, color, tagline, family, sources, vendorTier: tier,
    pieces: { helmet: `${name} ${slots[0]}`, gauntlets: `${name} ${slots[1]}`, chest: `${name} ${slots[2]}`, legs: `${name} ${slots[3]}`, classItem: `${name} ${slots[4]}` },
    two: { name: two[0], description: describe(two[1]), effects: two[1] },
    four: { name: four[0], description: describe(four[1]), effects: four[1] },
  })),
);

/** Raid, dungeon and exotic gear keep their prestige: no vendor may stock them. */
export const vendorSellable = (c: Collection, tier: VendorTier) => c.vendorTier !== null && c.vendorTier <= tier && c.family !== "exotic";
export const collectionsFrom = (activity: LootActivity) => COLLECTIONS.filter((c) => c.sources.includes(activity));

/** Bad-luck protection: every PITY_RUNS completions of the same activity guarantees a collection piece. */
export const PITY_RUNS = 3;
const hash = (s: string) => s.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17);
/** Deterministic piece for the nth run of an activity source; null when this run isn't a reward run. */
export function collectionReward(activity: LootActivity, key: string, run: number, firstClear: boolean) {
  if (!firstClear && run % PITY_RUNS !== 0) return null;
  const pool = collectionsFrom(activity);
  if (!pool.length) return null;
  const h = hash(`${key}:${run}`);
  const slots = ["helmet", "gauntlets", "chest", "legs", "classItem"] as const;
  return { setId: pool[h % pool.length]!.id, slot: slots[(h >>> 8) % slots.length]! };
}
