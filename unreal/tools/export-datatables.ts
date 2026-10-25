/**
 * Exports World Fracture's authored game data into Unreal Engine DataTable files.
 *
 * Run from the repo root:
 *   npx esbuild unreal/tools/export-datatables.ts --bundle --platform=node --format=esm \
 *     --alias:@=./src --outfile=/tmp/wf-export.mjs && node /tmp/wf-export.mjs
 *
 * Output (unreal/DataTables/):
 *   <Table>.json  — Unreal DataTable JSON (array of rows, each with a unique "Name"). Import via
 *                   Content Browser > Import, pick the matching F<Table>Row struct. Nested arrays and
 *                   objects are kept as real JSON so nothing is lost.
 *   <Table>.csv   — the same rows flattened for spreadsheets / quick review (nested values as JSON text).
 *   Plugins/WorldFractureCore/.../Public/Data/WFDataTableRows.h — USTRUCT(FTableRowBase) definitions inferred from the data. Scalars map to
 *                   int32/double/bool/FString; arrays of strings to TArray<FString>; anything nested is
 *                   carried as an FString of JSON (field suffix "Json") until it gets a proper struct.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WEAPONS } from "../../src/game/weapons";
import { LAUNCHERS } from "../../src/game/launchers";
import { VEHICLES } from "../../src/game/vehicles";
import { FLEET, GARAGES } from "../../src/game/fleet";
import { REGIONS, SKY } from "../../src/game/world";
import { LANDMARKS } from "../../src/game/landmarks";
import { ENCOUNTERS, EXTRA_ENEMIES, REGION_FACTION } from "../../src/game/encounters";
import { BOSS_PHASES } from "../../src/game/boss-phases";
import { QUESTS } from "../../src/game/quests";
import { CLASSES, SUBCLASSES, OPERATORS } from "../../src/game/loadout";
import { ARMOR_SETS } from "../../src/game/armor-sets";
import { MATERIALS } from "../../src/game/inventory";
import { REGIONAL_SHOPS } from "../../src/game/regional-shops";
import { CLASS_MISSIONS } from "../../src/game/class-missions";
import { ABILITY_NODES } from "../../src/game/ability-network";
import { UNIQUE_SCENARIOS } from "../../src/game/unique-scenarios";
import { ENCOUNTERS as SCENARIO_ENCOUNTERS } from "../../src/game/scenario-encounters";
import { SCENARIO_LOOT } from "../../src/game/scenario-loot";
import { VYRAK, COVENANT_ABILITY } from "../../src/game/dragon-covenant";
import { DRAGONITE, CHALLENGES as DRAGONITE_CHALLENGES } from "../../src/game/dragonite";
import { RACES, CHAMPIONSHIPS } from "../../src/game/racing";
import { HOMES, DECOR } from "../../src/game/housing";
import { ACTIVITIES, ELITES, VYRAK_REMATCH } from "../../src/game/activities";
import { WEAPON_MANIFEST } from "../../src/game/equipment";
import { catalogFrom } from "../../src/game/weapon-catalog";
import { campaignExotic } from "../../src/game/weapon-loot";
import { STORY_MISSIONS } from "../../src/game/progression";
import { COMPLETION, MISSION_IDS } from "../../src/game/missions/persistence";

type Row = Record<string, unknown>;
const OUT = join(process.cwd(), "unreal", "DataTables");
/** The row structs live in the plugin so its code (UWFQuestSubsystem) can read the tables. */
const HEADER = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Source", "WorldFractureCore", "Public", "Data", "WFDataTableRows.h");

/** Unreal reserves "Name" for the row key, so a data field called name becomes DisplayName. */
const pascal = (k: string) => { const p = rawPascal(k); return p === "Name" ? "DisplayName" : p; };
const rawPascal = (k: string) => k.replace(/(^|[_\-\s])([a-z0-9])/gi, (_, __, c: string) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "");
const isPlain = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);

/** Records keyed by id become rows named by that key; arrays use their id/name field. */
function toRows(data: unknown, nameKeys = ["id", "name"]): Row[] {
  const entries: [string | null, unknown][] = Array.isArray(data) ? data.map((v) => [null, v]) : Object.entries(data as Row);
  const seen = new Map<string, number>();
  return entries.map(([key, value], i) => {
    const row: Row = isPlain(value) ? { ...value } : { value };
    let name = key ?? String(nameKeys.map((k) => row[k]).find((v) => typeof v === "string" || typeof v === "number") ?? `Row${i}`);
    name = name.replace(/[^A-Za-z0-9_\-]/g, "_");
    const n = seen.get(name) ?? 0; seen.set(name, n + 1);
    return { Name: n ? `${name}_${n}` : name, ...row };
  });
}

