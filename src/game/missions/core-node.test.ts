// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { advanceMission, CORE_NODE, coreNodeReady, factionOf, REVEAL_GRAPH, FACTION_KEY, type MissionRun, type MissionEvent } from "./core-node";
import { missionSuite } from "./mission-suite";
import { EMPTY_STORY, runGraph, choose, enterNode } from "../story";
import { QUESTS } from "../quests";

const withChoice = (m: MissionRun, e: MissionEvent) => advanceMission(m, e, "resonants");

missionSuite("Core Node state machine", {
  id: "core-node", advance: withChoice as never, initial: CORE_NODE, payState: "WORLD_UPDATE", questId: "fd-09", materials: { dataShards: 4, microCircuits: 2 },
  script: [
    [{ type: "START" }, "TRIGGERED"], [{ type: "ANCHOR", x: 3, z: 4 }, "INFILTRATE"], [{ type: "ARRIVED" }, "COMBAT_1"], [{ type: "CLEAR" }, "HACKING"],
    [{ type: "HACK", progress: 100 }, "REVEAL"], [{ type: "DECIDED" }, "COMPLETE"], [{ type: "ACK" }, "WORLD_UPDATE"],
  ],
});

describe("Core Node — reveal and allegiance", () => {
  const atReveal = () => {
    let m = CORE_NODE;
    for (const e of [{ type: "START" }, { type: "ANCHOR", x: 0, z: 0 }, { type: "ARRIVED" }, { type: "CLEAR" }, { type: "HACK", progress: 100 }] as MissionEvent[]) m = advanceMission(m, e);
    return m;
  };
  test("the reveal cannot close without a recorded faction", () => {
    const m = atReveal();
    expect(m.state).toBe("REVEAL");
    expect(advanceMission(m, { type: "DECIDED" }, null).state).toBe("REVEAL");
    expect(advanceMission(m, { type: "DECIDED" }, "breakers").state).toBe("COMPLETE");
  });
  for (const f of ["controllers", "breakers", "resonants"] as const) {
    test(`choosing ${f} records the allegiance and NOVA's secret`, () => {
      const s = runGraph(EMPTY_STORY, REVEAL_GRAPH, { offer: f });
      expect(factionOf(s)).toBe(f);
      expect(s.flags).toContain("nova-secret-known");
      expect(s.flags).toContain(`faction-${f}`);
    });
  }
  test("the first allegiance stands: a replay cannot switch sides", () => {
    const s = runGraph(EMPTY_STORY, REVEAL_GRAPH, { offer: "breakers" });
    const flip = choose(enterNode(s, REVEAL_GRAPH, "offer")!.story, REVEAL_GRAPH, "offer", "controllers");
    expect(flip.ok).toBe(false);
    expect(s.choices[FACTION_KEY]).toBe("breakers");
  });
  test("trust with NOVA moves once, however often the scene replays", () => {
    const once = runGraph(EMPTY_STORY, REVEAL_GRAPH, { secret: "trust", offer: "resonants" });
    const twice = runGraph(once, REVEAL_GRAPH, { secret: "trust", offer: "resonants" });
    expect(once.trust["nova"]).toBe(15);
    expect(twice.trust["nova"]).toBe(15);
  });
  test("start gate", () => {
    expect(coreNodeReady(["fd-07"], EMPTY_STORY)).toBe(false);
    expect(coreNodeReady(["fd-08"], EMPTY_STORY)).toBe(true);
    expect(coreNodeReady(["fd-08", "core-node"], EMPTY_STORY)).toBe(false);
    // veterans past fd-09 without an allegiance still get the reveal, but never after the finale
    expect(coreNodeReady(["fd-08", "fd-09"], EMPTY_STORY)).toBe(true);
    expect(coreNodeReady(["fd-08", "fd-09"], { choices: { faction: "breakers" } })).toBe(false);
    expect(coreNodeReady(["fd-08", "fd-09", "fd-18"], EMPTY_STORY)).toBe(false);
  });
  test("fd-09 lists the mission after its original objective", () => {
    const o = QUESTS["fd-09"]!.objectives;
    expect(o[0]!.type).toBe("HACK_COMPLETE");
    expect(o[1]).toMatchObject({ type: "MISSION_COMPLETE", key: "core-node" });
  });
});
