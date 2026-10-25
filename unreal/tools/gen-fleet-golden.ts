/**
 * Records golden fleet and gadget behaviour from the web build's real fleet.ts (buyGarage, buyFleetVehicle, setActiveFleet,
 * tuneNode, setPaint, setVehicleCosmetic, tunedVehicle, fleetTuningSummary, sanctuariesFor) and vehicle-gadgets.ts for the
 * C++ port's test (Plugins/WorldFractureCore/Tests/FleetCoreTest.cpp).
 *
 *   npx esbuild unreal/tools/gen-fleet-golden.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/wf-fleet.mjs && node /tmp/wf-fleet.mjs
 *
 * Lines are tab-separated; "~" = absent. Catalog: FL (a build) with its N (tuning node) lines, GB (a garage base), VD (a chassis).
 * Cases: C, PMAT, NEX (ledger entry), then OP lines (each followed by R result and S state, TV / TS / SC reads); gadget
 * sequences: GC, then GOP lines each followed by GS (gadget state).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { FLEET, GARAGES, EMPTY_FLEET, buyGarage, buyFleetVehicle, setActiveFleet, tuneNode, setPaint, setVehicleCosmetic, tunedVehicle, fleetTuningSummary, sanctuariesFor, VEHICLE_COSMETIC_OPTIONS, type FleetState, type GarageId } from "../../src/game/fleet";
import { fleetNexPrice } from "../../src/game/market-prices";
import { VEHICLES, type VehicleId } from "../../src/game/vehicles";
import { freshGadgets, gadgetFor, GADGET_BY_BUILD, dropMine, mineTriggered, launchCaltrops, inCaltrops, inFlames, popFlares, stepFlares, spoofed, launchDrone, stepDrone, droneTarget, ramFor, slowFor, type GadgetState } from "../../src/game/vehicle-gadgets";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "fleet_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0xf1ee7;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const range = (a: number, b: number) => a + rand() * (b - a);
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const cost = (c: Record<string, number | undefined>) => Object.entries(c).map(([k, v]) => `${k}=${n(v!)}`).join(";") || NONE;

for (const f of FLEET) {
  out("FL", f.id, f.name, f.category, f.base, f.garage, f.ability, fleetNexPrice(f.id), cost(f.cost), f.hardpoints.join("|"), f.paints.join("|"));
  for (const nd of f.nodes) out("N", nd.id, nd.name, nd.text, nd.stat, nd.perLevel, nd.maxLevel, cost(nd.cost));
}
for (const g of Object.values(GARAGES)) out("GB", g.id, g.name, g.region, g.x, g.z, g.deckY === undefined ? 0 : 1, cost(g.cost));
for (const v of VEHICLES) out("VD", v.id, v.name, v.speed, v.hull, v.handling, v.ram);

type Save = { nexLedger: Record<string, number>; fleet: FleetState; materials: Record<string, number>; ownedVehicles: VehicleId[]; garageLoadout: VehicleId[]; selectedVehicle: VehicleId | null; earnedRewards: string[] };
const fleetText = (f: FleetState) => [f.owned.join(",") || NONE, f.garages.join(",") || NONE,
  Object.keys(f.tuning).sort().map((k) => `${k}:${Object.keys(f.tuning[k]!).sort().map((nd) => `${nd}=${n(f.tuning[k]![nd]!)}`).join("/")}`).join(",") || NONE,
  Object.keys(f.paint).sort().map((k) => `${k}=${f.paint[k]}`).join(",") || NONE, f.active ?? NONE,
  Object.keys(f.cosmetics ?? {}).sort().map((k) => { const c = f.cosmetics![k]!; return `${k}=${c.wheels}/${c.body}/${c.spoiler}/${c.armor}/${c.glow}`; }).join(",") || NONE].join("|");
const stateText = (p: Save) => [Object.keys(p.materials).sort().map((k) => `${k}=${n(p.materials[k]!)}`).join(",") || NONE, Object.keys(p.nexLedger).sort().map((k) => `${k}=${n(p.nexLedger[k]!)}`).join(",") || NONE,
  fleetText(p.fleet), p.ownedVehicles.join(",") || NONE, p.garageLoadout.join(",") || NONE, p.selectedVehicle ?? NONE].join("#");

const MATS = ["vehicleParts", "scrapMetal", "fuel", "reinforcedAlloy", "microCircuits", "cryoCrystal", "dataShards", "bioCatalyst", "aegisCore"];
const GIDS = Object.keys(GARAGES) as GarageId[];
let ops = 0;
for (let c = 0; c < 100; c++) {
  let p: Save = { nexLedger: {}, fleet: { ...EMPTY_FLEET, owned: [], garages: [], tuning: {}, paint: {}, cosmetics: {} }, materials: {}, ownedVehicles: [], garageLoadout: [], selectedVehicle: null, earnedRewards: [] };
  for (const m of MATS) if (rand() < 0.85) p.materials[m] = pick([0, 5, 20, 40, 80, 200, 400]);
  const nex = pick([0, 5000, 40000, 200000, 400000]);
  if (nex) p.nexLedger["seed:grant"] = nex;
  if (rand() < 0.3) { const v = pick(VEHICLES).id as VehicleId; p.ownedVehicles = [v]; p.garageLoadout = [v]; p.selectedVehicle = v; }
  out("C", `case-${c}`);
  for (const [k, v] of Object.entries(p.materials)) out("PMAT", k, v);
  for (const [k, v] of Object.entries(p.nexLedger)) out("NEX", k, v);
  for (const v of p.ownedVehicles) out("OWNV", v);
  for (let k = 0; k < 24; k++) {
    ops++;
    const r = rand();
    let res: { progression: Save; message: string } | { error: string };
    if (r < 0.2) { const g = rand() < 0.7 ? pick(GIDS.filter((x) => !p.fleet.garages.includes(x)).concat(GIDS)) : pick(GIDS); out("OP", "garage", g); res = buyGarage(p, g); }
    else if (r < 0.45) { const can = FLEET.filter((x) => p.fleet.garages.includes(x.garage) && !p.fleet.owned.includes(x.id)); const f = can.length && rand() < 0.7 ? pick(can).id : rand() < 0.95 ? pick(FLEET).id : "no-such"; out("OP", "buy", f); res = buyFleetVehicle(p, f); }
    else if (r < 0.55) { const f = p.fleet.owned.length && rand() < 0.8 ? pick(p.fleet.owned) : pick(FLEET).id; out("OP", "active", f); res = setActiveFleet(p, f); }
    else if (r < 0.8) { const f = p.fleet.owned.length && rand() < 0.85 ? pick(p.fleet.owned) : pick(FLEET).id; const e = FLEET.find((x) => x.id === f)!; const nd = rand() < 0.9 ? pick(e.nodes).id : "bogus"; out("OP", "tune", f, nd); res = tuneNode(p, f, nd); }
    else if (r < 0.9) { const f = p.fleet.owned.length && rand() < 0.85 ? pick(p.fleet.owned) : pick(FLEET).id; const e = FLEET.find((x) => x.id === f)!; const paint = rand() < 0.85 ? pick(e.paints) : "Hot Pink"; out("OP", "paint", f, paint); res = setPaint(p, f, paint); }
    else { const f = p.fleet.owned.length && rand() < 0.85 ? pick(p.fleet.owned) : pick(FLEET).id; const key = pick(Object.keys(VEHICLE_COSMETIC_OPTIONS)) as keyof typeof VEHICLE_COSMETIC_OPTIONS; const val = rand() < 0.85 ? pick(VEHICLE_COSMETIC_OPTIONS[key]) : "chrome"; out("OP", "cosmetic", f, key, val); res = setVehicleCosmetic(p, f, key, val as never); }
    out("R", "error" in res ? `ERR:${res.error}` : `OK:${res.message}`);
    if (!("error" in res)) p = res.progression;
    out("S", stateText(p));
    if (rand() < 0.3) for (const v of VEHICLES) { const t = tunedVehicle(v, p.fleet); if (t !== v) out("TV", v.id, t.name, t.speed, t.hull, t.handling, t.ram); }
    const sm = fleetTuningSummary(p.fleet);
    out("TS", sm ? `${sm.buildName}|${sm.category}|${sm.ability}|${sm.stats.map((s) => `${s.stat}/${n(s.level)}/${n(s.maxLevel)}/${n(s.bonus)}`).join(",")}` : NONE);
    out("SC", sanctuariesFor(p).map((s) => `${n(s.x)}/${n(s.z)}/${n(s.radius)}`).join(",") || NONE);
  }
}

// ---- gadgets ----
const gText = (st: GadgetState) => [st.mines.map((m) => `${m.kind}/${n(m.x)}/${n(m.y)}/${n(m.z)}/${n(m.armAt)}/${n(m.until)}/${n(m.id)}`).join(";") || NONE,
  st.caltrops.map((c) => `${n(c.x)}/${n(c.z)}/${n(c.r)}/${n(c.until)}/${n(c.id)}`).join(";") || NONE,
  st.drones.map((d) => `${n(d.x)}/${n(d.y)}/${n(d.z)}/${n(d.until)}/${n(d.cool)}/${n(d.angle)}/${n(d.id)}`).join(";") || NONE,
  st.flares.map((f) => `${n(f.x)}/${n(f.y)}/${n(f.z)}/${n(f.vx)}/${n(f.vy)}/${n(f.vz)}/${n(f.until)}`).join(";") || NONE, n(st.spoofUntil), n(st.nextId)].join("|");
for (const id of [...Object.keys(GADGET_BY_BUILD), "goliath-tank", ""]) { const g = gadgetFor(id || null); out("GF", id || NONE, g ? `${g.kind}|${g.name}|${g.use}|${n(g.cooldown)}` : NONE); }
for (let c = 0; c < 70; c++) {
  const st = freshGadgets();
  let now = 1000 + c;
  out("GC", c, now);
  for (let k = 0; k < 30; k++) {
    const r = rand();
    const targets = Array.from({ length: Math.floor(rand() * 6) }, () => ({ x: range(-20, 20), z: range(-20, 20), alive: rand() < 0.85 }));
    const tt = targets.map((t) => `${n(t.x)}/${n(t.z)}/${t.alive ? 1 : 0}`).join(";") || NONE;
    if (r < 0.15) { const kind = rand() < 0.5 ? "MINE" : "EMP_MINE"; const x = range(-10, 10), y = range(0, 3), z = range(-10, 10); dropMine(st, kind, x, y, z, now); out("GOP", "mine", kind, x, y, z, now); }
    else if (r < 0.3) { out("GOP", "trig", now, tt, st.mines.map((m) => mineTriggered(m, now, targets) ? 1 : 0).join(",") || NONE); }
    else if (r < 0.4) { const x = range(-10, 10), z = range(-10, 10); launchCaltrops(st, x, z, now); out("GOP", "caltrops", x, z, now); }
    else if (r < 0.5) { const x = range(-15, 15), z = range(-15, 15); out("GOP", "incal", x, z, now, inCaltrops(st, x, z, now) ? 1 : 0); }
    else if (r < 0.6) { const sx = range(-5, 5), sz = range(-5, 5), yaw = range(-7, 7), body = pick([0, 0, 1.2, 2.4]); out("GOP", "flame", sx, sz, yaw, body, tt, targets.map((t) => inFlames({ x: sx, z: sz, yaw }, t, body) ? 1 : 0).join(",") || NONE); }
    else if (r < 0.68) { const x = range(-5, 5), y = range(5, 40), z = range(-5, 5), yaw = range(-7, 7); popFlares(st, x, y, z, yaw, now); out("GOP", "flares", x, y, z, yaw, now); }
    else if (r < 0.76) { const x = range(-5, 5), y = range(0, 5), z = range(-5, 5); launchDrone(st, x, y, z, now); out("GOP", "drone", x, y, z, now); }
    else if (r < 0.88) {
      const dt = pick([0.016, 0.05, 0.1, 0.25]), px = range(-10, 10), py = range(0, 5), pz = range(-10, 10);
      now += dt;
      stepFlares(st, now, dt);
      const vis = targets.map(() => rand() < 0.8);
      const hits = st.drones.map((d) => { stepDrone(d, { x: px, y: py, z: pz }, dt); return droneTarget(d, targets, (i) => vis[i]!); });
      out("GOP", "step", dt, now, px, py, pz, tt, vis.map((v) => (v ? 1 : 0)).join(",") || NONE, hits.join(",") || NONE, spoofed(st, now) ? 1 : 0);
    } else {
      const id = pick([...Object.keys(GADGET_BY_BUILD), "rift-runner"]), bu = now + range(-1, 2), boss = rand() < 0.3, base = pick([0.25, 0.4, 0.9]);
      const rm = ramFor(gadgetFor(id), bu, now);
      out("GOP", "ram", id, bu, now, `${n(rm.damageMult)}/${n(rm.selfMult)}`, boss ? 1 : 0, base, slowFor(base, boss));
    }
    out("GS", gText(st));
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`100 fleet cases (${ops} operations), 70 gadget runs, ${lines.length} lines -> ${OUT}`);
