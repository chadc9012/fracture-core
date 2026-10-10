/** Evaluation of weapons and armor: a grade for any item and an honest comparison against what is worn in the same slot. Armor is
 * compared through the same attribute path combat uses (armor-attributes.ts), so the numbers shown here are the numbers that apply. Pure. */
import { loadoutAttributes, type Attributes } from "./armor-attributes";
import type { GearItem } from "./inventory";
import type { PlayerProgression } from "./progression";

export type Grade = "S" | "A" | "B" | "C" | "D";
export const GRADE_FLOOR: readonly [Grade, number][] = [["S", 160], ["A", 125], ["B", 100], ["C", 80], ["D", 0]];
const isWeapon = (i: Pick<GearItem, "slot">) => ["primary", "secondary", "heavy"].includes(i.slot);
/** score = power, +8 for a set piece, +10 for a special perk, +5 for scenario-exclusive rarity */
export function gearScore(item: GearItem): number { return item.power + (item.setId ? 8 : 0) + (item.perk ? 10 : 0) + (item.rarity ? 5 : 0); }
export function gradeOf(score: number): Grade { return GRADE_FLOOR.find(([, floor]) => score >= floor)![0]; }

export type Verdict = "EQUIPPED" | "EMPTY SLOT" | "UPGRADE" | "SIDEGRADE" | "DOWNGRADE";
export type Evaluation = { grade: Grade; score: number; kind: "weapon" | "armor"; verdict: Verdict; powerDelta: number; attributeDelta: Attributes | null; notes: string[] };
const ZERO: Attributes = { intellect: 0, mobility: 0, defense: 0 };
const round = (n: number) => Math.round(n * 10) / 10;
export const VERDICT_MARGIN = 5;

export function evaluateGear(progress: Pick<PlayerProgression, "inventory" | "equippedGear">, item: GearItem): Evaluation {
  const score = gearScore(item), kind = isWeapon(item) ? "weapon" : "armor";
  const wornId = progress.equippedGear[item.slot];
  const worn = wornId ? progress.inventory.find((g) => g.id === wornId) : undefined;
  const notes: string[] = [];
  if (item.setId) notes.push("Set piece: counts toward 2pc/4pc bonuses");
  if (item.perk) notes.push("Special perk");
  if (item.level > 1) notes.push(`Upgraded to level ${item.level}`);
  if (worn?.id === item.id) return { grade: gradeOf(score), score, kind, verdict: "EQUIPPED", powerDelta: 0, attributeDelta: null, notes };
  if (!worn) return { grade: gradeOf(score), score, kind, verdict: "EMPTY SLOT", powerDelta: item.power, attributeDelta: null, notes };
  const powerDelta = item.power - worn.power;
  let attributeDelta: Attributes | null = null; let value = powerDelta;
  if (kind === "armor") {
    const before = loadoutAttributes(progress).effective;
    const after = loadoutAttributes({ inventory: progress.inventory, equippedGear: { ...progress.equippedGear, [item.slot]: item.id } }).effective;
    attributeDelta = { intellect: round(after.intellect - before.intellect), mobility: round(after.mobility - before.mobility), defense: round(after.defense - before.defense) };
    value += attributeDelta.intellect + attributeDelta.mobility + attributeDelta.defense;
    if (item.element !== worn.element) notes.push(`Element ${worn.element} -> ${item.element}`);
  } else {
    attributeDelta = ZERO;
    if (item.element !== worn.element) notes.push(`Element ${worn.element} -> ${item.element}`);
  }
  const verdict: Verdict = value >= VERDICT_MARGIN ? "UPGRADE" : value <= -VERDICT_MARGIN ? "DOWNGRADE" : "SIDEGRADE";
  return { grade: gradeOf(score), score, kind, verdict, powerDelta, attributeDelta, notes };
}
