import { describe, expect, it } from "vitest";
import { RECAP_AFTER_MS, nextActivity, recapDue, repeatRewardFactor } from "./retention";

describe("retention rules", () => {
  it("first-ever clear pays 1.5x", () => expect(repeatRewardFactor(0, true)).toBe(1.5));
  it("first 10 repeat runs pay full", () => expect(repeatRewardFactor(9, false)).toBe(1));
  it("repeat rewards never drop below 25%", () => expect(repeatRewardFactor(100, false)).toBe(0.25));
  it("recap plays after 3 days away", () => expect(recapDue(new Date(0).toISOString(), RECAP_AFTER_MS)).toBe(true));
  it("no recap after a short break", () => expect(recapDue(new Date(0).toISOString(), 1000)).toBe(false));
  it("next activity is the first unfinished chapter", () => expect(nextActivity({ completedMissions: ["mission-01"] }).title).toBe("Awakening"));
});
