import { describe, expect, it } from "bun:test";
import { FOUNDRY_HUB, KITS, kitById, kitGun } from "./vehicle-foundry";
import { EMPTY_FLEET, FLEET, GARAGES, installKit, mergeFleet, normalizeFleet, tunedVehicle } from "./fleet";
import { armamentFor } from "./vehicle-weapons";
import { vehicleById } from "./vehicles";

const build = FLEET.find((f) => f.id === "goliath-4x4")!;
const save = (over: Record<string, unknown> = {}) => ({ nexLedger: {}, materials: { vehicleParts: 99, reinforcedAlloy: 99, microCircuits: 99, scrapMetal: 99, fuel: 99 }, ownedVehicles: [], garageLoadout: [], selectedVehicle: null, fleet: { ...EMPTY_FLEET, owned: [build.id], garages: [build.garage], active: build.id }, ...over });

describe("vehicle foundry", () => {
  it("every garage is a named hub and every kit with a pro has a con", () => {
    for (const id of Object.keys(GARAGES)) expect(FOUNDRY_HUB[id as keyof typeof FOUNDRY_HUB].name.length).toBeGreaterThan(3);
    for (const k of KITS) if (k.id !== "stock") { expect(k.pros.length).toBeGreaterThan(0); expect(k.cons.length).toBeGreaterThan(0); }
  });
  it("no kit is strictly better than stock: every non-stock kit makes something worse", () => {
    for (const k of KITS) {
      if (k.id === "stock") continue;
      const worse = Object.values(k.stats).some((v) => v! < 1) || k.gun.damage < 1 || k.gun.rate > 1;
      expect(worse).toBe(true);
    }
  });
  it("fitting a kit at the home hub pays materials and changes the drive and the guns", () => {
    const r = installKit(save(), build.id, "armored", build.garage);
    if ("error" in r) throw new Error(r.error);
    expect(r.progression.materials.reinforcedAlloy).toBe(89);
    const base = vehicleById(build.base), tuned = tunedVehicle(base, r.progression.fleet);
    expect(tuned.hull).toBeGreaterThan(base.hull);
    expect(tuned.speed).toBeLessThan(base.speed);
    const heavy = kitById("heavy-ordnance"), a0 = armamentFor(build.base, "OFFROAD", build.id), a1 = armamentFor(build.base, "OFFROAD", build.id, heavy);
    expect(a1.primary!.damage).toBeCloseTo(a0.primary!.damage * 1.6, 5);
    expect(a1.primary!.rate).toBeGreaterThan(a0.primary!.rate);
  });
  it("kits are fitted only at the build's own hub, and only to owned builds", () => {
    const other = (Object.keys(GARAGES) as (keyof typeof GARAGES)[]).find((g) => g !== build.garage)!;
    expect("error" in installKit(save(), build.id, "armored", other)).toBe(true);
    expect("error" in installKit(save({ fleet: EMPTY_FLEET }), build.id, "armored", build.garage)).toBe(true);
  });
  it("kits survive save normalisation and cloud merge (newer wins); junk is dropped", () => {
    const n = normalizeFleet({ ...EMPTY_FLEET, kits: { [build.id]: "stripped", "no-such": "armored", [FLEET[1]!.id]: "laser" } });
    expect(n.kits).toEqual({ [build.id]: "stripped" });
    const m = mergeFleet({ ...EMPTY_FLEET, kits: { [build.id]: "armored" } }, { ...EMPTY_FLEET, kits: { [build.id]: "stripped" } }, true);
    expect(m.kits?.[build.id]).toBe("armored");
  });
  it("stock leaves a gun untouched", () => {
    const g = { damage: 1, rate: 0.1, heat: 1 };
    expect(kitGun(g, kitById("stock"))).toBe(g);
  });
});
