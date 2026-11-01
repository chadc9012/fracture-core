/** Court games on the residences' multi-sport court (owner's Unity sports batches 2-4, Nov 1: SportsCourt, TennisMatchRules,
 * VolleyballMatchRules, CourtRallyController): free throws, a tennis match and a beach-volleyball match, as timing games.
 *  - Hoops: ten free throws on a swinging power meter; release in the green.
 *  - Rallies (tennis, volleyball): the ball comes back to you; hit it as it arrives (the window widens with Agility); a clean
 *    hit makes it harder for the rival to return; miss the window and the point is theirs. Rallies speed up as they go.
 *  - Scoring follows the sports: tennis games of 15-30-40 with deuce and advantage (first to 2 games), beach volleyball rally
 *    scoring to 15, win by 2.
 * Pure and seeded (a day's seed), so a run replays the same and tests are deterministic. Records in `progression.records`. */
import type { PlayerProgression } from "./progression";

export type SportId = "hoops" | "tennis" | "volleyball";
export const SPORTS: readonly { id: SportId; name: string; blurb: string }[] = [
  { id: "hoops", name: "Free Throws", blurb: "Ten shots. Release when the meter is in the green." },
  { id: "tennis", name: "Tennis", blurb: "First to two games. 15, 30, 40, deuce, advantage." },
  { id: "volleyball", name: "Beach Volleyball", blurb: "Rally scoring to 15, win by two." },
];
export const recordKey = (id: SportId) => `sport:${id}`;
export const sportBest = (p: Pick<PlayerProgression, "records">, id: SportId) => p.records[recordKey(id)] ?? 0;

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/* ---------------- tennis and volleyball scoring ---------------- */

export type TennisScore = { p: number; o: number; gamesP: number; gamesO: number };
export const TENNIS_GAMES = 2;
export function tennisPoint(s: TennisScore, playerWon: boolean): TennisScore {
  let { p, o, gamesP, gamesO } = s;
  if (playerWon) p++; else o++;
  // a game: at least 4 points and 2 clear
  if (p >= 4 && p - o >= 2) { gamesP++; p = 0; o = 0; }
  else if (o >= 4 && o - p >= 2) { gamesO++; p = 0; o = 0; }
  return { p, o, gamesP, gamesO };
}
export const tennisOver = (s: TennisScore) => s.gamesP >= TENNIS_GAMES || s.gamesO >= TENNIS_GAMES;
const CALL = ["Love", "15", "30", "40"];
export function tennisCall(s: TennisScore): string {
  if (s.p >= 3 && s.o >= 3) return s.p === s.o ? "Deuce" : s.p > s.o ? "Advantage you" : "Advantage rival";
  return `${CALL[Math.min(3, s.p)]} – ${CALL[Math.min(3, s.o)]}`;
}
export type VolleyScore = { p: number; o: number };
export const VOLLEY_TO = 15;
export const volleyPoint = (s: VolleyScore, playerWon: boolean): VolleyScore => (playerWon ? { ...s, p: s.p + 1 } : { ...s, o: s.o + 1 });
export const volleyOver = (s: VolleyScore) => (s.p >= VOLLEY_TO || s.o >= VOLLEY_TO) && Math.abs(s.p - s.o) >= 2;

/* ---------------- the rally ---------------- */

