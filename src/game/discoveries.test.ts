import { describe, expect, test } from "bun:test";
import "./racing"; // registers the race catalogue (Movement & Racing category)
import { ACTIVITIES, ELITES, FEATURED_BONUS, FEATURED_COUNT, activityState, categoryOf, completeActivity, featuredFor, isFeatured, startActivity, stepRun, weekKeyUtc, weeklyElitesFor, msUntilWeekReset, reputationOf, addReputation, activityById, type Run } from "./activities";
import { DISCOVERIES, DISTRESS_WINDOW_MS, discoveryById, isKnown, isOpen, nearby, positionOf, reveal, revealedBy, triggered } from "./discoveries";
import { DEFAULT_PROGRESSION } from "./progression";
import { pointWorld } from "./activities";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0); // Sunday
const fresh = () => structuredClone(DEFAULT_PROGRESSION);

describe("board categories", () => {
  test("all five categories are populated", () => {
    const seen = new Set(ACTIVITIES.map(categoryOf));
    for (const c of ["side", "bounty", "movement", "underground", "events"]) expect(seen.has(c as never)).toBe(true);
  });
});

describe("rotation uses real UTC time", () => {
  test("featured is stable within a UTC day and changes at midnight", () => {
    const a = featuredFor(Date.UTC(2026, 9, 18, 0, 0, 1)).map((x) => x.id), b = featuredFor(Date.UTC(2026, 9, 18, 23, 59, 59)).map((x) => x.id), c = featuredFor(Date.UTC(2026, 9, 19, 0, 0, 0)).map((x) => x.id);
    expect(a).toEqual(b); expect(c).not.toEqual(a);
    expect(a.length).toBe(FEATURED_COUNT); expect(new Set(featuredFor(T0).map((x) => x.area)).size).toBe(FEATURED_COUNT);
  });
  test("weekly elites rotate at Monday 00:00 UTC, not before", () => {
    const sun = weeklyElitesFor(Date.UTC(2026, 9, 18, 23, 59, 59)).map((x) => x.id), mon = weeklyElitesFor(Date.UTC(2026, 9, 19, 0, 0, 0)).map((x) => x.id), mon2 = weeklyElitesFor(Date.UTC(2026, 9, 19, 23, 0, 0)).map((x) => x.id);
    expect(weekKeyUtc(Date.UTC(2026, 9, 18, 23, 59, 59))).toBe("2026-10-12"); expect(weekKeyUtc(Date.UTC(2026, 9, 19, 0, 0, 0))).toBe("2026-10-19");
    expect(mon).toEqual(mon2); expect(sun.length).toBe(3);
    expect(msUntilWeekReset(Date.UTC(2026, 9, 18, 23, 59, 59))).toBe(1000);
  });
  test("the game clock plays no part: rotation depends only on the timestamp argument", () => { expect(featuredFor(T0).map((x) => x.id)).toEqual(featuredFor(T0).map((x) => x.id)); });
});

describe("featured bonus and elites", () => {
  test("featured completion pays more; elites have a weekly limit that survives a day change", () => {
    const f = featuredFor(T0)[0]!, p0 = fresh();
    const s = startActivity(p0, f.id, T0) as any; const run: Run = s.run; run.status = "complete";
    const r = completeActivity(s.progression, f, run, T0 + 200_000, () => 0.99) as any;
    expect(r.payout.featured).toBe(true);
    expect(r.payout.nex).toBeGreaterThanOrEqual(Math.round(f.rewards.nex * FEATURED_BONUS) - 1);
    const el = ELITES[0]!; let p = fresh();
    const SAT = T0 - 86_400_000;
    p = (startActivity(p, el.id, SAT) as any).progression;
    expect(activityState(p, el, T0).attemptsLeft).toBe(0); // next day, same week
    expect(activityState(p, el, T0).reason).toBe("Weekly limit reached");
    expect(activityState(p, el, Date.UTC(2026, 9, 19, 0, 0, 0)).attemptsLeft).toBe(1); // Monday
  });
});

describe("reward protection", () => {
  test("the same completed run cannot be claimed twice", () => {
    const def = activityById("nx-grid")!; const s = startActivity(fresh(), def.id, T0) as any; const run: Run = s.run; run.status = "complete";
    const first = completeActivity(s.progression, def, run, T0 + 100_000, () => 0.99) as any;
    expect(first.payout).toBeTruthy();
    const second = completeActivity(first.progression, def, run, T0 + 101_000, () => 0.99) as any;
    expect(second.error).toBe("Already claimed");
    const sum = (p: any) => Object.values(p.nexLedger).reduce((a: number, b: any) => a + b, 0);
    expect(sum(first.progression)).toBe(first.payout.nex);
  });
  test("a new attempt can be claimed once its own run completes", () => {
    const def = activityById("nx-grid")!; let p = fresh(); let total = 0;
    for (let i = 0; i < 2; i++) {
      const s = startActivity(p, def.id, T0 + i * 3_600_000) as any; s.run.status = "complete";
      const r = completeActivity(s.progression, def, s.run, T0 + i * 3_600_000 + 100_000, () => 0.99) as any; p = r.progression; total += r.payout.nex;
    }
    expect(Object.values(p.nexLedger).reduce((a: number, b: any) => a + b, 0)).toBe(total);
  });
  test("existing saves load: an old missionRuns record without 'last' has no cooldown", () => {
    const p = fresh(); p.missionRuns["act:nx-grid"] = { day: "2026-10-18", count: 1 };
    const st = activityState(p, activityById("nx-grid")!, T0); expect(st.cooldownLeftMs).toBe(0); expect(st.attemptsLeft).toBe(2);
  });
});

