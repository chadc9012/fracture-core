import { describe, expect, test } from "bun:test";
import {
  CINEMATICS, cinematicById, cinematicSeconds, shotSeconds, lineStarts, lineSeconds, startCinematic, stepCinematic, skipCinematic, pauseCinematic,
  resumeCinematic, inspectCinematic, hasPlayed, markPlayed, shouldPlay, playedFlag,
} from "./cinematics";
import { EMPTY_STORY, mergeStory, normalizeStory } from "./story";

const run = (id: string) => cinematicById(id)!;

describe("cinematic data", () => {
  test("ids unique, seven scenes covering missions 1-5 in order", () => {
    const ids = CINEMATICS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["m1-opening", "m2-evac", "m3-facility", "m4-training", "m4-transmission", "m5-road", "m5-gates"]);
    expect([...new Set(CINEMATICS.map((c) => c.mission))]).toEqual([1, 2, 3, 4, 5]);
  });
  test("line ids are unique across every scene (duplicate-dialogue prevention)", () => {
    const all = CINEMATICS.flatMap((c) => c.shots.flatMap((s) => s.lines.map((l) => l.id)));
    expect(new Set(all).size).toBe(all.length);
  });
  test("durations fall inside the screenplay targets", () => {
    for (const c of CINEMATICS) {
      const t = cinematicSeconds(c);
      expect(t).toBeGreaterThanOrEqual(c.target[0]);
      expect(t).toBeLessThanOrEqual(c.target[1]);
    }
  });
  test("every line fits inside its shot and lines never overlap", () => {
    for (const c of CINEMATICS) for (const s of c.shots) {
      const starts = lineStarts(s);
      s.lines.forEach((l, i) => {
        expect(starts[i]! + lineSeconds(l.text)).toBeLessThanOrEqual(shotSeconds(s) + 1e-9);
        if (i) expect(starts[i]!).toBeGreaterThanOrEqual(starts[i - 1]! + lineSeconds(s.lines[i - 1]!.text));
      });
    }
  });
  test("handoffs carry an objective only: no reward, completion or quest fields", () => {
    for (const c of CINEMATICS) {
      expect(Object.keys(c.handoff).sort()).toEqual(["control", "hook", "objective"]);
      expect(c.handoff.objective.length).toBeGreaterThan(0);
    }
    expect(run("m4-training").handoff.control).toBe("class-select");
  });
  test("hook flags are honest: only systems that exist in the repo are marked", () => {
    expect(run("m1-opening").handoff.hook.exists).toBe(true);
    expect(run("m5-road").handoff.hook.exists).toBe(false);
    expect(run("m2-evac").handoff.hook.exists).toBe(false);
  });
});

describe("cinematic player", () => {
  test("plays through and hands off exactly once", () => {
    const c = run("m1-opening");
    let p = startCinematic(c);
    const handoffs: unknown[] = [];
    for (let i = 0; i < 2000; i++) { p = stepCinematic(p, c, 0.1); if (p.handoff) handoffs.push(p.handoff); }
    expect(p.status).toBe("done");
    expect(p.skipped).toBe(false);
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0]).toBe(c.handoff);
  });
  test("skip ends at once with the same valid handoff, and a second skip does nothing", () => {
    const c = run("m3-facility");
    let p = stepCinematic(startCinematic(c), c, 5);
    p = skipCinematic(p, c);
    expect(p.status).toBe("done");
    expect(p.skipped).toBe(true);
    expect(p.handoff).toBe(c.handoff);
    p = skipCinematic(p, c);
    expect(p.handoff).toBeNull();
    p = stepCinematic(p, c, 10);
    expect(p.handoff).toBeNull();
  });
  test("skip right at the start still hands off the correct objective", () => {
    const c = run("m5-road");
    const p = skipCinematic(startCinematic(c), c);
    expect(p.handoff?.objective).toBe("Protect the convoy.");
  });
  test("pause freezes time; resume continues; no handoff while paused", () => {
    const c = run("m2-evac");
    let p = stepCinematic(startCinematic(c), c, 3);
    p = pauseCinematic(p);
    const frozen = stepCinematic(p, c, 1000);
    expect(frozen.elapsed).toBe(3);
    expect(frozen.status).toBe("paused");
    expect(frozen.handoff).toBeNull();
    p = stepCinematic(resumeCinematic(p), c, 1);
    expect(p.elapsed).toBe(4);
  });
  test("ignores non-positive or NaN dt", () => {
    const c = run("m1-opening");
    const p = startCinematic(c);
    expect(stepCinematic(p, c, -1).elapsed).toBe(0);
    expect(stepCinematic(p, c, NaN).elapsed).toBe(0);
  });
  test("inspect reports the shot and line, never a line twice at once, and null when done", () => {
    const c = run("m1-opening");
    let p = startCinematic(c);
    expect(inspectCinematic(p, c)?.shotIndex).toBe(0);
    const seen = new Set<string>();
    let last = "";
    for (let t = 0; t < cinematicSeconds(c); t += 0.25) {
      const i = inspectCinematic({ ...p, elapsed: t }, c);
      expect(i).not.toBeNull();
      if (i?.line && i.line.id !== last) { expect(seen.has(i.line.id)).toBe(false); seen.add(i.line.id); last = i.line.id; }
    }
    const totalLines = c.shots.reduce((n, s) => n + s.lines.length, 0);
    expect(seen.size).toBe(totalLines);
    p = skipCinematic(p, c);
    expect(inspectCinematic(p, c)).toBeNull();
  });
});

describe("played state", () => {
  test("plays once per save; marking is idempotent; dev force replays without touching state", () => {
    let s = EMPTY_STORY;
    expect(shouldPlay(s, "m1-opening")).toBe(true);
    s = markPlayed(s, "m1-opening");
    const again = markPlayed(s, "m1-opening");
    expect(again.flags.filter((f) => f === playedFlag("m1-opening"))).toHaveLength(1);
    expect(hasPlayed(s, "m1-opening")).toBe(true);
    expect(shouldPlay(s, "m1-opening")).toBe(false);
    expect(shouldPlay(s, "m1-opening", true)).toBe(true);
    expect(s.flags).toEqual([playedFlag("m1-opening")]);
  });
  test("survives save/load and cloud merge from either side", () => {
    const local = markPlayed(EMPTY_STORY, "m1-opening");
    const cloud = markPlayed(EMPTY_STORY, "m2-evac");
    const merged = mergeStory(local, cloud, true);
    expect(hasPlayed(merged, "m1-opening")).toBe(true);
    expect(hasPlayed(merged, "m2-evac")).toBe(true);
    const reloaded = normalizeStory(JSON.parse(JSON.stringify(merged)));
    expect(hasPlayed(reloaded, "m1-opening") && hasPlayed(reloaded, "m2-evac")).toBe(true);
    expect(hasPlayed(reloaded, "m3-facility")).toBe(false);
  });
  test("playing or skipping only ever changes the cine flag", () => {
    const c = run("m4-training");
    const p = skipCinematic(startCinematic(c), c);
    const after = p.handoff ? markPlayed(EMPTY_STORY, c.id) : EMPTY_STORY;
    expect(after.flags).toEqual([`cine:${c.id}`]);
    expect(after.stages).toEqual({});
    expect(after.collectibles).toEqual([]);
    expect(after.trust).toEqual({});
  });
});
