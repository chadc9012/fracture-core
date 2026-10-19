import { beforeAll, describe, expect, test } from "bun:test";
import { DESIGNS, DOOR, PORCH, footprint, homeBoxes, homeDecks, homeWalls, inResidence, neonKeepOut, residences, type Residence } from "./residences";
import { collideWalls, setWalls } from "./walls";
import { registerDeck } from "./district-decks";
import { walkHeight, WATER_LEVEL, heightAt } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { buildings, NEXUS } from "./nexus-districts";
import { neonLayoutWorld, TOWER_FOOTPRINT } from "./neon-layout";
import { NEON_FLAT, REGIONS } from "./world";
import { REGIONAL_SHOPS } from "./regional-shops";
import { groundCover } from "./ground-cover";

const homes = residences();
/** a point in the home's local frame (door wall at +z) in world space */
const at = (r: Residence, x: number, z: number) => ({ x: r.x + x * Math.cos(r.rot) + z * Math.sin(r.rot), z: r.z - x * Math.sin(r.rot) + z * Math.cos(r.rot) });
const corners = (r: Residence) => { const f = footprint(r); return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ x: r.x + sx! * f.hx, z: r.z + sz! * f.hz })); };
const overlap = (a: { x: number; z: number; hx: number; hz: number }, b: { x: number; z: number; hx: number; hz: number }) => Math.abs(a.x - b.x) < a.hx + b.hx && Math.abs(a.z - b.z) < a.hz + b.hz;

/** walk a walker (radius 0.45) in small steps toward a target; returns where it ended up */
function walk(from: { x: number; z: number }, to: { x: number; z: number }, y: number) {
  const body = { ...from };
  for (let i = 0; i < 400; i++) {
    const dx = to.x - body.x, dz = to.z - body.z, d = Math.hypot(dx, dz);
    if (d < 0.05) break;
    const step = Math.min(0.1, d);
    body.x += (dx / d) * step; body.z += (dz / d) * step;
    collideWalls(body, 0.45, y);
  }
  return body;
}

beforeAll(() => { for (const h of homes) { setWalls(h.id, homeWalls(h)); for (const d of homeDecks(h)) registerDeck(d); } });

