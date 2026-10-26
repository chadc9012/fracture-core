// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { STRAIT_CLEAR, STRAIT_WATER, borderDistance, nearestTwo, worldOfAnchor } from "./continent-borders";
import { CELESTIAL_BRIDGE, bridgeDeck } from "./nexus-bridge";
import { deckHeight } from "./district-decks";
import { crossingAllowed } from "./planet";
import { heightAt, WATER_LEVEL } from "./terrain";
import { LANES, ROUTES, laneSamples, ROAD_SAMPLES } from "./lanes";
import { NEON_SITE, REGIONS, WORLD_RADIUS } from "./world";
import { worldAt } from "./planet";

const neonD = (x: number, z: number) => Math.hypot(x - NEON_SITE.x, z - NEON_SITE.z);
const mass = (x: number, z: number) => nearestTwo(x, z).a.id;

describe("Stage 151: the continents are separate landmasses", () => {
  it("open sea runs along every border between landmasses", () => {
    let checked = 0;
    for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x += 6) for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z += 6) {
      if (Math.hypot(x, z) > WORLD_RADIUS * 0.95) continue;
      if (borderDistance(x, z) > STRAIT_WATER * 0.6) continue;
      expect(heightAt(x, z)).toBeLessThan(WATER_LEVEL - 1);
      checked++;
    }
    expect(checked).toBeGreaterThan(200);
  });
  it("walking from one continent's centre to another's always meets the sea, unless both share a landmass", () => {
    const sea = (a: { x: number; z: number }, b: { x: number; z: number }) => {
      for (let t = 0; t <= 1; t += 0.002) { const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; if (heightAt(x, z) < WATER_LEVEL) return true; }
      return false;
    };
    for (const a of REGIONS) for (const b of REGIONS) {
      if (a.id >= b.id || mass(a.x, a.z) === mass(b.x, b.z)) continue;
      expect(`${a.id}→${b.id}:${sea(a, b)}`).toBe(`${a.id}→${b.id}:true`);
    }
  });
  it("Nexus City and Neon City: one continent (Aetheria), two landmasses across a gulf, and the Celestial Bridge spans it", () => {
    const nexus = REGIONS.find((r) => r.id === "nexus")!;
    expect(worldOfAnchor("neon")).toBe("aetheria");
    expect(worldAt(NEON_SITE.x, NEON_SITE.z)).toBe("aetheria");
    expect(crossingAllowed(worldAt(nexus.x, nexus.z), worldAt(NEON_SITE.x, NEON_SITE.z))).toBe(true);
    expect(mass(nexus.x, nexus.z)).not.toBe(mass(NEON_SITE.x, NEON_SITE.z));
    const B = CELESTIAL_BRIDGE!;
    expect(B).toBeTruthy();
    const deck = bridgeDeck(B);
    // walk the deck end to end: never in the water, never a step, and both ends meet their bank
    let wet = 0, prev = deckHeight(deck, B.west.x, B.west.z);
    expect(Math.abs(prev - heightAt(B.west.x, B.west.z))).toBeLessThan(0.6);
    expect(Math.abs(deckHeight(deck, B.east.x, B.east.z) - heightAt(B.east.x, B.east.z))).toBeLessThan(0.6);
    for (let t = 0; t <= 1; t += 0.01) {
      const x = B.west.x + (B.east.x - B.west.x) * t, z = B.west.z + (B.east.z - B.west.z) * t, h = deckHeight(deck, x, z);
      if (heightAt(x, z) < WATER_LEVEL) wet++;
      expect(h).toBeGreaterThan(WATER_LEVEL + 10);
      expect(Math.abs(h - prev)).toBeLessThan(0.5);
      prev = h;
    }
    expect(wet).toBeGreaterThan(30); // it really crosses open sea
  });
  it("the border distance is continuous (no tears in the terrain built on it)", () => {
    for (let x = -WORLD_RADIUS; x < WORLD_RADIUS; x += 17) for (let z = -WORLD_RADIUS; z < WORLD_RADIUS; z += 1) {
      const a = borderDistance(x, z), b = borderDistance(x, z + 1);
      if (Number.isFinite(a) && Number.isFinite(b)) expect(Math.abs(a - b)).toBeLessThan(1.5);
    }
  });
  it("every region centre stands well back from the sea between continents", () => {
    for (const r of REGIONS) expect(borderDistance(r.x, r.z)).toBeGreaterThan(STRAIT_CLEAR + 16);
  });
});

describe("Stage 151: supply roads per continent", () => {
  it("no road runs into a strait: every sample is dry land, back from the sea", () => {
    for (const l of LANES) for (const p of laneSamples(l, ROAD_SAMPLES)) {
      expect(heightAt(p.x, p.z)).toBeGreaterThan(WATER_LEVEL);
      expect(borderDistance(p.x, p.z)).toBeGreaterThan(STRAIT_CLEAR);
    }
  });
  it("cut roads follow their route over a stretch of it, and the network still has roads", () => {
    expect(LANES.length).toBeGreaterThanOrEqual(3);
    for (const l of LANES) if (l.route) { expect(ROUTES).toContain(l.route); expect(l.span![0]).toBeLessThan(l.span![1]); }
    expect(worldAt(LANES[0]!.a.x, LANES[0]!.a.z)).toBeTruthy();
  });
});
