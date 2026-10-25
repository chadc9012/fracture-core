/**
 * Records golden quest-engine states from the web build's real src/game/quests.ts, for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/QuestCoreTest.cpp) to replay and match exactly.
 *
 * Run from the repo root:
 *   npx esbuild unreal/tools/gen-quest-golden.ts --bundle --platform=node --format=esm \
 *     --alias:@=./src --outfile=/tmp/wf-golden.mjs && node /tmp/wf-golden.mjs
 *
 * Writes Plugins/WorldFractureCore/Tests/quest_golden.txt:
 *   Q id title world shards unlocks next corruption materials   — the quest catalog (then its O lines)
 *   O type key amount                                         — one objective of the quest above
 *   C name / S state                                          — a case and its starting progression
 *   E type world id number  or  F                             — an event (F = finishActiveQuest), then
 *   X state                                                   — the progression the TypeScript engine produced
 * "~" stands for an absent value. States use the same canonical text as wf::quest::ToCanonicalString.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { QUESTS, gameTick, finishActiveQuest, type QuestEvent } from "../../src/game/quests";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "quest_golden.txt");
const NONE = "~";

const num = (n: number) => String(n);
const sorted = <T>(o: Record<string, T> | Partial<Record<string, T>>) => Object.keys(o).sort();

function canonical(p: PlayerProgression): string {
  const progress = sorted(p.questObjectiveProgress).map((k) => `${k}:[${p.questObjectiveProgress[k]!.map(num).join(",")}]`).join(",");
  const flags = sorted(p.worldFlags).filter((k) => p.worldFlags[k] !== undefined).map((k) => `${k}:${p.worldFlags[k] ? "true" : "false"}`).join(",");
  const mats = sorted(p.materials).filter((k) => p.materials[k as keyof typeof p.materials] !== undefined).map((k) => `${k}:${num(p.materials[k as keyof typeof p.materials]!)}`).join(",");
  const dungeon = sorted(p.dungeonClears ?? {}).map((k) => `${k}:${num(p.dungeonClears[k]!)}`).join(",");
  return `active=${p.activeQuestId ?? "null"};completed=[${p.completedMissions.join(",")}];progress={${progress}};unlocked=[${p.unlockedWorlds.join(",")}];flags={${flags}};world=${p.currentWorld};corruption=${num(p.corruptionLevel)};shards=${num(p.fractureShards)};materials={${mats}};dungeon={${dungeon}}`;
}

// Seeded so the golden file is stable between runs.
let seed = 0x5eed1234;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

const quests = Object.values(QUESTS);
const keysOf = (type: string) => [...new Set(quests.flatMap((q) => q.objectives.filter((o) => o.type === type).map((o) => o.key ?? "")))].filter(Boolean);
const worlds = [...new Set([...quests.map((q) => q.world), ...keysOf("KILLS"), ...keysOf("ENTER_WORLD"), ...keysOf("SURVIVE"), "nowhere"])];
const missions = [...keysOf("MISSION_COMPLETE"), ...quests.map((q) => q.id), "unknown-mission"];
const dungeons = [...keysOf("DUNGEON_CLEARED"), "unknown-dungeon"];
const bosses = [...keysOf("BOSS_DEFEATED"), "unknown-boss"];
const tiers = ["MONITORING", "DRONE_TRACKING", "INTERCEPTION", "LOCKDOWN_PURGE"] as const;
const seconds = [0.18, 0.5, 7.25, 30, 61];

/** An event aimed at the active quest most of the time, so long chains actually progress. */
function eventFor(p: PlayerProgression): QuestEvent {
  const q = p.activeQuestId ? QUESTS[p.activeQuestId] : undefined;
  if (q && rand() < 0.7) {
    const o = pick(q.objectives);
    switch (o.type) {
      case "ENTER_WORLD": return { type: "ENTER_WORLD", world: o.key! };
      case "KILLS": return { type: "KILL", world: o.key! };
      case "SURVIVE": return { type: "SURVIVED", world: o.key!, seconds: pick(seconds) };
      case "MISSION_COMPLETE": return { type: "MISSION_COMPLETE", missionId: o.key! };
      case "DUNGEON_CLEARED": return { type: "DUNGEON_CLEARED", dungeonId: o.key! };
      case "BOSS_DEFEATED": return { type: "BOSS_DEFEATED", encounterId: o.key! };
      case "HEAT_LEVEL": return { type: "HEAT_LEVEL", level: Number(o.key ?? 0) + pick([-1, 0, 1]) };
      case "LOCKDOWN_TIER": return { type: "LOCKDOWN_TIER", tier: pick(tiers) };
      case "HACK_COMPLETE": return { type: "HACK_COMPLETE" };
    }
  }
  switch (Math.floor(rand() * 9)) {
    case 0: return { type: "ENTER_WORLD", world: pick(worlds) };
    case 1: return { type: "KILL", world: pick(worlds) };
    case 2: return { type: "SURVIVED", world: pick(worlds), seconds: pick(seconds) };
    case 3: return { type: "MISSION_COMPLETE", missionId: pick(missions) };
    case 4: return { type: "DUNGEON_CLEARED", dungeonId: pick(dungeons) };
    case 5: return { type: "BOSS_DEFEATED", encounterId: pick(bosses) };
    case 6: return { type: "HEAT_LEVEL", level: Math.floor(rand() * 6) };
    case 7: return { type: "LOCKDOWN_TIER", tier: pick(tiers) };
    default: return { type: "HACK_COMPLETE" };
  }
}