/** ms either side of the ball's arrival that still counts as a hit: wider with Agility (Lv 1: 150 ms .. Lv 50+: 250 ms) */
export const hitWindow = (agility: number) => Math.min(250, 148 + Math.max(0, agility - 1) * 2.1);
export type Rally = {
  sport: "tennis" | "volleyball";
  /** "in": the ball is flying to you; "out": to the rival; "between": a beat after a point */
  phase: "in" | "out" | "between" | "done";
  from: number; dur: number; shots: number;
  /** the last hit's quality 0..1 (1 = dead centre) */
  quality: number;
  tennis: TennisScore; volley: VolleyScore;
  log: string; seed: number; agility: number;
};
const BASE_DUR = 1250, MIN_DUR = 620;
export function startRally(sport: "tennis" | "volleyball", seed: number, agility: number, now: number): Rally {
  return { sport, phase: "in", from: now, dur: BASE_DUR, shots: 0, quality: 0, tennis: { p: 0, o: 0, gamesP: 0, gamesO: 0 }, volley: { p: 0, o: 0 }, log: sport === "tennis" ? "Rival serves" : "Rival serves", seed, agility };
}
const pointTo = (r: Rally, playerWon: boolean, now: number, why: string): Rally => {
  const tennis = r.sport === "tennis" ? tennisPoint(r.tennis, playerWon) : r.tennis;
  const volley = r.sport === "volleyball" ? volleyPoint(r.volley, playerWon) : r.volley;
  const over = r.sport === "tennis" ? tennisOver(tennis) : volleyOver(volley);
  return { ...r, tennis, volley, phase: over ? "done" : "between", from: now, dur: 900, shots: 0, quality: 0, log: `${why} · ${playerWon ? "your point" : "rival's point"}`, seed: (r.seed * 31 + (playerWon ? 7 : 3)) >>> 0 };
};
/** a tap: inside the window returns the ball, outside loses the point */
export function rallyTap(r: Rally, now: number): Rally {
  if (r.phase !== "in") return r;
  const arrive = r.from + r.dur, err = Math.abs(now - arrive), w = hitWindow(r.agility);
  if (err > w) return pointTo(r, false, now, now < arrive ? "Too early" : "Too late");
  const quality = 1 - err / w;
  return { ...r, phase: "out", from: now, dur: Math.max(MIN_DUR, r.dur * 0.94), shots: r.shots + 1, quality, log: quality > 0.75 ? "Clean hit!" : "Returned" };
}
/** advance the clock: the ball reaching the rival (they return it or miss), a missed ball on your side, the beat between points */
export function rallyTick(r: Rally, now: number): Rally {
  if (r.phase === "done") return r;
  if (r.phase === "in" && now > r.from + r.dur + hitWindow(r.agility)) return pointTo(r, false, now, "Missed it");
  if (r.phase === "out" && now >= r.from + r.dur) {
    const roll = rng(r.seed + r.shots * 97)();
    // the rival returns most balls; a clean hit, a long rally and a fast ball all make it harder
    const returns = roll < Math.max(0.25, 0.86 - r.quality * 0.38 - r.shots * 0.025);
    if (!returns) return pointTo(r, true, now, r.quality > 0.75 ? "Winner" : "Rival misses");
    return { ...r, phase: "in", from: now, dur: Math.max(MIN_DUR, r.dur * 0.96), log: "Rival returns" };
  }
  if (r.phase === "between" && now >= r.from + r.dur) return { ...r, phase: "in", from: now, dur: BASE_DUR, log: r.sport === "volleyball" ? "Serve" : "Serve" };
  return r;
}
/** where the ball is, 0 (rival) .. 1 (you), for drawing */
export function ballAt(r: Rally, now: number): number {
  const t = Math.min(1, Math.max(0, (now - r.from) / r.dur));
  return r.phase === "in" ? t : r.phase === "out" ? 1 - t : 0;
}
export const rallyWon = (r: Rally) => (r.sport === "tennis" ? r.tennis.gamesP > r.tennis.gamesO : r.volley.p > r.volley.o);

/* ---------------- free throws ---------------- */

export const SHOTS = 10, METER_PERIOD = 1300;
/** the meter swings 0..1..0; release with it inside the green (wider with Agility) */
export const meterAt = (t: number) => { const k = (((t % METER_PERIOD) + METER_PERIOD) % METER_PERIOD) / METER_PERIOD; return k < 0.5 ? k * 2 : 2 - k * 2; };
export const greenHalf = (agility: number) => Math.min(0.12, 0.055 + Math.max(0, agility - 1) * 0.0013);
export type Hoops = { shot: number; made: number; start: number; last: "swish" | "rim-in" | "miss" | null; seed: number; agility: number };
export const startHoops = (seed: number, agility: number, now: number): Hoops => ({ shot: 0, made: 0, start: now, last: null, seed, agility });
export function shoot(h: Hoops, now: number): Hoops {
  if (h.shot >= SHOTS) return h;
  const off = Math.abs(meterAt(now - h.start) - 0.92), g = greenHalf(h.agility); // the green sits near the top of the swing
  const roll = rng(h.seed + h.shot * 131)();
  const result = off <= g ? "swish" : off <= g * 2 && roll < 0.5 ? "rim-in" : "miss";
  return { ...h, shot: h.shot + 1, made: h.made + (result === "miss" ? 0 : 1), last: result };
}
export const HOOPS_GREEN_CENTRE = 0.92;

/* ---------------- results ---------------- */

/** a finished game: the record (best kept) and the Agility xp it earns */
export function sportResult<P extends Pick<PlayerProgression, "records">>(p: P, sport: SportId, score: number, won: boolean): { progression: P; agilityXp: number; best: boolean } {
  const key = recordKey(sport), best = score > (p.records[key] ?? 0);
  const agilityXp = sport === "hoops" ? score * 4 : won ? 70 : 25;
  return { progression: best ? { ...p, records: { ...p.records, [key]: score } } : p, agilityXp, best };
}
