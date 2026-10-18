import { describe, expect, test } from "bun:test";
import { acquireTarget, cycleTarget, lockLookAt, newLockState, retainLock, swapShoulder, type LockCandidate } from "./target-lock";

const at = (id: string, x: number, y: number, z: number, o: Partial<LockCandidate> = {}): LockCandidate => ({ id, position: { x, y, z }, ...o });
const O = { x: 0, y: 0, z: 0 }, F = { x: 0, y: 0, z: -1 };

describe("target lock", () => {
  test("picks the target nearest the crosshair inside the cone", () => {
    expect(acquireTarget(O, F, [at("side", 10, 0, -10), at("ahead", 0, 0, -10)])).toBe("ahead");
  });
  test("ignores targets behind, too far, hidden or dead", () => {
    expect(acquireTarget(O, F, [at("behind", 0, 0, 10), at("far", 0, 0, -100), at("hid", 0, 0, -5, { visible: false }), at("dead", 0, 0, -5, { alive: false })])).toBeNull();
  });
  test("a boss priority can beat a slightly better aligned grunt", () => {
    expect(acquireTarget(O, F, [at("grunt", 0, 0, -10), at("boss", 1, 0, -10, { priority: 5 })])).toBe("boss");
  });
  test("lock is kept inside the retain radius and dropped past it, hidden or defeated", () => {
    const s = { ...newLockState(), lockedTargetId: "a" };
    expect(retainLock(s, O, [at("a", 0, 0, -30)]).lockedTargetId).toBe("a");
    expect(retainLock(s, O, [at("a", 0, 0, -60)]).lockedTargetId).toBeNull();
    expect(retainLock(s, O, [at("a", 0, 0, -5, { alive: false })]).lockedTargetId).toBeNull();
    expect(retainLock(s, O, []).lockedTargetId).toBeNull();
  });
  test("cycling is stable, wraps, and skips invalid targets", () => {
    const c = [at("b", 0, 0, -5), at("a", 0, 0, -5), at("c", 0, 0, -5, { alive: false })];
    expect(cycleTarget(null, c)).toBe("a");
    expect(cycleTarget("a", c)).toBe("b");
    expect(cycleTarget("b", c)).toBe("a");
    expect(cycleTarget("a", [])).toBeNull();
  });
  test("shoulder flips and flips back", () => expect(swapShoulder(swapShoulder(newLockState())).shoulderSide).toBe(1));
  test("look point leads a mover, capped at 0.8 s", () => {
    expect(lockLookAt({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { leadSeconds: 0.5 }).x).toBe(5);
    expect(lockLookAt({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { leadSeconds: 9 }).x).toBe(8);
    expect(lockLookAt({ x: 1, y: 2, z: 3 }).y).toBeCloseTo(2.8);
  });
  test("non-finite input never produces NaN", () => {
    const p = lockLookAt({ x: NaN, y: 0, z: 0 }, { x: Infinity, y: 0, z: 0 }, { leadSeconds: 0.5 });
    expect(Number.isFinite(p.x)).toBe(true);
  });
});
