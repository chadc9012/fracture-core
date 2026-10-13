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