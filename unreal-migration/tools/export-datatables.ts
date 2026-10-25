/**
 * Exports World Fracture's authored game data into Unreal Engine DataTable files.
 *
 * Run from the repo root:
 *   npx esbuild unreal-migration/tools/export-datatables.ts --bundle --platform=node --format=esm \
 *     --alias:@=./src --outfile=/tmp/wf-export.mjs && node /tmp/wf-export.mjs
 *
 * Output (unreal-migration/DataTables/):
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

type Row = Record<string, unknown>;
const OUT = join(process.cwd(), "unreal-migration", "DataTables");
/** The row structs live in the plugin so its code (UWFQuestSubsystem) can read the tables. */
const HEADER = join(process.cwd(), "unreal-migration", "Plugins", "WorldFractureCore", "Source", "WorldFractureCore", "Public", "Data", "WFDataTableRows.h");

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
function ueRow(row: Row, fields: Field[]): Row {
  const out: Row = { Name: row["Name"] };
  for (const f of fields) {
    const v = row[f.key];
    const field = pascal(f.key) + (f.json ? "Json" : "");
    if (v === undefined || v === null) out[field] = f.ue === "bool" ? false : f.ue === "int32" || f.ue === "double" ? 0 : f.ue.startsWith("TArray") ? [] : "";
    else out[field] = f.json ? JSON.stringify(v) : v;
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

writeFileSync(HEADER, [
  "// Generated by unreal-migration/tools/export-datatables.ts — re-run the exporter rather than hand-editing.",
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
console.log(summary.join("\n"));
