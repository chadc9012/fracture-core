/**
 * Records golden per-operator pockets from the web build's real operator-pockets.ts (switchOperator, livePocket) and
 * xp.ts (grantXP) for the C++ port's test (Plugins/WorldFractureCore/Tests/OperatorCoreTest.cpp): each operator's level,
 * XP, Nex, fracture shards and materials, with purchases and claims shared through the Nex ledger.
 *
 *   node unreal/tools/gen-goldens.mjs operator
 *
 * Lines are tab-separated; "~" = absent. C starts a case (played class); then OP lines each followed by S:
 *   S  pocketClass  live pocket  TITAN | HUNTER | WARLOCK stored pockets  ledger
 * A pocket is level/xp/nex/shards/materials.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";
import { grantXP, type XPEventType } from "../../src/game/xp";
import { spendNex } from "../../src/game/nex";
import { OPERATOR_CLASSES, freshPockets, livePocket, switchOperator, type ClassId, type OperatorPocket } from "../../src/game/operator-pockets";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "operator_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0x0b5e;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));

const mats = (m: Partial<Record<string, number>>) => Object.keys(m).sort().map((k) => `${k}=${n(m[k]!)}`).join(",") || NONE;
const pocket = (p: OperatorPocket) => [p.level, p.xp, p.nex, p.fractureShards, mats(p.materials)].map((v) => (typeof v === "number" ? n(v) : v)).join("/");
const ledger = (l: Record<string, number>) => Object.keys(l).sort().map((k) => `${k}=${n(l[k]!)}`).join(",") || NONE;
const state = (p: PlayerProgression) => out("S", p.pocketClass, pocket(livePocket(p)), OPERATOR_CLASSES.map((c) => pocket(p.operators[c])).join("|"), ledger(p.nexLedger));

const XP_TYPES: XPEventType[] = ["KILL", "ELITE_KILL", "BOSS_KILL", "MISSION", "OBJECTIVE", "DISCOVERY"];
const MATS = ["scrapMetal", "microCircuits", "dataShards", "fuel", "dragonite", "reinforcedAlloy"];
const KEYS = ["payout:boss:vyrak:2026-01-05", "home:grid-loft", "fleet:skyhawk", "decor:neon-sign", "mission:m2:2026-01-05:1", "race:r1", "repair:car:1"];
let ops = 0;
for (let c = 0; c < 160; c++) {
  const start: ClassId = pick(OPERATOR_CLASSES);
  let p: PlayerProgression = { ...DEFAULT_PROGRESSION, pocketClass: start, operators: freshPockets(), nexLedger: {}, materials: {} };
  if (rand() < 0.6) p.nexLedger["seed:grant"] = pick([500, 3000, 25000]);
  out("C", start, p.nexLedger["seed:grant"] ?? 0);
  for (let k = 0; k < 40; k++) {
    ops++;
    const r = rand();
    if (r < 0.25) { const t = pick(XP_TYPES), lvl = 1 + Math.floor(rand() * 12), sc = pick([1, 1.25, 1.5]); out("OP", "xp", t, lvl, sc); p = grantXP(p, t, { enemyLevel: lvl, scale: sc }).progression; }
    else if (r < 0.42) { const key = `${pick(KEYS)}:${k}`, v = pick([50, 400, 1200, 9000]); out("OP", "earn", key, v); p = { ...p, nexLedger: { ...p.nexLedger, [key]: v } }; }
    else if (r < 0.57) { const key = rand() < 0.8 ? `${pick(KEYS)}:${k}` : "seed:grant", price = pick([100, 900, 2500, 20000, 0]); out("OP", "spend", key, price); const l = spendNex(p.nexLedger, key, price); if (l) p = { ...p, nexLedger: l }; }
    else if (r < 0.7) { const id = pick(MATS), d = pick([1, 5, 30, -3]); out("OP", "mat", id, d); p = { ...p, materials: { ...p.materials, [id]: Math.max(0, (p.materials[id as keyof typeof p.materials] ?? 0) + d) } }; }
    else if (r < 0.78) { const d = pick([10, 250, -40]); out("OP", "shards", d); p = { ...p, fractureShards: Math.max(0, p.fractureShards + d) }; }
    else { const cls = rand() < 0.92 ? pick(OPERATOR_CLASSES) : pick(["NONE", "ROGUE"]); out("OP", "switch", cls); p = switchOperator(p, cls === "NONE" ? null : (cls as ClassId)); }
    state(p);
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`operator golden: ${ops} operations, ${lines.length} lines -> ${OUT}`);
