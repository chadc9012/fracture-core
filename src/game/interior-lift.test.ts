import { describe, expect, test } from "bun:test";
import { INTERIORS, LIFT_RADIUS, doorAt, interiorById, liftAt, roomBounds } from "./interiors";

/** every pad of every interior: a single `lift` or a bank of `lifts` */
const pads = INTERIORS.flatMap((i) => [...(i.lift ? [i.lift] : []), ...(i.lifts ?? [])].map((l) => ({ i, l })));
const padsOf = (id: string) => pads.filter((p) => p.i.id === id).map((p) => p.l);
describe("interior elevators", () => {
  test("there is at least one lift pair", () => { expect(pads.length).toBeGreaterThanOrEqual(2); });
  test("every lift leads to an existing interior that lifts back, so a ride is always reversible", () => {
    for (const { i, l } of pads) { expect(interiorById(l.to)).toBeTruthy(); expect(padsOf(l.to).some((b) => b.to === i.id)).toBe(true); }
  });
  test("a pad and its landing are inside the room, and you land clear of every destination pad (no ping-pong)", () => {
    for (const { i, l } of pads) {
      const to = interiorById(l.to)!, b = roomBounds(i), tb = roomBounds(to);
      expect(Math.abs(l.pad.x)).toBeLessThanOrEqual(b.hx); expect(Math.abs(l.pad.z)).toBeLessThanOrEqual(b.hz);
      expect(Math.abs(l.land.x)).toBeLessThanOrEqual(tb.hx); expect(Math.abs(l.land.z)).toBeLessThanOrEqual(tb.hz);
      for (const q of padsOf(l.to)) expect(Math.hypot(l.land.x - q.pad.x, l.land.z - q.pad.z)).toBeGreaterThan(LIFT_RADIUS + 0.5);
    }
  });
  test("stepping on the pad rides; one step off it does not", () => {
    const i = interiorById("nexus-apartment")!, l = padsOf("nexus-apartment")[0]!;
    expect(liftAt(i, l.pad.x, l.pad.z)?.to.id).toBe(l.to);
    expect(liftAt(i, l.pad.x + LIFT_RADIUS + 0.3, l.pad.z)).toBeNull();
    expect(liftAt(interiorById("neon-property-office")!, 0, 0)).toBeNull();
  });
  test("a lift-only floor has no street door: nobody can walk into it from the world", () => {
    for (const i of INTERIORS.filter((x) => x.viaLift)) expect(doorAt(i.doorPos.x, i.doorPos.z)?.id).not.toBe(i.id);
  });
  test("rooms never overlap: every interior has its own origin", () => {
    const keys = INTERIORS.map((i) => `${i.origin.x},${i.origin.z}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  test("the Residences' upper floors are left by their elevator, the lobby by its street door", () => {
    expect(interiorById("nexus-tower-lounge")!.noExit).toBe(true);
    expect(interiorById("nexus-apartment")!.noExit).toBeUndefined();
  });
});
