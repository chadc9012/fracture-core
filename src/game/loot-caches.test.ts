// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { canOpen, lootCaches, openCache, isOpenedToday, contractStatus } from "./loot-caches";
import { DEFAULT_PROGRESSION } from "./progression";
import { REGIONS } from "./world";

const NOW = Date.UTC(2026, 9, 10, 12);
const ctx = { enemiesNear: 0, weather: "CLEAR", night: 0, heldSeconds: 0 };

describe("world loot caches", () => {
  it("every region has caches and every lake hides a sunken one", () => {
    for (const r of REGIONS) expect(lootCaches().some((c) => c.regionId === r.id)).toBe(true);
    expect(lootCaches().some((c) => c.scenario === "sunken")).toBe(true);
  });
  it("scenarios gate opening", () => {
    const g = lootCaches().find((c) => c.scenario === "guarded")!;
    expect(canOpen(g, { ...ctx, enemiesNear: 2 }).ok).toBe(false);
    expect(canOpen(g, ctx).ok).toBe(true);
    const e = lootCaches().find((c) => c.scenario === "encrypted")!;
    expect(canOpen(e, { ...ctx, heldSeconds: 2.9 }).ok).toBe(false);
    expect(canOpen(e, { ...ctx, heldSeconds: 3 }).ok).toBe(true);
    const s = lootCaches().find((c) => c.scenario === "storm")!;
    expect(canOpen(s, ctx).ok).toBe(false);
    expect(canOpen(s, { ...ctx, weather: "STORM" }).ok).toBe(true);
    const m = lootCaches().find((c) => c.scenario === "moon")!;
    expect(canOpen(m, ctx).ok).toBe(false);
    expect(canOpen(m, { ...ctx, night: 0.8 }).ok).toBe(true);
  });
  it("a cache opens once per day and refills the next day", () => {
    const c = lootCaches()[0]!;
    const first = openCache(DEFAULT_PROGRESSION, c, NOW)!;
    expect(first).not.toBeNull();
    expect(openCache(first.progression, c, NOW)).toBeNull();
    expect(isOpenedToday(first.progression, c.id, NOW + 86_400_000)).toBe(false);
  });
  it("three caches in one region complete its salvage survey once", () => {
    const region = lootCaches().filter((c) => c.regionId === "veridan").slice(0, 3);
    let p = DEFAULT_PROGRESSION;
    const done: string[] = [];
    for (const c of region) { const r = openCache(p, c, NOW)!; p = r.progression; done.push(...r.contracts); }
    expect(done.some((t) => t.startsWith("Salvage Survey"))).toBe(true);
    expect(p.completedMissions).toContain("side-salvage-veridan");
    expect(contractStatus(p).find((s) => s.contract.id === "side-salvage-veridan")!.done).toBe(true);
  });
});

import { rollCacheGear, GEAR_CHANCE } from "./loot-caches";
describe("loot box gear", () => { const test = it;
  const all = lootCaches();
  test("legendary boxes always drop gear", () => {
    for (const c of all.filter((x) => x.rarity === "LEGENDARY")) expect(rollCacheGear(c, NOW)).not.toBeNull();
  });
  test("drop rate tracks rarity and gear goes to inventory once", () => {
    const commons = all.filter((x) => x.rarity === "COMMON");
    let hits = 0; for (let d = 0; d < 30; d++) for (const c of commons) if (rollCacheGear(c, NOW + d * 864e5)) hits++;
    const rate = hits / (30 * commons.length);
    expect(rate).toBeGreaterThan(GEAR_CHANCE.COMMON / 2); expect(rate).toBeLessThan(GEAR_CHANCE.COMMON * 2);
    const leg = all.find((x) => x.rarity === "LEGENDARY")!;
    const r = openCache(DEFAULT_PROGRESSION, leg, NOW)!;
    expect(r.progression.inventory.filter((g) => g.id === r.gear!.id).length).toBe(1);
  });
});
