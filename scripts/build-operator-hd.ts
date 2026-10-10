/* Offline build: bun scripts/build-operator-hd.ts
 * Reads public/models/operators/<name>.glb (the Meshy originals, kept as the source) and writes <name>-hd.glb with
 *  - one Loop subdivision step (src/game/operator-mesh.ts): ~4x triangles, rounder silhouette, smooth normals across UV seams
 *  - the up-to-24 skin influences reduced to the 4 strongest per vertex (three.js reads only 4)
 * Skeleton, animations and UVs are carried over unchanged. Unused accessors from the old mesh are dropped. */
import fs from "node:fs";
import path from "node:path";
import { subdivideSkinned, topInfluences } from "../src/game/operator-mesh";

type Json = any;
const COMP: Record<number, { size: number; T: any }> = { 5120: { size: 1, T: Int8Array }, 5121: { size: 1, T: Uint8Array }, 5122: { size: 2, T: Int16Array }, 5123: { size: 2, T: Uint16Array }, 5125: { size: 4, T: Uint32Array }, 5126: { size: 4, T: Float32Array } };
const NC: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function parse(file: string) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  const jl = b.readUInt32LE(12);
  const json: Json = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = b.subarray(20 + jl + 8);
  return { json, bin };
}
/** accessor -> tightly packed bytes */
function accessorBytes(json: Json, bin: Buffer, ai: number): Buffer {
  const a = json.accessors[ai], v = json.bufferViews[a.bufferView];
  if (a.sparse) throw new Error("sparse accessors are not supported");
  const elem = COMP[a.componentType]!.size * NC[a.type]!, stride = v.byteStride || elem, base = (v.byteOffset || 0) + (a.byteOffset || 0);
  const out = Buffer.alloc(a.count * elem);
  for (let i = 0; i < a.count; i++) bin.copy(out, i * elem, base + i * stride, base + i * stride + elem);
  return out;
}
function readTyped(json: Json, bin: Buffer, ai: number) {
  const a = json.accessors[ai], b = accessorBytes(json, bin, ai);
  const c = COMP[a.componentType]!;
  const copy = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  return new c.T(copy) as ArrayLike<number>;
}

