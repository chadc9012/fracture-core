/** The Arsenal's Index and Vault lists (pure). The Index is every weapon you carry (primary, secondary and heavy gear that is
 * not stored in the vault); the Vault is the same kind of gear stored off your carried inventory (stash.ts). A weapon is
 * in exactly one of the two. */
import type { GearItem, GearSlot } from "./inventory";
import { inVault } from "./stash";
import type { PlayerProgression } from "./progression";

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
