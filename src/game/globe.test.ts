import { describe, expect, test } from "bun:test";
import { CONTINENTS, OCEANS } from "./planet";
import { CONTINENT_GLOBE, CONTINENT_MAPS, OCEAN_GLOBE, angleBetween, boardToLatLon, continentAt, latLonToVec, vecToLatLon } from "./globe";
import { cartoMap } from "./carto-maps";

describe("the planet globe", () => {
  test("every continent sits on the near side where the board paints it, apart from the others", () => {
    for (const c of CONTINENTS) {
      const p = CONTINENT_GLOBE[c.id];
      expect(p).toBeTruthy();
      expect(Math.abs(p.lon)).toBeLessThan(90);
      for (const o of CONTINENTS) if (o !== c) expect(angleBetween(p, CONTINENT_GLOBE[o.id])).toBeGreaterThan(8);
    }
    // the board's centre is latitude 0, longitude 0
    const centre = boardToLatLon(345, 365)!;
    expect(Math.abs(centre.lat) + Math.abs(centre.lon)).toBeLessThan(1e-6);
  });
  test("a point on the sphere round-trips, and a tap on a continent's icon picks it", () => {
    for (const c of CONTINENTS) {
      const p = CONTINENT_GLOBE[c.id], [x, y, z] = latLonToVec(p.lat, p.lon), q = vecToLatLon(x, y, z);
      expect(Math.abs(q.lat - p.lat) + Math.abs(q.lon - p.lon)).toBeLessThan(1e-6);
      expect(continentAt({ lat: p.lat + 1, lon: p.lon - 1 })).toBe(c.id);
    }
    expect(continentAt({ lat: -20, lon: 175 })).toBeNull(); // the far side's open ocean
  });
  test("every ocean is named on the globe; every playable continent opens real street maps", () => {
    for (const o of OCEANS) expect(OCEAN_GLOBE[o.id]).toBeTruthy();
    for (const c of CONTINENTS) {
      for (const id of CONTINENT_MAPS[c.id]) expect(cartoMap(id)).toBeTruthy();
      if (c.tier !== "BACKDROP") expect(`${c.id}:${CONTINENT_MAPS[c.id].length > 0}`).toBe(`${c.id}:true`);
    }
  });
});
