import { REGIONS, WORLD_SCALE, NEON_SITE, type Region } from "./world";
import { NEON_KEEP, STRAIT_CLEAR, borderDistance } from "./continent-borders";

/* Supply routes shared by the simulation, the road renderer and the
 * obstacle registry (props are cleared off the roads so convoys never crash). */

export type Lane = { name: string; a: Region; b: Region; bow: number;
  /** Stage 151: a road cut at a strait follows its full route (`route`) over this stretch of it */
  route?: Lane; span?: readonly [number, number] };

const byId = (id: string) => REGIONS.find((r) => r.id === id)!;

/** Connected surface-highway network. Thalassia is underwater and needs a separate shore-to-airlock transit link,
 * not a road painted across open ocean. The Oct 22 network proposed 14 roads; only the ones that keep the tested
 * invariants are in (Nexus district blocks and the Spire skyline, forest ground continuity, terrain colour bounds,
 * one bridge deck per river crossing). Dropped for now: Nexus–Neon, Nexus–Swamps, Neon–Solara, Verdant–Frostspire,
 * Frostspire–Ember, Ember–Wastelands — each needs its own grading/approach work before it can join. */
const neon: Region = { ...byId("nexus"), id: "neon", name: "Neon City", x: NEON_SITE.x, z: NEON_SITE.z, radius: 30 };
const road = (name: string, a: string, b: string, bow: number): Lane => ({ name, a: a === "neon" ? neon : byId(a), b: b === "neon" ? neon : byId(b), bow });
/** the highway routes as first laid out across the one map (Stage 151 cuts them at the straits into LANES) */
export const ROUTES: Lane[] = [
  road("Nexus–Wastelands Highway", "nexus", "wastelands", 0.10),
  road("Wastelands–Solara Convoy Road", "wastelands", "solara", 0.24),
  road("Verdant–Nexus Forest Road", "veridan", "nexus", -0.26),
  road("Wastelands–Frostspire Pass", "wastelands", "frostspire", 0.34),
  road("Verdant–Swamps Causeway", "veridan", "swamps", 0.18),
  road("Swamps–Solara Southern Road", "swamps", "solara", -0.24),
  road("Ember–Solara Ridge Road", "ember", "solara", -0.14),
  road("Neon–Wastelands Industrial Road", "neon", "wastelands", 0.15),
];

export const LANE_HALF_WIDTH = 9;

/* Each route docks at its own gate on the hub ring: routes sharing a hub are
 * spread evenly around it, so two corridors never run over each other. */
const GATES = new Map<string, { x: number; z: number }>();
{
  const ends: { key: string; hub: Region; toward: Region }[] = [];
  ROUTES.forEach((l, i) => {
    ends.push({ key: `${i}a`, hub: l.a, toward: l.b });
    ends.push({ key: `${i}b`, hub: l.b, toward: l.a });
  });
  for (const hub of [...REGIONS, neon]) {
    const here = ends.filter((e) => e.hub === hub);
    here.forEach((e, idx) => {
      const base = Math.atan2(e.toward.z - hub.z, e.toward.x - hub.x);
      const spread = here.length > 1 ? (idx - (here.length - 1) / 2) * 0.7 : 0;
      const ang = base + spread;
      const d = hub.radius * 0.7;
      GATES.set(e.key, { x: hub.x + Math.cos(ang) * d, z: hub.z + Math.sin(ang) * d });
    });
  }
}

function gate(lane: Lane, end: "a" | "b") {
  return GATES.get(`${ROUTES.indexOf(lane)}${end}`)!;
}

export function lanePoint(lane: Lane, t: number): { x: number; z: number } {
  if (lane.route && lane.span) return lanePoint(lane.route, lane.span[0] + (lane.span[1] - lane.span[0]) * t);
  const A = gate(lane, "a");
  const B = gate(lane, "b");

  const mx = (A.x + B.x) / 2;
  const mz = (A.z + B.z) / 2;
  const nx = -(B.z - A.z) * lane.bow;
  const nz = (B.x - A.x) * lane.bow;
  const cx = mx + nx;
  const cz = mz + nz;
  const u = 1 - t;
  return {
    x: u * u * A.x + 2 * u * t * cx + t * t * B.x,
    z: u * u * A.z + 2 * u * t * cz + t * t * B.z,
  };
}

