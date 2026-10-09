// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { DEFAULT_PROGRESSION, normalizeProgression, type PlayerProgression } from "../progression";
import { gameTick, reconcileQuests } from "../quests";
import { advanceAwakening, AWAKENING } from "./awakening";
import { applyMissionCompletion, canResume, pruneCompleted, restoreMission, sanitizeActiveMissions, savedRunFor, withMissionRun } from "./persistence";
import { readySave } from "./mission-suite";

const reload = (p: PlayerProgression) => normalizeProgression(JSON.parse(JSON.stringify(p)));
const awakeningTo = (n: number) => {
  const evs = [{ type: "START" }, { type: "ANCHOR", x: 10, z: 20 }, { type: "CLEAR" }, { type: "CLEAR" }, { type: "ACK" }] as const;
  let m = AWAKENING; for (const e of evs.slice(0, n)) m = advanceAwakening(m, e as never); return m;
};

describe("sanitizeActiveMissions — invalid saved data", () => {
  test("junk of every shape yields an empty record and never throws", () => {
    for (const raw of [undefined, null, 7, "x", [], [1], true, { "awakening": 5 }, { "awakening": null }, { "awakening": [] }]) expect(sanitizeActiveMissions(raw)).toEqual({});
  });
  test("unknown mission ids, mismatched ids and unknown or non-resumable phases are dropped", () => {
    const good = { id: "awakening", state: "PATROL", target: null, hack: 0, hold: 0, wave2Done: false, nova: "", line: "", alert: "" };
    expect(sanitizeActiveMissions({ "made-up": good, "awakening": { ...good, id: "system-core" } })).toEqual({});
    expect(sanitizeActiveMissions({ "awakening": { ...good, state: "IDLE" } })).toEqual({});
    expect(sanitizeActiveMissions({ "awakening": { ...good, state: "NOT_A_PHASE" } })).toEqual({});
    expect(sanitizeActiveMissions({ "awakening": { ...good, state: 4 } })).toEqual({});
    expect(sanitizeActiveMissions({ "awakening": { ...good, state: "BOSS" } })).toEqual({}); // BOSS is not an awakening phase
  });
  test("bad field types are repaired, numbers clamped, strings capped", () => {
    const r = sanitizeActiveMissions({ "blackout-protocol": { id: "blackout-protocol", state: "HACKING", target: { x: "a", z: 1 }, hack: 9e9, hold: -4, wave2Done: "yes", nova: "n".repeat(5000), line: 3, alert: null } })["blackout-protocol"]!;
    expect(r).toMatchObject({ state: "HACKING", target: null, hack: 100, hold: 0, wave2Done: false, line: "", alert: "" });
    expect(r.nova.length).toBe(400);
    expect(sanitizeActiveMissions({ "awakening": { id: "awakening", state: "DROP", target: { x: NaN, z: 1 } } }).awakening!.target).toBeNull();
    expect(sanitizeActiveMissions({ "awakening": { id: "awakening", state: "DROP", target: { x: 1e9, z: 1 } } }).awakening!.target).toBeNull();
  });
  test("normalizeProgression of a whole corrupted save keeps the rest of the save intact", () => {
    const p = normalizeProgression({ ...DEFAULT_PROGRESSION, level: 7, activeMissions: "garbage" });
    expect(p.level).toBe(7);
    expect(p.activeMissions).toEqual({});
  });
});

describe("save → reload → resume", () => {
  test("legacy saves have no runs and the mission starts through its normal trigger", () => {
    const raw = JSON.parse(JSON.stringify(readySave("awakening"))); delete raw.activeMissions;
    expect(restoreMission("awakening", normalizeProgression(raw))).toBeNull();
  });
  test("each machine's run is stored independently", () => {
    let p = withMissionRun(readySave("awakening"), "awakening", awakeningTo(2));
    p = withMissionRun(p, "blackout-protocol", { id: "blackout-protocol", state: "INFILTRATION", target: { x: 1, z: 2 }, hack: 0, wave2Done: false, nova: "n" });
    expect(Object.keys(reload(p).activeMissions).sort()).toEqual(["awakening", "blackout-protocol"]);
  });
  test("resuming mid-mission, reloading repeatedly, then completing pays once", () => {
    let p = withMissionRun(readySave("awakening"), "awakening", awakeningTo(5)); // LOOT acknowledged → CAPTURE
    for (let i = 0; i < 3; i++) p = reload(p);
    const run = restoreMission<ReturnType<typeof awakeningTo>>("awakening", p)!;
    expect(run.state).toBe("CAPTURE");
    let m = advanceAwakening(run, { type: "ARRIVED" });
    m = advanceAwakening(advanceAwakening(m, { type: "HOLD", progress: 100 }), { type: "ARRIVED" });
    expect(m.state).toBe("COMPLETE");
    p = withMissionRun(p, "awakening", m);
    const paid = applyMissionCompletion(p, "awakening");
    expect(applyMissionCompletion(reload(paid), "awakening")).toEqual(reload(paid));
    expect(paid.completedMissions.filter((x) => x === "awakening")).toHaveLength(1);
    expect(paid.activeMissions.awakening).toBeUndefined();
  });
  test("saving a completed or idle run clears it; unchanged saves return the same object", () => {
    const p = withMissionRun(readySave("awakening"), "awakening", awakeningTo(2));
    expect(withMissionRun(p, "awakening", awakeningTo(2))).toBe(p);
    expect(withMissionRun(p, "awakening", AWAKENING).activeMissions.awakening).toBeUndefined();
    expect(withMissionRun(p, "awakening", null).activeMissions.awakening).toBeUndefined();
    const nothing = readySave("awakening");
    expect(withMissionRun(nothing, "awakening", null)).toBe(nothing);
  });
  test("a completed mission cannot be saved as active", () => {
    const done = applyMissionCompletion(readySave("awakening"), "awakening");
    expect(withMissionRun(done, "awakening", awakeningTo(3))).toBe(done);
  });
});

