import { describe, expect, it } from "bun:test";
import { EXTRACT, PVP_MODES, RANKED, newPvp, rankedDelta, rankedKey, rankedRating, rankedTier, stepPvp, royaleRadius, stormDamage, fieldSize, respawns, ROYALE, type PvpEvents, type PvpModeId, type Unit } from "./pvp";

const quiet = (over: Partial<PvpEvents> = {}): PvpEvents => ({ dt: 0.1, kills: 0, died: false, px: 100, pz: 100, rivalsAlive: 3, ...over });
function play(mode: PvpModeId, each: (t: number) => Partial<PvpEvents>, seconds = 2000) {
  const st = newPvp(mode, 7);
  for (let t = 0; t < seconds; t += 0.1) if (stepPvp(st, quiet(each(t)))) break;
  return st;
}

describe("Killbox modes", () => {
  it("every mode names its activity and has a sane target", () => {
    for (const m of Object.values(PVP_MODES)) { expect(m.activity.startsWith("killbox-")).toBe(true); expect(m.target).toBeGreaterThan(0); }
  });
  it("Clash: a player who keeps eliminating wins; one who only dies loses", () => {
    const hero = play("clash", (t) => ({ kills: Math.floor(t * 10) % 40 === 0 ? 1 : 0 }));
    expect(hero.result).toBe("win");
    const feeder = play("clash", (t) => ({ died: Math.floor(t * 10) % 30 === 0 }));
    expect(feeder.result).toBe("loss");
  });
  it("Clash: with nobody fighting, the off-field teams alone don't end it before the clock", () => {
    const st = play("clash", () => ({}), 300);
    expect(st.result).toBeNull();
    expect(st.us + st.them).toBeGreaterThan(10); // but the score does move
  });
  it("Dominion: standing in a zone captures it and held zones score", () => {
    const st = newPvp("dominion", 3);
    for (let t = 0; t < 8; t += 0.1) stepPvp(st, quiet({ px: 0, pz: 0 }));
    expect(st.zones.find((z) => z.id === "B")!.owner).toBe("us");
    expect(st.us).toBeGreaterThan(0);
  });
  it("Freefall: the board holds all 12 and a death scores for someone else", () => {
    const st = newPvp("freefall", 5);
    expect(st.board.length).toBe(12);
    stepPvp(st, quiet({ died: true }));
    expect(st.board.slice(1).reduce((a, b) => a + b, 0)).toBe(1);
  });
  it("Ascendancy: wiping the rivals wins a round, dying loses it, first to 5", () => {
    const st = newPvp("ascendancy", 1);
    stepPvp(st, quiet({ rivalsAlive: 3 })); for (let i = 0; i < 20; i++) stepPvp(st, quiet({ rivalsAlive: 3 }));
    stepPvp(st, quiet({ rivalsAlive: 0 }));
    expect(st.usRounds).toBe(1);
    expect(fieldSize(st)).toBe(0); // between rounds
    for (let i = 0; i < 40; i++) stepPvp(st, quiet()); // pause ends
    stepPvp(st, quiet({ died: true }));
    expect(st.themRounds).toBe(1);
    expect(respawns(st)).toBe(false);
  });
  it("Ascendancy: at the buzzer the zone decides the round", () => {
    const st = newPvp("ascendancy", 1);
    for (let t = 0; t < 90; t += 0.1) stepPvp(st, quiet());
    for (let t = 0; t < 7; t += 0.1) stepPvp(st, quiet({ px: 0, pz: 0 }));
    expect(st.usRounds).toBe(1);
  });
  it("Lockdown alternates attack and defence; an uncontested plant loses the defence round", () => {
    const st = newPvp("lockdown", 1);
    expect(st.attacking).toBe(true);
    for (let t = 0; t < 10; t += 0.1) stepPvp(st, quiet({ px: 0, pz: 0 }));
    expect(st.usRounds).toBe(1);
    expect(st.attacking).toBe(false);
    for (let t = 0; t < 20; t += 0.1) stepPvp(st, quiet());
    expect(st.themRounds).toBe(1);
  });
  it("Royale: the circle closes to the final size and burns outside it; surviving to the end wins", () => {
    expect(royaleRadius(0).radius).toBe(ROYALE.startRadius);
    expect(royaleRadius(10000).radius).toBe(ROYALE.finalRadius);
    const st = play("royale", () => ({ px: 0, pz: 0 }), 1200);
    expect(st.result).toBe("win");
    expect(stormDamage(st, st.radius + 5)).toBeGreaterThan(0);
    expect(stormDamage(st, 0)).toBe(0);
    const out = play("royale", (t) => ({ died: t > 30 }), 100);
    expect(out.result).toBe("loss");
  });
});

