import { REGIONS, WORLD_SCALE, type Region } from "./world";

/* Supply routes shared by the simulation, the road renderer and the
 * obstacle registry (props are cleared off the roads so convoys never crash). */

export type Lane = { name: string; a: Region; b: Region; bow: number };

const byId = (id: string) => REGIONS.find((r) => r.id === id)!;

export const LANES: Lane[] = [
  { name: "Nexus → Wastelands supply run", a: byId("nexus"), b: byId("wastelands"), bow: 0.1 },
  { name: "Wastelands → Solara convoy", a: byId("wastelands"), b: byId("solara"), bow: 0.24 },
  { name: "Veridan → Nexus resource haul", a: byId("veridan"), b: byId("nexus"), bow: -0.26 },
  { name: "Wastelands → Frostspire ascent", a: byId("wastelands"), b: byId("frostspire"), bow: 0.34 },
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
  for (const hub of REGIONS) {
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
