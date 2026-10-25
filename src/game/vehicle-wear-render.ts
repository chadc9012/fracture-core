import type { VehicleCondition } from "./vehicle-condition";

/** Visual look of worn running gear: flat tyres and a sagging ride height. Pure and monotonic in wear. */
export type WearLook = { flatCount: number; /** 0..1 fraction of a wheel radius a flat wheel sinks */ flatSink: number; /** 0..1 fraction of the max ride-height drop */ sag: number };
export const FLAT_THRESHOLDS = [35, 55, 75, 90] as const;
export const MAX_SAG = 0.1; // metres of ride-height drop at fully wrecked suspension
export function wearLook(c: Pick<VehicleCondition, "tires" | "suspension">): WearLook {
  const tires = Number.isFinite(c.tires) ? Math.max(0, c.tires) : 0;
  const susp = Number.isFinite(c.suspension) ? Math.max(0, Math.min(100, c.suspension)) : 0;
  const flatCount = FLAT_THRESHOLDS.filter((t) => tires >= t).length;
  return { flatCount, flatSink: flatCount > 0 ? 0.22 : 0, sag: susp / 100 };
}
export const wearKey = (l: WearLook) => `${l.flatCount}:${Math.round(l.sag * 20)}`;
/** Which wheel (by sorted index) goes flat first: back-left, front-right... stable order so repairs undo it in reverse. */
export function flatWheelIndices(count: number, wheels: number): number[] {
  const order = [3, 0, 2, 1, 4, 5, 6, 7];
  return order.filter((i) => i < wheels).slice(0, Math.min(count, wheels));
}
