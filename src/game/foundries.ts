/** Weapon foundries, the weapon taxonomy and monoblades (pure), from the owner's "Foundry Arsenal" brief.
 *
 * Foundry: every weapon GearItem belongs to one of five foundries. It is derived from the item (explicit `foundry`, else
 * keywords in its name, else a stable hash), so existing saves need no migration. The equipped weapon's foundry is a real
 * combat rule (sim.ts / Scene read `FOUNDRY_RULES`):
 *   Omolon     — Liquid Ammo: −25% weapon heat per shot
 *   Häkke      — Wall-Piercer: +20% damage to elites and bosses
 *   SUROS      — Dampeners: −30% recoil
 *   Tex Mech.  — Fan the Hammer: +25% damage from the hip (not aiming)
 *   Black Armory — Nanite Swarm: a player kill sends 1.5 damage into the nearest hostile within 10 m
 * Taxonomy (Kinetics / Exotics / Explosives / Delivery Systems) is descriptive only.
 *
 * Monoblades replace how the melee weapon (SWORD) swings. Owned blades live in earnedRewards (`blade:<id>`), the equipped
 * one in `progression.blade`. They are earned in the Wastelands: Vectal from the first vault defense, Sun-Cutter from the
 * Rust Run gold medal, the Aegis broadsword from the Mash-Pit gold medal. */
import type { GearItem } from "./inventory";

export type FoundryId = "OMOLON" | "HAKKE" | "SUROS" | "TEX_MECHANICA" | "BLACK_ARMORY";
export const FOUNDRIES: Record<FoundryId, { id: FoundryId; name: string; philosophy: string; perk: string; text: string; color: string }> = {
  OMOLON: { id: "OMOLON", name: "Omolon Dynamics", philosophy: "Directed energy and liquid-ammo electronics", perk: "Liquid Ammo", text: "−25% weapon heat per shot", color: "#38e8ff" },
  HAKKE: { id: "HAKKE", name: "Häkke Heavy Ordnance", philosophy: "Rugged military ballistics and stamped steel", perk: "Wall-Piercer", text: "+20% damage to elites and bosses", color: "#ffb23e" },
  SUROS: { id: "SUROS", name: "SUROS Design Group", philosophy: "Precision aerodynamics and ergonomic framing", perk: "Dampeners", text: "−30% recoil", color: "#ff4d5e" },
  TEX_MECHANICA: { id: "TEX_MECHANICA", name: "Tex Mechanica Precision", philosophy: "Embossed cast steel and hand-carved wood", perk: "Fan the Hammer", text: "+25% damage from the hip", color: "#d4a14a" },
  BLACK_ARMORY: { id: "BLACK_ARMORY", name: "Black Armory", philosophy: "Dark iron, nanite injection, bio-mechanical geometry", perk: "Nanite Swarm", text: "Kills send nanites into the nearest hostile", color: "#b968ff" },
};
export const FOUNDRY_RULES = { omolonHeat: 0.75, hakkeArmored: 1.2, surosRecoil: 0.7, texHip: 1.25, naniteDamage: 1.5, naniteRange: 10 } as const;

const WEAPON_SLOTS = new Set<GearItem["slot"]>(["primary", "secondary", "heavy"]);
const KEYWORDS: readonly [RegExp, FoundryId][] = [
  [/void|singularity|horizon|anomal|genesis|eternity|antiphon|hourglass/i, "BLACK_ARMORY"],
  [/pulse|arc|cryo|plasma|phase|caster|bio-lum/i, "OMOLON"],
  [/\bmg\b|mag-cannon|heavy|repeater|minigun|maul|frontline/i, "HAKKE"],
  [/dmr|rifle|carbine|smg/i, "SUROS"],
  [/pistol|sidearm|slugger|crossbow|revolver/i, "TEX_MECHANICA"],
];
const ORDER: readonly FoundryId[] = ["OMOLON", "HAKKE", "SUROS", "TEX_MECHANICA", "BLACK_ARMORY"];
const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

/** the foundry of a weapon item (null for armor and vehicles) */
export function foundryOf(item: Pick<GearItem, "name" | "slot"> & { foundry?: FoundryId | undefined } | null | undefined): FoundryId | null {
  if (!item || !WEAPON_SLOTS.has(item.slot)) return null;
  if (item.foundry) return item.foundry;
  for (const [re, f] of KEYWORDS) if (re.test(item.name)) return f;
  return ORDER[hash(item.name) % ORDER.length]!;
}

