/**
 * Restyling after creation (owner, Nov 2026): hair, hair colour and markings can be changed from the character menu's
 * Appearance tab for a Nex fee, like a barber's chair. The look is saved on the confirmed character (the same record the
 * Identity Forge writes: operator-styling.ts ids), so it survives reloads and cloud merges. Pure, like repairVehicle.
 */
import { nexBalance, spendNex, type NexLedger } from "./nex.ts";
import type { PlayerCharacter } from "./deployment/deployCharacter.ts";
import { accessoryOr, beardOr, hairColorOr, hairOr, headgearOr, markingsOr } from "./operator-styling.ts";
import { morphsEqual, morphsOr, type FaceMorphs } from "./face-morphs.ts";

export type RestylePatch = { hair?: string; hairColor?: string; marks?: readonly string[]; faceMorphs?: FaceMorphs; beard?: string; accessory?: string; headgear?: string };
export type RestyleStore = { character: PlayerCharacter | null; nexLedger: NexLedger };

/** a new cut or colour, a session in the ink chair, or the sculptor's table; any together pays each */
export const RESTYLE_PRICE = { hair: 250, marks: 400, face: 600 } as const;

/** what a restyle from the current look to `patch` would change, and cost */
export function restyleQuote(c: Pick<PlayerCharacter, "hair" | "hairColor" | "marks" | "bodyType" | "faceMorphs" | "beard" | "accessory" | "headgear">, patch: RestylePatch): { hairChanged: boolean; marksChanged: boolean; faceChanged: boolean; wearChanged: boolean; price: number; next: Pick<PlayerCharacter, "hair" | "hairColor" | "marks" | "faceMorphs" | "beard" | "accessory" | "headgear"> } {
  const next = {
    hair: hairOr(patch.hair ?? c.hair), hairColor: hairColorOr(patch.hairColor ?? c.hairColor),
    marks: markingsOr(patch.marks ?? c.marks), faceMorphs: morphsOr(patch.faceMorphs ?? c.faceMorphs),
    beard: beardOr(patch.beard ?? c.beard), accessory: accessoryOr(patch.accessory ?? c.accessory), headgear: headgearOr(patch.headgear ?? c.headgear),
  };
  // facial hair is the barber's work too; accessories and headgear are just put on, free
  const hairChanged = next.hair !== hairOr(c.hair) || next.hairColor !== hairColorOr(c.hairColor) || next.beard !== beardOr(c.beard);
  const wearChanged = next.accessory !== accessoryOr(c.accessory) || next.headgear !== headgearOr(c.headgear);
  const marksChanged = next.marks.join() !== markingsOr(c.marks).join();
  const faceChanged = !morphsEqual(next.faceMorphs, morphsOr(c.faceMorphs));
  return { hairChanged, marksChanged, faceChanged, wearChanged, price: (hairChanged ? RESTYLE_PRICE.hair : 0) + (marksChanged ? RESTYLE_PRICE.marks : 0) + (faceChanged ? RESTYLE_PRICE.face : 0), next };
}

/** Applies a restyle: validates the ids, charges the Nex once (ledger key `restyle:<now>`, so it can't be replayed), and
 * writes the look on the character. Robots have plating, not hair, so they can't be restyled. */
export function restyleCharacter<P extends RestyleStore>(p: P, patch: RestylePatch, now: number): { progression: P; message: string } | { error: string } {
  const c = p.character;
  if (!c) return { error: "Confirm your operator in the Identity Forge first" };
  if (c.bodyType === "robot") return { error: "Robot frames carry plating, not hair" };
  const q = restyleQuote(c, patch);
  if (q.price <= 0 && !q.wearChanged) return { error: "Nothing to change" };
  if (q.price <= 0) return { progression: { ...p, character: { ...c, ...q.next } }, message: "Changed what you're wearing" };
  const ledger = spendNex(p.nexLedger, `restyle:${now}`, q.price);
  if (!ledger) return { error: `Needs ${q.price} Nex (you have ${nexBalance(p.nexLedger)})` };
  const what = [q.hairChanged ? "new style" : "", q.marksChanged ? "new markings" : "", q.faceChanged ? "new face" : ""].filter(Boolean).join(" and ");
  return { progression: { ...p, nexLedger: ledger, character: { ...c, ...q.next } }, message: `Restyled: ${what} · -${q.price} Nex` };
}
