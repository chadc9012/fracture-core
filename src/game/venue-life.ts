/** Venue life (pure): what you do inside the city's nightlife venues once you've walked in. Stages 78-80 of the owner's
 * nightlife bundle, recovered from the stage 76-102 uploads (neon-nightlife.ts / NeonNightlife.tsx) and reconnected to the
 * venues that exist today. Nothing here runs a second progression pipeline:
 *  - memory lives in the main save as earnedRewards keys (union-merged by the cloud save, like venue visits and best scores);
 *  - house specials are paid in Nex through the ledger (spendNex) and act through the existing stim/buff system (stash.ts);
 *  - challenge rewards pay like activities do: a one-time Nex ledger claim, grantXP and materials.
 * There are no friendship or standing scores (owner, Oct 25): people remember what you have done together, and say so.
 *
 * Old venue -> today's venue (the uploads' places no longer exist; their ideas move to these):
 *  - Pulse Zero (club, dance floor, Four-Beat Dance)  -> Pulse Array
 *  - Skyline Room (lounge, "Meet the Locals")         -> Velvet Circuit
 *  - Pixel Pit (arcade, "Arcade Streak")              -> the Pixel Pit cabinet at Crown Casino (arcade.ts)
 *  - Afterglow Eats (late food, "Tasting Tour")       -> Afterglow (bar and kitchen)
 *  - new: Nexus City's late-night diner, the Grid Line Diner (owner chose one Nexus venue)
 * Old roles bouncer / bartender / local map to each venue's cast below (the host from nightlife.ts stays the greeter). */
import { nexBalance, spendNex } from "./nex";
import { grantXP } from "./xp";
import type { PlayerProgression } from "./progression";
import type { MaterialId } from "./inventory";
import type { Buffs, ConsumableId } from "./stash";
import { VENUE_HOURS, inHours, isVip, venueStanding } from "./nightlife";
import { danceBest } from "./dance";

export const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
type Save = Pick<PlayerProgression, "earnedRewards">;
const has = (p: Save, key: string) => p.earnedRewards.includes(key);
const count = (p: Save, prefix: string) => p.earnedRewards.filter((k) => k.startsWith(prefix)).length;
const add = <P extends Save>(p: P, key: string): P => (has(p, key) ? p : { ...p, earnedRewards: [...p.earnedRewards, key] });

/* ---------------- Stage 78: the Nexus venue ---------------- */

/** The Grid Line Diner: Nexus City's one nightlife venue, a late-night diner-bar on the ground floor of a low-rise block
 * near the hub (venue-doors.ts places its door, NexusDiner.tsx draws its frontage). Hours run dusk to dawn. */
export const NEXUS_DINER = { id: "grid-line-diner", name: "GRID LINE DINER", sub: "NEXUS CITY · LATE NIGHT", color: "#ffb347", accent: "#4fd1ff", host: "Ma Ruiz, owner", open: 17, close: 7 } as const;

/* ---------------- Stage 79/80: who's inside ---------------- */

export type Role = "bouncer" | "bartender" | "regular";
/** something you have done that people can remember */
export type Fact = "danced" | "fourbeat" | "jackpot" | "special" | "vip" | "regular";
export type Topic = { id: string; title: string; text: string; /** what has to be true before they'll bring it up */ needs?: Fact | "second-night" | "third-night"; discovery?: { title: string; nex: number; xp: number; materials: Partial<Record<MaterialId, number>> } };
export type CastMember = {
  id: string; venue: string; name: string; role: Role;
  /** where they stand in the venue's pocket room (room-local metres; Interiors.tsx VenueRoom) */
  spot: { x: number; z: number };
  /** first meeting, and what they say once they know you */
  first: string; known: readonly string[];
  /** what they say when they remember something you did here */
  remembers: Partial<Record<Fact, string>>;
  topics: readonly Topic[];
};

