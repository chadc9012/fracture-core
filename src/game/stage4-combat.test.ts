// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { loadProgression } from "./progression";
import { claimCovenant, claimWyrmlingGift, isBonded } from "./dragon-covenant";
import { spendBudget, impactFor, FRAME_PARTICLE_BUDGET } from "./combat-feedback";
import { buyShader, applyShader, grantShader, shaderLook } from "./armor-shaders";
import { cinematicById } from "./cinematics";
import { LAIR_SCENARIOS, scenarioById } from "./unique-scenarios";
import { ENCOUNTERS } from "./scenario-encounters";
import { bossStoryFor, bossDialogueDue } from "./boss-stories";
import { claimDrops } from "./inventory";
import { EMPTY_STORY } from "./story";
import { createSim, summonScenarioBoss } from "./sim";
import { createLiveBuild } from "./live-build";
import { castAbility } from "./ability-effects";

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

describe("Vyrak in the world", () => {
  test("registered as a Solara lair scenario with a three-phase encounter and finale", () => {
    const sc = scenarioById("vyrak")!;
    expect(sc.regionId).toBe("solara");
    expect(LAIR_SCENARIOS.some((s) => s.id === "vyrak")).toBe(true);
    const enc = ENCOUNTERS.vyrak!;
    expect(enc.phases.map((p) => p.name)).toEqual(["Sky Sovereign", "Scale Shedding", "Covenant Trial"]);
    expect(enc.phases[2]!.finale?.attack).toBe("covenant-roar");
  });
  test("a confirmed, participated Vyrak kill bonds the Operator through claimDrops", () => {
    const p = { ...loadProgression(), identityClass: "TITAN" as const };
    const next = claimDrops(p, [{ id: 1, material: "dragonite", amount: 3, enemy: "Vyrak, the Ashen Covenant", scenarioClaim: { scenarioId: "vyrak", runId: "vyrak-test-run", participated: true, rolls: [] } }]);
    expect(isBonded(next, "TITAN")).toBe(true);
    expect(next.inventory.filter((g) => g.setId === "dragons-covenant").length).toBe(5);
    expect(next.unlockedAbilities).toContain("ember-bulwark");
    // no participation, no bond
    const nope = claimDrops(loadProgression(), [{ id: 2, material: "dragonite", amount: 3, enemy: "Vyrak", scenarioClaim: { scenarioId: "vyrak", runId: "vyrak-test-run-2", participated: false, rolls: [] } }]);
    expect(nope.earnedRewards.some((r) => r.startsWith("covenant:vyrak:"))).toBe(false);
  });
  test("boss story: intro at the lair, bond conversation after the kill", () => {
    const story = bossStoryFor("vyrak")!;
    expect(story.title).toBe("The Ashen Covenant");
    expect(bossDialogueDue(EMPTY_STORY, "vyrak", "lair")?.id).toBe("vyrak.intro");
    expect(bossDialogueDue(EMPTY_STORY, "vyrak", "defeat")).toBeNull();
  });
  test("covenant abilities cast: wyrm-dash burns and refunds, ash-nova weakens", () => {
    const sim = createSim();
    expect(summonScenarioBoss(sim, scenarioById("rime-alpha")!, 0, 4)).toBe(true);
    const m = sim.machines.find((x) => x.alive)!;
    Object.assign(m, { hp: 1e6, maxHp: 1e6, cool: 999, x: 0, z: 4 }); // on the dash path (yaw 0 → +z)
    const hunter = { ...loadProgression(), identityClass: "HUNTER" as const };
    const bonded = claimCovenant(hunter, "HUNTER").progression;
    const live = createLiveBuild({ mode: "HYBRID", slots: { PRIMARY: "phase-veil", TACTICAL: "wyrm-dash", ULTIMATE: "shadow-strike" } }, bonded.abilityBranches);
    const hpBefore = m.hp;
    const r = castAbility(sim, live, "TACTICAL", { x: 0, z: 0, yaw: 0 }, { environment: "war", inVehicle: false });
    expect(r.ok).toBe(true);
    expect(m.hp).toBeLessThan(hpBefore);
    const warlock = claimCovenant(loadProgression(), "WARLOCK").progression;
    const live2 = createLiveBuild({ mode: "HYBRID", slots: { PRIMARY: "recon-swarm", TACTICAL: "ash-nova", ULTIMATE: "rift-turret" } }, warlock.abilityBranches);
    const r2 = castAbility(sim, live2, "TACTICAL", { x: 0, z: 0, yaw: 0 }, { environment: "war", inVehicle: false });
    expect(r2.ok).toBe(true);
  });
});
