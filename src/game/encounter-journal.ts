/** Encounter journal (design doc: hidden encounter discovery, System Mastery, three-operator progression).
 *  - Clues and discovery are ACCOUNT-wide: once any Operator has found a hidden site, the others need not search again.
 *  - Completion, mastery records and personal rewards are PER OPERATOR; nothing here copies one Operator's reward to another.
 *  - NOVA hints unlock only after enough clues, so a stuck player is helped but the search is not skipped.
 * Everything is stored as earnedRewards keys (the cloud merge unions them), so the save schema does not change. */
import type { ClassId, PlayerProgression } from "./progression";
import { UNIQUE_SCENARIOS } from "./unique-scenarios";

type Store = Pick<PlayerProgression, "earnedRewards">;
export type Clue = { id: string; text: string; /** how it is found: several routes per encounter so one obscure action is never required */ route: "site" | "world" | "npc" | "combat" };

const SITE: Clue = { id: "site", route: "site", text: "You stood at the place the rumours describe." };
const AUTHORED: Record<string, readonly Clue[]> = {
  "hollow-colossus": [
    { id: "tremors", route: "world", text: "The ground in the Wastelands ruins trembles in a slow, regular rhythm." },
    { id: "machinery", route: "world", text: "Dormant machinery under the ruins is wired to something very large." },
  ],
  "exiled-architect": [
    { id: "blueprint", route: "world", text: "A blueprint fragment shows an engineer rewriting a wall as if it were a drawing." },
    { id: "charge", route: "combat", text: "An unstable charge carried across a gap by one ability and held by another does something no tutorial explains." },
  ],
  "verdant-sovereign": [
    { id: "ecosystem", route: "world", text: "The forest changes its animals and paths depending on what you do in it." },
    { id: "keeper", route: "npc", text: "A wary forager talks about a heart of the forest that listens." },
  ],
  "black-market-phantom": [
    { id: "rumour", route: "npc", text: "Racers whisper about a masked rival who takes impossible routes and vanishes before the finish." },
    { id: "shortcut", route: "world", text: "A hidden shortcut in Neon City's underground network does not appear on any map." },
  ],
  vyrak: [
    { id: "inscription", route: "world", text: "An inscription in Solara describes a sky sovereign that tests courage, not strength." },
    { id: "ember", route: "npc", text: "A ranger remembers a dragon that remembers the world before the Fracture." },
  ],
};
export const cluesFor = (encounterId: string): readonly Clue[] => [SITE, ...(AUTHORED[encounterId] ?? [])];
/** clues needed before the encounter counts as discovered */
export const discoveryThreshold = (encounterId: string) => Math.min(cluesFor(encounterId).length, 2);

const clueKey = (e: string, c: string) => `enc-clue:${e}:${c}`;
const foundKey = (e: string) => `enc-found:${e}`;
const doneKey = (cls: ClassId, e: string) => `enc-done:${cls}:${e}`;
const masteryKey = (cls: ClassId, e: string, m: string) => `enc-mastery:${cls}:${e}:${m}`;

const has = (p: Store, k: string) => p.earnedRewards.includes(k);
const add = <T extends Store>(p: T, k: string): T => (has(p, k) ? p : { ...p, earnedRewards: [...p.earnedRewards, k] });

export const knownClues = (p: Store, encounterId: string): Clue[] => cluesFor(encounterId).filter((c) => has(p, clueKey(encounterId, c.id)));
export const isDiscovered = (p: Store, encounterId: string) => has(p, foundKey(encounterId));
export const isCompleted = (p: Store, cls: ClassId | null, encounterId: string) => !!cls && has(p, doneKey(cls, encounterId));

/** Records a clue (idempotent). Unknown encounters / clues are ignored. Reaching the threshold marks the encounter discovered for the account. */
export function recordClue<T extends Store>(p: T, encounterId: string, clueId: string): { progression: T; newClue: boolean; discovered: boolean } {
  if (!UNIQUE_SCENARIOS.some((s) => s.id === encounterId) || !cluesFor(encounterId).some((c) => c.id === clueId)) return { progression: p, newClue: false, discovered: false };
  if (has(p, clueKey(encounterId, clueId))) return { progression: p, newClue: false, discovered: false };
  let next = add(p, clueKey(encounterId, clueId));
  const wasFound = isDiscovered(next, encounterId);
  if (!wasFound && knownClues(next, encounterId).length >= discoveryThreshold(encounterId)) next = add(next, foundKey(encounterId));
  return { progression: next, newClue: true, discovered: !wasFound && isDiscovered(next, encounterId) };
}

/** NOVA's optional hint: none with no clues, vague with one, pointed once enough clues exist to be stuck on. Never reveals the trigger itself. */
export function novaHint(p: Store, encounterId: string): string | null {
  const n = knownClues(p, encounterId).length;
  if (n === 0 || isDiscovered(p, encounterId)) return null;
  const scenario = UNIQUE_SCENARIOS.find((s) => s.id === encounterId);
  if (!scenario) return null;
  return n === 1 ? "NOVA: One lead is not a pattern. Look for a second clue in a different place." : `NOVA: Your clues point toward ${scenario.regionId === "thalassia" ? "the sunken ark near Thalassia" : `the ${scenario.regionId} region`}. Compare them and look for the odd detail.`;
}

/** Completion is personal. Discovery is implied (you cannot clear a site you have not stood in). */
export function recordEncounterClear<T extends Store>(p: T, cls: ClassId | null, encounterId: string): T {
  if (!cls || !UNIQUE_SCENARIOS.some((s) => s.id === encounterId)) return p;
  return add(add(p, foundKey(encounterId)), doneKey(cls, encounterId));
}

/** Mastery records reward demonstrated understanding (a counter worked), once per Operator per record. */
export function recordMastery<T extends Store>(p: T, cls: ClassId | null, encounterId: string, mastery: string): T {
  if (!cls || !isCompleted(p, cls, encounterId)) return p;
  return add(p, masteryKey(cls, encounterId, mastery));
}
export const masteryCount = (p: Store, cls: ClassId | null, encounterId: string) => (cls ? p.earnedRewards.filter((r) => r.startsWith(`enc-mastery:${cls}:${encounterId}:`)).length : 0);

export type JournalEntry = { id: string; /** unique story encounters (Vyrak) get their own journal section */ special: boolean; name: string; discovered: boolean; completed: boolean; clues: { text: string; known: boolean }[]; hint: string | null; mastery: number };
/** The journal view: undiscovered encounters show only the clues already found, with the rest masked. */
export function journalFor(p: Store, cls: ClassId | null): JournalEntry[] {
  return UNIQUE_SCENARIOS.filter((s) => isDiscovered(p, s.id) || knownClues(p, s.id).length > 0 || isCompleted(p, cls, s.id)).map((s) => {
    const known = new Set(knownClues(p, s.id).map((c) => c.id));
    const discovered = isDiscovered(p, s.id);
    return { id: s.id, special: s.id === "vyrak", name: discovered ? s.name : "Unknown encounter", discovered, completed: isCompleted(p, cls, s.id), clues: cluesFor(s.id).map((c) => ({ text: known.has(c.id) ? c.text : "???", known: known.has(c.id) })), hint: novaHint(p, s.id), mastery: masteryCount(p, cls, s.id) };
  });
}
