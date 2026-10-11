import { describe, expect, test } from "bun:test";
import { THALASSIA_CENTER } from "./thalassia-site";
import { COOLANT, CRUSH_DEPTH, DOCK, RING, coolantDamage, coolantPhase, hullDamagePerSec, hullStressStep, sectorAt } from "./thalassia-sectors";

const C = THALASSIA_CENTER;
describe("Thalassia sectors", () => {
  test("sectors by position", () => {
    expect(sectorAt(C.x + 500, -5, C.z)).toBeNull();
    expect(sectorAt(C.x + DOCK.dx, -5, C.z + DOCK.dz)).toBe("SENTRY_DOCK");
    expect(sectorAt(C.x + (RING.inner + RING.outer) / 2, -10, C.z)).toBe("ABYSSAL_RING");
    expect(sectorAt(C.x, -25, C.z)).toBe("SUNK_CORE");
    expect(sectorAt(C.x + 70, -5, C.z + 30)).toBe("OUTER_CITY");
  });
  test("hull stress builds only past crush depth and hurts only at full stress", () => {
    let s = 0;
    for (let i = 0; i < 60; i++) s = hullStressStep(s, CRUSH_DEPTH - 1, 0.1);
    expect(s).toBe(0);
    for (let i = 0; i < 200; i++) s = hullStressStep(s, CRUSH_DEPTH + 8, 0.1);
    expect(s).toBe(1);
    expect(hullDamagePerSec(s)).toBeGreaterThan(0);
    expect(hullDamagePerSec(0.9)).toBe(0);
    for (let i = 0; i < 100; i++) s = hullStressStep(s, 5, 0.1);
    expect(s).toBe(0);
  });
  test("coolant always telegraphs before it arcs", () => {
    let last = "CALM";
    for (let t = 0; t < 30; t += 0.05) { const p = coolantPhase(t); if (p === "ARC" && last === "CALM") throw new Error("arc without warning"); last = p; }
  });
  test("coolant hurts near the floor during an arc, never above reach or outside the ring", () => {
    const tArc = COOLANT.period - COOLANT.arc / 2;
    expect(coolantPhase(tArc)).toBe("ARC");
    expect(coolantDamage("ABYSSAL_RING", RING.floorY + 1, tArc, 0.1)).toBeGreaterThan(0);
    expect(coolantDamage("ABYSSAL_RING", RING.floorY + COOLANT.reach + 1, tArc, 0.1)).toBe(0);
    expect(coolantDamage("SENTRY_DOCK", RING.floorY + 1, tArc, 0.1)).toBe(0);
    expect(coolantDamage("ABYSSAL_RING", RING.floorY + 1, 0.5, 0.1)).toBe(0);
  });
});

import { AIR_REACH, CRUSH_DEPTH as CD, DOCK_DECK_Y, REACTOR_Y, airStationAt, airStations, dockSite, reactorSite, ringWaypoint, depthOf } from "./thalassia-sectors";
describe("Thalassia mission sites and air", () => {
  test("sites sit in their sectors", () => {
    const d = dockSite(); expect(sectorAt(d.x, DOCK_DECK_Y, d.z)).toBe("SENTRY_DOCK");
    const w = ringWaypoint(); expect(sectorAt(w.x, -10, w.z)).toBe("ABYSSAL_RING");
    const r = reactorSite(); expect(sectorAt(r.x, REACTOR_Y, r.z)).toBe("SUNK_CORE");
    expect(depthOf(DOCK_DECK_Y)).toBeLessThan(CD); // the dock is safe from crush depth
    expect(depthOf(REACTOR_Y)).toBeGreaterThan(CD); // the reactor is not
  });
  test("the dock air station only works once the airlock is restored; the ring station always works", () => {
    const [dock, ring] = airStations();
    expect(airStationAt(dock!.x, dock!.y, dock!.z, false)).toBeNull();
    expect(airStationAt(dock!.x, dock!.y, dock!.z, true)?.id).toBe("dock");
    expect(airStationAt(ring!.x, ring!.y, ring!.z, false)?.id).toBe("ring");
    expect(airStationAt(ring!.x, ring!.y + AIR_REACH + 1, ring!.z, true)).toBeNull();
  });
});
