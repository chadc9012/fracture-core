/** City street level (pure, deterministic): kerbs, painted crossings, stop lines and lane markings, street furniture and
 * puddles for Nexus City's district grid (nexus-districts.ts) and Neon City's tower grid (neon-layout.ts), placed from the
 * same street grids the buildings, lamps and palms already use. Nothing here invents a layout:
 *  - a street segment is the carriageway between two grid cells where at least one cell is built (a Nexus district block,
 *    a Neon tower or venue lot); a junction is a grid corner with two or more segments, and every one of its arms gets a
 *    zebra crossing, a stop line on the approach lane and tactile pads on the kerbs it lands on;
 *  - sidewalks are the band inside each built cell's kerb; furniture only stands there, clear of every building, venue,
 *    home, garage, door, shop counter, lamp post and palm, and (Neon) of the district cores, Spire, race loop, rails and
 *    maglev via neonClearance;
 *  - solid furniture (benches, shelters, planters) becomes height-limited walls (walls.ts), so it stops the player but never
 *    pulls the third-person camera in; small items (bins, bollards, hydrants, poles) are non-blocking.
 * Nexus already paints its centre and edge lines in the street shader (city-surface.ts), so its paint here is the crossings
 * only; Neon's plain wet asphalt gets the full set. CityStreets.tsx draws it instanced, one draw per prop kind. */
