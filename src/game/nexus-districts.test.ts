import { describe, expect, test } from "bun:test";
import { BLOCK, CITY_INNER, CITY_OUTER, NEXUS, blocks, buildings, districtAt, facadeKit, lamps, parkedCars, streetLights } from "./nexus-districts";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { heightAt, WATER_LEVEL } from "./terrain";

describe("Nexus districts", () => {
  test("districts by bearing (north = −z)", () => {
    expect(districtAt(NEXUS.x, NEXUS.z - 50)).toBe("spire");
    expect(districtAt(NEXUS.x + 50, NEXUS.z)).toBe("market");
    expect(districtAt(NEXUS.x - 50, NEXUS.z)).toBe("arcology");
    expect(districtAt(NEXUS.x, NEXUS.z + 50)).toBe("shipyard");
  });
  test("blocks sit in the ring, off roads and water, and never overlap the safe-zone hub", () => {
    const bs = blocks();
    expect(bs.length).toBeGreaterThan(15);
    for (const b of bs) {
      const d = Math.hypot(b.x - NEXUS.x, b.z - NEXUS.z);
      expect(d).toBeGreaterThanOrEqual(CITY_INNER);
      expect(d).toBeLessThanOrEqual(CITY_OUTER);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = b.x + dx! * BLOCK / 2, z = b.z + dz! * BLOCK / 2;
        expect(distanceToRoad(x, z)).toBeGreaterThan(LANE_HALF_WIDTH);
        expect(heightAt(x, z)).toBeGreaterThan(WATER_LEVEL);
      }
    }
  });
  test("buildings stand on their lowest corner and the skyline is tallest in the Spire district", () => {
    const bs = buildings();
    for (const b of bs) {
      expect(b.top).toBeGreaterThan(b.base);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) expect(b.base).toBeLessThanOrEqual(heightAt(b.x + dx! * b.w / 2, b.z + dz! * b.d / 2));
    }
    const avg = (d: string) => { const l = bs.filter((b) => b.district === d); return l.reduce((s, b) => s + b.floors, 0) / Math.max(1, l.length); };
    expect(avg("spire")).toBeGreaterThan(avg("shipyard"));
  });
  test("lamps and parked cars are off the supply roads", () => {
    for (const l of lamps()) expect(distanceToRoad(l.x, l.z)).toBeGreaterThan(LANE_HALF_WIDTH - 3);
    for (const c of parkedCars()) expect(distanceToRoad(c.x, c.z)).toBeGreaterThanOrEqual(LANE_HALF_WIDTH);
  });
});

describe("facade kit", () => {
  const all = buildings;
  test("ledges and fins stay on their building, shopfronts sit at street level, every building has a plinth", () => {
    const bs = all(); const kit = facadeKit(bs);
    expect(kit.plinths.length).toBe(bs.length);
    expect(kit.ledges.length).toBeGreaterThan(20);
    expect(kit.fins.length).toBeGreaterThan(50);
    expect(kit.shopfronts.length).toBeGreaterThan(10);
    for (const l of kit.ledges) expect(bs.some((b) => Math.abs(b.x - l.x) < 0.01 && Math.abs(b.z - l.z) < 0.01 && l.y < b.top)).toBe(true);
    for (const s of kit.shopfronts) { const b = bs.find((k) => Math.abs(k.x - s.x) <= k.w / 2 + 0.2 && Math.abs(k.z - s.z) <= k.d / 2 + 0.2)!; expect(b).toBeTruthy(); expect(s.y - (b.base + 1)).toBeLessThan(3); }
  });
});

describe("facade kit: modular architecture pieces", () => {
  const bs = buildings(); const kit = facadeKit(bs);
  const owner = (x: number, z: number, slack: number) => bs.find((k) => Math.abs(k.x - x) <= k.w / 2 + slack && Math.abs(k.z - z) <= k.d / 2 + slack);
  test("balconies, rails, portals, lobbies and blades all exist and belong to a building", () => {
    for (const list of [kit.balconies, kit.rails, kit.portals, kit.lobbies, kit.blades]) {
      expect(list.length).toBeGreaterThan(10);
      for (const f of list) expect(owner(f.x, f.z, 1.6)).toBeTruthy();
    }
  });
  test("balconies hang on tall-enough residential bodies, below the roof", () => {
    for (const b of kit.balconies) { const o = owner(b.x, b.z, 1.6)!; expect(o.floors).toBeGreaterThanOrEqual(6); expect(b.y).toBeLessThan(o.top); expect(o.style === "concrete" || o.style === "glass").toBe(true); }
    expect(kit.rails.length).toBe(kit.balconies.length);
  });
  test("every lobby entrance is at street level and matches a portal frame", () => {
    expect(kit.lobbies.length).toBe(kit.portals.length);
    kit.lobbies.forEach((l, i) => { const o = owner(l.x, l.z, 1.6)!; expect(l.y - (o.base + 1)).toBeLessThan(2.5); expect(Math.abs(l.x - kit.portals[i]!.x)).toBeLessThan(0.3); });
  });
  test("an entrance never sits on a face that already has a shopfront", () => {
    for (const p of kit.portals) for (const s of kit.shopfronts) {
      const near = Math.abs(p.x - s.x) < 0.3 && Math.abs(p.z - s.z) < 0.3;
      expect(near).toBe(false);
    }
  });
  test("adding architecture left the shopfront layout and the original pieces alone", () => {
    const again = facadeKit(bs);
    expect(again.shopfronts).toEqual(kit.shopfronts);
    expect(again.balconies).toEqual(kit.balconies);
  });
});

describe("street lights", () => {
  test("two per block face on the pavement, never on water or a supply road", () => {
    const ls = streetLights();
    expect(ls.length).toBeGreaterThan(blocks().length * 4);
    for (const l of ls) { expect(heightAt(l.x, l.z)).toBeGreaterThan(WATER_LEVEL); expect(distanceToRoad(l.x, l.z)).toBeGreaterThanOrEqual(LANE_HALF_WIDTH); }
  });
});
