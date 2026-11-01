/**
 * Cosmetic gear (owner's "Expanded Equipment" boards, Nov 1: Accessories & Gear — capes/cloaks, backpacks, belts, shoulder
 * gear, scarves/masks, rings, earrings, amulets, charms, wings, auras). Appearance only, never stats: each slot wears one item,
 * owned items are `cosmetic:<id>` in earnedRewards, and the worn set lives on progression.cosmetics. Bought for Nex here, earned
 * from events (seasonal.ts) or dropped from activities. cosmetic-pieces.ts draws them on the rig. Pure rules.
 */
import { nexBalance, spendNex, type NexLedger } from "./nex.ts";

export type CosmeticSlot = "back" | "shoulders" | "belt" | "neck" | "hands" | "ears" | "charm" | "aura";
export const COSMETIC_SLOTS: readonly CosmeticSlot[] = ["back", "shoulders", "belt", "neck", "hands", "ears", "charm", "aura"];
export const SLOT_LABEL: Record<CosmeticSlot, string> = { back: "Back", shoulders: "Shoulders", belt: "Belt", neck: "Neck", hands: "Rings", ears: "Earrings", charm: "Weapon charm", aura: "Aura" };

export type CosmeticRarity = "common" | "rare" | "legendary" | "exotic";
/** how it's drawn (cosmetic-pieces.ts): the shape family and its colours */
export type CosmeticVisual = { kind: "cape" | "cloak" | "backpack" | "wings" | "pauldrons" | "spikes" | "belt" | "pouches" | "scarf" | "mask" | "amulet" | "rings" | "earrings" | "charm" | "aura"; color: string; accent?: string; glow?: string };
export type Cosmetic = { id: string; slot: CosmeticSlot; name: string; blurb: string; rarity: CosmeticRarity; price: number | null; source: string; visual: CosmeticVisual; /** seasonal.ts event id when it is only sold during that event */ event?: string };

const c = (id: string, slot: CosmeticSlot, name: string, blurb: string, rarity: CosmeticRarity, price: number | null, source: string, visual: CosmeticVisual, event?: string): Cosmetic => ({ id, slot, name, blurb, rarity, price, source, visual, ...(event ? { event } : {}) });

