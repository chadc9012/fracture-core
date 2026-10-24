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

/** a block given over to a walk-in residence (residences.ts) instead of a tower; `rot` turns its door (local +z) to face the city centre */
export type HomeLot = { x: number; z: number; rot: 0 | 1 | 2 | 3 };
/** room a residence needs around a lot centre (largest Neon design, residences.ts, is 16 x 18 m plus its porch) */
export const HOME_REACH = 13.5;

/** extra keep-out points (local), e.g. shop counters and interior doors, supplied by the caller so this module stays leaf-level */
export function neonTowers(keepOut: readonly { x: number; z: number; r: number }[] = []): TowerPlacement[] {
  return neonLayout(keepOut).towers;
}

/** the clearance test the grid is laid out with (local coordinates): a rectangle of half-extents ex, ez centred at x, z
 * stays on the plateau and clear of the market core, district cores, spire, skate shop, race loop, rails, maglev and
 * the caller's keep-out points. Also used to fit things in after the grid (residence garages). */
export function neonClearance(keepOut: readonly { x: number; z: number; r: number }[] = []) {
  const segs = paths();
  const discs = [
    ...NEON_DISTRICTS.map((d) => ({ x: d.dx, z: d.dz, r: d.radius + MARGIN })),
    { x: SPIRE.x, z: SPIRE.z, r: SPIRE.base + 12 },
    { x: SKATE_SHOP_OFFSET.x, z: SKATE_SHOP_OFFSET.z, r: 12 },
    ...keepOut,
  ];
  // market avenue, Grid deck and the drone lanes above it
  const coreX = DECK.halfX + DECK.width + MARGIN + 4, coreZ = DECK.halfZ + DECK.width + MARGIN + 4;
  const lim = NEON_FLAT - 10;
  return (x: number, z: number, ex: number, ez: number) => {
    const reach = Math.hypot(ex, ez);
    return Math.hypot(x, z) + reach <= lim && !(Math.abs(x) < coreX + ex && Math.abs(z) < coreZ + ez)
      && !discs.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + reach) && !segs.some((s) => segDist(s, x, z) < s.half + reach);
  };
}

/** the whole grid: towers, plus a few outer blocks (spread round the city) that hold residences instead */
export function neonLayout(keepOut: readonly { x: number; z: number; r: number }[] = []): { towers: TowerPlacement[]; homes: HomeLot[] } {
  const clear = neonClearance(keepOut);
  const out: TowerPlacement[] = [];
  const lim = NEON_FLAT - 10;
  const n = Math.floor(lim / BLOCK);
  // residences take outer blocks with room for the largest design, picked evenly round the compass
  const want = NEON_FLAT >= 150 ? 4 : NEON_FLAT >= 120 ? 2 : 0;
  const spots: { x: number; z: number; a: number }[] = [];
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const x = i * BLOCK, z = j * BLOCK;
    if (Math.hypot(x, z) >= 70 && clear(x, z, HOME_REACH / Math.SQRT2, HOME_REACH / Math.SQRT2)) spots.push({ x, z, a: Math.atan2(z, x) });
  }
  spots.sort((p, q) => p.a - q.a);
  const homes: HomeLot[] = [];
  if (want && spots.length) for (let k = 0; k < Math.min(want, spots.length); k++) {
    const s = spots[Math.floor((k * spots.length) / Math.min(want, spots.length))]!;
    // door toward the centre: local +z turned by rot quarter-turns is (sin, cos) of rot·π/2
    const r = Math.round(Math.atan2(-s.x, -s.z) / (Math.PI / 2));
    homes.push({ x: s.x, z: s.z, rot: (((r % 4) + 4) % 4) as 0 | 1 | 2 | 3 });
  }
  const taken = new Set(homes.map((h) => `${h.x},${h.z}`));
  let seed = 9001;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const x = i * BLOCK, z = j * BLOCK;
    const pick = rnd(), turn = rnd(), tint = rnd();
    if (taken.has(`${x},${z}`)) continue;
    const d = Math.hypot(x, z);
    const pool = d < 75 ? TALL : d < 115 ? MID : LOW;
    const variant = pool[Math.floor(pick * pool.length)]!;
    const rot = (Math.floor(turn * 4) % 4) as 0 | 1 | 2 | 3;
    const [hx, hz] = TOWER_FOOTPRINT[variant];
    const ex = rot % 2 ? hz : hx, ez = rot % 2 ? hx : hz;
    if (!clear(x, z, ex, ez)) continue;
    out.push({ x, z, variant, rot, glow: GLOWS[Math.floor(tint * GLOWS.length)]! });
  }
  return { towers: out, homes };
}