export const CAST: readonly CastMember[] = [
  // Pulse Array: club (old Pulse Zero)
  { id: "pa-vex", venue: "pulse-array", name: "Vex", role: "bouncer", spot: { x: 1.4, z: 3.1 },
    first: "Hands visible, weapons holstered. You start something on my floor, you finish it outside.",
    known: ["You again. Floor's warm tonight.", "Keep it clean in there and we stay friends."],
    remembers: { danced: "Saw you on the floor. Didn't trip over anyone. That's more than most.", vip: "VIP rail's on the left. You know the way." },
    topics: [
      { id: "pa-vex-rules", title: "House rules", text: "No drawn steel, no deals on the floor, no Grid patches past the rope. Everything else is between you and the DJ." },
      { id: "pa-vex-quiet", title: "Trouble lately?", needs: "second-night", text: "A crew in Grid jackets keep testing the back door. They never get past it. Tell your friends that." },
    ] },
  { id: "pa-juno", venue: "pulse-array", name: "Juno", role: "regular", spot: { x: 2.6, z: 0.8 },
    first: "New face. The trick is the four-count: feel the kick, step on four.",
    known: ["Four-count, remember? Everything else is decoration.", "DJ changes the set every night. Same bones, new skin."],
    remembers: { fourbeat: "You found the four! Told you it's all in the kick.", danced: "Your footwork's getting less embarrassing." },
    topics: [
      { id: "pa-juno-fourbeat", title: "Teach me the four-count", text: "Stand on the floor, wait for the pulse, hit it on the beat. Four clean steps and you're dancing. Miss four and the floor eats you." },
      { id: "pa-juno-set", title: "Tonight's set", needs: "danced", text: "The set runs on the club's tempo and changes at midnight. Off-beats creep in once you're seven steps deep. Watch for them." },
      { id: "pa-juno-rail", title: "The old light rig", needs: "third-night", text: "Before Pulse Array it was a freight shed. The old rig's still up in the rafters. Somebody tags it every year.",
        discovery: { title: "Freight-shed light rig", nex: 60, xp: 80, materials: { dataChip: 2 } } },
    ] },
  // Afterglow: bar and late kitchen (old Afterglow Eats)
  { id: "ag-sable", venue: "afterglow", name: "Sable", role: "bartender", spot: { x: -1.5, z: -4.6 },
    first: "Kitchen's open till the sun comes up. The Sunrise Plate fixes most things.",
    known: ["The usual corner's free.", "You look like a long shift. Sit."],
    remembers: { special: "Back for another plate? It's the hot sauce. Everyone comes back for the hot sauce.", regular: "Night after night. You're a regular now, whether you like it or not." },
    topics: [
      { id: "ag-sable-plate", title: "What's in the Sunrise Plate?", text: "Eggs, flatbread, the green sauce and something from the coast I won't name. Keeps you mending for a while after." },
      { id: "ag-sable-tour", title: "Where else eats this late?", needs: "special", text: "Velvet pours a decent Violet Hour, Crown does espresso that'll stop your heart, and Ma Ruiz runs a diner over in Nexus. Try them all." },
    ] },
  { id: "ag-otto", venue: "afterglow", name: "Otto", role: "regular", spot: { x: -3.2, z: 2.0 },
    first: "Don't sit there, that's... fine, sit there. I'm Otto. I drive the dawn tram.",
    known: ["Tram's running late again. Always is.", "Afterglow at four in the morning is the only honest place in Neon."],
    remembers: { danced: "You were on the floor at the sunrise set. Bold." },
    topics: [
      { id: "ag-otto-trams", title: "The dawn tram", text: "Maglev line, tower to tower. I see the whole city wake up. Mostly it wakes up angry." },
      { id: "ag-otto-ledger", title: "Anything strange on your route?", needs: "second-night", text: "There's a stop the board says doesn't exist. Lights come on there some nights. I don't stop. Nobody asks me to." },
    ] },
  // Velvet Circuit: lounge (old Skyline Room)
  { id: "vc-bram", venue: "velvet-circuit", name: "Bram", role: "bouncer", spot: { x: 1.4, z: 3.1 },
    first: "Lounge rules. Quiet voices, no recordings, tip the performers.",
    known: ["Evening.", "Showcase is worth your time tonight."],
    remembers: { vip: "Front row's held for you." },
    topics: [{ id: "vc-bram-show", title: "What's the show?", text: "Cabaret, live band, one act that does something with light I still can't explain. Starts when the room goes violet." }] },
  { id: "vc-lena", venue: "velvet-circuit", name: "Lena", role: "bartender", spot: { x: -3.3, z: -4.5 },
    first: "Violet Hour? It's the house pour. Takes the edge off a bad day.",
    known: ["Same again?", "Quiet tonight. I like quiet."],
    remembers: { special: "You came back for the Violet Hour. Good taste." },
    topics: [{ id: "vc-lena-pour", title: "The Violet Hour", text: "Plum, smoke and a mineral from the frost country. Folks swear it makes them hard to hurt for a bit. Don't quote me." }] },
  { id: "vc-ines", venue: "velvet-circuit", name: "Ines", role: "regular", spot: { x: -3.2, z: 2.0 },
    first: "You're blocking my view of the stage. Kidding. Sit.",
    known: ["The new act is good. Don't tell them I said so.", "I come for the music and leave before the speeches."],
    remembers: { regular: "You keep turning up. We should form a club. A quiet one." },
    topics: [
      { id: "vc-ines-city", title: "Who comes here?", text: "Tower clerks, off-duty Aegis, a few people who'd rather not be named. The music's the only thing nobody argues about." },
      { id: "vc-ines-booth", title: "The empty booth", needs: "second-night", text: "The far booth's kept empty every night. Reserved for someone who stopped coming. The staff still set a glass.",
        discovery: { title: "The reserved booth", nex: 50, xp: 70, materials: { energyToken: 2 } } },
    ] },
  { id: "vc-cass", venue: "velvet-circuit", name: "Cass", role: "regular", spot: { x: -0.2, z: -2.8 },
    first: "Lena makes the best drink in Neon and she knows it.",
    known: ["Lena's in a mood. Order something easy.", "I used to perform here. Now I heckle politely."],
    remembers: {},
    topics: [{ id: "vc-cass-stage", title: "You performed here?", text: "Six seasons. Then my hands started shaking. Now I come to watch. It's not worse, just different." }] },
  // Crown Casino: pit boss is the host; arcade cabinet (old Pixel Pit)
  { id: "cc-rook", venue: "crown-casino", name: "Rook", role: "bouncer", spot: { x: 1.4, z: 3.1 },
    first: "No weapons drawn, no debts left unpaid. The house watches everyone.",
    known: ["Lucky night?", "Dorian says hello. He doesn't."],
    remembers: { jackpot: "Heard you broke the Pixel Pit. The cabinet's been sulking." },
    topics: [{ id: "cc-rook-house", title: "Who runs the Crown?", text: "Dorian runs the floor. Who runs Dorian is a question people stop asking around here." }] },
  { id: "cc-mags", venue: "crown-casino", name: "Mags", role: "regular", spot: { x: 2.6, z: 0.8 },
    first: "You here for the tables or the cabinet? The cabinet's honest at least.",
    known: ["Cabinet's faster tonight.", "I've lost more to that machine than to any table."],
    remembers: { jackpot: "Jackpot! Buy me an espresso, you owe the room one." },
    topics: [
      { id: "cc-mags-pit", title: "Beating the Pixel Pit", text: "Don't press early, it counts as a miss. Wait for the light, then commit. Every round it gets meaner." },
      { id: "cc-mags-chip", title: "The lucky chip", needs: "jackpot", text: "Old house chip, wedged in the cabinet's coin return. Nobody's managed to get it out. You've got steady hands.",
        discovery: { title: "The cabinet's lucky chip", nex: 80, xp: 90, materials: { dataShards: 1 } } },
    ] },
  // Grid Line Diner (Nexus)
  { id: "gl-ma", venue: "grid-line-diner", name: "Ma Ruiz", role: "bartender", spot: { x: -1.5, z: -4.6 },
    first: "Sit anywhere that isn't sticky. Night Shift Special's on the board.",
    known: ["Coffee's fresh. Ish.", "You eat yet? You don't look like you ate."],
    remembers: { special: "Back for the special. I'll make it extra hot.", regular: "Three nights running. Your stool's got your shape now." },
    topics: [
      { id: "gl-ma-diner", title: "How long's the diner been here?", text: "Before the towers, before the Fracture. My mother ran it for the rail crews. We kept the counter." },
      { id: "gl-ma-crews", title: "Who comes in at night?", needs: "second-night", text: "Grid techs off the late shift, couriers, Guild runners. Everybody's tired, nobody's trouble. Mostly." },
    ] },
  { id: "gl-deck", venue: "grid-line-diner", name: "Deck", role: "regular", spot: { x: -1.4, z: 0.4 },
    first: "Grid tech. Night shift. Don't ask me to fix your lights.",
    known: ["Three substations down tonight. Same three.", "Coffee and complaints, that's the shift."],
    remembers: { regular: "You're a night person too. Respect." },
    topics: [
      { id: "gl-deck-grid", title: "What breaks on the Grid?", text: "Everything at the edges. The hub's fine. Out past the districts the lines hum wrong after dark." },
      { id: "gl-deck-relay", title: "A relay nobody logged", needs: "third-night", text: "There's a relay box on a roof in the shipyard district that isn't on any map. It's warm. I put my hand on it once.",
        discovery: { title: "The unlogged relay", nex: 70, xp: 80, materials: { scrapMetal: 6 } } },
    ] },
];
export const castAt = (venue: string) => CAST.filter((c) => c.venue === venue);

