/**
 * Exports the gear catalogues for the Godot project (godot-world-fracture/scripts/gear/): the starter loadout, the named weapon
 * catalogue with the frame each item fires as (weapon-classes.ts), the armour sets with their pieces and bonuses, the clothing
 * outfits and the cosmetics. The web game stays the source of truth; the JSON is small, so it is committed
 * (godot-world-fracture/data/gear.json) and re-run whenever a catalogue changes.
 *
 *   bun scripts/export-godot-gear.ts
 */
import { writeFileSync } from "node:fs";
import { STARTER_GEAR, weaponDamageMultiplier } from "../src/game/inventory";
import { WEAPON_CATALOG, CLASS_LABEL } from "../src/game/weapon-catalog";
import { frameFor, itemClass } from "../src/game/weapon-classes";
import { ARMOR_SETS } from "../src/game/armor-sets";
import { OUTFITS } from "../src/game/clothing-sets";
import { COSMETICS, COSMETIC_SLOTS } from "../src/game/cosmetics";
import { MELEE_CLASS } from "../src/game/foundries";

const slotOf = (arch: string) => (arch === "HEAVY" ? "heavy" : arch === "SIDEARM" ? "secondary" : arch === "BLADE" ? "melee" : "primary");
/** which Godot frame a weapon fires as (weapons.gd FRAMES: AUTO / SMG / SHOTGUN / SNIPER / FUSION / SIDEARM / HEAVY / LMG); launchers fire as HEAVY until a launcher frame lands */
const godotFrame = (slot: string, name: string) => {
  const f = slot === "primary" ? frameFor("AUTO", name) : slot === "heavy" ? frameFor("HEAVY", name) : slot === "secondary" ? "SIDEARM" : "AUTO";
  const cls = itemClass(name);
  if (slot === "heavy" && cls === "launcher") return "HEAVY";
  return f;
};
const out = {
  starter: STARTER_GEAR.map((g) => ({ ...g, frame: godotFrame(g.slot, g.name), cls: g.slot === "primary" ? "ar" : g.slot === "secondary" ? "pistol" : "" })),
  classLabel: CLASS_LABEL,
  weapons: WEAPON_CATALOG.map((w) => ({ id: w.id, name: w.name, cls: w.cls, rarity: w.rarity, via: w.via, element: w.element, tier: w.tier, slot: slotOf(w.archetype), frame: godotFrame(slotOf(w.archetype), w.name) })),
  meleeClass: MELEE_CLASS,
  armorSets: ARMOR_SETS.map((s) => ({ id: s.id, name: s.name, regionId: s.regionId, element: s.element, color: s.color, tagline: s.tagline, pieces: s.pieces, two: s.two, four: s.four })),
  outfits: OUTFITS,
  cosmeticSlots: COSMETIC_SLOTS,
  cosmetics: COSMETICS.map((c) => ({ id: c.id, name: c.name, slot: c.slot, price: c.price, source: c.source, event: c.event ?? null, visual: c.visual })),
  power: { damageAt: [100, 200, 300, 400, 500].map((p) => [p, weaponDamageMultiplier(p)]) },
};
writeFileSync("godot-world-fracture/data/gear.json", JSON.stringify(out));
console.log(`gear.json: ${out.weapons.length} weapons, ${out.armorSets.length} armour sets, ${out.outfits.length} outfits, ${out.cosmetics.length} cosmetics`);
