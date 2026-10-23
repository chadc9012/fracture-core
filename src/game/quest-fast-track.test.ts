import { describe, expect, test } from "bun:test";
import { DEFAULT_PROGRESSION } from "./progression";
import { QUESTS, finishActiveQuest } from "./quests";

describe("dev quest fast-track", () => {
  test("finishing the active quest completes it once and moves to the next", () => {
    const p = { ...structuredClone(DEFAULT_PROGRESSION), activeQuestId: "fd-02" };
    const next = finishActiveQuest(p);
    expect(next.completedMissions).toContain("fd-02");
    expect(next.activeQuestId).toBe(QUESTS["fd-02"]!.nextQuestId);
    expect(next.fractureShards).toBeGreaterThan(p.fractureShards);
  });
});
