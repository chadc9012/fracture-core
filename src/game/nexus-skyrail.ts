/** The Nexus sky-rail (owner's target frames, Nexus and Neon at night: an elevated rail bridge crossing the boulevard ahead, lit
 * along its underside). Two straight guideways ride above Nexus street lines, one north-south and one east-west, crossing south-east
 * of the hub; each stands on portal frames whose two legs sit at the kerbs of the street below, mid-block, so traffic and the
 * pavements stay clear. A three-car train shuttles along each line. Pure layout (tested); NexusSkyRail.tsx draws it. */
import { NEXUS, CITY_INNER, CITY_OUTER, PITCH, STREET, buildings } from "./nexus-districts";
import { heightAt, WATER_LEVEL } from "./terrain";
import { BUILDING_MODELS, nexusHubTowers } from "./building-models";

export const SKYRAIL = {
  /** deck underside clearance above the street, deck depth and width (m) */
  clearance: 10, depth: 1.1, width: 4.2,
  /** the street lines it follows: offset from the hub centre (half a block past the grid) */
  offset: PITCH * 1.5,
  /** how far each line runs from the hub (m) */
  reach: CITY_OUTER + 10,
  /** portal leg inset from the street centre (just inside the kerb) */
  legOff: STREET / 2 - 0.45,
  /** train: cars, car length (m), speed (m/s) */
  cars: 3, carLen: 11, speed: 14,
} as const;

export type RailLine = { id: "ns" | "ew"; ax: number; az: number; bx: number; bz: number };
export type Pier = { x: number; z: number; /** ground at the pier */ ground: number; /** deck underside */ deck: number; /** unit vector across the line */ nx: number; nz: number };

/** the two guideways in world space */
export function railLines(): RailLine[] {
  const o = SKYRAIL.offset, r = SKYRAIL.reach;
  return [
    { id: "ns", ax: NEXUS.x + o, az: NEXUS.z - r, bx: NEXUS.x + o, bz: NEXUS.z + r },
    { id: "ew", ax: NEXUS.x - r, az: NEXUS.z + o, bx: NEXUS.x + r, bz: NEXUS.z + o },
  ];
}

const lineLen = (l: RailLine) => Math.hypot(l.bx - l.ax, l.bz - l.az);
/** the point `s` metres along a line */
export function linePoint(l: RailLine, s: number) {
  const len = lineLen(l), t = s / len;
  return { x: l.ax + (l.bx - l.ax) * t, z: l.az + (l.bz - l.az) * t, dx: (l.bx - l.ax) / len, dz: (l.bz - l.az) / len };
}

/** piers every block (mid-block, between intersections) where the ground is dry; the deck rides `clearance` over the highest street
 * ground under each span so it never dips toward a rise. */
export function piers(l: RailLine): Pier[] {
  const len = lineLen(l), out: Pier[] = [], hub = nexusHubTowers(NEXUS);
  // mid-block positions along the line: block centres sit on the hub grid, so measure from the hub's projection
  const first = (() => { const p = linePoint(l, 0); const along = l.id === "ns" ? p.z - NEXUS.z : p.x - NEXUS.x; return ((((-along) % PITCH) + PITCH) % PITCH); })();
  for (let s = first; s <= len; s += PITCH) {
    const p = linePoint(l, s);
    const g = heightAt(p.x, p.z);
    if (g < WATER_LEVEL + 1) continue;
    const pier = { x: p.x, z: p.z, ground: g, deck: 0, nx: -p.dz, nz: p.dx };
    // a leg that would crowd one of the hub's civic towers is dropped (the deck spans the gap)
    if (legs(pier).some((q) => hub.some((t) => Math.hypot(q.x - t.x, q.z - t.z) < Math.max(BUILDING_MODELS[t.model].w, BUILDING_MODELS[t.model].d) / 2 + 2))) continue;
    out.push(pier);
  }
  // deck height: clearance over the higher ground of each pier and its neighbours (a smooth, never-dipping deck)
  for (let i = 0; i < out.length; i++) {
    const hi = Math.max(out[i]!.ground, out[i - 1]?.ground ?? -Infinity, out[i + 1]?.ground ?? -Infinity);
    out[i]!.deck = hi + SKYRAIL.clearance;
  }
  return out;
}

/** deck underside height at `s` metres along the line (linear between piers) */
export function deckAt(l: RailLine, ps: readonly Pier[], s: number): number {
  if (!ps.length) return heightAt(l.ax, l.az) + SKYRAIL.clearance;
  const along = (p: Pier) => Math.hypot(p.x - l.ax, p.z - l.az);
  if (s <= along(ps[0]!)) return ps[0]!.deck;
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1]!, b = ps[i]!, sa = along(a), sb = along(b);
    if (s <= sb) return a.deck + (b.deck - a.deck) * ((s - sa) / Math.max(sb - sa, 1e-6));
  }
  return ps[ps.length - 1]!.deck;
}

/** the leg positions of a pier (one at each kerb) */
export function legs(p: Pier): { x: number; z: number }[] {
  return [-1, 1].map((k) => ({ x: p.x + p.nx * SKYRAIL.legOff * k, z: p.z + p.nz * SKYRAIL.legOff * k }));
}

/** where the train's nose is at time `t`: it shuttles end to end along the line, easing at each terminus */
export function trainAt(l: RailLine, t: number, phase = 0): number {
  const len = lineLen(l) - SKYRAIL.cars * SKYRAIL.carLen;
  const period = (2 * len) / SKYRAIL.speed + 8;          // there and back, a 4 s dwell at each end
  const u = (((t + phase) % period) + period) % period, run = len / SKYRAIL.speed;
  if (u < run) return SKYRAIL.cars * SKYRAIL.carLen + len * (0.5 - 0.5 * Math.cos((Math.PI * u) / run));
  if (u < run + 4) return lineLen(l);
  if (u < 2 * run + 4) { const v = u - run - 4; return SKYRAIL.cars * SKYRAIL.carLen + len * (0.5 + 0.5 * Math.cos((Math.PI * v) / run)); }
  return SKYRAIL.cars * SKYRAIL.carLen;
}

/** distance from (x,z) to the nearest building footprint edge (negative inside), for the tests */
export function buildingClearance(x: number, z: number): number {
  let best = Infinity;
  for (const b of buildings()) {
    const dx = Math.abs(x - b.x) - b.w / 2, dz = Math.abs(z - b.z) - b.d / 2;
    best = Math.min(best, dx > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) : Math.max(dx, dz));
  }
  return best;
}

/** the hub plaza stays open under the rail: lines run outside the inner ring (tests) */
export const HUB_CLEAR = CITY_INNER;
