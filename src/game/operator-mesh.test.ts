import { describe, expect, test } from "bun:test";
import { smoothNormals, subdivideSkinned, topInfluences, weldIds, type SkinMesh } from "./operator-mesh";

/** a unit cube with every face its own 4 vertices (the way UV/normal seams split a real mesh), half skinned to joint 0 and half to joint 1 */
function cube(): SkinMesh {
  const faces: [number[], number[], number[], number[]][] = [
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
    [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
    [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  ];
  const position: number[] = [], uv: number[] = [], joints: number[] = [], weights: number[] = [], index: number[] = [];
  faces.forEach((f, fi) => {
    const base = fi * 4;
    f.forEach((p, k) => { position.push(...p); uv.push((k % 2) * 0.4 + (fi % 3) * 0.33, (k >> 1) * 0.4 + Math.floor(fi / 3) * 0.5); const up = p[1]! > 0; joints.push(up ? 1 : 0, 0, 0, 0); weights.push(1, 0, 0, 0); });
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  return { position: Float32Array.from(position), uv: Float32Array.from(uv), joints: Uint16Array.from(joints), weights: Float32Array.from(weights), index: Uint32Array.from(index) };
}

describe("operator mesh", () => {
  test("welding collapses seam-split vertices", () => {
    expect(weldIds(cube().position).count).toBe(8);
  });
  test("subdivision quadruples triangles, stays watertight and keeps skin normalised", () => {
    const m = subdivideSkinned(cube());
    expect(m.index.length / 3).toBe(12 * 4);
    // every welded edge is shared by exactly two triangles
    const edges = new Map<string, number>();
    for (let t = 0; t < m.index.length; t += 3) for (let e = 0; e < 3; e++) { const a = m.weld[m.index[t + e]!]!, b = m.weld[m.index[t + (e + 1) % 3]!]!; const k = a < b ? `${a}-${b}` : `${b}-${a}`; edges.set(k, (edges.get(k) ?? 0) + 1); }
    expect([...edges.values()].every((c) => c === 2)).toBe(true);
    for (let v = 0; v < m.weights.length / 4; v++) expect(m.weights[v * 4]! + m.weights[v * 4 + 1]! + m.weights[v * 4 + 2]! + m.weights[v * 4 + 3]!).toBeCloseTo(1, 4);
  });
  test("corners are rounded (pulled toward the centre) and normals are unit length", () => {
    const m = subdivideSkinned(cube());
    let maxR = 0;
    for (let v = 0; v < m.position.length / 3; v++) maxR = Math.max(maxR, Math.hypot(m.position[v * 3]!, m.position[v * 3 + 1]!, m.position[v * 3 + 2]!));
    expect(maxR).toBeLessThan(Math.sqrt(3) - 0.05);
    for (let v = 0; v < m.normal.length / 3; v++) expect(Math.hypot(m.normal[v * 3]!, m.normal[v * 3 + 1]!, m.normal[v * 3 + 2]!)).toBeCloseTo(1, 4);
  });
  test("a UV seam does not crack: split copies of one point stay at one position", () => {
    const m = subdivideSkinned(cube());
    const byWeld = new Map<number, string>();
    for (let v = 0; v < m.weld.length; v++) { const k = [m.position[v * 3]!, m.position[v * 3 + 1]!, m.position[v * 3 + 2]!].map((x) => x.toFixed(5)).join(","); const prev = byWeld.get(m.weld[v]!); if (prev) expect(prev).toBe(k); else byWeld.set(m.weld[v]!, k); }
  });
  test("edge points between two joints blend their influences", () => {
    const m = subdivideSkinned(cube());
    let blended = 0;
    for (let v = 0; v < m.weights.length / 4; v++) if (m.weights[v * 4]! > 0.01 && m.weights[v * 4]! < 0.99) blended++;
    expect(blended).toBeGreaterThan(0);
  });
  test("topInfluences keeps the strongest four of many sets and renormalises", () => {
    const joints = [[1, 2, 3, 4], [5, 6, 7, 8]], weights = [[0.3, 0.2, 0.1, 0.05], [0.2, 0.1, 0.03, 0.02]];
    const { joints: j, weights: w } = topInfluences(joints, weights, 1);
    expect([...j]).toEqual([1, 2, 5, 3]);
    expect(w[0]! + w[1]! + w[2]! + w[3]!).toBeCloseTo(1, 5);
    expect(w[0]!).toBeGreaterThan(w[1]!);
  });
  test("smooth normals share across a seam", () => {
    const c = cube();
    const { weld, count } = weldIds(c.position);
    const n = smoothNormals(c.position, c.index, weld, count);
    // the two split copies of corner (-1,-1,1) point the same way
    const corner = [...Array(c.position.length / 3).keys()].filter((v) => c.position[v * 3] === -1 && c.position[v * 3 + 1] === -1 && c.position[v * 3 + 2] === 1);
    expect(corner.length).toBeGreaterThan(1);
    for (const v of corner) expect(n[v * 3]).toBeCloseTo(n[corner[0]! * 3]!, 5);
  });
});
