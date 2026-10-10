import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import { buildPalette } from "./operator-paint";
import { smoothNormals, vertexCurvature, weldIds } from "./operator-mesh";
import { bakeTexels, faceAt, headFrame, paintBaked, REGION_ORDER, regionWeightArray, type PaintMesh } from "./operator-texture";

const R = REGION_ORDER.length;
const palette = buildPalette({ armor: "#7a5a3c", cloth: "#2d333d", trim: "#c9a24a" });

/** a flat quad filling the whole UV square, left half helmet-weighted, right half chest-weighted */
function quad(): PaintMesh {
  const position = [-1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 2, 0, 0, 2, 0, 1, 2, 0], uv = [0, 0, 0.5, 0, 1, 0, 0, 1, 0.5, 1, 1, 1];
  const index = [0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4];
  const regionWeights = new Float32Array(6 * R);
  [0, 3].forEach((v) => { regionWeights[v * R + REGION_ORDER.indexOf("helmet")] = 1; });
  [2, 5].forEach((v) => { regionWeights[v * R + REGION_ORDER.indexOf("chest")] = 1; });
  [1, 4].forEach((v) => { regionWeights[v * R + REGION_ORDER.indexOf("helmet")] = 0.5; regionWeights[v * R + REGION_ORDER.indexOf("chest")] = 0.5; });
  const normal = new Float32Array(6 * 3); for (let v = 0; v < 6; v++) normal[v * 3 + 2] = 1;
  return { position, normal, uv, index, regionWeights, curvature: new Float32Array(6) };
}

describe("operator texture", () => {
  test("fills the UV square and keeps plate colours where one region clearly wins", () => {
    const b = bakeTexels(quad(), 64);
    expect(b.covered).toBeGreaterThan(0.99);
    const out = paintBaked(b, palette);
    const px = (x: number, y: number) => [out.color[(y * 64 + x) * 4]!, out.color[(y * 64 + x) * 4 + 1]!, out.color[(y * 64 + x) * 4 + 2]!];
    const left = px(4, 32), right = px(60, 32);
    expect(left).not.toEqual(right);
    expect(out.color[3]).toBe(255);
  });
  test("a seam darkens the border between two armor pieces", () => {
    const out = paintBaked(bakeTexels(quad(), 64), palette);
    const luma = (x: number, y: number) => out.color[(y * 64 + x) * 4]! + out.color[(y * 64 + x) * 4 + 1]! + out.color[(y * 64 + x) * 4 + 2]!;
    expect(luma(32, 32)).toBeLessThan(Math.min(luma(10, 32), luma(54, 32)));
  });
  test("repainting from the same bake with a new palette changes colours but not coverage", () => {
    const b = bakeTexels(quad(), 32);
    const a = paintBaked(b, palette), c = paintBaked(b, buildPalette({ armor: "#2a4f9a", trim: "#9fd0ff" }));
    expect(a.covered).toBe(c.covered);
    expect([...a.color.slice(0, 64)]).not.toEqual([...c.color.slice(0, 64)]);
  });
  test("every texel is opaque and the emissive floor is never black", () => {
    const out = paintBaked(bakeTexels(quad(), 32), palette);
    for (let i = 0; i < 32 * 32; i++) { expect(out.color[i * 4 + 3]).toBe(255); expect(out.emissive[i * 4]! + out.emissive[i * 4 + 1]! + out.emissive[i * 4 + 2]!).toBeGreaterThan(10); }
  });
  test("visor only appears on the front of the head, at eye height", () => {
    const head = { y0: 1.4, h: 0.28, cx: 0, hw: 0.1 };
    expect(faceAt(head, 1, 0, 1.4 + 0.5 * 0.28, 1).visor).toBeGreaterThan(0.9);
    expect(faceAt(head, 1, 0, 1.4 + 0.5 * 0.28, -1).visor).toBe(0); // back of the head
    expect(faceAt(head, 1, 0, 1.4 + 0.9 * 0.28, 1).visor).toBe(0); // crown
    expect(faceAt(head, 1, 0, 1.4 + 0.5 * 0.28, 1).slit).toBeGreaterThan(0.9);
    expect(faceAt(head, 0, 0, 1.4 + 0.5 * 0.28, 1).visor).toBe(0); // not part of the head
    expect(headFrame({ position: [0, 1, 0, 0, 2, 0], regionWeights: new Float32Array(2 * R) })).toBeNull();
  });
  test("curvature: ridges positive, creases negative", () => {
    // a strip folded into a ridge along z (convex when seen from +y)
    const position = new Float32Array([-1, 0, 0, 0, 1, 0, 1, 0, 0, -1, 0, 1, 0, 1, 1, 1, 0, 1, -2, -1, 0, 2, -1, 0, -2, -1, 1, 2, -1, 1]);
    const index = [0, 1, 3, 1, 4, 3, 1, 2, 4, 2, 5, 4, 6, 0, 8, 0, 3, 8, 2, 7, 5, 7, 9, 5];
    const { weld, count } = weldIds(position);
    const normal = smoothNormals(position, index, weld, count);
    const c = vertexCurvature(position, normal, index, weld, count);
    expect(c.length).toBe(10);
    for (const v of c) { expect(v).toBeLessThanOrEqual(1); expect(v).toBeGreaterThanOrEqual(-1); }
  });
});

