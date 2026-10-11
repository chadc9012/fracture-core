import { describe, expect, test } from "bun:test";

// mirror of Scene.tsx scenePropsEqual (Scene.tsx imports React/three, which the rule tests avoid)
const shallowSame = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && Object.getPrototypeOf(a) === Object.prototype && Object.getPrototypeOf(b) === Object.prototype) {
    const ka = Object.keys(a as object), kb = Object.keys(b as object);
    return ka.length === kb.length && ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
};
describe("scene prop equality", () => {
  test("fresh arrays/objects with the same contents are equal; changed contents are not", () => {
    expect(shallowSame(["AUTO", "SIDEARM"], ["AUTO", "SIDEARM"])).toBe(true);
    expect(shallowSame(["AUTO"], ["AUTO", "SIDEARM"])).toBe(false);
    expect(shallowSame({ elapsed: 1, totalSeconds: 9 }, { elapsed: 1, totalSeconds: 9 })).toBe(true);
    expect(shallowSame({ elapsed: 1 }, { elapsed: 2 })).toBe(false);
    const run = { state: "DIVE" };
    expect(shallowSame(run, { ...run })).toBe(true);
  });
});