function eventLine(e: QuestEvent): string {
  switch (e.type) {
    case "ENTER_WORLD": case "KILL": return `E\t${e.type}\t${e.world}\t${NONE}\t0`;
    case "SURVIVED": return `E\t${e.type}\t${e.world}\t${NONE}\t${num(e.seconds)}`;
    case "MISSION_COMPLETE": return `E\t${e.type}\t${NONE}\t${e.missionId}\t0`;
    case "DUNGEON_CLEARED": return `E\t${e.type}\t${NONE}\t${e.dungeonId}\t0`;
    case "BOSS_DEFEATED": return `E\t${e.type}\t${NONE}\t${e.encounterId}\t0`;
    case "HEAT_LEVEL": return `E\t${e.type}\t${NONE}\t${NONE}\t${num(e.level)}`;
    case "LOCKDOWN_TIER": return `E\t${e.type}\t${NONE}\t${e.tier}\t0`;
    case "HACK_COMPLETE": return `E\t${e.type}\t${NONE}\t${NONE}\t0`;
  }
}

const lines: string[] = [];
for (const q of quests) {
  const mats = Object.entries(q.rewardMaterials).map(([k, v]) => `${k}=${num(v!)}`).join(",");
  lines.push(["Q", q.id, q.title, q.world, num(q.rewardShards), q.unlocksWorld ?? NONE, q.nextQuestId ?? NONE, num(q.corruption), mats || NONE].join("\t"));
  for (const o of q.objectives) lines.push(["O", o.type, o.key ?? NONE, num(o.amount)].join("\t"));
}

const base: PlayerProgression = DEFAULT_PROGRESSION;
const starts: [string, PlayerProgression][] = [
  ["default", base],
  ["no-active-quest", { ...base, activeQuestId: null }],
  ["unknown-active-quest", { ...base, activeQuestId: "fd-99" }],
  ["near-wasteland-threshold", { ...base, corruptionLevel: 44.95 }],
  ["corruption-capped", { ...base, corruptionLevel: 99.5 }],
  ...quests.map((q): [string, PlayerProgression] => [`active-${q.id}`, { ...base, activeQuestId: q.id }]),
];
// Saves where missions/clears already happened before their quest became active (reconcile cascades).
for (let i = 0; i < 12; i++) {
  const completedMissions = [...new Set(Array.from({ length: 1 + Math.floor(rand() * 6) }, () => pick(missions)))];
  const dungeonClears = Object.fromEntries(Array.from({ length: Math.floor(rand() * 3) }, () => [pick([...dungeons, ...bosses]), 1 + Math.floor(rand() * 2)]));
  starts.push([`prefilled-${i}`, { ...base, activeQuestId: pick(quests).id, completedMissions, dungeonClears, materials: { scrapMetal: 3 } }]);
}

let steps = 0;
for (const [name, start] of starts) {
  for (let run = 0; run < 3; run++) {
    lines.push(`C\t${name}#${run}`);
    lines.push(`S\t${canonical(start)}`);
    let p = start;
    for (let step = 0; step < 40; step++) {
      if (rand() < 0.05) { lines.push("F"); p = finishActiveQuest(p); }
      else { const e = eventFor(p); lines.push(eventLine(e)); p = gameTick(p, e); }
      lines.push(`X\t${canonical(p)}`);
      steps++;
    }
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`${quests.length} quests, ${starts.length * 3} cases, ${steps} recorded states -> ${OUT}`);
