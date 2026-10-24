/** Walk-in residences in Nexus City and Neon City: eight designs (suburban house, townhouse, duplex, courtyard house,
 * apartment block, condo, industrial loft, skyline villa) whose ground floor is a real, furnished home you walk into —
 * an open front door, a living room with kitchen and dining, and a back wall of bedroom and bathroom through an
 * interior doorway. Upper storeys are closed shells (no stairs yet).
 *
 * Pure layout and geometry data, no three.js: ResidentialHomes.tsx turns `homeBoxes` into a few merged meshes, the walls
 * go to walls.ts (player collision, doorways stay open) and the floor is a district deck so you stand on it.
 *
 * Placement: Nexus homes form a street just south of the city (outside the districts, off the supply roads, on flat
 * dry ground and clear of every other region); Neon homes take outer blocks of the tower grid (neon-layout.ts), so
 * they never meet a tower, race line, rail, shop or door. */
import { NEXUS_SUBURB, REGIONS } from "./world";
import { heightAt, neonPlateauLevel, slopeAt, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { CITY_OUTER, NEXUS } from "./nexus-districts";
import { neonClearance, neonLayoutWorld, TOWER_FOOTPRINT } from "./neon-layout";
import { NEON_SITE } from "./world";
import { REGIONAL_SHOPS } from "./regional-shops";
import { INTERIORS } from "./interiors";
import type { Wall } from "./walls";
import type { Deck } from "./district-decks";

export type HomeStyle = "suburban" | "townhouse" | "duplex" | "courtyard" | "apartment" | "condo" | "loft" | "villa";
export type Residence = { id: string; style: HomeStyle; city: "nexus" | "neon"; x: number; z: number; rot: number; floor: number; base: number;
  /** the home's own garage beside it (none where nothing fits): centre, same turn as the house, door on its local +z */
  garage?: Garage };
export type Garage = { x: number; z: number; rot: number; bays: number; floor: number; base: number };
export type Design = { w: number; d: number; h: number; levels: number; wall: string; trim: string; floor: string; accent: string; glass: string; roof: "gable" | "flat" | "parapet" };

/** w across the front, d front-to-back, h ground-floor height (m) */
export const DESIGNS: Record<HomeStyle, Design> = {
  suburban: { w: 10, d: 11, h: 3.6, levels: 1, wall: "#c9b9a1", trim: "#685a51", floor: "#a98b67", accent: "#7c9d8b", glass: "#456779", roof: "gable" },
  townhouse: { w: 9, d: 12, h: 3.6, levels: 3, wall: "#a17a68", trim: "#483d3b", floor: "#9e8069", accent: "#c1a36d", glass: "#415a6b", roof: "parapet" },
  duplex: { w: 13, d: 11, h: 3.6, levels: 2, wall: "#b4b3a7", trim: "#515b60", floor: "#9b886e", accent: "#9a8664", glass: "#526e7b", roof: "gable" },
  courtyard: { w: 14, d: 13, h: 3.6, levels: 2, wall: "#d0c4aa", trim: "#83745d", floor: "#bca17c", accent: "#648b77", glass: "#60838a", roof: "flat" },
  apartment: { w: 15, d: 15, h: 3.6, levels: 4, wall: "#929ba4", trim: "#323d49", floor: "#777b80", accent: "#d0a36a", glass: "#37556b", roof: "parapet" },
  condo: { w: 15, d: 15, h: 3.6, levels: 5, wall: "#c5c9ca", trim: "#303f4c", floor: "#8d8176", accent: "#70a6b6", glass: "#476f83", roof: "flat" },
  loft: { w: 15, d: 16, h: 4.6, levels: 2, wall: "#787e82", trim: "#343b42", floor: "#806e5d", accent: "#b97b56", glass: "#36536c", roof: "flat" },
  villa: { w: 16, d: 17, h: 4.0, levels: 2, wall: "#d6d2c8", trim: "#3a4145", floor: "#a99a85", accent: "#608c99", glass: "#356477", roof: "flat" },
};
export const STOREY = 3.4;
export const WALL = 0.26;
/** front door and interior doorway widths: a walker (collision radius 0.45 m) passes both */
export const DOOR = 2.0;
export const INNER_DOOR = 1.6;
export const PORCH = 2.2;

/** parking bays in each design's garage: private houses get a private garage, blocks a shared one */
export const GARAGE_BAYS: Record<HomeStyle, number> = { suburban: 1, townhouse: 1, duplex: 2, courtyard: 2, apartment: 1, condo: 2, loft: 2, villa: 3 };
/** one bay: wide enough for the drivable vehicles (their wall-collision radius is 2.2 m, sim.ts), not just a car body */
export const BAY_W = 5.0;
export const GARAGE_D = 7.2;       // front to back
export const GARAGE_H = 3.0;
export const DOOR_H = 2.5;          // door opening height
export const garageWidth = (bays: number) => bays * BAY_W + WALL * 2;

const NEXUS_STYLES: HomeStyle[] = ["suburban", "townhouse", "duplex", "courtyard", "suburban", "townhouse", "apartment", "condo"];
const NEON_STYLES: HomeStyle[] = ["apartment", "loft", "condo", "villa"];

/** footprint half-extents in world axes once turned by `rot` (porch included on the door side) */
export function footprint(r: Pick<Residence, "style" | "rot">) {
  const { w, d } = DESIGNS[r.style];
  const quarter = Math.round(r.rot / (Math.PI / 2)) % 2 !== 0;
  return quarter ? { hx: (d + PORCH * 2) / 2, hz: w / 2 } : { hx: w / 2, hz: (d + PORCH * 2) / 2 };
}

const NEXUS_PITCH = 26;
const others = REGIONS.filter((r) => r.id !== "nexus");

function nexusLots(): { x: number; z: number; rot: number }[] {
  const out: { x: number; z: number; d: number; rot: number }[] = [];
  const n = Math.ceil(NEXUS_SUBURB.r / NEXUS_PITCH);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    // the street grid of the suburb disc (world.ts NEXUS_SUBURB), where the ground is eased level
    const x = NEXUS_SUBURB.x + i * NEXUS_PITCH, z = NEXUS_SUBURB.z + j * NEXUS_PITCH;
    if (Math.hypot(x - NEXUS_SUBURB.x, z - NEXUS_SUBURB.z) + 13 > NEXUS_SUBURB.r) continue;
    const d = Math.hypot(x - NEXUS.x, z - NEXUS.z);
    if (d < CITY_OUTER + 14) continue;
    const h = 10.5, pts = [[x, z], [x - h, z - h], [x + h, z - h], [x - h, z + h], [x + h, z + h], [x, z - h - PORCH], [x, z + h + PORCH]] as const;
    const hs = pts.map(([px, pz]) => heightAt(px, pz));
    if (Math.min(...hs) < WATER_LEVEL + 1 || Math.max(...hs) - Math.min(...hs) > 1.2 || slopeAt(x, z) > 0.2) continue;
    if (pts.some(([px, pz]) => distanceToRoad(px, pz) < LANE_HALF_WIDTH + 3)) continue;
    if (others.some((r) => Math.hypot(x - r.x, z - r.z) < r.radius + 20)) continue;
    if (REGIONAL_SHOPS.some((s) => Math.hypot(x - s.x, z - s.z) < 22) || INTERIORS.some((it) => Math.hypot(x - it.doorPos.x, z - it.doorPos.z) < 20)) continue;
    // the row nearest the city faces it (door north); the rows behind face each other across their own street
    out.push({ x, z, d, rot: ((j % 2) + 2) % 2 === 1 ? Math.PI : 0 });
  }
  return out.sort((a, b) => a.d - b.d).slice(0, NEXUS_STYLES.length);
}

