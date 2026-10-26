/**
 * Records golden activity bounties from the web build's real activity-payouts.ts (payoutFor, payInto, tagLegacyPayouts,
 * payFlat) for the C++ port's test (Plugins/WorldFractureCore/Tests/BountyCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs bounty
 *
 * Lines are tab-separated; "~" = absent. C starts a ledger; then
 *   PF class id nowMs mult operator -> key|nex|first or ~      PI (same, pays) -> key|nex|first or ~ ; then L ledger
 *   TG operator -> changed ; L ledger       FL key nex -> 0/1 ; L ledger       SEED key value (a ledger entry)
 *   DAY nowMs -> YYYY-MM-DD      CB scenarioId nowMs operator -> nex|first (claimBossBounty, NO_BOUNTY honoured) ; L ledger
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { payoutFor, payInto, tagLegacyPayouts, payFlat, claimBossBounty, type PayoutClass } from "../../src/game/activity-payouts";
import type { NexLedger } from "../../src/game/nex";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "bounty_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0xb0b7;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const led = (l: NexLedger) => Object.keys(l).sort().map((k) => `${k}=${n(l[k]!)}`).join(",") || NONE;

const CLASSES: PayoutClass[] = ["boss", "strike", "dungeon", "raid"];
const IDS = ["dark-knight", "rime-alpha", "drowned-monarch", "hollow-saint", "vyrak", "astravore", "sub-terra@hard", "fuel-king", "hollow-star", "hollow-star@master"];
const OPS = ["", "TITAN", "HUNTER", "WARLOCK"];
const T0 = Date.UTC(2026, 9, 25, 9), DAY = 86_400_000;
for (const t of [0, Date.UTC(1999, 11, 31, 23, 59, 59), Date.UTC(2000, 1, 29, 12), Date.UTC(2026, 9, 25, 23, 59, 59, 999), Date.UTC(2026, 9, 26), T0 + 400 * DAY, Date.UTC(2100, 2, 1)]) out("DAY", t, new Date(t).toISOString().slice(0, 10));
for (let c = 0; c < 400; c++) {
  let ledger: NexLedger = {};
  out("C");
  if (rand() < 0.4) for (let k = 0; k < 3; k++) {
    // legacy, untagged entries and unrelated keys
    const key = pick([`payout:${pick(CLASSES)}:${pick(IDS)}:first:2026-10-2${Math.floor(rand() * 5)}`, `payout:${pick(CLASSES)}:${pick(IDS)}:2026-10-2${Math.floor(rand() * 5)}`, "payout:secret:x", "payout:cache:c1@2026-10-25", "home:grid-loft", `payout:raid:hollow-star:2026-10-24:challenge`]);
    const v = pick([800, -9000, 350, 400, 6000]);
    ledger[key] = v; out("SEED", key, v);
  }
  let now = T0 + Math.floor(rand() * 3) * DAY;
  for (let k = 0; k < 25; k++) {
    const r = rand();
    if (r < 0.06) { const op = pick(OPS.slice(1)); const t = tagLegacyPayouts(ledger, op); out("TG", op, t !== ledger ? 1 : 0); ledger = t; out("L", led(ledger)); continue; }
    if (r < 0.1) { const key = pick(["payout:secret:x", "payout:secret:y", `payout:cache:c${k % 3}@2026-10-25`]), nex = pick([400, 60]); const before = ledger; const p = payFlat({ nexLedger: ledger }, key, nex); ledger = p.nexLedger ?? {}; out("FL", key, nex, ledger !== before ? 1 : 0); out("L", led(ledger)); continue; }
    if (r < 0.2) now += pick([1000, DAY, 3 * DAY, DAY / 2]);
    if (r < 0.28) { const sid = pick(["astravore", "dark-knight", "vyrak", "hollow-saint"]), op = pick(OPS.slice(1)); const res = claimBossBounty({ nexLedger: ledger, pocketClass: op }, sid, now); out("CB", sid, now, op, `${n(res.paid)}|${res.first ? 1 : 0}`); ledger = res.progression.nexLedger; out("L", led(ledger)); continue; }
    const cls = pick(CLASSES), id = pick(IDS), mult = pick([1, 1, 1.5, 2.25, 0.7]), op = pick(OPS);
    if (r < 0.5) { const p = payoutFor(ledger, cls, id, now, mult, op || undefined); out("PF", cls, id, now, mult, op || NONE, p ? `${p.key}|${n(p.nex)}|${p.first ? 1 : 0}` : NONE); }
    else {
      const res = payInto({ nexLedger: ledger, ...(op ? { pocketClass: op } : {}) }, cls, id, now, mult);
      out("PI", cls, id, now, mult, op || NONE, `${n(res.paid)}|${res.first ? 1 : 0}`);
      ledger = res.progression.nexLedger; out("L", led(ledger));
    }
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`bounty golden: ${lines.length} lines -> ${OUT}`);
