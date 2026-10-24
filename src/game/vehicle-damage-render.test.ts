import { describe, expect, test } from "bun:test";
import { FRESH_VEHICLE, impactVehicle, type VehicleCondition } from "./vehicle-condition";
import { MAX_DENTS, damageLook, dentPool, dentTierOf, hashSeed } from "./vehicle-damage-render";

const at = (body: number, engine = 0): VehicleCondition => ({ body, engine, tires: 0, suspension: 0 });

describe("damage look", () => {
  test("a fresh vehicle shows nothing", () => {
    const l = damageLook(FRESH_VEHICLE, 1);
    expect(l).toMatchObject({ dentTier: 0, glass: 0, headlightsOut: 0, bumperHang: 0, soot: 0 });
    expect(l.dents.length).toBe(0); expect(l.cracks.length).toBe(0);
  });
  test("stages step up with body damage", () => {
    expect([0, 7, 8, 29, 30, 54, 55, 79, 80, 100].map(dentTierOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(damageLook(at(45), 1).glass).toBe(1); expect(damageLook(at(70), 1).glass).toBe(2); expect(damageLook(at(95), 1).glass).toBe(3);
    expect(damageLook(at(55), 1).headlightsOut).toBe(1); expect(damageLook(at(85), 1).headlightsOut).toBe(2);
    expect(damageLook(at(60), 1).bumperHang).toBe(0); expect(damageLook(at(100), 1).bumperHang).toBe(1);
  });
  test("monotonic: worse condition never removes or moves anything already shown", () => {
    let prev = damageLook(at(0), 42);
    for (let b = 1; b <= 100; b++) {
      const next = damageLook(at(b), 42);
      expect(next.dents.length).toBeGreaterThanOrEqual(prev.dents.length);
      expect(next.cracks.length).toBeGreaterThanOrEqual(prev.cracks.length);
      expect(next.headlightsOut).toBeGreaterThanOrEqual(prev.headlightsOut);
      expect(next.bumperHang).toBeGreaterThanOrEqual(prev.bumperHang);
      prev.dents.forEach((d, i) => expect(next.dents[i]).toEqual(d));
      prev.cracks.forEach((c, i) => expect(next.cracks[i]).toEqual(c));
      prev = next;
    }
  });
  test("deterministic per vehicle and different between vehicles", () => {
    expect(damageLook(at(90), 7)).toEqual(damageLook(at(90), 7));
    expect(damageLook(at(90), hashSeed("scrap-interceptor")).dents).not.toEqual(damageLook(at(90), hashSeed("goliath-tank")).dents);
    expect(dentPool(3).length).toBe(MAX_DENTS);
    for (const d of dentPool(5)) { expect(d.u).toBeGreaterThan(0); expect(d.u).toBeLessThan(1); expect(d.v).toBeGreaterThan(0); expect(d.v).toBeLessThan(1); }
  });
  test("soot appears only once the engine burns, and the key only changes when something visible does", () => {
    expect(damageLook(at(0, 74), 1).soot).toBe(0); expect(damageLook(at(0, 75), 1).soot).toBeGreaterThan(0); expect(damageLook(at(0, 100), 1).soot).toBe(1);
    expect(damageLook(at(10), 1).key).toBe(damageLook(at(12), 1).key); expect(damageLook(at(10), 1).key).not.toBe(damageLook(at(35), 1).key);
  });
  test("real crashes drive the look: a hard hit shows more than a bump", () => {
    const bump = impactVehicle(FRESH_VEHICLE, 6), crash = impactVehicle(FRESH_VEHICLE, 45);
    expect(damageLook(crash, 1).dentTier).toBeGreaterThan(damageLook(bump, 1).dentTier);
    let c = FRESH_VEHICLE; for (let i = 0; i < 4; i++) c = impactVehicle(c, 30); expect(damageLook(c, 1).dentTier).toBe(4);
  });
});