/** the keep-out list Neon City's grid is laid out with (shop counters and interior doors) — shared with NeonTowerBlocks */
export function neonKeepOut() {
  return [...REGIONAL_SHOPS.map((s) => ({ x: s.x, z: s.z, r: 8 })), ...INTERIORS.filter((i) => i.kind !== "VENUE").map((i) => ({ x: i.doorPos.x, z: i.doorPos.z, r: 6 }))];
}

function build(): Residence[] {
  const out: Residence[] = [];
  nexusLots().forEach((l, i) => {
    const style = NEXUS_STYLES[i]!, { w, d } = DESIGNS[style];
    const hs = [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => heightAt(l.x + sx! * w / 2, l.z + sz! * d / 2));
    out.push({ id: `nexus-home-${i + 1}`, style, city: "nexus", x: l.x, z: l.z, rot: l.rot, floor: Math.max(...hs) + 0.15, base: Math.min(...hs) - 0.8 });
  });
  const level = neonPlateauLevel();
  neonLayoutWorld(neonKeepOut()).homes.forEach((h, i) => {
    out.push({ id: `neon-home-${i + 1}`, style: NEON_STYLES[i % NEON_STYLES.length]!, city: "neon", x: h.x, z: h.z, rot: (h.rot * Math.PI) / 2, floor: level + 0.15, base: level - 0.6 });
  });
  placeGarages(out);
  return out;
}

