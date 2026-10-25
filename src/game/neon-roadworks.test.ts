import { describe, expect, test } from "bun:test";
import { cityStreets } from "./city-streets";
import { GROUND_FLEET, assignLoops, findLoops, streetGrid } from "./neon-ground-traffic";
import { ROADWORKS, drivenEdges, neonRoadworks, segmentEdge } from "./neon-roadworks";

describe("Neon roadworks", () => {
  const c = cityStreets("neon"), g = streetGrid(c), driven = drivenEdges(assignLoops(findLoops(g), GROUND_FLEET));
  const w = neonRoadworks(c, g, driven);
  test("a handful of closures, each with a barrier run, cones and a lamp", () => {
    expect(w.closed.length).toBeGreaterThan(0);
    expect(w.closed.length).toBeLessThanOrEqual(ROADWORKS.max);
    expect(w.barriers.length).toBeGreaterThanOrEqual(w.closed.length * 2);
    expect(w.cones.length).toBe(w.closed.length * 6);
    expect(w.lamps.length).toBe(w.closed.length);
  });
  test("no closure on a street the ground traffic drives", () => {
    for (const k of w.closed) expect(driven.has(k)).toBe(false);
  });
  test("every barrier and cone stands on its closed segment's carriageway, clear of the junction boxes", () => {
    const closedSegs = c.segments.filter((s) => w.closed.includes(segmentEdge(g, s)));
    const onSeg = (x: number, z: number) => closedSegs.some((s) => Math.abs(x - s.x) <= s.hx + 0.01 && Math.abs(z - s.z) <= s.hz + 0.01);
    for (const b of w.barriers) expect(onSeg(b.x, b.z)).toBe(true);
    for (const k of w.cones) expect(onSeg(k.x, k.z)).toBe(true);
    for (const j of c.junctions) for (const b of w.barriers) expect(Math.hypot(b.x - j.x, b.z - j.z)).toBeGreaterThan(3);
  });
  test("deterministic", () => { expect(neonRoadworks(c, g, driven)).toEqual(w); });
});
