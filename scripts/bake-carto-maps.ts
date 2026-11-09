/**
 * Bakes the street maps' land-cover images (carto-maps.ts) into public/maps/carto/ so every city and region map opens sharp at
 * once on a phone, plus each map's satellite data (cover, hill shade, depth) the game recolours into the satellite view. The game uses them only while their fingerprint matches the live world (useCartoMap), so a stale bake falls
 * back to painting in the game, never to a wrong map.
 *
 *   bun scripts/bake-carto-maps.ts [size] [id,id...]   (the Android APK workflow runs it before every build; re-run after a
 *   terrain change; with ids it bakes just those maps and keeps the rest of the manifest)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { png } from "./lib/png";
import { CARTO_MAPS, cartoBounds, cartoFingerprint, cartoSource, paintCartoAll } from "../src/game/carto-maps";

const SIZE = Number(process.argv[2] ?? 1536);
const OUT = join(process.cwd(), "public", "maps", "carto");

mkdirSync(OUT, { recursive: true });
const only = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
const prev = only && existsSync(join(OUT, "manifest.json")) ? JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf8")) : null;
const maps: Record<string, { url: string; data: string; size: number }> = prev?.maps ?? {};
for (const m of CARTO_MAPS) {
  if (only && !only.has(m.id)) continue;
  const t = performance.now();
  const { pixels, data } = paintCartoAll(SIZE, cartoBounds(m), cartoSource(m));
  writeFileSync(join(OUT, `${m.id}.png`), png(pixels, SIZE));
  // the satellite view's data (cover, shade, depth): the game recolours it on the phone (satelliteFromData)
  writeFileSync(join(OUT, `${m.id}.data.png`), png(data, SIZE));
  maps[m.id] = { url: `/maps/carto/${m.id}.png`, data: `/maps/carto/${m.id}.data.png`, size: SIZE };
  console.log(`${m.id}: ${Math.round(performance.now() - t)} ms`);
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ fingerprint: cartoFingerprint(), size: SIZE, maps }, null, 1));
console.log("wrote", OUT);
