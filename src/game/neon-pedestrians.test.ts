import { describe, expect, test } from "bun:test";
import { cityStreets, propRect } from "./city-streets";
import { assignWalkers, pavementWalks, walkerPose } from "./neon-pedestrians";

const st = cityStreets("neon"), walks = pavementWalks(st), walkers = assignWalkers(walks, 12);
describe("neon pedestrians", () => {
  test("there are clear pavements and a dozen walkers", () => { expect(walks.length).toBeGreaterThan(12); expect(walkers.length).toBe(12); });
  test("walkers use distinct walks", () => { expect(new Set(walkers.map((w) => w.walk)).size).toBe(12); });
  test("no walker ever overlaps a solid prop or building", () => {
    const blockers = [...st.props.filter((p) => p.kind !== "bollard").map(propRect), ...st.solids];
    for (const w of walkers) for (let t = 0; t < 400; t += 1.3) {
      const p = walkerPose(w, t);
      expect(blockers.some((r) => Math.abs(p.x - r.x) <= r.hx && Math.abs(p.z - r.z) <= r.hz)).toBe(false);
    }
  });
  test("walkers stay on their edge and turn round at the ends", () => {
    const w = walkers[0]!, a = walkerPose(w, 0), far = walkerPose(w, w.walk.length / w.speed + 1000);
    for (const p of [a, far]) { const s = (p.x - w.walk.a.x) * w.walk.dx + (p.z - w.walk.a.z) * w.walk.dz; expect(s).toBeGreaterThanOrEqual(-1e-6); expect(s).toBeLessThanOrEqual(w.walk.length + 1e-6); }
    const yaws = new Set<number>(); for (let t = 0; t < 2 * w.walk.length / w.speed; t += 0.5) yaws.add(Math.round(walkerPose(w, t).yaw * 100));
    expect(yaws.size).toBe(2);
  });
});
