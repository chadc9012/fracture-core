/**
 * Transmog (owner's board, Nov 1: "keep stats, change appearance"): each armour slot can show any owned piece for that slot
 * while the equipped piece keeps its stats and set bonuses. The choice lives on progression.transmog; armor-look.ts reads it
 * for the motif and colour, armor-sets.ts never sees it. Pure rules.
 */
import type { SetSlot } from "./armor-sets.ts";
/** armor-sets.ts SET_SLOTS, listed here so this module stays free of that module's imports (tests run it under plain node) */
const SET_SLOTS: readonly SetSlot[] = ["helmet", "gauntlets", "chest", "legs", "classItem"];
import type { GearItem } from "./inventory.ts";

export type Transmog = Partial<Record<SetSlot, string>>;
export type TransmogStore = { inventory: GearItem[]; transmog: Transmog };

/** drops entries that don't point at an owned piece of that slot (sold, dismantled, or an old save) */
export function normalizeTransmog(raw: unknown, inventory: readonly GearItem[]): Transmog {
  if (!raw || typeof raw !== "object") return {};
  const out: Transmog = {};
  for (const slot of SET_SLOTS) {
    const id = (raw as Record<string, unknown>)[slot];
    if (typeof id === "string" && inventory.some((g) => g.id === id && g.slot === slot)) out[slot] = id;
  }
  return out;
}
/** the pieces a slot could show: everything owned for that slot */
export const transmogOptions = (p: Pick<TransmogStore, "inventory">, slot: SetSlot): GearItem[] => p.inventory.filter((g) => g.slot === slot);
/** shows `id` (an owned piece of `slot`) in that slot; null clears it (the equipped piece shows again) */
export function setTransmog<P extends TransmogStore>(p: P, slot: SetSlot, id: string | null): P {
  if (id === null) { if (!(slot in p.transmog)) return p; const next = { ...p.transmog }; delete next[slot]; return { ...p, transmog: next }; }
  if (!p.inventory.some((g) => g.id === id && g.slot === slot) || p.transmog[slot] === id) return p;
  return { ...p, transmog: { ...p.transmog, [slot]: id } };
}
