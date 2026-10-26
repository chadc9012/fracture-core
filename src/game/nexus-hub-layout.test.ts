import { nexusPalms } from "./city-palms";
import { describe, expect, test } from "bun:test";
import { BUILDING_MODELS, NEXUS_HUB_PROMENADE, NEXUS_HUB_RING, NEXUS_HUB_ROAD_R, NEXUS_HUB_ROAD_HALF, footprintRadius, nexusHubTowers } from "./building-models";
import { INTERIORS, SHOP_INTERIORS } from "./interiors";
import { REGIONAL_SHOPS } from "./regional-shops";
import { REGIONS } from "./world";

const C = REGIONS.find((r) => r.id === "nexus")!;
const towers = nexusHubTowers(C);

describe("Nexus hub at life size", () => {
  test("no two hub towers touch", () => {
    for (let i = 0; i < towers.length; i++) for (let j = i + 1; j < towers.length; j++) {
      const a = towers[i]!, b = towers[j]!;
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(footprintRadius(BUILDING_MODELS[a.model]) + footprintRadius(BUILDING_MODELS[b.model]) - 2);
    }
  });
  test("towers stand outside the ring road, which runs outside the promenade and the storefronts", () => {
    for (const t of towers) { const m = BUILDING_MODELS[t.model]; expect(NEXUS_HUB_RING.r - Math.max(m.w, m.d) / 2).toBeGreaterThan(NEXUS_HUB_ROAD_R + NEXUS_HUB_ROAD_HALF); }
    expect(NEXUS_HUB_ROAD_R - NEXUS_HUB_ROAD_HALF).toBeGreaterThan(NEXUS_HUB_PROMENADE[1]);
    // traffic never drives through a door or a plaza palm
    for (const d of [...INTERIORS.filter((i) => i.regionId === "nexus"), ...SHOP_INTERIORS.filter((i) => i.shopId?.startsWith("nexus"))]) {
      const r = Math.hypot(d.doorPos.x - C.x, d.doorPos.z - C.z);
      expect(r < NEXUS_HUB_ROAD_R - NEXUS_HUB_ROAD_HALF - 0.3 || r > NEXUS_HUB_ROAD_R + NEXUS_HUB_ROAD_HALF + 0.3 - 1e-6).toBe(true); // (a lobby door sits exactly 0.3 m past the kerb: float noise must not flip it)
    }
    for (const p of nexusPalms()) { const r = Math.hypot(p.x - C.x, p.z - C.z); expect(r < NEXUS_HUB_ROAD_R - NEXUS_HUB_ROAD_HALF || r > NEXUS_HUB_ROAD_R + NEXUS_HUB_ROAD_HALF + 1).toBe(true); }
    for (const s of REGIONAL_SHOPS.filter((q) => q.id.startsWith("nexus"))) expect(Math.hypot(s.x - C.x, s.z - C.z) + 5.7).toBeLessThan(NEXUS_HUB_PROMENADE[0] + 0.2);
  });
  test("every Nexus door can be walked up to: none sits inside a tower", () => {
    const doors = [...INTERIORS.filter((i) => i.regionId === "nexus"), ...SHOP_INTERIORS.filter((i) => i.shopId?.startsWith("nexus"))];
    expect(doors.length).toBeGreaterThan(2);
    for (const d of doors) for (const t of towers) {
      const m = BUILDING_MODELS[t.model];
      expect(Math.hypot(d.doorPos.x - t.x, d.doorPos.z - t.z)).toBeGreaterThan(Math.min(m.w, m.d) * 0.5 + 1);
    }
  });
});