describe("Extraction", () => {
  const sites = { home: { x: 0, z: 0 }, us: { x: 0, z: 25 }, them: { x: 0, z: -25 } };
  const field = (me: Partial<Unit>, foes: Partial<Unit>[] = []): Unit[] => [{ id: "player", team: "us", x: 0, z: 0, alive: true, ...me }, ...foes.map((f, i) => ({ id: `r${i}`, team: "them" as const, x: 0, z: -20, alive: true, ...f }))];
  const step = (st: ReturnType<typeof newPvp>, units: Unit[], dt = 0.1) => stepPvp(st, { dt, kills: 0, died: false, px: 0, pz: 0, rivalsAlive: 4, units });

  it("standing on the core unopposed picks it up; a contested core stays put", () => {
    const st = newPvp("extraction", 1, undefined, undefined, sites);
    for (let i = 0; i < 6; i++) step(st, field({}, [{ x: 1, z: 0 }]));
    expect(st.core!.holder).toBeNull();
    for (let t = 0; t < EXTRACT.pickTime + 0.2; t += 0.1) step(st, field({}));
    expect([st.core!.holder, st.core!.carrier]).toEqual(["us", "player"]);
  });
  it("the core follows its carrier and scores on the carrier's own pad, then goes home", () => {
    const st = newPvp("extraction", 1, undefined, undefined, sites);
    for (let t = 0; t < 1.5; t += 0.1) step(st, field({}));
    step(st, field({ z: 12 }));
    expect([st.core!.x, st.core!.z]).toEqual([0, 12]);
    step(st, field({ z: 24 }));
    expect(st.us).toBe(1);
    expect([st.core!.holder, st.core!.x, st.core!.z]).toEqual([null, 0, 0]);
  });
  it("the carrier going down drops the core where they fell; left alone it resets home", () => {
    const st = newPvp("extraction", 1, undefined, undefined, sites);
    for (let t = 0; t < 1.5; t += 0.1) step(st, field({}));
    step(st, field({ z: 10 }));
    step(st, field({ z: 10, alive: false }));
    expect([st.core!.holder, st.core!.z]).toEqual([null, 10]);
    for (let t = 0; t < EXTRACT.resetAfter + 0.5; t += 0.1) step(st, field({ z: 30 }));
    expect([st.core!.x, st.core!.z]).toEqual([0, 0]);
  });
  it("their carrier scores on their pad; the first to three wins", () => {
    const st = newPvp("extraction", 1, undefined, undefined, sites);
    for (let n = 0; n < 3; n++) {
      for (let t = 0; t < 1.5; t += 0.1) step(st, field({ z: 30 }, [{ x: 0, z: 0 }]));
      step(st, field({ z: 30 }, [{ x: 0, z: -24 }]));
    }
    expect([st.them, st.result]).toEqual([3, "loss"]);
  });
  it("kills don't score in Extraction", () => {
    const st = newPvp("extraction", 1, undefined, undefined, sites);
    for (let i = 0; i < 50; i++) stepPvp(st, { dt: 0.1, kills: 1, died: false, px: 0, pz: 30, rivalsAlive: 4, units: field({ z: 30 }) });
    expect(st.us).toBe(0);
  });
});

