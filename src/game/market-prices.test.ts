import { describe, expect, test } from "bun:test";
import { FLEET, GARAGES, buyFleetVehicle, buyGarage, EMPTY_FLEET } from "./fleet";
import { FLEET_NEX_PRICE, fleetNexPrice, USD_PER_NEX } from "./market-prices";
import { DEFAULT_PROGRESSION } from "./progression";
import { nexBalance } from "./nex";
import { HOMES } from "./housing";

const by = (cat: string) => FLEET.filter((f) => f.category === cat).map((f) => fleetNexPrice(f.id));
describe("market prices", () => {
  test("every fleet build has a price and nothing orphaned is priced", () => {
    for (const f of FLEET) expect(fleetNexPrice(f.id)).toBeGreaterThan(0);
    for (const id of Object.keys(FLEET_NEX_PRICE)) expect(FLEET.some((f) => f.id === id)).toBe(true);
  });
  test("tiers: aircraft cost more than land vehicles on average (a supercar can match an attack helicopter); the exotic tops everything", () => {
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(avg(by("AIR"))).toBeGreaterThan(avg(by("LAND")) * 3);
    const all = FLEET.map((f) => fleetNexPrice(f.id));
    expect(fleetNexPrice("void-skimmer-prototype")).toBe(Math.max(...all));
  });
  test("anchored to the reference scale: helicopter $1.75M, VTOL $3.99M, fighter $6.5M, luxury jet $10M", () => {
    expect(fleetNexPrice("skyhawk") * USD_PER_NEX).toBe(1_750_000);
    expect(fleetNexPrice("valkyrie-vtol") * USD_PER_NEX).toBe(3_990_000);
    expect(fleetNexPrice("f39-jupiter") * USD_PER_NEX).toBe(6_500_000);
    expect(fleetNexPrice("void-skimmer-prototype") * USD_PER_NEX).toBe(10_000_000);
  });
  test("housing sits on the same scale: no home costs more than a $20M mansion", () => {
    expect(Math.max(...HOMES.map((h) => h.price)) * USD_PER_NEX).toBeLessThanOrEqual(20_000_000);
  });
  test("buying a build charges its Nex once, on top of parts; short of Nex it refuses and keeps the parts", () => {
    const base = { ...DEFAULT_PROGRESSION, ownedVehicles: [], garageLoadout: [], selectedVehicle: null, fleet: EMPTY_FLEET, materials: { scrapMetal: 500, vehicleParts: 100, fuel: 60, reinforcedAlloy: 80, microCircuits: 80, cryoCrystal: 20, dataShards: 30, bioCatalyst: 20 } };
    const g = buyGarage({ ...base, nexLedger: { seed: 10000 } }, "base-01"); if ("error" in g) throw new Error(g.error);
    const broke = buyFleetVehicle({ ...g.progression, nexLedger: { seed: 100 } }, "goliath-4x4");
    expect("error" in broke && broke.error).toContain("Needs 4,500 Nex");
    const ok = buyFleetVehicle({ ...g.progression, nexLedger: { seed: 10000 } }, "goliath-4x4"); if ("error" in ok) throw new Error(ok.error);
    expect(nexBalance(ok.progression.nexLedger)).toBe(10000 - 4500);
    expect(GARAGES["base-01"]).toBeDefined();
  });
});
