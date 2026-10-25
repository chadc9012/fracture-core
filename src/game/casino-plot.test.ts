import { describe, expect, test } from "bun:test";
import { casinoLocation } from "./casino-access";
import { neonKeepOut } from "./residences";
import { neonLayoutWorld, TOWER_FOOTPRINT, CASINO_PLOT as CASINO_KEEP } from "./neon-layout";
import { NEON_SITE } from "./world";
import { cityStreets } from "./city-streets";
import { RACES, worldPoint } from "./racing";

const c = casinoLocation(NEON_SITE), HX = 25, HZ = 28; // footprint used by casinoFloorAt / the combat gate
const overlaps = (x: number, z: number, hx: number, hz: number) => Math.abs(x - c.x) < HX + hx && Math.abs(z - c.z) < HZ + hz;

describe("Skyline Casino plot", () => {
  test("the casino circle covers its whole footprint", () => { expect(Math.hypot(HX, HZ)).toBeLessThanOrEqual(CASINO_KEEP.r); });
  test("no Neon tower or residence is built on it", () => {
    const l = neonLayoutWorld(neonKeepOut());
    for (const t of l.towers) { const [hx, hz] = TOWER_FOOTPRINT[t.variant]; expect(overlaps(t.x, t.z, Math.max(hx, hz), Math.max(hx, hz))).toBe(false); }
    for (const h of l.homes) expect(overlaps(h.x, h.z, 14, 14)).toBe(false);
  });
  test("no street solid (benches, shelters, planters) stands inside it", () => {
    for (const s of cityStreets("neon").solids) expect(overlaps(s.x, s.z, s.hx, s.hz)).toBe(false);
  });
  test("no race gate or leg runs through it", () => {
    for (const r of RACES) for (let i = 1; i < r.points.length; i++) {
      const a = worldPoint(r, i - 1), b = worldPoint(r, i);
      for (let u = 0; u <= 1; u += 0.02) expect(overlaps(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u, 0, 0) ? `${r.id} leg ${i}` : "clear").toBe("clear");
    }
  });
});
