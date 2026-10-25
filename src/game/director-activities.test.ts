// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { MAP_NODES, dungeonBrief, dungeonDeploy, insideStage, launchGate, nodeRadius, raidBrief, raidDeploy } from "./director-activities";
import { CARD_RECT, DESTINATION_PINS, STAGE_PANELS, type Rect } from "./destination-map";
import { SIGNATURE_DUNGEONS, gatesForDay } from "./fracture-gates";
import { RAID_INSTANCES, raidArrival } from "./raid-instances";
import { clearedTodayKey, sealKey } from "./descent-run";
import { createSim } from "./sim";
import { createDescentRuntime, stepDescentRuntime } from "./descent-runtime";
import { DEFAULT_PROGRESSION } from "./progression";
import { WORLD_RADIUS } from "./world";
import { HOLLOW_STAR_ID } from "./hollow-star-data";

const NOW = Date.UTC(2026, 9, 25, 12);
const hits = (r: Rect, x: number, y: number, pad: number) => x + pad > r.x && x - pad < r.x + r.w && y + pad > r.y && y - pad < r.y + r.h;

describe("map nodes", () => {
  it("one node per signature dungeon and per raid, each on an existing destination", () => {
    expect(MAP_NODES.filter((n) => n.kind === "DUNGEON").length).toBe(SIGNATURE_DUNGEONS.length);
    expect(MAP_NODES.filter((n) => n.kind === "RAID").length).toBe(RAID_INSTANCES.length);
    for (const n of MAP_NODES) expect(DESTINATION_PINS.some((p) => p.id === n.destination)).toBe(true);
  });
  it("nodes sit on the planet: inside the stage, off the painted labels, the screen chrome, the card, and each other", () => {
    for (const n of MAP_NODES) {
      const r = nodeRadius(n);
      expect(insideStage(n)).toBe(true);
      for (const p of DESTINATION_PINS) expect(hits(p.label, n.at.x, n.at.y, r)).toBe(false);
      // the status badges (Recommended / Story / bosses) sit in a strip above each label; the rank caption hangs below the node
      for (const p of DESTINATION_PINS) expect(hits({ x: p.label.x, y: p.label.y - 26, w: 240, h: 26 }, n.at.x, n.at.y + r / 2, r * 0.9)).toBe(false);
      for (const panel of [...Object.values(STAGE_PANELS), CARD_RECT]) expect(hits(panel, n.at.x, n.at.y, r)).toBe(false);
      for (const o of MAP_NODES) if (o !== n) expect(Math.hypot(o.at.x - n.at.x, o.at.y - n.at.y)).toBeGreaterThan(r + nodeRadius(o) + 8);
    }
  });
});

describe("dungeon launch", () => {
  it("uses today's world gate when the dungeon has one, otherwise a gate at the board rank", () => {
    const today = gatesForDay(NOW);
    for (const d of SIGNATURE_DUNGEONS) {
      const g = launchGate(d.id, NOW)!;
      const world = today.find((x) => x.dungeonId === d.id);
      if (world) expect(g).toEqual(world);
      else { expect(g.shownRank).toBe(d.rank); expect(g.trueRank).toBe(d.rank); expect(g.sealed).toBe(d.sealed); }
    }
  });
  it("deploys beside the gate (outside its trigger) or on dry land at the destination", () => {
    for (const d of SIGNATURE_DUNGEONS) {
      const t = dungeonDeploy(d.id, NOW)!;
      expect(t.id).toBe(`dungeon:${d.id}`);
      expect("y" in t).toBe(false); // never a submersible arrival: you come back out on your feet
      expect(Math.hypot(t.x, t.z)).toBeLessThan(WORLD_RADIUS);
    }
  });
  it("the runtime enters a launched gate from wherever you stand and returns you there", () => {
    const sim = createSim();
    for (const m of sim.machines) m.alive = false;
    const rt = createDescentRuntime();
    const gate = launchGate("sublevel-protocol", NOW)!;
    const at = { px: 120, py: 30, pz: -40 };
    const r = stepDescentRuntime(rt, sim, { now: NOW, ...at, inVehicle: false, blocked: false, earnedRewards: [], gates: () => [], launch: gate });
    expect(rt.run?.dungeonId).toBe("sublevel-protocol");
    expect(r.teleport).not.toBeNull();
    expect(rt.returnPos).toEqual({ x: at.px, y: at.py, z: at.pz });
  });
  it("a blocked launch does nothing", () => {
    const sim = createSim();
    const rt = createDescentRuntime();
    stepDescentRuntime(rt, sim, { now: NOW, px: 0, py: 30, pz: 0, inVehicle: false, blocked: true, earnedRewards: [], gates: () => [], launch: launchGate("iron-grave", NOW) });
    expect(rt.run).toBeNull();
  });
});

describe("briefings", () => {
  it("a dungeon brief reads the gate, and shows today's clear and owned seals", () => {
    const g = launchGate("iron-grave", NOW)!;
    const p = { ...DEFAULT_PROGRESSION, earnedRewards: [clearedTodayKey("iron-grave", g.day), sealKey("iron-grave", "SOLO")] };
    const b = dungeonBrief(p, "iron-grave", NOW)!;
    expect(b.rank).toBe(g.shownRank);
    expect(b.clearedToday).toBe(true);
    expect(b.seals).toEqual(["SOLO"]);
    expect(b.rewards.find((r) => r.id === "seal-SOLO")!.earned).toBe(true);
    expect(b.modifiers.some((m) => m.id === "collapse")).toBe(true);
    expect(dungeonBrief(DEFAULT_PROGRESSION, "iron-grave", NOW)!.clearedToday).toBe(false);
  });
  it("a raid brief lists its encounters and fireteam; launching it uses the Raid tab's own target", () => {
    const b = raidBrief(DEFAULT_PROGRESSION, HOLLOW_STAR_ID)!;
    expect(b.encounters.length).toBeGreaterThan(3);
    expect(b.fireteam).toBe(6);
    expect(b.cleared).toBe(false);
    const raid = RAID_INSTANCES[0]!;
    expect(raidDeploy(raid)).toMatchObject({ id: `raid:${raid.id}`, ...raidArrival(raid) });
  });
});
