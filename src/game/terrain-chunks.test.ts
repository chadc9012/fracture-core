import { describe, expect, test } from "bun:test";
import { CHUNK, LOD_COUNT, LOD_DISTANCE, LOD_SEGS, buildChunk, startChunkBuild, chunkKey, chunkOf, chunksNear, distanceToChunk, lodForDistance, planBuilds, skirtDepth, type ChunkSamplers } from "./terrain-chunks";

const hill = (x: number, z: number) => 8 * Math.sin(x * 0.05) * Math.cos(z * 0.04) + 0.02 * x;
const samplers: ChunkSamplers = { height: hill, color: (_x, _z, h) => [h / 20, 0.5, 0.25], weights: () => [1, 0, 0, 0, 0, 0] };

describe("chunk coordinates and LOD", () => {
  test("chunkOf handles negatives", () => {
    expect(chunkOf(0, 0)).toEqual({ cx: 0, cz: 0 });
    expect(chunkOf(-0.1, 95.9)).toEqual({ cx: -1, cz: 0 });
    expect(chunkOf(-96, -97)).toEqual({ cx: -1, cz: -2 });
  });
  test("distanceToChunk is zero inside and measured to the edge outside", () => {
    expect(distanceToChunk({ cx: 0, cz: 0 }, 10, 10)).toBe(0);
    expect(distanceToChunk({ cx: 0, cz: 0 }, CHUNK + 30, 10)).toBeCloseTo(30, 6);
    expect(distanceToChunk({ cx: 0, cz: 0 }, -30, -40)).toBeCloseTo(50, 6);
  });
  test("lod grows with distance and is monotonic", () => {
    let prev = 0;
    for (let d = 0; d < 1000; d += 10) { const l = lodForDistance(d); expect(l).toBeGreaterThanOrEqual(prev); prev = l; }
    expect(lodForDistance(0)).toBe(0);
    expect(lodForDistance(LOD_DISTANCE[0]! + 1)).toBe(1);
    expect(lodForDistance(5000)).toBe(LOD_COUNT - 1);
  });
  test("hysteresis keeps the current lod near an edge but not far past it", () => {
    const e = LOD_DISTANCE[0]!;
    expect(lodForDistance(e * 1.05, 0)).toBe(0); // just past the edge: stay fine
    expect(lodForDistance(e * 1.2, 0)).toBe(1);
    expect(lodForDistance(e * 0.95, 1)).toBe(1); // just inside: stay coarse
    expect(lodForDistance(e * 0.8, 1)).toBe(0);
  });
  test("chunksNear is nearest-first, within radius and inside the world disc", () => {
    const list = chunksNear(0, 0, 400, 760);
    expect(list.length).toBeGreaterThan(20);
    const d = list.map((c) => distanceToChunk(c, 0, 0));
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(Math.max(...d)).toBeLessThanOrEqual(400);
    expect(chunksNear(5000, 5000, 400, 760)).toEqual([]);
  });
});

