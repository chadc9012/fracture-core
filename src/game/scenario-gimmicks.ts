/** Pure damage rules for Unique Scenario gimmicks (see unique-scenarios.ts). Each one asks the player for something
 * other than raw DPS; sim.ts applies the returned multiplier on top of the poise window. Inspired by the "can't be
 * brute-forced" boss fights of Shangri-La Frontier, with original rules:
 *  - poise:    only the poise/stagger window hurts (Unbroken Glass, System Core, Rime Alpha)
 *  - adaptive: the boss learns — repeating one element wears its counter in; mixing elements opens a stagger gap (Dark Knight)
 *  - attune:   the boss cycles an attuned element; only that element lands cleanly (Hollow Saint)
 *  - closing:  the boss sidesteps distant fire; only a close-quarters duel connects (Red Ronin) */
export type Gimmick = "poise" | "adaptive" | "attune" | "closing";
export type DamageElement = "KINETIC" | "THERMAL" | "CRYO" | "ARC" | "BIO";

export const ATTUNE_ORDER: readonly DamageElement[] = ["KINETIC", "THERMAL", "CRYO", "ARC"];
export const ATTUNE_SECONDS = 9;
export const HISTORY_LENGTH = 6;
export const CLOSE_RANGE = 14;
export const FAR_RANGE = 34;

export const attunedElement = (nowSec: number): DamageElement => ATTUNE_ORDER[Math.floor(Math.max(0, nowSec) / ATTUNE_SECONDS) % ATTUNE_ORDER.length]!;

export type GimmickInput = { element: DamageElement; nowSec: number; distance: number; history: readonly DamageElement[] };
export type GimmickResult = { mult: number; history: DamageElement[] };

/** Length of the run of identical elements at the end of the history, including the current hit. */
export function streakOf(history: readonly DamageElement[], element: DamageElement): number {
  let n = 1;
  for (let i = history.length - 1; i >= 0 && history[i] === element; i--) n++;
  return n;
}

export function gimmickMultiplier(gimmick: Gimmick | undefined, input: GimmickInput): GimmickResult {
  const history = [...input.history, input.element].slice(-HISTORY_LENGTH);
  switch (gimmick) {
    case "adaptive": {
      const streak = streakOf(input.history, input.element);
      const counter = streak <= 3 ? 1 : Math.max(0.3, 1 - (streak - 3) * 0.2);
      const mixed = new Set(history).size >= 3 && history.length >= 4 ? 1.3 : 1;
      return { mult: counter * mixed, history };
    }
    case "attune":
      return { mult: input.element === attunedElement(input.nowSec) ? 1.25 : 0.3, history };
    case "closing": {
      const t = Math.min(1, Math.max(0, (input.distance - CLOSE_RANGE) / (FAR_RANGE - CLOSE_RANGE)));
      return { mult: 1.2 - t * 1.08, history };
    }
    default:
      return { mult: 1, history };
  }
}