/* ---------------- facts (Stage 80 memory) ---------------- */

const talkKey = (npc: string, day: string) => `venue-talk:${npc}@${day}`;
const factKey = (fact: "danced" | "fourbeat" | "jackpot" | "special", venue: string, day: string) => `venue-${fact}:${venue}@${day}`;
/** nights you've spent talking with someone (distinct days); never shown to the player, it only picks what they remember */
export const nightsTalked = (p: Save, npc: string) => count(p, `venue-talk:${npc}@`);
export function hasFact(p: Save, venue: string, fact: Fact): boolean {
  if (fact === "vip") return isVip(p, venue);
  if (fact === "regular") return venueStanding(p, venue) >= 3;
  if (fact === "danced") return danceBest(p, venue) > 0 || count(p, `venue-danced:${venue}@`) > 0;
  return count(p, `venue-${fact}:${venue}@`) > 0;
}
/** remember something you did at a venue tonight (once per venue per night) */
export const recordFact = <P extends Save>(p: P, venue: string, fact: "danced" | "fourbeat" | "jackpot" | "special", now = Date.now()): P => add(p, factKey(fact, venue, dayOf(now)));

/* ---------------- Stage 79: conversations ---------------- */

export type Line = { speaker: string; text: string };
const topicOpen = (p: Save, c: CastMember, t: Topic, nights: number) =>
  !t.needs || (t.needs === "second-night" ? nights >= 2 : t.needs === "third-night" ? nights >= 3 : hasFact(p, c.venue, t.needs));
