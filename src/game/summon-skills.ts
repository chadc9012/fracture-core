/** Skills for the troops Astravore calls in (the concept-art roles): a Void Reaver flanks and strikes from behind, a Void Arcanist
 *  drops area orbs that leave a slowing pool, and a Void Sentinel deploys short-lived turrets that suppress the player. They run
 *  from stepEncounters, damage through hurtPlayer (so dodges, i-frames and armor all apply) and keep their state in a WeakMap so
 *  recycled machine slots never inherit it. Presentation reads `skillOf` only. */
import { inCircle } from "./scenario-encounters";
import { walkHeight as walkHeightFor } from "./terrain";
import { hurtPlayer, type Machine, type WorldSim } from "./sim";

export const REAVER = "Void Reaver", ARCANIST = "Void Arcanist", SENTINEL = "Void Sentinel", TURRET = "Void Turret";
export const MAX_TURRETS = 3, TURRET_LIFE = 25;
export const REAVER_STRIKE = { windup: 0.9, radius: 3.2, damage: 9, cooldown: 4.5, minRange: 1, maxRange: 16, behind: 2.2 } as const;
export const ARCANIST_ORB = { windup: 1.3, radius: 6, damage: 11, cooldown: 6, maxRange: 45, poolLife: 4, poolDps: 4, poolSlow: 0.6 } as const;
export const REAVER_SPEED = 9, ARCANIST_SPEED = 4.5, ARCANIST_BAND = [16, 28] as const;
export const SENTINEL_DEPLOY = { windup: 1.0, cooldown: 9, maxRange: 50, distance: 8 } as const;

export type SkillState = { st: "IDLE" | "TELL"; t: number; total: number; cd: number; ax: number; az: number; tx: number; tz: number; radius: number; life: number; /** position at the start of the frame, before the generic AI moved it */ ox: number; oz: number };
const states = new WeakMap<Machine, SkillState>();
const blank = (cd: number): SkillState => ({ st: "IDLE", t: 0, total: 0, cd, ax: 0, az: 0, tx: 0, tz: 0, radius: 0, life: 0, ox: 0, oz: 0 });
/** the live skill state of a machine, or undefined when it has none (presentation only) */
export const skillOf = (m: Machine): SkillState | undefined => (m.alive && m.summoned ? states.get(m) : undefined);
/** a freshly (re)spawned troop starts with no skill state, whatever the slot held before */
export const resetSkill = (m: Machine) => { states.delete(m); };
export const isTurret = (m: Machine) => m.profile === TURRET;
const stateFor = (m: Machine, cd: number) => { let s = states.get(m); if (!s) { s = blank(cd); states.set(m, s); } return s; };

function face(m: Machine, x: number, z: number) { m.rot = Math.atan2(x - m.x, z - m.z); }

/** Place a turret machine in a free slot at (x, z); returns it, or null when no slot is free. */
function deployTurret(sim: WorldSim, from: Machine, x: number, z: number): Machine | null {
  const slot = sim.machines.find((s) => !s.alive);
  if (!slot) return null;
  Object.assign(slot, { alive: true, react: undefined, x, z, y: walkHeightFor(x, z), hp: 2, maxHp: 2, rot: from.rot, scale: 0.5, zone: from.zone, cool: 1.5, elite: false, boss: false, mission: false, profile: TURRET, kind: "RAIDER", drop: "dataShards", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, aim: 0, summoned: true });
  delete slot.encounter; delete slot.decoy; delete slot.living; delete slot.nemesis; delete slot.scenarioId; delete slot.lastPlayerDamage;
  const s = blank(0); s.ax = x; s.az = z; s.life = TURRET_LIFE; states.set(slot, s);
  return slot;
}

