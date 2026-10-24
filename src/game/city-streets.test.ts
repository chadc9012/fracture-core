import { describe, expect, test } from "bun:test";
import { buildCityStreets, cityStreets, propRect, propsForTier, puddlesForTier, signalPhase, streetWalls, SOLID_PROPS, KERB_W, type CityStreets, type Rect, type Disc } from "./city-streets";
import { INTERIORS } from "./interiors";
import { VENUE_INTERIORS } from "./venue-doors";
import { REGIONAL_SHOPS } from "./regional-shops";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";

const overlap = (a: Rect, b: Rect, m = 0) => Math.abs(a.x - b.x) < a.hx + b.hx + m && Math.abs(a.z - b.z) < a.hz + b.hz + m;
const rectDisc = (a: Rect, d: Disc) => Math.hypot(Math.max(Math.abs(d.x - a.x) - a.hx, 0), Math.max(Math.abs(d.z - a.z) - a.hz, 0)) < d.r;
const junctionBox = (s: CityStreets, j: { x: number; z: number }): Rect => ({ x: j.x, z: j.z, hx: s.street / 2, hz: s.street / 2 });

for (const city of ["nexus", "neon"] as const) describe(`${city} streets`, () => {
  const s = cityStreets(city);

  test("is deterministic", () => {
    expect(JSON.stringify(buildCityStreets(city))).toBe(JSON.stringify(s));
  });

  test("has a real street network", () => {
    expect(s.segments.length).toBeGreaterThan(40);
    expect(s.junctions.length).toBeGreaterThan(25);
    expect(s.kerbs.length).toBeGreaterThan(300);
    expect(s.props.filter((p) => p.kind === "signal").length).toBeGreaterThan(20);
    for (const k of ["bench", "bin", "planter", "hydrant", "sign"] as const) expect(s.props.some((p) => p.kind === k)).toBe(true);
  });

  test("every junction arm has a zebra crossing, a stop line on its approach lane and lies on a real carriageway", () => {
    for (const j of s.junctions) {
      expect(j.arms.length).toBeGreaterThanOrEqual(2);
      for (const a of j.arms) {
        const dx = a === "+x" ? 1 : a === "-x" ? -1 : 0, dz = a === "+z" ? 1 : a === "-z" ? -1 : 0;
        const probe = { x: j.x + dx * (s.street / 2 + 2), z: j.z + dz * (s.street / 2 + 2), hx: 0.05, hz: 0.05 };
        const seg = s.segments.find((g) => overlap(g, probe));
        expect(seg).toBeDefined();
        const zebra = s.paint.filter((p) => p.kind === "zebra" && overlap(p, probe, 2.5));
        expect(zebra.length).toBeGreaterThanOrEqual(4);
        for (const z of zebra) expect(overlap(z, seg!)).toBe(true);
        const stop = s.paint.filter((p) => p.kind === "stop" && Math.abs((p.x - j.x) * dx + (p.z - j.z) * dz - (s.street / 2 + 3.95)) < 0.1 && Math.abs((p.x - j.x) * dz - (p.z - j.z) * dx) < s.street / 2);
        expect(stop.length).toBe(1);
      }
    }
  });

  test("no furniture stands in a lane, a junction box or a building, and all of it is on a kerbed sidewalk", () => {
    const lanes = [...s.segments, ...s.junctions.map((j) => junctionBox(s, j))];
    for (const p of s.props) {
      const r = propRect(p);
      for (const l of lanes) expect(overlap(r, l)).toBe(false);
      for (const b of s.solids) expect(overlap(r, b)).toBe(false);
      for (const d of s.solidDiscs) expect(rectDisc(r, d)).toBe(false);
      const c = s.cells.find((q) => Math.abs(q.x - p.x) <= s.half && Math.abs(q.z - p.z) <= s.half);
      expect(c).toBeDefined();
      expect(Math.abs(p.x - c!.x) + r.hx).toBeLessThanOrEqual(s.half - KERB_W + 1e-6);
      expect(Math.abs(p.z - c!.z) + r.hz).toBeLessThanOrEqual(s.half - KERB_W + 1e-6);
      if (city === "nexus") expect(distanceToRoad(p.x, p.z)).toBeGreaterThanOrEqual(LANE_HALF_WIDTH);
    }
  });

  test("keeps doors, shop counters and venue fronts clear", () => {
    const doors = [...INTERIORS, ...VENUE_INTERIORS].map((i) => i.doorPos);
    for (const p of s.props) {
      if (p.onPole) continue;
      const r = propRect(p);
      for (const d of doors) expect(rectDisc(r, { ...d, r: 2.5 })).toBe(false);
      for (const q of REGIONAL_SHOPS) expect(rectDisc(r, { x: q.x, z: q.z, r: 3 })).toBe(false);
    }
  });

  test("furniture never overlaps other furniture, lamp posts or palms", () => {
    const rs = s.props.map(propRect);
    for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) expect(overlap(rs[a]!, rs[b]!)).toBe(false);
    for (const [i, p] of s.props.entries()) if (!p.onPole) for (const f of s.fixtures) expect(rectDisc(rs[i]!, f)).toBe(false);
  });

  test("paint, kerbs and puddles never run under a building", () => {
    for (const q of [...s.paint, ...s.kerbs]) for (const b of s.solids) expect(overlap(q, b)).toBe(false);
    for (const p of s.puddles) for (const b of s.solids) expect(overlap({ x: p.x, z: p.z, hx: p.sx, hz: p.sx }, b)).toBe(false);
  });

  test("LOW keeps every solid piece, signal and sign but drops small clutter", () => {
    const low = propsForTier(s.props, "LOW");
    expect(low.length).toBeLessThan(s.props.length);
    for (const k of [...SOLID_PROPS, "signal", "sign"] as const) expect(low.filter((p) => p.kind === k).length).toBe(s.props.filter((p) => p.kind === k).length);
    expect(propsForTier(s.props, "HIGH").length).toBe(s.props.length);
    if (s.puddles.length) expect(puddlesForTier(s.puddles, "LOW").length).toBeLessThan(s.puddles.length);
  });

  test("solid furniture collides as low walls only", () => {
    const walls = streetWalls(s.props, () => 10);
    expect(walls.length).toBeGreaterThan(0);
    for (const w of walls) { expect(w.top).toBeLessThanOrEqual(12.6); expect(w.top).toBeGreaterThan(10); }
  });
});

describe("street detail", () => {
  test("Neon gets lane lines and puddles, Nexus leaves its lanes to the street shader", () => {
    expect(cityStreets("neon").paint.some((p) => p.kind === "centre")).toBe(true);
    expect(cityStreets("neon").puddles.length).toBeGreaterThan(30);
    expect(cityStreets("nexus").paint.some((p) => p.kind === "centre" || p.kind === "edge")).toBe(false);
  });
  test("signals alternate axes and show amber before the change", () => {
    expect(signalPhase(0).green).toBe("x");
    expect(signalPhase(13).green).toBe("z");
    expect(signalPhase(10).amber).toBe(true);
    expect(signalPhase(2).amber).toBe(false);
  });
});
