// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { BOARD, CONTINENTS, GLOBE, OCEANS, PLANET, THALASSIA_ZONE_RADIUS, borderBlocks, continentById, continentOfRegion, crossingAllowed, worldAt, worldName } from "./planet";
import { TERMINALS } from "./travel";
import { NEON_FLAT, NEON_SITE, NEXUS_SUBURB, REGIONS } from "./world";
import { LANDMARKS } from "./landmarks";
import { THALASSIA_CENTER } from "./thalassia-site";
import { AREAS } from "./activities";

const worldOfRegion = (id: string) => continentOfRegion(id)?.world;

describe("the planet: the canon board, 12 continents and 7 oceans (owner, Nov 1 2026)", () => {
  it("has the board's twelve continents and seven oceans, in its list order", () => {
    expect(CONTINENTS.map((c) => c.name)).toEqual(["Nexus City", "Neon City", "Verdant Forest", "Thalassia", "Frost Spire", "Scorched Plains", "Wastelands", "Crystal Badlands", "Storm Islands", "The Shattered Reefs", "Ember Peaks", "Shrouded Swamps"]);
    expect(CONTINENTS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(OCEANS.map((o) => o.name)).toEqual(["Aurora Ocean", "Fracture Ocean", "Solara Ocean", "Silent Ocean", "Obsidian Ocean", "Tempest Ocean", "Echo Ocean"]);
    expect([PLANET.majorContinents, PLANET.majorOceans]).toEqual([12, 7]);
    expect(PLANET.diameterKm).toBe(12742);
    expect(Math.round(PLANET.surfaceKm2 / 100_000) / 10).toBe(510.1);
    expect(PLANET.polarDiameterKm).toBeLessThan(PLANET.diameterKm);
  });
  it("keeps the design bible's protected geography", () => {
    // Neon City is its own continent, not Nexus City
    expect(continentOfRegion("neon")!.id).toBe("neon-city");
    expect(continentOfRegion("nexus")!.id).toBe("nexus-city");
    // Vyrak's lair stays in the Solara Desert, on the Scorched Plains
    expect(continentOfRegion("solara")!.id).toBe("scorched-plains");
    expect(continentById("scorched-plains")!.places.some((p) => p.name === "Solara Desert" && p.live === "solara")).toBe(true);
    // Thalassia is offshore from the Verdant Forest, its own water, reached from the Verdant shore
    expect(continentOfRegion("thalassia")!.world).toBe("thalassia");
    expect(continentById("thalassia")!.look).toContain("Verdant");
    expect(continentOfRegion("veridan")!.id).toBe("verdant-forest");
    expect(continentOfRegion("riverdale")!.id).toBe("verdant-forest");
  });
  it("every game region has a continent, every playable continent has a world and regions", () => {
    for (const r of REGIONS) expect(continentOfRegion(r.id)).toBeTruthy();
    for (const c of CONTINENTS.filter((x) => x.tier === "CORE")) { expect(c.regions.length).toBeGreaterThan(0); expect(c.world).toBeTruthy(); }
    for (const c of CONTINENTS.filter((x) => x.tier === "BACKDROP")) expect(c.world).toBeNull();
  });
  it("every live place on a continent is a real terminal or region, and world names list their continents", () => {
    const regionIds = new Set([...REGIONS.map((r) => r.id), "neon", "riverdale", "thalassia"]);
    for (const c of CONTINENTS) for (const p of c.places) if (p.live) {
      if (p.live.startsWith("terminal:")) expect(`${c.id}:${TERMINALS.some((t) => t.id === p.live)}`).toBe(`${c.id}:true`);
      else if (!p.live.startsWith("seaport:")) expect(regionIds.has(p.live)).toBe(true);
    }
    expect(worldName("kharos")).toBe("Scorched Plains · Wastelands");
    expect(worldName("aetheria")).toBe("Nexus City · Neon City · Verdant Forest");
    expect(worldName("thalassia")).toBe("Thalassia");
  });
  it("pins and list rows sit on the board, and no two continents' frames collide", () => {
    for (const c of [...CONTINENTS, ...OCEANS] as { panel: { x: number; y: number; w: number; h: number } }[]) {
      expect(c.panel.x + c.panel.w).toBeLessThanOrEqual(BOARD.w); expect(c.panel.y + c.panel.h).toBeLessThanOrEqual(BOARD.h);
    }
    for (const c of CONTINENTS) {
      expect(Math.hypot(c.pin.x - GLOBE.x, c.pin.y - GLOBE.y)).toBeLessThan(GLOBE.r);
      for (const d of CONTINENTS) if (d !== c) expect(Math.abs(c.pin.x - d.pin.x) > 100 || Math.abs(c.pin.y - d.pin.y) > 60).toBe(true);
    }
  });
});

describe("continent worlds on the live map", () => {
  it("each region centre lies in its own continent's world", () => {
    for (const r of REGIONS) expect(worldAt(r.x, r.z)).toBe(worldOfRegion(r.id)!);
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
      const want = worldOfRegion(l.regionId);
      expect(`${l.id}:${worldAt(l.x, l.z)}`).toBe(`${l.id}:${want}`);
    }
  });
  it("every activity area sits in one world at its centre", () => {
    for (const [id, a] of Object.entries(AREAS)) expect(`${id}:${worldAt(a.x, a.z)}`).toMatch(/:(aetheria|sylvaris|kharos|frosthelm|pyrrath|thalassia)$/);
  });
});

describe("Thalassia is off the coast, not part of a continent", () => {
  it("its city and water are their own space", () => {
    expect(worldAt(THALASSIA_CENTER.x, THALASSIA_CENTER.z)).toBe("thalassia");
    expect(worldAt(THALASSIA_CENTER.x + THALASSIA_ZONE_RADIUS - 5, THALASSIA_CENTER.z)).toBe("thalassia");
  });
  it("you can cross only between it and Aetheria's coast; other continents are borders", () => {
    expect(crossingAllowed("aetheria", "thalassia")).toBe(true);
    expect(crossingAllowed("thalassia", "aetheria")).toBe(true);
    expect(crossingAllowed("sylvaris", "thalassia")).toBe(false);
    expect(crossingAllowed("aetheria", "kharos")).toBe(false);
    expect(crossingAllowed("kharos", "kharos")).toBe(true);
  });
  it("the sea lane from the Verdant shore to the city never passes through another continent", () => {
    const v = REGIONS.find((r) => r.id === "veridan")!;
    for (let t = 0; t <= 1; t += 0.01) {
      const w = worldAt(v.x + (THALASSIA_CENTER.x - v.x) * t, v.z + (THALASSIA_CENTER.z - v.z) * t);
      expect(["aetheria", "thalassia"]).toContain(w);
    }
  });
  it("walking from Verdant toward Solara is stopped at the border", () => {
    const v = REGIONS.find((r) => r.id === "veridan")!, n = REGIONS.find((r) => r.id === "solara")!;
    let blocked = false;
    for (let t = 0; t < 1; t += 0.002) {
      const x0 = v.x + (n.x - v.x) * t, z0 = v.z + (n.z - v.z) * t, x1 = v.x + (n.x - v.x) * (t + 0.002), z1 = v.z + (n.z - v.z) * (t + 0.002);
      if (borderBlocks(x0, z0, x1, z1).blocked) { blocked = true; break; }
    }
    expect(blocked).toBe(true);
  });
});
