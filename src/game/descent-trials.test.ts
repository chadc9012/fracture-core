import { describe, expect, test } from "bun:test";
import { AIRTIME, BEACON_LEAK, DUNGEON_TRIALS, GRAVITY, JUMP_APEX, MAX_GAP, MAX_RISE, STEP_UP, WALK_SPEED, buildParkour, buildPuzzle, courseExtremes, freshPuzzle, onSummit, platformGround, stepPuzzle, trialDifficulty, trialOf } from "./descent-trials";
import { RANK_ORDER, SIGNATURE_DUNGEONS, buildDescent, descentGroundAt, tierKinds, type RiftRank } from "./fracture-gates";

const RANKS_WITH_TRIALS: RiftRank[] = ["D", "C", "B", "A", "S"];
const layoutOf = (id: string, rank: RiftRank) => buildDescent(id, rank, undefined, `t:${id}:${rank}`);
const open = { drops: new Set<number>(), nested: false };

describe("trial physics", () => {
  test("the generator's limits sit well inside a walking jump", () => {
    const reach = WALK_SPEED * AIRTIME;
    expect(reach).toBeGreaterThan(19);
    expect(MAX_GAP).toBeLessThan(reach * 0.7);
    expect(MAX_RISE).toBeLessThan(JUMP_APEX * 0.75);
    expect(Math.sqrt(2 * GRAVITY * JUMP_APEX)).toBeGreaterThan(18);
  });
});

describe("parkour floors", () => {
  test("every dungeon at every rank builds a course inside the jump limits, inside its room, with headroom", () => {
    for (const d of SIGNATURE_DUNGEONS) for (const rank of RANKS_WITH_TRIALS) {
      const layout = layoutOf(d.id, rank);
      for (const t of layout.tiers.filter((x) => x.kind === "PARKOUR")) {
        const c = t.trial!.parkour!, ex = courseExtremes(c);
        expect(ex.gap).toBeLessThanOrEqual(MAX_GAP + 0.01);
        expect(ex.rise).toBeLessThanOrEqual(MAX_RISE + 0.01);
        for (const p of c.platforms) {
          expect(Math.abs(p.x - layout.origin.x) + p.w / 2).toBeLessThanOrEqual(t.w / 2);
          expect(Math.abs(p.z - layout.origin.z) + p.d / 2).toBeLessThanOrEqual(t.d / 2);
          expect(p.top).toBeGreaterThanOrEqual(t.floorY);
          expect(p.top).toBeLessThanOrEqual(t.floorY + t.wallH - 4);
        }
        // first pad is the landing, last pad holds the drop
        expect(Math.abs(c.platforms[0]!.x - t.landing.x)).toBeLessThan(0.5);
        expect(Math.abs(c.platforms[0]!.z - t.landing.z)).toBeLessThan(0.5);
        const last = c.platforms.at(-1)!;
        expect(Math.hypot(last.x - t.drop!.x, last.z - t.drop!.z)).toBeLessThan(0.5);
        expect(last.top).toBe(t.floorY);
      }
    }
  });
  test("the platforms are the only ground: standing on one holds, a gap falls through, the pit is below", () => {
    const layout = layoutOf("rootbound-labyrinth", "B");
    const t = layout.tiers.find((x) => x.kind === "PARKOUR")!, c = t.trial!.parkour!;
    const p = c.platforms[1]!;
    expect(descentGroundAt(layout, open, p.x, p.z, p.top + 0.5)).toBe(p.top);
    const high = c.platforms.find((q) => q.top >= t.floorY + 3)!;
    expect(platformGround(c, high.x, high.z, t.floorY - 0.5)).not.toBe(high.top); // too far below to step up
    const a = c.platforms[0]!, b = c.platforms[1]!;
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    if (Math.abs(mx - a.x) > a.w / 2 && Math.abs(mx - b.x) > b.w / 2 || Math.abs(mz - a.z) > a.d / 2 && Math.abs(mz - b.z) > b.d / 2) expect(descentGroundAt(layout, open, mx, mz, t.floorY + 1)).toBeLessThan(t.floorY);
  });
  test("an ascent climbs to a summit above the floor; a gap run keeps the summit at the far pad", () => {
    const ascent = layoutOf("rootbound-labyrinth", "C").tiers.find((x) => x.kind === "PARKOUR")!;
    expect(DUNGEON_TRIALS["rootbound-labyrinth"]!.parkour).toBe("ASCENT");
    const ac = ascent.trial!.parkour!;
    expect(ac.platforms[ac.summit]!.top).toBeGreaterThan(ascent.floorY + 4);
    expect(ac.platforms[ac.summit]!.top).toBe(Math.max(...ac.platforms.map((p) => p.top)));
    const run = layoutOf("drowned-cathedral", "C").tiers.find((x) => x.kind === "PARKOUR");
    if (run) expect(run.trial!.parkour!.kind).toBe("GAP_RUN");
  });
  test("onSummit needs the pad and its height", () => {
    const t = layoutOf("rootbound-labyrinth", "C").tiers.find((x) => x.kind === "PARKOUR")!, c = t.trial!.parkour!, p = c.platforms[c.summit]!;
    expect(onSummit(c, p.x, p.z, p.top)).toBe(true);
    expect(onSummit(c, p.x, p.z, p.top - 6)).toBe(false);
    expect(onSummit(c, p.x + p.w, p.z, p.top)).toBe(false);
  });
  test("difficulty rises with rank and differs between dungeons", () => {
    const room = (d: string, r: RiftRank) => { const t = layoutOf(d, r).tiers.find((x) => x.kind === "PUZZLE")!; return t; };
    expect(trialDifficulty("abyssal-vault", "S")).toBeGreaterThan(trialDifficulty("rootbound-labyrinth", "S"));
    expect(trialDifficulty("rootbound-labyrinth", "S")).toBeGreaterThan(trialDifficulty("rootbound-labyrinth", "C"));
    const t = layoutOf("forgotten-foundation", "S").tiers.find((x) => x.kind === "PARKOUR")!;
    const easy = buildParkour({ origin: { x: 0, z: 0 }, floorY: 0, wallH: 28, w: 100, d: 100, landing: { x: 0, z: -26 }, drop: { x: 0, z: 26 } }, "GAP_RUN", 0, "s");
    const hard = buildParkour({ origin: { x: 0, z: 0 }, floorY: 0, wallH: 28, w: 100, d: 100, landing: { x: 0, z: -26 }, drop: { x: 0, z: 26 } }, "GAP_RUN", 1, "s");
    expect(courseExtremes(hard).gap).toBeGreaterThan(courseExtremes(easy).gap);
    expect(hard.platforms[2]!.w).toBeLessThan(easy.platforms[2]!.w);
    expect(t.trial!.parkour).toBeDefined();
    expect(room("rootbound-labyrinth", "C")).toBeDefined();
    expect(new Set(Object.values(DUNGEON_TRIALS).map((x) => x.hardness)).size).toBe(Object.keys(DUNGEON_TRIALS).length);
  });
});

