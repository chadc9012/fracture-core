// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import {
  AIRPORTS, ELEVATOR_PLATFORM_R, FERRY_ROUTES, SEAPORTS, TERMINALS, arrivalPoint, dockArrival, dockLift, elevatorDown, elevatorGroundAt, elevatorUp, flightsFrom, hasVisited,
  platformArrival, recordVisit, terminalAt, thalassiaElevator,
} from "./travel";
import { CONTINENTS, worldAt } from "./planet";
import { heightAt, WATER_LEVEL } from "./terrain";
import { THALASSIA_CENTER } from "./thalassia-site";
import { DEFAULT_PROGRESSION } from "./progression";
import { drivablePoint } from "./race-routing";

describe("transit terminals", () => {
  it("every playable region and Neon City has an airport and a seaport, on dry ground, in its own continent's world", () => {
    expect(AIRPORTS().length).toBe(8);
    expect(SEAPORTS().length).toBe(8);
    for (const t of SEAPORTS()) {
      // a seaport stands on the quay: open sea within a short walk
      let sea = false;
      for (let a = 0; a < Math.PI * 2 && !sea; a += Math.PI / 24) for (let d = 4; d < 40 && !sea; d += 2) if (heightAt(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d) < WATER_LEVEL) sea = true;
      expect(`${t.id}:${sea}`).toBe(`${t.id}:true`);
    }
    for (const t of TERMINALS) {
      expect(heightAt(t.x, t.z)).toBeGreaterThan(WATER_LEVEL);
      expect(worldAt(t.x, t.z)).toBe(t.world);
      expect(worldAt(arrivalPoint(t).x, arrivalPoint(t).z)).toBe(t.world);
      expect(CONTINENTS.find((c) => c.id === t.world)!.tier).toBe("CORE");
      // the canopy footprint is clear of buildings, water and rivers
      for (let i = 0; i < 12; i++) expect(`${t.id}:${drivablePoint(t.x + Math.cos(i / 2) * 8, t.z + Math.sin(i / 2) * 8)}`).toBe(`${t.id}:true`);
    }
  });
  it("you stand at a terminal to use it", () => {
    const t = TERMINALS[0]!;
    expect(terminalAt(t.x + 1, t.z)?.id).toBe(t.id);
    expect(terminalAt(arrivalPoint(t).x, arrivalPoint(t).z)).toBeNull();
  });
  it("ferries sail the sea lanes between seaports; every seaport has at least one, and Nexus and Neon have one across the gulf", () => {
    for (const p of SEAPORTS()) {
      const f = flightsFrom(p, DEFAULT_PROGRESSION);
      expect(f.length).toBeGreaterThan(0);
      expect(f.every((o) => o.terminal.kind === "SEAPORT")).toBe(true);
    }
    expect(FERRY_ROUTES.some(([a, b]) => a === "nexus" && b === "neon")).toBe(true);
  });
  it("flights go to every other airport on a playable continent, never to Thalassia", () => {
    const from = AIRPORTS().find((t) => t.regionId === "veridan")!;
    const f = flightsFrom(from, DEFAULT_PROGRESSION);
    expect(f.length).toBe(AIRPORTS().length - 1);
    expect(f.every((o) => o.open)).toBe(true);
    expect(f.some((o) => o.terminal.world === "thalassia")).toBe(false);
  });
  it("visiting a continent is remembered once", () => {
    const p = recordVisit(DEFAULT_PROGRESSION, "kharos");
    expect(hasVisited(p, "kharos")).toBe(true);
    expect(recordVisit(p, "kharos")).toBe(p);
  });
});

describe("the Thalassia elevator", () => {
  const e = thalassiaElevator();
  it("stands in the sea off Veyloria's coast, on the bearing to the city, joined to dry land by a pier", () => {
    expect(heightAt(e.platform.x, e.platform.z)).toBeLessThan(WATER_LEVEL);
    expect(heightAt(e.pier.x, e.pier.z)).toBeGreaterThan(WATER_LEVEL - 1.2);
    expect(worldAt(e.platform.x, e.platform.z)).toBe("veyloria");
    expect(Math.hypot(e.platform.x - THALASSIA_CENTER.x, e.platform.z - THALASSIA_CENTER.z)).toBeLessThan(Math.hypot(e.pier.x - THALASSIA_CENTER.x, e.pier.z - THALASSIA_CENTER.z));
  });
  it("its deck and pier are ground above the water; the sea beside them is not", () => {
    expect(elevatorGroundAt(e.platform.x, e.platform.z, e.deckY)).toBe(e.deckY);
    const mid = { x: (e.pier.x + e.platform.x) / 2, z: (e.pier.z + e.platform.z) / 2 };
    expect(elevatorGroundAt(mid.x, mid.z, e.deckY)).toBe(e.deckY);
    expect(elevatorGroundAt(e.platform.x + ELEVATOR_PLATFORM_R + 6, e.platform.z + 6, e.deckY)).toBe(-Infinity);
    expect(elevatorGroundAt(e.platform.x, e.platform.z, WATER_LEVEL - 10)).toBe(-Infinity);
  });
  it("rides down from the platform to the dock and back up", () => {
    expect(elevatorDown(e.platform.x, e.platform.z, e.deckY)).toBe(true);
    expect(elevatorDown(e.platform.x + 6, e.platform.z, e.deckY)).toBe(false);
    const d = dockLift();
    expect(elevatorUp(d.x, d.y + 1.6, d.z)).toBe(true);
    // you step out of each car clear of the other end's trigger
    const down = dockArrival();
    expect(elevatorUp(down.x, down.y, down.z)).toBe(false);
    const up = platformArrival();
    expect(elevatorDown(up.x, up.z, up.y - 1.6)).toBe(false);
    expect(worldAt(down.x, down.z)).toBe("thalassia");
  });
});
