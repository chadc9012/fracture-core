/** Suspension bridges over the sea between landmasses. Pure geometry data; NexusBridge.tsx draws them.
 *
 * - The Nexus Strait Bridge (owner's overlook frame, docs/reference/target-overlook-day.png: a suspension bridge strides over
 *   the water beside Nexus City): east of downtown, over the strait to the Verdant shore.
 * - The Celestial Bridge (owner, planet update Oct 25 2026): Nexus City and Neon City stand on separate landmasses across an
 *   ocean gulf, both Aetheria; the Celestial Bridge joins them: a wide deck with several driving lanes, a protected transit
 *   route down the middle, maintenance walkways under the deck, and viewpoints at the towers overlooking the water.
 *
 * Each span is found on the real terrain (a ray from one city toward the other: the abutments are where the ground leaves the
 * city's level at each shore), so it moves with the coast. The deck is a registered deck with its own approach ramp at each
 * end (walkHeight, the camera and vehicles agree on it). */
import type { Deck } from "./district-decks";
import { heightAt, WATER_LEVEL } from "./terrain";
import { NEON_SITE, REGIONS } from "./world";

export type BridgeSpec = {
  id: string;
  name: string;
  /** abutments (deck ends on land) */
  west: { x: number; z: number };
  east: { x: number; z: number };
  /** deck top at each abutment: the deck runs straight from the one bank's level to the other's */
  topWest: number;
  topEast: number;
  width: number;
  /** pylon positions as a fraction of the span, and their height above the deck */
  towers: readonly number[];
  towerHeight: number;
  /** lowest point of the main cable above the deck, mid-span */
  sag: number;
  /** suspender spacing along the deck */
  hanger: number;
  /** cable planes either side of the centre line */
  cableOffset: number;
  /** the Celestial Bridge's extras: a protected transit route down the median, viewpoints at the towers, cyan cable light */
  celestial: boolean;
};

const NEXUS = REGIONS.find((r) => r.id === "nexus")!;
const VERDANT = REGIONS.find((r) => r.id === "veridan")!;

/** walk from `from` toward `to`: the last stretch of the start's land before the water, and the first of the far land after
 * it. Each abutment stands `inset` metres back on dry ground from where the bank starts to fall to the sea. */
export function spanAcross(from: { x: number; z: number }, to: { x: number; z: number }, inset = 4): { west: { x: number; z: number }; east: { x: number; z: number }; groundW: number; groundE: number } | null {
  const dx = to.x - from.x, dz = to.z - from.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, step = 1;
  let wet0 = -1, wet1 = -1;
  for (let s = 0; s <= L; s += step) {
    const h = heightAt(from.x + ux * s, from.z + uz * s);
    if (h < WATER_LEVEL) { if (wet0 < 0) wet0 = s; wet1 = s; } else if (wet0 >= 0 && s - wet1 > 30) break;
  }
  if (wet0 < 0) return null;
  // back up the banks until the ground stops rising: that is the top of the harbour wall or the bank
  const climb = (s: number, dir: number) => {
    let prev = heightAt(from.x + ux * s, from.z + uz * s);
    for (let k = 0; k < 80; k++) {
      const n = s + dir * step, h = heightAt(from.x + ux * n, from.z + uz * n);
      if (h - prev < 0.08 && h > WATER_LEVEL + 3) return n + dir * inset;
      s = n; prev = h;
    }
    return s + dir * inset;
  };
  const sw = climb(wet0, -1), se = climb(wet1, 1);
  const west = { x: from.x + ux * sw, z: from.z + uz * sw }, east = { x: from.x + ux * se, z: from.z + uz * se };
  return { west, east, groundW: heightAt(west.x, west.z), groundE: heightAt(east.x, east.z) };
}

function makeSpec(id: string, name: string, from: { x: number; z: number }, to: { x: number; z: number }, o: { width: number; towerHeight: number; celestial: boolean }): BridgeSpec | null {
  const s = spanAcross(from, to);
  if (!s) return null;
  return {
    id, name, west: s.west, east: s.east, topWest: s.groundW + 0.05, topEast: s.groundE + 0.05,
    width: o.width, towers: [0.27, 0.73], towerHeight: o.towerHeight, sag: 2.2, hanger: 6, cableOffset: o.width / 2 - 0.3, celestial: o.celestial,
  };
}

