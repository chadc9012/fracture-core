import { describe, expect, test } from "bun:test";
import { placeable } from "./dressing-kit";
import * as F from "./frost-dressing";
import * as S from "./swamp-dressing";
import * as W from "./waste-dressing";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";

const ok = (rules: Parameters<typeof placeable>[0], set: readonly { x: number; z: number }[]) => { for (const p of set) expect(placeable(rules, p.x, p.z, 0)).toBe(true); };

describe("Frostspire dressing", () => {
  test("pines, crystals, drifts and camps on valid ground, clear of hazards and arenas", () => {
    ok(F.FROST, F.pines()); ok(F.FROST, F.iceCrystals()); ok(F.FROST, F.drifts());
    const camps = F.camps(); expect(camps.length).toBe(3);
    for (const c of camps) { ok(F.FROST, [c.at]); ok(F.FROST, c.items); }
    expect(F.frozenFall()).not.toBeNull();
  });
});
describe("Swamps dressing", () => {
  test("lily pads only on water, everything off roads and out of the sink/temple", () => {
    ok(S.SWAMP_WATER, S.lilyPads()); ok(S.SWAMP_ANY, S.cypress()); ok(S.SWAMP_ANY, S.logs());
    for (const p of S.fungusPatches().flat()) expect(placeable(S.SWAMP_LAND, p.x, p.z, 0)).toBe(true);
    for (const run of S.boardwalks()) expect(run.length).toBeGreaterThan(4);
  });
});
describe("Wastelands dressing", () => {
  test("ruins, junk and billboards keep off roads and out of the wreck field and outpost", () => {
    ok(W.WASTE, W.ruins()); ok(W.WASTE, W.billboards());
    for (const p of W.junkHeaps().flat()) expect(placeable(W.WASTE, p.x, p.z, 0)).toBe(true);
    expect(W.pylons().length).toBeGreaterThan(5);
    for (const r of W.ruins()) expect(distanceToRoad(r.x, r.z)).toBeGreaterThan(LANE_HALF_WIDTH);
  });
  test("deterministic", () => { expect(W.ruins()).toEqual(W.ruins()); expect(F.pines()).toEqual(F.pines()); });
});

import { waterSurface } from "./dressing-kit";
describe("swamp water surface", () => {
  test("every lily pad has a water surface under it", () => { for (const p of S.lilyPads()) expect(waterSurface(p.x, p.z)).not.toBeNull(); });
});
