import { describe, expect, test } from "bun:test";
import { INTERIORS, LIFT_RADIUS, doorAt, interiorById, liftAt } from "./interiors";

const lifts = INTERIORS.filter((i) => i.lift);
describe("interior elevators", () => {
  test("there is at least one lift pair", () => { expect(lifts.length).toBeGreaterThanOrEqual(2); });
  test("every lift leads to an existing interior that lifts back, so a ride is always reversible", () => {
    for (const i of lifts) { const to = interiorById(i.lift!.to)!; expect(to).toBeTruthy(); expect(to.lift?.to).toBe(i.id); }
  });
  test("a pad and its landing are inside the 9 m room, and you land clear of the destination's pad (no ping-pong)", () => {
    for (const i of lifts) {
      const l = i.lift!, to = interiorById(l.to)!;
      for (const p of [l.pad, l.land]) { expect(Math.abs(p.x)).toBeLessThanOrEqual(4.5); expect(Math.abs(p.z)).toBeLessThanOrEqual(4.5); }
      expect(Math.hypot(l.land.x - to.lift!.pad.x, l.land.z - to.lift!.pad.z)).toBeGreaterThan(LIFT_RADIUS + 0.5);
    }
  });
  test("stepping on the pad rides; one step off it does not", () => {
    const i = interiorById("nexus-apartment")!;
    expect(liftAt(i, i.lift!.pad.x, i.lift!.pad.z)?.to.id).toBe("nexus-tower-lounge");
    expect(liftAt(i, i.lift!.pad.x + LIFT_RADIUS + 0.3, i.lift!.pad.z)).toBeNull();
    expect(liftAt(interiorById("neon-property-office")!, 0, 0)).toBeNull();
  });
  test("a lift-only floor has no street door: nobody can walk into it from the world", () => {
    for (const i of INTERIORS.filter((x) => x.viaLift)) expect(doorAt(i.doorPos.x, i.doorPos.z)?.id).not.toBe(i.id);
  });
  test("rooms never overlap: every interior has its own origin", () => {
    const keys = INTERIORS.map((i) => `${i.origin.x},${i.origin.z}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  test("the lounge is leaveable: its exit marker works like any other room's", () => {
    const l = interiorById("nexus-tower-lounge")!;
    expect(l.exitOffset).toEqual({ x: 0, z: 4 });
    expect(l.kind).toBe("APARTMENT");
  });
});