/** topics this person will talk about now (counting tonight's conversation) */
export function openTopics(p: Save, npc: string, now = Date.now()): Topic[] {
  const c = CAST.find((x) => x.id === npc); if (!c) return [];
  const nights = nightsTalked(p, npc) + (has(p, talkKey(npc, dayOf(now))) ? 0 : 1);
  return c.topics.filter((t) => topicOpen(p, c, t, nights));
}
/** what they say when you walk up: a first meeting, or a line that shows they remember you (and what you did) */
export function greeting(p: Save, npc: string, now = Date.now()): Line[] {
  const c = CAST.find((x) => x.id === npc); if (!c) return [];
  const nights = nightsTalked(p, npc);
  if (nights === 0) return [{ speaker: c.name, text: c.first }];
  const facts: Fact[] = ["jackpot", "fourbeat", "special", "danced", "vip", "regular"];
  const memory = facts.find((f) => c.remembers[f] && hasFact(p, c.venue, f));
  const day = dayOf(now), pick = c.known[(nights + day.charCodeAt(day.length - 1)) % c.known.length]!;
  return memory ? [{ speaker: c.name, text: c.remembers[memory]! }, { speaker: c.name, text: pick }] : [{ speaker: c.name, text: pick }];
}
/** talking counts tonight once (the memory that unlocks second- and third-night topics) */
export const recordTalk = <P extends Save>(p: P, npc: string, now = Date.now()): P => add(p, talkKey(npc, dayOf(now)));
export const discoveryKey = (topic: string) => `venue-discovery:${topic}`;
export const discovered = (p: Save, topic: string) => has(p, discoveryKey(topic));

