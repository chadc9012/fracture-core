/** The named weapon catalogue from the World Fracture weapon & vehicle reference sheet: every class of weapon in five
 * rarities, each with where it comes from (shop, loot, missions, bosses, quests). They are ordinary manifest weapons
 * (equipment.ts shape), so they become GearItems the same way, equip into the primary / secondary / heavy slot and boost
 * whichever weapon of that slot you fire; the name, element and power band are what differ. Pure.
 *  - shop  (common):  in every weapons shop's weekly rotation (weeklyCatalogStock, Monday 00:00 UTC)
 *  - loot  (rare):    join the enemy drop pool (weapon-loot.ts)
 *  - boss  (epic):    join the boss drop pool
 *  - mission / quest: the twelve exotics, one per story mission first clear (weapon-loot.ts CAMPAIGN_EXOTIC) */
import type { DamageElement, WeaponManifestItem, WeaponTier } from "./equipment";

export type CatalogRarity = "common" | "uncommon" | "rare" | "epic" | "exotic";
export type CatalogSource = "shop" | "loot" | "mission" | "boss" | "quest";
export type CatalogClass = "melee" | "sword" | "greatsword" | "katana" | "dagger" | "axe" | "warhammer" | "polearm" | "staff" | "bow" | "pistol" | "smg" | "ar" | "auto" | "lmg" | "sniper" | "fusion" | "shotgun" | "crossbow" | "launcher" | "special" | "relic";
export type CatalogWeapon = WeaponManifestItem & { rarity: CatalogRarity; via: CatalogSource; cls: CatalogClass };

export const CLASS_LABEL: Record<CatalogClass, string> = { melee: "Melee", sword: "Swords", greatsword: "Greatswords", katana: "Katanas", dagger: "Daggers", axe: "Axes", warhammer: "Warhammers", polearm: "Polearms", staff: "Staves", bow: "Bows", relic: "Exotic / Relic", pistol: "Pistols", smg: "SMGs", ar: "Assault rifles", auto: "Auto rifles", lmg: "Light machine guns", sniper: "Sniper rifles", fusion: "Fusion rifles", shotgun: "Shotguns", crossbow: "Crossbows", launcher: "Grenade launchers", special: "Special / energy" };
const TIER: Record<CatalogRarity, WeaponTier> = { common: "T1", uncommon: "T2", rare: "T3", epic: "T4", exotic: "T5" };
/** the manifest archetype (equipment.ts names); slot rules read it (weapon-loot.ts: HEAVY -> heavy, SIDEARM -> secondary, else primary) */
const ARCH: Record<CatalogClass, string> = { melee: "BLADE", sword: "BLADE", greatsword: "BLADE", katana: "BLADE", dagger: "BLADE", axe: "BLADE", warhammer: "BLADE", polearm: "BLADE", staff: "CASTER", bow: "DMR", relic: "CASTER", pistol: "SIDEARM", smg: "SMG", ar: "ASSAULT RIFLE", auto: "ASSAULT RIFLE", lmg: "HEAVY", sniper: "DMR", fusion: "CASTER", shotgun: "SHOTGUN", crossbow: "DMR", launcher: "HEAVY", special: "CASTER" };

