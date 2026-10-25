// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { GROUND_FLEET, LANE_OFFSET, assignLoops, findLoops, loopPath, makePath, pathAt, streetGrid } from "./neon-ground-traffic";
import { cityStreets } from "./city-streets";
import { FLEET_MODELS } from "./fleet-models";

const streets = cityStreets("neon");
const grid = streetGrid(streets);
const loops = findLoops(grid);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe("Neon ground traffic", () => {
  it("only uses real fleet models, a little traffic, and trucks among the cars", () => {
    for (const v of GROUND_FLEET) expect(FLEET_MODELS[v.model]).toBeDefined();
    expect(GROUND_FLEET.length).toBeLessThanOrEqual(10);
    expect(GROUND_FLEET.filter((v) => v.model === "tech-transport" || v.model === "offroad-truck").length).toBeGreaterThanOrEqual(2);
    expect(GROUND_FLEET.length - GROUND_FLEET.filter((v) => FLEET_MODELS[v.model].kind === "heavy" || v.model === "offroad-truck").length).toBeGreaterThanOrEqual(4);
  });
  it("the street grid reads back every segment as a unit edge and the nodes land on the junctions", () => {
    expect(grid.edges.size).toBe(streets.segments.length);
    for (const j of streets.junctions) { let best = 1e9; for (let i = -40; i < 40; i++) for (let k = -40; k < 40; k++) { const p = grid.node(i, k); best = Math.min(best, Math.hypot(p.x - j.x, p.z - j.z)); } expect(best).toBeLessThan(0.01); }
  });
  it("finds plenty of closed routes whose every edge is a real carriageway", () => {
    expect(loops.length).toBeGreaterThanOrEqual(GROUND_FLEET.length * 3);
    for (const l of loops) {
      expect(l.nodes.length).toBeGreaterThanOrEqual(6);
      for (let k = 0; k < l.nodes.length; k++) {
        const a = l.nodes[k]!, b = l.nodes[(k + 1) % l.nodes.length]!;
        expect(Math.abs(a.i - b.i) + Math.abs(a.j - b.j)).toBe(1);
        const key = a.j === b.j ? `x:${Math.min(a.i, b.i)}:${a.j}` : `z:${a.i}:${Math.min(a.j, b.j)}`;
        expect(grid.edges.has(key)).toBe(true);
        expect(grid.junctions.has(`${a.i},${a.j}`)).toBe(true);
      }
    }
  });
  it("every assigned lane stays on the street surface, is closed and turns smoothly", () => {
    const assigned = assignLoops(loops, GROUND_FLEET);
    expect(new Set(assigned.map((l) => JSON.stringify(l.nodes))).size).toBe(GROUND_FLEET.length);
    GROUND_FLEET.forEach((v, k) => {
      const path = makePath(loopPath(grid, assigned[k]!, v.reverse));
      expect(path.length).toBeGreaterThan(100);
      let prevYaw = pathAt(path, 0).yaw;
      for (let s = 0.5; s <= path.length + 0.5; s += 0.5) {
        const p = pathAt(path, s);
        const onStreet = streets.segments.some((g) => Math.abs(p.x - g.x) <= g.hx + 0.5 && Math.abs(p.z - g.z) <= g.hz + 0.5) || streets.junctions.some((j) => Math.abs(p.x - j.x) <= streets.street / 2 + 0.5 && Math.abs(p.z - j.z) <= streets.street / 2 + 0.5);
        expect(onStreet).toBe(true);
        expect(Math.abs(wrap(p.yaw - prevYaw))).toBeLessThan(0.45);
        prevYaw = p.yaw;
      }
      const a = pathAt(path, 0), b = pathAt(path, path.length);
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1e-6);
    });
  });
  it("keeps to the right: the same route driven both ways uses opposite lanes", () => {
    const l = loops[0]!;
    const fwd = makePath(loopPath(grid, l, false)), back = makePath(loopPath(grid, l, true));
    // every point of the forward lane is LANE_OFFSET*2 from the reverse lane's nearest point on straight stretches
    let near = 0, total = 0;
    for (let s = 0; s < fwd.length; s += 2) {
      const p = pathAt(fwd, s); let best = 1e9;
      for (let u = 0; u < back.length; u += 0.5) { const q = pathAt(back, u); best = Math.min(best, Math.hypot(p.x - q.x, p.z - q.z)); }
      total++; if (Math.abs(best - 2 * LANE_OFFSET) < 0.2) near++;
    }
    expect(near / total).toBeGreaterThan(0.6);
  });
});
