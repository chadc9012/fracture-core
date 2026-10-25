/**
 * Records golden merchant behaviour from the web build's real regional-shops.ts (shopOffers, shopLock, shopPriceMult,
 * buyOffer, serviceFee, serviceTargets, serviceGear), weapon-catalog.ts weeklyCatalogStock, shop-hours.ts, living-world.ts
 * (adjustRep, recordDistrict, livingShopTerms) and inventory.ts upgradeGear / infuseGear for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/ShopCoreTest.cpp).
 *
 *   npx esbuild unreal/tools/gen-shop-golden.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/wf-shop.mjs && node /tmp/wf-shop.mjs
 *
 * Date.now is pinned per case; the one Math.random draw a gear purchase makes (its id suffix) is recorded on its line.
 * Lines are tab-separated; "~" = absent. Catalog: W / A / NW / COL / SET / SHOP. Cases: C, then PM / PMAT / PI / LG / LL / LD,
 * then OFF (offers, followed by O lines), LOCK, BUY, SVC, UP, INF, REP, DIST, HR, each followed by its result.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { REGIONAL_SHOPS, shopOffers, shopLock, shopPriceMult, buyOffer, serviceFee, serviceTargets, serviceGear, type ShopOffer } from "../../src/game/regional-shops";
import { weeklyCatalogStock, WEAPON_CATALOG } from "../../src/game/weapon-catalog";
import { setShopClockHour, shopHours, isOpenAt } from "../../src/game/shop-hours";
import { adjustRep, recordDistrict, livingShopTerms, SHOP_FACTION, districtOf, EMPTY_LIVING, type FactionId, type LivingState } from "../../src/game/living-world";
import { upgradeGear, infuseGear, type GearItem, type MaterialId } from "../../src/game/inventory";
import { WEAPON_MANIFEST, ARMOR_MANIFEST } from "../../src/game/equipment";
import { COLLECTIONS } from "../../src/game/armor-collections";
import { ARMOR_SETS, SET_SLOTS } from "../../src/game/armor-sets";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "shop_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0x5b0b;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
let nowMs = 0;
Date.now = () => nowMs;
let nextRandom: number | null = null;
Math.random = () => { if (nextRandom === null) throw new Error("unexpected Math.random"); const v = nextRandom; nextRandom = null; return v; };

const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const gear = (g: GearItem) => [g.id, g.name, g.slot, n(g.power), n(g.level), g.element, g.source, g.setId ?? "", g.rarity ?? "", g.perk ?? ""].join("|");

// ---- catalog ----
for (const w of WEAPON_MANIFEST) out("W", w.id, w.name, w.tier, w.archetype, w.element);
for (const a of ARMOR_MANIFEST) out("A", a.id, a.name, a.tier, a.slot, a.classId);
for (const w of WEAPON_CATALOG) out("NW", w.id, w.name, w.tier, w.archetype, w.element, w.rarity, w.via, w.cls);
for (const c of COLLECTIONS) out("COL", c.id, c.name, c.family, c.sources.join(",") || NONE, c.vendorTier ?? 0, SET_SLOTS.map((s) => `${s}=${c.pieces[s] ?? ""}`).join(";"), c.two.name, c.four.name);
for (const s of ARMOR_SETS) out("SET", s.id, s.name, s.regionId ?? "", s.element, ...SET_SLOTS.map((k) => s.pieces[k] ?? ""));
for (const s of REGIONAL_SHOPS) { const d = districtOf(s.x, s.z); out("SHOP", s.id, s.name, s.kind, s.place, s.currency, s.x, s.z, s.priceMult, s.minLevel, s.vendorTier ?? 0, s.requires?.missionId ?? NONE, s.requires?.label ?? NONE, s.minStanding ?? NONE, SHOP_FACTION[s.id] ?? NONE, d?.id ?? NONE, d?.name ?? NONE); }

const offerText = (o: ShopOffer) => [o.key, o.type, o.name, o.detail, n(o.price), n(o.minLevel), o.type === "piece" && o.deal ? 1 : 0, o.type === "material" ? `${o.material}/${n(o.amount)}` : NONE,
  o.type === "gear" ? `${o.listing.kind}/${o.listing.item.id}/${n(o.listing.power)}` : NONE, o.type === "piece" ? `${o.drop.setId}/${o.drop.slot}` : NONE].join("|");
const stateText = (p: PlayerProgression) => {
  const mats = Object.keys(p.materials).sort().filter((k) => p.materials[k as MaterialId] !== undefined).map((k) => `${k}=${n(p.materials[k as MaterialId]!)}`).join(",");
  return `${mats}#${p.inventory.map(gear).join(";")}`;
};
const livingText = (l: LivingState) => [Object.keys(l.gain).sort().map((k) => `${k}=${n(l.gain[k as FactionId]!)}`).join(","), Object.keys(l.loss).sort().map((k) => `${k}=${n(l.loss[k as FactionId]!)}`).join(","),
  Object.keys(l.districts).sort().map((k) => `${k}=${n(l.districts[k]!.securedAt)}/${n(l.districts[k]!.fallenAt)}`).join(",")].join("|");

const MISSIONS = [...new Set(REGIONAL_SHOPS.filter((s) => s.requires).map((s) => s.requires!.missionId))];
const MATS: MaterialId[] = [...new Set(REGIONAL_SHOPS.map((s) => s.currency)), "thermalShards", "cryoCrystal", "sporeFiber", "bioCatalyst", "microCircuits", "forgeCatalyst", "tuningCore", "vehicleParts", "reinforcedAlloy", "scrapMetal"];
const FACTIONS: FactionId[] = ["wardens", "guild", "syndicate", "aegis"];
const DISTRICTS = ["nexus:spire", "nexus:market", "nexus:shipyard", "nexus:arcology", "neon:spire", "neon:undercity", "neon:market", "neon:grid"];
const ELEMENTS: GearItem["element"][] = ["KINETIC", "THERMAL", "CRYO", "ARC", "BIO"];
const SLOTS: GearItem["slot"][] = ["primary", "secondary", "heavy", "helmet", "chest", "gauntlets", "legs", "classItem", "vehicle"];

let ops = 0;
for (let c = 0; c < 140; c++) {
  nowMs = 1_700_000_000_000 + Math.floor(rand() * 400) * 86_400_000 + Math.floor(rand() * 86_400_000);
  const hour = rand() < 0.3 ? null : pick([0, 1, 3, 4.99, 5, 12, 17.5, 18, 23, 24.5, rand() * 24]);
  setShopClockHour(hour);
  let p: PlayerProgression = { ...DEFAULT_PROGRESSION, level: pick([1, 2, 3, 5, 6, 8, 10, 12, 20]), completedMissions: MISSIONS.filter(() => rand() < 0.5), materials: {}, inventory: [], equippedGear: {}, living: EMPTY_LIVING };
  for (const m of MATS) if (rand() < 0.8) p.materials[m] = pick([0, 1, 2, 3, 5, 10, 25, 60, 150, 400, 2000]);
  for (let i = 0, k = 2 + Math.floor(rand() * 7); i < k; i++) {
    const set = rand() < 0.25 ? pick(ARMOR_SETS) : null;
    const slot = set ? pick(SET_SLOTS) : pick(SLOTS);
    p.inventory.push({ id: `inv-${c}-${i}`, name: `Item ${i}`, slot, power: 100 + Math.floor(rand() * 200), level: 1 + Math.floor(rand() * 11), element: pick(ELEMENTS), source: "test", ...(set ? { setId: set.id } : {}) });
  }
  let living: LivingState = EMPTY_LIVING;
  for (const f of FACTIONS) { if (rand() < 0.5) living = adjustRep(living, f, pick([5, 15, 30, 60, 120]), false); if (rand() < 0.35) living = adjustRep(living, f, -pick([5, 15, 30, 60, 120]), false); }
  for (const d of DISTRICTS) if (rand() < 0.3) living = recordDistrict(living, d, rand() < 0.6 ? "WON" : "FAILED", nowMs - Math.floor(rand() * 4) * 86_400_000);
  p = { ...p, living };
  out("C", `case-${c}`, nowMs, hour === null ? NONE : hour, p.level);
  for (const m of p.completedMissions) out("PM", m);
  for (const [k, v] of Object.entries(p.materials)) out("PMAT", k, v!);
  for (const g of p.inventory) out("PI", gear(g));
  out("LIV", livingText(p.living));
  for (let k = 0; k < 26; k++) {
    const shop = pick(REGIONAL_SHOPS), r = rand();
    ops++;
    if (r < 0.3) {
      const day = Math.floor(nowMs / 86_400_000) + pick([0, 0, 1, 3, 7, -2]);
      const mult = shopPriceMult(shop, p);
      const offers = shopOffers(shop, day, mult);
      out("OFF", shop.id, day, mult, offers.length);
      for (const o of offers) out("O", offerText(o));
      out("LOCK", shop.id, shopLock(shop, p) ?? NONE, livingShopTerms(p.living, shop, nowMs).lock ?? NONE, livingShopTerms(p.living, shop, nowMs).priceMult);
    } else if (r < 0.58) {
      const offers = shopOffers(shop, Math.floor(nowMs / 86_400_000), shopPriceMult(shop, p));
      if (!offers.length) continue;
      const i = Math.floor(rand() * offers.length), rv = rand();
      nextRandom = rv;
      const res = buyOffer(p, shop, offers[i]!);
      nextRandom = null;
      out("BUY", shop.id, i, rv, "error" in res ? `ERR:${res.error}` : `OK:${res.message}`);
      if (!("error" in res)) p = res.progression;
      out("ST", stateText(p));
    } else if (r < 0.78) {
      const svcShops = REGIONAL_SHOPS.filter((x) => ["gunsmith", "mods", "armorsmith", "vehicles"].includes(x.kind) && x.minLevel <= p.level && (!x.requires || p.completedMissions.includes(x.requires.missionId)));
      const shop = svcShops.length && rand() < 0.85 ? pick(svcShops) : pick(REGIONAL_SHOPS);
      const targets = serviceTargets(shop, p);
      const id = targets.length && rand() < 0.85 ? pick(targets).id : pick(p.inventory).id;
      const el = shop.kind === "mods" && rand() < 0.8 ? pick(ELEMENTS) : undefined;
      const item = p.inventory.find((g) => g.id === id)!;
      out("SVC", shop.id, id, el ?? NONE, serviceFee(shop, item), targets.map((t) => t.id).join(",") || NONE);
      const res = serviceGear(p, shop, id, el);
      out("SR", "error" in res ? `ERR:${res.error}` : `OK:${res.message}`);
      if (!("error" in res)) p = res.progression;
      out("ST", stateText(p));
    } else if (r < 0.86) {
      const g = pick(p.inventory);
      if (rand() < 0.5) { const next = upgradeGear(p, g.id); out("UP", g.id, next === p ? 0 : 1); p = next; }
      else { const el = pick(ELEMENTS), next = infuseGear(p, g.id, el); out("INF", g.id, el, next === p ? 0 : 1); p = next; }
      out("ST", stateText(p));
    } else if (r < 0.93) {
      const f = pick(FACTIONS), amt = pick([-40, -12, -3, 3, 7, 13, 25, 50]), spill = rand() < 0.7;
      p = { ...p, living: adjustRep(p.living, f, amt, spill) };
      out("REP", f, amt, spill ? 1 : 0, livingText(p.living));
    } else {
      const d = pick(DISTRICTS), won = rand() < 0.5, at = nowMs - Math.floor(rand() * 3) * 86_400_000;
      p = { ...p, living: recordDistrict(p.living, d, won ? "WON" : "FAILED", at) };
      out("DIST", d, won ? 1 : 0, at, livingText(p.living));
    }
  }
}
// weekly catalogue and hours on their own
for (let i = 0; i < 200; i++) { const s = pick(REGIONAL_SHOPS), t = 1_650_000_000_000 + Math.floor(rand() * 2000) * 3_600_000; out("WK", s.id, t, weeklyCatalogStock(s.id, t).map((w) => w.id).join(",")); }
for (const s of REGIONAL_SHOPS) for (const h of [null, -1, 0, 0.5, 1, 4.99, 5, 12, 17.99, 18, 23.5, 24, 25, 48.2]) { const hrs = shopHours(s); out("HR", s.id, h === null ? NONE : h, isOpenAt(hrs, h) ? 1 : 0); }
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`140 cases, ${ops} operations, ${lines.length} lines -> ${OUT}`);
