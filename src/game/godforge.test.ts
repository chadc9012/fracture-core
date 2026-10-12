// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import {
  AWAKEN_KILLS, HEART_KEY, HOLLOW_CROWN, PREMIUM_STORE_ENABLED, VAEL, ascendRelic, claimHeart, collectRuneDust, forgeRelic, forgeStage,
  guardianDue, premiumPurchase, recordRelicKills, removeRune, runeCombat, socketRune, vaelNear,
} from "./godforge";
import { FORGE_MARKS, secretKey } from "./secrets";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "./progression";
import { createSim, defeatMachine, hurtPlayer } from "./sim";
import { heightAt, WATER_LEVEL } from "./terrain";
import { regionAt } from "./world";

const NOW = 1_800_000_000_000;
const marks = FORGE_MARKS.map(secretKey);
const ok = <P,>(r: { progression: P } | { error: string }): P => { if ("error" in r) throw new Error(r.error); return r.progression; };
const slain = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `n${i}`, name: "N", epithet: "", profile: "p", regionId: "wastelands", rank: 3, traits: [], kills: 1, returns: 0, status: "SLAIN" as const, createdAt: 0, lastSeenAt: 0, grudge: "" }));
const ready = (): PlayerProgression => ({ ...DEFAULT_PROGRESSION, earnedRewards: [...marks], materials: { forgeCatalyst: 20, runeDust: 40, aegisCore: 4, fractureCore: 2 }, fractureShards: 5000, nemeses: [] });

describe("Godforge questline", () => {
  it("the Hollow Crown is a real place in the Wastelands on dry land, with Vael inside it", () => {
    expect(regionAt(HOLLOW_CROWN.x, HOLLOW_CROWN.z)?.id).toBe("wastelands");
    expect(heightAt(HOLLOW_CROWN.x, HOLLOW_CROWN.z)).toBeGreaterThan(WATER_LEVEL + 0.5);
    expect(Math.hypot(VAEL.x - HOLLOW_CROWN.x, VAEL.z - HOLLOW_CROWN.z)).toBeLessThan(HOLLOW_CROWN.radius);
  });
  it("stages: sealed until all three marks, the guardian only wakes at the open door, Vael only after the heart", () => {
    expect(forgeStage({ earnedRewards: marks.slice(0, 2) })).toBe("SEALED");
    const door = { earnedRewards: marks };
    expect(forgeStage(door)).toBe("DOOR");
    expect(guardianDue(door, HOLLOW_CROWN.x, HOLLOW_CROWN.z)).toBe(true);
    expect(guardianDue({ earnedRewards: marks.slice(0, 1) }, HOLLOW_CROWN.x, HOLLOW_CROWN.z)).toBe(false);
    expect(vaelNear(door, VAEL.x, VAEL.z)).toBe(false);
    const p = ok(claimHeart({ ...ready() }));
    expect(p.earnedRewards).toContain(HEART_KEY); expect(p.materials.crownHeart).toBe(1);
    expect(vaelNear(p, VAEL.x, VAEL.z)).toBe(true);
    expect("error" in claimHeart(p)).toBe(true);
  });
});

describe("relics and runes", () => {
  it("forging needs the heart and consumes it; runes need unlocking, respect sockets and conflicts, and set the element", () => {
    expect("error" in forgeRelic(ready(), "eclipse-devourer", NOW)).toBe(true);
    let p = ok(forgeRelic(ok(claimHeart(ready())), "eclipse-devourer", NOW));
    expect(p.materials.crownHeart).toBe(0);
    const id = p.inventory.find((i) => i.godforge)!.id;
    expect("error" in socketRune(p, id, "BLOOM")).toBe(true); // the Drowned Bell is not found yet
    p = ok(socketRune(p, id, "STORM"));
    expect(p.inventory.find((i) => i.id === id)!.element).toBe("ARC");
    expect("error" in socketRune(p, id, "FROST")).toBe(true); // one socket at Relic tier
    p = { ...p, nemeses: slain(1) };
    p = ok(ascendRelic(p, id));
    p = ok(socketRune(p, id, "FROST"));
    expect("error" in socketRune({ ...p, nemeses: slain(3) }, id, "EMBER")).toBe(true);
    p = ok(removeRune(p, id, "STORM"));
    expect(p.inventory.find((i) => i.id === id)!.element).toBe("CRYO");
  });
  it("ascending is gated by slain nemeses and raises level and power", () => {
    let p = ok(forgeRelic(ok(claimHeart(ready())), "crownfire", NOW));
    const id = p.inventory.find((i) => i.godforge)!.id, lvl = p.inventory.find((i) => i.id === id)!.level;
    expect("error" in ascendRelic(p, id)).toBe(true);
    p = ok(ascendRelic({ ...p, nemeses: slain(1) }, id));
    const it = p.inventory.find((i) => i.id === id)!;
    expect(it.godforge!.tier).toBe("ASCENDANT"); expect(it.level).toBe(lvl + 1);
    expect("error" in ascendRelic(p, id)).toBe(true);
  });
  it("mastery awakens once at the kill target", () => {
    let p = ok(forgeRelic(ok(claimHeart(ready())), "stillwater", NOW));
    const id = p.inventory.find((i) => i.godforge)!.id, power = p.inventory.find((i) => i.id === id)!.power;
    p = recordRelicKills(p, id, AWAKEN_KILLS - 1).progression;
    expect(p.inventory.find((i) => i.id === id)!.godforge!.awakened).toBe(false);
    const r = recordRelicKills(p, id, 5);
    expect(r.message).toContain("awakens");
    expect(r.progression.inventory.find((i) => i.id === id)!.power).toBe(power + 30);
    expect(recordRelicKills(r.progression, id, 500).message).toBeUndefined();
  });
  it("rune dust is derived from nemeses and secrets and can only be collected once", () => {
    const p = { ...ready(), nemeses: slain(2) };
    const r = ok(collectRuneDust(p));
    expect(r.materials.runeDust).toBe(40 + 4 + marks.length);
    expect("error" in collectRuneDust(r)).toBe(true);
  });
  it("the premium store is switched off and cannot sell anything", () => {
    expect(PREMIUM_STORE_ENABLED).toBe(false);
    expect("error" in premiumPurchase()).toBe(true);
  });
});

describe("runes in the real sim", () => {
  it("Ward cuts incoming damage, Reap heals on a player kill", () => {
    const a = createSim(), b = createSim();
    Object.assign(b.runes, runeCombat({ tier: "RELIC", runes: ["WARD"], kills: 0, awakened: false }));
    hurtPlayer(a, 20, "t"); hurtPlayer(b, 20, "t");
    expect(100 - b.hp).toBeCloseTo((100 - a.hp) * 0.85);
    const s = createSim(); for (const m of s.machines) m.alive = false;
    Object.assign(s.runes, runeCombat({ tier: "RELIC", runes: ["REAP"], kills: 0, awakened: false }));
    s.hp = 50;
    const m = s.machines[0]!; Object.assign(m, { alive: true, hp: 0, x: 0, z: 0, profile: "x", zone: "veridan", drop: "scrapMetal" });
    defeatMachine(s, m, "player");
    expect(s.hp).toBe(56);
  });
});
