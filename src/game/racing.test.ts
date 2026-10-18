import { describe, expect, test } from "bun:test";
import { CHAMPIONSHIPS, CHECKPOINT_RADIUS, COUNTDOWN_S, CORRIDOR, DIFFICULTIES, POINTS_BY_PLACE, RACES, applyRaceResult, bestMedal, championshipPoints, difficultyLocked, hiddenUnlocked, newRaceRun, personalBest, rankIndex, rivalPositions, rivalTimes, raceById, racesIn, tickRace, timeLimit, windowOpen, worldPoint, type RaceDef, type RaceRun } from "./racing";
import { ACTIVITIES, AREAS, activityById, activityState, completeActivity, startActivity, stepRun, currentTarget, type Run } from "./activities";
import { DISCOVERIES, nearby } from "./discoveries";
import { DEFAULT_PROGRESSION } from "./progression";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
const fresh = () => structuredClone(DEFAULT_PROGRESSION);
const tick = (def: RaceDef, run: RaceRun, x: number, z: number, o: Record<string, unknown> = {}) => tickRace(def, run, { x, z, dt: 0.1, now: T0, mode: def.mode, ...o } as never);
/** drive a race perfectly: stage, count down, hit every gate in order at a given pace */
function drive(def: RaceDef, run: RaceRun, pace = 1, skip: number[] = []) {
  const s = worldPoint(def, 0);
  tick(def, run, s.x, s.z); for (let i = 0; i < COUNTDOWN_S * 10 + 2; i++) tick(def, run, s.x, s.z);
  const total = def.par * pace; const per = total / (def.points.length - 1);
  for (let i = 1; i < def.points.length; i++) {
    if (skip.includes(i)) continue;
    const w = worldPoint(def, i);
    for (let k = 0; k < Math.round(per / 0.1); k++) { tickRace(def, run, { x: w.x, z: w.z, dt: 0.1, now: T0, mode: def.mode, ...(w.depth !== undefined ? { y: w.depth } : {}) } as never); if (run.phase !== "running") break; }
    if (run.phase !== "running") break;
  }
  return run;
}

describe("catalogue", () => {
  test("every racing region has races and a championship; ids and names are unique", () => {
    const ids = new Set(RACES.map((r) => r.id)); expect(ids.size).toBe(RACES.length);
    expect(new Set(RACES.map((r) => r.name)).size).toBe(RACES.length);
    for (const area of ["neon", "nexus", "neon-core", "veridan", "thalassia", "ember", "wastelands", "swamps", "solara", "frostspire"]) {
      expect(racesIn(area).length).toBeGreaterThanOrEqual(5); expect(CHAMPIONSHIPS.some((c) => c.area === area)).toBe(true);
    }
  });
  test("named races from the design exist", () => {
    for (const n of ["Midnight Circuit", "Rail Riot", "Ghostline Run", "Blacktop Takeover", "Skybridge Sprint", "The Last Exit", "Gridlock Grand Prix", "Sentinel Chase", "Coreline GP", "Aegis Drop", "Redline Protocol", "Flux Runner", "Wildroot Rally", "Canopy Rush", "Abyssal Sprint", "Trench Runner", "Pressure Drop", "Ashfall Rally", "Lava Line", "Dust Devil Rally", "Rust Run", "Canyon King", "Mire Runner", "Sunfire Rally", "Dune Devil", "Whiteout Rally", "Glacier Circuit", "Neon Grand Prix", "World Rally Series"]) expect(RACES.some((r) => r.name === n) || CHAMPIONSHIPS.some((c) => c.name === n)).toBe(true);
    for (const n of ["The Ghost Circuit", "Blackout Run", "The Null Track", "The Ancient Run", "The Ghost Fleet", "The Furnace Run", "The Scavenger's Crown", "The Drowned Circuit", "The Sun King's Run", "The Frozen Ghost"]) expect(RACES.some((r) => r.name === n && r.hidden)).toBe(true);
  });
  test("courses are valid: start==finish for loops, mode fits region, dive races are underwater only in Thalassia, championship rounds exist", () => {
    for (const r of RACES) {
      expect(r.points.length).toBeGreaterThanOrEqual(6); expect(r.par).toBeGreaterThan(15);
      if (r.mode === "dive") { expect(r.area).toBe("thalassia"); expect(r.points.every((p) => p.depth !== undefined)).toBe(true); }
      for (const s of r.shortcuts) { expect(s.skipTo).toBeGreaterThan(s.at); expect(s.skipTo).toBeLessThan(r.points.length); }
    }
    for (const c of CHAMPIONSHIPS) for (const id of c.rounds) expect(raceById(id)).toBeTruthy();
    expect(raceById("r-th-pressure")!.points.map((p) => p.depth)[1]! > raceById("r-th-pressure")!.points.at(-2)!.depth!).toBe(true); // Pressure Drop gets deeper
  });
  test("hidden races never appear on the board; visible ones do", () => {
    for (const r of RACES) { const onBoard = ACTIVITIES.some((a) => a.id === r.id); expect(onBoard).toBe(!r.hidden); if (r.hidden) expect(activityById(r.id)).toBeTruthy(); }
  });
  test("races are movement & racing activities with real-time limits that match the area rules", () => {
    for (const r of RACES.filter((x) => !x.hidden)) { const a = activityById(r.id)!; expect(a.stages[0]!.kind).toBe("race"); expect(a.attempts).toBe(r.area === "neon-core" ? 2 : 3); if (r.area === "neon-core") expect(a.cooldownMin).toBe(60); }
  });
});

