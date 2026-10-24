import { nexBalance, spendNex, type NexLedger } from "./nex";

export type VehicleCondition = { body: number; engine: number; tires: number; suspension: number };
export const FRESH_VEHICLE: VehicleCondition = { body: 0, engine: 0, tires: 0, suspension: 0 };
export function normalizeCondition(raw?: Partial<VehicleCondition>): VehicleCondition {
  const n = (v?: number) => Number.isFinite(v) ? Math.max(0, Math.min(100, v ?? 0)) : 0;
  return { body: n(raw?.body), engine: n(raw?.engine), tires: n(raw?.tires), suspension: n(raw?.suspension) };
}
export function impactVehicle(c: VehicleCondition, speedLost: number, mode: "world" | "casual" | "competitive" = "world"): VehicleCondition {
  const severity = Math.max(0, Math.abs(speedLost) - 2) * (mode === "casual" ? 0.4 : mode === "competitive" ? 1.25 : 1);
  if (!severity) return c;
  return normalizeCondition({ body: c.body + severity, engine: c.engine + severity * 0.45, tires: c.tires + severity * 0.3, suspension: c.suspension + severity * (speedLost > 18 ? 0.8 : 0.2) });
}
export function conditionEffects(c: VehicleCondition) {
  return { speed: 1 - c.engine * 0.006, acceleration: 1 - c.engine * 0.007, grip: 1 - c.tires * 0.006, stability: 1 - c.suspension * 0.006, disabled: c.engine >= 90 || c.body >= 100 };
}
export function repairPrice(c: VehicleCondition) { return Math.ceil((c.body + c.engine + c.tires + c.suspension) / 4); }
/** Recovery restores mobility, not pristine condition; no ownership field is ever touched. */
export function recoverVehicle(c: VehicleCondition, calm: boolean, stopped: boolean): VehicleCondition {
  return calm && stopped ? { ...c, body: Math.min(85, c.body), engine: Math.min(70, c.engine) } : c;
}

/** A full repair is a separate, repeatable Nex spend — never confused with the fleet's one-time material purchases
 * or tuning nodes (fleet.ts). 3 Nex per repairPrice point, so a totally wrecked vehicle (repairPrice 100) costs 300
 * Nex: routine upkeep, nowhere near a home purchase (housing.ts prices run in the thousands). */
export const REPAIR_NEX_PER_POINT = 3;
export function repairCost(c: VehicleCondition): number { return repairPrice(c) * REPAIR_NEX_PER_POINT; }
export type RepairStore = { nexLedger: NexLedger; vehicleConditions: Record<string, VehicleCondition> };
/** Pay Nex to fully repair a vehicle, keyed by its base vehicle id (the same key Scene.tsx uses for live condition).
 * Each repair gets its own uniquely-timestamped ledger entry, exactly like every other Nex spend here (housing.ts,
 * nex.ts spendNex), so a repair can never be double-charged or replayed. */
export function repairVehicle<P extends RepairStore>(p: P, vehicleId: string, now: number): { progression: P; message: string } | { error: string } {
  const condition = normalizeCondition(p.vehicleConditions[vehicleId]);
  const price = repairCost(condition);
  if (price <= 0) return { error: "Already in good condition" };
  const ledger = spendNex(p.nexLedger, `repair:${vehicleId}:${now}`, price);
  if (!ledger) return { error: `Needs ${price} Nex (you have ${nexBalance(p.nexLedger)})` };
  return { progression: { ...p, nexLedger: ledger, vehicleConditions: { ...p.vehicleConditions, [vehicleId]: FRESH_VEHICLE } }, message: `Repaired · -${price} Nex` };
}