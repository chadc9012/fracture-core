/** City happenings (pure): the calm side of city life. Each in-game day every district hosts one daytime or evening gathering —
 * a street market, a busker set, a car meet, a food-truck night — picked deterministically from (day, district), so the same
 * day always has the same lineup and nothing needs saving to be consistent. Walking into the district while it is on earns a small
 * once per real day "regular" mark (an `earnedRewards` key, union-merged by the cloud save like venue visits) and a little standing with
 * the district's faction; it never pays currency or XP and never touches combat. */
import { DISTRICTS, type District, type FactionId } from "./living-world";
import { hourOf } from "./world";

export type HappeningKind = "market" | "busker" | "carmeet" | "foodtruck";
export type Happening = { kind: HappeningKind; title: string; blurb: string; from: number; to: number };
export const HAPPENINGS: Record<HappeningKind, Happening> = {
  market: { kind: "market", title: "Street Market", blurb: "Stalls are out and the block smells like fried dough.", from: 9, to: 17 },
  busker: { kind: "busker", title: "Busker Set", blurb: "Someone's playing on the corner and a small crowd has stopped to listen.", from: 12, to: 21 },
  carmeet: { kind: "carmeet", title: "Car Meet", blurb: "Engines idling, hoods up. The local crews are showing off.", from: 19, to: 24 },
  foodtruck: { kind: "foodtruck", title: "Food Truck Night", blurb: "A row of trucks has parked up and the line is already long.", from: 17, to: 23 },
};
const KINDS = Object.keys(HAPPENINGS) as HappeningKind[];
/** how far from a district's anchor counts as being at it */
export const HAPPENING_RADIUS = 55;
/** what a visit is worth: a little standing with the district's faction, once per district per real day */
export const HAPPENING_REP = 1;

/** in-game day number from the day cycle's running clock (whole days elapsed) */
export const dayIndex = (t: number) => Math.floor(t);
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** the happening a district hosts on a given day */
export const happeningFor = (districtId: string, day: number): Happening => HAPPENINGS[KINDS[hash(`${districtId}@${day}`) % KINDS.length]!];
export const isOn = (h: Happening, t: number) => { const hr = hourOf(t); return hr >= h.from && hr < h.to; };

export type LiveHappening = { district: District; happening: Happening; day: number };
/** every happening that is on right now, across both cities */
export function activeHappenings(t: number): LiveHappening[] {
  const day = dayIndex(t);
  return DISTRICTS.map((district) => ({ district, happening: happeningFor(district.id, day), day })).filter((x) => isOn(x.happening, t));
}
/** the happening the player is standing at (nearest within range), or null */
export function happeningAt(x: number, z: number, t: number): LiveHappening | null {
  let best: LiveHappening | null = null, bd = HAPPENING_RADIUS;
  for (const h of activeHappenings(t)) { const d = Math.hypot(h.district.x - x, h.district.z - z); if (d <= bd) { bd = d; best = h; } }
  return best;
}

type Save = { earnedRewards: string[] };
/** attendance is keyed by the real calendar day (like venue visits), because the in-game day counter restarts every session */
export const happeningKey = (districtId: string, calendarDay: string) => `happening:${districtId}@${calendarDay}`;
export const hasAttended = (p: Save, districtId: string, calendarDay: string) => p.earnedRewards.includes(happeningKey(districtId, calendarDay));
/** how many happenings this player has turned up to, ever */
export const attendance = (p: Save) => p.earnedRewards.filter((k) => k.startsWith("happening:")).length;
/** mark attendance; `faction` is who to thank (the district's own), `rep` is 0 when it was already counted today */
export function attend<P extends Save>(p: P, live: LiveHappening, calendarDay: string): { progression: P; faction: FactionId | null; rep: number } {
  if (hasAttended(p, live.district.id, calendarDay)) return { progression: p, faction: null, rep: 0 };
  return { progression: { ...p, earnedRewards: [...p.earnedRewards, happeningKey(live.district.id, calendarDay)] }, faction: live.district.faction, rep: HAPPENING_REP };
}
