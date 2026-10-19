import { describe, expect, test } from "bun:test";
import { NEON_FADE, NEON_FLAT, NEON_SITE, REGIONS, WORLD_RADIUS } from "./world";
import { heightAt, neonPlateauLevel, WATER_LEVEL } from "./terrain";

describe("Neon City plateau", () => {
  test("the city stands on one level above the water", () => {
    const level = neonPlateauLevel();
    expect(level).toBeGreaterThan(WATER_LEVEL + 2);
    let worst = 0;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) for (let r = 0; r <= NEON_FLAT - 4; r += 12) {
      worst = Math.max(worst, Math.abs(heightAt(NEON_SITE.x + Math.cos(a) * r, NEON_SITE.z + Math.sin(a) * r) - level));
    }
    // roads may grade a strip slightly; buildings and the market slab must not float or sink
    expect(worst).toBeLessThan(0.6);
  });
  test("the plateau stays inside the world and clear of the Nexus hub's buildings", () => {
    expect(Math.hypot(NEON_SITE.x, NEON_SITE.z) + NEON_FLAT + NEON_FADE).toBeLessThan(WORLD_RADIUS - 40);
    const nexus = REGIONS.find((r) => r.id === "nexus")!;
    expect(Math.hypot(NEON_SITE.x - nexus.x, NEON_SITE.z - nexus.z) - (NEON_FLAT + NEON_FADE)).toBeGreaterThan(25 + 20);
  });
});
