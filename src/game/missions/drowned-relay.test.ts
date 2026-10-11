// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { advanceMission, DROWNED_RELAY, PURGE_CHANNELS, PURGE_FREQUENCIES, PURGE_START, carrierFor, pickFrequency, purgeProgress, relaySite, RELAY_OFFSET } from "./drowned-relay";
import { missionSuite } from "./mission-suite";
import { BOSS_LAIRS, LAIR_RADIUS } from "../waypoints";
import { REGIONS } from "../world";

missionSuite("Drowned Relay state machine", {
  id: "drowned-relay", advance: advanceMission as never, initial: DROWNED_RELAY, payState: "WORLD_UPDATE", questId: "fd-05", materials: { bioCatalyst: 2, dataShards: 2 },
  script: [
    [{ type: "START" }, "TRIGGERED"], [{ type: "ANCHOR", x: 3, z: 4 }, "WADING"], [{ type: "ARRIVED" }, "COMBAT_1"], [{ type: "CLEAR" }, "PURGING"],
    [{ type: "HACK", progress: 100 }, "BOSS"], [{ type: "CLEAR" }, "COMPLETE"], [{ type: "ACK" }, "WORLD_UPDATE"],
  ],
});

describe("Drowned Relay — placement", () => {
  const swamps = REGIONS.find((r) => r.id === "swamps")!;
  const relay = relaySite(swamps);
  test("the relay sits inside the swamps", () => {
    expect(Math.hypot(relay.x - swamps.x, relay.z - swamps.z)).toBeLessThan(swamps.radius * 0.6);
    expect(Math.hypot(RELAY_OFFSET.dx, RELAY_OFFSET.dz)).toBeGreaterThan(0);
  });
  test("walking to the relay (or fighting around it) never enters the KV-Unit's free-roam lair", () => {
    const lair = BOSS_LAIRS.find((l) => l.regionId === "swamps")!;
    // arrival radius 14 + boss summoned 18 m off + wave ring 16 m: stay far outside the lair trigger
    expect(Math.hypot(lair.x - relay.x, lair.z - relay.z)).toBeGreaterThan(LAIR_RADIUS + 14 + 18 + 16);
  });
});

describe("Drowned Relay — purge minigame", () => {
  test("carriers are deterministic and in range", () => {
    for (let seed = 0; seed < 50; seed++) for (let c = 0; c < PURGE_CHANNELS; c++) {
      const f = carrierFor(seed, c);
      expect(f).toBe(carrierFor(seed, c));
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(PURGE_FREQUENCIES.length);
    }
  });
  test("correct picks lock channels and reach 100; wrong picks only count a miss", () => {
    const seed = 1234;
    let s = PURGE_START;
    const wrong = (carrierFor(seed, 0) + 1) % PURGE_FREQUENCIES.length;
    s = pickFrequency(s, seed, 0, wrong);
    expect(s.misses).toBe(1);
    expect(purgeProgress(s)).toBe(0);
    for (let c = 0; c < PURGE_CHANNELS; c++) s = pickFrequency(s, seed, c, carrierFor(seed, c));
    expect(purgeProgress(s)).toBe(100);
    // a locked channel ignores further input
    expect(pickFrequency(s, seed, 0, wrong)).toBe(s);
  });
  test("partial purge never completes the mission", () => {
    let m = DROWNED_RELAY;
    for (const e of [{ type: "START" }, { type: "ANCHOR", x: 0, z: 0 }, { type: "ARRIVED" }, { type: "CLEAR" }] as const) m = advanceMission(m, e);
    m = advanceMission(m, { type: "HACK", progress: 67 });
    expect(m.state).toBe("PURGING");
    expect(m.hack).toBe(67);
  });
});
