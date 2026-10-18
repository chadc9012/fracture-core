import { describe, expect, test } from "bun:test";
import { CLIMB_MAX, MANTLE_MAX, MANTLE_SECONDS, TRAVERSAL, createTraversal, restTraversal, startTraversal, stepTraversal } from "./traversal";

const go = { forward: true, climbHeld: true };
describe("mantle and climb", () => {
  test("small lips are ignored, medium rises mantle, tall faces need climb held", () => {
    const s = createTraversal("TITAN");
    expect(startTraversal(s, "TITAN", 0, 0.4, go)).toBe("NONE");
    expect(startTraversal(s, "TITAN", 0, 1.5, go)).toBe("MANTLE");
    const t = createTraversal("TITAN");
    expect(startTraversal(t, "TITAN", 0, 4, { forward: true, climbHeld: false })).toBe("NONE");
    expect(startTraversal(t, "TITAN", 0, 4, go)).toBe("CLIMB");
    expect(startTraversal(createTraversal("TITAN"), "TITAN", 0, CLIMB_MAX + 1, go)).toBe("NONE");
  });
  test("you have to be moving into the surface", () => expect(startTraversal(createTraversal("HUNTER"), "HUNTER", 0, 1.5, { forward: false, climbHeld: true })).toBe("NONE"));
  test("a mantle rises to the top with only a small hop over the lip, and finishes", () => {
    const s = createTraversal("HUNTER"); startTraversal(s, "HUNTER", 0, 2, go);
    let y = 0, last = -1, done = false, n = 0;
    while (!done && n++ < 200) { const r = stepTraversal(s, "HUNTER", 0.016, 2, false); y = r.y; done = r.done; expect(r.y).toBeLessThanOrEqual(2.15); expect(r.y).toBeGreaterThanOrEqual(last - 0.15); last = r.y; }
    expect(done).toBe(true); expect(y).toBe(2); expect(s.mode).toBe("NONE");
    expect(n * 0.016).toBeLessThan(MANTLE_SECONDS);
  });
  test("Hunter mantles faster than Warlock", () => {
    const time = (c: "HUNTER" | "WARLOCK") => { const s = createTraversal(c); startTraversal(s, c, 0, 2, go); let n = 0; while (!stepTraversal(s, c, 0.01, 2, false).done && n < 500) n++; return n; };
    expect(time("HUNTER")).toBeLessThan(time("WARLOCK"));
  });
  test("a climb gains height, drains stamina, then pulls over the lip", () => {
    const s = createTraversal("TITAN"); startTraversal(s, "TITAN", 0, 6, go);
    const before = s.stamina; let n = 0, done = false, y = 0;
    while (!done && n++ < 1000) { const r = stepTraversal(s, "TITAN", 0.016, 6, true); y = r.y; done = r.done; }
    expect(done).toBe(true); expect(y).toBe(6); expect(s.stamina).toBeLessThan(before);
  });
  test("releasing jump or running out of stamina drops you", () => {
    const s = createTraversal("WARLOCK"); startTraversal(s, "WARLOCK", 0, 7, go);
    stepTraversal(s, "WARLOCK", 0.1, 7, true);
    const r = stepTraversal(s, "WARLOCK", 0.1, 7, false);
    expect(r.done).toBe(true); expect(r.fell).toBe(true);
    const e = createTraversal("WARLOCK"); startTraversal(e, "WARLOCK", 0, 7, go); e.stamina = 0.01;
    stepTraversal(e, "WARLOCK", 0.1, 7, true);
    expect(stepTraversal(e, "WARLOCK", 0.1, 7, true).fell).toBe(true);
  });
  test("a tall climb that stamina cannot finish is not completed (Warlock 80 stamina vs a 7.5 face)", () => {
    const s = createTraversal("WARLOCK"); startTraversal(s, "WARLOCK", 0, CLIMB_MAX, go);
    let n = 0, r = stepTraversal(s, "WARLOCK", 0.05, CLIMB_MAX, true);
    while (!r.done && n++ < 400) r = stepTraversal(s, "WARLOCK", 0.05, CLIMB_MAX, true);
    expect(r.done).toBe(true);
  });
  test("stamina refills on the ground only, up to the class cap", () => {
    const s = createTraversal("HUNTER"); s.stamina = 10;
    restTraversal(s, "HUNTER", 1, false); expect(s.stamina).toBe(10);
    restTraversal(s, "HUNTER", 10, true); expect(s.stamina).toBe(TRAVERSAL.HUNTER.stamina);
  });
  test("a mantle is only offered up to its maximum rise", () => expect(startTraversal(createTraversal("TITAN"), "TITAN", 0, MANTLE_MAX + 0.01, { forward: true, climbHeld: false })).toBe("NONE"));
});
