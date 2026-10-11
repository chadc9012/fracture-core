/** Trailer set pieces placed at existing landmarks (pure layout, no three.js):
 *  - The Convoy Sprint (Wastelands): burned-out car wrecks along the old run, some still smoking — the "runs that lost".
 *  - Smoldering Trench (Ember Peaks): glowing lava fissures inside the real lava-trench hazard zone, with chunks of
 *    fracture debris hanging above them.
 * SetPieces.tsx draws these and samples the ground height; nothing here changes collision, hazards or rewards
 * (the trench's damage is still the hazard-zones.ts rule; the fissures sit inside that zone so the look matches it). */
import { LANDMARKS } from "./landmarks";
import { HAZARD_ZONES } from "./hazard-zones";
import { mulberry32 } from "./rng";
import { WORLD_SCALE } from "./world";

export type Wreck = { x: number; z: number; yaw: number; roll: number; kind: "sedan" | "pickup" | "van"; smoke: boolean; burning: boolean };
export type Fissure = { x: number; z: number; yaw: number; length: number; width: number };
export type Debris = { x: number; z: number; lift: number; size: number; spin: number; phase: number };

const S = Math.max(1, WORLD_SCALE / 2);
const lm = (id: string) => LANDMARKS.find((l) => l.id === id)!;

export const WRECK_COUNT = 14;
export const WRECK_SPREAD = 26 * S;
export const MIN_WRECK_GAP = 5;

/** Wrecks strung along a line through the Convoy Sprint (the run heads north–south), jittered and never stacked. */
export function wreckField(isBlocked: (x: number, z: number) => boolean = () => false): Wreck[] {
  const c = lm("convoy-sprint");
  const rnd = mulberry32(0xc0ffee);
  const out: Wreck[] = [];
  const kinds: Wreck["kind"][] = ["sedan", "sedan", "pickup", "van"];
  for (let tries = 0; out.length < WRECK_COUNT && tries < 400; tries++) {
    const along = (rnd() * 2 - 1) * WRECK_SPREAD;
    const side = (rnd() * 2 - 1) * 9 * S * 0.6;
    const x = c.x + side, z = c.z + along;
    if (isBlocked(x, z)) continue;
    if (out.some((w) => Math.hypot(w.x - x, w.z - z) < MIN_WRECK_GAP)) continue;
    const n = out.length;
    out.push({
      x, z,
      yaw: rnd() * Math.PI * 2,
      roll: rnd() < 0.18 ? Math.PI * (0.45 + rnd() * 0.1) : (rnd() - 0.5) * 0.12, // a few on their side
      kind: kinds[Math.floor(rnd() * kinds.length)]!,
      smoke: n % 3 === 0,
      burning: n % 5 === 0,
    });
  }
  return out;
}

/** The lava-trench zone this art belongs to; fissures stay inside it so the glow never promises damage elsewhere. */
export const TRENCH_ZONE = HAZARD_ZONES.find((z) => z.kind === "lava-trench")!;

export function trenchCentre(): { x: number; z: number } {
  const l = lm(TRENCH_ZONE.landmarkId);
  return { x: l.x, z: l.z };
}

export function lavaFissures(): Fissure[] {
  const c = trenchCentre(), R = TRENCH_ZONE.radius;
  const rnd = mulberry32(0x1a7a);
  const main = rnd() * Math.PI;
  const out: Fissure[] = [{ x: c.x, z: c.z, yaw: main, length: R * 1.3, width: 2.2 }];
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2, d = R * (0.2 + rnd() * 0.45);
    const length = R * (0.25 + rnd() * 0.3);
    out.push({ x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d, yaw: main + (rnd() - 0.5) * 1.4, length, width: 0.6 + rnd() * 0.9 });
  }
  return out;
}

export const DEBRIS_COUNT = 9;
export function floatingDebris(): Debris[] {
  const c = trenchCentre(), R = TRENCH_ZONE.radius;
  const rnd = mulberry32(0xdeb7);
  return Array.from({ length: DEBRIS_COUNT }, () => {
    const a = rnd() * Math.PI * 2, d = R * rnd() * 0.75;
    return { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d, lift: 5 + rnd() * 12, size: 0.8 + rnd() * 2.6, spin: (rnd() - 0.5) * 0.4, phase: rnd() * Math.PI * 2 };
  });
}

/** Floating debris pose at time t (seconds): a slow bob and tumble. */
export function debrisPose(d: Debris, t: number): { y: number; rx: number; ry: number } {
  return { y: d.lift + Math.sin(t * 0.5 + d.phase) * 0.8, rx: t * d.spin * 0.6 + d.phase, ry: t * d.spin };
}

/** Lava glow pulse 0.7..1 */
export const lavaPulse = (t: number, phase = 0) => 0.85 + 0.15 * Math.sin(t * 1.7 + phase);
