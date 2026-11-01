// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { EVAC_DONE, EVAC_RESCUED, LOBBY, MORNING, MORNING_DONE, RESIDENTS, TRAPPED, finishEvac, getEvac, markMorning, morningDone, rescueNeighbour, residentLine, residentNear, residentPlace, resetEvac, startEvac } from "./residence-life";
import { ATTRIBUTES, attrLevel, attributeLevel, awardAttribute, train, trainingKey } from "./attributes";
import { HOOPS_GREEN_CENTRE, METER_PERIOD, SHOTS, hitWindow, rallyTap, rallyTick, shoot, sportResult, startHoops, startRally, tennisCall, tennisOver, tennisPoint, volleyOver, volleyPoint } from "./sports";

describe("residence life", () => {
  it("the morning finishes once, after every step", () => {
    let p = { earnedRewards: [] as string[] };
    let finished = 0;
    for (const s of MORNING) { const r = markMorning(p, s.id); p = r.progression; if (r.finished) finished++; }
    expect(finished).toBe(1);
    expect(morningDone(p)).toBe(true);
    expect(markMorning(p, "mail").finished).toBe(false);
  });
  it("residents are found near where they stand and cycle their lines", () => {
    resetEvac();
    const ellis = RESIDENTS.find((r) => r.id === "ellis")!;
    expect(residentNear(ellis.floor, ellis.x + 0.5, ellis.z)?.id).toBe("ellis");
    expect(residentNear(ellis.floor, ellis.x + 10, ellis.z + 10)).toBeNull();
    expect(residentLine(ellis, ellis.lines.length)).toBe(ellis.lines[0]);
  });
  it("the evacuation needs the morning, traps Mara, and pays once (more with the rescue)", () => {
    resetEvac();
    expect(startEvac({ earnedRewards: [] }, 0)).toBe(false);
    expect(startEvac({ earnedRewards: [MORNING_DONE] }, 0)).toBe(true);
    const mara = RESIDENTS.find((r) => r.id === "mara")!;
    expect(residentPlace(mara)).toEqual(TRAPPED);
    expect(rescueNeighbour()).toBe(true);
    expect(residentPlace(mara)).toBeNull();
    const r = finishEvac({ earnedRewards: [MORNING_DONE] })!;
    expect(r.rescued).toBe(true);
    expect(r.progression.earnedRewards).toContain(EVAC_DONE);
    expect(r.progression.earnedRewards).toContain(EVAC_RESCUED);
    expect(getEvac().phase).toBe("escaped");
    resetEvac();
    expect(startEvac(r.progression, 0)).toBe(false);
    resetEvac();
  });
  it("when it hits in the lobby, Mara is beside you and runs out with you (not trapped on 11)", () => {
    resetEvac();
    expect(startEvac({ earnedRewards: [MORNING_DONE] }, 0, LOBBY)).toBe(true);
    expect(getEvac().rescued).toBe(true);
    expect(residentPlace(RESIDENTS.find((r) => r.id === "mara")!)).toBeNull();
    expect(finishEvac({ earnedRewards: [MORNING_DONE] })!.rescued).toBe(true);
    resetEvac();
  });
});

describe("attributes", () => {
  it("levels on 50 × level² and reports level ups", () => {
    expect(attrLevel(0).level).toBe(1);
    expect(attrLevel(50).level).toBe(2);
    expect(attrLevel(49).level).toBe(1);
    const r = awardAttribute({ records: {} }, "agility", 60);
    expect(r.levelUp).toBe(2);
    expect(attributeLevel(r.progression, "agility")).toBe(2);
    expect(ATTRIBUTES.length).toBe(4);
  });
  it("training pays once per spot per day", () => {
    const now = 86_400_000 * 100;
    const a = train({ records: {}, earnedRewards: [] }, "gym", now);
    if ("error" in a) throw new Error(a.error);
    expect(a.progression.earnedRewards).toContain(trainingKey("gym", now));
    expect("error" in train(a.progression, "gym", now)).toBe(true);
    expect("error" in train(a.progression, "gym", now + 86_400_000)).toBe(false);
    expect("error" in train(a.progression, "nowhere", now)).toBe(true);
  });
});

describe("court games", () => {
  it("tennis scores 15-30-40, deuce and advantage, first to two games", () => {
    let s = { p: 0, o: 0, gamesP: 0, gamesO: 0 };
    for (let i = 0; i < 3; i++) s = tennisPoint(s, true);
    for (let i = 0; i < 3; i++) s = tennisPoint(s, false);
    expect(tennisCall(s)).toBe("Deuce");
    s = tennisPoint(s, true);
    expect(tennisCall(s)).toBe("Advantage you");
    s = tennisPoint(s, true);
    expect(s.gamesP).toBe(1);
    for (let i = 0; i < 4; i++) s = tennisPoint(s, true);
    expect(tennisOver(s)).toBe(true);
  });
  it("volleyball goes to 15, win by two", () => {
    let s = { p: 14, o: 14 };
    expect(volleyOver(volleyPoint(s, true))).toBe(false);
    s = volleyPoint(volleyPoint(s, true), true);
    expect(volleyOver(s)).toBe(true);
  });
  it("a hit on time returns the ball, a late one loses the point; agility widens the window", () => {
    expect(hitWindow(50)).toBeGreaterThan(hitWindow(1));
    const r = startRally("tennis", 7, 1, 0);
    expect(rallyTap(r, r.dur).phase).toBe("out");
    const late = rallyTap(r, r.dur + 400);
    expect(late.phase).toBe("between");
    expect(late.tennis.o).toBe(1);
    expect(rallyTick(r, r.dur + 1000).tennis.o).toBe(1);
  });
  it("free throws: releasing in the green swishes; ten shots", () => {
    // the meter rises 0..1 over half a period: green centre at 0.92 is at t = 0.46 period
    let h = startHoops(3, 1, 0);
    const t = HOOPS_GREEN_CENTRE * METER_PERIOD / 2;
    h = shoot(h, t);
    expect(h.last).toBe("swish");
    for (let i = 1; i < SHOTS + 2; i++) h = shoot(h, t);
    expect(h.shot).toBe(SHOTS);
    const res = sportResult({ records: {} }, "hoops", h.made, true);
    expect(res.best).toBe(true);
    expect(res.agilityXp).toBe(h.made * 4);
  });
});
