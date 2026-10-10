import { describe, expect, test } from "bun:test";
import { SKY_BODY, skyBodyElevation, skyParams } from "./sky-dome";

describe("sky dome parameters", () => {
  test("day has no night/stars, midnight is fully dark with stars", () => {
    const noon = skyParams(0.9, 0), midnight = skyParams(-0.3, 0);
    expect(noon.night).toBe(0);
    expect(noon.starStrength).toBe(0);
    expect(midnight.night).toBeGreaterThan(0.95);
    expect(midnight.starStrength).toBeGreaterThan(0.95);
    expect(midnight.sunStrength).toBe(0);
  });
  test("a clear day still has scattered cloud and overcast has more", () => {
    expect(skyParams(0.8, 0).cover).toBeGreaterThanOrEqual(0.38);
    expect(skyParams(0.8, 1).cover).toBeGreaterThan(skyParams(0.8, 0.5).cover);
  });
  test("storm clouds hide the stars", () => {
    expect(skyParams(-0.3, 1).starStrength).toBeLessThan(skyParams(-0.3, 0).starStrength * 0.2);
  });
  test("golden hour is warm: more red than blue in the sun and lit clouds; noon is near white", () => {
    const dusk = skyParams(0.04, 0), noon = skyParams(0.9, 0);
    expect(dusk.sunColor[0]).toBeGreaterThan(dusk.sunColor[2] * 2);
    expect(dusk.cloudLit[0]).toBeGreaterThan(dusk.cloudLit[2]);
    expect(Math.abs(noon.sunColor[0] - noon.sunColor[2])).toBeLessThan(0.2);
  });
  test("all colours stay in range", () => {
    for (let y = -1; y <= 1; y += 0.1) for (const c of [0, 0.5, 1]) {
      const p = skyParams(y, c);
      for (const col of [p.sunColor, p.cloudLit, p.cloudShade]) for (const v of col) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1.0001); }
    }
  });
});

describe("the Fracture Moon and the sky wash", () => {
  test("the giant body sits above the horizon at a unit-ish direction and is much larger than the moon", () => {
    expect(skyBodyElevation()).toBeGreaterThan(0.3);
    expect(skyBodyElevation()).toBeLessThan(0.9);
    expect(SKY_BODY.radius).toBeGreaterThan(0.1); // our moon is ~0.02 rad
    expect(SKY_BODY.radius).toBeLessThan(0.3);
  });
  test("the wash is warm at the horizon at golden hour and cool and dark at night", () => {
    const dusk = skyParams(0.04, 0), noon = skyParams(0.9, 0), night = skyParams(-0.4, 0);
    expect(dusk.horizon[0]).toBeGreaterThan(dusk.horizon[2] * 2);
    expect(noon.zenith[2]).toBeGreaterThan(noon.zenith[0]);
    expect(night.zenith[0] + night.zenith[1] + night.zenith[2]).toBeLessThan(0.4);
    for (const p of [dusk, noon, night]) for (const c of [...p.zenith, ...p.horizon]) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(1.0001); }
  });
});
