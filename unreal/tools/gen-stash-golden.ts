/**
 * Records golden stash operations from the web build's real stash.ts for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/StashCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs stash
 *
 *   CS -> consumables      P save   B buffs
 *   OP op arg now -> changed|save|buffs      (op: grant craftRuin craftStim use sell dismantle upgrade toVault fromVault)
 *   VC now -> visible       BE now -> resist|regen|damageMult      Q id -> duplicate|canSell|sellValue|parts|partsCost|inVault
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONSUMABLES, RUIN_STONE_RECIPE, STIMS, buffEffect, canSellDuplicate, craftRuinStone, craftStim, dismantle, dismantleParts, fromVault, grant, inVault, isDuplicate, partsCost, sellDuplicate, sellValue, toVault, upgradeWithParts, useStim, visibleConsumables, type Buffs, type ConsumableId } from "../../src/game/stash";
import type { GearItem, MaterialId } from "../../src/game/inventory";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "stash_golden.txt");
const n = (v: number) => String(v);
let seed = 0x5a54;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
type S = { inventory: GearItem[]; materials: Partial<Record<MaterialId, number>>; equippedGear: Partial<Record<string, string>>; earnedRewards: string[]; fractureShards: number; vaultIds?: string[] };
const kv = (m: Record<string, number | undefined>) => Object.keys(m).filter((k) => m[k] !== undefined).sort().map((k) => `${k}=${n(m[k]!)}`).join(",") || "~";
const item = (g: GearItem) => [g.id, g.name, g.slot, n(g.power), n(g.level), g.source, g.setId ?? "~", g.rarity ?? "~", g.favorite ? "1" : "0"].join("^");
const ps = (p: S) => [p.inventory.map(item).join(";") || "~", Object.keys(p.equippedGear).sort().map((k) => `${k}=${p.equippedGear[k]}`).join(",") || "~", (p.vaultIds ?? []).join(",") || "~", kv(p.materials as Record<string, number>), p.earnedRewards.join(",") || "~", n(p.fractureShards)].join("|");
const bs = (b: Buffs) => Object.keys(b).sort().map((k) => `${k}=${n(b[k as ConsumableId]!.stacks)}:${n(b[k as ConsumableId]!.until)}`).join(",") || "~";

out("CS", (["armorStim", "healStim", "ruinStone"] as const).map((id) => [id, CONSUMABLES[id].name, n(CONSUMABLES[id].seconds), CONSUMABLES[id].blurb,
  Object.entries(id === "ruinStone" ? RUIN_STONE_RECIPE : STIMS[id].recipe).map(([k, v]) => `${k}=${v}`).join(",")].join("^")).join(";"));

const NAMES = ["Ace of Spades", "Hunter Cloak", "Vanguard Helm", "Wyrm Rifle", "Ash Plate"];
const SLOTS = ["primary", "secondary", "helmet", "chest", "classItem"];
const MATS: MaterialId[] = ["dataChip", "energyToken", "relicFragment", "gearParts", "armorStim", "healStim", "ruinStone", "scrapMetal"];
let now = 1_765_000_000_000;
for (let t = 0; t < 400; t++) {
  const inventory: GearItem[] = [];
  const count = Math.floor(rand() * 9);
  for (let i = 0; i < count; i++) {
    const g: GearItem = { id: `g${t}-${i}`, name: pick(NAMES), slot: pick(SLOTS) as GearItem["slot"], power: pick([10, 104, 255, 305, 999]), level: pick([1, 2, 9, 10, 11]), element: "KINETIC", source: rand() < 0.15 ? "Starting loadout" : "Drop" };
    if (rand() < 0.3) g.setId = pick(["vanguard", "ember"]);
    if (rand() < 0.2) g.rarity = pick(["LEGENDARY", "EXOTIC"] as const);
    if (rand() < 0.15) g.favorite = true;
    inventory.push(g);
  }
  const materials: Partial<Record<MaterialId, number>> = {};
  for (const m of MATS) if (rand() < 0.7) materials[m] = Math.floor(rand() * 12);
  const equippedGear: Record<string, string> = {};
  if (inventory.length && rand() < 0.6) equippedGear.primary = pick(inventory).id;
  if (inventory.length && rand() < 0.3) equippedGear.helmet = pick(inventory).id;
  let p: S = { inventory, materials, equippedGear, earnedRewards: rand() < 0.3 ? ["x"] : [], fractureShards: pick([0, 40, 500]), vaultIds: rand() < 0.3 && inventory.length ? [inventory[0]!.id] : rand() < 0.5 ? [] : undefined };
  let buffs: Buffs = {};
  out("P", ps(p));
  out("B", bs(buffs));
  for (let k = 0; k < 30; k++) {
    now += pick([1, 500, 29_999, 30_000, 30_001, 60_000, 200_000]);
    const ids = [...p.inventory.map((g) => g.id), "missing"];
    const op = pick(["grant", "craftRuin", "craftStim", "use", "use", "sell", "dismantle", "upgrade", "toVault", "fromVault", "q", "vis"]);
    let next: S = p, arg = "~";
    if (op === "grant") { const m = pick(MATS); const amt = pick([1, 2, 5]); arg = `${m}=${amt}`; next = grant(p, m, amt); }
    else if (op === "craftRuin") next = craftRuinStone(p);
    else if (op === "craftStim") { arg = pick(["armorStim", "healStim"]); next = craftStim(p, arg as "armorStim"); }
    else if (op === "use") { arg = pick(["armorStim", "healStim", "ruinStone"]); const r = useStim(p, buffs, arg as ConsumableId, now); if (r) { next = r.progression; buffs = r.buffs; } }
    else if (op === "sell") { arg = pick(ids); next = sellDuplicate(p, arg); }
    else if (op === "dismantle") { arg = pick(ids); next = dismantle(p, arg); }
    else if (op === "upgrade") { arg = pick(ids); next = upgradeWithParts(p, arg); }
    else if (op === "toVault") { arg = pick(ids); next = toVault(p, arg); }
    else if (op === "fromVault") { arg = pick(ids); next = fromVault(p, arg); }
    else if (op === "q") { for (const g of p.inventory) out("Q", g.id, [isDuplicate(p, g) ? 1 : 0, canSellDuplicate(p, g) ? 1 : 0, sellValue(g), dismantleParts(g), partsCost(g), inVault(p, g.id) ? 1 : 0].map(n).join("|")); continue; }
    else { out("VC", now, visibleConsumables(p.materials, buffs, now).join(",")); const e = buffEffect(buffs, now); out("BE", now, `${n(e.resist)}|${n(e.regen)}|${n(e.damageMult)}`); continue; }
    out("OP", op, arg, now, `${next !== p ? 1 : 0}|${ps(next)}|${bs(buffs)}`);
    p = next;
  }
}
// a full stack of three, then a fourth use refused while it runs; and the vault filling to its 150 cap
{
  let p: S = { inventory: [], materials: { armorStim: 3, healStim: 3, ruinStone: 6, gearParts: 30, energyToken: 9 }, equippedGear: {}, earnedRewards: [], fractureShards: 0 };
  let buffs: Buffs = {};
  out("P", ps(p)); out("B", bs(buffs));
  let at = 1_766_000_000_000;
  for (const id of ["armorStim", "armorStim", "armorStim", "armorStim", "ruinStone", "ruinStone", "ruinStone", "ruinStone", "ruinStone"] as ConsumableId[]) {
    if (id === "armorStim") { const g = grant(p, "armorStim", 1); out("OP", "grant", "armorStim=1", at, `1|${ps(g)}|${bs(buffs)}`); p = g; }
    at += 1000;
    const r = useStim(p, buffs, id, at);
    if (r) { p = r.progression; buffs = r.buffs; }
    out("OP", "use", id, at, `${r ? 1 : 0}|${ps(p)}|${bs(buffs)}`);
  }
  const inv: GearItem[] = Array.from({ length: 152 }, (_, i) => ({ id: `v${i}`, name: `Item ${i}`, slot: "primary" as GearItem["slot"], power: 10, level: 1, element: "KINETIC" as const, source: "Drop" }));
  p = { inventory: inv, materials: {}, equippedGear: {}, earnedRewards: [], fractureShards: 0, vaultIds: [] };
  out("P", ps(p));
  for (let i = 0; i < 152; i++) { const next = toVault(p, `v${i}`); out("OP", "toVault", `v${i}`, at, `${next !== p ? 1 : 0}|${ps(next)}|${bs(buffs)}`); p = next; }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`stash golden: ${lines.length} lines -> ${OUT}`);
