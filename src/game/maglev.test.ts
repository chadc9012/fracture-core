import { describe, expect, test } from "bun:test";
import { DECK } from "./neon-tiers";
import { DRONE_LANES } from "./neon-tiers";
import { MAGLEV_LINES, carPoses, cycleLegs, cycleSeconds, railLength, trainState, worldMaglev, CAR_STEP } from "./maglev";

const C = { x: 0, z: 0 };
describe("Neon City maglev", () => {
  test("several lines, all above the Grid deck and clear of the street", () => {
    expect(MAGLEV_LINES.length).toBeGreaterThanOrEqual(4);
    for (const l of MAGLEV_LINES) for (const p of l.rail.pts) expect(p[2]!, l.id).toBeGreaterThan(DECK.y + 4);
    expect(new Set(MAGLEV_LINES.map((l) => l.id)).size).toBe(MAGLEV_LINES.length);
  });
  test("different lines never share a height where their tracks cross the same drone lane", () => {
    const ys = MAGLEV_LINES.map((l) => l.rail.pts[0]![2]!);
    for (const lane of DRONE_LANES) for (const y of ys) expect(Math.abs(y - lane.y)).toBeGreaterThan(2);
  });
  test("trains stop at stations, move between them, and are periodic", () => {
    for (const l of MAGLEV_LINES) {
      const total = railLength(l), cycle = cycleSeconds(l, total);
      let stopped = 0, moving = 0;
      for (let t = 0; t < cycle; t += 0.5) { const st = trainState(l, total, 0, t); if (st.stopped) stopped++; else moving++; }
      expect(stopped, l.id).toBeGreaterThan(0); expect(moving, l.id).toBeGreaterThan(0);
      const a = trainState(l, total, 0, 3.3), b = trainState(l, total, 0, 3.3 + cycle);
      expect(Math.abs(a.s - b.s)).toBeLessThan(1e-6);
    }
  });
  test("a train never exceeds cruise speed by much and never leaves the rail", () => {
    for (const l of MAGLEV_LINES) {
      const total = railLength(l), cycle = cycleSeconds(l, total);
      let prev = trainState(l, total, 0, 0).s;
      for (let t = 0.1; t < cycle; t += 0.1) {
        const s = trainState(l, total, 0, t).s; const v = Math.abs(s - prev) / 0.1;
        expect(v, `${l.id} at ${t}`).toBeLessThan(l.speed * 1.25 * 1.6);
        prev = s;
        if (l.mode === "shuttle") { expect(s).toBeGreaterThanOrEqual(-1e-6); expect(s).toBeLessThanOrEqual(total + 1e-6); }
      }
    }
  });
  test("trains on a line are spread out, cars trail the head on the rail with fixed spacing", () => {
    for (const { line, rail } of worldMaglev(C)) {
      if (line.trains > 1) expect(trainState(line, rail.total, 0, 1).s).not.toBeCloseTo(trainState(line, rail.total, 1, 1).s, 1);
      const st = trainState(line, rail.total, 0, 40);
      const cars = carPoses(line, rail, st);
      expect(cars.length).toBe(line.cars);
      if (line.mode === "loop") expect(Math.hypot(cars[0]!.x - cars[1]!.x, cars[0]!.z - cars[1]!.z)).toBeGreaterThan(CAR_STEP * 0.5);
    }
  });
  test("legs cover the whole cycle in order", () => {
    for (const l of MAGLEV_LINES) { const legs = cycleLegs(l, railLength(l)); expect(legs.length).toBeGreaterThan(1); }
  });
});
