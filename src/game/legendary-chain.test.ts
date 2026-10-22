import { describe, it, expect } from "bun:test";
import { emptyChainState, registerChainHit } from "./legendary-chain";
const hit = (id: string, sourceId: string, element: "ARC" | "THERMAL", at: number, targetId = "boss") => ({ id, sourceId, element, at, targetId });
describe("legendary chain rules", () => {
  it("combines distinct players' elements without granting rewards", () => {
    const first = registerChainHit(emptyChainState(), hit("1", "nyx", "ARC", 100));
    const second = registerChainHit(first.state, hit("2", "cipher", "THERMAL", 200));
    expect(second.reaction?.kind).toBe("THERMAL_SHOCK");
    expect(registerChainHit(second.state, hit("2", "cipher", "THERMAL", 200)).reaction).toBeNull();
  });
  it("rejects expired, same-source, and different-target combinations", () => {
    const first = registerChainHit(emptyChainState(), hit("1", "nyx", "ARC", 100));
    expect(registerChainHit(first.state, hit("2", "nyx", "THERMAL", 200)).reaction).toBeNull();
    expect(registerChainHit(first.state, hit("3", "cipher", "THERMAL", 4000)).reaction).toBeNull();
    expect(registerChainHit(first.state, hit("4", "cipher", "THERMAL", 200, "other")).reaction).toBeNull();
  });
  it("rejects malformed hit identities and out-of-order packets", () => {
    const first = registerChainHit(emptyChainState(), hit("first", "nyx", "ARC", 500));
    expect(registerChainHit(first.state, hit("bad id", "cipher", "THERMAL", 600)).reaction).toBeNull();
    const older = registerChainHit(first.state, hit("older", "cipher", "THERMAL", 400));
    expect(older.state).toBe(first.state);
    expect(older.reaction).toBeNull();
    expect(registerChainHit(first.state, hit("new", "cipher", "THERMAL", 600)).reaction?.kind).toBe("THERMAL_SHOCK");
  });
  it("bounds active combo state under many distinct targets", () => {
    let state = emptyChainState();
    for (let i = 0; i < 500; i++) {
      state = registerChainHit(state, hit(`h${i}`, "nyx", "ARC", i, `target${i}`)).state;
    }
    expect(state.marks.length).toBeLessThanOrEqual(256);
    expect(state.consumed.length).toBe(500);
  });

});

import { resolveChainDamage } from "./legendary-chain";
describe("chain damage boundary", () => {
  it("keeps ordinary hits unchanged and scales valid reaction damage", () => {
    const a = registerChainHit(emptyChainState(), hit("a", "nyx", "ARC", 100));
    const b = registerChainHit(a.state, hit("b", "cipher", "THERMAL", 200));
    expect(resolveChainDamage(100, null)).toBe(100);
    expect(resolveChainDamage(100, b.reaction)).toBe(120);
  });
  it("rejects invalid damage and invalid multipliers", () => {
    expect(resolveChainDamage(-2, null)).toBe(0);
    expect(resolveChainDamage(Number.NaN, null)).toBe(0);
    expect(resolveChainDamage(100, { targetId: "x", kind: "SHATTER", triggerId: "x", damageMultiplier: Infinity })).toBe(100);
  });
});
