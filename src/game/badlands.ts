/** The Wastelands badlands (Stage 45 terrain pass): towering fluted sandstone buttes and thin spires in clusters across the
 * region, like the reference "sunset - The Wastelands" — the open dune plain becomes a valley of rock towers. Pure layout:
 * Badlands.tsx draws each formation with organic-geometry.ts sandstoneFormation and registers it as solid rock.
 * Formations keep clear of supply roads, rivers, landmarks, the activity sites (vault gate, arena, Rust Run rally course),
 * every baked race route through the region, and house plots, so nothing ever blocks a route or a mission. */
import { REGIONS, WORLD_SCALE } from "./world";
import { WATER_LEVEL, heightAt, riverAt, slopeAt } from "./terrain";
import { LANE_HALF_WIDTH, distanceToRoad } from "./lanes";
import { landmarksIn } from "./landmarks";
import { ARENA, RUST_RUN, VAULT_GATE } from "./wasteland-activities";
import { BAKED_ROUTES } from "./race-routes.generated";
import { inResidence } from "./residences";
import { mulberry32 } from "./rng";

export type Formation = { x: number; z: number; kind: "butte" | "spire"; /** footprint radius (m) */ r: number; /** height (m) */ h: number; yaw: number; seed: number };
export const wastelands = () => REGIONS.find((r) => r.id === "wastelands")!;

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};
/** every polyline a vehicle must be able to drive through the region: the rally loop and each baked race route */
function courses(): [number, number][][] {
  const rally = RUST_RUN.checkpoints.map((c) => [c.x, c.z] as [number, number]);
  const baked = Object.values(BAKED_ROUTES[WORLD_SCALE] ?? BAKED_ROUTES[Object.keys(BAKED_ROUTES).map(Number).sort((a, b) => b - a)[0]!] ?? {}).map((r) => r.p.map(([x, z]) => [x, z] as [number, number]));
  return [rally, ...baked];
}
let COURSES: [number, number][][] | null = null;
export function nearCourse(x: number, z: number, clear: number): boolean {
  COURSES ??= courses();
  for (const c of COURSES) for (let i = 1; i < c.length; i++) if (segDist(x, z, c[i - 1]![0], c[i - 1]![1], c[i]![0], c[i]![1]) < clear) return true;
  return false;
}

/** can a formation of footprint radius r stand at (x, z)? */
export function formationFits(x: number, z: number, r: number): boolean {
  const w = wastelands();
  if (Math.hypot(x - w.x, z - w.z) > w.radius * 0.94 - r) return false;
  if (heightAt(x, z) < WATER_LEVEL + 1.5 || slopeAt(x, z) > 0.55) return false;
  if (distanceToRoad(x, z) < LANE_HALF_WIDTH + r + 6) return false;
  const rv = riverAt(x, z); if (rv && rv.dist < rv.w + r + 6) return false;
  for (const l of landmarksIn("wastelands")) if (Math.hypot(x - l.x, z - l.z) < r + 34) return false;
  for (const s of [VAULT_GATE, ARENA]) if (Math.hypot(x - s.x, z - s.z) < s.radius + r + 14) return false;
  if (nearCourse(x, z, r + 14)) return false;
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; if (inResidence(x + Math.cos(a) * r, z + Math.sin(a) * r)) return false; }
  return !inResidence(x, z);
}

/** the formations: clusters (one big butte with spires and smaller buttes around it), seeded and stable */
export function badlands(): Formation[] {
  const w = wastelands(), rnd = mulberry32(0xbad1a), out: Formation[] = [];
  const S = 1.35; // towers up to ~75 m: monumental next to a 1.85 m operator, but sized for a ~250 m region
  const free = (x: number, z: number, r: number) => out.every((f) => Math.hypot(f.x - x, f.z - z) > f.r + r + 5);
  for (let guard = 0, clusters = 0; clusters < 16 && guard < 4000; guard++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * w.radius * 0.88;
    const cx = w.x + Math.cos(a) * d, cz = w.z + Math.sin(a) * d;
    const big = { r: (7 + rnd() * 6) * S, h: (30 + rnd() * 26) * S };
    if (!formationFits(cx, cz, big.r) || !free(cx, cz, big.r + 20)) continue;
    out.push({ x: cx, z: cz, kind: "butte", r: big.r, h: big.h, yaw: rnd() * Math.PI * 2, seed: Math.floor(rnd() * 1e6) });
    clusters++;
    const kids = 3 + Math.floor(rnd() * 4);
    for (let k = 0, tries = 0; k < kids && tries < kids * 6; tries++) {
      const spire = rnd() < 0.55, r = spire ? (1.6 + rnd() * 1.6) * S : (3.5 + rnd() * 4) * S, h = spire ? (14 + rnd() * 16) * S : (14 + rnd() * 18) * S;
      const ka = rnd() * Math.PI * 2, kd = big.r + r + 6 + rnd() * 26 * S;
      const x = cx + Math.cos(ka) * kd, z = cz + Math.sin(ka) * kd;
      if (formationFits(x, z, r) && free(x, z, r) && ++k) out.push({ x, z, kind: spire ? "spire" : "butte", r, h, yaw: rnd() * Math.PI * 2, seed: Math.floor(rnd() * 1e6) });
    }
  }
  return out;
}
