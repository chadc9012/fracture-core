/** Neon City's nightlife venues (the owner's nightlife board, kept from the uploaded nightlife phase): Pulse Array and
 * Afterglow (nightclubs), Velvet Circuit (a 21+ cabaret lounge — exterior signage only) and Crown Casino. Each venue
 * takes over the tower lot nearest its spot on the board, so it inherits a cleared, street-facing block without moving
 * any tower, home or race route; NeonTowerBlocks skips those towers and NeonVenues builds the venues there. Pure. */
import { TOWER_FOOTPRINT, type TowerPlacement } from "./neon-layout";
import { NEON_SITE } from "./world";

export type Venue = { id: string; name: string; sub: string; kind: "nightclub" | "lounge" | "casino"; color: string; accent: string; dx: number; dz: number };
export const VENUES: readonly Venue[] = [
  { id: "pulse-array", name: "PULSE ARRAY", sub: "NEON CITY NIGHTCLUB", kind: "nightclub", color: "#35efff", accent: "#7a5cff", dx: 26, dz: 52 },
  { id: "afterglow", name: "AFTERGLOW", sub: "NEON CITY NIGHTCLUB", kind: "nightclub", color: "#ff3b9d", accent: "#ff7a3a", dx: -26, dz: 52 },
  { id: "velvet-circuit", name: "VELVET CIRCUIT", sub: "21+ CABARET LOUNGE", kind: "lounge", color: "#c040ff", accent: "#ff4fa8", dx: 26, dz: 86 },
  { id: "crown-casino", name: "CROWN CASINO", sub: "CASINO · HOTEL", kind: "casino", color: "#ffc247", accent: "#ff8a2a", dx: -104, dz: -26 },
];

export type VenueLot = { venue: Venue; x: number; z: number; rot: 0 | 1 | 2 | 3; hx: number; hz: number; tower: TowerPlacement };

export function venueLots(towers: readonly TowerPlacement[]): VenueLot[] {
  const used = new Set<TowerPlacement>();
  const out: VenueLot[] = [];
  for (const v of VENUES) {
    const tx = NEON_SITE.x + v.dx, tz = NEON_SITE.z + v.dz;
    let best: TowerPlacement | null = null, bd = Infinity;
    for (const t of towers) { if (used.has(t)) continue; const d = Math.hypot(t.x - tx, t.z - tz); if (d < bd) { bd = d; best = t; } }
    if (!best) continue;
    used.add(best);
    const [hx, hz] = TOWER_FOOTPRINT[best.variant];
    // face the venue's entrance toward the city centre (local +z turned by rot quarter-turns)
    const r = Math.round(Math.atan2(NEON_SITE.x - best.x, NEON_SITE.z - best.z) / (Math.PI / 2));
    out.push({ venue: v, x: best.x, z: best.z, rot: (((r % 4) + 4) % 4) as VenueLot["rot"], hx, hz, tower: best });
  }
  return out;
}

/* ------------------------------------------------------------------ nightlife as gameplay (pure)
 * The four venues open their doors at night (VENUE_HOURS) as walk-in pocket rooms (venue-doors.ts), host a repeating
 * event schedule, and remember you: every night you walk in is one visit, stored as a `venue-visit:<id>@<day>` key in
 * progression.earnedRewards (cloud merge is a union, so a visit is never lost or double-counted), and your standing with
 * the venue is the number of nights you have come. Regulars hear more; at VIP_VISITS the staff treat you as VIP.
 * Nothing here pays currency or XP: it is social standing only. Dialogue is ambient city talk, never story spoilers. */

/** opening hours on the day clock (0-24); a close earlier than the open runs past midnight */
export const VENUE_HOURS: Readonly<Record<string, { open: number; close: number }>> = {
  "pulse-array": { open: 20, close: 4 }, afterglow: { open: 21, close: 5 }, "velvet-circuit": { open: 18, close: 2 }, "crown-casino": { open: 0, close: 24 },
  // Nexus City's late-night diner (venue-life.ts NEXUS_DINER)
  "grid-line-diner": { open: 17, close: 7 },
};
export const inHours = (open: number, close: number, hour: number) => (open === close || (open === 0 && close === 24) ? true : open < close ? hour >= open && hour < close : hour >= open || hour < close);
export const venueOpen = (id: string, hour: number) => { const h = VENUE_HOURS[id]; return h ? inHours(h.open, h.close, hour) : false; };

