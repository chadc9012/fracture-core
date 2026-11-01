/** What Apartment 1204's spots do (nexus-residences.ts APARTMENT_SPOTS; owner's "Nexus City Apartment" sheet: rest to
 * recover, use the PC for missions, news and intel, store items in your stash, change outfits and gear, train with the
 * home workout setup, listen to World Fracture Radio, watch news and world updates). Rest, PC, stash and wardrobe open
 * systems that already exist (GameCanvas wires them); this module holds the parts with their own rules. Pure; tested in
 * apartment-actions.test.ts. */
import type { PlayerProgression } from "./progression";
import type { Buffs } from "./stash";
import { RADIO_STATIONS, type MusicSource, type StationId } from "./radio-stations";

const dayOf = (now: number) => Math.floor(now / 86_400_000);
export const workoutKey = (day: number) => `apartment-workout:${day}`;
/** the workout's buff: the Armor Stim's effect (+10% damage resistance), once a day, for 10 minutes */
export const WORKOUT_BUFF = "armorStim" as const;
export const WORKOUT_SECONDS = 600;

/** a home workout: once per UTC day, a timed armour buff (an Armor Stim's effect, at no cost) */
export function workOut<P extends Pick<PlayerProgression, "earnedRewards">>(p: P, buffs: Buffs, now = Date.now()): { progression: P; buffs: Buffs; message: string } | { error: string } {
  const key = workoutKey(dayOf(now));
  if (p.earnedRewards.includes(key)) return { error: "You've already trained today. Come back tomorrow." };
  const cur = buffs[WORKOUT_BUFF], live = !!cur && cur.until > now;
  const until = Math.max(live ? cur!.until : 0, now + WORKOUT_SECONDS * 1000);
  return {
    progression: { ...p, earnedRewards: [...p.earnedRewards, key] },
    buffs: { ...buffs, [WORKOUT_BUFF]: { stacks: live ? Math.max(1, cur!.stacks) : 1, until } },
    message: `Workout done · +10% damage resistance for ${WORKOUT_SECONDS / 60} min`,
  };
}

/** the station after `current` on World Fracture Radio (the playlist counts as the first stop), wrapping round */
export function nextStation(current: MusicSource): { source: MusicSource; name: string } {
  const order: MusicSource[] = ["playlist", ...(Object.keys(RADIO_STATIONS) as StationId[])];
  const source = order[(order.indexOf(current) + 1) % order.length]!;
  return { source, name: source === "playlist" ? "Your playlist" : RADIO_STATIONS[source].name };
}

/** Nexus City News: a headline for the hour, the morning-show lines from the sheet's story, and live world facts */
const HEADLINES = [
  "Nexus City: another day of progress",
  "Capitol confirms the elevated highway loop reopens on schedule",
  "Residents report flickering lights near the stability towers",
  "Neon City casinos post a record week across the gulf",
  "Verdant Forest rangers warn of storms on the river road",
  "Thalassia's elevator platform running on its usual timetable",
  "Transit authority adds evening ferries to the Wastelands",
  "Vanguard patrols doubled after reports of signal interference",
];
export function newsHeadline(p: Pick<PlayerProgression, "level" | "completedMissions">, now = Date.now()): { headline: string; ticker: string } {
  const hour = Math.floor(now / 3_600_000);
  const headline = HEADLINES[hour % HEADLINES.length]!;
  const done = p.completedMissions.length;
  const ticker = done === 0 ? "No Operator activity reported in the city today." : `Operators completed ${done} operation${done === 1 ? "" : "s"} for the city · Lv ${p.level} on record.`;
  return { headline, ticker };
}
