/**
 * Records golden armor effects from the web build's real armor-sets.ts (setStatuses, armorEffects), armor-perks.ts
 * (perkEffects), armor-attributes.ts (loadoutAttributes, hasFlexibility, loadoutEffects) and inventory.ts
 * (weaponDamageMultiplier) for the C++ port's test (Plugins/WorldFractureCore/Tests/ArmorCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs armor
 *
 * Lines are tab-separated; "~" = absent. Effects are resist|weaponDamage|moveSpeed|regen|slideBoost|abilityRecharge.
 *   SET id two four            PERK set slot effects
 *   C                          a new loadout; then IT id slot power level setId source, EQ slot id, and
 *   R armorEffects perkEffects raw(i|m|d) effective(i|m|d) worn flex loadoutEffects
 *   WD power -> multiplier      GS weaponId kind inVehicle -> slot
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ARMOR_SETS, SET_SLOTS, makeSetPiece, armorEffects, type ArmorEffects, type SetSlot } from "../../src/game/armor-sets";
import { ARMOR_PERKS, perkEffects } from "../../src/game/armor-perks";
import { loadoutAttributes, hasFlexibility, loadoutEffects } from "../../src/game/armor-attributes";
import { weaponDamageMultiplier, type GearItem } from "../../src/game/inventory";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "armor_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0xa2e0;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const KEYS: (keyof ArmorEffects)[] = ["resist", "weaponDamage", "moveSpeed", "regen", "slideBoost", "abilityRecharge"];
const fx = (e: Partial<ArmorEffects>) => KEYS.map((k) => n(e[k] ?? 0)).join("|");

for (const s of ARMOR_SETS) out("SET", s.id, fx(s.two.effects), fx(s.four.effects));
for (const [setId, slots] of Object.entries(ARMOR_PERKS)) for (const [slot, perk] of Object.entries(slots)) out("PERK", setId, slot, fx(perk.effects));

const SLOTS = [...SET_SLOTS, "primary", "heavy"] as const;
let cases = 0;
for (let c = 0; c < 1500; c++) {
  cases++;
  out("C");
  const inventory: GearItem[] = [];
  const equippedGear: Partial<Record<string, string>> = {};
  // lean on a few sets so 2- and 4-piece bonuses go live; add loose armor and the odd weapon
  const favourites = [pick(ARMOR_SETS).id, pick(ARMOR_SETS).id];
  const pieces = Math.floor(rand() * 9);
  for (let k = 0; k < pieces; k++) {
    const setId = rand() < 0.75 ? pick(favourites) : pick(ARMOR_SETS).id, slot = pick(SET_SLOTS);
    const item = makeSetPiece(setId, slot, 1 + Math.floor(rand() * 12));
    // the odd piece outside the 1-10 range (an old or hand-edited save) checks the level clamps
    if (item && rand() < 0.12) item.level = pick([0, 11, 14]);
    if (item && !inventory.some((i) => i.id === item.id)) inventory.push(item);
  }
  for (let k = 0; k < Math.floor(rand() * 4); k++) {
    const slot = pick([...SET_SLOTS, "primary"] as const);
    inventory.push({ id: `loose-${k}`, name: "Loose", slot, power: pick([80, 100, 140, 235, 300, 520]), level: 1, element: "KINETIC", source: pick(["Raider drop", "Vendor", "Mission", "Raider drop"]) });
  }
  for (const it of inventory) out("IT", it.id, it.slot, it.power, it.level, it.setId ?? NONE, it.source);
  for (const slot of SLOTS) {
    if (rand() < 0.2) continue;
    const fits = inventory.filter((i) => i.slot === slot || (rand() < 0.05));
    if (!fits.length) continue;
    const id = rand() < 0.04 ? "missing-item" : pick(fits).id;
    equippedGear[slot] = id; out("EQ", slot, id);
  }
  const p = { inventory, equippedGear };
  const a = loadoutAttributes(p);
  out("R", fx(armorEffects(p)), fx(perkEffects(p)), `${n(a.raw.intellect)}|${n(a.raw.mobility)}|${n(a.raw.defense)}`, `${n(a.effective.intellect)}|${n(a.effective.mobility)}|${n(a.effective.defense)}`, a.worn, hasFlexibility(p) ? 1 : 0, fx(loadoutEffects(p)));
}
for (const pw of [0, 50, 100, 101, 235, 300, 450, 451, 600, 1000]) out("WD", pw, weaponDamageMultiplier(pw));
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`armor golden: ${cases} loadouts, ${lines.length} lines -> ${OUT}`);
void ({} as SetSlot);
