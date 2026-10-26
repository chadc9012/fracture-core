import { describe, expect, it } from "bun:test";
import { AIR, freshAir, freshRun, landingTricks, scoreLanding, stepAir, stepPowerslide, stuntNex, STUNT_PAY, type Landing } from "./stunts";
import { cleanGrime, stepGrime, grimeTint, MUD } from "./vehicle-mud";

const none = { throttle: 0, brake: 0, steer: 0, handbrake: false };
/** drive over a ramp: ground rises at `grade` for `up` seconds of travel, then drops away flat at the base height */
function rampJump(speed: number, grade: number, upSec: number, input = none, dt = 1 / 60) {
  const st = freshAir(0);
  let t = 0, landing: Landing | null = null, launched = false;
  while (t < 10 && !landing) {
    const stand = t < upSec ? speed * grade * t : 0;
    landing = stepAir(st, stand, t > upSec ? input : none, dt);
    if (st.airborne) launched = true;
    t += dt;
  }
  return { launched, landing };
}

describe("off-road air", () => {
  it("follows rolling ground without leaving it", () => {
    const st = freshAir(0);
    for (let i = 0; i < 600; i++) { const t = i / 60; stepAir(st, Math.sin(t * 2) * 0.3, none, 1 / 60); expect(st.airborne).toBe(false); }
  });
  it("launches off a ramp lip at speed and lands back on the ground", () => {
    const { launched, landing } = rampJump(25, 0.3, 0.8);
    expect(launched).toBe(true);
    expect(landing).not.toBeNull();
    expect(landing!.airTime).toBeGreaterThan(0.5);
    expect(landing!.clean).toBe(true);
  });
  it("a slow crawl over the same ramp just drops off the lip", () => {
    const { landing } = rampJump(4, 0.3, 0.8);
    expect(landing === null || landing.airTime < 0.5).toBe(true);
  });
  it("holding brake in the air flips it backwards; a full flip landed clean scores a Backflip", () => {
    let best: Landing | null = null;
    for (let hold = 0.6; hold < 3; hold += 0.02) {
      const st = freshAir(0); let t = 0, l: Landing | null = null;
      while (t < 10 && !l) { const stand = t < 1.2 ? 30 * 0.45 * t : 0; const air = st.airborne; const brake = air && st.airTime < hold ? 1 : 0; l = stepAir(st, stand, { ...none, brake }, 1 / 60); t += 1 / 60; }
      if (l?.clean && l.pitch > Math.PI) { best = l; break; }
    }
    expect(best).not.toBeNull();
    expect(landingTricks(best!).some((t) => t.name === "Backflip")).toBe(true);
  });
  it("landing upside down is a wipeout: no points and the combo breaks", () => {
    const run = freshRun();
    expect(scoreLanding(run, { airTime: 1.8, pitch: Math.PI, roll: 0, spinYaw: 0, impact: 8, clean: false }, 1)).toBe(0);
    expect(run.last?.wipeout).toBe(true);
    expect(run.combo).toBe(0);
  });
  it("chained stunts build a combo multiplier", () => {
    const run = freshRun(), l: Landing = { airTime: 1.6, pitch: 0.2, roll: 0, spinYaw: Math.PI * 2, impact: 4, clean: true };
    const a = scoreLanding(run, l, 1), b = scoreLanding(run, l, 3), c = scoreLanding(run, l, 20);
    expect(b).toBeGreaterThan(a);
    expect(c).toBe(a); // the window ran out
  });
  it("a long powerslide scores when it ends; a short one doesn't", () => {
    const run = freshRun();
    for (let i = 0; i < 60; i++) stepPowerslide(run, 0.6, 25, 1 / 60, i / 60);
    expect(stepPowerslide(run, 0, 25, 1 / 60, 1)).toBe(0);
    for (let i = 0; i < 120; i++) stepPowerslide(run, 0.6, 25, 1 / 60, 2 + i / 60);
    expect(stepPowerslide(run, 0, 25, 1 / 60, 4)).toBeGreaterThan(0);
  });
  it("stunt pay is capped per day", () => {
    expect(stuntNex(100000, 0)).toBe(STUNT_PAY.dailyCap);
    expect(stuntNex(100000, STUNT_PAY.dailyCap)).toBe(0);
    expect(stuntNex(49, 0)).toBe(0);
  });
  it("gravity constant is sane", () => { expect(AIR.gravity).toBeGreaterThan(9); });
});

describe("vehicle mud", () => {
  it("swamp mud builds fast, the road barely at all, and water washes it off", () => {
    let g = cleanGrime();
    for (let i = 0; i < 600; i++) g = stepGrime(g, "MUD", 25, 0.5, 1 / 60);
    expect(g.level).toBeGreaterThan(0.5);
    expect(g.r).toBeLessThan(0.3); // dark brown
    let road = cleanGrime();
    for (let i = 0; i < 600; i++) road = stepGrime(road, "ROAD", 25, 0, 1 / 60);
    expect(road.level).toBe(0);
    for (let i = 0; i < 600; i++) g = stepGrime(g, "WATER", 10, 0, 1 / 60);
    expect(g.level).toBe(0);
  });
  it("desert dust is pale and the tint is bounded", () => {
    let g = cleanGrime();
    for (let i = 0; i < 6000; i++) g = stepGrime(g, "SAND", 30, 1, 1 / 60);
    expect(g.r).toBeGreaterThan(0.6);
    expect(grimeTint(g)).toBeLessThanOrEqual(MUD.maxTint);
  });
});
