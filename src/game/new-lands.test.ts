import { describe, expect, test } from "bun:test";
import { NEW_LANDS } from "./new-lands";
import { CONTINENTS } from "./planet";
import { cartoMapAt } from "./carto-maps";
import { REGIONS } from "./world";
import { WATER_LEVEL } from "./terrain";

describe("the new lands (Crystal Badlands, The Shattered Reefs)", () => {
  test("every place on the board's list for the continent is on its map", () => {
    for (const land of NEW_LANDS) {
      const c = CONTINENTS.find((x) => x.id === land.map.id);
      if (!c) continue;   // the planetary board's regions (board-lands.ts) aren't continents of their own
      const names = land.features().pois.map((p) => p.name);
      for (const p of c.places) expect(`${c.id}:${p.name}:${names.some((n) => n.startsWith(p.name) || p.name.includes(n))}`).toBe(`${c.id}:${p.name}:true`);
    }
  });
  test("towns stand on dry land, piers reach the water, and the lands lie beyond the playable world", () => {
    for (const land of NEW_LANDS) {
      const f = land.features(), town = f.pois.find((p) => p.rank === 0 && (p.cat === "village" || p.cat === "spire" || p.cat === "research"))!;
      expect(land.source.height(town.x, town.z)).toBeGreaterThan(WATER_LEVEL + 1);
      for (const r of REGIONS) expect(Math.hypot(land.map.x - r.x, land.map.z - r.z)).toBeGreaterThan(land.map.reach + r.radius * 3);
      expect(cartoMapAt(land.map.x, land.map.z)?.id).toBe(land.map.id);
      const covers = new Set<string>();
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const x = land.map.x + i * land.map.reach * 0.22, z = land.map.z + j * land.map.reach * 0.22, h = land.source.height(x, z); covers.add(land.source.cover(x, z, h, 0.2)); }
      expect(covers.size).toBeGreaterThan(4);
    }
  });
});
