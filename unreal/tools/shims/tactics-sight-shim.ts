/**
 * The line-of-sight stand-in for enemy-tactics.ts in the tactics golden (gen-tactics-golden.ts): sightLine is blocked by a
 * fixed pattern of the eye's position, so findFlankSpot's search can be replayed in C++ with the same rule
 * (Tests/TacticsCoreTest.cpp TcBlocked). Calls are counted.
 */
export type Point3 = { x: number; y: number; z: number };
export type SightWorld = { ground: (x: number, z: number) => number; obstaclesNear?: unknown; solids?: unknown };
export const sightCalls = { n: 0 };
export const blockedRule = (from: Point3, to: Point3) => ((Math.floor(from.x * 0.37) + Math.floor(from.z * 0.23) + Math.floor(to.x * 0.11) + Math.floor(to.y * 7)) % 3 + 3) % 3 === 0;
export function sightLine(from: Point3, to: Point3, _world: SightWorld): { blocked: boolean; at?: Point3 } {
  sightCalls.n++;
  return { blocked: blockedRule(from, to) };
}

/** enemy-cover.ts imports this too; coverCandidates is not replayed, so any height will do */
export const obstacleHeight = (_o: unknown) => 2;