/** the same placements in world coordinates */
export const neonTowersWorld = (keepOut: readonly { x: number; z: number; r: number }[] = []) => neonLayoutWorld(keepOut).towers;

export function neonLayoutWorld(keepOut: readonly { x: number; z: number; r: number }[] = []) {
  const l = neonLayout(keepOut.map((k) => ({ x: k.x - NEON_SITE.x, z: k.z - NEON_SITE.z, r: k.r })));
  return { towers: l.towers.map((t) => ({ ...t, x: t.x + NEON_SITE.x, z: t.z + NEON_SITE.z })), homes: l.homes.map((h) => ({ ...h, x: h.x + NEON_SITE.x, z: h.z + NEON_SITE.z })) };
}

export type NeonLamp = { x: number; z: number; yaw: number; glow: string };
/** Street lamps for the tower grid (local coordinates): one on each street-facing corner of every tower block, its arm reaching
 * over the street and its pool tinted by the block's sign colour, so the wet streets between the towers are lit at night.
 * Only where the clearance test allows a lamp post (never on the race boulevard, rails, district cores or shop doors). */
export function neonStreetLights(keepOut: readonly { x: number; z: number; r: number }[] = []): NeonLamp[] {
  const clear = neonClearance(keepOut);
  const seen = new Set<string>(), out: NeonLamp[] = [];
  const k = BLOCK * 0.36;
  for (const t of neonLayout(keepOut).towers) for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const x = t.x + sx * k, z = t.z + sz * k, key = `${Math.round(x)},${Math.round(z)}`;
    if (seen.has(key) || !clear(x, z, 0.6, 0.6)) continue;
    seen.add(key);
    out.push({ x, z, yaw: Math.atan2(sx, sz), glow: t.glow });
  }
  return out;
}
export const neonStreetLightsWorld = (keepOut: readonly { x: number; z: number; r: number }[] = []) =>
  neonStreetLights(keepOut.map((q) => ({ x: q.x - NEON_SITE.x, z: q.z - NEON_SITE.z, r: q.r }))).map((l) => ({ ...l, x: l.x + NEON_SITE.x, z: l.z + NEON_SITE.z }));

/** Pools of light for the city core the tower grid leaves out (local coordinates): both kerbs of the market avenue and
 * round the inside of the Grid deck, whose span shades the streets below it at night. Colours alternate magenta/cyan. */
export function neonCorePools(): NeonLamp[] {
  const out: NeonLamp[] = [];
  for (let z = -30; z <= 30; z += 6) for (const x of [-5.5, 5.5]) out.push({ x, z, yaw: x < 0 ? Math.PI / 2 : -Math.PI / 2, glow: x < 0 ? "#ff2ea6" : "#38e8ff" });
  const hx = DECK.halfX - 3, hz = DECK.halfZ - 3;
  for (let x = -hx; x <= hx; x += 10) for (const z of [-hz, hz]) out.push({ x, z, yaw: 0, glow: GLOWS[(Math.round(x / 10) + 10) % GLOWS.length]! });
  for (let z = -hz + 10; z <= hz - 10; z += 10) for (const x of [-hx, hx]) out.push({ x, z, yaw: 0, glow: GLOWS[(Math.round(z / 10) + 12) % GLOWS.length]! });
  return out;
}
