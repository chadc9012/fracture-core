import { describe, expect, test } from "bun:test";
import { COASTLINE_ENABLED, coastDistance } from "./coastline";
import { heightAt, WATER_LEVEL } from "./terrain";
import { REGIONS, WORLD_SCALE } from "./world";
import { LANDMARKS } from "./landmarks";
import { RESOURCE_SITES, BOSS_LAIRS, SCENARIO_LAIRS } from "./waypoints";
import { THALASSIA_CENTER } from "./thalassia-site";
import { FOREST_SPAWN, CRASH_SITE, TRAIL } from "./verdant";

const dry = (x: number, z: number) => heightAt(x, z) > WATER_LEVEL + 0.2;

describe("coastline", () => {
  test("enabled only at the scaled world", () => { expect(COASTLINE_ENABLED).toBe(WORLD_SCALE === 4); });
  test("region centres and authored sites are dry land", () => {
    const bad: string[] = [];
    for (const r of REGIONS) if (!dry(r.x, r.z)) bad.push(`region ${r.id}`);
    for (const l of LANDMARKS) if (l.type !== "ocean" && l.regionId !== "thalassia" && !dry(l.x, l.z)) bad.push(`landmark ${l.id}`);
    for (const m of [...RESOURCE_SITES, ...BOSS_LAIRS, ...SCENARIO_LAIRS]) if (m.id !== "scenario-drowned-monarch" && !dry(m.x, m.z)) bad.push(`${m.kind} ${m.id}`);
    for (const p of [FOREST_SPAWN, CRASH_SITE, ...TRAIL]) if (!dry(p.x, p.z)) bad.push("verdant point");
    expect(bad).toEqual([]);
  });
  test("Thalassia stays open ocean", () => {
    if (!COASTLINE_ENABLED) return;
    expect(coastDistance(THALASSIA_CENTER.x, THALASSIA_CENTER.z)).toBeLessThan(0);
  });
  test("deterministic", () => { expect(coastDistance(100, -200)).toBe(coastDistance(100, -200)); });
});
