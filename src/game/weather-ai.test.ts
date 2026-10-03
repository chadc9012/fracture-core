import { describe, expect, it } from "bun:test";
import { sampleWeather } from "./weather-cycle";
import { createAi, sightRange, stepAwareness, ALERT_AT } from "./enemy-perception";

describe("weather cycle", () => {
  it("Nexus is always clear", () => {
    for (let t = 0; t < 5; t += 0.1) expect(sampleWeather("nexus", t).state).toBe("CLEAR");
  });
  it("is deterministic", () => {
    expect(sampleWeather("veridan", 1.23)).toEqual(sampleWeather("veridan", 1.23));
  });
});

describe("enemy perception", () => {
  it("night and fog shrink sight range", () => {
    expect(sightRange(1, 1, false)).toBeLessThan(sightRange(0, 1, false));
    expect(sightRange(0, 0.3, false)).toBeLessThan(sightRange(0, 1, false));
  });
  it("patrols when the player is out of range, alerts when seen", () => {
    const ai = createAi(0, 0, 3);
    for (let i = 0; i < 60; i++) stepAwareness(ai, { distance: 200, sight: 85, noise: 0, damaged: false, facing: true }, 200, 0, 0.05);
    expect(ai.state).toBe("PATROL");
    for (let i = 0; i < 60; i++) stepAwareness(ai, { distance: 20, sight: 85, noise: 0, damaged: false, facing: true }, 20, 0, 0.05);
    expect(ai.state).toBe("ALERT");
  });
  it("taking damage alerts instantly", () => {
    const ai = createAi(0, 0, 3);
    stepAwareness(ai, { distance: 200, sight: 85, noise: 0, damaged: true, facing: false }, 5, 5, 0.1);
    expect(ai.awareness).toBeGreaterThanOrEqual(ALERT_AT);
    expect(ai.state).toBe("ALERT");
  });
  it("searches after losing the player", () => {
    const ai = createAi(0, 0, 3);
    stepAwareness(ai, { distance: 10, sight: 85, noise: 0, damaged: true, facing: true }, 10, 0, 0.1);
    for (let i = 0; i < 40; i++) stepAwareness(ai, { distance: 300, sight: 85, noise: 0, damaged: false, facing: false }, 300, 0, 0.1);
    expect(ai.state).toBe("SEARCH");
    expect(ai.lastX).toBe(10);
  });
});
