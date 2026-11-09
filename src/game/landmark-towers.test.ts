import { describe, expect, test } from "bun:test";
import { CARTO_MAPS } from "./carto-maps";
import { CASINO_TOWER_M, CORE_SPIRE_M, cartoFeatures } from "./carto-features";

const height = (b: { m?: number; h: number }) => (b.m && b.m > 0 ? b.m : 3.5 + 120 * Math.pow(b.h, 1.6));

describe("landmark towers (owner, Nov 9 2026)", () => {
  const all = CARTO_MAPS.flatMap((m) => cartoFeatures(m).buildings.map((b) => ({ map: m.id, b })));
  const byName = (n: string) => all.filter((r) => r.b.name === n);
  test("the Nexus Core Spire is the tallest building in the game at 420 m", () => {
    const core = byName("Nexus Core Spire");
    expect(core.length).toBeGreaterThan(0);
    expect(core.every((r) => (r.map === "nexus" || r.map === "nexus-region") && height(r.b) === CORE_SPIRE_M)).toBe(true);
    expect(CORE_SPIRE_M).toBe(420);
  });
  test("the Neon City Grand Casino is the second tallest at 380 m, and nothing else comes near either", () => {
    const casino = byName("Neon City Grand Casino");
    expect(casino.length).toBeGreaterThan(0);
    expect(casino.every((r) => r.map === "neon-city" && height(r.b) === CASINO_TOWER_M)).toBe(true);
    const rest = all.filter((r) => r.b.name !== "Nexus Core Spire" && r.b.name !== "Neon City Grand Casino");
    expect(Math.max(...rest.map((r) => height(r.b)))).toBeLessThan(CASINO_TOWER_M);
  });
});
