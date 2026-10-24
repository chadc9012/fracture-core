import { describe, expect, test } from "bun:test";
import { CUE_SHAPE, DIRECTOR_CUES, directorCue } from "./director-cues";
import { DESTINATION_PINS } from "./destination-map";

describe("director cues", () => {
  test("every destination has its own voice, unknown ids fall back", () => {
    for (const p of DESTINATION_PINS) expect(DIRECTOR_CUES[p.id]).toBeDefined();
    expect(new Set(Object.values(DIRECTOR_CUES).map((c) => `${c.f0}/${c.wave}`)).size).toBe(Object.keys(DIRECTOR_CUES).length);
    expect(directorCue("nowhere").f0).toBeGreaterThan(0);
  });
  test("opening sweeps up and lasts longer than selecting; back sweeps down", () => {
    expect(CUE_SHAPE.open.dur).toBeGreaterThan(CUE_SHAPE.select.dur);
    expect(CUE_SHAPE.back.up).toBe(-1);
  });
});
