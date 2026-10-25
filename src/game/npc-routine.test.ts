// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { npcPosition, onDuty, restSpot, REST_DISTANCE } from "./npc-routine";
import { LIVING_NPCS, npcWorld } from "./living-npcs";

describe("living NPC routine", () => {
  it("works 05:00-22:00, rests overnight, and always works with no clock", () => {
    expect(onDuty(5)).toBe(true);
    expect(onDuty(21.9)).toBe(true);
    expect(onDuty(22)).toBe(false);
    expect(onDuty(0)).toBe(false);
    expect(onDuty(4.9)).toBe(false);
    expect(onDuty(null)).toBe(true);
    expect(onDuty(Number.NaN)).toBe(true);
  });
  it("on duty everyone stands exactly where npcWorld says", () => {
    for (const n of LIVING_NPCS) expect(npcPosition(n, 12)).toMatchObject({ ...npcWorld(n), onDuty: true });
    for (const n of LIVING_NPCS) expect(npcPosition(n, null)).toMatchObject(npcWorld(n));
  });
  it("overnight each NPC rests a short walk from the post, toward the centre, and the spot is stable", () => {
    for (const n of LIVING_NPCS) {
      const day = npcWorld(n), night = npcPosition(n, 2);
      const moved = Math.hypot(night.x - day.x, night.z - day.z);
      expect(night.onDuty).toBe(false);
      expect(moved).toBeGreaterThan(1);
      expect(moved).toBeLessThanOrEqual(REST_DISTANCE + 2.5);
      expect(restSpot(n)).toEqual(restSpot(n));
    }
  });
  it("rest spots never stack two NPCs on the same spot", () => {
    const spots = LIVING_NPCS.map((n) => npcPosition(n, 2));
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.z - spots[j]!.z)).toBeGreaterThan(1.2);
  });
});
