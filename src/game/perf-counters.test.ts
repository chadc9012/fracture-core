import { describe, expect, test } from "bun:test";
import { createWhyRender } from "./perf-counters";

describe("createWhyRender", () => {
  test("counts only keys whose identity changed", () => {
    const w = createWhyRender();
    const a = { x: 1 }, b = { x: 2 };
    expect(w.render({ hud: a, phase: "w" })).toEqual([]);
    expect(w.render({ hud: b, phase: "w" })).toEqual(["hud"]);
    expect(w.render({ hud: b, phase: "w" })).toEqual([]);
    const d = w.drain();
    expect(d.renders).toBe(3);
    expect(d.noChange).toBe(1);
    expect(d.causes).toEqual([["hud", 1]]);
    expect(w.drain().causes).toEqual([]);
  });
});
