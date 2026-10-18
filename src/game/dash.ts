/**
 * Operator dashes (pure). Every Operator has its own dash with its own feel, and each dash has a three-tier perk
 * tree (two choices per tier, Destiny-style) bought with calibration tokens. Choices are stored in the existing
 * `abilityBranches` map under `dash:<CLASS>:<tier>` so saving and cloud merge need no new field.
 *   NYX (HUNTER)      Ghost Step   — long, fast, brief invulnerability, marks what it passes
 *   GOLIATH (TITAN)   Bulwark Rush — short heavy charge: damage resist, shoves and hurts enemies in the way
 *   CIPHER (WARLOCK)  Phase Drift  — mid-range hover-slide that stalls the fall and disrupts what it crosses
 * Scene applies the returned numbers; nothing here touches the world.
 */
import type { ClassId } from "./loadout";

export type DashId = "ghost-step" | "bulwark-rush" | "phase-drift";
export type DashDef = { id: DashId; classId: ClassId; operator: string; name: string; blurb: string; base: DashStats };

export type DashStats = {
  distance: number;      // world units covered
  duration: number;      // seconds the dash lasts
  iframes: number;       // seconds of invulnerability from the start
  cooldown: number;      // seconds to recharge one charge
  charges: number;       // dashes stored
  resist: number;        // 0..1 damage reduction while dashing
  hitDamage: number;     // damage to each enemy passed through
  knockback: number;     // push on each enemy passed
  hover: number;         // seconds of fall-stall after the dash
  endBlastRadius: number; endBlastDamage: number; // shockwave where it ends
  mark: number;          // enemies passed take +fraction damage for 4 s
  slow: number;          // 0..1 slow on enemies passed for 3 s
  refundOnHit: number;   // seconds of cooldown returned per enemy passed
  pierce: boolean;       // passes through enemies rather than being stopped by them
};
const ZERO = { iframes: 0, resist: 0, hitDamage: 0, knockback: 0, hover: 0, endBlastRadius: 0, endBlastDamage: 0, mark: 0, slow: 0, refundOnHit: 0, pierce: false, charges: 1 };

export const DASHES: Record<ClassId, DashDef> = {
  HUNTER: { id: "ghost-step", classId: "HUNTER", operator: "NYX", name: "Ghost Step", blurb: "A long, silent lunge. You cannot be hit as it starts.",
    base: { ...ZERO, distance: 9, duration: 0.18, iframes: 0.22, cooldown: 3.5 } },
  TITAN: { id: "bulwark-rush", classId: "TITAN", operator: "GOLIATH", name: "Bulwark Rush", blurb: "A short armoured charge that shoves aside whatever stands in the way.",
    base: { ...ZERO, distance: 6, duration: 0.3, cooldown: 5.5, resist: 0.5, hitDamage: 2, knockback: 4, pierce: false } },
  WARLOCK: { id: "phase-drift", classId: "WARLOCK", operator: "CIPHER", name: "Phase Drift", blurb: "A hovering slide through the air that stalls your fall.",
    base: { ...ZERO, distance: 7.5, duration: 0.26, iframes: 0.15, cooldown: 4.5, hover: 0.5 } },
};
export const dashFor = (classId: ClassId): DashDef => DASHES[classId];

export type DashPerk = { id: string; tier: 1 | 2 | 3; name: string; blurb: string; apply: (s: DashStats) => DashStats };
const mul = (s: DashStats, k: Partial<Record<keyof DashStats, number>>): DashStats => {
  const out = { ...s } as Record<string, number | boolean>;
  for (const [key, v] of Object.entries(k)) out[key] = (s[key as keyof DashStats] as number) * (v as number);
  return out as unknown as DashStats;
};

