import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { CAMPAIGN_SCRIPT } from "./campaign-script";
import { CAMPAIGN_CINEMATICS, campaignCinematicsFor, sceneShots } from "./campaign-cinematics";
import { cinematicSeconds, inspectCinematic, skipCinematic, startCinematic, stepCinematic } from "./cinematics";

describe("campaign script", () => {
  test("covers all four documents sections with real dialogue", () => {
    for (const g of ["blackout", "rime-alpha", "null-sovereign", "fracture-engine"] as const) {
      const lines = CAMPAIGN_SCRIPT.filter((s) => s.group === g).flatMap((s) => s.beats.filter((b) => b[0] === "l"));
      expect(lines.length, g).toBeGreaterThanOrEqual(10);
    }
  });
  test("key lines from the document are present", () => {
    const all = CAMPAIGN_SCRIPT.flatMap((s) => s.beats).map((b) => b[b.length - 1]!).join("\n");
    expect(all).toContain("Welcome to Neon City.");
    expect(all).toContain("They were bait.");
    expect(all).toContain("I would prefer to appeal from somewhere else.");
  });
  test("every spoken line has a speaker and text, ids are unique", () => {
    expect(new Set(CAMPAIGN_SCRIPT.map((s) => s.id)).size).toBe(CAMPAIGN_SCRIPT.length);
    for (const s of CAMPAIGN_SCRIPT) for (const b of s.beats) { if (b[0] === "l") { expect(b[1].length).toBeGreaterThan(1); expect(b[3].length).toBeGreaterThan(1); } else expect(b[1].length).toBeGreaterThan(1); }
  });
});

describe("campaign cinematics", () => {
  test("play through the shared controller, skip cleanly, and hand off once", () => {
    expect(CAMPAIGN_CINEMATICS.length).toBeGreaterThanOrEqual(10);
    for (const c of CAMPAIGN_CINEMATICS) {
      expect(c.shots.length, c.id).toBeGreaterThan(0);
      expect(new Set(c.shots.flatMap((s) => s.lines.map((l) => l.id))).size, c.id).toBe(c.shots.flatMap((s) => s.lines).length);
      let p = startCinematic(c);
      expect(inspectCinematic(p, c)).not.toBeNull();
      let handoffs = 0;
      for (let t = 0; t < cinematicSeconds(c) + 2 && p.status !== "done"; t += 0.5) { p = stepCinematic(p, c, 0.5); if (p.handoff) handoffs++; }
      expect(p.status).toBe("done"); expect(handoffs).toBe(1);
      const skipped = skipCinematic(startCinematic(c), c);
      expect(skipped.handoff?.objective).toBe(c.handoff.objective);
    }
  });
  test("the scenes group by section", () => {
    expect(campaignCinematicsFor("fracture-engine").length).toBeGreaterThan(3);
    expect(campaignCinematicsFor("blackout").length).toBeGreaterThan(0);
  });
  test("handoff hooks that claim to exist point at real files", () => {
    for (const c of CAMPAIGN_CINEMATICS) if (c.handoff.hook.exists) { const f = c.handoff.hook.system.split(" ")[0]!; expect(existsSync(`src/game/${f}`), f).toBe(true); }
  });
  test("a cue after spoken lines opens a new shot", () => {
    const scene = CAMPAIGN_SCRIPT.find((s) => s.id === "blackout-3")!;
    expect(sceneShots(scene).length).toBeGreaterThan(1);
  });
});
