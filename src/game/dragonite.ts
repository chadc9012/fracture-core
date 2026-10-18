/**
 * Dragonite bond system, beyond the first Vyrak win (pure; builds on dragon-covenant.ts).
 * Everything is per Operator class: bond, upgrades and clears are keys in earnedRewards, so the cloud merge unions them and one
 * Operator's win never unlocks another's.
 *   covenant:vyrak:<CLASS>                 bond (dragon-covenant.ts)
 *   dragonite-up:<CLASS>:<ability>:<n>     upgrade n (1..4) bought for an ability
 *   covenant-clear:<CLASS>:<n>             nth Vyrak clear
 *   covenant-challenge:<CLASS>:<id>        optional challenge completed (once)
 * Four abilities channel the dragon's power (Dragonfire, Wyrmwing, Dragonhide); Wyrmcall summons the dragon itself.
 */
import type { ClassId, PlayerProgression } from "./progression";
import type { GearItem } from "./inventory";
import { claimCovenant, dragoniteGear, isBonded } from "./dragon-covenant";

export type DragoniteId = "dragonfire" | "wyrmwing" | "dragonhide" | "wyrmcall" | "roar" | "scalebreaker" | "skyfall";
export type DragoniteDef = { id: DragoniteId; name: string; kind: "OFFENSE" | "MOBILITY" | "DEFENSE" | "SUMMON" | "CONTROL" | "ULTIMATE"; cooldown: number; energy: number; windup: number; blurb: string; upgrades: readonly [string, string, string, string] };
export const DRAGONITE: Record<DragoniteId, DragoniteDef> = {
  dragonfire: { id: "dragonfire", name: "Dragonfire", kind: "OFFENSE", cooldown: 18, energy: 25, windup: 0.6, blurb: "A forward cone of violet fire that leaves Fracture Burn.", upgrades: ["Longer range", "Wider cone", "More damage to corrupted enemies", "Eruption at the end of the breath"] },
  wyrmwing: { id: "wyrmwing", name: "Wyrmwing", kind: "MOBILITY", cooldown: 22, energy: 20, windup: 0.2, blurb: "Spectral wings: a launch, a controlled glide and one air dash.", upgrades: ["Higher launch", "Longer glide", "Second air dash", "Aerial strike on landing"] },
  dragonhide: { id: "dragonhide", name: "Dragonhide", kind: "DEFENSE", cooldown: 30, energy: 30, windup: 0, blurb: "Spectral scales: damage resistance and less stagger. Time it for a bonus.", upgrades: ["More resistance", "Less stagger", "Wider perfect-timing window", "Shares a smaller shield with nearby allies"] },
  wyrmcall: { id: "wyrmcall", name: "Wyrmcall", kind: "SUMMON", cooldown: 120, energy: 60, windup: 0.8, blurb: "Vyrak answers: strafing runs, dragonfire on a group, interrupts, a finishing assault.", upgrades: ["Longer stay", "Shorter cooldown", "Another strafing run", "Finishing assault on bosses"] },
  roar: { id: "roar", name: "Roar of Ruin", kind: "CONTROL", cooldown: 26, energy: 28, windup: 0.4, blurb: "Vyrak bellows: nearby enemies are staggered and their next attack is delayed. Bosses only lose poise.", upgrades: ["Wider roar", "Longer stagger", "Enemies take extra damage while staggered", "Shockwave knocks smaller enemies back"] },
  scalebreaker: { id: "scalebreaker", name: "Scalebreaker", kind: "OFFENSE", cooldown: 20, energy: 22, windup: 0.3, blurb: "A tail-and-claw slam in front of you that shatters armor and hits boss poise hard.", upgrades: ["More damage", "Larger arc", "Strips enemy shields", "Second strike"] },
  skyfall: { id: "skyfall", name: "Skyfall", kind: "ULTIMATE", cooldown: 150, energy: 80, windup: 1.0, blurb: "Vyrak climbs, then dives onto the target area in a violet impact. Needs room above and is a late-game finisher.", upgrades: ["Larger impact", "Shorter cooldown", "Leaves Fracture Burn", "Furious Vyrak hits harder"] },
};
export const DRAGONITE_IDS = Object.keys(DRAGONITE) as DragoniteId[];
export const MAX_UPGRADE = 4;
export const UPGRADE_COST = [3, 6, 10, 15] as const; // Dragonite material
/** the same 50% cap the rest of the game's resistance obeys */
export const RESIST_CAP = 0.5;

const upKey = (c: ClassId, a: DragoniteId, n: number) => `dragonite-up:${c}:${a}:${n}`;
export const upgradeLevel = (p: Pick<PlayerProgression, "earnedRewards">, c: ClassId, a: DragoniteId): number => {
  let n = 0;
  while (n < MAX_UPGRADE && p.earnedRewards.includes(upKey(c, a, n + 1))) n++;
  return n;
};
export const hasAbility = (p: Pick<PlayerProgression, "earnedRewards">, c: ClassId | null) => isBonded(p, c);

