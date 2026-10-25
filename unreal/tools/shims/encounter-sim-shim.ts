/** Test shim for gen-encounter-golden: encounter-sim.ts's hurtPlayer and alert calls are recorded instead of applied
 * (armor, i-frames and death belong to the engine side; the C++ core reports these hits for the engine to apply). */
export * from "../../../src/game/sim";
type Hurt = [number, string];
export function hurtPlayer(_sim: unknown, dmg: number, label: string) { ((globalThis as unknown as { __wfHurts: Hurt[] }).__wfHurts ??= []).push([dmg, label]); }
export function alert() {}
