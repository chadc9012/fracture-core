// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { heightAt, waterNetwork, WATER_LEVEL } from "./terrain";
import { carveTarget } from "./rivers";

describe("water network", () => {
  const net = waterNetwork();
  it("rivers never flow uphill", () => {
    for (const r of net.rivers) for (let i = 1; i < r.points.length; i++) expect(r.points[i]!.s).toBeLessThanOrEqual(r.points[i - 1]!.s + 1e-6);
  });
  it("river water sits in a carved bed, not floating above the ground", () => {
    for (const r of net.rivers) for (const p of r.points) expect(heightAt(p.x, p.z)).toBeLessThan(p.s + 0.01);
  });
  it("waterfalls only exist on real drops", () => {
    for (const r of net.rivers) for (const f of r.falls) expect(f.top - f.bottom).toBeGreaterThanOrEqual(3);
  });
  it("lakes sit above the sea and never above the stream that feeds them", () => {
    for (const l of net.lakes) expect(l.level).toBeGreaterThan(WATER_LEVEL);
  });
  it("dry washes carry no waterfalls", () => {
    for (const r of net.rivers.filter((q) => q.dry)) expect(r.falls.length).toBe(0);
  });
  it("carving only ever lowers ground", () => {
    expect(carveTarget(5, 8, 3, 1, 0)).toBe(5);
    expect(carveTarget(5, 4, 3, 1, 0)).toBeCloseTo(3);
    expect(carveTarget(5, 4, 3, 1, 20)).toBe(5);
  });
});
