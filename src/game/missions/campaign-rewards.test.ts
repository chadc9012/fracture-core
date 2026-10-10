// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, mock, test } from "bun:test";
import type { PlayerProgression } from "../progression";
import type { MissionId } from "./persistence";

// cloud-save.ts imports the Supabase client; the merge itself is pure, so stub the client out.
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { mergeProgression } = await import("../cloud-save");
const { DEFAULT_PROGRESSION, normalizeProgression } = await import("../progression");
const { applyMissionCompletion, MISSION_IDS } = await import("./persistence");

const reload = (p: PlayerProgression) => normalizeProgression(JSON.parse(JSON.stringify(p)));
const wealth = (p: PlayerProgression) => JSON.stringify({ x: p.xp, l: p.level, m: p.materials, g: p.inventory, r: p.earnedRewards, d: p.completedMissions });

/** Plays the scripted chain in order, applying each completion the way GameCanvas does. */
function playChain(): { states: Record<MissionId, PlayerProgression>; final: PlayerProgression } {
  let p: PlayerProgression = { ...DEFAULT_PROGRESSION, tutorialComplete: true };
  const states = {} as Record<MissionId, PlayerProgression>;
  for (const id of MISSION_IDS) { p = applyMissionCompletion(p, id); states[id] = p; }
  return { states, final: p };
}

describe("campaign rewards are paid once", () => {
  test("every mission records completion", () => {
    const { final } = playChain();
    for (const id of MISSION_IDS) expect(final.completedMissions).toContain(id);
  });

  test("completing the same mission again changes nothing, including after a save round trip", () => {
    const { states } = playChain();
    for (const id of MISSION_IDS) {
      const once = states[id];
      expect(wealth(applyMissionCompletion(once, id))).toBe(wealth(once));
      expect(wealth(applyMissionCompletion(reload(once), id))).toBe(wealth(reload(once)));
    }
  });

  test("merging a stale pre-completion copy, in either direction, then completing again never pays twice", () => {
    for (const id of MISSION_IDS) {
      const before = playChain().states;
      const idx = MISSION_IDS.indexOf(id);
      const stale = idx === 0 ? { ...DEFAULT_PROGRESSION, tutorialComplete: true } : before[MISSION_IDS[idx - 1]];
      const done = before[id];
      for (const localNewer of [true, false]) {
        const merged = mergeProgression(localNewer ? stale : done, localNewer ? done : stale, localNewer);
        expect(merged.completedMissions).toContain(id);
        const again = applyMissionCompletion(merged, id);
        expect(wealth(again)).toBe(wealth(merged));
        expect(merged.xp).toBeGreaterThanOrEqual(Math.min(stale.xp, done.xp));
        expect(merged.xp).toBeLessThanOrEqual(Math.max(stale.xp, done.xp));
      }
    }
  });

  test("a mission completed on two devices merges to a single payout", () => {
    const { states } = playChain();
    const a = states["awakening"], b = reload(states["awakening"]);
    const merged = mergeProgression(a, b, true);
    expect(merged.materials).toEqual(a.materials);
    expect(merged.inventory.length).toBe(a.inventory.length);
    expect(merged.xp).toBe(a.xp);
  });
});