import { NEXUS, BLOCK as NEXUS_BLOCK, PITCH as NEXUS_PITCH, CITY_OUTER, blocks, buildings, lamps, streetLights } from "./nexus-districts";
import { BLOCK as NEON_PITCH, TOWER_FOOTPRINT, neonClearance, neonLayoutWorld, neonStreetLightsWorld } from "./neon-layout";
import { footprint, garageRect, neonKeepOut, residences } from "./residences";
import { venueLots } from "./nightlife";
import { neonPalms, nexusPalms } from "./city-palms";
import { BUILDING_MODELS, footprintRadius, nexusHubTowers } from "./building-models";
import { INTERIORS } from "./interiors";
import { VENUE_INTERIORS } from "./venue-doors";
import { REGIONAL_SHOPS } from "./regional-shops";
import { NEON_FLAT, NEON_SITE } from "./world";
import { heightAt, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { mulberry32 } from "./rng";
import type { RenderTier } from "./performance";
import type { Wall } from "./walls";

export type StreetCity = "nexus" | "neon";
/** axis-aligned rectangle: centre and half extents (every street, kerb and furniture footprint here is grid-aligned) */
export type Rect = { x: number; z: number; hx: number; hz: number };
export type Disc = { x: number; z: number; r: number };
export type PaintKind = "zebra" | "stop" | "centre" | "edge" | "tactile";
export type Paint = Rect & { kind: PaintKind };
/** `low`: a dropped kerb (pedestrian ramp) where a crossing lands */
export type Kerb = Rect & { low: boolean };
export type PropKind = "bench" | "bin" | "bollard" | "planter" | "hydrant" | "shelter" | "signal" | "sign";
/** `yaw` turns the prop's local +z (its street side) to face the street; signals face their local +z down the street they
 * control (`axis`) with the mast arm along local +x, `reach` metres long; signs carry the two street names. */
export type StreetProp = { kind: PropKind; x: number; z: number; yaw: number; axis?: "x" | "z"; reach?: number; names?: readonly [string, string];
  /** a signal hung on an existing corner lamp post (no pole of its own) */
  onPole?: boolean };
export type Puddle = { x: number; z: number; sx: number; sz: number; yaw: number };
export type Arm = "+x" | "-x" | "+z" | "-z";
export type Junction = { x: number; z: number; arms: Arm[] };
/** a carriageway between two junctions; `along` is the direction traffic runs */
export type Segment = Rect & { along: "x" | "z"; key: string };
export type Cell = { i: number; j: number; x: number; z: number };
export type CityStreets = {
  city: StreetCity; pitch: number; half: number; street: number;
  /** cells with a sidewalk (kerbed, furnished) */
  cells: Cell[]; segments: Segment[]; junctions: Junction[];
  paint: Paint[]; kerbs: Kerb[]; slabs: Rect[]; props: StreetProp[]; puddles: Puddle[];
  /** what the layout keeps clear of (for tests and debugging) */
  solids: Rect[]; solidDiscs: Disc[]; keep: Disc[]; fixtures: Disc[];
};

/** footprint half extents of each prop along its own (along-kerb, toward-street) axes */
export const PROP_HALF: Record<PropKind, readonly [number, number]> = {
  bench: [0.95, 0.32], bin: [0.3, 0.3], bollard: [0.14, 0.14], planter: [0.75, 0.36], hydrant: [0.25, 0.25], shelter: [2.0, 0.8], signal: [0.3, 0.3], sign: [0.14, 0.14],
};
/** how far in from the kerb face each prop's centre stands */
const SETBACK: Record<PropKind, number> = { bench: 0.95, bin: 0.72, bollard: 0.5, planter: 0.85, hydrant: 0.6, shelter: 1.25, signal: 0.4, sign: 0.5 };
export const SOLID_PROPS: readonly PropKind[] = ["bench", "shelter", "planter"];
export const KERB_W = 0.3;
const RAMP: readonly [number, number] = [0.6, 3.4]; // crossing band, metres out from the junction box edge

const NEXUS_NAMES = {
  /** streets running along z, by grid column line */
  z: ["CIVIC AVE", "FOUNDRY AVE", "HELIX AVE", "ARC AVE", "MERIDIAN AVE", "VECTOR AVE", "HALO AVE", "ORBIT AVE", "BEACON AVE", "SUMMIT AVE"],
  x: ["1ST ST", "2ND ST", "3RD ST", "4TH ST", "5TH ST", "6TH ST", "7TH ST", "8TH ST", "9TH ST", "10TH ST"],
};
const NEON_NAMES = {
  z: ["KATANA AVE", "CHROME AVE", "SYNTH ROW", "PULSE AVE", "GLITCH AVE", "NEON BLVD", "DATA AVE", "VOLT AVE", "RONIN AVE", "LASER AVE", "SHARD AVE", "HALO AVE", "ECHO AVE"],
  x: ["MIDNIGHT ST", "AXON ST", "KANJI ST", "CIRCUIT ST", "STATIC ST", "VAPOR ST", "NOVA ST", "CIPHER ST", "QUARTZ ST", "RAIN ST", "ORCHID ST", "VECTOR ST", "PRISM ST"],
};

type Spec = {
  city: StreetCity; cx: number; cz: number; pitch: number; half: number; n: number; seed: number;
  built: (i: number, j: number) => boolean;
  sidewalk: (i: number, j: number) => boolean;
  /** the ground there can carry street paint / furniture of half extents ex, ez (city area, water, roads, rails...) */
  areaOk: (x: number, z: number, ex: number, ez: number) => boolean;
  solids: Rect[]; solidDiscs: Disc[]; keep: Disc[]; fixtures: Disc[];
  /** corner lamp posts a signal head can hang from instead of planting a second pole beside them */
  poles: readonly { x: number; z: number }[];
  names: { x: readonly string[]; z: readonly string[] };
  /** Nexus paints lane and edge lines in its street shader */
  laneLines: boolean; puddles: boolean;
};

const overlap = (a: Rect, b: Rect, m = 0) => Math.abs(a.x - b.x) < a.hx + b.hx + m && Math.abs(a.z - b.z) < a.hz + b.hz + m;
const rectDisc = (a: Rect, d: Disc, m = 0) => {
  const qx = Math.max(Math.abs(d.x - a.x) - a.hx, 0), qz = Math.max(Math.abs(d.z - a.z) - a.hz, 0);
  return Math.hypot(qx, qz) < d.r + m;
};
const DIRS: Record<Arm, readonly [number, number]> = { "+x": [1, 0], "-x": [-1, 0], "+z": [0, 1], "-z": [0, -1] };

/** a prop's world footprint (yaw is always a quarter turn here) */
export function propRect(p: StreetProp): Rect {
  const [a, b] = PROP_HALF[p.kind];
  const quarter = Math.abs(Math.round(Math.sin(p.yaw))) === 1;
  return { x: p.x, z: p.z, hx: quarter ? b : a, hz: quarter ? a : b };
}

function build(s: Spec): CityStreets {
  const { cx, cz, pitch: P, half: H, n } = s;
  const W = P - 2 * H, w2 = W / 2;
  const blocked = (r: Rect, m = 0) => s.solids.some((q) => overlap(r, q, m)) || s.solidDiscs.some((d) => rectDisc(r, d, m));
  const cellOf = (x: number, z: number) => ({ i: Math.round((x - cx) / P), j: Math.round((z - cz) / P) });

  // ---- carriageways
  const segs = new Map<string, Segment>();
  const addSeg = (key: string, r: Rect, along: "x" | "z") => { if (s.areaOk(r.x, r.z, 1, 1) && !blocked(r)) segs.set(key, { ...r, along, key }); };
  for (let i = -n - 1; i <= n + 1; i++) for (let j = -n - 1; j <= n + 1; j++) {
    if (s.built(i, j) || s.built(i, j + 1)) addSeg(`x:${i}:${j}`, { x: cx + i * P, z: cz + (j + 0.5) * P, hx: H, hz: w2 }, "x");
    if (s.built(i, j) || s.built(i + 1, j)) addSeg(`z:${i}:${j}`, { x: cx + (i + 0.5) * P, z: cz + j * P, hx: w2, hz: H }, "z");
  }
  const armSeg = (i: number, j: number, a: Arm) => segs.get(a === "+x" ? `x:${i + 1}:${j}` : a === "-x" ? `x:${i}:${j}` : a === "+z" ? `z:${i}:${j + 1}` : `z:${i}:${j}`);

  const paint: Paint[] = [], props: StreetProp[] = [], junctions: Junction[] = [];
  const addPaint = (p: Paint) => { if (s.areaOk(p.x, p.z, p.hx, p.hz) && !blocked(p)) { paint.push(p); return true; } return false; };
  const cellsList: Cell[] = [];
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) if (s.sidewalk(i, j)) cellsList.push({ i, j, x: cx + i * P, z: cz + j * P });
  const hasWalk = (x: number, z: number) => { const c = cellOf(x, z); return s.sidewalk(c.i, c.j); };

  // furniture clearance: inside its own cell's kerb, clear of solids, keep-outs, fixtures and other props
  const placed: Rect[] = [];
  const fits = (p: StreetProp, gap = 0.35) => {
    const r = propRect(p), c = cellOf(p.x, p.z);
    if (!s.sidewalk(c.i, c.j)) return false;
    const ox = Math.abs(p.x - (cx + c.i * P)), oz = Math.abs(p.z - (cz + c.j * P));
    if (ox + r.hx > H - KERB_W + 1e-6 || oz + r.hz > H - KERB_W + 1e-6) return false;
    if (blocked(r, 0.35)) return false;
    if (s.keep.some((d) => rectDisc(r, d))) return false;
    if (s.fixtures.some((d) => rectDisc(r, d, 0.25))) return false;
    if (placed.some((q) => overlap(r, q, gap))) return false;
    return s.areaOk(p.x, p.z, r.hx, r.hz);
  };
  const place = (p: StreetProp, gap?: number) => { if (!fits(p, gap)) return false; props.push(p); placed.push(propRect(p)); return true; };

  // ---- junctions: crossings, stop lines, tactile pads, signals and a street-name sign
  for (let i = -n - 1; i <= n; i++) for (let j = -n - 1; j <= n; j++) {
    const jx = cx + (i + 0.5) * P, jz = cz + (j + 0.5) * P;
    const arms: Arm[] = [];
    const crossing = new Map<Arm, Paint[]>();
    for (const a of ["+x", "-x", "+z", "-z"] as const) {
      if (!armSeg(i, j, a)) continue;
      const [dx, dz] = DIRS[a];
      const t0 = w2 + RAMP[0], t1 = w2 + RAMP[1], tm = (t0 + t1) / 2, th = (t1 - t0) / 2;
      const k = Math.max(2, Math.floor((W - 0.5) / 1.0));
      const stripes: Paint[] = [];
      for (let q = 0; q < k; q++) {
        const o = (q - (k - 1) / 2) * 1.0;
        stripes.push(dx ? { kind: "zebra", x: jx + dx * tm, z: jz + o, hx: th, hz: 0.25 } : { kind: "zebra", x: jx + o, z: jz + dz * tm, hx: 0.25, hz: th });
      }
      if (stripes.every((p) => s.areaOk(p.x, p.z, p.hx, p.hz) && !blocked(p))) { arms.push(a); crossing.set(a, stripes); }
    }
    if (arms.length < 2) continue;
    junctions.push({ x: jx, z: jz, arms });
    for (const a of arms) {
      const [dx, dz] = DIRS[a];
      for (const p of crossing.get(a)!) paint.push(p);
      // stop line across the lane that approaches the junction (traffic keeps right: heading -d, its lane is on (dz, -dx))
      const rx = dz, rz = -dx, ts = w2 + RAMP[1] + 0.55;
      const sx = jx + dx * ts + rx * (w2 / 2), sz = jz + dz * ts + rz * (w2 / 2);
      addPaint(dx ? { kind: "stop", x: sx, z: sz, hx: 0.22, hz: w2 / 2 - 0.15 } : { kind: "stop", x: sx, z: sz, hx: w2 / 2 - 0.15, hz: 0.22 });
      // tactile pads on the dropped kerbs either side of the crossing
      const tm = w2 + (RAMP[0] + RAMP[1]) / 2, th = (RAMP[1] - RAMP[0]) / 2 - 0.2;
      for (const side of [-1, 1]) {
        const px = jx + dx * tm + (dx ? 0 : side * (w2 + KERB_W + 0.35)), pz = jz + dz * tm + (dz ? 0 : side * (w2 + KERB_W + 0.35));
        if (hasWalk(px, pz)) addPaint(dx ? { kind: "tactile", x: px, z: pz, hx: th, hz: 0.3 } : { kind: "tactile", x: px, z: pz, hx: 0.3, hz: th });
      }
    }
    // signals at three- and four-way junctions: the pole on the corner beside each arm, mast across that arm's far
    // (approach) lane, head facing the oncoming traffic
    if (arms.length >= 3) for (const a of arms) {
      const [dx, dz] = DIRS[a];
      const yaw = Math.atan2(dx, dz), mx = Math.cos(yaw), mz = -Math.sin(yaw);
      const off = w2 + KERB_W + SETBACK.signal, px = jx + (dx - mx) * off, pz = jz + (dz - mz) * off;
      const pole = s.poles.find((q) => Math.hypot(q.x - px, q.z - pz) < 1.3 && hasWalk(q.x, q.z));
      if (pole) {
        // the head sits over the approach lane's centre: the pole's distance back across the street plus a quarter width
        const reach = -((pole.x - jx) * mx + (pole.z - jz) * mz) + w2 / 2;
        const p: StreetProp = { kind: "signal", x: pole.x, z: pole.z, yaw, axis: dx ? "x" : "z", reach, onPole: true };
        props.push(p); placed.push(propRect(p));
      } else place({ kind: "signal", x: px, z: pz, yaw, axis: dx ? "x" : "z", reach: off + w2 / 2 }, 0.2);
    }
    // one street-name sign per junction, on the first free corner
    const ix = i + 1 + Math.floor(n * 4), jzI = j + 1 + Math.floor(n * 4);
    const names = [s.names.x[(jzI) % s.names.x.length]!, s.names.z[(ix) % s.names.z.length]!] as const;
    for (const [qx, qz] of [[1, -1], [-1, 1], [1, 1], [-1, -1]] as const) {
      if (place({ kind: "sign", x: jx + qx * (w2 + 1.45), z: jz + qz * (w2 + SETBACK.sign), yaw: 0, names }, 0.2)) break;
    }
  }

  // ---- lane markings (Neon): dashed centre line and solid edge lines between the crossings
  if (s.laneLines) for (const g of segs.values()) {
    const ax = g.along === "x";
    const free = H - (RAMP[1] + 1.0), period = 3.6, dash = 2;
    const count = Math.max(1, Math.floor((2 * free + period - dash) / period));
    const start = -((count - 1) * period) / 2;
    for (let q = 0; q < count; q++) {
      const u = start + q * period;
      addPaint(ax ? { kind: "centre", x: g.x + u, z: g.z, hx: dash / 2, hz: 0.07 } : { kind: "centre", x: g.x, z: g.z + u, hx: 0.07, hz: dash / 2 });
    }
    const el = H - (RAMP[1] + 0.8);
    for (const side of [-1, 1]) {
      const o = side * (w2 - 0.45);
      addPaint(ax ? { kind: "edge", x: g.x, z: g.z + o, hx: el, hz: 0.06 } : { kind: "edge", x: g.x + o, z: g.z, hx: 0.06, hz: el });
    }
  }

  // ---- kerbs round every sidewalk cell, dropped where the crossings land at its corners
  const kerbs: Kerb[] = [], slabs: Rect[] = [];
  for (const c of cellsList) {
    slabs.push({ x: c.x, z: c.z, hx: H - KERB_W, hz: H - KERB_W });
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      // pieces along the side (u from -H to H): corner nose, ramp, body, ramp, corner nose
      const cuts = [-H, -H + RAMP[0], -H + RAMP[1], H - RAMP[1], H - RAMP[0], H];
      for (let q = 0; q < cuts.length - 1; q++) {
        const u0 = cuts[q]!, u1 = cuts[q + 1]!, um = (u0 + u1) / 2, uh = (u1 - u0) / 2, low = q === 1 || q === 3;
        const k: Kerb = nx ? { x: c.x + nx * (H - KERB_W / 2), z: c.z + um, hx: KERB_W / 2, hz: uh, low } : { x: c.x + um, z: c.z + nz * (H - KERB_W / 2), hx: uh, hz: KERB_W / 2, low };
        if (!blocked(k)) kerbs.push(k);
      }
    }
  }

  // ---- furniture along each street-facing side of a sidewalk cell
  const rnd = mulberry32(s.seed);
  const slot = H * 0.42;
  for (const c of cellsList) for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const key = nx === 1 ? `z:${c.i}:${c.j}` : nx === -1 ? `z:${c.i - 1}:${c.j}` : nz === 1 ? `x:${c.i}:${c.j}` : `x:${c.i}:${c.j - 1}`;
    const r1 = rnd(), r2 = rnd(), r3 = rnd(), flip = rnd() < 0.5 ? 1 : -1;
    if (!segs.has(key)) continue;
    const yaw = Math.atan2(nx, nz);
    const at = (kind: PropKind, u: number): StreetProp => {
      const d = H - KERB_W - SETBACK[kind];
      return { kind, x: c.x + nx * d + (nx ? 0 : u), z: c.z + nz * d + (nz ? 0 : u), yaw };
    };
    // the middle of the side: a bus/tram shelter on some streets, otherwise a bin or a planter
    const first = (kind: PropKind, us: readonly number[]) => us.some((u) => place(at(kind, u)));
    if (r1 < 0.24) { if (!first("shelter", [0, flip * 2.6, -flip * 2.6])) first("bin", [flip * 0.6, flip * 1.4]); }
    else if (r1 < 0.6) first("bin", [flip * 0.6, flip * 1.4, flip * 2.4]);
    else first("planter", [0, flip * 1.8, -flip * 1.8]);
    // one end: a bench with a bin beside it, or a planter
    const ua = -flip * slot;
    if (r2 < 0.6) { if (place(at("bench", ua))) place(at("bin", ua - flip * 1.45), 0.15); }
    else if (r2 < 0.85) place(at("planter", ua));
    // the other end: a hydrant by the kerb, or a bench
    const ub = flip * slot;
    if (r3 < 0.45) place(at("hydrant", ub));
    else if (r3 < 0.75) place(at("bench", ub));
    // bollards guard the inner end of each dropped kerb
    for (const u of [-(H - RAMP[1] - 0.25), H - RAMP[1] - 0.25]) place(at("bollard", u), 0.2);
  }

  // ---- puddles (Neon's acid rain): along the gutters, the odd one mid-lane and in the junction boxes
  const puddles: Puddle[] = [];
  if (s.puddles) {
    const pr = mulberry32(s.seed ^ 0x9d1e);
    const add = (x: number, z: number, sx: number, sz: number) => {
      const yaw = pr() * Math.PI;
      if (s.areaOk(x, z, sx, sx) && !blocked({ x, z, hx: sx, hz: sx })) puddles.push({ x, z, sx, sz, yaw });
    };
    for (const g of segs.values()) {
      const ax = g.along === "x";
      const k = Math.floor(pr() * 3);
      for (let q = 0; q < k; q++) {
        const u = (pr() * 2 - 1) * (H - 1.5), side = pr() < 0.5 ? -1 : 1, mid = pr() < 0.25;
        const o = mid ? (pr() - 0.5) * w2 : side * (w2 - 0.55 - pr() * 0.4);
        add(ax ? g.x + u : g.x + o, ax ? g.z + o : g.z + u, 0.7 + pr() * 1.6, 0.45 + pr() * 0.8);
      }
    }
    for (const jn of junctions) if (pr() < 0.4) add(jn.x + (pr() - 0.5) * w2, jn.z + (pr() - 0.5) * w2, 1 + pr() * 1.8, 0.6 + pr() * 1);
  }

  return { city: s.city, pitch: P, half: H, street: W, cells: cellsList, segments: [...segs.values()], junctions, paint, kerbs, slabs, props, puddles, solids: s.solids, solidDiscs: s.solidDiscs, keep: s.keep, fixtures: s.fixtures };
}

