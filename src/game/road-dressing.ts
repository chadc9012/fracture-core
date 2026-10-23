/** What the supply roads look like and what stands beside them — pure placement, no three.js (RoadDressing.tsx and
 * Roads.tsx draw it, road-dressing.test.ts checks it).
 *
 * - Every road has a surface class: the highways and convoy roads between the big hubs are asphalt with lane lines, the
 *   mountain and ridge routes are gravel, the forest road and the swamp causeway stay packed dirt.
 * - Roadside furniture follows the class: reflector posts every ~24 m on asphalt and gravel, guard rails where the verge
 *   drops away (embankments, cuttings above water) and on the approaches to every bridge, street lamps for the last
 *   stretch into each hub on asphalt, and a destination sign leaving each hub.
 * - Every resolved river crossing (terrain.ts riverCrossings) gets a real bridge: the deck already carries the player
 *   (deckAt), so the model is built on exactly that deck — slab, kerbs, rails, piers down to the bed and abutments.
 *
 * Nothing is placed in water, on a bridge span (except the bridge itself), inside a hub, or on the 7.2 m surfaced strip. */
import { LANES, ROAD_SAMPLES, distanceToRoad, laneSamples, type Lane } from "./lanes";
import { ROAD_HALF } from "./road-ribbon";
import { WATER_LEVEL, heightAt, riverCrossings, type Crossing } from "./terrain";

export type RoadKind = "asphalt" | "gravel" | "dirt";

/** the road's surface from its name: the hub-to-hub trunk roads are paved */
export function roadKind(lane: Lane): RoadKind {
  if (/highway|industrial|convoy/i.test(lane.name)) return "asphalt";
  if (/pass|ridge|southern/i.test(lane.name)) return "gravel";
  return "dirt";
}

export type Post = { x: number; z: number; y: number; yaw: number };
export type Rail = { x: number; z: number; y: number; yaw: number; length: number };
export type Lamp = { x: number; z: number; y: number; yaw: number };
export type Sign = { x: number; z: number; y: number; yaw: number; to: string; km: number; kind: RoadKind };
export type Bridge = { x: number; z: number; deck: number; yaw: number; length: number; width: number; kind: RoadKind; piers: { along: number; side: number; bed: number }[] };

const POST_EVERY = 24, LAMP_EVERY = 30, LAMP_REACH = 160, RAIL_DROP = 1.6;
/** posts and rails stand this far from the centre line: just off the surfaced strip, inside the graded corridor */
export const VERGE = ROAD_HALF + 1.1;

type Sample = { x: number; z: number; along: number; nx: number; nz: number; yaw: number };
function walk(lane: Lane): Sample[] {
  const pts = laneSamples(lane, ROAD_SAMPLES);
  let along = 0;
  return pts.map((p, i) => {
    if (i > 0) along += Math.hypot(p.x - pts[i - 1]!.x, p.z - pts[i - 1]!.z);
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
    return { x: p.x, z: p.z, along, nx: -dz / len, nz: dx / len, yaw: Math.atan2(dx, dz) };
  });
}

let bridgesCache: Crossing[] | null = null;
const resolved = () => (bridgesCache ??= riverCrossings().filter((c) => c.resolved));
/** within `pad` metres of a bridge span (measured along the bridge axis) */
export function nearBridge(x: number, z: number, pad = 2): boolean {
  return resolved().some((c) => {
    const dx = x - c.x, dz = z - c.z, along = dx * c.dirX + dz * c.dirZ, across = -dx * c.dirZ + dz * c.dirX;
    return Math.abs(along) < c.length / 2 + pad && Math.abs(across) < c.width / 2 + 6;
  });
}
/** only the walled city cores (Nexus, Neon) keep their own street furniture; a road end in a wilderness region is open country */
const CITY_CORE = 60;
const inHub = (lane: Lane, x: number, z: number) => [lane.a, lane.b].some((h) => h.radius < CITY_CORE && Math.hypot(x - h.x, z - h.z) < h.radius * 0.95);
/** dry ground that isn't another road's surfaced strip (roads meet and run close near the hub gates) */
const dry = (x: number, z: number) => heightAt(x, z) > WATER_LEVEL + 0.4 && distanceToRoad(x, z) > ROAD_HALF + 0.6;

export type RoadDressing = { posts: Post[]; rails: Rail[]; lamps: Lamp[]; signs: Sign[] };

