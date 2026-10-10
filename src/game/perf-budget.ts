/** Pure render-cost budgets, keyed by the quality tier. The scene's cost used to depend on how many triangles each downloaded
 * model happened to have (some Poly Haven rocks/trunks are ~100k each); these budgets make the cost a number we choose:
 * foliage and decorative models are drawn nearest-first until their triangle allowance is spent, district lights are
 * capped, and shadow casters beyond the cheap tiers are dropped. Presentation only: nothing here touches gameplay. */
import type { RenderTier } from "./performance";

export type BudgetKind = "fir" | "broadleaf" | "shrub" | "fern" | "log" | "rock";
const TIER_SCALE: Record<RenderTier, number> = { LOW: 0.6, MEDIUM: 1, HIGH: 1.9, ULTRA: 3 };
/** triangles allowed per species on MEDIUM; other tiers multiply by TIER_SCALE */
export const FOLIAGE_TRIS: Record<BudgetKind, number> = { fir: 280_000, broadleaf: 280_000, shrub: 110_000, fern: 110_000, log: 50_000, rock: 100_000 };
/** triangles allowed for all decorative region models together (RegionModels) */
export const REGION_MODEL_TRIS = 220_000;
/** district point lights that may be on at once; each costs every lit pixel */
export const LIGHT_CAP: Record<RenderTier, number> = { LOW: 2, MEDIUM: 4, HIGH: 6, ULTRA: 8 };
/** heavy decorative meshes only cast shadows from HIGH up: the shadow pass redraws every caster */
export const heavyShadows = (tier: RenderTier) => tier === "HIGH" || tier === "ULTRA";

/** how much of a district's mount radius is used (NearOnly): far cities past the fog line cost every draw call for little */
export const NEAR_SCALE: Record<RenderTier, number> = { LOW: 0.55, MEDIUM: 0.7, HIGH: 0.85, ULTRA: 1 };

export const foliageTris = (kind: BudgetKind, tier: RenderTier) => Math.round(FOLIAGE_TRIS[kind] * TIER_SCALE[tier]);
export const regionModelTris = (tier: RenderTier) => Math.round(REGION_MODEL_TRIS * TIER_SCALE[tier]);

/** how many instances fit in a triangle allowance (never negative; a model bigger than the allowance gets 0) */
export const maxInstances = (allowance: number, trisPerInstance: number) => (trisPerInstance > 0 ? Math.max(0, Math.floor(allowance / trisPerInstance)) : Number.MAX_SAFE_INTEGER);

/** Far-forest proxies: trees past the detailed budget are drawn as ~20-triangle silhouettes instead of vanishing,
 * so the forest keeps its depth without paying for the real models. Only tree species get proxies. */
export const PROXY_RADIUS = { fir: 340, broadleaf: 340 } as const;
export const PROXY_MAX: Record<RenderTier, number> = { LOW: 900, MEDIUM: 1800, HIGH: 2600, ULTRA: 3600 };
export const PROXY_COLOR = { fir: "#2c5a3a", broadleaf: "#4b7d3b" } as const;

export type XZ = { x: number; z: number };
/** nearest-first indices within `radius` that are NOT already drawn in detail (`near`), at most `max` */
export function farProxies(items: readonly XZ[], cx: number, cz: number, near: readonly number[], radius: number, max: number): number[] {
  if (max <= 0) return [];
  const skip = new Set(near), r2 = radius * radius, hits: { i: number; d: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    if (skip.has(i)) continue;
    const dx = items[i]!.x - cx, dz = items[i]!.z - cz, d = dx * dx + dz * dz;
    if (d <= r2) hits.push({ i, d });
  }
  hits.sort((a, b) => a.d - b.d); if (hits.length > max) hits.length = max;
  return hits.map((h) => h.i);
}
/** indices of items within `radius` of (cx,cz), nearest first, at most `max` of them */
export function nearestWithin(items: readonly XZ[], cx: number, cz: number, radius: number, max: number): number[] {
  if (max <= 0) return [];
  const r2 = radius * radius, hits: { i: number; d: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const dx = items[i]!.x - cx, dz = items[i]!.z - cz, d = dx * dx + dz * dz;
    if (d <= r2) hits.push({ i, d });
  }
  if (hits.length > max) hits.sort((a, b) => a.d - b.d).length = max;
  return hits.map((h) => h.i);
}

/** which lights may be on: those inside their range (with hysteresis for lights already on), nearest first, up to `cap` */
export type LightCandidate = { id: number; d: number; range: number; on: boolean };
export function pickLights(lights: readonly LightCandidate[], cap: number): Set<number> {
  const eligible = lights.filter((l) => (l.on ? l.d <= l.range * 1.25 : l.d < l.range)).sort((a, b) => a.d - b.d);
  return new Set(eligible.slice(0, Math.max(0, cap)).map((l) => l.id));
}

/** current tier, set by Scene so deep components need no prop plumbing; `version` lets them notice a change */
let tier: RenderTier = "MEDIUM";
let version = 0;
export const getPerfTier = () => tier;
export const perfTierVersion = () => version;
export function setPerfTier(next: RenderTier) { if (next !== tier) { tier = next; version++; } }
