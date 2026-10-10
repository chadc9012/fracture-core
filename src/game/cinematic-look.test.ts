import { describe, expect, test } from "bun:test";
import { gradeStyle } from "./cinematic-look";
describe("cinematic grade", () => {
  test("is a single plain layer: no blend mode, reduced mode is flatter", () => {
    const g = gradeStyle(); const r = gradeStyle({ reduce: true });
    expect(Object.keys(g).sort()).toEqual(["background", "opacity"]);
    expect(g.background).toContain("radial-gradient"); expect(g.background).toContain("linear-gradient");
    expect(r.opacity).toBeLessThan(g.opacity);
  });
});
