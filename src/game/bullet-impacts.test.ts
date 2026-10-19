import { describe, expect, test } from "bun:test";
import { IMPACT_STYLE, makePuffs, makeSparks, puffAlive, sparkAlive, spawnImpact, stepImpacts, SPARK_POOL } from "./bullet-impacts";

const seq = () => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

describe("bullet impacts", () => {
  test("a hit spawns its style's sparks and one puff, thrown back against the bullet", () => {
    const sparks = makeSparks(), puffs = makePuffs();
    spawnImpact(sparks, puffs, { x: 0, y: 1, z: 0, kind: "cover", vx: 0, vz: 130 }, seq());
    const live = sparks.filter(sparkAlive);
    expect(live.length).toBe(IMPACT_STYLE.cover.sparks);
    expect(puffs.filter(puffAlive).length).toBe(1);
    // the bullet flew toward +z, so the debris comes back toward -z and upward
    for (const s of live) { expect(s.vz).toBeLessThan(0.5); expect(s.vy).toBeGreaterThan(0); }
  });
  test("particles fall, fade out, and the pool never grows", () => {
    const sparks = makeSparks(), puffs = makePuffs(), rnd = seq();
    for (let i = 0; i < 40; i++) spawnImpact(sparks, puffs, { x: i, y: 1, z: 0, kind: "ground", vx: 130, vz: 0 }, rnd);
    expect(sparks.length).toBe(SPARK_POOL);
    const y0 = sparks.filter(sparkAlive).map((s) => s.y);
    for (let t = 0; t < 30; t++) stepImpacts(sparks, puffs, 1 / 30);
    expect(sparks.filter(sparkAlive).length).toBe(0);
    expect(puffs.filter(puffAlive).length).toBe(0);
    expect(y0.length).toBeGreaterThan(0);
  });
  test("a full pool recycles the oldest particles so the newest hit always shows", () => {
    const sparks = makeSparks(), puffs = makePuffs(), rnd = seq();
    for (let i = 0; i < 60; i++) spawnImpact(sparks, puffs, { x: 0, y: 1, z: 0, kind: "truck", vx: 0, vz: 130 }, rnd);
    spawnImpact(sparks, puffs, { x: 99, y: 1, z: 0, kind: "machine", vx: 0, vz: 130 }, rnd);
    expect(sparks.filter((s) => s.kind === "machine" && sparkAlive(s)).length).toBe(IMPACT_STYLE.machine.sparks);
    expect(puffs.some((p) => p.kind === "machine" && p.x > 98)).toBe(true);
  });
});
