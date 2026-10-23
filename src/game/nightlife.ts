/** Neon City's nightlife venues (the owner's nightlife board, kept from the uploaded nightlife phase): Pulse Array and
 * Afterglow (nightclubs), Velvet Circuit (a 21+ cabaret lounge — exterior signage only) and Crown Casino. Each venue
 * takes over the tower lot nearest its spot on the board, so it inherits a cleared, street-facing block without moving
 * any tower, home or race route; NeonTowerBlocks skips those towers and NeonVenues builds the venues there. Pure. */
import { TOWER_FOOTPRINT, type TowerPlacement } from "./neon-layout";
import { NEON_SITE } from "./world";

export type Venue = { id: string; name: string; sub: string; kind: "nightclub" | "lounge" | "casino"; color: string; accent: string; dx: number; dz: number };
export const VENUES: readonly Venue[] = [
  { id: "pulse-array", name: "PULSE ARRAY", sub: "NEON CITY NIGHTCLUB", kind: "nightclub", color: "#35efff", accent: "#7a5cff", dx: 26, dz: 52 },
  { id: "afterglow", name: "AFTERGLOW", sub: "NEON CITY NIGHTCLUB", kind: "nightclub", color: "#ff3b9d", accent: "#ff7a3a", dx: -26, dz: 52 },
  { id: "velvet-circuit", name: "VELVET CIRCUIT", sub: "21+ CABARET LOUNGE", kind: "lounge", color: "#c040ff", accent: "#ff4fa8", dx: 26, dz: 86 },
  { id: "crown-casino", name: "CROWN CASINO", sub: "CASINO · HOTEL", kind: "casino", color: "#ffc247", accent: "#ff8a2a", dx: -104, dz: -26 },
];

export type VenueLot = { venue: Venue; x: number; z: number; rot: 0 | 1 | 2 | 3; hx: number; hz: number; tower: TowerPlacement };

export function venueLots(towers: readonly TowerPlacement[]): VenueLot[] {
  const used = new Set<TowerPlacement>();
  const out: VenueLot[] = [];
  for (const v of VENUES) {
    const tx = NEON_SITE.x + v.dx, tz = NEON_SITE.z + v.dz;
    let best: TowerPlacement | null = null, bd = Infinity;
    for (const t of towers) { if (used.has(t)) continue; const d = Math.hypot(t.x - tx, t.z - tz); if (d < bd) { bd = d; best = t; } }
    if (!best) continue;
    used.add(best);
    const [hx, hz] = TOWER_FOOTPRINT[best.variant];
    // face the venue's entrance toward the city centre (local +z turned by rot quarter-turns)
    const r = Math.round(Math.atan2(NEON_SITE.x - best.x, NEON_SITE.z - best.z) / (Math.PI / 2));
    out.push({ venue: v, x: best.x, z: best.z, rot: (((r % 4) + 4) % 4) as VenueLot["rot"], hx, hz, tower: best });
  }
  return out;
}
