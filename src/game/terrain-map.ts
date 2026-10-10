/** Paints the real world into a map image: hill-shaded terrain colour from the same heightAt/colorAt the game uses, deep and shallow ocean beyond the
 * coast, lakes and rivers in blue. Pure (returns RGBA bytes), so the tactical map shows the actual continent instead of bare circles, and the
 * map can never disagree with the world. */
import { WATER_LEVEL, colorAt, heightAt, riverAt, waterNetwork } from "./terrain";
import { WORLD_RADIUS } from "./world";

export const MAP_EXTENT = WORLD_RADIUS * 1.08; // world units from the centre to each edge of the map

export function terrainMapPixels(size: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const net = waterNetwork();
  const step = (2 * MAP_EXTENT) / size;
  const hs = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) hs[j * size + i] = heightAt(-MAP_EXTENT + (i + 0.5) * step, -MAP_EXTENT + (j + 0.5) * step);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = -MAP_EXTENT + (i + 0.5) * step, z = -MAP_EXTENT + (j + 0.5) * step, h = hs[j * size + i]!;
      let r: number, g: number, b: number;
      if (h < WATER_LEVEL) {
        const t = Math.min(1, Math.max(0, (WATER_LEVEL - h) / 10)); // shallow turquoise -> deep navy
        r = 40 - t * 28; g = 130 - t * 80; b = 160 - t * 60;
      } else {
        const [cr, cg, cb] = colorAt(x, z, h);
        // hillshade: light from the north-west, from the height gradient
        const hx = (hs[j * size + Math.min(size - 1, i + 1)]! - hs[j * size + Math.max(0, i - 1)]!) / (2 * step);
        const hz = (hs[Math.min(size - 1, j + 1) * size + i]! - hs[Math.max(0, j - 1) * size + i]!) / (2 * step);
        const shade = Math.min(1.35, Math.max(0.6, 1 + (-hx - hz) * 0.55));
        r = cr * 255 * shade; g = cg * 255 * shade; b = cb * 255 * shade;
        const rv = riverAt(x, z);
        if (rv && rv.dist < Math.max(rv.w, step * 0.8)) { r = 70; g = 150; b = 205; }
      }
      const k = (j * size + i) * 4;
      out[k] = r; out[k + 1] = g; out[k + 2] = b; out[k + 3] = 255;
    }
  }
  // lakes
  for (const l of net.lakes) {
    const cx = (l.x + MAP_EXTENT) / step, cy = (l.z + MAP_EXTENT) / step, rr = l.r / step;
    for (let j = Math.max(0, Math.floor(cy - rr)); j <= Math.min(size - 1, Math.ceil(cy + rr)); j++) for (let i = Math.max(0, Math.floor(cx - rr)); i <= Math.min(size - 1, Math.ceil(cx + rr)); i++) {
      if (Math.hypot(i - cx, j - cy) > rr) continue;
      const k = (j * size + i) * 4; out[k] = 62; out[k + 1] = 140; out[k + 2] = 200;
    }
  }
  return out;
}

let cached: string | null = null;
/** data URL of the painted map (browser only; cached after the first paint) */
export function terrainMapDataUrl(size = 420): string | null {
  if (cached) return cached;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(size, size);
  img.data.set(terrainMapPixels(size));
  g.putImageData(img, 0, 0);
  cached = canvas.toDataURL("image/png");
  return cached;
}
