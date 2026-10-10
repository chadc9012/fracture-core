// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it, mock } from "bun:test";

// cloud-save.ts imports the Supabase client; the merge itself is pure, so stub the client out.
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { mergeProgression } = await import("./cloud-save");
const { DEFAULT_PROGRESSION } = await import("./progression");
const { FIRST_TUTORIAL } = await import("./onboarding");
const { shouldPlayIntro } = await import("./session-restore");

describe("mergeProgression onboarding fields", () => {
  it("keeps the furthest tutorial checkpoint regardless of which copy is newer", () => {
    const local = { ...DEFAULT_PROGRESSION, tutorialRun: { ...FIRST_TUTORIAL, step: "MOVEMENT" as const } };
    const cloud = { ...DEFAULT_PROGRESSION, tutorialRun: { ...FIRST_TUTORIAL, step: "CHAMBER" as const } };
    expect(mergeProgression(local, cloud, true).tutorialRun?.step).toBe("CHAMBER");
    expect(mergeProgression(local, cloud, false).tutorialRun?.step).toBe("CHAMBER");
  });
  it("a tutorial finished on either device clears the checkpoint and counts as seen", () => {
    const local = { ...DEFAULT_PROGRESSION, tutorialRun: { ...FIRST_TUTORIAL, step: "CONTACT" as const } };
    const cloud = { ...DEFAULT_PROGRESSION, tutorialComplete: true };
    const m = mergeProgression(local, cloud, true);
    expect(m.tutorialRun).toBeNull();
    expect(m.introSeen).toBe(true);
    expect(shouldPlayIntro(m)).toBe(false);
  });
  it("the intro stays seen if either device saw it", () => {
    expect(mergeProgression({ ...DEFAULT_PROGRESSION, introSeen: true }, DEFAULT_PROGRESSION, false).introSeen).toBe(true);
  });
  it("the newer copy's character wins, while completed missions are unioned (no progress lost)", () => {
    const a = { ...DEFAULT_PROGRESSION, identityClass: "TITAN" as const, completedMissions: ["mission-01"] };
    const b = { ...DEFAULT_PROGRESSION, identityClass: "HUNTER" as const, completedMissions: ["mission-01", "awakening"] };
    const m = mergeProgression(a, b, false);
    expect(m.identityClass).toBe("HUNTER");
    expect(m.completedMissions).toEqual(["mission-01", "awakening"]);
    expect(mergeProgression(a, b, true).identityClass).toBe("TITAN");
  });
});
