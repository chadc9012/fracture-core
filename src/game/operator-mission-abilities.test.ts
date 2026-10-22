// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { createSim, type WorldSim } from "./sim";
import { castAbility } from "./ability-effects";
import { classBuild, createLiveBuild, operatorAbilityStats } from "./live-build";
import { heightAt } from "./terrain";
import type { ClassId } from "./loadout";

let spy: { mockRestore: () => void };
beforeEach(() => { spy = spyOn(performance, "now").mockImplementation(() => 2_000_000); });
afterEach(() => spy.mockRestore());
const TX = 3000, TZ = 3000;
function missionSim(): WorldSim {
  const sim = createSim();
  for (const m of sim.machines) m.alive = false;
  Object.assign(sim.machines[0]!, { alive: true, x: TX + 3, z: TZ, y: heightAt(TX, TZ), hp: 1000, mission: true, boss: false, elite: false });
  return sim;
}
const EXPECTED: Record<ClassId, [string, number, number][]> = {
  TITAN: [["siege-mode", 25, 25], ["kinetic-slam", 18, 20], ["bastion-shield", 24, 40]],
  HUNTER: [["phase-veil", 18, 15], ["rift-dash", 10, 12], ["shadow-strike", 22, 35]],
  WARLOCK: [["recon-swarm", 18, 18], ["disruption-pulse", 16.2, 24], ["rift-turret", 27, 45]],
};

describe("Operator abilities cast in missions with their listed cooldown and energy", () => {
  for (const cls of ["TITAN", "HUNTER", "WARLOCK"] as const) {
    it(`${cls}: card numbers match what each cast spends`, () => {
      const stats = operatorAbilityStats(cls);
      expect(stats.map((s) => [s.id, s.cooldown, s.energy])).toEqual(EXPECTED[cls]);
      for (const s of stats) {
        const sim = missionSim(), live = createLiveBuild(classBuild(cls));
        const r = castAbility(sim, live, s.slot, { x: TX, z: TZ, yaw: 0 }, { environment: "war", inVehicle: false });
        expect(r.ok).toBe(true);
        expect(live.energy).toBeCloseTo(100 - s.energy, 5);
        expect(live.runtime[s.slot].cooldown).toBeCloseTo(s.cooldown, 5);
        const again = castAbility(sim, live, s.slot, { x: TX, z: TZ, yaw: 0 }, { environment: "war", inVehicle: false });
        expect(again.ok).toBe(false);
        expect(again.reason).toBe("COOLDOWN");
      }
    });
  }
  it("refuses a cast without enough energy and spends nothing", () => {
    const sim = missionSim(), live = createLiveBuild(classBuild("WARLOCK"));
    live.energy = 44;
    const r = castAbility(sim, live, "ULTIMATE", { x: TX, z: TZ, yaw: 0 }, { environment: "war", inVehicle: false });
    expect(r.reason).toBe("ENERGY");
    expect(live.energy).toBe(44);
    expect(live.runtime.ULTIMATE.cooldown).toBe(0);
  });
});