export function stepSummonSkills(sim: WorldSim, dt: number, px: number, pz: number) {
  const turrets = sim.machines.filter((m) => m.alive && m.summoned && isTurret(m)).length;
  let deployed = turrets;
  for (const m of sim.machines) {
    if (!m.alive || !m.summoned) { states.delete(m); continue; }
    const d = Math.hypot(px - m.x, pz - m.z);
    if (m.profile === TURRET) {
      const s = stateFor(m, 0);
      m.x = s.ax; m.z = s.az; face(m, px, pz); // a turret never moves
      s.life -= dt;
      if (s.life <= 0) { m.alive = false; delete m.summoned; states.delete(m); deployed--; }
      continue;
    }
    if (m.profile === REAVER) {
      const s = stateFor(m, 2);
      m.cool = Math.max(m.cool, 99); // its attack is the strike below, not a rifle shot
      s.cd -= dt;
      if (s.st === "IDLE") {
        if (s.cd <= 0 && d > REAVER_STRIKE.minRange && d < REAVER_STRIKE.maxRange) {
          // aim at a point just BEHIND the player as seen from the Reaver, so the strike is a flank, not a charge
          const ux = (px - m.x) / (d || 1), uz = (pz - m.z) / (d || 1);
          Object.assign(s, { st: "TELL", t: REAVER_STRIKE.windup, total: REAVER_STRIKE.windup, ax: m.x, az: m.z, tx: px + ux * REAVER_STRIKE.behind, tz: pz + uz * REAVER_STRIKE.behind, radius: REAVER_STRIKE.radius });
        }
      } else {
        m.x = s.ax; m.z = s.az; face(m, s.tx, s.tz); // crouches in place while the strike is read
        s.t -= dt;
        if (s.t <= 0) {
          m.x = s.tx; m.z = s.tz; m.y = walkHeightFor(m.x, m.z);
          if (inCircle(px, pz, s.tx, s.tz, s.radius)) hurtPlayer(sim, REAVER_STRIKE.damage, REAVER);
          s.st = "IDLE"; s.cd = REAVER_STRIKE.cooldown;
        }
      }
    } else if (m.profile === ARCANIST) {
      const s = stateFor(m, 3);
      m.cool = Math.max(m.cool, 99);
      s.cd -= dt;
      if (s.st === "IDLE") {
        if (s.cd <= 0 && d < ARCANIST_ORB.maxRange) Object.assign(s, { st: "TELL", t: ARCANIST_ORB.windup, total: ARCANIST_ORB.windup, ax: m.x, az: m.z, tx: px, tz: pz, radius: ARCANIST_ORB.radius });
      } else {
        m.x = s.ax; m.z = s.az; face(m, s.tx, s.tz);
        s.t -= dt;
        if (s.t <= 0) {
          if (inCircle(px, pz, s.tx, s.tz, s.radius)) hurtPlayer(sim, ARCANIST_ORB.damage, ARCANIST);
          const now = performance.now() / 1000;
          sim.encounterZones.push({ id: sim.nextEncounterZoneId++, scenarioId: "astravore", name: "Void Orb pool", kind: "SLOW", x: s.tx, z: s.tz, radius: s.radius * 0.8, dps: ARCANIST_ORB.poolDps, slow: ARCANIST_ORB.poolSlow, armAt: now, until: now + ARCANIST_ORB.poolLife, scope: "attack" });
          s.st = "IDLE"; s.cd = ARCANIST_ORB.cooldown;
        }
      }
    } else if (m.profile === SENTINEL) {
      const s = stateFor(m, 4); // keeps its own suppressing fire; the turrets are extra
      s.cd -= dt;
      if (s.st === "IDLE") {
        if (s.cd <= 0 && d < SENTINEL_DEPLOY.maxRange && deployed < MAX_TURRETS) {
          const ux = (px - m.x) / (d || 1), uz = (pz - m.z) / (d || 1);
          Object.assign(s, { st: "TELL", t: SENTINEL_DEPLOY.windup, total: SENTINEL_DEPLOY.windup, ax: m.x, az: m.z, tx: m.x + ux * SENTINEL_DEPLOY.distance, tz: m.z + uz * SENTINEL_DEPLOY.distance, radius: 1.8 });
        }
      } else {
        s.t -= dt;
        if (s.t <= 0) {
          if (deployed < MAX_TURRETS && deployTurret(sim, m, s.tx, s.tz)) deployed++;
          s.st = "IDLE"; s.cd = SENTINEL_DEPLOY.cooldown;
        }
      }
    }
  }
  recordOrigins(sim);
}

/** (end of stepSummonSkills) remember where each troop stands before the generic AI moves it */
function recordOrigins(sim: WorldSim) { for (const m of sim.machines) { const s = m.alive && m.summoned ? states.get(m) : undefined; if (s) { s.ox = m.x; s.oz = m.z; } } }

/** Called at the end of stepSim, after the generic AI has moved every machine: these troops are positioned by their own skills,
 *  so whatever the squad AI did this frame is replaced. Turrets and a troop winding up hold still; a Reaver rushes the player
 *  (it flanks by striking from behind); an Arcanist holds a casting distance. */
export function stepSummonPins(sim: WorldSim, dt: number, px: number, pz: number) {
  for (const m of sim.machines) {
    if (!m.alive || !m.summoned) continue;
    const s = states.get(m);
    if (!s) continue;
    if (m.profile === TURRET || ((m.profile === REAVER || m.profile === ARCANIST) && s.st === "TELL")) { m.x = s.ax; m.z = s.az; continue; }
    const dx = px - s.ox, dz = pz - s.oz, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    if (m.profile === REAVER) {
      const v = d > 2.5 ? REAVER_SPEED : 0;
      m.x = s.ox + ux * v * dt; m.z = s.oz + uz * v * dt; face(m, px, pz);
    } else if (m.profile === ARCANIST) {
      const v = d > ARCANIST_BAND[1] ? ARCANIST_SPEED : d < ARCANIST_BAND[0] ? -ARCANIST_SPEED : 0;
      m.x = s.ox + ux * v * dt; m.z = s.oz + uz * v * dt; face(m, px, pz);
    }
    m.y = walkHeightFor(m.x, m.z);
  }
}
