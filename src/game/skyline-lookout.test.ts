import { describe, expect, test } from "bun:test";
import { LEDGE, fissures, lookoutDeck, skylineLookout } from "./skyline-lookout";
import { NEXUS } from "./nexus-districts";
import { heightAt, walkHeight } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { clearDecks, registerDeck } from "./district-decks";

describe("skyline lookout", () => {
  const l = skylineLookout();
  test("exists, outside the city, off the roads, on ground that falls away toward Nexus", () => {
    expect(l).not.toBeNull();
    const d = Math.hypot(l!.x - NEXUS.x, l!.z - NEXUS.z);
    expect(d).toBeGreaterThan(NEXUS.radius);
    expect(distanceToRoad(l!.x, l!.z)).toBeGreaterThan(LANE_HALF_WIDTH + 5);
    expect(l!.y).toBeGreaterThan(heightAt(NEXUS.x, NEXUS.z));
    expect(heightAt(l!.x + l!.dirX * 30, l!.z + l!.dirZ * 30)).toBeLessThan(l!.y);
  });
  test("faces the city and its top is walkable ground", () => {
    const toCity = Math.atan2(NEXUS.z - l!.z, NEXUS.x - l!.x), facing = Math.atan2(l!.dirZ, l!.dirX);
    expect(Math.abs(Math.atan2(Math.sin(toCity - facing), Math.cos(toCity - facing)))).toBeLessThan(0.05);
    clearDecks();
    const deck = lookoutDeck(l!);
    registerDeck(deck);
    const tipX = l!.x + l!.dirX * LEDGE.length * 0.7, tipZ = l!.z + l!.dirZ * LEDGE.length * 0.7;
    expect(walkHeight(tipX, tipZ)).toBeGreaterThanOrEqual(deck.top - 1e-6);
    clearDecks();
  });
  test("fissures stay on the ledge", () => {
    for (const f of fissures()) for (const [al, ac] of [f.a, f.b]) {
      expect(Math.abs(al)).toBeLessThanOrEqual(LEDGE.length / 2);
      expect(Math.abs(ac)).toBeLessThanOrEqual(LEDGE.width / 2);
    }
  });
});
