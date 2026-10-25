/** The broken horizon (trailer references, docs/trailer-references.md): shattered chunks of the old world hanging in the far sky — rock
 * islands with ruined towers on top, debris trailing beneath, and one inverted city block hanging upside down. Like the sky dome they travel
 * with the player (they are scenery on the horizon, never reachable), so this is pure layout in player-relative metres; BrokenHorizon.tsx draws
 * it inside the sky group so it hides underwater with the sky. Seeded, so every client sees the same skyline. */
import { mulberry32 } from "./rng";
import { SKY_BODY, riftPoint } from "./sky-dome";

export type HorizonTower = { dx: number; dz: number; w: number; d: number; h: number; lit: boolean };
export type HorizonIsland = {
  /** player-relative position (m) */
  x: number; y: number; z: number;
  /** top radius and rock depth (the rock is an inverted cone below the top) */
  r: number; depth: number;
  towers: HorizonTower[];
  /** small chunks hanging below, player-relative offsets from the island centre */
  debris: { dx: number; dy: number; dz: number; s: number }[];
  /** the upside-down city block: towers hang below the rock instead of standing on it */
  inverted: boolean;
  spin: number; bob: number; phase: number;
};

export const HORIZON_DIST = 1250;
/** below the camera far plane (1800) with room for the largest island */
export const HORIZON_MAX_REACH = 1600;

const az = (v: readonly number[]) => Math.atan2(v[2]!, v[0]!);

export function brokenHorizon(seed = 7): HorizonIsland[] {
  const rnd = mulberry32(seed);
  const rift = az(riftPoint(0.7)), moon = az(SKY_BODY.dir);
  // a cluster under the rift (it tore them loose), a few on the far sides, none in front of the Fracture Moon
  const azimuths = [rift - 0.32, rift - 0.12, rift + 0.06, rift + 0.24, rift + 0.5, rift + 1.4, rift - 1.3, rift + 2.3, rift - 2.2];
  const out: HorizonIsland[] = [];
  azimuths.forEach((a, i) => {
    let ang = a;
    const dm = Math.atan2(Math.sin(ang - moon), Math.cos(ang - moon));
    if (Math.abs(dm) < 0.55) ang = moon + Math.sign(dm || 1) * 0.55;
    const dist = HORIZON_DIST * (0.88 + rnd() * 0.22);
    const r = 45 + rnd() * 70;
    const inverted = i === 2;
    const towers: HorizonTower[] = [];
    const nt = inverted ? 7 : 2 + Math.floor(rnd() * 4);
    for (let t = 0; t < nt; t++) {
      const rr = Math.sqrt(rnd()) * r * 0.62, ta = rnd() * Math.PI * 2;
      towers.push({ dx: Math.cos(ta) * rr, dz: Math.sin(ta) * rr, w: 8 + rnd() * 14, d: 8 + rnd() * 14, h: (inverted ? 40 : 18) + rnd() * (inverted ? 70 : 55), lit: rnd() < 0.6 });
    }
    const debris = Array.from({ length: 3 + Math.floor(rnd() * 4) }, () => ({ dx: (rnd() - 0.5) * r * 1.4, dy: -(r * 0.6 + rnd() * r * 1.4), dz: (rnd() - 0.5) * r * 1.4, s: 4 + rnd() * 12 }));
    out.push({
      x: Math.cos(ang) * dist, z: Math.sin(ang) * dist, y: 240 + rnd() * 260 + (inverted ? 120 : 0), // live check: at 130-360 m they sat just over the hills and read as clutter, not sky
      r, depth: r * (1.1 + rnd() * 0.8), towers, debris, inverted,
      spin: (rnd() - 0.5) * 0.01, bob: 3 + rnd() * 6, phase: rnd() * Math.PI * 2,
    });
  });
  // the owner's target frame (wilds by day): the sky is full of smaller floating islands at every distance, not just a few on the horizon
  for (let k = 0, guard = 0; k < 24 && guard < 400; guard++) {
    const ang = rnd() * Math.PI * 2;
    const dm = Math.atan2(Math.sin(ang - moon), Math.cos(ang - moon));
    if (Math.abs(dm) < 0.55) continue;
    const dist = 620 + rnd() * 720, r = 18 + Math.pow(rnd(), 1.5) * 44; // target frame: big enough to read as islands with buildings, not specks
    const y = Math.max(150, dist * (0.22 + rnd() * 0.3));
    if (out.some((o) => Math.hypot(o.x - Math.cos(ang) * dist, o.y - y, o.z - Math.sin(ang) * dist) < (o.r + r) * 1.6)) continue;
    const towers: HorizonTower[] = [];
    for (let t = 0, nt = rnd() < 0.6 ? 1 + Math.floor(rnd() * 3) : 0; t < nt; t++) {
      const rr = Math.sqrt(rnd()) * r * 0.5, ta = rnd() * Math.PI * 2;
      towers.push({ dx: Math.cos(ta) * rr, dz: Math.sin(ta) * rr, w: 3 + rnd() * r * 0.25, d: 3 + rnd() * r * 0.25, h: 6 + rnd() * r * 0.9, lit: rnd() < 0.4 });
    }
    const debris = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ dx: (rnd() - 0.5) * r, dy: -(r * 0.8 + rnd() * r * 1.5), dz: (rnd() - 0.5) * r, s: 1.5 + rnd() * r * 0.2 }));
    out.push({ x: Math.cos(ang) * dist, z: Math.sin(ang) * dist, y, r, depth: r * (1.2 + rnd() * 1.1), towers, debris, inverted: false, spin: (rnd() - 0.5) * 0.02, bob: 2 + rnd() * 4, phase: rnd() * Math.PI * 2 });
    k++;
  }
  return out;
}