type Rect = { x: number; z: number; hx: number; hz: number };
const rectsOverlap = (a: Rect, b: Rect, m = 0) => Math.abs(a.x - b.x) < a.hx + b.hx + m && Math.abs(a.z - b.z) < a.hz + b.hz + m;
/** a garage's world-axis half extents (turns are quarter turns) */
export function garageRect(g: Garage): Rect {
  const w = garageWidth(g.bays) / 2, d = GARAGE_D / 2;
  return Math.round(g.rot / (Math.PI / 2)) % 2 !== 0 ? { x: g.x, z: g.z, hx: d, hz: w } : { x: g.x, z: g.z, hx: w, hz: d };
}

/** Fit each home's garage beside it, door facing the street like the front door: try the right side, then the left;
 * a home with no room on either side has no garage. Checked against every home and garage already placed, the supply
 * roads, shops and interior doors, slope and water (Nexus), and the tower grid's clearances (Neon). */
function placeGarages(homes: Residence[]) {
  const shells: Rect[] = homes.map((h) => ({ x: h.x, z: h.z, ...footprint(h) }));
  const neon = neonLayoutWorld(neonKeepOut());
  const towers: Rect[] = neon.towers.map((t) => { const [hx, hz] = TOWER_FOOTPRINT[t.variant]; return t.rot % 2 ? { x: t.x, z: t.z, hx: hz, hz: hx } : { x: t.x, z: t.z, hx, hz }; });
  const clearNeon = neonClearance(neonKeepOut().map((k) => ({ x: k.x - NEON_SITE.x, z: k.z - NEON_SITE.z, r: k.r })));
  const placed: Rect[] = [];
  for (const h of homes) {
    const p = DESIGNS[h.style];
    // the design's bay count, or fewer where the full garage doesn't fit
    for (let bays = GARAGE_BAYS[h.style]; bays >= 1 && !h.garage; bays--) {
    const gw = garageWidth(bays);
    // right side, then left; flush with the front, then set back level with the middle of the house
    const spots = [1, -1].flatMap((side) => [p.d / 2 - GARAGE_D / 2, 0, -p.d / 2 + GARAGE_D / 2].map((lz) => ({ side, lz })));
    for (const { side, lz } of spots) {
      const lx = side * (p.w / 2 + 1.4 + gw / 2);
      const c = turn(h, lx, lz);
      const g: Garage = { x: c.x, z: c.z, rot: h.rot, bays, floor: h.floor, base: h.base };
      const r = garageRect(g);
      // and the apron in front of the doors stays open, so a car can pull in
      const apron = turn(h, lx, lz + GARAGE_D / 2 + 3.5);
      const pts = [[r.x - r.hx, r.z - r.hz], [r.x + r.hx, r.z - r.hz], [r.x - r.hx, r.z + r.hz], [r.x + r.hx, r.z + r.hz], [r.x, r.z], [apron.x, apron.z]] as const;
      if (shells.some((s) => rectsOverlap(r, s, 1)) || placed.some((s) => rectsOverlap(r, s, 1))) continue;
      if (REGIONAL_SHOPS.some((s) => Math.hypot(r.x - s.x, r.z - s.z) < Math.max(r.hx, r.hz) + 8)) continue;
      if (INTERIORS.some((it) => Math.hypot(r.x - it.doorPos.x, r.z - it.doorPos.z) < Math.max(r.hx, r.hz) + 6)) continue;
      if (h.city === "nexus") {
        const hs = pts.map(([x, z]) => heightAt(x, z));
        if (Math.min(...hs) < WATER_LEVEL + 1 || Math.max(...hs) - Math.min(...hs) > 1.4) continue;
        if (pts.some(([x, z]) => distanceToRoad(x, z) < LANE_HALF_WIDTH + 2)) continue;
        if (others.some((o) => Math.hypot(r.x - o.x, r.z - o.z) < o.radius + 15)) continue;
        if (Math.hypot(r.x - NEXUS.x, r.z - NEXUS.z) < CITY_OUTER + 8) continue;
        g.floor = Math.max(...hs) + 0.12; g.base = Math.min(...hs) - 0.6;
      } else {
        if (!clearNeon(r.x - NEON_SITE.x, r.z - NEON_SITE.z, r.hx, r.hz)) continue;
        if (towers.some((t) => rectsOverlap(r, t, 2))) continue;
        if (!clearNeon(apron.x - NEON_SITE.x, apron.z - NEON_SITE.z, 1.5, 1.5)) continue;
      }
      h.garage = g; placed.push(r);
      break;
    }
    }
  }
}

