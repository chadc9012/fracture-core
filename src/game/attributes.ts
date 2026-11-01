/** Physical attributes (owner's Unity starter pack, Nov 1: PlayerAttributes): Strength, Agility, Stamina and Discipline, each
 * levelling with experience (the next level needs 50 × level² xp, level 100 cap). Training at home and in the residences earns
 * them: workouts and the gym (strength), sports on the court (agility), swimming (stamina), a shift at the co-working desks or
 * a finished routine (discipline). Stored as total xp in `progression.records` ("attr:<id>"; cloud merge keeps the higher).
 * Agility widens the timing window on the court (sports.ts); the others are shown on your record. Pure. */
import type { PlayerProgression } from "./progression";

export type AttributeId = "strength" | "agility" | "stamina" | "discipline";
export const ATTRIBUTES: readonly { id: AttributeId; label: string; blurb: string }[] = [
  { id: "strength", label: "Strength", blurb: "Workouts and the gym" },
  { id: "agility", label: "Agility", blurb: "Sports on the court" },
  { id: "stamina", label: "Stamina", blurb: "Laps in the pool" },
  { id: "discipline", label: "Discipline", blurb: "Shifts, routines, daily training" },
];
export const ATTR_CAP = 100;
export const attrKey = (id: AttributeId) => `attr:${id}`;
/** xp needed to go from `level` to the next */
export const xpForNext = (level: number) => 50 * level * level;
/** level and progress toward the next from a total xp */
export function attrLevel(totalXp: number): { level: number; into: number; need: number } {
  let level = 1, left = Math.max(0, totalXp);
  while (level < ATTR_CAP && left >= xpForNext(level)) { left -= xpForNext(level); level++; }
  return { level, into: left, need: level >= ATTR_CAP ? 0 : xpForNext(level) };
}
export const attrXp = (p: Pick<PlayerProgression, "records">, id: AttributeId) => p.records[attrKey(id)] ?? 0;
export const attributeLevel = (p: Pick<PlayerProgression, "records">, id: AttributeId) => attrLevel(attrXp(p, id)).level;
/** award xp; returns the new progression and the new level if it went up */
export function awardAttribute<P extends Pick<PlayerProgression, "records">>(p: P, id: AttributeId, xp: number): { progression: P; levelUp: number | null } {
  const before = attrLevel(attrXp(p, id)).level, total = attrXp(p, id) + Math.max(0, Math.round(xp));
  const after = attrLevel(total).level;
  return { progression: { ...p, records: { ...p.records, [attrKey(id)]: total } }, levelUp: after > before ? after : null };
}
/** what each training spot trains, and how much (a small amount: daily-capped spots pay more) */
export const TRAINING: Partial<Record<string, { attr: AttributeId; xp: number }[]>> = {
  workout: [{ attr: "strength", xp: 60 }, { attr: "discipline", xp: 30 }],
  gym: [{ attr: "strength", xp: 40 }, { attr: "stamina", xp: 15 }],
  pool: [{ attr: "stamina", xp: 45 }],
  shift: [{ attr: "discipline", xp: 40 }],
  dog: [{ attr: "agility", xp: 10 }],
};
/** the gym, the pool and a shift pay attribute xp once per spot per UTC day (the home workout keeps its own daily rule) */
export const trainingKey = (spot: string, now: number) => `train:${spot}:${Math.floor(now / 86_400_000)}`;
export function train<P extends Pick<PlayerProgression, "records" | "earnedRewards">>(p: P, spot: string, now = Date.now()): { progression: P; message: string } | { error: string } {
  const plan = TRAINING[spot];
  if (!plan) return { error: "Nothing to train here" };
  const key = trainingKey(spot, now);
  if (p.earnedRewards.includes(key)) return { error: "You've trained here today. Come back tomorrow." };
  let next: P = { ...p, earnedRewards: [...p.earnedRewards, key] };
  const parts: string[] = [];
  for (const t of plan) { const r = awardAttribute(next, t.attr, t.xp); next = r.progression; parts.push(`+${t.xp} ${ATTRIBUTES.find((a) => a.id === t.attr)!.label}${r.levelUp ? ` (Lv ${r.levelUp}!)` : ""}`); }
  return { progression: next, message: parts.join(" · ") };
}
