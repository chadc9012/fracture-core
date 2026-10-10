/** Ground cover layout (pure, seeded): flowers, bushes, small rocks and reeds for every region, plus reeds and flowers along real river banks.
 * Fills the space between the big trees and props so the world reads full. Rendering lives in GroundCover.tsx; this module only decides WHERE and
 * WHAT, using the same heightAt/slope/road/river/trail rules as every other prop so nothing grows through the mission trail, roads or water. */
import { REGIONS, type Region } from "./world";
import { WATER_LEVEL, fbm, heightAt, slopeAt, riverAt, waterNetwork } from "./terrain";
import { LANE_HALF_WIDTH, distanceToRoad } from "./lanes";
import { isReserved } from "./verdant";

export type CoverKind = "flower" | "bush" | "rock" | "reed";
export type CoverItem = { kind: CoverKind; x: number; z: number; y: number; s: number; r: number; /** resolved hex colour from the region palette */ color: string };

type Spec = { flower: number; bush: number; rock: number; reed: number; flowers: readonly string[]; bushes: readonly string[]; rocks: readonly string[] };
/** per-region counts at density 1 and palettes (hex). Palettes are indexed by CoverItem.tint. */
export const COVER_SPEC: Record<string, Spec> = {
  veridan: { flower: 1100, bush: 320, rock: 140, reed: 120, flowers: ["#ff6fa8", "#ffd84a", "#f4f1e8", "#a98bff", "#ff9a3c", "#6fc8ff"], bushes: ["#2f6b3a", "#3d7a40", "#4f8a3c", "#2a5a36"], rocks: ["#7c7f78", "#6b6e66", "#8a8c82"] },
  nexus: { flower: 90, bush: 50, rock: 20, reed: 0, flowers: ["#ffffff", "#9fe8ff", "#ffd84a"], bushes: ["#35704a", "#2f6444"], rocks: ["#8a909a", "#757b86"] },
  wastelands: { flower: 90, bush: 190, rock: 240, reed: 20, flowers: ["#ff9a3c", "#ffd84a", "#d9534f"], bushes: ["#7d7a45", "#8e8650", "#6a6a3c"], rocks: ["#9b8564", "#85735a", "#a8946f"] },
  solara: { flower: 130, bush: 170, rock: 190, reed: 0, flowers: ["#ffd84a", "#ff7a3c", "#e94f6c"], bushes: ["#a39a55", "#b3a864", "#8c8a4a"], rocks: ["#b9794a", "#a5683f", "#c98b58"] },
  frostspire: { flower: 70, bush: 140, rock: 300, reed: 10, flowers: ["#bfe6ff", "#ffffff", "#9ec8ff"], bushes: ["#c8dce6", "#a9c2cf", "#dbe8ee"], rocks: ["#8a97a6", "#737f8e", "#a2adb9"] },
  ember: { flower: 60, bush: 110, rock: 320, reed: 0, flowers: ["#ff5a1f", "#ffb347"], bushes: ["#3a2a28", "#4a302a", "#2c2220"], rocks: ["#2c2a2e", "#3a363a", "#4a3a36"] },
  swamps: { flower: 170, bush: 230, rock: 60, reed: 650, flowers: ["#9be8d8", "#ffffff", "#d6a8ff"], bushes: ["#25412f", "#2f5a3c", "#1f3a2a"], rocks: ["#4a5a4c", "#3c4a3f"] },
};

/** reeds are tinted greens/olives by the renderer; the colour multiplies the blade texture */
export const REED_COLORS = ["#8aa65a", "#9db36a", "#7a9650", "#a8b872"] as const;

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const hashStr = (t: string) => t.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17);

type Rules = { maxSlope: number; minH?: number; maxH?: number; patch?: number };
const RULES: Record<CoverKind, Rules> = {
  flower: { maxSlope: 0.45, minH: WATER_LEVEL + 0.5, patch: 0.5 },
  bush: { maxSlope: 0.7, minH: WATER_LEVEL + 0.5, patch: 0.38 },
  rock: { maxSlope: 1.4, minH: WATER_LEVEL + 0.3 },
  reed: { maxSlope: 0.35, minH: WATER_LEVEL - 0.2, patch: 0.45 },
};

