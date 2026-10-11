// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { endingTierFor } from "./endings";
import { EMPTY_STORY } from "./story";

describe("ending selection", () => {
  test("the Core Node allegiance decides the ending, whatever the corruption", () => {
    expect(endingTierFor({ corruptionLevel: 90, story: { ...EMPTY_STORY, choices: { faction: "controllers" } } })).toBe("CONTROL");
    expect(endingTierFor({ corruptionLevel: 5, story: { ...EMPTY_STORY, choices: { faction: "breakers" } } })).toBe("CHAOS");
    expect(endingTierFor({ corruptionLevel: 90, story: { ...EMPTY_STORY, choices: { faction: "resonants" } } })).toBe("BALANCE");
  });
  test("without an allegiance the old corruption rule still applies", () => {
    expect(endingTierFor({ corruptionLevel: 10, story: EMPTY_STORY })).toBe("CONTROL");
    expect(endingTierFor({ corruptionLevel: 50, story: EMPTY_STORY })).toBe("BALANCE");
    expect(endingTierFor({ corruptionLevel: 80, story: { ...EMPTY_STORY, choices: { faction: "nonsense" } } })).toBe("CHAOS");
  });
});

import { aftermathFor } from "./endings";
describe("aftermath", () => {
  test("no allegiance, no aftermath", () => { expect(aftermathFor({ story: EMPTY_STORY })).toEqual([]); });
  test("the side and NOVA's trust both show", () => {
    const close = aftermathFor({ story: { ...EMPTY_STORY, choices: { faction: "resonants" }, trust: { nova: 15 } } });
    expect(close[0]).toContain("Resonants");
    expect(close[1]).toContain("NOVA stays");
    const cold = aftermathFor({ story: { ...EMPTY_STORY, choices: { faction: "breakers" }, trust: { nova: 0 } } });
    expect(cold[1]).toContain("goes quiet");
    const neutral = aftermathFor({ story: { ...EMPTY_STORY, choices: { faction: "controllers" } } });
    expect(neutral[1]).toContain("thank you");
  });
});
