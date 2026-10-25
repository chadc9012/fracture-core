// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { threatTicks, THREAT_MAX, THREAT_RANGE } from "./threat-indicators";
import { track } from "./waypoints";

const e = (x: number, z: number, state: "PATROL" | "SUSPICIOUS" | "ALERT" | "SEARCH" = "ALERT", alive = true) => ({ alive, x, z, ai: { state } });

describe("compass threat ticks", () => {
  it("ignores patrolling, dead and distant enemies", () => {
    expect(threatTicks([e(0, 10, "PATROL"), e(0, 10, "ALERT", false), e(0, THREAT_RANGE + 1)], 0, 0, 0)).toEqual([]);
    expect(threatTicks([{ alive: true, x: 0, z: 10 }], 0, 0, 0)).toEqual([]);
  });
  it("uses the same bearing as the compass markers", () => {
    for (const yaw of [0, 1, -2.2, 3]) {
      const t = threatTicks([e(12, -7)], 0, 0, yaw)[0]!;
      const m = track([{ id: "x", kind: "LANDMARK" as never, label: "", regionId: "nexus", x: 12, z: -7 }], 0, 0, yaw)[0]!;
      expect(t.bearing).toBeCloseTo(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, m.bearing)));
    }
  });
  it("pins threats behind the player to the compass edge and flags them", () => {
    const behind = threatTicks([e(0, -20)], 0, 0, 0)[0]!;
    expect(behind.offscreen).toBe(true);
    expect(Math.abs(behind.bearing)).toBeCloseTo(Math.PI / 2);
    expect(threatTicks([e(0, 20)], 0, 0, 0)[0]!.offscreen).toBe(false);
  });
  it("labels suspicious separately, sorts nearest first, caps the count", () => {
    const list = threatTicks([e(0, 30), e(0, 10, "SUSPICIOUS"), ...Array.from({ length: 10 }, (_, i) => e(i + 1, 40))], 0, 0, 0);
    expect(list.length).toBe(THREAT_MAX);
    expect(list[0]).toMatchObject({ dist: 10, level: "SUSPICIOUS" });
    expect(list[1]!.level).toBe("ALERT");
  });
});
