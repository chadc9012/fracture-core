// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { createSim, fireBullet, stepSim, summonScenarioBoss, type Machine, type WorldSim } from "./sim";
import { NULL_CHARGE_THRESHOLD, NULL_COOLDOWN_SECONDS, NULL_DECAY_SECONDS, NULL_PERK, NULL_PULSE_POISE, NULL_PULSE_RADIUS, NULL_PULSE_STUN_SECONDS, resetNullCharge } from "./null-disruption";
import { INITIAL_POISE } from "./boss-poise";
import { heightAt } from "./terrain";
import { scenarioById } from "./unique-scenarios";

/** These tests drive the REAL bullet loop in stepSim (fireBullet -> stepSim -> hit -> perk), with performance.now() under test control.
 * Targets are parked far from the player with a long attack cooldown so AI does not interfere. */
let clock = 1000; // seconds
let spy: { mockRestore: () => void };
const TX = 2000, TZ = 2000; // far from spawn/other systems
const PX = TX + 100, PZ = TZ; // inside despawn range (260 m) but beyond the 55 m ranged-attack range

beforeEach(() => { clock = 1000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

function makeSim(perk: typeof NULL_PERK | null = NULL_PERK): WorldSim {
  const sim = createSim();
  for (const m of sim.machines) m.alive = false;
  sim.equippedPerk = perk ?? undefined;
  return sim;
}
const home = new WeakMap<Machine, { x: number; z: number }>(); // AI patrol would otherwise drift targets out from under the bullet
function put(sim: WorldSim, i: number, over: Partial<Machine> = {}): Machine {
  const m = sim.machines[i]!;
  home.set(m, { x: TX + i * 3, z: TZ });
  Object.assign(m, { alive: true, x: TX + i * 3, z: TZ, y: heightAt(TX, TZ), hp: 1e6, rot: 0, scale: 1, zone: "wastelands", cool: 99, elite: false, boss: false, profile: "Test Drone", kind: "OVERCLOCKED", kx: 0, kz: 0, mission: false, vulnUntil: 0, vulnMult: 1, aim: 0, ...over });
  return m;
}
/** one player bullet at the machine, one sim step */
function shoot(sim: WorldSim, m: Machine, dt = 0.016) {
  clock += dt;
  sim.weaponHeat = 0; sim.overheated = false; // heat is a separate system; keep the harness firing
  const h = home.get(m); if (h && m.alive) { m.x = h.x; m.z = h.z; m.kx = 0; m.kz = 0; }
  expect(fireBullet(sim, m.x, heightAt(m.x, m.z) + 3, m.z, 0)).toBe(true);
  stepSim(sim, { px: PX, pz: PZ, dt, night: 0.5, inVehicle: false });
}
const timedOrdinary = (m: Machine) => { m.aim = 50; m.cool = 99; }; // wind-up in progress = interrupt = timed
const charge = (sim: WorldSim) => sim.nullCharge.charge;

describe("Null Disruption through the real bullet-hit loop", () => {
  it("a timed hit on an ordinary enemy (interrupting a wind-up) adds exactly one charge", () => {
    const sim = makeSim(); const m = put(sim, 0); timedOrdinary(m);
    shoot(sim, m);
    expect(charge(sim)).toBe(1);
  });
  it("a normal hit (no wind-up, no open window) adds no charge", () => {
    const sim = makeSim(); const m = put(sim, 0);
    shoot(sim, m);
    expect(charge(sim)).toBe(0);
  });
  it("a missed shot adds no charge and spends no hit event", () => {
    const sim = makeSim(); const m = put(sim, 0); timedOrdinary(m);
    clock += 0.016;
    fireBullet(sim, m.x + 60, heightAt(m.x + 60, m.z) + 3, m.z, 0); // fired well wide of the target
    stepSim(sim, { px: PX, pz: PZ, dt: 0.016, night: 0.5, inVehicle: false });
    expect(charge(sim)).toBe(0);
    expect(sim.nextHitId).toBe(0);
  });
  it("a dead or absent target cannot award charge", () => {
    const sim = makeSim(); const m = put(sim, 0); timedOrdinary(m); m.alive = false;
    shoot(sim, m);
    expect(charge(sim)).toBe(0);
  });
  it("without the perk equipped nothing is tracked", () => {
    const sim = makeSim(null); const m = put(sim, 0); timedOrdinary(m);
    shoot(sim, m);
    expect(charge(sim)).toBe(0);
    expect(sim.nextHitId).toBe(0);
  });
  it("charge is capped by the threshold and the next hit pulses once, then resets", () => {
    const sim = makeSim(); const m = put(sim, 0); timedOrdinary(m);
    for (let i = 0; i < NULL_CHARGE_THRESHOLD; i++) shoot(sim, m);
    expect(charge(sim)).toBe(NULL_CHARGE_THRESHOLD);
    expect(sim.nullPulse).toBeNull();
    shoot(sim, m);
    expect(sim.nullPulse?.id).toBe(1);
    expect(charge(sim)).toBe(0);
  });
  it("one bullet can produce at most one pulse even with many enemies in range", () => {
    const sim = makeSim(); const a = put(sim, 0); for (let i = 1; i < 6; i++) put(sim, i);
    timedOrdinary(a);
    for (let i = 0; i < NULL_CHARGE_THRESHOLD + 1; i++) shoot(sim, a);
    expect(sim.nullPulse?.id).toBe(1);
  });
  it("the pulse stuns every living enemy within the radius for 1.4 s and spares those outside", () => {
    const sim = makeSim(); const a = put(sim, 0); const near = put(sim, 1, { cool: 0.1 });
    const far = put(sim, 2, { x: TX + NULL_PULSE_RADIUS + 6, cool: 0.1 });
    timedOrdinary(a);
    for (let i = 0; i < NULL_CHARGE_THRESHOLD; i++) shoot(sim, a);
    near.cool = 0.1; far.cool = 0.1;
    shoot(sim, a);
    expect(sim.nullPulse).toMatchObject({ id: 1, radius: NULL_PULSE_RADIUS });
    expect(near.cool).toBeGreaterThanOrEqual(NULL_PULSE_STUN_SECONDS - 0.2); // one 16 ms step of cooldown tick may have elapsed
    expect(far.cool).toBeLessThan(NULL_PULSE_STUN_SECONDS - 0.2);
  });
  it("lockout: no charge builds for 8 s after a pulse, then charging resumes", () => {
    const sim = makeSim(); const m = put(sim, 0); timedOrdinary(m);
    for (let i = 0; i < NULL_CHARGE_THRESHOLD + 1; i++) shoot(sim, m);
    expect(sim.nullPulse?.id).toBe(1);
    const t0 = sim.nullPulse!.at;
    for (let i = 0; i < 6; i++) { shoot(sim, m); expect(charge(sim)).toBe(0); expect(clock - t0).toBeLessThan(NULL_COOLDOWN_SECONDS); }
    clock = t0 + NULL_COOLDOWN_SECONDS - 0.05; shoot(sim, m); // still locked out (boundary - epsilon)
    expect(charge(sim)).toBe(0);
    clock = t0 + NULL_COOLDOWN_SECONDS + 0.05; shoot(sim, m);
    expect(charge(sim)).toBe(1);
  });
  it("charge expires after 6 s without a timed hit (and a hit just inside the window keeps it)", () => {
    const sim = makeSim(); const m = put(sim, 0); timedOrdinary(m);
    shoot(sim, m); shoot(sim, m);
    expect(charge(sim)).toBe(2);
    clock += NULL_DECAY_SECONDS - 0.5; shoot(sim, m);
    expect(charge(sim)).toBe(3);
    clock += NULL_DECAY_SECONDS + 0.5; shoot(sim, m); // expired: restarts from zero, this hit is charge 1
    expect(charge(sim)).toBe(1);
  });
  it("DOCUMENTED: a fully charged player who waits > 6 s loses the charge; the hit then just builds charge 1 (no pulse)", () => {
    const sim = makeSim(); const m = put(sim, 0); timedOrdinary(m);
    for (let i = 0; i < NULL_CHARGE_THRESHOLD; i++) shoot(sim, m);
    clock += NULL_DECAY_SECONDS + 1;
    shoot(sim, m);
    expect(sim.nullPulse).toBeNull();
    expect(charge(sim)).toBe(1);
  });
  it("a fully charged hit is NOT lost to the lockout: charge cannot be built during lockout, so full charge never coexists with it", () => {
    const sim = makeSim(); const m = put(sim, 0); timedOrdinary(m);
    for (let i = 0; i < NULL_CHARGE_THRESHOLD + 1; i++) shoot(sim, m);
    for (let i = 0; i < 20; i++) shoot(sim, m);
    expect(charge(sim)).toBe(0);
    expect(sim.nullCharge.cooldownUntil).toBeGreaterThan(clock);
  });
  it("an untimed hit at full charge still releases the pulse (the charge is spent on the next hit, timed or not)", () => {
    const sim = makeSim(); const m = put(sim, 0); timedOrdinary(m);
    for (let i = 0; i < NULL_CHARGE_THRESHOLD; i++) shoot(sim, m);
    m.aim = 0;
    shoot(sim, m);
    expect(sim.nullPulse?.id).toBe(1);
  });
  it("switching away resets charge (Scene's reset) but keeps the lockout, so swapping cannot dodge the cooldown", () => {
    const sim = makeSim(); const m = put(sim, 0); timedOrdinary(m);
    for (let i = 0; i < NULL_CHARGE_THRESHOLD + 1; i++) shoot(sim, m);
    const lock = sim.nullCharge.cooldownUntil;
    // mirrors Scene.tsx: perk change -> charge 0, keep cooldownUntil/lastEventId
    sim.nullCharge = { ...resetNullCharge(), cooldownUntil: lock, lastEventId: sim.nullCharge.lastEventId };
    sim.equippedPerk = undefined; shoot(sim, m); expect(charge(sim)).toBe(0);
    sim.equippedPerk = NULL_PERK; shoot(sim, m);
    expect(charge(sim)).toBe(0); // still locked out
  });
  it("a repeated simulation event does not double count: a stepSim with no new bullet changes nothing", () => {
    const sim = makeSim(); const m = put(sim, 0); timedOrdinary(m);
    shoot(sim, m);
    const ids = sim.nextHitId;
    for (let i = 0; i < 10; i++) { clock += 0.016; stepSim(sim, { px: PX, pz: PZ, dt: 0.016, night: 0.5, inVehicle: false }); }
    expect(sim.nextHitId).toBe(ids);
    expect(charge(sim)).toBe(1);
  });
});

describe("Null Disruption against a boss (real Dark Knight summon)", () => {
  const knight = (sim: WorldSim) => {
    expect(summonScenarioBoss(sim, scenarioById("dark-knight")!, TX, TZ)).toBe(true);
    const m = sim.machines.find((x) => x.alive && x.scenarioId === "dark-knight")!;
    Object.assign(m, { hp: 1e6, maxHp: 1e6, cool: 99, aim: 0 });
    return m;
  };
  it("hits on a boss with no open window are not timed", () => {
    const sim = makeSim(); const m = knight(sim);
    shoot(sim, m);
    expect(charge(sim)).toBe(0);
  });
  it("hits while the boss is staggered are timed and charge", () => {
    const sim = makeSim(); const m = knight(sim);
    m.poiseState = { ...INITIAL_POISE, staggerUntil: clock + 100 };
    shoot(sim, m);
    expect(charge(sim)).toBe(1);
  });
  it("hits while a weak point is open are timed", () => {
    const sim = makeSim(); const m = knight(sim);
    m.poiseState = { ...INITIAL_POISE, weakPointUntil: clock + 100 };
    shoot(sim, m); shoot(sim, m);
    expect(charge(sim)).toBe(2);
  });
  it("the pulse adds boss poise damage (compared against an identical shot without a pulse)", () => {
    const run = (withPulse: boolean) => {
      const sim = makeSim(); const m = knight(sim);
      m.poiseState = { ...INITIAL_POISE, weakPointUntil: clock + 1000 };
      if (withPulse) sim.nullCharge = { ...sim.nullCharge, charge: NULL_CHARGE_THRESHOLD, lastTimedAt: clock };
      const before = m.poiseState.poise;
      shoot(sim, m);
      return { sim, gained: (m.poiseState?.poise ?? 0) - before, m };
    };
    const plain = run(false), pulsed = run(true);
    expect(plain.sim.nullPulse).toBeNull();
    expect(pulsed.sim.nullPulse?.id).toBe(1);
    // poise may saturate into a stagger (poise resets); either way the pulse must have pushed it further than the plain shot
    const staggered = (pulsed.m.poiseState?.staggerUntil ?? 0) > clock;
    expect(staggered || pulsed.gained >= plain.gained + NULL_PULSE_POISE - 1).toBe(true);
  });
});
