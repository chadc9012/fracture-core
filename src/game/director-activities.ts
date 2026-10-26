/** Dungeon and raid nodes on the Director's destination map, laid out the way Destiny's destination map shows them: a small
 * framed node beside the destination it belongs to, a hover card, and a full launch screen. Pure data + status; the screen
 * is in DestinationMap.tsx. Dungeons launch straight into their descent (descent-runtime.ts `launch`); the raid launches
 * its off-map instance (raid-instances.ts) — neither can be started by walking up to it except a dungeon's own world gate. */
import { RANKS, SIGNATURE_DUNGEONS, buildDescent, dayOf, gatesForDay, shownDepth, type FractureGate, type RiftRank, type SignatureDungeon } from "./fracture-gates";
import { CHAMPION_NAME, LIVES, clearedTodayKey, sealKey, tierPlan, type ChampionType, type Seal } from "./descent-run";
import { RAID_INSTANCES, raidArrival, type RaidInstance } from "./raid-instances";
import { HOLLOW_STAR, HOLLOW_STAR_ID } from "./hollow-star-data";
import { RAID_VARIANTS, STARBREAKER_KEY } from "./hollow-star-raid";
import { DESTINATION_PINS, STAGE, destinationInfo, type DestinationId } from "./destination-map";
import { thalassiaElevator } from "./travel";
import type { PlayerProgression } from "./progression";

export type MapNodeKind = "DUNGEON" | "RAID";
export type MapNode = {
  /** `dungeon:<id>` / `raid:<id>` */
  id: string;
  kind: MapNodeKind;
  refId: string;
  destination: DestinationId;
  /** node centre in destination-map stage pixels (1536×1024) */
  at: { x: number; y: number };
  /** hero art file in src/assets/activities */
  art: string;
};

/** which destination each signature dungeon hangs off */
export const DUNGEON_DESTINATION: Record<string, DestinationId> = {
  "rootbound-labyrinth": "veridan", "drowned-cathedral": "swamps", "tomb-hollow-sun": "solara", "iron-grave": "wastelands",
  "eternal-whiteout": "frostspire", "crucible-fallen": "ember", "sublevel-protocol": "neon-city", "forgotten-foundation": "nexus",
  "abyssal-vault": "thalassia",
};
/** hand-placed on the painted planet: on the terrain the dungeon lives in, clear of the painted labels and the screen chrome */
const DUNGEON_AT: Record<string, { x: number; y: number }> = {
  "rootbound-labyrinth": { x: 562, y: 486 }, "drowned-cathedral": { x: 430, y: 682 }, "tomb-hollow-sun": { x: 1166, y: 770 },
  "iron-grave": { x: 1408, y: 326 }, "eternal-whiteout": { x: 770, y: 120 }, "crucible-fallen": { x: 1024, y: 116 },
  "sublevel-protocol": { x: 790, y: 604 }, "forgotten-foundation": { x: 1004, y: 404 }, "abyssal-vault": { x: 454, y: 590 },
};
const RAID_AT: Record<string, { x: number; y: number }> = { [HOLLOW_STAR_ID]: { x: 868, y: 196 } };
const RAID_DESTINATION: Record<string, DestinationId> = { [HOLLOW_STAR_ID]: "nexus" };

export const MAP_NODES: readonly MapNode[] = [
  ...SIGNATURE_DUNGEONS.map((d): MapNode => ({ id: `dungeon:${d.id}`, kind: "DUNGEON", refId: d.id, destination: DUNGEON_DESTINATION[d.id]!, at: DUNGEON_AT[d.id]!, art: `hero-${d.id}.jpg` })),
  ...RAID_INSTANCES.map((r): MapNode => ({ id: `raid:${r.id}`, kind: "RAID", refId: r.id, destination: RAID_DESTINATION[r.id] ?? "nexus", at: RAID_AT[r.id] ?? { x: 868, y: 232 }, art: `hero-${r.id}.jpg` })),
];
/** node hit radius in stage pixels (raids draw larger) */
export const nodeRadius = (n: MapNode) => (n.kind === "RAID" ? 30 : 21);
export const nodesFor = (dest: DestinationId) => MAP_NODES.filter((n) => n.destination === dest);

/* ---------------- dungeon status + briefing ---------------- */

/** the gate a map launch enters: today's world gate when the dungeon has one, otherwise a gate made for it at its board rank */
export function launchGate(dungeonId: string, now: number): FractureGate | null {
  const d = SIGNATURE_DUNGEONS.find((x) => x.id === dungeonId);
  if (!d) return null;
  const today = gatesForDay(now).find((g) => g.dungeonId === dungeonId);
  if (today) return today;
  const day = dayOf(now);
  return { id: `${d.id}:${day}`, dungeonId: d.id, day, x: 0, z: 0, y: 0, shownRank: d.rank, trueRank: d.rank, sealed: d.sealed };
}

export type DungeonBrief = {
  dungeon: SignatureDungeon;
  gate: FractureGate;
  /** today's gate sits in the world as well (you can walk in) */
  worldGate: boolean;
  rank: RiftRank;
  /** depth the gate reads, metres */
  depth: number;
  floors: number;
  encounters: number;
  champions: ChampionType[];
  lives: number;
  enrage: number;
  clearedToday: boolean;
  seals: Seal[];
  /** gate opens after the evening break if left alone */
  modifiers: { id: string; label: string; detail: string; tone: "info" | "warn" | "danger" }[];
  rewards: { id: string; label: string; detail: string; earned: boolean }[];
};

const SEALS: readonly Seal[] = ["FLAWLESS", "SOLO", "SOLO_FLAWLESS"];
const SEAL_LABEL: Record<Seal, string> = { FLAWLESS: "Flawless", SOLO: "Solo", SOLO_FLAWLESS: "Solo Flawless" };

