import { expect, test } from "bun:test";
import { DRONE_STATION, droneStation, stepDrone } from "./nova-drone";

test("NOVA drone keeps station off the left shoulder, follows without overshoot, snaps after a teleport", () => {
  // facing +z (yaw 0): left is +x
  const s = droneStation(0, 0, 0, 0, 0);
  expect(s.x).toBeGreaterThan(1);
  expect(s.y).toBeCloseTo(DRONE_STATION.up, 1);
  let p = { x: 0, y: 0, z: 0, yaw: 0 };
  const target = { x: 10, y: 2, z: 0, yaw: 0 };
  for (let i = 0; i < 120; i++) { const n = stepDrone(p, target, 1 / 60); expect(n.x).toBeLessThanOrEqual(10); p = n; }
  expect(p.x).toBeGreaterThan(9);
  const far = stepDrone({ x: 0, y: 0, z: 0, yaw: 0 }, { x: 500, y: 0, z: 0, yaw: 0 }, 1 / 60);
  expect(far.x).toBe(500);
});