/* ---------------- Stage 79: house specials ---------------- */

export type Special = { venue: string; name: string; blurb: string; price: number; buff: ConsumableId; seconds: number };
export const SPECIALS: readonly Special[] = [
  { venue: "pulse-array", name: "Overdrive Tonic", blurb: "Citrus, guarana and a hum you feel in your teeth. Hit harder for a while.", price: 45, buff: "ruinStone", seconds: 60 },
  { venue: "afterglow", name: "Sunrise Plate", blurb: "Eggs, flatbread and the green sauce. You keep mending for a while after.", price: 35, buff: "healStim", seconds: 45 },
  { venue: "velvet-circuit", name: "Violet Hour", blurb: "Plum, smoke and frost mineral. Takes the edge off incoming fire.", price: 50, buff: "armorStim", seconds: 90 },
  { venue: "crown-casino", name: "High Roller Espresso", blurb: "Thick enough to stand a spoon in. Sharpens your aim.", price: 40, buff: "ruinStone", seconds: 45 },
  { venue: "grid-line-diner", name: "Night Shift Special", blurb: "Noodles, chilli oil, bottomless coffee. Patches you up between jobs.", price: 30, buff: "healStim", seconds: 60 },
];
export const specialAt = (venue: string) => SPECIALS.find((s) => s.venue === venue) ?? null;
const specialKey = (venue: string, day: string) => `special:${venue}@${day}`;
export const hadSpecialTonight = (p: Pick<PlayerProgression, "nexLedger">, venue: string, now = Date.now()) => specialKey(venue, dayOf(now)) in p.nexLedger;
/** one special per venue per night, paid in Nex; the effect is one stack of an existing buff for the special's duration
 * (it never shortens a longer running buff, and never stacks past what you already had) */
export function orderSpecial<P extends Pick<PlayerProgression, "nexLedger" | "earnedRewards">>(p: P, buffs: Buffs, venue: string, hour: number, now = Date.now()):
  { progression: P; buffs: Buffs; special: Special } | { error: string } {
  const s = specialAt(venue); if (!s) return { error: "Nothing on the menu here" };
  const h = VENUE_HOURS[venue] ?? (venue === NEXUS_DINER.id ? { open: NEXUS_DINER.open, close: NEXUS_DINER.close } : null);
  if (h && !inHours(h.open, h.close, hour)) return { error: "The kitchen's closed" };
  if (hadSpecialTonight(p, venue, now)) return { error: `You've had the ${s.name} tonight` };
  const ledger = spendNex(p.nexLedger, specialKey(venue, dayOf(now)), s.price);
  if (!ledger) return { error: `${s.name} is ${s.price} Nex (you have ${nexBalance(p.nexLedger)})` };
  const cur = buffs[s.buff], live = cur && cur.until > now;
  const until = Math.max(live ? cur!.until : 0, now + s.seconds * 1000);
  const next = recordFact({ ...p, nexLedger: ledger }, venue, "special", now);
  return { progression: next, buffs: { ...buffs, [s.buff]: { stacks: live ? Math.max(1, cur!.stacks) : 1, until } }, special: s };
}