describe("reactive unlocks", () => {
  test("a reputation-gated contract is locked until faction reputation is earned", () => {
    const def = activityById("th-trench")!; let p = fresh();
    expect(activityState(p, def, T0).reason).toContain("reputation"); expect("error" in (startActivity(p, def.id, T0) as any)).toBe(true);
    p = addReputation(p, def.faction, 30); expect(reputationOf(p, def.faction)).toBe(30);
    expect(activityState(p, def, T0).available).toBe(true);
  });
});

describe("discoveries", () => {
  test("every area has discoveries; ids unique; reveals point at real hidden discoveries", () => {
    const ids = new Set<string>();
    for (const d of DISCOVERIES) { expect(ids.has(d.id)).toBe(false); ids.add(d.id); for (const r of d.reveals ?? []) expect(discoveryById(r)?.hidden).toBe(true); }
    for (const area of new Set(ACTIVITIES.map((a) => a.area))) expect(DISCOVERIES.some((d) => d.area === area)).toBe(true);
    expect(DISCOVERIES.filter((d) => d.hidden).length).toBeGreaterThan(3);
  });
  test("hidden discoveries stay hidden until a beacon reveals them; the reveal persists", () => {
    const hidden = DISCOVERIES.find((d) => d.hidden)!; let p = fresh();
    const w = positionOf(hidden, T0);
    expect(nearby(p, w.x, w.z, T0).some((s) => s.discovery.id === hidden.id)).toBe(false);
    expect(triggered(p, w.x, w.z, T0)).toBeNull();
    const beacon = DISCOVERIES.find((d) => d.reveals?.includes(hidden.id))!;
    expect(revealedBy(beacon.def.id)).toContain(hidden.id);
    p = reveal(p, revealedBy(beacon.def.id)); p = JSON.parse(JSON.stringify(p));
    expect(isKnown(p, hidden)).toBe(true); expect(triggered(p, w.x, w.z, T0)?.id).toBe(hidden.id);
    expect(reveal(p, [hidden.id])).toBe(p); // idempotent
  });
  test("discoveries share the board's limits: attempts and cooldown remove them from the world", () => {
    const d = discoveryById("nc-rift")!; let p = fresh(); const w = positionOf(d, T0);
    expect(triggered(p, w.x, w.z, T0)?.id).toBe("nc-rift");
    const s = startActivity(p, d.def.id, T0) as any; p = s.progression; s.run.status = "complete";
    p = (completeActivity(p, d.def, s.run, T0 + 60_000, () => 0.99) as any).progression;
    expect(triggered(p, w.x, w.z, T0 + 120_000)).toBeNull(); // on cooldown: the fracture has settled
    expect(triggered(p, w.x, w.z, T0 + 60_000 + 13 * 60_000)?.id).toBe("nc-rift");
  });
  test("patrols move in real time, others do not; distress signals expire", () => {
    const patrol = DISCOVERIES.find((d) => d.kind === "patrol")!, flag = DISCOVERIES.find((d) => d.kind === "flag")!;
    expect(positionOf(patrol, T0)).not.toEqual(positionOf(patrol, T0 + 30_000)); expect(positionOf(flag, T0)).toEqual(positionOf(flag, T0 + 30_000));
    const dist = DISCOVERIES.find((d) => d.kind === "distress")!; let open = 0, closed = 0;
    for (let t = 0; t < 180; t += 5) (isOpen(dist, T0 + t * 60_000).open ? open++ : closed++);
    expect(open).toBeGreaterThan(0); expect(closed).toBeGreaterThan(open);
    expect(isOpen(dist, T0).msLeft === Infinity).toBe(false);
    expect(DISTRESS_WINDOW_MS).toBe(30 * 60_000);
  });
  test("discovered, accepted, completed and rewarded end to end (fracture containment)", () => {
    const d = discoveryById("vf-rift")!; let p = fresh(); const w = pointWorld(d.area, d.at);
    expect(triggered(p, w.x, w.z, T0)?.id).toBe("vf-rift");
    const s = startActivity(p, d.def.id, T0) as any; p = s.progression; const run: Run = s.run;
    const t = { x: w.x, z: w.z, dt: 1, now: T0, kills: 0, elites: 0, bosses: 0, hp: 100, deaths: 0 };
    stepRun(d.def, run, t); stepRun(d.def, run, { ...t, dt: 30 }); expect(run.stage).toBe(1);
    stepRun(d.def, run, { ...t }); stepRun(d.def, run, { ...t, kills: 5 }); expect(run.status).toBe("complete");
    const r = completeActivity(p, d.def, run, T0 + 60_000, () => 0.99) as any; expect(r.payout.nex).toBeGreaterThan(0);
  });
});