const doorDiscs = (near: (x: number, z: number) => boolean, r: number): Disc[] => [...INTERIORS, ...VENUE_INTERIORS].filter((i) => near(i.doorPos.x, i.doorPos.z)).map((i) => ({ x: i.doorPos.x, z: i.doorPos.z, r }));

function nexusSpec(): Spec {
  const P = NEXUS_PITCH, H = NEXUS_BLOCK / 2, n = Math.ceil(CITY_OUTER / P);
  const built = new Set(blocks().map((b) => `${Math.round((b.x - NEXUS.x) / P)},${Math.round((b.z - NEXUS.z) / P)}`));
  const inner = NEXUS.radius * 0.87 + 1, outer = CITY_OUTER - 1;
  const near = (x: number, z: number) => Math.hypot(x - NEXUS.x, z - NEXUS.z) < CITY_OUTER + 30;
  const solids: Rect[] = buildings().map((b) => ({ x: b.x, z: b.z, hx: b.w / 2 + 0.15, hz: b.d / 2 + 0.15 }));
  const solidDiscs: Disc[] = nexusHubTowers(NEXUS).map((t) => ({ x: t.x, z: t.z, r: footprintRadius(BUILDING_MODELS[t.model]) + 0.5 }));
  for (const r of residences()) if (r.city === "nexus" && near(r.x, r.z)) { solids.push({ x: r.x, z: r.z, ...footprint(r) }); if (r.garage) solids.push(garageRect(r.garage)); }
  return {
    city: "nexus", cx: NEXUS.x, cz: NEXUS.z, pitch: P, half: H, n, seed: 0x57ee7,
    built: (i, j) => built.has(`${i},${j}`), sidewalk: (i, j) => built.has(`${i},${j}`),
    areaOk: (x, z, ex, ez) => {
      for (const [sx, sz] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const px = x + sx * ex, pz = z + sz * ez, d = Math.hypot(px - NEXUS.x, pz - NEXUS.z);
        if (d < inner || d > outer || heightAt(px, pz) < WATER_LEVEL + 0.5 || distanceToRoad(px, pz) < LANE_HALF_WIDTH + 0.5) return false;
      }
      return true;
    },
    solids, solidDiscs,
    keep: [...doorDiscs(near, 3), ...REGIONAL_SHOPS.filter((q) => near(q.x, q.z)).map((q) => ({ x: q.x, z: q.z, r: 4.5 }))],
    fixtures: [...streetLights(), ...lamps()].map((l) => ({ x: l.x, z: l.z, r: 0.2 })).concat(nexusPalms().map((p) => ({ x: p.x, z: p.z, r: 0.55 }))),
    poles: lamps(),
    names: NEXUS_NAMES, laneLines: false, puddles: false,
  };
}