describe("Ranked", () => {
  it("is competitive Dominion that moves your rating", () => {
    expect(PVP_MODES.ranked.kind).toBe("zones");
    expect(PVP_MODES.ranked.ranked).toBe(true);
  });
  it("a win adds more for a bigger margin; a loss costs less when it was close", () => {
    expect(rankedDelta(true, 150, 140, 150)).toBeLessThan(rankedDelta(true, 150, 40, 150));
    expect(rankedDelta(true, 150, 149, 150)).toBeGreaterThanOrEqual(20);
    expect(rankedDelta(false, 140, 150, 150)).toBeGreaterThan(rankedDelta(false, 10, 150, 150));
    expect(rankedDelta(false, 0, 150, 150)).toBe(-18);
  });
  it("the rating is the start plus every ranked result in the save, and picks the tier", () => {
    const keys = [rankedKey(1, 25), rankedKey(2, 30), rankedKey(3, -10), "crucible-win:killbox-ranked:1", "ranked:bad"];
    expect(rankedRating(keys)).toBe(RANKED.start + 45);
    expect(rankedRating([])).toBe(RANKED.start);
    expect(rankedTier(1000).name).toBe("Bronze");
    expect(rankedTier(1100).name).toBe("Silver");
    expect(rankedTier(1800)).toEqual({ name: "Ascendant", floor: 1700, next: null });
    expect(rankedRating(Array.from({ length: 100 }, (_, i) => rankedKey(i, -18)))).toBe(0);
  });
});

describe("Rounds with ally bots", () => {
  const ev = (over: Partial<PvpEvents>): PvpEvents => ({ dt: 0.1, kills: 0, died: false, px: 0, pz: 30, rivalsAlive: 3, alliesAlive: 2, objectiveUs: 0, ...over });
  it("going down doesn't end the round while your allies stand; it ends when the last of them falls", () => {
    const st = newPvp("ascendancy", 1, undefined, { allies: 2, rivals: 3 });
    for (let i = 0; i < 20; i++) stepPvp(st, ev({}));
    stepPvp(st, ev({ died: true }));
    expect([st.out, st.round, st.themRounds]).toEqual([true, 1, 0]);
    for (let i = 0; i < 20; i++) stepPvp(st, ev({ alliesAlive: 1 }));
    expect(st.round).toBe(1);
    stepPvp(st, ev({ alliesAlive: 0 }));
    expect([st.out, st.round, st.themRounds, st.reason]).toEqual([false, 2, 1, "Your team went down"]);
  });
  it("your allies can still win the round you sat out", () => {
    const st = newPvp("ascendancy", 1, undefined, { allies: 2, rivals: 3 });
    for (let i = 0; i < 20; i++) stepPvp(st, ev({}));
    stepPvp(st, ev({ died: true }));
    stepPvp(st, ev({ rivalsAlive: 0 }));
    expect([st.usRounds, st.out]).toEqual([1, false]);
  });
  it("an ally on the objective holds it; you don't while you're down", () => {
    const st = newPvp("ascendancy", 1, undefined, { allies: 2, rivals: 3 });
    const rt = PVP_MODES.ascendancy.roundTime ?? 90;
    for (let t = 0; t < rt + 0.5; t += 0.1) stepPvp(st, ev({}));
    stepPvp(st, ev({ died: true }));
    for (let t = 0; t < 12; t += 0.1) stepPvp(st, ev({ px: 0, pz: 0, objectiveUs: 1 }));
    expect(st.usRounds).toBe(1);
  });
  it("with no ally bots a death still ends the round as before", () => {
    const st = newPvp("ascendancy", 1);
    for (let i = 0; i < 20; i++) stepPvp(st, quiet({}));
    stepPvp(st, quiet({ died: true }));
    expect([st.themRounds, st.reason]).toEqual([1, "You went down"]);
  });
});
