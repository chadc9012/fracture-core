/**
 * Records golden races from the web build's real racing.ts (tickRace, evaluate, rivals, records, applyRaceResult) and
 * activities.ts (activityState, startActivity, completeActivity) for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/RaceCoreTest.cpp).
 *
 *   npx esbuild unreal/tools/gen-race-golden.ts --bundle --platform=node --format=esm --alias:@=./src \
 *     --outfile=/tmp/wf-race-golden.mjs && node /tmp/wf-race-golden.mjs
 *
 * Lines (tab-separated, "~" = absent):
 *   RACE id area name type mode par rivals rank laps hidden    (hidden = need|marker,marker or ~)
 *   PT x z depth period open / SC at viaX viaZ skipTo / OB id x z radius segment     the race above
 *   CH id area name rank rounds        ACT ... (see actLine)
 *   CASE name / PER key / PRUN key day count last / PNEX key value / PM material amount / PX xp level tokens nova
 *   START act now difficulty -> SR ok|error|attemptsLeft|cooldown      (the run starts; ST = state lines)
 *   TICK x z dt now mode y disabled fell collisions style -> X run state
 *   RP x z -> rival positions / live place            RT diff -> rival times
 *   APPLY act nex startedAt -> AR result              DONE act now featured -> DR payout
 *   L progression state
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { RACES, CHAMPIONSHIPS, DIFFICULTIES, rankIndex, racingScore, championshipsWon, tickRace, rivalTimes, rivalPositions, livePlace, applyRaceResult, raceObstacles, worldPoint, newRaceRun, type RaceDef, type RaceRun, type Difficulty } from "../../src/game/racing";
import { ACTIVITIES, ELITES, activityById, activityState, startActivity, completeActivity, isFeatured, featuredFor, weekKeyUtc, pointWorld, type ActivityDef, type Run } from "../../src/game/activities";
import { isRaceActivity } from "../../src/game/racing";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "race_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
const o = (v: number | undefined | null) => (v === undefined || v === null ? NONE : String(v));
let seed = 0x2ace;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
Math.random = () => { throw new Error("race rules must not draw random numbers"); };

const lines: string[] = [];
const actLine = (d: ActivityDef, race: RaceDef) => {
  const limit = d.stages.reduce((s, st) => s + ("timeLimit" in st ? (st as { timeLimit: number }).timeLimit : 0), 0);
  const mats = Object.entries(d.rewards.materials).map(([k, v]) => `${k}:${n(v!)}`).join(",") || NONE;
  return ["ACT", d.id, d.kind, d.faction, d.period ?? NONE, n(d.attempts), n(d.cooldownMin), n(d.minRep ?? 0), d.challenge?.id ?? NONE, n(limit), n(d.rewards.nex), n(d.rewards.xp), n(d.rewards.rep), n(d.rewards.shaderChance), mats, n(race.rank)].join("\t");
};
for (const r of RACES) {
  lines.push(["RACE", r.id, r.area, r.name, r.type, r.mode, n(r.par), n(r.rivals), n(r.rank), n(r.laps), r.hidden ? `${r.hidden.need}|${r.hidden.markers.join(",")}` : NONE].join("\t"));
  r.points.forEach((pt, i) => { const w = worldPoint(r, i); lines.push(["PT", n(w.x), n(w.z), o(pt.depth), o(pt.window?.period), o(pt.window?.open)].join("\t")); });
  for (const s of r.shortcuts) { const v = pointWorld(r.area, s.via); lines.push(["SC", n(s.at), n(v.x), n(v.z), n(s.skipTo)].join("\t")); }
  for (const ob of raceObstacles(r)) lines.push(["OB", ob.id, n(ob.x), n(ob.z), n(ob.radius), n(ob.segment)].join("\t"));
  lines.push(actLine(activityById(r.id)!, r));
}
for (const c of CHAMPIONSHIPS) lines.push(["CH", c.id, c.area, c.name, n(c.rank), c.rounds.join(",")].join("\t"));

const runText = (run: RaceRun) => {
  const r = run.result;
  const res = r ? [r.valid ? 1 : 0, n(r.time), n(r.penalties), n(r.par), r.medal ?? NONE, n(r.place), n(r.field), n(r.style), r.difficulty].join("/") : NONE;
  const rec = run.recover ? `${n(run.recover.x)}/${n(run.recover.z)}/${o(run.recover.depth)}` : NONE;
  return [run.phase, n(run.wall0), n(run.countdown), n(run.time), n(run.next), run.passed.join(","), n(run.penalties), n(run.collisions), (run.hitObstacles ?? []).join(","), n(run.impact ?? 0), n(run.recoveries), n(run.outside), n(run.style), run.notice ?? NONE, run.failReason ?? NONE, run.viaShortcut ? 1 : 0, rec, res].join("|");
};
const progText = (p: PlayerProgression) => {
  const nm = (m: Record<string, number | undefined>) => Object.keys(m).filter((k) => m[k] !== undefined).sort().map((k) => `${k}:${n(m[k]!)}`).join(",");
  const runs = Object.keys(p.missionRuns).sort().map((k) => { const r = p.missionRuns[k]! as { day: string; count: number; last?: number }; return `${k}:${r.day}/${n(r.count)}/${o(r.last)}`; }).join(",");
  return `earned=[${p.earnedRewards.join(",")}];nex={${nm(p.nexLedger)}};runs={${runs}};materials={${nm(p.materials)}};xp=${n(p.xp)};level=${n(p.level)};tokens=${n(p.calibrationTokens)};nova=${n(p.novaLevel)};novaUnlocks=[${p.novaUnlocks.join(",")}]`;
};

let ticks = 0, finishes = 0, cases = 0;
const STYLES = ["clean", "clean", "shortcut", "sloppy", "wander", "wrongmode", "wreck", "slow"] as const;
for (const race of RACES) {
  for (let rep = 0; rep < 2; rep++) {
    const style = pick(STYLES);
    const diff: Difficulty = pick(DIFFICULTIES);
    let now = Date.UTC(2026, 3, 1 + Math.floor(rand() * 20), Math.floor(rand() * 24));
    // a save with some racing history: medals, a personal best, championship points, rank-gate history, reputation
    const earned: string[] = [];
    for (const r of RACES) if (rand() < 0.15) for (const m of (["bronze", "silver", "gold"] as const).slice(0, 1 + Math.floor(rand() * 3))) earned.push(`race-medal:${r.id}:${pick(DIFFICULTIES)}:${m}`);
    if (rand() < 0.4) earned.push(`race-pb:${race.id}:${diff}:${Math.round(race.par * pick([0.7, 1, 1.5]) * 1000)}`);
    for (const c of CHAMPIONSHIPS) if (c.rounds.includes(race.id) && rand() < 0.5) for (const r of c.rounds) if (r !== race.id || rand() < 0.5) earned.push(`champ:${c.id}:${r}:${pick([1, 6, 10, 15])}`);
    if (rand() < 0.3) earned.push(`rep:${activityById(race.id)!.faction}:${pick([0, 12, 140])}`);
    if (rand() < 0.2) earned.push(`rival-beat:${race.id}:${diff}:0`);
    // a near-Legend record: golds on Legendary across the board (Legend also needs two championships)
    if (rand() < 0.12) { for (const r of RACES.slice(0, 16)) earned.push(`race-medal:${r.id}:legendary:gold`); if (rand() < 0.5) earned.push(`champ-done:${CHAMPIONSHIPS[0]!.id}`, `champ-done:${CHAMPIONSHIPS[1]!.id}`); }
    const missionRuns: PlayerProgression["missionRuns"] = {};
    if (rand() < 0.4) missionRuns[`act:${race.id}`] = { day: new Date(now).toISOString().slice(0, 10), count: pick([0, 1, 2, 3]), ...(rand() < 0.5 ? { last: now - pick([60_000, 3_600_000]) } : {}) } as never;
    if (race.hidden && rand() < 0.6) for (const m of race.hidden.markers) missionRuns[`act:d-${m}`] = { day: "2026-01-01", count: 1 } as never;
    let p: PlayerProgression = { ...DEFAULT_PROGRESSION, earnedRewards: earned, missionRuns, nexLedger: rand() < 0.5 ? { seed: 500 } : {}, materials: {}, xp: Math.floor(rand() * 500), level: 1 + Math.floor(rand() * 10) };
    lines.push(["CASE", `${race.id}-${rep}-${style}`].join("\t"));
    for (const k of p.earnedRewards) lines.push(["PER", k].join("\t"));
    for (const [k, r] of Object.entries(p.missionRuns)) { const rr = r as { day: string; count: number; last?: number }; lines.push(["PRUN", k, rr.day, n(rr.count), o(rr.last)].join("\t")); }
    for (const [k, v] of Object.entries(p.nexLedger)) lines.push(["PNEX", k, n(v)].join("\t"));
    lines.push(["PX", n(p.xp), n(p.level), n(p.calibrationTokens), n(p.novaLevel)].join("\t"));
    cases++;

    const def = activityById(race.id)!;
    const started = startActivity(p, race.id, now, diff);
    const st = activityState(p, def, now);
    lines.push(["START", race.id, n(now), diff].join("\t"));
    lines.push(["SR", "error" in started ? `0|${started.error}|${n(st.attemptsLeft)}|${n(st.cooldownLeftMs)}` : `1|~|${n(st.attemptsLeft)}|${n(st.cooldownLeftMs)}`].join("\t"));
    // a run regardless: a blocked start still tests tickRace (the host would not show it)
    const actRun: Run = "error" in started ? ({ id: race.id, startedAt: now, status: "active", difficulty: diff } as Run) : started.run;
    if (!("error" in started)) p = started.progression;
    lines.push(`L\t${progText(p)}`);
    const run = newRaceRun(race, diff, now);
    lines.push(["RT", diff, rivalTimes(race, diff).map(n).join(",")].join("\t"));

    // drive the course
    let x = worldPoint(race, 0).x + pick([0, 20, 45]), z = worldPoint(race, 0).z;
    const mode = style === "wrongmode" ? (race.mode === "foot" ? "vehicle" : "foot") : race.mode;
    const speed = { foot: 9, vehicle: 30, dive: 14 }[race.mode] * (style === "slow" ? 0.35 : 1);
    let lastSig = "";
    for (let k = 0; k < 1600 && run.phase !== "finished" && run.phase !== "failed"; k++) {
      const dt = pick([0.05, 0.1, 0.2, 0.3]);
      now += dt * 1000 + (rand() < 0.01 ? pick([2000, 60_000]) : 0);
      const target = run.phase === "staging" || run.phase === "countdown" ? worldPoint(race, 0)
        : style === "shortcut" && race.shortcuts.some((s) => s.at === run.next) ? pointWorld(race.area, race.shortcuts.find((s) => s.at === run.next)!.via) : worldPoint(race, run.next);
      const stay = run.phase === "countdown";
      if (!stay) {
        const dx = target.x - x, dz = target.z - z, d = Math.hypot(dx, dz) || 1, step = Math.min(d, speed * dt);
        x += (dx / d) * step; z += (dz / d) * step;
        if (style === "sloppy" || style === "wander") { x += (rand() - 0.5) * (style === "wander" ? 30 : 6); z += (rand() - 0.5) * (style === "wander" ? 30 : 6); }
      }
      if (style === "wander" && rand() < 0.01) { x += 150; }
      const tick = {
        x, z, dt, now, mode: mode as RaceDef["mode"],
        y: race.mode === "dive" ? (worldPoint(race, run.next).depth ?? -10) + pick([0, 2, 7.5, 8.5, 9]) : undefined,
        vehicleDisabled: style === "wreck" && rand() < 0.01, fell: rand() < 0.003, collisions: rand() < 0.02 ? 1 : 0, style: race.style ? pick([0, 0, 1, 3]) : 0,
      };
      tickRace(race, run, tick);
      lines.push(["TICK", n(x), n(z), n(dt), n(now), mode, o(tick.y), tick.vehicleDisabled ? "1" : "0", tick.fell ? "1" : "0", n(tick.collisions), n(tick.style)].join("\t"));
      // the state every 4th tick and whenever something happened (phase, gate, notice, recovery)
      const text = runText(run), sig = `${run.phase}|${run.next}|${run.notice}|${run.recoveries}|${run.collisions}`;
      if (k % 4 === 0 || sig !== lastSig || run.recover) lines.push(`X\t${text}`);
      lastSig = sig;
      if (run.recover) { x = run.recover.x; z = run.recover.z; lines.push(["RECOVERED"].join("\t")); run.recover = null; }
      ticks++;
      if (run.phase === "running" && rand() < 0.03) {
        const lp = livePlace(race, run, x, z), rp = rivalPositions(race, run.difficulty, run.time);
        lines.push(["RP", n(x), n(z), `${lp.place}/${lp.field}|${rp.map((q) => `${n(q.x)}/${n(q.z)}/${o(q.depth)}/${n(q.progress)}`).join(";")}`].join("\t"));
      }
    }
    if (run.phase === "finished") finishes++;
    // save the result: racing records, then the activity payout
    (actRun as Run & { race?: unknown }).race = run;
    if (run.phase === "finished" && run.result?.valid) actRun.status = "complete";
    const applied = applyRaceResult(p, def, actRun);
    lines.push(["APPLY", race.id, n(def.rewards.nex), n(actRun.startedAt)].join("\t"));
    if ("error" in applied) lines.push(["AR", `0|${applied.error}`].join("\t"));
    else {
      const rw = applied.reward;
      p = applied.progression;
      lines.push(["AR", `1|${n(rw.nexBonus)}|${rw.personalBest ? 1 : 0}|${rw.medal ?? NONE}|${rw.newMedal ? 1 : 0}|${o(rw.championshipPoints)}|${rw.championshipDone ? 1 : 0}|${rw.rankUp ?? NONE}|${rw.rivalsFirstBeaten.join(",")}`].join("\t"));
    }
    // and a second identical claim records nothing
    if (!("error" in applied)) { const again = applyRaceResult(p, def, actRun); lines.push(["APPLY", race.id, n(def.rewards.nex), n(actRun.startedAt)].join("\t"), ["AR", "error" in again ? `0|${again.error}` : "1|?"].join("\t")); }
    lines.push(`L\t${progText(p)}`);
    lines.push(["RK", `${rankIndex(p)}|${n(racingScore(p))}|${championshipsWon(p)}`].join("\t"));
    const featured = isFeatured(def.id, actRun.startedAt);
    const done = completeActivity(p, def, actRun, now, () => 0.999999);
    lines.push(["DONE", race.id, n(now), featured ? "1" : "0"].join("\t"));
    if ("error" in done) lines.push(["DR", `0|${done.error}`].join("\t"));
    else {
      p = done.progression;
      const pay = done.payout;
      lines.push(["DR", `1|${n(pay.nex)}|${n(pay.xp)}|${n(pay.rep)}|${Object.keys(pay.materials).sort().map((k) => `${k}:${n(pay.materials[k as keyof typeof pay.materials]!)}`).join(",")}|${pay.bonus ? 1 : 0}`].join("\t"));
    }
    lines.push(`L\t${progText(p)}`);
    // the state right after: attempts and cooldown
    const after = activityState(p, def, now + 1000);
    lines.push(["STATE", race.id, n(now + 1000), `${after.available ? 1 : 0}|${after.reason ?? NONE}|${n(after.attemptsLeft)}|${n(after.cooldownLeftMs)}`].join("\t"));
  }
}
// the activity engine on its own: every board activity and weekly elite (attempts, weekly periods, reputation gates,
// the Killbox taper, challenges, featured bonus, the one-time forge catalyst)
for (const def of [...ACTIVITIES.filter((a) => !isRaceActivity(a)), ...ELITES]) {
  for (let rep = 0; rep < 3; rep++) {
    let now = Date.UTC(2026, 4, 1 + Math.floor(rand() * 25), Math.floor(rand() * 24));
    const fe = featuredFor(now);
    if (rand() < 0.5 && fe.length) { /* run a featured one on this day */ }
    const earned: string[] = rand() < 0.5 ? [`rep:${def.faction}:${pick([0, 10, 29, 30, 60])}`] : [];
    if (rand() < 0.3) earned.push(`activity-first-catalyst:${def.id}`);
    const missionRuns: PlayerProgression["missionRuns"] = {};
    if (rand() < 0.6) missionRuns[`act:${def.id}`] = { day: def.period === "week" ? `w${weekKeyUtc(now)}` : new Date(now).toISOString().slice(0, 10), count: pick([0, 1, 2, 5, 6, 9]), ...(rand() < 0.6 ? { last: now - pick([60_000, 1_800_000, 7_200_000]) } : {}) } as never;
    let p: PlayerProgression = { ...DEFAULT_PROGRESSION, earnedRewards: earned, missionRuns, nexLedger: {}, materials: {}, xp: Math.floor(rand() * 500), level: 1 + Math.floor(rand() * 10) };
    lines.push(["CASE", `${def.id}-${rep}`].join("\t"));
    for (const k of p.earnedRewards) lines.push(["PER", k].join("\t"));
    for (const [k, r] of Object.entries(p.missionRuns)) { const rr = r as { day: string; count: number; last?: number }; lines.push(["PRUN", k, rr.day, n(rr.count), o(rr.last)].join("\t")); }
    lines.push(["PX", n(p.xp), n(p.level), n(p.calibrationTokens), n(p.novaLevel)].join("\t"));
    const limit = def.stages.reduce((s2, st) => s2 + ("timeLimit" in st ? (st as { timeLimit: number }).timeLimit : 0), 0);
    const mats = Object.entries(def.rewards.materials).map(([k, v]) => `${k}:${n(v!)}`).join(",") || NONE;
    lines.push(["ACT", def.id, def.kind, def.faction, def.period ?? NONE, n(def.attempts), n(def.cooldownMin), n(def.minRep ?? 0), def.challenge?.id ?? NONE, n(limit), n(def.rewards.nex), n(def.rewards.xp), n(def.rewards.rep), n(def.rewards.shaderChance), mats, NONE].join("\t"));
    const st0 = activityState(p, def, now);
    const started = startActivity(p, def.id, now);
    lines.push(["ASTART", def.id, n(now)].join("\t"), ["SR", "error" in started ? `0|${started.error}|${n(st0.attemptsLeft)}|${n(st0.cooldownLeftMs)}` : `1|~|${n(st0.attemptsLeft)}|${n(st0.cooldownLeftMs)}`].join("\t"));
    const run: Run = "error" in started ? ({ id: def.id, startedAt: now } as Run) : started.run;
    if (!("error" in started)) p = started.progression;
    run.status = rand() < 0.85 ? "complete" : "active";
    run.wasHurt = rand() < 0.4; run.diedDuring = rand() < 0.2;
    const end = now + (limit ? limit * 1000 * pick([0.3, 0.6, 0.61, 1]) : 30_000);
    lines.push(["ARUN", run.status, run.wasHurt ? "1" : "0", run.diedDuring ? "1" : "0"].join("\t"));
    const featured = isFeatured(def.id, run.startedAt);
    const done = completeActivity(p, def, run, end, () => 0.999999);
    lines.push(["DONE", def.id, n(end), featured ? "1" : "0"].join("\t"));
    if ("error" in done) lines.push(["DR", `0|${done.error}`].join("\t"));
    else {
      p = done.progression;
      const pay = done.payout;
      lines.push(["DR", `1|${n(pay.nex)}|${n(pay.xp)}|${n(pay.rep)}|${Object.keys(pay.materials).sort().map((k) => `${k}:${n(pay.materials[k as keyof typeof pay.materials]!)}`).join(",")}|${pay.bonus ? 1 : 0}`].join("\t"));
    }
    lines.push(`L\t${progText(p)}`);
    const after = activityState(p, def, end + 1000);
    lines.push(["STATE", def.id, n(end + 1000), `${after.available ? 1 : 0}|${after.reason ?? NONE}|${n(after.attemptsLeft)}|${n(after.cooldownLeftMs)}`].join("\t"));
    void now;
  }
}
// featured days: complete each featured activity of a few days so the 1.5x bonus is exercised
for (let dayN = 0; dayN < 6; dayN++) {
  const now = Date.UTC(2026, 5, 1 + dayN, 9);
  for (const def of featuredFor(now)) {
    let p: PlayerProgression = { ...DEFAULT_PROGRESSION, earnedRewards: [], missionRuns: {}, nexLedger: {}, materials: {} };
    lines.push(["CASE", `featured-${dayN}-${def.id}`].join("\t"), ["PX", n(p.xp), n(p.level), n(p.calibrationTokens), n(p.novaLevel)].join("\t"));
    const limit = def.stages.reduce((s2, st) => s2 + ("timeLimit" in st ? (st as { timeLimit: number }).timeLimit : 0), 0);
    const mats = Object.entries(def.rewards.materials).map(([k, v]) => `${k}:${n(v!)}`).join(",") || NONE;
    lines.push(["ACT", def.id, def.kind, def.faction, def.period ?? NONE, n(def.attempts), n(def.cooldownMin), n(def.minRep ?? 0), def.challenge?.id ?? NONE, n(limit), n(def.rewards.nex), n(def.rewards.xp), n(def.rewards.rep), n(def.rewards.shaderChance), mats, NONE].join("\t"));
    const started = startActivity(p, def.id, now);
    if ("error" in started) continue;
    lines.push(["ASTART", def.id, n(now)].join("\t"), ["SR", `1|~|${n(activityState(p, def, now).attemptsLeft)}|${n(activityState(p, def, now).cooldownLeftMs)}`].join("\t"));
    p = started.progression;
    const run = started.run; run.status = "complete";
    lines.push(["ARUN", "complete", "0", "0"].join("\t"));
    const done = completeActivity(p, def, run, now + 60_000, () => 0.999999);
    lines.push(["DONE", def.id, n(now + 60_000), isFeatured(def.id, run.startedAt) ? "1" : "0"].join("\t"));
    if (!("error" in done)) { p = done.progression; const pay = done.payout; lines.push(["DR", `1|${n(pay.nex)}|${n(pay.xp)}|${n(pay.rep)}|${Object.keys(pay.materials).sort().map((k) => `${k}:${n(pay.materials[k as keyof typeof pay.materials]!)}`).join(",")}|${pay.bonus ? 1 : 0}`].join("\t")); }
    else lines.push(["DR", `0|${done.error}`].join("\t"));
    lines.push(`L\t${progText(p)}`);
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`${RACES.length} races, ${CHAMPIONSHIPS.length} championships, ${cases} runs, ${ticks} ticks, ${finishes} finished -> ${OUT}`);
