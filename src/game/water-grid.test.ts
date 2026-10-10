import { describe, expect, test } from "bun:test";
import { WATER_INNER_HALF, WATER_OUTER_HALF, WATER_STEP, waterAxis, waterGrid, waterTriangles } from "./water-grid";

const OLD_TRIS = 2 * 300 * 300; // the former uniform patch
describe("water patch grid", () => {
  const tiers = ["LOW", "MEDIUM", "HIGH", "ULTRA"] as const;
  for (const t of tiers) test(`${t}: symmetric, strictly increasing, covers the old patch, far fewer triangles`, () => {
    const a = waterAxis(WATER_INNER_HALF[t]);
    expect(a[0]).toBe(-WATER_OUTER_HALF); expect(a[a.length - 1]).toBe(WATER_OUTER_HALF);
    for (let i = 1; i < a.length; i++) expect(a[i]!).toBeGreaterThan(a[i - 1]!);
    for (let i = 0; i < a.length; i++) expect(a[i]!).toBeCloseTo(-a[a.length - 1 - i]!, 6);
    expect(waterTriangles(a)).toBeLessThan(OLD_TRIS * 0.5);
  });
  test("inner zone keeps the old 8 m spacing on the world lattice", () => {
    const a = waterAxis(WATER_INNER_HALF.MEDIUM), inner = a.filter((v) => Math.abs(v) <= WATER_INNER_HALF.MEDIUM);
    for (let i = 1; i < inner.length; i++) expect(inner[i]! - inner[i - 1]!).toBe(WATER_STEP);
    for (const v of inner) expect(v % WATER_STEP === 0).toBe(true);
  });
  test("spacing never shrinks outward and the outer edge stays bounded", () => {
    const a = waterAxis(WATER_INNER_HALF.LOW), mid = Math.floor(a.length / 2);
    let prev = 0;
    for (let i = mid + 1; i < a.length - 2; i++) { const s = a[i + 1]! - a[i]!; expect(s).toBeGreaterThanOrEqual(prev - 1e-9); prev = s; }
    expect(prev).toBeLessThanOrEqual(64);
  });
  test("ULTRA still matches the near-field density of the old patch and is bigger than LOW", () => {
    expect(waterTriangles(waterAxis(WATER_INNER_HALF.ULTRA))).toBeGreaterThan(waterTriangles(waterAxis(WATER_INNER_HALF.LOW)));
  });
  test("index buffer is valid and counts match", () => {
    const a = waterAxis(WATER_INNER_HALF.LOW), g = waterGrid(a), n = a.length;
    expect(g.positions.length).toBe(n * n * 3);
    expect(g.index.length / 3).toBe(waterTriangles(a));
    for (const i of g.index) expect(i).toBeLessThan(n * n);
  });
  test("tier triangle counts (recorded for the perf notes)", () => { expect(tiers.map((t) => waterTriangles(waterAxis(WATER_INNER_HALF[t])))).toEqual([22472, 38088, 51200, 66248]); });
});
