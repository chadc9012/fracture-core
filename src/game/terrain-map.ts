/** Paints the real world into a map image: hill-shaded terrain colour from the same heightAt/colorAt the game uses, contour lines, a depth-graded
 * ocean with surf at the coast, lakes and rivers in blue. Pure (returns RGBA bytes), so the tactical map shows the actual continent instead of
 * bare circles, and the map can never disagree with the world.
 *
 * The raster is a resumable job: sampling the terrain for every pixel costs seconds on a weak machine, so the UI steps it a few milliseconds per
 * frame (useTerrainMap) instead of freezing the map screen. `terrainMapPixels` runs the same job to completion in one call. */
import { WATER_LEVEL, colorAt, heightAt, riverAt, waterNetwork } from "./terrain";
import { REGIONS, WORLD_RADIUS } from "./world";

export const MAP_EXTENT = WORLD_RADIUS * 1.08; // world units from the centre to each edge of the map
/** the ocean colour at the map's edge (also used as the screen background so the square image blends in) */
export const MAP_OCEAN_EDGE = "#0a2b55";
/** metres between contour lines; every 5th is an index line */
export const CONTOUR_INTERVAL = 10;
export const CONTOUR_INDEX_EVERY = 5;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Ocean colour by depth below the waterline: turquoise shallows into deep navy. */
export function oceanColor(depth: number): [number, number, number] {
  const t = clamp01(depth / 30), s = smooth(0.1, 0.5, t);
  const shallow: [number, number, number] = [72, 190, 196], mid: [number, number, number] = [26, 120, 176], deep: [number, number, number] = [12, 50, 100];
  const a = [mix(shallow[0], mid[0], s), mix(shallow[1], mid[1], s), mix(shallow[2], mid[2], s)] as const;
  const d = smooth(0.4, 1, t);
  return [mix(a[0], deep[0], d), mix(a[1], deep[1], d), mix(a[2], deep[2], d)];
}

/** Game ground colour -> map colour: lifted and a touch more saturated, so the dark in-game palette reads as a map, not as mud. */
export function mapLand(r: number, g: number, b: number): [number, number, number] {
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b, sat = 1.1;
  const lift = (c: number) => clamp01((L + (c - L) * sat) * 1.16 + 0.035);
  return [lift(r), lift(g), lift(b)];
}

