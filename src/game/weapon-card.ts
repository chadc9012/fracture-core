/**
 * What a weapon's card says about its class (pure; character-sheet.ts itemTooltip shows it). Everything comes from the rules combat
 * uses, so the card cannot drift from the game: the class from weapon-classes.ts (the item's slot and name), the role, range band
 * and headshot multiplier from weapon-meta.ts, and shots to kill from `shotsToKill` against a regular trooper and an elite, with
 * this item's own power (inventory.ts weaponDamageMultiplier) and a fresh build's damage, at equal power level, inside the band.
 */
import { frameDef, frameFor, type FrameId } from "./weapon-classes";
import { shotsToKill, WEAPON_META, type WeaponRole } from "./weapon-meta";
import { weaponDamageMultiplier, type GearItem } from "./inventory";

/** the build damage a card assumes: Scene's 1.2 base x the smallest ability-synergy bonus (weapon-meta.test.ts FRESH) */
export const CARD_BUILD = 1.2 * 1.08;
/** the enemies a card counts against: a regular trooper and an elite of a mid-to-hard region (sim.ts spawnMachine) */
export const CARD_TARGETS = { trooper: 5, elite: 11 } as const;

export type WeaponProfile = {
  frame: FrameId;
  className: string;
  role: WeaponRole;
  roleLabel: string;
  /** full damage out to this range (m); Infinity for explosives and melee */
  range: number;
  precision: number;
  /** trigger pulls to kill (a shotgun's pellets are one shot, a pulse burst or a fusion volley one pull) */
  kills: Record<keyof typeof CARD_TARGETS, { body: number; head: number }>;
  /** what one pull is called: "shot", "burst" or "volley" */
  unit: "shot" | "burst" | "volley";
};

/** the class a weapon item fires as, from the slot it equips into: primary -> the Auto Rifle's slot, secondary -> the Pulse
 * Rifle's, heavy -> the Heavy Cannon's (Scene's equippedWeapon lookup) */
export function frameOfItem(item: Pick<GearItem, "slot" | "name">): FrameId | null {
  if (item.slot === "primary") return frameFor("AUTO", item.name);
  if (item.slot === "secondary") return frameFor("PULSE", item.name);
  if (item.slot === "heavy") return frameFor("HEAVY", item.name);
  return null;
}

export function weaponProfile(item: Pick<GearItem, "slot" | "name" | "power">): WeaponProfile | null {
  const frame = frameOfItem(item);
  if (!frame) return null;
  const meta = WEAPON_META[frame], def = frameDef(frame);
  const scale = CARD_BUILD * weaponDamageMultiplier(item.power);
  // counted inside the band (at its edge, or close for melee/explosives) so the card shows what the gun does in its job
  const distance = Number.isFinite(meta.rangeFull) ? Math.min(meta.rangeFull, 30) : 5;
  const perPull = Math.max(1, def.burst) * (def.pellets ?? 1);
  const pulls = (hits: number) => (Number.isFinite(hits) ? Math.ceil(hits / perPull) : Infinity);
  const kills = {} as WeaponProfile["kills"];
  for (const [k, hp] of Object.entries(CARD_TARGETS) as [keyof typeof CARD_TARGETS, number][]) {
    kills[k] = { body: pulls(shotsToKill(frame, hp, { distance, precision: false, scale })), head: pulls(shotsToKill(frame, hp, { distance, precision: true, scale })) };
  }
  const unit = def.burst > 1 ? (frame === "FUSION" ? "volley" : "burst") : "shot";
  return { frame, className: def.name, role: meta.role, roleLabel: meta.label, range: meta.rangeFull, precision: meta.precision, kills, unit };
}

/** the card's one-line kill summary, e.g. "Trooper: 1 shot · Elite: 2 shots (1 to the head)" */
export function killLine(p: WeaponProfile): string {
  const n = (x: number) => (Number.isFinite(x) ? `${x} ${p.unit}${x === 1 ? "" : "s"}` : "—");
  const part = (label: string, k: { body: number; head: number }) => `${label}: ${n(k.body)}${k.head < k.body ? ` (${k.head} to the head)` : ""}`;
  return `${part("Trooper", p.kills.trooper)} · ${part("Elite", p.kills.elite)}`;
}