export function dungeonBrief(p: Pick<PlayerProgression, "earnedRewards">, dungeonId: string, now: number): DungeonBrief | null {
  const d = SIGNATURE_DUNGEONS.find((x) => x.id === dungeonId);
  const gate = launchGate(dungeonId, now);
  if (!d || !gate) return null;
  const rank = gate.shownRank;
  const layout = buildDescent(d.id, rank, undefined, gate.id);
  const champions = [...new Set(layout.tiers.flatMap((t) => tierPlan(t, rank).waves.flatMap((w) => w.champions)))];
  const earned = new Set(p.earnedRewards);
  const seals = SEALS.filter((s) => earned.has(sealKey(d.id, s)));
  const clearedToday = earned.has(clearedTodayKey(d.id, gate.day));
  const modifiers: DungeonBrief["modifiers"] = [
    ...champions.map((c) => ({ id: `champ-${c}`, label: CHAMPION_NAME[c], detail: "Champions shrug off normal fire; break them with the matching counter.", tone: "warn" as const })),
    { id: "lives", label: `Shared lives · ${LIVES(1)}`, detail: "Every death spends one; out of lives before the boss falls, the descent fails.", tone: "info" },
    { id: "collapse", label: `Collapse · ${Math.round(RANKS[rank].enrage / 60)} min`, detail: "Once the boss wakes, the descent collapses if it is still standing when the timer runs out.", tone: "danger" },
    ...(gate.sealed ? [{ id: "sealed", label: "Sealed", detail: "The entrance closes behind you. The only way out is the boss room.", tone: "danger" as const }] : []),
    { id: "boss", label: d.boss, detail: d.bossMechanic, tone: "warn" },
  ];
  const rewards: DungeonBrief["rewards"] = [
    { id: "chests", label: "Encounter chests", detail: "One per encounter floor, once a week.", earned: false },
    { id: "clear", label: "Boss clear", detail: "Clear loot and contract pay, once a day.", earned: clearedToday },
    ...SEALS.map((s) => ({ id: `seal-${s}`, label: `${SEAL_LABEL[s]} seal`, detail: s === "FLAWLESS" ? "Clear without spending a life." : s === "SOLO" ? "Clear it alone." : "Alone, without a death.", earned: seals.includes(s) })),
  ];
  return {
    dungeon: d, gate, worldGate: gate.x !== 0 || gate.z !== 0, rank, depth: shownDepth(d.id, rank), floors: layout.tiers.length,
    encounters: RANKS[rank].encounters, champions, lives: LIVES(1), enrage: RANKS[rank].enrage, clearedToday, seals, modifiers, rewards,
  };
}

/* ---------------- raid briefing ---------------- */

export type RaidBrief = {
  raid: RaidInstance;
  encounters: { id: string; name: string; room: string }[];
  boss: string;
  fireteam: number;
  challengeFireteam: number;
  duration: string;
  cleared: boolean;
  starbreaker: boolean;
  identity: string;
  reward: string;
};

export function raidBrief(p: Pick<PlayerProgression, "earnedRewards" | "dungeonClears">, raidId: string): RaidBrief | null {
  const raid = RAID_INSTANCES.find((r) => r.id === raidId);
  if (!raid) return null;
  const def = HOLLOW_STAR; // the only raid; a second raid adds its own definition here
  return {
    raid, encounters: def.stages.map((s) => ({ id: s.id, name: s.name, room: s.room ?? "" })), boss: def.boss, fireteam: RAID_VARIANTS.STANDARD.party,
    challengeFireteam: RAID_VARIANTS.CHALLENGE.party, duration: def.duration, cleared: (p.dungeonClears?.[raidId] ?? 0) > 0,
    starbreaker: p.earnedRewards.includes(STARBREAKER_KEY), identity: def.identity, reward: def.signature.name,
  };
}

/** the deploy target the map's raid node launches (the same one the Raid tab uses) */
export const raidDeploy = (raid: RaidInstance) => {
  const a = raidArrival(raid);
  return { id: `raid:${raid.id}`, name: raid.name, sub: `Raid · ${raid.entrance}`, color: "#a970ff", x: a.x, z: a.z };
};

/** the deploy target a dungeon node launches: travel to the dungeon's gate (or its destination when it has none), then the
 * descent starts on arrival (GameCanvas reads the `dungeon:` id) */
export function dungeonDeploy(dungeonId: string, now: number) {
  const d = SIGNATURE_DUNGEONS.find((x) => x.id === dungeonId);
  const gate = launchGate(dungeonId, now);
  if (!d || !gate) return null;
  const dest = destinationInfo(DUNGEON_DESTINATION[d.id]!);
  const worldGate = gate.x !== 0 || gate.z !== 0;
  // stand just off the gate's trigger so the walk-in gate does not fire first
  // a submerged destination (Thalassia) is entered from the elevator pier on the Verdant shore: you come back out on dry land
  const at = worldGate ? { x: gate.x, z: gate.z + 18 } : dest.drop.y !== undefined ? { ...thalassiaElevator().pier } : { x: dest.drop.x, z: dest.drop.z };
  return { id: `dungeon:${d.id}`, name: d.name, sub: `Dungeon · ${d.place}`, color: "#5ee7ff", ...at };
}

export const insideStage = (n: MapNode) => n.at.x - nodeRadius(n) >= 0 && n.at.y - nodeRadius(n) >= 0 && n.at.x + nodeRadius(n) <= STAGE.w && n.at.y + nodeRadius(n) <= STAGE.h;
export const pinLabels = () => DESTINATION_PINS.map((p) => p.label);
