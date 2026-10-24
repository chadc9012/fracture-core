import { describe, expect, test } from "bun:test";
import { DEFAULT_PROGRESSION } from "./progression";
import { STORM_ISLAND_SITES, stormSiteWorld } from "./storm-islands";
import { FOUND_KEY, NEST_KILLS, SKY_DOCK_DROP, islandTop, stormGroundAt, stormPrompt, stormQuests, stormSiteAt, stormStep, stormMissionId } from "./storm-quests";

const found = { ...DEFAULT_PROGRESSION, earnedRewards: [...DEFAULT_PROGRESSION.earnedRewards, FOUND_KEY] };
const dock = STORM_ISLAND_SITES.find((s) => s.id === "sky-dock")!;

describe("Storm Islands ground", () => {
  test("you can stand on an island, and the sea below never lifts you up to it", () => {
    const w = stormSiteWorld(dock);
    expect(stormGroundAt(w.x, w.z, islandTop(dock) + 1)).toBe(islandTop(dock));
    expect(stormGroundAt(w.x, w.z, 0)).toBe(-Infinity);
    expect(stormSiteAt(w.x + 3, w.z, islandTop(dock))?.id).toBe("sky-dock");
    expect(stormSiteAt(w.x, w.z, 0)).toBeNull();
    expect(stormSiteAt(SKY_DOCK_DROP.x, SKY_DOCK_DROP.z, SKY_DOCK_DROP.y - 1.6)?.id).toBe("sky-dock");
  });
});

describe("Storm Islands quests", () => {
  test("nothing is open until the islands are found", () => {
    expect(stormQuests(DEFAULT_PROGRESSION).every((q) => q.state === "LOCKED")).toBe(true);
    expect(stormQuests(found)[0]!.state).toBe("ACTIVE");
    expect(stormQuests(found).filter((q) => q.state === "ACTIVE").length).toBe(1);
  });
  test("The Missing Convoy: arrive, recover the manifest, get paid once through the side-contract path", () => {
    let p = stormStep(found, { site: "sky-dock", action: "arrive" }).progression;
    expect(stormPrompt(p, "sky-dock")?.text).toBe("Recover the flight manifest");
    const r = stormStep(p, { site: "sky-dock", action: "interact" });
    p = r.progression;
    expect(r.messages.some((m) => m.includes("complete"))).toBe(true);
    expect(p.completedMissions).toContain(stormMissionId("storm-01"));
    expect(stormQuests(p).find((q) => q.quest.id === "storm-02")!.state).toBe("ACTIVE");
    expect(stormQuests(p).find((q) => q.quest.id === "storm-side-01")!.state).toBe("ACTIVE");
    expect(stormStep(p, { site: "sky-dock", action: "interact" }).progression).toBe(p);
  });
  test("the wrong island or the wrong action does nothing; the nest needs the guardian's pack defeated", () => {
    expect(stormStep(found, { site: "signal-spire", action: "arrive" }).progression).toBe(found);
    let p = stormStep(found, { site: "sky-dock", action: "arrive" }).progression;
    p = stormStep(p, { site: "sky-dock", action: "interact" }).progression;
    p = stormStep(p, { site: "thunder-nest", action: "arrive" }).progression;
    expect(stormStep(p, { site: "thunder-nest", action: "kills", nestKills: NEST_KILLS - 1 }).progression).toBe(p);
    p = stormStep(p, { site: "thunder-nest", action: "kills", nestKills: NEST_KILLS }).progression;
    expect(stormQuests(p).find((q) => q.quest.id === "storm-side-01")!.state).toBe("DONE");
  });
});

import { inStormAirspace } from "./storm-quests";
describe("Storm Islands airspace", () => {
  test("every island stands inside the airspace the rim clamp lets you keep; the sea below it does not", () => {
    for (const s of STORM_ISLAND_SITES) { const w = stormSiteWorld(s); expect(inStormAirspace(w.x, islandTop(s) + 1.6, w.z)).toBe(true); expect(inStormAirspace(w.x, 2, w.z)).toBe(false); }
  });
});