/** Runs the shipped HD operator files through the real pipeline (no GPU): the paint must cover the body and put a visor on every operator. */
function loadGlb(file: string) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = b.subarray(20 + jl + 8);
  const read = (ai: number) => {
    const a = json.accessors[ai], v = json.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type as "SCALAR"]!, T = ({ 5123: Uint16Array, 5126: Float32Array } as const)[a.componentType as 5123]!;
    const copy = bin.buffer.slice(bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0), bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0) + a.count * n * T.BYTES_PER_ELEMENT);
    return new T(copy);
  };
  const p = json.meshes[0].primitives[0];
  return { json, p, position: read(p.attributes.POSITION) as unknown as Float32Array, normal: read(p.attributes.NORMAL) as unknown as Float32Array, uv: read(p.attributes.TEXCOORD_0) as unknown as Float32Array, joints: read(p.attributes.JOINTS_0) as unknown as Uint16Array, weights: read(p.attributes.WEIGHTS_0) as unknown as Float32Array, index: read(p.indices) as unknown as Uint16Array, names: json.skins[0].joints.map((n: number) => json.nodes[n].name) as string[] };
}

describe("shipped operator models (HD)", () => {
  for (const name of ["goliath", "nyx", "cipher"]) {
    test(`${name}-hd paints a covered, varied body with a visor`, () => {
      const file = `public/models/operators/${name}-hd.glb`;
      if (!fs.existsSync(file)) return;
      const m = loadGlb(file);
      expect(Object.keys(m.p.attributes).sort()).toEqual(["JOINTS_0", "NORMAL", "POSITION", "TEXCOORD_0", "WEIGHTS_0"]);
      const n = m.position.length / 3;
      expect(n).toBeLessThan(65536);
      expect(m.index.length / 3).toBeGreaterThan(9000); // subdivided, not the ~3k original
      for (let v = 0; v < n; v++) expect(m.weights[v * 4]! + m.weights[v * 4 + 1]! + m.weights[v * 4 + 2]! + m.weights[v * 4 + 3]!).toBeCloseTo(1, 3);
      const rw = regionWeightArray(m.names, m.joints, m.weights, n);
      const { weld, count } = weldIds(m.position);
      const curvature = vertexCurvature(m.position, m.normal, m.index, weld, count);
      const baked = bakeTexels({ position: m.position, normal: m.normal, uv: m.uv, index: m.index, regionWeights: rw, curvature }, 256);
      expect(baked.covered).toBeGreaterThan(0.4);
      const out = paintBaked(baked, buildPalette({ armor: "#6b4a30", trim: "#c9a24a" }), { accent: "#4fd8ff" });
      expect(out.visorTexels).toBeGreaterThan(5);
      expect(out.visorTexels).toBeLessThan(baked.covered * 256 * 256 * 0.05); // a face band, not a body wash
      const colours = new Set<number>();
      for (let i = 0; i < 256 * 256; i++) colours.add(out.color[i * 4]! >> 3 | (out.color[i * 4 + 1]! >> 3) << 5 | (out.color[i * 4 + 2]! >> 3) << 10);
      expect(colours.size).toBeGreaterThan(60); // not one flat colour
    });
  }
});
