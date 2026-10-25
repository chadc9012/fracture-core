import { describe, expect, test } from "bun:test";
import { collapseBlend, COLLAPSE_TIME, DEATH_POSE, deathPoseFor, ENEMY_ARMS, enemyWeapon, heldPitch, HELD_MUZZLE, LOW_READY } from "./enemy-weapons";
import { HELD_MODEL } from "../components/game/heldModels";
import { existsSync } from "fs";

describe("who carries what", () => {
  test("the human factions are armed at every rank; aberrations are creatures and are not", () => {
    for (const kind of ["RAIDER", "OVERCLOCKED", "VANGUARD"] as const) for (const role of ["standard", "elite", "boss"] as const) expect(enemyWeapon(kind, role)).not.toBeNull();
    for (const role of ["standard", "elite", "boss"] as const) expect(enemyWeapon("ABERRATION", role)).toBeNull();
  });
  test("ranks differ within a faction, and every carried weapon has an authored model on disk", () => {
    for (const ranks of Object.values(ENEMY_ARMS)) {
      const carried = Object.values(ranks).filter(Boolean);
      if (carried.length) expect(new Set(carried).size).toBeGreaterThan(1);
      for (const cls of carried) expect(existsSync(`public${HELD_MODEL[cls!].url}`)).toBe(true);
    }
  });
  test("guns have a barrel tip ahead of the grip; blades have none", () => {
    for (const [cls, mz] of Object.entries(HELD_MUZZLE)) {
      if (cls === "sword") { expect(mz).toBeNull(); continue; }
      expect(mz![2]).toBeGreaterThan(0.15);
    }
  });
});

describe("carry and aim", () => {
  test("guns come level when aiming and sit at a low ready otherwise", () => {
    expect(heldPitch("rifle", 1)).toBe(0);
    expect(heldPitch("rifle", 0)).toBe(LOW_READY.rifle);
    expect(heldPitch("rifle", 0.5)).toBeCloseTo(LOW_READY.rifle / 2, 6);
    expect(heldPitch("rifle", 7)).toBe(0); // clamped
  });
  test("a blade is carried point-down even while its bearer winds up", () => {
    expect(heldPitch("sword", 1)).toBe(LOW_READY.sword);
  });
});

describe("death collapse", () => {
  test("the blend starts at the standing pose, finishes before the topple lands, and never overshoots", () => {
    expect(collapseBlend(0)).toBe(0);
    expect(collapseBlend(COLLAPSE_TIME)).toBe(1);
    expect(collapseBlend(99)).toBe(1);
    expect(COLLAPSE_TIME).toBeLessThan(0.55);
    for (let t = 0; t < COLLAPSE_TIME; t += 0.05) expect(collapseBlend(t + 0.05)).toBeGreaterThanOrEqual(collapseBlend(t));
  });
  test("each body gets its own variation of the same collapse (deterministic per seed)", () => {
    const a = deathPoseFor(0.12), b = deathPoseFor(0.87);
    expect(deathPoseFor(0.12)).toEqual(a);
    expect(a).not.toEqual(b);
    for (const [bone, e] of Object.entries(DEATH_POSE)) {
      // same direction as the authored collapse, 0.7..1.25 of its size (the head may turn either way)
      for (let i = 0; i < 3; i++) {
        if (bone === "Head" && i === 1) continue;
        const want = e[i]!, got = a[bone]![i]!;
        if (want === 0) { expect(got).toBe(0); continue; }
        expect(Math.sign(got)).toBe(Math.sign(want));
        expect(Math.abs(got / want)).toBeGreaterThanOrEqual(0.7 - 1e-9);
        expect(Math.abs(got / want)).toBeLessThanOrEqual(1.25 + 1e-9);
      }
    }
  });
});
