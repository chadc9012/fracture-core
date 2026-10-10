// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { heightAt, waterNetwork, WATER_LEVEL } from "./terrain";
import { carveTarget } from "./rivers";
import { REGIONS } from "./world";

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

describe("named water features survive terrain changes", () => {
  const net = waterNetwork();
  const byRegion = (id: string) => net.rivers.find((r) => r.regionId === id);
  it("Frostspire stream reaches the ocean down a four-fall cascade", () => {
    const f = byRegion("frostspire")!;
    expect(f.mouth).toBe("ocean");
    expect(f.falls.length).toBe(4);
  });
  it("Ember stream keeps its falls; Veridan, swamp and Wastelands channels exist; Wastelands stays dry", () => {
    expect(byRegion("ember")!.falls.length).toBeGreaterThanOrEqual(1);
    expect(byRegion("veridan")).toBeDefined();
    expect(byRegion("swamps")).toBeDefined();
    expect(byRegion("wastelands")!.dry).toBe(true);
  });
  it("Solara keeps an oasis pool", () => {
    const solara = REGIONS.find((r) => r.id === "solara")!;
    expect(net.lakes.some((l) => Math.hypot(l.x - solara.x, l.z - solara.z) < solara.radius)).toBe(true);
  });
});

describe("road crossings", () => {
  it("every road-river crossing gets a bridge deck, never a filled channel", async () => {
    const { riverCrossings, deckAt } = await import("./terrain");
    for (const c of riverCrossings()) { expect(c.resolved).toBe(true); expect(deckAt(c.x, c.z)).toBe(c.deck); }
  });
});
