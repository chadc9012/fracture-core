import { describe, expect, test } from "bun:test";
import { INITIAL_REFRAIN, REFRAIN_COOLDOWN_SECONDS, REFRAIN_DAMAGE_PER_VERSE, REFRAIN_DECAY_SECONDS, REFRAIN_RADIUS, REFRAIN_SPLASH, REFRAIN_VERSES, refrainBurstDamage, refrainDamageMult, registerRefrainKill, resetRefrain } from "./ashen-refrain";
import { pieceFor } from "./raid-lockout";

const kills = (n: number, t0 = 0, id0 = 0) => { let s = INITIAL_REFRAIN, b = false; for (let i = 0; i < n; i++) { const r = registerRefrainKill(s, { now: t0 + i, eventId: id0 + i }); s = r.state; b = r.burst; } return { s, b }; };

describe("Ashen Refrain", () => {
  test("each kill adds a verse and a damage bonus, the next kill at full verses bursts", () => {
    expect(refrainDamageMult(INITIAL_REFRAIN, 0)).toBe(1);
    const a = kills(2);
    expect(a.s.verses).toBe(2);
    expect(refrainDamageMult(a.s, 2)).toBeCloseTo(1 + 2 * REFRAIN_DAMAGE_PER_VERSE);
    expect(kills(REFRAIN_VERSES).b).toBe(false);
    const r = kills(REFRAIN_VERSES + 1);
    expect(r.b).toBe(true);
    expect(r.s.verses).toBe(0);
  });
  test("the burst locks out, builds nothing in the lockout, and builds again after", () => {
    const r = kills(REFRAIN_VERSES + 1);
    const during = registerRefrainKill(r.s, { now: 6.5, eventId: 99 });
    expect(during.burst).toBe(false);
    expect(during.state.verses).toBe(0);
    expect(registerRefrainKill(r.s, { now: 5 + REFRAIN_COOLDOWN_SECONDS, eventId: 100 }).state.verses).toBe(1);
  });
  test("verses fade after a pause, including their damage bonus", () => {
    const { s } = kills(3);
    expect(refrainDamageMult(s, 2 + REFRAIN_DECAY_SECONDS + 1)).toBe(1);
    const late = registerRefrainKill(s, { now: 2 + REFRAIN_DECAY_SECONDS + 1, eventId: 50 });
    expect(late.state.verses).toBe(1);
  });
  test("one activation per kill event", () => {
    const { s } = kills(REFRAIN_VERSES);
    const a = registerRefrainKill(s, { now: 9, eventId: 77 }), b = registerRefrainKill(a.state, { now: 9, eventId: 77 });
    expect(a.burst).toBe(true);
    expect(b.burst).toBe(false);
    expect(b.state).toBe(a.state);
  });
  test("a weapon swap clears verses but not the lockout", () => {
    const r = kills(REFRAIN_VERSES + 1), z = resetRefrain(r.s);
    expect(z.verses).toBe(0);
    expect(z.cooldownUntil).toBe(r.s.cooldownUntil);
  });
  test("burst damage is a share of the killing hit, inside the radius only", () => {
    expect(refrainBurstDamage(3, 0, 10)).toBeCloseTo(10 * REFRAIN_SPLASH);
    expect(refrainBurstDamage(REFRAIN_RADIUS + 0.1, 0, 10)).toBeNull();
  });
  test("the Ashen Choir boss drop carries the perk", () => {
    expect(pieceFor("cantor-boss", "normal").perk).toBe("ASHEN_REFRAIN");
  });
});
