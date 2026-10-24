import { expect, test } from "bun:test";
import { FRESH_VEHICLE, impactVehicle, conditionEffects, recoverVehicle, repairCost, repairPrice, repairVehicle } from "./vehicle-condition";
import { nexBalance, spendNex } from "./nex";
test("minor impacts differ from high speed crashes", () => { expect(impactVehicle(FRESH_VEHICLE, 1)).toBe(FRESH_VEHICLE); expect(impactVehicle(FRESH_VEHICLE, 30).suspension).toBeGreaterThan(impactVehicle(FRESH_VEHICLE, 5).suspension); });
test("casual damage is lower than competitive", () => { expect(impactVehicle(FRESH_VEHICLE, 20, "casual").body).toBeLessThan(impactVehicle(FRESH_VEHICLE, 20, "competitive").body); });
test("components penalize their driving systems", () => { const e = conditionEffects({ body: 0, engine: 90, tires: 50, suspension: 40 }); expect(e.disabled).toBe(true); expect(e.speed).toBeLessThan(1); expect(e.grip).toBeLessThan(1); expect(e.stability).toBeLessThan(1); });
test("recovery requires calm and stationary and retains damage", () => { const c = { body: 100, engine: 100, tires: 60, suspension: 50 }; expect(recoverVehicle(c, false, true)).toBe(c); expect(recoverVehicle(c, true, false)).toBe(c); expect(conditionEffects(recoverVehicle(c, true, true)).disabled).toBe(false); expect(recoverVehicle(c, true, true).tires).toBe(60); });
test("Nex spending never converts shards and keeps debits after union merge", () => { const paid = spendNex({ mission: 100 }, "repair:1", 30); expect(paid).not.toBeNull(); expect(nexBalance({ mission: 100, ...paid })).toBe(70); expect(spendNex({ mission: 10 }, "repair:2", 30)).toBeNull(); expect(repairPrice(FRESH_VEHICLE)).toBe(0); });
test("repair is a separate, repeatable Nex spend that fully restores condition and never double-charges one moment", () => {
  expect(repairCost(FRESH_VEHICLE)).toBe(0);
  const wrecked = { body: 100, engine: 100, tires: 100, suspension: 100 };
  expect(repairCost(wrecked)).toBe(repairPrice(wrecked) * 3);
  const p = { nexLedger: { mission: 1000 }, vehicleConditions: { "scrap-interceptor": wrecked } };
  const fresh = repairVehicle(p, "scrap-interceptor", 1) as { progression: typeof p; message: string };
  expect(fresh.progression.vehicleConditions["scrap-interceptor"]).toEqual(FRESH_VEHICLE);
  expect(nexBalance(fresh.progression.nexLedger)).toBe(1000 - repairCost(wrecked));
  expect(repairVehicle(fresh.progression, "scrap-interceptor", 2)).toEqual({ error: "Already in good condition" });
  // a separate vehicle's condition is untouched
  const q = { nexLedger: { mission: 1000 }, vehicleConditions: { a: wrecked, b: { body: 20, engine: 0, tires: 0, suspension: 0 } } };
  const paidA = repairVehicle(q, "a", 1) as { progression: typeof q; message: string };
  expect(paidA.progression.vehicleConditions.b).toEqual(q.vehicleConditions.b);
  // too poor to pay
  const poor = { nexLedger: {}, vehicleConditions: { a: wrecked } };
  expect(repairVehicle(poor, "a", 1)).toEqual({ error: `Needs ${repairCost(wrecked)} Nex (you have 0)` });
  // the same instant can't be charged twice for the same vehicle (spendNex's own id-reuse guard)
  const r1 = repairVehicle({ nexLedger: { mission: 1000 }, vehicleConditions: { a: { body: 40, engine: 0, tires: 0, suspension: 0 } } }, "a", 5);
  if ("error" in r1) throw new Error(r1.error);
  const again = repairVehicle({ ...r1.progression, vehicleConditions: { a: { body: 40, engine: 0, tires: 0, suspension: 0 } } }, "a", 5);
  expect("error" in again).toBe(true);
});