/** A cached, interpolated copy of the walkable ground for AI perception (line of sight, cover, flanking, grenade threat). The
 * exact ground (terrain.ts walkHeight) is an expensive stack of noise and authored landforms, and enemies sampled it every
 * couple of metres along every sight line, every frame: ~30 ms of a phone-speed frame with a squad out (play-test Nov 2).
 * Tiles of the ground are sampled once at 1 m and kept (oldest dropped past a cap); a query is a bilinear read. Placement of
 * bodies and bullets keeps using the exact ground. */
import { heightAt, walkHeight } from "./terrain";

export const GROUND_TILE = 16;   // metres per tile side
export const GROUND_STEP_M = 1;  // sample spacing (m)
const N = GROUND_TILE / GROUND_STEP_M + 1;
const MAX_TILES = 400;           // ~10 km² of ground around the fights, ~0.5 MB

export function makeGroundCache(exact: (x: number, z: number) => number, maxTiles = MAX_TILES) {
  const tiles = new Map<number, Float32Array>();
  const key = (tx: number, tz: number) => (tx + 32768) * 65536 + (tz + 32768);
  const tile = (tx: number, tz: number) => {
    const k = key(tx, tz);
    let t = tiles.get(k);
    if (t) return t;
    t = new Float32Array(N * N);
    const x0 = tx * GROUND_TILE, z0 = tz * GROUND_TILE;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) t[j * N + i] = exact(x0 + i * GROUND_STEP_M, z0 + j * GROUND_STEP_M);
    if (tiles.size >= maxTiles) tiles.delete(tiles.keys().next().value!);
    tiles.set(k, t);
    return t;
  };
  const at = (x: number, z: number): number => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return exact(x, z);
    const tx = Math.floor(x / GROUND_TILE), tz = Math.floor(z / GROUND_TILE), t = tile(tx, tz);
    const fx = (x - tx * GROUND_TILE) / GROUND_STEP_M, fz = (z - tz * GROUND_TILE) / GROUND_STEP_M;
    const i = Math.min(N - 2, Math.floor(fx)), j = Math.min(N - 2, Math.floor(fz)), u = fx - i, v = fz - j;
    const a = t[j * N + i]!, b = t[j * N + i + 1]!, c = t[(j + 1) * N + i]!, d = t[(j + 1) * N + i + 1]!;
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  return { at, size: () => tiles.size, clear: () => tiles.clear() };
}

/** the shared cache of walkHeight for AI perception */
export const aiGround = makeGroundCache(walkHeight);
export const perceptionGround = aiGround.at;
/** the same for the bare terrain (heightAt: no bridge decks or sea-floor clamp), for bullets and rockets meeting the ground */
export const terrainGround = makeGroundCache(heightAt);
export const cachedTerrainAt = terrainGround.at;
