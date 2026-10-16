/** Stage 4 — The Dragon's Covenant. Vyrak is a unique dragon encounter (distinct from Vaelith, who is never slain). When an
 * Operator defeats Vyrak, the dragon does not die: it shrinks into a small floating Wyrmling bound to THAT Operator class only.
 * The bond grants a Dragonite armor set and one class ability, and the Wyrmling brings a small Dragonite gift once per day.
 * Pure rules; claims live in earnedRewards (`covenant:vyrak:<CLASS>`, `covenant-gift:<CLASS>:<day>`), so cloud merges union them. */
import type { ClassId, PlayerProgression } from "./progression";
import type { GearItem, GearSlot } from "./inventory";

export const VYRAK = {
  id: "vyrak",
  name: "Vyrak, the Ashen Covenant",
  regionId: "solara",
  minLevel: 12,
  phases: [
    { at: 1, name: "Sky Sovereign", telegraph: "Wings flare gold before a strafing fire run" },
    { at: 0.6, name: "Scale Shedding", telegraph: "Chest plates glow and crack — the weak point opens" },
    { at: 0.25, name: "Covenant Trial", telegraph: "Vyrak lands, roars, and offers the bond if you hold your ground" },
  ],
  intro: [
    { speaker: "Vyrak", text: "Another small thing with a borrowed spark. Show me why the Fracture chose you." },
    { speaker: "NOVA", text: "Its armor sheds under heat. Break the chest plates and the core is exposed." },
  ],
  bond: [
    { speaker: "Vyrak", text: "Enough. You fight like one who will not be ruled. Then I will not rule you — I will walk beside you." },
    { speaker: "NOVA", text: "Its mass is collapsing… it's choosing a smaller form. I think it just joined us." },
  ],
} as const;

export type CovenantAbility = { id: string; name: string; description: string; cooldown: number };
export const COVENANT_ABILITY: Record<ClassId, CovenantAbility> = {
  TITAN: { id: "ember-bulwark", name: "Ember Bulwark", description: "The Wyrmling breathes a wall of flame in front of you that blocks shots and burns enemies who cross it.", cooldown: 45 },
  HUNTER: { id: "wyrm-dash", name: "Wyrm Dash", description: "Dash through enemies trailing dragonfire; each enemy hit refunds dodge energy.", cooldown: 30 },
  WARLOCK: { id: "ash-nova", name: "Ash Nova", description: "The Wyrmling dives and detonates an ash nova that weakens enemies by 15%.", cooldown: 40 },
};

const SLOTS: GearSlot[] = ["helmet", "gauntlets", "chest", "legs", "classItem"];
const PIECE_NAME: Record<string, string> = { helmet: "Crest", gauntlets: "Talons", chest: "Heartscale", legs: "Greaves", classItem: "Covenant Mantle" };
export const dragoniteGear = (cls: ClassId): GearItem[] => SLOTS.map((slot) => ({
  id: `dragonite-${slot}-${cls.toLowerCase()}`, name: `Dragonite ${PIECE_NAME[slot]}`, slot, power: 300, level: 1, element: "THERMAL",
  rarity: "EXOTIC", setId: "dragons-covenant", source: `Vyrak's Covenant (${cls})`,
}));

export const bondKey = (cls: ClassId) => `covenant:vyrak:${cls}`;
export const isBonded = (p: Pick<PlayerProgression, "earnedRewards">, cls: ClassId | null) => !!cls && p.earnedRewards.includes(bondKey(cls));

/** Called once on a confirmed Vyrak defeat. Only the Operator who won is bonded; a second win with the same class pays nothing. */
export function claimCovenant(p: PlayerProgression, cls: ClassId | null): { progression: PlayerProgression; bonded: boolean } {
  if (!cls || isBonded(p, cls)) return { progression: p, bonded: false };
  const owned = new Set(p.inventory.map((g) => g.id));
  const gear = dragoniteGear(cls).filter((g) => !owned.has(g.id));
  return {
    bonded: true,
    progression: {
      ...p,
      earnedRewards: [...p.earnedRewards, bondKey(cls)],
      inventory: [...p.inventory, ...gear],
      materials: { ...p.materials, dragonite: (p.materials.dragonite ?? 0) + 5 },
    },
  };
}

export const GIFT_AMOUNT = 2;
/** The Wyrmling's daily Dragonite gift — only for a bonded class, once per UTC day. */
export function claimWyrmlingGift(p: PlayerProgression, cls: ClassId | null, now = Date.now()): PlayerProgression | null {
  if (!cls || !isBonded(p, cls)) return null;
  const key = `covenant-gift:${cls}:${Math.floor(now / 86_400_000)}`;
  if (p.earnedRewards.includes(key)) return null;
  return { ...p, earnedRewards: [...p.earnedRewards, key], materials: { ...p.materials, dragonite: (p.materials.dragonite ?? 0) + GIFT_AMOUNT } };
}

/** Floating companion pose relative to the Operator: hovers behind the shoulder and bobs. Scene adds this to the player position. */
export function wyrmlingOffset(t: number, yaw: number): [number, number, number] {
  const side = 0.9, back = 0.7, bob = Math.sin(t * 1.6) * 0.15;
  return [Math.cos(yaw) * side - Math.sin(yaw) * back, 2.1 + bob, -Math.sin(yaw) * side - Math.cos(yaw) * back];
}
