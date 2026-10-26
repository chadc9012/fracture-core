/** The Nexus Strait Bridge (owner's overlook frame, docs/reference/target-overlook-day.png: a suspension bridge strides over the
 * water beside Nexus City). It spans the Stage 151 strait east of downtown, from the city edge to the Verdant shore: two
 * pylons standing in the water, main cables sagging between the tower tops and anchored at the abutments, vertical
 * suspenders down to a walkable, drivable deck (a registered deck, so walkHeight, the camera and vehicles agree on it).
 * Pure geometry data; NexusBridge.tsx draws it. */
import type { Deck } from "./district-decks";

/** abutments (deck ends on land) and deck dimensions, metres */
export const BRIDGE = {
  west: { x: 124, z: -184 },
  east: { x: 268, z: -176 },
  /** deck top, a touch above both banks so the approach ramps climb onto it */
  top: 21.6,
  /** ground the approach ramps run down to at both ends */
  base: 16.5,
  ramp: 9,
  width: 13,
  /** pylon positions as a fraction of the span, and their height above the deck */
  towers: [0.27, 0.73] as const,
  towerHeight: 46,
  /** lowest point of the main cable above the deck, mid-span */
  sag: 2.2,
  /** suspender spacing along the deck */
  hanger: 6,
  /** cable planes either side of the centre line */
  cableOffset: 6.2,
} as const;

export type BridgeFrame = { cx: number; cz: number; dirX: number; dirZ: number; length: number; yaw: number };
/** the span's centre, unit direction west→east, length and yaw (rotation about y that maps local +z onto the span) */
export function bridgeFrame(): BridgeFrame {
  const { west: a, east: b } = BRIDGE, dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
  return { cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, dirX: dx / length, dirZ: dz / length, length, yaw: Math.atan2(dx, dz) };
}

/** the walkable deck, ramps included (the deck runs a few metres onto each bank) */
export function bridgeDeck(): Deck {
  const f = bridgeFrame();
  return { id: "nexus-strait-bridge", x: f.cx, z: f.cz, dirX: f.dirX, dirZ: f.dirZ, length: f.length + 8, width: BRIDGE.width, top: BRIDGE.top, base: BRIDGE.base, ramp: BRIDGE.ramp };
}

/** main-cable height above the deck at `u` (0 = west abutment .. 1 = east): anchored at deck level at the ends, over the tower
 * saddles, and a parabola between them sagging to BRIDGE.sag at mid-span; side spans are parabolas too, from anchor to saddle */
export function cableHeight(u: number): number {
  const [t0, t1] = BRIDGE.towers, H = BRIDGE.towerHeight - 1.5;
  if (u <= t0) { const k = u / t0; return 0.8 + (H - 0.8) * k * k; }
  if (u >= t1) { const k = (1 - u) / (1 - t1); return 0.8 + (H - 0.8) * k * k; }
  const k = (u - (t0 + t1) / 2) / ((t1 - t0) / 2); // -1 .. 1 across the main span
  return BRIDGE.sag + (H - BRIDGE.sag) * k * k;
}

/** local positions (along the span from its centre, m) and lengths of every vertical suspender on one cable plane */
export function suspenders(): { along: number; height: number }[] {
  const f = bridgeFrame(), out: { along: number; height: number }[] = [];
  const n = Math.floor(f.length / BRIDGE.hanger);
  for (let i = 1; i < n; i++) {
    const u = i / n;
    if (BRIDGE.towers.some((t) => Math.abs(u - t) * f.length < 2.5)) continue; // no hanger inside a pylon
    const h = cableHeight(u);
    if (h > 1.2) out.push({ along: (u - 0.5) * f.length, height: h });
  }
  return out;
}

/** lamp posts along both kerbs: local along-span positions */
export function bridgeLamps(): number[] {
  const f = bridgeFrame(), out: number[] = [];
  for (let s = -f.length / 2 + 8; s <= f.length / 2 - 8; s += 18) out.push(s);
  return out;
}
