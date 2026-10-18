import { describe, expect, test } from "bun:test";
import { ACTIVITIES, AREAS, isFeatured, activityById, activityState, startActivity, stepRun, completeActivity, abandonRun, currentTarget, pointWorld, reputationOf, msUntilReset, dayKeyUtc, areaOfPoint, type Run, type Tick } from "./activities";
import { DEFAULT_PROGRESSION } from "./progression";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
const tick = (o: Partial<Tick> = {}): Tick => ({ x: 0, z: 0, dt: 0.1, now: T0, kills: 0, elites: 0, bosses: 0, hp: 100, deaths: 0, ...o });
const fresh = () => structuredClone(DEFAULT_PROGRESSION);

describe("catalogue", () => {
  test("every area has activities, ids unique, areas exist", () => {
    const ids = new Set<string>();
    for (const a of ACTIVITIES) { expect(ids.has(a.id)).toBe(false); ids.add(a.id); expect(AREAS[a.area]).toBeTruthy(); expect(a.stages.length).toBeGreaterThan(0); }
    for (const area of Object.keys(AREAS)) expect(ACTIVITIES.some((a) => a.area === area)).toBe(true);
  });
  test("attempts and cooldowns follow the design table", () => {
    for (const a of ACTIVITIES) {
      expect(a.attempts).toBeGreaterThanOrEqual(2); expect(a.attempts).toBeLessThanOrEqual(3);
      if (a.area === "neon-underground" || a.area === "neon-core") { expect(a.attempts).toBe(2); expect(a.cooldownMin).toBe(60); }
      if (a.area === "neon") { expect(a.attempts).toBe(3); expect(a.cooldownMin).toBeGreaterThanOrEqual(20); expect(a.cooldownMin).toBeLessThanOrEqual(30); }
    }
  });
  test("named activities exist", () => {
    for (const n of ["Signal Jackers", "The Black Ledger", "Pressure Line", "Abyssal Hunters", "The Silent Dock", "Convoy Breaker", "Rebel Route", "Glass Caravan", "Scale-Breakers"]) expect(ACTIVITIES.some((a) => a.name === n)).toBe(true);
  });
});

describe("real-time limits", () => {
  const def = activityById("nx-grid")!;
  test("starting consumes an attempt; failing/abandoning never refunds", () => {
    let p = fresh(); let left = activityState(p, def, T0).attemptsLeft; expect(left).toBe(3);
    const s = startActivity(p, def.id, T0); if ("error" in s) throw new Error(s.error);
    p = s.progression; expect(activityState(p, def, T0).attemptsLeft).toBe(2);
    abandonRun(s.run); expect(s.run.status).toBe("failed");
    expect(activityState(p, def, T0).attemptsLeft).toBe(2);
  });
  test("daily cap blocks only that activity; other activities stay available", () => {
    let p = fresh();
    for (let i = 0; i < 3; i++) { const s = startActivity(p, def.id, T0 + i); if ("error" in s) throw new Error(s.error); p = s.progression; }
    expect("error" in startActivity(p, def.id, T0 + 5)).toBe(true);
    expect(activityState(p, activityById("nx-sentinel")!, T0).available).toBe(true);
  });
  test("resets at 00:00 UTC and not before", () => {
    let p = fresh();
    for (let i = 0; i < 3; i++) p = (startActivity(p, def.id, T0) as any).progression;
    const justBefore = Date.UTC(2026, 9, 18, 23, 59, 59);
    expect(activityState(p, def, justBefore).attemptsLeft).toBe(0);
    expect(activityState(p, def, Date.UTC(2026, 9, 19, 0, 0, 0)).attemptsLeft).toBe(3);
    expect(msUntilReset(T0)).toBe(12 * 3600_000);
  });
  test("cooldown starts at completion, is real time, survives a clock set backwards", () => {
    let p = fresh(); const s = startActivity(p, def.id, T0) as any; p = s.progression; const run: Run = s.run; run.status = "complete";
    const done = completeActivity(p, def, run, T0 + 1000, () => 0.99) as any; p = done.progression;
    const st = activityState(p, def, T0 + 1000 + 5 * 60_000);
    expect(st.available).toBe(false); expect(st.reason).toBe("On cooldown"); expect(st.cooldownLeftMs).toBe((def.cooldownMin - 5) * 60_000);
    expect(activityState(p, def, T0 - 10 * 3600_000).cooldownLeftMs).toBe(def.cooldownMin * 60_000); // clock moved back: still a full cooldown, never extended
    expect(activityState(p, def, T0 + 1000 + def.cooldownMin * 60_000).available).toBe(true);
  });
  test("a cap on one day persists across a save round-trip", () => {
    let p = fresh(); p = (startActivity(p, def.id, T0) as any).progression;
    const back = JSON.parse(JSON.stringify(p));
    expect(activityState(back, def, T0).attemptsLeft).toBe(2);
  });
});

