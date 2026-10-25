/**
 * Records golden reward states from the web build's real sim.ts defeatMachine, inventory.ts claimDrops and xp.ts
 * grantXP, for the C++ port's test (Plugins/WorldFractureCore/Tests/RewardCoreTest.cpp).
 *
 *   npx esbuild unreal/tools/gen-reward-golden.ts --bundle --platform=node --format=esm \
 *     --alias:@=./src --outfile=/tmp/wf-reward-golden.mjs && node /tmp/wf-reward-golden.mjs
 *
 * Math.random is replaced with a recorder, so every number the web build draws is written to the file and the C++
 * test feeds the same numbers back. Unique Scenario bosses are left out: their claim path is not ported yet.
 *
 * Lines (tab-separated, "~" = absent):
 *   SET id name region element helmet gauntlets chest legs classItem      armor sets, catalog order
 *   POOLE / POOLB id name slot element                                     enemy / boss weapon pools, pool order
 *   C name                                                                 a case
 *   PI id name slot power level element source setId rarity              starting inventory (in order)
 *   PE slot id / PM material amount / PD dungeon count / PC mission        equipped, materials, clears, missions
 *   PX xp level tokens nova / PN unlock                                    account level, NOVA unlocks
 *   S credits kills bossKills eliteKills rivalKills nextDropId combatHeat  starting sim tally
 *   K boss elite decoy mission eq alive hp zone drop profile rival living nemesis credit r1 r2 suffix
 *   T tally                                                                after the kill (DescribeTally)
 *   CLAIM / L loot                                                         claimDrops of all drops (DescribeLoot)
 *   X type enemyLevel combatHeat scale / G gained leveledUp newLevel unlocked / L loot   grantXP per XP event
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
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";
import { CHALLENGES } from "../../src/game/map-activities";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "reward_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
const opt = (v: string | undefined | null) => (v === undefined || v === null || v === "" ? NONE : v);

// --- deterministic generator for the cases themselves (separate from the numbers the game draws) ---
let seed = 0xc0ffee;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

// --- Math.random recorder: the game draws from a queue we fill, and we log what it drew ---
let queue: number[] = [];
let drawn: number[] = [];
Math.random = () => { const v = queue.length ? queue.shift()! : rand(); drawn.push(v); return v; };
/** game rolls skewed low so set and weapon drops happen often enough to test, plus exact edge values */
const gameRoll = () => { const r = rand(); return r < 0.15 ? pick([0, 0.02, 0.019999999999999997, 0.03, 0.08, 0.12, 0.35, 0.6, 1e-7, 0.9999999999999999]) : r < 0.6 ? rand() * 0.4 : rand(); };

// --- the catalog the C++ test needs, rebuilt the way weapon-loot.ts builds its pools ---
const ELEMENT: Record<string, string> = { KINETIC: "KINETIC", PLASMA: "ARC", CRYO: "CRYO", ARC: "ARC", THERMAL: "THERMAL", VOID: "BIO" };
const SLOT_OF = (archetype: string) => (archetype === "HEAVY" ? "heavy" : archetype === "SIDEARM" ? "secondary" : "primary");
const droppable = WEAPON_MANIFEST.filter((w) => w.tier === "T1" || w.tier === "T2" || w.tier === "T3");
const enemyPool = [...droppable, ...catalogFrom("loot")];
const bossPool = [...enemyPool, ...catalogFrom("boss")];

const lines: string[] = [];
for (const s of ARMOR_SETS) lines.push(["SET", s.id, s.name, s.regionId, s.element, ...SET_SLOTS.map((slot) => s.pieces[slot])].join("\t"));
for (const w of enemyPool) lines.push(["POOLE", w.id, w.name, SLOT_OF(w.archetype), ELEMENT[w.element]!].join("\t"));
for (const w of bossPool) lines.push(["POOLB", w.id, w.name, SLOT_OF(w.archetype), ELEMENT[w.element]!].join("\t"));

