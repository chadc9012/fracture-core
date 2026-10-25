/**
 * Records golden mission payouts from the web build's real progression.ts rewardMission and missions/persistence.ts
 * applyMissionCompletion for the C++ port's test (Plugins/WorldFractureCore/Tests/MissionRewardCoreTest.cpp).
 *
 *   npx esbuild unreal/tools/gen-missionreward-golden.ts --bundle --platform=node --format=esm \
 *     --alias:@=./src --outfile=/tmp/wf-mr-golden.mjs && node /tmp/wf-mr-golden.mjs
 *
 * applyMissionCompletion ends with the quest tick (quests.ts gameTick, golden-tested on its own); the file records the
 * payout before that tick and the quest event it fires, which is what the C++ ApplyMissionCompletion returns.
 *
 * Lines (tab-separated, "~" = absent). Items are "id|name|slot|power|level|element|source|setId|rarity|perk".
 *   SET id name region element helmet gauntlets chest legs classItem     armor sets (regional and collections)
 *   CP id name slot element                                              completion-weapon pool, in order
 *   CAMP missionId                                                       campaign order
 *   EXO missionId weaponId name slot element source                      campaign exotics
 *   COLL setId sources                                                   collections in order, sources comma-joined
 *   STORY missionId / COMP missionId eventType eventId materials         story missions / mission-machine payouts
 *   C name / PI item / PE slot id / PM material amount / PC mission / PX xp level tokens nova shards / PN unlock
 *   PRUN key day count last / PNEX key amount
 *   R missionId nowMs materials    rewardMission;            then  L state
 *   A missionId nowMs              applyMissionCompletion;   then  E paid eventType eventId, L state
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { rewardMission, DEFAULT_PROGRESSION, STORY_MISSIONS, type PlayerProgression } from "../../src/game/progression";
import { COMPLETION, MISSION_IDS, type MissionId } from "../../src/game/missions/persistence";
import { ARMOR_SETS, SET_SLOTS } from "../../src/game/armor-sets";
import { COLLECTIONS } from "../../src/game/armor-collections";
import { WEAPON_MANIFEST } from "../../src/game/equipment";
import { campaignExotic, completionWeapon, missionWeaponPower } from "../../src/game/weapon-loot";
import type { GearItem, MaterialId } from "../../src/game/inventory";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "missionreward_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0x5eed42;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
Math.random = () => { throw new Error("rewardMission must not draw random numbers"); };

const ELEMENT: Record<string, string> = { KINETIC: "KINETIC", PLASMA: "ARC", CRYO: "CRYO", ARC: "ARC", THERMAL: "THERMAL", VOID: "BIO" };
const SLOT_OF = (archetype: string) => (archetype === "HEAVY" ? "heavy" : archetype === "SIDEARM" ? "secondary" : "primary");
const DROPPABLE = WEAPON_MANIFEST.filter((w) => w.tier === "T1" || w.tier === "T2" || w.tier === "T3");
const gear = (g: GearItem) => `${g.id}|${g.name}|${g.slot}|${n(g.power)}|${n(g.level)}|${g.element}|${g.source}|${g.setId ?? ""}|${g.rarity ?? ""}|${g.perk ?? ""}`;
const numMap = (m: Record<string, number | undefined>) => `{${Object.keys(m).filter((k) => m[k] !== undefined).sort().map((k) => `${k}:${n(m[k]!)}`).join(",")}}`;
const matText = (m: Record<string, number | undefined>) => Object.keys(m).filter((k) => m[k] !== undefined).map((k) => `${k}:${n(m[k]!)}`).join(",") || NONE;

const lines: string[] = [];
for (const s of ARMOR_SETS) lines.push(["SET", s.id, s.name, s.regionId, s.element, ...SET_SLOTS.map((slot) => s.pieces[slot])].join("\t"));
for (const w of DROPPABLE) lines.push(["CP", w.id, w.name, SLOT_OF(w.archetype), ELEMENT[w.element]!].join("\t"));
MISSION_IDS.forEach((id, i) => { if (missionWeaponPower(id) !== 140 + 17 * i) throw new Error(`campaign order changed at ${id}`); lines.push(["CAMP", id].join("\t")); });
const EXOTIC_PREFIX = "Exotic · ";
for (const id of MISSION_IDS) {
  const e = campaignExotic(id);
  if (!e) continue;
  if (!e.source.startsWith(EXOTIC_PREFIX) || !e.id.startsWith("exotic:")) throw new Error(`exotic shape changed: ${e.id}`);
  lines.push(["EXO", id, e.id.slice("exotic:".length), e.name, e.slot, e.element, e.source.slice(EXOTIC_PREFIX.length)].join("\t"));
}
for (const c of COLLECTIONS) lines.push(["COLL", c.id, c.sources.join(",")].join("\t"));
for (const id of STORY_MISSIONS) lines.push(["STORY", id].join("\t"));
for (const id of MISSION_IDS) {
  const c = COMPLETION[id];
  const eventId = c.event.type === "MISSION_COMPLETE" ? (c.event as { missionId: string }).missionId : (c.event as { encounterId: string }).encounterId;
  lines.push(["COMP", id, c.event.type, eventId, matText(c.materials)].join("\t"));
}

const describe = (p: PlayerProgression) => {
  const r = p.lastMissionReward;
  return `inventory=[${p.inventory.map(gear).join(";")}];equipped={${Object.keys(p.equippedGear).filter((k) => p.equippedGear[k as keyof typeof p.equippedGear]).sort().map((k) => `${k}:${p.equippedGear[k as keyof typeof p.equippedGear]}`).join(",")}};materials=${numMap(p.materials)};xp=${n(p.xp)};level=${n(p.level)};tokens=${n(p.calibrationTokens)};nova=${n(p.novaLevel)};novaUnlocks=[${p.novaUnlocks.join(",")}]`
    + `;shards=${n(p.fractureShards)};earned=[${p.earnedRewards.join(",")}];abilities=[${p.unlockedAbilities.join(",")}];runs={${Object.keys(p.missionRuns).sort().map((k) => { const x = p.missionRuns[k]!; return `${k}:${x.day}/${n(x.count)}/${x.last === undefined ? "~" : n(x.last)}`; }).join(",")}}`
    + `;completed=[${p.completedMissions.join(",")}];nex=${numMap(p.nexLedger)};last=${r ? `${r.missionId}/${n(r.factor)}/${r.firstClear ? 1 : 0}/${n(r.xp)}/${numMap(r.materials)}/${r.box!.rarity}/${numMap(r.box!.materials)}` : "~"}`;
};

const extraIds = ["mission-01", "side-rally", "side-derby", "side-vault-defense", "contract-relay", "dungeon-not-a-mission"];
const allIds = [...MISSION_IDS, ...extraIds];
const materialIds: MaterialId[] = ["scrapMetal", "dataShards", "microCircuits", "cryoCrystal", "forgeCatalyst", "tuningCore", "dataChip", "fractureCore"];
const DAY = 86_400_000;
let calls = 0;
const CASES = 160;
for (let c = 0; c < CASES; c++) {
  let now = Date.UTC(2026, pick([0, 3, 9, 11]), 1 + Math.floor(rand() * 28)) + Math.floor(rand() * DAY);
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - DAY).toISOString().slice(0, 10);
  const inventory: GearItem[] = [];
  const completedMissions = allIds.filter(() => rand() < 0.3);
  // earlier clears whose rewards are already owned, or missing (backfill), plus collection pieces at various levels
  for (const id of completedMissions) {
    if (MISSION_IDS.includes(id as MissionId) && rand() < 0.5) inventory.push(completionWeapon("mission", id));
    const ex = campaignExotic(id);
    if (ex && rand() < 0.5) inventory.push(ex);
  }
  for (let i = Math.floor(rand() * 5); i > 0; i--) {
    const col = pick(COLLECTIONS), slot = pick(SET_SLOTS), level = pick([1, 3, 9, 10]);
    if (!inventory.some((g) => g.id === `set-${col.id}-${slot}`)) inventory.push({ id: `set-${col.id}-${slot}`, name: col.pieces[slot], slot, power: 95 + 15 * (level - 1), level, element: col.element, source: `${col.name} set`, setId: col.id });
  }
  const missionRuns: PlayerProgression["missionRuns"] = {};
  for (const id of allIds) if (rand() < 0.3) missionRuns[id] = { day: rand() < 0.7 ? today : yesterday, count: pick([0, 1, 2, 3, 8, 9, 10, 11, 14, 20]) };
  if (rand() < 0.3) missionRuns["act:vyrak-rematch"] = { day: today, count: 1, last: now - 1000 };
  const p: PlayerProgression = {
    ...DEFAULT_PROGRESSION, inventory, completedMissions, missionRuns,
    equippedGear: inventory.length && rand() < 0.5 ? { [inventory[0]!.slot]: inventory[0]!.id } : {},
    materials: Object.fromEntries(materialIds.filter(() => rand() < 0.4).map((m) => [m, Math.floor(rand() * 12)])),
    xp: Math.floor(rand() * 900), level: 1 + Math.floor(rand() * 15), calibrationTokens: Math.floor(rand() * 4),
    novaLevel: pick([0, 4.9, 9.95, 24.9, 40]), novaUnlocks: [], fractureShards: Math.floor(rand() * 300),
    nexLedger: rand() < 0.5 ? { "mission:awakening:2026-01-01:1": 1500, "spend:home": -400 } : {},
    earnedRewards: [], unlockedAbilities: [], identityClass: null,
  };
  lines.push(`C\tcase-${c}`);
  for (const g of p.inventory) lines.push(["PI", gear(g)].join("\t"));
  for (const [slot, id] of Object.entries(p.equippedGear)) if (id) lines.push(["PE", slot, id].join("\t"));
  for (const [m, v] of Object.entries(p.materials)) lines.push(["PM", m, n(v!)].join("\t"));
  for (const m of p.completedMissions) lines.push(["PC", m].join("\t"));
  lines.push(["PX", n(p.xp), n(p.level), n(p.calibrationTokens), n(p.novaLevel), n(p.fractureShards)].join("\t"));
  for (const [k, r] of Object.entries(p.missionRuns)) lines.push(["PRUN", k, r.day, n(r.count), r.last === undefined ? NONE : n(r.last)].join("\t"));
  for (const [k, v] of Object.entries(p.nexLedger)) lines.push(["PNEX", k, n(v)].join("\t"));

  let q = p;
  for (let k = 1 + Math.floor(rand() * 8); k > 0; k--) {
    if (rand() < 0.15) now += DAY; // a new UTC day resets the repeat counter
    if (rand() < 0.5) {
      const id = pick(MISSION_IDS);
      lines.push(["A", id, n(now)].join("\t"));
      if (q.completedMissions.includes(id)) lines.push(["E", "0", NONE, NONE].join("\t"));
      else {
        const comp = COMPLETION[id];
        q = rewardMission(q, id, comp.materials, now);
        const eventId = comp.event.type === "MISSION_COMPLETE" ? (comp.event as { missionId: string }).missionId : (comp.event as { encounterId: string }).encounterId;
        lines.push(["E", "1", comp.event.type, eventId].join("\t"));
      }
    } else {
      const id = rand() < 0.6 ? pick(allIds) : pick(["side-rally", "side-derby", "contract-relay"]);
      // repeat runs of the same mission on one day climb the taper and the pity counter
      const mats: Partial<Record<MaterialId, number>> = Object.fromEntries(materialIds.filter(() => rand() < 0.35).map((m) => [m, pick([1, 2, 3, 5, 7])]));
      const repeats = rand() < 0.3 ? 1 + Math.floor(rand() * 12) : 1;
      for (let r = 0; r < repeats; r++) {
        lines.push(["R", id, n(now), matText(mats)].join("\t"));
        q = rewardMission(q, id, mats, now);
        lines.push(`L\t${describe(q)}`);
        calls++;
      }
      continue;
    }
    lines.push(`L\t${describe(q)}`);
    calls++;
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`${ARMOR_SETS.length} sets, ${DROPPABLE.length} completion weapons, ${COLLECTIONS.length} collections, ${CASES} cases, ${calls} payouts -> ${OUT}`);
