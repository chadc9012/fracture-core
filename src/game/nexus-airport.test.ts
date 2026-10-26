import { describe, expect, it } from "bun:test";
import { AIRPORT, airportDeck, airportPoint } from "./nexus-airport";
import { heightAt, WATER_LEVEL } from "./terrain";
import { distanceToRoad } from "./lanes";
import { REGIONS } from "./world";
const NEX = REGIONS.find((r) => r.id === "nexus")!;

describe("Nexus Airport", () => {
  const deck = airportDeck(heightAt);
  it("the flat top stands above the ground everywhere on it, and over dry land", () => {
    const half = AIRPORT.length / 2 - AIRPORT.ramp;
    for (let s = -half; s <= half; s += 8) for (let t = -AIRPORT.width / 2; t <= AIRPORT.width / 2; t += 6) {
      const p = airportPoint(s, t), g = heightAt(p.x, p.z);
      expect(deck.top).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(WATER_LEVEL);
    }
  });
  it("keeps clear of downtown and the supply roads", () => {
    for (let s = -AIRPORT.length / 2; s <= AIRPORT.length / 2; s += 10) for (const t of [-AIRPORT.width / 2, 0, AIRPORT.width / 2]) {
      const p = airportPoint(s, t);
      expect(Math.hypot(p.x - NEX.x, p.z - NEX.z)).toBeGreaterThan(105);
      expect(distanceToRoad(p.x, p.z)).toBeGreaterThan(8);
    }
  });
  it("the ramps are drivable (no steeper than 1 in 3)", () => { expect((deck.top - deck.base) / AIRPORT.ramp).toBeLessThan(0.34); });
});
