/** Neon City's tower blocks: a street grid laid over the city plateau (world.ts NEON_FLAT), one authored tower per block
 * (public/models/city/neon-towers.glb, scripts/build-city.py), kept clear of everything the city already uses — the market
 * avenue and Grid deck, the three district cores, the Aegis Spire, the Rust-Muck race loop, the grind rails and maglev,
 * and every shop counter and door. Pure and deterministic so the layout is testable and identical on every client.
 * Coordinates here are local to the city centre unless a function says otherwise. */
import { NEON_DISTRICTS, RACE_GATES } from "./neon-districts";
import { SPIRE, DECK } from "./neon-tiers";
import { RAILS, worldRails } from "./maggrind";
import { MAGLEV_LINES } from "./maglev";
import { NEON_FLAT, NEON_SITE } from "./world";
import { SKATE_SHOP_OFFSET } from "./skate-boots";

export type TowerVariant = "A" | "B" | "C" | "D" | "E" | "F";
/** footprint half-extents (x, z) of each authored variant's podium, metres (build-city.py VARIANTS) */
export const TOWER_FOOTPRINT: Record<TowerVariant, [number, number]> = { A: [6, 6], B: [7, 6], C: [5, 5], D: [8, 5], E: [6, 7], F: [9, 7] };
const TALL: TowerVariant[] = ["E", "C", "A", "B"];
const MID: TowerVariant[] = ["E", "A", "B", "F", "C"];
const LOW: TowerVariant[] = ["D", "F", "B", "A"];

export type TowerPlacement = { x: number; z: number; variant: TowerVariant; rot: 0 | 1 | 2 | 3; glow: string };

export const BLOCK = 26;          // street grid pitch: a 16-18 m block plus an 8-10 m street
const MARGIN = 6;                 // clearance around anything the city already uses
const RACE_HALF = 14;             // the race loop stays a wide boulevard
export const GLOWS = ["#ff2ea6", "#38e8ff", "#b968ff", "#39ff7a", "#ffcf3a"];

type Seg = { ax: number; az: number; bx: number; bz: number; half: number };
const segDist = (s: Seg, x: number, z: number) => {
  const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez || 1;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * ex + (z - s.az) * ez) / l2));
  return Math.hypot(s.ax + ex * t - x, s.az + ez * t - z);
};

function paths(): Seg[] {
  const out: Seg[] = [];
  RACE_GATES.forEach((g, i) => { const n = RACE_GATES[(i + 1) % RACE_GATES.length]!; out.push({ ax: g.dx, az: g.dz, bx: n.dx, bz: n.dz, half: RACE_HALF }); });
  const lines = [...worldRails({ x: 0, z: 0 }, () => 0, RAILS), ...worldRails({ x: 0, z: 0 }, () => 0, MAGLEV_LINES.map((l) => l.rail))];
  for (const r of lines) {
    const n = r.closed ? r.pts.length : r.pts.length - 1;
    for (let i = 0; i < n; i++) { const a = r.pts[i]!, b = r.pts[(i + 1) % r.pts.length]!; out.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, half: 8 }); }
  }
  return out;
}

/** extra keep-out points (local), e.g. shop counters and interior doors, supplied by the caller so this module stays leaf-level */
export function neonTowers(keepOut: readonly { x: number; z: number; r: number }[] = []): TowerPlacement[] {
  const segs = paths();
  const discs = [
    ...NEON_DISTRICTS.map((d) => ({ x: d.dx, z: d.dz, r: d.radius + MARGIN })),
    { x: SPIRE.x, z: SPIRE.z, r: SPIRE.base + 12 },
    { x: SKATE_SHOP_OFFSET.x, z: SKATE_SHOP_OFFSET.z, r: 12 },
    ...keepOut,
  ];
  // market avenue, Grid deck and the drone lanes above it
  const coreX = DECK.halfX + DECK.width + MARGIN + 4, coreZ = DECK.halfZ + DECK.width + MARGIN + 4;
  const out: TowerPlacement[] = [];
  const lim = NEON_FLAT - 10;
  const n = Math.floor(lim / BLOCK);
  let seed = 9001;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const x = i * BLOCK, z = j * BLOCK;
    const pick = rnd(), turn = rnd(), tint = rnd();
    const d = Math.hypot(x, z);
    const pool = d < 75 ? TALL : d < 115 ? MID : LOW;
    const variant = pool[Math.floor(pick * pool.length)]!;
    const rot = (Math.floor(turn * 4) % 4) as 0 | 1 | 2 | 3;
    const [hx, hz] = TOWER_FOOTPRINT[variant];
    const ex = rot % 2 ? hz : hx, ez = rot % 2 ? hx : hz;
    const reach = Math.hypot(ex, ez);
    if (d + reach > lim) continue;
    if (Math.abs(x) < coreX + ex && Math.abs(z) < coreZ + ez) continue;
    if (discs.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + reach)) continue;
    if (segs.some((s) => segDist(s, x, z) < s.half + reach)) continue;
    out.push({ x, z, variant, rot, glow: GLOWS[Math.floor(tint * GLOWS.length)]! });
  }
  return out;
}

/** the same placements in world coordinates */
export const neonTowersWorld = (keepOut: readonly { x: number; z: number; r: number }[] = []) =>
  neonTowers(keepOut.map((k) => ({ x: k.x - NEON_SITE.x, z: k.z - NEON_SITE.z, r: k.r }))).map((t) => ({ ...t, x: t.x + NEON_SITE.x, z: t.z + NEON_SITE.z }));
