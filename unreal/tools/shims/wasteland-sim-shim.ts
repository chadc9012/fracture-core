/**
 * The live-sim stand-in for wasteland-runtime.ts in the wasteland golden: alerts, freeSlots and spawnEventSquad are logged in call
 * order, and spawned raiders go into the recorder's fixed machine pool on a fixed grid around the spawn point, which the C++ test's
 * fake world repeats (Tests/WastelandCoreTest.cpp).
 */
export type Machine = { alive: boolean; living?: string; x: number; z: number };
export type WorldSim = { machines: Machine[]; kills: number; hp: number };
export const simLog: string[] = [];
export const alert = (_sim: WorldSim, text: string) => { simLog.push(`E\talert\t${text}`); };
export function freeSlots(_sim: WorldSim, need: number, px: number, pz: number): number { simLog.push(`E\tfree\t${need}\t${px}\t${pz}`); return 0; }
export const gridSpot = (x: number, z: number, i: number, ring: number) => ({ x: x + ((i % 3) - 1) * ring * 0.5, z: z + (Math.floor(i / 3) - 1) * ring * 0.5 });
export function spawnEventSquad(sim: WorldSim, tag: string, x: number, z: number, count: number, elite: number, _regionId: string, ring = 12, troopIndex?: number): number {
  let n = 0;
  for (let i = 0; i < count; i++) {
    const m = sim.machines.find((e) => !e.alive);
    if (!m) break;
    const p = gridSpot(x, z, i, ring);
    m.alive = true; m.living = tag; m.x = p.x; m.z = p.z;
    n++;
  }
  simLog.push(`E\tspawn\t${tag}\t${x}\t${z}\t${count}\t${elite}\t${ring}\t${troopIndex ?? -1}\t${n}`);
  return n;
}
