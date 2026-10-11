/** Zone story missions for Frostspire (fd-11), Ember Peaks (fd-12/fd-13) and the Wastelands (fd-14),
 * the remaining rows of campaign tracker §8. The Drowned Relay and Solar Array Alpha are bespoke
 * files; these three share one machine shape so the rules live in one place:
 *
 *   IDLE → START → TRIGGERED → ANCHOR → TRAVEL → ARRIVED → COMBAT_1 → CLEAR → HACKING
 *        → HACK 100 → BOSS → CLEAR → COMPLETE → ACK → WORLD_UPDATE
 *
 * Each mission's boss is its region's existing catalog boss (encounters.ts), summoned with
 * summonBoss(region, ..., { mission: true }); each wave is that region's own troops. Every mission
 * has its own story lines and its own minigame (sequence / dial / match), all pure and testable.
 *
 * Story thread (from fd-10's Nexus lockdown to the Fuel King):
 *  - Frostspire · "The Frozen Beacon": the Authority's purge order was relayed from a beacon on the
 *    high passes. Subject Zero, the Authority's first Resonant experiment, was frozen in to guard it.
 *    The re-keyed beacon shows the order came from Ember Peaks, the failure core.
 *  - Ember Peaks · "The Failure Core": Overseer Kael is still running the reactor that failed when the
 *    Fracture began, trying to restart containment. Venting it shows the reactor was never meant to
 *    contain the Fracture: it was feeding it, and the fuel came up the Grid-Iron Highway.
 *  - Wastelands · "Convoy Breaker": the Rust-King Gant runs the fuel convoys for the Rebellion. Breaking
 *    his convoy override shows who buys the fuel: the Fuel King (fd-15). */
export type ZoneMissionId = "frozen-beacon" | "failure-core" | "convoy-breaker";
export type MissionState = "IDLE" | "TRIGGERED" | "TRAVEL" | "COMBAT_1" | "HACKING" | "BOSS" | "COMPLETE" | "WORLD_UPDATE";
export type MissionEvent =
  | { type: "START" }
  | { type: "ANCHOR"; x: number; z: number }
  | { type: "ARRIVED" }
  | { type: "CLEAR" }
  | { type: "HACK"; progress: number }
  | { type: "ACK" };

export type MissionRun = { id: ZoneMissionId; state: MissionState; target: { x: number; z: number } | null; hack: number; nova: string };

export type Minigame = "sequence" | "dial" | "match";

export type ZoneMissionSpec = {
  id: ZoneMissionId;
  title: string;
  regionId: "frostspire" | "ember" | "wastelands";
  /** quest this mission completes alongside its existing objective */
  questId: "fd-11" | "fd-13" | "fd-14";
  /** quest that must be complete before the mission starts (the chapter before this zone) */
  afterQuest: "fd-10" | "fd-12" | "fd-13";
  /** site as an offset from the region centre, in units of its radius */
  site: { dx: number; dz: number };
  accent: string;
  waveSize: number;
  minigame: Minigame;
  hackLabel: string;
  hackHelp: string;
  bossHint: string;
  completeBanner: string;
  completeReward: string;
  ackLabel: string;
  materials: Record<string, number>;
  objective: Record<MissionState, string>;
  nova: Record<Exclude<MissionState, "IDLE">, string>;
};