export const DASH_PERKS: Record<ClassId, readonly [readonly [DashPerk, DashPerk], readonly [DashPerk, DashPerk], readonly [DashPerk, DashPerk]]> = {
  HUNTER: [
    [{ id: "short-fuse", tier: 1, name: "Short Fuse", blurb: "−20% cooldown", apply: (s) => mul(s, { cooldown: 0.8 }) },
     { id: "long-reach", tier: 1, name: "Long Reach", blurb: "+25% distance", apply: (s) => mul(s, { distance: 1.25 }) }],
    [{ id: "afterimage", tier: 2, name: "Afterimage", blurb: "+0.2 s invulnerability", apply: (s) => ({ ...s, iframes: s.iframes + 0.2 }) },
     { id: "edge-refund", tier: 2, name: "Edge Refund", blurb: "each enemy passed returns 0.6 s of cooldown", apply: (s) => ({ ...s, refundOnHit: 0.6, pierce: true }) }],
    [{ id: "double-step", tier: 3, name: "Double Step", blurb: "store two dashes", apply: (s) => ({ ...s, charges: 2 }) },
     { id: "shadow-mark", tier: 3, name: "Shadow Mark", blurb: "enemies passed take +25% damage for 4 s", apply: (s) => ({ ...s, mark: 0.25, pierce: true }) }],
  ],
  TITAN: [
    [{ id: "heavy-boots", tier: 1, name: "Heavy Boots", blurb: "+50% shove", apply: (s) => mul(s, { knockback: 1.5 }) },
     { id: "momentum", tier: 1, name: "Momentum", blurb: "+30% distance", apply: (s) => mul(s, { distance: 1.3 }) }],
    [{ id: "plated-charge", tier: 2, name: "Plated Charge", blurb: "damage resist 50% → 75%", apply: (s) => ({ ...s, resist: 0.75 }) },
     { id: "quake-landing", tier: 2, name: "Quake Landing", blurb: "shockwave where the charge ends", apply: (s) => ({ ...s, endBlastRadius: 5, endBlastDamage: 2 }) }],
    [{ id: "wrecking-ball", tier: 3, name: "Wrecking Ball", blurb: "double damage, passes through enemies", apply: (s) => ({ ...mul(s, { hitDamage: 2 }), pierce: true }) },
     { id: "unstoppable", tier: 3, name: "Unstoppable", blurb: "each enemy hit returns 1.2 s of cooldown", apply: (s) => ({ ...s, refundOnHit: 1.2 }) }],
  ],
  WARLOCK: [
    [{ id: "swift-drift", tier: 1, name: "Swift Drift", blurb: "−20% cooldown", apply: (s) => mul(s, { cooldown: 0.8 }) },
     { id: "deep-drift", tier: 1, name: "Deep Drift", blurb: "hover twice as long", apply: (s) => mul(s, { hover: 2 }) }],
    [{ id: "static-trail", tier: 2, name: "Static Trail", blurb: "enemies crossed are staggered: their next attack is delayed 1.2 s", apply: (s) => ({ ...s, slow: 0.4, pierce: true }) },
     { id: "phase-shield", tier: 2, name: "Phase Shield", blurb: "+0.25 s invulnerability", apply: (s) => ({ ...s, iframes: s.iframes + 0.25 }) }],
    [{ id: "twin-drift", tier: 3, name: "Twin Drift", blurb: "store two dashes", apply: (s) => ({ ...s, charges: 2 }) },
     { id: "overload-wake", tier: 3, name: "Overload Wake", blurb: "a pulse where the drift ends", apply: (s) => ({ ...s, endBlastRadius: 4.5, endBlastDamage: 1.5 }) }],
  ],
};

/** calibration tokens to buy tier 1/2/3; changing a tier you already bought costs RETUNE_COST */
export const TIER_COST = [1, 2, 3] as const;
export const RETUNE_COST = 1;

type Branches = Record<string, string>;
const key = (c: ClassId, tier: number) => `dash:${c}:${tier}`;
export type DashProgress = { calibrationTokens: number; abilityBranches: Branches };

/** chosen perk id per tier (undefined where nothing is bought), in tier order; a tier is only valid if all earlier ones are bought */
export function chosenPerks(branches: Branches, classId: ClassId): (DashPerk | undefined)[] {
  const out: (DashPerk | undefined)[] = [];
  let open = true;
  for (let t = 1; t <= 3; t++) {
    const pair = DASH_PERKS[classId][t - 1]!;
    const perk = open ? pair.find((p) => p.id === branches[key(classId, t)]) : undefined;
    out.push(perk);
    if (!perk) open = false;
  }
  return out;
}
export const dashLevel = (branches: Branches, classId: ClassId) => chosenPerks(branches, classId).filter(Boolean).length;

