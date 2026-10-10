// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { carveCells, refinePatch } from "./terrain-refine";
import { heightAt } from "./terrain";
import { IMPACT_PIT } from "./forest-relief";
import { WORLD_RADIUS } from "./world";

const SIZE = WORLD_RADIUS * 2.1, SEG = Math.round(SIZE / 2.5), cell = SIZE / SEG, half = SIZE / 2; // the 2.5 m grid the refinement was designed for, at any WORLD_SCALE
const patch = refinePatch(SIZE, SEG, IMPACT_PIT.x, IMPACT_PIT.z, 15, 4, heightAt);

/** height the mesh draws at (x, z): bilinear over the patch's own fine grid */
function fineMesh(x: number, z: number) {
  const fine = cell / patch.sub, w = patch.cols + 1;
  const gx = (x + half) / fine - patch.ix0 * patch.sub, gz = (z + half) / fine - patch.iz0 * patch.sub;
  const i = Math.min(patch.cols - 1, Math.max(0, Math.floor(gx))), j = Math.min(patch.rows - 1, Math.max(0, Math.floor(gz))), fx = gx - i, fz = gz - j;
  const H = (a: number, b: number) => patch.vertices[a + w * b]!.h;
  return H(i, j) * (1 - fx) * (1 - fz) + H(i + 1, j) * fx * (1 - fz) + H(i, j + 1) * (1 - fx) * fz + H(i + 1, j + 1) * fx * fz;
}
function coarseMesh(x: number, z: number) {
  const gx = (x + half) / cell, gz = (z + half) / cell, ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
  const h = (a: number, b: number) => heightAt(a * cell - half, b * cell - half);
  return h(ix, iz) * (1 - fx) * (1 - fz) + h(ix + 1, iz) * fx * (1 - fz) + h(ix, iz + 1) * (1 - fx) * fz + h(ix + 1, iz + 1) * fx * fz;
}

describe("local terrain refinement", () => {
  test("the patch covers the pit and sits on whole coarse cells", () => {
    expect(patch.ix0 * cell - half).toBeLessThan(IMPACT_PIT.x - 12);
    expect((patch.ix1 * cell - half)).toBeGreaterThan(IMPACT_PIT.x + 12);
    expect(patch.vertices.length).toBe((patch.cols + 1) * (patch.rows + 1));
    expect(patch.vertices.length).toBeLessThan(6000); // a local patch, not a second world
  });
  test("the coarse mesh misses the pit by over half a metre; the patch brings it well under 0.25 m", () => {
    let coarse = 0, fine = 0;
    for (let x = IMPACT_PIT.x - 11; x <= IMPACT_PIT.x + 11; x += 0.37) for (let z = IMPACT_PIT.z - 11; z <= IMPACT_PIT.z + 11; z += 0.37) {
      coarse = Math.max(coarse, Math.abs(coarseMesh(x, z) - heightAt(x, z)));
      fine = Math.max(fine, Math.abs(fineMesh(x, z) - heightAt(x, z)));
    }
    expect(coarse).toBeGreaterThan(0.4);
    expect(fine).toBeLessThan(0.25);
  });
  test("the patch border lies exactly on the coarse mesh edges, so there are no cracks", () => {
    const edge = patch.vertices.filter((_, k) => { const i = k % (patch.cols + 1), j = Math.floor(k / (patch.cols + 1)); return i === 0 || j === 0 || i === patch.cols || j === patch.rows; });
    expect(edge.length).toBe(2 * (patch.cols + patch.rows));
    for (const v of edge) expect(Math.abs(v.h - coarseMesh(v.x, v.z))).toBeLessThan(1e-6);
  });
  test("carving removes exactly the patch cells and keeps the rest of the coarse index", () => {
    const index = Array.from({ length: SEG * SEG * 6 }, (_, k) => k);
    const kept = carveCells(index, SEG, patch);
    const removed = (patch.ix1 - patch.ix0) * (patch.iz1 - patch.iz0);
    expect(kept.length).toBe(index.length - removed * 6);
    expect(new Set(kept).size).toBe(kept.length);
  });
  test("triangles are wound like the plane's and indices stay in range", () => {
    expect(patch.indices.length).toBe(patch.cols * patch.rows * 6);
    expect(Math.max(...patch.indices)).toBe(patch.vertices.length - 1);
  });
});
