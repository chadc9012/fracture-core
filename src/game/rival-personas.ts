/** Named rival identities for races (racing.ts). Six personas get assigned to a race's rival slots by a stable hash
 * of raceId+difficulty+slot, so "the 2nd-fastest field slot in this circuit on Advanced" is always the same driver
 * across every run and every session — real rival persistence without a backend or any new save shape.
 *
 * A persona only reshapes a rival's on-track POSITION CURVE mid-race (early surge vs. late charge) through a pure,
 * endpoint-preserving function (shape(0)=0, shape(1)=1, monotonic on [0,1]). It never touches rivalTimes' finish
 * time, so medals, placement, `progress` (used by livePlace) and the economy are scored exactly as before — this is
 * cosmetic pacing feel layered on top of the real, already-tested result. */

export type RivalPersonaId = "rabbit" | "closer" | "metronome" | "hothead" | "grinder" | "wildcard";
export type RivalPersona = { id: RivalPersonaId; name: string; tagline: string; shape: (u: number) => number };

/** Fast off the line, eases off through the middle; always lands exactly on 1 at u=1. */
const easeOut = (p: number) => (u: number) => 1 - (1 - u) ** p;
/** Holds back early, surges through the back half. */
const easeIn = (p: number) => (u: number) => u ** p;
/** A bounded wobble around the straight-line pace; zero at both ends so the finish time never moves. */
const wobble = (amp: number, cycles: number) => (u: number) => u + amp * Math.sin(u * Math.PI * cycles) * u * (1 - u);
/** Every shape only has to behave in [0,1]; outside it (a rival already finished, or hasn't started) the straight
 * ratio is enough since the caller clamps the final result to [0,1] anyway. */
const clamped = (f: (u: number) => number): ((u: number) => number) => (u) => (u <= 0 || u >= 1 ? u : f(u));

export const RIVAL_PERSONAS: readonly RivalPersona[] = [
  { id: "rabbit", name: "Rabbit", tagline: "Blisters off the line, fades on the back half.", shape: clamped(easeOut(0.55)) },
  { id: "closer", name: "Closer", tagline: "Hangs back, saves everything for the final stretch.", shape: clamped(easeIn(0.6)) },
  { id: "metronome", name: "Metronome", tagline: "Same pace every lap, never panics.", shape: clamped((u) => u) },
  { id: "hothead", name: "Hothead", tagline: "Pushes too hard mid-race and pays for it.", shape: clamped(wobble(0.07, 1)) },
  { id: "grinder", name: "Grinder", tagline: "Unspectacular and steady; rarely last, rarely first.", shape: clamped(easeOut(0.85)) },
  { id: "wildcard", name: "Wildcard", tagline: "No two runs look the same.", shape: clamped(wobble(0.14, 2)) },
];

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Stable persona for one race's rival slot on one difficulty: the same driver every time this exact field is run. */
export function personaForSlot(raceId: string, difficulty: string, slot: number): RivalPersona {
  const i = hash(`${raceId}:${difficulty}:${slot}:persona`) % RIVAL_PERSONAS.length;
  return RIVAL_PERSONAS[i]!;
}
