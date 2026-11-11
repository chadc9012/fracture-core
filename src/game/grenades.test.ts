// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { createSim, type Machine, type WorldSim } from "./sim";
import { GRENADES, OPERATOR_GRENADES, SMOKE_SIGHT, blastDamage, equipGrenade, equippedGrenade, inSmoke, newPouch, nextGrenade, stepFlight, stepPouch, switchPouch, throwGrenade, type GrenadeId, type LiveGrenade } from "./grenades";
import { newGrenadeRuntime, playerShrouded, stepPlayerGrenades, throwPlayerGrenade, type GrenadeRuntime } from "./player-grenades";
import { heightAt } from "./terrain";
import type { ClassId } from "./loadout";

let clock = 2000;
let spy: { mockRestore: () => void };
beforeEach(() => { clock = 2000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

const TX = 3000, TZ = 3000, flat = () => 0;
const world = () => { const sim = createSim(); for (const m of sim.machines) m.alive = false; return sim; };
let slot = 0;
function put(sim: WorldSim, dx: number, dz: number, over: Partial<Machine> = {}): Machine {
  const m = sim.machines[slot++ % sim.machines.length]!;
  Object.assign(m, { alive: true, x: TX + dx, z: TZ + dz, y: heightAt(TX, TZ), hp: 10, maxHp: 10, rot: 0, scale: 1, zone: "wastelands", cool: 0, elite: false, boss: false, profile: "Test Drone", kind: "OVERCLOCKED", kx: 0, kz: 0, mission: false, vulnUntil: 0, vulnMult: 1, aim: 0, poiseState: undefined, scenarioId: undefined, playerHits: undefined, ...over });
  return m;
}
/** a grenade of a kind lying at the target, about to go off (or a mine already armed) */
function drop(rt: GrenadeRuntime, kind: GrenadeId, dx = 0, dz = 0, over: Partial<LiveGrenade> = {}) {
  const g: LiveGrenade = { id: rt.nextId++, kind, x: TX + dx, y: 0.12, z: TZ + dz, vx: 0, vy: 0, vz: 0, fuse: 0.01, rest: true, armed: false, zone: false, life: GRENADES[kind].duration, ...over };
  rt.live.push(g); return g;
}
const run = (sim: WorldSim, rt: GrenadeRuntime, seconds: number, player = { x: TX, z: TZ + 40 }) => {
  for (let t = 0; t < seconds; t += 0.05) { clock += 0.05; stepPlayerGrenades(sim, rt, 0.05, { player, ground: flat, now: clock }); }
};

describe("every Operator has three grenades of its own", () => {
  it("nine grenades, three per Operator, none shared", () => {
    const all = Object.values(OPERATOR_GRENADES).flat();
    expect(all).toHaveLength(9);
    expect(new Set(all).size).toBe(9);
    for (const [cls, ids] of Object.entries(OPERATOR_GRENADES)) for (const id of ids) expect(GRENADES[id].classId).toBe(cls as ClassId);
    expect(OPERATOR_GRENADES.TITAN.map((id) => GRENADES[id].operator)).toEqual(["GOLIATH", "GOLIATH", "GOLIATH"]);
    expect(OPERATOR_GRENADES.HUNTER.map((id) => GRENADES[id].operator)).toEqual(["NYX", "NYX", "NYX"]);
    expect(OPERATOR_GRENADES.WARLOCK.map((id) => GRENADES[id].operator)).toEqual(["CIPHER", "CIPHER", "CIPHER"]);
  });
  it("the equipped grenade is saved under grenade:<CLASS>, defaults to the first, and can't be another Operator's", () => {
    expect(equippedGrenade({}, "HUNTER").id).toBe("shroud");
    const p = equipGrenade({ abilityBranches: {} }, "HUNTER", "tripmine");
    expect("error" in p).toBe(false);
    expect(equippedGrenade((p as { abilityBranches: Record<string, string> }).abilityBranches, "HUNTER").id).toBe("tripmine");
    expect("error" in equipGrenade({ abilityBranches: {} }, "HUNTER", "breacher")).toBe(true);
    expect(equippedGrenade({ "grenade:TITAN": "shroud" }, "TITAN").id).toBe("breacher");
    expect(nextGrenade("WARLOCK", "rift-well")).toBe("singularity");
  });
});

describe("the pouch", () => {
  it("throws spend a charge; charges come back one per cooldown", () => {
    const p = newPouch("breacher"), live: LiveGrenade[] = [];
    expect(throwGrenade(p, live, 1, { x: 0, y: 2, z: 0 }, 0, 0)).not.toBeNull();
    expect(throwGrenade(p, live, 2, { x: 0, y: 2, z: 0 }, 0, 0)).not.toBeNull();
    expect(throwGrenade(p, live, 3, { x: 0, y: 2, z: 0 }, 0, 0)).toBeNull();
    for (let t = 0; t < GRENADES.breacher.cooldown + 0.1; t += 0.1) stepPouch(p, 0.1);
    expect(p.charges).toBe(1);
  });
  it("switching keeps the fill as a fraction", () => {
    const p = newPouch("breacher"); p.charges = 1;
    expect(switchPouch(p, "concussion").charges).toBe(1);
    expect(switchPouch({ kind: "singularity", charges: 1, recharge: 0 }, "arc-chain").charges).toBe(2);
  });
  it("a throw arcs out along the aim, lands and rolls to a stop; a tripmine sticks where it first lands", () => {
    const live: LiveGrenade[] = [], p = newPouch("breacher");
    const g = throwGrenade(p, live, 1, { x: 0, y: 1.5, z: 0 }, 0, 0.2)!;
    for (let t = 0; t < 4 && !g.rest; t += 0.02) stepFlight(g, 0.02, flat);
    expect(g.rest).toBe(true);
    expect(g.z).toBeGreaterThan(12); expect(Math.abs(g.x)).toBeLessThan(0.01);
    const m = throwGrenade(newPouch("tripmine"), live, 2, { x: 0, y: 1.5, z: 0 }, Math.PI / 2, 0.2)!;
    let landedAt = 0;
    for (let t = 0; t < 4; t += 0.02) { stepFlight(m, 0.02, flat); if (m.rest && !landedAt) landedAt = m.x; }
    expect(m.x).toBe(landedAt);
  });
  it("at most two tripmines are set; a third takes the oldest's place", () => {
    const live: LiveGrenade[] = [], p = newPouch("tripmine"); p.charges = 3;
    for (let i = 1; i <= 3; i++) throwGrenade(p, live, i, { x: 0, y: 1, z: 0 }, 0, 0);
    expect(live.map((g) => g.id)).toEqual([2, 3]);
  });
});

describe("GOLIATH's grenades", () => {
  it("Breacher Frag: heavy damage falling off to the edge, throws bodies back, nothing beyond the radius", () => {
    const sim = world(), rt = newGrenadeRuntime("breacher");
    const close = put(sim, 1, 0), edge = put(sim, 5, 0), out = put(sim, 6.5, 0);
    drop(rt, "breacher"); run(sim, rt, 0.1);
    expect(close.hp).toBeLessThan(10 - GRENADES.breacher.damage * 0.8);
    expect(edge.hp).toBeGreaterThan(close.hp);
    expect(out.hp).toBe(10);
    expect(close.x - TX).toBeGreaterThan(1.5);
    expect(blastDamage(GRENADES.breacher, 0)).toBe(6); expect(blastDamage(GRENADES.breacher, 6)).toBe(0);
  });
  it("Thermite: a burning pool that keeps hurting what stands in it until it burns out", () => {
    const sim = world(), rt = newGrenadeRuntime("thermite"), m = put(sim, 3.5, 0, { hp: 40, maxHp: 40 });
    drop(rt, "thermite"); run(sim, rt, 0.1);
    expect(m.hp).toBeGreaterThan(39.5); // outside the first blast (only a moment of the pool)
    run(sim, rt, 3);
    expect(m.hp).toBeLessThan(40 - GRENADES.thermite.tick * 2.5);
    run(sim, rt, 4);
    expect(rt.live).toHaveLength(0);
  });
  it("Concussion: light damage, a long stun and a big shove across a wide radius", () => {
    const sim = world(), rt = newGrenadeRuntime("concussion"), m = put(sim, 6, 0, { aim: 0.5 });
    drop(rt, "concussion"); run(sim, rt, 0.1);
    expect(m.hp).toBeGreaterThan(8); expect(m.cool).toBeGreaterThanOrEqual(2.3); expect(m.aim).toBe(0);
    expect(rt.stunned.has(m)).toBe(true);
  });
});

describe("NYX's grenades", () => {
  it("Shroud: enemies in the cloud can't aim; you in the cloud are almost unseen; it clears", () => {
    const sim = world(), rt = newGrenadeRuntime("shroud"), m = put(sim, 2, 0, { aim: 0.6 });
    drop(rt, "shroud"); run(sim, rt, 1);
    expect(m.aim).toBe(0); expect(m.cool).toBeGreaterThan(0);
    expect(playerShrouded(rt, TX + 1, TZ)).toBe(true);
    expect(playerShrouded(rt, TX + 20, TZ)).toBe(false);
    expect(SMOKE_SIGHT).toBeLessThan(0.2);
    run(sim, rt, GRENADES.shroud.duration);
    expect(inSmoke(rt.live, TX, TZ)).toBe(false);
  });
  it("Tripmine: waits armed until an enemy comes close, then goes off; it times out unsprung", () => {
    const sim = world(), rt = newGrenadeRuntime("tripmine"), far = put(sim, 10, 0);
    drop(rt, "tripmine", 0, 0, { fuse: 0.5 }); run(sim, rt, 3);
    expect(rt.live).toHaveLength(1); expect(rt.live[0]!.armed).toBe(true); expect(far.hp).toBe(10);
    far.x = TX + 2; run(sim, rt, 0.1);
    expect(rt.live).toHaveLength(0); expect(far.hp).toBeLessThan(10 - 4);
    drop(rt, "tripmine", 0, 0, { fuse: 0.1 }); run(sim, rt, GRENADES.tripmine.duration + 1);
    expect(rt.live).toHaveLength(0);
  });
  it("Tracer: marks what it catches to take a third more damage for six seconds", () => {
    const sim = world(), rt = newGrenadeRuntime("tracer"), m = put(sim, 2, 0);
    drop(rt, "tracer"); run(sim, rt, 0.1);
    expect(m.vulnMult).toBeCloseTo(1.33, 2); expect(m.vulnUntil).toBeGreaterThan(clock + 5);
  });
});

describe("CIPHER's grenades", () => {
  it("Singularity: drags enemies in to the centre, then bursts on them", () => {
    const sim = world(), rt = newGrenadeRuntime("singularity"), m = put(sim, 7, 0);
    drop(rt, "singularity"); run(sim, rt, 0.8);
    expect(m.x - TX).toBeLessThan(4);
    run(sim, rt, 1.2);
    expect(m.hp).toBeLessThan(10 - 2);
    expect(rt.live).toHaveLength(0);
  });
  it("Arc Chain: stuns what it hits and arcs on to the nearest enemies beyond the blast", () => {
    const sim = world(), rt = newGrenadeRuntime("arc-chain");
    const a = put(sim, 1, 0), b = put(sim, 8, 0), c = put(sim, 15, 0), d = put(sim, 40, 0);
    drop(rt, "arc-chain"); run(sim, rt, 0.1);
    for (const m of [a, b, c]) { expect(m.hp).toBeLessThan(10); expect(m.cool).toBeGreaterThanOrEqual(1.4); }
    expect(d.hp).toBe(10);
    expect(rt.fx.at(-1)!.arcs!.length).toBeGreaterThanOrEqual(3);
  });
  it("Rift Well: heals you while you stand in it, and enemies in it fire slower", () => {
    const sim = world(), rt = newGrenadeRuntime("rift-well"), m = put(sim, 1, 0, { cool: 0 });
    sim.hp = 40;
    drop(rt, "rift-well"); run(sim, rt, 2, { x: TX, z: TZ + 1 });
    expect(sim.hp).toBeGreaterThan(40 + GRENADES["rift-well"].tick * 1.5);
    expect(m.cool).toBeGreaterThan(0.5);
    sim.hp = 40; run(sim, rt, 2, { x: TX + 30, z: TZ });
    expect(sim.hp).toBe(40);
  });
});

describe("grenade kills are the player's", () => {
  it("a grenade kill goes through the sim's kill path", () => {
    const sim = world(), rt = newGrenadeRuntime("breacher"), m = put(sim, 0.5, 0, { hp: 1, maxHp: 1 });
    const kills = sim.kills;
    drop(rt, "breacher"); run(sim, rt, 0.1);
    expect(m.alive).toBe(false); expect(sim.kills).toBe(kills + 1);
  });
  it("throwPlayerGrenade refuses when the pouch is empty", () => {
    const rt = newGrenadeRuntime("singularity");
    expect(throwPlayerGrenade(rt, { x: 0, y: 1, z: 0 }, 0, 0)).toBe(true);
    expect(throwPlayerGrenade(rt, { x: 0, y: 1, z: 0 }, 0, 0)).toBe(false);
  });
});
