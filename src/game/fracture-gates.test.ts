import { describe, expect, test } from "bun:test";
import {
  DESCENT_ORIGIN, DESCENT_TOP, DROP_RADIUS, RANKS, RANK_ORDER, SIGNATURE_DUNGEONS, buildDescent, descentGroundAt, descentSolids,
  gateAt, gateColor, gatesForDay, inShaft, tierAt, tierKinds, type OpenWays,
} from "./fracture-gates";
import { REGIONS, WORLD_RADIUS } from "./world";

const DAY = Date.UTC(2026, 9, 25, 12);
const closed: OpenWays = { drops: new Set(), nested: false };
const allOpen = (n: number): OpenWays => ({ drops: new Set(Array.from({ length: n }, (_, i) => i)), nested: false });

describe("ranks", () => {
  test("deeper ranks go deeper, with more floors, encounters and champions", () => {
    for (let i = 1; i < RANK_ORDER.length; i++) {
      const a = RANKS[RANK_ORDER[i - 1]!], b = RANKS[RANK_ORDER[i]!];
      expect(b.depth).toBeGreaterThan(a.depth);
      expect(b.tiers).toBeGreaterThanOrEqual(a.tiers);
      expect(b.encounters).toBeGreaterThanOrEqual(a.encounters);
      expect(b.gateHeight).toBeGreaterThan(a.gateHeight);
    }
  });
  test("gate colours: cyan low, violet mid, crimson high, red when sealed", () => {
    expect(gateColor("D", false).core).toBe("#5ee7ff");
    expect(gateColor("B", false).core).toBe("#a970ff");
    expect(gateColor("S", false).core).toBe("#ff3b3b");
    expect(gateColor("F", true).core).toBe("#ff2a2a");
  });
});

describe("daily gates", () => {
  test("every signature dungeon with a region gets a gate on dry, gentle ground inside the world", () => {
    const gates = gatesForDay(DAY);
    const sited = SIGNATURE_DUNGEONS.filter((d) => d.regionId);
    expect(gates.length).toBe(sited.length);
    for (const g of gates) {
      expect(Math.hypot(g.x, g.z)).toBeLessThan(WORLD_RADIUS);
      const region = REGIONS.find((r) => r.id === SIGNATURE_DUNGEONS.find((d) => d.id === g.dungeonId)!.regionId)!;
      expect(Math.hypot(g.x - region.x, g.z - region.z)).toBeLessThan(region.radius);
      expect(RANK_ORDER.indexOf(g.trueRank) - RANK_ORDER.indexOf(g.shownRank)).toBeGreaterThanOrEqual(0);
      expect(RANK_ORDER.indexOf(g.trueRank) - RANK_ORDER.indexOf(g.shownRank)).toBeLessThanOrEqual(1);
    }
  });
  test("same day, same gates on every client; another day moves them", () => {
    expect(gatesForDay(DAY)).toEqual(gatesForDay(DAY + 3600_000));
    const tomorrow = gatesForDay(DAY + 86400_000);
    expect(tomorrow.map((g) => `${g.x},${g.z}`)).not.toEqual(gatesForDay(DAY).map((g) => `${g.x},${g.z}`));
  });
  test("some gate-days lie about their rank, most do not", () => {
    let lies = 0, total = 0;
    for (let d = 0; d < 60; d++) for (const g of gatesForDay(DAY + d * 86400_000)) { total++; if (g.trueRank !== g.shownRank) lies++; }
    expect(lies).toBeGreaterThan(0);
    expect(lies / total).toBeLessThan(0.3);
  });
  test("you walk into a gate at its foot", () => {
    const g = gatesForDay(DAY)[0]!;
    expect(gateAt([g], g.x + 1, g.z)?.id).toBe(g.id);
    expect(gateAt([g], g.x + 40, g.z)).toBeNull();
  });
});

