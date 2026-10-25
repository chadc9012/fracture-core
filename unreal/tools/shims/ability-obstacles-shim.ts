/** Test shim for gen-ability-golden: the world's obstacles are the case's own list (every one is "nearby"). */
export function queryObstacles(_x: number, _z: number): { x: number; z: number; r: number }[] {
  return ((globalThis as unknown as { __wfObstacles: { x: number; z: number; r: number }[] }).__wfObstacles ??= []);
}
