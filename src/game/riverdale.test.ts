// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { RIVERDALE, boardwalk, boardwalkDeck, riverside, townBoxes, townLevel, townWalls } from "./riverdale";
import { heightAt, WATER_LEVEL } from "./terrain";
import { residences, footprint } from "./residences";
import { deeds } from "./residence-deeds";
import { worldAt } from "./planet";
import { borderDistance, STRAIT_CLEAR } from "./continent-borders";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { deckHeight } from "./district-decks";
import { landmarkById } from "./landmarks";

describe("Riverdale, Aetheria's river town", () => {
  it("stands in Aetheria on the Verdant landmass, well back from the sea between continents", () => {
    expect(worldAt(RIVERDALE.x, RIVERDALE.z)).toBe("aetheria");
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = RIVERDALE.x + Math.cos(a) * (RIVERDALE.r + RIVERDALE.fade), z = RIVERDALE.z + Math.sin(a) * (RIVERDALE.r + RIVERDALE.fade);
      expect(borderDistance(x, z)).toBeGreaterThan(STRAIT_CLEAR + 16);
    }
    expect(landmarkById("riverdale")).toBeTruthy();
  });
  it("its ground is graded level and dry", () => {
    const L = townLevel();
    expect(L).toBeGreaterThan(WATER_LEVEL + 2);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) for (const d of [0, 20, 40, RIVERDALE.r - 2]) {
      expect(Math.abs(heightAt(RIVERDALE.x + Math.cos(a) * d, RIVERDALE.z + Math.sin(a) * d) - L)).toBeLessThan(0.5);
    }
  });
  it("has streets of walk-in homes round the square, each a deed for sale, none on the square or a road", () => {
    const homes = residences().filter((r) => r.city === "riverdale");
    expect(homes.length).toBeGreaterThanOrEqual(6);
    for (const h of homes) {
      const f = footprint(h);
      expect(Math.hypot(h.x - RIVERDALE.x, h.z - RIVERDALE.z) - Math.max(f.hx, f.hz)).toBeGreaterThan(RIVERDALE.square);
      expect(distanceToRoad(h.x, h.z)).toBeGreaterThan(LANE_HALF_WIDTH);
    }
    const ds = deeds().filter((d) => d.city === "Riverdale");
    expect(ds.length).toBe(homes.length);
    expect(new Set(ds.map((d) => d.address)).size).toBe(ds.length);
  });
  it("the boardwalk runs level from the town to a jetty over the river", () => {
    const r = riverside(), b = boardwalk(), deck = boardwalkDeck();
    expect(r.dist).toBeGreaterThan(RIVERDALE.r);
    expect(b.end).toBeGreaterThan(r.dist);
    const end = { x: RIVERDALE.x + b.dirX * (b.end - 1), z: RIVERDALE.z + b.dirZ * (b.end - 1) };
    expect(heightAt(end.x, end.z)).toBeLessThan(b.y);
    expect(deckHeight(deck, end.x, end.z)).toBeCloseTo(b.y, 3);
    const start = { x: RIVERDALE.x + b.dirX * (b.start + 1), z: RIVERDALE.z + b.dirZ * (b.start + 1) };
    expect(Math.abs(deckHeight(deck, start.x, start.z) - heightAt(start.x, start.z))).toBeLessThan(0.6);
  });
  it("has its clock tower, lamps and sign, and the tower and rails are solid", () => {
    expect(townBoxes().length).toBeGreaterThan(40);
    expect(townWalls().length).toBeGreaterThanOrEqual(8);
  });
});
