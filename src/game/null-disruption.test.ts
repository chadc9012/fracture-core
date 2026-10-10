// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { INITIAL_NULL_CHARGE, NULL_CHARGE_THRESHOLD, NULL_COOLDOWN_SECONDS, NULL_DECAY_SECONDS, registerNullHit, type NullChargeState } from "./null-disruption";

let id = 0;
const hit = (s: NullChargeState, now: number, timed: boolean, eventId = id++) => registerNullHit(s, { now, timed, eventId });
const charge = (n: number, t0 = 0) => { let s = INITIAL_NULL_CHARGE; for (let i = 0; i < n; i++) s = hit(s, t0 + i * 0.5, true).state; return s; };

describe("Null Disruption", () => {
  it("only timed hits build charge", () => {
    let s = INITIAL_NULL_CHARGE;
    for (let i = 0; i < 10; i++) s = hit(s, i * 0.2, false).state;
    expect(s.charge).toBe(0);
    s = hit(s, 3, true).state;
    expect(s.charge).toBe(1);
  });
  it("caps at the threshold and releases a pulse on the NEXT hit, even an untimed one", () => {
    const full = charge(NULL_CHARGE_THRESHOLD);
    expect(full.charge).toBe(NULL_CHARGE_THRESHOLD);
    const r = hit(full, 4, false);
    expect(r.pulse).toBe(true);
    expect(r.state.charge).toBe(0);
  });
  it("a timed hit at full charge releases the pulse rather than overcharging", () => {
    const r = hit(charge(NULL_CHARGE_THRESHOLD), 4, true);
    expect(r.pulse).toBe(true);
    expect(r.state.charge).toBe(0);
  });
  it("does not pulse before the threshold", () => expect(hit(charge(NULL_CHARGE_THRESHOLD - 1), 3, true).pulse).toBe(false));
  it("a single hit event can never activate twice", () => {
    const full = charge(NULL_CHARGE_THRESHOLD);
    const a = registerNullHit(full, { now: 5, timed: true, eventId: 777 });
    const b = registerNullHit(a.state, { now: 5, timed: true, eventId: 777 });
    expect(a.pulse).toBe(true);
    expect(b.pulse).toBe(false);
    expect(b.state).toBe(a.state);
  });
  it("cooldown blocks charging and pulsing until it ends", () => {
    const fired = hit(charge(NULL_CHARGE_THRESHOLD), 5, true).state;
    const during = hit(fired, 5 + 1, true).state;
    expect(during.charge).toBe(0);
    const after = hit(fired, 5 + NULL_COOLDOWN_SECONDS + 0.1, true).state;
    expect(after.charge).toBe(1);
  });
  it("charge fades after a pause without timed hits", () => {
    const s = charge(NULL_CHARGE_THRESHOLD - 1);
    const late = hit(s, 2 + NULL_DECAY_SECONDS + 1, false);
    expect(late.state.charge).toBe(0);
    expect(late.pulse).toBe(false);
  });
});