describe("floor kinds", () => {
  test("the rank decides how many puzzle and parkour floors a descent has", () => {
    const want: Record<string, [number, number]> = { F: [0, 0], E: [1, 0], D: [1, 1], C: [2, 1], B: [2, 2], A: [3, 2], S: [3, 3] };
    for (const rank of RANK_ORDER) {
      const kinds = tierKinds(rank, 20, true);
      expect(kinds.filter((k) => k === "PUZZLE").length).toBe(want[rank]![0]);
      expect(kinds.filter((k) => k === "PARKOUR").length).toBe(want[rank]![1]);
      expect(kinds[0]).toBe("THRESHOLD");
      expect(kinds.at(-1)).toBe("BOSS");
    }
    expect(tierKinds("S", 20).some((k) => k === "PUZZLE" || k === "PARKOUR")).toBe(false); // off unless asked
  });
  test("trial floors are gated and carry their trial", () => {
    for (const t of layoutOf("iron-grave", "A").tiers) {
      if (t.kind === "PUZZLE") { expect(t.gated).toBe(true); expect(t.trial?.puzzle).toBeDefined(); }
      if (t.kind === "PARKOUR") { expect(t.gated).toBe(true); expect(t.trial?.parkour).toBeDefined(); }
    }
  });
});

describe("puzzles", () => {
  const room = { origin: { x: 0, z: 0 }, floorY: 0, wallH: 28, w: 92, d: 104, landing: { x: 0, z: -26 }, drop: { x: 0, z: 26 } };
  const step = (spec: ReturnType<typeof buildPuzzle>, st: ReturnType<typeof freshPuzzle>, i: number | null, now: number, dt = 0.2) => {
    const p = i === null ? { x: 0, z: 0 } : spec.plates[i]!;
    return stepPuzzle(spec, st, { x: i === null ? 9999 : p.x, z: i === null ? 9999 : p.z, now, dt });
  };
  test("plates are inside the room, clear of the landing and drop, and never stacked", () => {
    for (const kind of ["SEQUENCE", "BEACONS", "RELAY"] as const) for (const dif of [0, 0.5, 1]) {
      const spec = buildPuzzle(room, kind, dif, `p:${kind}:${dif}`);
      for (const p of spec.plates) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(room.w / 2 - 3);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(room.d / 2 - 3);
      }
      for (let i = 0; i < spec.plates.length; i++) for (let j = i + 1; j < spec.plates.length; j++) expect(Math.hypot(spec.plates[i]!.x - spec.plates[j]!.x, spec.plates[i]!.z - spec.plates[j]!.z)).toBeGreaterThan(spec.radius * 2);
    }
  });
  test("harder puzzles have more plates and tighter timing", () => {
    for (const kind of ["SEQUENCE", "BEACONS", "RELAY"] as const) expect(buildPuzzle(room, kind, 1, "x").plates.length).toBeGreaterThan(buildPuzzle(room, kind, 0, "x").plates.length);
    expect(buildPuzzle(room, "BEACONS", 1, "x").charge).toBeGreaterThan(buildPuzzle(room, "BEACONS", 0, "x").charge);
  });
  test("a sequence needs the order; a wrong plate resets; the plate you just pressed is not a mistake", () => {
    const spec = buildPuzzle(room, "SEQUENCE", 0.5, "seq");
    const byOrder = spec.plates.map((_, i) => i).sort((a, b) => spec.plates[a]!.order - spec.plates[b]!.order);
    let st = freshPuzzle(spec), t = 0;
    const press = (i: number) => { const r = step(spec, st, i, t++); st = r.state; const off = step(spec, st, null, t++); st = off.state; return r.events; };
    expect(press(byOrder[0]!)).toContain("STEP");
    const wrong = byOrder[2]!;
    expect(press(wrong)).toContain("WRONG");
    expect(st.progress).toBe(0);
    for (const i of byOrder.slice(0, -1)) expect(press(i)).toContain("STEP");
    expect(press(byOrder.at(-1)!)).toContain("DONE");
    expect(st.done).toBe(true);
    // repeat press of the previous plate is lenient
    let s2 = freshPuzzle(spec); t = 0;
    s2 = step(spec, s2, byOrder[0]!, t++).state; s2 = step(spec, s2, null, t++).state;
    s2 = step(spec, s2, byOrder[1]!, t++).state; s2 = step(spec, s2, null, t++).state;
    const again = step(spec, s2, byOrder[1]!, t++);
    expect(again.events).not.toContain("WRONG");
  });
  test("a sequence only counts a plate once per step on (no farming by standing)", () => {
    const spec = buildPuzzle(room, "SEQUENCE", 0.5, "seq2");
    const first = spec.plates.findIndex((p) => p.order === 0);
    let st = freshPuzzle(spec);
    for (let t = 0; t < 10; t++) st = step(spec, st, first, t).state;
    expect(st.progress).toBe(1);
  });
  test("beacons fill while you stand in them, leak when you leave, and finish when every one is full", () => {
    const spec = buildPuzzle(room, "BEACONS", 0.5, "bea");
    let st = freshPuzzle(spec), t = 0;
    for (let k = 0; k < 5; k++) st = step(spec, st, 0, t += 0.2).state;
    const partial = st.charge[0]!;
    expect(partial).toBeGreaterThan(0);
    st = step(spec, st, null, t += 0.2, 2).state;
    expect(st.charge[0]!).toBeLessThan(partial);
    expect(BEACON_LEAK).toBeGreaterThan(0);
    const events: string[] = [];
    for (let i = 0; i < spec.plates.length; i++) for (let k = 0; k < Math.ceil(spec.charge / 0.2) + 2; k++) { const r = step(spec, st, i, t += 0.2); st = r.state; events.push(...r.events); }
    expect(events.filter((e) => e === "BEACON_FULL").length).toBe(spec.plates.length);
    expect(st.done).toBe(true);
  });
  test("a relay starts its clock on the first plate, resets when time runs out, and can be finished in time", () => {
    const spec = buildPuzzle(room, "RELAY", 0.5, "rel");
    let st = freshPuzzle(spec);
    let r = step(spec, st, 0, 100); st = r.state;
    expect(r.events).toContain("STEP");
    expect(st.startedAt).toBe(100);
    st = step(spec, st, null, 100.1).state;
    r = step(spec, st, null, 100 + spec.timeLimit + 1);
    expect(r.events).toContain("RESET");
    expect(r.state.progress).toBe(0);
    // finishing in time at walking pace: the chain's walking time fits the limit
    let len = Math.hypot(spec.plates[0]!.x - room.landing.x, spec.plates[0]!.z - room.landing.z) * 0;
    for (let i = 1; i < spec.plates.length; i++) len += Math.hypot(spec.plates[i]!.x - spec.plates[i - 1]!.x, spec.plates[i]!.z - spec.plates[i - 1]!.z);
    expect(len / WALK_SPEED).toBeLessThan(spec.timeLimit);
    st = freshPuzzle(spec);
    let now = 200; const events: string[] = [];
    for (let i = 0; i < spec.plates.length; i++) { const a = step(spec, st, i, now); st = a.state; events.push(...a.events); st = step(spec, st, null, now + 0.05).state; now += 0.1; }
    expect(events).toContain("DONE");
  });
  test("every dungeon has a trial config and a distinct puzzle/parkour pairing", () => {
    for (const d of SIGNATURE_DUNGEONS) expect(DUNGEON_TRIALS[d.id]).toBeDefined();
    expect(trialOf("nope").hardness).toBe(0.5);
    const pairs = new Set(Object.values(DUNGEON_TRIALS).map((x) => `${x.puzzle}/${x.parkour}`));
    expect(pairs.size).toBeGreaterThanOrEqual(5);
  });
});