const gear = (g: GearItem) => `${g.id}|${g.name}|${g.slot}|${n(g.power)}|${n(g.level)}|${g.element}|${g.source}|${g.setId ?? ""}|${g.rarity ?? ""}`;
const numMap = (m: Record<string, number | undefined>) => `{${Object.keys(m).filter((k) => m[k] !== undefined).sort().map((k) => `${k}:${n(m[k]!)}`).join(",")}}`;
const loot = (p: PlayerProgression) => `inventory=[${p.inventory.map(gear).join(";")}];equipped={${Object.keys(p.equippedGear).filter((k) => p.equippedGear[k as keyof typeof p.equippedGear]).sort().map((k) => `${k}:${p.equippedGear[k as keyof typeof p.equippedGear]}`).join(",")}};materials=${numMap(p.materials)};xp=${n(p.xp)};level=${n(p.level)};tokens=${n(p.calibrationTokens)};nova=${n(p.novaLevel)};novaUnlocks=[${p.novaUnlocks.join(",")}]`;

type Sim = ReturnType<typeof createSim>;
const tally = (s: Sim) => `kills=${n(s.kills)};boss=${n(s.bossKills)};elite=${n(s.eliteKills)};rival=${n(s.rivalKills)};credits=${n(s.credits)};nextDrop=${n(s.nextDropId)};materials=${numMap(s.materials as Record<string, number>)};living=${numMap(s.livingKills)};nemesis=[${s.nemesisEvents.map((e) => `${e.id}${e.killed ? ":killed" : ":escaped"}`).join(",")}];drops=[${s.drops.map((d) => `${n(d.id)}/${d.material}/${n(d.amount)}/${d.enemy}/${d.setDrop ? `${d.setDrop.setId}:${d.setDrop.slot}` : ""}/${d.weaponDrop ? gear(d.weaponDrop) : ""}`).join(";")}];xp=[${s.xpEvents.map((x) => `${x.type}/${n(x.enemyLevel)}/${n(x.combatHeat)}`).join(";")}]`;

const regions = [...REGIONS.map((r) => r.id), "nowhere"];
const materials: MaterialId[] = ["scrapMetal", "sporeFiber", "cryoCrystal", "thermalShards", "microCircuits", "magmaCore", "zeroCore", "abyssCore", "aegisCore", "anomalyCore", "vehicleParts", "fractureCore", "dataShards"];
const slots = ["primary", "secondary", "heavy", "helmet", "chest", "gauntlets", "legs", "classItem"] as const;