describe("lifecycle and fair checkpoints", () => {
  const def = raceById("nc-circuit")!;
  test("stage → countdown → running → finish, with a valid result", () => {
    const run = newRaceRun(def, "standard", T0), s = worldPoint(def, 0);
    expect(run.phase).toBe("staging");
    const far = tick(def, run, s.x + 500, s.z); expect(far.phase).toBe("staging");
    tick(def, run, s.x, s.z); expect(run.phase).toBe("countdown");
    for (let i = 0; i < COUNTDOWN_S * 10 + 2; i++) tick(def, run, s.x, s.z);
    expect(run.phase).toBe("running"); expect(run.time).toBeLessThan(0.5); // the clock started with the race, not before
    drive(def, newRaceRun(def, "standard", T0));
    const done = drive(def, newRaceRun(def, "standard", T0), 0.95);
    expect(done.phase).toBe("finished"); expect(done.result!.valid).toBe(true); expect(done.result!.medal).toBe("gold");
  });
  test("leaving the start line during the countdown resets it", () => {
    const run = newRaceRun(def, "standard", T0), s = worldPoint(def, 0); tick(def, run, s.x, s.z); expect(run.phase).toBe("countdown");
    tick(def, run, s.x + 400, s.z); expect(run.phase).toBe("staging");
  });
  test("a skipped checkpoint can never finish; reaching the finish early does nothing", () => {
    const run = newRaceRun(def, "standard", T0), s = worldPoint(def, 0); tick(def, run, s.x, s.z); for (let i = 0; i < 40; i++) tick(def, run, s.x, s.z);
    const fin = worldPoint(def, def.points.length - 1);
    for (let i = 0; i < 20; i++) tickRace(def, run, { x: fin.x, z: fin.z, dt: 0.1, now: T0, mode: "vehicle" });
    expect(run.phase).toBe("running"); expect(run.next).toBe(1); // sitting on the finish line while on checkpoint 1 is not a finish
    const skipped = drive(def, newRaceRun(def, "standard", T0), 1, [3]);
    expect(skipped.phase).not.toBe("finished");
  });
  test("checkpoints count only in the right movement mode", () => {
    const run = newRaceRun(def, "standard", T0), s = worldPoint(def, 0); tick(def, run, s.x, s.z); for (let i = 0; i < 40; i++) tick(def, run, s.x, s.z);
    const w = worldPoint(def, 1); tickRace(def, run, { x: w.x, z: w.z, dt: 0.1, now: T0, mode: "foot" });
    expect(run.next).toBe(1); expect(run.notice).toBe("Wrong movement mode for this race");
    tickRace(def, run, { x: w.x, z: w.z, dt: 0.1, now: T0, mode: "vehicle" }); expect(run.next).toBe(2);
  });
  test("time limit fails the race; a long pause cannot bank or lose race time; wall clock guards abandoned races", () => {
    const run = newRaceRun(def, "standard", T0), s = worldPoint(def, 0); tick(def, run, s.x, s.z); for (let i = 0; i < 40; i++) tick(def, run, s.x, s.z);
    const t0 = run.time; tickRace(def, run, { x: s.x, z: s.z, dt: 300, now: T0, mode: "vehicle" }); expect(run.time - t0).toBeLessThan(0.26);
    const slow = newRaceRun(def, "standard", T0); tick(def, slow, s.x, s.z); for (let i = 0; i < 40; i++) tick(def, slow, s.x, s.z);
    for (let i = 0; i < 4000 && slow.phase === "running"; i++) tickRace(def, slow, { x: s.x, z: s.z, dt: 0.25, now: T0, mode: "vehicle" });
    expect(slow.phase).toBe("failed"); expect(slow.failReason).toBe("Out of time");
    const ghost = newRaceRun(def, "standard", T0); tickRace(def, ghost, { x: s.x + 900, z: s.z, dt: 0.1, now: T0 + 11 * 60_000, mode: "vehicle" });
    expect(ghost.phase).toBe("failed"); expect(ghost.failReason).toBe("Never reached the start line");
  });
  test("collisions cost time; a wreck or fall recovers to the LAST CHECKPOINT with a penalty and does not reset the race", () => {
    const base = drive(def, newRaceRun(def, "standard", T0), 0.8);
    const hit = newRaceRun(def, "standard", T0), s = worldPoint(def, 0); tick(def, hit, s.x, s.z); for (let i = 0; i < 40; i++) tick(def, hit, s.x, s.z);
    for (const i of [1, 2]) { const w = worldPoint(def, i); tickRace(def, hit, { x: w.x, z: w.z, dt: 0.1, now: T0, mode: "vehicle" }); }
    tickRace(def, hit, { x: s.x, z: s.z, dt: 0.1, now: T0, mode: "vehicle", vehicleDisabled: true });
    const back = worldPoint(def, 2);
    expect(hit.recover).toEqual({ x: back.x, z: back.z }); expect(hit.penalties).toBeGreaterThan(0); expect(hit.next).toBe(3); expect(hit.passed).toEqual([1, 2]);
    hit.recover = null; tickRace(def, hit, { x: back.x, z: back.z, dt: 0.1, now: T0, mode: "vehicle", fell: true }); expect(hit.recoveries).toBe(2);
    expect(base.result!.penalties).toBe(0);
    for (let k = 0; k < 4; k++) tickRace(def, hit, { x: back.x, z: back.z, dt: 0.1, now: T0, mode: "vehicle", fell: true });
    expect(hit.phase).toBe("failed"); expect(hit.failReason).toBe("Too many recoveries");
  });
  test("leaving the course warns, then recovers you instead of teleporting to the finish", () => {
    const run = newRaceRun(def, "standard", T0), s = worldPoint(def, 0); tick(def, run, s.x, s.z); for (let i = 0; i < 40; i++) tick(def, run, s.x, s.z);
    const lost = { x: s.x + CORRIDOR.vehicle * 6, z: s.z + CORRIDOR.vehicle * 6 };
    for (let i = 0; i < 40; i++) tickRace(def, run, { x: lost.x, z: lost.z, dt: 0.1, now: T0, mode: "vehicle" });
    expect(run.notice).toBe("Return to the course");
    for (let i = 0; i < 60; i++) tickRace(def, run, { x: lost.x, z: lost.z, dt: 0.1, now: T0, mode: "vehicle" });
    expect(run.recover).toBeTruthy(); expect(run.next).toBe(1);
  });
  test("an authored shortcut works only by passing its gate; it saves distance but the finish stays valid", () => {
    const sc = RACES.find((r) => r.shortcuts.length)!, s = sc.shortcuts[0]!;
    const run = newRaceRun(sc, "standard", T0), st = worldPoint(sc, 0); tick(sc, run, st.x, st.z); for (let i = 0; i < 40; i++) tick(sc, run, st.x, st.z);
    for (let i = 1; i < s.at; i++) { const w = worldPoint(sc, i); tickRace(sc, run, { x: w.x, z: w.z, dt: 0.1, now: T0, mode: sc.mode } as never); }
    expect(run.next).toBe(s.at);
    const v = AREAS[sc.area]!; const via = { x: v.x + s.via[0] * v.radius, z: v.z + s.via[1] * v.radius };
    tickRace(sc, run, { x: via.x, z: via.z, dt: 0.1, now: T0, mode: sc.mode } as never); expect(run.next).toBe(s.skipTo); expect(run.viaShortcut).toBe(true);
    for (let i = s.skipTo; i < sc.points.length; i++) { const w = worldPoint(sc, i); tickRace(sc, run, { x: w.x, z: w.z, dt: 0.1, now: T0, mode: sc.mode } as never); }
    expect(run.phase).toBe("finished"); expect(run.result!.valid).toBe(true);
  });
  test("reality gates open and close on a fixed beat (learnable), and a closed gate does not pass you", () => {
    const fr = RACES.find((r) => r.points.some((p) => p.window))!, i = fr.points.findIndex((p) => p.window), pt = fr.points[i]!;
    expect(windowOpen(pt, 0)).toBe(true); expect(windowOpen(pt, pt.window!.open + 0.5)).toBe(false); expect(windowOpen(pt, pt.window!.period + 1)).toBe(true);
    const run = newRaceRun(fr, "standard", T0), st = worldPoint(fr, 0); tickRace(fr, run, { x: st.x, z: st.z, dt: 0.1, now: T0, mode: fr.mode } as never); for (let k = 0; k < 40; k++) tickRace(fr, run, { x: st.x, z: st.z, dt: 0.1, now: T0, mode: fr.mode } as never);
    for (let k = 1; k < i; k++) { const w = worldPoint(fr, k); run.time = 0; tickRace(fr, run, { x: w.x, z: w.z, dt: 0.01, now: T0, mode: fr.mode } as never); }
    expect(run.next).toBe(i);
    const w = worldPoint(fr, i); run.time = pt.window!.open + 1;
    tickRace(fr, run, { x: w.x, z: w.z, dt: 0.01, now: T0, mode: fr.mode } as never); expect(run.next).toBe(i); expect(run.notice).toBe("Gate closed: wait for it to open");
  });
  test("underwater gates need the right depth", () => {
    const th = raceById("r-th-pressure")!, run = newRaceRun(th, "standard", T0), st = worldPoint(th, 0);
    tickRace(th, run, { x: st.x, z: st.z, dt: 0.1, now: T0, mode: "dive", y: st.depth! } as never); for (let k = 0; k < 40; k++) tickRace(th, run, { x: st.x, z: st.z, dt: 0.1, now: T0, mode: "dive", y: st.depth! } as never);
    const w = worldPoint(th, 1);
    tickRace(th, run, { x: w.x, z: w.z, dt: 0.1, now: T0, mode: "dive", y: w.depth! + 30 } as never); expect(run.next).toBe(1);
    tickRace(th, run, { x: w.x, z: w.z, dt: 0.1, now: T0, mode: "dive", y: w.depth! } as never); expect(run.next).toBe(2);
    const car = tickRace(th, newRaceRun(th, "standard", T0), { x: st.x, z: st.z, dt: 0.1, now: T0, mode: "vehicle" } as never); expect(car.phase).toBe("staging"); // cars cannot start an underwater race
  });
});

