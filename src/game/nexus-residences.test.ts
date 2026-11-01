// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { APARTMENT_SPOTS, DIRECTORY, FLOORS, FLOOR_ORDER, FLOOR_SPOTS, callPad, floorBoxes, floorWalls, residenceFloor, spotAt, stairsPad, type ResidenceFloorId } from "./nexus-residences";
import { INTERIORS, atExitMarker, doorAt, interiorById, liftAt, roomBounds } from "./interiors";
import { MORNING_DONE, PAD_REACH, RESIDENTS, TRAPPED, canRide, getEvac, onCallPad, onStairsPad, residentPlace, resetEvac, startEvac, stairsTo } from "./residence-life";
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
  it("has every floor, the lobby the only street door", () => {
    expect(FLOORS.map((f) => f.code)).toEqual(["L", "12-04", "11", "12", "R", "P", "2", "3", "4"]);
    expect(DIRECTORY.map((d) => d.code)).toEqual(["R", "12-04", "12", "11", "4", "3", "2", "L", "P"]);
    expect(doorAt(interiorById("nexus-apartment")!.doorPos.x, interiorById("nexus-apartment")!.doorPos.z)?.id).toBe("nexus-apartment");
    for (const id of FLOOR_ORDER.filter((o) => o !== "nexus-apartment")) { const i = interiorById(id)!; expect(i.viaLift).toBe(true); expect(atExitMarker(i, i.exitOffset.x, i.exitOffset.z)).toBe(false); }
    const lobby = interiorById("nexus-apartment")!;
    expect(atExitMarker(lobby, lobby.exitOffset.x, lobby.exitOffset.z)).toBe(true);
    expect(Math.hypot(lobby.spawnOffset.x - lobby.exitOffset.x, lobby.spawnOffset.z - lobby.exitOffset.z)).toBeGreaterThan(2.2 + 0.5);
  });
  it("one elevator call pad and one stairs door per floor, apart, and you arrive off both; the old lift pads are gone", () => {
    for (const id of FLOOR_ORDER) {
      const f = residenceFloor(id)!, c = callPad(id), st = stairsPad(id), i = interiorById(id)!;
      expect(onCallPad(id, c.x, c.z)).toBe(true);
      expect(onStairsPad(id, st.x, st.z)).toBe(true);
      expect(Math.hypot(c.x - st.x, c.z - st.z)).toBeGreaterThan(PAD_REACH * 2 + 0.5);
      expect(onCallPad(id, f.arrive.x, f.arrive.z) || onStairsPad(id, f.arrive.x, f.arrive.z)).toBe(false);
      expect(liftAt(i, c.x, c.z)).toBeNull();
    }
  });
  it("the elevator goes anywhere but stops in the evacuation; the stairs then lead floor by floor to the lobby", () => {
    resetEvac();
    expect(canRide("nexus-res-1204", "nexus-res-roof")).toBeNull();
    expect(canRide("nexus-res-1204", "nexus-res-1204")).not.toBeNull();
    expect(stairsTo("nexus-res-roof")).toBeNull();
    expect(startEvac({ earnedRewards: [MORNING_DONE] }, 0)).toBe(true);
    expect(getEvac().phase).toBe("alarm");
    expect(canRide("nexus-res-1204", "nexus-res-roof")).not.toBeNull();
    for (const from of FLOOR_ORDER.filter((o) => o !== "nexus-apartment")) {
      let at: ResidenceFloorId = from, hops = 0;
      while (at !== "nexus-apartment" && hops < 12) {
        const s: NonNullable<ReturnType<typeof stairsTo>> = stairsTo(at)!;
        expect(s).not.toBeNull();
        // you come out clear of the stairs door (no instant second ride) and on open floor
        expect(onStairsPad(s.to, s.land.x, s.land.z)).toBe(false);
        expect(`${s.to}:${reachable(s.to)(s.land.x, s.land.z, 0.4)}`).toBe(`${s.to}:true`);
        at = s.to; hops++;
      }
      expect(at).toBe("nexus-apartment");
    }
    resetEvac();
  });
  it("on every floor you can walk from the arrival point to the call pad, the stairs, every spot and every resident (and the lobby's street door)", () => {
    for (const id of FLOOR_ORDER) {
      const can = reachable(id), c = callPad(id), st = stairsPad(id);
      expect(`${id}:call:${can(c.x, c.z, PAD_REACH)}`).toBe(`${id}:call:true`);
      expect(`${id}:stairs:${can(st.x, st.z, PAD_REACH)}`).toBe(`${id}:stairs:true`);
      for (const s of FLOOR_SPOTS[id] ?? []) {
        expect(`${id}:${s.id}:${can(s.x, s.z, s.r)}`).toBe(`${id}:${s.id}:true`);
        expect(spotAt(id, s.x, s.z)?.id).toBe(s.id);
      }
    }
    for (const r of RESIDENTS) { const at = residentPlace(r)!; expect(`${r.id}:${reachable(at.floor)(at.x, at.z, 2.4)}`).toBe(`${r.id}:true`); }
    expect(`trapped:${reachable(TRAPPED.floor)(TRAPPED.x, TRAPPED.z, 2.4)}`).toBe("trapped:true");
    const lobby = interiorById("nexus-apartment")!;
    expect(reachable("nexus-apartment")(lobby.exitOffset.x, lobby.exitOffset.z, 2.2)).toBe(true);
    expect(APARTMENT_SPOTS.length).toBeGreaterThan(5);
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
