/**
 * Exports the web build's terrain (terrain.ts heightAt: the natural heightmap with rivers carved and supply roads graded)
 * as unreal/DataTables/Terrain.bin for AWFTerrain, plus the region ground colours it tints by.
 *
 * Format (little-endian):
 *   char[4] "WFT1"; int32 N (samples per side); float Cell (m); float Origin (m, the -x / -z corner, same on both axes);
 *   float WaterLevel (m); float HMin (m); float HStep (m per unit); int32 CompressedBytes;
 *   then CompressedBytes of zlib holding N*N uint16 heights, row by row in z (index = iz * N + ix): h = HMin + v * HStep.
 * Rules metres: x, z on the ground = Unreal X, Y; height = Unreal Z.
 *
 * Run from the repo root:
 *   npx esbuild unreal/tools/export-terrain.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/t.mjs && node /tmp/t.mjs
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { heightAt, WATER_LEVEL } from "../../src/game/terrain";
import { WORLD_RADIUS } from "../../src/game/world";

const CELL = 4;
const HALF = Math.ceil((WORLD_RADIUS * 1.05) / CELL) * CELL;
const N = (2 * HALF) / CELL + 1;
const ORIGIN = -HALF;

const heights = new Float32Array(N * N);
let lo = Infinity, hi = -Infinity;
for (let iz = 0; iz < N; iz++) {
  for (let ix = 0; ix < N; ix++) {
    const h = heightAt(ORIGIN + ix * CELL, ORIGIN + iz * CELL);
    heights[iz * N + ix] = h;
    if (h < lo) lo = h;
    if (h > hi) hi = h;
  }
}
const step = (hi - lo) / 65535 || 1;
const q = new Uint16Array(N * N);
for (let i = 0; i < q.length; i++) q[i] = Math.round((heights[i]! - lo) / step);
const packed = deflateSync(Buffer.from(q.buffer), { level: 9 });

const header = Buffer.alloc(32);
header.write("WFT1", 0, "ascii");
header.writeInt32LE(N, 4);
header.writeFloatLE(CELL, 8);
header.writeFloatLE(ORIGIN, 12);
header.writeFloatLE(WATER_LEVEL, 16);
header.writeFloatLE(lo, 20);
header.writeFloatLE(step, 24);
header.writeInt32LE(packed.length, 28);
const file = join(process.cwd(), "unreal", "DataTables", "Terrain.bin");
writeFileSync(file, Buffer.concat([header, packed]));
console.log(`Terrain.bin: ${N}x${N} samples every ${CELL} m from ${ORIGIN} m, heights ${lo.toFixed(1)}..${hi.toFixed(1)} m (step ${(step * 1000).toFixed(2)} mm), ${(packed.length / 1024).toFixed(0)} KB`);
