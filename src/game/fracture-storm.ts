/** The Fracture Storm (owner's trailers, Oct 2026: a vast ring of violet storm cloud crackling with lightning over the city skyline).
 * Pure parameters: where the ring hangs, how big it is, and the lightning schedule, so the look can be tuned and tested without a GPU.
 * FractureStorm.tsx only draws them. */
import { REGIONS } from "./world";
import { NEON_CENTER } from "./living-world";

const nexus = REGIONS.find((r) => r.id === "nexus")!;
/** centred between the Nexus hub and Neon City, high above both skylines */
export const STORM = {
  x: (nexus.x + NEON_CENTER.x) / 2,
  z: (nexus.z + NEON_CENTER.z) / 2,
  y: 300,
  /** inner and outer radius of the cloud band (m) */
  inner: 120,
  outer: 230,
  /** radians per second the band turns */
  spin: 0.012,
} as const;

/** 0..1 hash */
const h = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** A lightning strike from the ring's inner edge down toward the skyline every few seconds, lasting a fraction of a second.
 * `on` while it flashes; `angle` round the ring where it starts; `k` 0..1 flash strength (bright then flickering out). */
export function stormStrike(t: number): { on: boolean; angle: number; k: number; seed: number } {
  const period = 3.6, slot = Math.floor(t / period), within = t - slot * period;
  const start = h(slot) * (period - 0.5);
  const dur = 0.22 + h(slot + 7) * 0.2;
  const local = within - start;
  if (local < 0 || local > dur) return { on: false, angle: 0, k: 0, seed: slot };
  const flicker = 0.55 + 0.45 * Math.abs(Math.sin(local * 70));
  return { on: true, angle: h(slot + 3) * Math.PI * 2, k: (1 - local / dur) * flicker, seed: slot };
}

/** how strongly the band glows: always visible, brighter at night and in storms (the fracture feeds on storms) */
export function stormGlow(night: number, storm: boolean): number {
  return Math.min(1.6, 0.55 + 0.75 * Math.max(0, Math.min(1, night)) + (storm ? 0.3 : 0));
}

/** Shattered ground caught in the storm: rock chunks drifting round the ring (trailer "the next fracture"), lit violet from inside.
 * Seeded and fixed, so every player sees the same debris field. */
export type Debris = { a: number; r: number; y: number; s: number; spin: number; tilt: number };
export function stormDebris(count = 64): Debris[] {
  const out: Debris[] = [];
  for (let i = 0; i < count; i++) {
    const big = i % 9 === 0;
    out.push({
      a: h(i * 3.1) * Math.PI * 2,
      r: STORM.inner * 0.75 + h(i * 5.7) * (STORM.outer * 1.15 - STORM.inner * 0.75),
      y: STORM.y - 110 + h(i * 2.3) * 120,
      s: big ? 10 + h(i * 1.9) * 8 : 2 + h(i * 4.4) * 5,
      spin: (h(i * 8.8) - 0.5) * 0.3,
      tilt: h(i * 6.6) * Math.PI,
    });
  }
  return out;
}