function neonSpec(): Spec {
  const P = NEON_PITCH, H = 10, n = Math.floor((NEON_FLAT - 10) / P);
  const keepOut = neonKeepOut();
  const { towers } = neonLayoutWorld(keepOut);
  const venues = venueLots(towers);
  const cell = (x: number, z: number) => `${Math.round((x - NEON_SITE.x) / P)},${Math.round((z - NEON_SITE.z) / P)}`;
  const built = new Set(towers.map((t) => cell(t.x, t.z)));
  const venueCells = new Set(venues.map((v) => cell(v.x, v.z)));
  const ext = (hx: number, hz: number, rot: number) => (rot % 2 ? [hz, hx] : [hx, hz]) as [number, number];
  const solids: Rect[] = towers.filter((t) => !venueCells.has(cell(t.x, t.z))).map((t) => { const [hx, hz] = ext(...TOWER_FOOTPRINT[t.variant], t.rot); return { x: t.x, z: t.z, hx: hx + 0.1, hz: hz + 0.1 }; });
  for (const v of venues) {
    const [hx, hz] = ext(v.hx, v.hz, v.rot);
    solids.push({ x: v.x, z: v.z, hx, hz });
    // the red carpet, rope line and canopy run out of the front onto the pavement and street
    const a = (v.rot * Math.PI) / 2, fx = Math.round(Math.sin(a)), fz = Math.round(Math.cos(a)), D = (v.rot % 2 ? hx : hz) + 4;
    solids.push({ x: v.x + fx * D, z: v.z + fz * D, hx: 4.5, hz: 4.5 });
  }
  const near = (x: number, z: number) => Math.hypot(x - NEON_SITE.x, z - NEON_SITE.z) < NEON_FLAT + 20;
  for (const r of residences()) if (r.city === "neon") { solids.push({ x: r.x, z: r.z, ...footprint(r) }); if (r.garage) solids.push(garageRect(r.garage)); }
  const clear = neonClearance(keepOut.map((k) => ({ x: k.x - NEON_SITE.x, z: k.z - NEON_SITE.z, r: k.r })));
  const towerList = towers.filter((t) => !venueCells.has(cell(t.x, t.z)));
  const lampsWorld = neonStreetLightsWorld(keepOut);
  return {
    city: "neon", cx: NEON_SITE.x, cz: NEON_SITE.z, pitch: P, half: H, n, seed: 0x3e057,
    built: (i, j) => built.has(`${i},${j}`), sidewalk: (i, j) => built.has(`${i},${j}`) && !venueCells.has(`${i},${j}`),
    areaOk: (x, z, ex, ez) => clear(x - NEON_SITE.x, z - NEON_SITE.z, ex, ez),
    solids, solidDiscs: [],
    keep: [...doorDiscs(near, 3.5), ...VENUE_INTERIORS.map((v) => ({ x: v.doorPos.x, z: v.doorPos.z, r: 8 })), ...REGIONAL_SHOPS.filter((q) => near(q.x, q.z)).map((q) => ({ x: q.x, z: q.z, r: 4.5 }))],
    fixtures: lampsWorld.map((l) => ({ x: l.x, z: l.z, r: 0.2 })).concat(neonPalms(towerList).map((p) => ({ x: p.x, z: p.z, r: 0.55 }))),
    poles: lampsWorld,
    names: NEON_NAMES, laneLines: true, puddles: true,
  };
}

