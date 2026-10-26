import { describe, expect, it } from "bun:test";
import { PVP_MODES, newPvp, stepPvp, royaleRadius, stormDamage, fieldSize, respawns, ROYALE, type PvpEvents, type PvpModeId } from "./pvp";

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
