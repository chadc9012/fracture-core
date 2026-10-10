/* Chunked terrain with distance LOD. The world is WORLD_SCALE times wider than the original single-mesh ground, so the
 * heightmap is cut into CHUNK-metre tiles and each tile is built at a resolution that depends on its distance to the camera.
 * Everything here is pure: the caller injects the height / colour / surface-weight samplers (terrain.ts and
 * region-materials.ts in the game), so the grid maths, LOD choice, seam handling and skirts are unit-tested without three.js.
 *
 * Layout matches THREE.PlaneGeometry rotated by -PI/2 about X (the previous ground): local x = world x, local y = -world z,
 * local z = height. Positions therefore stay compatible with the surface-blend shader (vSurfUv = position.xy / 9). */

export const CHUNK = 96;
/** segments per chunk side at each LOD: 1.5 m, 3 m, 6 m, 12 m spacing */
export const LOD_SEGS = [64, 32, 16, 8] as const;
export const LOD_COUNT = LOD_SEGS.length;
/** distance (m, camera to the nearest point of the chunk) at which each coarser LOD takes over */
export const LOD_DISTANCE = [150, 330, 620] as const;
/** hysteresis band so a chunk on the boundary does not flip LOD every frame */
export const LOD_HYSTERESIS = 0.12;

export type ChunkCoord = { cx: number; cz: number };
export const chunkKey = (cx: number, cz: number) => `${cx},${cz}`;
export const chunkOrigin = (c: ChunkCoord) => ({ x: c.cx * CHUNK, z: c.cz * CHUNK });
export const chunkOf = (x: number, z: number): ChunkCoord => ({ cx: Math.floor(x / CHUNK), cz: Math.floor(z / CHUNK) });

/** distance from a point to the nearest point of the chunk's footprint (0 inside it) */
export function distanceToChunk(c: ChunkCoord, x: number, z: number): number {
  const x0 = c.cx * CHUNK, z0 = c.cz * CHUNK;
  const dx = Math.max(x0 - x, 0, x - (x0 + CHUNK));
  const dz = Math.max(z0 - z, 0, z - (z0 + CHUNK));
  return Math.hypot(dx, dz);
}

/** LOD for a distance; `current` (when given) is kept while the distance stays inside the hysteresis band of its edge. */
export function lodForDistance(dist: number, current?: number): number {
  let lod = 0;
  while (lod < LOD_DISTANCE.length && dist >= LOD_DISTANCE[lod]!) lod++;
  if (current === undefined || current === lod) return lod;
  if (current < lod) { // moving away: stay finer until clearly past the edge
    const edge = LOD_DISTANCE[current]!;
    return dist < edge * (1 + LOD_HYSTERESIS) ? current : lod;
  }
  // coming closer: stay coarser until clearly inside the edge
  const edge = LOD_DISTANCE[current - 1]!;
  return dist > edge * (1 - LOD_HYSTERESIS) ? current : lod;
}

/** every chunk whose footprint is within `radius` of (x, z) and whose centre is inside the playable disc (+ a margin of ocean) */
export function chunksNear(x: number, z: number, radius: number, worldRadius: number): ChunkCoord[] {
  const out: (ChunkCoord & { d: number })[] = [];
  const c0 = chunkOf(x - radius, z - radius), c1 = chunkOf(x + radius, z + radius);
  const limit = worldRadius * 1.12 + CHUNK * 0.75;
  for (let cx = c0.cx; cx <= c1.cx; cx++) for (let cz = c0.cz; cz <= c1.cz; cz++) {
    const c = { cx, cz };
    if (Math.hypot((cx + 0.5) * CHUNK, (cz + 0.5) * CHUNK) > limit) continue;
    const d = distanceToChunk(c, x, z);
    if (d <= radius) out.push({ ...c, d });
  }
  return out.sort((a, b) => a.d - b.d).map(({ cx, cz }) => ({ cx, cz }));
}

