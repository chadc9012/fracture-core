/** Vyrak, the Sky Sovereign — a Unique in the Shangri-La Frontier sense (owner, Nov 23 2026: "Think Shanghai-la frontier";
 * answers: secret conditions, world-first + unique loot, the Ashen Mark on a loss, both games).
 *  - Nothing in the game mentions him: no clue, no journal entry, no map marker, no radio, no activity. He comes down only when
 *    the conditions line up — alone, at night, on foot, level 12+, standing in the Ribcage crater at the end of the Glass Flats
 *    for a while (SOVEREIGN_DWELL). Nobody is told the conditions.
 *  - Losing (the Operator's hull goes down mid-fight) does not reset him: he climbs back into the dark and brands the Operator with
 *    the Ashen Mark. The mark is the only sign he exists; NPCs notice it. It lasts until he falls.
 *  - Winning is once per account: he never returns. It pays the Dragonite set for the winning class, Dragonite, the title
 *    "Sky Sovereign's Equal", and a world-first check (src/routes/api/world-firsts.ts reads every save for the earliest kill).
 * There is no companion, trust, riding, rematch or Covenant ability any more (the Wyrmling system was cut with this).
 * Everything is earnedRewards keys, so the cloud merge unions them and the save schema does not change. Pure rules. */
import type { ClassId, PlayerProgression } from "./progression";
import type { GearItem, GearSlot } from "./inventory";

export const VYRAK = {
  id: "vyrak",
  name: "Vyrak, the Sky Sovereign",
  regionId: "solara",
  minLevel: 12,
  briefing: "Something older than the Fracture has come down out of the dark. Its scale armor turns almost everything — it only opens in the moments after its own attacks, and again when the chest plates crack.",
  tell: "Its wings flare gold before a strafing run, its chest plates glow before they burst, and the whole crater shakes before the roar.",
  phases: [
    { at: 1, name: "Sky Sovereign", telegraph: "Wings flare gold before a strafing fire run" },
    { at: 0.6, name: "Scale Shedding", telegraph: "Chest plates glow and crack — the weak point opens" },
    { at: 0.25, name: "The Trial", telegraph: "Vyrak lands and roars — hold your ground" },
  ],
  intro: [
    { speaker: "Vyrak", text: "Another small thing with a borrowed spark. Show me why the Fracture chose you." },
    { speaker: "NOVA", text: "I have nothing on this. Nothing. Its armor sheds under heat — break the chest plates." },
  ],
} as const;

/* ---------------- the secret conditions ---------------- */
/** metres from the Ribcage lair centre that count as "in the crater" */
export const SOVEREIGN_RADIUS = 45;
/** seconds the conditions must hold, unbroken, before he comes down */
export const SOVEREIGN_DWELL = 12;
/** Scene's nightFactor (0 day … 1 deep night) at or above which it counts as night */
export const SOVEREIGN_NIGHT = 0.6;

export type SovereignConditions = {
  /** distance to the Ribcage lair, metres */
  dist: number;
  /** 0 = full day, 1 = deep night */
  night: number;
  level: number;
  inVehicle: boolean;
  /** no AI squad, no co-op/PvP, no running activity, no other boss alive, no tutorial */
  alone: boolean;
};
export const conditionsMet = (c: SovereignConditions): boolean =>
  c.dist <= SOVEREIGN_RADIUS && c.night >= SOVEREIGN_NIGHT && c.level >= VYRAK.minLevel && !c.inVehicle && c.alone;

export type SovereignWatch = { held: number; called: boolean };
export const createWatch = (): SovereignWatch => ({ held: 0, called: false });
/** Advance the watch. True exactly once, the tick the conditions have held for SOVEREIGN_DWELL; any break resets the count.
 * Once called it stays quiet until the Operator leaves the crater (so a fight that ends does not re-summon on the spot). */
export function stepWatch(w: SovereignWatch, c: SovereignConditions, dt: number, slain: boolean): boolean {
  if (slain) { w.held = 0; return false; }
  if (w.called) { if (c.dist > SOVEREIGN_RADIUS * 2) { w.called = false; w.held = 0; } return false; }
  if (!conditionsMet(c)) { w.held = 0; return false; }
  w.held += Math.max(0, dt);
  if (w.held < SOVEREIGN_DWELL) return false;
  w.called = true; w.held = 0;
  return true;
}

/* ---------------- keys ---------------- */
type Store = Pick<PlayerProgression, "earnedRewards">;
export const SLAIN_KEY = "unique-slain:vyrak";
/** `unique-slain-at:vyrak:<epoch ms>:<CALLSIGN>` — when and by whom, read by the world-first route */
export const SLAIN_AT_PREFIX = "unique-slain-at:vyrak:";
export const MARK_KEY = "ashen-mark:vyrak";
export const TITLE_KEY = "title:sky-sovereigns-equal";
export const TITLE = "Sky Sovereign's Equal";
export const SEEN_FIRST_KEY = "world-first-seen:vyrak";

const has = (p: Store, k: string) => p.earnedRewards.includes(k);
export const isSlain = (p: Store) => has(p, SLAIN_KEY);
/** branded and not yet avenged (keys are never removed — the cloud merge would bring them back — so the mark is derived) */
export const isMarked = (p: Store) => has(p, MARK_KEY) && !isSlain(p);
/** the Operator has met him at least once — only then does anything (journal, title) acknowledge him */
export const hasMet = (p: Store) => isSlain(p) || has(p, MARK_KEY);

