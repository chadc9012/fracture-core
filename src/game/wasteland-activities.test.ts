// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it, mock } from "bun:test";
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const A = await import("./wasteland-activities");
const { createWasteRuntime, stepWasteRuntime } = await import("./wasteland-runtime");
const { DEFAULT_PROGRESSION, normalizeProgression } = await import("./progression");
const { mergeProgression } = await import("./cloud-save");
const { createSim, defeatMachine } = await import("./sim");
const { heightAt, WATER_LEVEL, slopeAt } = await import("./terrain");
const { trustOf } = await import("./story");

type P = typeof DEFAULT_PROGRESSION;
const base = (): P => ({ ...DEFAULT_PROGRESSION, materials: {}, earnedRewards: [], completedMissions: [], records: {} });
const NOW = 1_800_000_000_000;
const quiet = () => { const sim = createSim(); for (const m of sim.machines) m.alive = false; return sim; };

describe("places", () => {
  it("every start, the arena and each checkpoint are on dry, drivable ground", () => {
    for (const p of [A.VAULT_GATE, A.ARENA, A.RUST_RUN.start, ...A.RUST_RUN.checkpoints]) {
      expect(heightAt(p.x, p.z)).toBeGreaterThan(WATER_LEVEL + 0.5);
      expect(slopeAt(p.x, p.z)).toBeLessThan(0.45);
    }
    expect(A.rallyTargets().GOLD).toBeLessThan(A.rallyTargets().BRONZE);
  });
});

describe("vault defense", () => {
  it("three waves in order, gate damage only from raiders near it, won when the last wave is cleared", () => {
    let r = A.startVault(NOW);
    let s = A.stepVault(r, { dt: 4, tagAlive: 0, nearGate: 0, playerDist: 3, playerAlive: true });
    expect(s.spawnWave).toEqual(A.VAULT_WAVES[0]);
    r = s.run;
    r = A.stepVault(r, { dt: 2, tagAlive: 5, nearGate: 2, playerDist: 3, playerAlive: true }).run;
    expect(r.gate).toBeCloseTo(A.GATE_MAX - 2 * A.GATE_DPS_PER_RAIDER * 2);
    for (let w = 1; w <= A.VAULT_WAVES.length; w++) {
      s = A.stepVault(r, { dt: 0.1, tagAlive: 0, nearGate: 0, playerDist: 3, playerAlive: true });
      r = s.run;
      if (w < A.VAULT_WAVES.length) { expect(r.phase).toBe("BREAK"); s = A.stepVault(r, { dt: A.VAULT_BREAK + 0.1, tagAlive: 0, nearGate: 0, playerDist: 3, playerAlive: true }); expect(s.spawnWave).toEqual(A.VAULT_WAVES[w]); r = s.run; }
    }
    expect(s.outcome).toBe("WON");
  });
  it("fails on a breached gate, on death and when you leave", () => {
    const wave = { ...A.startVault(NOW), phase: "WAVE" as const, wave: 1, gate: 1 };
    expect(A.stepVault(wave, { dt: 1, tagAlive: 3, nearGate: 3, playerDist: 3, playerAlive: true }).outcome).toBe("FAILED");
    expect(A.stepVault(wave, { dt: 0.1, tagAlive: 3, nearGate: 0, playerDist: 3, playerAlive: false }).outcome).toBe("FAILED");
    expect(A.stepVault(wave, { dt: 0.1, tagAlive: 3, nearGate: 0, playerDist: 500, playerAlive: true }).outcome).toBe("FAILED");
  });
  it("a win pays once per run through the mission taper and raises Legion standing", () => {
    const run = { id: "v1", gate: 90 };
    const r = A.resolveVault(base(), run, "WON", NOW);
    expect(r.progression.completedMissions).toContain("side-vault-defense");
    expect(trustOf(r.progression.story, A.LEGION)).toBe(15);
    expect(A.resolveVault(r.progression, run, "WON", NOW).progression).toBe(r.progression);
    expect(A.legionRank(r.progression)).toBe("Gate Hand");
  });
});