export interface ChunkSamplers {
  height: (x: number, z: number) => number;
  /** vertex colour at a world point, its height and its 0..1 slope (from the height grid, so the sampler need not re-sample the terrain) */
  color: (x: number, z: number, h: number, slope: number) => readonly [number, number, number];
  /** six surface weights summing to 1 (wA = 0..2, wB = 3..5) */
  weights: (x: number, z: number) => readonly number[];
}

export interface ChunkMesh {
  position: Float32Array;
  normal: Float32Array;
  color: Float32Array;
  wA: Float32Array;
  wB: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
  vertexCount: number;
  segs: number;
  /** min / max height of the surface (excluding skirts) for culling bounds */
  minH: number;
  maxH: number;
}

/** metres of ground texture per UV repeat of the old ground detail map (399 m / 240 tiles) */
export const DETAIL_TILE_M = 399 / 240;

/** terrain.ts slopeAt() samples +-2.5 m and divides by 5.5, so slope = |gradient| * 5 / 5.5 */
export const SLOPE_PER_GRADIENT = 5 / 5.5;

/** how far the edge skirts drop: enough to hide the height mismatch between neighbouring LODs */
export const skirtDepth = (spacing: number) => 1.5 + spacing * 0.9;

/** Resumable chunk build: LOD 0 is ~4.5k vertices of noise sampling (tens of ms), far too much for one frame, so the work is cut into
 * rows and `step(budgetMs)` does as many as fit. `buildChunk` runs it to completion for tests and tools. */
export interface ChunkBuild {
  /** do work for at most ~budgetMs (always at least one row); true when the mesh is complete */
  step(budgetMs: number): boolean;
  result(): ChunkMesh;
  readonly done: boolean;
}

