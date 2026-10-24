import { describe, expect, test } from "bun:test";
import { ARCADE_ROUNDS, ARCADE_VENUES, JACKPOT_BONUS, MAX_MISSES, ROUND_GAP_MS, TARGETS_PER_ROUND, arcadeBest, arcadeSignal, arcadeTap, arcadeTick, isArcadePress, recordArcade, roundTargets, startArcade, toleranceFor, type ArcadeRun } from "./arcade";
import { VENUES } from "./nightlife";

const V = "crown-casino", DAY = "2026-10-24", T0 = 10_000;
/** the absolute time of the current target */
const targetAt = (s: ArcadeRun) => s.roundStartsAt + s.targets[s.next]!;

describe("Pixel Pit reflex cabinet", () => {
  test("hosted at a real venue; tonight's timings are the same for everyone and change tomorrow", () => {
    for (const id of Object.keys(ARCADE_VENUES)) expect(VENUES.some((v) => v.id === id)).toBe(true);
    expect(ARCADE_VENUES[V]!.cabinet).toBe("Pixel Pit");
    expect(roundTargets(V, DAY, 0)).toEqual(roundTargets(V, DAY, 0));
    expect(roundTargets(V, DAY, 0)).not.toEqual(roundTargets(V, "2026-10-25", 0));
    for (let r = 0; r < ARCADE_ROUNDS; r++) {
      const t = roundTargets(V, DAY, r), tol = toleranceFor(r);
      expect(t).toHaveLength(TARGETS_PER_ROUND);
      for (let i = 1; i < t.length; i++) expect(t[i]! - t[i - 1]!).toBeGreaterThan(2 * tol); // windows never overlap
    }
    expect(toleranceFor(ARCADE_ROUNDS - 1)).toBeLessThan(toleranceFor(0));
  });

  test("presses before the first round starts are ignored; the signal reads READY, WAIT, then HIT", () => {
    const s = startArcade(V, DAY, T0);
    expect(arcadeTap(s, T0 + 100)).toBe(s);
    expect(arcadeSignal(s, T0 + 100)).toBe("READY");
    expect(arcadeSignal(s, s.roundStartsAt + 10)).toBe("WAIT");
    expect(arcadeSignal(s, targetAt(s))).toBe("HIT");
  });

  test("an early press is a miss and does not advance the target; two misses end the run", () => {
    let s = startArcade(V, DAY, T0);
    const early = targetAt(s) - toleranceFor(0) - 50;
    s = arcadeTap(s, early);
    expect(s).toMatchObject({ misses: 1, next: 0, hits: 0, done: false, last: { kind: "early" } });
    s = arcadeTap(s, early + 10);
    expect(s).toMatchObject({ misses: MAX_MISSES, done: true, won: false, endedBy: "misses" });
    expect(arcadeTap(s, targetAt(startArcade(V, DAY, T0)))).toBe(s); // nothing after the run ends
    expect(arcadeSignal(s, early + 20)).toBe("GAME OVER");
  });

  test("a press inside the window hits; dead-on scores more than the edge of the window", () => {
    const s = startArcade(V, DAY, T0);
    const dead = arcadeTap(s, targetAt(s)), edge = arcadeTap(s, targetAt(s) + toleranceFor(0) - 1);
    expect(dead).toMatchObject({ hits: 1, next: 1, misses: 0, last: { kind: "hit" } });
    expect(edge.hits).toBe(1);
    expect(dead.score).toBe(150);
    expect(dead.score).toBeGreaterThan(edge.score);
  });

  test("unanswered signals become late misses; walking away ends the run as a timeout", () => {
    const s = startArcade(V, DAY, T0);
    const t = arcadeTick(s, T0 + 60_000);
    expect(t).toMatchObject({ done: true, won: false, endedBy: "timeout", misses: MAX_MISSES, last: { kind: "late" } });
    // a player who pressed this round and then let two signals pass loses on misses, not a timeout
    const hit = arcadeTap(s, targetAt(s));
    expect(arcadeTick(hit, T0 + 60_000)).toMatchObject({ done: true, endedBy: "misses", hits: 1 });
  });

  test("one late miss is survivable: the round still ends and the next one starts after a breather", () => {
    let s = startArcade(V, DAY, T0);
    s = arcadeTap(s, targetAt(s));
    s = arcadeTap(s, targetAt(s));
    const lastWindowCloses = targetAt(s) + toleranceFor(0);
    s = arcadeTick(s, lastWindowCloses + 1);
    expect(s).toMatchObject({ round: 1, next: 0, misses: 1, hits: 2, done: false });
    expect(s.roundStartsAt).toBe(lastWindowCloses + ROUND_GAP_MS);
    expect(arcadeTap(s, s.roundStartsAt - 10)).toBe(s); // presses in the breather are ignored
  });

  test("a clean run clears every round for the jackpot; deterministic for the same presses", () => {
    const play = () => {
      let s = startArcade(V, DAY, T0);
      while (!s.done) s = arcadeTap(s, targetAt(s));
      return s;
    };
    const a = play(), b = play();
    expect(a).toMatchObject({ done: true, won: true, endedBy: "cleared", misses: 0, hits: ARCADE_ROUNDS * TARGETS_PER_ROUND, round: ARCADE_ROUNDS - 1 });
    let expected = 0;
    for (let r = 0; r < ARCADE_ROUNDS; r++) expected += 150 * (r + 1) * TARGETS_PER_ROUND;
    expect(a.score).toBe(expected + JACKPOT_BONUS);
    expect(b).toEqual(a);
    expect(arcadeSignal(a, T0 + 1e6)).toBe("JACKPOT");
  });

  test("non-finite clocks never change the run", () => {
    const s = startArcade(V, DAY, T0);
    expect(arcadeTap(s, Number.NaN)).toBe(s);
    expect(arcadeTick(s, Number.POSITIVE_INFINITY)).toBe(s);
  });

  test("only a new best is saved, one key per venue", () => {
    let p = { earnedRewards: ["venue-best:crown-casino:9000"] as string[] };
    expect(arcadeBest(p, V)).toBe(0); // the dance best is a different key
    p = recordArcade(p, V, 1200);
    expect(recordArcade(p, V, 800)).toBe(p);
    p = recordArcade(p, V, 4100);
    expect(arcadeBest(p, V)).toBe(4100);
    expect(p.earnedRewards.filter((k) => k.startsWith(`arcade-best:${V}:`))).toEqual([`arcade-best:${V}:4100`]);
    expect(p.earnedRewards).toContain("venue-best:crown-casino:9000");
  });

  test("Space hits, but not a held repeat or typing in a field", () => {
    expect(isArcadePress({ code: "Space", repeat: false, target: null })).toBe(true);
    expect(isArcadePress({ code: "Space", repeat: true, target: null })).toBe(false);
    expect(isArcadePress({ code: "Space", repeat: false, target: { tagName: "INPUT" } })).toBe(false);
    expect(isArcadePress({ code: "Space", repeat: false, target: { tagName: "DIV", isContentEditable: true } })).toBe(false);
    expect(isArcadePress({ code: "Enter", repeat: false, target: null })).toBe(false);
  });
});
