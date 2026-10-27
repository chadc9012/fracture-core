/**
 * Records golden activity-board runs from the web build's real activities.ts for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/ActivityCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs activity
 *
 *   AR id name x z radius     the activity areas (activities.ts AREAS)
 *   D id kind area stages     the definition the next runs use
 *   N now -> run              a fresh run (newRun)
 *   T x z dt now kills elites bosses hp deaths rivalKills pvp -> run|target        (stepRun, then currentTarget)
 *   AB -> run                 abandonRun
 *   FE now -> featured ids    WE now -> weekly elite ids, week key     AO x z -> area      CA kind id area -> category
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ACTIVITIES, AREAS, ELITES, abandonRun, areaOfPoint, categoryOf, currentTarget, featuredFor, newRun, pointWorld, stepRun, weekKeyUtc, weeklyElitesFor, type ActivityDef, type Objective, type Run } from "../../src/game/activities";
import { ARENA_POINT } from "../../src/game/crucible";
// the game loads racing.ts, which appends the non-hidden races to the board (featuredFor's pool); a named import keeps it bundled
import { isRaceActivity } from "../../src/game/racing";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "activity_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0xac71;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const fr = (p: readonly [number, number]) => `${n(p[0])}:${n(p[1])}`;
const obj = (o: Objective) => {
  const a = o as Record<string, unknown>;
  return [o.kind, o.label, n((a.count as number) ?? 0), (a.tier as string) ?? "any", ((a.points as [number, number][]) ?? []).map(fr).join(",") || "~", n((a.timeLimit as number) ?? 0),
    a.at ? fr(a.at as [number, number]) : "0:0", n((a.radius as number) ?? 0), n((a.seconds as number) ?? 0), a.from ? fr(a.from as [number, number]) : "0:0", a.to ? fr(a.to as [number, number]) : "0:0",
    (a.raceId as string) ?? "~", (a.mode as string) ?? "~", n((a.target as number) ?? 0)].join("^");
};
const run = (r: Run) => [r.status, r.failReason ?? "~", n(r.stage), n(r.stageStartedAt), n(r.progress), n(r.need), n(r.cp), r.visited.join(",") || "~", b(r.carrying), n(r.hold), n(r.killsBase), n(r.elitesBase), n(r.bossesBase), n(r.hpMin), n(r.deaths0), b(r.diedDuring), b(r.wasHurt),
  r.rivalBase === undefined ? "~" : n(r.rivalBase), r.theirScore === undefined ? "~" : n(r.theirScore), r.pvpLine ?? "~"].join("|");

for (const [id, a] of Object.entries(AREAS)) out("AR", id, a.name, a.x, a.z, a.radius);
const defs: ActivityDef[] = [...ACTIVITIES, ...ELITES].filter((d) => d.stages.length && d.stages.every((s) => s.kind !== "race" && s.kind !== "pvp"));
for (const d of defs) {
  out("D", d.id, d.kind, d.area, d.stages.map(obj).join(";"));
  const area = AREAS[d.area]!;
  for (let k = 0; k < 6; k++) {
    let now = 1_766_000_000_000 + Math.floor(rand() * 1e9);
    const r = newRun(d, now);
    out("N", now, run(r));
    let kills = Math.floor(rand() * 50), elites = Math.floor(rand() * 5), bosses = Math.floor(rand() * 2), deaths = Math.floor(rand() * 3), rivalKills = Math.floor(rand() * 4), hp = 100;
    const rivalRate = pick([0.15, 0.01, 0]), deathRate = pick([0.02, 0.2]);
    let us = 0, them = 0;
    for (let step = 0; step < 400 && r.status === "active"; step++) {
      const dt = pick([1 / 60, 0.1, 0.5, 1, 2]);
      now += Math.round(dt * 1000) + (rand() < 0.01 ? 400_000 : 0);
      const tgt = currentTarget(d, r);
      // usually walk at the target, sometimes wander or stand just off it
      let x = area.x + (rand() - 0.5) * area.radius * 2, z = area.z + (rand() - 0.5) * area.radius * 2;
      if (tgt && rand() < 0.6) { const off = pick([0, 3, 6.99, 7, 7.01, 12]); const a = rand() * Math.PI * 2; x = tgt.x + Math.cos(a) * off; z = tgt.z + Math.sin(a) * off; }
      if (rand() < 0.2) kills++;
      if (rand() < 0.04) elites++;
      if (rand() < 0.01) bosses++;
      if (rand() < deathRate) deaths++;
      if (rand() < rivalRate) rivalKills++;
      if (rand() < 0.05) hp = pick([100, 99.6, 99.4, 50]);
      const o = d.stages[r.stage]!;
      let pvp: { us: number; them: number; result: "win" | "loss" | null; reason: string; line: string } | undefined;
      if (o.kind === "pvp" && rand() < 0.9) { if (rand() < 0.2) us++; if (rand() < 0.1) them++; pvp = { us, them, result: us >= o.target ? "win" : them >= o.target ? "loss" : null, reason: rand() < 0.5 ? "" : "Out of rounds", line: `${us}-${them}` }; }
      const tick = { x, z, dt, now, kills, elites, bosses, hp, deaths, rivalKills: rand() < 0.95 ? rivalKills : undefined, ...(pvp ? { pvp: pvp as never } : {}) };
      stepRun(d, r, tick);
      const t2 = currentTarget(d, r);
      out("T", x, z, dt, now, kills, elites, bosses, hp, deaths, tick.rivalKills ?? "~", pvp ? `${n(pvp.us)}:${n(pvp.them)}:${pvp.result ?? ""}:${pvp.reason}:${pvp.line}` : "~", `${run(r)}|${t2 ? `${n(t2.x)}:${n(t2.z)}:${t2.label}` : "~"}`);
      if (rand() < 0.003) { abandonRun(r); out("AB", run(r)); }
    }
  }
}
// the exact edges: a timed stage at its limit to the millisecond (and one past), standing exactly 7 m from a checkpoint
for (const d of defs.filter((x) => "timeLimit" in x.stages[0]!)) {
  const area = AREAS[d.area]!, lim = (d.stages[0] as { timeLimit: number }).timeLimit;
  for (const extra of [0, 1]) {
    const start = 1_767_000_000_000, r = newRun(d, start);
    out("D", d.id, d.kind, d.area, d.stages.map(obj).join(";"));
    out("N", start, run(r));
    for (const at of [start, start + lim * 1000 + extra]) {
      const far = { x: area.x + area.radius * 5, z: area.z, dt: 0.1, now: at, kills: 0, elites: 0, bosses: 0, hp: 100, deaths: 0, rivalKills: 0 };
      stepRun(d, r, far);
      const t2 = currentTarget(d, r);
      out("T", far.x, far.z, far.dt, at, 0, 0, 0, 100, 0, 0, "~", `${run(r)}|${t2 ? `${n(t2.x)}:${n(t2.z)}:${t2.label}` : "~"}`);
    }
  }
}
// the crucible arena point lives in crucible.ts
out("AP", fr(ARENA_POINT));
const fresh = { earnedRewards: [] as string[], missionRuns: {} };
if (!ACTIVITIES.some(isRaceActivity)) throw new Error("racing.ts did not register its races");
for (const d of ACTIVITIES) out("BE", d.id, d.area, d.minRep ?? 0, b(Boolean(d.gate?.(fresh))));
for (const d of ELITES) out("EL", d.id);
for (let k = 0; k < 400; k++) { const now = 1_765_000_000_000 + Math.floor(rand() * 4e10); out("FE", now, featuredFor(now).map((a) => a.id).join(",")); out("WE", now, `${weeklyElitesFor(now).map((a) => a.id).join(",")}|${weekKeyUtc(now)}`); }
const pts = Object.values(AREAS);
for (let k = 0; k < 3000; k++) { const a = pick(pts); const x = a.x + (rand() - 0.5) * a.radius * 3, z = a.z + (rand() - 0.5) * a.radius * 3; out("AO", x, z, areaOfPoint(x, z) ?? "~"); }
for (const a of pts) for (const [dx, dz] of [[a.radius * 1.2, 0], [0, -a.radius * 1.2]]) out("AO", a.x + dx!, a.z + dz!, areaOfPoint(a.x + dx!, a.z + dz!) ?? "~");
for (const d of [...ACTIVITIES, ...ELITES]) out("CA", d.kind, d.id, d.area, categoryOf(d));
void pointWorld;
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`activity golden: ${lines.length} lines -> ${OUT}`);