describe("descent layout", () => {
  test("threshold first, boss last, the rank's encounter count in between, a gatekeeper from B up", () => {
    for (const r of RANK_ORDER) {
      const k = tierKinds(r);
      expect(k.length).toBe(RANKS[r].tiers);
      expect(k[0]).toBe("THRESHOLD");
      expect(k[k.length - 1]).toBe("BOSS");
      expect(k.filter((x) => x === "ENCOUNTER").length).toBe(RANKS[r].encounters);
      expect(k.includes("GATEKEEPER")).toBe(RANK_ORDER.indexOf(r) >= RANK_ORDER.indexOf("B"));
    }
  });
  test("the boss floor is exactly the rank's depth below the threshold, far above the sea, far outside the world", () => {
    for (const r of RANK_ORDER) {
      const l = buildDescent("rootbound-labyrinth", r);
      expect(l.tiers[0]!.floorY).toBe(DESCENT_TOP);
      expect(DESCENT_TOP - l.tiers[l.tiers.length - 1]!.floorY).toBeCloseTo(RANKS[r].depth, 6);
      expect(l.nested.floorY).toBeGreaterThan(500);
    }
    expect(Math.hypot(DESCENT_ORIGIN.x, DESCENT_ORIGIN.z) - 120).toBeGreaterThan(WORLD_RADIUS);
  });
  test("each drop lands you inside the next room, at the opposite end from that room's own drop", () => {
    const l = buildDescent("crucible-fallen", "S");
    for (let i = 0; i < l.tiers.length - 1; i++) {
      const t = l.tiers[i]!, next = l.tiers[i + 1]!;
      expect(next.landing).toEqual(t.drop!);
      expect(Math.abs(next.landing.z - l.origin.z)).toBeLessThan(next.d / 2);
      if (next.drop) expect(Math.sign(next.drop.z - l.origin.z)).toBe(-Math.sign(next.landing.z - l.origin.z));
    }
  });
});

describe("descent ground", () => {
  const l = buildDescent("iron-grave", "B");
  const t0 = l.tiers[0]!, t1 = l.tiers[1]!;
  test("you stand on the floor of the tier you are on", () => {
    expect(descentGroundAt(l, closed, t0.landing.x, t0.landing.z, t0.floorY + 0.1)).toBe(t0.floorY);
    expect(descentGroundAt(l, closed, t1.landing.x, t1.landing.z, t1.floorY + 0.1)).toBe(t1.floorY);
  });
  test("a closed drop is floor; an open one drops you to the next tier", () => {
    const d = t0.drop!;
    expect(descentGroundAt(l, closed, d.x, d.z, t0.floorY)).toBe(t0.floorY);
    expect(descentGroundAt(l, allOpen(l.tiers.length), d.x, d.z, t0.floorY)).toBe(t1.floorY);
    expect(descentGroundAt(l, allOpen(l.tiers.length), d.x + DROP_RADIUS + 1, d.z, t0.floorY)).toBe(t0.floorY);
  });
  test("outside the column there is no descent floor", () => {
    expect(descentGroundAt(l, closed, 0, 0, 100)).toBe(-Infinity);
    expect(descentGroundAt(l, closed, l.origin.x + 200, l.origin.z, t0.floorY)).toBe(-Infinity);
    // past a small room's wall but over a bigger room below: that lower floor catches you
    expect(descentGroundAt(l, closed, l.origin.x + t0.w, l.origin.z, t0.floorY)).toBeLessThan(t0.floorY);
  });
  test("an open shaft slows the fall between floors", () => {
    const d = t0.drop!, o = allOpen(l.tiers.length);
    expect(inShaft(l, o, d.x, d.z, (t0.floorY + t1.floorY) / 2)).toBe(true);
    expect(inShaft(l, closed, d.x, d.z, (t0.floorY + t1.floorY) / 2)).toBe(false);
    expect(tierAt(l, (t0.floorY + t1.floorY) / 2).index).toBe(1);
  });
  test("every floor is a closed room: four walls, no taller than the gap to the floor above", () => {
    const boxes = descentSolids(l, false);
    expect(boxes.length).toBe(l.tiers.length * 4);
    const step = RANKS.B.depth / (RANKS.B.tiers - 1);
    for (const b of boxes) expect(b.h).toBeLessThan(step);
  });
});
