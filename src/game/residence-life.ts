/** Life in Nexus City Residences (owner's residences pack, Nov 1): the residents you can talk to, the first-morning routine in
 * Apartment 1204, the elevator directory, and the reality-fracture evacuation (elevators stop, the stairs open, a neighbour
 * needs help, you get out through the lobby). Pure rules plus one small live store for the evacuation; progress persists in
 * `progression.earnedRewards` (cloud merge unions it). Scene measures where you stand, GameCanvas shows the buttons. */
import type { PlayerProgression } from "./progression";
import { FLOOR_ORDER, callPad, residenceFloor, stairsDown, stairsPad, type ResidenceFloorId } from "./nexus-residences";

/* ---------------- residents ---------------- */

export type Resident = { id: string; name: string; role: string; floor: ResidenceFloorId; x: number; z: number; lines: readonly string[] };
export const RESIDENTS: readonly Resident[] = [
  { id: "ellis", name: "Ellis", role: "Concierge", floor: "nexus-apartment", x: 2, z: -5.85, lines: [
    "Welcome home. Lifts are behind you, the directory lists every floor.",
    "Parcels go up to the mail room on Floor 2. Ivo keeps them safe.",
    "The courtyard terrace on 3 is open till late. The court's free most mornings.",
    "Residents get the co-working floor on 4 for free. Don't tell the landlord I said that." ] },
  { id: "mara", name: "Mara", role: "Neighbour · off-shift Vanguard tech", floor: "nexus-apartment", x: 4.5, z: 2.2, lines: [
    "Morning, neighbour. Building's been quiet. Too quiet, if you ask me.",
    "I swear the lights in 12 flickered three times last night.",
    "If the lifts ever stop, take the stairs. Don't wait for anyone to come get you." ] },
  { id: "ivo", name: "Ivo", role: "Mail clerk", floor: "nexus-res-services", x: 2, z: -5.6, lines: [
    "Something came for 12-04. Check your box.",
    "Laundry's free before nine. After that it's a war.",
    "Storage lockers are on the south wall. Yours is the one with the dent." ] },
  { id: "kito", name: "Kito", role: "Dog walker", floor: "nexus-res-courtyard", x: -4.2, z: 2.6, lines: [
    "That's Biscuit and that's Rook. Biscuit steals balls.",
    "The dogs get twitchy before a storm. They've been twitchy all week.",
    "Grab a ball and throw it. They'll love you forever." ] },
  { id: "sana", name: "Sana", role: "Trainer", floor: "nexus-res-fitness", x: -1.0, z: 2.8, lines: [
    "Treadmills for stamina, the rack for strength. Do both.",
    "Laps in the pool build lungs. Operators need lungs.",
    "Train every day and it shows. Your body keeps the score." ] },
  { id: "priya", name: "Priya", role: "Freelance engineer", floor: "nexus-res-cowork", x: 3, z: 0.6, lines: [
    "Grab any desk with a green light. The coffee's actually good.",
    "I'm debugging a drone swarm. It keeps forming a smiley face.",
    "A shift here pays a little. More than sitting around." ] },
  { id: "juno", name: "Juno", role: "Sky Lounge host", floor: "nexus-tower-lounge", x: 6.5, z: 4.5, lines: [
    "Movie night's every night. Popcorn's on the house.",
    "Pool table's level, despite what the losers say." ] },
  { id: "dex", name: "Dex", role: "Garage attendant", floor: "nexus-res-parking", x: 9.6, z: 2.8, lines: [
    "Your bay's waiting. Chargers on the north wall are free for residents.",
    "Somebody keeps parking a tank in two spaces. Not naming names." ] },
];
export const TALK_RADIUS = 2.6;
/** where a resident is now: Mara is trapped in the Floor 11 lounge during an evacuation until you reach her, then heads out */
export function residentPlace(r: Resident): { floor: ResidenceFloorId; x: number; z: number } | null {
  if (r.id === "mara" && evac.phase === "alarm") return evac.rescued ? null : TRAPPED;
  return { floor: r.floor, x: r.x, z: r.z };
}
export const residentsOn = (floor: string | null | undefined) => RESIDENTS.filter((r) => residentPlace(r)?.floor === floor);
/** the resident you're close enough to talk to on this floor (local metres), nearest first */
export function residentNear(floor: string | null | undefined, x: number, z: number): Resident | null {
  let best: Resident | null = null, bd = TALK_RADIUS;
  for (const r of residentsOn(floor)) { const at = residentPlace(r)!, d = Math.hypot(x - at.x, z - at.z); if (d < bd) { bd = d; best = r; } }
  return best;
}
/** the line a resident says on the n-th chat (cycles) */
export const residentLine = (r: Resident, n: number) => r.lines[((n % r.lines.length) + r.lines.length) % r.lines.length]!;

/* ---------------- the first morning ---------------- */

