/**
 * Operator grenades (pure; owner ask Nov 10: "different kinds of grenades that are unique to the three operators"). Every
 * Operator carries three grenades of its own and equips one; the choice is stored in the existing `abilityBranches` map under
 * `grenade:<CLASS>` (as dash perks are), so saves and the cloud merge need no new field.
 *   GOLIATH (TITAN)   Breacher Frag (a heavy blast that throws bodies back) · Thermite (a burning pool) · Concussion (a wide stun)
 *   NYX (HUNTER)      Shroud (a smoke cloud: nobody sees in or out) · Tripmine (sticks where it lands, waits) · Tracer (marks for +damage)
 *   CIPHER (WARLOCK)  Singularity (pulls everything in, then bursts) · Arc Chain (stuns and jumps between targets) · Rift Well (heals you)
 * This file holds the numbers, the throw and the runtime state of each grenade; player-grenades.ts applies them to the sim.
 */
import type { ClassId } from "./loadout";

export type GrenadeId = "breacher" | "thermite" | "concussion" | "shroud" | "tripmine" | "tracer" | "singularity" | "arc-chain" | "rift-well";
/** what it does when it goes off */
export type GrenadeEffect =
  | "BLAST"      // damage in a radius, optional knockback / stun
  | "BURN"       // a small blast, then a pool that burns what stands in it
  | "SMOKE"      // a cloud: enemies inside can't see, you inside can't be seen
  | "MINE"       // sticks where it lands, arms, then blasts when an enemy comes close
  | "MARK"       // a small blast that leaves everything it caught taking extra damage
  | "PULL"       // drags everything in toward the centre, then bursts
  | "CHAIN"      // stuns and arcs on to the nearest enemies
  | "HEAL";      // a well that heals you while you stand in it and slows enemies in it

export type GrenadeDef = {
  id: GrenadeId; classId: ClassId; operator: "GOLIATH" | "NYX" | "CIPHER"; name: string; blurb: string; effect: GrenadeEffect;
  /** the colour of its light and its ring on the ground */
  color: string;
  /** charges carried, and seconds to bring one back */
  charges: number; cooldown: number;
  /** seconds from the throw to going off (a mine arms on landing instead); sticky grenades stop where they first land */
  fuse: number; sticky: boolean;
  /** blast radius and damage at the centre (falls to half at the edge) */
  radius: number; damage: number;
  knockback: number; stun: number;
  /** zones (burn, smoke, heal, pull) last this long; `tick` is damage (burn) or healing (heal) per second */
  duration: number; tick: number;
  /** MARK: extra damage taken by what it caught, for `duration` seconds; HEAL: enemies in the well are slowed by this much */
  amount: number;
  /** CHAIN: arcs to this many more enemies within `reach` metres; MINE: triggers when an enemy comes within `reach` */
  jumps: number; reach: number;
};

const Z = { knockback: 0, stun: 0, duration: 0, tick: 0, amount: 0, jumps: 0, reach: 0, sticky: false } as const;

