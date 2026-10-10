import { describe, expect, test } from "bun:test";
import { fxFrame, fxStyle } from "./spell-fx";
import { GROVE, growGroves } from "./forest-density";
import { gradeStyle } from "./cinematic-look";
import { buildPalette, luma } from "./operator-paint";
import { CULL_RADIUS } from "./foliage-cull";

const seq = (seed: number) => { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

describe("ability fx", () => {
  test("every effect kind has a style and the flourish ends", () => {
    for (const k of ["BLOCK", "DAMAGE", "DASH", "MARK", "SILENCE", "FIELD", "DOME", "COOLDOWN_SHIFT", "SIEGE", "VEIL", "STRIKE", "TURRET", "NONE"] as const) {
      const s = fxStyle(k);
      expect(s.shapes.length).toBeGreaterThan(0);
      expect(fxFrame(0.01, s, 6).active).toBe(true);
      expect(fxFrame(s.seconds + 0.01, s, 6).active).toBe(false);
    }
  });
  test("size follows the real radius (clamped) and fades out", () => {
    const s = fxStyle("DOME");
    const small = fxFrame(0.4, s, 2), big = fxFrame(0.4, s, 8);
    expect(big.ringScale).toBeGreaterThan(small.ringScale);
    expect(fxFrame(0.4, s, 999).ringScale).toBeLessThanOrEqual(14);
    expect(fxFrame(s.seconds * 0.9, s, 6).opacity).toBeLessThan(fxFrame(0.05, s, 6).opacity);
  });
  test("reduced motion: no pillar growth and a short flourish", () => {
    const s = fxStyle("STRIKE");
    expect(fxFrame(0.1, s, 6, true).pillarHeight).toBe(0);
    expect(fxFrame(0.5, s, 6, true).active).toBe(false);
  });
  test("negative age is inactive", () => expect(fxFrame(-1, fxStyle("DAMAGE"), 5).active).toBe(false));
});

describe("grove planting", () => {
  const centres = [{ x: 0, z: 0 }, { x: 30, z: 5 }, { x: -20, z: 25 }];
  test("is deterministic, respects accept, and keeps minimum spacing", () => {
    const accept = (x: number, z: number) => Math.hypot(x, z) > 4;
    const a = growGroves(centres, [], seq(1), accept), b = growGroves(centres, [], seq(1), accept);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(centres.length * 3);
    for (const t of a) expect(accept(t.x, t.z)).toBe(true);
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) expect(Math.hypot(a[i]!.x - a[j]!.x, a[i]!.z - a[j]!.z)).toBeGreaterThanOrEqual(GROVE.minSpacing - 1e-9);
  });
  test("never plants on top of existing trees or rejected ground", () => {
    const existing = [{ x: 2.5, z: 0 }, { x: 0, z: 3 }];
    const out = growGroves(centres, existing, seq(2), () => true);
    for (const t of out) for (const e of existing) expect(Math.hypot(t.x - e.x, t.z - e.z)).toBeGreaterThanOrEqual(GROVE.minSpacing - 1e-9);
    expect(growGroves(centres, [], seq(3), () => false)).toEqual([]);
  });
  test("tree draw distance stays bounded so denser planting does not mean more draw cost", () => {
    expect(CULL_RADIUS.fir).toBeLessThanOrEqual(130);
    expect(CULL_RADIUS.fern).toBeLessThan(CULL_RADIUS.fir);
  });
});

describe("cinematic grade", () => {
  test("is subtle and reduced mode is flatter", () => {
    const g = gradeStyle(), r = gradeStyle({ reduce: true });
    expect(g.opacity).toBeLessThanOrEqual(0.7);
    expect(r.opacity).toBeLessThan(g.opacity);
    expect(g.vignette).toContain("radial-gradient");
  });
});

describe("operator paint", () => {
  test("armor reads bright enough and the trim colour separates helmet/shoulders from the base plate", () => {
    const pal = buildPalette({ armor: "#3a3a3a", trim: "#d4a030" });
    expect(luma(pal.chest.color)).toBeGreaterThan(0.3);
    expect(pal.helmet.color).not.toBe(pal.chest.color);
    expect(pal.pauldron.color).not.toBe(pal.chest.color);
    expect(pal.gauntlet.color).not.toBe(pal.thigh.color);
  });
  test("worn set pieces still take their set colour", () => {
    const pal = buildPalette({ armor: "#6b6f76", trim: "#d4a030", look: { chest: { color: "#aa2222" } } as never });
    expect(pal.chest.color).not.toBe(buildPalette({ armor: "#6b6f76", trim: "#d4a030" }).chest.color);
  });
});
