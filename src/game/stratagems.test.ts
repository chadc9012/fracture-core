// @ts-ignore bun test runner types are not installed
import { describe, expect, it } from "bun:test";
import { STRATAGEMS, cooldownRemaining, createStratagemState, inputDirection, openStratagems, releaseStratagems, tickStratagems, type Dir } from "./stratagems";

const type = (state: ReturnType<typeof createStratagemState>, dirs: Dir[], now = 1) => dirs.map((d) => inputDirection(state, d, now));

describe("stratagem codes", () => {
  it("has no code that is a prefix of another (so a match is never ambiguous)", () => {
    for (const a of STRATAGEMS) for (const b of STRATAGEMS) if (a !== b) expect(b.code.slice(0, a.code.length).join()).not.toBe(a.code.join());
  });
  it("partial matches keep listening, a full match arms and closes entry", () => {
    const s = createStratagemState(); openStratagems(s);
    expect(type(s, ["R", "R", "U"])).toEqual(["partial", "partial", "match"]);
    expect(s.armed).toBe("ORBITAL_STRIKE");
    expect(s.open).toBe(false);
  });
  it("a wrong arrow resets the code and flashes failure", () => {
    const s = createStratagemState(); openStratagems(s);
    expect(type(s, ["R", "D"], 5)).toEqual(["partial", "fail"]);
    expect(s.seq).toEqual([]);
    expect(s.failUntil).toBeGreaterThan(5);
  });
  it("ignores arrows when closed", () => {
    const s = createStratagemState();
    expect(inputDirection(s, "U", 1)).toBe("none");
  });
  it("hesitating clears a half-typed code", () => {
    const s = createStratagemState(); openStratagems(s);
    inputDirection(s, "R", 1);
    expect(tickStratagems(s, 1.5)).toBe(false);
    expect(tickStratagems(s, 4)).toBe(true);
    expect(s.seq).toEqual([]);
  });
  it("releasing throws the armed beacon and starts its cooldown", () => {
    const s = createStratagemState(); openStratagems(s);
    type(s, ["U", "U", "L", "R"], 10);
    expect(releaseStratagems(s, 10)).toBe("RECON_PULSE");
    expect(cooldownRemaining(s, "RECON_PULSE", 10)).toBeGreaterThan(0);
    expect(releaseStratagems(s, 11)).toBeNull();
  });
  it("refuses a stratagem that is still cooling down", () => {
    const s = createStratagemState(); openStratagems(s);
    type(s, ["R", "R", "U"], 1); releaseStratagems(s, 1);
    openStratagems(s);
    expect(type(s, ["R", "R", "U"], 2).at(-1)).toBe("cooldown");
    expect(s.armed).toBeNull();
  });
});