describe("objectives", () => {
  test("kills in order, baselined so earlier kills do not count", () => {
    const def = activityById("vf-stalker")!; const s = startActivity(fresh(), def.id, T0) as any; const run: Run = s.run;
    stepRun(def, run, tick({ kills: 50 }));
    stepRun(def, run, tick({ kills: 55 })); expect(run.progress).toBe(5);
    stepRun(def, run, tick({ kills: 56 })); expect(run.stage).toBe(1);
    stepRun(def, run, tick({ kills: 56, elites: 0 })); // re-baseline
    stepRun(def, run, tick({ kills: 57, elites: 1 })); expect(run.status).toBe("complete");
  });
  test("race gates must be hit in order and the clock fails the run", () => {
    const def = activityById("sw-track")!; const run = (startActivity(fresh(), def.id, T0) as any).run as Run;
    const o: any = def.stages[0];
    const w1 = pointWorld(def.area, o.points[1]); stepRun(def, run, tick({ x: w1.x, z: w1.z })); expect(run.cp).toBe(0);
    for (const f of o.points) { const w = pointWorld(def.area, f); stepRun(def, run, tick({ x: w.x, z: w.z })); }
    expect(run.stage).toBe(1); // all four gates hit in order moves on to the kills stage
    const late = (startActivity(fresh(), def.id, T0) as any).run as Run;
    stepRun(def, late, tick({ now: T0 + 1000 })); stepRun(def, late, tick({ now: T0 + (o.timeLimit + 1) * 1000 }));
    expect(late.status).toBe("failed"); expect(late.failReason).toBe("Out of time");
  });
  test("hold decays when leaving the zone; deliver needs pickup first", () => {
    const hd = activityById("vf-bloom")!; const hr = (startActivity(fresh(), hd.id, T0) as any).run as Run;
    const hw = pointWorld(hd.area, [0, 0]);
    for (let i = 0; i < 130; i++) stepRun(hd, hr, tick({ x: hw.x, z: hw.z, dt: 0.5 }));
    expect(hr.stage).toBe(1);
    const dd = activityById("nx-contract")!; const dr = (startActivity(fresh(), dd.id, T0) as any).run as Run;
    const o: any = dd.stages[0]; const to = pointWorld(dd.area, o.to), from = pointWorld(dd.area, o.from);
    stepRun(dd, dr, tick({ x: to.x, z: to.z })); expect(dr.status).toBe("active");
    stepRun(dd, dr, tick({ x: from.x, z: from.z })); expect(dr.carrying).toBe(true);
    expect(currentTarget(dd, dr)!.x).toBeCloseTo(to.x);
    stepRun(dd, dr, tick({ x: to.x, z: to.z })); expect(dr.status).toBe("complete");
  });
  test("areaOfPoint finds the area", () => { const a = AREAS.nexus!; expect(areaOfPoint(a.x, a.z)).toBe("nexus"); });
});

