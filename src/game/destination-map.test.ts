import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CARD_RECT, CLOSEUP_RECT, DESTINATION_PINS, DRAWER_RECT, STAGE, STAGE_PANELS, destinationActivities, destinationInfo, destinationStatus, stepDestination } from "./destination-map";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "./progression";
import { REGIONS } from "./world";
import { CITY_DESTINATIONS } from "./destinations";
import { cityAt } from "./living-world";

const ART = fileURLToPath(new URL("../assets/destination", import.meta.url));
const fresh = (over: Partial<PlayerProgression> = {}): PlayerProgression => ({ ...DEFAULT_PROGRESSION, ...over });
const inside = (r: { x: number; y: number; w: number; h: number }) => r.x >= 0 && r.y >= 0 && r.x + r.w <= STAGE.w && r.y + r.h <= STAGE.h;
const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("destination map", () => {
  test("the nine destinations are every region plus both cities, each with its art", () => {
    const ids = DESTINATION_PINS.map((p) => p.id).sort();
    expect(ids).toEqual([...REGIONS.map((r) => r.id), ...CITY_DESTINATIONS.map((c) => c.id)].sort());
    for (const p of DESTINATION_PINS) {
      expect(existsSync(join(ART, `emblem-${p.id}.png`))).toBe(true);
      expect(existsSync(join(ART, `${p.id}.jpg`))).toBe(true);
    }
    expect(existsSync(join(ART, "planet.jpg"))).toBe(true);
  });

  test("hotspots and live panels sit on the stage; hotspots never hide under a panel", () => {
    const panels = [...Object.values(STAGE_PANELS), CARD_RECT];
    for (const p of DESTINATION_PINS) {
      expect(inside(p.label)).toBe(true);
      for (const panel of panels) expect(overlap(p.label, panel) ? `${p.id} under a panel` : "ok").toBe("ok");
    }
    for (const r of [...panels, DRAWER_RECT, CLOSEUP_RECT]) expect(inside(r)).toBe(true);
    for (let i = 0; i < DESTINATION_PINS.length; i++) for (let j = i + 1; j < DESTINATION_PINS.length; j++) expect(overlap(DESTINATION_PINS[i]!.label, DESTINATION_PINS[j]!.label)).toBe(false);
  });

  test("launch uses the live world: submersible arrival for Thalassia, a land drop elsewhere", () => {
    expect(destinationInfo("thalassia").drop.y).toBeDefined();
    for (const id of ["nexus", "neon-city", "veridan", "ember", "wastelands"] as const) expect(destinationInfo(id).drop.y).toBeUndefined();
    const v = REGIONS.find((r) => r.id === "veridan")!;
    expect(Math.hypot(destinationInfo("veridan").drop.x - v.x, destinationInfo("veridan").drop.z - v.z)).toBeLessThan(10);
  });

  test("Neon City and Nexus City split their shared region; nothing is listed twice", () => {
    const p = fresh({ tutorialComplete: true, completedMissions: ["mission-01"] });
    const neon = destinationActivities(p, "neon-city"), nexus = destinationActivities(p, "nexus");
    for (const a of neon) expect(cityAt(a.x, a.z) === "neon" || a.id === "city:neon-city").toBe(true);
    for (const a of nexus) expect(a.id).not.toBe("city:neon-city");
    const ids = new Set(neon.map((a) => a.id));
    for (const a of nexus) expect(ids.has(a.id)).toBe(false);
    const thal = new Set(destinationActivities(p, "thalassia").map((a) => a.id));
    for (const a of destinationActivities(p, "swamps")) expect(thal.has(a.id)).toBe(false);
  });

  test("exactly one place carries the next story chapter, and list navigation wraps", () => {
    const p = fresh();
    const story = DESTINATION_PINS.filter((d) => destinationStatus(p, d.id).story);
    expect(story.length).toBeLessThanOrEqual(1);
    expect(stepDestination(DESTINATION_PINS[0]!.id, -1)).toBe(DESTINATION_PINS[DESTINATION_PINS.length - 1]!.id);
    expect(stepDestination(DESTINATION_PINS[DESTINATION_PINS.length - 1]!.id, 1)).toBe(DESTINATION_PINS[0]!.id);
  });
});
