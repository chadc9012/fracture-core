import { describe, expect, test } from "bun:test";
import {
  addCorpse, bloodOf, corpsePose, critterBlood, emptyGoreEvent, FALL_TIME, GORE_TUNE, makeCorpses, makeGorePools, normalizeGore, severBone,
  severOf, spawnSpray, sprayFor, stepGore, type GoreEvent,
} from "./gore";
import { createSim, defeatMachine, fireBullet, stepSim } from "./sim";
import { heightAt } from "./terrain";
const step = (sim: ReturnType<typeof createSim>) => stepSim(sim, { px: 0, pz: 0, dt: 1 / 60, night: 0.2, inVehicle: false });

const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]!; };
const ev = (o: Partial<GoreEvent>): GoreEvent => ({ ...emptyGoreEvent(), dx: 1, dz: 0, size: 1, ...o });

describe("who bleeds what", () => {
  test("people bleed red, machines spark, aliens green or blue", () => {
    expect(bloodOf({ kind: "RAIDER", profile: "Wasteland Grunt" })).toBe("RED");
    expect(bloodOf({ kind: "VANGUARD", profile: "Frost Enforcer" })).toBe("RED");
    expect(bloodOf({ kind: "OVERCLOCKED", profile: "Data Drone Scout" })).toBe("MACHINE");
    expect(bloodOf({ kind: "OVERCLOCKED", profile: "Automated Tech-Drone" })).toBe("MACHINE");
    expect(bloodOf({ kind: "ABERRATION", profile: "Swamp-Mutated Stalker" })).toBe("GREEN");
    expect(bloodOf({ kind: "ABERRATION", profile: "Silicon-Fused Viper" })).toBe("BLUE");
    expect(bloodOf({ kind: "RAIDER", profile: "Anyone", rival: "TITAN" })).toBe("RED");
  });
  test("wildlife: mammals green, birds/fish/reptiles blue", () => {
    expect(critterBlood("DEER")).toBe("GREEN");
    expect(critterBlood("FOX")).toBe("GREEN");
    expect(critterBlood("VULTURE")).toBe("BLUE");
    expect(critterBlood("FISH")).toBe("BLUE");
    expect(critterBlood("SNAKE")).toBe("BLUE");
  });
  test("the setting defaults to FULL and rejects junk", () => {
    expect(normalizeGore(undefined)).toBe("FULL");
    expect(normalizeGore("nope")).toBe("FULL");
    expect(normalizeGore("OFF")).toBe("OFF");
  });
});

describe("levels", () => {
  test("OFF sprays nothing, REDUCED less than FULL and never severs", () => {
    const e = ev({ kind: "KILL", cause: "PELLET", power: 1 });
    expect(sprayFor(e, "OFF", seq(0)).drops.length).toBe(0);
    const reduced = sprayFor(e, "REDUCED", seq(0)), full = sprayFor(e, "FULL", seq(0));
    expect(reduced.drops.length).toBeGreaterThan(0);
    expect(full.drops.length).toBeGreaterThan(reduced.drops.length);
    expect(reduced.sever).toBeNull();
    expect(reduced.gibs.length).toBe(0);
  });
  test("a heavy blast gibs a body on FULL; a light hit never severs", () => {
    expect(severOf({ kind: "KILL", cause: "BLAST", power: 0.9 }, "FULL", seq(0.5)).gib).toBe(true);
    expect(severOf({ kind: "HIT", cause: "BLADE", power: 1 }, "FULL", seq(0)).part).toBeNull();
    expect(severOf({ kind: "KILL", cause: "BULLET", power: 0.1 }, "FULL", seq(0.5)).part).toBeNull();
  });
  test("blades take limbs or heads; sniper-class rounds take heads", () => {
    expect(severOf({ kind: "KILL", cause: "BLADE", power: 1 }, "FULL", seq(0, 0.6)).part).toBe("ARM_R");
    expect(severOf({ kind: "KILL", cause: "BULLET", power: 0.9 }, "FULL", seq(0, 0.9)).part).toBe("HEAD");
  });
  test("machines spark and vent coolant instead of only bleeding", () => {
    const s = sprayFor(ev({ kind: "KILL", blood: "MACHINE", power: 0.5 }), "FULL", seq(0.3));
    expect(s.sparks.length).toBeGreaterThan(5);
    expect(s.mists.some((m) => m.vapour)).toBe(true);
  });
  test("the exit spray leaves along the hit direction", () => {
    const s = sprayFor(ev({ kind: "HIT", dx: 0, dz: 1, power: 0.5 }), "FULL", seq(0.5, 0.9, 0.5, 0.5));
    const fwd = s.drops.filter((d) => d.vz > 0).length;
    expect(fwd).toBeGreaterThan(s.drops.length / 2);
  });
});

