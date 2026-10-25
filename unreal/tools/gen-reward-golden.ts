/**
 * Records golden reward states from the web build's real sim.ts defeatMachine, inventory.ts claimDrops and xp.ts
 * grantXP — Unique Scenario bosses, the encounter journal and Vyrak's covenant included — for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/RewardCoreTest.cpp).
 *
 *   npx esbuild unreal/tools/gen-reward-golden.ts --bundle --platform=node --format=esm \
 *     --alias:@=./src --outfile=/tmp/wf-reward-golden.mjs && node /tmp/wf-reward-golden.mjs
 *
 * Math.random, performance.now and Date.now are replaced, so every number the web build draws is written to the file and
 * the C++ test feeds the same numbers back.
 *
 * Lines (tab-separated, "~" = absent). Items are "id|name|slot|power|level|element|source|setId|rarity|perk" (| inside a field never occurs).
 *   SET id name region element helmet gauntlets chest legs classItem      armor sets, catalog order
 *   POOLE / POOLB id name slot element                                     enemy / boss weapon pools, pool order
 *   SCU id rewardCredits                                                   every Unique Scenario
 *   SCL id                                                                 a SCENARIO_LOOT entry
 *   SCG id item / SCC id chance item                                       SCENARIO_LOOT guaranteed / chance entries, in order
 *   CA class abilityId                                                     covenant ability per class
 *   C name / NOW ms                                                        a case and its clock
 *   PI item / PE slot id / PM material amount / PD dungeon count / PC mission / PX xp level tokens nova shards
 *   PN unlock / PCL class / PER key / PAB ability / PRUN key day count last
 *   S credits kills bossKills eliteKills rivalKills nextDropId combatHeat  starting sim tally
 *   K alive boss elite decoy mission eq hp zone drop profile rival living nemesis credit scenarioId run hits elapsed deaths rolls suffix
 *   T tally / CLAIM / L loot / X type enemyLevel combatHeat scale / G gained leveledUp newLevel unlocked
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSim, defeatMachine } from "../../src/game/sim";
import { claimDrops, type GearItem, type MaterialId } from "../../src/game/inventory";
import { grantXP } from "../../src/game/xp";
import { ARMOR_SETS, SET_SLOTS } from "../../src/game/armor-sets";
import { WEAPON_MANIFEST } from "../../src/game/equipment";
import { catalogFrom } from "../../src/game/weapon-catalog";
import { REGIONS } from "../../src/game/world";
import { DEFAULT_PROGRESSION, type ClassId, type PlayerProgression } from "../../src/game/progression";
import { CHALLENGES } from "../../src/game/map-activities";
import { SCENARIO_LOOT } from "../../src/game/scenario-loot";
import { UNIQUE_SCENARIOS } from "../../src/game/unique-scenarios";
import { COVENANT_ABILITY, dragoniteGear } from "../../src/game/dragon-covenant";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "reward_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
const opt = (v: string | undefined | null) => (v === undefined || v === null || v === "" ? NONE : v);

// --- deterministic generator for the cases themselves (separate from the numbers the game draws) ---
let seed = 0xc0ffee;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

// --- the game's clocks and random numbers, recorded ---
let queue: number[] = [];
let drawn: number[] = [];
Math.random = () => { const v = queue.length ? queue.shift()! : rand(); drawn.push(v); return v; };
const PERF_NOW_MS = 1_000_000; // performance.now(): a scenario boss summoned `elapsed` s ago has scenarioT0 = 1000 - elapsed
globalThis.performance.now = () => PERF_NOW_MS;
let nowMs = 0;
Date.now = () => nowMs;
/** game rolls skewed low so set, weapon and scenario chance drops happen often enough to test, plus exact edge values */
const gameRoll = () => { const r = rand(); return r < 0.15 ? pick([0, 0.02, 0.019999999999999997, 0.03, 0.08, 0.12, 0.15, 0.2, 0.25, 0.35, 0.6, 1e-7, 0.9999999999999999]) : r < 0.6 ? rand() * 0.4 : rand(); };

