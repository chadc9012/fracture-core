// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { colorAt, heightAt, slopeMask } from "./terrain";

describe("slope masking", () => {
  it("leaves flat ground alone and turns steep faces to rock", () => {
    expect(slopeMask(0)).toEqual({ dirt: 0, rock: 0 });
    const steep = slopeMask(1);
    expect(steep.dirt).toBe(1);
    expect(steep.rock).toBe(1);
  });
  it("is monotonic", () => {
    let last = -1;
    for (let s = 0; s <= 1; s += 0.05) { const m = slopeMask(s); expect(m.rock + m.dirt).toBeGreaterThanOrEqual(last); last = m.rock + m.dirt; }
  });
  it("produces valid colours across the map", () => {
    for (let x = -400; x <= 400; x += 80) for (let z = -400; z <= 400; z += 80) {
      for (const v of colorAt(x, z, heightAt(x, z))) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    }
  });
});
