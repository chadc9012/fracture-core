import { describe, expect, test } from "bun:test";
import { LANDMARKS, LANDMARK_ROUTES, landmarkRoutes, discoverLandmarks, undiscoveredNear, isLandmarkKnown, nearestLandmark, landmarksIn, LANDMARK_DISCOVER_RADIUS } from "./landmarks";
import { REGIONS } from "./world";
import { heightAt, WATER_LEVEL } from "./terrain";
import { THALASSIA_CENTER } from "./thalassia-site";
import { HAZARD_ZONES, zoneAt, zoneCenter, combineHazard, NO_ZONE, AVALANCHE_PERIOD, AVALANCHE_WARN } from "./hazard-zones";
import { hazardAt } from "./region-hazards";
import { ERAS, regionStory, discoveredCount, regionHistory } from "./world-story";

const P = (earnedRewards: string[] = []) => ({ earnedRewards });

describe("landmarks", () => {
  test("ids unique, each region has landmarks, all above water on land", () => {
    expect(new Set(LANDMARKS.map((l) => l.id)).size).toBe(LANDMARKS.length);
    for (const r of REGIONS) expect(landmarksIn(r.id).length).toBeGreaterThanOrEqual(3);
    for (const l of LANDMARKS) if (l.type !== "ocean") expect(heightAt(l.x, l.z)).toBeGreaterThan(WATER_LEVEL);
  });
  test("every landmark of a region lies inside that region", () => {
    for (const l of LANDMARKS) { const r = REGIONS.find((x) => x.id === l.regionId); if (r) expect(Math.hypot(l.x - r.x, l.z - r.z)).toBeLessThan(r.radius); }
  });
  test("thalassia matches its site", () => {
    const t = LANDMARKS.find((l) => l.id === "thalassia")!;
    expect(t.x).toBe(THALASSIA_CENTER.x); expect(t.z).toBe(THALASSIA_CENTER.z);
  });
  test("routes reference real landmarks and connect everything", () => {
    expect(landmarkRoutes().length).toBe(LANDMARK_ROUTES.length);
    const seen = new Set(["transit-plaza"]); let grew = true;
    while (grew) { grew = false; for (const [a, b] of LANDMARK_ROUTES) { if (seen.has(a) !== seen.has(b)) { seen.add(a); seen.add(b); grew = true; } } }
    const isolated = LANDMARKS.filter((l) => !seen.has(l.id) && !["thalassia"].includes(l.id)).map((l) => l.id);
    expect(isolated).toEqual([]);
  });
  test("discovery is idempotent and ledger-only", () => {
    const l = LANDMARKS.find((x) => x.id === "summit-array")!;
    const p0 = P();
    expect(isLandmarkKnown(p0, l.id)).toBe(false);
    const p1 = discoverLandmarks(p0, l.x + 5, l.z);
    expect(p1.earnedRewards).toContain("landmark-seen:summit-array");
    expect(discoverLandmarks(p1, l.x + 5, l.z)).toBe(p1);
    expect(undiscoveredNear(p0, l.x + LANDMARK_DISCOVER_RADIUS + 5, l.z).map((x) => x.id)).not.toContain("summit-array");
  });
  test("safe-zone hubs are known from the start; nearest works", () => {
    expect(isLandmarkKnown(P(), "transit-plaza")).toBe(true);
    const nx = REGIONS.find((r) => r.id === "nexus")!; const n = nearestLandmark(nx.x, nx.z)!; expect(n.landmark.id).toBe("transit-plaza");
  });
});

describe("hazard zones", () => {
  test("each zone sits on a hazard landmark region and is detected at its centre", () => {
    for (const z of HAZARD_ZONES) { const c = zoneCenter(z, 0); expect(zoneAt(c.x, c.z, 0, false).zoneId).toBe(z.id); expect(zoneAt(c.x + z.radius + 3, c.z, 0, false).zoneId).not.toBe(z.id); }
  });
  test("quicksand slows on foot, not in vehicle; centre drifts", () => {
    const z = HAZARD_ZONES.find((x) => x.kind === "quicksand")!;
    const c = zoneCenter(z, 0);
    expect(zoneAt(c.x, c.z, 0, false).speedMul).toBeLessThan(0.7);
    expect(zoneAt(c.x, c.z, 0, true).speedMul).toBe(1);
    expect(zoneCenter(z, 30)).not.toEqual(c);
  });
  test("avalanche is telegraphed before it hurts", () => {
    const z = HAZARD_ZONES.find((x) => x.kind === "avalanche")!; const c = zoneCenter(z, 0);
    const start = AVALANCHE_PERIOD - 4 - 3;
    expect(zoneAt(c.x, c.z, 1, false).damagePerSec).toBe(0);
    const warn = zoneAt(c.x, c.z, start + 0.5, false);
    expect(warn.damagePerSec).toBe(0); expect(warn.warning).toContain("rumble");
    expect(zoneAt(c.x, c.z, start + AVALANCHE_WARN + 0.5, false).damagePerSec).toBeGreaterThan(0);
    expect(zoneAt(c.x, c.z, start + AVALANCHE_WARN + 0.5, true).damagePerSec).toBe(0);
  });
  test("spatial sink pulls toward the centre", () => {
    const z = HAZARD_ZONES.find((x) => x.kind === "spatial-sink")!; const c = zoneCenter(z, 0);
    const e = zoneAt(c.x + 8, c.z, 0, false);
    expect(e.pullX).toBeLessThan(0); expect(e.gravityMul).toBeLessThan(1);
  });
  test("combine keeps region effect when no zone; multiplies and adds when in one", () => {
    const region = hazardAt({ regionId: "frostspire", t: 0, dt: 0.1, sheltered: false, exposure: 0 });
    expect(combineHazard(region, NO_ZONE)).toBe(region);
    const z = HAZARD_ZONES.find((x) => x.kind === "crevasse")!; const c = zoneCenter(z, 0);
    const m = combineHazard(region, zoneAt(c.x, c.z, 0, false));
    expect(m.speedMul).toBeCloseTo(region.speedMul * 0.8); expect(m.damagePerSec).toBeCloseTo(region.damagePerSec + 0.6); expect(m.exposure).toBe(region.exposure);
  });
});

describe("world story", () => {
  test("eras and region history exist; story reveals as landmarks are found", () => {
    expect(ERAS.length).toBe(3);
    for (const r of REGIONS) expect(regionHistory(r.id).length).toBeGreaterThan(10);
    const before = discoveredCount(P());
    const after = discoveredCount(P(["landmark-seen:summit-array"]));
    expect(after).toBe(before + 1);
    expect(regionStory(P(), "frostspire").every((e) => !e.known)).toBe(true);
    expect(regionStory(P(["landmark-seen:summit-array"]), "frostspire").filter((e) => e.known).length).toBe(1);
  });
});
