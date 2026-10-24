/** The nightclub dance floor (pure): a short rhythm set at Pulse Array and Afterglow. Arrows scroll toward the line on the
 * club's beat; hit them on time with the arrow keys or the d-pad. Tonight's set is the same for everyone (seeded by venue
 * and day), so a best score means something. Your best per venue is kept in the save as `venue-best:<id>:<score>`
 * (earnedRewards, union-merged; the highest wins). Social only: no currency, XP or loot. */
export type Arrow = "left" | "up" | "down" | "right";
export const ARROWS: readonly Arrow[] = ["left", "up", "down", "right"];
export const DANCE_VENUES: Readonly<Record<string, { bpm: number; beats: number }>> = { "pulse-array": { bpm: 124, beats: 24 }, afterglow: { bpm: 108, beats: 20 } };
export const LEAD_IN = 2; // seconds before the first beat
export const WINDOW = { perfect: 0.08, good: 0.16, miss: 0.25 } as const;
export const POINTS = { perfect: 300, good: 100, miss: 0 } as const;
export type Judgement = keyof typeof POINTS;
export type Beat = { t: number; arrow: Arrow; hit: Judgement | null };

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** tonight's set: beats on the club's tempo, with the odd off-beat once you're into it */
export function danceSet(venueId: string, day: string): Beat[] {
  const v = DANCE_VENUES[venueId] ?? { bpm: 116, beats: 20 };
  const r = rng(hash(`${venueId}@${day}`)), step = 60 / v.bpm;
  const out: Beat[] = [];
  let t = LEAD_IN, last: Arrow | null = null;
  for (let i = 0; i < v.beats; i++) {
    let a = ARROWS[Math.floor(r() * 4)]!;
    if (a === last && r() < 0.6) a = ARROWS[(ARROWS.indexOf(a) + 1 + Math.floor(r() * 3)) % 4]!;
    out.push({ t, arrow: a, hit: null }); last = a;
    t += i > 6 && r() < 0.25 ? step / 2 : step;
  }
  return out;
}

/** a press at `now` (seconds since the set started): judges the earliest unjudged beat of that arrow inside the window */
export function press(beats: Beat[], arrow: Arrow, now: number): Judgement | null {
  const b = beats.find((x) => x.hit === null && x.arrow === arrow && Math.abs(x.t - now) <= WINDOW.miss);
  if (!b) return null;
  const d = Math.abs(b.t - now);
  b.hit = d <= WINDOW.perfect ? "perfect" : d <= WINDOW.good ? "good" : "miss";
  return b.hit;
}
/** beats that slid past the line unplayed count as misses */
export function expire(beats: Beat[], now: number): number {
  let n = 0;
  for (const b of beats) if (b.hit === null && now - b.t > WINDOW.miss) { b.hit = "miss"; n++; }
  return n;
}
export const finished = (beats: Beat[]) => beats.every((b) => b.hit !== null);

export type DanceResult = { score: number; perfect: number; good: number; miss: number; bestCombo: number; grade: "S" | "A" | "B" | "C" | "D" };
export function result(beats: readonly Beat[]): DanceResult {
  let combo = 0, bestCombo = 0;
  for (const b of beats) { if (b.hit === "perfect" || b.hit === "good") { combo++; bestCombo = Math.max(bestCombo, combo); } else combo = 0; }
  const perfect = beats.filter((b) => b.hit === "perfect").length, good = beats.filter((b) => b.hit === "good").length, miss = beats.length - perfect - good;
  const score = perfect * POINTS.perfect + good * POINTS.good + bestCombo * 20;
  const pct = (perfect + good * 0.5) / Math.max(1, beats.length);
  const grade = pct >= 0.95 ? "S" : pct >= 0.8 ? "A" : pct >= 0.6 ? "B" : pct >= 0.4 ? "C" : "D";
  return { score, perfect, good, miss, bestCombo, grade };
}

export const bestKey = (venueId: string, score: number) => `venue-best:${venueId}:${Math.round(score)}`;
export function danceBest(p: { earnedRewards: readonly string[] }, venueId: string): number {
  let best = 0;
  for (const k of p.earnedRewards) if (k.startsWith(`venue-best:${venueId}:`)) best = Math.max(best, Number(k.slice(`venue-best:${venueId}:`.length)) || 0);
  return best;
}
/** keeps one key per venue (the best); returns the same object when the score is not a new best */
export function recordDance<P extends { earnedRewards: string[] }>(p: P, venueId: string, score: number): P {
  if (score <= danceBest(p, venueId)) return p;
  return { ...p, earnedRewards: [...p.earnedRewards.filter((k) => !k.startsWith(`venue-best:${venueId}:`)), bestKey(venueId, score)] };
}
export const keyArrow = (code: string): Arrow | null => ({ ArrowLeft: "left", ArrowUp: "up", ArrowDown: "down", ArrowRight: "right", KeyA: "left", KeyW: "up", KeyS: "down", KeyD: "right" } as Record<string, Arrow>)[code] ?? null;
/** standard-mapping d-pad buttons 14 left, 12 up, 13 down, 15 right */
export const PAD_ARROW: Readonly<Record<number, Arrow>> = { 14: "left", 12: "up", 13: "down", 15: "right" };
