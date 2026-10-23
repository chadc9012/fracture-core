import { describe, expect, test } from "bun:test";
import { neonPalms, nexusPalms } from "./city-palms";
import { buildings } from "./nexus-districts";
import { TOWER_FOOTPRINT, neonTowersWorld } from "./neon-layout";

describe("city palms", () => {
  test("Nexus palms never stand inside a district building", () => {
    const ps = nexusPalms(), bs = buildings();
    expect(ps.length).toBeGreaterThan(40);
    for (const p of ps) for (const b of bs) expect(Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.z - b.z) < b.d / 2).toBe(false);
  });
  test("Neon palms stand outside every tower podium", () => {
    const ts = neonTowersWorld(), ps = neonPalms(ts);
    expect(ps.length).toBeGreaterThan(10);
    for (const p of ps) for (const t of ts) { const [hx, hz] = TOWER_FOOTPRINT[t.variant]; const r = Math.min(hx, hz); expect(Math.hypot(p.x - t.x, p.z - t.z)).toBeGreaterThan(r); }
  });
});
