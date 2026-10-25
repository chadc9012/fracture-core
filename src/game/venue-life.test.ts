import { describe, expect, test } from "bun:test";
import {
  CAST, CHALLENGES, FOURBEAT, NEXUS_DINER, SPECIALS, castAt, challengeClaimed, claimChallenges, claimDiscovery, dayOf, discovered,
  fourBeatTap, fourBeatTick, greeting, hadSpecialTonight, nightsTalked, openTopics, orderSpecial, recordFact, recordTalk, startFourBeat,
} from "./venue-life";
import { DINER_INTERIOR, dinerFront } from "./venue-doors";
import { INTERIORS } from "./interiors";
import { VENUES, VENUE_HOURS, venueDialogue } from "./nightlife";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "./progression";
import { buildings } from "./nexus-districts";
import { walkHeight, WATER_LEVEL } from "./terrain";
import { nexBalance } from "./nex";

const DAY = 24 * 3600 * 1000;
const T0 = Date.parse("2026-10-25T23:00:00Z");
const fresh = (nex = 1000): PlayerProgression => ({ ...structuredClone(DEFAULT_PROGRESSION), nexLedger: { "test-grant": nex } });

describe("Stage 78: today's venues", () => {
  test("every cast member and special belongs to a venue that exists (the old Pulse Zero / Skyline Room / Pixel Pit / Afterglow Eats ids are gone)", () => {
    const ids = new Set([...VENUES.map((v) => v.id), NEXUS_DINER.id]);
    for (const c of CAST) expect(ids.has(c.venue)).toBe(true);
    for (const s of SPECIALS) expect(ids.has(s.venue)).toBe(true);
    for (const c of CHALLENGES) expect(ids.has(c.venue)).toBe(true);
    for (const old of ["pulse-zero", "skyline-room", "pixel-pit"]) expect(CAST.some((c) => c.venue === old)).toBe(false);
  });
  test("every venue, including the Grid Line Diner, is a walk-in room with hours, a host and greeting lines", () => {
    for (const id of [...VENUES.map((v) => v.id), NEXUS_DINER.id]) {
      expect(INTERIORS.some((i) => i.venueId === id && i.kind === "VENUE")).toBe(true);
      expect(VENUE_HOURS[id]).toBeDefined();
      expect(venueDialogue(id, 0, 22).length).toBeGreaterThan(0);
      expect(castAt(id).length).toBeGreaterThan(0);
    }
  });
  test("pocket rooms never share a spot", () => {
    const keys = INTERIORS.map((i) => `${i.origin.x},${i.origin.z}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  test("the diner's door is on dry street outside its block, not inside any building", () => {
    const f = dinerFront(), d = DINER_INTERIOR;
    expect(walkHeight(d.doorPos.x, d.doorPos.z)).toBeGreaterThan(WATER_LEVEL + 0.5);
    for (const b of buildings()) expect(Math.abs(d.doorPos.x - b.x) > b.w / 2 || Math.abs(d.doorPos.z - b.z) > b.d / 2).toBe(true);
    expect(Math.hypot(d.doorPos.x - f.x, d.doorPos.z - f.z)).toBeLessThan(2.5);
  });
  test("cast members stand inside the room, away from each other and clear of the exit seam", () => {
    for (const c of CAST) {
      expect(Math.abs(c.spot.x)).toBeLessThan(4.6); expect(Math.abs(c.spot.z)).toBeLessThan(4.8);
      expect(Math.hypot(c.spot.x - 0, c.spot.z - 4)).toBeGreaterThan(1.2);
      for (const o of castAt(c.venue)) if (o !== c) expect(Math.hypot(o.spot.x - c.spot.x, o.spot.z - c.spot.z)).toBeGreaterThan(1);
    }
  });
});

describe("Stage 79: conversations, specials and the Four-Beat Dance", () => {
  test("a first meeting, then a line that remembers you", () => {
    let p = fresh();
    expect(greeting(p, "pa-juno", T0)[0]!.text).toBe(CAST.find((c) => c.id === "pa-juno")!.first);
    p = recordTalk(p, "pa-juno", T0);
    expect(greeting(p, "pa-juno", T0 + DAY)[0]!.text).not.toBe(CAST.find((c) => c.id === "pa-juno")!.first);
    p = recordFact(p, "pulse-array", "fourbeat", T0 + DAY);
    expect(greeting(p, "pa-juno", T0 + DAY)[0]!.text).toContain("found the four");
  });
  test("talking twice in one night counts once; later nights open new topics", () => {
    let p = fresh();
    p = recordTalk(recordTalk(p, "ag-otto", T0), "ag-otto", T0 + 1000);
    expect(nightsTalked(p, "ag-otto")).toBe(1);
    expect(openTopics(p, "ag-otto", T0 + 2000).map((t) => t.id)).toEqual(["ag-otto-trams"]);
    expect(openTopics(p, "ag-otto", T0 + DAY).map((t) => t.id)).toContain("ag-otto-ledger");
  });
  test("a discovery pays once", () => {
    let p = fresh();
    for (let i = 0; i < 3; i++) p = recordTalk(p, "pa-juno", T0 + i * DAY);
    const topic = openTopics(p, "pa-juno", T0 + 3 * DAY).find((t) => t.discovery)!;
    const a = claimDiscovery(p, topic);
    expect(a.paid).not.toBeNull();
    expect(discovered(a.progression, topic.id)).toBe(true);
    expect(nexBalance(a.progression.nexLedger)).toBe(nexBalance(p.nexLedger) + topic.discovery!.nex);
    expect(claimDiscovery(a.progression, topic).paid).toBeNull();
  });
  test("a house special costs Nex, works once per venue per night, respects hours and buffs through the stim system", () => {
    const p = fresh(100);
    const r = orderSpecial(p, {}, "afterglow", 23, T0);
    if ("error" in r) throw new Error(r.error);
    expect(nexBalance(r.progression.nexLedger)).toBe(100 - 35);
    expect(r.buffs.healStim!.until).toBe(T0 + 45000);
    expect(hadSpecialTonight(r.progression, "afterglow", T0)).toBe(true);
    expect("error" in orderSpecial(r.progression, r.buffs, "afterglow", 23, T0 + 1000)).toBe(true);
    expect("error" in orderSpecial(r.progression, r.buffs, "afterglow", 23, T0 + DAY)).toBe(false);
    expect("error" in orderSpecial(p, {}, "afterglow", 12, T0)).toBe(true); // Afterglow opens at 21:00
    expect("error" in orderSpecial(fresh(10), {}, "afterglow", 23, T0)).toBe(true); // can't afford it
    // never shortens a longer running buff
    const long = orderSpecial(p, { healStim: { stacks: 2, until: T0 + 300000 } }, "afterglow", 23, T0);
    if ("error" in long) throw new Error(long.error);
    expect(long.buffs.healStim).toEqual({ stacks: 2, until: T0 + 300000 });
  });
  test("Four-Beat: four on-beat taps win; one tap per beat; four misses or the timeout lose", () => {
    let s = startFourBeat("pulse-array"); const b = s.beatMs, at = (k: number) => FOURBEAT.leadInMs + k * b;
    for (let k = 0; k < 4; k++) { s = fourBeatTap(s, at(k) + 10).state; expect(fourBeatTap(s, at(k) + 20).grade).toBeNull(); }
    expect(s.done && s.won).toBe(true);
    let m = startFourBeat("pulse-array");
    for (let k = 0; k < 4; k++) m = fourBeatTap(m, at(k) + b / 2).state;
    expect(m.done && !m.won).toBe(true);
    expect(fourBeatTick(startFourBeat("afterglow"), FOURBEAT.timeoutMs + 1).done).toBe(true);
  });
});

describe("Stage 80: memory and challenges", () => {
  test("challenges pay through the Nex ledger, XP and materials exactly once", () => {
    let p = fresh();
    for (let i = 0; i < 4; i++) p = recordFact(p, "pulse-array", "fourbeat", T0 + i * DAY);
    const xp0 = p.xp, lvl0 = p.level;
    const a = claimChallenges(p);
    expect(a.paid.map((x) => x.title)).toContain("Four-Beat Dance");
    expect(challengeClaimed(a.progression, "four-beat")).toBe(true);
    expect(a.progression.xp !== xp0 || a.progression.level !== lvl0).toBe(true);
    expect(a.progression.materials.energyToken ?? 0).toBe((p.materials.energyToken ?? 0) + 2);
    expect(claimChallenges(a.progression).paid).toHaveLength(0);
  });
  test("one Four-Beat win a night counts toward the challenge", () => {
    let p = fresh();
    for (let i = 0; i < 4; i++) p = recordFact(p, "pulse-array", "fourbeat", T0 + i * 1000);
    expect(claimChallenges(p).paid.some((x) => x.title === "Four-Beat Dance")).toBe(false);
  });
  test("the Tasting Tour needs a special at every venue", () => {
    let p = fresh(5000), buffs = {};
    for (const s of SPECIALS) {
      const r = orderSpecial(p, buffs, s.venue, 23, T0);
      if ("error" in r) throw new Error(`${s.venue}: ${r.error}`);
      p = r.progression; buffs = r.buffs;
    }
    expect(claimChallenges(p).paid.map((x) => x.title)).toContain("Tasting Tour");
  });
  test("memory is plain save keys (no score fields), one per person or venue per night", () => {
    let p = fresh();
    p = recordTalk(p, "gl-deck", T0); p = recordTalk(p, "gl-deck", T0 + 60000);
    expect(p.earnedRewards.filter((k) => k.startsWith("venue-talk:gl-deck@"))).toEqual([`venue-talk:gl-deck@${dayOf(T0)}`]);
  });
});
