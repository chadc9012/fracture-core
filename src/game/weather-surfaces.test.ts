// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { DRY_HOURS, puddleCover, rainFall, stepGroundWetness, wetnessFromHistory } from "./wetness";
import { dewByHour, dewStrength } from "./dew";
import { GUST_WRAP, gustAt, gustiness, gustSpeed, stepGustDrift, windStrength } from "./wind";
import { environmentAt } from "./environment";
import { nearestGlints } from "./wet-reflections";

const run = (w: number, rain: number, hours: number, sun = 0.8, region?: string, step = 0.1) => {
  for (let h = 0; h < hours; h += step) w = stepGroundWetness(w, rain, step, sun, region);
  return w;
};

describe("rain wetness over time", () => {
  it("only rain wets the ground (snow and ash don't)", () => {
    expect(rainFall("Rain mist", 0.6)).toBeCloseTo(0.6);
    expect(rainFall("Snow haze", 0.9)).toBe(0);
    expect(rainFall("Ashfall", 1)).toBe(0);
    expect(rainFall(undefined, 1)).toBe(0);
  });
  it("soaks in within about an hour of steady rain and stays bounded", () => {
    expect(run(0, 0.6, 0.25)).toBeGreaterThan(0.15);
    expect(run(0, 0.6, 1.5)).toBeGreaterThan(0.9);
    expect(run(0, 1, 20)).toBeLessThanOrEqual(1);
    expect(stepGroundWetness(0.5, 0, 0)).toBe(0.5);
    expect(stepGroundWetness(2, 0, -1)).toBe(1);
  });
  it("dries out after the rain stops: slowly, faster in sun and deserts, slower at night and in the bog", () => {
    const after1 = run(1, 0, 1);
    expect(after1).toBeLessThan(1);
    expect(after1).toBeGreaterThan(0.6); // still glistening an hour later
    expect(run(1, 0, DRY_HOURS * 2)).toBe(0); // dry again eventually
    expect(run(1, 0, 2, 1)).toBeLessThan(run(1, 0, 2, 0)); // sun dries faster than night
    expect(run(1, 0, 2, 0.8, "solara")).toBeLessThan(run(1, 0, 2, 0.8, "swamps"));
  });
  it("history seed: wet right after a shower, dry after a long clear spell, matches stepping", () => {
    const shower = (stopAgo: number) => (ago: number) => ({ rain: ago > stopAgo && ago < stopAgo + 2 ? 0.7 : 0, sun: 0.7 });
    expect(wetnessFromHistory(shower(0.1))).toBeGreaterThan(0.85);
    expect(wetnessFromHistory(shower(6))).toBeLessThan(wetnessFromHistory(shower(1)));
    expect(wetnessFromHistory(() => ({ rain: 0, sun: 1 }))).toBe(0);
  });
  it("puddles only once the ground is soaked", () => {
    expect(puddleCover(0.3)).toBe(0);
    expect(puddleCover(1)).toBe(1);
    expect(puddleCover(0.7)).toBeGreaterThan(0);
  });
  it("the real weather cycle produces wet spells and dry spells in the forest", () => {
    // a few in-game days of Veridan weather, seeded from history at each hour
    let wetHours = 0, dryHours = 0;
    for (let hr = 0; hr < 24 * 6; hr++) {
      const t = hr / 24;
      const w = wetnessFromHistory((ago) => { const e = environmentAt("veridan", t - ago / 24, 0); return { rain: rainFall(e.weather?.label, e.weather?.precipitation ?? 0), sun: 0.6 }; }, "veridan", 0.5);
      if (w > 0.5) wetHours++;
      if (w < 0.05) dryHours++;
    }
    expect(wetHours).toBeGreaterThan(0);
    expect(dryHours).toBeGreaterThan(0);
  });
});