export function upgradeDragonite(p: PlayerProgression, c: ClassId | null, a: DragoniteId): { progression: PlayerProgression } | { error: string } {
  if (!c || !isBonded(p, c)) return { error: "Bond with Vyrak on this Operator first" };
  const lv = upgradeLevel(p, c, a);
  if (lv >= MAX_UPGRADE) return { error: "Fully upgraded" };
  const cost = UPGRADE_COST[lv]!;
  const have = p.materials.dragonite ?? 0;
  if (have < cost) return { error: `Needs ${cost} Dragonite (you have ${have})` };
  return { progression: { ...p, materials: { ...p.materials, dragonite: have - cost }, earnedRewards: [...p.earnedRewards, upKey(c, a, lv + 1)] } };
}

/* ---------------- armor: Vyrak's Covenant pieces ---------------- */
export type CovenantPiece = "helmet" | "chest" | "gauntlets" | "legs" | "classItem";
export const PIECE_NAMES: Record<CovenantPiece, string> = { helmet: "Wyrm Crown", chest: "Fractureheart Plate", gauntlets: "Talon Grips", legs: "Skybreaker Greaves", classItem: "Covenant Sigil" };
export const PIECE_FOCUS: Record<CovenantPiece, string> = {
  helmet: "Dragonite abilities cost 10% less energy", chest: "Dragonhide gives extra stagger protection", gauntlets: "Dragonfire applies Fracture Burn more reliably",
  legs: "Wyrmwing gains better aerial control", classItem: "Wyrmcall lasts 15% longer",
};
/** How many Covenant pieces are worn (set id dragons-covenant) */
export function wornCovenant(inventory: readonly GearItem[], equipped: Partial<Record<string, string>>): CovenantPiece[] {
  const ids = new Set(Object.values(equipped));
  return inventory.filter((g) => g.setId === "dragons-covenant" && ids.has(g.id)).map((g) => g.slot as CovenantPiece);
}
export type ArmorBonus = { energyCost: number; stagger: number; burnChance: number; airControl: number; summonTime: number; potency: number; enhanced: DragoniteId | null; aura: boolean };
/** Pieces matter on their own; 2 / 3 / 5 pieces add a little more. Never required, and the total stays small so mixed builds remain viable. */
export function armorBonus(worn: readonly CovenantPiece[], enhance: DragoniteId | null = null): ArmorBonus {
  const has = (p: CovenantPiece) => worn.includes(p), n = new Set(worn).size;
  return {
    energyCost: has("helmet") ? 0.1 : 0, stagger: has("chest") ? 0.15 : 0, burnChance: has("gauntlets") ? 0.2 : 0, airControl: has("legs") ? 0.2 : 0, summonTime: has("classItem") ? 0.15 : 0,
    potency: n >= 5 ? 0.12 : n >= 2 ? 0.04 : 0,
    enhanced: n >= 3 ? enhance : null,
    aura: n >= 5,
  };
}
/** appearance stage from the number of Vyrak clears: I newly bonded, II awakened (3 clears), III ancient ascendant (6) */
export const clearCount = (p: Pick<PlayerProgression, "earnedRewards">, c: ClassId) => p.earnedRewards.filter((r) => r.startsWith(`covenant-clear:${c}:`)).length;
export const appearanceStage = (clears: number): 1 | 2 | 3 => (clears >= 6 ? 3 : clears >= 3 ? 2 : 1);