let kills = 0;
for (let c = 0; c < 140; c++) {
  // a starting save: some set pieces (some at the level cap), some weapons, gear worn, clears and missions
  const inventory: GearItem[] = [];
  for (let i = Math.floor(rand() * 6); i > 0; i--) {
    const set = pick(ARMOR_SETS), slot = pick(SET_SLOTS), level = pick([1, 2, 5, 9, 10]);
    if (inventory.some((g) => g.id === `set-${set.id}-${slot}`)) continue;
    inventory.push({ id: `set-${set.id}-${slot}`, name: set.pieces[slot], slot, power: 95 + 15 * (level - 1), level, element: set.element, source: `${set.name} set`, setId: set.id });
  }
  for (let i = Math.floor(rand() * 4); i > 0; i--) inventory.push({ id: `w${c}-${i}`, name: `Weapon ${i}`, slot: pick(slots), power: pick([90, 135, 190, 260, 340]), level: 1, element: "KINETIC", source: "Starting loadout" });
  if (rand() < 0.3) inventory.push({ id: "boss-magmaCore", name: "Old Relic", slot: "heavy", power: 260, level: 1, element: "THERMAL", source: "Old" });
  const equippedGear: PlayerProgression["equippedGear"] = {};
  for (const g of inventory) if (rand() < 0.6) equippedGear[g.slot] = g.id;
  const p: PlayerProgression = {
    ...DEFAULT_PROGRESSION, inventory, equippedGear,
    materials: Object.fromEntries(materials.filter(() => rand() < 0.3).map((m) => [m, Math.floor(rand() * 20)])),
    dungeonClears: Object.fromEntries(Array.from({ length: Math.floor(rand() * 4) }, (_, i) => [`dungeon-${i}`, 1 + Math.floor(rand() * 5)])),
    completedMissions: Array.from({ length: Math.floor(rand() * 15) }, (_, i) => `m-${i}`),
    xp: Math.floor(rand() * 900), level: 1 + Math.floor(rand() * 12), calibrationTokens: Math.floor(rand() * 5),
    novaLevel: pick([0, 3.5, 9.99, 24.5, 30]), novaUnlocks: rand() < 0.3 ? ["CORRUPTION_CONTROL"] : [],
  };
  lines.push(`C\tcase-${c}`);
  for (const g of p.inventory) lines.push(["PI", g.id, g.name, g.slot, n(g.power), n(g.level), g.element, g.source, opt(g.setId), opt(g.rarity)].join("\t"));
  for (const [slot, id] of Object.entries(p.equippedGear)) if (id) lines.push(["PE", slot, id].join("\t"));
  for (const [m, v] of Object.entries(p.materials)) lines.push(["PM", m, n(v!)].join("\t"));
  for (const [d, v] of Object.entries(p.dungeonClears)) lines.push(["PD", d, n(v)].join("\t"));
  for (const m of p.completedMissions) lines.push(["PC", m].join("\t"));
  lines.push(["PX", n(p.xp), n(p.level), n(p.calibrationTokens), n(p.novaLevel)].join("\t"));
  for (const u of p.novaUnlocks) lines.push(["PN", u].join("\t"));

  const sim = createSim();
  Object.assign(sim, { kills: 0, bossKills: 0, eliteKills: 0, rivalKills: 0, credits: Math.floor(rand() * 500), nextDropId: Math.floor(rand() * 50), combatHeat: pick([0, 10, 24.9, 25, 60, 99]), materials: {}, livingKills: {}, nemesisEvents: [], drops: [], xpEvents: [], foundry: undefined });
  sim.runes = { ...sim.runes, reap: false };
  lines.push(["S", n(sim.credits), n(sim.kills), n(sim.bossKills), n(sim.eliteKills), n(sim.rivalKills), n(sim.nextDropId), n(sim.combatHeat)].join("\t"));

  for (let k = Math.floor(rand() * 8) + 1; k > 0; k--) {
    const m = sim.machines[0]!;
    const boss = rand() < 0.25, elite = !boss && rand() < 0.3;
    const special = rand();
    Object.assign(m, {
      alive: rand() < 0.95, hp: rand() < 0.95 ? pick([0, -1.5]) : 2, boss, elite, zone: pick(regions), drop: pick(materials), profile: pick(["Raider", "Warlord", "Kael", "Drone"]),
      decoy: special < 0.05 ? true : undefined, mission: rand() < 0.1 ? true : undefined, eq: special > 0.92 ? true : undefined,
      rival: special >= 0.05 && special < 0.1 ? pick(["TITAN", "HUNTER", "WARLOCK"]) : undefined,
      living: special >= 0.1 && special < 0.2 ? pick(["riot", "convoy"]) : undefined,
      nemesis: special >= 0.2 && special < 0.27 ? pick(["n1", "n2"]) : undefined,
      scenarioId: undefined, scenarioRun: undefined, playerHits: undefined, encounter: undefined, goreHit: undefined,
    });
    const credit = rand() < 0.2 ? "world" : "player";
    const before = { alive: m.alive, hp: m.hp, decoy: !!m.decoy, rival: m.rival, living: m.living, nemesis: m.nemesis, eq: !!m.eq, mission: !!m.mission };
    queue = [gameRoll(), gameRoll(), rand()]; drawn = [];
    const randomBefore = Math.random; let suffixText = NONE;
    // capture the suffix the web build builds from its third draw
    const realToString = Number.prototype.toString;
    Number.prototype.toString = function (this: number, radix?: number) { const s = realToString.call(this, radix); if (radix === 36) suffixText = s.slice(2, 8); return s; };
    defeatMachine(sim, m, credit);
    Number.prototype.toString = realToString;
    Math.random = randomBefore;
    if (drawn.length !== 0 && drawn.length !== 3) throw new Error(`unexpected draw count ${drawn.length}`);
    lines.push(["K", before.alive ? 1 : 0, boss ? 1 : 0, elite ? 1 : 0, before.decoy ? 1 : 0, before.mission ? 1 : 0, before.eq ? 1 : 0, n(before.hp), m.zone, m.drop, m.profile, opt(before.rival), opt(before.living), opt(before.nemesis), credit,
      drawn.length ? n(drawn[0]!) : NONE, drawn.length ? n(drawn[1]!) : NONE, drawn.length ? suffixText : NONE].join("\t"));
    lines.push(`T\t${tally(sim)}`);
    kills++;
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
console.log(`${ARMOR_SETS.length} sets, ${enemyPool.length}/${bossPool.length} pool weapons, 140 cases, ${kills} kills -> ${OUT}`);
