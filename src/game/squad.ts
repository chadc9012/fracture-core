/** AI squadmates (from the trailer: two troopers running and firing beside the Operator). Pure rules: formation, target
 * choice, fire cadence and hit rolls. sim.ts applies the returned hits through applyMachineDamageMods / defeatMachine;
 * Squad.tsx only draws `mates` and `shots`.
 *
 * Boundaries, so the squad can never farm or replace the player:
 *  - they only shoot while the player is in a fight (combat heat) and only at enemies near the PLAYER;
 *  - their damage is support-sized (SQUAD_DPS per mate) and never touches bosses below BOSS_FLOOR of max hp,
 *    so a boss kill is always the player's;
 *  - they cannot be hurt (no ally damage model exists yet) and never enter vehicles. */

export type Mate = {
  id: number; name: string; x: number; z: number; yaw: number;
  /** ground speed this frame (m/s), drives the run cycle */
  speed: number;
  cool: number; target: number; firing: number;
};
export type SquadShot = { id: number; fromX: number; fromZ: number; toX: number; toZ: number; hit: boolean; at: number };
export type SquadState = { enabled: boolean; mates: Mate[]; shots: SquadShot[]; nextShot: number; clock: number };
export type SquadTarget = { x: number; z: number; alive: boolean; boss: boolean; hp: number; maxHp?: number | undefined; decoy?: boolean | undefined };
export type SquadHit = { index: number; damage: number };

export const SQUAD_NAMES = ["VEX", "HOLT"] as const;
/** formation offsets in the player's frame: [right, back] metres */
export const FORMATION: readonly [number, number][] = [[-3.2, -2.6], [3.4, -3.4]];
export const ENGAGE_RANGE = 34;
export const SQUAD_DPS = 2.2;
export const FIRE_INTERVAL = 0.22;
export const BURST = 5;
export const BURST_REST = 0.9;
export const HIT_CHANCE = 0.6;
/** squad fire never takes a boss below this fraction of its max hp */
export const BOSS_FLOOR = 0.25;
/** combat heat the player must be generating before the squad opens fire */
export const ENGAGE_HEAT = 0.5;
const RUN = 7.5, WALK = 4.2, MAX_SHOTS = 24;

export function createSquad(px: number, pz: number, enabled = true): SquadState {
  return {
    enabled,
    mates: SQUAD_NAMES.map((name, i) => ({ id: i, name, x: px + FORMATION[i]![0], z: pz + FORMATION[i]![1], yaw: 0, speed: 0, cool: i * 0.4, target: -1, firing: 0 })),
    shots: [], nextShot: 1, clock: 0,
  };
}

/** Where mate `i` wants to stand for a player at (px,pz) facing `yaw` (yaw 0 = +z). */
export function formationSlot(i: number, px: number, pz: number, yaw: number): { x: number; z: number } {
  const [r, b] = FORMATION[i % FORMATION.length]!;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;
  return { x: px + rx * r + fx * b, z: pz + rz * r + fz * b };
}

/** Nearest living, non-decoy enemy within ENGAGE_RANGE of the PLAYER, measured from the mate. */
export function pickTarget(targets: readonly SquadTarget[], mx: number, mz: number, px: number, pz: number): number {
  let best = -1, bestD = Infinity;
  targets.forEach((t, i) => {
    if (!t.alive || t.decoy || Math.hypot(t.x - px, t.z - pz) > ENGAGE_RANGE) return;
    const d = Math.hypot(t.x - mx, t.z - mz);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/** Damage a squad round may deal to `t` (bosses are floored so the squad can never land a boss kill). */
export function squadDamage(t: SquadTarget, dmg: number): number {
  if (!t.boss) return dmg;
  const floor = (t.maxHp ?? t.hp) * BOSS_FLOOR;
  return Math.max(0, Math.min(dmg, t.hp - floor));
}

export type SquadInput = { px: number; pz: number; yaw: number; dt: number; heat: number; inVehicle: boolean; rand: () => number };

/** One step. Mutates the squad (positions, shots) and returns the hits for sim.ts to apply. */
export function stepSquad(squad: SquadState, targets: readonly SquadTarget[], input: SquadInput): SquadHit[] {
  const { px, pz, yaw, dt, heat, inVehicle, rand } = input;
  squad.clock += dt;
  const hits: SquadHit[] = [];
  if (!squad.enabled) return hits;
  const engaged = heat >= ENGAGE_HEAT && !inVehicle;
  squad.mates.forEach((m, i) => {
    // movement: keep the formation slot; teleport back if left far behind (fast travel, vehicles)
    const slot = formationSlot(i, px, pz, yaw);
    const dx = slot.x - m.x, dz = slot.z - m.z, d = Math.hypot(dx, dz);
    if (d > 60) { m.x = slot.x; m.z = slot.z; m.speed = 0; }
    else if (d > 0.6) {
      const v = Math.min(d / Math.max(dt, 1e-3), d > 6 ? RUN : WALK);
      m.x += (dx / d) * v * dt; m.z += (dz / d) * v * dt; m.speed = v;
    } else m.speed = 0;
    // targeting + fire
    m.target = engaged ? pickTarget(targets, m.x, m.z, px, pz) : -1;
    const t = m.target >= 0 ? targets[m.target] : undefined;
    const faceYaw = t ? Math.atan2(t.x - m.x, t.z - m.z) : m.speed > 0.3 ? Math.atan2(dx, dz) : yaw;
    m.yaw = turn(m.yaw, faceYaw, dt * 10);
    m.firing = Math.max(0, m.firing - dt);
    m.cool -= dt;
    if (!t || m.cool > 0) return;
    const shotInBurst = Math.floor(squad.clock / FIRE_INTERVAL + i) % (BURST + 1);
    m.cool = shotInBurst === BURST ? BURST_REST : FIRE_INTERVAL;
    if (shotInBurst === BURST) return;
    const hit = rand() < HIT_CHANCE;
    const jitter = hit ? 0 : 1.5 + rand() * 2;
    const ang = rand() * Math.PI * 2;
    squad.shots.push({ id: squad.nextShot++, fromX: m.x, fromZ: m.z, toX: t.x + Math.cos(ang) * jitter, toZ: t.z + Math.sin(ang) * jitter, hit, at: squad.clock });
    if (squad.shots.length > MAX_SHOTS) squad.shots.splice(0, squad.shots.length - MAX_SHOTS);
    m.firing = 0.12;
    if (hit) {
      const dmg = squadDamage(t, (SQUAD_DPS * FIRE_INTERVAL * (BURST + 1)) / BURST);
      if (dmg > 0) hits.push({ index: m.target, damage: dmg });
    }
  });
  return hits;
}

function turn(from: number, to: number, k: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, k);
}
