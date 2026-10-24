import { describe, expect, test } from "bun:test";
import { SHARD_FX, shardAlpha, shardCount, shardFlights, shardGain } from "./shard-gain";

describe("fracture shard gain visual", () => {
  test("only an increase after the first seen value counts (loading a save is not a reward)", () => {
    expect(shardGain(undefined, 120)).toBe(0);
    expect(shardGain(120, 120)).toBe(0);
    expect(shardGain(150, 120)).toBe(0);
    expect(shardGain(120, 270)).toBe(150);
    expect(shardGain(NaN, 5)).toBe(0);
  });
  test("bigger gains throw more shards, capped", () => {
    expect(shardCount(0)).toBe(0);
    expect(shardCount(1)).toBe(1);
    expect(shardCount(150)).toBeGreaterThan(shardCount(10));
    expect(shardCount(1e9)).toBe(SHARD_FX.maxShards);
  });
  test("flights are deterministic, rise, and spin about unit axes", () => {
    const a = shardFlights(6, 42), b = shardFlights(6, 42);
    expect(a).toEqual(b);
    for (const f of a) {
      expect(f.vy).toBeGreaterThan(0);
      expect(Math.hypot(f.ax, f.ay, f.az)).toBeCloseTo(1, 5);
    }
  });
  test("fades in, holds and fades out within its life", () => {
    expect(shardAlpha(0)).toBe(0);
    expect(shardAlpha(SHARD_FX.life * 0.3)).toBe(1);
    expect(shardAlpha(SHARD_FX.life * 0.9)).toBeLessThan(0.5);
    expect(shardAlpha(SHARD_FX.life)).toBe(0);
  });
});
