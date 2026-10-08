// @ts-ignore bun:test has no types in this sandbox
import { describe, expect, it } from "bun:test";
import { ABILITY_NODES, DEFAULT_BUILD } from "./ability-network";
import { ABILITY_CONFIGS } from "./combat-engine";
import { classBuild, createLiveBuild, activateLiveAbility } from "./live-build";
import { CLASSES, OPERATORS } from "./loadout";
import { LEGACY_ABILITY_IDS, bodyTypeOr, bodyProfile, migrateAbilityIds, migrateBranches, migrateBuild } from "./operators";
import { normalizeProgression, DEFAULT_PROGRESSION } from "./progression";
import { createDeployGuard, deployCharacter, validateCharacter, type PlayerCharacter } from "./deployment/deployCharacter";
import { applyCharacter } from "./deployment/applyCharacter";
import { deployRiftTurret, stepRiftTurret, strikeDamage, strikeLanding, knockbackFrom, veilSightMult } from "./operator-abilities";

describe("operators + abilities", () => {
  it("roster is NYX / GOLIATH / CIPHER with the specified stats", () => {
    expect(OPERATORS.map((o) => o.name)).toEqual(["GOLIATH", "NYX", "CIPHER"]);
    const nyx = OPERATORS.find((o) => o.id === "nyx")!;
    expect(nyx.baseStats).toEqual({ health: 100, armor: 70, mobility: 100, tech: 65 });
    expect(OPERATORS.find((o) => o.id === "goliath")!.baseStats.health).toBe(160);
  });
  it("every class build resolves to a node and a config, with the spec cooldowns", () => {
    const expected: Record<string, number[]> = { TITAN: [25, 18, 24], HUNTER: [18, 10, 22], WARLOCK: [20, 18, 30] };
    for (const cls of ["TITAN", "HUNTER", "WARLOCK"] as const) {
      const ids = Object.values(classBuild(cls).slots);
      expect(ids.map((id) => ABILITY_CONFIGS.find((c) => c.id === id)?.cooldown)).toEqual(expected[cls]!);
      expect(ids.map((id) => ABILITY_NODES.find((n) => n.id === id)?.cooldown)).toEqual(expected[cls]!);
      expect(CLASSES.find((c) => c.id === cls)!.abilities.map((a) => a.name)).toEqual(ids.map((id) => ABILITY_NODES.find((n) => n.id === id)!.name));
    }
  });
  it("every legacy id maps to an existing node in the same slot and class", () => {
    expect(Object.keys(LEGACY_ABILITY_IDS)).toHaveLength(9);
    for (const [oldId, newId] of Object.entries(LEGACY_ABILITY_IDS)) expect(ABILITY_NODES.some((n) => n.id === newId)).toBe(true);
    expect(ABILITY_NODES.every((n) => n.links.every((l) => ABILITY_NODES.some((m) => m.id === l)))).toBe(true);
    expect(DEFAULT_BUILD.slots.PRIMARY && ABILITY_NODES.some((n) => n.id === DEFAULT_BUILD.slots.TACTICAL)).toBe(true);
  });
  it("old saves migrate: unlocks, equipped build, branches", () => {
    expect(migrateAbilityIds(["fracture-shield", "phase-dash", "siege-mode"])).toEqual(["siege-mode", "phase-veil"]);
    expect(migrateBuild({ mode: "SOLO", slots: { PRIMARY: "code-pulse", TACTICAL: "reality-field", ULTIMATE: "system-override" } }).slots).toEqual({ PRIMARY: "recon-swarm", TACTICAL: "disruption-pulse", ULTIMATE: "rift-turret" });
    expect(migrateBranches({ "fracture-shield": "reflector", "rift-dash": "ghost-step" })).toEqual({ "rift-dash": "ghost-step" });
    const p = normalizeProgression({ ...DEFAULT_PROGRESSION, version: 5, unlockedAbilities: ["phase-dash"], activeBuild: { mode: "SOLO", slots: { PRIMARY: "phase-dash", TACTICAL: "mark-target", ULTIMATE: "time-split" } } });
    expect(p.unlockedAbilities).toEqual(["phase-veil"]);
    expect(p.activeBuild.slots.TACTICAL).toBe("rift-dash");
    expect(p.character).toBeNull();
  });
  it("a legacy build handed to the live build still activates", () => {
    const live = createLiveBuild({ mode: "SOLO", slots: { PRIMARY: "phase-dash", TACTICAL: "mark-target", ULTIMATE: "time-split" } });
    expect(activateLiveAbility(live, "PRIMARY", "war")?.id).toBe("phase-veil");
    expect(live.veilTime).toBe(6);
    expect(activateLiveAbility(live, "TACTICAL", "war")?.id).toBe("rift-dash");
    expect(live.dashTime).toBeGreaterThan(0);
  });
  it("siege sets siegeTime; disruption sets hackTime", () => {
    const g = createLiveBuild(classBuild("TITAN"));
    activateLiveAbility(g, "PRIMARY", "war");
    expect(g.siegeTime).toBe(8);
    const c = createLiveBuild(classBuild("WARLOCK"));
    activateLiveAbility(c, "TACTICAL", "war");
    expect(c.hackTime).toBe(5);
  });
});