/* ---------------- ability numbers ---------------- */
export type DragoniteStats = { cooldown: number; energy: number; [k: string]: number };
export function dragoniteStats(id: DragoniteId, level: number, armor: ArmorBonus, base = DRAGONITE[id]): DragoniteStats {
  const L = Math.max(0, Math.min(MAX_UPGRADE, level));
  const boost = 1 + armor.potency + (armor.enhanced === id ? 0.15 : 0);
  const energy = Math.round(base.energy * (1 - armor.energyCost));
  switch (id) {
    case "dragonfire": return { cooldown: base.cooldown, energy, damage: (6 + 1.5 * L) * boost, range: 10 + (L >= 1 ? 3 : 0), coneDeg: 40 + (L >= 2 ? 20 : 0), corruptedMult: L >= 3 ? 1.5 : 1.2, burnSeconds: 4, burnChance: Math.min(1, 0.7 + armor.burnChance), eruption: L >= 4 ? 1 : 0 };
    case "wyrmwing": return { cooldown: base.cooldown, energy, launch: (9 + (L >= 1 ? 2 : 0)) * boost, glideSeconds: 4 + (L >= 2 ? 2 : 0), airDashes: L >= 3 ? 2 : 1, control: 0.5 + armor.airControl, landingStrike: L >= 4 ? 1 : 0 };
    case "dragonhide": return { cooldown: base.cooldown, energy, resist: Math.min(RESIST_CAP, (0.25 + 0.03 * L) * boost), duration: 8, stagger: Math.min(0.9, 0.3 + (L >= 2 ? 0.2 : 0) + armor.stagger), perfectWindow: 0.3 + (L >= 3 ? 0.15 : 0), perfectBonus: 0.1, allyShield: L >= 4 ? 0.1 : 0 };
    case "roar": return { cooldown: base.cooldown, energy, radius: (9 + (L >= 1 ? 3 : 0)) * boost, stagger: 2 + (L >= 2 ? 1.2 : 0), vulnMult: L >= 3 ? 1.25 : 1, vulnSeconds: 6, knockback: L >= 4 ? 5 : 0 };
    case "scalebreaker": return { cooldown: base.cooldown, energy, damage: (8 + 2 * L) * boost, arcDeg: 70 + (L >= 1 ? 30 : 0), range: 5.5, shieldBreak: L >= 2 ? 1 : 0, strikes: L >= 3 ? 2 : 1 };
    case "skyfall": return { cooldown: L >= 1 ? 120 : base.cooldown, energy, radius: (9 + (L >= 2 ? 3 : 0)) * boost, damage: 32 * boost, windup: base.windup, burn: L >= 3 ? 1 : 0, furyMult: L >= 4 ? 1.5 : 1 };
    case "wyrmcall": return { cooldown: Math.max(60, 120 - (L >= 2 ? 25 : 0)), energy, duration: (12 + (L >= 1 ? 4 : 0)) * (1 + armor.summonTime), strafes: 1 + (L >= 3 ? 1 : 0), damage: 14 * boost, finisher: L >= 4 ? 1 : 0 };
  }
}
/** Total resistance the player ends up with: the Dragonhide bonus stacks with armor but the game-wide cap holds. */
export const cappedResist = (armorResist: number, dragonhide: number) => Math.min(RESIST_CAP, Math.max(0, armorResist) + Math.max(0, dragonhide));

/* ---------------- repeat clears and optional challenges ---------------- */
export type ChallengeId = "unbroken-covenant" | "wings-of-the-ancient" | "dragons-patience";
export const CHALLENGES: Record<ChallengeId, { name: string; how: string; ornament: string; title: string }> = {
  "unbroken-covenant": { name: "The Unbroken Covenant", how: "Defeat Vyrak in a rematch without dying.", ornament: "Unbroken Crest", title: "Unbroken" },
  "wings-of-the-ancient": { name: "Wings of the Ancient", how: "Defeat Vyrak in a rematch within 5 minutes of the summons.", ornament: "Ancient Wingtips", title: "Wingbound" },
  "dragons-patience": { name: "The Dragon's Patience", how: "Answer each hidden attack pattern correctly.", ornament: "Patient Scale", title: "Patient One" },
};
/** Challenges the game can really measure from a rematch claim. "dragons-patience" needs hidden-pattern tracking that is not built, so it is not awarded yet. */
export const WINGS_SECONDS = 300;
export function challengesMet(claim: { elapsed?: number | undefined; deaths?: number | undefined }): ChallengeId[] {
  const out: ChallengeId[] = [];
  if (claim.deaths === 0) out.push("unbroken-covenant");
  if (claim.elapsed !== undefined && claim.elapsed <= WINGS_SECONDS) out.push("wings-of-the-ancient");
  return out;
}
export const challengeKey = (c: ClassId, id: ChallengeId) => `covenant-challenge:${c}:${id}`;

/** Record a Vyrak clear for this Operator. First clear: the bond (dragon-covenant.ts). Later clears: Dragonite material, and every 2nd one an extra
 * Covenant piece variant. Each challenge pays an ornament + title once. Clear and reward keys make a repeated call with the same `runId` pay nothing. */
