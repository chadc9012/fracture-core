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

import { cityDistricts, destinationFleet, destinationGarages, destinationHomes, destinationResidences, destinationShops, destinationSummary } from "./destination-director";
import { REGIONAL_SHOPS } from "./regional-shops";
import { FLEET, GARAGES } from "./fleet";
import { HOMES } from "./housing";
import { residences } from "./residences";

describe("destination services", () => {
  const once = <T,>(all: readonly T[], of: (d: (typeof DESTINATIONS)[number]) => T[], key: (t: T) => string) => {
    for (const t of all) expect(DESTINATIONS.filter((d) => of(d).some((x) => key(x) === key(t))).map((d) => d.id).length === 1 ? key(t) : `${key(t)} in ${DESTINATIONS.filter((d) => of(d).some((x) => key(x) === key(t))).map((d) => d.id).join(",") || "nowhere"}`).toBe(key(t));
  };
  test("every shop, base, home and walk-in residence belongs to exactly one destination", () => {
    once(REGIONAL_SHOPS, destinationShops, (s) => s.id);
    once(Object.keys(GARAGES), destinationGarages, (g) => g);
    once(HOMES, destinationHomes, (h) => h.id);
    once(residences(), destinationResidences, (r) => r.id);
  });
  test("every fleet vehicle is sold where its garage stands", () => {
    for (const f of FLEET) expect(DESTINATIONS.filter((d) => destinationFleet(d).some((x) => x.id === f.id)).length).toBe(1);
  });
  test("Neon City, Thalassia and Nexus City have named districts inside them", () => {
    for (const id of ["neon-city", "thalassia", "nexus"]) {
      const d = destinationById(id)!, ds = cityDistricts(d);
      expect(ds.length).toBeGreaterThanOrEqual(3);
      for (const k of ds) expect(Math.hypot(k.x - d.x, k.z - d.z)).toBeLessThan((d.reach ?? 400) + 10);
    }
    // wilderness regions show the board's named sites (region-atlas.ts)
    expect(cityDistricts(destinationById("veridan")!).map((k) => k.name)).toContain("Lumina Falls");
  });
  test("the summary adds up with the lists", () => {
    const p = fresh();
    for (const d of DESTINATIONS) {
      const s = destinationSummary(p, d);
      expect(s.shops).toBe(destinationShops(d).length);
      expect(s.dungeonsFound).toBeLessThanOrEqual(s.dungeonsTotal);
    }
  });
});