/** can anything stand here? never on the mission trail/spawn/crash/ambush pads, supply roads, or inside a river channel */
export function placeable(x: number, z: number, kind: CoverKind, region: Region | null): boolean {
  void region;
  if (isReserved(x, z, 1)) return false; // the mission pads are fixed world positions, whichever region circle the item came from
  if (distanceToRoad(x, z) < LANE_HALF_WIDTH) return false;
  const rv = riverAt(x, z);
  if (rv && kind !== "reed" && rv.dist < rv.w + 1.2) return false;
  return true;
}

function regionItems(region: Region, density: number): CoverItem[] {
  const spec = COVER_SPEC[region.id];
  if (!spec) return [];
  const out: CoverItem[] = [];
  (["flower", "bush", "rock", "reed"] as const).forEach((kind, ki) => {
    const want = Math.round(spec[kind] * density);
    if (!want) return;
    const rnd = rng(hashStr(region.id) * 7 + ki * 1013 + 5);
    const rule = RULES[kind];
    const palette: readonly string[] = kind === "flower" ? spec.flowers : kind === "bush" ? spec.bushes : kind === "rock" ? spec.rocks : REED_COLORS;
    let n = 0, guard = want * 25;
    while (n < want && guard-- > 0) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * region.radius * 0.97;
      const x = region.x + Math.cos(a) * d, z = region.z + Math.sin(a) * d;
      if (rule.patch !== undefined && fbm(x * 0.09 + ki * 17, z * 0.09 - ki * 9, 2) < rule.patch) continue; // meadows and thickets, not an even carpet
      const y = heightAt(x, z);
      if (y < (rule.minH ?? -99) || y > (rule.maxH ?? 999)) continue;
      if (slopeAt(x, z) > rule.maxSlope) continue;
      if (kind === "reed") { const rv = riverAt(x, z); if (y > WATER_LEVEL + 1.2 && !(rv && rv.dist < rv.w + 4)) continue; }
      if (!placeable(x, z, kind, region)) continue;
      out.push({ kind, x, z, y, s: kind === "rock" ? 0.4 + rnd() * rnd() * 2 : 0.7 + rnd() * 0.7, r: rnd() * Math.PI * 2, color: palette[Math.floor(rnd() * palette.length)]! });
      n++;
    }
  });
  return out;
}

/** reeds and wildflowers lining every wet river and lake edge */
function bankItems(density: number): CoverItem[] {
  const out: CoverItem[] = [];
  const net = waterNetwork();
  const rnd = rng(4242);
  for (const river of net.rivers) {
    if (river.dry) continue;
    const spec = COVER_SPEC[river.regionId];
    river.points.forEach((p, i) => {
      if (i % 2) return;
      for (const side of [-1, 1]) {
        if (rnd() > 0.8 * density) continue;
        const nxt = river.points[Math.min(river.points.length - 1, i + 1)]!, prv = river.points[Math.max(0, i - 1)]!;
        const tx = nxt.x - prv.x, tz = nxt.z - prv.z, tl = Math.hypot(tx, tz) || 1;
        const off = p.w + 0.6 + rnd() * 2.6;
        const x = p.x + (-tz / tl) * side * off + (rnd() - 0.5) * 2, z = p.z + (tx / tl) * side * off + (rnd() - 0.5) * 2;
        const y = heightAt(x, z);
        if (y < WATER_LEVEL - 0.2 || !placeable(x, z, "reed", REGIONS.find((r) => r.id === river.regionId) ?? null)) continue;
        const flower = rnd() < 0.35 && !!spec;
        out.push({ kind: flower ? "flower" : "reed", x, z, y, s: 0.8 + rnd() * 0.7, r: rnd() * Math.PI * 2, color: flower ? spec!.flowers[Math.floor(rnd() * spec!.flowers.length)]! : REED_COLORS[Math.floor(rnd() * REED_COLORS.length)]! });
      }
    });
  }
  return out;
}

const cache = new Map<number, CoverItem[]>();
/** the whole world's ground cover at a density (LOW ~0.35, MEDIUM ~0.7, HIGH 1, ULTRA 1.4). Cached per density. */
export function groundCover(density: number): CoverItem[] {
  const key = Math.round(density * 100);
  const hit = cache.get(key);
  if (hit) return hit;
  const all = [...REGIONS.flatMap((r) => regionItems(r, density)), ...bankItems(density)];
  cache.set(key, all);
  return all;
}
export const coverDensityFor = (tier: "LOW" | "MEDIUM" | "HIGH" | "ULTRA") => (tier === "LOW" ? 0.35 : tier === "MEDIUM" ? 0.7 : tier === "HIGH" ? 1 : 1.3);