export const COSMETICS: readonly Cosmetic[] = [
  // back
  c("cape-vanguard", "back", "Vanguard Cape", "A grey field cape, weighted at the hem.", "common", 800, "Apex Gear", { kind: "cape", color: "#4a5058" }),
  c("cape-crimson", "back", "Crimson Cloak", "A deep red hooded cloak.", "rare", 2400, "Apex Gear", { kind: "cloak", color: "#7a1a22", accent: "#2a0d10" }),
  c("cape-void", "back", "Voidwalker Cloak", "A cloak that drinks the light.", "legendary", null, "Dungeon: the Sunken Arcology Vaults", { kind: "cloak", color: "#1a1030", accent: "#5a2a9a", glow: "#7a3aff" }),
  c("pack-scout", "back", "Scout Backpack", "A canvas pack with a bedroll.", "common", 600, "Apex Gear", { kind: "backpack", color: "#6b5a3a", accent: "#3a3024" }),
  c("pack-tech", "back", "Tech Pack", "A hard-shell pack with a status light.", "rare", 2000, "Apex Gear", { kind: "backpack", color: "#2a2e36", accent: "#15181e", glow: "#41e6ff" }),
  c("wings-aether", "back", "Aether Wings", "Wings of folded light.", "exotic", null, "Raid: the Hollow Star, first clear", { kind: "wings", color: "#cfe8ff", glow: "#92e9f5" }),
  c("wings-ember", "back", "Ember Wings", "Wings of banked fire.", "exotic", null, "Vyrak's Covenant Trial", { kind: "wings", color: "#ff7a3a", glow: "#ff4a1a" }),
  // shoulders
  c("pauldron-steel", "shoulders", "Steel Pauldrons", "Plain plate shoulders.", "common", 700, "Apex Gear", { kind: "pauldrons", color: "#8a929c" }),
  c("pauldron-gold", "shoulders", "Gilded Pauldrons", "Gold-edged shoulder plate.", "rare", 2600, "Apex Gear", { kind: "pauldrons", color: "#c9a24a", accent: "#5a4420" }),
  c("spikes-reaver", "shoulders", "Reaver Spikes", "Scrap spikes on the shoulders.", "rare", null, "Wastelands: Reaver kills", { kind: "spikes", color: "#4a4a4a", accent: "#8a2f1e" }),
  // belt
  c("belt-utility", "belt", "Utility Belt", "Pouches and a buckle.", "common", 400, "Apex Gear", { kind: "pouches", color: "#3a3430", accent: "#8a7a5a" }),
  c("belt-sash", "belt", "Operator Sash", "A broad sash in the faction colour.", "common", 500, "Apex Gear", { kind: "belt", color: "#2a4a6a" }),
  // neck
  c("scarf-red", "neck", "Red Scarf", "A long red scarf.", "common", 450, "Apex Gear", { kind: "scarf", color: "#8a1f2a" }),
  c("scarf-grey", "neck", "Grey Scarf", "A wool scarf, wrapped twice.", "common", 450, "Apex Gear", { kind: "scarf", color: "#6a6e74" }),
  c("mask-half", "neck", "Half Mask", "A black half mask over the nose and mouth.", "rare", 1500, "Rusty Trigger", { kind: "mask", color: "#15171c", accent: "#41e6ff" }),
  c("amulet-resonant", "neck", "Resonant Amulet", "A shard that hums with the system.", "legendary", null, "Act 3: the Core Node", { kind: "amulet", color: "#d9cfb8", glow: "#59ff7a" }),
  // hands, ears, charm
  c("rings-steel", "hands", "Steel Rings", "Two plain steel bands.", "common", 300, "Apex Gear", { kind: "rings", color: "#9aa3ad" }),
  c("rings-gold", "hands", "Gold Rings", "Three gold rings.", "rare", 1800, "Apex Gear", { kind: "rings", color: "#d4a94a" }),
  c("earrings-hoops", "ears", "Hoops", "Steel hoop earrings.", "common", 350, "Apex Gear", { kind: "earrings", color: "#b8c0c8" }),
  c("earrings-studs", "ears", "Blue Studs", "Small glowing studs.", "rare", 1200, "Apex Gear", { kind: "earrings", color: "#92e9f5", glow: "#41e6ff" }),
  c("charm-dragonite", "charm", "Dragonite Charm", "A scale on a cord, clipped to the weapon.", "legendary", null, "Vyrak bond", { kind: "charm", color: "#d13a2a", glow: "#ff7a3a" }),
  c("charm-skull", "charm", "Skull Charm", "A small chrome skull.", "common", 500, "Rusty Trigger", { kind: "charm", color: "#c8d0dc" }),
  // aura
  c("aura-resonance", "aura", "Resonance Aura", "A faint cyan ring at your feet.", "legendary", null, "Raid: the Hollow Star, Resonant End", { kind: "aura", color: "#41e6ff", glow: "#41e6ff" }),
  c("aura-ember", "aura", "Ember Aura", "Embers drifting up around you.", "legendary", null, "Ember Peaks: Summit Guardian", { kind: "aura", color: "#ff7a3a", glow: "#ff4a1a" }),
  // seasonal (seasonal.ts): sold only while the event runs, kept forever
  c("cape-pumpkin", "back", "Harvest Cloak", "An orange cloak stitched with vines.", "rare", 1500, "Halloween Collection", { kind: "cloak", color: "#c85a14", accent: "#2a3a1a" }, "halloween"),
  c("wings-bat", "back", "Bat Wings", "Leathery black wings.", "legendary", 4000, "Halloween Collection", { kind: "wings", color: "#1a1418", glow: "#7a3aff" }, "halloween"),
  c("cape-winter", "back", "Frostveil Cloak", "A white fur-lined cloak.", "rare", 1500, "Winter Collection", { kind: "cloak", color: "#e8f0ff", accent: "#9fd8ff" }, "winter"),
  c("aura-snow", "aura", "Snowfall Aura", "Snow falling around you.", "legendary", 4000, "Winter Collection", { kind: "aura", color: "#e8f0ff", glow: "#9fd8ff" }, "winter"),
  c("wings-blossom", "back", "Blossom Wings", "Petal-pink translucent wings.", "legendary", 4000, "Spring Collection", { kind: "wings", color: "#f5b8d0", glow: "#ff8ac0" }, "spring"),
  c("aura-petals", "aura", "Petal Aura", "Petals drifting at your feet.", "rare", 1500, "Spring Collection", { kind: "aura", color: "#f5b8d0", glow: "#ff8ac0" }, "spring"),
  c("scarf-lei", "neck", "Festival Lei", "A garland of bright flowers.", "common", 600, "Summer Festival", { kind: "scarf", color: "#ff5a8a", accent: "#ffd25a" }, "summer"),
  c("aura-sun", "aura", "Sunburst Aura", "A warm golden ring.", "legendary", 4000, "Summer Festival", { kind: "aura", color: "#ffd25a", glow: "#ffb02e" }, "summer"),
  c("wings-anniversary", "back", "Anniversary Wings", "Gold wings for the first year.", "exotic", null, "Anniversary: log in during the event", { kind: "wings", color: "#ffe08a", glow: "#ffd25a" }, "anniversary"),
  c("charm-heart", "charm", "Heart Charm", "A small red heart.", "common", 400, "Valentine's Collection", { kind: "charm", color: "#e0304a", glow: "#ff6a8a" }, "valentines"),
  c("aura-fireworks", "aura", "Fireworks Aura", "Sparks bursting around you.", "legendary", 3500, "New Year's Collection", { kind: "aura", color: "#ffd25a", glow: "#ff8a3a" }, "newyear"),
  c("cape-harvest", "back", "Reaper's Cape", "A russet cape for the harvest.", "rare", 1500, "Harvest Collection", { kind: "cape", color: "#8a4a1e" }, "harvest"),
  c("wings-lunar", "back", "Lunar Dragon Wings", "Red and gold dragon wings.", "legendary", 4000, "Lunar Festival", { kind: "wings", color: "#c8202a", glow: "#ffd25a" }, "lunar"),
  c("charm-clover", "charm", "Clover Charm", "A four-leaf clover in resin.", "common", 400, "St. Patrick's Collection", { kind: "charm", color: "#2f9a3a", glow: "#59ff7a" }, "stpatricks"),
  c("cape-patriot", "back", "Patriot Cape", "Red, white and blue stripes.", "rare", 1500, "Independence Collection", { kind: "cape", color: "#2a3a8a", accent: "#c82a2a" }, "independence"),
  c("mask-calavera", "neck", "Calavera Mask", "A painted sugar-skull mask.", "rare", 1800, "Day of the Dead Collection", { kind: "mask", color: "#f2f2f2", accent: "#e0304a" }, "dayofthedead"),
  c("aura-bounty", "aura", "Bounty Aura", "Gold leaves at your feet.", "rare", 1500, "Thanksgiving Collection", { kind: "aura", color: "#c88a2a", glow: "#ffb02e" }, "thanksgiving"),
];

