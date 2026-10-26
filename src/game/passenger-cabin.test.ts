// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import {
  AVAILABLE_STYLES, CABIN_LIGHTING, ENTERTAINMENT_CHANNELS, SEAT_THEMES, assignedSeat, availableStyles, boardedCount, boardingLabel, cabinManifest, cabinSpec,
  clampCabinPoint, clampRecline, entertainmentLabel, lightingFor, makeSeats, pickSeat, seatScreenColor, styleFor, type CabinMode,
} from "./passenger-cabin";
import { JOURNEY_SECONDS, boardingProgress, journeyPhase, phaseLabel, serviceNumber } from "./flight-journey";

const MODES: CabinMode[] = ["air", "sea"];

describe("seat styles (stages 108-113)", () => {
  it("offers the luxury styles by mode: sleepers and pods fly, lounges sail", () => {
    expect(availableStyles("air")).toContain("sleeper");
    expect(availableStyles("air")).toContain("zero-g-pod");
    expect(availableStyles("air")).toContain("first-class-suite");
    expect(availableStyles("sea")).toContain("lounge");
    expect(availableStyles("sea")).not.toContain("zero-g-pod");
    expect(() => makeSeats("sea", "zero-g-pod")).toThrow();
    expect(styleFor("sea", "zero-g-pod")).toBe("economy");
  });
  it("every style lays out rows on both sides that fit inside the cabin walls and clear of the aisle", () => {
    for (const mode of MODES) for (const style of AVAILABLE_STYLES[mode]) {
      const c = cabinSpec(mode), t = SEAT_THEMES[style], seats = makeSeats(mode, style);
      expect(seats.length).toBeGreaterThanOrEqual(2);
      expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length);
      for (const s of seats) {
        expect(Math.abs(s.x) + t.width / 2).toBeLessThan(c.width / 2);
        expect(Math.abs(s.x) - t.width / 2).toBeGreaterThan(c.aisleWidth / 2);
        expect(Math.abs(s.z) + t.depth / 2).toBeLessThan(c.length / 2);
      }
      expect(seats.some((s) => s.side === "L" && s.x < 0)).toBe(true);
      expect(seats.some((s) => s.side === "R" && s.x > 0)).toBe(true);
    }
  });
  it("names seats like an airline: economy is 3-3 with A and F at the windows", () => {
    const row1 = makeSeats("air", "economy").filter((s) => s.row === 1).sort((a, b) => a.x - b.x).map((s) => s.id);
    expect(row1).toEqual(["1A", "1B", "1C", "1D", "1E", "1F"]);
  });
  it("the manifest is the same for the same trip, and booking refuses a taken or unknown seat", () => {
    const seats = makeSeats("air", "business");
    const a = cabinManifest(seats, "AE 214"), b = cabinManifest(seats, "AE 214");
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThan(seats.length);
    expect(pickSeat(seats, a, a[0]!).ok).toBe(false);
    expect(pickSeat(seats, a, "99Z").ok).toBe(false);
    const mine = assignedSeat(seats, a)!;
    expect(a).not.toContain(mine.id);
    expect(pickSeat(seats, a, mine.id)).toEqual({ ok: true, seatId: mine.id });
  });
  it("fellow passengers board progressively", () => {
    expect(boardedCount(20, -1)).toBe(0);
    expect(boardedCount(20, 0.5)).toBe(10);
    expect(boardedCount(20, 9)).toBe(20);
    expect(boardingLabel(0)).toBe("Gate open");
    expect(boardingLabel(1)).toBe("Boarding complete");
  });
});

describe("walking, comfort and ambience (stages 105-107, 114-119)", () => {
  it("keeps you on the aisle and inside the bulkheads", () => {
    for (const mode of MODES) {
      const c = cabinSpec(mode), p = clampCabinPoint({ x: 100, z: 100 }, mode);
      expect(p.x).toBeLessThan(c.aisleWidth / 2);
      expect(p.z).toBeLessThan(c.length / 2);
      expect(clampCabinPoint({ x: NaN, z: NaN }, mode)).toEqual({ x: 0, z: 0 });
    }
  });
  it("recline is clamped per seat style", () => {
    expect(clampRecline("economy", 90)).toBe(12);
    expect(clampRecline("royal-cabin", 90)).toBe(75);
    expect(clampRecline("premium", -4)).toBe(0);
    expect(clampRecline("premium", NaN)).toBe(0);
  });
  it("entertainment channels have labels and distinct screen colours; lighting follows the trip", () => {
    expect(ENTERTAINMENT_CHANNELS.every((c) => entertainmentLabel(c).length > 0)).toBe(true);
    expect(new Set(ENTERTAINMENT_CHANNELS.map(seatScreenColor)).size).toBe(ENTERTAINMENT_CHANNELS.length);
    expect(Object.values(CABIN_LIGHTING).every((l) => l.intensity > 0)).toBe(true);
    expect(lightingFor("boarding", "night")).toBe("boarding");
    expect(lightingFor("enroute", "night")).toBe("night");
    expect(lightingFor("enroute", "day")).toBe("daylight");
  });
  it("a trip runs boarding -> departing -> en route -> arriving -> complete", () => {
    const d = JOURNEY_SECONDS.scheduled;
    expect([0, 0.2, 0.5, 0.9, 1].map((k) => journeyPhase(k * d, d))).toEqual(["boarding", "departing", "enroute", "arriving", "complete"]);
    expect(journeyPhase(NaN, d)).toBe("boarding");
    expect(boardingProgress(d, d)).toBe(1);
    expect(phaseLabel("ferry", "enroute")).toBe("At sea");
    expect(serviceNumber("scheduled", "terminal:nexus", "terminal:neon")).toBe(serviceNumber("scheduled", "terminal:nexus", "terminal:neon"));
    expect(serviceNumber("scheduled", "terminal:nexus", "terminal:neon")).toMatch(/^AE \d{3}$/);
  });
});
