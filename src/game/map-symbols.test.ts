import { describe, expect, test } from "bun:test";
import { LANDMARKS } from "./landmarks";
import { LANDMARK_GLYPH, LANDMARK_NAME, MARKER_GLYPH, MARKER_NAME, legendLandmarkTypes } from "./map-symbols";

describe("map symbols", () => {
  test("every landmark in the data has a glyph and a legend name", () => {
    for (const l of LANDMARKS) { expect(LANDMARK_GLYPH[l.type]).toBeTruthy(); expect(LANDMARK_NAME[l.type]).toBeTruthy(); }
  });
  test("legend lists exactly the landmark types the world uses", () => {
    const used = [...new Set(LANDMARKS.map((l) => l.type))];
    expect(legendLandmarkTypes(used).sort()).toEqual([...used].sort());
  });
  test("no two symbols mean different things", () => {
    const markers = Object.values(MARKER_GLYPH);
    expect(new Set(markers).size).toBe(markers.length);
    expect(LANDMARK_GLYPH.ruin).not.toBe(MARKER_GLYPH.RUIN);
    for (const k of Object.keys(MARKER_GLYPH) as (keyof typeof MARKER_GLYPH)[]) expect(MARKER_NAME[k]).toBeTruthy();
  });
});