export const GRENADES: Readonly<Record<GrenadeId, GrenadeDef>> = {
  // GOLIATH · heavy and kinetic
  breacher: { ...Z, id: "breacher", classId: "TITAN", operator: "GOLIATH", name: "Breacher Frag", effect: "BLAST", color: "#ffb02e",
    blurb: "A heavy frag that hits hard and throws everything nearby back off its feet.", charges: 2, cooldown: 14, fuse: 1.6, radius: 6, damage: 6, knockback: 4 },
  thermite: { ...Z, id: "thermite", classId: "TITAN", operator: "GOLIATH", name: "Thermite", effect: "BURN", color: "#ff5a1a",
    blurb: "Bursts into a pool of burning thermite. Anything standing in it burns.", charges: 2, cooldown: 16, fuse: 1.2, radius: 3, damage: 2, duration: 6, tick: 1.4, reach: 4.5 },
  concussion: { ...Z, id: "concussion", classId: "TITAN", operator: "GOLIATH", name: "Concussion", effect: "BLAST", color: "#f4e7c0",
    blurb: "A wide shockwave: light damage, but everything caught is stunned and shoved away.", charges: 2, cooldown: 15, fuse: 1.3, radius: 7.5, damage: 2, knockback: 6, stun: 2.5 },
  // NYX · stealth and traps
  shroud: { ...Z, id: "shroud", classId: "HUNTER", operator: "NYX", name: "Shroud", effect: "SMOKE", color: "#8a7aa8",
    blurb: "A thick smoke cloud. Enemies inside can't see; while you're inside, nobody can see you.", charges: 2, cooldown: 18, fuse: 1, radius: 6.5, damage: 0, duration: 9 },
  tripmine: { ...Z, id: "tripmine", classId: "HUNTER", operator: "NYX", name: "Tripmine", effect: "MINE", color: "#ff3a5a",
    blurb: "Sticks where it lands and arms. The first enemy to come close sets it off. Up to two at a time.", charges: 2, cooldown: 14, fuse: 1, sticky: true, radius: 4.5, damage: 7, duration: 25, reach: 3 },
  tracer: { ...Z, id: "tracer", classId: "HUNTER", operator: "NYX", name: "Tracer", effect: "MARK", color: "#38e8ff",
    blurb: "A light burst that marks everything it catches: marked enemies take a third more damage for six seconds.", charges: 2, cooldown: 12, fuse: 1.1, radius: 5.5, damage: 1.5, duration: 6, amount: 0.33 },
  // CIPHER · rift tech
  singularity: { ...Z, id: "singularity", classId: "WARLOCK", operator: "CIPHER", name: "Singularity", effect: "PULL", color: "#b04aff",
    blurb: "Opens a tiny rift that drags enemies into a knot, then collapses on them.", charges: 1, cooldown: 18, fuse: 1.2, radius: 4, damage: 5, duration: 1.6, reach: 8 },
  "arc-chain": { ...Z, id: "arc-chain", classId: "WARLOCK", operator: "CIPHER", name: "Arc Chain", effect: "CHAIN", color: "#7ff4ff",
    blurb: "An electric burst that stuns what it hits and arcs on to the three nearest enemies.", charges: 2, cooldown: 14, fuse: 1.2, radius: 5, damage: 2.5, stun: 1.5, jumps: 3, reach: 9 },
  "rift-well": { ...Z, id: "rift-well", classId: "WARLOCK", operator: "CIPHER", name: "Rift Well", effect: "HEAL", color: "#4affa0",
    blurb: "Leaves a well of rift light: you heal while you stand in it, and enemies in it are slowed.", charges: 1, cooldown: 22, fuse: 0.9, radius: 4.5, damage: 0, duration: 8, tick: 9, amount: 0.5 },
};

/** each Operator's three grenades, in the order they are shown */
export const OPERATOR_GRENADES: Readonly<Record<ClassId, readonly [GrenadeId, GrenadeId, GrenadeId]>> = {
  TITAN: ["breacher", "thermite", "concussion"],
  HUNTER: ["shroud", "tripmine", "tracer"],
  WARLOCK: ["singularity", "arc-chain", "rift-well"],
};

const key = (c: ClassId) => `grenade:${c}`;
/** the grenade this Operator has equipped (the first of its three until one is picked) */
export function equippedGrenade(branches: Readonly<Record<string, string>>, classId: ClassId): GrenadeDef {
  const id = branches[key(classId)] as GrenadeId | undefined;
  return id && GRENADES[id]?.classId === classId ? GRENADES[id] : GRENADES[OPERATOR_GRENADES[classId][0]];
}
/** equip one of the Operator's own grenades (anything else is refused) */
export function equipGrenade<T extends { abilityBranches: Record<string, string> }>(p: T, classId: ClassId, id: GrenadeId): T | { error: string } {
  if (GRENADES[id]?.classId !== classId) return { error: "That grenade belongs to another Operator" };
  return { ...p, abilityBranches: { ...p.abilityBranches, [key(classId)]: id } };
}
/** the next of the Operator's grenades after `id` (the in-match cycle key) */
export function nextGrenade(classId: ClassId, id: GrenadeId): GrenadeId {
  const list = OPERATOR_GRENADES[classId], i = list.indexOf(id);
  return list[(i + 1) % list.length]!;
}

/* ---------------- runtime ---------------- */

/** a grenade in flight, rolling, armed on the ground, or a zone it left behind */
export type LiveGrenade = {
  id: number; kind: GrenadeId;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  /** seconds to going off (mines: to arming) */
  fuse: number;
  /** on the ground and still */
  rest: boolean;
  /** mines: armed and waiting; zones: gone off and burning / smoking / healing / pulling */
  armed: boolean; zone: boolean;
  /** seconds the mine or zone has left */
  life: number;
};
/** the player's grenade pouch: charges of the equipped kind and the recharge clock */
export type GrenadePouch = { kind: GrenadeId; charges: number; recharge: number };

