import { describe, expect, test } from "bun:test";
import { allLocations, childrenOf, destKey, isLocationVisible, locationById, locationPath, locationsIn, activityBrief, DESTINATION_ALIAS } from "./locations";
import { DESTINATION_PINS } from "./destination-map";
import { INTERIORS } from "./interiors";
import { LANDMARKS } from "./landmarks";
import { ACTIVITIES } from "./activities";
import { DEFAULT_PROGRESSION } from "./progression";
import { landmarkKey } from "./landmarks";

const p = DEFAULT_PROGRESSION;

describe("one location registry", () => {
  const all = allLocations();
  test("every id is unique and every parent exists", () => {
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    for (const l of all) if (l.parentId) expect(locationById(l.parentId)).toBeDefined();
  });
  test("the nine destinations, each with art and a playable drop", () => {
    const dests = all.filter((l) => l.level === "destination");
    expect(dests.map((d) => d.destinationId).sort()).toEqual(DESTINATION_PINS.map((x) => x.id).sort());
    for (const d of dests) { expect(d.art).toBeDefined(); expect(Number.isFinite(d.world.x) && Number.isFinite(d.world.z)).toBe(true); }
    expect(locationById(destKey("thalassia"))!.layer).toBe("underwater");
  });
  test("every door, landmark and activity is placed under a destination, nothing is dropped", () => {
    expect(all.filter((l) => l.level === "entrance").length).toBe(INTERIORS.length);
    expect(all.filter((l) => l.level === "landmark").length).toBe(LANDMARKS.length);
    expect(all.filter((l) => l.level === "activity").length).toBe(ACTIVITIES.filter((a) => DESTINATION_ALIAS[a.area]).length);
    for (const l of all) expect(Number.isFinite(l.world.x) && Number.isFinite(l.world.z)).toBe(true);
  });
  test("a city's districts are its children and the path leads back to the destination", () => {
    const nexusAreas = childrenOf(destKey("nexus")).filter((l) => l.level === "area");
    expect(nexusAreas.length).toBeGreaterThan(3);
    const neonUnder = locationById("area:neon-city:neon-underground");
    expect(neonUnder?.layer).toBe("underground");
    const door = locationsIn("nexus").find((l) => l.id === "door:nexus-apartment")!;
    expect(locationPath(door.id)[0]!.id).toBe(destKey("nexus"));
  });
  test("undiscovered places are invisible until found", () => {
    const hidden = allLocations().find((l) => l.discoverKey && !isLocationVisible(p, l));
    expect(hidden).toBeDefined();
    expect(isLocationVisible({ earnedRewards: [landmarkKey(hidden!.discoverKey!)] }, hidden!)).toBe(true);
  });
  test("activity locations read their real definition: requirements, attempts, rewards", () => {
    const op = allLocations().find((l) => l.level === "activity")!;
    const b = activityBrief(p, op)!;
    expect(b.def.id).toBe(op.activityId!);
    expect(b.def.rewards.nex).toBeGreaterThan(0);
    expect(b.attemptsLeft).toBeGreaterThan(0);
  });
});
describe("street view contents", () => {
  test("the Nexus plaza holds its walk-in shops and tower lobby doors", () => {
    const plaza = childrenOf("area:nexus:plaza");
    expect(plaza.some((l) => l.id === "door:nexus-apartment")).toBe(true);
    expect(plaza.filter((l) => l.level === "entrance").length).toBeGreaterThan(3);
  });
});