const cache = new Map<StreetCity, CityStreets>();
/** the street level of a city (cached; identical on every client) */
export function cityStreets(city: StreetCity): CityStreets {
  let hit = cache.get(city);
  if (!hit) { hit = build(city === "nexus" ? nexusSpec() : neonSpec()); cache.set(city, hit); }
  return hit;
}
/** fresh, uncached build (tests: determinism) */
export const buildCityStreets = (city: StreetCity) => build(city === "nexus" ? nexusSpec() : neonSpec());

const hash = (x: number, z: number) => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return h - Math.floor(h); };
/** LOW draws about half the small, non-blocking furniture and puddles; solid pieces (which also collide), signals and
 * signs stay on every tier so the street plays the same everywhere */
export function propsForTier(props: readonly StreetProp[], tier: RenderTier): StreetProp[] {
  if (tier !== "LOW") return [...props];
  return props.filter((p) => SOLID_PROPS.includes(p.kind) || p.kind === "signal" || p.kind === "sign" || hash(p.x, p.z) < 0.5);
}
export function puddlesForTier(puddles: readonly Puddle[], tier: RenderTier): Puddle[] {
  return tier === "LOW" ? puddles.filter((p) => hash(p.x, p.z) < 0.5) : [...puddles];
}

/** collision for the solid furniture as low walls (walls.ts): they stop a body at their height but the camera and anything
 * above them pass, so walking past a bench never yanks the third-person camera in. `groundAt` is the walk height. */
