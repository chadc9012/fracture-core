import { beforeEach, describe, expect, test } from "bun:test";
import { ARRIVE_RADIUS, getPin, pinAt, pinFromMarker, pinMarker, reached, resetPinCache, setPin, subscribePin } from "./map-pin";

describe("map waypoint", () => {
  beforeEach(() => { resetPinCache(); setPin(null); });
  test("a marker becomes a pin, the pin becomes a WAYPOINT marker, and listeners hear changes", () => {
    let heard = 0;
    const off = subscribePin(() => heard++);
    setPin(pinFromMarker({ id: "boss-ember", kind: "BOSS", label: "Magma Behemoth", x: 10, z: -20 }));
    expect(getPin()).toEqual({ id: "boss-ember", label: "Magma Behemoth", x: 10, z: -20, source: "BOSS" });
    const m = pinMarker(getPin()!);
    expect(m.kind).toBe("WAYPOINT");
    expect([m.x, m.z]).toEqual([10, -20]);
    setPin(null);
    expect(getPin()).toBeNull();
    off();
    setPin(pinAt(1, 2));
    expect(heard).toBe(2);
  });
  test("custom map points and arrival radius", () => {
    const p = pinAt(100.4, -50.6);
    expect(p.label).toBe("Custom waypoint");
    expect(reached(p, 100.4 + ARRIVE_RADIUS - 0.5, -50.6)).toBe(true);
    expect(reached(p, 100.4 + ARRIVE_RADIUS + 1, -50.6)).toBe(false);
  });
});
