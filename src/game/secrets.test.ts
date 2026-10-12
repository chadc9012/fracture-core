// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { FORGE_MARKS, SECRETS, claimSecret, conditionHolds, secretKey, secretPoint, senseSecret, SECRET_REACH } from "./secrets";
import { DEFAULT_PROGRESSION } from "./progression";
import { heightAt, WATER_LEVEL } from "./terrain";
import { REGIONS } from "./world";

const ctx0 = { night: false, storm: false, nemesisSlain: false, pledged: false };
const base = () => ({ ...DEFAULT_PROGRESSION, materials: {}, earnedRewards: [] as string[] });

describe("secrets", () => {
  it("every secret sits on dry land inside its region", () => {
    for (const s of SECRETS) {
      const p = secretPoint(s), r = REGIONS.find((x) => x.id === s.regionId)!;
      expect(Math.hypot(p.x - r.x, p.z - r.z)).toBeLessThan(r.radius);
      expect(heightAt(p.x, p.z)).toBeGreaterThan(WATER_LEVEL + 0.3);
    }
  });
  it("conditions gate the claim, and each pays once into materials, shards and the story collection", () => {
    const night = SECRETS.find((s) => s.condition === "NIGHT")!;
    expect("error" in claimSecret(base(), night.id, ctx0)).toBe(true);
    const r = claimSecret(base(), night.id, { ...ctx0, night: true });
    if ("error" in r) throw new Error(r.error);
    expect(r.progression.earnedRewards).toContain(secretKey(night.id));
    expect(r.progression.story.collectibles).toContain(`secret:${night.id}`);
    expect(r.progression.fractureShards).toBe(base().fractureShards + night.shards);
    expect("error" in claimSecret(r.progression, night.id, { ...ctx0, night: true })).toBe(true);
  });
  it("sensing finds the nearest unfound secret and skips found ones", () => {
    const s = SECRETS[0]!, p = secretPoint(s);
    const near = senseSecret(p.x + 1, p.z, { ...ctx0, earned: [] });
    expect(near?.secret.id).toBe(s.id); expect(near!.dist).toBeLessThan(SECRET_REACH);
    expect(senseSecret(p.x + 1, p.z, { ...ctx0, earned: [secretKey(s.id)] })?.secret.id).not.toBe(s.id);
  });
  it("FRAGMENTS needs all three Forgewright marks", () => {
    expect(conditionHolds("FRAGMENTS", { ...ctx0, earned: FORGE_MARKS.slice(0, 2).map(secretKey) })).toBe(false);
    expect(conditionHolds("FRAGMENTS", { ...ctx0, earned: FORGE_MARKS.map(secretKey) })).toBe(true);
  });
});
