// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it, mock } from "bun:test";
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const F = await import("./foundries");
const { createSim, defeatMachine, hurtPlayer, stepSim, fireBullet } = await import("./sim");
const { DEFAULT_PROGRESSION, normalizeProgression } = await import("./progression");
const { mergeProgression } = await import("./cloud-save");
const W = await import("./wasteland-activities");
const { itemTooltip } = await import("./character-sheet");
const { WEAPON_MANIFEST } = await import("./equipment");
const { heightAt } = await import("./terrain");

type P = typeof DEFAULT_PROGRESSION;
const gun = (name: string, slot: "primary" | "secondary" | "heavy" = "primary") => ({ id: name, name, slot, power: 120, level: 1, element: "KINETIC" as const, source: "t" });
const NOW = 1_800_000_000_000;

describe("foundries", () => {
  it("every weapon has a foundry, armor has none, and the derivation is stable", () => {
    expect(F.foundryOf(gun("Enforcer SMG"))).toBe("SUROS");
    expect(F.foundryOf(gun("Heavy Mag-Cannon", "heavy"))).toBe("HAKKE");
    expect(F.foundryOf(gun("Cryo-Pulse Carbine"))).toBe("OMOLON");
    expect(F.foundryOf(gun("Pipe-Rail Pistol", "secondary"))).toBe("TEX_MECHANICA");
    expect(F.foundryOf(gun("The Event Horizon"))).toBe("BLACK_ARMORY");
    expect(F.foundryOf({ ...gun("Enforcer SMG"), foundry: "HAKKE" })).toBe("HAKKE");
    expect(F.foundryOf({ ...gun("Plate"), slot: "chest" })).toBeNull();
    const all = new Set(WEAPON_MANIFEST.map((w) => F.foundryOf(gun(w.name))));
    expect(all.size).toBe(5);
    expect(F.taxonomyOf({ ...gun("Rocket Launcher", "heavy") })?.category).toBe("DELIVERY SYSTEMS");
    expect(itemTooltip(gun("Enforcer SMG")).perks.some((p) => p.includes("SUROS"))).toBe(true);
  });
  it("Häkke adds damage against elites only", () => {
    const hit = (foundry: "HAKKE" | null, elite: boolean) => {
      const sim = createSim();
      for (const m of sim.machines) m.alive = false;
      const m = sim.machines[0]!;
      const X = W.VAULT_GATE.x - 40, Z = W.VAULT_GATE.z, Y = heightAt(X, Z) + 3;
      Object.assign(m, { alive: true, x: X, z: Z + 5, y: Y, hp: 100, elite, boss: false, scale: 1, cool: 9, profile: "T", zone: "wastelands" });
      sim.foundry = foundry;
      fireBullet(sim, X, Y, Z, 0, false, 0, 2, 0, 0);
      for (let i = 0; i < 20; i++) stepSim(sim, { dt: 0.02, px: X, pz: Z, night: 0, inVehicle: false, yaw: 0 });
      return 100 - m.hp;
    };
    expect(hit("HAKKE", true)).toBeGreaterThan(hit(null, true) * 1.15);
    expect(hit("HAKKE", false)).toBeCloseTo(hit(null, false), 5);
  });
  it("Black Armory nanites hit the nearest hostile after a player kill, once, and never pay for world kills", () => {
    const sim = createSim();
    for (const m of sim.machines) m.alive = false;
    const [a, b] = [sim.machines[0]!, sim.machines[1]!];
    Object.assign(a, { alive: true, x: 0, z: 0, hp: 0, boss: false, scale: 1, profile: "A", zone: "wastelands" });
    Object.assign(b, { alive: true, x: 4, z: 0, hp: 5, boss: false, scale: 1, profile: "B", zone: "wastelands" });
    sim.foundry = "BLACK_ARMORY";
    defeatMachine(sim, a, "player");
    expect(b.hp).toBeCloseTo(5 - F.FOUNDRY_RULES.naniteDamage);
    Object.assign(a, { alive: true, hp: 0 });
    const hp = b.hp;
    defeatMachine(sim, a, "world");
    expect(b.hp).toBe(hp);
  });
});

describe("monoblades", () => {
  it("swing stats: finisher, armored bonus, reach, shockwave only on the third swing", () => {
    const base = { damage: 3, reach: 6 };
    expect(F.swingStats(null, 1, base, false)).toEqual({ damage: 3, reach: 6, shockwave: null, deflect: 0 });
    expect(F.swingStats(F.BLADES.vectal, 1, base, true).damage).toBeCloseTo(3 * 1.1 * 1.4);
    expect(F.swingStats(F.BLADES["aegis-broadsword"], 2, base, false).shockwave).toBeNull();
    expect(F.swingStats(F.BLADES["aegis-broadsword"], 3, base, false).shockwave).not.toBeNull();
    expect(F.swingStats(F.BLADES["sun-cutter"], 1, base, false).reach).toBe(8);
    const sw = F.BLADES["aegis-broadsword"].shockwave!;
    expect(F.inShockwave(sw, 0, 0, 0, 0.5, 8)).toBe(true);
    expect(F.inShockwave(sw, 0, 0, 0, 0, -3)).toBe(false);
    expect(F.inShockwave(sw, 0, 0, 0, 5, 5)).toBe(false);
  });
  it("Sun-Cutter's deflect window halves incoming damage", () => {
    const sim = createSim();
    sim.hp = 100; sim.deflectUntil = performance.now() / 1000 + 5;
    hurtPlayer(sim, 10, "t");
    const deflected = 100 - sim.hp;
    sim.hp = 100; sim.deflectUntil = 0;
    hurtPlayer(sim, 10, "t");
    expect(deflected).toBeCloseTo((100 - sim.hp) / 2);
  });
  it("blades are earned in the Wastelands, once, and equipping needs ownership; the choice survives a merge", () => {
    const base: P = { ...DEFAULT_PROGRESSION, materials: {}, earnedRewards: [], completedMissions: [], records: {}, blade: null };
    const v = W.resolveVault(base, { id: "v1", gate: 50 }, "WON", NOW).progression;
    expect(F.ownsBlade(v, "vectal")).toBe(true);
    expect(v.blade).toBe("vectal");
    const g = W.resolveRally(v, "r1", W.rallyTargets().GOLD - 1, NOW).progression;
    expect(F.ownsBlade(g, "sun-cutter")).toBe(true);
    expect(g.blade).toBe("vectal"); // a new blade never replaces your choice
    expect(F.equipBlade(g, "aegis-broadsword")).toBe(g); // not owned
    const eq = F.equipBlade(g, "sun-cutter");
    expect(F.activeBlade(eq)?.id).toBe("sun-cutter");
    expect(normalizeProgression({ ...DEFAULT_PROGRESSION, blade: undefined }).blade).toBeNull();
    expect(mergeProgression(eq, g, true).blade).toBe("sun-cutter");
  });
});
