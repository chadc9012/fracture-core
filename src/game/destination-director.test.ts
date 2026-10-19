import { describe, expect, test } from "bun:test";
import { DESTINATIONS, DIRECTOR_FILTERS, destinationActivities, destinationById, discoveredSites, matchesFilter } from "./destination-director";
import { REGIONS } from "./world";
import { LANDMARKS, landmarkKey } from "./landmarks";
import { DEFAULT_PROGRESSION } from "./progression";
import { regionActivities } from "./map-activities";

const fresh = () => structuredClone(DEFAULT_PROGRESSION);

describe("destination director", () => {
  test("every region plus Neon City and Thalassia is its own destination", () => {
    for (const r of REGIONS) expect(destinationById(r.id)?.city).toBe(false);
    expect(destinationById("neon-city")?.city).toBe(true);
    expect(destinationById("neon-city")?.regionId).toBe("nexus");
    expect(destinationById("thalassia")?.regionId).toBe("swamps");
    expect(new Set(DESTINATIONS.map((d) => d.id)).size).toBe(DESTINATIONS.length);
  });
  test("a city and its parent region never list the same activity", () => {
    const p = fresh();
    for (const city of DESTINATIONS.filter((d) => d.city)) {
      const parent = destinationById(city.regionId)!;
      const a = new Set(destinationActivities(p, city).map((x) => x.id));
      for (const x of destinationActivities(p, parent)) expect(a.has(x.id)).toBe(false);
    }
  });
  test("together they still cover every activity of the region (nothing is lost)", () => {
    const p = fresh();
    for (const r of REGIONS) {
      const ids = new Set([r.id, ...DESTINATIONS.filter((d) => d.city && d.regionId === r.id).map((d) => d.id)].flatMap((id) => destinationActivities(p, destinationById(id)!).map((a) => a.id)));
      for (const a of regionActivities(p, r.id)) expect(ids.has(a.id)).toBe(true);
    }
  });
  test("filters: ALL keeps everything, the named chips and OTHER split the rest without overlap", () => {
    const p = fresh();
    for (const d of DESTINATIONS) {
      const acts = destinationActivities(p, d);
      expect(acts.filter((a) => matchesFilter(a, "ALL")).length).toBe(acts.length);
      for (const a of acts) expect(DIRECTOR_FILTERS.filter((f) => f !== "ALL" && matchesFilter(a, f)).length).toBe(1);
    }
  });
  test("ruins and hazards stay hidden until discovered", () => {
    const site = LANDMARKS.find((l) => l.type === "ruin" || l.type === "hazard")!;
    const d = DESTINATIONS.find((x) => discoveredSites({ earnedRewards: [landmarkKey(site.id)] }, x).some((l) => l.id === site.id));
    expect(d).toBeDefined();
    expect(discoveredSites({ earnedRewards: [] }, d!).some((l) => l.id === site.id)).toBe(false);
  });
});