export function startChunkBuild(c: ChunkCoord, lod: number, s: ChunkSamplers, now: () => number = () => (typeof performance !== "undefined" ? performance.now() : Date.now())): ChunkBuild {
  const segs = LOD_SEGS[Math.max(0, Math.min(LOD_COUNT - 1, lod))]!;
  const step = CHUNK / segs;
  const x0 = c.cx * CHUNK, z0 = c.cz * CHUNK;
  const n = segs + 1;
  // heights with a one-cell border so normals use the true neighbours and match across chunks of the same LOD
  const hn = n + 2;
  const H = new Float32Array(hn * hn);
  const hAt = (i: number, j: number) => H[(j + 1) * hn + (i + 1)]!;

  const skirtN = segs * 4;
  const vertexCount = n * n + skirtN;
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const color = new Float32Array(vertexCount * 3);
  const wA = new Float32Array(vertexCount * 3);
  const wB = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const index = new Uint32Array((segs * segs * 2 + skirtN * 2) * 3);
  let minH = Infinity, maxH = -Infinity;
  let phase: 0 | 1 | 2 = 0;
  let row = 0;
  let finished = false;

  const heightRow = (j: number) => { for (let i = 0; i < hn; i++) H[j * hn + i] = s.height(x0 + (i - 1) * step, z0 + (j - 1) * step); };
  const vertexRow = (j: number) => {
    for (let i = 0; i < n; i++) {
      const v = j * n + i;
      const x = x0 + i * step, z = z0 + j * step;
      const h = hAt(i, j);
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
      position[v * 3] = x; position[v * 3 + 1] = -z; position[v * 3 + 2] = h;
      // surface normal in plane-local space: (-dh/dx, +dh/dz_world, 1)
      const hx = (hAt(i + 1, j) - hAt(i - 1, j)) / (2 * step);
      const hz = (hAt(i, j + 1) - hAt(i, j - 1)) / (2 * step);
      const inv = 1 / Math.hypot(hx, hz, 1);
      normal[v * 3] = -hx * inv; normal[v * 3 + 1] = hz * inv; normal[v * 3 + 2] = inv;
      const col = s.color(x, z, h, Math.min(1, SLOPE_PER_GRADIENT * Math.hypot(hx, hz)));
      color[v * 3] = col[0]; color[v * 3 + 1] = col[1]; color[v * 3 + 2] = col[2];
      const w = s.weights(x, z);
      wA[v * 3] = w[0]!; wA[v * 3 + 1] = w[1]!; wA[v * 3 + 2] = w[2]!;
      wB[v * 3] = w[3]!; wB[v * 3 + 1] = w[4]!; wB[v * 3 + 2] = w[5]!;
      uv[v * 2] = x / (DETAIL_TILE_M * 240); uv[v * 2 + 1] = -z / (DETAIL_TILE_M * 240);
    }
  };
  const finalize = () => {
    // surface triangles: [a, b, c], [c, b, d] with a = (i, j), b = (i, j+1), c = (i+1, j), d = (i+1, j+1) (front face up)
    let t = 0;
    for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) {
      const a = j * n + i, b = (j + 1) * n + i, cc = j * n + i + 1, d = (j + 1) * n + i + 1;
      index[t++] = a; index[t++] = b; index[t++] = cc;
      index[t++] = cc; index[t++] = b; index[t++] = d;
    }
    // skirts: walk the border clockwise (seen from above) so [p0, p1, q1], [p0, q1, q0] faces outward
    const border: number[] = [];
    for (let i = 0; i < segs; i++) border.push(i);                           // top edge, left to right
    for (let j = 0; j < segs; j++) border.push(j * n + segs);                // right edge, top to bottom
    for (let i = segs; i > 0; i--) border.push(segs * n + i);                // bottom edge, right to left
    for (let j = segs; j > 0; j--) border.push(j * n);                       // left edge, bottom to top
    const drop = skirtDepth(step);
    const lowered = new Map<number, number>();
    border.forEach((src, k) => {
      const v = n * n + k;
      lowered.set(src, v);
      for (let q = 0; q < 3; q++) {
        position[v * 3 + q] = position[src * 3 + q]! - (q === 2 ? drop : 0);
        normal[v * 3 + q] = normal[src * 3 + q]!;
        color[v * 3 + q] = color[src * 3 + q]!;
        wA[v * 3 + q] = wA[src * 3 + q]!;
        wB[v * 3 + q] = wB[src * 3 + q]!;
      }
      uv[v * 2] = uv[src * 2]!; uv[v * 2 + 1] = uv[src * 2 + 1]!;
    });
    for (let k = 0; k < border.length; k++) {
      const p0 = border[k]!, p1 = border[(k + 1) % border.length]!;
      const q0 = lowered.get(p0)!, q1 = lowered.get(p1)!;
      index[t++] = p0; index[t++] = p1; index[t++] = q1;
      index[t++] = p0; index[t++] = q1; index[t++] = q0;
    }
    finished = true;
  };

  const api: ChunkBuild = {
    get done() { return finished; },
    step(budgetMs: number) {
      if (finished) return true;
      const t0 = now();
      do {
        if (phase === 0) { heightRow(row++); if (row >= hn) { phase = 1; row = 0; } }
        else if (phase === 1) { vertexRow(row++); if (row >= n) { phase = 2; row = 0; } }
        else { finalize(); return true; }
      } while (now() - t0 < budgetMs);
      return false;
    },
    result() {
      if (!finished) throw new Error("chunk build not finished");
      return { position, normal, color, wA, wB, uv, index, vertexCount, segs, minH, maxH };
    },
  };
  return api;
}

export function buildChunk(c: ChunkCoord, lod: number, s: ChunkSamplers): ChunkMesh {
  const b = startChunkBuild(c, lod, s);
  while (!b.step(1e9)) { /* run to completion */ }
  return b.result();
}

/** a small work queue: nearest chunks first, one entry per (chunk, lod), never builds what already exists */
export interface BuildRequest { cx: number; cz: number; lod: number; priority: number }
export function planBuilds(wanted: readonly (ChunkCoord & { lod: number; dist: number })[], have: (key: string) => number | undefined, pending: ReadonlySet<string>): BuildRequest[] {
  const out: BuildRequest[] = [];
  for (const w of wanted) {
    const key = chunkKey(w.cx, w.cz);
    if (have(key) === w.lod) continue;
    if (pending.has(`${key}@${w.lod}`)) continue;
    out.push({ cx: w.cx, cz: w.cz, lod: w.lod, priority: w.dist });
  }
  return out.sort((a, b) => a.priority - b.priority);
}