describe("rewards", () => {
  const def = activityById("sw-track")!;
  const complete = (hurt = false, now = T0 + 60_000) => { const s = startActivity(fresh(), def.id, T0) as any; const run: Run = s.run; run.status = "complete"; run.wasHurt = hurt; return { s, run, now }; };
  test("pays nex, rep, materials; bonus adds 25%", () => {
    const { s, run } = complete(); const r = completeActivity(s.progression, def, run, T0 + 60_000, () => 0.99) as any;
    expect(r.payout.bonus).toBe(true); // fast challenge met (60 s of 150 s)
    expect(r.payout.nex).toBe(Math.round(def.rewards.nex * 1.25 * (isFeatured(def.id, T0) ? 1.5 : 1)));
    expect(reputationOf(r.progression, def.faction)).toBe(r.payout.rep);
    expect(r.progression.materials.bioCatalyst).toBeGreaterThan(s.progression.materials.bioCatalyst ?? 0);
    expect(Object.values(r.progression.nexLedger).reduce((a: number, b: any) => a + b, 0)).toBe(r.payout.nex);
  });
  test("slow run gets base reward; shader drop is earned-only and not duplicated", () => {
    const { s, run } = complete(); const r = completeActivity(s.progression, def, run, T0 + 200_000, () => 0) as any;
    expect(r.payout.bonus).toBe(false); expect(r.payout.nex).toBe(Math.round(def.rewards.nex * (isFeatured(def.id, T0) ? 1.5 : 1))); expect(r.payout.shader).toBe("circuit-runner");
    const again = (startActivity(r.progression, def.id, T0 + 3_000_000) as any); const run2: Run = again.run; run2.status = "complete";
    const r2 = completeActivity(again.progression, def, run2, T0 + 3_100_000, () => 0) as any;
    expect(r2.payout.shader).not.toBe("circuit-runner");
  });
  test("incomplete run pays nothing", () => { const s = startActivity(fresh(), def.id, T0) as any; expect("error" in (completeActivity(s.progression, def, s.run, T0) as any)).toBe(true); });
  test("higher difficulty pays more than easy", () => {
    const avg = (d: number) => { const l = ACTIVITIES.filter((a) => a.difficulty === d); return l.reduce((n, a) => n + a.rewards.nex, 0) / l.length; };
    expect(avg(3)).toBeGreaterThan(avg(2)); expect(avg(4)).toBeGreaterThan(avg(3));
  });
  test("dayKey is UTC", () => { expect(dayKeyUtc(Date.UTC(2026, 9, 18, 23, 59))).toBe("2026-10-18"); });
});

import { challengesMet } from "./dragonite";
import { VYRAK_REMATCH, markCompleted } from "./activities";
describe("vyrak rematch limits", () => {
  test("2 per day, 60 min cooldown from the clear, challenges are measurable", () => {
    let p = structuredClone(DEFAULT_PROGRESSION);
    expect(activityState(p, VYRAK_REMATCH, T0).available).toBe(true);
    p = (startActivity(p, "vyrak-rematch", T0) as any).progression;
    expect(activityState(p, VYRAK_REMATCH, T0).attemptsLeft).toBe(1);
    p = markCompleted(p, VYRAK_REMATCH, T0 + 200_000);
    expect(activityState(p, VYRAK_REMATCH, T0 + 300_000).reason).toBe("On cooldown");
    expect(activityState(p, VYRAK_REMATCH, T0 + 200_000 + 61 * 60_000).available).toBe(true);
    p = (startActivity(p, "vyrak-rematch", T0 + 4_000_000) as any).progression;
    expect(activityState(p, VYRAK_REMATCH, T0 + 4_100_000 + 3600_000).reason).toBe("Daily limit reached");
  });
  test("first clear does not spend a rematch attempt", () => { const p = markCompleted(structuredClone(DEFAULT_PROGRESSION), VYRAK_REMATCH, T0); expect(activityState(p, VYRAK_REMATCH, T0 + 61 * 60_000).attemptsLeft).toBe(2); });
  test("challenges", () => {
    expect(challengesMet({ elapsed: 200, deaths: 0 })).toEqual(["unbroken-covenant", "wings-of-the-ancient"]);
    expect(challengesMet({ elapsed: 400, deaths: 1 })).toEqual([]);
    expect(challengesMet({})).toEqual([]);
  });
});