export function laneDressing(lane: Lane): RoadDressing {
  const kind = roadKind(lane), s = walk(lane), total = s[s.length - 1]!.along;
  const posts: Post[] = [], rails: Rail[] = [], lamps: Lamp[] = [], signs: Sign[] = [];
  const at = (p: Sample, side: number, off = VERGE) => ({ x: p.x + p.nx * off * side, z: p.z + p.nz * off * side });
  const ok = (lane2: Lane, x: number, z: number) => dry(x, z) && !inHub(lane2, x, z) && !nearBridge(x, z, 1);
  let nextPost = POST_EVERY / 2, nextLamp = 0;
  for (let i = 1; i < s.length; i++) {
    const p = s[i]!, q = s[i - 1]!;
    // reflector posts, both sides
    if (kind !== "dirt" && p.along >= nextPost) {
      nextPost = p.along + POST_EVERY;
      for (const side of [-1, 1]) { const w = at(p, side); if (ok(lane, w.x, w.z)) posts.push({ ...w, y: heightAt(w.x, w.z), yaw: p.yaw }); }
    }
    // street lamps on the last stretch into each hub (asphalt only), alternating sides
    const toEnd = Math.min(p.along, total - p.along);
    if (kind === "asphalt" && toEnd < LAMP_REACH && p.along >= nextLamp) {
      nextLamp = p.along + LAMP_EVERY;
      const side = Math.round(p.along / LAMP_EVERY) % 2 ? 1 : -1, w = at(p, side, VERGE + 0.6);
      if (ok(lane, w.x, w.z)) lamps.push({ ...w, y: heightAt(w.x, w.z), yaw: Math.atan2(-p.nx * side, -p.nz * side) }); // local +Z (the arm) leans over the road
    }
    // guard rails: one segment per sample gap where the ground falls away beyond the verge, or the road nears a bridge
    for (const side of [-1, 1]) {
      const a = at(q, side), b = at(p, side), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const out = at({ ...p, x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }, side, VERGE + 4);
      const drop = heightAt(mx, mz) - heightAt(out.x, out.z);
      const approach = nearBridge(mx, mz, 16) && !nearBridge(mx, mz, 0.5);
      if ((drop > RAIL_DROP || approach || (kind === "asphalt" && heightAt(out.x, out.z) <= WATER_LEVEL + 0.4)) && dry(mx, mz) && !inHub(lane, mx, mz) && !nearBridge(mx, mz, 0.5) && kind !== "dirt")
        rails.push({ x: mx, z: mz, y: heightAt(mx, mz), yaw: Math.atan2(b.x - a.x, b.z - a.z), length: Math.hypot(b.x - a.x, b.z - a.z) });
    }
  }
  // destination signs leaving each hub, on the right of travel, facing the driver
  for (const [from, to, dir] of [[lane.a, lane.b, 1], [lane.b, lane.a, -1]] as const) {
    const lead = from.radius < CITY_CORE ? from.radius * 1.1 : 25, want = dir > 0 ? lead : total - lead;
    const p = s.reduce((best, c) => (Math.abs(c.along - want) < Math.abs(best.along - want) ? c : best), s[0]!);
    const w = at(p, dir > 0 ? -1 : 1, VERGE + 1.2), facing = p.yaw + (dir > 0 ? Math.PI : 0);
    if (dry(w.x, w.z) && !nearBridge(w.x, w.z, 2)) signs.push({ ...w, y: heightAt(w.x, w.z), yaw: facing, to: to.name, km: Math.max(0.1, Math.round((total - (dir > 0 ? p.along : total - p.along)) / 100) / 10), kind });
  }
  return { posts, rails, lamps, signs };
}

/** the lane a crossing belongs to (closest centre line) */
export function crossingLane(c: Crossing): Lane {
  let best = LANES[0]!, bd = Infinity;
  for (const l of LANES) for (const p of laneSamples(l, ROAD_SAMPLES)) { const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = l; } }
  return best;
}

export function bridgeOf(c: Crossing): Bridge {
  const kind = roadKind(crossingLane(c)), half = c.length / 2 + 2;
  const piers: Bridge["piers"] = [];
  const step = kind === "dirt" ? 4 : 8;
  for (let a = -half + step; a < half - step / 2; a += step) for (const side of [-1, 1]) {
    const x = c.x + c.dirX * a + -c.dirZ * side * (c.width / 2 - 0.8), z = c.z + c.dirZ * a + c.dirX * side * (c.width / 2 - 0.8);
    piers.push({ along: a, side, bed: Math.min(heightAt(x, z), c.deck - 0.8) });
  }
  return { x: c.x, z: c.z, deck: c.deck, yaw: Math.atan2(c.dirX, c.dirZ), length: half * 2, width: c.width, kind, piers };
}

let cache: { dressing: RoadDressing; bridges: Bridge[] } | null = null;
/** every road's furniture plus every bridge, computed once */
export function worldRoadDressing() {
  if (cache) return cache;
  const dressing: RoadDressing = { posts: [], rails: [], lamps: [], signs: [] };
  for (const l of LANES) { const d = laneDressing(l); dressing.posts.push(...d.posts); dressing.rails.push(...d.rails); dressing.lamps.push(...d.lamps); dressing.signs.push(...d.signs); }
  cache = { dressing, bridges: resolved().map(bridgeOf) };
  return cache;
}
