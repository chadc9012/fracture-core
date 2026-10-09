// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { parsePerfFlags } from "./perf-flags";

describe("perf flags", () => {
  it("changes nothing by default", () => {
    expect(parsePerfFlags("")).toEqual({ hud: true, shadows: true, post: true, dpr: null });
  });
  it("reads switches and ignores a bad dpr", () => {
    expect(parsePerfFlags("?hud=0&shadows=0&post=0&dpr=0.5")).toEqual({ hud: false, shadows: false, post: false, dpr: 0.5 });
    expect(parsePerfFlags("?dpr=abc").dpr).toBeNull();
    expect(parsePerfFlags("?dpr=9").dpr).toBeNull();
  });
});