export type Taxonomy = { category: "KINETICS" | "EXOTICS" | "EXPLOSIVES" | "DELIVERY SYSTEMS"; type: string };
export function taxonomyOf(item: Pick<GearItem, "name" | "slot" | "element">): Taxonomy | null {
  if (!WEAPON_SLOTS.has(item.slot)) return null;
  if (/rocket|launcher|cinder|frostbite|vitriol|missile/i.test(item.name)) return { category: "DELIVERY SYSTEMS", type: "Rockets" };
  if (/grenade|charge|mortar/i.test(item.name)) return { category: "EXPLOSIVES", type: "Chemical Explosives" };
  if (/blade|sword|maul|edge/i.test(item.name)) return { category: "KINETICS", type: "Monoblades" };
  if (/rail|gauss|coil|mag-cannon/i.test(item.name)) return { category: "KINETICS", type: "Railguns & Gauss" };
  if (item.element !== "KINETIC") return { category: "EXOTICS", type: item.element === "ARC" ? "Particle Guns" : "Directed Energy" };
  return { category: "KINETICS", type: "Chemical Propellant" };
}

/* ------------------------------------------------------------ monoblades ------------------------------------------------------------ */
export type BladeId = "vectal" | "aegis-broadsword" | "sun-cutter";
export type Blade = {
  id: BladeId; name: string; foundry: FoundryId; rarity: "LEGENDARY" | "EXOTIC"; perk: string; text: string; source: string;
  /** multiplies the swing's damage (and vs elites/bosses on top) */
  damage: number; armored: number; reach: number;
  /** combo finisher: a ground line in front of you */
  shockwave: { length: number; width: number; damage: number } | null;
  /** seconds after each swing during which incoming damage is halved */
  deflect: number;
};
export const BLADES: Record<BladeId, Blade> = {
  vectal: { id: "vectal", name: "Vectal Monoblade Mk-IV", foundry: "HAKKE", rarity: "LEGENDARY", perk: "Monomolecular Edge", text: "+40% damage to elites and bosses", source: "Hold the Sub-Terra vault gates once", damage: 1.1, armored: 1.4, reach: 0, shockwave: null, deflect: 0 },
  "aegis-broadsword": { id: "aegis-broadsword", name: "Aegis Resonance Broadsword", foundry: "BLACK_ARMORY", rarity: "EXOTIC", perk: "Fracture Shockwave", text: "The third swing sends a violet shockwave 12 m along the ground", source: "Gold medal in the Mash-Pit", damage: 1.25, armored: 1, reach: 1, shockwave: { length: 12, width: 2.5, damage: 4 }, deflect: 0 },
  "sun-cutter": { id: "sun-cutter", name: "Sun-Cutter Curved Sabra", foundry: "SUROS", rarity: "EXOTIC", perk: "Thermal Reflection", text: "+2 m reach; for 0.6 s after each swing, incoming damage is halved", source: "Gold medal on the Rust Run", damage: 1, armored: 1, reach: 2, shockwave: null, deflect: 0.6 },
};
export const bladeKey = (id: BladeId) => `blade:${id}`;
export const ownsBlade = (p: { earnedRewards: readonly string[] }, id: BladeId) => p.earnedRewards.includes(bladeKey(id));
export const ownedBlades = (p: { earnedRewards: readonly string[] }) => (Object.keys(BLADES) as BladeId[]).filter((id) => ownsBlade(p, id));
/** the equipped blade, only if still owned */
export const activeBlade = (p: { earnedRewards: readonly string[]; blade?: string | null | undefined }): Blade | null => (p.blade && p.blade in BLADES && ownsBlade(p, p.blade as BladeId) ? BLADES[p.blade as BladeId] : null);

/** grant a blade once (and equip it if nothing is equipped) */
export function grantBlade<P extends { earnedRewards: string[]; blade: string | null }>(p: P, id: BladeId): { progression: P; granted: boolean } {
  if (ownsBlade(p, id)) return { progression: p, granted: false };
  return { progression: { ...p, earnedRewards: [...p.earnedRewards, bladeKey(id)], blade: p.blade ?? id }, granted: true };
}
export function equipBlade<P extends { earnedRewards: string[]; blade: string | null }>(p: P, id: BladeId | null): P {
  if (id !== null && !ownsBlade(p, id)) return p;
  return { ...p, blade: id };
}

/** swing numbers for the melee weapon with (or without) a monoblade */
export function swingStats(blade: Blade | null, combo: number, base: { damage: number; reach: number }, armored: boolean): { damage: number; reach: number; shockwave: Blade["shockwave"]; deflect: number } {
  const finisher = combo === 3;
  const dmg = base.damage * (finisher ? 1.8 : 1) * (blade?.damage ?? 1) * (armored ? blade?.armored ?? 1 : 1);
  return { damage: dmg, reach: base.reach + (blade?.reach ?? 0), shockwave: finisher ? blade?.shockwave ?? null : null, deflect: blade?.deflect ?? 0 };
}

/** is (x,z) inside a shockwave line that starts at (ox,oz) heading `yaw` (yaw 0 = +z)? */
export function inShockwave(sw: NonNullable<Blade["shockwave"]>, ox: number, oz: number, yaw: number, x: number, z: number): boolean {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const dx = x - ox, dz = z - oz;
  const along = dx * fx + dz * fz, across = Math.abs(dx * fz - dz * fx);
  return along >= 0 && along <= sw.length && across <= sw.width;
}