let cached: Residence[] | null = null;
export function residences(): Residence[] { return (cached ??= build()); }

/** inside a residence's footprint (plus margin): ground cover and scatter stay out */
export function inResidence(x: number, z: number, margin = 1): boolean {
  for (const r of residences()) {
    const f = footprint(r);
    if (Math.abs(x - r.x) < f.hx + margin && Math.abs(z - r.z) < f.hz + margin) return true;
    if (r.garage) { const g = garageRect(r.garage); if (Math.abs(x - g.x) < g.hx + margin && Math.abs(z - g.z) < g.hz + margin) return true; }
  }
  return false;
}

/* ------------------------------------------------------------------ geometry, in the home's local frame
 * origin: footprint centre at floor level; door wall at +z; +y up. */

export type Mat = "solid" | "glass" | "lamp";
export type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; color: string; mat: Mat; /** a gable roof prism instead of a box */ prism?: boolean };

/** `sink`: how far the foundation reaches below the floor (to the lowest ground under the footprint) */
export function homeBoxes(style: HomeStyle, sink = 1): Box[] {
  const p = DESIGNS[style], { w, d, h } = p, out: Box[] = [];
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, mat: Mat = "solid") => out.push({ x, y, z, sx, sy, sz, color, mat });
  const front = d / 2, wing = (w - DOOR) / 2;
  // foundation down to the lowest ground under the footprint, so nothing floats on a slope; then the floor
  box(0, -sink / 2, 0, w + 0.3, sink, d + 0.3, "#6d6a64");
  box(0, -0.03, 0, w - WALL * 2, 0.06, d - WALL * 2, p.floor);
  // porch step outside the door
  box(0, -0.08, front + PORCH / 2, DOOR + 1.2, 0.16, PORCH, "#7a7f7e");
  // ground-floor shell: back, sides, front either side of the door, lintel above it
  box(0, h / 2, -front + WALL / 2, w, h, WALL, p.wall);
  box(-w / 2 + WALL / 2, h / 2, 0, WALL, h, d, p.wall);
  box(w / 2 - WALL / 2, h / 2, 0, WALL, h, d, p.wall);
  box(-(DOOR + wing) / 2, h / 2, front - WALL / 2, wing, h, WALL, p.wall);
  box((DOOR + wing) / 2, h / 2, front - WALL / 2, wing, h, WALL, p.wall);
  box(0, h - (h - 2.5) / 2, front - WALL / 2, DOOR, h - 2.5, WALL, p.wall);
  // door frame, ground-floor windows either side of the door and on the flanks
  for (const s of [-1, 1]) {
    box(s * (DOOR / 2 + 0.06), 1.25, front + 0.02, 0.12, 2.5, WALL + 0.06, p.trim);
    box(s * (DOOR / 2 + wing / 2), 1.6, front + 0.005, Math.min(1.8, wing * 0.6), 1.2, WALL + 0.03, p.glass, "glass");
    box(s * (w / 2), 1.6, -d * 0.05, WALL + 0.03, 1.2, Math.min(2.4, d * 0.22), p.glass, "glass");
  }
  box(0, 2.56, front + 0.02, DOOR + 0.24, 0.12, WALL + 0.06, p.trim);
  // exterior detail (face-lift: the homes read as flat boxes): framed windows with sills, shutters on the flanks, a porch lamp
  for (const s of [-1, 1]) {
    const fw = Math.min(1.8, wing * 0.6), fx = s * (DOOR / 2 + wing / 2);
    box(fx, 0.97, front + 0.04, fw + 0.22, 0.08, WALL + 0.18, p.trim); // sill
    box(fx, 2.23, front + 0.03, fw + 0.14, 0.07, WALL + 0.1, p.trim); // head
    for (const j of [-1, 1]) box(fx + j * (fw / 2 + 0.035), 1.6, front + 0.03, 0.07, 1.26, WALL + 0.1, p.trim); // jambs
    box(fx, 1.6, front + 0.03, 0.045, 1.2, WALL + 0.08, p.trim); // mullion
    const fz = -d * 0.05, fd = Math.min(2.4, d * 0.22);
    box(s * (w / 2 + 0.04), 0.97, fz, WALL + 0.18, 0.08, fd + 0.22, p.trim);
    box(s * (w / 2 + 0.03), 2.23, fz, WALL + 0.1, 0.07, fd + 0.14, p.trim);
    for (const j of [-1, 1]) box(s * (w / 2 + 0.07), 1.6, fz + j * (fd / 2 + 0.32), 0.05, 1.3, 0.55, p.accent); // shutters
  }
  // back wall: a bedroom window over the headboard and a small bathroom window (frosted), framed like the front
  for (const [bx, bw, bh, by] of [[-w * 0.27, 1.5, 0.8, 1.85], [w * 0.36, 0.7, 0.55, 1.95]] as const) {
    box(bx, by, -front - 0.005, bw, bh, WALL + 0.03, bx > 0 ? "#b9c4c8" : p.glass, "glass");
    box(bx, by - bh / 2 - 0.04, -front - 0.04, bw + 0.2, 0.08, WALL + 0.18, p.trim);
    box(bx, by + bh / 2 + 0.035, -front - 0.03, bw + 0.12, 0.07, WALL + 0.1, p.trim);
  }
  box(DOOR / 2 + 0.38, 2.15, front + 0.1, 0.16, 0.24, 0.12, "#2b2b2b");
  box(DOOR / 2 + 0.38, 2.12, front + 0.17, 0.1, 0.14, 0.02, "#ffe2b0", "lamp");
  // ceiling and a ceiling light
  box(0, h - 0.06, 0, w - WALL * 2, 0.12, d - WALL * 2, "#e8e2d6");
  box(0, h - 0.13, d * 0.12, 1.1, 0.03, 1.1, "#fff1d6", "lamp");
  box(-w * 0.25, h - 0.13, -d * 0.36, 0.7, 0.03, 0.7, "#fff1d6", "lamp");

  // interior: a partition across the back third with a doorway, splitting bedroom (left) from bathroom (right)
  const line = -d * 0.18, pw = (w - INNER_DOOR) / 2;
  box(-(INNER_DOOR + pw) / 2, (h - 0.12) / 2, line, pw, h - 0.12, 0.14, p.wall);
  box((INNER_DOOR + pw) / 2, (h - 0.12) / 2, line, pw, h - 0.12, 0.14, p.wall);
  box(0, h - 0.12 - (h - 2.3) / 2, line, INNER_DOOR, h - 2.3, 0.14, p.wall);
  // interior door, standing open against the partition
  box(-INNER_DOOR / 2 - 0.05, 1.1, line + 0.75, 0.06, 2.2, 1.45, p.trim);
  const back = (line + -front + WALL) / 2, backDepth = line - (-front + WALL);
  box(w * 0.2, (h - 0.12) / 2, back, 0.12, h - 0.12, backDepth, p.wall);
  // bedroom: bed with headboard, side table
  box(-w * 0.27, 0.25, -front + WALL + 1.15, 1.8, 0.5, 2.1, "#d0c6b2");
  box(-w * 0.27, 0.12, -front + WALL + 1.15, 1.95, 0.24, 2.2, p.trim);
  box(-w * 0.27, 0.6, -front + WALL + 0.08, 1.95, 1.2, 0.1, p.accent);
  box(-w * 0.27 + 1.35, 0.28, -front + WALL + 0.35, 0.45, 0.55, 0.45, p.trim);
  // bathroom: tub, basin, mirror
  box(w / 2 - WALL - 0.45, 0.28, back, 0.8, 0.55, Math.min(1.6, backDepth - 0.4), "#ecece7");
  box(w * 0.2 + 0.4, 0.45, -front + WALL + 0.35, 0.6, 0.85, 0.5, "#eee9df");
  box(w * 0.2 + 0.4, 1.4, -front + WALL + 0.03, 0.6, 0.7, 0.04, "#8199a4", "glass");

  // living room: rug, sofa and coffee table on the left, kitchen counter on the right wall, dining table by the windows
  box(-w * 0.27, 0.01, front * 0.3, 2.6, 0.02, 2.2, p.accent);
  box(-w / 2 + WALL + 0.5, 0.25, front * 0.3, 0.9, 0.5, 2.4, p.accent);
  box(-w / 2 + WALL + 0.12, 0.55, front * 0.3, 0.25, 0.6, 2.4, p.accent);
  box(-w * 0.2, 0.22, front * 0.3, 0.9, 0.08, 1.2, "#8b745e");
  box(w / 2 - WALL - 0.35, 0.45, line + 2.0, 0.65, 0.9, 2.8, p.trim);
  box(w / 2 - WALL - 0.35, 0.92, line + 2.0, 0.7, 0.05, 2.85, "#d9d4c9");
  box(w * 0.22, 0.74, front - 2.4, 1.2, 0.06, 1.8, "#a88b6c");
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(w * 0.22 + sx * 0.5, 0.36, front - 2.4 + sz * 0.8, 0.07, 0.72, 0.07, p.trim);
  if (style === "loft") box(-w * 0.15, 2.9, -front * 0.2, w * 0.55, 0.16, d * 0.3, p.trim); // mezzanine shelf
  if (style === "courtyard") box(w * 0.22, 0.03, front - 2.4, 2.4, 0.04, 2.4, "#647d67");

  // upper storeys: closed shells with windows on every side, a floor band between storeys
  const top = h + (p.levels - 1) * STOREY;
  for (let i = 0; i < p.levels - 1; i++) {
    const y0 = h + i * STOREY;
    box(0, y0 + 0.1, 0, w + 0.2, 0.2, d + 0.2, p.trim);
    box(0, y0 + STOREY / 2, 0, w, STOREY, d, p.wall);
    const n = Math.max(2, Math.round(w / 3.4));
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + (k + 0.5) * (w / n);
      const ww = Math.min(2.0, (w / n) * 0.62);
      for (const s of [-1, 1]) {
        box(x, y0 + 1.75, s * (d / 2 + 0.01), ww, 1.4, 0.06, p.glass, "glass");
        box(x, y0 + 1.0, s * (d / 2 + 0.07), ww + 0.2, 0.08, 0.16, p.trim); // sill
        box(x, y0 + 2.49, s * (d / 2 + 0.05), ww + 0.12, 0.07, 0.1, p.trim); // head
      }
    }
    const m = Math.max(2, Math.round(d / 3.6));
    for (let k = 0; k < m; k++) {
      const z = -d / 2 + (k + 0.5) * (d / m);
      const wd = Math.min(2.0, (d / m) * 0.62);
      for (const s of [-1, 1]) {
        box(s * (w / 2 + 0.01), y0 + 1.75, z, 0.06, 1.4, wd, p.glass, "glass");
        box(s * (w / 2 + 0.07), y0 + 1.0, z, 0.16, 0.08, wd + 0.2, p.trim);
        box(s * (w / 2 + 0.05), y0 + 2.49, z, 0.1, 0.07, wd + 0.12, p.trim);
      }
    }
    if (style === "condo" || style === "villa") {
      box(0, y0 + 0.25, d / 2 + 0.75, w * 0.6, 0.12, 1.5, p.trim); // balcony
      box(0, y0 + 0.8, d / 2 + 1.47, w * 0.6, 0.05, 0.05, "#2f3236"); // railing: top rail, posts
      for (let k = 0; k <= 6; k++) box(-w * 0.3 + (k / 6) * w * 0.6, y0 + 0.55, d / 2 + 1.47, 0.04, 0.5, 0.04, "#2f3236");
      for (const sx of [-1, 1]) box(sx * w * 0.3, y0 + 0.8, d / 2 + 0.75, 0.05, 0.05, 1.45, "#2f3236");
    }
  }
  if (p.roof === "gable") {
    out.push({ x: 0, y: top + 0.9, z: 0, sx: w + 0.6, sy: 1.8, sz: d + 0.6, color: p.trim, mat: "solid", prism: true });
    box(w * 0.28, top + 1.3, -d * 0.12, 0.75, 2.6, 0.75, "#6f5a4c"); // brick chimney through the roof
    box(w * 0.28, top + 2.65, -d * 0.12, 0.9, 0.12, 0.9, "#4a3c33");
    for (const s of [-1, 1]) box(0, top + 0.02, s * (d / 2 + 0.28), w + 0.6, 0.12, 0.12, "#3c3f42"); // gutters along both eaves
  }
  else {
    box(0, top + 0.12, 0, w + 0.3, 0.24, d + 0.3, p.trim);
    if (p.roof === "parapet") for (const s of [-1, 1]) { box(0, top + 0.55, s * (d / 2 + 0.05), w + 0.3, 0.6, 0.2, p.trim); box(s * (w / 2 + 0.05), top + 0.55, 0, 0.2, 0.6, d + 0.3, p.trim); }
  }
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) box(sx * (w / 2 + 0.06), top / 2, sz * (d / 2 + 0.06), 0.09, top, 0.09, "#3c3f42"); // downpipes
  return out;
}

