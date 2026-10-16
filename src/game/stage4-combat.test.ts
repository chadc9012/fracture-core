// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { loadProgression } from "./progression";
import { claimCovenant, claimWyrmlingGift, isBonded } from "./dragon-covenant";
import { spendBudget, impactFor, FRAME_PARTICLE_BUDGET } from "./combat-feedback";
import { buyShader, applyShader, grantShader, shaderLook } from "./armor-shaders";
import { cinematicById } from "./cinematics";

describe("Vyrak's Covenant", () => {
  test("bonds only the Operator class that won, once", () => {
    const r = claimCovenant(loadProgression(), "HUNTER");
    expect(r.bonded).toBe(true);
    expect(isBonded(r.progression, "HUNTER")).toBe(true);
    expect(isBonded(r.progression, "TITAN")).toBe(false);
    expect(r.progression.inventory.filter((g) => g.setId === "dragons-covenant").length).toBe(5);
    expect(claimCovenant(r.progression, "HUNTER").bonded).toBe(false);
  });
  test("Wyrmling gift is once per day and only for the bonded class", () => {
    const p = claimCovenant(loadProgression(), "WARLOCK").progression;
    const day = 86_400_000 * 100;
    const g = claimWyrmlingGift(p, "WARLOCK", day)!;
    expect(g.materials.dragonite).toBe(7);
    expect(claimWyrmlingGift(g, "WARLOCK", day + 1000)).toBeNull();
    expect(claimWyrmlingGift(p, "TITAN", day)).toBeNull();
  });
});

describe("combat feedback", () => {
  test("pistol hit is light, ability and boss scale up", () => {
    expect(impactFor({ damage: 20 })).toBe("light");
    expect(impactFor({ damage: 20, ability: true })).toBe("ability");
  });
  test("many hits never exceed the frame budget, but a boss hit still shows", () => {
    let left = FRAME_PARTICLE_BUDGET.PERFORMANCE, total = 0;
    for (let i = 0; i < 50; i++) { const s = spendBudget(left, "heavy"); total += s.particles; left = s.remaining; }
    expect(total).toBe(FRAME_PARTICLE_BUDGET.PERFORMANCE);
    expect(spendBudget(0, "boss").particles).toBeGreaterThan(0);
  });
});

describe("armor shaders", () => {
  test("buy once, apply to many items, stats untouched", () => {
    const base = { ...loadProgression(), materials: { microCircuits: 100 } };
    const b = buyShader(base, "neon-rain"); if ("error" in b) throw new Error(b.error);
    expect(b.progression.materials.microCircuits).toBe(60);
    expect("error" in buyShader(b.progression, "neon-rain")).toBe(true);
    let p = b.progression;
    for (const item of p.inventory.slice(0, 2)) { const r = applyShader(p, item.id, "neon-rain"); if ("error" in r) throw new Error(r.error); p = r.progression; }
    expect(p.inventory.slice(0, 2).every((g) => g.shader === "neon-rain")).toBe(true);
    expect(p.inventory.map((g) => g.power)).toEqual(base.inventory.map((g) => g.power));
  });
  test("cannot apply unowned; exotic keeps its glow", () => {
    const p = loadProgression();
    expect("error" in applyShader(p, p.inventory[0]!.id, "void-prism")).toBe(true);
    expect(grantShader(p, "void-prism").earnedRewards).toContain("shader:void-prism");
    expect(shaderLook({ rarity: "EXOTIC", shader: "void-prism" }, "#ffffff")!.emissive).toBe("#ffffff");
  });
});

test("Neon arrival ends in player control with the objective", () => {
  const c = cinematicById("neon-arrival")!;
  expect(c.handoff).toMatchObject({ control: "gameplay", objective: "INVESTIGATE THE DISTURBANCE" });
});