// --- the catalog the C++ test needs, rebuilt the way weapon-loot.ts builds its pools ---
const ELEMENT: Record<string, string> = { KINETIC: "KINETIC", PLASMA: "ARC", CRYO: "CRYO", ARC: "ARC", THERMAL: "THERMAL", VOID: "BIO" };
const SLOT_OF = (archetype: string) => (archetype === "HEAVY" ? "heavy" : archetype === "SIDEARM" ? "secondary" : "primary");
const droppable = WEAPON_MANIFEST.filter((w) => w.tier === "T1" || w.tier === "T2" || w.tier === "T3");
const enemyPool = [...droppable, ...catalogFrom("loot")];
const bossPool = [...enemyPool, ...catalogFrom("boss")];

const gear = (g: GearItem) => `${g.id}|${g.name}|${g.slot}|${n(g.power)}|${n(g.level)}|${g.element}|${g.source}|${g.setId ?? ""}|${g.rarity ?? ""}|${g.perk ?? ""}`;
const lines: string[] = [];
for (const s of ARMOR_SETS) lines.push(["SET", s.id, s.name, s.regionId, s.element, ...SET_SLOTS.map((slot) => s.pieces[slot])].join("\t"));
for (const w of enemyPool) lines.push(["POOLE", w.id, w.name, SLOT_OF(w.archetype), ELEMENT[w.element]!].join("\t"));
for (const w of bossPool) lines.push(["POOLB", w.id, w.name, SLOT_OF(w.archetype), ELEMENT[w.element]!].join("\t"));
for (const s of UNIQUE_SCENARIOS) lines.push(["SCU", s.id, n(s.rewardCredits)].join("\t"));
for (const [id, entry] of Object.entries(SCENARIO_LOOT)) {
  lines.push(["SCL", id].join("\t")); // the entry exists even when it lists no items (Vyrak pays through the covenant)
  for (const g of entry.guaranteed) lines.push(["SCG", id, gear(g)].join("\t"));
  for (const c of entry.chance) lines.push(["SCC", id, n(c.chance), gear(c.item)].join("\t"));
}
for (const [cls, a] of Object.entries(COVENANT_ABILITY)) lines.push(["CA", cls, a.id].join("\t"));

const numMap = (m: Record<string, number | undefined>) => `{${Object.keys(m).filter((k) => m[k] !== undefined).sort().map((k) => `${k}:${n(m[k]!)}`).join(",")}}`;
const loot = (p: PlayerProgression) => `inventory=[${p.inventory.map(gear).join(";")}];equipped={${Object.keys(p.equippedGear).filter((k) => p.equippedGear[k as keyof typeof p.equippedGear]).sort().map((k) => `${k}:${p.equippedGear[k as keyof typeof p.equippedGear]}`).join(",")}};materials=${numMap(p.materials)};xp=${n(p.xp)};level=${n(p.level)};tokens=${n(p.calibrationTokens)};nova=${n(p.novaLevel)};novaUnlocks=[${p.novaUnlocks.join(",")}]`
  + `;shards=${n(p.fractureShards)};earned=[${p.earnedRewards.join(",")}];abilities=[${p.unlockedAbilities.join(",")}];runs={${Object.keys(p.missionRuns).sort().map((k) => { const r = p.missionRuns[k]!; return `${k}:${r.day}/${n(r.count)}/${r.last === undefined ? "~" : n(r.last)}`; }).join(",")}}`;

type Sim = ReturnType<typeof createSim>;
const claimText = (c: NonNullable<Sim["drops"][number]["scenarioClaim"]>) => `/claim:${c.scenarioId}:${c.runId}:${c.participated ? 1 : 0}:${c.rolls.map(n).join(",")}:${c.elapsed === undefined ? "~" : n(c.elapsed)}:${c.deaths === undefined ? "~" : n(c.deaths)}`;
const tally = (s: Sim) => `kills=${n(s.kills)};boss=${n(s.bossKills)};elite=${n(s.eliteKills)};rival=${n(s.rivalKills)};credits=${n(s.credits)};nextDrop=${n(s.nextDropId)};materials=${numMap(s.materials as Record<string, number>)};living=${numMap(s.livingKills)};nemesis=[${s.nemesisEvents.map((e) => `${e.id}${e.killed ? ":killed" : ":escaped"}`).join(",")}];drops=[${s.drops.map((d) => `${n(d.id)}/${d.material}/${n(d.amount)}/${d.enemy}/${d.setDrop ? `${d.setDrop.setId}:${d.setDrop.slot}` : ""}/${d.weaponDrop ? gear(d.weaponDrop) : ""}${d.scenarioClaim ? claimText(d.scenarioClaim) : ""}`).join(";")}];xp=[${s.xpEvents.map((x) => `${x.type}/${n(x.enemyLevel)}/${n(x.combatHeat)}`).join(";")}]`;

