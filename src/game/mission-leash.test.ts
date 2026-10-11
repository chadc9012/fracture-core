// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import { createSim, stepSim, type Machine } from "./sim";

/** Regression (Thalassia live playtest): dying at the Sentry Dock respawned the player ~1 km away; the distance leash silently removed the
 * dock wave, and the mission's "no live mission machines" check then advanced Descent Protocol without a fight. */
let clock = 2000;
let spy: { mockRestore: () => void };
beforeEach(() => { clock = 2000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

it("a scripted mission machine is never leashed away by distance; an ordinary one is", () => {
  const sim = createSim(); for (const m of sim.machines) m.alive = false;
  const mk = (i: number, mission: boolean): Machine => Object.assign(sim.machines[i]!, { alive: true, x: 3000, z: 3000, hp: 3, rot: 0, scale: 1, cool: 0, elite: false, boss: false, profile: "Test Drone", mission });
  const mission = mk(0, true), stray = mk(1, false);
  for (let i = 0; i < 60; i++) { clock += 1; stepSim(sim, { px: 3000 + 1200, pz: 3000, dt: 1, night: 0.5, inVehicle: false }); }
  expect(mission.alive).toBe(true);
  expect(stray.alive).toBe(false);
});
