import { expect, test } from "bun:test";
import { SHOTS, blastAtDistance, flavorFor, shotKey, variation } from "./audio-design";

test("every gun has a full four-layer report; heavier guns hit lower and ring longer", () => {
  for (const p of Object.values(SHOTS)) { expect(p.crack.dur).toBeLessThan(0.05); expect(p.blast.drive).toBeGreaterThan(1); expect(p.thump.f1).toBeLessThan(p.thump.f0); expect(p.tail.dur).toBeGreaterThan(p.blast.dur); }
  expect(SHOTS.HEAVY.thump.f0).toBeLessThan(SHOTS.AUTO.thump.f0);
  expect(SHOTS.SHOTGUN.tail.dur).toBeGreaterThan(SHOTS.AUTO.tail.dur);
  expect(shotKey("SWORD")).toBeNull();
  expect(shotKey("CINDER")).toBe("LAUNCHER");
});

test("humanised variation stays subtle", () => {
  for (const r of [0, 0.5, 0.999]) { const v = variation(() => r); expect(v.pitch).toBeGreaterThan(0.93); expect(v.pitch).toBeLessThan(1.07); }
});

test("far explosions arrive late (speed of sound), darker and quieter, but the sub carries", () => {
  const near = blastAtDistance(5), far = blastAtDistance(343);
  expect(far.delay).toBeCloseTo(1, 2);
  expect(far.cutoff).toBeLessThan(near.cutoff);
  expect(far.gain).toBeLessThan(near.gain);
  expect(far.sub).toBeGreaterThan(far.gain);
  expect(flavorFor("THERMAL")).toBe("THERMAL");
  expect(flavorFor("BIO")).toBe("TOXIC");
  expect(flavorFor(undefined)).toBe("KINETIC");
});