type Row = [name: string, rarity: CatalogRarity, via: CatalogSource, element: DamageElement];
const SHEET: Record<CatalogClass, Row[]> = {
  melee: [["Razor Fang", "common", "shop", "KINETIC"], ["Storm Katana", "rare", "loot", "ARC"], ["Void Saber", "epic", "boss", "VOID"], ["Solara Blade", "exotic", "quest", "THERMAL"]],
  // the owner's "Expanded Equipment, Weapons & Seasonal Collections" board (Nov 1): melee families, bows, staves and relics
  sword: [["Vanguard Sabre", "common", "shop", "KINETIC"], ["Steel Fang", "common", "shop", "KINETIC"], ["Arc Edge", "uncommon", "loot", "ARC"], ["Emberbrand", "rare", "loot", "THERMAL"], ["Frostbite Blade", "rare", "loot", "CRYO"], ["Nightfall Sword", "epic", "boss", "VOID"], ["Sunforged Blade", "epic", "mission", "THERMAL"], ["Starfall Edge", "exotic", "quest", "PLASMA"]],
  greatsword: [["Bulwark Claymore", "common", "shop", "KINETIC"], ["Ironjaw Greatsword", "uncommon", "loot", "KINETIC"], ["Glacier Cleaver", "rare", "loot", "CRYO"], ["Stormbreaker", "rare", "loot", "ARC"], ["Voidrend Greatsword", "epic", "boss", "VOID"], ["Magma Executioner", "epic", "boss", "THERMAL"], ["Vyrak's Fang", "exotic", "quest", "THERMAL"], ["Worldsplitter", "exotic", "quest", "PLASMA"]],
  katana: [["Neon Katana", "common", "shop", "KINETIC"], ["Ashen Katana", "uncommon", "loot", "THERMAL"], ["Rime Katana", "rare", "loot", "CRYO"], ["Static Katana", "rare", "loot", "ARC"], ["Shadow Katana", "epic", "boss", "VOID"], ["Phase Katana", "epic", "mission", "PLASMA"], ["Fracture Edge", "exotic", "quest", "VOID"], ["Dawnbreaker Katana", "exotic", "quest", "THERMAL"]],
  dagger: [["Scrap Shiv", "common", "shop", "KINETIC"], ["Viper Fang", "common", "shop", "KINETIC"], ["Spark Dirk", "uncommon", "loot", "ARC"], ["Venom Stiletto", "rare", "loot", "VOID"], ["Cinder Dagger", "rare", "loot", "THERMAL"], ["Nightshade", "epic", "boss", "VOID"], ["Hollow Needle", "epic", "boss", "CRYO"], ["Whisper of Solara", "exotic", "quest", "PLASMA"]],
  axe: [["Scrapper Axe", "common", "shop", "KINETIC"], ["Ironhead Hatchet", "common", "shop", "KINETIC"], ["Frostcleaver", "uncommon", "loot", "CRYO"], ["Thunder Axe", "rare", "loot", "ARC"], ["Magma Splitter", "rare", "loot", "THERMAL"], ["Voidhewer", "epic", "boss", "VOID"], ["Reaver's Twin Axes", "epic", "boss", "KINETIC"], ["Sunder of Pyrrath", "exotic", "quest", "THERMAL"]],
  warhammer: [["Breaker Maul", "common", "shop", "KINETIC"], ["Rampart Hammer", "uncommon", "loot", "KINETIC"], ["Glacial Maul", "rare", "loot", "CRYO"], ["Storm Hammer", "rare", "loot", "ARC"], ["Magma Hammer", "epic", "boss", "THERMAL"], ["Voidquake", "epic", "boss", "VOID"], ["Tidebreaker Maul", "exotic", "quest", "CRYO"], ["Core Crusher", "exotic", "quest", "PLASMA"]],
  polearm: [["Picket Spear", "common", "shop", "KINETIC"], ["Vanguard Halberd", "uncommon", "loot", "KINETIC"], ["Arc Glaive", "rare", "loot", "ARC"], ["Frost Pike", "rare", "loot", "CRYO"], ["Ember Lance", "epic", "boss", "THERMAL"], ["Voidreaver", "epic", "boss", "VOID"], ["Solara Spear", "exotic", "quest", "THERMAL"], ["Tidebreaker", "exotic", "quest", "CRYO"]],
  staff: [["Survey Staff", "common", "shop", "ARC"], ["Conduit Rod", "uncommon", "loot", "ARC"], ["Ember Staff", "rare", "loot", "THERMAL"], ["Rime Staff", "rare", "loot", "CRYO"], ["Void Sceptre", "epic", "boss", "VOID"], ["Resonance Staff", "epic", "mission", "PLASMA"], ["Staff of the Deepmind", "exotic", "quest", "VOID"], ["Sunpillar", "exotic", "quest", "THERMAL"]],
  bow: [["Scout Bow", "common", "shop", "KINETIC"], ["Hunter's Recurve", "common", "shop", "KINETIC"], ["Static Bow", "uncommon", "loot", "ARC"], ["Emberbow", "rare", "loot", "THERMAL"], ["Frostreach Bow", "rare", "loot", "CRYO"], ["Voidstring", "epic", "boss", "VOID"], ["Skyline Longbow", "epic", "mission", "PLASMA"], ["Bow of the Fractured Sun", "exotic", "quest", "THERMAL"]],
  relic: [["Aether Rifle", "exotic", "quest", "PLASMA"], ["Reality-Shift Carbine", "exotic", "quest", "VOID"], ["Echo Lance", "exotic", "quest", "ARC"], ["Fracture Core Shard", "exotic", "quest", "VOID"], ["Deepmind Relic", "exotic", "boss", "CRYO"], ["Overseer's Eye", "exotic", "boss", "PLASMA"]],
  pistol: [["R-9 Sidearm", "common", "shop", "KINETIC"], ["Scrap Revolver", "common", "shop", "KINETIC"], ["Arc Pistol", "uncommon", "loot", "ARC"], ["Nova Handcannon", "rare", "loot", "THERMAL"], ["Rimefire Pistol", "rare", "loot", "CRYO"], ["Shadowbite", "epic", "boss", "VOID"], ["Lightbringer", "exotic", "quest", "PLASMA"]],
  smg: [["Viper SMG", "common", "shop", "KINETIC"], ["Street Sweeper SMG", "common", "shop", "KINETIC"], ["Neon SMG", "rare", "loot", "ARC"], ["Cinder SMG", "rare", "loot", "THERMAL"], ["Dark Current", "epic", "boss", "VOID"], ["Eclipse SMG", "exotic", "quest", "THERMAL"]],
  ar: [["Axiom AR", "common", "shop", "KINETIC"], ["Vanguard Carbine", "common", "shop", "KINETIC"], ["Frostline AR", "uncommon", "loot", "CRYO"], ["Valkyrie AR", "rare", "loot", "ARC"], ["Riftwalker", "epic", "boss", "VOID"], ["Worldbreaker", "exotic", "quest", "THERMAL"]],
  auto: [["Sentinel Auto", "common", "shop", "KINETIC"], ["Titan Auto", "rare", "loot", "KINETIC"], ["Ashfall Auto", "epic", "boss", "THERMAL"], ["Dominator", "exotic", "quest", "PLASMA"]],
  lmg: [["Bulwark LMG", "common", "shop", "KINETIC"], ["Scrap Chaingun", "uncommon", "loot", "KINETIC"], ["Ravager LMG", "rare", "loot", "CRYO"], ["Storm Forged", "epic", "boss", "ARC"], ["Thunder Lord", "exotic", "quest", "ARC"]],
  sniper: [["Scout Sniper", "common", "shop", "KINETIC"], ["Ridgeline DMR", "uncommon", "loot", "KINETIC"], ["Glacier Sniper", "rare", "loot", "CRYO"], ["Storm Sniper", "rare", "loot", "ARC"], ["Void Stalker", "epic", "boss", "VOID"], ["Silent Horizon", "exotic", "mission", "PLASMA"]],
  fusion: [["Phase Fusion", "rare", "loot", "ARC"], ["Starfire Fusion", "epic", "boss", "THERMAL"], ["Gravity Lance", "exotic", "mission", "VOID"]],
  shotgun: [["Riot Shotgun", "common", "shop", "KINETIC"], ["Scrapgun", "common", "shop", "KINETIC"], ["Hellfire SG", "rare", "loot", "THERMAL"], ["Glacier SG", "rare", "loot", "CRYO"], ["Oblivion SG", "epic", "boss", "VOID"], ["Doombringer", "exotic", "quest", "THERMAL"]],
  crossbow: [["Nomad Crossbow", "rare", "loot", "KINETIC"], ["Frostbow", "epic", "boss", "CRYO"], ["Soulpiercer", "exotic", "quest", "VOID"]],
  launcher: [["Breach GL", "rare", "loot", "KINETIC"], ["Cataclysm", "epic", "boss", "THERMAL"], ["World Ender", "exotic", "quest", "PLASMA"]],
  special: [["Arc Disruptor", "rare", "loot", "ARC"], ["Solar Eruption", "epic", "boss", "THERMAL"], ["Void Reaper", "epic", "boss", "VOID"], ["Light of Solara", "exotic", "quest", "PLASMA"]],
};
const SOURCE_LABEL: Record<CatalogSource, string> = { shop: "Buy · weekly weapon stock", loot: "Loot · enemy drops", mission: "Missions", boss: "Boss drop", quest: "Quest reward" };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const WEAPON_CATALOG: readonly CatalogWeapon[] = (Object.entries(SHEET) as [CatalogClass, Row[]][]).flatMap(([cls, rows]) => rows.map(([name, rarity, via, element]) => ({
  id: `cat-${slug(name)}`, name, tier: TIER[rarity], archetype: ARCH[cls], element, durability: 100, perk: `${CLASS_LABEL[cls]} · ${rarity}`, source: SOURCE_LABEL[via], rarity, via, cls,
})));
export const catalogById = (id: string) => WEAPON_CATALOG.find((w) => w.id === id);
export const catalogFrom = (via: CatalogSource) => WEAPON_CATALOG.filter((w) => w.via === via);

/** the weekly reset: Monday 00:00 UTC, the same week for every client */
export const WEEK_MS = 7 * 86_400_000;
const MONDAY = Date.UTC(2024, 0, 1); // a Monday
export const catalogWeek = (now = Date.now()) => Math.floor((now - MONDAY) / WEEK_MS);
export const nextCatalogReset = (now = Date.now()) => MONDAY + (catalogWeek(now) + 1) * WEEK_MS;
/** this week's featured catalogue weapons at one shop: `count` distinct common (shop) weapons, shuffled per shop and week */
export function weeklyCatalogStock(shopId: string, now = Date.now(), count = 3): CatalogWeapon[] {
  const pool = [...catalogFrom("shop")];
  let h = 2166136261 >>> 0;
  for (const ch of shopId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  let st = (h ^ Math.imul(catalogWeek(now) + 1, 2654435761)) >>> 0;
  for (let i = pool.length - 1; i > 0; i--) { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; const j = st % (i + 1); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  return pool.slice(0, Math.min(count, pool.length));
}
