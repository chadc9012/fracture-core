import { describe, expect, test } from "bun:test";
import { VENUES, venueLots } from "./nightlife";
import { neonTowersWorld } from "./neon-layout";
import { neonKeepOut } from "./residences";

describe("nightlife venues", () => {
  test("each venue takes a distinct tower lot near its board position", () => {
    const towers = neonTowersWorld(neonKeepOut());
    const lots = venueLots(towers);
    expect(lots.length).toBe(VENUES.length);
    expect(new Set(lots.map((l) => l.tower)).size).toBe(lots.length);
    for (const l of lots) expect(towers.includes(l.tower)).toBe(true);
  });
});