export const ZONE_MISSIONS: Record<ZoneMissionId, ZoneMissionSpec> = {
  "frozen-beacon": {
    id: "frozen-beacon", title: "The Frozen Beacon", regionId: "frostspire", questId: "fd-11", afterQuest: "fd-10",
    site: { dx: 0.1, dz: 0.15 }, accent: "#9fe4ff", waveSize: 5, minigame: "sequence",
    hackLabel: "Beacon re-key", hackHelp: "Watch the beacon's key pattern, then repeat it.",
    bossHint: "Ice blades fan outward before the lunge. Sidestep, then punish.",
    completeBanner: "Subject Zero down · beacon re-keyed", completeReward: "+ XP shards · Cryo Crystal · the order came from Ember Peaks", ackLabel: "Read the order",
    materials: { cryoCrystal: 2, dataShards: 2 },
    objective: {
      IDLE: "", TRIGGERED: "Find where the purge order came from", TRAVEL: "Climb to the beacon on the high pass",
      COMBAT_1: "Frost-hardened guards: clear the pass", HACKING: "Re-key the frozen beacon", BOSS: "Bring down Subject Zero",
      COMPLETE: "Beacon re-keyed", WORLD_UPDATE: "The order came from Ember Peaks",
    },
    nova: {
      TRIGGERED: "That purge in Nexus didn't start in Nexus. The order was relayed in from the north, from the Frostspire passes.",
      TRAVEL: "There's a relay beacon up on the high pass, iced over but still live. Keep moving. The cold here gets into your head.",
      COMBAT_1: "Guards, frozen into position until something walked in. That's you. Clear them.",
      HACKING: "The beacon's key is scrambled. I'll show you the pattern; you put it back in the right order.",
      BOSS: "Re-keying it cracked the ice around something big. That's Subject Zero, the Authority's first Resonant experiment. They froze it up here to guard this.",
      COMPLETE: "Subject Zero's down. The beacon's open, and it still has the purge order in its buffer.",
      WORLD_UPDATE: "The order wasn't the Authority's. It came up from Ember Peaks, from the reactor where containment failed the first time.",
    },
  },
  "failure-core": {
    id: "failure-core", title: "The Failure Core", regionId: "ember", questId: "fd-13", afterQuest: "fd-12",
    site: { dx: -0.1, dz: 0.15 }, accent: "#ff8a3d", waveSize: 6, minigame: "dial",
    hackLabel: "Reactor venting", hackHelp: "Set each vent valve to the pressure the reactor can hold. A valve locks when it's right.",
    bossHint: "His hammer glows before the shockwave. Get distance when it does.",
    completeBanner: "Overseer Kael down · reactor vented", completeReward: "+ XP shards · Thermal Shards · the fuel came up the highway", ackLabel: "Follow the fuel line",
    materials: { thermalShards: 3, dataShards: 2 },
    objective: {
      IDLE: "", TRIGGERED: "Find the source of the purge order", TRAVEL: "Reach the failed reactor in the caldera",
      COMBAT_1: "Reactor guard drones: clear the caldera", HACKING: "Vent the reactor before it spikes", BOSS: "Bring down Overseer Kael",
      COMPLETE: "Reactor vented", WORLD_UPDATE: "The fuel came up the Grid-Iron Highway",
    },
    nova: {
      TRIGGERED: "The purge order traced back here, to the reactor in the caldera. Something down there is still giving orders.",
      TRAVEL: "The reactor's still running, and it's way past safe. Get to the control ring before it spikes again.",
      COMBAT_1: "Guard drones, still on the original containment protocol. They think you're the breach.",
      HACKING: "Pressure's climbing. Set each vent valve to what the core can hold, or this whole caldera goes.",
      BOSS: "Venting it woke the operator. Overseer Kael. He's been down here since the first failure, trying to restart containment.",
      COMPLETE: "Kael's down. Reactor's stable. And its logs are open.",
      WORLD_UPDATE: "It was never containing the Fracture. It was feeding it. And the fuel came in by convoy, up the Grid-Iron Highway.",
    },
  },
  "convoy-breaker": {
    id: "convoy-breaker", title: "Convoy Breaker", regionId: "wastelands", questId: "fd-14", afterQuest: "fd-13",
    site: { dx: 0.15, dz: 0.2 }, accent: "#d9a35b", waveSize: 6, minigame: "match",
    hackLabel: "Convoy override", hackHelp: "Each lock wants one of four codes. Pick the one whose signature matches.",
    bossHint: "The crane arm locks its landing lane before it drops. Get out of that lane.",
    completeBanner: "Rust-King Gant down · convoy stopped", completeReward: "+ XP shards · Scrap Metal · the buyer is the Fuel King", ackLabel: "Find the buyer",
    materials: { scrapMetal: 4, dataShards: 2 },
    objective: {
      IDLE: "", TRIGGERED: "Follow the fuel line out of Ember", TRAVEL: "Intercept the convoy on the highway",
      COMBAT_1: "Convoy escorts: break them", HACKING: "Crack the convoy override", BOSS: "Bring down the Rust-King Gant",
      COMPLETE: "Convoy stopped", WORLD_UPDATE: "The buyer is the Fuel King",
    },
    nova: {
      TRIGGERED: "The reactor's fuel came in by convoy. There's one running the Grid-Iron Highway right now.",
      TRAVEL: "Convoy's stopped at a junction on the highway. That's your window.",
      COMBAT_1: "Rebellion escorts, running stolen Fracture tech. They're not going to let you near those tankers.",
      HACKING: "The tankers are on an override lock. Match each lock's code to its signature and they're ours.",
      BOSS: "The override was keyed to someone. The Rust-King Gant, and he wants his convoy back.",
      COMPLETE: "Gant's down. The manifests are open.",
      WORLD_UPDATE: "Every tanker was going to one buyer. Not the Rebellion, not the Authority. The Fuel King.",
    },
  },
};

export const ZONE_MISSION_IDS = Object.keys(ZONE_MISSIONS) as ZoneMissionId[];

export const initialRun = (id: ZoneMissionId): MissionRun => ({ id, state: "IDLE", target: null, hack: 0, nova: "" });

export function zoneSite(spec: ZoneMissionSpec, region: { x: number; z: number; radius: number }): { x: number; z: number } {
  return { x: region.x + region.radius * spec.site.dx, z: region.z + region.radius * spec.site.dz };
}