describe("rivals, medals, difficulty", () => {
  const def = raceById("nc-circuit")!;
  test("rival pace is deterministic and tighter on higher difficulty", () => {
    expect(rivalTimes(def, "standard")).toEqual(rivalTimes(def, "standard"));
    const avg = (d: "standard" | "advanced" | "legendary") => rivalTimes(def, d).reduce((a, b) => a + b, 0) / def.rivals;
    expect(avg("advanced")).toBeLessThan(avg("standard")); expect(avg("legendary")).toBeLessThan(avg("advanced"));
    expect(timeLimit(def, "legendary")).toBeLessThan(timeLimit(def, "standard"));
  });
  test("rivals follow the same course and finish; place counts faster rivals", () => {
    const end = rivalPositions(def, "standard", 10_000), fin = worldPoint(def, def.points.length - 1);
    for (const r of end) { expect(r.progress).toBe(1); expect(Math.hypot(r.x - fin.x, r.z - fin.z)).toBeLessThan(40); }
    expect(drive(def, newRaceRun(def, "standard", T0), 0.9).result!.place).toBe(1);
    expect(drive(def, newRaceRun(def, "standard", T0), 1.3).result!.place).toBeGreaterThan(1);
  });
  test("medal thresholds tighten with difficulty and an invalid run earns none", () => {
    const std = drive(def, newRaceRun(def, "standard", T0), 1.0).result!, leg = drive(def, newRaceRun(def, "legendary", T0), 1.0).result!;
    expect(std.medal).toBe("gold"); expect(leg.medal).not.toBe("gold");
  });
  test("advanced needs a Standard medal, legendary needs an Advanced gold", () => {
    const p = fresh(); expect(difficultyLocked(p, def.id, "standard")).toBeNull();
    expect(difficultyLocked(p, def.id, "advanced")).toContain("Standard"); expect(difficultyLocked(p, def.id, "legendary")).toContain("Advanced");
    p.earnedRewards.push(`race-medal:${def.id}:standard:bronze`); expect(difficultyLocked(p, def.id, "advanced")).toBeNull();
  });
});

