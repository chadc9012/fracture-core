// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { DEFAULT_PROGRESSION, normalizeProgression, rewardMission, type PlayerProgression } from "../progression";
import { reconcileQuests, gameTick } from "../quests";
import { applyMissionCompletion, canResume, restoreMission, withMissionRun, MISSION_IDS, type MissionId } from "./persistence";

type Ev = { type: string; [k: string]: unknown };
type Run = { id: string; state: string; [k: string]: unknown };
export type Spec = {
  id: MissionId;
  advance: (m: never, e: never) => Run;
  initial: Run;
  /** the real event script: [event, state expected afterwards] */
  script: [Ev, string][];
  /** state at which GameCanvas pays the mission (awakening pays at COMPLETE, the others at WORLD_UPDATE) */
  payState: string;
  materials: Record<string, number>;
  /** quest event key this mission feeds, and the quest that listens for it */
  questId: string;
};
const adv = (s: Spec, m: Run, e: Ev) => (s.advance as (m: Run, e: Ev) => Run)(m, e);
const ALL: Ev[] = [{ type: "START" }, { type: "ANCHOR", x: 5, z: 5 }, { type: "ARRIVED" }, { type: "CLEAR" }, { type: "HACK", progress: 100 }, { type: "HOLD", progress: 100 }, { type: "ACK" }];
const PREREQ: Record<MissionId, MissionId | null> = { "awakening": null, "broken-signal": "awakening", "drowned-relay": "broken-signal", "blackout-protocol": "broken-signal", "stitched-neon-core": "blackout-protocol", "solar-array": "stitched-neon-core", "descent-protocol": "stitched-neon-core", "system-core": "descent-protocol" };

/** A save in which the mission is legitimately resumable (tutorial done, prerequisite done, on the right quest). */
export function readySave(id: MissionId): PlayerProgression {
  const done = ["mission-01"]; let pre = PREREQ[id];
  while (pre) { done.push(pre); pre = PREREQ[pre]; }
  return { ...DEFAULT_PROGRESSION, tutorialComplete: true, completedMissions: done, activeQuestId: id === "system-core" ? "fd-18" : DEFAULT_PROGRESSION.activeQuestId };
}
const reload = (p: PlayerProgression) => normalizeProgression(JSON.parse(JSON.stringify(p)));
const runsTo = (s: Spec, n: number) => { let m = s.initial; for (const [e] of s.script.slice(0, n)) m = adv(s, m, e); return m; };