describe("rally and derby", () => {
  it("the rally needs every checkpoint in order and a vehicle", () => {
    let r = A.startRally();
    expect(A.stepRally(r, { dt: 1, x: 0, z: 0, inVehicle: false }).outcome?.finished).toBe(false);
    const last = A.RUST_RUN.checkpoints[A.RUST_RUN.checkpoints.length - 1]!;
    expect(A.stepRally(r, { dt: 1, x: last.x, z: last.z, inVehicle: true }).checkpoint).toBeUndefined(); // out of order does nothing
    let s: ReturnType<typeof A.stepRally> = { run: r };
    for (const c of A.RUST_RUN.checkpoints) { s = A.stepRally(s.run, { dt: 5, x: c.x, z: c.z, inVehicle: true }); }
    expect(s.outcome).toEqual({ finished: true, time: 5 * A.RUST_RUN.checkpoints.length });
  });
  it("medals pay each tier once, best time is kept, records merge best-wins", () => {
    const t = A.rallyTargets();
    const r1 = A.resolveRally(base(), `r624`, t.SILVER - 1, NOW);
    expect(r1.medal).toBe("SILVER");
    expect(r1.progression.earnedRewards.filter((k) => k.startsWith("medal:rust-run")).length).toBe(2);
    const r2 = A.resolveRally(r1.progression, `r648`, t.GOLD - 1, NOW);
    expect(r2.progression.earnedRewards.filter((k) => k.startsWith("medal:rust-run")).length).toBe(3);
    expect(r2.progression.records["rust-run"]).toBe(t.GOLD - 1);
    const r3 = A.resolveRally(r2.progression, `r885`, t.BRONZE - 1, NOW);
    expect(r3.progression.records["rust-run"]).toBe(t.GOLD - 1);
    expect(A.mergeRecords({ "rust-run": 90, "mash-pit": 4 }, { "rust-run": 80, "mash-pit": 9 })).toEqual({ "rust-run": 80, "mash-pit": 9 });
    expect(normalizeProgression({ ...DEFAULT_PROGRESSION, records: undefined }).records).toEqual({});
    expect(mergeProgression({ ...base(), records: { "rust-run": 70 } }, { ...base(), records: { "rust-run": 60 } }, true).records["rust-run"]).toBe(60);
  });
  it("derby counts only kills in the pit in a vehicle, ends when you leave or time runs out", () => {
    let r = A.startDerby(NOW);
    r = A.stepDerby(r, { dt: 1, inArena: true, inVehicle: true, kills: 3, tagAlive: 2 }).run;
    expect(r.wrecks).toBe(3);
    const s = A.stepDerby(r, { dt: 1, inArena: false, inVehicle: true, kills: 5, tagAlive: 2 });
    expect(s.outcome).toEqual({ wrecks: 3 });
    expect(A.resolveDerby(base(), { id: "d" }, 11, NOW).medal).toBe("SILVER");
  });
});

describe("runtime on the real sim", () => {
  it("stepping onto the gate starts the defense and spawns tagged raiders; clearing them all wins", () => {
    const sim = quiet(), rt = createWasteRuntime(sim);
    const step = (dt: number) => stepWasteRuntime(rt, sim, { dt, now: NOW, px: A.VAULT_GATE.x, pz: A.VAULT_GATE.z, inVehicle: false, blocked: false });
    step(0.1);
    expect(rt.vault?.phase).toBe("BREAK");
    const emits = [];
    for (let w = 0; w < 3; w++) {
      step(A.VAULT_BREAK + 3.1);
      const tagged = sim.machines.filter((m) => m.alive && m.living?.startsWith("vault:"));
      expect(tagged.length).toBe(A.VAULT_WAVES[w]!.size);
      for (const m of tagged) { m.hp = 0; defeatMachine(sim, m, "player"); }
      emits.push(...step(0.1).emits);
    }
    expect(emits).toEqual([expect.objectContaining({ type: "VAULT", outcome: "WON" })]);
    expect(step(0.1).hud?.title).toBe("Activity over"); // and it does not restart while you stand there
    expect(rt.vault).toBeNull();
  });
  it("the derby only starts in a vehicle and spawns buggies", () => {
    const sim = quiet(), rt = createWasteRuntime(sim);
    stepWasteRuntime(rt, sim, { dt: 0.1, now: NOW, px: A.ARENA.x, pz: A.ARENA.z, inVehicle: false, blocked: false });
    expect(rt.derby).toBeNull();
    stepWasteRuntime(rt, sim, { dt: 0.1, now: NOW, px: A.ARENA.x, pz: A.ARENA.z, inVehicle: true, blocked: false });
    stepWasteRuntime(rt, sim, { dt: 0.1, now: NOW, px: A.ARENA.x, pz: A.ARENA.z, inVehicle: true, blocked: false });
    const buggies = sim.machines.filter((m) => m.alive && m.living?.startsWith("derby:"));
    expect(buggies.length).toBeGreaterThan(0);
    expect(buggies.every((m) => m.profile === "Rust-Runner Buggy")).toBe(true);
  });
});
