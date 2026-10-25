/** Neon City pedestrians: a few civilians strolling the pavements. Each walker ping-pongs along one street edge on a pavement line that
 * is verified clear of every solid street prop and building footprint (city-streets.ts), so nobody walks through a bench or a tower.
 * Visual only (the living NPCs in living-npcs.ts are the interactive ones). Pure, world metres. */
import type { CityStreets } from "./city-streets";
import { propRect } from "./city-streets";
import { streetGrid } from "./neon-ground-traffic";

export type Pt = { x: number; z: number };
export type Walk = { a: Pt; b: Pt; length: number; /** unit direction a->b */ dx: number; dz: number };
export type Walker = { walk: Walk; speed: number; phase: number; model: number; height: number };

export const PAVEMENT_OFFSETS = [4.6, 4.8, 5.0, 5.2, 5.4, 5.6] as const;
export const END_TRIM = 5; // stay clear of the junction box
const CLEAR = 0.45;

const hit = (p: Pt, r: { x: number; z: number; hx: number; hz: number }, m: number) => Math.abs(p.x - r.x) <= r.hx + m && Math.abs(p.z - r.z) <= r.hz + m;

/** every street edge that has a clear pavement line on at least one side, as a walk (first clear offset/side wins) */
export function pavementWalks(streets: Pick<CityStreets, "segments" | "pitch" | "junctions" | "props" | "solids">): Walk[] {
  const grid = streetGrid(streets);
  const blockers = [...streets.props.filter((p) => p.kind !== "bollard").map(propRect), ...streets.solids];
  const out: Walk[] = [];
  for (const e of [...grid.edges].sort()) {
    const [k, si, sj] = e.split(":"), i = +si!, j = +sj!;
    const A = grid.node(i, j), B = k === "x" ? grid.node(i + 1, j) : grid.node(i, j + 1);
    const ux = k === "x" ? 1 : 0, uz = k === "x" ? 0 : 1;
    let found: Walk | null = null;
    for (const off of PAVEMENT_OFFSETS) {
      for (const side of [1, -1]) {
        const nx = -uz * side * off, nz = ux * side * off;
        const a = { x: A.x + ux * END_TRIM + nx, z: A.z + uz * END_TRIM + nz }, b = { x: B.x - ux * END_TRIM + nx, z: B.z - uz * END_TRIM + nz };
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        let ok = true;
        for (let s = 0; s <= len && ok; s += 0.5) { const p = { x: a.x + ux * s, z: a.z + uz * s }; if (blockers.some((r) => hit(p, r, CLEAR))) ok = false; }
        if (ok) { found = { a, b, length: len, dx: ux, dz: uz }; break; }
      }
      if (found) break;
    }
    if (found) out.push(found);
  }
  return out;
}

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** n walkers on distinct walks spread by seed (fewer if there are not enough clear pavements) */
export function assignWalkers(walks: readonly Walk[], n: number, models = 3): Walker[] {
  const order = walks.map((w, i) => ({ i, k: hash(i + 1) })).sort((p, q) => p.k - q.k).slice(0, n);
  return order.map(({ i }, m) => ({ walk: walks[i]!, speed: 1.1 + hash(m + 40) * 0.6, phase: hash(m + 90), model: m % models, height: 0.96 + (m % 3) * 0.04 }));
}

/** position and facing (radians, atan2(dx,dz)) after t seconds; the walker turns round at each end */
export function walkerPose(w: Walker, t: number): { x: number; z: number; yaw: number; moving: true } {
  const L = w.walk.length, d = (w.phase * 2 * L + t * w.speed) % (2 * L), fwd = d < L, s = fwd ? d : 2 * L - d;
  const sx = fwd ? 1 : -1;
  return { x: w.walk.a.x + w.walk.dx * s, z: w.walk.a.z + w.walk.dz * s, yaw: Math.atan2(w.walk.dx * sx, w.walk.dz * sx), moving: true };
}
