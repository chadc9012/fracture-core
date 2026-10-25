/**
 * Vehicle gadgets (pure). The non-gun hardpoints the fleet builds list in the garage (fleet.ts), which until now did
 * nothing: mine and EMP-mine droppers, a caltrop launcher, flame jets, flare pods, the Remora drone dock, a ramming grill
 * and the boundary-breach thruster. They fire on the secondary trigger (the build's second hardpoint), except the grill,
 * which is always on. Rules, numbers and geometry live here; sim.ts owns the live objects and applies damage through its
 * shared damage path (applyMachineDamageMods / defeatMachine / gore), Scene.tsx deploys them and presentation draws them.
 */

export type GadgetKind = "MINE" | "EMP_MINE" | "CALTROPS" | "FLAME" | "FLARES" | "DRONE" | "RAM" | "BREACH";
export type VehicleGadget = {
  kind: GadgetKind;
  name: string;
  /** seconds between uses (0 = held / always on) */
  cooldown: number;
  /** HELD: works while the trigger is held (flame); PRESS: one use per pull; PASSIVE: always on (grill) */
  use: "HELD" | "PRESS" | "PASSIVE";
};

const g = (kind: GadgetKind, name: string, cooldown: number, use: VehicleGadget["use"] = "PRESS"): VehicleGadget => ({ kind, name, cooldown, use });

/** fleet build id → its gadget hardpoint */
export const GADGET_BY_BUILD: Record<string, VehicleGadget> = {
  "goliath-4x4": g("RAM", "Bumper: kinetic ramming grill", 0, "PASSIVE"),
  "behemoth-v16": g("FLAME", "Under-chassis flame jets", 0, "HELD"),
  "dune-stalker": g("MINE", "Rear mine dropper", 1.6),
  "f39-jupiter": g("DRONE", "RQ-44 Remora drone dock", 28),
  "rift-runner": g("CALTROPS", "Rear: caltrop launcher", 9),
  "void-chaser": g("EMP_MINE", "EMP mine dispenser", 2.4),
  skyhawk: g("FLARES", "Pylons: flare pods", 11),
  "void-skimmer-prototype": g("BREACH", "Hull: boundary-breach thruster", 8),
};
export const gadgetFor = (buildId: string | null | undefined): VehicleGadget | null => (buildId ? GADGET_BY_BUILD[buildId] ?? null : null);

/* ---------------- tuning ---------------- */

export const GADGET = {
  MINE: { arm: 0.9, trigger: 3.4, radius: 7, damage: 16, knock: 2.4, life: 90, max: 6 },
  EMP_MINE: { arm: 0.9, trigger: 4, radius: 10, damage: 3, stun: 3, slow: 0.25, slowFor: 3, life: 90, max: 4 },
  CALTROPS: { radius: 5.5, life: 14, dps: 2, slow: 0.4, back: 7 },
  /** flames reach this far around the hull, a little further ahead; damage per second, heat per second (net of the gun's
   *  34/s venting it overheats in about five seconds of burning) */
  FLAME: { reach: 5.5, ahead: 3, dps: 9, heat: 55 },
  /** flares: incoming enemy fire is spoofed this long; the burning flares drawn fall for `fall` seconds */
  FLARES: { spoof: 3.5, count: 8, fall: 3 },
  DRONE: { life: 24, orbit: 7, height: 9, range: 70, rate: 0.45, damage: 1.3, speed: 28 },
  RAM: { damageMult: 2.4, selfMult: 0.35 },
  BREACH: { impulse: 1.8, window: 1.2, ramMult: 3, selfMult: 0.5 },
} as const;

/* ---------------- live objects ---------------- */

export type Mine = { kind: "MINE" | "EMP_MINE"; x: number; y: number; z: number; armAt: number; until: number; id: number };
export type CaltropField = { x: number; z: number; r: number; until: number; id: number };
export type Drone = { x: number; y: number; z: number; until: number; cool: number; angle: number; id: number };
export type Flare = { x: number; y: number; z: number; vx: number; vy: number; vz: number; until: number };
export type GadgetState = {
  mines: Mine[];
  caltrops: CaltropField[];
  drones: Drone[];
  flares: Flare[];
  /** enemy fire is spoofed until then (flares) */
  spoofUntil: number;
  /** flame jets burning this step (Scene sets, sim reads and clears) */
  flame: { x: number; z: number; yaw: number } | null;
  /** the last flame step the sim burned (presentation draws the jets from it) */
  flameLit: { x: number; z: number; yaw: number; t: number } | null;
  /** ram multipliers this step (grill, breach) */
  ram: { damageMult: number; selfMult: number };
  breachUntil: number;
  /** drone shots this step, for tracers: from → to */
  droneShots: { x: number; y: number; z: number; tx: number; ty: number; tz: number; id: number }[];
  nextId: number;
};
export const freshGadgets = (): GadgetState => ({ mines: [], caltrops: [], drones: [], flares: [], spoofUntil: 0, flame: null, flameLit: null, ram: { damageMult: 1, selfMult: 1 }, breachUntil: 0, droneShots: [], nextId: 1 });

type P = { x: number; z: number };

