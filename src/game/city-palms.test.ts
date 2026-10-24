import { describe, expect, test } from "bun:test";
import { neonPalms, nexusPalms, palmSolids } from "./city-palms";
import { buildings } from "./nexus-districts";
import { TOWER_FOOTPRINT, neonTowersWorld } from "./neon-layout";
import { addObstacle, resetObstacles } from "./obstacles";
import { boomClearance } from "./camera-occlusion";
import { walkHeight } from "./terrain";

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

describe("palm trunks are solid", () => {
  // Regression: palms were never in the obstacle grid, so the third-person camera sat behind a trunk (a screen of bark in Nexus)
  // and players walked through them.
  test("every palm has a trunk-sized solid, and a palm behind the player pulls the camera in front of it", () => {
    const palms = nexusPalms();
    const solids = palmSolids(palms);
    expect(solids.length).toBe(palms.length);
    for (const s of solids) { expect(s.r).toBeGreaterThan(0.2); expect(s.r).toBeLessThan(0.5); }
    const p = palms[0]!;
    resetObstacles();
    for (const s of solids) addObstacle("tree", s.x, s.z, s.r, 1e9, 1);
    const head = { x: p.x, y: walkHeight(p.x, p.z) + 1.7, z: p.z + 2.5 };
    const cam = { x: p.x, y: head.y + 1.5, z: p.z - 2.5 };
    expect(boomClearance(head, cam)).toBeLessThan(0.6);
    resetObstacles();
  });
});
