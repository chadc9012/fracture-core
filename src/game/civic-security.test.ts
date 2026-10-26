import { describe, expect, it } from "bun:test";
import { BASTION, CLEAR_SECURITY, SECURITY, arrestFine, inRestricted, isDischargeOffence, jurisdictionAt, payFine, report, tick, wanted } from "./civic-security";
import { NEON_SITE } from "./world";
import { heightAt, WATER_LEVEL } from "./terrain";

describe("civic security", () => {
  it("offences raise the wanted level; outside a jurisdiction nothing happens", () => {
    let st = report(CLEAR_SECURITY, "weapon-discharge", "neon", 1);
    expect(wanted(st.heat)).toBe(1);
    st = report(st, "weapon-discharge", "neon", 1.5); // too soon: no stacking
    expect(st.heat).toBe(15);
    st = report(st, "weapon-discharge", "neon", 3);
    expect(wanted(st.heat)).toBe(2);
    expect(report(CLEAR_SECURITY, "weapon-discharge", "none", 1)).toBe(CLEAR_SECURITY);
  });
  it("heat holds while you're seen or being searched for, then cools to clear", () => {
    let st = report(CLEAR_SECURITY, "trespass", "base", 0);
    for (let t = 0; t < 10; t += 0.1) st = tick(st, true, 0.1, t);
    expect(st.heat).toBeGreaterThan(0);
    for (let t = 10; t < 60; t += 0.1) st = tick(st, false, 0.1, t);
    expect(st).toBe(CLEAR_SECURITY);
  });
  it("self-defence and activity shots are no crime", () => {
    expect(isDischargeOffence(SECURITY.selfDefence - 1, false)).toBe(false);
    expect(isDischargeOffence(Infinity, true)).toBe(false);
    expect(isDischargeOffence(Infinity, false)).toBe(true);
  });
  it("fines scale with stars and never take the balance below zero", () => {
    expect(arrestFine(15)).toEqual({ status: "citation", fine: 150 });
    expect(arrestFine(90).status).toBe("detained");
    const l = payFine({ a: 100 }, 400, 100, 5);
    expect(Object.values(l).reduce((a, b) => a + b, 0)).toBe(0);
    expect(payFine({}, 400, 0, 5)).toEqual({});
  });
  it("Neon City and Bastion Command are where they claim; the base stands on dry land and its range is open", () => {
    expect(jurisdictionAt(NEON_SITE.x, NEON_SITE.z)).toBe("neon");
    expect(jurisdictionAt(BASTION.x, BASTION.z)).toBe("base");
    expect(inRestricted(BASTION.x, BASTION.z)).toBe(true);
    expect(inRestricted(BASTION.x + BASTION.range.dx, BASTION.z + BASTION.range.dz)).toBe(false);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) expect(heightAt(BASTION.x + a! * BASTION.halfX, BASTION.z + b! * BASTION.halfZ)).toBeGreaterThan(WATER_LEVEL + 1);
  });
});
