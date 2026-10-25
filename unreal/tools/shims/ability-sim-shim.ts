/** Test shim for gen-ability-golden: ability-effects.ts's damage pricing, deaths, alerts, rift turret and volatile zone
 * spawns are recorded (damage scaled by a fixed 0.9 so the test sees the priced value is what gets subtracted).
 * stunMachine, applyVulnPulse and the rest of sim.ts stay real. */
export * from "../../../src/game/sim";
type Log = string[];
const log = (): Log => ((globalThis as unknown as { __wfAbilityLog: Log }).__wfAbilityLog ??= []);
const slot = (sim: { machines: unknown[] }, m: unknown) => sim.machines.indexOf(m);
export function applyMachineDamageMods(sim: { machines: unknown[] }, m: unknown, dmg: number, element: string, x: number, z: number) {
  log().push(`dmg:${slot(sim, m)}:${dmg}:${element}:${x}:${z}`);
  return dmg * 0.9;
}
export function defeatMachine(sim: { machines: unknown[] }, m: { alive: boolean; hp: number }) {
  log().push(`defeat:${slot(sim, m)}`);
  if (m.hp <= 0) m.alive = false;
}
export function alert(_sim: unknown, text: string) { log().push(`alert:${text}`); }
export function markGoreHit() { /* presentation only */ }
export function placeRiftTurret(_sim: unknown, x: number, z: number, duration: number) { log().push(`turret:${x}:${z}:${duration}`); }
export function spawnVolatileZone(_sim: unknown, x: number, z: number, radius: number, dps: number, duration: number) { log().push(`volatile:${x}:${z}:${radius}:${dps}:${duration}`); }