describe("morning dew", () => {
  it("peaks at dawn and burns off by mid-morning", () => {
    expect(dewByHour(5.5)).toBeGreaterThan(0.95);
    expect(dewByHour(6.5)).toBeGreaterThan(0.95);
    expect(dewByHour(8)).toBeLessThan(dewByHour(6.5));
    expect(dewByHour(8)).toBeGreaterThan(0);
    expect(dewByHour(10.5)).toBe(0);
    expect(dewByHour(14)).toBe(0);
    expect(dewByHour(22)).toBe(0);
    expect(dewByHour(29.5)).toBeCloseTo(dewByHour(5.5)); // wraps the day
  });
  it("clear calm humid mornings get the most; cloud, wind, rain and deserts suppress it", () => {
    const best = dewStrength(6, { cloud: 0.1, wind: 1, regionId: "veridan" });
    expect(best).toBeGreaterThan(0.8);
    expect(dewStrength(6, { cloud: 0.95, wind: 1, regionId: "veridan" })).toBeLessThan(best * 0.5);
    expect(dewStrength(6, { cloud: 0.1, wind: 14, regionId: "veridan" })).toBeLessThan(0.05);
    expect(dewStrength(6, { cloud: 0.1, wind: 1, precipitation: 1, regionId: "veridan" })).toBe(0);
    expect(dewStrength(6, { cloud: 0.1, wind: 1, regionId: "solara" })).toBeLessThan(best * 0.4);
  });
});

describe("water light reflections", () => {
  it("picks the nearest lights in range, nearest first, within the budget", () => {
    const gs = [{ x: 100, z: 0 }, { x: 5, z: 0 }, { x: 0, z: 50 }, { x: 1000, z: 0 }];
    expect(nearestGlints(gs, 0, 0, 2)).toEqual([{ x: 5, z: 0 }, { x: 0, z: 50 }]);
    expect(nearestGlints(gs, 0, 0, 10, 200).length).toBe(3);
    expect(nearestGlints(gs, 0, 0, 0)).toEqual([]);
  });
});

describe("gust field", () => {
  it("is bounded, patchy (strong gusts and lulls) and tiles at the wrap so the drift can wrap", () => {
    let lo = 0, hi = 0, n = 0;
    for (let x = 0; x < 600; x += 7) for (let z = 0; z < 600; z += 7) {
      const g = gustAt(x, z, 0, 0); n++;
      expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(1);
      if (g < 0.1) lo++; if (g > 0.6) hi++;
    }
    expect(lo / n).toBeGreaterThan(0.15);
    expect(hi / n).toBeGreaterThan(0.1);
    for (const [x, z] of [[13, 77], [-410, 255], [999, -3]] as const) expect(gustAt(x + GUST_WRAP, z - GUST_WRAP, 0, 0)).toBeCloseTo(gustAt(x, z, 0, 0), 6);
  });
  it("travels downwind: after drifting, the gust that was at p is found downwind of p", () => {
    const dir = { x: 0.6, z: 0.8 }, speed = 8, dt = 2;
    const off = stepGustDrift({ x: 0, z: 0 }, dir.x, dir.z, speed, dt);
    const d = gustSpeed(speed) * dt;
    for (const [x, z] of [[10, 20], [-300, 41], [512, 512]] as const) expect(gustAt(x + dir.x * d, z + dir.z * d, off.x, off.z)).toBeCloseTo(gustAt(x, z, 0, 0), 6);
    const far = stepGustDrift({ x: GUST_WRAP - 1, z: 1 }, 1, -1, 14, 10);
    expect(far.x).toBeGreaterThanOrEqual(0); expect(far.x).toBeLessThan(GUST_WRAP); expect(far.z).toBeGreaterThanOrEqual(0);
  });
  it("storms gust harder and faster than still air", () => {
    expect(gustiness(14)).toBeGreaterThan(gustiness(2));
    expect(gustiness(0)).toBeGreaterThanOrEqual(0.35);
    expect(gustiness(100)).toBeLessThanOrEqual(1);
    expect(gustSpeed(14)).toBeGreaterThan(gustSpeed(1));
    expect(windStrength(14)).toBeGreaterThan(windStrength(5));
  });
});