const turn = (r: Residence, x: number, z: number) => {
  const c = Math.cos(r.rot), s = Math.sin(r.rot);
  return { x: r.x + x * c + z * s, z: r.z - x * s + z * c };
};

/** world-space walls for collision: the ground-floor shell with its door gap, the interior partitions, and the big
 * furniture (bed, sofa, counter, tub) so you walk round it, not through it */
export function homeWalls(r: Residence): Wall[] {
  const p = DESIGNS[r.style], { w, d, h } = p, front = d / 2, top = r.floor + h + (p.levels - 1) * STOREY;
  const out: Wall[] = [];
  const seg = (ax: number, az: number, bx: number, bz: number, half: number, wallTop = top) => {
    const a = turn(r, ax, az), b = turn(r, bx, bz);
    out.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, half, base: r.base, top: wallTop });
  };
  const ix = w / 2 - WALL / 2, iz = front - WALL / 2;
  seg(-ix, -iz, ix, -iz, WALL / 2);
  seg(-ix, -iz, -ix, iz, WALL / 2);
  seg(ix, -iz, ix, iz, WALL / 2);
  seg(-ix, iz, -DOOR / 2, iz, WALL / 2);
  seg(DOOR / 2, iz, ix, iz, WALL / 2);
  const line = -d * 0.18, inner = r.floor + h;
  seg(-ix, line, -INNER_DOOR / 2, line, 0.07, inner);
  seg(INNER_DOOR / 2, line, ix, line, 0.07, inner);
  seg(w * 0.2, line, w * 0.2, -iz, 0.06, inner);
  const fy = r.floor + 0.6;
  seg(-w * 0.27, -front + WALL + 0.2, -w * 0.27, -front + WALL + 2.1, 0.95, fy); // bed
  seg(-w / 2 + WALL + 0.45, front * 0.3 - 1.1, -w / 2 + WALL + 0.45, front * 0.3 + 1.1, 0.45, fy); // sofa
  seg(w / 2 - WALL - 0.35, line + 0.7, w / 2 - WALL - 0.35, line + 3.3, 0.33, r.floor + 1); // counter
  return out;
}