/** drop a mine at a point behind the vehicle; the oldest goes when the cap is reached */
export function dropMine(st: GadgetState, kind: "MINE" | "EMP_MINE", x: number, y: number, z: number, now: number) {
  const t = GADGET[kind];
  st.mines.push({ kind, x, y, z, armAt: now + t.arm, until: now + t.life, id: st.nextId++ });
  const mine = st.mines.filter((m) => m.kind === kind);
  if (mine.length > t.max) st.mines.splice(st.mines.indexOf(mine[0]!), 1);
}
/** armed and something walked onto it */
export const mineTriggered = (m: Mine, now: number, targets: readonly P[]) => now >= m.armAt && targets.some((t) => Math.hypot(t.x - m.x, t.z - m.z) <= GADGET[m.kind].trigger);

export function launchCaltrops(st: GadgetState, x: number, z: number, now: number) {
  st.caltrops.push({ x, z, r: GADGET.CALTROPS.radius, until: now + GADGET.CALTROPS.life, id: st.nextId++ });
  if (st.caltrops.length > 3) st.caltrops.shift();
}
export const inCaltrops = (st: GadgetState, x: number, z: number, now: number) => st.caltrops.some((c) => c.until > now && Math.hypot(x - c.x, z - c.z) <= c.r);

/** under-chassis flames: everything within `reach` of the hull, stretched `ahead` metres forward */
export function inFlames(src: { x: number; z: number; yaw: number }, t: P, bodyR = 0): boolean {
  const fx = Math.sin(src.yaw), fz = Math.cos(src.yaw);
  const dx = t.x - src.x, dz = t.z - src.z;
  const along = dx * fx + dz * fz;
  // a capsule along the hull's long axis: from 2 m behind to `ahead` m in front
  const c = Math.max(-2, Math.min(GADGET.FLAME.ahead, along));
  return Math.hypot(dx - fx * c, dz - fz * c) <= GADGET.FLAME.reach + bodyR;
}

/** pop flares: a fan of burning decoys thrown out and down from the airframe, and enemy fire spoofed for a moment */
export function popFlares(st: GadgetState, x: number, y: number, z: number, yaw: number, now: number) {
  const n = GADGET.FLARES.count;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2) / (n / 2);
    const a = yaw + Math.PI + side * (0.6 + k * 0.9);
    st.flares.push({ x, y, z, vx: Math.sin(a) * (10 + k * 6), vy: 4 - k * 3, vz: Math.cos(a) * (10 + k * 6), until: now + GADGET.FLARES.fall });
  }
  if (st.flares.length > 32) st.flares.splice(0, st.flares.length - 32);
  st.spoofUntil = now + GADGET.FLARES.spoof;
}
export function stepFlares(st: GadgetState, now: number, dt: number) {
  st.flares = st.flares.filter((f) => f.until > now);
  for (const f of st.flares) { f.vy -= 9.8 * 0.35 * dt; f.vx *= 1 - dt * 0.6; f.vz *= 1 - dt * 0.6; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; }
}
export const spoofed = (st: GadgetState, now: number) => st.spoofUntil > now;

export function launchDrone(st: GadgetState, x: number, y: number, z: number, now: number) {
  st.drones = st.drones.filter((d) => d.until > now);
  if (st.drones.length >= 1) st.drones.shift(); // one Remora per dock
  st.drones.push({ x, y, z, until: now + GADGET.DRONE.life, cool: 0.6, angle: 0, id: st.nextId++ });
}
/** the drone flies to its orbit slot over the player (returns where it is now) */
export function stepDrone(d: Drone, player: { x: number; y: number; z: number }, dt: number) {
  d.angle += dt * 0.7;
  const tx = player.x + Math.sin(d.angle) * GADGET.DRONE.orbit, tz = player.z + Math.cos(d.angle) * GADGET.DRONE.orbit, ty = player.y + GADGET.DRONE.height;
  const dx = tx - d.x, dy = ty - d.y, dz = tz - d.z, dist = Math.hypot(dx, dy, dz);
  const step = Math.min(dist, GADGET.DRONE.speed * dt);
  if (dist > 1e-6) { d.x += (dx / dist) * step; d.y += (dy / dist) * step; d.z += (dz / dist) * step; }
  d.cool -= dt;
}
/** nearest live target within range (index), or -1 */
export function droneTarget(d: Drone, targets: readonly (P & { alive: boolean })[], visible: (i: number) => boolean = () => true): number {
  let best = -1, bd: number = GADGET.DRONE.range;
  targets.forEach((t, i) => {
    if (!t.alive) return;
    const dist = Math.hypot(t.x - d.x, t.z - d.z);
    if (dist < bd && visible(i)) { bd = dist; best = i; }
  });
  return best;
}

/** what a ram does this step: the grill always, the breach thruster for its window */
export function ramFor(gadget: VehicleGadget | null, breachUntil: number, now: number): { damageMult: number; selfMult: number } {
  if (gadget?.kind === "RAM") return { damageMult: GADGET.RAM.damageMult, selfMult: GADGET.RAM.selfMult };
  if (gadget?.kind === "BREACH" && breachUntil > now) return { damageMult: GADGET.BREACH.ramMult, selfMult: GADGET.BREACH.selfMult };
  return { damageMult: 1, selfMult: 1 };
}

/** a slow on a machine, bosses shrug most of it off */
export const slowFor = (base: number, boss: boolean) => (boss ? Math.max(base, 0.8) : base);