export function streetWalls(props: readonly StreetProp[], groundAt: (x: number, z: number) => number): Wall[] {
  const out: Wall[] = [];
  for (const p of props) {
    if (!SOLID_PROPS.includes(p.kind)) continue;
    const y = groundAt(p.x, p.z), c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    // local (u along the kerb = +x, v toward the street = +z) to world
    const at = (u: number, v: number) => ({ x: p.x + u * c + v * s, z: p.z - u * s + v * c });
    const seg = (u0: number, v0: number, u1: number, v1: number, half: number, top: number) => { const a = at(u0, v0), b = at(u1, v1); out.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, half, base: y - 0.5, top: y + top }); };
    if (p.kind === "bench") seg(-0.9, 0, 0.9, 0, 0.3, 0.85);
    else if (p.kind === "planter") seg(-0.7, 0, 0.7, 0, 0.34, 0.75);
    else { seg(-1.8, -0.62, 1.8, -0.62, 0.12, 2.6); seg(-1.8, -0.62, -1.8, 0.2, 0.1, 2.6); seg(1.8, -0.62, 1.8, 0.2, 0.1, 2.6); }
  }
  return out;
}

/** signal phase (pure, from the world clock): which axis has green, and whether it is on amber */
export const SIGNAL_CYCLE = 24;
export function signalPhase(seconds: number): { green: "x" | "z"; amber: boolean } {
  const t = ((seconds % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE, half = SIGNAL_CYCLE / 2;
  return { green: t < half ? "x" : "z", amber: (t % half) > half - 3 };
}
