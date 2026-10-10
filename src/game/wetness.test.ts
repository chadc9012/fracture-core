import { describe, expect, test } from "bun:test";
import { wetnessAt, wetTint, BANK_WET, SPRAY_CORE, SPRAY_REACH } from "./wetness";
import { colorAt, groundWetnessAt, waterNetwork, heightAt } from "./terrain";

describe("wetness", () => {
  test("saturated in the channel, fades to dry past the bank, never negative or above 1", () => {
    expect(wetnessAt({ river: { dist: 0, w: 5 } })).toBe(1);
    expect(wetnessAt({ river: { dist: 5, w: 5 } })).toBeGreaterThan(0.5);
    expect(wetnessAt({ river: { dist: 5 + BANK_WET + 0.1, w: 5 } })).toBe(0);
    for (let d = 0; d < 60; d += 1.5) { const v = wetnessAt({ river: { dist: d, w: 5 }, lake: { dist: d, r: 8 }, fall: d }); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  test("falls wet their plunge zone and nothing beyond the spray reach", () => {
    expect(wetnessAt({ fall: SPRAY_CORE * 0.5 })).toBeGreaterThan(0.8);
    expect(wetnessAt({ fall: SPRAY_REACH + 1 })).toBe(0);
    expect(wetnessAt({})).toBe(0);
  });
  test("tint is subtle: dry unchanged, wet soil darker and muddier, wet rock only darkened", () => {
    const grass: [number, number, number] = [0.3, 0.5, 0.2], rock: [number, number, number] = [0.5, 0.5, 0.5];
    expect(wetTint(grass, 0)).toEqual(grass);
    const w = wetTint(grass, 1);
    expect(w[1]).toBeLessThan(grass[1]);
    expect(w[1]).toBeGreaterThan(grass[1] * 0.55); // never near-black
    const wr = wetTint(rock, 1, 1);
    expect(wr[0]).toBeLessThan(rock[0]);
    expect(wr[0]).toBeGreaterThan(rock[0] * 0.7);
    expect(Math.abs(wr[0] - wr[2])).toBeLessThan(0.03); // rock stays neutral, not mud-brown
  });
  test("terrain wetness: saturated on a river centre line and the lake bed, dry far from any water", () => {
    const net = waterNetwork();
    const r = net.rivers.find((q) => !q.dry)!;
    const p = r.points[Math.floor(r.points.length / 2)]!;
    expect(groundWetnessAt(p.x, p.z)).toBe(1);
    if (net.lakes[0]) expect(groundWetnessAt(net.lakes[0].x, net.lakes[0].z)).toBe(1);
    // the world is mostly dry: well under a fifth of random inland points are damp
    let wet = 0, n = 0;
    for (let i = 0; i < 2000; i++) { const x = ((i * 7919) % 4000) - 2000, z = ((i * 104729) % 4000) - 2000; n++; if (groundWetnessAt(x, z) > 0) wet++; }
    expect(wet / n).toBeLessThan(0.2);
  });
  test("colorAt still returns a valid colour in a wet channel", () => {
    const r = waterNetwork().rivers.find((q) => !q.dry)!;
    const p = r.points[3]!;
    const c = colorAt(p.x, p.z, heightAt(p.x, p.z));
    for (const v of c) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
});
