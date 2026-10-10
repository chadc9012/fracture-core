/* Pure mesh tools for the authored operator models (rendering-free, so they are testable and also run in the offline build script).
 * The Meshy bodies have only ~1,400 unique points / ~3k triangles, so they read as chunky. `subdivideSkinned` applies one Loop
 * subdivision step (4x triangles, rounder silhouette) while keeping UV seams, skinning and a smooth normal field intact, and
 * `topInfluences` squeezes the up-to-24 skin influences Meshy exports into the 4 per vertex that three.js actually reads. */

export type SkinMesh = {
  position: Float32Array; // xyz per vertex
  uv: Float32Array; // uv per vertex
  joints: Uint16Array; // 4 joint indices per vertex
  weights: Float32Array; // 4 weights per vertex (sum 1)
  index: Uint32Array; // triangle list
};
export type SmoothMesh = SkinMesh & { normal: Float32Array; weld: Uint32Array };

/** Merge any number of influence sets (each 4 wide) into the 4 strongest per vertex, renormalised. */
export function topInfluences(jointSets: ArrayLike<number>[], weightSets: ArrayLike<number>[], count: number): { joints: Uint16Array; weights: Float32Array } {
  const joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) {
    const acc = new Map<number, number>();
    for (let s = 0; s < jointSets.length; s++) for (let k = 0; k < 4; k++) {
      const w = weightSets[s]![v * 4 + k] ?? 0;
      if (w > 0) { const j = jointSets[s]![v * 4 + k]!; acc.set(j, (acc.get(j) ?? 0) + w); }
    }
    writeTop4(joints, weights, v, acc);
  }
  return { joints, weights };
}

function writeTop4(joints: Uint16Array, weights: Float32Array, v: number, acc: Map<number, number>) {
  const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  let total = 0;
  for (const [, w] of top) total += w;
  for (let k = 0; k < 4; k++) {
    const e = top[k];
    joints[v * 4 + k] = e ? e[0] : 0;
    weights[v * 4 + k] = e && total > 0 ? e[1] / total : k === 0 ? 1 : 0;
  }
}

const edgeKey = (a: number, b: number) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);