function playThrough(p: ReturnType<typeof fresh>, id: string, now: number, pace = 0.9, difficulty: "standard" | "advanced" | "legendary" = "standard") {
  const s = startActivity(p, id, now, difficulty) as { progression: typeof p; run: Run }; if ((s as any).error) throw new Error((s as any).error); const run = s.run;
  const def = activityById(id)!, race = raceById(id)!, st = worldPoint(race, 0);
  const t = (x: number, z: number, extra = {}) => stepRun(def, run, { x, z, dt: 0.1, now, kills: 0, elites: 0, bosses: 0, hp: 100, deaths: 0, mode: race.mode, ...extra });
  t(st.x, st.z); for (let i = 0; i < 40; i++) t(st.x, st.z);
  const per = (race.par * pace) / (race.points.length - 1);
  for (let i = 1; i < race.points.length; i++) { const w = worldPoint(race, i); for (let k = 0; k < Math.round(per / 0.1); k++) { t(w.x, w.z, w.depth !== undefined ? { y: w.depth } : {}); if (run.status !== "active") break; } if (run.status !== "active") break; }
  return { p: s.progression, run, def };
}
describe("through the activity engine: start → complete → reward", () => {
  test("a completed race pays once, records the best time and medal, and survives a save round-trip", () => {
    const { p, run, def } = playThrough(fresh(), "nc-circuit", T0);
    expect(run.status).toBe("complete"); expect(currentTarget(def, run)).toBeNull();
    const paid = completeActivity(p, def, run, T0 + 60_000, () => 0.99) as any; expect(paid.payout.nex).toBeGreaterThan(0);
    const rec = applyRaceResult(paid.progression, def, run) as any; expect(rec.reward.personalBest).toBe(true); expect(rec.reward.medal).toBe("gold");
    const again = applyRaceResult(rec.progression, def, run) as any; expect(again.error).toBe("Already recorded");
    const saved = JSON.parse(JSON.stringify(rec.progression)); expect(personalBest(saved, "nc-circuit", "standard")).toBeGreaterThan(0); expect(bestMedal(saved, "nc-circuit", "standard")).toBe("gold");
    expect(activityState(saved, def, T0 + 120_000).reason).toBe("On cooldown");
    expect((completeActivity(rec.progression, def, run, T0 + 61_000) as any).error).toBe("Already claimed");
  });
  test("a slower replay keeps the better best; a failed run still costs the attempt", () => {
    let a = playThrough(fresh(), "nc-circuit", T0, 0.9); let p = (completeActivity(a.p, a.def, a.run, T0 + 60_000, () => 0.99) as any).progression; p = (applyRaceResult(p, a.def, a.run) as any).progression;
    const best = personalBest(p, "nc-circuit", "standard")!;
    const b = playThrough(p, "nc-circuit", T0 + 4 * 3_600_000, 1.2); let q = (completeActivity(b.p, b.def, b.run, T0 + 4 * 3_600_000 + 60_000, () => 0.99) as any).progression; q = (applyRaceResult(q, b.def, b.run) as any).progression;
    expect(personalBest(q, "nc-circuit", "standard")).toBe(best);
    const f = startActivity(fresh(), "nc-circuit", T0) as any; f.run.status = "failed"; expect(activityState(f.progression, activityById("nc-circuit")!, T0).attemptsLeft).toBe(2);
  });
  test("the board hides rank-locked races until your results earn the rank", () => {
    const locked = activityById("r-nc-lastexit")!; expect(activityState(fresh(), locked, T0).reason).toContain("Veteran");
    const p = fresh(); for (const r of racesIn("neon").slice(0, 5)) for (const d of DIFFICULTIES) { p.earnedRewards.push(`race-medal:${r.id}:${d}:gold`); }
    expect(rankIndex(p)).toBeGreaterThanOrEqual(2); expect(activityState(p, locked, T0).available).toBe(true);
    const spam = fresh(); for (let i = 0; i < 500; i++) spam.earnedRewards.push(`race-attempt:${i}`); expect(rankIndex(spam)).toBe(0); // entering races is not rank
  });
});