export function brandAshenMark<T extends Store>(p: T): { progression: T; branded: boolean } {
  if (isSlain(p) || has(p, MARK_KEY)) return { progression: p, branded: false };
  return { progression: { ...p, earnedRewards: [...p.earnedRewards, MARK_KEY] }, branded: true };
}

const SLOTS: GearSlot[] = ["helmet", "gauntlets", "chest", "legs", "classItem"];
const PIECE_NAME: Record<string, string> = { helmet: "Crest", gauntlets: "Talons", chest: "Heartscale", legs: "Greaves", classItem: "Sovereign Mantle" };
/** the Dragonite set (ids unchanged from the old Covenant so saves that already hold it keep their pieces) */
export const dragoniteGear = (cls: ClassId): GearItem[] => SLOTS.map((slot) => ({
  id: `dragonite-${slot}-${cls.toLowerCase()}`, name: `Dragonite ${PIECE_NAME[slot]}`, slot, power: 300, level: 1, element: "THERMAL",
  rarity: "EXOTIC", setId: "dragons-covenant", source: "A Unique, slain",
}));
export const SLAIN_DRAGONITE = 8;

/** The kill, once per account. Pays the winning class's Dragonite set, Dragonite and the title, and stamps when and by whom. */
export function recordSovereignSlain(p: PlayerProgression, cls: ClassId | null, now: number, callsign: string): { progression: PlayerProgression; slain: boolean } {
  if (isSlain(p)) return { progression: p, slain: false };
  const owned = new Set(p.inventory.map((g) => g.id));
  const gear = cls ? dragoniteGear(cls).filter((g) => !owned.has(g.id)) : [];
  const sign = callsign.trim().toUpperCase().replace(/[^A-Z0-9 _-]/g, "").slice(0, 16) || "OPERATOR";
  return {
    slain: true,
    progression: {
      ...p,
      earnedRewards: [...p.earnedRewards, SLAIN_KEY, `${SLAIN_AT_PREFIX}${Math.floor(now)}:${sign}`, TITLE_KEY],
      inventory: [...p.inventory, ...gear],
      materials: { ...p.materials, dragonite: (p.materials.dragonite ?? 0) + SLAIN_DRAGONITE },
    },
  };
}
/** this save's own kill stamp, if any */
export function slainAt(p: Store): { at: number; callsign: string } | null {
  const k = p.earnedRewards.filter((r) => r.startsWith(SLAIN_AT_PREFIX)).map(parseSlainKey).filter((x): x is { at: number; callsign: string } => !!x).sort((a, b) => a.at - b.at)[0];
  return k ?? null;
}
export function parseSlainKey(k: string): { at: number; callsign: string } | null {
  if (!k.startsWith(SLAIN_AT_PREFIX)) return null;
  const rest = k.slice(SLAIN_AT_PREFIX.length), i = rest.indexOf(":");
  const at = Number(i < 0 ? rest : rest.slice(0, i));
  return Number.isFinite(at) && at > 0 ? { at, callsign: i < 0 ? "OPERATOR" : rest.slice(i + 1) || "OPERATOR" } : null;
}

/* ---------------- the world-first announcement ---------------- */
export type WorldFirst = { callsign: string; at: number } | null;
/** The banner after a kill: the world's first if nobody on record fell him earlier. */
export function worldFirstBanner(first: WorldFirst, mine: { at: number; callsign: string }): string {
  if (!first || first.at >= mine.at) return `WORLD FIRST · ${mine.callsign} has slain a Unique: Vyrak, the Sky Sovereign`;
  return `UNIQUE SLAIN · Vyrak, the Sky Sovereign — the world's first fell to ${first.callsign}`;
}
/** The announcement every other player sees once, on entering the world, after someone somewhere has slain him. */
export function worldAnnouncement(p: Store, first: WorldFirst): string | null {
  if (!first || has(p, SEEN_FIRST_KEY)) return null;
  const mine = slainAt(p);
  if (mine && mine.at <= first.at) return null; // it was you: you already had the banner
  return `WORLD ANNOUNCEMENT · ${first.callsign} has slain a Unique: Vyrak, the Sky Sovereign`;
}
export const markAnnouncementSeen = <T extends Store>(p: T): T => (has(p, SEEN_FIRST_KEY) ? p : { ...p, earnedRewards: [...p.earnedRewards, SEEN_FIRST_KEY] });

/* ---------------- the Ashen Mark ---------------- */
export const BRAND_LINES = [
  "VYRAK: You lived. Carry that, little spark. I will know you when I see you again.",
  "The Sky Sovereign climbs back into the dark. Ash has burned into your armor, and it will not wipe off.",
] as const;
/** what people say when a marked Operator walks past (Scene picks one per NPC, rate-limited) */
export const ASHEN_REMARKS = [
  "That ash on your plates — it's still warm. Where have you been?",
  "Don't stand so close. My grandmother said ash like that comes down from the Glass Flats at night.",
  "You've got the look of someone something let go. Don't push your luck twice.",
  "Old rangers had a word for marks like yours. They didn't say it out loud.",
] as const;
export const ashenRemark = (seed: number) => ASHEN_REMARKS[Math.abs(Math.floor(seed)) % ASHEN_REMARKS.length]!;
export const MARK_REMARK_RADIUS = 6, MARK_REMARK_COOLDOWN = 45;
