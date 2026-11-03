import { describe, expect, it } from "bun:test";
import { inForestCalibration, resumeSpot, validSpot } from "./resume-spot";
import { DESCENT_ORIGIN } from "./fracture-gates";

const home = { x: 60, z: -270 };
const done = { tutorialComplete: true, tutorialRun: null, completedMissions: ["mission-01"] };
describe("resume spot", () => {
  it("a save past the opening comes back where it last stood, else outside the Residences (never the forest spawn)", () => {
    expect(resumeSpot(done, { x: 300, z: 120 }, home)).toEqual({ x: 300, z: 120 });
    expect(resumeSpot(done, null, home)).toEqual(home);
  });
  it("a save part-way through the old forest calibration keeps the forest", () => {
    const mid = { tutorialComplete: false, tutorialRun: { step: "MOVEMENT" }, completedMissions: [] };
    expect(inForestCalibration(mid)).toBe(true);
    expect(resumeSpot(mid, { x: 300, z: 120 }, home)).toBeNull();
  });
  it("never remembers a spot outside the walkable world (descents, NaN)", () => {
    expect(validSpot({ x: DESCENT_ORIGIN.x, z: DESCENT_ORIGIN.z })).toBe(false);
    expect(validSpot({ x: NaN, z: 0 })).toBe(false);
    expect(resumeSpot(done, { x: DESCENT_ORIGIN.x, z: DESCENT_ORIGIN.z }, home)).toEqual(home);
  });
});