/** Vertex ids that share a position (UV / normal seams split vertices; subdivision must treat them as one point). */
export function weldIds(position: Float32Array, precision = 1e-5): { weld: Uint32Array; count: number } {
  const n = position.length / 3, weld = new Uint32Array(n), seen = new Map<string, number>();
  const q = 1 / precision;
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(position[i * 3]! * q)},${Math.round(position[i * 3 + 1]! * q)},${Math.round(position[i * 3 + 2]! * q)}`;
    let id = seen.get(key);
    if (id === undefined) { id = seen.size; seen.set(key, id); }
    weld[i] = id;
  }
  return { weld, count: seen.size };
}

/** Smooth per-vertex normals: area-weighted face normals accumulated per *welded* point, so UV seams never show as creases. */
export function smoothNormals(position: Float32Array, index: ArrayLike<number>, weld: Uint32Array, weldCount: number): Float32Array {
  const acc = new Float64Array(weldCount * 3);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t]!, b = index[t + 1]!, c = index[t + 2]!;
    const ax = position[b * 3]! - position[a * 3]!, ay = position[b * 3 + 1]! - position[a * 3 + 1]!, az = position[b * 3 + 2]! - position[a * 3 + 2]!;
    const bx = position[c * 3]! - position[a * 3]!, by = position[c * 3 + 1]! - position[a * 3 + 1]!, bz = position[c * 3 + 2]! - position[a * 3 + 2]!;
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; // length = 2 x area
    for (const v of [a, b, c]) { const w = weld[v]! * 3; acc[w] = acc[w]! + nx; acc[w + 1] = acc[w + 1]! + ny; acc[w + 2] = acc[w + 2]! + nz; }
  }
  const out = new Float32Array(position.length);
  for (let v = 0; v < weld.length; v++) {
    const w = weld[v]! * 3;
    const x = acc[w]!, y = acc[w + 1]!, z = acc[w + 2]!, len = Math.hypot(x, y, z) || 1;
    out[v * 3] = x / len; out[v * 3 + 1] = y / len; out[v * 3 + 2] = z / len;
  }
  return out;
}

/** One Loop subdivision step. Positions are smoothed on the welded mesh (so seams cannot crack open); UVs and skin are interpolated per split vertex. */
export function subdivideSkinned(mesh: SkinMesh): SmoothMesh {
  const { position, uv, joints, weights, index } = mesh;
  const n = position.length / 3;
  const { weld, count: wc } = weldIds(position);
  // welded geometry: representative position per point, and the welded edge table
  const wpos = new Float64Array(wc * 3);
  for (let i = 0; i < n; i++) { const w = weld[i]! * 3; wpos[w] = position[i * 3]!; wpos[w + 1] = position[i * 3 + 1]!; wpos[w + 2] = position[i * 3 + 2]!; }
  type Edge = { a: number; b: number; opp: number[] };
  const edges = new Map<number, Edge>();
  for (let t = 0; t < index.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = weld[index[t + e]!]!, b = weld[index[t + (e + 1) % 3]!]!, c = weld[index[t + (e + 2) % 3]!]!;
      if (a === b) continue;
      const k = edgeKey(a, b);
      const ed = edges.get(k);
      if (ed) ed.opp.push(c); else edges.set(k, { a, b, opp: [c] });
    }
  }
  const ring: Set<number>[] = Array.from({ length: wc }, () => new Set<number>());
  const boundary: number[][] = Array.from({ length: wc }, () => []);
  const crease = new Uint8Array(wc); // non-manifold edge: keep the point where it is
  for (const ed of edges.values()) {
    ring[ed.a]!.add(ed.b); ring[ed.b]!.add(ed.a);
    if (ed.opp.length === 1) { boundary[ed.a]!.push(ed.b); boundary[ed.b]!.push(ed.a); }
    else if (ed.opp.length > 2) { crease[ed.a] = 1; crease[ed.b] = 1; }
  }
  const moved = new Float64Array(wc * 3);
  for (let v = 0; v < wc; v++) {
    const px = wpos[v * 3]!, py = wpos[v * 3 + 1]!, pz = wpos[v * 3 + 2]!;
    const bd = boundary[v]!;
    if (crease[v] || ring[v]!.size < 3) { moved[v * 3] = px; moved[v * 3 + 1] = py; moved[v * 3 + 2] = pz; continue; }
    if (bd.length === 2) {
      for (let c = 0; c < 3; c++) moved[v * 3 + c] = 0.75 * wpos[v * 3 + c]! + 0.125 * (wpos[bd[0]! * 3 + c]! + wpos[bd[1]! * 3 + c]!);
      continue;
    }
    if (bd.length > 0) { moved[v * 3] = px; moved[v * 3 + 1] = py; moved[v * 3 + 2] = pz; continue; }
    const k = ring[v]!.size, beta = k === 3 ? 3 / 16 : 3 / (8 * k);
    let sx = 0, sy = 0, sz = 0;
    for (const nb of ring[v]!) { sx += wpos[nb * 3]!; sy += wpos[nb * 3 + 1]!; sz += wpos[nb * 3 + 2]!; }
    moved[v * 3] = (1 - k * beta) * px + beta * sx; moved[v * 3 + 1] = (1 - k * beta) * py + beta * sy; moved[v * 3 + 2] = (1 - k * beta) * pz + beta * sz;
  }
  // one new point per welded edge
  const edgeIds = new Map<number, number>();
  const edgePos: number[] = [];
  const edgePoint = (a: number, b: number): number => {
    const k = edgeKey(a, b);
    let id = edgeIds.get(k);
    if (id !== undefined) return id;
    id = edgeIds.size; edgeIds.set(k, id);
    const ed = edges.get(k);
    if (ed && ed.opp.length === 2) {
      for (let c = 0; c < 3; c++) edgePos.push(0.375 * (wpos[a * 3 + c]! + wpos[b * 3 + c]!) + 0.125 * (wpos[ed.opp[0]! * 3 + c]! + wpos[ed.opp[1]! * 3 + c]!));
    } else for (let c = 0; c < 3; c++) edgePos.push(0.5 * (wpos[a * 3 + c]! + wpos[b * 3 + c]!));
    return id;
  };
  // output vertices: the originals (smoothed), then one per split edge
  const splitEdges = new Map<number, number>();
  const outPos: number[] = [], outUv: number[] = [], outWeld: number[] = [], outJoints: number[] = [], outWeights: number[] = [];
  for (let i = 0; i < n; i++) {
    const w = weld[i]! * 3;
    outPos.push(moved[w]!, moved[w + 1]!, moved[w + 2]!);
    outUv.push(uv[i * 2]!, uv[i * 2 + 1]!);
    outWeld.push(weld[i]!);
    for (let k = 0; k < 4; k++) { outJoints.push(joints[i * 4 + k]!); outWeights.push(weights[i * 4 + k]!); }
  }
  const mid = (a: number, b: number): number => {
    const key = edgeKey(a, b);
    const have = splitEdges.get(key);
    if (have !== undefined) return have;
    const id = outPos.length / 3;
    splitEdges.set(key, id);
    const wa = weld[a]!, wb = weld[b]!;
    if (wa === wb) outPos.push((position[a * 3]! + position[b * 3]!) / 2, (position[a * 3 + 1]! + position[b * 3 + 1]!) / 2, (position[a * 3 + 2]! + position[b * 3 + 2]!) / 2), outWeld.push(wc + 0x3fffffff - id);
    else { const e = edgePoint(wa, wb); outPos.push(edgePos[e * 3]!, edgePos[e * 3 + 1]!, edgePos[e * 3 + 2]!); outWeld.push(wc + e); }
    outUv.push((uv[a * 2]! + uv[b * 2]!) / 2, (uv[a * 2 + 1]! + uv[b * 2 + 1]!) / 2);
    const acc = new Map<number, number>();
    for (const [v, f] of [[a, 0.5], [b, 0.5]] as const) for (let k = 0; k < 4; k++) { const w = weights[v * 4 + k]! * f; if (w > 0) { const j = joints[v * 4 + k]!; acc.set(j, (acc.get(j) ?? 0) + w); } }
    const tj = new Uint16Array(4), tw = new Float32Array(4);
    writeTop4(tj, tw, 0, acc);
    for (let k = 0; k < 4; k++) { outJoints.push(tj[k]!); outWeights.push(tw[k]!); }
    return id;
  };
  const outIndex: number[] = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t]!, b = index[t + 1]!, c = index[t + 2]!;
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    outIndex.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
  }
  // welded ids of the new points are only used to share normals; remap them to a dense range
  const dense = new Map<number, number>();
  const weldOut = new Uint32Array(outWeld.length);
  outWeld.forEach((w, i) => { let d = dense.get(w); if (d === undefined) { d = dense.size; dense.set(w, d); } weldOut[i] = d; });
  const positionOut = Float32Array.from(outPos);
  const indexOut = Uint32Array.from(outIndex);
  return { position: positionOut, uv: Float32Array.from(outUv), joints: Uint16Array.from(outJoints), weights: Float32Array.from(outWeights), index: indexOut, weld: weldOut, normal: smoothNormals(positionOut, indexOut, weldOut, dense.size) };
}

/** Signed curvature per vertex, ~-1..1: positive on convex ridges and edges, negative in creases and cavities. Uses the umbrella Laplacian
 * on the welded mesh (neighbour average vs the point, projected on the normal), normalised by edge length, then smoothed once.
 * Painted as baked cavity shading + edge wear, it gives a low-poly body the definition a flat colour cannot. */
export function vertexCurvature(position: Float32Array, normal: Float32Array, index: ArrayLike<number>, weld: Uint32Array, weldCount: number, gain = 7): Float32Array {
  const sum = new Float64Array(weldCount * 3), deg = new Uint32Array(weldCount), rep = new Uint32Array(weldCount);
  const seen = new Uint8Array(weldCount);
  for (let v = 0; v < weld.length; v++) if (!seen[weld[v]!]) { seen[weld[v]!] = 1; rep[weld[v]!] = v; }
  const pairs = new Set<number>();
  let edgeLen = 0, edgeN = 0;
  for (let t = 0; t < index.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = index[t + e]!, b = index[t + (e + 1) % 3]!, wa = weld[a]!, wb = weld[b]!;
    if (wa === wb) continue;
    const k = edgeKey(wa, wb);
    if (pairs.has(k)) continue;
    pairs.add(k);
    for (let c = 0; c < 3; c++) { sum[wa * 3 + c] = sum[wa * 3 + c]! + position[b * 3 + c]!; sum[wb * 3 + c] = sum[wb * 3 + c]! + position[a * 3 + c]!; }
    deg[wa] = deg[wa]! + 1; deg[wb] = deg[wb]! + 1;
    edgeLen += Math.hypot(position[a * 3]! - position[b * 3]!, position[a * 3 + 1]! - position[b * 3 + 1]!, position[a * 3 + 2]! - position[b * 3 + 2]!); edgeN++;
  }
  const avg = edgeN ? edgeLen / edgeN : 1;
  const raw = new Float32Array(weldCount);
  for (let w = 0; w < weldCount; w++) {
    if (!deg[w]) continue;
    const v = rep[w]!;
    const lx = sum[w * 3]! / deg[w]! - position[v * 3]!, ly = sum[w * 3 + 1]! / deg[w]! - position[v * 3 + 1]!, lz = sum[w * 3 + 2]! / deg[w]! - position[v * 3 + 2]!;
    raw[w] = -(lx * normal[v * 3]! + ly * normal[v * 3 + 1]! + lz * normal[v * 3 + 2]!) / avg;
  }
  // one smoothing pass over the weld graph
  const acc = new Float64Array(weldCount);
  const cnt = new Uint32Array(weldCount);
  for (const k of pairs) { const a = Math.floor(k / 4294967296), b = k - a * 4294967296; acc[a] = acc[a]! + raw[b]!; cnt[a] = cnt[a]! + 1; acc[b] = acc[b]! + raw[a]!; cnt[b] = cnt[b]! + 1; }
  const out = new Float32Array(weld.length);
  for (let v = 0; v < weld.length; v++) {
    const w = weld[v]!;
    const s = cnt[w] ? 0.5 * raw[w]! + 0.5 * (acc[w]! / cnt[w]!) : raw[w]!;
    out[v] = Math.max(-1, Math.min(1, s * gain));
  }
  return out;
}
