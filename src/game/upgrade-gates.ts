/** Upgrade gates: past the first levels, upgrading a weapon or armor piece needs a special material that must be EARNED (or, for one of
 * them, bought), so power cannot be bought with farmed scrap alone.
 *   forgeCatalyst - weapons from level 3. Earned only: first clear of a main mission, first clear of a dungeon.
 *   tuningCore    - armor from level 4. Earned by side contracts, or bought at mod shops.
 * Pure data + checks; inventory.upgradeGear enforces them and pays them. */
import type { GearItem, MaterialId } from "./inventory";

export type UpgradeGate = { material: Extract<MaterialId, "forgeCatalyst" | "tuningCore">; amount: number; fromLevel: number; earnedBy: string };
const WEAPON_SLOTS = ["primary", "secondary", "heavy"];
export const WEAPON_GATE: UpgradeGate = { material: "forgeCatalyst", amount: 1, fromLevel: 3, earnedBy: "First clear of a main mission or a dungeon" };
export const ARMOR_GATE: UpgradeGate = { material: "tuningCore", amount: 1, fromLevel: 4, earnedBy: "Side contracts, or buy at a mod shop" };

/** the gate that applies to upgrading `item` to its next level, or null while it is still free */
export function upgradeGate(item: Pick<GearItem, "slot" | "level">): UpgradeGate | null {
  if (item.slot === "vehicle") return null;
  const g = WEAPON_SLOTS.includes(item.slot) ? WEAPON_GATE : ARMOR_GATE;
  return item.level >= g.fromLevel ? g : null;
}
/** side contracts and main missions pay the special materials once, on first clear */
export const isSideContract = (id: string) => id.startsWith("side-");
export const FIRST_CLEAR_SPECIAL = (missionId: string): Partial<Record<MaterialId, number>> => (isSideContract(missionId) ? { tuningCore: 1 } : missionId === "mission-01" ? {} : { forgeCatalyst: 1 });