/** walkable floor (and porch ramp down to the street) as district decks */
export function homeDecks(r: Residence): Deck[] {
  const { w, d } = DESIGNS[r.style];
  const fwd = { x: Math.sin(r.rot), z: Math.cos(r.rot) };
  const porch = turn(r, 0, d / 2 + PORCH / 2);
  const ground = heightAt(porch.x, porch.z);
  return [
    { id: `${r.id}:floor`, x: r.x, z: r.z, dirX: fwd.x, dirZ: fwd.z, length: d - WALL, width: w - WALL, top: r.floor, base: r.floor, ramp: 0 },
    // ramps at both ends: the inner end sits under the floor deck (the higher deck wins), the outer one meets the street
    { id: `${r.id}:porch`, x: porch.x, z: porch.z, dirX: fwd.x, dirZ: fwd.z, length: PORCH + 1.2, width: DOOR + 1.2, top: r.floor, base: Math.min(r.floor, ground), ramp: 1.4 },
  ];
}

/* ------------------------------------------------------------------ garages (residence-deeds.ts sells them with the home)
 * Local frame: origin at the slab centre on the floor, doors along +z. One roll-up door per bay; the doors themselves
 * are drawn and animated by ResidenceGarages.tsx (they lift for the owner), so only the shell is here. */