export const cosmeticById = (id: string): Cosmetic | undefined => COSMETICS.find((x) => x.id === id);
export const ownsCosmetic = (p: { earnedRewards: readonly string[] }, id: string): boolean => p.earnedRewards.includes(`cosmetic:${id}`);
export const ownedCosmetics = (p: { earnedRewards: readonly string[] }): Cosmetic[] => COSMETICS.filter((x) => ownsCosmetic(p, x.id));

export type WornCosmetics = Partial<Record<CosmeticSlot, string>>;
export type CosmeticStore = { earnedRewards: string[]; nexLedger: NexLedger; cosmetics: WornCosmetics };

/** the worn set with anything unowned or unknown dropped (old saves carry none) */
export function normalizeCosmetics(raw: unknown, earned: readonly string[] = []): WornCosmetics {
  if (!raw || typeof raw !== "object") return {};
  const out: WornCosmetics = {};
  for (const slot of COSMETIC_SLOTS) {
    const id = (raw as Record<string, unknown>)[slot];
    const item = typeof id === "string" ? cosmeticById(id) : undefined;
    if (item && item.slot === slot && (earned.length === 0 || earned.includes(`cosmetic:${item.id}`))) out[slot] = item.id;
  }
  return out;
}

/** grants an item outright (an event reward, a drop): idempotent */
export function grantCosmetic<P extends { earnedRewards: string[] }>(p: P, id: string): P {
  if (!cosmeticById(id) || p.earnedRewards.includes(`cosmetic:${id}`)) return p;
  return { ...p, earnedRewards: [...p.earnedRewards, `cosmetic:${id}`] };
}

/** Buys a priced item for Nex (ledger key `cosmetic:<id>`, so it can't be bought twice) and wears it. `activeEvents` gates
 * seasonal stock: an event item is only for sale while its event runs. */
export function buyCosmetic<P extends CosmeticStore>(p: P, id: string, activeEvents: readonly string[] = []): { progression: P; message: string } | { error: string } {
  const item = cosmeticById(id);
  if (!item) return { error: "No such item" };
  if (ownsCosmetic(p, id)) return { progression: wearCosmetic(p, id), message: `Wearing ${item.name}` };
  if (item.price === null) return { error: `${item.name} isn't for sale: ${item.source}` };
  if (item.event && !activeEvents.includes(item.event)) return { error: `${item.name} is only sold during its event (${item.source})` };
  const ledger = spendNex(p.nexLedger, `cosmetic:${id}`, item.price);
  if (!ledger) return { error: `Needs ${item.price} Nex (you have ${nexBalance(p.nexLedger)})` };
  const owned = grantCosmetic({ ...p, nexLedger: ledger }, id);
  return { progression: wearCosmetic(owned, id), message: `Bought ${item.name} · -${item.price} Nex` };
}

/** wears an owned item in its slot; an unowned id is ignored */
export function wearCosmetic<P extends CosmeticStore>(p: P, id: string): P {
  const item = cosmeticById(id);
  if (!item || !ownsCosmetic(p, id) || p.cosmetics[item.slot] === id) return p;
  return { ...p, cosmetics: { ...p.cosmetics, [item.slot]: id } };
}
export function removeCosmetic<P extends CosmeticStore>(p: P, slot: CosmeticSlot): P {
  if (!(slot in p.cosmetics)) return p;
  const next = { ...p.cosmetics }; delete next[slot];
  return { ...p, cosmetics: next };
}
/** what's drawn: the worn items that are really owned, by slot */
export function wornCosmetics(p: Pick<CosmeticStore, "earnedRewards" | "cosmetics">): Cosmetic[] {
  return COSMETIC_SLOTS.map((s) => p.cosmetics[s]).filter((id): id is string => !!id).map((id) => cosmeticById(id)).filter((x): x is Cosmetic => !!x && ownsCosmetic(p, x.id));
}
