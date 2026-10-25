import { describe, expect, test } from "bun:test";
import { ENEMY_ARMS, enemyWeapon, heldPitch, HELD_MUZZLE, LOW_READY } from "./enemy-weapons";
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

