// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { clusterAround } from "./foliage";

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe("clusterAround", () => {
  const parents = [{ x: 0, z: 0, s: 1 }, { x: 40, z: 0, s: 1.4 }];
  it("is deterministic for a seed", () => {
    expect(clusterAround(parents, 4, seeded(7), () => true)).toEqual(clusterAround(parents, 4, seeded(7), () => true));
  });
  it("keeps children within the ring and respects exclusions", () => {
    const all = clusterAround(parents, 6, seeded(3), () => true, { minRadius: 2, maxRadius: 5 });
    expect(all.length).toBeGreaterThan(0);
    for (const c of all) { const p = parents[c.parent]!; const d = Math.hypot(c.x - p.x, c.z - p.z); expect(d).toBeGreaterThanOrEqual(1.99); expect(d).toBeLessThanOrEqual(5.01); }
    expect(clusterAround(parents, 6, seeded(3), (x) => x > 100)).toHaveLength(0);
  });
});
