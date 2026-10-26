/**
 * Bakes the painted map images (terrain-map.ts) into public/maps/terrain/ so the map opens sharp at once. On phones the
 * progressive paint took 20-60 s at full size, so the owner saw the blocky preview (Oct 26 shots). The game uses these only
 * while their fingerprint matches the live terrain (useTerrainMap), so a stale bake falls back to painting, never to a wrong map.
 *
 *   bun scripts/bake-terrain-maps.ts      (the Android APK workflow runs it before every build; re-run after a terrain change)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { createMapJob, detailBounds, detailKey, mapFingerprint, terrainMapPixels, WORLD_BOUNDS } from "../src/game/terrain-map";
import { DESTINATIONS } from "../src/game/destination-director";
import { REGIONS } from "../src/game/world";

const WORLD = 1024, DETAIL = 768;
const OUT = join(process.cwd(), "public", "maps", "terrain");

/** RGBA pixels -> PNG (RGB, "Sub" filtered rows) */
function png(px: Uint8ClampedArray, size: number): Buffer {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 1; // Sub
    for (let x = 0; x < size; x++) for (let c = 0; c < 3; c++) {
      const v = px[(y * size + x) * 4 + c]!, left = x ? px[(y * size + x - 1) * 4 + c]! : 0;
      raw[row + 1 + x * 3 + c] = (v - left) & 255;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const paint = (size: number, bounds = WORLD_BOUNDS) => { const job = createMapJob(size, bounds); while (!job.step(Infinity)) { /* to completion */ } return job.pixels; };

mkdirSync(OUT, { recursive: true });
const t0 = performance.now();
const fingerprint = mapFingerprint();
writeFileSync(join(OUT, "world.png"), png(terrainMapPixels(WORLD), WORLD));
const details: Record<string, { url: string; bounds: ReturnType<typeof detailBounds> }> = {};
for (const d of DESTINATIONS) {
  const region = REGIONS.find((r) => r.id === d.regionId);
  const focus = { x: d.x, z: d.z, radius: d.reach ?? region?.radius ?? 100 };
  const bounds = detailBounds(focus), file = `${d.id}.png`;
  writeFileSync(join(OUT, file), png(paint(DETAIL, bounds), DETAIL));
  details[detailKey(focus)] = { url: `/maps/terrain/${file}`, bounds };
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ fingerprint, world: { url: "/maps/terrain/world.png", size: WORLD }, detailSize: DETAIL, details }, null, 1) + "\n");
console.log(`baked ${1 + Object.keys(details).length} map images (${fingerprint}) in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
