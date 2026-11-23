// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { loadProgression } from "./progression";
import { isMarked, isSlain, slainAt, SLAIN_KEY, TITLE_KEY } from "./sky-sovereign";
import { spendBudget, impactFor, FRAME_PARTICLE_BUDGET } from "./combat-feedback";
import { buyShader, applyShader, grantShader, shaderLook } from "./armor-shaders";
import { cinematicById } from "./cinematics";
import { LAIR_SCENARIOS, scenarioById } from "./unique-scenarios";
import { ENCOUNTERS } from "./scenario-encounters";
import { bossStoryFor, bossDialogueDue } from "./boss-stories";
import { claimDrops } from "./inventory";
import { EMPTY_STORY } from "./story";

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

describe("Vyrak in the world (a Unique — sky-sovereign.ts)", () => {
  test("registered as a Solara scenario with a three-phase encounter and finale", () => {
    const sc = scenarioById("vyrak")!;
    expect(sc.regionId).toBe("solara");
    expect(LAIR_SCENARIOS.some((s) => s.id === "vyrak")).toBe(true);
    const enc = ENCOUNTERS["vyrak"]!;
    expect(enc.phases.map((p) => p.name)).toEqual(["Sky Sovereign", "Scale Shedding", "The Trial"]);
    expect(enc.phases[2]!.finale?.attack).toBe("covenant-roar");
  });
  test("a confirmed, participated kill through claimDrops pays the set, the title and the stamp — once per account", () => {
    const p = { ...loadProgression(), identityClass: "TITAN" as const, earnedRewards: ["ashen-mark:vyrak"] };
    const next = claimDrops(p, [{ id: 1, material: "dragonite", amount: 3, enemy: "Vyrak, the Sky Sovereign", scenarioClaim: { scenarioId: "vyrak", runId: "vyrak-test-run", participated: true, rolls: [] } }]);
    expect(isSlain(next)).toBe(true);
    expect(isMarked(next)).toBe(false); // the mark is lifted by the kill
    expect(next.earnedRewards).toContain(TITLE_KEY);
    expect(slainAt(next)).not.toBeNull();
    expect(next.inventory.filter((g) => g.setId === "dragons-covenant").length).toBe(5);
    expect(next.unlockedAbilities.some((a) => ["ember-bulwark", "wyrm-dash", "ash-nova"].includes(a))).toBe(false);
    const again = claimDrops(next, [{ id: 3, material: "dragonite", amount: 3, enemy: "Vyrak", scenarioClaim: { scenarioId: "vyrak", runId: "vyrak-test-run-3", participated: true, rolls: [] } }]);
    expect(again.earnedRewards.filter((k) => k === SLAIN_KEY).length).toBe(1);
    // no participation, no kill
    const nope = claimDrops(loadProgression(), [{ id: 2, material: "dragonite", amount: 3, enemy: "Vyrak", scenarioClaim: { scenarioId: "vyrak", runId: "vyrak-test-run-2", participated: false, rolls: [] } }]);
    expect(isSlain(nope)).toBe(false);
  });
  test("boss story: intro when he comes down, his last words after the kill, no bond", () => {
    const story = bossStoryFor("vyrak")!;
    expect(story.title).toBe("The Sky Sovereign");
    expect(bossDialogueDue(EMPTY_STORY, "vyrak", "lair")?.id).toBe("vyrak.intro");
    expect(bossDialogueDue(EMPTY_STORY, "vyrak", "defeat")).toBeNull();
    expect(Object.keys(story.due)).toEqual(["defeated"]);
    expect(story.due["defeated"]!.graph.id).toBe("vyrak.fall");
  });
});
