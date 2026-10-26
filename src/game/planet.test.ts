// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { CONTINENTS, MAJOR_CONTINENTS, NATIONS, OCEANS, PLANET, THALASSIA_ZONE_RADIUS, borderBlocks, continentById, crossingAllowed, worldAt } from "./planet";
import { NEON_FLAT, NEON_SITE, NEXUS_SUBURB, REGIONS } from "./world";
import { LANDMARKS } from "./landmarks";
import { THALASSIA_CENTER } from "./thalassia-site";
import { AREAS } from "./activities";

const continentOfRegion = (id: string) => CONTINENTS.find((c) => c.regions.includes(id))?.id;

describe("the planet", () => {
  it("is Earth-sized (planet update): 12,756 km, oblate, 7 major continents, 5 major oceans, the rest archipelagos, nations and subregions", () => {
    expect(PLANET.diameterKm).toBe(12756);
    expect(PLANET.polarDiameterKm).toBeLessThan(PLANET.diameterKm);
    expect(PLANET.surfaceKm2 / 510_072_000).toBeGreaterThan(0.99);
    expect(PLANET.surfaceKm2 / 510_072_000).toBeLessThan(1.01);
    expect(MAJOR_CONTINENTS().map((c) => c.id).sort()).toEqual(["aetheria", "frosthelm", "kharos", "noctyra", "pyrrath", "sylvaris", "veyloria"]);
    expect(OCEANS.filter((o) => o.major).length).toBe(5);
    for (const id of ["elyndra", "valdoria", "myrathis", "drakoria", "zephyria"]) expect(continentById(id)!.kind).not.toBe("CONTINENT");
    expect(NATIONS.length).toBe(48);
    expect(new Set(NATIONS.map((n) => n.name)).size).toBe(48);
  });
  it("Nexus City and Neon City are both Aetheria", () => {
    expect(continentOfRegion("nexus")).toBe("aetheria");
    expect(continentOfRegion("neon")).toBe("aetheria");
  });
  it("owner decisions: start on Veyloria, Wastelands with Solara on Kharos, Meridian is Aetheria's capital, Thalassia on no continent", () => {
    expect(continentOfRegion("veridan")).toBe("veyloria");
    expect(continentOfRegion("wastelands")).toBe("kharos");
    expect(continentOfRegion("solara")).toBe("kharos");
    expect(continentById("aetheria")!.capital).toBe("Meridian");
    expect(CONTINENTS.some((c) => c.regions.includes("thalassia"))).toBe(false);
  });
  it("every game region has a continent, and every CORE continent has a region", () => {
    for (const r of REGIONS) expect(continentOfRegion(r.id)).toBeTruthy();
    for (const c of CONTINENTS.filter((x) => x.tier === "CORE")) expect(c.regions.length).toBeGreaterThan(0);
  });
});

describe("continent worlds on the live map", () => {
  it("each region centre lies in its own continent's world", () => {
    for (const r of REGIONS) expect(worldAt(r.x, r.z)).toBe(continentOfRegion(r.id)!);
  });
  it("Neon City's whole plateau, the Nexus hub and its suburb are all Aetheria", () => {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      expect(worldAt(NEON_SITE.x + Math.cos(a) * NEON_FLAT, NEON_SITE.z + Math.sin(a) * NEON_FLAT)).toBe("aetheria");
    }
    const nexus = REGIONS.find((r) => r.id === "nexus")!;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) expect(worldAt(nexus.x + Math.cos(a) * 40, nexus.z + Math.sin(a) * 40)).toBe("aetheria");
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) expect(worldAt(NEXUS_SUBURB.x + Math.cos(a) * NEXUS_SUBURB.r, NEXUS_SUBURB.z + Math.sin(a) * NEXUS_SUBURB.r)).toBe("aetheria");
  });
  it("every landmark stands in the world of its own region", () => {
    for (const l of LANDMARKS) {
      const want = l.regionId === "thalassia" ? "thalassia" : l.regionId === "neon" ? "aetheria" : continentOfRegion(l.regionId);
      expect(`${l.id}:${worldAt(l.x, l.z)}`).toBe(`${l.id}:${want}`);
    }
  });
  it("every activity area sits in one world at its centre", () => {
    for (const [id, a] of Object.entries(AREAS)) expect(`${id}:${worldAt(a.x, a.z)}`).toMatch(/:(aetheria|veyloria|sylvaris|kharos|frosthelm|pyrrath|thalassia)$/);
  });
});

describe("Thalassia is off the coast, not part of a continent", () => {
  it("its city and water are their own space", () => {
    expect(worldAt(THALASSIA_CENTER.x, THALASSIA_CENTER.z)).toBe("thalassia");
    expect(worldAt(THALASSIA_CENTER.x + THALASSIA_ZONE_RADIUS - 5, THALASSIA_CENTER.z)).toBe("thalassia");
  });
  it("you can cross only between it and Veyloria's coast; other continents are borders", () => {
    expect(crossingAllowed("veyloria", "thalassia")).toBe(true);
    expect(crossingAllowed("thalassia", "veyloria")).toBe(true);
    expect(crossingAllowed("sylvaris", "thalassia")).toBe(false);
    expect(crossingAllowed("veyloria", "aetheria")).toBe(false);
    expect(crossingAllowed("kharos", "kharos")).toBe(true);
  });
  it("the sea lane from Veyloria to the city never passes through another continent", () => {
    const v = REGIONS.find((r) => r.id === "veridan")!;
    for (let t = 0; t <= 1; t += 0.01) {
      const w = worldAt(v.x + (THALASSIA_CENTER.x - v.x) * t, v.z + (THALASSIA_CENTER.z - v.z) * t);
      expect(["veyloria", "thalassia"]).toContain(w);
    }
  });
  it("walking from Verdant toward Nexus is stopped at the border", () => {
    const v = REGIONS.find((r) => r.id === "veridan")!, n = REGIONS.find((r) => r.id === "nexus")!;
    let blocked = false;
    for (let t = 0; t < 1; t += 0.002) {
      const x0 = v.x + (n.x - v.x) * t, z0 = v.z + (n.z - v.z) * t, x1 = v.x + (n.x - v.x) * (t + 0.002), z1 = v.z + (n.z - v.z) * (t + 0.002);
      if (borderBlocks(x0, z0, x1, z1).blocked) { blocked = true; break; }
    }
    expect(blocked).toBe(true);
  });
});