/* ---------------- Stage 79: the Four-Beat Dance ---------------- */

/** The four-count from the old Pulse Zero floor: tap on the club's beat. Four clean hits win, four misses or 15 s lose, and
 * each beat takes one tap (a second tap on the same beat is ignored). Times in ms from the start, injected for tests. */
export const FOURBEAT = { hits: 4, misses: 4, timeoutMs: 15000, windowFrac: 0.3, leadInMs: 1200 } as const;
export const FOURBEAT_BPM: Readonly<Record<string, number>> = { "pulse-array": 124, afterglow: 108, "velvet-circuit": 96 };
export type FourBeat = { venue: string; beatMs: number; hits: number; misses: number; lastBeat: number; done: boolean; won: boolean };
export const startFourBeat = (venue: string): FourBeat => ({ venue, beatMs: 60000 / (FOURBEAT_BPM[venue] ?? 110), hits: 0, misses: 0, lastBeat: -1, done: false, won: false });
/** where the next beat is, 0..1 of the way there (for the pulse ring) */
export const fourBeatPhase = (s: FourBeat, t: number) => (t < FOURBEAT.leadInMs ? 0 : ((t - FOURBEAT.leadInMs) % s.beatMs) / s.beatMs);
export function fourBeatTick(s: FourBeat, t: number): FourBeat {
  return s.done || t <= FOURBEAT.timeoutMs ? s : { ...s, done: true, won: false };
}
export function fourBeatTap(s0: FourBeat, t: number): { state: FourBeat; grade: "hit" | "miss" | null } {
  const s = fourBeatTick(s0, t);
  if (s.done || !Number.isFinite(t) || t < 0) return { state: s, grade: null };
  const rel = t - FOURBEAT.leadInMs;
  if (rel < -s.beatMs * FOURBEAT.windowFrac) { const misses = s.misses + 1; return { state: { ...s, misses, done: misses >= FOURBEAT.misses }, grade: "miss" }; }
  const beat = Math.round(rel / s.beatMs);
  if (beat === s.lastBeat) return { state: s, grade: null };
  const off = Math.abs(rel - beat * s.beatMs), hit = off <= s.beatMs * FOURBEAT.windowFrac;
  const hits = s.hits + (hit ? 1 : 0), misses = s.misses + (hit ? 0 : 1);
  const won = hits >= FOURBEAT.hits;
  return { state: { ...s, lastBeat: beat, hits, misses, done: won || misses >= FOURBEAT.misses, won }, grade: hit ? "hit" : "miss" };
}

/* ---------------- Stage 80: venue challenges ---------------- */