export function buildHd(src: string, dst: string) {
  const { json, bin } = parse(src);
  const mesh = json.meshes[0], prim = mesh.primitives[0];
  if (json.meshes.length !== 1 || mesh.primitives.length !== 1) throw new Error("expected one mesh with one primitive");
  const pos = Float32Array.from(readTyped(json, bin, prim.attributes.POSITION));
  const uv = Float32Array.from(readTyped(json, bin, prim.attributes.TEXCOORD_0));
  const index = Uint32Array.from(readTyped(json, bin, prim.indices));
  const count = pos.length / 3;
  const jointSets: ArrayLike<number>[] = [], weightSets: ArrayLike<number>[] = [];
  for (let s = 0; prim.attributes[`WEIGHTS_${s}`] !== undefined; s++) {
    const wa = json.accessors[prim.attributes[`WEIGHTS_${s}`]];
    const raw = readTyped(json, bin, prim.attributes[`WEIGHTS_${s}`]);
    const scale = wa.componentType === 5121 ? 1 / 255 : wa.componentType === 5123 ? 1 / 65535 : 1;
    weightSets.push(Float32Array.from(raw, (x) => x * (wa.normalized ? scale : 1)));
    jointSets.push(readTyped(json, bin, prim.attributes[`JOINTS_${s}`]));
  }
  const top = topInfluences(jointSets, weightSets, count);
  const hd = subdivideSkinned({ position: pos, uv, joints: top.joints, weights: top.weights, index });
  const vCount = hd.position.length / 3;
  if (vCount > 65535) throw new Error("too many vertices for 16-bit indices");

  // accessors still needed: animations + skin; the mesh's are replaced
  const keep = new Set<number>();
  for (const anim of json.animations ?? []) for (const sm of anim.samplers) { keep.add(sm.input); keep.add(sm.output); }
  for (const sk of json.skins ?? []) if (sk.inverseBindMatrices !== undefined) keep.add(sk.inverseBindMatrices);
  const remap = new Map<number, number>();
  const chunks: Buffer[] = [];
  const views: Json[] = [], accessors: Json[] = [];
  let offset = 0;
  const addView = (data: Buffer, target?: number) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
    views.push({ buffer: 0, byteOffset: offset, byteLength: data.byteLength, ...(target ? { target } : {}) });
    chunks.push(data); offset += data.byteLength;
    return views.length - 1;
  };
  for (const ai of [...keep].sort((a, b) => a - b)) {
    const a = json.accessors[ai];
    const na = { ...a, bufferView: addView(accessorBytes(json, bin, ai)), byteOffset: 0 };
    accessors.push(na); remap.set(ai, accessors.length - 1);
  }
  const addAccessor = (arr: ArrayBufferView, componentType: number, type: string, count: number, target?: number, extra: Json = {}) => {
    const data = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    accessors.push({ bufferView: addView(Buffer.from(data), target), byteOffset: 0, componentType, count, type, ...extra });
    return accessors.length - 1;
  };
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < vCount; v++) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c]!, hd.position[v * 3 + c]!); max[c] = Math.max(max[c]!, hd.position[v * 3 + c]!); }
  const attributes = {
    POSITION: addAccessor(hd.position, 5126, "VEC3", vCount, 34962, { min, max }),
    NORMAL: addAccessor(hd.normal, 5126, "VEC3", vCount, 34962),
    TEXCOORD_0: addAccessor(hd.uv, 5126, "VEC2", vCount, 34962),
    JOINTS_0: addAccessor(hd.joints, 5123, "VEC4", vCount, 34962),
    WEIGHTS_0: addAccessor(hd.weights, 5126, "VEC4", vCount, 34962),
  };
  const indices = addAccessor(Uint16Array.from(hd.index), 5123, "SCALAR", hd.index.length, 34963);
  prim.attributes = attributes; prim.indices = indices;
  for (const anim of json.animations ?? []) for (const sm of anim.samplers) { sm.input = remap.get(sm.input); sm.output = remap.get(sm.output); }
  for (const sk of json.skins ?? []) if (sk.inverseBindMatrices !== undefined) sk.inverseBindMatrices = remap.get(sk.inverseBindMatrices);
  json.accessors = accessors; json.bufferViews = views;
  json.asset = { ...(json.asset ?? {}), generator: "world-fracture scripts/build-operator-hd.ts", extras: { derivedFrom: path.basename(src), process: "Loop subdivision x1 + top-4 skin influences; skeleton, clips and UVs unchanged" } };
  const body = Buffer.concat(chunks);
  const binPad = (4 - (body.length % 4)) % 4, binChunk = Buffer.concat([body, Buffer.alloc(binPad)]);
  json.buffers = [{ byteLength: binChunk.length }];
  let jsonText = Buffer.from(JSON.stringify(json)); const jp = (4 - (jsonText.length % 4)) % 4; jsonText = Buffer.concat([jsonText, Buffer.alloc(jp, 0x20)]);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonText.length + 8 + binChunk.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonText.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binChunk.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(dst, Buffer.concat([header, jh, jsonText, bh, binChunk]));
  return { before: { verts: count, tris: index.length / 3 }, after: { verts: vCount, tris: hd.index.length / 3 }, bytes: fs.statSync(dst).size };
}

if (import.meta.main) {
  const dir = path.resolve(import.meta.dir, "../public/models/operators");
  for (const name of ["goliath", "nyx", "cipher"]) console.log(name, JSON.stringify(buildHd(path.join(dir, `${name}.glb`), path.join(dir, `${name}-hd.glb`))));
}
