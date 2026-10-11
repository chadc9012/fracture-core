import { expect, test } from "bun:test";
import { introCameraAt } from "./intro-camera";
import { riftPoint } from "./sky-dome";

test("intro opens on the broken horizon under the Sky Rift and looks up the tear", () => {
  const p0 = introCameraAt(0, 30), p1 = introCameraAt(9, 30);
  const dir = (p: typeof p0) => { const d = [p.lookAt[0] - p.position[0], p.lookAt[1] - p.position[1], p.lookAt[2] - p.position[2]]; const l = Math.hypot(d[0]!, d[1]!, d[2]!); return d.map((x) => x / l); };
  const r = riftPoint(0.7);
  const d0 = dir(p0);
  expect(d0[0]! * r[0] + d0[2]! * r[2]).toBeGreaterThan(0.6); // facing the rift's side of the sky
  expect(dir(p1)[1]!).toBeGreaterThan(d0[1]!);                // then tilting up it
});