describe("buildChunk", () => {
  for (let lod = 0; lod < LOD_COUNT; lod++) {
    test(`lod ${lod}: counts, indices and attribute ranges`, () => {
      const m = buildChunk({ cx: 2, cz: -1 }, lod, samplers);
      const segs = LOD_SEGS[lod]!;
      expect(m.segs).toBe(segs);
      expect(m.vertexCount).toBe((segs + 1) ** 2 + segs * 4);
      expect(m.index.length).toBe((segs * segs * 2 + segs * 4 * 2) * 3);
      for (const i of m.index) expect(i).toBeLessThan(m.vertexCount);
      for (let v = 0; v < m.vertexCount; v++) {
        const len = Math.hypot(m.normal[v * 3]!, m.normal[v * 3 + 1]!, m.normal[v * 3 + 2]!);
        expect(len).toBeCloseTo(1, 4);
        expect(m.normal[v * 3 + 2]!).toBeGreaterThan(0); // local z is up
      }
      expect(m.minH).toBeLessThanOrEqual(m.maxH);
    });
  }

  test("surface triangles face up (plane-local +z) and skirt triangles face outward", () => {
    const m = buildChunk({ cx: 0, cz: 0 }, 2, { ...samplers, height: () => 0 });
    const segs = LOD_SEGS[2]!;
    const surface = segs * segs * 2;
    const p = (v: number) => [m.position[v * 3]!, m.position[v * 3 + 1]!, m.position[v * 3 + 2]!] as const;
    const normalOf = (t: number) => {
      const a = p(m.index[t * 3]!), b = p(m.index[t * 3 + 1]!), c = p(m.index[t * 3 + 2]!);
      const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!], w = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
      return [u[1]! * w[2]! - u[2]! * w[1]!, u[2]! * w[0]! - u[0]! * w[2]!, u[0]! * w[1]! - u[1]! * w[0]!];
    };
    for (let t = 0; t < surface; t++) expect(normalOf(t)[2]!).toBeGreaterThan(0);
    // outward = away from the chunk centre in plane-local xy
    const cx = CHUNK / 2, cy = -CHUNK / 2;
    for (let t = surface; t < surface + segs * 4 * 2; t++) {
      const n = normalOf(t);
      const a = p(m.index[t * 3]!);
      const out = (a[0] - cx) * n[0]! + (a[1] - cy) * n[1]!;
      expect(out).toBeGreaterThan(0);
    }
  });

  test("neighbouring chunks at the same lod agree on the shared border (no cracks, matching normals)", () => {
    for (const lod of [0, 3]) {
      const a = buildChunk({ cx: 0, cz: 0 }, lod, samplers), b = buildChunk({ cx: 1, cz: 0 }, lod, samplers);
      const n = LOD_SEGS[lod]! + 1;
      for (let j = 0; j < n; j++) {
        const va = j * n + (n - 1), vb = j * n; // right edge of a, left edge of b
        expect(a.position[va * 3]!).toBeCloseTo(b.position[vb * 3]!, 6);
        expect(a.position[va * 3 + 1]!).toBeCloseTo(b.position[vb * 3 + 1]!, 6);
        expect(a.position[va * 3 + 2]!).toBeCloseTo(b.position[vb * 3 + 2]!, 6);
        for (let q = 0; q < 3; q++) expect(a.normal[va * 3 + q]!).toBeCloseTo(b.normal[vb * 3 + q]!, 5);
      }
    }
  });

  test("skirts hide the height gap between lods", () => {
    const fine = buildChunk({ cx: 0, cz: 0 }, 0, samplers), coarse = buildChunk({ cx: 1, cz: 0 }, 3, samplers);
    // along the shared edge x = CHUNK the coarse surface is a chord of the fine one; its skirt reaches below the fine surface
    const nF = LOD_SEGS[0]! + 1, nC = LOD_SEGS[3]! + 1;
    const stepC = CHUNK / LOD_SEGS[3]!;
    let worst = 0;
    for (let j = 0; j < nF; j++) {
      const z = (j * CHUNK) / LOD_SEGS[0]!;
      const k = Math.min(nC - 2, Math.floor(z / stepC));
      const h0 = coarse.position[(k * nC) * 3 + 2]!, h1 = coarse.position[((k + 1) * nC) * 3 + 2]!;
      const chord = h0 + (h1 - h0) * ((z - k * stepC) / stepC);
      worst = Math.max(worst, Math.abs(chord - fine.position[(j * nF + nF - 1) * 3 + 2]!));
    }
    expect(skirtDepth(CHUNK / LOD_SEGS[3]!)).toBeGreaterThan(worst);
  });

  test("uv is continuous in world space across chunks", () => {
    const a = buildChunk({ cx: 0, cz: 0 }, 1, samplers), b = buildChunk({ cx: 1, cz: 0 }, 1, samplers);
    const n = LOD_SEGS[1]! + 1;
    expect(a.uv[(n - 1) * 2]!).toBeCloseTo(b.uv[0]!, 8);
  });
});

describe("planBuilds", () => {
  test("only requests missing or changed lods, nearest first, skipping pending", () => {
    const wanted = [{ cx: 0, cz: 0, lod: 0, dist: 0 }, { cx: 1, cz: 0, lod: 1, dist: 50 }, { cx: 2, cz: 0, lod: 2, dist: 200 }, { cx: 3, cz: 0, lod: 3, dist: 400 }];
    const have = (k: string) => (k === chunkKey(0, 0) ? 0 : k === chunkKey(1, 0) ? 2 : undefined);
    const plan = planBuilds(wanted, have, new Set([`${chunkKey(2, 0)}@2`]));
    expect(plan.map((p) => `${p.cx},${p.cz}@${p.lod}`)).toEqual(["1,0@1", "3,0@3"]);
  });
});

describe("resumable builds", () => {
  test("a tiny budget still finishes, in many steps, with the same mesh as the one-shot build", () => {
    const b = startChunkBuild({ cx: -1, cz: 3 }, 1, samplers, (() => { let t = 0; return () => (t += 1); })());
    let steps = 0;
    while (!b.step(2)) steps++;
    expect(steps).toBeGreaterThan(10);
    const one = buildChunk({ cx: -1, cz: 3 }, 1, samplers);
    expect(Array.from(b.result().position)).toEqual(Array.from(one.position));
    expect(Array.from(b.result().index)).toEqual(Array.from(one.index));
  });
  test("result() before completion is an error", () => {
    const b = startChunkBuild({ cx: 0, cz: 0 }, 3, samplers);
    expect(() => b.result()).toThrow();
  });
  test("the slope handed to the colour sampler matches terrain.ts slopeAt on a plane", () => {
    const seen: number[] = [];
    buildChunk({ cx: 0, cz: 0 }, 3, { ...samplers, height: (x) => 0.5 * x, color: (_x, _z, _h, slope) => { seen.push(slope); return [0, 0, 0]; } });
    // gradient 0.5 -> slope 0.5 * 5 / 5.5
    expect(seen[Math.floor(seen.length / 2)]!).toBeCloseTo(0.5 * (5 / 5.5), 5);
  });
});
