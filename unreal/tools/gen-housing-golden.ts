/**
 * Records golden housing behaviour from the web build's real housing.ts (buyHome, buyDecor, placeDecor, normalizeHousing)
 * and residence-deeds.ts (buyDeed, parkedIn, parkVehicle, unparkVehicle) for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/HousingCoreTest.cpp).
 *
 *   npx esbuild unreal/tools/gen-housing-golden.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/wf-house.mjs && node /tmp/wf-house.mjs
 *
 * Lines are tab-separated; "~" = absent. Catalog: HOME, DECOR, DEED, FLEETID. Cases: C, NEX, GAR, OWN; then OP lines each
 * followed by R (result) and S (ledger | housing); NORM lines check normalizeHousing.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOMES, DECOR, EMPTY_HOUSING, buyHome, buyDecor, placeDecor, normalizeHousing, type HousingState, type DecorSlot } from "../../src/game/housing";
import { deeds, buyDeed, parkedIn, parkVehicle, unparkVehicle, styleName } from "../../src/game/residence-deeds";
import { FLEET, GARAGES, EMPTY_FLEET, type FleetState, type GarageId } from "../../src/game/fleet";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "housing_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0x40be;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));

for (const h of HOMES) out("HOME", h.id, h.name, h.kind, h.district, h.regionId, h.garage ?? NONE, h.price, h.rooms.join(","));
for (const d of DECOR) out("DECOR", d.id, d.name, d.slot, d.price, d.rooms.join(","));
for (const d of deeds()) out("DEED", d.id, d.name, d.address, d.kind, styleName(d), d.city, d.district, d.price, d.bays);
for (const f of FLEET) out("FLEETID", f.id, f.name);

type Save = { nexLedger: Record<string, number>; housing: HousingState; fleet: FleetState };
const housingText = (h: HousingState) => [Object.keys(h.placed).sort().map((k) => `${k}:${Object.keys(h.placed[k]!).sort().map((r) => `${r}=${h.placed[k]![r]}`).join("/")}`).join(",") || NONE, h.home ?? NONE,
  Object.keys(h.parked ?? {}).sort().map((k) => `${k}=${h.parked![k]}`).join(",") || NONE].join("|");
const ledgerText = (l: Record<string, number>) => Object.keys(l).sort().map((k) => `${k}=${n(l[k]!)}`).join(",") || NONE;
const SLOTS: DecorSlot[] = ["wallpaper", "paint", "floor", "furniture", "art", "tv", "bed", "bath", "lighting"];
const ALL_HOMES = [...HOMES.map((h) => h.id), ...deeds().map((d) => d.id)];
let ops = 0;
for (let c = 0; c < 150; c++) {
  let p: Save = { nexLedger: {}, housing: { ...EMPTY_HOUSING, placed: {} }, fleet: { ...EMPTY_FLEET, owned: [], garages: [], tuning: {}, paint: {}, cosmetics: {} } };
  const grant = pick([0, 3000, 20000, 60000, 150000, 600000]);
  if (grant) p.nexLedger["seed:grant"] = grant;
  for (const g of Object.keys(GARAGES) as GarageId[]) if (rand() < 0.4) p.fleet.garages.push(g);
  for (const f of FLEET) if (rand() < 0.25) p.fleet.owned.push(f.id);
  out("C", `case-${c}`);
  for (const [k, v] of Object.entries(p.nexLedger)) out("NEX", k, v);
  for (const g of p.fleet.garages) out("GAR", g);
  for (const f of p.fleet.owned) out("OWN", f);
  for (let k = 0; k < 30; k++) {
    ops++;
    const r = rand();
    let res: { progression: Save; message: string } | { error: string };
    const owned = ALL_HOMES.filter((h) => `home:${h}` in p.nexLedger);
    if (r < 0.18) { const id = rand() < 0.95 ? pick(HOMES).id : "castle"; out("OP", "home", id); res = buyHome(p, id); }
    else if (r < 0.35) { const id = rand() < 0.95 ? pick(DECOR).id : "lava-lamp"; out("OP", "decor", id); res = buyDecor(p, id); }
    else if (r < 0.6) {
      const h = owned.filter((x) => HOMES.some((y) => y.id === x)), home = h.length && rand() < 0.85 ? pick(h) : pick(HOMES).id;
      const def = HOMES.find((x) => x.id === home)!, room = rand() < 0.9 ? Math.floor(rand() * def.rooms.length) : 9;
      const d = rand() < 0.15 ? null : rand() < 0.8 ? pick(DECOR) : null;
      const slot = d && rand() < 0.8 ? d.slot : pick(SLOTS);
      out("OP", "place", home, room, slot, d ? d.id : NONE); res = placeDecor(p, home, room, slot, d ? d.id : null);
    }
    else if (r < 0.75) { const id = rand() < 0.95 ? pick(deeds()).id : "nexus-home-99"; out("OP", "deed", id); res = buyDeed(p, id); }
    else if (r < 0.92) {
      const ownedDeeds = owned.filter((x) => deeds().some((d) => d.id === x)), deed = ownedDeeds.length && rand() < 0.85 ? pick(ownedDeeds) : pick(deeds()).id;
      const v = p.fleet.owned.length && rand() < 0.85 ? pick(p.fleet.owned) : pick(FLEET).id;
      out("OP", "park", v, deed, parkedIn(p, deed).join(",") || NONE); res = parkVehicle(p, v, deed);
    } else { const v = rand() < 0.8 && p.fleet.owned.length ? pick(p.fleet.owned) : pick(FLEET).id; out("OP", "unpark", v); res = unparkVehicle(p, v); }
    out("R", "error" in res ? `ERR:${res.error}` : `OK:${res.message}`);
    if (!("error" in res)) p = res.progression;
    out("S", ledgerText(p.nexLedger), housingText(p.housing));
  }
}
// normalizeHousing on messy saves
for (let i = 0; i < 80; i++) {
  const raw: { placed: Record<string, Record<string, unknown>>; home: unknown; parked: Record<string, unknown> } = { placed: {}, home: pick([null, "grid-loft", "no-home", 5, "nexus-home-3"]), parked: {} };
  for (let k = 0; k < 4; k++) { const h = pick([...HOMES.map((x) => x.id), "bogus-home"]); raw.placed[h] = raw.placed[h] ?? {}; raw.placed[h]![`${k}:${pick(SLOTS)}`] = pick([...DECOR.map((d) => d.id), "bogus-decor", 7]); }
  for (let k = 0; k < 3; k++) raw.parked[pick(FLEET).id] = pick(["", "nexus-home-2", "neon-home-11", "garage-9", 3]);
  const norm = normalizeHousing(raw);
  const show = (v: unknown) => typeof v === "string" ? v : `#${String(v)}`;
  out("NORM", Object.keys(raw.placed).map((h) => `${h}:${Object.entries(raw.placed[h]!).map(([k, v]) => `${k}=${show(v)}`).join("/")}`).join(","), show(raw.home), Object.entries(raw.parked).map(([k, v]) => `${k}=${show(v)}`).join(","), housingText(norm));
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`150 cases, ${ops} operations, ${lines.length} lines -> ${OUT}`);
