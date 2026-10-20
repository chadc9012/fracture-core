import { describe, expect, test } from "bun:test";
import { RACES, rawVehicleCourses, worldPoint } from "./racing";
import { BAKED_ROUTES } from "./race-routes.generated";
import { drivablePoint, legDrivable, MAX_GAP } from "./race-routing";
import { WORLD_SCALE } from "./world";

const len = (pts: { x: number; z: number }[]) => pts.slice(1).reduce((L, p, i) => L + Math.hypot(p.x - pts[i]!.x, p.z - pts[i]!.z), 0);

describe("drivable race routes", () => {
  const vehicle = RACES.filter((r) => r.mode === "vehicle");
  test("every vehicle course is baked for this world scale (re-run scripts/bake-race-routes.ts after changing the world)", () => {
    for (const r of vehicle) expect(BAKED_ROUTES[WORLD_SCALE]?.[r.id] ? r.id : `${r.id} not baked`).toBe(r.id);
  });
  test("every gate stands on drivable ground and every leg between gates is drivable", () => {
    for (const r of vehicle) {
      const pts = r.points.map((_, i) => worldPoint(r, i));
      for (const p of pts) expect(drivablePoint(p.x, p.z) ? "ok" : `${r.id} gate at ${p.x},${p.z}`).toBe("ok");
      for (let i = 1; i < pts.length; i++) {
        expect(legDrivable(pts[i - 1]!, pts[i]!) ? "ok" : `${r.id} leg ${i}`).toBe("ok");
        expect(Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z)).toBeLessThanOrEqual(MAX_GAP + 1);
      }
    }
  });
  test("routing keeps each course a real race: enough gates, most of its authored length, loops still close", () => {
    const raw = new Map(rawVehicleCourses().map((c) => [c.id, c.points]));
    for (const r of vehicle) {
      const pts = r.points.map((_, i) => worldPoint(r, i)), src = raw.get(r.id)!;
      expect(pts.length).toBeGreaterThanOrEqual(6);
      expect(len(pts) / len(src) > 0.6 ? "ok" : `${r.id} only ${Math.round((len(pts) / len(src)) * 100)}% of its length`).toBe("ok");
      const loop = Math.hypot(src[0]!.x - src[src.length - 1]!.x, src[0]!.z - src[src.length - 1]!.z) < 1;
      if (loop) expect(Math.hypot(pts[0]!.x - pts[pts.length - 1]!.x, pts[0]!.z - pts[pts.length - 1]!.z)).toBeLessThan(1);
      expect(r.par).toBeGreaterThan(20);
    }
  });
});
