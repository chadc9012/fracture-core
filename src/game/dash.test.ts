import { describe, expect, test } from "bun:test";
import { DASHES, DASH_PERKS, RETUNE_COST, chosenPerks, createDashState, dashDamageTaken, dashHit, dashInvulnerable, dashLevel, dashStats, hoverVy, stepDash, tryDash, upgradeDash } from "./dash";
import type { ClassId } from "./loadout";

const CLASSES: ClassId[] = ["HUNTER", "TITAN", "WARLOCK"];
const base = (tokens: number, b: Record<string, string> = {}) => ({ calibrationTokens: tokens, abilityBranches: b });

describe("operator dashes", () => {
  test("each operator has a unique dash with its own numbers", () => {
    const ids = new Set(CLASSES.map((c) => DASHES[c].id));
    expect(ids.size).toBe(3);
    const sigs = new Set(CLASSES.map((c) => JSON.stringify(dashStats(c))));
    expect(sigs.size).toBe(3);
    expect(DASHES.HUNTER.operator).toBe("NYX"); expect(DASHES.TITAN.operator).toBe("GOLIATH"); expect(DASHES.WARLOCK.operator).toBe("CIPHER");
  });
  test("NYX is longest and invulnerable; GOLIATH resists and hurts; CIPHER hovers", () => {
    const n = dashStats("HUNTER"), g = dashStats("TITAN"), c = dashStats("WARLOCK");
    expect(n.distance).toBeGreaterThan(g.distance); expect(n.iframes).toBeGreaterThan(0);
    expect(g.resist).toBeGreaterThan(0); expect(g.hitDamage).toBeGreaterThan(0); expect(g.iframes).toBe(0);
    expect(c.hover).toBeGreaterThan(0);
  });
  test("every class has three tiers of two distinct perks, and every perk changes the stats", () => {
    for (const c of CLASSES) {
      const tiers = DASH_PERKS[c];
      expect(tiers.length).toBe(3);
      const names = new Set<string>();
      tiers.forEach((pair, i) => pair.forEach((p) => { expect(p.tier).toBe(i + 1); names.add(p.id); expect(JSON.stringify(p.apply(dashStats(c)))).not.toBe(JSON.stringify(dashStats(c))); }));
      expect(names.size).toBe(6);
    }
  });
  test("perks must be bought in tier order and cost 1, 2, 3 tokens", () => {
    expect("error" in upgradeDash(base(9), "HUNTER", 2, "afterimage")).toBe(true);
    let p = base(6);
    for (const [tier, perk, cost] of [[1, "short-fuse", 1], [2, "afterimage", 2], [3, "double-step", 3]] as const) {
      const r = upgradeDash(p, "HUNTER", tier, perk); if ("error" in r) throw new Error(r.error);
      expect(r.spent).toBe(cost); p = r.progress;
    }
    expect(p.calibrationTokens).toBe(0);
    expect(dashLevel(p.abilityBranches, "HUNTER")).toBe(3);
    const s = dashStats("HUNTER", p.abilityBranches);
    expect(s.charges).toBe(2); expect(s.cooldown).toBeCloseTo(2.8); expect(s.iframes).toBeCloseTo(0.42);
  });
  test("not enough tokens, unknown perk and repeat picks are refused without changing anything", () => {
    expect("error" in upgradeDash(base(0), "TITAN", 1, "momentum")).toBe(true);
    expect("error" in upgradeDash(base(5), "TITAN", 1, "nope")).toBe(true);
    const a = upgradeDash(base(5), "TITAN", 1, "momentum"); if ("error" in a) throw 0;
    expect("error" in upgradeDash(a.progress, "TITAN", 1, "momentum")).toBe(true);
  });
  test("an earlier tier can be retuned for 1 token and keeps the later tiers", () => {
    let p = base(10);
    for (const [t, id] of [[1, "heavy-boots"], [2, "quake-landing"]] as const) { const r = upgradeDash(p, "TITAN", t, id); if ("error" in r) throw 0; p = r.progress; }
    const before = p.calibrationTokens;
    const r = upgradeDash(p, "TITAN", 1, "momentum"); if ("error" in r) throw new Error(r.error);
    expect(before - r.progress.calibrationTokens).toBe(RETUNE_COST);
    expect(chosenPerks(r.progress.abilityBranches, "TITAN").map((x) => x?.id)).toEqual(["momentum", "quake-landing", undefined]);
  });
  test("one operator's perks never change another's dash", () => {
    const b = { "dash:HUNTER:1": "long-reach" };
    expect(dashStats("TITAN", b)).toEqual(dashStats("TITAN"));
    expect(dashStats("HUNTER", b).distance).toBeCloseTo(11.25);
  });
  test("a later tier stored without the earlier one is ignored", () => {
    expect(dashLevel({ "dash:WARLOCK:3": "twin-drift" }, "WARLOCK")).toBe(0);
  });

  test("dash covers its distance, has i-frames, recharges, and refuses a second use mid-dash", () => {
    const st = dashStats("HUNTER"), s = createDashState("HUNTER");
    expect(tryDash(s, st, 0, -1)).toBe(true);
    expect(tryDash(s, st, 0, -1)).toBe(false);
    expect(dashInvulnerable(s)).toBe(true);
    let dist = 0; const dt = 0.01;
    for (let t = 0; t < 0.5; t += dt) dist += stepDash(s, st, dt) * dt;
    expect(dist).toBeCloseTo(st.distance, 0);
    expect(s.charges).toBe(0);
    for (let t = 0; t < 4; t += dt) stepDash(s, st, dt);
    expect(s.charges).toBe(1);
  });
  test("no direction, no dash", () => expect(tryDash(createDashState("TITAN"), dashStats("TITAN"), 0, 0)).toBe(false));
  test("GOLIATH takes reduced damage only while charging", () => {
    const st = dashStats("TITAN"), s = createDashState("TITAN");
    expect(dashDamageTaken(s, st)).toBe(1);
    tryDash(s, st, 1, 0);
    expect(dashDamageTaken(s, st)).toBe(0.5);
  });
  test("CIPHER hovers after the drift", () => {
    const st = dashStats("WARLOCK"), s = createDashState("WARLOCK");
    tryDash(s, st, 1, 0);
    for (let t = 0; t < 0.3; t += 0.01) stepDash(s, st, 0.01);
    expect(hoverVy(s, -20)).toBe(-1.5);
    for (let t = 0; t < 1; t += 0.01) stepDash(s, st, 0.01);
    expect(hoverVy(s, -20)).toBe(-20);
  });
  test("an enemy counts once per dash, and Edge Refund speeds the recharge", () => {
    const b = { "dash:HUNTER:1": "short-fuse", "dash:HUNTER:2": "edge-refund" };
    const st = dashStats("HUNTER", b), s = createDashState("HUNTER", b);
    tryDash(s, st, 1, 0);
    const before = s.recharge;
    expect(dashHit(s, st, 7)).toBe(true); expect(dashHit(s, st, 7)).toBe(false);
    expect(before - s.recharge).toBeCloseTo(0.6);
  });
  test("two stored charges allow back-to-back dashes", () => {
    const b = { "dash:WARLOCK:1": "swift-drift", "dash:WARLOCK:2": "phase-shield", "dash:WARLOCK:3": "twin-drift" };
    const st = dashStats("WARLOCK", b), s = createDashState("WARLOCK", b);
    expect(s.charges).toBe(2);
    tryDash(s, st, 1, 0); for (let t = 0; t < 0.4; t += 0.01) stepDash(s, st, 0.01);
    expect(tryDash(s, st, 1, 0)).toBe(true);
  });
});
