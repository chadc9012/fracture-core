import { describe, expect, test } from "bun:test";
import { DECOR, HOMES, type RoomId } from "./housing";
import { aabbOverlap, itemParts, partBounds, roomFurniture, styleOf, type HomeStyle, type Part } from "./home-furniture";

const ROOMS: RoomId[] = ["living", "bedroom", "bathroom", "kitchen", "garage"];
const STYLES: HomeStyle[] = ["salvage", "neon", "rustic", "desert", "luxe"];
const WALL_H = 3.6;
const solid = (ps: Part[]) => ps.filter((p) => !p.ghost);

/** every legal one-item-per-slot combination for a room (including "nothing" per slot) */
function combos(room: RoomId): Record<string, string>[] {
  const bySlot = new Map<string, string[]>();
  for (const d of DECOR) if (d.rooms.includes(room) && ["furniture", "art", "tv", "bed", "bath", "lighting"].includes(d.slot)) bySlot.set(d.slot, [...(bySlot.get(d.slot) ?? []), d.id]);
  let out: Record<string, string>[] = [{}];
  for (const [slot, ids] of bySlot) out = out.flatMap((c) => [c, ...ids.map((id) => ({ ...c, [slot]: id }))]);
  return out;
}

describe("home furniture models", () => {
  test("every furnishing decor id has a detailed model with many parts, not one slab", () => {
    for (const d of DECOR.filter((x) => ["furniture", "art", "tv", "bed", "bath"].includes(x.slot))) {
      const room = d.rooms[0]!;
      expect(itemParts(d.id, room, "salvage").length, d.id).toBeGreaterThanOrEqual(8);
    }
    expect(itemParts("light-neon", "living", "neon").length).toBeGreaterThanOrEqual(3);
  });

  test("finishes (paint, wallpaper, floor) have no furniture model", () => {
    for (const d of DECOR.filter((x) => ["paint", "wallpaper", "floor"].includes(x.slot))) expect(itemParts(d.id, "living", "luxe")).toEqual([]);
  });

  test("each home gets a style, and the same item looks different in different styles", () => {
    for (const h of HOMES) expect(STYLES).toContain(styleOf(h.id));
    const a = itemParts("bed-king", "bedroom", "salvage").map((p) => p.color).join();
    const b = itemParts("bed-king", "bedroom", "luxe").map((p) => p.color).join();
    expect(a).not.toBe(b);
  });

  test("rooms hold their own kind of fixture", () => {
    const names = (r: RoomId) => roomFurniture(r, "salvage", {}).fixtures.map((p) => p.name);
    expect(names("kitchen")).toContain("hob");
    expect(names("bathroom")).toContain("mirror");
    expect(names("garage")).toContain("bench");
    expect(names("bedroom")).toContain("body");
  });

  for (const style of STYLES) for (const room of ROOMS) {
    test(`${style}/${room}: every combination stays in the room, clear of doorways and the exit, with nothing overlapping`, () => {
      for (const slots of combos(room)) {
        const f = roomFurniture(room, style, slots);
        const groups: { label: string; parts: Part[] }[] = [{ label: "fixtures", parts: solid(f.fixtures) }, ...f.items.map((i) => ({ label: i.id, parts: solid(i.parts) }))];
        for (const g of groups) for (const part of g.parts) {
          const b = partBounds(part);
          const tag = `${g.label}/${part.name} in ${JSON.stringify(slots)}`;
          // inside the walls (inner faces at ±4.875) and under the ceiling
          expect(b.min[0], tag).toBeGreaterThanOrEqual(-4.9); expect(b.max[0], tag).toBeLessThanOrEqual(4.9);
          expect(b.min[2], tag).toBeGreaterThanOrEqual(-4.9); expect(b.max[2], tag).toBeLessThanOrEqual(4.9);
          expect(b.min[1], tag).toBeGreaterThanOrEqual(-0.001); expect(b.max[1], tag).toBeLessThanOrEqual(WALL_H);
          // walking lane between the two doorways (|z| < 1.2) and the exit lane in front of the door
          const lane = { min: [-5, 0, -1.2] as [number, number, number], max: [5, 2.4, 1.2] as [number, number, number] };
          expect(aabbOverlap(b, lane), `${tag} blocks the doorway lane`).toBe(false);
          const exit = { min: [-1.5, 0, 1.2] as [number, number, number], max: [1.5, 2.4, 5] as [number, number, number] };
          expect(aabbOverlap(b, exit), `${tag} blocks the exit`).toBe(false);
        }
        for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++)
          for (const pa of groups[i]!.parts) for (const pb of groups[j]!.parts)
            expect(aabbOverlap(partBounds(pa), partBounds(pb)), `${groups[i]!.label}/${pa.name} overlaps ${groups[j]!.label}/${pb.name} in ${JSON.stringify(slots)}`).toBe(false);
      }
    });
  }

  test("items that do not belong in the room are not drawn", () => {
    const f = roomFurniture("bathroom", "neon", { bed: "bed-king" }, (id, _slot, room) => DECOR.find((d) => d.id === id)?.rooms.includes(room) ?? false);
    expect(f.items).toEqual([]);
  });

  test("lit items carry a light so the room is actually lit by them", () => {
    expect(itemParts("tv-holo", "living", "neon").some((p) => p.light)).toBe(true);
    expect(itemParts("light-neon", "living", "neon").some((p) => p.light)).toBe(true);
  });
});
