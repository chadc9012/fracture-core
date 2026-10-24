/** What a damaged vehicle should look like (pure). Maps the one real VehicleCondition to visible damage stages so the
 * renderer holds no second health system. Everything is deterministic per vehicle seed and monotonic: more damage only
 * ever ADDS dents/cracks/dead lights, it never moves or removes the ones already shown. */
import type { VehicleCondition } from "./vehicle-condition";

export type DentFace = "L" | "R" | "F" | "B";
/** u: 0..1 along the face (length for flanks, width for ends), v: 0..1 up the body, r: radius in body-heights, depth 0..1 */
export type Dent = { face: DentFace; u: number; v: number; r: number; depth: number };
export type Crack = { angle: number; length: number };
export type DamageLook = {
  /** 0 clean .. 4 wrecked */
  dentTier: number;
  dents: Dent[];
  /** 0 clean, 1 chipped, 2 cracked, 3 shattered */
  glass: 0 | 1 | 2 | 3;
  cracks: Crack[];
  headlightsOut: 0 | 1 | 2;
  bumperHang: number;
  /** 0..1 soot over the hood once the engine is on fire */
  soot: number;
  /** stable key: identical looks give identical keys so the renderer only rebuilds when something visible changes */
  key: string;
};

export const MAX_DENTS = 14;
const FACES: readonly DentFace[] = ["L", "R", "F", "B", "L", "R", "F"];

export function hashSeed(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const dentTierOf = (body: number) => body < 8 ? 0 : body < 30 ? 1 : body < 55 ? 2 : body < 80 ? 3 : 4;
const DENTS_AT_TIER = [0, 2, 5, 9, MAX_DENTS] as const;

/** The full pool for a vehicle, generated once in a fixed order; a look takes a prefix of it. */
export function dentPool(seed: number): Dent[] {
  const r = rng(seed ^ 0x9e3779b9);
  return Array.from({ length: MAX_DENTS }, (_, i) => ({ face: FACES[i % FACES.length]!, u: 0.12 + r() * 0.76, v: 0.25 + r() * 0.5, r: 0.12 + r() * 0.16, depth: 0.4 + r() * 0.6 }));
}
export function crackPool(seed: number): Crack[] {
  const r = rng(seed ^ 0x85ebca6b);
  return Array.from({ length: 9 }, (_, i) => ({ angle: (i / 9) * Math.PI * 2 + (r() - 0.5) * 0.5, length: 0.35 + r() * 0.65 }));
}

export function damageLook(c: VehicleCondition, seed: number): DamageLook {
  const dentTier = dentTierOf(c.body);
  const dents = dentPool(seed).slice(0, DENTS_AT_TIER[dentTier]!);
  const glass = c.body >= 90 ? 3 : c.body >= 65 ? 2 : c.body >= 40 ? 1 : 0;
  const cracks = crackPool(seed).slice(0, glass === 0 ? 0 : glass === 1 ? 3 : glass === 2 ? 6 : 9);
  const headlightsOut = c.body >= 80 ? 2 : c.body >= 50 ? 1 : 0;
  const bumperHang = c.body < 70 ? 0 : Math.min(1, (c.body - 70) / 30);
  const soot = c.engine < 75 ? 0 : Math.min(1, 0.35 + (c.engine - 75) / 25 * 0.65);
  const key = [dentTier, glass, headlightsOut, Math.round(bumperHang * 10), Math.round(soot * 10)].join(":");
  return { dentTier, dents, glass, cracks, headlightsOut, bumperHang, soot, key };
}
