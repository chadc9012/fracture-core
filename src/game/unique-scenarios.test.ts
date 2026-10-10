// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
// @ts-ignore node types are not in this project tsconfig
import { existsSync, readFileSync, statSync } from "node:fs";
import { LAIR_SCENARIOS, UNIQUE_SCENARIOS, scenarioById, scenarioFor } from "./unique-scenarios";
import { BOSS_LAIRS, SCENARIO_LAIRS } from "./waypoints";
import { MATERIALS } from "./inventory";
import { REGIONS } from "./world";
import { encounterFor } from "./encounters";

describe("unique scenarios", () => {
  it("have unique ids and a real drop material each", () => {
    expect(new Set(UNIQUE_SCENARIOS.map((s) => s.id)).size).toBe(UNIQUE_SCENARIOS.length);
    for (const s of UNIQUE_SCENARIOS) expect(MATERIALS[s.drop as keyof typeof MATERIALS]).toBeDefined();
  });
  it("keep the original fallback behaviour for Solara and Thalassia", () => {
    expect(scenarioFor("solara")?.id).toBe("unbroken-glass");
    expect(scenarioFor("thalassia")?.id).toBe("system-core");
  });
  it("lair scenarios never hijack a region's catalog or fallback boss", () => {
    for (const s of LAIR_SCENARIOS) {
      expect(scenarioFor(s.regionId)?.id).not.toBe(s.id);
      expect(scenarioById(s.id)).toBe(s);
    }
  });
  it("Rime Alpha and the Dark Knight are registered with lairs inside their regions, apart from the catalog lairs", () => {
    for (const id of ["rime-alpha", "dark-knight"]) {
      const lair = SCENARIO_LAIRS.find((l) => l.scenarioId === id)!;
      expect(lair).toBeDefined();
      const region = REGIONS.find((r) => r.id === lair.regionId)!;
      expect(Math.hypot(lair.x - region.x, lair.z - region.z)).toBeLessThan(region.radius);
      for (const other of BOSS_LAIRS) expect(Math.hypot(lair.x - other.x, lair.z - other.z)).toBeGreaterThan(20);
    }
  });
  it("only authored lair regions with a catalog boss keep their regular boss (the scenario is an extra fight)", () => {
    expect(encounterFor("frostspire")?.boss).toBeDefined();
  });
  it("boss models ship in /public as valid, reasonably small GLBs", () => {
    for (const s of UNIQUE_SCENARIOS.filter((x) => x.model)) {
      const path = `public${s.model!.url}`;
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path).subarray(0, 4).toString()).toBe("glTF");
      expect(statSync(path).size).toBeLessThan(8_000_000);
      expect(s.model!.height).toBeGreaterThan(1);
    }
  });
});
