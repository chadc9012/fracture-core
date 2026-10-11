// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import {
  advanceMission, initialRun, zoneMissionReady, zoneSite, ZONE_MISSIONS, ZONE_MISSION_IDS,
  SEQ_LENGTH, SEQ_GLYPHS, sequenceFor, enterGlyph, sequenceProgress,
  DIALS, DIAL_STEPS, dialStart, dialTarget, turnDial, dialProgress,
  MATCH_LOCKS, MATCH_CODES, matchStart, matchAnswer, matchSignature, pickCode, matchProgress,
} from "./zone-missions";
import { missionSuite } from "./mission-suite";
import { BOSS_LAIRS, SCENARIO_LAIRS, LAIR_RADIUS } from "../waypoints";
import { REGIONS } from "../world";
import { QUESTS } from "../quests";
import { encounterFor } from "../encounters";

for (const id of ZONE_MISSION_IDS) {
  const spec = ZONE_MISSIONS[id];
  missionSuite(`${spec.title} state machine`, {
    id, advance: advanceMission as never, initial: initialRun(id), payState: "WORLD_UPDATE", questId: spec.questId, materials: spec.materials,
    script: [
      [{ type: "START" }, "TRIGGERED"], [{ type: "ANCHOR", x: 3, z: 4 }, "TRAVEL"], [{ type: "ARRIVED" }, "COMBAT_1"], [{ type: "CLEAR" }, "HACKING"],
      [{ type: "HACK", progress: 100 }, "BOSS"], [{ type: "CLEAR" }, "COMPLETE"], [{ type: "ACK" }, "WORLD_UPDATE"],
    ],
  });
}

describe("zone missions — data", () => {
  for (const id of ZONE_MISSION_IDS) {
    const spec = ZONE_MISSIONS[id];
    const region = REGIONS.find((r) => r.id === spec.regionId)!;
    test(`${id}: its quest lists it, its region has a catalog boss, every state has lines`, () => {
      expect(QUESTS[spec.questId]!.objectives.some((o) => o.type === "MISSION_COMPLETE" && o.key === id)).toBe(true);
      expect(encounterFor(spec.regionId)?.boss).toBeTruthy();
      for (const st of ["TRIGGERED", "TRAVEL", "COMBAT_1", "HACKING", "BOSS", "COMPLETE", "WORLD_UPDATE"] as const) {
        expect(spec.nova[st].length).toBeGreaterThan(10);
        expect(spec.objective[st].length).toBeGreaterThan(3);
      }
    });
    test(`${id}: the site is inside the region and far from every walk-in lair`, () => {
      const site = zoneSite(spec, region);
      expect(Math.hypot(site.x - region.x, site.z - region.z)).toBeLessThan(region.radius * 0.6);
      for (const lair of [...BOSS_LAIRS, ...SCENARIO_LAIRS]) {
        if (lair.regionId !== spec.regionId) continue;
        expect(Math.hypot(lair.x - site.x, lair.z - site.z)).toBeGreaterThan(LAIR_RADIUS + 14 + 18 + 16);
      }
    });
  }
  test("each mission starts only in its own chapter", () => {
    expect(zoneMissionReady("frozen-beacon", ["fd-09"])).toBe(false);
    expect(zoneMissionReady("frozen-beacon", ["fd-10"])).toBe(true);
    expect(zoneMissionReady("frozen-beacon", ["fd-10", "fd-11"])).toBe(false); // old saves past the chapter
    expect(zoneMissionReady("frozen-beacon", ["fd-10", "frozen-beacon"])).toBe(false);
    expect(zoneMissionReady("failure-core", ["fd-12"])).toBe(true);
    expect(zoneMissionReady("convoy-breaker", ["fd-13"])).toBe(true);
  });
});

describe("zone missions — minigames", () => {
  test("sequence: the right pattern completes, a slip restarts entry", () => {
    for (let seed = 0; seed < 30; seed++) {
      const seq = sequenceFor(seed);
      expect(seq).toHaveLength(SEQ_LENGTH);
      let s = { entered: 0 };
      s = enterGlyph(s, seed, seq[0]!);
      s = enterGlyph(s, seed, (seq[1]! + 1) % SEQ_GLYPHS.length);
      expect(s.entered).toBe(0);
      for (const g of seq) s = enterGlyph(s, seed, g);
      expect(sequenceProgress(s)).toBe(100);
    }
  });
  test("dial: valves never start on target and can always be turned onto it", () => {
    for (let seed = 0; seed < 30; seed++) {
      let s = dialStart(seed);
      expect(dialProgress(s)).toBe(0);
      for (let i = 0; i < DIALS; i++) {
        const t = dialTarget(seed, i);
        expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThan(DIAL_STEPS);
        for (let k = 0; k < DIAL_STEPS * 2 && !s.locked[i]; k++) s = turnDial(s, seed, i, s.value[i]! < t ? 1 : -1);
        expect(s.locked[i]).toBe(true);
      }
      expect(dialProgress(s)).toBe(100);
    }
  });
  test("match: signatures identify one code; wrong picks only count misses", () => {
    const seed = 99;
    let s = matchStart();
    for (let lock = 0; lock < MATCH_LOCKS; lock++) {
      const sig = matchSignature(seed, lock);
      const fits = MATCH_CODES.filter((c) => c.replace(/[A-Z]/g, "▮") === sig);
      expect(fits).toHaveLength(1);
      s = pickCode(s, seed, lock, (matchAnswer(seed, lock) + 1) % MATCH_CODES.length);
      s = pickCode(s, seed, lock, matchAnswer(seed, lock));
    }
    expect(s.misses).toBe(MATCH_LOCKS);
    expect(matchProgress(s)).toBe(100);
  });
});
