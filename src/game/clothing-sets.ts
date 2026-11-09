/**
 * Clothing and lifestyle wear (owner's boards, Nov 1: Streetwear, Cyberpunk, Formal, Athletic, Beachwear, Tactical, Explorer,
 * Racer, Gym, Casual, plus the seasonal outfits). An outfit is a full look for the operator: the plate, undersuit, glow and
 * trim colours the body takes (character.appearance, the same channels the Appearance tab edits) with a name and a style.
 * Owned outfits are `outfit:<id>` in earnedRewards; wearing one writes its colours onto the confirmed character and remembers
 * the id on progression.outfit, so armour stats never change (that is the transmog idea: the look is clothing, the numbers
 * are the gear). Until the Godot build has modelled clothing, this is what an outfit changes on the body. Pure rules.
 */
import { nexBalance, spendNex, type NexLedger } from "./nex.ts";
import type { PlayerCharacter } from "./deployment/deployCharacter.ts";

export type Outfit = { id: string; name: string; blurb: string; style: string; price: number | null; source: string; armor: string; cloth: string; visor: string; trim: string; event?: string };
const o = (id: string, name: string, blurb: string, style: string, price: number | null, source: string, armor: string, cloth: string, visor: string, trim: string, event?: string): Outfit => ({ id, name, blurb, style, price, source, armor, cloth, visor, trim, ...(event ? { event } : {}) });

export const OUTFITS: readonly Outfit[] = [
  o("streetwear", "Streetwear", "Bomber, joggers and high-tops.", "Streetwear", 1200, "Scrapyard Bazaar", "#2a2e36", "#c8d0dc", "#ff2fd0", "#e0502a"),
  o("cyberpunk", "Cyberpunk", "Neon piping on black synth-leather.", "Cyberpunk", 1800, "Neon City: Pulse Array", "#15171c", "#3a1a5a", "#41e6ff", "#ff2fd0"),
  o("formal", "Formal", "A sharp dark suit.", "Formal", 2200, "Spire District tailor", "#1a1d24", "#f2f2f2", "#92e9f5", "#8a7a5a"),
  o("athletic", "Athletic", "Team jersey and shorts.", "Athletic", 900, "Scrapyard Bazaar", "#e0502a", "#f2f2f2", "#ffd25a", "#1a1d24"),
  o("beachwear", "Beachwear", "Sun-faded shorts and a sarong.", "Beachwear", 700, "Southern Docks", "#f5d8a0", "#2aa8c8", "#ffd25a", "#ff5a8a"),
  o("tactical", "Tactical", "Plate carrier over fatigues.", "Tactical", 1500, "Apex Gear", "#3c4650", "#6d7b5a", "#ffb000", "#20262e"),
  o("explorer", "Explorer", "Field jacket, cargo trousers, boots.", "Explorer", 1300, "Vanguard Outpost Alpha", "#6b5a3a", "#a07a4a", "#ffd25a", "#3a3024"),
  o("racer", "Racer", "A sponsor-patched racing jacket.", "Racer", 1600, "Cylinder & Co Heavy Motorworks", "#c82a2a", "#f2f2f2", "#41e6ff", "#1a1d24"),
  o("gym", "Gym", "Tank top and training shorts.", "Gym", 600, "Scrapyard Bazaar", "#f2f2f2", "#2a2e36", "#59ff7a", "#4a5058"),
  o("casual", "Casual", "A tee and worn denim.", "Casual", 500, "Scrapyard Bazaar", "#8aa0b8", "#2a3a5c", "#92e9f5", "#6a6e74"),
  // seasonal (seasonal.ts): sold only while the event runs
  o("halloween-witch", "Haunted Coven", "Black and violet, cobweb lace.", "Halloween", 2500, "Halloween Collection", "#15161c", "#3b1a66", "#7a3aff", "#c85a14", "halloween"),
  o("winter-festive", "Festive Red", "Red and white, fur trim.", "Winter", 2500, "Winter Collection", "#8a1f1f", "#f2f2f2", "#9fd8ff", "#c9a24a", "winter"),
  o("spring-pastel", "Spring Pastel", "Soft pink and mint.", "Spring", 2000, "Spring Collection", "#f5b8d0", "#b8e8a0", "#ff8ac0", "#f2f2f2", "spring"),
  o("summer-tropical", "Tropical", "Bright flowers on white.", "Summer", 2000, "Summer Festival", "#ff5a8a", "#f2f2f2", "#ffd25a", "#2aa8c8", "summer"),
  o("anniversary-gold", "Anniversary Gold", "Gold on black, the first-year look.", "Anniversary", null, "Anniversary: log in during the event", "#ffe08a", "#15161c", "#ffd25a", "#c9a24a", "anniversary"),
];

export const outfitById = (id: string): Outfit | undefined => OUTFITS.find((x) => x.id === id);
export const ownsOutfit = (p: { earnedRewards: readonly string[] }, id: string): boolean => p.earnedRewards.includes(`outfit:${id}`);

export type OutfitStore = { earnedRewards: string[]; nexLedger: NexLedger; character: PlayerCharacter | null; outfit: string | null };

export function grantOutfit<P extends { earnedRewards: string[] }>(p: P, id: string): P {
  if (!outfitById(id) || p.earnedRewards.includes(`outfit:${id}`)) return p;
  return { ...p, earnedRewards: [...p.earnedRewards, `outfit:${id}`] };
}
/** puts an owned outfit on: its colours go on the confirmed character, the id is remembered */
export function wearOutfit<P extends OutfitStore>(p: P, id: string): P {
  const x = outfitById(id);
  if (!x || !ownsOutfit(p, id) || !p.character) return p;
  return { ...p, outfit: id, character: { ...p.character, appearance: { ...p.character.appearance, armor: x.armor, cloth: x.cloth, visor: x.visor, trim: x.trim } } };
}
/** buys (ledger key `outfit:<id>`) and wears; event outfits only while the event runs */
export function buyOutfit<P extends OutfitStore>(p: P, id: string, activeEvents: readonly string[] = []): { progression: P; message: string } | { error: string } {
  const x = outfitById(id);
  if (!x) return { error: "No such outfit" };
  if (!p.character) return { error: "Confirm your operator in the Identity Forge first" };
  if (ownsOutfit(p, id)) return { progression: wearOutfit(p, id), message: `Wearing ${x.name}` };
  if (x.price === null) return { error: `${x.name} isn't for sale: ${x.source}` };
  if (x.event && !activeEvents.includes(x.event)) return { error: `${x.name} is only sold during its event (${x.source})` };
  const ledger = spendNex(p.nexLedger, `outfit:${id}`, x.price);
  if (!ledger) return { error: `Needs ${x.price} Nex (you have ${nexBalance(p.nexLedger)})` };
  return { progression: wearOutfit(grantOutfit({ ...p, nexLedger: ledger }, id), id), message: `Bought ${x.name} · -${x.price} Nex` };
}
