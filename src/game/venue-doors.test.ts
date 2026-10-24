import { describe, expect, test } from "bun:test";
import { VENUE_INTERIORS } from "./venue-doors";
import { INTERIORS, isInteriorOpen, doorAt } from "./interiors";
import { VENUES, VENUE_EVENTS, VIP_VISITS, inHours, isVip, recordVenueVisit, venueDialogue, venueEvent, venueOpen, venueStanding, venueVisitKey } from "./nightlife";
import { neonTowersWorld, TOWER_FOOTPRINT } from "./neon-layout";
import { neonKeepOut } from "./residences";
import { venueLots } from "./nightlife";
import { DOOR_RADIUS } from "./interiors";

const at = (h: number) => h / 24;

describe("nightlife venues are walk-in rooms with hours", () => {
  test("every venue has one registered door, on its red carpet, clear of every tower", () => {
    expect(VENUE_INTERIORS.length).toBe(VENUES.length);
    for (const v of VENUE_INTERIORS) expect(INTERIORS.filter((i) => i.id === v.id).length).toBe(1);
    const towers = neonTowersWorld(neonKeepOut()), lots = venueLots(towers);
    for (const d of VENUE_INTERIORS) {
      const lot = lots.find((l) => `venue-${l.venue.id}` === d.id)!;
      expect(Math.hypot(d.doorPos.x - lot.x, d.doorPos.z - lot.z)).toBeLessThan(14);
      for (const t of towers) {
        if (t === lot.tower) continue;
        const [hx, hz] = TOWER_FOOTPRINT[t.variant];
        expect(Math.abs(d.doorPos.x - t.x) < hx && Math.abs(d.doorPos.z - t.z) < hz).toBe(false);
      }
    }
  });
  test("doors keep the tower layout unchanged (venue doors are not keep-outs)", () => {
    expect(neonKeepOut().some((k) => VENUE_INTERIORS.some((v) => v.doorPos.x === k.x && v.doorPos.z === k.z))).toBe(false);
  });
  test("clubs open at night and close by dawn; the casino never closes", () => {
    const club = VENUE_INTERIORS.find((v) => v.venueId === "pulse-array")!, casino = VENUE_INTERIORS.find((v) => v.venueId === "crown-casino")!;
    expect(isInteriorOpen(club, at(23))).toBe(true); expect(isInteriorOpen(club, at(2))).toBe(true); expect(isInteriorOpen(club, at(14))).toBe(false);
    expect(isInteriorOpen(casino, at(14))).toBe(true);
    expect(venueOpen("pulse-array", 3.5)).toBe(true); expect(inHours(22, 0, 23)).toBe(true); expect(inHours(22, 0, 1)).toBe(false);
    const d = club.doorPos;
    expect(doorAt(d.x, d.z, (i) => i.kind !== "VENUE" || isInteriorOpen(i, at(14)))?.id ?? null).not.toBe(club.id);
    expect(doorAt(d.x, d.z)?.id).toBe(club.id);
    expect(DOOR_RADIUS).toBeGreaterThan(0);
  });
  test("events run on schedule, across midnight", () => {
    for (const e of VENUE_EVENTS) expect(VENUES.some((v) => v.id === e.venue)).toBe(true);
    expect(venueEvent("pulse-array", 0.5)?.id).toBe("pulse-overdrive");
    expect(venueEvent("pulse-array", 21)).toBeNull();
  });
  test("standing counts nights visited, once per day, and VIP after enough nights", () => {
    let p = { earnedRewards: [] as string[] };
    p = recordVenueVisit(p, "afterglow", Date.UTC(2026, 9, 1, 22));
    const same = recordVenueVisit(p, "afterglow", Date.UTC(2026, 9, 1, 23));
    expect(same).toBe(p);
    for (let d = 2; d <= VIP_VISITS; d++) p = recordVenueVisit(p, "afterglow", Date.UTC(2026, 9, d, 22));
    expect(venueStanding(p, "afterglow")).toBe(VIP_VISITS);
    expect(isVip(p, "afterglow")).toBe(true); expect(isVip(p, "pulse-array")).toBe(false);
    expect(p.earnedRewards).toContain(venueVisitKey("afterglow", "2026-10-01"));
  });
  test("the host greets newcomers, regulars and VIPs differently and mentions tonight's event", () => {
    const a = venueDialogue("afterglow", 0, 12).map((l) => l.text).join(), b = venueDialogue("afterglow", 3, 12).map((l) => l.text).join(), c = venueDialogue("afterglow", VIP_VISITS, 12).map((l) => l.text).join();
    expect(new Set([a, b, c]).size).toBe(3);
    expect(venueDialogue("afterglow", 0, 4).some((l) => l.text.includes("Sunrise Session"))).toBe(true);
  });
});
