// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { WORKOUT_BUFF, WORKOUT_SECONDS, newsHeadline, nextStation, workOut, workoutKey } from "./apartment-actions";
import { RADIO_STATIONS } from "./radio-stations";

const DAY = 86_400_000, now = 20_000 * DAY + 3_600_000;
describe("Apartment 1204's spots", () => {
  it("a workout gives the armour buff once a day, and again the next day", () => {
    const r = workOut({ earnedRewards: [] }, {}, now);
    if ("error" in r) throw new Error(r.error);
    expect(r.buffs[WORKOUT_BUFF]!.until).toBe(now + WORKOUT_SECONDS * 1000);
    expect(r.progression.earnedRewards).toEqual([workoutKey(20_000)]);
    expect("error" in workOut(r.progression, r.buffs, now + 1000)).toBe(true);
    expect("error" in workOut(r.progression, r.buffs, now + DAY)).toBe(false);
  });
  it("a workout never shortens a longer buff already running", () => {
    const r = workOut({ earnedRewards: [] }, { [WORKOUT_BUFF]: { stacks: 2, until: now + 3_000_000 } }, now);
    if ("error" in r) throw new Error(r.error);
    expect(r.buffs[WORKOUT_BUFF]).toEqual({ stacks: 2, until: now + 3_000_000 });
  });
  it("the radio steps through the playlist and every station, then wraps", () => {
    const seen: string[] = []; let s: Parameters<typeof nextStation>[0] = "playlist";
    for (let i = 0; i <= Object.keys(RADIO_STATIONS).length; i++) { s = nextStation(s).source; seen.push(s); }
    expect(seen.at(-1)).toBe("playlist");
    expect(new Set(seen).size).toBe(Object.keys(RADIO_STATIONS).length + 1);
  });
  it("the news has a headline and reports the player's operations", () => {
    expect(newsHeadline({ level: 1, completedMissions: [] }, now).ticker).toContain("No Operator activity");
    expect(newsHeadline({ level: 7, completedMissions: ["a", "b"] }, now).ticker).toContain("2 operations");
    expect(newsHeadline({ level: 1, completedMissions: [] }, now).headline.length).toBeGreaterThan(10);
  });
});
