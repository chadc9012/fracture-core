import { describe, expect, test } from "bun:test";
import { createSim, type Machine, type WorldSim } from "./sim";
import { DEFAULT_PROGRESSION } from "./progression";
import { claimCovenant } from "./dragon-covenant";
import { createDragoniteRuntime, castDragonite, stepDragonite, type DragoniteCtx } from "./dragonite-cast";

const world = () => { const sim = createSim(); for (const m of sim.machines) m.alive = false; return sim; };
let slot = 0;
function put(sim: WorldSim, dx: number, dz: number, hp = 50): Machine {
  const m = sim.machines[slot++ % sim.machines.length]!;
  Object.assign(m, { alive: true, x: 3000 + dx, z: 3000 + dz, hp, boss: false, aim: 0, stunUntil: 0 });
  return m;
}
const bondedCtx = (cls: "HUNTER" | "TITAN" = "HUNTER"): DragoniteCtx => {
  const p = claimCovenant({ ...DEFAULT_PROGRESSION, earnedRewards: [], inventory: [] } as never, "HUNTER").progression;
  return { earnedRewards: p.earnedRewards, inventory: [], equippedGear: {}, cls };
};
const pose = { x: 3000, z: 3000, yaw: 0 };

describe("Dragonite casting", () => {
  test("refused without the bond on this Operator", () => {
    const rt = createDragoniteRuntime(), e = { value: 100 };
    expect(castDragonite(rt, world(), e, "dragonfire", pose, true, bondedCtx("TITAN")).ok).toBe(false);
    expect(e.value).toBe(100);
  });
  test("Dragonfire spends energy, starts the cooldown, and hits only enemies inside the cone", () => {
    slot = 0; const sim = world(), rt = createDragoniteRuntime(), e = { value: 100 };
    const front = put(sim, 0, 6), behind = put(sim, 0, -6), far = put(sim, 0, 30);
    const r = castDragonite(rt, sim, e, "dragonfire", pose, true, bondedCtx());
    expect(r.ok).toBe(true);
    expect(e.value).toBeLessThan(100);
    expect(front.hp).toBeLessThan(50); expect(behind.hp).toBe(50); expect(far.hp).toBe(50);
    expect(castDragonite(rt, sim, e, "dragonfire", pose, true, bondedCtx()).ok).toBe(false);
  });
  test("not enough energy refuses and spends nothing", () => {
    const rt = createDragoniteRuntime(), e = { value: 1 };
    expect(castDragonite(rt, world(), e, "dragonhide", pose, true, bondedCtx()).ok).toBe(false);
    expect(e.value).toBe(1); expect(rt.cd.dragonhide).toBe(0);
  });
  test("Dragonhide gives capped resistance that expires", () => {
    const rt = createDragoniteRuntime(), sim = world(), e = { value: 100 };
    castDragonite(rt, sim, e, "dragonhide", pose, true, bondedCtx());
    const on = stepDragonite(rt, sim, 0.1, pose, bondedCtx());
    expect(on.resist).toBeGreaterThan(0); expect(on.resist).toBeLessThanOrEqual(0.5);
    expect(stepDragonite(rt, sim, 20, pose, bondedCtx()).resist).toBe(0);
  });
  test("Wyrmwing returns a launch and a glide window", () => {
    const rt = createDragoniteRuntime(), e = { value: 100 };
    const r = castDragonite(rt, world(), e, "wyrmwing", pose, true, bondedCtx());
    expect(r.launchVy).toBeGreaterThan(0); expect(r.glideSeconds).toBeGreaterThan(0);
  });
  test("Wyrmcall strafes a nearby enemy, then withdraws and recovers", () => {
    slot = 0; const sim = world(), rt = createDragoniteRuntime(), e = { value: 100 }, ctx = bondedCtx();
    const target = put(sim, 0, 12, 500);
    expect(castDragonite(rt, sim, e, "wyrmcall", pose, true, ctx).ok).toBe(true);
    expect(castDragonite(rt, sim, e, "wyrmcall", pose, true, ctx).ok).toBe(false);
    for (let i = 0; i < 40 * 60; i++) { target.hp = Math.max(target.hp, 1); stepDragonite(rt, sim, 1 / 60, pose, ctx); }
    expect(rt.wyrm.state).toBe("RECOVERY");
  });
});
