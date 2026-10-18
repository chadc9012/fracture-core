import { describe, expect, test } from "bun:test";
import { GRIND_MAX_SPEED, GRIND_MIN_SPEED, MAG_RANGE, RAILS, closestOnRail, createGrind, isGrinding, leaveGrind, railAt, stepGrind, tryLatch, worldRails } from "./maggrind";
import { BOOTS, bootStats, buyBoots, buyBootsNex } from "./skate-boots";
import { nexBalance } from "./nex";

const flat = () => 0;
const rails = worldRails({ x: 1000, z: -500 }, flat);
const grid = rails.find((r) => r.id === "grid-line")!;
const avenue = rails.find((r) => r.id === "avenue-run")!;

describe("Mag-Grind boots purchase", () => {
  test("costs 8,000 NEX, is a permanent unlock, and cannot be bought twice", () => {
    expect(BOOTS.maggrind.nexPrice).toBe(8000);
    const p = { earnedRewards: [] as string[], nexLedger: { grant: 9000 } as Record<string, number> };
    const r = buyBootsNex(p, "maggrind"); if (!r.ok) throw new Error(r.reason);
    expect(nexBalance(r.progression.nexLedger)).toBe(1000);
    expect(r.progression.earnedRewards).toContain("boots:maggrind");
    expect(bootStats(r.progression.earnedRewards, "maggrind").grind).toBe(true);
    const again = buyBootsNex(r.progression, "maggrind"); expect(again.ok).toBe(false);
  });
  test("refused without enough NEX, and shards cannot buy it", () => {
    const poor = buyBootsNex({ earnedRewards: [] as string[], nexLedger: { grant: 100 } as Record<string, number> }, "maggrind");
    expect(poor.ok).toBe(false);
    const sh = buyBoots({ earnedRewards: [], fractureShards: 99999 }, "maggrind");
    expect(sh.ok).toBe(false);
  });
  test("unowned Mag-Grind boots give no grind even if equipped", () => expect(bootStats([], "maggrind").grind).toBeFalsy());
  test("other pairs are still bought with shards", () => expect(buyBoots({ earnedRewards: [], fractureShards: 100 }, "street").ok).toBe(true));
});

describe("grind rails", () => {
  test("every rail has at least two points, positive length, and the grid line is a closed loop", () => {
    for (const r of RAILS) expect(r.pts.length).toBeGreaterThanOrEqual(2);
    for (const r of rails) expect(r.total).toBeGreaterThan(10);
    expect(grid.closed).toBe(true);
  });
  test("latching needs the boots, being close, and being near rail height", () => {
    const at = railAt(avenue, 20);
    const g = () => createGrind();
    expect(tryLatch(g(), rails, false, at.x, 0, at.z, 10, 0)).toBe(false);
    expect(tryLatch(g(), rails, true, at.x, 0, at.z + MAG_RANGE + 1, 10, 0)).toBe(false);
    expect(tryLatch(g(), rails, true, at.x, 6, at.z, 10, 0)).toBe(false);
    expect(tryLatch(g(), rails, true, at.x, 0, at.z + 1, 10, 0)).toBe(true);
  });
  test("you keep your direction and at least the minimum speed", () => {
    const g = createGrind(); const a = railAt(avenue, 30);
    tryLatch(g, rails, true, a.x, 0, a.z, -12, 0);
    expect(g.dir).toBe(-1);
    expect(g.speed).toBeGreaterThanOrEqual(GRIND_MIN_SPEED);
    const standing = createGrind(); tryLatch(standing, rails, true, a.x, 0, a.z, 0, 0);
    expect(standing.speed).toBe(GRIND_MIN_SPEED);
  });
  test("speed builds but is capped, and the player rides exactly on the rail", () => {
    const g = createGrind(); const a = railAt(grid, 10);
    tryLatch(g, rails, true, a.x, 14.9, a.z, 5, 0);
    let last = null;
    for (let i = 0; i < 600; i++) last = stepGrind(g, rails, 0.016);
    expect(g.speed).toBe(GRIND_MAX_SPEED);
    expect(last!.y).toBeCloseTo(15 + 1.1);
    expect(isGrinding(g)).toBe(true); // closed loop never runs out
  });
  test("an open rail ends and sets a cooldown before you can latch again", () => {
    const g = createGrind(); const a = railAt(avenue, avenue.total - 3);
    tryLatch(g, rails, true, a.x, 0, a.z, 20, 0);
    let ended = false;
    for (let i = 0; i < 200 && !ended; i++) ended = stepGrind(g, rails, 0.016)?.ended ?? false;
    expect(ended).toBe(true); expect(isGrinding(g)).toBe(false);
    const e = railAt(avenue, avenue.total);
    expect(tryLatch(g, rails, true, e.x, 0, e.z, 0, 0)).toBe(false);
    stepGrind(g, rails, 1);
    expect(tryLatch(g, rails, true, e.x - 3, 0, e.z, 0, 0)).toBe(true);
  });
  test("jumping off keeps the rail speed and pops upward", () => {
    const g = createGrind(); const a = railAt(avenue, 40);
    tryLatch(g, rails, true, a.x, 0, a.z, 20, 0);
    for (let i = 0; i < 30; i++) stepGrind(g, rails, 0.016);
    const out = leaveGrind(g, rails)!;
    expect(out.vy).toBeGreaterThan(5); expect(Math.hypot(out.vx, out.vz)).toBeGreaterThan(GRIND_MIN_SPEED);
    expect(isGrinding(g)).toBe(false);
  });
  test("closest point lies on the rail", () => {
    const c = closestOnRail(avenue, avenue.pts[0]!.x + 5, avenue.pts[0]!.z + 1.5);
    expect(c.dist).toBeCloseTo(1.5); expect(c.s).toBeCloseTo(5);
  });
  test("ground-following rails ride above uneven ground", () => {
    const hill = worldRails({ x: 0, z: 0 }, (x) => x * 0.1);
    const r = hill.find((x) => x.id === "avenue-run")!;
    expect(r.pts[3]!.y).toBeGreaterThan(r.pts[0]!.y);
  });
});