export type MorningStep = "dress" | "breakfast" | "phone" | "news" | "neighbour" | "mail";
export const MORNING: readonly { id: MorningStep; label: string; hint: string }[] = [
  { id: "dress", label: "Get dressed", hint: "Wardrobe, in the bedroom" },
  { id: "breakfast", label: "Make breakfast", hint: "Kitchen island" },
  { id: "phone", label: "Check your messages", hint: "By the sofa" },
  { id: "news", label: "Watch the morning news", hint: "The TV wall" },
  { id: "neighbour", label: "Say hi to Mara", hint: "Lobby lounge" },
  { id: "mail", label: "Pick up your mail", hint: "Floor 2 · mail room" },
];
export const morningKey = (step: MorningStep) => `morning:${step}`;
export const MORNING_DONE = "morning:done";
export const MORNING_REWARD = { xp: 150, nex: 100 } as const;
export const morningDone = (p: Pick<PlayerProgression, "earnedRewards">) => p.earnedRewards.includes(MORNING_DONE);
export const morningSteps = (p: Pick<PlayerProgression, "earnedRewards">) => MORNING.map((s) => ({ ...s, done: p.earnedRewards.includes(morningKey(s.id)) }));
/** tick a step off; returns the new progression and whether this finished the routine (the caller pays MORNING_REWARD once) */
export function markMorning<P extends Pick<PlayerProgression, "earnedRewards">>(p: P, step: MorningStep): { progression: P; finished: boolean } {
  if (morningDone(p) || p.earnedRewards.includes(morningKey(step))) return { progression: p, finished: false };
  const earned = [...p.earnedRewards, morningKey(step)];
  const finished = MORNING.every((s) => earned.includes(morningKey(s.id)));
  return { progression: { ...p, earnedRewards: finished ? [...earned, MORNING_DONE] : earned }, finished };
}
/** which morning step a spot or a chat ticks */
export const MORNING_FOR: Partial<Record<string, MorningStep>> = { wardrobe: "dress", breakfast: "breakfast", phone: "phone", tv: "news", "talk:mara": "neighbour", mail: "mail" };

/* ---------------- the evacuation ---------------- */

export const EVAC_DONE = "evac:done", EVAC_RESCUED = "evac:rescued";
export const EVAC_REWARD = { xp: 300, nex: 250, rescueXp: 200 } as const;
/** where Mara is trapped during the evacuation: the Floor 11 lounge, by the theater seats */
export const TRAPPED = { floor: "nexus-tower-lounge" as ResidenceFloorId, x: -4.6, z: 0.6 };
export type Evac = { phase: "off" | "alarm" | "escaped"; rescued: boolean; startedAt: number };
let evac: Evac = { phase: "off", rescued: false, startedAt: 0 };
const evacListeners = new Set<() => void>();
export const getEvac = () => evac;
export const subscribeEvac = (fn: () => void) => { evacListeners.add(fn); return () => { evacListeners.delete(fn); }; };
function setEvac(next: Evac) { evac = next; evacListeners.forEach((f) => f()); }
/** the fracture hits after the first morning: start the evacuation if it has not been survived yet */
export function startEvac(p: Pick<PlayerProgression, "earnedRewards">, now: number): boolean {
  if (evac.phase === "alarm" || p.earnedRewards.includes(EVAC_DONE) || !morningDone(p)) return false;
  setEvac({ phase: "alarm", rescued: false, startedAt: now });
  return true;
}
export function rescueNeighbour(): boolean { if (evac.phase !== "alarm" || evac.rescued) return false; setEvac({ ...evac, rescued: true }); return true; }
/** out through the lobby doors: the evacuation is over; returns what to pay (once) */
export function finishEvac<P extends Pick<PlayerProgression, "earnedRewards">>(p: P): { progression: P; xp: number; nex: number; rescued: boolean } | null {
  if (evac.phase !== "alarm") return null;
  const rescued = evac.rescued;
  setEvac({ ...evac, phase: "escaped" });
  if (p.earnedRewards.includes(EVAC_DONE)) return null;
  return { progression: { ...p, earnedRewards: [...p.earnedRewards, EVAC_DONE, ...(rescued ? [EVAC_RESCUED] : [])] }, xp: EVAC_REWARD.xp + (rescued ? EVAC_REWARD.rescueXp : 0), nex: EVAC_REWARD.nex, rescued };
}
/** test hook */
export function resetEvac() { setEvac({ phase: "off", rescued: false, startedAt: 0 }); }
export const evacuating = () => evac.phase === "alarm";

/* ---------------- moving between floors ---------------- */

export const PAD_REACH = 1.0;
/** standing on a floor's elevator call pad (local metres) */
export const onCallPad = (floor: ResidenceFloorId, x: number, z: number) => { const c = callPad(floor); return Math.hypot(x - c.x, z - c.z) < PAD_REACH; };
export const onStairsPad = (floor: ResidenceFloorId, x: number, z: number) => { const c = stairsPad(floor); return Math.hypot(x - c.x, z - c.z) < PAD_REACH; };
/** can the elevator take you to `to` from `from` right now? (no: during an evacuation, or the same floor) */
export function canRide(from: ResidenceFloorId, to: ResidenceFloorId): string | null {
  if (evacuating()) return "Elevators offline · use the emergency stairs";
  if (from === to) return "You're on this floor";
  if (!FLOOR_ORDER.includes(to)) return "No such floor";
  return null;
}
/** where the stairs lead from a floor during an evacuation (one floor down), and where you come out */
export function stairsTo(from: ResidenceFloorId): { to: ResidenceFloorId; land: { x: number; z: number } } | null {
  if (!evacuating()) return null;
  const to = stairsDown(from);
  if (!to) return null;
  const f = residenceFloor(to)!, st = stairsPad(to);
  // come out beside the stairwell door, a step into the room (clear of its pad, so you don't ride straight down again)
  return { to, land: f.bank === "west" ? { x: st.x + 2.4, z: st.z + 0.6 } : { x: st.x + 0.4, z: st.z - 2.4 } };
}
