// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { advanceMission, SOLAR_ARRAY, MIRRORS, HEADINGS, alignProgress, arraySite, mirrorStart, misalignment, rotateMirror, targetHeading } from "./solar-array";
import { missionSuite } from "./mission-suite";
import { REGIONS } from "../world";

missionSuite("Solar Array Alpha state machine", {
  id: "solar-array", advance: advanceMission as never, initial: SOLAR_ARRAY, payState: "WORLD_UPDATE", questId: "fd-08", materials: { anomalyCarbon: 2, dataShards: 2 },
  script: [
    [{ type: "START" }, "TRIGGERED"], [{ type: "ANCHOR", x: 3, z: 4 }, "CROSSING"], [{ type: "ARRIVED" }, "COMBAT_1"], [{ type: "CLEAR" }, "REALIGNING"],
    [{ type: "HACK", progress: 100 }, "BOSS"], [{ type: "CLEAR" }, "COMPLETE"], [{ type: "ACK" }, "WORLD_UPDATE"],
  ],
});

describe("Solar Array Alpha — placement and mirrors", () => {
  test("the array sits inside Solara", () => {
    const solara = REGIONS.find((r) => r.id === "solara")!;
    const a = arraySite(solara);
    expect(Math.hypot(a.x - solara.x, a.z - solara.z)).toBeLessThan(solara.radius * 0.6);
  });
  test("mirrors never start aligned and every mirror can be rotated onto its target", () => {
    for (let seed = 0; seed < 40; seed++) {
      let s = mirrorStart(seed);
      expect(alignProgress(s)).toBe(0);
      for (let m = 0; m < MIRRORS; m++) {
        expect(misalignment(s, seed, m)).toBeGreaterThan(0);
        for (let i = 0; i < HEADINGS && !s.locked[m]; i++) s = rotateMirror(s, seed, m, 1);
        expect(s.heading[m]).toBe(targetHeading(seed, m));
      }
      expect(alignProgress(s)).toBe(100);
      expect(rotateMirror(s, seed, 0, -1)).toBe(s); // locked mirrors ignore input
    }
  });
  test("rotating both ways wraps around", () => {
    const s = mirrorStart(5);
    const back = rotateMirror(rotateMirror(s, 5, 1, 1), 5, 1, -1);
    if (!back.locked[1]) expect(back.heading[1]).toBe(s.heading[1]);
  });
});