/** the dash's numbers after all bought perks */
export function dashStats(classId: ClassId, branches: Branches = {}): DashStats {
  return chosenPerks(branches, classId).reduce<DashStats>((s, p) => (p ? p.apply(s) : s), { ...DASHES[classId].base });
}

export type UpgradeResult = { progress: DashProgress; spent: number } | { error: string };
/** Buy a perk (next tier in order) or retune an earlier tier. */
export function upgradeDash<T extends DashProgress>(p: T, classId: ClassId, tier: 1 | 2 | 3, perkId: string): ({ progress: T; spent: number } | { error: string }) {
  const perk = DASH_PERKS[classId][tier - 1]!.find((x) => x.id === perkId);
  if (!perk) return { error: "Unknown perk" };
  const level = dashLevel(p.abilityBranches, classId);
  const have = p.abilityBranches[key(classId, tier)];
  if (tier > level + 1) return { error: `Unlock tier ${level + 1} first` };
  if (have === perkId && tier <= level) return { error: "Already chosen" };
  const cost = tier <= level ? RETUNE_COST : TIER_COST[tier - 1]!;
  if (p.calibrationTokens < cost) return { error: `Needs ${cost} calibration token${cost > 1 ? "s" : ""}` };
  return { spent: cost, progress: { ...p, calibrationTokens: p.calibrationTokens - cost, abilityBranches: { ...p.abilityBranches, [key(classId, tier)]: perkId } } };
}

/* ---------------- runtime ---------------- */
export type DashState = { charges: number; recharge: number; active: number; total: number; dirX: number; dirZ: number; speed: number; invuln: number; hover: number; hit: Set<number> };
export const createDashState = (classId: ClassId, branches: Branches = {}): DashState => ({ charges: dashStats(classId, branches).charges, recharge: 0, active: 0, total: 0, dirX: 0, dirZ: 0, speed: 0, invuln: 0, hover: 0, hit: new Set() });

/** Start a dash along (dirX, dirZ). False when none stored, already dashing, or no direction. */
export function tryDash(s: DashState, stats: DashStats, dirX: number, dirZ: number): boolean {
  const l = Math.hypot(dirX, dirZ);
  if (s.charges < 1 || s.active > 0 || l < 1e-6) return false;
  s.charges--;
  if (s.recharge <= 0) s.recharge = stats.cooldown;
  s.active = s.total = stats.duration;
  s.dirX = dirX / l; s.dirZ = dirZ / l; s.speed = stats.distance / stats.duration;
  s.invuln = stats.iframes; s.hover = 0; s.hit = new Set();
  return true;
}
/** Returns the dash's horizontal speed this frame (0 when not dashing). Ends with a hover window and recharges stored dashes. */
export function stepDash(s: DashState, stats: DashStats, dt: number): number {
  s.invuln = Math.max(0, s.invuln - dt);
  s.hover = Math.max(0, s.hover - dt);
  if (s.charges < stats.charges) {
    s.recharge -= dt;
    if (s.recharge <= 0) { s.charges++; s.recharge = s.charges < stats.charges ? stats.cooldown : 0; }
  }
  if (s.active <= 0) return 0;
  const prev = s.active;
  s.active = Math.max(0, s.active - dt);
  if (s.active === 0 && prev > 0) s.hover = stats.hover;
  return s.speed;
}
/** Record an enemy passed (once per dash). Returns true the first time; refunds cooldown per the perks. */
export function dashHit(s: DashState, stats: DashStats, enemyId: number): boolean {
  if (s.hit.has(enemyId)) return false;
  s.hit.add(enemyId);
  if (stats.refundOnHit > 0 && s.charges < stats.charges) s.recharge = Math.max(0.01, s.recharge - stats.refundOnHit);
  return true;
}
export const dashInvulnerable = (s: DashState) => s.invuln > 0;
/** damage taken while dashing (resist), 1 when not dashing */
export const dashDamageTaken = (s: DashState, stats: DashStats) => (s.active > 0 ? 1 - stats.resist : 1);
/** fall speed cap during a hover window: stalls descent */
export const hoverVy = (s: DashState, vy: number) => (s.hover > 0 && vy < -1.5 ? -1.5 : vy);
