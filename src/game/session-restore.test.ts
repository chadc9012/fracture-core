// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { DEFAULT_PROGRESSION, normalizeProgression, type PlayerProgression } from "./progression";
import { OPERATORS, operatorByClass, type ClassId } from "./loadout";
import { forgeInitial, armorSummary, cyclePiece, setSlotPiece, slotOptions } from "./deployment/forgeState";
import { grantSetPiece } from "./armor-sets";
import { FIRST_TUTORIAL, advanceTutorial, furtherTutorial, sanitizeTutorial } from "./onboarding";
import { freshProgression, firstMissionHud, hudIdentity, newGamePlan, reconcileRuns, reconcileTutorial, sameSession, sessionFromProgression, shouldPlayIntro, tutorialForEntry, withIntroSeen, withTutorialRun } from "./session-restore";
import { withMissionRun, restoreMission } from "./missions/persistence";
import { readySave } from "./missions/mission-suite";
import { applyMissionCompletion } from "./missions/persistence";
import { padIntent, NEW_PAD_NAV } from "./menu-nav";

const saved = (classId: ClassId, extra: Partial<PlayerProgression> = {}): PlayerProgression => {
  const f = forgeInitial({ classId });
  const op = operatorByClass(classId);
  return { ...DEFAULT_PROGRESSION, identityClass: classId, character: { deploymentId: "dep-1", operatorId: op.id, classId, subclassId: f.subclassId, bodyType: f.bodyType, displayName: f.appearance.callsign, appearance: f.appearance, loadout: { weaponOrder: [] } }, ...extra };
};
const reload = (p: PlayerProgression) => normalizeProgression(JSON.parse(JSON.stringify(p)));

