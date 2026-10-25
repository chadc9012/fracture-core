import { describe, expect, test } from "bun:test";
import { DURATION, STAGGER_IMMUNITY, hitPart, isStaggeredNow, reactionBones, reactTo, recoilAt } from "./enemy-reactions";

const hit = (damage: number, now: number, prev?: ReturnType<typeof reactTo>, o: { elite?: boolean; boss?: boolean } = {}) => reactTo(prev, { damage, maxHp: 10, elite: !!o.elite, boss: !!o.boss, now, dx: 0, dz: 1 });

describe("enemy hit reactions", () => {
  test("a small hit flinches, a big one staggers; elites need more; bosses never stagger", () => {
    expect(hit(1, 0)?.kind).toBe("flinch");
    expect(hit(3, 0)?.kind).toBe("stagger");
    expect(hit(3, 0, undefined, { elite: true })?.kind).toBe("flinch");
    expect(hit(9, 0, undefined, { boss: true })?.kind).toBe("flinch");
  });
  test("a stagger lasts its duration, a flinch never cuts it short, and it can't chain into a stun-lock", () => {
    const s = hit(5, 0)!;
    expect(isStaggeredNow(s, DURATION.stagger * 0.5)).toBe(true);
    expect(hit(1, 0.1, s)).toBe(s);
    expect(isStaggeredNow(s, DURATION.stagger + 0.01)).toBe(false);
    expect(hit(5, DURATION.stagger + 0.2, s)?.kind).toBe("flinch");
    expect(hit(5, DURATION.stagger + STAGGER_IMMUNITY + 0.05, s)?.kind).toBe("stagger");
  });
  test("recoil eases from full to nothing; bad input is ignored", () => {
    const s = hit(5, 0)!;
    expect(recoilAt(s, 0)).toBeCloseTo(1);
    expect(recoilAt(s, DURATION.stagger)).toBe(0);
    expect(recoilAt(s, 0.2)).toBeLessThan(recoilAt(s, 0.05));
    expect(hit(Number.NaN, 0)).toBeUndefined();
    expect(reactTo(undefined, { damage: 1, maxHp: 0, elite: false, boss: false, now: 0, dx: 0, dz: 0 })).toBeUndefined();
  });
});

describe("where the hit lands decides what moves", () => {
  const r = (part: "HEAD" | "TORSO" | "LEGS", dx: number, dz: number) => reactTo(undefined, { damage: 5, maxHp: 10, elite: false, boss: false, now: 0, dx, dz, part })!;
  test("the hit height picks head, torso or legs", () => {
    expect(hitPart(1.7, 0, 1.85)).toBe("HEAD");
    expect(hitPart(1.2, 0, 1.85)).toBe("TORSO");
    expect(hitPart(0.5, 0, 1.85)).toBe("LEGS");
  });
  test("a body shot from the front jolts the chest back; from behind, forward (body facing +z)", () => {
    expect(reactionBones(r("TORSO", 0, -1), 0.02, 0)!["Spine"]![0]).toBeLessThan(0);
    expect(reactionBones(r("TORSO", 0, 1), 0.02, 0)!["Spine"]![0]).toBeGreaterThan(0);
  });
  test("a head shot moves the head and neck, not the legs; a leg shot buckles the knee on the side it is pushed to", () => {
    const head = reactionBones(r("HEAD", 0, -1), 0.02, 0)!;
    expect(head["Head"]![0]).toBeLessThan(0);
    expect(head["LeftLeg"]).toBeUndefined();
    const legs = reactionBones(r("LEGS", 1, 0), 0.02, 0)!; // pushed toward the body's left
    expect(legs["LeftLeg"]![0]).toBeGreaterThan(0.3);
    expect(legs["RightLeg"]).toBeUndefined();
  });
  test("the pose follows the body's facing, and is gone once the reaction ends", () => {
    // the same world-space shot on a body turned round reverses the lean
    expect(Math.sign(reactionBones(r("TORSO", 0, -1), 0.02, Math.PI)!["Spine"]![0])).toBe(1);
    expect(reactionBones(r("TORSO", 0, -1), DURATION.stagger + 0.01, 0)).toBeNull();
    expect(reactionBones(undefined, 0, 0)).toBeNull();
  });
});
