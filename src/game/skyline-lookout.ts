/** The skyline lookout (owner's trailer: "Operator on a cracked ledge over the skyline, violet energy, drone", listed as planned in
 * docs/trailer-references.md): a cracked rock ledge on the highest open ground looking at the Nexus skyline, with glowing
 * Fracture fissures through it. Pure placement: searched once over a ring outside the city, never on a road, river, mission pad,
 * house or the Neon plateau; the ledge is a walkable deck pointing at Nexus. */
import { NEXUS } from "./nexus-districts";
import { heightAt, neonPlateauWeight, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { placeable } from "./ground-cover";
import { inResidence } from "./residences";
import { regionAt } from "./world";
import type { Deck } from "./district-decks";

export const LEDGE = { length: 7, width: 3.4, lift: 0.45, ramp: 0.9 } as const;
export type Lookout = { x: number; z: number; y: number; dirX: number; dirZ: number };

let cached: Lookout | null | undefined;
/** the lookout spot: high, open ground whose front drops toward Nexus (best of a ring search), facing the city */
export function skylineLookout(): Lookout | null {
  if (cached !== undefined) return cached;
  let best: (Lookout & { score: number }) | null = null;
  const inner = NEXUS.radius * 1.35;
  for (let r = inner; r <= inner + 260; r += 12) {
    for (let a = 0; a < 360; a += 4) {
      const t = (a * Math.PI) / 180, x = NEXUS.x + Math.cos(t) * r, z = NEXUS.z + Math.sin(t) * r;
      const y = heightAt(x, z);
      if (y < WATER_LEVEL + 6) continue;
      if (neonPlateauWeight(x, z) > 0.05 || distanceToRoad(x, z) < LANE_HALF_WIDTH + 6 || inResidence(x, z, 6)) continue;
      if (!placeable(x, z, "rock", regionAt(x, z))) continue;
      const dirX = (NEXUS.x - x) / r, dirZ = (NEXUS.z - z) / r;
      // the ledge must stand on open ground along its whole length, and the land must fall away in front of it
      let ok = true;
      for (const k of [0.3, 0.6, 1]) { const px = x + dirX * LEDGE.length * k, pz = z + dirZ * LEDGE.length * k; if (!placeable(px, pz, "rock", regionAt(px, pz)) || distanceToRoad(px, pz) < LANE_HALF_WIDTH + 4) ok = false; }
      if (!ok) continue;
      const drop = y - heightAt(x + dirX * 30, z + dirZ * 30);
      const score = y + drop * 0.8 - r * 0.01;
      if (!best || score > best.score) best = { x, z, y, dirX, dirZ, score };
    }
  }
  cached = best ? { x: best.x, z: best.z, y: best.y, dirX: best.dirX, dirZ: best.dirZ } : null;
  return cached;
}

/** the walkable top of the ledge: starts at the lookout and runs LEDGE.length toward the city, a little above the rock */
export function lookoutDeck(l: Lookout): Deck {
  const cx = l.x + l.dirX * LEDGE.length / 2, cz = l.z + l.dirZ * LEDGE.length / 2;
  return { id: "skyline-lookout", x: cx, z: cz, dirX: l.dirX, dirZ: l.dirZ, length: LEDGE.length, width: LEDGE.width, top: l.y + LEDGE.lift, base: l.y, ramp: LEDGE.ramp };
}

/** the glowing fissures across the ledge top: a zig-zag of short segments in ledge-local coordinates (along, across), seeded */
export function fissures(seed = 7): { a: [number, number]; b: [number, number] }[] {
  let s = seed; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const out: { a: [number, number]; b: [number, number] }[] = [];
  for (let line = 0; line < 3; line++) {
    let along = -LEDGE.length / 2 + 0.8 + r() * 1.5, across = (r() - 0.5) * LEDGE.width * 0.6;
    for (let k = 0; k < 6 && along < LEDGE.length / 2 - 0.6; k++) {
      const na = along + 0.5 + r() * 0.8, nc = Math.max(-LEDGE.width / 2 + 0.3, Math.min(LEDGE.width / 2 - 0.3, across + (r() - 0.5) * 0.9));
      out.push({ a: [along, across], b: [na, nc] });
      along = na; across = nc;
    }
  }
  return out;
}
