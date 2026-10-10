/** Weapon-evolution ruins: five super-rare, hidden sites. At a ruin the player may evolve ONE earned weapon (once per ruin,
 * once per weapon). Evolving adds a flat power bonus, sets the weapon's element and grants a special ability.
 *
 * Pure rules only. Guard-rails (see weapon-evolution.test.ts):
 *  - a ruin pays once per save: the claim `ruin:<id>` lives in earnedRewards (cloud-merged by union);
 *  - nothing is free: the weapon must already be level >= EVOLVE_MIN_LEVEL (earned by upgrading, which has its own gate) and
 *    the cost (forge catalysts, which are earn-only, plus the ruin's element material) is deducted in the same return;
 *  - a failed attempt changes nothing; a weapon already evolved cannot be evolved again;
 *  - the ability's combat rules are evaluated here; sim.ts applies them through applyMachineDamageMods / stunMachine, so
 *    boss poise, scenario gimmicks and stun caps still hold. No enemy-shield system is involved. */
import { REGIONS } from "./world";
import { heightAt, riverAt, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { isReserved } from "./verdant";
import type { GearItem, MaterialId } from "./inventory";
import type { PlayerProgression } from "./progression";

export type EvolutionAbility = "EMBER_BRAND" | "RIME_SHATTER" | "ROT_BLOOM" | "STORM_ARC" | "SUN_FLARE";
export type Evolution = { ruinId: string; ability: EvolutionAbility };
type Element = GearItem["element"];

export type AbilityRule = {
  name: string; blurb: string;
  /** every Nth landed hit triggers the burst (0 = passive) */
  everyHits: number;
  /** burst reaches other machines within this radius of the struck one, up to maxTargets */
  radius: number; maxTargets: number;
  /** burst damage as a fraction of the triggering hit */
  burstFraction: number;
  /** extra damage multiplier on chilled targets (RIME_SHATTER), 1 = none */
  chilledBonus: number;
  /** stun seconds on non-boss burst targets (stunMachine still caps bosses) */
  stun: number;
};

export const ABILITY_RULES: Record<EvolutionAbility, AbilityRule> = {
  EMBER_BRAND: { name: "Ember Brand", blurb: "Every 5th hit detonates a thermal burst around the target.", everyHits: 5, radius: 6, maxTargets: 4, burstFraction: 0.8, chilledBonus: 1, stun: 0 },
  RIME_SHATTER: { name: "Rime Shatter", blurb: "+30% damage to chilled targets; every 6th hit shatters frost onto neighbours.", everyHits: 6, radius: 7, maxTargets: 3, burstFraction: 0.5, chilledBonus: 1.3, stun: 0 },
  ROT_BLOOM: { name: "Rot Bloom", blurb: "Every 4th hit blooms corrosive spores that eat armour on nearby machines.", everyHits: 4, radius: 6, maxTargets: 3, burstFraction: 0.4, chilledBonus: 1, stun: 0 },
  STORM_ARC: { name: "Storm Arc", blurb: "Every 4th hit chains lightning to up to 2 nearby machines.", everyHits: 4, radius: 10, maxTargets: 2, burstFraction: 0.5, chilledBonus: 1, stun: 0 },
  SUN_FLARE: { name: "Sun Flare", blurb: "Every 6th hit flares: nearby machines are blinded and stunned briefly.", everyHits: 6, radius: 8, maxTargets: 5, burstFraction: 0.25, chilledBonus: 1, stun: 0.9 },
};

export const EVOLVE_POWER_BONUS = 60;     // about four upgrade levels of power, delivered once
export const EVOLVE_MIN_LEVEL = 5;
export const EVOLVE_CATALYSTS = 2;        // forgeCatalyst is earn-only
export const EVOLVE_ELEMENT_AMOUNT = 6;
export const RUIN_REACH = 6;
export const RUIN_DISCOVER_RADIUS = 40;

export type Ruin = { id: string; name: string; regionId: string; element: Exclude<Element, "KINETIC">; ability: EvolutionAbility; material: MaterialId; blurb: string; x: number; z: number };
type RuinDef = Omit<Ruin, "x" | "z">;
const DEFS: RuinDef[] = [
  { id: "cinderglass-vault", name: "Cinderglass Vault", regionId: "ember", element: "THERMAL", ability: "EMBER_BRAND", material: "thermalShards", blurb: "A vitrified vault still humming with heat." },
  { id: "rimeheart-spire", name: "Rimeheart Spire", regionId: "frostspire", element: "CRYO", ability: "RIME_SHATTER", material: "cryoCrystal", blurb: "A broken spire with a frozen core." },
  { id: "drowned-orchard", name: "Drowned Orchard", regionId: "swamps", element: "BIO", ability: "ROT_BLOOM", material: "bioCatalyst", blurb: "Stone arches strangled by glowing spores." },
  { id: "stormwrecked-array", name: "Stormwrecked Array", regionId: "wastelands", element: "ARC", ability: "STORM_ARC", material: "microCircuits", blurb: "A toppled relay array that still crackles." },
  { id: "sunken-heliostat", name: "Sunken Heliostat", regionId: "solara", element: "THERMAL", ability: "SUN_FLARE", material: "thermalShards", blurb: "A mirror ring that once fed the sun." },
];

/** small seeded RNG (kept local: useKeyboard.ts pulls in React, which pure rule modules must not) */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

let cached: Ruin[] | null = null;
/** Deterministic ruin sites, far from roads, water and fixed mission pads. Same on every client. */
export function ruins(): Ruin[] {
  if (cached) return cached;
  cached = DEFS.map((d) => {
    const r = REGIONS.find((e) => e.id === d.regionId) ?? REGIONS[0]!;
    const rnd = mulberry32(d.id.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 11));
    let best = { x: r.x + r.radius * 0.5, z: r.z }, guard = 300;
    while (guard-- > 0) {
      const a = rnd() * Math.PI * 2, dist = r.radius * (0.45 + rnd() * 0.4);
      const x = r.x + Math.cos(a) * dist, z = r.z + Math.sin(a) * dist;
      if (heightAt(x, z) < WATER_LEVEL + 1) continue;
      if (distanceToRoad(x, z) < LANE_HALF_WIDTH + 12) continue;
      const rv = riverAt(x, z); if (rv && rv.dist < rv.w + 8) continue;
      if (isReserved(x, z, 12)) continue;
      best = { x, z }; break;
    }
    return { ...d, ...best };
  });
  return cached;
}
export const ruinById = (id: string) => ruins().find((r) => r.id === id);

