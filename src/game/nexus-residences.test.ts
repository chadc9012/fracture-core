// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { APARTMENT_SPOTS, FLOORS, FLOOR_ORDER, PAD_R, elevatorPads, floorBoxes, floorWalls, residenceFloor, spotAt, type ResidenceFloorId } from "./nexus-residences";
import { INTERIORS, LIFT_RADIUS, atExitMarker, doorAt, interiorById, liftAt, roomBounds } from "./interiors";
import type { Wall } from "./walls";

const BODY = 0.45;
/** distance from a point to a wall segment's edge (its centre line less its half thickness) */
function clearance(w: Wall, x: number, z: number) {
  const dx = w.bx - w.ax, dz = w.bz - w.az, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - w.ax) * dx + (z - w.az) * dz) / L2));
  return Math.hypot(x - (w.ax + dx * t), z - (w.az + dz * t)) - w.half;
}
/** can a body stand at (x, z) on this floor: inside the room and clear of every wall that reaches body height */
const standable = (id: ResidenceFloorId, walls: Wall[], x: number, z: number) => {
  const f = residenceFloor(id)!, b = roomBounds(interiorById(id)!);
  if (Math.abs(x) > b.hx || Math.abs(z) > b.hz) return false;
  return walls.every((w) => w.top < 0.4 || w.base > 1.7 || clearance(w, x, z) > BODY);
};
/** every standable cell reachable on foot from the floor's arrival point (0.25 m grid) */
function reachable(id: ResidenceFloorId) {
  const f = residenceFloor(id)!, walls = floorWalls(id), step = 0.25, seen = new Set<string>(), key = (i: number, j: number) => `${i},${j}`;
  const start = [Math.round(f.arrive.x / step), Math.round(f.arrive.z / step)] as const, queue: [number, number][] = [[start[0], start[1]]];
  seen.add(key(start[0], start[1]));
  while (queue.length) {
    const [i, j] = queue.shift()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di, nj = j + dj, k = key(ni, nj);
      if (seen.has(k) || !standable(id, walls, ni * step, nj * step)) continue;
      seen.add(k); queue.push([ni, nj]);
    }
  }
  return (x: number, z: number, r: number) => { for (const k of seen) { const [i, j] = k.split(",").map(Number); if (Math.hypot(i! * step - x, j! * step - z) < r) return true; } return false; };
}

describe("Nexus City Residences", () => {
  it("has the sheet's floors in building order, the lobby the only street door", () => {
    expect(FLOORS.map((f) => f.code)).toEqual(["L", "12-04", "11", "12", "R"]);
    expect(doorAt(interiorById("nexus-apartment")!.doorPos.x, interiorById("nexus-apartment")!.doorPos.z)?.id).toBe("nexus-apartment");
    for (const id of FLOOR_ORDER.slice(1)) { const i = interiorById(id)!; expect(i.viaLift).toBe(true); expect(atExitMarker(i, i.exitOffset.x, i.exitOffset.z)).toBe(false); }
    const lobby = interiorById("nexus-apartment")!;
    expect(atExitMarker(lobby, lobby.exitOffset.x, lobby.exitOffset.z)).toBe(true);
    expect(Math.hypot(lobby.spawnOffset.x - lobby.exitOffset.x, lobby.spawnOffset.z - lobby.exitOffset.z)).toBeGreaterThan(2.2 + 0.5);
  });
  it("every floor's elevator rides to every other floor, and you land clear of every pad", () => {
    for (const id of FLOOR_ORDER) {
      const i = interiorById(id)!, pads = elevatorPads(id);
      expect(pads.map((p) => p.to).sort()).toEqual(FLOOR_ORDER.filter((o) => o !== id).slice().sort());
      for (const p of pads) {
        const ride = liftAt(i, p.pad.x, p.pad.z)!;
        expect(ride.to.id).toBe(p.to);
        for (const q of elevatorPads(p.to)) expect(Math.hypot(ride.land.x - q.pad.x, ride.land.z - q.pad.z)).toBeGreaterThan(LIFT_RADIUS + 0.5);
      }
      // pads never overlap each other
      for (const a of pads) for (const b of pads) if (a !== b) expect(Math.hypot(a.pad.x - b.pad.x, a.pad.z - b.pad.z)).toBeGreaterThan(PAD_R * 2);
    }
  });
  it("on every floor you can walk from where the elevator leaves you to every pad (and the lobby's street door)", () => {
    for (const id of FLOOR_ORDER) {
      const can = reachable(id);
      for (const p of elevatorPads(id)) expect(`${id}->${p.to}:${can(p.pad.x, p.pad.z, PAD_R)}`).toBe(`${id}->${p.to}:true`);
    }
    const lobby = interiorById("nexus-apartment")!;
    expect(reachable("nexus-apartment")(lobby.exitOffset.x, lobby.exitOffset.z, 2.2)).toBe(true);
  });
  it("every apartment spot can be walked to, and stands inside the apartment", () => {
    const can = reachable("nexus-res-1204");
    for (const s of APARTMENT_SPOTS) {
      expect(`${s.id}:${can(s.x, s.z, s.r)}`).toBe(`${s.id}:true`);
      expect(spotAt("nexus-res-1204", s.x, s.z)?.id).toBe(s.id);
    }
    expect(spotAt("nexus-apartment", APARTMENT_SPOTS[0]!.x, APARTMENT_SPOTS[0]!.z)).toBeNull();
  });
  it("floors sit far from every other interior and from each other", () => {
    for (const f of FLOORS) for (const o of INTERIORS) if (o.id !== f.id) expect(Math.hypot(o.origin.x - f.origin.x, o.origin.z - f.origin.z)).toBeGreaterThanOrEqual(190);
  });
  it("every box stays inside its floor's footprint (the balcony and roof parapet excepted), and has real size", () => {
    for (const f of FLOORS) for (const b of floorBoxes(f.id)) {
      expect(b.sx > 0 && b.sy > 0 && b.sz > 0).toBe(true);
      expect(Math.abs(b.x) - b.sx / 2).toBeLessThanOrEqual(f.hx + 0.2);
      if (b.z < -f.hz - 0.2) expect(f.id).toBe("nexus-res-1204");   // only the apartment's balcony lies beyond its glass
    }
  });
});
