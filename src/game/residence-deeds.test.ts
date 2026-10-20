import { describe, expect, test } from "bun:test";
import { BAY_W, GARAGE_D, bayApron, bayPose, footprint, garageRect, garageWalls, residences } from "./residences";
import { buyDeed, deedNear, deeds, garageAt, ownsDeed, parkVehicle, parkedAt, parkedIn, unparkVehicle, frontDoor } from "./residence-deeds";
import { buyListing, listings, ownsListing } from "./property-listings";
import { normalizeHousing, mergeHousing, EMPTY_HOUSING, HOMES } from "./housing";
import { EMPTY_FLEET } from "./fleet";
import { collideWalls, setWalls } from "./walls";
import { heightAt, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";

const rich = () => ({ nexLedger: { grant: 1_000_000 } as Record<string, number>, housing: EMPTY_HOUSING, fleet: { ...EMPTY_FLEET, owned: ["ghost-ray", "valkyrie-vtol", "goliath-4x4"], garages: ["base-02" as const] } });
const overlap = (a: { x: number; z: number; hx: number; hz: number }, b: { x: number; z: number; hx: number; hz: number }) => Math.abs(a.x - b.x) < a.hx + b.hx && Math.abs(a.z - b.z) < a.hz + b.hz;

describe("residence garages", () => {
  const homes = residences();
  test("nearly every walk-in home gets its own garage beside it, overlapping no home or other garage", () => {
    expect(homes.filter((h) => h.garage).length).toBeGreaterThanOrEqual(homes.length - 1);
    const rects = [...homes.map((h) => ({ x: h.x, z: h.z, ...footprint(h) })), ...homes.filter((h) => h.garage).map((h) => garageRect(h.garage!))];
    for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) expect(overlap(rects[a]!, rects[b]!)).toBe(false);
    for (const h of homes) if (h.garage && h.city === "nexus") {
      const r = garageRect(h.garage);
      for (const [x, z] of [[r.x - r.hx, r.z - r.hz], [r.x + r.hx, r.z + r.hz]] as const) { expect(heightAt(x, z)).toBeGreaterThan(WATER_LEVEL); expect(distanceToRoad(x, z)).toBeGreaterThan(LANE_HALF_WIDTH); }
    }
  });
  test("a closed door is a wall across the bay; an open one lets a car through", () => {
    const h = homes.find((r) => r.garage)!, g = h.garage!;
    const outside = bayApron(g, 0), inside = bayPose(g, 0);
    const drive = (open: boolean) => {
      setWalls("t", garageWalls(g, Array.from({ length: g.bays }, () => open)));
      const body = { ...outside };
      for (let i = 0; i < 300; i++) { const dx = inside.x - body.x, dz = inside.z - body.z, d = Math.hypot(dx, dz); if (d < 0.05) break; body.x += (dx / d) * 0.1; body.z += (dz / d) * 0.1; collideWalls(body, 0.9, g.floor + 0.5); }
      return Math.hypot(body.x - inside.x, body.z - inside.z);
    };
    expect(drive(false)).toBeGreaterThan(1.5);
    expect(drive(true)).toBeLessThan(0.2);
    setWalls("t", []);
    expect(BAY_W).toBeGreaterThan(3);
    expect(GARAGE_D).toBeGreaterThan(6);
  });
  test("stepping out inside a garage finds it; the street outside the front door finds the home", () => {
    for (const h of homes) {
      if (h.garage) expect(garageAt(bayPose(h.garage, 0).x, bayPose(h.garage, 0).z)).toBe(h.id);
      const d = frontDoor(h);
      expect(deedNear(d.x, d.z)).toBe(h.id);
    }
  });
});

describe("residence deeds", () => {
  test("every residence has one deed with a unique address and a Nex price; Neon costs more", () => {
    const ds = deeds();
    expect(ds.length).toBe(residences().length);
    expect(new Set(ds.map((d) => d.address)).size).toBe(ds.length);
    for (const d of ds) expect(d.price).toBeGreaterThan(0);
    const neonApt = ds.find((d) => d.city === "Neon City" && d.residence.style === "apartment"), nexApt = ds.find((d) => d.city === "Nexus City" && d.residence.style === "apartment");
    if (neonApt && nexApt) expect(neonApt.price).toBeGreaterThan(nexApt.price);
  });
  test("buying spends Nex once; you can't buy twice or without the money", () => {
    const d = deeds()[0]!, p = rich();
    const r = buyDeed(p, d.id);
    if ("error" in r) throw new Error(r.error);
    expect(ownsDeed(r.progression, d.id)).toBe(true);
    expect("error" in buyDeed(r.progression, d.id)).toBe(true);
    expect("error" in buyDeed({ nexLedger: {} }, d.id)).toBe(true);
  });
  test("parking: owned vehicle into an owned home, capacity enforced, moving and taking out, survives normalize and merge", () => {
    const d = deeds().find((x) => x.bays >= 1)!;
    let p = rich();
    expect("error" in parkVehicle(p, "ghost-ray", d.id)).toBe(true); // not owned yet
    const b = buyDeed(p, d.id); if ("error" in b) throw new Error(b.error); p = b.progression;
    const r = parkVehicle(p, "ghost-ray", d.id); if ("error" in r) throw new Error(r.error); p = r.progression;
    expect(parkedIn(p, d.id)).toEqual(["ghost-ray"]);
    expect("error" in parkVehicle(p, "nautilus-abyss", d.id)).toBe(true); // not in the fleet
    const fill = ["valkyrie-vtol", "goliath-4x4"].slice(0, d.bays - 1);
    for (const v of fill) { const x = parkVehicle(p, v, d.id); if ("error" in x) throw new Error(x.error); p = x.progression; }
    const extra = ["valkyrie-vtol", "goliath-4x4"][d.bays - 1];
    if (extra) expect("error" in parkVehicle(p, extra, d.id)).toBe(true);
    const out = unparkVehicle(p, "ghost-ray"); if ("error" in out) throw new Error(out.error);
    expect(parkedAt(out.progression)["ghost-ray"]).toBeUndefined();
    // the taken-out tombstone wins over an older copy that still had it parked
    const merged = mergeHousing(normalizeHousing(out.progression.housing), normalizeHousing(p.housing), true);
    expect(parkedAt({ housing: merged })["ghost-ray"]).toBeUndefined();
    expect(normalizeHousing({ parked: { "ghost-ray": "nope", x: d.id } }).parked).toEqual({ x: d.id });
  });
});

describe("property store listings", () => {
  test("the store lists every agent home and every walk-in home once, and buys through each system", () => {
    const ls = listings();
    expect(new Set(ls.map((l) => l.id)).size).toBe(ls.length);
    expect(ls.length).toBe(HOMES.length + deeds().length);
    const p = rich();
    for (const id of [HOMES[0]!.id, deeds()[0]!.id]) { const r = buyListing(p, id); if ("error" in r) throw new Error(r.error); expect(ownsListing(r.progression, id)).toBe(true); }
    for (const l of ls) if (l.source === "deed") expect(l.door).toBeDefined();
  });
});