export const claimKey = (ruinId: string) => `ruin:${ruinId}`;
export const seenKey = (ruinId: string) => `ruin-seen:${ruinId}`;
export const isEvolved = (p: Pick<PlayerProgression, "earnedRewards">, ruinId: string) => p.earnedRewards.includes(claimKey(ruinId));
export const isDiscovered = (p: Pick<PlayerProgression, "earnedRewards">, ruinId: string) => p.earnedRewards.includes(seenKey(ruinId)) || isEvolved(p, ruinId);
export const isWeapon = (item: Pick<GearItem, "slot">) => item.slot === "primary" || item.slot === "secondary" || item.slot === "heavy";

/** nearest undiscovered ruin within RUIN_DISCOVER_RADIUS; discovery only records "seen" (the map then shows it). */
export function discoverNearby(p: PlayerProgression, x: number, z: number): PlayerProgression {
  const found = ruins().filter((r) => !isDiscovered(p, r.id) && Math.hypot(r.x - x, r.z - z) <= RUIN_DISCOVER_RADIUS);
  if (!found.length) return p;
  return { ...p, earnedRewards: [...p.earnedRewards, ...found.map((r) => seenKey(r.id))] };
}

export type EvolveCheck = { ok: boolean; reason: string };
export function canEvolve(p: PlayerProgression, ruin: Ruin, weaponId: string): EvolveCheck {
  if (isEvolved(p, ruin.id)) return { ok: false, reason: "This ruin has already given its power" };
  const item = p.inventory.find((g) => g.id === weaponId);
  if (!item || !isWeapon(item)) return { ok: false, reason: "Pick a weapon" };
  if (item.evolution) return { ok: false, reason: "Already evolved" };
  if (item.level < EVOLVE_MIN_LEVEL) return { ok: false, reason: `Weapon must be level ${EVOLVE_MIN_LEVEL}` };
  if ((p.materials.forgeCatalyst ?? 0) < EVOLVE_CATALYSTS) return { ok: false, reason: `Needs ${EVOLVE_CATALYSTS} forge catalysts` };
  if ((p.materials[ruin.material] ?? 0) < EVOLVE_ELEMENT_AMOUNT) return { ok: false, reason: `Needs ${EVOLVE_ELEMENT_AMOUNT} ${ruin.material}` };
  return { ok: true, reason: "" };
}

