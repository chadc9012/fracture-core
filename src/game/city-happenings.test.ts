import { describe, expect, test } from "bun:test";
import { HAPPENINGS, activeHappenings, attend, attendance, happeningAt, happeningFor, hasAttended, isOn } from "./city-happenings";
import { DISTRICTS } from "./living-world";

const at = (day: number, hour: number) => day + hour / 24;
describe("city happenings", () => {
  test("the lineup is deterministic per day and varies between days and districts", () => {
    for (const d of DISTRICTS) expect(happeningFor(d.id, 3)).toBe(happeningFor(d.id, 3));
    const kinds = new Set(DISTRICTS.flatMap((d) => [0, 1, 2, 3, 4, 5].map((day) => happeningFor(d.id, day).kind)));
    expect(kinds.size).toBe(Object.keys(HAPPENINGS).length);
  });
  test("they run in their hours only", () => {
    expect(isOn(HAPPENINGS.market, at(1, 12))).toBe(true);
    expect(isOn(HAPPENINGS.market, at(1, 3))).toBe(false);
    expect(isOn(HAPPENINGS.carmeet, at(1, 23.5))).toBe(true);
    expect(activeHappenings(at(2, 4))).toEqual([]);
    expect(activeHappenings(at(2, 13)).length).toBeGreaterThan(0);
  });
  test("standing at a district during its happening finds it; far away or off-hours does not", () => {
    const live = activeHappenings(at(2, 13))[0]!;
    expect(happeningAt(live.district.x, live.district.z, at(2, 13))?.district.id).toBe(live.district.id);
    expect(happeningAt(live.district.x + 5000, live.district.z, at(2, 13))).toBeNull();
    expect(happeningAt(live.district.x, live.district.z, at(2, 4))).toBeNull();
  });
  test("attending counts once per district per day, then again on a new day", () => {
    const live = activeHappenings(at(2, 13))[0]!;
    const p0 = { earnedRewards: [] as string[] };
    const a = attend(p0, live, "2026-10-25");
    expect(a.rep).toBe(1); expect(a.faction).toBe(live.district.faction); expect(hasAttended(a.progression, live.district.id, "2026-10-25")).toBe(true);
    expect(attend(a.progression, live, "2026-10-25").rep).toBe(0);
    expect(attend(a.progression, live, "2026-10-26").rep).toBe(1);
    expect(attendance(a.progression)).toBe(1);
  });
});
