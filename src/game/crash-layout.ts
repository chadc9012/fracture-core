/* Layout of the crash-site set dressing and trail wear, as pure data: where the hull lies, its collision circles,
 * the secondary scout wreck, supply crates thrown along the skid, tyre ruts and puddles on the trail.
 * Everything is deterministic and keeps clear of the trail, so no decoration can block the mission route. */
import { HULL_AXIS, IMPACT_PIT } from "./forest-relief";
import { heightAt, slopeAt } from "./terrain";
import { CRASH_SITE, ENCOUNTER, FURROW, TRAIL, TRAIL_HALF_WIDTH, trailInfo } from "./verdant";

type P = { x: number; z: number };
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** The crashed transport: nose buried at the impact pit, lying out along the skid, tail raised. Local +X runs nose → tail. */
export const HULL = { x: IMPACT_PIT.x, z: IMPACT_PIT.z, yaw: Math.atan2(-HULL_AXIS.z, HULL_AXIS.x), pitch: 0.2, length: 12, radius: 1.9, sink: 0.3 } as const;

/** world position `along` metres from the nose along the hull axis (ground plan, ignoring pitch) */
export const hullPoint = (along: number): P => ({ x: HULL.x + HULL_AXIS.x * along, z: HULL.z + HULL_AXIS.z * along });

/** collision circles down the hull (the three heavy sections the old box debris provided, now following the real shape) */
export const HULL_SOLIDS = [2.5, 5.5, 8.5, 11].map((along) => ({ ...hullPoint(along), r: 2.1 }));

const clearOfRoute = (p: P, margin: number) => trailInfo(p.x, p.z).dist > TRAIL_HALF_WIDTH + margin && Math.hypot(p.x - ENCOUNTER.x, p.z - ENCOUNTER.z) > ENCOUNTER.radius + margin;

/** a smaller damaged scout craft off the trail, between the spawn and the ambush clearing, angled toward the road */
export const SCOUT: { x: number; z: number; yaw: number; length: number; radius: number } | null = (() => {
  for (const frac of [0.3, 0.25, 0.35, 0.2, 0.4]) {
    const i = Math.floor((TRAIL.length - 1) * frac);
    const a = TRAIL[i]!, b = TRAIL[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    for (const side of [1, -1]) for (const off of [8, 10, 12]) {
      const x = a.x + (-(b.z - a.z) / len) * off * side, z = a.z + ((b.x - a.x) / len) * off * side;
      if (!clearOfRoute({ x, z }, 4.5) || slopeAt(x, z) > 0.25 || heightAt(x, z) < 0) continue;
      // lies roughly along the road, nose pointing back toward it
      return { x, z, yaw: Math.atan2(-(b.z - a.z), b.x - a.x) + 0.5 * side, length: 5.2, radius: 0.95 };
    }
  }
  return null;
})();

export type Crate = { x: number; z: number; w: number; h: number; d: number; yaw: number; tilt: number; open: boolean };
/** supply crates thrown clear of the hull, strewn along the skid and fanning out from the impact; some burst open */
export const CRATES: readonly Crate[] = (() => {
  const r = rng(4242);
  const out: Crate[] = [];
  let guard = 400;
  while (out.length < 11 && guard-- > 0) {
    const along = 3 + r() * (FURROW.length - 3);
    const spread = 2.2 + (along / FURROW.length) * 4 + r() * 2.5; // the debris fan widens down the skid
    const across = (r() < 0.5 ? -1 : 1) * (FURROW.width / 2 + 0.4 + r() * spread);
    const x = CRASH_SITE.x + FURROW.dx * along - FURROW.dz * across, z = CRASH_SITE.z + FURROW.dz * along + FURROW.dx * across;
    if (!clearOfRoute({ x, z }, 1.4) || slopeAt(x, z) > 0.4) continue;
    if (HULL_SOLIDS.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.9)) continue;
    if (out.some((c) => Math.hypot(c.x - x, c.z - z) < 2)) continue;
    const s = 0.8 + r() * 0.6;
    out.push({ x, z, w: 1.2 * s, h: 0.8 * s, d: 0.9 * s, yaw: r() * 6.28, tilt: (r() - 0.5) * 0.7, open: r() < 0.4 });
  }
  return out;
})();

export type Puddle = { x: number; z: number; r: number; stretch: number; yaw: number };
/** shallow standing water in low, level spots beside and on the trail */
export const PUDDLES: readonly Puddle[] = (() => {
  const r = rng(909);
  const out: Puddle[] = [];
  for (let i = 4; i < TRAIL.length - 4; i += 5) {
    const a = TRAIL[i]!, b = TRAIL[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const off = (r() - 0.5) * 2.4;
    const x = a.x + (-(b.z - a.z) / len) * off, z = a.z + ((b.x - a.x) / len) * off;
    if (r() < 0.35 || slopeAt(x, z) > 0.12) continue;
    if (Math.hypot(x - CRASH_SITE.x, z - CRASH_SITE.z) < 9) continue;
    out.push({ x, z, r: 0.5 + r() * 0.8, stretch: 1.4 + r() * 1.2, yaw: Math.atan2(b.z - a.z, b.x - a.x) });
  }
  return out;
})();

/** two wheel-rut lines along the trail, offset from the centre-line (metres), as point lists */
export function rutLines(offset = 0.8): P[][] {
  return [-1, 1].map((side) => TRAIL.map((p, i) => {
    const a = TRAIL[Math.max(0, i - 1)]!, b = TRAIL[Math.min(TRAIL.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: p.x + (-(b.z - a.z) / len) * offset * side, z: p.z + ((b.x - a.x) / len) * offset * side };
  }));
}
