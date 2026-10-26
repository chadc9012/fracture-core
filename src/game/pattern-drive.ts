/** Applies enemy-patterns.ts to a real machine: movement, blinks, strikes through hurtPlayer (so dodges, i-frames and armor
 *  count), the punish window through the machine's vulnerability fields, and the wind-up shown as `machine.patternTell`. */
import { newPattern, patternFor, stepPattern, type PatternState } from "./enemy-patterns";
import { hurtPlayer, type Machine, type WorldSim } from "./sim";
import { walkHeight } from "./terrain";

const states = new WeakMap<Machine, PatternState & { lastHp: number }>();
export type DriveInput = { d: number; dx: number; dz: number; dt: number; speed: number; time: number; yaw: number | undefined; playerHp: number };

const eligible = (m: Machine) => !m.boss && !m.summoned && !m.rival && !m.mission && !m.decoy && !m.nemesis;

/** Drives one alert machine for a frame. Returns null when the machine has no pattern (the caller falls back to squad roles). */
export function drivePattern(sim: WorldSim, m: Machine, index: number, inp: DriveInput): { fire: boolean } | null {
  if (!eligible(m)) return null;
  const id = patternFor(m.kind, m.elite, index);
  if (!id) { m.patternTell = undefined; return null; }
  const key = `${id}|${m.profile}`;
  let s = states.get(m);
  if (!s || s.key !== key || m.hp > s.lastHp + 0.01) { s = { ...newPattern(id, key, index * 7 + 3), lastHp: m.hp }; states.set(m, s); }
  s.lastHp = m.hp;

  const ox = m.x, oz = m.z; // where the player is, in the world, is fixed by the offset from here
  const out = stepPattern(s, { d: inp.d, dx: inp.dx, dz: inp.dz, dt: inp.dt, time: inp.time, speed: inp.speed, playerYaw: inp.yaw, playerHp: inp.playerHp });
  if (out.blink) { m.x += out.blink.x; m.z += out.blink.z; m.y = walkHeight(m.x, m.z) + 2.2 * m.scale; m.kx = 0; m.kz = 0; }
  else { m.x += out.vx * inp.dt; m.z += out.vz * inp.dt; }
  m.rot = out.rot;

  const now = performance.now() / 1000;
  if (out.tell) {
    m.patternTell = { kind: out.tell.kind, x: m.x + out.tell.tx, z: m.z + out.tell.tz, radius: out.tell.radius, width: out.tell.width, progress: out.tell.progress };
    m.aim = 0; m.cool = Math.max(m.cool, 0.4); // a committed attack: no rifle shot until it resolves
  } else m.patternTell = undefined;

  if (out.strike) {
    const st = out.strike, cx = m.x + st.x, cz = m.z + st.z;
    if (Math.hypot(ox + inp.dx - cx, oz + inp.dz - cz) <= st.radius) {
      sim.lastHitBy = { profile: m.profile, zone: m.zone, elite: m.elite, boss: m.boss, nemesis: m.nemesis };
      sim.combatHeat += 2;
      hurtPlayer(sim, st.damage / sim.mods.hullDurability, st.label);
    }
  }
  if (out.exposed) { m.vulnUntil = now + out.exposed.seconds; m.vulnMult = out.exposed.mult; }
  else if (out.guard !== undefined && now >= m.vulnUntil - 0.15) { m.vulnUntil = now + 0.25; m.vulnMult = out.guard; }
  return { fire: out.fire };
}
