// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { loadProgression } from "./progression";
import {
  brandAshenMark, conditionsMet, createWatch, hasMet, isMarked, isSlain, markAnnouncementSeen, parseSlainKey, recordSovereignSlain, slainAt,
  SOVEREIGN_DWELL, SOVEREIGN_NIGHT, SOVEREIGN_RADIUS, stepWatch, TITLE_KEY, VYRAK, worldAnnouncement, worldFirstBanner, type SovereignConditions,
} from "./sky-sovereign";
import { ACTIVITIES, activityById } from "./activities";
import { DISCOVERIES } from "./discoveries";
import { journalFor } from "./encounter-journal";
import { regionActivities } from "./map-activities";

const ok: SovereignConditions = { dist: 10, night: 0.9, level: 20, inVehicle: false, alone: true };

describe("the secret conditions", () => {
  test("all five must hold: in the crater, night, level 12+, on foot, alone", () => {
    expect(conditionsMet(ok)).toBe(true);
    expect(conditionsMet({ ...ok, dist: SOVEREIGN_RADIUS + 1 })).toBe(false);
    expect(conditionsMet({ ...ok, night: SOVEREIGN_NIGHT - 0.01 })).toBe(false);
    expect(conditionsMet({ ...ok, level: VYRAK.minLevel - 1 })).toBe(false);
    expect(conditionsMet({ ...ok, inVehicle: true })).toBe(false);
    expect(conditionsMet({ ...ok, alone: false })).toBe(false);
  });
  test("he comes down once the conditions have held, unbroken, for the dwell — and not again until you leave", () => {
    const w = createWatch();
    let fired = 0;
    for (let t = 0; t < SOVEREIGN_DWELL - 1; t += 0.5) if (stepWatch(w, ok, 0.5, false)) fired++;
    expect(fired).toBe(0);
    stepWatch(w, { ...ok, night: 0.1 }, 0.5, false); // dawn breaks: the count starts over
    expect(w.held).toBe(0);
    for (let t = 0; t <= SOVEREIGN_DWELL + 1; t += 0.5) if (stepWatch(w, ok, 0.5, false)) fired++;
    expect(fired).toBe(1);
    for (let t = 0; t < SOVEREIGN_DWELL * 3; t += 0.5) if (stepWatch(w, ok, 0.5, false)) fired++;
    expect(fired).toBe(1);
    stepWatch(w, { ...ok, dist: SOVEREIGN_RADIUS * 3 }, 0.5, false);
    for (let t = 0; t <= SOVEREIGN_DWELL + 1; t += 0.5) if (stepWatch(w, ok, 0.5, false)) fired++;
    expect(fired).toBe(2);
  });
  test("never once slain", () => {
    const w = createWatch();
    let fired = 0;
    for (let t = 0; t < SOVEREIGN_DWELL * 3; t += 0.5) if (stepWatch(w, ok, 0.5, true)) fired++;
    expect(fired).toBe(0);
  });
});

describe("the Ashen Mark and the kill", () => {
  test("a loss brands once; the kill lifts the mark (derived, keys never removed)", () => {
    const p = loadProgression();
    expect(hasMet(p)).toBe(false);
    const b = brandAshenMark(p);
    expect(b.branded).toBe(true); expect(isMarked(b.progression)).toBe(true);
    expect(brandAshenMark(b.progression).branded).toBe(false);
    const k = recordSovereignSlain({ ...b.progression, identityClass: "HUNTER" }, "HUNTER", 1_800_000_000_000, "nyx-13");
    expect(k.slain).toBe(true); expect(isSlain(k.progression)).toBe(true); expect(isMarked(k.progression)).toBe(false);
    expect(brandAshenMark(k.progression).branded).toBe(false);
    expect(k.progression.earnedRewards).toContain(TITLE_KEY);
    expect(slainAt(k.progression)).toEqual({ at: 1_800_000_000_000, callsign: "NYX-13" });
    expect(k.progression.inventory.filter((g) => g.setId === "dragons-covenant").length).toBe(5);
    expect(recordSovereignSlain(k.progression, "TITAN", 1_900_000_000_000, "x").slain).toBe(false);
  });
  test("slain stamps parse; garbage does not", () => {
    expect(parseSlainKey("unique-slain-at:vyrak:123:ACE")).toEqual({ at: 123, callsign: "ACE" });
    expect(parseSlainKey("unique-slain-at:vyrak:abc:ACE")).toBeNull();
    expect(parseSlainKey("unique-slain:vyrak")).toBeNull();
  });
});

describe("the world-first announcement", () => {
  const mine = { at: 2000, callsign: "ACE" };
  test("the banner crowns you when nobody fell him earlier", () => {
    expect(worldFirstBanner(null, mine)).toContain("WORLD FIRST · ACE");
    expect(worldFirstBanner({ at: 2000, callsign: "ACE" }, mine)).toContain("WORLD FIRST · ACE");
    expect(worldFirstBanner({ at: 1000, callsign: "ZED" }, mine)).toContain("fell to ZED");
  });
  test("everyone else sees it once on entering the world; the slayer does not", () => {
    const p = loadProgression();
    expect(worldAnnouncement(p, null)).toBeNull();
    expect(worldAnnouncement(p, { at: 1000, callsign: "ZED" })).toContain("ZED has slain a Unique");
    expect(worldAnnouncement(markAnnouncementSeen(p), { at: 1000, callsign: "ZED" })).toBeNull();
    const slayer = recordSovereignSlain(p, "TITAN", 1000, "ZED").progression;
    expect(worldAnnouncement(slayer, { at: 1000, callsign: "ZED" })).toBeNull();
  });
});

describe("nothing brings him up", () => {
  test("no activity, discovery, rematch or map marker names him", () => {
    expect(activityById("vyrak-rematch")).toBeUndefined();
    for (const a of ACTIVITIES) expect(`${a.name} ${a.brief}`.toLowerCase()).not.toContain("vyrak");
    for (const d of DISCOVERIES) expect(`${d.name} ${d.sign ?? ""}`.toLowerCase()).not.toContain("vyrak");
    expect(journalFor(loadProgression(), "TITAN").some((e) => e.id === VYRAK.id)).toBe(false);
  });
  test("his lair never reaches the map", () => {
    for (const p of [loadProgression(), recordSovereignSlain(loadProgression(), "TITAN", 1, "A").progression]) expect(JSON.stringify(regionActivities(p, "solara")).toLowerCase()).not.toContain("vyrak");
  });
});