describe("Continue restores the saved operator", () => {
  for (const op of OPERATORS) {
    it(`${op.name} stays ${op.name} after save → reload`, () => {
      const s = sessionFromProgression(reload(saved(op.classId)));
      expect(s.cls).toBe(op.classId);
      expect(s.appearance.callsign).toBe(op.callsign);
      expect(hudIdentity(s).playerClass).toBe(op.classId);
    });
  }
  it("keeps custom colours, callsign, subclass and body type", () => {
    const base = saved("HUNTER");
    const p = reload({ ...base, character: { ...base.character!, bodyType: "female", subclassId: "SHADOW_HUNTER", appearance: { ...base.character!.appearance, armor: "#112233", callsign: "Vesper" } } });
    const s = sessionFromProgression(p);
    expect([s.cls, s.bodyType, s.appearance.armor, s.appearance.callsign]).toEqual(["HUNTER", "female", "#112233", "Vesper"]);
  });
  it("a corrupt character falls back to the class the save identifies with, never silently to another class", () => {
    const p = { ...DEFAULT_PROGRESSION, identityClass: "WARLOCK" as const, character: null };
    expect(sessionFromProgression(p).cls).toBe("WARLOCK");
    expect(sessionFromProgression(DEFAULT_PROGRESSION).cls).toBe("TITAN");
  });
  it("repeated Continue derives an identical session and never changes the save", () => {
    const p = saved("WARLOCK", { completedMissions: ["mission-01"], tutorialComplete: true });
    const before = JSON.stringify(p);
    const a = sessionFromProgression(p), b = sessionFromProgression(p);
    expect(sameSession(a, b)).toBe(true);
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe("worn equipment restores and drives the stats", () => {
  const wearing = () => {
    let p = saved("HUNTER");
    p = grantSetPiece(p, { setId: "verdant-warden", slot: "helmet" })!.progress as PlayerProgression;
    p = grantSetPiece(p, { setId: "ember-forged", slot: "legs" })?.progress as PlayerProgression ?? p;
    return p;
  };
  it("selection is per slot, mixes sets, and survives a reload with identical stats", () => {
    let p = wearing();
    const helmets = slotOptions(p, "helmet");
    expect(helmets[0]!.id).toBeNull();
    const piece = helmets.find((o) => o.setId === "verdant-warden")!;
    p = setSlotPiece(p, "helmet", piece.id);
    const before = armorSummary(p);
    const after = armorSummary(reload(p));
    expect(after).toEqual(before);
    expect(before.slots.find((s) => s.slot === "helmet")!.name).toBe(piece.name);
  });
  it("only owned pieces of the right slot can be worn", () => {
    const p = wearing();
    expect(setSlotPiece(p, "helmet", "field-chest")).toBe(p);
    expect(setSlotPiece(p, "helmet", "does-not-exist")).toBe(p);
  });
  it("changing a piece changes the derived totals; removing it restores the previous totals", () => {
    const base = wearing();
    const none = setSlotPiece(base, "helmet", null);
    const worn = setSlotPiece(base, "helmet", slotOptions(base, "helmet").find((o) => o.setId === "verdant-warden")!.id);
    const a = armorSummary(none).stats, b = armorSummary(worn).stats;
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(armorSummary(setSlotPiece(worn, "helmet", null)).stats).toEqual(a);
  });
  it("cycling wraps through None and the owned pieces", () => {
    let p = wearing();
    const n = slotOptions(p, "helmet").length;
    const start = p.equippedGear.helmet ?? null;
    for (let i = 0; i < n; i++) p = cyclePiece(p, "helmet", 1);
    expect(p.equippedGear.helmet ?? null).toBe(start);
    expect(cyclePiece(cyclePiece(p, "helmet", 1), "helmet", -1).equippedGear.helmet ?? null).toBe(start);
  });
});

describe("intro and tutorial continuity", () => {
  it("plays once for a brand-new save, then never again", () => {
    expect(shouldPlayIntro(DEFAULT_PROGRESSION)).toBe(true);
    const seen = withIntroSeen(DEFAULT_PROGRESSION);
    expect(shouldPlayIntro(reload(seen))).toBe(false);
    expect(withIntroSeen(seen)).toBe(seen);
  });
  it("never plays for a returning player, even from a save written before the flag existed", () => {
    const legacy = reload({ ...DEFAULT_PROGRESSION, completedMissions: ["mission-01"], introSeen: undefined } as unknown as PlayerProgression);
    expect(shouldPlayIntro(legacy)).toBe(false);
    expect(shouldPlayIntro({ ...DEFAULT_PROGRESSION, tutorialComplete: true })).toBe(false);
  });
  it("tutorial resumes from the saved step instead of step one", () => {
    let t = FIRST_TUTORIAL;
    t = advanceTutorial(t, "READY");
    t = advanceTutorial(t, "GATE");
    const p = reload(withTutorialRun(DEFAULT_PROGRESSION, t));
    expect(p.tutorialRun).toEqual(t);
    expect(tutorialForEntry(p)).toEqual(t);
    expect(tutorialForEntry(p)!.step).toBe("MOVEMENT");
    expect(tutorialForEntry(DEFAULT_PROGRESSION)).toEqual(FIRST_TUTORIAL);
  });
  it("is not marked complete early: VICTORY and completion clear the checkpoint, nothing sets tutorialComplete", () => {
    const mid = withTutorialRun(DEFAULT_PROGRESSION, { ...FIRST_TUTORIAL, step: "SENTINEL" });
    expect(mid.tutorialComplete).toBe(false);
    expect(withTutorialRun(mid, { ...FIRST_TUTORIAL, step: "VICTORY" }).tutorialRun).toBeNull();
    expect(tutorialForEntry({ tutorialComplete: true, tutorialRun: mid.tutorialRun })).toBeNull();
    expect(withTutorialRun(mid, mid.tutorialRun)).toBe(mid);
  });
  it("rejects junk checkpoints and keeps the furthest on merge", () => {
    expect(sanitizeTutorial({ step: "NOPE" })).toBeNull();
    expect(sanitizeTutorial({ ...FIRST_TUTORIAL, step: "VICTORY" })).toBeNull();
    const a = { ...FIRST_TUTORIAL, step: "ABILITY" as const }, b = { ...FIRST_TUTORIAL, step: "CHAMBER" as const };
    expect(furtherTutorial(a, b)).toBe(b);
    expect(furtherTutorial(b, a)).toBe(b);
    expect(furtherTutorial(null, a)).toBe(a);
  });
  it("first-mission HUD is added only while Mission 01 is open", () => {
    expect(firstMissionHud({ completedMissions: [] })).toHaveLength(1);
    expect(firstMissionHud({ completedMissions: ["mission-01"] })).toHaveLength(0);
  });
});

describe("cloud merge after the initial load", () => {
  const live = (p: PlayerProgression) => ({
    awakening: restoreMission<{ id: string }>("awakening", p), "broken-signal": restoreMission<{ id: string }>("broken-signal", p),
  });
  it("an idle machine adopts the merged run; a running one keeps its live run", () => {
    const merged = withMissionRun(readySave("broken-signal"), "broken-signal", { id: "broken-signal", state: "HACKING", target: { x: 1, z: 2 }, hack: 40, wave2Done: true, nova: "n" });
    const idle = reconcileRuns({}, merged);
    expect(idle["broken-signal"]).toMatchObject({ state: "HACKING", hack: 40 });
    const liveRun = { id: "broken-signal", state: "ESCORT_NEWER" };
    expect(reconcileRuns({ "broken-signal": liveRun }, merged)["broken-signal"]).toBe(liveRun);
  });
  it("a mission finished elsewhere never reopens locally", () => {
    const done = applyMissionCompletion(readySave("broken-signal"), "broken-signal");
    expect(reconcileRuns({ "broken-signal": { id: "broken-signal" } }, done)["broken-signal"]).toBeNull();
  });
  it("applying the same merge twice is idempotent (no duplicate runs or rewards)", () => {
    const merged = withMissionRun(readySave("broken-signal"), "broken-signal", { id: "broken-signal", state: "HACKING", target: null, hack: 10, wave2Done: false, nova: "" });
    const once = reconcileRuns({}, merged);
    const twice = reconcileRuns(once, merged);
    expect(twice).toEqual(once);
    expect(live(merged)["broken-signal"]).toEqual(once["broken-signal"]);
  });
  it("the live tutorial survives a merge unless another device finished it (VICTORY is never torn down)", () => {
    const t = { ...FIRST_TUTORIAL, step: "CONTACT" as const };
    expect(reconcileTutorial(t, { tutorialComplete: false })).toBe(t);
    expect(reconcileTutorial(t, { tutorialComplete: true })).toBeNull();
    const v = { ...FIRST_TUTORIAL, step: "VICTORY" as const };
    expect(reconcileTutorial(v, { tutorialComplete: true })).toBe(v);
  });
  it("a remote character change re-derives the session", () => {
    expect(sameSession(sessionFromProgression(saved("TITAN")), sessionFromProgression(saved("HUNTER")))).toBe(false);
  });
});

describe("New Game", () => {
  it("asks first whenever a save exists, and prefers parking it in a free slot", () => {
    expect(newGamePlan(false, null)).toBe("fresh");
    expect(newGamePlan(true, 2)).toBe("park");
    expect(newGamePlan(true, null)).toBe("blocked");
  });
  it("starts from a genuinely fresh profile that shares nothing with the old one", () => {
    const old = saved("HUNTER", { completedMissions: ["mission-01"], tutorialComplete: true, introSeen: true });
    const fresh = freshProgression();
    expect(fresh.character).toBeNull();
    expect(fresh.completedMissions).toEqual([]);
    expect(shouldPlayIntro(fresh)).toBe(true);
    fresh.completedMissions.push("x");
    expect(DEFAULT_PROGRESSION.completedMissions).toEqual([]);
    expect(old.completedMissions).toEqual(["mission-01"]);
  });
});

describe("controller", () => {
  it("a face button on a standard pad yields a confirm intent usable to skip the intro", () => {
    const buttons = Array(17).fill(false); buttons[0] = true;
    expect(padIntent(NEW_PAD_NAV, { buttons, axes: [0, 0, 0, 0] }, 1000).intent).toBe("confirm");
    const back = Array(17).fill(false); back[1] = true;
    expect(padIntent(NEW_PAD_NAV, { buttons: back, axes: [0, 0, 0, 0] }, 1000).intent).toBe("back");
  });
});