const turnG = (g: Garage, x: number, z: number) => { const c = Math.cos(g.rot), s = Math.sin(g.rot); return { x: g.x + x * c + z * s, z: g.z - x * s + z * c }; };
/** local x of a bay's centre */
export const bayX = (g: Pick<Garage, "bays">, i: number) => (i - (g.bays - 1) / 2) * BAY_W;
/** where a vehicle stands in bay i (world), nose toward the door */
export function bayPose(g: Garage, i: number) { const p = turnG(g, bayX(g, i), 0.2); return { x: p.x, z: p.z, y: g.floor, rot: g.rot }; }
/** the point in front of bay i's door (world): where you stand to open it */
export function bayApron(g: Garage, i: number) { return turnG(g, bayX(g, i), GARAGE_D / 2 + 2.5); }

export function garageBoxes(g: Garage, sink = 1): Box[] {
  const w = garageWidth(g.bays), d = GARAGE_D, h = GARAGE_H, out: Box[] = [];
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, mat: Mat = "solid") => out.push({ x, y, z, sx, sy, sz, color, mat });
  const wall = "#8c8f93", trim = "#3b4046";
  box(0, -sink / 2, 0, w + 0.3, sink, d + 0.3, "#5f6164");
  box(0, -0.02, 0, w - WALL * 2, 0.04, d - WALL * 2, "#4a4d51");
  // apron slab in front of the doors, down to the street
  box(0, -0.06, d / 2 + 1.5, w, 0.12, 3, "#56595d");
  box(0, h / 2, -d / 2 + WALL / 2, w, h, WALL, wall);
  box(-w / 2 + WALL / 2, h / 2, 0, WALL, h, d, wall);
  box(w / 2 - WALL / 2, h / 2, 0, WALL, h, d, wall);
  // header over the doors, and posts between the bays
  box(0, DOOR_H + (h - DOOR_H) / 2, d / 2 - WALL / 2, w, h - DOOR_H, WALL, wall);
  for (let i = 1; i < g.bays; i++) box(-w / 2 + WALL + i * BAY_W, DOOR_H / 2, d / 2 - WALL / 2, 0.3, DOOR_H, WALL + 0.04, trim);
  box(0, h + 0.1, 0, w + 0.4, 0.2, d + 0.4, trim);
  // bay lines, wheel stops and a strip light per bay
  for (let i = 0; i < g.bays; i++) {
    const x = bayX(g, i);
    for (const s of [-1, 1]) box(x + s * (BAY_W / 2 - 0.12), 0.005, 0.2, 0.08, 0.012, d - 1.4, "#d8cf8e");
    box(x, 0.08, -d / 2 + 1.0, 1.6, 0.14, 0.22, "#c9a640");
    box(x, h - 0.05, 0, 0.18, 0.04, 2.4, "#fff3dc", "lamp");
  }
  return out;
}

