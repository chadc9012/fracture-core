/**
 * Records golden nemeses from the web build's real nemesis.ts for the C++ port's test (Plugins/WorldFractureCore/Tests/NemesisCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs nemesis
 *
 *   P save (nemeses, earned, materials, shards)  then
 *   PD profile zone elite boss nemesis region now -> line save      NK id now -> line save
 *   AD region inRegion sinceAmbush summoned -> id      ST id -> hp|damage|scale|weak      WM id element -> mult
 *   MG a b -> merged
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyPlayerDeath, applyNemesisKill, ambushDue, nemesisStats, weaknessMult, mergeNemeses, WEAK_ELEMENT, type Nemesis } from "../../src/game/nemesis";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "nemesis_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x7e31;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const nem = (x: Nemesis) => [x.id, x.status, x.name, x.epithet, x.profile, x.regionId, n(x.rank), x.traits.join(".") || "~", n(x.kills), n(x.returns), n(x.createdAt), n(x.lastSeenAt), x.grudge].join("^");
const kv = (m: Record<string, number | undefined>) => Object.keys(m).filter((k) => m[k] !== undefined).sort().map((k) => `${k}=${n(m[k]!)}`).join(",") || "~";
const ps = (p: PlayerProgression) => [p.nemeses.map(nem).join(";") || "~", p.earnedRewards.join(",") || "~", kv(p.materials as Record<string, number>), n(p.fractureShards)].join("|");

const PROFILES = ["Badlands Marauder", "Nomad Sniper", "Rust-Runner Buggy", "Vanguard Enforcer", "Hostile", "", "Chrono-Stalker", "Spore Hulk", "Neon Ganger"];
const ZONES = ["wastelands", "frostspire", "swamps", "veridan", "ember", "solara", "nexus"];
const REGION_NAMES = ["The Wastelands", "Frostspire", "the wastes", "Verdant Forest"];
const ELEMENTS = ["THERMAL", "CRYO", "ARC", "BIO", "KINETIC", ""];
let now = 1_760_000_000_000;
for (let t = 0; t < 500; t++) {
  let p: PlayerProgression = { ...structuredClone(DEFAULT_PROGRESSION), nemeses: [], earnedRewards: [], materials: {} as PlayerProgression["materials"], fractureShards: pick([0, 120, 500]) };
  out("P", ps(p));
  for (let k = 0; k < 40; k++) {
    now += 1 + Math.floor(rand() * 5e6);
    const r = rand();
    const alive = p.nemeses.filter((x) => x.status === "ALIVE");
    if (r < 0.45) {
      const useNem = alive.length && rand() < 0.35;
      const killer = { profile: pick(PROFILES), zone: pick(ZONES), elite: rand() < 0.3, boss: rand() < 0.08, nemesis: useNem ? (rand() < 0.9 ? pick(alive).id : "nem-gone") : undefined };
      const region = pick(REGION_NAMES);
      const res = applyPlayerDeath(p, killer, region, now);
      out("PD", killer.profile || "~", killer.zone, b(killer.elite), b(killer.boss), killer.nemesis ?? "~", region, now, res.line ?? "~", ps(res.progression));
      p = res.progression;
    } else if (r < 0.7) {
      const id = alive.length && rand() < 0.9 ? pick(alive).id : pick([...p.nemeses.map((x) => x.id), "nem-none"]);
      if (rand() < 0.1 && p.nemeses.length) p = { ...p, earnedRewards: [...p.earnedRewards, `nemesis:${p.nemeses[0]!.id}:0`] }, out("EK", `nemesis:${p.nemeses[0]!.id}:0`);
      const res = applyNemesisKill(p, id, now);
      out("NK", id, now, res.line ?? "~", ps(res.progression));
      p = res.progression;
    } else if (r < 0.85) {
      const region = pick([...ZONES, ""]), inRegion = pick([0, 3, 4, 4.01, 59.9, 60, 61, 300]), since = pick([0, 239.9, 240, 1e9]);
      const summoned = rand() < 0.3 && p.nemeses.length ? pick(p.nemeses).id : rand() < 0.1 ? "nem-x" : null;
      const due = ambushDue(p.nemeses, region || null, inRegion, since, summoned);
      out("AD", region || "~", inRegion, since, summoned ?? "~", due ? due.id : "~");
    } else if (r < 0.95 && p.nemeses.length) {
      const x = pick(p.nemeses), st = nemesisStats(x), el = pick(ELEMENTS);
      out("ST", x.id, [n(st.hp), n(st.damage), n(st.scale), x.traits.map((tr) => WEAK_ELEMENT[tr]).find(Boolean) ?? "~"].join("|"));
      out("WM", x.id, el || "~", weaknessMult(x, (el || undefined) as never));
    } else if (p.nemeses.length) {
      const other = p.nemeses.map((x) => ({ ...x, rank: Math.max(1, x.rank + pick([-1, 0, 1])), kills: x.kills + pick([0, 1]), lastSeenAt: x.lastSeenAt + pick([-1, 0, 1]), status: rand() < 0.2 ? ("SLAIN" as const) : x.status, grudge: x.grudge + (rand() < 0.5 ? " (b)" : "") }));
      out("MG", other.map(nem).join(";"), mergeNemeses(p.nemeses, other).map(nem).join(";") || "~");
    }
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`nemesis golden: ${lines.length} lines -> ${OUT}`);