type Field = { key: string; ue: string; json: boolean };
function inferFields(rows: Row[]): Field[] {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => k !== "Name");
  return keys.map((key) => {
    const vals = rows.map((r) => r[key]).filter((v) => v !== undefined && v !== null);
    if (vals.length && vals.every((v) => typeof v === "boolean")) return { key, ue: "bool", json: false };
    if (vals.length && vals.every((v) => typeof v === "number")) return { key, ue: vals.every((v) => Number.isInteger(v)) ? "int32" : "double", json: false };
    if (vals.every((v) => typeof v === "string")) return { key, ue: "FString", json: false };
    if (vals.length && vals.every((v) => Array.isArray(v) && v.every((x) => typeof x === "string"))) return { key, ue: "TArray<FString>", json: false };
    return { key, ue: "FString", json: true };
  });
}

/** Unreal's JSON importer matches property names exactly, so rows are re-keyed to the struct's field names. */
const codeFields = new Set<string>();
let tableName = "";
function ueRow(row: Row, fields: Field[]): Row {
  const out: Row = { Name: row["Name"] };
  for (const f of fields) {
    const v = row[f.key];
    const field = pascal(f.key) + (f.json ? "Json" : "");
    if (v === undefined || v === null) out[field] = f.ue === "bool" ? false : f.ue === "int32" || f.ue === "double" ? 0 : f.ue.startsWith("TArray") ? [] : "";
    else if (typeof v === "function") { codeFields.add(`${tableName}.${f.key}`); out[field] = ""; } // rules written as code are ported as code, not data
    else out[field] = f.json ? JSON.stringify(v) ?? "" : v;
  }
  return out;
}

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const structs: string[] = [];
const summary: string[] = [];
function table(name: string, data: unknown, nameKeys?: string[]) {
  tableName = name;
  const rows = toRows(data, nameKeys);
  const fields = inferFields(rows);
  const ue = rows.map((r) => ueRow(r, fields));
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(ue, null, 2) + "\n");
  const cols = ["Name", ...fields.map((f) => pascal(f.key) + (f.json ? "Json" : ""))];
  writeFileSync(join(OUT, `${name}.csv`), [cols.join(","), ...ue.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n");
  structs.push([
    `/** ${name}: ${rows.length} rows, exported from the web build. */`,
    "USTRUCT(BlueprintType)",
    `struct F${name}Row : public FTableRowBase`,
    "{",
    "\tGENERATED_BODY()",
    ...fields.map((f) => `\tUPROPERTY(EditAnywhere, BlueprintReadWrite) ${f.ue} ${pascal(f.key)}${f.json ? "Json" : ""}${f.ue === "bool" ? " = false" : f.ue === "int32" ? " = 0" : f.ue === "double" ? " = 0.0" : ""};`),
    "};",
  ].join("\n"));
  summary.push(`${name}\t${rows.length}`);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(join(HEADER, ".."), { recursive: true });
table("Weapons", WEAPONS);
table("Launchers", LAUNCHERS);
table("Vehicles", VEHICLES);
table("Fleet", FLEET);
table("Garages", GARAGES);
table("Regions", REGIONS);
table("Landmarks", LANDMARKS);
table("RegionalEncounters", ENCOUNTERS, ["regionId", "id", "name"]);
table("ExtraEnemies", EXTRA_ENEMIES, ["id", "name", "profile"]);
table("RegionFactions", Object.fromEntries(Object.entries(REGION_FACTION).map(([k, v]) => [k, { region: k, faction: v }])));
table("BossPhases", BOSS_PHASES, ["id", "phase", "name"]);
table("Quests", QUESTS);
table("Classes", CLASSES);
table("Subclasses", SUBCLASSES);
table("Operators", OPERATORS);
table("AbilityNodes", ABILITY_NODES);
table("ArmorSets", ARMOR_SETS);
table("Materials", MATERIALS);
table("RegionalShops", REGIONAL_SHOPS);
table("ClassMissions", CLASS_MISSIONS);
table("SkyPhases", SKY);
// Unique encounters, Vyrak's covenant and dragonite, racing, housing and activities (the preserve list).
table("UniqueScenarios", UNIQUE_SCENARIOS);
table("ScenarioEncounters", SCENARIO_ENCOUNTERS);
table("ScenarioLoot", SCENARIO_LOOT);
table("VyrakCovenant", { vyrak: VYRAK });
table("CovenantAbilities", COVENANT_ABILITY);
table("Dragonite", DRAGONITE);
table("DragoniteChallenges", DRAGONITE_CHALLENGES);
table("Races", RACES);
table("Championships", CHAMPIONSHIPS);
table("Homes", HOMES);
table("Decor", DECOR);
table("Activities", [...ACTIVITIES, ...ELITES, VYRAK_REMATCH]);
// Kill weapon drops pick by index into these pools, so order is part of the data (weapon-loot.ts ENEMY_POOL / BOSS_POOL).
{
  const element: Record<string, string> = { KINETIC: "KINETIC", PLASMA: "ARC", CRYO: "CRYO", ARC: "ARC", THERMAL: "THERMAL", VOID: "BIO" };
  const slotOf = (archetype: string) => (archetype === "HEAVY" ? "heavy" : archetype === "SIDEARM" ? "secondary" : "primary");
  const enemyPool = [...WEAPON_MANIFEST.filter((w) => w.tier === "T1" || w.tier === "T2" || w.tier === "T3"), ...catalogFrom("loot")];
  const bossPool = [...enemyPool, ...catalogFrom("boss")];
  const row = (pool: string) => (w: { id: string; name: string; archetype: string; element: string }, order: number) => ({ id: `${pool}-${order}`, pool, order, weaponId: w.id, name: w.name, slot: slotOf(w.archetype), element: element[w.element] });
  table("WeaponLootPools", [...enemyPool.map(row("enemy")), ...bossPool.map(row("boss"))]);
  // Mission payouts (progression.ts rewardMission, missions/persistence.ts COMPLETION). The completion-weapon pool is
  // weapon-loot.ts DROPPABLE (the enemy pool's manifest prefix) and picks by index, so its order is data too.
  const droppable = WEAPON_MANIFEST.filter((w) => w.tier === "T1" || w.tier === "T2" || w.tier === "T3");
  table("CompletionWeapons", droppable.map((w, order) => ({ id: `completion-${order}`, order, weaponId: w.id, name: w.name, slot: slotOf(w.archetype), element: element[w.element] })));
  table("MissionPayouts", [...STORY_MISSIONS].map((missionId) => {
    const campaign = (MISSION_IDS as readonly string[]).indexOf(missionId);
    const done = campaign >= 0 ? COMPLETION[missionId as (typeof MISSION_IDS)[number]] : undefined;
    const ev = done?.event as { type: string; missionId?: string; encounterId?: string } | undefined;
    const exotic = campaignExotic(missionId);
    return {
      id: missionId, campaignOrder: campaign, story: true,
      materials: JSON.stringify(done?.materials ?? {}), eventType: ev?.type ?? "", eventId: ev ? (ev.missionId ?? ev.encounterId ?? "") : "",
      exoticWeaponId: exotic ? exotic.id.slice("exotic:".length) : "", exoticName: exotic?.name ?? "", exoticSlot: exotic?.slot ?? "", exoticElement: exotic?.element ?? "",
      exoticSource: exotic ? exotic.source.slice("Exotic \u00b7 ".length) : "",
    };
  }));
}

writeFileSync(HEADER, [
  "// Generated by unreal/tools/export-datatables.ts — re-run the exporter rather than hand-editing.",
  "#pragma once",
  "",
  "// Number fields are int32 when every exported value is whole, double otherwise. A column that is whole today",
  "// but may later hold fractions (tuning that is 1 now, 1.5 later) should be switched to double by hand.",
  "",
  '#include "CoreMinimal.h"',
  '#include "Engine/DataTable.h"',
  '#include "WFDataTableRows.generated.h"',
  "",
  structs.join("\n\n"),
  "",
].join("\n"));
writeFileSync(join(OUT, "MANIFEST.tsv"), "table\trows\n" + summary.join("\n") + "\n");
writeFileSync(join(OUT, "CODE_FIELDS.txt"), "Fields holding functions in the web build (rules to port as code, exported empty):\n" + [...codeFields].sort().join("\n") + "\n");
console.log(summary.join("\n"));
if (codeFields.size) console.log(`code-only fields: ${[...codeFields].join(", ")}`);