/** collision for the garage shell, plus each closed door (a vehicle-tight wall across the bay) */
export function garageWalls(g: Garage, open: readonly boolean[]): Wall[] {
  const w = garageWidth(g.bays), d = GARAGE_D, top = g.floor + GARAGE_H, out: Wall[] = [];
  const seg = (ax: number, az: number, bx: number, bz: number, half: number, wallTop = top) => { const a = turnG(g, ax, az), b = turnG(g, bx, bz); out.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, half, base: g.base, top: wallTop }); };
  const ix = w / 2 - WALL / 2, iz = d / 2 - WALL / 2;
  seg(-ix, -iz, ix, -iz, WALL / 2);
  seg(-ix, -iz, -ix, iz, WALL / 2);
  seg(ix, -iz, ix, iz, WALL / 2);
  for (let i = 1; i < g.bays; i++) { const x = -w / 2 + WALL + i * BAY_W; seg(x, iz - 0.1, x, iz + 0.1, 0.15); }
  for (let i = 0; i < g.bays; i++) if (!open[i]) { const x = bayX(g, i); seg(x - BAY_W / 2 + 0.15, iz, x + BAY_W / 2 - 0.15, iz, 0.12); }
  return out;
}

/** the garage floor and the apron ramp as walkable decks */
export function garageDecks(id: string, g: Garage): Deck[] {
  const w = garageWidth(g.bays), fwd = { x: Math.sin(g.rot), z: Math.cos(g.rot) };
  const apron = turnG(g, 0, GARAGE_D / 2 + 1.5), ground = heightAt(apron.x, apron.z);
  return [
    { id: `${id}:garage`, x: g.x, z: g.z, dirX: fwd.x, dirZ: fwd.z, length: GARAGE_D - WALL, width: w - WALL, top: g.floor, base: g.floor, ramp: 0 },
    { id: `${id}:apron`, x: apron.x, z: apron.z, dirX: fwd.x, dirZ: fwd.z, length: 3.6, width: w, top: g.floor, base: Math.min(g.floor, ground), ramp: 2.4 },
  ];
}
