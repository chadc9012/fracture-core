import { describe, expect, test } from "bun:test";
import { coastBite } from "./terrain";
import { BASE_WORLD_REGIONS, BASE_WORLD_RADIUS } from "./world";

describe("fractured coast", () => {
  test("the sea never bites into a region or its shore", () => {
    for (const r of BASE_WORLD_REGIONS) for (let a = 0; a < Math.PI * 2; a += 0.2) for (const k of [0, 0.5, 1, 1.3]) {
      expect(coastBite(r.x + Math.cos(a) * r.radius * k, r.z + Math.sin(a) * r.radius * k)).toBe(0);
    }
  });
  test("bays exist along the rim, and the heart of the world is untouched", () => {
    let bays = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.05) if (coastBite(Math.cos(a) * BASE_WORLD_RADIUS * 0.8, Math.sin(a) * BASE_WORLD_RADIUS * 0.8) > 10) bays++;
    expect(bays).toBeGreaterThan(5);
    expect(coastBite(0, 0)).toBe(0);
  });
});
