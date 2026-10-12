// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it, mock } from "bun:test";
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { mergeProgression } = await import("./cloud-save");
const { DEFAULT_PROGRESSION, normalizeProgression } = await import("./progression");
const { EMPTY_FLEET, FLEET, GARAGES, buyFleetVehicle, buyGarage, garageNear, mergeFleet, normalizeFleet, setActiveFleet, setPaint, tuneNode, tunedVehicle } = await import("./fleet");
const { VEHICLES, vehicleById } = await import("./vehicles");
const { regionActivities } = await import("./map-activities");
const { REGIONS } = await import("./world");
const { CAMPAIGN, campaignProgress } = await import("./campaign");
const { CHRONICLE } = await import("./retention");

type P = typeof DEFAULT_PROGRESSION;
const ok = (r: { progression: P; message: string } | { error: string }) => { if ("error" in r) throw new Error(r.error); return r.progression; };
const rich = (): P => ({ ...DEFAULT_PROGRESSION, ownedVehicles: [], garageLoadout: [], selectedVehicle: null, fleet: EMPTY_FLEET, materials: { scrapMetal: 200, vehicleParts: 60, fuel: 60, reinforcedAlloy: 80, microCircuits: 80, cryoCrystal: 20, dataShards: 30, bioCatalyst: 20, aegisCore: 3 } });

describe("fleet", () => {
  it("every fleet build drives as a real vehicle and lives in a real garage", () => {
    for (const f of FLEET) {
      expect(VEHICLES.some((v) => v.id === f.base)).toBe(true);
      expect(GARAGES[f.garage]).toBeDefined();
      expect(f.nodes.length).toBeGreaterThan(0);
    }
  });
  it("needs the base first, pays materials, unlocks the drivable vehicle and makes it active", () => {
    let p = rich();
    expect("error" in buyFleetVehicle(p, "goliath-4x4")).toBe(true);
    p = ok(buyGarage(p, "base-01"));
    expect(p.materials.scrapMetal).toBe(160);
    expect("error" in buyGarage(p, "base-01")).toBe(true);
    p = ok(buyFleetVehicle(p, "goliath-4x4"));
    expect(p.ownedVehicles).toContain("wasteland-jeep");
    expect(p.selectedVehicle).toBe("wasteland-jeep");
    expect(p.fleet.active).toBe("goliath-4x4");
    expect(p.materials.vehicleParts).toBe(52);
    expect("error" in buyFleetVehicle(p, "goliath-4x4")).toBe(true);
  });
  it("refuses what you can't afford and changes nothing", () => {
    const p = { ...rich(), materials: {} };
    const r = buyGarage(p, "base-02");
    expect("error" in r).toBe(true);
  });
  it("tuning changes the active vehicle's real numbers and stops at max", () => {
    let p = ok(buyFleetVehicle(ok(buyGarage(rich(), "base-01")), "goliath-4x4"));
    const base = vehicleById("wasteland-jeep");
    for (let i = 0; i < 3; i++) p = ok(tuneNode(p, "goliath-4x4", "engine"));
    expect("error" in tuneNode(p, "goliath-4x4", "engine")).toBe(true);
    const tuned = tunedVehicle(base, p.fleet);
    expect(tuned.speed).toBeCloseTo(base.speed * 1.18);
    expect(tuned.name).toBe("Goliath-4x4 Apex");
    // a different base vehicle is untouched
    expect(tunedVehicle(vehicleById("goliath-tank"), p.fleet)).toEqual(vehicleById("goliath-tank"));
    p = ok(setPaint(p, "goliath-4x4", "Stealth Black"));
    expect(p.fleet.paint["goliath-4x4"]).toBe("Stealth Black");
    expect("error" in setPaint(p, "goliath-4x4", "Hot Pink")).toBe(true);
  });
  it("switching the active build switches the driven vehicle", () => {
    let p = ok(buyGarage(ok(buyGarage(rich(), "base-01")), "base-02"));
    p = ok(buyFleetVehicle(p, "goliath-4x4"));
    p = ok(buyFleetVehicle(p, "valkyrie-vtol"));
    expect(p.selectedVehicle).toBe("rift-helicopter");
    p = ok(setActiveFleet(p, "goliath-4x4"));
    expect(p.selectedVehicle).toBe("wasteland-jeep");
  });
  it("merges never lose owned builds, bases or tuning; saves normalise", () => {
    const a = { ...EMPTY_FLEET, owned: ["goliath-4x4"], garages: ["base-01" as const], tuning: { "goliath-4x4": { engine: 2 } }, paint: { "goliath-4x4": "Desert Camo" }, active: "goliath-4x4" };
    const b = { ...EMPTY_FLEET, owned: ["valkyrie-vtol"], garages: ["base-02" as const], tuning: { "goliath-4x4": { engine: 3, armor: 1 } }, paint: {}, active: "valkyrie-vtol" };
    const m = mergeFleet(a, b, true);
    expect(m.owned.sort()).toEqual(["goliath-4x4", "valkyrie-vtol"]);
    expect(m.tuning["goliath-4x4"]).toEqual({ engine: 3, armor: 1 });
    expect(m.active).toBe("goliath-4x4");
    expect(normalizeFleet({ owned: ["nope", "goliath-4x4"], garages: ["base-99"], tuning: { x: { y: -1 } } })).toEqual({ ...EMPTY_FLEET, owned: ["goliath-4x4"], tuning: { x: {} } });
    expect(normalizeProgression({ ...DEFAULT_PROGRESSION, fleet: undefined }).fleet).toEqual(EMPTY_FLEET);
    const merged = mergeProgression({ ...DEFAULT_PROGRESSION, fleet: a }, { ...DEFAULT_PROGRESSION, fleet: b }, false);
    expect(merged.fleet.garages.sort()).toEqual(["base-01", "base-02"]);
  });
  it("every garage is reachable from its own spot and listed on exactly one region's map", () => {
    for (const g of Object.values(GARAGES)) {
      expect(garageNear(g.x, g.z)).toBe(g.id);
      const listed = REGIONS.filter((r) => regionActivities(DEFAULT_PROGRESSION, r.id).some((a) => a.id === `garage:${g.id}`));
      expect(listed.length).toBe(1);
    }
  });
});

describe("campaign", () => {
  it("every playable mission id is a real chapter, and progress counts only finished playable ones", () => {
    const real = new Set(CHRONICLE.map((c) => c.id));
    for (const m of CAMPAIGN.flatMap((a) => a.missions)) if (m.playable) expect(real.has(m.playable)).toBe(true);
    const c0 = campaignProgress(DEFAULT_PROGRESSION);
    expect(c0.done).toBe(0);
    expect(c0.total).toBe(21);
    const c1 = campaignProgress({ ...DEFAULT_PROGRESSION, completedMissions: ["awakening", "descent-protocol", "not-a-mission"] });
    expect(c1.done).toBe(2);
  });
});