describe("particles land and stain the ground", () => {
  test("droplets fall to the ground and leave decals that later fade", () => {
    const pools = makeGorePools();
    spawnSpray(pools, sprayFor(ev({ kind: "KILL", y: 1.2, power: 0.6 }), "FULL", seq(0.2, 0.7, 0.4)), "RED", "FULL");
    for (let i = 0; i < 120; i++) stepGore(pools, 1 / 60, () => 0, "FULL", seq(0.1));
    expect(pools.drops.filter((d) => d.alive).length).toBe(0);
    const decals = pools.decals.filter((d) => d.alive);
    expect(decals.length).toBeGreaterThan(3);
    expect(decals.every((d) => Math.abs(d.y - 0.03) < 1e-6)).toBe(true);
    for (let i = 0; i < 100; i++) stepGore(pools, 1, () => 0, "FULL");
    expect(pools.decals.filter((d) => d.alive).length).toBe(0);
  });
  test("gibs bounce, come to rest on the ground and stay a while", () => {
    const pools = makeGorePools();
    spawnSpray(pools, sprayFor(ev({ kind: "KILL", cause: "BLAST", power: 1, y: 1, body: { kind: "RAIDER", role: "standard", rot: 0, groundY: 0, scale: 1 } }), "FULL", seq(0.3, 0.6)), "RED", "FULL", seq(0.5));
    expect(pools.gibs.filter((g) => g.alive).length).toBeGreaterThan(4);
    for (let i = 0; i < 600; i++) stepGore(pools, 1 / 60, () => 0, "FULL", seq(0.9));
    const gibs = pools.gibs.filter((g) => g.alive);
    expect(gibs.length).toBeGreaterThan(4);
    expect(gibs.every((g) => g.rest && g.y >= 0 && g.y < 0.2)).toBe(true);
  });
});

describe("bodies", () => {
  test("a killed body falls away from the shot, lies still, then sinks and frees its slot", () => {
    const corpses = makeCorpses();
    const c = addCorpse(corpses, ev({ kind: "KILL", dx: 0, dz: -1, body: { kind: "RAIDER", role: "standard", rot: 0, groundY: 2, scale: 1 } }), "FULL", { sever: null, gib: false, stumpSpurt: 0 })!;
    expect(c.fz).toBe(-1);
    expect(corpsePose({ age: 0, life: c.life }).tip).toBe(0);
    expect(corpsePose({ age: FALL_TIME + 1, life: c.life }).tip).toBeCloseTo(1, 5);
    expect(corpsePose({ age: c.life - 0.01, life: c.life }).sink).toBeGreaterThan(0.9);
    expect(GORE_TUNE.OFF.corpseLife).toBeGreaterThan(0); // bodies fall even with gore off
  });
  test("a gibbed body leaves no corpse", () => {
    expect(addCorpse(makeCorpses(), ev({ kind: "KILL", body: { kind: "RAIDER", role: "standard", rot: 0, groundY: 0, scale: 1 } }), "FULL", { sever: null, gib: true, stumpSpurt: 0 })).toBeNull();
  });
  test("severed parts map onto the Mixamo rig bones", () => {
    const names = ["mixamorig:Hips", "mixamorig:Neck", "mixamorig:Head", "mixamorig:LeftArm", "mixamorig:LeftForeArm", "mixamorig:RightArm", "mixamorig:LeftUpLeg", "mixamorig:RightUpLeg"];
    expect(severBone(names, "HEAD")).toBe("mixamorig:Head");
    expect(severBone(names, "ARM_L")).toBe("mixamorig:LeftArm");
    expect(severBone(names, "LEG_R")).toBe("mixamorig:RightUpLeg");
    expect(severBone(["Bone_1"], "HEAD")).toBeNull();
  });
});

describe("the sim logs gore without changing combat", () => {
  test("a bullet hit logs a HIT, a kill logs a KILL with the body to lay down", () => {
    const sim = createSim();
    const m = sim.machines[0]!;
    const g = heightAt(0, 20), g0 = heightAt(0, 0);
    Object.assign(m, { alive: true, x: 0, z: 20, y: g + 2.2 * 0.95, hp: 3.5, maxHp: 3.5, scale: 0.95, elite: false, boss: false, profile: "Wasteland Grunt", kind: "RAIDER", rot: 0, kx: 0, kz: 0, cool: 9 });
    for (const o of sim.machines.slice(1)) o.alive = false;
    const before = sim.nextGoreId;
    fireBullet(sim, 0, g0 + 1.2, 0, 0, false, Math.atan2(g - g0, 20), 1, 1, 1, undefined, "BULLET");
    for (let i = 0; i < 30 && sim.nextGoreId === before; i++) step(sim);
    expect(sim.nextGoreId).toBeGreaterThan(before);
    const hit = sim.gore[before % sim.gore.length]!;
    expect(hit.kind).toBe("HIT");
    expect(hit.blood).toBe("RED");
    expect(hit.dz).toBeCloseTo(1, 3);
    m.hp = 0; defeatMachine(sim, m);
    const kill = sim.gore[(sim.nextGoreId - 1) % sim.gore.length]!;
    expect(kill.kind).toBe("KILL");
    expect(kill.body?.kind).toBe("RAIDER");
    expect(Math.abs(kill.body!.groundY - heightAt(m.x, m.z))).toBeLessThan(0.15);
  });
  test("a round that meets a published animal stops and drops it", () => {
    const sim = createSim();
    for (const o of sim.machines) o.alive = false;
    const g = heightAt(0, 15), g0 = heightAt(0, 0);
    sim.fauna.push({ id: "deer-1", x: 0, y: g + 1, z: 15, r: 0.9, species: "DEER" });
    fireBullet(sim, 0, g0 + 1.2, 0, 0, false, Math.atan2(g + 1 - (g0 + 1.2), 15));
    for (let i = 0; i < 20; i++) step(sim);
    expect(sim.faunaHits).toContain("deer-1");
    const kill = sim.gore[(sim.nextGoreId - 1) % sim.gore.length]!;
    expect(kill.critter).toBe("deer-1");
    expect(kill.blood).toBe("GREEN");
  });
});
