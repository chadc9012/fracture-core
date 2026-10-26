/**
 * Weapon classes from gear (pure; Scene reads `arsenalFor`). The catalogue (weapon-catalog.ts) names twelve classes of weapon
 * but every one fired as whatever gun its slot carried, so an equipped "Scout Sniper" was an auto rifle with a new name.
 * Now the equipped item's class decides how the slot's gun fires, CoD Create-a-Class style:
 *
 *  - PRIMARY slot (the Auto Rifle's place in the loadout): assault/auto rifles stay the Auto Rifle; SMGs, snipers (and
 *    crossbows), fusion rifles (and casters/energy weapons) and shotguns fire as their own class (`FRAMES`).
 *  - HEAVY slot: light machine guns fire as an LMG; everything else stays the Heavy Cannon.
 *  - The rest of the loadout (Pulse, Hand Cannon, Shotgun, Sword, launchers) keeps its own gun.
 *
 * A class is resolved from the catalogue by name, else from the item's name (manifest weapons: "Enforcer SMG", "Kinetic
 * DMR", "West Frontline MG"…), else it stays the slot's gun. Range bands, precision and class affinity for each frame live
 * in weapon-meta.ts. The held model is still the slot's own (authored GLBs per class are a later art pass).
 */
import { WEAPON_CATALOG, type CatalogClass } from "./weapon-catalog";
import { WEAPONS, type WeaponDef, type WeaponId } from "./weapons";

/** a frame is a slot gun or one of the gear-only classes */
export type GearFrameId = "SMG" | "SNIPER" | "LMG" | "FUSION";
export type FrameId = WeaponId | GearFrameId;

/** the gear-only classes, in the same units as WEAPONS (damage = multiplier on a base bullet). `sound` borrows a slot gun's voice */
export const FRAMES: Record<GearFrameId, Omit<WeaponDef, "id"> & { sound: WeaponId }> = {
  // fastest fire, best hip fire, weak past close range
  SMG: { name: "Submachine Gun", kind: "gun", damage: 0.72, fireRate: 0.065, burst: 1, burstGap: 0, spread: 0.026, adsSpread: 0.55, recoil: 0.005, knock: 0.6, heat: 0.4, punch: 0.45, mag: 40, reserve: 240, reload: 1.5, sound: "AUTO" },
  // one heavy round at a time: wide from the hip, pin-point aimed, kills from far away
  SNIPER: { name: "Sniper Rifle", kind: "gun", damage: 6.5, fireRate: 1.05, burst: 1, burstGap: 0, spread: 0.06, adsSpread: 0.08, recoil: 0.07, knock: 3, heat: 2.4, punch: 2.8, mag: 5, reserve: 30, reload: 2.6, sound: "HEAVY" },
  // a big magazine and steady mid-range fire, slow to reload; cool enough to empty the whole magazine without venting
  LMG: { name: "Light Machine Gun", kind: "gun", damage: 1.05, fireRate: 0.095, burst: 1, burstGap: 0, spread: 0.045, adsSpread: 0.45, recoil: 0.009, knock: 0.9, heat: 0.5, punch: 0.7, mag: 80, reserve: 320, reload: 3.6, sound: "AUTO" },
  // a five-bolt volley per pull: devastating close, falls off fast. Recoil and heat are charged per bolt, so both are small:
  // at 0.03 a bolt the volley climbed a metre over a head at 12 m, and 1.6 heat a bolt overheated in two pulls (play-test)
  FUSION: { name: "Fusion Rifle", kind: "gun", damage: 2.2, fireRate: 1.1, burst: 5, burstGap: 0.035, spread: 0.02, adsSpread: 0.6, recoil: 0.008, knock: 1.4, heat: 0.55, punch: 1.8, mag: 20, reserve: 100, reload: 2.2, sound: "PULSE" },
};

/** the frame's firing stats: a slot gun's own, or a gear class's */
export function frameDef(frame: FrameId): WeaponDef {
  if (frame in WEAPONS) return WEAPONS[frame as WeaponId];
  const { sound: _s, ...f } = FRAMES[frame as GearFrameId];
  return { id: "AUTO", ...f };
}
export const frameSound = (frame: FrameId): WeaponId => (frame in WEAPONS ? (frame as WeaponId) : FRAMES[frame as GearFrameId].sound);

/** the catalogue class of an item by its name, else one read off the name itself; null when it says nothing */
export function itemClass(name: string | undefined): CatalogClass | null {
  if (!name) return null;
  const cat = WEAPON_CATALOG.find((w) => w.name === name);
  if (cat) return cat.cls;
  const n = name.toLowerCase();
  if (/\bsmg\b|sub-carbine|submachine/.test(n)) return "smg";
  if (/\bdmr\b|sniper|crossbow|\bbow\b|marksman/.test(n)) return "sniper";
  if (/\blmg\b|\bmg\b|minigun|repeater|machine gun/.test(n)) return "lmg";
  if (/fusion|caster|disruptor|lance/.test(n)) return "fusion";
  if (/shotgun|\bsg\b/.test(n)) return "shotgun";
  return null;
}

/** which frame a loadout gun fires with the item equipped in its slot */
export function frameFor(slotGun: WeaponId, itemName: string | undefined): FrameId {
  const cls = itemClass(itemName);
  if (slotGun === "AUTO") {
    if (cls === "smg") return "SMG";
    if (cls === "sniper" || cls === "crossbow") return "SNIPER";
    if (cls === "fusion" || cls === "special") return "FUSION";
    if (cls === "shotgun") return "SHOTGUN";
    return "AUTO";
  }
  if (slotGun === "HEAVY" && cls === "lmg") return "LMG";
  return slotGun;
}

export type ArmedWeapon = WeaponDef & { frame: FrameId; sound: WeaponId };
export type Arsenal = Record<WeaponId, ArmedWeapon>;
type Gear = { inventory: readonly { id: string; name: string; slot: string }[]; equippedGear: Partial<Record<string, string>> } | undefined;

/** every loadout gun as it fires with the current gear: the slot gun's id (ammo, binds and the held model key on it) with
 * the frame's stats and name (the HUD shows the class, e.g. "Sniper Rifle") */
export function arsenalFor(gear: Gear): Arsenal {
  const item = (slot: string) => { const id = gear?.equippedGear[slot]; return id ? gear?.inventory.find((g) => g.id === id && g.slot === slot) : undefined; };
  const out = {} as Arsenal;
  for (const id of Object.keys(WEAPONS) as WeaponId[]) {
    const frame = id === "AUTO" ? frameFor("AUTO", item("primary")?.name) : id === "HEAVY" ? frameFor("HEAVY", item("heavy")?.name) : id;
    out[id] = { ...frameDef(frame), id, frame, sound: frameSound(frame) };
  }
  return out;
}
