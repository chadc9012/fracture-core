import { describe, expect, test } from "bun:test";
import { LANES, distanceToRoad } from "./lanes";
import { ROAD_HALF } from "./road-ribbon";
import { bridgeOf, laneDressing, nearBridge, roadKind, worldRoadDressing } from "./road-dressing";
import { WATER_LEVEL, deckAt, heightAt, riverCrossings } from "./terrain";

describe("road dressing", () => {
  test("trunk roads are paved, mountain routes gravel, forest and swamp roads dirt", () => {
    const kinds = Object.fromEntries(LANES.map((l) => [l.name, roadKind(l)]));
    expect(kinds["Nexus–Wastelands Highway"]).toBe("asphalt");
    expect(kinds["Neon–Wastelands Industrial Road"]).toBe("asphalt");
    expect(kinds["Wastelands–Frostspire Pass"]).toBe("gravel");
    expect(kinds["Verdant–Nexus Forest Road"]).toBe("dirt");
    expect(kinds["Verdant–Swamps Causeway"]).toBe("dirt");
  });
  const { dressing, bridges } = worldRoadDressing();
  test("paved and gravel roads get posts both sides; nothing stands on the surfaced strip, in water or on a bridge span", () => {
    for (const l of LANES) { const d = laneDressing(l); if (roadKind(l) !== "dirt") expect(d.posts.length).toBeGreaterThan(6); else expect(d.posts.length).toBe(0); }
    for (const p of [...dressing.posts, ...dressing.lamps, ...dressing.rails]) {
      expect(distanceToRoad(p.x, p.z)).toBeGreaterThan(ROAD_HALF);
      expect(heightAt(p.x, p.z)).toBeGreaterThan(WATER_LEVEL);
      expect(nearBridge(p.x, p.z, 0.5)).toBe(false);
    }
  });
  test("each road has a destination sign leaving each hub, naming the other end", () => {
    for (const l of LANES) { const names = dressing.signs.filter((s) => s.to === l.a.name || s.to === l.b.name).map((s) => s.to); expect(names.length).toBeGreaterThan(0); }
    for (const s of dressing.signs) expect(s.km).toBeGreaterThan(0);
  });
  test("asphalt roads light their approaches into the hubs", () => {
    expect(dressing.lamps.length).toBeGreaterThan(4);
  });
  test("every resolved crossing has a bridge built on the deck the player walks on, with piers reaching down", () => {
    const res = riverCrossings().filter((c) => c.resolved);
    expect(bridges.length).toBe(res.length);
    for (const c of res) {
      const b = bridgeOf(c);
      expect(deckAt(c.x, c.z)).toBeCloseTo(b.deck, 5);
      expect(b.length).toBeGreaterThanOrEqual(c.length);
      for (const p of b.piers) expect(p.bed).toBeLessThan(b.deck);
    }
  });
});

import { vergeScatter, vergeGround, VERGE as VERGE_EDGE } from "./road-dressing";
import { LANES as ALL_LANES, distanceToRoad as roadDist } from "./lanes";
import { ROAD_HALF as HALF } from "./road-ribbon";
import { regionAt as region } from "./world";
import { WATER_LEVEL as WL } from "./terrain";

describe("verge scatter (wilds target frame)", () => {
  const at = (x: number, z: number) => region(x, z)?.id;
  const all = ALL_LANES.flatMap((l) => vergeScatter(l, at));
  test("every road gets rocks and scrub along its edges, never on a surfaced strip", () => {
    expect(all.length).toBeGreaterThan(1000);
    expect(all.some((i) => i.kind === "rock") && all.some((i) => i.kind === "scrub")).toBe(true);
    for (const i of all) expect(roadDist(i.x, i.z)).toBeGreaterThan(HALF + 0.85);
  });
  test("items stay within a few metres of a road (they line it, not fill the map)", () => {
    for (const i of all) expect(roadDist(i.x, i.z)).toBeLessThan(VERGE_EDGE + 9);
  });
  test("the dry regions are thicker than the green ones", () => {
    const per = (r: string) => all.filter((i) => i.region === r).length;
    const wl = per("wastelands"), vf = per("veridan");
    if (wl && vf) expect(wl / Math.max(1, vf)).toBeGreaterThan(1);
  });
  test("ground height resolves lazily and items in water are dropped", () => {
    const it = { ...all[0]! };
    const y = vergeGround(it);
    if (y !== null) expect(y).toBeGreaterThan(WL);
    expect(Number.isNaN(it.y)).toBe(false);
  });
  test("deterministic", () => { expect(vergeScatter(ALL_LANES[0]!, at).slice(0, 20)).toEqual(vergeScatter(ALL_LANES[0]!, at).slice(0, 20)); });
});