export function missionSuite(title: string, s: Spec) {
  describe(title, () => {
    test("normal progression follows the real transitions to the end", () => {
      let m = s.initial;
      expect(m.state).toBe("IDLE");
      for (const [e, state] of s.script) { m = adv(s, m, e); expect(m.state).toBe(state); }
      expect(m.state).toBe(s.payState);
    });

    test("out-of-order events never advance any phase", () => {
      for (let i = 0; i <= s.script.length; i++) {
        const m = runsTo(s, i);
        const nextType = s.script[i]?.[0].type;
        for (const e of ALL) {
          if (e.type === nextType) continue;
          expect(adv(s, m, e).state).toBe(m.state);
        }
      }
    });

    test("a second START mid-run does not restart or reset the mission", () => {
      for (let i = 1; i < s.script.length; i++) {
        const m = runsTo(s, i);
        expect(adv(s, m, { type: "START" })).toEqual(m);
      }
    });

    test("duplicate delivery of a phase's event does not skip the next phase", () => {
      for (let i = 0; i < s.script.length - 1; i++) {
        const [e] = s.script[i]!; const [next] = s.script[i + 1]!;
        if (e.type === next.type) continue; // same event type legitimately drives two phases in a row (see the per-machine note)
        const once = runsTo(s, i + 1);
        expect(adv(s, once, e).state).toBe(once.state);
      }
    });

    test("partial progress events keep the phase and cannot complete early", () => {
      const hackIdx = s.script.findIndex(([e]) => e.type === "HACK" || e.type === "HOLD");
      const before = runsTo(s, hackIdx);
      const kind = s.script[hackIdx]![0].type;
      const low = adv(s, before, { type: kind, progress: 30 });
      expect(low.state).toBe(before.state);
    });

    test("a save at every intermediate phase survives JSON + normalize and restores the identical run", () => {
      for (let i = 1; i <= s.script.length; i++) {
        const m = runsTo(s, i);
        const saved = reload(withMissionRun(readySave(s.id), s.id, m));
        expect(restoreMission(s.id, saved)).toEqual(m);
      }
    });

    test("every restored phase can be finished with the real transitions", () => {
      for (let i = 1; i < s.script.length; i++) {
        let m = restoreMission<Run>(s.id, reload(withMissionRun(readySave(s.id), s.id, runsTo(s, i))))!;
        for (const [e, state] of s.script.slice(i)) { m = adv(s, m, e); expect(m.state).toBe(state); }
        expect(m.state).toBe(s.payState);
      }
    });

    test("completion after restore pays exactly once, clears the saved run and ticks the quest", () => {
      const base = { ...readySave(s.id), activeQuestId: s.questId };
      const mid = withMissionRun(base, s.id, runsTo(s, s.script.length - 1));
      const restored = reload(mid);
      expect(restoreMission(s.id, restored)).not.toBeNull();
      const paid = applyMissionCompletion(restored, s.id);
      expect(paid.completedMissions).toContain(s.id);
      expect(paid.activeMissions[s.id]).toBeUndefined();
      expect(paid.xp + paid.level * 1000).toBeGreaterThan(restored.xp + restored.level * 1000);
      // identical to what the old inline GameCanvas effect produced (reward + quest tick), plus the cleared run
      const legacy = gameTick(rewardMission(restored, s.id, s.materials), s.id === "system-core" ? { type: "BOSS_DEFEATED", encounterId: "system-core" } : { type: "MISSION_COMPLETE", missionId: s.id });
      expect({ ...paid, lastMissionReward: null, missionRuns: null }).toEqual({ ...legacy, activeMissions: {}, lastMissionReward: null, missionRuns: null });
    });

    test("reward idempotency: duplicate completion, reloads and reconciliation never pay twice", () => {
      const once = applyMissionCompletion({ ...readySave(s.id), activeQuestId: s.questId }, s.id);
      const twice = applyMissionCompletion(once, s.id);
      expect(twice).toEqual(once);
      let p = once;
      for (let k = 0; k < 4; k++) p = reconcileQuests(reload(applyMissionCompletion(p, s.id)));
      expect(p.materials).toEqual(once.materials);
      expect(p.xp).toBe(once.xp);
      expect(p.level).toBe(once.level);
      expect(p.completedMissions.filter((x) => x === s.id)).toHaveLength(1);
      expect(p.missionRuns[s.id]?.count).toBe(1);
    });

    test("a completed mission is never reopened from a stale saved run", () => {
      const done = applyMissionCompletion(readySave(s.id), s.id);
      const stale = { ...done, activeMissions: { [s.id]: { id: s.id, state: s.script[1]![1], target: null, hack: 0, hold: 0, wave2Done: false, nova: "", line: "", alert: "" } } } as PlayerProgression;
      expect(canResume(s.id, stale)).toBe(false);
      expect(restoreMission(s.id, stale)).toBeNull();
      expect(reload(stale).activeMissions[s.id]).toBeDefined(); // sanitize alone keeps it; resume is what refuses it
      expect(withMissionRun(stale, s.id, runsTo(s, 2)).activeMissions[s.id]).toBeUndefined(); // and the next save drops it
    });

    test("unsafe saves fall back to a fresh start instead of resuming", () => {
      const m = runsTo(s, 2);
      const noTutorial = withMissionRun({ ...readySave(s.id), tutorialComplete: false, completedMissions: readySave(s.id).completedMissions.filter((x) => x !== "mission-01") }, s.id, m);
      expect(restoreMission(s.id, noTutorial)).toBeNull();
      const pre = PREREQ[s.id];
      if (pre) expect(restoreMission(s.id, withMissionRun({ ...readySave(s.id), completedMissions: ["mission-01"] }, s.id, m))).toBeNull();
      if (s.id === "system-core") expect(restoreMission(s.id, withMissionRun({ ...readySave(s.id), activeQuestId: "fd-17" }, s.id, m))).toBeNull();
    });

    test("a legacy save without mission fields loads with no runs and starts fresh", () => {
      const raw = JSON.parse(JSON.stringify(readySave(s.id))); delete raw.activeMissions;
      const p = normalizeProgression(raw);
      expect(p.activeMissions).toEqual({});
      expect(restoreMission(s.id, p)).toBeNull();
      expect(MISSION_IDS).toContain(s.id);
    });
  });
}