export const newPouch = (kind: GrenadeId): GrenadePouch => ({ kind, charges: GRENADES[kind].charges, recharge: 0 });
/** switching grenades (between fights or with the cycle key) keeps the pouch's fill as a fraction */
export function switchPouch(p: GrenadePouch, kind: GrenadeId): GrenadePouch {
  if (p.kind === kind) return p;
  const was = GRENADES[p.kind], now = GRENADES[kind];
  return { kind, charges: Math.min(now.charges, Math.floor((p.charges / was.charges) * now.charges + 1e-6)), recharge: 0 };
}
export function stepPouch(p: GrenadePouch, dt: number) {
  const g = GRENADES[p.kind];
  if (p.charges >= g.charges) { p.recharge = 0; return; }
  p.recharge += dt;
  if (p.recharge >= g.cooldown) { p.charges++; p.recharge = 0; }
}

export const THROW = { speed: 19, lift: 4.5, gravity: 22, bounce: 0.35, friction: 0.55, maxLive: 6 } as const;

/** throw the equipped grenade from the hand along the aim (yaw, pitch); false when the pouch is empty */
export function throwGrenade(p: GrenadePouch, live: LiveGrenade[], nextId: number, from: { x: number; y: number; z: number }, yaw: number, pitch: number): LiveGrenade | null {
  if (p.charges <= 0) return null;
  const g = GRENADES[p.kind];
  // tripmines: at most two set at a time, the oldest goes when a third is thrown
  if (g.effect === "MINE") { const mines = live.filter((q) => q.kind === p.kind); if (mines.length >= 2) live.splice(live.indexOf(mines[0]!), 1); }
  if (live.length >= THROW.maxLive) live.shift();
  p.charges--;
  const c = Math.cos(pitch);
  const gr: LiveGrenade = { id: nextId, kind: p.kind, x: from.x, y: from.y, z: from.z, vx: Math.sin(yaw) * c * THROW.speed, vy: Math.sin(pitch) * THROW.speed + THROW.lift, vz: Math.cos(yaw) * c * THROW.speed, fuse: g.fuse, rest: false, armed: false, zone: false, life: g.duration };
  live.push(gr);
  return gr;
}

/** fly / bounce / roll one step over the ground; sticky grenades stop dead on their first touch */
export function stepFlight(gr: LiveGrenade, dt: number, ground: (x: number, z: number) => number) {
  if (gr.rest || gr.zone || gr.armed) return;
  gr.vy -= THROW.gravity * dt;
  gr.x += gr.vx * dt; gr.y += gr.vy * dt; gr.z += gr.vz * dt;
  const floor = ground(gr.x, gr.z) + 0.12;
  if (gr.y <= floor) {
    gr.y = floor;
    if (GRENADES[gr.kind].sticky) { gr.vx = gr.vy = gr.vz = 0; gr.rest = true; return; }
    gr.vy = Math.abs(gr.vy) * THROW.bounce; gr.vx *= THROW.friction; gr.vz *= THROW.friction;
    if (Math.abs(gr.vy) < 1 && Math.hypot(gr.vx, gr.vz) < 0.6) { gr.vx = gr.vy = gr.vz = 0; gr.rest = true; }
  }
}

/** blast damage at a distance: full at the centre, half at the edge, none beyond */
export const blastDamage = (g: GrenadeDef, dist: number) => (dist >= g.radius ? 0 : g.damage * (1 - 0.5 * (dist / g.radius)));

/** the zone radius of a gone-off grenade (burn pools and pulls use `reach` when it is set, the rest their radius) */
export const zoneRadius = (g: GrenadeDef) => (g.effect === "BURN" || g.effect === "PULL" ? g.reach : g.radius);

/** Shroud: how well enemies see the player — 0.15 while the player stands in smoke; and whether a point is inside smoke */
export function inSmoke(live: readonly LiveGrenade[], x: number, z: number): boolean {
  return live.some((g) => g.zone && GRENADES[g.kind].effect === "SMOKE" && Math.hypot(g.x - x, g.z - z) < GRENADES[g.kind].radius);
}
export const SMOKE_SIGHT = 0.15;
