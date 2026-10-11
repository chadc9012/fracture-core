import { describe, expect, test } from "bun:test";
import { DEBRIS_COUNT, MIN_WRECK_GAP, TRENCH_ZONE, WRECK_COUNT, debrisPose, floatingDebris, lavaFissures, trenchCentre, wreckField } from "./set-pieces";

describe("set pieces", () => {
  test("wreck field is deterministic, full and never stacked", () => {
    const a = wreckField(), b = wreckField();
    expect(a).toEqual(b);
    expect(a.length).toBe(WRECK_COUNT);
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) expect(Math.hypot(a[i]!.x - a[j]!.x, a[i]!.z - a[j]!.z)).toBeGreaterThanOrEqual(MIN_WRECK_GAP);
    expect(a.some((w) => w.smoke)).toBe(true);
  });
  test("blocked ground is skipped", () => {
    const c = wreckField()[0]!;
    expect(wreckField((x, z) => Math.hypot(x - c.x, z - c.z) < 1).some((w) => w.x === c.x && w.z === c.z)).toBe(false);
  });
  test("lava fissures stay inside the real lava-trench hazard zone", () => {
    const c = trenchCentre();
    for (const f of lavaFissures()) {
      for (const s of [-0.5, 0.5]) {
        const x = f.x + Math.sin(f.yaw) * f.length * s, z = f.z + Math.cos(f.yaw) * f.length * s;
        expect(Math.hypot(x - c.x, z - c.z)).toBeLessThanOrEqual(TRENCH_ZONE.radius);
      }
    }
  });
  test("debris floats above the trench and bobs within a metre", () => {
    const d = floatingDebris();
    expect(d.length).toBe(DEBRIS_COUNT);
    for (const x of d) for (let t = 0; t < 20; t += 1.3) { const p = debrisPose(x, t); expect(p.y).toBeGreaterThan(4); expect(Math.abs(p.y - x.lift)).toBeLessThanOrEqual(0.8 + 1e-9); }
  });
});
