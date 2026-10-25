/** Nexus City's night signage (owner's target frame "Nexus at night": tall violet banners and holographic figure ads on the towers,
 * cyan light strips up the tower corners, all glowing over the wet streets). Pure placement from the district buildings: every sign
 * sits on a face that looks onto a street (away from its own block's centre), a hand's width off the wall, never below the shopfronts. */
import { blocks, buildings, NEXUS, type Building } from "./nexus-districts";
import { mulberry32 } from "./rng";

export type Banner = { x: number; y: number; z: number; /** facing (yaw about +y; the panel's front looks along it) */ yaw: number; w: number; h: number; design: number; color: string };
export type Strip = { x: number; z: number; y0: number; y1: number; color: string };

export const SIGN_COLORS = ["#b45cff", "#38e8ff", "#ff3fb4", "#5a8cff", "#ffb347"] as const;
export const BANNER_DESIGNS = 6;
/** signage only near the hub, where the trailer frame looks (m) */
export const SIGN_RADIUS = 170;

type Face = { nx: number; nz: number };
/** the building's faces that look onto a street: outward normals pointing away from the centre of the block it stands in */
export function streetFaces(b: Building, blockCentre: { x: number; z: number }): Face[] {
  const dx = b.x - blockCentre.x, dz = b.z - blockCentre.z, out: Face[] = [];
  if (Math.abs(dx) > 0.5) out.push({ nx: Math.sign(dx), nz: 0 });
  if (Math.abs(dz) > 0.5) out.push({ nx: 0, nz: Math.sign(dz) });
  // a tower filling its whole block faces a street on every side
  if (!out.length) out.push({ nx: 1, nz: 0 }, { nx: -1, nz: 0 }, { nx: 0, nz: 1 }, { nx: 0, nz: -1 });
  return out;
}

export function nexusSigns(): { banners: Banner[]; screens: Banner[]; strips: Strip[] } {
  const rnd = mulberry32(2117), bl = blocks();
  const banners: Banner[] = [], screens: Banner[] = [], strips: Strip[] = [];
  const near = buildings().filter((b) => Math.hypot(b.x - NEXUS.x, b.z - NEXUS.z) < SIGN_RADIUS && b.floors >= 4);
  for (const b of near) {
    const centre = bl.reduce((a, c) => (Math.hypot(c.x - b.x, c.z - b.z) < Math.hypot(a.x - b.x, a.z - b.z) ? c : a), bl[0]!);
    const faces = streetFaces(b, centre);
    const color = SIGN_COLORS[Math.floor(rnd() * SIGN_COLORS.length)]!;
    const ground = b.base + 1.2;
    for (const f of faces) {
      const half = f.nx !== 0 ? b.d / 2 : b.w / 2;                 // half-width of this face
      const off = (f.nx !== 0 ? b.w / 2 : b.d / 2) + 0.35;          // wall distance from the centre, plus the stand-off
      const yaw = Math.atan2(f.nx, f.nz);
      const along = (s: number) => (f.nx !== 0 ? { x: b.x + f.nx * off, z: b.z + s } : { x: b.x + s, z: b.z + f.nz * off });
      // a tall vertical banner near one corner of the face (on towers tall enough to carry it)
      const bh = Math.min(16, (b.top - ground) * 0.45);
      if (bh > 6 && rnd() < 0.75) {
        const s = (rnd() < 0.5 ? -1 : 1) * Math.max(0, half - 1.6), p = along(s);
        banners.push({ ...p, y: ground + 6 + bh / 2, yaw, w: Math.min(2.6, half * 0.6), h: bh, design: Math.floor(rnd() * BANNER_DESIGNS), color });
      }
      // a wide holographic screen on the broader street faces of the bigger towers
      if (half > 3.8 && b.floors >= 6 && rnd() < 0.5) {
        const sw = Math.min(10, half * 1.3), p = along((rnd() - 0.5) * (half - sw / 2) * 0.6);
        screens.push({ ...p, y: ground + 10 + rnd() * Math.max(2, (b.top - ground) * 0.35), yaw, w: sw, h: sw * 0.56, design: Math.floor(rnd() * BANNER_DESIGNS), color: SIGN_COLORS[Math.floor(rnd() * SIGN_COLORS.length)]! });
      }
    }
    // light strips up the street-side corners of the tall towers
    if (b.floors >= 10) {
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        if (!faces.some((f) => f.nx === sx || f.nz === sz)) continue;
        strips.push({ x: b.x + sx * (b.w / 2 + 0.06), z: b.z + sz * (b.d / 2 + 0.06), y0: ground + 4, y1: b.top - 0.3, color: rnd() < 0.7 ? "#38e8ff" : color });
      }
    }
  }
  return { banners, screens, strips };
}