/** the Celestial Bridge: Nexus City to Neon City across the gulf */
export const CELESTIAL_BRIDGE: BridgeSpec | null = makeSpec("celestial-bridge", "The Celestial Bridge", NEXUS, NEON_SITE, { width: 26, towerHeight: 72, celestial: true });
/** the Nexus Strait Bridge: east of downtown, to the Verdant shore */
export const NEXUS_STRAIT_BRIDGE: BridgeSpec | null = makeSpec("nexus-strait-bridge", "Nexus Strait Bridge", NEXUS, VERDANT, { width: 13, towerHeight: 46, celestial: false });
export const BRIDGES: readonly BridgeSpec[] = [CELESTIAL_BRIDGE, NEXUS_STRAIT_BRIDGE].filter((b): b is BridgeSpec => !!b);

export type BridgeFrame = { cx: number; cz: number; dirX: number; dirZ: number; length: number; yaw: number; midTop: number; pitch: number };
/** the span's centre, unit direction west→east, length, yaw (rotation about y that maps local +z onto the span), the deck
 * height at mid-span and its pitch (the renderer tilts the span by it so the drawn deck lies on the walked one) */
export function bridgeFrame(b: BridgeSpec): BridgeFrame {
  const { west: a, east: c } = b, dx = c.x - a.x, dz = c.z - a.z, length = Math.hypot(dx, dz);
  return { cx: (a.x + c.x) / 2, cz: (a.z + c.z) / 2, dirX: dx / length, dirZ: dz / length, length, yaw: Math.atan2(dx, dz),
    midTop: (b.topWest + b.topEast) / 2, pitch: Math.atan2(b.topEast - b.topWest, length) };
}

/** deck overlap onto each bank */
export const DECK_LAND = 3;
/** the walkable deck: straight from bank to bank, a few metres onto each */
export function bridgeDeck(b: BridgeSpec): Deck {
  const f = bridgeFrame(b), k = (b.topEast - b.topWest) / f.length;
  return { id: b.id, x: f.cx, z: f.cz, dirX: f.dirX, dirZ: f.dirZ, length: f.length + DECK_LAND * 2, width: b.width, top: b.topWest - k * DECK_LAND, base: b.topWest, ramp: 0, topB: b.topEast + k * DECK_LAND };
}

/** main-cable height above the deck at `u` (0 = west abutment .. 1 = east): anchored at deck level at the ends, over the tower
 * saddles, and a parabola between them sagging to `sag` at mid-span; side spans are parabolas too, from anchor to saddle */
export function cableHeight(b: BridgeSpec, u: number): number {
  const t0 = b.towers[0]!, t1 = b.towers[b.towers.length - 1]!, H = b.towerHeight - 1.5;
  if (u <= t0) { const k = u / t0; return 0.8 + (H - 0.8) * k * k; }
  if (u >= t1) { const k = (1 - u) / (1 - t1); return 0.8 + (H - 0.8) * k * k; }
  const k = (u - (t0 + t1) / 2) / ((t1 - t0) / 2); // -1 .. 1 across the main span
  return b.sag + (H - b.sag) * k * k;
}

/** local positions (along the span from its centre, m) and lengths of every vertical suspender on one cable plane */
export function suspenders(b: BridgeSpec): { along: number; height: number }[] {
  const f = bridgeFrame(b), out: { along: number; height: number }[] = [];
  const n = Math.floor(f.length / b.hanger);
  for (let i = 1; i < n; i++) {
    const u = i / n;
    if (b.towers.some((t) => Math.abs(u - t) * f.length < 2.5)) continue; // no hanger inside a pylon
    const h = cableHeight(b, u);
    if (h > 1.2) out.push({ along: (u - 0.5) * f.length, height: h });
  }
  return out;
}

/** lamp posts along both kerbs: local along-span positions */
export function bridgeLamps(b: BridgeSpec): number[] {
  const f = bridgeFrame(b), out: number[] = [];
  for (let s = -f.length / 2 + 8; s <= f.length / 2 - 8; s += 18) out.push(s);
  return out;
}

/** the Celestial Bridge's lane plan across the deck (local x from the centre line, m): driving lanes each way either side of
 * a protected transit route down the median */
export function celestialLanes(b: BridgeSpec): { driving: number[]; transit: [number, number]; walkway: number } {
  const half = b.width / 2;
  return { driving: [-half + 3, -half + 6.5, half - 6.5, half - 3], transit: [-2.6, 2.6], walkway: half - 0.9 };
}
