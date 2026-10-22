/** Shared vehicle tuning definitions for the world adapter.
 * These are conservative baseline values, not a replacement for race physics.
 */
export type VehicleClass = 'car' | 'motorcycle' | 'truck' | 'hovercraft' | 'aircraft' | 'boat' | 'submarine';
export type VehicleMode = 'ground' | 'air' | 'water' | 'submersible';
export interface VehicleMotion {
  speed: number;
  heading: number;
  verticalSpeed: number;
  pitch: number;
  roll: number;
}
export interface VehicleTuning {
  mode: VehicleMode;
  maxForwardSpeed: number;
  acceleration: number;
  braking: number;
  turnRate: number;
}
export const VEHICLE_TUNING_PRESETS: Readonly<Record<VehicleClass, Readonly<VehicleTuning>>> = {
  car: { mode: 'ground', maxForwardSpeed: 38, acceleration: 11, braking: 19, turnRate: 1.8 },
  motorcycle: { mode: 'ground', maxForwardSpeed: 44, acceleration: 14, braking: 17, turnRate: 2.2 },
  truck: { mode: 'ground', maxForwardSpeed: 27, acceleration: 7, braking: 13, turnRate: 1.2 },
  hovercraft: { mode: 'ground', maxForwardSpeed: 34, acceleration: 9, braking: 12, turnRate: 1.5 },
  aircraft: { mode: 'air', maxForwardSpeed: 95, acceleration: 18, braking: 12, turnRate: 1.0 },
  boat: { mode: 'water', maxForwardSpeed: 24, acceleration: 5, braking: 7, turnRate: 1.1 },
  submarine: { mode: 'submersible', maxForwardSpeed: 16, acceleration: 3, braking: 5, turnRate: 0.8 },
};