/** Painterly biome tints (the in-game ground colours are dark; the illustrated map reads vivid): a region pulls nearby land toward its own palette. */
const BIOME: Record<string, { c: [number, number, number]; k: number }> = {
  veridan: { c: [38, 132, 56], k: 0.6 }, frostspire: { c: [226, 238, 252], k: 0.55 }, ember: { c: [52, 32, 30], k: 0.65 },
  wastelands: { c: [216, 150, 80], k: 0.5 }, solara: { c: [238, 178, 94], k: 0.6 }, swamps: { c: [30, 100, 78], k: 0.6 }, nexus: { c: [128, 156, 176], k: 0.45 },
};
function hash2(x: number, y: number): number { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** 2D value noise, 0..1 */
export function vnoise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return mix(mix(hash2(xi, yi), hash2(xi + 1, yi), u), mix(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
/** Land colour after biome tint and painterly texture (canopy mottling in the forest, glowing lava veins on Ember). RGB 0..255. */
export function biomeLand(x: number, z: number, h: number, base: [number, number, number]): [number, number, number] {
  let [r, g, b] = base;
  for (const reg of REGIONS) {
    const def = BIOME[reg.id];
    if (!def) continue;
    const d = Math.hypot(x - reg.x, z - reg.z) / reg.radius, w = 1 - smooth(0.55, 1.2, d);
    if (w <= 0) continue;
    let k = def.k * w;
    if (reg.id === "frostspire") k *= smooth(8, 55, h - WATER_LEVEL);
    r = mix(r, def.c[0], k); g = mix(g, def.c[1], k); b = mix(b, def.c[2], k);
    if (reg.id === "veridan") { const m = 0.78 + 0.44 * (0.6 * vnoise2(x / 7, z / 7) + 0.4 * vnoise2(x / 2.6, z / 2.6)); r *= m; g *= m; b *= m; }
    else if (reg.id === "ember") {
      const vein = Math.abs(vnoise2(x / 16, z / 16) - 0.5) * 2; // ridged noise: thin bright lines
      const glow = smooth(0.86, 0.975, 1 - vein) * w * (0.55 + 0.45 * smooth(-4, 30, h - WATER_LEVEL));
      r = mix(r, 255, glow); g = mix(g, 112, glow); b = mix(b, 28, glow);
    }
  }
  return [r, g, b];
}

export type MapJob = {
  readonly size: number;
  readonly pixels: Uint8ClampedArray;
  /** run for about `budgetMs` milliseconds; returns true when the whole image is painted */
  step(budgetMs: number): boolean;
  /** 0..1 */
  progress(): number;
};

export function createMapJob(size: number): MapJob {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const hs = new Float32Array(size * size);
  const net = waterNetwork();
  const stepM = (2 * MAP_EXTENT) / size;
  let hDone = 0, sDone = 0, lakesDone = false;
  const WL = WATER_LEVEL;
  const sun = (() => { const x = -0.6, y = 0.62, z = -0.5, l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l }; })();
  const H = (i: number, j: number) => hs[Math.min(size - 1, Math.max(0, j)) * size + Math.min(size - 1, Math.max(0, i))]!;

  const heightRow = (j: number) => { for (let i = 0; i < size; i++) hs[j * size + i] = heightAt(-MAP_EXTENT + (i + 0.5) * stepM, -MAP_EXTENT + (j + 0.5) * stepM); };
  const shadeRow = (j: number) => {
    for (let i = 0; i < size; i++) {
      const x = -MAP_EXTENT + (i + 0.5) * stepM, z = -MAP_EXTENT + (j + 0.5) * stepM, h = hs[j * size + i]!;
      let r: number, g: number, b: number;
      if (h < WL) {
        const depth = WL - h;
        [r, g, b] = oceanColor(depth);
        // surf: a soft pale band along the coast
        const foam = (1 - smooth(0, 1.6, depth)) * 0.55;
        r = mix(r, 235, foam); g = mix(g, 244, foam); b = mix(b, 246, foam);
      } else {
        const [cr, cg, cb] = colorAt(x, z, h);
        const lc = mapLand(cr, cg, cb);
        [r, g, b] = biomeLand(x, z, h, [lc[0] * 255, lc[1] * 255, lc[2] * 255]);
        // hillshade from the north-west, exaggerated so relief reads on a flat 1.6 km image
        // slope over +-2 pixels so fine surface noise does not turn into orange-peel shading
        const gx = (H(i + 2, j) - H(i - 2, j) + H(i + 2, j + 1) - H(i - 2, j + 1) + H(i + 2, j - 1) - H(i - 2, j - 1)) / (12 * stepM), gz = (H(i, j + 2) - H(i, j - 2) + H(i + 1, j + 2) - H(i + 1, j - 2) + H(i - 1, j + 2) - H(i - 1, j - 2)) / (12 * stepM), ex = 2.6;
        const nx = -gx * ex, nz = -gz * ex, nl = Math.hypot(nx, 1, nz);
        const lam = (nx * sun.x + 1 * sun.y + nz * sun.z) / nl;
        const shade = Math.min(1.45, Math.max(0.5, 1 + (lam - sun.y) * 1.7));
        r *= shade; g *= shade; b *= shade;
        // contour lines: a line where the elevation band changes between neighbouring pixels (index lines every 5th, a little stronger)
        const band = Math.floor((h - WL) / CONTOUR_INTERVAL), bx = Math.floor((H(i + 1, j) - WL) / CONTOUR_INTERVAL), bz = Math.floor((H(i, j + 1) - WL) / CONTOUR_INTERVAL);
        if ((bx !== band || bz !== band) && h > WL + 1.2) {
          const hi = Math.max(band, bx, bz), index = hi % CONTOUR_INDEX_EVERY === 0;
          const k = index ? 0.74 : 0.9;
          r *= k; g *= k * 0.98; b *= k * 0.94;
        }
        // shoreline: a thin dark outline where land meets water
        if (H(i + 1, j) < WL || H(i - 1, j) < WL || H(i, j + 1) < WL || H(i, j - 1) < WL) { r *= 0.62; g *= 0.66; b *= 0.7; }
        // rivers, soft-edged
        const rv = riverAt(x, z);
        if (rv) {
          const t = 1 - smooth(Math.max(rv.w * 0.6, stepM * 0.45), Math.max(rv.w, stepM * 0.9), rv.dist);
          if (t > 0) { r = mix(r, 70, t); g = mix(g, 150, t); b = mix(b, 208, t); }
        }
      }
      // gentle vignette toward the frame
      const edge = Math.hypot(x, z) / MAP_EXTENT, vig = 1 - 0.32 * smooth(0.82, 1.35, edge);
      const k = (j * size + i) * 4;
      pixels[k] = r * vig; pixels[k + 1] = g * vig; pixels[k + 2] = b * vig; pixels[k + 3] = 255;
    }
  };
  const paintLakes = () => {
    for (const l of net.lakes) {
      const cx = (l.x + MAP_EXTENT) / stepM, cy = (l.z + MAP_EXTENT) / stepM, rr = l.r / stepM;
      for (let j = Math.max(0, Math.floor(cy - rr - 1)); j <= Math.min(size - 1, Math.ceil(cy + rr + 1)); j++) for (let i = Math.max(0, Math.floor(cx - rr - 1)); i <= Math.min(size - 1, Math.ceil(cx + rr + 1)); i++) {
        const d = Math.hypot(i - cx, j - cy);
        if (d > rr + 0.6) continue;
        const t = 1 - smooth(rr - 0.7, rr + 0.6, d), deep = 1 - clamp01(d / rr), k = (j * size + i) * 4;
        pixels[k] = mix(pixels[k]!, mix(70, 44, deep), t); pixels[k + 1] = mix(pixels[k + 1]!, mix(150, 118, deep), t); pixels[k + 2] = mix(pixels[k + 2]!, mix(208, 178, deep), t);
      }
    }
  };
  return {
    size, pixels,
    progress: () => (lakesDone ? 1 : Math.min(0.99, (hDone + sDone) / (2 * size))),
    step(budgetMs) {
      if (lakesDone) return true;
      const t0 = performance.now();
      do {
        // keep three height rows ahead of the shading row (it reads its neighbours)
        if (hDone < size && hDone <= sDone + 3) heightRow(hDone++);
        else if (sDone < size) shadeRow(sDone++);
        else { paintLakes(); lakesDone = true; return true; }
      } while (performance.now() - t0 < budgetMs);
      return false;
    },
  };
}

export function terrainMapPixels(size: number): Uint8ClampedArray {
  const job = createMapJob(size);
  while (!job.step(Infinity)) { /* runs to completion */ }
  return job.pixels;
}

export function pixelsToDataUrl(pixels: Uint8ClampedArray, size: number): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(size, size);
  img.data.set(pixels);
  g.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

let cached: string | null = null;
/** data URL of the painted map, synchronous (browser only; cached). Prefer useTerrainMap, which paints progressively without freezing. */
export function terrainMapDataUrl(size = 420): string | null {
  if (cached) return cached;
  cached = pixelsToDataUrl(terrainMapPixels(size), size);
  return cached;
}