export type VenueEvent = { id: string; venue: string; title: string; start: number; end: number };
export const VENUE_EVENTS: readonly VenueEvent[] = [
  { id: "pulse-overdrive", venue: "pulse-array", title: "Overdrive Hour · bass-heavy set", start: 23, end: 1 },
  { id: "afterglow-sunrise", venue: "afterglow", title: "Sunrise Session · last dance before dawn", start: 3, end: 5 },
  { id: "velvet-showcase", venue: "velvet-circuit", title: "Midnight Showcase · live cabaret", start: 22, end: 0 },
  { id: "crown-high-roller", venue: "crown-casino", title: "High Roller Night · private tables open", start: 21, end: 2 },
];
export const venueEvent = (id: string, hour: number): VenueEvent | null => VENUE_EVENTS.find((e) => e.venue === id && inHours(e.start, e.end, hour)) ?? null;

export const VIP_VISITS = 5;
export const venueVisitKey = (id: string, day: string) => `venue-visit:${id}@${day}`;
const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
/** nights visited (distinct days) */
export const venueStanding = (p: { earnedRewards: readonly string[] }, id: string) => p.earnedRewards.filter((k) => k.startsWith(`venue-visit:${id}@`)).length;
export const isVip = (p: { earnedRewards: readonly string[] }, id: string) => venueStanding(p, id) >= VIP_VISITS;
/** one visit per venue per day; returns the same object when today's visit is already recorded */
export function recordVenueVisit<P extends { earnedRewards: string[] }>(p: P, id: string, now = Date.now()): P {
  const key = venueVisitKey(id, dayOf(now));
  return p.earnedRewards.includes(key) ? p : { ...p, earnedRewards: [...p.earnedRewards, key] };
}

/** who greets you inside, and what they say by how well they know you (new / regular / VIP) */
export const VENUE_HOST: Readonly<Record<string, string>> = { "pulse-array": "Kade, door host", afterglow: "Sable, bartender", "velvet-circuit": "Mirelle, hostess", "crown-casino": "Dorian, pit boss", "grid-line-diner": "Ma Ruiz, owner" };
const LINES: Readonly<Record<string, readonly [string[], string[], string[]]>> = {
  "pulse-array": [
    ["First time at Pulse Array? Keep your hands where the bouncers can see them and your eyes on the lights.", "The floor shakes on the drop. That's the building, not you."],
    ["You again. Good. The regulars are starting to save you a spot by the rail.", "DJ's been testing a new set all week. Stick around past eleven."],
    ["VIP rail's yours tonight. Nobody asks questions up there.", "You've earned the quiet booth. The city can wait an hour."],
  ],
  afterglow: [
    ["Afterglow never really closes, it just gets quieter. What are you drinking?", "Most people come here to forget a job. Some come to find one."],
    ["Back already? I'll start your usual.", "Heard a crew from the Grid tried to start trouble last night. Didn't last long."],
    ["For you, the back room's open. Best view of the sunrise in Neon.", "Regulars like you keep this place alive. First round's on the house — figuratively. I still need the till to balance."],
  ],
  "velvet-circuit": [
    ["Welcome to the Velvet Circuit. Seats near the stage are earned, not bought.", "The show starts when the lights go violet."],
    ["Nice to see a familiar face. The performers notice who comes back.", "Tonight's showcase has a new act. Don't leave early."],
    ["Your table's ready, VIP. Front row.", "The house remembers its friends."],
  ],
  "grid-line-diner": [
    ["Grid Line Diner. Counter, booths, coffee that's been on since sundown. Sit.", "Night Shift Special's on the board. It fixes most things."],
    ["Back again. The coffee remembers you.", "Late shift's been rough on the Grid. Everyone's eating double."],
    ["Your stool's waiting. You're family here now, God help you.", "Regulars eat first. That's the rule, and I made it."],
  ],
  "crown-casino": [
    ["Crown Casino never sleeps. House rules: no weapons drawn, no debts left unpaid.", "Watch the tables before you play them. The house always watches you."],
    ["The dealers know your face now. That's good — mostly.", "High Roller Night brings out people who'd rather not be seen. Be polite."],
    ["The private tables are open to you. Dorian's orders.", "A VIP in the Crown hears things. Keep what you hear to yourself."],
  ],
};
/** the greeting lines for a visit (standing counted before today's visit is recorded) */
export function venueDialogue(id: string, standing: number, hour: number): { speaker: string; text: string }[] {
  const tier = standing >= VIP_VISITS ? 2 : standing >= 2 ? 1 : 0;
  const speaker = VENUE_HOST[id] ?? "Host", bank = LINES[id]?.[tier] ?? [];
  const ev = venueEvent(id, hour);
  return [...bank.map((text) => ({ speaker, text })), ...(ev ? [{ speaker, text: `Tonight: ${ev.title}.` }] : [])];
}
