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
      // one lap (a circuit's points repeat for every lap)
      const per = (r.points.length - 1) / r.laps, pts = r.points.slice(0, per + 1).map((_, i) => worldPoint(r, i)), src = raw.get(r.id)!;
      expect(Number.isInteger(per)).toBe(true);
      expect(pts.length).toBeGreaterThanOrEqual(6);
      expect(len(pts) / len(src) > 0.6 ? "ok" : `${r.id} only ${Math.round((len(pts) / len(src)) * 100)}% of its length`).toBe("ok");
      const loop = Math.hypot(src[0]!.x - src[src.length - 1]!.x, src[0]!.z - src[src.length - 1]!.z) < 1;
      if (loop) expect(Math.hypot(pts[0]!.x - pts[pts.length - 1]!.x, pts[0]!.z - pts[pts.length - 1]!.z)).toBeLessThan(1);
      expect(r.par).toBeGreaterThan(20);
    }
  });
});

import { pointWorld } from "./activities";
describe("routed shortcuts and laps", () => {
  test("a routed shortcut is a drivable cut no longer than the route it skips, and repeats every lap", () => {
    let n = 0;
    for (const r of RACES.filter((x) => x.mode === "vehicle")) for (const sc of r.shortcuts) {
      n++;
      const from = worldPoint(r, sc.at - 1), to = worldPoint(r, sc.skipTo), via = pointWorld(r.area, sc.via);
      expect(sc.skipTo).toBeGreaterThan(sc.at);
      expect(legDrivable(from, via) && legDrivable(via, to) ? "ok" : `${r.id} shortcut`).toBe("ok");
      let route = 0; for (let k = sc.at; k <= sc.skipTo; k++) { const a = worldPoint(r, k - 1), b = worldPoint(r, k); route += Math.hypot(a.x - b.x, a.z - b.z); }
      expect(Math.hypot(via.x - from.x, via.z - from.z) + Math.hypot(to.x - via.x, to.z - via.z)).toBeLessThanOrEqual(route + 0.5);
    }
    expect(n).toBeGreaterThan(0);
  });
});
