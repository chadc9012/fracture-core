import { REGIONS, WORLD_RADIUS } from "./world";

/* ------------------------------------------------------------------
 * Heightmap: seeded value noise (fbm) + per-region biome profiles.
 * heightAt() is the single source of truth — the mesh, prop scatter,
 * the player, vehicles and AI all sample the same function.
 * ------------------------------------------------------------------ */

export const WATER_LEVEL = -2.5;

function hash2(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = smooth(x - xi);
  const ty = smooth(y - yi);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

export function fbm(x: number, y: number, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += vnoise(x * f, y * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.05;
  }
  return sum / norm;
}

function ridged(x: number, y: number) {
  return 1 - Math.abs(fbm(x, y, 3) * 2 - 1);
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** biome weight 1 at the region centre, 0 at the rim */
function weight(d: number, radius: number) {
  return 1 - smoothstep(0.15, 1.05, d / radius);
}

export function heightAt(x: number, z: number): number {
  // rolling base terrain
  let h = fbm(x * 0.011, z * 0.011, 4) * 16 - 2;
  h += (fbm(x * 0.05 + 40, z * 0.05 - 20, 2) - 0.5) * 3;

  for (const r of REGIONS) {
    const d = Math.hypot(x - r.x, z - r.z);
    if (d > r.radius * 1.1) continue;
    const w = weight(d, r.radius);
    if (w <= 0) continue;

    switch (r.id) {
      case "frostspire": {
        // tall ridged mountain range
        const m = ridged(x * 0.02, z * 0.02);
        h = h * (1 - w) + w * (18 + m * 58);
        break;
      }
      case "ember": {
        // volcano cone with a crater
        const cone = Math.max(0, 1 - d / (r.radius * 0.85));
        const crater = smoothstep(0, 7, d);
        h = h * (1 - w) + w * (4 + cone * cone * 46 * crater + (1 - crater) * 20);
        break;
      }
      case "solara": {
        // dunes
        const dune = Math.sin(x * 0.06 + z * 0.02) * 3 + Math.sin(z * 0.09) * 2;
        h = h * (1 - w) + w * (5 + dune);
        break;
      }
      case "swamps": {
        // wet lowland, at/below water in places
        const wet = fbm(x * 0.07 - 12, z * 0.07 + 8, 3);
        h = h * (1 - w) + w * (-1.6 + wet * 4);
        break;
      }
      case "veridan": {
        h = h * (1 - w) + w * (3 + fbm(x * 0.03, z * 0.03, 3) * 8);
        break;
      }
      case "wastelands": {
        h = h * (1 - w) + w * (2.5 + (fbm(x * 0.04 + 9, z * 0.04, 3) - 0.5) * 6);
        break;
      }
      case "nexus": {
        // flat city plateau
        const pad = 1 - smoothstep(r.radius * 0.55, r.radius, d);
        h = h * (1 - w) + w * (7 * pad + h * (1 - pad) * 0.4 + 2);
        break;
      }
    }
  }

  // coastline: sink the terrain into the ocean at the world rim
  const d = Math.hypot(x, z);
  const coast = 1 - smoothstep(WORLD_RADIUS * 0.78, WORLD_RADIUS * 1.02, d);
  h = h * coast - (1 - coast) * 16;
  return h;
}

/** ground height a walker stands on (water surface if submerged) */
export function walkHeight(x: number, z: number) {
  return Math.max(WATER_LEVEL - 0.6, heightAt(x, z));
}

/** terrain steepness 0..1 — used for traction and traversal cost */
export function slopeAt(x: number, z: number) {
  const e = 2.5;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.min(1, Math.hypot(dx, dz) / (e * 2.2));
}

/* ---------------- vertex colouring ---------------- */

const PALETTE = {
  deep: [0.03, 0.16, 0.28],
  shallow: [0.09, 0.35, 0.45],
  sand: [0.76, 0.66, 0.42],
  grass: [0.2, 0.44, 0.22],
  dirt: [0.36, 0.28, 0.17],
  rock: [0.36, 0.35, 0.34],
  snow: [0.93, 0.95, 1.0],
  ash: [0.14, 0.1, 0.09],
  lava: [0.85, 0.24, 0.05],
  swamp: [0.12, 0.22, 0.15],
} as const;

function mix(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  return [
    a[0]! + (b[0]! - a[0]!) * t,
    a[1]! + (b[1]! - a[1]!) * t,
    a[2]! + (b[2]! - a[2]!) * t,
  ];
}

/**
 * Slope masking (auto-material): flats keep their biome colour, mid slopes break into exposed
 * dirt, steep faces become cliff rock — no hand painting, and any deformed terrain re-masks itself.
 * `slope` is slopeAt()'s 0..1 steepness. Returns blend weights (each 0..1, rock wins over dirt).
 * Thresholds are tuned to this heightmap (slopeAt saturates near 42 degrees), not raw 30/45 degrees.
 */
export function slopeMask(slope: number): { dirt: number; rock: number } {
  return { dirt: smoothstep(0.22, 0.5, slope), rock: smoothstep(0.5, 0.85, slope) };
}

/** colour by elevation, then tinted by the dominant biome, then cliff-masked by slope */
export function colorAt(x: number, z: number, h: number): [number, number, number] {
  let c: [number, number, number];
  if (h < -6) c = [...PALETTE.deep];
  else if (h < WATER_LEVEL) c = mix(PALETTE.deep, PALETTE.shallow, (h + 6) / 6);
  else if (h < 1.6) c = mix(PALETTE.shallow, PALETTE.sand, Math.min(1, h / 1.6));
  else if (h < 12) c = mix(PALETTE.sand, PALETTE.grass, (h - 1.6) / 10.4);
  else if (h < 26) c = mix(PALETTE.grass, PALETTE.dirt, (h - 12) / 14);
  else if (h < 44) c = mix(PALETTE.dirt, PALETTE.rock, (h - 26) / 18);
  else c = mix(PALETTE.rock, PALETTE.snow, Math.min(1, (h - 44) / 18));

  for (const r of REGIONS) {
    const d = Math.hypot(x - r.x, z - r.z);
    if (d > r.radius * 1.1) continue;
    const w = weight(d, r.radius) * 0.85;
    if (w <= 0) continue;
    if (r.id === "solara") c = mix(c, PALETTE.sand, w);
    else if (r.id === "veridan") c = mix(c, PALETTE.grass, w * 0.9);
    else if (r.id === "swamps") c = mix(c, PALETTE.swamp, w);
    else if (r.id === "ember") {
      c = mix(c, PALETTE.ash, w);
      if (h > 34) c = mix(c, PALETTE.lava, smoothstep(34, 48, h) * 0.8);
    } else if (r.id === "frostspire") c = mix(c, PALETTE.snow, w * smoothstep(24, 48, h));
    else if (r.id === "wastelands") c = mix(c, [0.55, 0.44, 0.28], w * 0.8);
    else if (r.id === "nexus") c = mix(c, [0.2, 0.24, 0.3], w);
  }

  // slope mask: steep ground sheds its grass/snow for dirt then bare rock; underwater and the
  // shoreline keep their colour so beaches and sea floors do not turn to cliff
  if (h > 1.6) {
    const { dirt, rock } = slopeMask(slopeAt(x, z));
    const cliff = (fbm(x * 0.12, z * 0.12, 2) - 0.5) * 0.1; // strata variation
    c = mix(c, [PALETTE.dirt[0] + cliff, PALETTE.dirt[1] + cliff, PALETTE.dirt[2] + cliff], dirt * 0.75);
    c = mix(c, [PALETTE.rock[0] + cliff, PALETTE.rock[1] + cliff, PALETTE.rock[2] + cliff], rock * 0.9);
  }

  // a little noise so large surfaces never read as flat colour
  const n = (fbm(x * 0.35, z * 0.35, 2) - 0.5) * 0.08;
  return [
    Math.min(1, Math.max(0, c[0] + n)),
    Math.min(1, Math.max(0, c[1] + n)),
    Math.min(1, Math.max(0, c[2] + n)),
  ];
}