/** point offset to one side of the lane so oncoming traffic never meets head-on */
export function laneLanePoint(lane: Lane, t: number, side: number) {
  const a = lanePoint(lane, Math.max(0, t - 0.004));
  const b = lanePoint(lane, Math.min(1, t + 0.004));
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const p = lanePoint(lane, t);
  return { x: p.x + (-dz / len) * side, z: p.z + (dx / len) * side };
}

export function laneSamples(lane: Lane, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, i) => lanePoint(lane, i / steps));
}

/* ---------------- Stage 151: roads stop at the sea ----------------
 * A route whose ends are on different landmasses is cut where it reaches a strait: each side keeps its own road from the
 * hub down to a ferry pier on the shore (the road ends on land, STRAIT_CLEAR + a margin back from the border). Crossing
 * is by transit flight. Routes inside one landmass stay whole. */
const PIER_MARGIN = 14;
const STUB_MIN = 110;
function cutRoute(r: Lane): Lane[] {
  const N = 400, pts = Array.from({ length: N + 1 }, (_, i) => lanePoint(r, i / N));
  // at the sea, or on the beach / too close to it for a road: only where a strait can be (not on Neon City's land border)
  const blocked = pts.map((p) => Math.hypot(p.x - NEON_SITE.x, p.z - NEON_SITE.z) >= NEON_KEEP && borderDistance(p.x, p.z) < STRAIT_CLEAR + PIER_MARGIN);
  if (!blocked.includes(true)) return [r];
  const len = (i0: number, i1: number) => { let l = 0; for (let i = i0; i < i1; i++) l += Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.z - pts[i]!.z); return l; };
  const pier = (i: number, from: Region, to: Region): Region => ({ ...from, id: `pier-${from.id}-${to.id}-${i}`, name: `${to.name} Ferry Pier`, x: pts[i]!.x, z: pts[i]!.z, radius: 0 });
  // every dry run of the route long enough to be a road stays one: from a hub (or a pier) to a pier (or a hub)
  const out: Lane[] = [];
  for (let i = 0; i <= N;) {
    if (blocked[i]) { i++; continue; }
    let j = i; while (j < N && !blocked[j + 1]) j++;
    if (len(i, j) >= STUB_MIN) {
      const a = i === 0 ? r.a : pier(i, r.b, r.a), b = j === N ? r.b : pier(j, r.a, r.b);
      const side = i === 0 && j === N ? "" : i === 0 ? ` · ${r.a.name} side` : j === N ? ` · ${r.b.name} side` : " · inland stretch";
      out.push({ name: `${r.name}${side}`, a, b, bow: r.bow, route: r, span: [i / N, j / N] });
    }
    i = j + 1;
  }
  return out;
}
/** the supply roads as they run now: whole routes inside a landmass, harbour roads where a route met the sea */
export const LANES: Lane[] = ROUTES.flatMap(cutRoute);

/** samples per route: a longer route gets proportionally more, so the spacing stays ~2.5 m at any WORLD_SCALE */
export const ROAD_SAMPLES = Math.round(40 * Math.max(1, WORLD_SCALE));
const ROAD_POINTS = LANES.flatMap((l) => laneSamples(l, ROAD_SAMPLES));

/* Bucketed lookup: the road is long and sampled densely, so a linear scan per terrain vertex or prop candidate is too slow. */
const BUCKET = 24;
const buckets = new Map<number, { x: number; z: number }[]>();
const bucketKey = (cx: number, cz: number) => (cx + 4096) * 8192 + (cz + 4096);
for (const p of ROAD_POINTS) {
  const k = bucketKey(Math.floor(p.x / BUCKET), Math.floor(p.z / BUCKET));
  const list = buckets.get(k);
  if (list) list.push(p); else buckets.set(k, [p]);
}
/** farther than this from any road, distanceToRoad just reports ROAD_FAR (every caller only compares against a few metres) */
export const ROAD_FAR = BUCKET * 2;

/** distance from the nearest road centre-line sample (exact up to ROAD_FAR, then ROAD_FAR) */
export function distanceToRoad(x: number, z: number) {
  const cx = Math.floor(x / BUCKET), cz = Math.floor(z / BUCKET);
  let best = ROAD_FAR;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const list = buckets.get(bucketKey(cx + i, cz + j));
    if (!list) continue;
    for (const p of list) { const d = Math.hypot(p.x - x, p.z - z); if (d < best) best = d; }
  }
  return best;
}
