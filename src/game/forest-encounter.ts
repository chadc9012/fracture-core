import { ENCOUNTER } from "./verdant";
import { troopFor } from "./encounters";
import { walkHeight } from "./terrain";
import type { MaterialId } from "./inventory";
import type { WorldSim } from "./sim";

/** Wakes the Verdant ambush patrol using the existing machine pool and the regional troop catalog.
 * Machines are ordinary (not mission-tagged), so patrol/suspicion/cover run through enemy-perception
 * exactly like any other forest enemy, and drops use the shared encounter catalog. Returns how many spawned. */
export function spawnForestPatrol(sim: WorldSim, count = ENCOUNTER.spawnPoints.length): number {
  let n = 0;
  for (let i = 0; i < Math.min(count, ENCOUNTER.spawnPoints.length); i++) {
    const m = sim.machines.find((e) => !e.alive);
    if (!m) break;
    const at = ENCOUNTER.spawnPoints[i]!;
    const troop = troopFor("veridan", i);
    if (!troop) break;
    const elite = i === 0;
    Object.assign(m, {
      alive: true, x: at.x, z: at.z, y: walkHeight(at.x, at.z) + 1, rot: 0, kx: 0, kz: 0, aim: 0, ai: undefined,
      hp: elite ? 6 : 3, scale: elite ? 1.4 : 0.95, zone: "veridan", cool: 1.8, elite, boss: false, mission: false,
      profile: troop.name, kind: troop.kind, drop: troop.drop as MaterialId, vulnUntil: 0, vulnMult: 1,
    });
    n++;
  }
  return n;
}
