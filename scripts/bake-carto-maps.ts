/**
 * Bakes the street maps' land-cover images (carto-maps.ts) into public/maps/carto/ so every city and region map opens sharp at
 * once on a phone. The game uses them only while their fingerprint matches the live world (useCartoMap), so a stale bake falls
 * back to painting in the game, never to a wrong map.
 *
 *   bun scripts/bake-carto-maps.ts [size]     (the Android APK workflow runs it before every build; re-run after a terrain change)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { CARTO_MAPS, cartoBounds, cartoFingerprint, paintCarto } from "../src/game/carto-maps";

const SIZE = Number(process.argv[2] ?? 1536);
const OUT = join(process.cwd(), "public", "maps", "carto");

/** RGBA pixels -> PNG (RGB, "Sub" filtered rows: flat map colours compress well) */
function png(px: Uint8ClampedArray, size: number): Buffer {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 1;
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
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
const maps: Record<string, { url: string; size: number }> = {};
for (const m of CARTO_MAPS) {
  const t = performance.now();
  writeFileSync(join(OUT, `${m.id}.png`), png(paintCarto(SIZE, cartoBounds(m)), SIZE));
  maps[m.id] = { url: `/maps/carto/${m.id}.png`, size: SIZE };
  console.log(`${m.id}: ${Math.round(performance.now() - t)} ms`);
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ fingerprint: cartoFingerprint(), size: SIZE, maps }, null, 1));
console.log("wrote", OUT);