export function recordVyrakClear(p: PlayerProgression, c: ClassId | null, runId: string, challenges: readonly ChallengeId[] = []): { progression: PlayerProgression; firstBond: boolean; gained: string[] } {
  if (!c) return { progression: p, firstBond: false, gained: [] };
  const done = `covenant-run:${c}:${runId}`;
  if (p.earnedRewards.includes(done)) return { progression: p, firstBond: false, gained: [] };
  const gained: string[] = [];
  let next: PlayerProgression = { ...p, earnedRewards: [...p.earnedRewards, done] };
  const first = claimCovenant(next, c);
  next = first.progression;
  if (first.bonded) gained.push("Vyrak bond", "Dragonite armor", "Dragonite abilities");
  else {
    next = { ...next, materials: { ...next.materials, dragonite: (next.materials.dragonite ?? 0) + 3 } };
    gained.push("3 Dragonite");
    const clears = clearCount(next, c) + 1;
    if (clears % 2 === 0) {
      const slot = (["helmet", "chest", "gauntlets", "legs", "classItem"] as const)[(clears / 2 - 1) % 5]!;
      const base = dragoniteGear(c).find((g) => g.slot === slot)!;
      const extra: GearItem = { ...base, id: `${base.id}-r${clears}`, name: `${base.name} (Rolled)`, power: base.power + Math.min(20, clears * 2) };
      next = { ...next, inventory: [...next.inventory, extra] };
      gained.push(extra.name);
    }
  }
  next = { ...next, earnedRewards: [...next.earnedRewards, `covenant-clear:${c}:${clearCount(next, c) + 1}`] };
  for (const ch of challenges) {
    const k = challengeKey(c, ch);
    if (next.earnedRewards.includes(k) || !CHALLENGES[ch]) continue;
    next = { ...next, earnedRewards: [...next.earnedRewards, k] };
    gained.push(`${CHALLENGES[ch].ornament} · title ${CHALLENGES[ch].title}`);
  }
  return { progression: next, firstBond: first.bonded, gained };
}

/* ---------------- Wyrmcall ally state machine ---------------- */
export type WyrmState = "BONDED" | "APPROACH" | "ASSESS" | "ATTACK" | "DEFEND" | "WITHDRAW" | "RECOVERY";
export type WyrmTarget = { id: number; dist: number; boss: boolean; windingUp: boolean };
export type Wyrm = { state: WyrmState; t: number; left: number; strafesLeft: number; target: number | null; cooldown: number; finished: boolean };
export const createWyrm = (): Wyrm => ({ state: "BONDED", t: 0, left: 0, strafesLeft: 0, target: null, cooldown: 0, finished: false });
export type WyrmAction = { kind: "strafe" | "breath" | "interrupt" | "finisher"; target: number } | null;
export const APPROACH_TIME = 1.2, ATTACK_TIME = 1.6, ASSESS_TIME = 0.5, WITHDRAW_TIME = 1.0;

export function summonWyrm(w: Wyrm, stats: DragoniteStats): boolean {
  if (w.state !== "BONDED" || w.cooldown > 0) return false;
  Object.assign(w, { state: "APPROACH" as WyrmState, t: 0, left: stats["duration"] ?? 12, strafesLeft: stats["strafes"] ?? 1, target: null, finished: false });
  return true;
}
/** Advance the dragon. Returns the attack it makes this tick (the host applies damage). Withdraws when time runs out, then recovers for `cooldown`. */
export function stepWyrm(w: Wyrm, dt: number, targets: readonly WyrmTarget[], stats: DragoniteStats): WyrmAction {
  w.cooldown = Math.max(0, w.cooldown - dt);
  if (w.state === "BONDED" || w.state === "RECOVERY") { if (w.state === "RECOVERY" && w.cooldown <= 0) w.state = "BONDED"; return null; }
  w.t += dt; w.left -= dt;
  if (w.state !== "WITHDRAW" && w.left <= 0) { w.state = "WITHDRAW"; w.t = 0; return null; }
  switch (w.state) {
    case "APPROACH": if (w.t >= APPROACH_TIME) { w.state = "ASSESS"; w.t = 0; } return null;
    case "ASSESS": {
      if (w.t < ASSESS_TIME) return null;
      const threat = targets.find((x) => x.windingUp && !x.boss);
      if (threat) { w.state = "DEFEND"; w.t = 0; w.target = threat.id; return null; }
      const pick = [...targets].sort((a, b) => Number(b.boss) - Number(a.boss) || a.dist - b.dist)[0];
      if (!pick) { w.t = 0; return null; }
      w.state = "ATTACK"; w.t = 0; w.target = pick.id;
      return null;
    }
    case "ATTACK": {
      if (w.t < ATTACK_TIME) return null;
      const target = w.target ?? 0, boss = targets.find((x) => x.id === target)?.boss ?? false;
      w.t = 0;
      if (boss && stats["finisher"] && w.strafesLeft <= 0) { w.state = "WITHDRAW"; return { kind: "finisher", target }; }
      const action: WyrmAction = w.strafesLeft > 0 ? { kind: "strafe", target } : { kind: "breath", target };
      if (w.strafesLeft > 0) w.strafesLeft--;
      w.state = "ASSESS";
      return action;
    }
    case "DEFEND": { const target = w.target ?? 0; w.state = "ASSESS"; w.t = 0; return { kind: "interrupt", target }; }
    case "WITHDRAW":
      if (w.t >= WITHDRAW_TIME) { w.state = "RECOVERY"; w.cooldown = stats.cooldown; w.finished = true; }
      return null;
    default: return null;
  }
}