describe("operator ability rules", () => {
  it("veil cuts sight, strike doubles under veil", () => {
    expect(veilSightMult(3)).toBeLessThan(0.2);
    expect(veilSightMult(0)).toBe(1);
    expect(strikeDamage(2)).toBe(strikeDamage(0) * 2);
  });
  it("strike lands behind the target; knockback pushes away", () => {
    const l = strikeLanding(0, 0, 0, 10);
    expect(l.x).toBeCloseTo(0); expect(l.z).toBeCloseTo(11.8);
    expect(knockbackFrom(0, 0, 3, 0, 6).x).toBeCloseTo(9);
  });
  it("rift turrets cap at 2, expire, and fire at the nearest target", () => {
    let list = deployRiftTurret([], 0, 0, 0, 20);
    list = deployRiftTurret(list, 5, 0, 1, 20);
    list = deployRiftTurret(list, 9, 0, 2, 20);
    expect(list).toHaveLength(2);
    expect(list[0]!.x).toBe(5);
    expect(deployRiftTurret(list, 1, 1, 100, 20)).toHaveLength(1);
    const t = list[0]!;
    t.cool = 0;
    const hit = stepRiftTurret(t, [{ x: 30, z: 0, alive: true }, { x: 8, z: 0, alive: true }, { x: 6, z: 0, alive: false }], 0.016);
    expect(hit).toBe(1);
    expect(stepRiftTurret(t, [{ x: 8, z: 0, alive: true }], 0.016)).toBe(-1);
  });
});

describe("body types + deploy flow", () => {
  const character = (over: Partial<PlayerCharacter> = {}): PlayerCharacter => ({ deploymentId: "d1", operatorId: "nyx", classId: "HUNTER", subclassId: "SHADOW_HUNTER", bodyType: "robot", displayName: "NYX", appearance: { armor: "#1", cloth: "#2", visor: "#3", trim: "#4", callsign: "NYX" }, loadout: { weaponOrder: ["RIFLE"] }, ...over });
  it("old saves default to male; robots are segmented", () => {
    expect(bodyTypeOr(undefined)).toBe("male");
    expect(bodyTypeOr("female")).toBe("female");
    expect(bodyProfile("robot").segmented).toBe(true);
    expect(bodyProfile("female").shoulders).toBeLessThan(bodyProfile("male").shoulders);
  });
  it("saved character persists into progression and is idempotent", () => {
    const a = applyCharacter(DEFAULT_PROGRESSION, character());
    expect(a.character?.bodyType).toBe("robot");
    expect(a.identityClass).toBe("HUNTER");
    expect(a.activeBuild.slots.PRIMARY).toBe("phase-veil");
    expect(applyCharacter(a, character())).toBe(a);
    expect(normalizeProgression(JSON.parse(JSON.stringify(a))).character?.bodyType).toBe("robot");
  });
  it("validation rejects blank names and bad body types", () => {
    expect(validateCharacter(character({ displayName: "  " }))).toContain("callsign");
    expect(validateCharacter(character({ bodyType: "x" as never }))).toContain("body type");
    expect(validateCharacter(character())).toBeNull();
  });
  it("mission launches only after a successful save", async () => {
    const calls: string[] = [];
    await deployCharacter(character(), { saveCharacter: async () => { calls.push("save"); }, launchMission: async (id) => { calls.push(id); } });
    expect(calls).toEqual(["save", "mission-01"]);
    const failed: string[] = [];
    await expect(deployCharacter(character(), { saveCharacter: async () => { throw new Error("nope"); }, launchMission: async (id) => { failed.push(id); } })).rejects.toThrow("nope");
    expect(failed).toEqual([]);
  });
  it("guard ignores clicks while a deployment is in flight and recovers after failure", async () => {
    const guard = createDeployGuard();
    let launches = 0;
    const run = () => guard.run(async () => { await new Promise((r) => setTimeout(r, 10)); launches++; });
    const results = await Promise.all([run(), run(), run()]);
    expect(launches).toBe(1);
    expect(results.filter((r) => r === null)).toHaveLength(2);
    await guard.run(async () => { throw new Error("x"); }).catch(() => {});
    expect(guard.busy).toBe(false);
  });
});
