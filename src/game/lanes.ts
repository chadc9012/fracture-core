import { REGIONS, WORLD_SCALE, NEON_SITE, type Region } from "./world";

/* Supply routes shared by the simulation, the road renderer and the
 * obstacle registry (props are cleared off the roads so convoys never crash). */

export type Lane = { name: string; a: Region; b: Region; bow: number };

const byId = (id: string) => REGIONS.find((r) => r.id === id)!;

/** Connected surface-highway network. Every land destination has at least two approaches.
 * Thalassia is underwater and requires a separate shore-to-airlock transit link,
 * not a road painted across open ocean. */
const neon: Region = { ...byId("nexus"), id: "neon", name: "Neon City", x: NEON_SITE.x, z: NEON_SITE.z, radius: 30 };
const road = (name: string, a: string, b: string, bow: number): Lane => ({ name, a: a === "neon" ? neon : byId(a), b: b === "neon" ? neon : byId(b), bow });
export const LANES: Lane[] = [
  road("Nexus–Wastelands Highway", "nexus", "wastelands", 0.10),
  road("Wastelands–Solara Convoy Road", "wastelands", "solara", 0.24),
  road("Verdant–Nexus Forest Road", "veridan", "nexus", -0.26),
  road("Wastelands–Frostspire Pass", "wastelands", "frostspire", 0.34),
  road("Nexus–Neon Expressway", "nexus", "neon", -0.12),
  road("Neon–Solara Southern Bypass", "neon", "solara", 0.19),
  road("Verdant–Swamps Causeway", "veridan", "swamps", 0.18),
  road("Swamps–Solara Southern Road", "swamps", "solara", -0.24),
  road("Frostspire–Ember Mountain Pass", "frostspire", "ember", -0.18),
  road("Ember–Wastelands Ash Road", "ember", "wastelands", 0.22),
  road("Ember–Solara Ridge Road", "ember", "solara", -0.14),
  road("Verdant–Frostspire Highland Road", "veridan", "frostspire", 0.16),
  road("Nexus–Swamps South Road", "nexus", "swamps", -0.12),
  road("Neon–Wastelands Industrial Road", "neon", "wastelands", 0.15),
];

export const LANE_HALF_WIDTH = 9;

/* Each route docks at its own gate on the hub ring: routes sharing a hub are
 * spread evenly around it, so two corridors never run over each other. */
const GATES = new Map<string, { x: number; z: number }>();
{
  const ends: { key: string; hub: Region; toward: Region }[] = [];
  LANES.forEach((l, i) => {
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
  return GATES.get(`${LANES.indexOf(lane)}${end}`)!;
}

export function lanePoint(lane: Lane, t: number) {
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