/** Evolves a weapon at a ruin. Returns the same progression object when refused, so callers can detect a no-op. */
export function evolveWeapon(p: PlayerProgression, ruinId: string, weaponId: string): PlayerProgression {
  const ruin = ruinById(ruinId);
  if (!ruin || !canEvolve(p, ruin, weaponId).ok) return p;
  const materials = { ...p.materials, forgeCatalyst: (p.materials.forgeCatalyst ?? 0) - EVOLVE_CATALYSTS, [ruin.material]: (p.materials[ruin.material] ?? 0) - EVOLVE_ELEMENT_AMOUNT };
  return {
    ...p, materials,
    earnedRewards: [...p.earnedRewards, claimKey(ruin.id)],
    inventory: p.inventory.map((g) => g.id === weaponId ? { ...g, power: g.power + EVOLVE_POWER_BONUS, element: ruin.element, evolution: { ruinId: ruin.id, ability: ruin.ability } } : g),
  };
}

/** Cloud merge helper: the copy with the higher level wins, but an evolution found on either copy is kept (and its one-time
 * power bonus applied if the winning copy lacks it), so a merge can never strip an evolution whose claim is already spent. */
export function mergeEvolution(best: GearItem, a: GearItem | undefined, b: GearItem | undefined): GearItem {
  if (best.evolution) return best;
  const evo = a?.evolution ?? b?.evolution;
  if (!evo) return best;
  const ruin = ruinById(evo.ruinId);
  return { ...best, power: best.power + EVOLVE_POWER_BONUS, element: ruin?.element ?? best.element, evolution: evo };
}

// ---- combat rules (pure) ----
export type EvolutionCharge = { hits: number };
export const freshCharge = (): EvolutionCharge => ({ hits: 0 });
export type EvolutionHit = { charge: EvolutionCharge; burst: boolean };
/** register one landed hit; `burst` is true on every Nth hit */
export function registerEvolutionHit(charge: EvolutionCharge, ability: EvolutionAbility): EvolutionHit {
  const rule = ABILITY_RULES[ability];
  if (rule.everyHits <= 0) return { charge, burst: false };
  const hits = charge.hits + 1;
  return hits >= rule.everyHits ? { charge: { hits: 0 }, burst: true } : { charge: { hits }, burst: false };
}
/** damage multiplier of the ability for a single hit */
export const evolutionDamageMult = (ability: EvolutionAbility, chilled: boolean) => (chilled ? ABILITY_RULES[ability].chilledBonus : 1);
/** the burst's victims: nearest-first, excluding the struck target, within radius, capped */
export function burstTargets<T extends { x: number; z: number }>(origin: { x: number; z: number }, others: T[], ability: EvolutionAbility): T[] {
  const rule = ABILITY_RULES[ability];
  return others.map((o) => ({ o, d: Math.hypot(o.x - origin.x, o.z - origin.z) })).filter((e) => e.d > 0.01 && e.d <= rule.radius).sort((a, b) => a.d - b.d).slice(0, rule.maxTargets).map((e) => e.o);
}

/** the element an ability burst carries (its ruin's element) */
export const ruinElementOf = (ability: EvolutionAbility): Exclude<Element, "KINETIC"> => DEFS.find((d) => d.ability === ability)?.element ?? "ARC";
