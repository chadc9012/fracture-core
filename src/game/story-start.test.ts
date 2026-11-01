// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { OPENING_FLOOR, OPENING_SKIPPED, WAKE_AT, openingOver, skipOpening, startsInResidences } from "./story-start";
import { EVAC_DONE } from "./residence-life";
import { floorWalls, residenceFloor, type ResidenceFloorId } from "./nexus-residences";
import { interiorById, roomBounds } from "./interiors";
import type { Wall } from "./walls";
import { roomSolids, sweepSolids } from "./environment-collision";
import { INTERIOR_ALTITUDE } from "./interiors";

function clearance(w: Wall, x: number, z: number) {
  const dx = w.bx - w.ax, dz = w.bz - w.az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - w.ax) * dx + (z - w.az) * dz) / L2));
  return Math.hypot(x - (w.ax + dx * t), z - (w.az + dz * t)) - w.half;
}
/** cells reachable on foot from the floor's arrival point (nexus-residences.test.ts's flood fill) */
function reachable(id: ResidenceFloorId) {
  const f = residenceFloor(id)!, walls = floorWalls(id), b = roomBounds(interiorById(id)!), step = 0.25, seen = new Set<string>();
  const ok = (x: number, z: number) => Math.abs(x) <= b.hx && Math.abs(z) <= b.hz && walls.every((w) => w.top < 0.4 || w.base > 1.7 || clearance(w, x, z) > 0.45);
  const q: [number, number][] = [[Math.round(f.arrive.x / step), Math.round(f.arrive.z / step)]];
  seen.add(q[0]!.join(","));
  while (q.length) { const [i, j] = q.shift()!; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const k = `${i + di},${j + dj}`; if (!seen.has(k) && ok((i + di) * step, (j + dj) * step)) { seen.add(k); q.push([i + di, j + dj]); } } }
  return (x: number, z: number, r: number) => [...seen].some((k) => { const [i, j] = k.split(",").map(Number); return Math.hypot(i! * step - x, j! * step - z) < r; });
}

describe("story start: a new character wakes in Apartment 1204", () => {
  const fresh = { earnedRewards: [] as string[], tutorialComplete: false, tutorialRun: null, completedMissions: [] as string[] };
  it("only new characters start there; getting out of the building or skipping ends it", () => {
    expect(startsInResidences(fresh)).toBe(true);
    expect(startsInResidences({ ...fresh, tutorialRun: { step: "MATERIALIZE", gates: 0, jumped: false, kills: 0, chained: 0, abilities: 0, bossHits: 0 } })).toBe(true);
    expect(startsInResidences({ ...fresh, tutorialRun: { step: "CONTACT", gates: 3, jumped: true, kills: 0, chained: 0, abilities: 1, bossHits: 0 } })).toBe(false);
    expect(startsInResidences({ ...fresh, tutorialComplete: true })).toBe(false);
    expect(startsInResidences({ ...fresh, completedMissions: ["awakening"] })).toBe(false);
    expect(openingOver({ earnedRewards: [EVAC_DONE] })).toBe(true);
    expect(startsInResidences({ ...fresh, earnedRewards: [EVAC_DONE] })).toBe(false);
    const skipped = skipOpening(fresh);
    expect(skipped.earnedRewards).toEqual([OPENING_SKIPPED]);
    expect(skipOpening(skipped)).toBe(skipped);
    expect(startsInResidences(skipped)).toBe(false);
  });
  it("you wake somewhere you can walk from", () => {
    expect(reachable(OPENING_FLOOR)(WAKE_AT.x, WAKE_AT.z, 0.3)).toBe(true);
  });
  it("no plain-room shell walls cut through the residence floors (they trapped you beside the bed)", () => {
    const room = interiorById(OPENING_FLOOR)!, solids = roomSolids(room, INTERIOR_ALTITUDE);
    expect(solids).toEqual([]);
    const body = { x: room.origin.x + 0.3, z: room.origin.z - 3.6 };
    expect(sweepSolids(body, { x: room.origin.x + WAKE_AT.x, z: room.origin.z + WAKE_AT.z }, INTERIOR_ALTITUDE, 1.8, 0.5, solids)).toBe(false);
    expect(body.x).toBeCloseTo(room.origin.x + 0.3);
  });
});
