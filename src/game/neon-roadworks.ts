/** Neon City roadworks (owner's Neon target frame: jersey barriers and traffic cones along the boulevard). A few street segments that no
 * ground-traffic loop drives get a lane closure: a run of jersey barriers fencing off one lane and cones tapering in at each end, with an
 * amber warning lamp on the first barrier. Never on a segment the traffic uses, never in a junction box. Pure layout (tested);
 * NeonRoadworks.tsx draws it. */
import type { CityStreets, Segment } from "./city-streets";
import type { Loop, StreetGrid } from "./neon-ground-traffic";

export const ROADWORKS = {
  /** how many segments get a closure at most, the shortest segment worth closing (m) */
  max: 6, minLength: 16,
  /** barrier length and spacing along the run (m), offset of the barrier line from the street centre (m) */
  barrierLen: 2, spacing: 2.15, offset: 0.9,
  /** share of the segment the barrier run covers */
  cover: 0.5,
} as const;

export type Barrier = { x: number; z: number; yaw: number };
export type Cone = { x: number; z: number };
export type Roadworks = { barriers: Barrier[]; cones: Cone[]; lamps: Barrier[]; closed: string[] };

/** the grid edge key of a segment (the same keys streetGrid uses) */
export function segmentEdge(grid: StreetGrid, s: Segment): string {
  const h = grid.pitch / 2;
  const ix = (x: number) => Math.round((x - grid.x0) / grid.pitch), iz = (z: number) => Math.round((z - grid.z0) / grid.pitch);
  return s.along === "x" ? `x:${ix(s.x - h)}:${iz(s.z)}` : `z:${ix(s.x)}:${iz(s.z - h)}`;
}

/** every grid edge a traffic loop drives */
export function drivenEdges(loops: readonly Loop[]): Set<string> {
  const out = new Set<string>();
  for (const l of loops) for (let k = 0; k < l.nodes.length; k++) {
    const a = l.nodes[k]!, b = l.nodes[(k + 1) % l.nodes.length]!;
    out.add(a.j === b.j ? `x:${Math.min(a.i, b.i)}:${a.j}` : `z:${a.i}:${Math.min(a.j, b.j)}`);
  }
  return out;
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };

export function neonRoadworks(streets: Pick<CityStreets, "segments">, grid: StreetGrid, driven: Set<string>): Roadworks {
  const free = streets.segments
    .map((s) => ({ s, key: segmentEdge(grid, s), len: (s.along === "x" ? s.hx : s.hz) * 2 }))
    .filter((c) => !driven.has(c.key) && c.len >= ROADWORKS.minLength)
    .sort((a, b) => hash(a.key) - hash(b.key))
    .slice(0, ROADWORKS.max);
  const barriers: Barrier[] = [], cones: Cone[] = [], lamps: Barrier[] = [];
  for (const { s, key, len } of free) {
    const side = hash(key + "side") < 0.5 ? -1 : 1, run = len * ROADWORKS.cover;
    const n = Math.max(2, Math.floor(run / ROADWORKS.spacing));
    // along-axis unit (u) and across-axis unit (v)
    const ux = s.along === "x" ? 1 : 0, uz = s.along === "x" ? 0 : 1, vx = uz, vz = ux;
    const yaw = s.along === "x" ? Math.PI / 2 : 0;
    for (let k = 0; k < n; k++) {
      const a = -run / 2 + ROADWORKS.spacing * (k + 0.5) - (n * ROADWORKS.spacing - run) / 2;
      const b = { x: s.x + ux * a + vx * ROADWORKS.offset * side, z: s.z + uz * a + vz * ROADWORKS.offset * side, yaw };
      barriers.push(b);
      if (k === 0) lamps.push(b);
    }
    // cones taper from the kerb in to the barrier line at both ends
    for (const end of [-1, 1]) for (let c = 1; c <= 3; c++) {
      const a = end * Math.min(len / 2 - 0.4, run / 2 + c * 1.05), off = ROADWORKS.offset + (c / 3) * (2.6 - ROADWORKS.offset);
      cones.push({ x: s.x + ux * a + vx * off * side, z: s.z + uz * a + vz * off * side });
    }
  }
  return { barriers, cones, lamps, closed: free.map((f) => f.key) };
}
