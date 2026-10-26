import { describe, expect, test } from "bun:test";
import { INITIAL_MAW, MAW_COOLDOWN_SECONDS, MAW_DECAY_SECONDS, MAW_RADIUS, MAW_SPLASH, MAW_THRESHOLD, mawEffect, registerMawHit, resetMaw } from "./maw-collapse";
import { pieceFor } from "./raid-lockout";

const feed = (n: number, t0 = 0, id0 = 0) => { let s = INITIAL_MAW, c = false; for (let i = 0; i < n; i++) { const r = registerMawHit(s, { now: t0 + i * 0.3, eventId: id0 + i }); s = r.state; c = r.collapse; } return { s, c }; };

describe("Maw Collapse", () => {
  test("collapses on the hit after full hunger, then locks out", () => {
    expect(feed(MAW_THRESHOLD).c).toBe(false);
    const r = feed(MAW_THRESHOLD + 1);
    expect(r.c).toBe(true);
    expect(r.s.hunger).toBe(0);
    const again = registerMawHit(r.s, { now: 3, eventId: 99 });
    expect(again.collapse).toBe(false);
    expect(again.state.hunger).toBe(0); // nothing builds in the lockout
  });
  test("builds again after the cooldown", () => {
    const r = feed(MAW_THRESHOLD + 1);
    const t = 2 + MAW_COOLDOWN_SECONDS;
    expect(registerMawHit(r.s, { now: t, eventId: 100 }).state.hunger).toBe(1);
  });
  test("hunger fades after a pause", () => {
    const { s } = feed(MAW_THRESHOLD);
    const late = registerMawHit(s, { now: 100 + MAW_DECAY_SECONDS, eventId: 50 });
    expect(late.collapse).toBe(false);
    expect(late.state.hunger).toBe(1);
  });
  test("one activation per hit event", () => {
    const { s } = feed(MAW_THRESHOLD);
    const a = registerMawHit(s, { now: 5, eventId: 77 });
    const b = registerMawHit(a.state, { now: 5, eventId: 77 });
    expect(a.collapse).toBe(true);
    expect(b.collapse).toBe(false);
    expect(b.state).toBe(a.state);
  });
  test("a weapon swap clears hunger but not the lockout", () => {
    const r = feed(MAW_THRESHOLD + 1);
    const z = resetMaw(r.s);
    expect(z.hunger).toBe(0);
    expect(z.cooldownUntil).toBe(r.s.cooldownUntil);
  });
  test("pulls toward the target and splashes only inside the radius", () => {
    const e = mawEffect(6, 0, 10)!;
    expect(e.pullX).toBeLessThan(0);
    expect(e.damage).toBeCloseTo(10 * MAW_SPLASH);
    expect(mawEffect(MAW_RADIUS + 0.1, 0, 10)).toBeNull();
    expect(mawEffect(0, 0, 10)!.pullX).toBe(0);
  });
  test("the raid boss drop carries the perk", () => {
    const fang = pieceFor("hollow-star-boss", "normal");
    expect(fang.id).toBe("hs-astravore-fang");
    expect(fang.perk).toBe("MAW_COLLAPSE");
  });
});
