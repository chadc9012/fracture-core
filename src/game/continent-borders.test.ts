// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { LANDMASS, NEON_KEEP, NEON_KEEP_FADE, STRAIT_CLEAR, STRAIT_WATER, borderDistance, nearestTwo } from "./continent-borders";
import { heightAt, WATER_LEVEL } from "./terrain";
import { LANES, ROUTES, laneSamples, ROAD_SAMPLES } from "./lanes";
import { NEON_SITE, REGIONS, WORLD_RADIUS } from "./world";
import { worldAt } from "./planet";

const neonD = (x: number, z: number) => Math.hypot(x - NEON_SITE.x, z - NEON_SITE.z);
const mass = (x: number, z: number) => { const w = nearestTwo(x, z).a.id; return LANDMASS[w] ?? w; };

describe("Stage 151: the continents are separate landmasses", () => {
  it("open sea runs along every border between landmasses (away from Neon City, which stays put)", () => {
    let checked = 0;
    for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x += 6) for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z += 6) {
      if (Math.hypot(x, z) > WORLD_RADIUS * 0.95 || neonD(x, z) < NEON_KEEP + NEON_KEEP_FADE) continue;
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
      // a straight line can pass round the sea only through Neon City's land: skip pairs whose line runs through it
      let viaNeon = false;
      for (let t = 0; t <= 1; t += 0.01) if (neonD(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) < NEON_KEEP + NEON_KEEP_FADE) viaNeon = true;
      if (!viaNeon) expect(`${a.id}→${b.id}:${sea(a, b)}`).toBe(`${a.id}→${b.id}:true`);
    }
  });
  it("Aetheria and Noctyra (Nexus and Neon City) keep their land border", () => {
    expect(LANDMASS["aetheria"]).toBe(LANDMASS["noctyra"]);
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
      if (neonD(p.x, p.z) >= NEON_KEEP) expect(borderDistance(p.x, p.z)).toBeGreaterThan(STRAIT_CLEAR);
    }
  });
  it("cut roads follow their route over a stretch of it, and the network still has roads", () => {
    expect(LANES.length).toBeGreaterThanOrEqual(3);
    for (const l of LANES) if (l.route) { expect(ROUTES).toContain(l.route); expect(l.span![0]).toBeLessThan(l.span![1]); }
    expect(worldAt(LANES[0]!.a.x, LANES[0]!.a.z)).toBeTruthy();
  });
});
