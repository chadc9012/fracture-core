/** The Arsenal's Index and Vault lists (pure). The Index is every weapon you carry (primary, secondary and heavy gear that is
 * not stored in the vault); the Vault is the same kind of gear stored off your carried inventory (stash.ts). A weapon is
 * in exactly one of the two. */
import type { GearItem, GearSlot } from "./inventory";
import { inVault } from "./stash";
import type { PlayerProgression } from "./progression";
import { WEAPONS, WEAPON_ORDER, type WeaponId } from "./weapons";

export const WEAPON_SLOTS: readonly GearSlot[] = ["primary", "secondary", "heavy"];
const isWeapon = (g: GearItem) => (WEAPON_SLOTS as readonly string[]).includes(g.slot);
const bySlotThenPower = (a: GearItem, b: GearItem) => WEAPON_SLOTS.indexOf(a.slot) - WEAPON_SLOTS.indexOf(b.slot) || b.power - a.power || a.name.localeCompare(b.name);

/** every carried weapon, grouped order: primary, secondary, heavy; strongest first */
export function weaponIndex(p: Pick<PlayerProgression, "inventory" | "vaultIds">): GearItem[] {
  return p.inventory.filter((g) => isWeapon(g) && !inVault(p as PlayerProgression, g.id)).sort(bySlotThenPower);
}
/** weapons stored in the vault */
export function weaponVault(p: Pick<PlayerProgression, "inventory" | "vaultIds">): GearItem[] {
  return p.inventory.filter((g) => isWeapon(g) && inVault(p as PlayerProgression, g.id)).sort(bySlotThenPower);
}

/** the built-in weapons (weapons.ts) with whether the active loadout of the player's class has each slotted; these are not gear, so
 * they sit in their own part of the Index */
export function baseWeaponRows(p: Pick<PlayerProgression, "arsenal" | "identityClass">): { id: WeaponId; name: string; detail: string; slotted: boolean }[] {
  const cls = p.identityClass ?? "TITAN";
  const arsenal = p.arsenal[cls];
  const slots = new Set<WeaponId>(arsenal.loadouts[arsenal.active]?.slots ?? []);
  return WEAPON_ORDER.map((id) => {
    const w = WEAPONS[id];
    const detail = w.kind === "sword" ? "Melee" : `${w.mag} rounds · ${(1 / w.fireRate).toFixed(1)}/s`;
    return { id, name: w.name, detail: `${detail} · ${(w.element ?? "KINETIC").toLowerCase()}`, slotted: slots.has(id) };
  });
}
