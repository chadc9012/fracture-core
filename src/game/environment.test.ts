// @ts-ignore bun test runner types are not installed
import { describe, expect, it } from "bun:test";
import { SEASON_LENGTH_DAYS, createEnvState, environmentAt, seasonAt, stepEnvironment } from "./environment";

const seq = (values: number[]) => { let i = 0; return () => values[i++ % values.length]!; };

describe("seasons", () => {
  it("cycle spring → summer → autumn → winter and wrap into a new year", () => {
    expect(seasonAt(0).season).toBe("SPRING");
    expect(seasonAt(SEASON_LENGTH_DAYS * 1.5).season).toBe("SUMMER");
    expect(seasonAt(SEASON_LENGTH_DAYS * 2.5).season).toBe("AUTUMN");
    expect(seasonAt(SEASON_LENGTH_DAYS * 3.5).season).toBe("WINTER");
    expect(seasonAt(SEASON_LENGTH_DAYS * 4.1)).toMatchObject({ season: "SPRING", year: 1 });
  });
  it("is deterministic", () => {
    expect(environmentAt("veridan", 3.3, 0.2)).toEqual(environmentAt("veridan", 3.3, 0.2));
  });
  it("winter is colder than summer in the same region", () => {
    const summer = environmentAt("veridan", SEASON_LENGTH_DAYS * 1.5, 0).thermal;
    const winter = environmentAt("veridan", SEASON_LENGTH_DAYS * 3.5, 0).thermal;
    expect(winter).toBeLessThan(summer);
  });
  it("Nexus is shielded: mild year-round", () => {
    for (let t = 0; t < 30; t += 1.7) expect(environmentAt("nexus", t, 0.5).thermal).toBe(0);
  });
});

describe("hazards", () => {
  const hot = environmentAt("ember", SEASON_LENGTH_DAYS * 1.5, 0);
  const cold = environmentAt("frostspire", SEASON_LENGTH_DAYS * 3.5, 1);
  it("scorching ground builds heat exposure, warns, then hurts", () => {
    expect(hot.thermal).toBeGreaterThan(0.7);
    const s = createEnvState();
    let warned = false, damage = 0;
    for (let i = 0; i < 600; i++) { const o = stepEnvironment(s, { dt: 0.1, regionId: "ember", env: hot, sheltered: false, px: 0, pz: 0, rand: Math.random }); if (o.warning.startsWith("Heat")) warned = true; damage += o.damage; }
    expect(warned).toBe(true);
    expect(damage).toBeGreaterThan(0);
  });
  it("shelter relieves exposure and stops damage", () => {
    const s = createEnvState(); s.heat = 1;
    let damage = 0;
    for (let i = 0; i < 200; i++) damage += stepEnvironment(s, { dt: 0.1, regionId: "ember", env: hot, sheltered: true, px: 0, pz: 0, rand: Math.random }).damage;
    expect(s.heat).toBe(0);
    expect(damage).toBeLessThan(0.5);
  });
  it("freezing nights build cold exposure", () => {
    expect(cold.thermal).toBeLessThan(-0.7);
    const s = createEnvState();
    for (let i = 0; i < 300; i++) stepEnvironment(s, { dt: 0.1, regionId: "frostspire", env: cold, sheltered: false, px: 0, pz: 0, rand: Math.random });
    expect(s.cold).toBe(1);
  });
  it("never hurts inside the Nexus shield", () => {
    const s = createEnvState();
    const env = environmentAt("nexus", SEASON_LENGTH_DAYS * 3.5, 1);
    for (let i = 0; i < 300; i++) expect(stepEnvironment(s, { dt: 0.1, regionId: "nexus", env, sheltered: false, px: 0, pz: 0, rand: Math.random }).damage).toBe(0);
  });
  it("lightning is telegraphed before it lands, and only in storms", () => {
    // find a storm time in veridan
    let t = 0; let storm = environmentAt("veridan", 0, 0);
    while (!(storm.weather.state === "STORM" && storm.weather.precipitation > 0.8) && t < 200) { t += 0.05; storm = environmentAt("veridan", t, 0); }
    expect(storm.weather.state).toBe("STORM");
    const s = createEnvState(); s.nextStrike = 0.01;
    const first = stepEnvironment(s, { dt: 0.05, regionId: "veridan", env: storm, sheltered: false, px: 0, pz: 0, rand: seq([0.1, 0.5, 0.5]) });
    expect(first.detonated).toHaveLength(0);
    expect(s.strikes).toHaveLength(1);
    expect(first.warning).toContain("Lightning");
    let landed = 0;
    for (let i = 0; i < 40; i++) landed += stepEnvironment(s, { dt: 0.05, regionId: "veridan", env: storm, sheltered: true, px: 0, pz: 0, rand: Math.random }).detonated.length;
    expect(landed).toBe(1);
  });
});