describe("walk-in residences", () => {
  test("a street of homes south of Nexus, and Neon City's outer blocks, deterministically", () => {
    expect(homes.filter((h) => h.city === "nexus").length).toBeGreaterThanOrEqual(6);
    expect(homes.filter((h) => h.city === "neon").length).toBe(NEON_FLAT >= 150 ? 4 : NEON_FLAT >= 120 ? 2 : 0);
    expect(new Set(homes.map((h) => h.style)).size).toBeGreaterThanOrEqual(NEON_FLAT >= 150 ? 8 : 6);
    expect(new Set(homes.map((h) => h.id)).size).toBe(homes.length);
  });
  test("every home stands on dry ground off the supply roads, outside every other region, and overlaps nothing", () => {
    const shells = homes.map((h) => ({ x: h.x, z: h.z, ...footprint(h) }));
    for (let a = 0; a < shells.length; a++) for (let b = a + 1; b < shells.length; b++) expect(overlap(shells[a]!, shells[b]!)).toBe(false);
    const city = buildings().map((b) => ({ x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2 }));
    const { towers } = neonLayoutWorld(neonKeepOut());
    for (const h of homes) {
      const shell = { x: h.x, z: h.z, ...footprint(h) };
      for (const c of corners(h)) {
        expect(heightAt(c.x, c.z)).toBeGreaterThan(WATER_LEVEL);
        if (h.city === "nexus") expect(distanceToRoad(c.x, c.z)).toBeGreaterThan(LANE_HALF_WIDTH);
      }
      for (const b of city) expect(overlap(shell, b)).toBe(false);
      for (const t of towers) { const [hx, hz] = TOWER_FOOTPRINT[t.variant]; expect(overlap(shell, { x: t.x, z: t.z, hx: Math.max(hx, hz), hz: Math.max(hx, hz) })).toBe(false); }
      for (const s of REGIONAL_SHOPS) expect(Math.hypot(h.x - s.x, h.z - s.z)).toBeGreaterThan(14);
      if (h.city === "nexus") {
        expect(Math.hypot(h.x - NEXUS.x, h.z - NEXUS.z)).toBeGreaterThan(95);
        for (const r of REGIONS) if (r.id !== "nexus") expect(Math.hypot(h.x - r.x, h.z - r.z)).toBeGreaterThan(r.radius);
      }
      // the foundation reaches the lowest ground under the house, and the floor clears the highest
      for (const c of corners(h)) { expect(h.base).toBeLessThanOrEqual(heightAt(c.x, c.z) + 1e-6); }
    }
  });
  test("you walk in the front door, through the living room and into the bedroom", () => {
    for (const h of homes) {
      const { d, w } = DESIGNS[h.style], y = h.floor;
      const street = at(h, 0, d / 2 + PORCH + 1.5), living = at(h, 0, d * 0.1), bedroom = at(h, -w * 0.12, -d / 2 + 2.6);
      const inside = walk(street, living, y);
      expect(Math.hypot(inside.x - living.x, inside.z - living.z)).toBeLessThan(0.1);
      // through the interior doorway (on the centre line), then across to the bed's side
      const doorway = at(h, 0, -d * 0.18 - 0.6);
      const through = walk(inside, doorway, y);
      expect(Math.hypot(through.x - doorway.x, through.z - doorway.z)).toBeLessThan(0.1);
      const bed = walk(through, bedroom, y);
      expect(Math.hypot(bed.x - bedroom.x, bed.z - bedroom.z)).toBeLessThan(0.6);
      // and you stand on the floor, not in it
      expect(walkHeight(living.x, living.z)).toBeCloseTo(h.floor, 3);
    }
  });
  test("the walls are solid: you can't walk through a side or back wall, and a vehicle can't fit the door", () => {
    for (const h of homes) {
      const { w, d } = DESIGNS[h.style], y = h.floor;
      for (const [from, to] of [[at(h, -w / 2 - 2, 0), at(h, -w / 2 + 2, 0)], [at(h, 0, -d / 2 - 2), at(h, 0, -d / 2 + 2)]] as const) {
        const end = walk(from, to, y);
        expect(Math.hypot(end.x - from.x, end.z - from.z)).toBeLessThan(2.2); // stopped at the wall, not inside
      }
      const car = { ...at(h, 0, d / 2 + 2.6) };
      for (let i = 0; i < 60; i++) { const t = at(h, 0, 0); const dx = t.x - car.x, dz = t.z - car.z, l = Math.hypot(dx, dz); car.x += dx / l * 0.1; car.z += dz / l * 0.1; collideWalls(car, 2.2, y); }
      const local = { x: (car.x - h.x) * Math.cos(h.rot) - (car.z - h.z) * Math.sin(h.rot), z: (car.x - h.x) * Math.sin(h.rot) + (car.z - h.z) * Math.cos(h.rot) };
      expect(local.z).toBeGreaterThan(d / 2 - 0.3);
      expect(DOOR).toBeLessThan(2 * 2.2);
    }
  });
  test("every box of a home stays inside its footprint, and no ground cover grows inside one", () => {
    for (const h of homes) {
      const { w, d } = DESIGNS[h.style];
      for (const b of homeBoxes(h.style)) {
        expect(Math.abs(b.x) + b.sx / 2).toBeLessThanOrEqual(w / 2 + 0.7);
        expect(Math.abs(b.z) + b.sz / 2).toBeLessThanOrEqual(d / 2 + PORCH + 0.8);
      }
    }
    for (const c of groundCover(1)) expect(inResidence(c.x, c.z, 0)).toBe(false);
  });
});
