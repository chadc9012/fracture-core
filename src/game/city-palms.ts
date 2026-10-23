/** City palms (public/models/foliage/palm-a/b/c.glb, scripts/build-palms.py): the reference boards line every boulevard
 * with them. Pure placement: Nexus hub plaza ring, the middle of every Nexus district block face (between the street
 * lights, on the pavement), and the two street-front corners of every Neon City tower. Nothing lands inside a building. */
import { NEXUS, BLOCK, blocks } from "./nexus-districts";
import { TOWER_FOOTPRINT, type TowerPlacement } from "./neon-layout";
import { heightAt, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { mulberry32 } from "./rng";

export type Palm = { x: number; z: number; variant: 0 | 1 | 2; yaw: number; scale: number };

const ok = (x: number, z: number) => heightAt(x, z) > WATER_LEVEL + 0.5 && distanceToRoad(x, z) >= LANE_HALF_WIDTH;

export function nexusPalms(): Palm[] {
  const rnd = mulberry32(0x9a1e);
  const out: Palm[] = [];
  const pick = (): Palm["variant"] => (Math.floor(rnd() * 3) as Palm["variant"]);
  // plaza ring inside the hub, clear of the spawn lane to the south
  const r = NEXUS.radius * 0.62;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const x = NEXUS.x + Math.cos(a) * r, z = NEXUS.z + Math.sin(a) * r;
    if (Math.abs(x - NEXUS.x) < 5 && z > NEXUS.z) continue;
    out.push({ x, z, variant: pick(), yaw: rnd() * Math.PI * 2, scale: 0.9 + rnd() * 0.25 });
  }
  for (const b of blocks()) {
    const h = BLOCK / 2 - 1.1;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = b.x + nx * h, z = b.z + nz * h;
      if (ok(x, z)) out.push({ x, z, variant: pick(), yaw: rnd() * Math.PI * 2, scale: 0.85 + rnd() * 0.3 });
    }
  }
  return out;
}

export function neonPalms(towers: readonly TowerPlacement[]): Palm[] {
  const rnd = mulberry32(0x3e0f);
  const out: Palm[] = [];
  for (const t of towers) {
    const [hx, hz] = TOWER_FOOTPRINT[t.variant];
    const a = (t.rot * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
    for (const side of [-1, 1]) {
      const lx = side * (hx - 0.8), lz = hz + 2.2; // street-front corners, on the pavement outside the podium
      const x = t.x + lx * c + lz * s, z = t.z - lx * s + lz * c;
      if (ok(x, z)) out.push({ x, z, variant: (Math.floor(rnd() * 3) as Palm["variant"]), yaw: rnd() * Math.PI * 2, scale: 0.9 + rnd() * 0.35 });
    }
  }
  return out;
}