const regions = [...REGIONS.map((r) => r.id), "nowhere"];
const materials: MaterialId[] = ["scrapMetal", "sporeFiber", "cryoCrystal", "thermalShards", "microCircuits", "magmaCore", "zeroCore", "abyssCore", "aegisCore", "anomalyCore", "vehicleParts", "fractureCore", "dataShards", "dragonite"];
const slots = ["primary", "secondary", "heavy", "helmet", "chest", "gauntlets", "legs", "classItem"] as const;
const classes: (ClassId | null)[] = ["TITAN", "HUNTER", "WARLOCK", null];
const scenarioIds = [...UNIQUE_SCENARIOS.map((s) => s.id), "vyrak", "vyrak", "vyrak", "vyrak", "vyrak", "vyrak", "dark-knight", "unknown-scenario"];
const lootItems = Object.values(SCENARIO_LOOT).flatMap((e) => [...e.guaranteed, ...e.chance.map((c) => c.item)]);

let kills = 0, scenarioKills = 0;
const CASES = 220;
for (let c = 0; c < CASES; c++) {
  nowMs = Date.UTC(2026, pick([0, 1, 9, 11]), 1 + Math.floor(rand() * 28), Math.floor(rand() * 24)) + Math.floor(rand() * 3_600_000);
  const cls = pick(classes);
  const inventory: GearItem[] = [];
  for (let i = Math.floor(rand() * 6); i > 0; i--) {
    const set = pick(ARMOR_SETS), slot = pick(SET_SLOTS), level = pick([1, 2, 5, 9, 10]);
    if (inventory.some((g) => g.id === `set-${set.id}-${slot}`)) continue;
    inventory.push({ id: `set-${set.id}-${slot}`, name: set.pieces[slot], slot, power: 95 + 15 * (level - 1), level, element: set.element, source: `${set.name} set`, setId: set.id });
  }
  for (let i = Math.floor(rand() * 4); i > 0; i--) inventory.push({ id: `w${c}-${i}`, name: `Weapon ${i}`, slot: pick(slots), power: pick([90, 135, 190, 260, 340]), level: 1, element: "KINETIC", source: "Starting loadout" });
  if (rand() < 0.3) inventory.push({ id: "boss-magmaCore", name: "Old Relic", slot: "heavy", power: 260, level: 1, element: "THERMAL", source: "Old" });
  // scenario loot already owned, at every level including the cap (duplicates level, then turn into shards)
  for (let i = Math.floor(rand() * 4); i > 0; i--) {
    const item = pick(lootItems), level = pick([1, 4, 9, 10]);
    if (!inventory.some((g) => g.id === item.id)) inventory.push({ ...item, level, power: item.power + 15 * (level - 1) });
  }
  const earnedRewards: string[] = [];
  const pastRuns = Array.from({ length: 3 }, (_, i) => `run-${c}-old-${i}`);
  if (rand() < 0.4) earnedRewards.push(`scenario-run:${pick(pastRuns)}`);
  for (const k of classes) if (k && rand() < (k === cls ? 0.6 : 0.3)) earnedRewards.push(`covenant:vyrak:${k}`);
  if (cls && rand() < 0.5) for (let i = 1 + Math.floor(rand() * 5); i > 0; i--) earnedRewards.push(`covenant-clear:${cls}:${i}`);
  if (cls && rand() < 0.3) earnedRewards.push(`covenant-run:${cls}:${pick(pastRuns)}`);
  if (cls && rand() < 0.2) earnedRewards.push(`covenant-challenge:${cls}:unbroken-covenant`);
  if (cls && rand() < 0.3) earnedRewards.push(`enc-done:${cls}:${pick(UNIQUE_SCENARIOS).id}`);
  if (rand() < 0.3) earnedRewards.push(`enc-found:${pick(UNIQUE_SCENARIOS).id}`);
  if (cls && earnedRewards.includes(`covenant:vyrak:${cls}`) && rand() < 0.5) inventory.push(...dragoniteGear(cls).slice(0, 2));
  const equippedGear: PlayerProgression["equippedGear"] = {};
  for (const g of inventory) if (rand() < 0.6) equippedGear[g.slot] = g.id;
  const missionRuns: PlayerProgression["missionRuns"] = rand() < 0.3 ? { "act:vyrak-rematch": { day: "2026-03-04", count: pick([0, 1, 2]), ...(rand() < 0.5 ? { last: nowMs - 7_200_000 } : {}) } } : {};
  const p: PlayerProgression = {
    ...DEFAULT_PROGRESSION, inventory, equippedGear, identityClass: cls, earnedRewards, missionRuns,
    unlockedAbilities: rand() < 0.3 && cls ? [COVENANT_ABILITY[cls].id] : [],
    fractureShards: Math.floor(rand() * 500),
    materials: Object.fromEntries(materials.filter(() => rand() < 0.3).map((m) => [m, Math.floor(rand() * 20)])),
    dungeonClears: Object.fromEntries(Array.from({ length: Math.floor(rand() * 4) }, (_, i) => [`dungeon-${i}`, 1 + Math.floor(rand() * 5)])),
    completedMissions: Array.from({ length: Math.floor(rand() * 15) }, (_, i) => `m-${i}`),
    xp: Math.floor(rand() * 900), level: 1 + Math.floor(rand() * 12), calibrationTokens: Math.floor(rand() * 5),
    novaLevel: pick([0, 3.5, 9.99, 24.5, 30]), novaUnlocks: rand() < 0.3 ? ["CORRUPTION_CONTROL"] : [],
  };
  lines.push(`C\tcase-${c}`, `NOW\t${n(nowMs)}`);
  for (const g of p.inventory) lines.push(["PI", gear(g)].join("\t"));
  for (const [slot, id] of Object.entries(p.equippedGear)) if (id) lines.push(["PE", slot, id].join("\t"));
  for (const [m, v] of Object.entries(p.materials)) lines.push(["PM", m, n(v!)].join("\t"));
  for (const [d, v] of Object.entries(p.dungeonClears)) lines.push(["PD", d, n(v)].join("\t"));
  for (const m of p.completedMissions) lines.push(["PC", m].join("\t"));
  lines.push(["PX", n(p.xp), n(p.level), n(p.calibrationTokens), n(p.novaLevel), n(p.fractureShards)].join("\t"));
  for (const u of p.novaUnlocks) lines.push(["PN", u].join("\t"));
  if (p.identityClass) lines.push(["PCL", p.identityClass].join("\t"));
  for (const k of p.earnedRewards) lines.push(["PER", k].join("\t"));
  for (const a of p.unlockedAbilities) lines.push(["PAB", a].join("\t"));
  for (const [k, r] of Object.entries(p.missionRuns)) lines.push(["PRUN", k, r.day, n(r.count), r.last === undefined ? NONE : n(r.last)].join("\t"));

  const sim = createSim();
  Object.assign(sim, { kills: 0, bossKills: 0, eliteKills: 0, rivalKills: 0, credits: Math.floor(rand() * 500), nextDropId: Math.floor(rand() * 50), combatHeat: pick([0, 10, 24.9, 25, 60, 99]), materials: {}, livingKills: {}, nemesisEvents: [], drops: [], xpEvents: [], foundry: undefined, deaths: 5 });
  sim.runes = { ...sim.runes, reap: false };
  lines.push(["S", n(sim.credits), n(sim.kills), n(sim.bossKills), n(sim.eliteKills), n(sim.rivalKills), n(sim.nextDropId), n(sim.combatHeat)].join("\t"));

  for (let k = Math.floor(rand() * 6) + 1; k > 0; k--) {
    const m = sim.machines[0]!;
    const scenario = rand() < 0.4;
    const boss = scenario || rand() < 0.25, elite = !boss && rand() < 0.3;
    const special = scenario ? 0.5 : rand();
    const scenarioId = scenario ? pick(scenarioIds) : undefined;
    const elapsed = scenario && rand() < 0.8 ? pick([30, 299, 300, 300.5, 900]) : undefined;
    const deaths = scenario && rand() < 0.8 ? pick([0, 0, 1, 3]) : undefined;
    Object.assign(m, {
      alive: rand() < 0.95, hp: rand() < 0.95 ? pick([0, -1.5]) : 2, boss, elite, zone: pick(regions), drop: pick(materials), profile: pick(["Raider", "Warlord", "Kael", "Drone", "Vyrak"]),
      decoy: special < 0.05 ? true : undefined, mission: rand() < 0.1 ? true : undefined, eq: special > 0.92 ? true : undefined,
      rival: special >= 0.05 && special < 0.1 ? pick(["TITAN", "HUNTER", "WARLOCK"]) : undefined,
      living: special >= 0.1 && special < 0.2 ? pick(["riot", "convoy"]) : undefined,
      nemesis: special >= 0.2 && special < 0.27 ? pick(["n1", "n2"]) : undefined,
      scenarioId, scenarioRun: scenario ? (rand() < 0.85 ? pick([...pastRuns, `run-${c}-${k}`, `run-${c}-${k}`]) : undefined) : undefined,
      playerHits: scenario ? pick([0, 4, 5, 9, 9]) : undefined,
      scenarioT0: elapsed === undefined ? undefined : PERF_NOW_MS / 1000 - elapsed,
      scenarioDeaths0: deaths === undefined ? undefined : sim.deaths - deaths,
      encounter: undefined, goreHit: undefined,
    });
    const credit = rand() < 0.2 ? "world" : "player";
    const before = { alive: m.alive, hp: m.hp, decoy: !!m.decoy, rival: m.rival, living: m.living, nemesis: m.nemesis, eq: !!m.eq, mission: !!m.mission, scenarioId: m.scenarioId, run: m.scenarioRun, hits: m.playerHits };
    queue = Array.from({ length: 6 }, gameRoll).concat([rand(), rand()]); drawn = [];
    let suffixText = NONE;
    const realToString = Number.prototype.toString;
    Number.prototype.toString = function (this: number, radix?: number) { const s = realToString.call(this, radix); if (radix === 36) suffixText = s.slice(2, 8); return s; };
    defeatMachine(sim, m, credit);
    Number.prototype.toString = realToString;
    // the last draw built the weapon-drop id suffix; the others are rolls the C++ replays in order
    const rolls = suffixText === NONE ? drawn : drawn.slice(0, -1);
    lines.push(["K", before.alive ? 1 : 0, boss ? 1 : 0, elite ? 1 : 0, before.decoy ? 1 : 0, before.mission ? 1 : 0, before.eq ? 1 : 0, n(before.hp), m.zone, m.drop, m.profile, opt(before.rival), opt(before.living), opt(before.nemesis), credit,
      opt(before.scenarioId), opt(before.run), before.hits === undefined ? "0" : n(before.hits), elapsed === undefined ? NONE : n(elapsed), deaths === undefined ? NONE : n(deaths),
      rolls.length ? rolls.map(n).join(",") : NONE, suffixText].join("\t"));
    lines.push(`T\t${tally(sim)}`);
    kills++;
    if (scenario) scenarioKills++;
  }

  const claimed = claimDrops(p, sim.drops);
  lines.push("CLAIM", `L\t${loot(claimed)}`);
  let q = claimed;
  for (const x of sim.xpEvents) {
    const scale = CHALLENGES[pick(["STANDARD", "HARD", "VERY_HARD"] as const)].reward;
    const r = grantXP(q, x.type, { enemyLevel: x.enemyLevel, combatHeat: x.combatHeat, scale });
    q = r.progression;
    lines.push(["X", x.type, n(x.enemyLevel), n(x.combatHeat), n(scale)].join("\t"));
    lines.push(["G", n(r.gained), r.leveledUp ? 1 : 0, n(r.newLevel), r.novaUnlocked.join(",") || NONE].join("\t"));
    lines.push(`L\t${loot(q)}`);
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`${ARMOR_SETS.length} sets, ${enemyPool.length}/${bossPool.length} pool weapons, ${UNIQUE_SCENARIOS.length} scenarios, ${CASES} cases, ${kills} kills (${scenarioKills} scenario) -> ${OUT}`);