export function advanceMission(m: MissionRun, e: MissionEvent): MissionRun {
  const line = ZONE_MISSIONS[m.id].nova;
  switch (m.state) {
    case "IDLE": return e.type === "START" ? { ...m, state: "TRIGGERED", nova: line.TRIGGERED } : m;
    case "TRIGGERED": return e.type === "ANCHOR" ? { ...m, state: "TRAVEL", target: { x: e.x, z: e.z }, nova: line.TRAVEL } : m;
    case "TRAVEL": return e.type === "ARRIVED" ? { ...m, state: "COMBAT_1", nova: line.COMBAT_1 } : m;
    case "COMBAT_1": return e.type === "CLEAR" ? { ...m, state: "HACKING", nova: line.HACKING } : m;
    case "HACKING":
      if (e.type !== "HACK") return m;
      if (e.progress >= 100) return { ...m, hack: 100, state: "BOSS", nova: line.BOSS };
      return { ...m, hack: e.progress };
    case "BOSS": return e.type === "CLEAR" ? { ...m, state: "COMPLETE", nova: line.COMPLETE } : m;
    case "COMPLETE": return e.type === "ACK" ? { ...m, state: "WORLD_UPDATE", target: null, nova: line.WORLD_UPDATE } : m;
    default: return m;
  }
}

/** Should this zone mission start now? The previous chapter's quest is done and this one's isn't. */
export function zoneMissionReady(id: ZoneMissionId, completed: readonly string[]): boolean {
  const spec = ZONE_MISSIONS[id];
  return completed.includes(spec.afterQuest) && !completed.includes(spec.questId) && !completed.includes(id);
}

const hash = (seed: number, i: number, salt: number) => (Math.imul((seed | 0) ^ Math.imul(i + 1, salt), 0x2c1b3c6d) >>> 0);

/* ---------- sequence: memorize and repeat (Frozen Beacon) ---------- */
export const SEQ_GLYPHS = ["◆", "▲", "●", "■"] as const;
export const SEQ_LENGTH = 5;
export function sequenceFor(seed: number): number[] { return Array.from({ length: SEQ_LENGTH }, (_, i) => hash(seed, i, 0x5bd1e995) % SEQ_GLYPHS.length); }
export type SequenceState = { entered: number };
/** A correct glyph advances; a wrong one restarts the entry (the pattern can be replayed). */
export function enterGlyph(s: SequenceState, seed: number, glyph: number): SequenceState {
  if (s.entered >= SEQ_LENGTH) return s;
  return sequenceFor(seed)[s.entered] === glyph ? { entered: s.entered + 1 } : { entered: 0 };
}
export const sequenceProgress = (s: SequenceState) => Math.round((s.entered / SEQ_LENGTH) * 100);

/* ---------- dial: set each valve to its target (Failure Core) ---------- */
export const DIALS = 3;
export const DIAL_STEPS = 10;
export const dialTarget = (seed: number, i: number) => 2 + (hash(seed, i, 0x7feb352d) % (DIAL_STEPS - 3));
export type DialState = { value: number[]; locked: boolean[] };
export const dialStart = (seed: number): DialState => {
  const idx = Array.from({ length: DIALS }, (_, i) => i);
  return { value: idx.map((i) => (dialTarget(seed, i) + 4) % DIAL_STEPS), locked: idx.map(() => false) };
};
export function turnDial(s: DialState, seed: number, i: number, step: 1 | -1): DialState {
  if (i < 0 || i >= DIALS || s.locked[i]) return s;
  const value = s.value.map((v, k) => (k === i ? Math.max(0, Math.min(DIAL_STEPS - 1, v + step)) : v));
  return { value, locked: s.locked.map((l, k) => (k === i ? value[k] === dialTarget(seed, k) : l)) };
}
export const dialProgress = (s: DialState) => Math.round((s.locked.filter(Boolean).length / DIALS) * 100);

/* ---------- match: pick the code whose signature matches (Convoy Breaker) ---------- */
export const MATCH_LOCKS = 3;
export const MATCH_CODES = ["RK-1", "RK-4", "GT-2", "GT-7"] as const;
export const matchAnswer = (seed: number, lock: number) => hash(seed, lock, 0x68e31da4) % MATCH_CODES.length;
/** The signature shown for a lock: the answer's code with its letters swapped for marks, so it has to be read, not guessed. */
export const matchSignature = (seed: number, lock: number) => MATCH_CODES[matchAnswer(seed, lock)]!.replace(/[A-Z]/g, "▮");
export type MatchState = { locked: boolean[]; misses: number };
export const matchStart = (): MatchState => ({ locked: Array.from({ length: MATCH_LOCKS }, () => false), misses: 0 });
export function pickCode(s: MatchState, seed: number, lock: number, code: number): MatchState {
  if (lock < 0 || lock >= MATCH_LOCKS || s.locked[lock]) return s;
  if (matchAnswer(seed, lock) !== code) return { ...s, misses: s.misses + 1 };
  return { ...s, locked: s.locked.map((l, i) => (i === lock ? true : l)) };
}
export const matchProgress = (s: MatchState) => Math.round((s.locked.filter(Boolean).length / MATCH_LOCKS) * 100);