export type Reward = { nex: number; xp: number; materials: Partial<Record<MaterialId, number>> };
export type Challenge = { id: string; venue: string; title: string; blurb: string; target: number; progress: (p: PlayerProgression) => number; reward: Reward };
const nightsWith = (p: Save, prefix: string) => count(p, prefix);
export const CHALLENGES: readonly Challenge[] = [
  { id: "four-beat", venue: "pulse-array", title: "Four-Beat Dance", blurb: "Land the four-count on four different nights", target: 4,
    progress: (p) => nightsWith(p, "venue-fourbeat:pulse-array@"), reward: { nex: 120, xp: 140, materials: { energyToken: 2 } } },
  { id: "floor-filler", venue: "afterglow", title: "Sunrise Set", blurb: "Score 4,000 or more on Afterglow's dance set", target: 1,
    progress: (p) => (danceBest(p, "afterglow") >= 4000 ? 1 : 0), reward: { nex: 100, xp: 120, materials: { dataChip: 2 } } },
  { id: "meet-the-locals", venue: "velvet-circuit", title: "Meet the Locals", blurb: "Get to know everyone at the Velvet Circuit", target: castAt("velvet-circuit").length,
    progress: (p) => castAt("velvet-circuit").filter((c) => nightsTalked(p, c.id) > 0).length, reward: { nex: 90, xp: 110, materials: { energyToken: 1, dataChip: 1 } } },
  { id: "arcade-streak", venue: "crown-casino", title: "Arcade Streak", blurb: "Hit the Pixel Pit jackpot on three nights", target: 3,
    progress: (p) => nightsWith(p, "venue-jackpot:crown-casino@"), reward: { nex: 150, xp: 160, materials: { dataShards: 1 } } },
  { id: "tasting-tour", venue: "afterglow", title: "Tasting Tour", blurb: "Try the house special at every venue in the city", target: SPECIALS.length,
    progress: (p) => SPECIALS.filter((s) => count(p, `venue-special:${s.venue}@`) > 0).length, reward: { nex: 140, xp: 150, materials: { gearParts: 4 } } },
  { id: "night-shift", venue: "grid-line-diner", title: "Night Shift Regular", blurb: "Eat at the Grid Line Diner on three nights", target: 3,
    progress: (p) => nightsWith(p, "venue-special:grid-line-diner@"), reward: { nex: 80, xp: 100, materials: { scrapMetal: 8 } } },
];
export const challengesAt = (venue: string) => CHALLENGES.filter((c) => c.venue === venue);
const claimKey = (id: string) => `venue-challenge:${id}`;
export const challengeClaimed = (p: Pick<PlayerProgression, "nexLedger">, id: string) => claimKey(id) in p.nexLedger;

/** pays a reward through the same pipeline as activities: a one-time Nex ledger claim, mission-scaled XP and materials */
function pay(p: PlayerProgression, key: string, r: Reward): PlayerProgression {
  let next: PlayerProgression = { ...p, nexLedger: { ...p.nexLedger, [key]: r.nex } };
  next = grantXP(next, "MISSION", { scale: r.xp / 1200 }).progression;
  const materials = { ...next.materials };
  for (const [id, n] of Object.entries(r.materials) as [MaterialId, number][]) materials[id] = (materials[id] ?? 0) + n;
  return { ...next, materials };
}
export type Payout = { title: string; reward: Reward };
/** claims every finished, unclaimed challenge (idempotent: a claimed challenge never pays twice) */
export function claimChallenges(p: PlayerProgression): { progression: PlayerProgression; paid: Payout[] } {
  let next = p; const paid: Payout[] = [];
  for (const c of CHALLENGES) {
    if (challengeClaimed(next, c.id) || c.progress(next) < c.target) continue;
    next = pay(next, claimKey(c.id), c.reward); paid.push({ title: c.title, reward: c.reward });
  }
  return { progression: next, paid };
}
/** a discovery pays once, when its topic is first heard */
export function claimDiscovery(p: PlayerProgression, topic: Topic): { progression: PlayerProgression; paid: Payout | null } {
  if (!topic.discovery || discovered(p, topic.id)) return { progression: p, paid: null };
  const next = add(pay(p, `venue-discovery-pay:${topic.id}`, topic.discovery), discoveryKey(topic.id));
  return { progression: next, paid: { title: topic.discovery.title, reward: topic.discovery } };
}
export const rewardText = (r: Reward) => [r.nex ? `+${r.nex} Nex` : "", r.xp ? `+${r.xp} XP` : "", ...Object.entries(r.materials).map(([k, n]) => `+${n} ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`)].filter(Boolean).join(" · ");
