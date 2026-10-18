import { describe, expect, test } from "bun:test";
import { DEFAULT_PROGRESSION } from "./progression";
import { claimCovenant } from "./dragon-covenant";
import { challengeKey } from "./dragonite";
import { FLIGHT, FULL_TRUST, canRide, claimAncientBond, claimEternalCovenant, createFlight, recordTrust, stepFlight, trustOf, trustStage } from "./vyrak-trust";

const bonded = (cls: "HUNTER" | "TITAN" = "HUNTER") => claimCovenant({ ...DEFAULT_PROGRESSION, earnedRewards: [], inventory: [] } as never, cls).progression;
const withKeys = <T extends { earnedRewards: string[] }>(p: T, keys: string[]): T => ({ ...p, earnedRewards: [...p.earnedRewards, ...keys] });
const full = (cls: "HUNTER" | "TITAN" = "HUNTER") => withKeys(bonded(cls), [challengeKey(cls, "unbroken-covenant"), challengeKey(cls, "wings-of-the-ancient"), challengeKey(cls, "dragons-patience"), `vyrak-puzzle:${cls}:a`, `vyrak-puzzle:${cls}:b`, ...["a", "b", "c"].map((r) => `vyrak-ruin:${cls}:${r}`)]);

describe("Vyrak trust", () => {
  test("nothing without the bond, and it is per Operator", () => {
    expect(trustOf({ earnedRewards: [] }, "HUNTER").total).toBe(0);
    expect(trustStage({ earnedRewards: [] }, "HUNTER")).toBe(0);
    const p = full("HUNTER");
    expect(trustOf(p, "TITAN").total).toBe(0);
  });
  test("each source pays once and repeated easy encounters add nothing", () => {
    let p = bonded();
    p = recordTrust(p, "HUNTER", "ruin", "x"); const once = trustOf(p, "HUNTER").total;
    p = recordTrust(p, "HUNTER", "ruin", "x");
    expect(trustOf(p, "HUNTER").total).toBe(once);
    expect(trustOf(withKeys(p, ["enc-done:HUNTER:unbroken-glass"]), "HUNTER").total).toBeGreaterThan(once);
  });
  test("trust never exceeds full and no single route can fill the bar", () => {
    expect(trustOf(full(), "HUNTER").total).toBe(FULL_TRUST);
    const ruins = withKeys(bonded(), Array.from({ length: 40 }, (_, i) => `vyrak-ruin:HUNTER:${i}`));
    expect(trustOf(ruins, "HUNTER").total).toBeLessThan(FULL_TRUST);
  });
  test("riding needs full trust AND the ceremony, for that Operator only", () => {
    const early = claimAncientBond(bonded(), "HUNTER"); expect(early.ok).toBe(false);
    const r = claimAncientBond(full(), "HUNTER"); expect(r.ok).toBe(true);
    expect(trustStage(r.progression, "HUNTER")).toBe(4);
    expect(claimAncientBond(r.progression, "HUNTER").ok).toBe(false);
    expect(canRide(r.progression, "TITAN", { regionId: "solara", inDungeon: false, inStoryMission: false, indoors: false }).ok).toBe(false);
    expect(canRide(r.progression, "HUNTER", { regionId: "solara", inDungeon: false, inStoryMission: false, indoors: false }).ok).toBe(true);
  });
  test("riding is refused indoors, in dungeons, story missions and city airspace", () => {
    const p = claimAncientBond(full(), "HUNTER").progression;
    const base = { regionId: "solara", inDungeon: false, inStoryMission: false, indoors: false };
    for (const bad of [{ indoors: true }, { inDungeon: true }, { inStoryMission: true }, { regionId: "neon" }]) expect(canRide(p, "HUNTER", { ...base, ...bad }).ok).toBe(false);
  });
  test("the Eternal Covenant needs the Ancient Bond first", () => {
    expect(claimEternalCovenant(full(), "HUNTER").ok).toBe(false);
    const p = claimAncientBond(full(), "HUNTER").progression;
    const e = claimEternalCovenant(p, "HUNTER"); expect(e.ok).toBe(true);
    expect(trustStage(e.progression, "HUNTER")).toBe(5);
  });
});
describe("dragon flight", () => {
  test("stays within speed limits, below the ceiling and above the ground", () => {
    let f = createFlight(0, 50, 0, 0);
    for (let i = 0; i < 600; i++) {
      f = stepFlight(f, { pitch: i % 200 < 100 ? 1 : -1, turn: Math.sin(i / 30), throttle: 1 }, 1 / 60, () => 20);
      expect(f.speed).toBeGreaterThanOrEqual(FLIGHT.min - 1e-9); expect(f.speed).toBeLessThanOrEqual(FLIGHT.max + 1e-9);
      expect(f.y).toBeLessThanOrEqual(FLIGHT.ceiling); expect(f.y).toBeGreaterThanOrEqual(22 - 1e-9);
    }
  });
  test("diving speeds up, climbing slows down, turning banks", () => {
    const dive = stepFlight(createFlight(0, 100, 0, 0), { pitch: -1, turn: 0, throttle: 0 }, 1, () => 0);
    const climb = stepFlight(createFlight(0, 100, 0, 0), { pitch: 1, turn: 0, throttle: 0 }, 1, () => 0);
    expect(dive.speed).toBeGreaterThan(climb.speed);
    expect(stepFlight(createFlight(0, 100, 0, 0), { pitch: 0, turn: 1, throttle: 0 }, 0.5, () => 0).bank).toBeGreaterThan(0);
  });
});

describe("later-stage rewards", () => {
  test("the Ancient Bond and Eternal Covenant grant Covenant armor once, per Operator", () => {
    const base = { ...full(), inventory: [] as never[] };
    const a = claimAncientBond(base, "HUNTER"); expect(a.ok).toBe(true);
    expect(a.progression.inventory.some((g: { id: string }) => g.id === "vyrak-wingmantle-hunter")).toBe(true);
    const e = claimEternalCovenant(a.progression, "HUNTER"); expect(e.ok).toBe(true);
    expect(e.progression.inventory.filter((g: { setId?: string }) => g.setId === "dragons-covenant").length).toBe(2);
    expect(claimEternalCovenant(e.progression, "HUNTER").progression.inventory.length).toBe(e.progression.inventory.length);
  });
});