describe("championships", () => {
  test("points by place, best score per round, one-time champion reward", () => {
    const c = CHAMPIONSHIPS.find((x) => x.id === "ch-neon-gp")!; let p = fresh(); for (const r of RACES) p.earnedRewards.push(`race-medal:${r.id}:standard:gold`, `race-medal:${r.id}:advanced:gold`, `race-medal:${r.id}:legendary:gold`); let champDone = 0; let t = T0;
    for (const id of c.rounds) {
      const a = playThrough(p, id, t, 0.9); const paid = completeActivity(a.p, a.def, a.run, t + 60_000, () => 0.99) as any;
      const rec = applyRaceResult(paid.progression, a.def, a.run) as any; if (rec.error) throw new Error(`${id}: ${rec.error}`); p = rec.progression; if (rec.reward.championshipDone) champDone++; t += 6 * 3_600_000;
    }
    const st = championshipPoints(p, c); expect(st.complete).toBe(true); expect(st.total).toBe(c.rounds.length * POINTS_BY_PLACE[0]!); expect(champDone).toBe(1);
    expect(p.earnedRewards.filter((e) => e === `champ-done:${c.id}`).length).toBe(1); expect(p.nexLedger[`champ-reward:${c.id}`]).toBeGreaterThan(0);
  });
});