describe("resume safety (recovery path)", () => {
  test("the System Core only resumes while fd-18 is the active quest", () => {
    const sc = readySave("system-core");
    expect(canResume("system-core", sc)).toBe(true);
    expect(canResume("system-core", { ...sc, activeQuestId: "fd-17" })).toBe(false);
  });
  test("an unfinished tutorial blocks every resume; mission-01 counts as the tutorial having been finished", () => {
    const fresh = { ...readySave("awakening"), tutorialComplete: false, completedMissions: [] as string[] };
    expect(canResume("awakening", fresh)).toBe(false);
    expect(canResume("awakening", { ...fresh, completedMissions: ["mission-01"] })).toBe(true);
  });
  test("a prerequisite that is missing blocks a resume", () => {
    expect(canResume("stitched-neon-core", { ...readySave("stitched-neon-core"), completedMissions: ["mission-01", "awakening"] })).toBe(false);
  });
  test("savedRunFor ignores a hand-edited run for a mission the save is not ready for", () => {
    const p = withMissionRun(readySave("descent-protocol"), "descent-protocol", { id: "descent-protocol", state: "TRACING", target: null, hack: 40, nova: "" });
    expect(savedRunFor("descent-protocol", p)).not.toBeNull();
    expect(savedRunFor("descent-protocol", { ...p, completedMissions: ["mission-01"] })).toBeNull();
  });
});

describe("quest and mission consistency", () => {
  test("a mission paid before its quest became active is still credited by the ledger", () => {
    const early = applyMissionCompletion({ ...readySave("awakening"), activeQuestId: "fd-02" }, "awakening");
    expect(early.completedMissions).toContain("awakening");
    const again = reconcileQuests(reload(early));
    expect(again.completedMissions.filter((x) => x === "awakening")).toHaveLength(1);
    expect(reconcileQuests(again)).toEqual(again);
  });
  test("the awakening completion advances fd-01 exactly as the old inline reward did", () => {
    const p = applyMissionCompletion({ ...readySave("awakening"), activeQuestId: "fd-01", questObjectiveProgress: {} }, "awakening");
    expect(p.completedMissions).toContain("fd-01");
    expect(p.activeQuestId).toBe("fd-02");
    expect(applyMissionCompletion(p, "awakening")).toEqual(p);
  });
  test("a duplicate MISSION_COMPLETE event after completion changes nothing", () => {
    const p = applyMissionCompletion({ ...readySave("awakening"), activeQuestId: "fd-01" }, "awakening");
    expect(gameTick(p, { type: "MISSION_COMPLETE", missionId: "awakening" })).toEqual(p);
  });
  test("System Core completion fires the fd-18 boss objective once", () => {
    const p = applyMissionCompletion(readySave("system-core"), "system-core");
    expect(p.completedMissions).toContain("fd-18");
    expect(applyMissionCompletion(p, "system-core")).toEqual(p);
  });
});

describe("save merge helper", () => {
  // cloud-save.ts itself imports the Supabase client, which is not installed in the test sandbox, so only the pure
  // helper it calls is tested here; the wiring in mergeProgression is covered by typecheck only.
  const run = (id: string, state: string) => ({ id, state, target: null, hack: 0, hold: 0, wave2Done: false, nova: "", line: "", alert: "" });
  test("a run for a mission completed on either device is dropped; other runs survive", () => {
    const pruned = pruneCompleted({ "awakening": run("awakening", "PATROL"), "broken-signal": run("broken-signal", "COMBAT_1") }, ["awakening"]);
    expect(Object.keys(pruned)).toEqual(["broken-signal"]);
    expect(pruneCompleted(undefined, ["awakening"])).toEqual({});
  });
});