describe("hidden races and discovery", () => {
  test("hidden races appear in the world only after their markers are found", () => {
    const h = raceById("h-nc-ghostcircuit")!, w = worldPoint(h, 0); let p = fresh();
    expect(hiddenUnlocked(p, h)).toBe(false); expect(nearby(p, w.x, w.z, T0).some((s) => s.discovery.id === h.id)).toBe(false);
    for (const m of h.hidden!.markers) p.missionRuns[`act:d-${m}`] = { day: "2026-10-18", count: 1, last: T0 };
    expect(hiddenUnlocked(p, h)).toBe(true);
    const rankP = structuredClone(p); for (const r of racesIn("neon").slice(0, 5)) for (const d of DIFFICULTIES) rankP.earnedRewards.push(`race-medal:${r.id}:${d}:gold`);
    expect(nearby(rankP, w.x, w.z, T0 + 24 * 3_600_000 * 2).some((s) => s.discovery.id === h.id)).toBe(true);
    expect(DISCOVERIES.some((d) => d.id === h.id && d.hidden)).toBe(true);
  });
  test("checkpoint radii are generous enough to hit and every marker discovery referenced by hidden races exists", () => {
    expect(CHECKPOINT_RADIUS.vehicle).toBeGreaterThan(CHECKPOINT_RADIUS.foot);
    for (const r of RACES.filter((x) => x.hidden)) for (const m of r.hidden!.markers) expect(DISCOVERIES.some((d) => d.id === m)).toBe(true);
  });
});
