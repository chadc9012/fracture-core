/**
 * Gore (presentation only). Combat never reads anything here: sim.ts logs what was hit and how hard into the
 * sim.gore ring (logGore), and GoreFx.tsx turns those events into blood, decals, gibs and corpses.
 *
 * What bleeds what (owner, Oct 24 2026):
 *  - humans (Raiders, Vanguard, Overclocked operatives, rival operators): red blood
 *  - machines (drones, turrets, mechs, sentinels, constructs): sparks, black oil and pale-blue coolant vapour
 *  - aliens / aberrations: green (mutated flesh) or blue (silicon / crystal / abyssal)
 *  - wildlife: green (mammals) or blue (birds, fish, reptiles)
 *
 * Levels (Settings > Gameplay > Gore): OFF (bodies still fall, no fluids or dismemberment), REDUCED (light spray and
 * small, short-lived decals, no dismemberment), FULL (heavy spray, pooling decals, severed limbs and gibs).
 * Everything here is pure and takes an injectable `rnd` so the rules are testable.
 */
import { DEATHS, deathFall, deathRoot, deathStyleFor, type DeathStyle, type RootKey } from "./death-animations";

export type GoreLevel = "OFF" | "REDUCED" | "FULL";
export const GORE_LEVELS: GoreLevel[] = ["OFF", "REDUCED", "FULL"];
export const DEFAULT_GORE: GoreLevel = "FULL";
export const normalizeGore = (v: unknown): GoreLevel => (v === "OFF" || v === "REDUCED" || v === "FULL" ? v : DEFAULT_GORE);

export type BloodType = "RED" | "GREEN" | "BLUE" | "MACHINE";
/** how the finishing (or current) hit was delivered — decides what can be severed */
export type GoreCause = "BULLET" | "PELLET" | "BLADE" | "BLAST" | "CRUSH" | "ABILITY";
export type GoreKind = "HIT" | "KILL";
export type SeverPart = "HEAD" | "ARM_L" | "ARM_R" | "LEG_L" | "LEG_R";

/** one gore event in the sim ring: where, which way the hit travelled, and how hard relative to the target's health */
export type GoreEvent = {
  id: number; kind: GoreKind; blood: BloodType; cause: GoreCause;
  x: number; y: number; z: number;
  /** horizontal travel direction of the hit (normalised; 0,0 = unknown) */
  dx: number; dz: number;
  /** 0..1: damage of this hit over the target's max health (overkill counts) */
  power: number;
  /** body size: 1 = a 1.85 m trooper */
  size: number;
  /** for KILL: which body (faction model + role) to lay down as a corpse; machine slot rotation */
  body?: { kind: "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD" | "SKYBORN"; role: "standard" | "elite" | "boss"; rot: number; groundY: number; scale: number } | undefined;
  /** for wildlife kills: the critter id, so the wildlife layer can lay that animal down */
  critter?: string | undefined;
};
export const GORE_LOG = 48;
export const emptyGoreEvent = (): GoreEvent => ({ id: 0, kind: "HIT", blood: "RED", cause: "BULLET", x: 0, y: 0, z: 0, dx: 0, dz: 0, power: 0, size: 1 });

/* ---------------- who bleeds what ---------------- */

const MACHINE_WORDS = /drone|turret|sentinel|sentry|mech|construct|automaton|android|robot|bot\b|interceptor|walker|tank|gunship|frame|unit|core|overseer|warden|engine|rig\b|hauler|behemoth crawler/i;
const BLUE_ALIEN_WORDS = /silicon|crystal|shard|abyssal|leviathan|deep|drowned|rime|frost|glacial|ice|void|resonan|echo|phantom|wraith/i;
const GREEN_ALIEN_WORDS = /aberration|mutat|crawl|craw|stalker|viper|queen|spawn|brood|hive|swarm|husk|thing|beast|maw|horror|wyrm|dragon|tree|sovereign|grove|silt|spore|leech/i;

/** blood of an enemy machine from its faction and profile name. Bosses use the same rule (a mech boss sparks). */
export function bloodOf(m: { kind: "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD" | "SKYBORN"; profile: string; rival?: unknown }): BloodType {
  if (m.rival) return "RED"; // rival operators are people in armor
  const p = m.profile;
  if (MACHINE_WORDS.test(p)) return "MACHINE";
  if (m.kind === "SKYBORN") return "BLUE"; // avian aliens
  if (m.kind === "ABERRATION") return BLUE_ALIEN_WORDS.test(p) || /viper/i.test(p) ? "BLUE" : "GREEN";
  if (GREEN_ALIEN_WORDS.test(p)) return "GREEN";
  if (BLUE_ALIEN_WORDS.test(p) && !/frost|ice|glacial|rime/i.test(p)) return "BLUE"; // frost troopers are people in cold gear
  return "RED";
}

/** wildlife blood: mammals green, birds / fish / reptiles blue */
export function critterBlood(species: string): BloodType {
  return species === "SONGBIRD" || species === "VULTURE" || species === "FISH" || species === "SNAKE" ? "BLUE" : "GREEN";
}

/* ---------------- look ---------------- */

export type GoreLook = {
  /** droplet colour (normal blended), mist colour, decal colour */
  drop: string; mist: string; decal: string;
  /** a hot additive layer (machines: sparks) and a vapour layer (machines: coolant) */
  spark?: string; vapour?: string;
  /** additive glow on the droplets (alien blood glows faintly) */
  glow: number;
};
export const GORE_LOOK: Record<BloodType, GoreLook> = {
  RED: { drop: "#6e0a0a", mist: "#7a1010", decal: "#3a0606", glow: 0 },
  GREEN: { drop: "#3f8f1c", mist: "#5fb02a", decal: "#1f4a0e", glow: 0.35 },
  BLUE: { drop: "#1c5fbf", mist: "#3f8fe8", decal: "#0c2a5e", glow: 0.45 },
  MACHINE: { drop: "#0b0a09", mist: "#2a2724", decal: "#090807", spark: "#ffcf7a", vapour: "#bfe6ff", glow: 0 },
};

type LevelTune = { drops: number; mist: number; decalLife: number; decalSize: number; sever: boolean; gibs: number; corpseLife: number; pool: boolean };
export const GORE_TUNE: Record<GoreLevel, LevelTune> = {
  OFF: { drops: 0, mist: 0, decalLife: 0, decalSize: 0, sever: false, gibs: 0, corpseLife: 6, pool: false },
  REDUCED: { drops: 0.4, mist: 0.6, decalLife: 20, decalSize: 0.6, sever: false, gibs: 0, corpseLife: 10, pool: false },
  FULL: { drops: 1, mist: 1, decalLife: 75, decalSize: 1, sever: true, gibs: 1, corpseLife: 30, pool: true },
};

/* ---------------- what a hit sprays ---------------- */

export type DropSpec = { x: number; y: number; z: number; vx: number; vy: number; vz: number; size: number; life: number };
export type MistSpec = { x: number; y: number; z: number; size: number; life: number; vapour: boolean };
export type SparkSpec = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number };
export type GibSpec = { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; size: number; shape: "CHUNK" | "LIMB" | "HEAD" | "PLATE" };
export type Spray = { drops: DropSpec[]; mists: MistSpec[]; sparks: SparkSpec[]; gibs: GibSpec[]; sever: SeverPart | null; gib: boolean; stumpSpurt: number };

const EMPTY: Spray = { drops: [], mists: [], sparks: [], gibs: [], sever: null, gib: false, stumpSpurt: 0 };

/** which part (if any) a kill takes off. Blades and shotguns take limbs/heads, blasts and crushes gib the whole body. */
export function severOf(e: Pick<GoreEvent, "kind" | "cause" | "power">, level: GoreLevel, rnd: () => number): { part: SeverPart | null; gib: boolean } {
  if (e.kind !== "KILL" || !GORE_TUNE[level].sever) return { part: null, gib: false };
  const p = e.power;
  if ((e.cause === "BLAST" && p > 0.45) || (e.cause === "CRUSH" && p > 0.7)) return { part: null, gib: true };
  let chance = 0;
  if (e.cause === "BLADE") chance = 0.55 + p * 0.4;
  else if (e.cause === "PELLET") chance = 0.25 + p * 0.6;
  else if (e.cause === "BLAST" || e.cause === "CRUSH") chance = 0.6;
  else if (e.cause === "BULLET") chance = p > 0.6 ? 0.35 : 0.06; // heavy single rounds (snipers, hand cannons) can take a head
  else chance = p > 0.5 ? 0.2 : 0;
  if (rnd() >= chance) return { part: null, gib: false };
  const r = rnd();
  const part: SeverPart = e.cause === "BULLET" ? "HEAD" : r < 0.3 ? "HEAD" : r < 0.55 ? "ARM_L" : r < 0.8 ? "ARM_R" : r < 0.9 ? "LEG_L" : "LEG_R";
  return { part, gib: false };
}

/** height of a severed part above the feet, in body heights */
export const PART_HEIGHT: Record<SeverPart, number> = { HEAD: 0.92, ARM_L: 0.72, ARM_R: 0.72, LEG_L: 0.3, LEG_R: 0.3 };

/** everything one gore event spawns at this level. Sprays leave forward along the hit (exit wound) with a smaller back-spray. */
export function sprayFor(e: GoreEvent, level: GoreLevel, rnd: () => number = Math.random): Spray {
  const tune = GORE_TUNE[level];
  if (level === "OFF") return EMPTY;
  const machine = e.blood === "MACHINE";
  const kill = e.kind === "KILL";
  const p = Math.min(1, Math.max(0, e.power));
  const { part, gib } = severOf(e, level, rnd);
  let dx = e.dx, dz = e.dz;
  const dl = Math.hypot(dx, dz);
  if (dl < 1e-3) { const a = rnd() * Math.PI * 2; dx = Math.sin(a); dz = Math.cos(a); } else { dx /= dl; dz /= dl; }
  const size = Math.max(0.5, e.size);
  const out: Spray = { drops: [], mists: [], sparks: [], gibs: [], sever: part, gib, stumpSpurt: 0 };

  // droplets: exit spray forward + a little back-spray; kills and blades spray more
  const base = (kill ? 14 : 6) + p * 14 + (e.cause === "BLADE" ? 6 : 0) + (gib ? 22 : 0) + (part ? 8 : 0);
  const n = Math.round(base * tune.drops * (machine ? 0.6 : 1));
  for (let i = 0; i < n; i++) {
    const back = rnd() < 0.25 ? -0.6 : 1;
    const a = (rnd() - 0.5) * (gib ? Math.PI * 2 : 1.4);
    const ca = Math.cos(a), sa = Math.sin(a);
    const fx = (dx * ca - dz * sa) * back, fz = (dx * sa + dz * ca) * back;
    const v = (2.2 + rnd() * 4.5) * (0.7 + p * 0.8) * (gib ? 1.6 : 1);
    out.drops.push({ x: e.x, y: e.y, z: e.z, vx: fx * v, vy: 0.6 + rnd() * 3.2 * (gib ? 1.8 : 1), vz: fz * v, size: (0.025 + rnd() * 0.05) * size, life: 1.6 });
  }
  // mist puff at the wound (machines: dark oil smoke + coolant vapour)
  const mists = Math.round((kill ? 2 : 1) * tune.mist + (gib ? 2 : 0));
  for (let i = 0; i < mists; i++) out.mists.push({ x: e.x + dx * 0.25 * i, y: e.y + 0.05 * i, z: e.z + dz * 0.25 * i, size: (0.35 + p * 0.5 + (gib ? 0.8 : 0)) * size, life: 0.5 + rnd() * 0.3, vapour: false });
  if (machine) {
    out.mists.push({ x: e.x, y: e.y + 0.1, z: e.z, size: (0.5 + p * 0.6) * size, life: kill ? 2.2 : 0.9, vapour: true });
    const sparks = Math.round((kill ? 18 : 7) * (0.6 + p) * (level === "FULL" ? 1 : 0.5));
    for (let i = 0; i < sparks; i++) {
      const a = rnd() * Math.PI * 2, v = 3 + rnd() * 7;
      out.sparks.push({ x: e.x, y: e.y, z: e.z, vx: Math.sin(a) * v * 0.6 + dx * v * 0.5, vy: 1 + rnd() * 5, vz: Math.cos(a) * v * 0.6 + dz * v * 0.5, life: 0.25 + rnd() * 0.45 });
    }
  }
  // severed parts and gibs fly off with the hit
  if (tune.gibs > 0 && (part || gib)) {
    const push = 3 + p * 6;
    if (part) {
      const h = PART_HEIGHT[part] * 1.85 * size;
      const side = part === "ARM_L" || part === "LEG_L" ? -1 : part === "ARM_R" || part === "LEG_R" ? 1 : 0;
      out.gibs.push({ x: e.x - dz * side * 0.3, y: (e.body?.groundY ?? e.y - 1) + h, z: e.z + dx * side * 0.3, vx: dx * push + (rnd() - 0.5) * 2, vy: 2.5 + rnd() * 3, vz: dz * push + (rnd() - 0.5) * 2, spin: 6 + rnd() * 10, size, shape: machine ? "PLATE" : part === "HEAD" ? "HEAD" : "LIMB" });
      out.stumpSpurt = machine ? 0.8 : 1.8;
    }
    if (gib) {
      const count = machine ? 9 : 8;
      for (let i = 0; i < count; i++) {
        const a = rnd() * Math.PI * 2, v = push * (0.5 + rnd() * 0.9);
        const shape: GibSpec["shape"] = machine ? "PLATE" : i === 0 ? "HEAD" : i < 4 ? "LIMB" : "CHUNK";
        out.gibs.push({ x: e.x, y: (e.body?.groundY ?? e.y - 1) + 0.6 + rnd() * 1.1 * size, z: e.z, vx: Math.sin(a) * v + dx * push * 0.5, vy: 3 + rnd() * 6, vz: Math.cos(a) * v + dz * push * 0.5, spin: 4 + rnd() * 14, size: size * (0.7 + rnd() * 0.5), shape });
      }
    }
  }
  return out;
}

/* ---------------- particle pools (pure stepping; GoreFx draws them) ---------------- */

export const DROP_POOL = 160;
export const MIST_POOL = 32;
export const SPARK_POOL_GORE = 96;
export const DECAL_POOL = 72;
export const GIB_POOL = 28;

export type Drop = DropSpec & { age: number; blood: BloodType; alive: boolean; trail?: boolean };
export type Mist = MistSpec & { age: number; blood: BloodType; alive: boolean };
export type GSpark = SparkSpec & { age: number; alive: boolean };
export type Decal = { x: number; y: number; z: number; size: number; grow: number; rot: number; age: number; life: number; blood: BloodType; alive: boolean };
export type Gib = GibSpec & { age: number; life: number; blood: BloodType; alive: boolean; rx: number; ry: number; rz: number; rest: boolean; bleed: number };

export type GorePools = { drops: Drop[]; mists: Mist[]; sparks: GSpark[]; decals: Decal[]; gibs: Gib[]; cursor: Record<string, number> };
export function makeGorePools(): GorePools {
  return {
    drops: Array.from({ length: DROP_POOL }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, life: 0, age: 0, blood: "RED" as BloodType, alive: false })),
    mists: Array.from({ length: MIST_POOL }, () => ({ x: 0, y: 0, z: 0, size: 0, life: 0, vapour: false, age: 0, blood: "RED" as BloodType, alive: false })),
    sparks: Array.from({ length: SPARK_POOL_GORE }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, age: 0, alive: false })),
    decals: Array.from({ length: DECAL_POOL }, () => ({ x: 0, y: 0, z: 0, size: 0, grow: 0, rot: 0, age: 0, life: 0, blood: "RED" as BloodType, alive: false })),
    gibs: Array.from({ length: GIB_POOL }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, size: 0, shape: "CHUNK" as GibSpec["shape"], age: 0, life: 0, blood: "RED" as BloodType, alive: false, rx: 0, ry: 0, rz: 0, rest: false, bleed: 0 })),
    cursor: {},
  };
}

/** a free slot, else the oldest round a cursor (the newest effect always shows) */
function slot<T extends { alive: boolean }>(pools: GorePools, key: string, pool: T[]): T {
  const start = pools.cursor[key] ?? 0;
  for (let i = 0; i < pool.length; i++) { const j = (start + i) % pool.length; if (!pool[j]!.alive) { pools.cursor[key] = (j + 1) % pool.length; return pool[j]!; } }
  pools.cursor[key] = (start + 1) % pool.length;
  return pool[start]!;
}

export function spawnSpray(pools: GorePools, s: Spray, blood: BloodType, level: GoreLevel, rnd: () => number = Math.random) {
  for (const d of s.drops) Object.assign(slot(pools, "d", pools.drops), d, { age: 0, blood, alive: true, trail: false });
  for (const m of s.mists) Object.assign(slot(pools, "m", pools.mists), m, { age: 0, blood, alive: true });
  for (const k of s.sparks) Object.assign(slot(pools, "s", pools.sparks), k, { age: 0, alive: true });
  for (const g of s.gibs) Object.assign(slot(pools, "g", pools.gibs), g, { age: 0, life: GORE_TUNE[level].corpseLife, blood, alive: true, rx: rnd() * 6, ry: rnd() * 6, rz: rnd() * 6, rest: false, bleed: blood === "MACHINE" ? 0 : 2.5 });
}

/** a flat splat on the ground; under a corpse it is a slowly spreading pool */
export function addDecal(pools: GorePools, x: number, y: number, z: number, size: number, blood: BloodType, level: GoreLevel, rnd: () => number = Math.random, grow = 0) {
  const tune = GORE_TUNE[level];
  if (tune.decalLife <= 0) return;
  Object.assign(slot(pools, "c", pools.decals), { x, y: y + 0.03, z, size: size * tune.decalSize, grow: grow * tune.decalSize, rot: rnd() * Math.PI * 2, age: 0, life: tune.decalLife * (0.85 + rnd() * 0.3), blood, alive: true });
}

/** advance every particle; droplets and gibs land on `ground(x,z)` and leave decals there */
export function stepGore(pools: GorePools, dt: number, ground: (x: number, z: number) => number, level: GoreLevel, rnd: () => number = Math.random) {
  for (const d of pools.drops) {
    if (!d.alive) continue;
    d.age += dt;
    d.vy -= 9.8 * dt; d.vx *= 1 - 0.6 * dt; d.vz *= 1 - 0.6 * dt;
    d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    const g = ground(d.x, d.z);
    if (d.y <= g) {
      d.alive = false;
      if (d.blood !== "MACHINE" || rnd() < 0.5) addDecal(pools, d.x, g, d.z, d.size * (d.trail ? 5 : 9) + 0.06, d.blood, level, rnd);
    } else if (d.age > d.life) d.alive = false;
  }
  for (const m of pools.mists) { if (!m.alive) continue; m.age += dt; m.y += dt * (m.vapour ? 0.8 : 0.15); if (m.age > m.life) m.alive = false; }
  for (const s of pools.sparks) {
    if (!s.alive) continue;
    s.age += dt; s.vy -= 9.8 * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    const g = ground(s.x, s.z);
    if (s.y < g) { s.y = g; s.vy = -s.vy * 0.35; s.vx *= 0.5; s.vz *= 0.5; }
    if (s.age > s.life) s.alive = false;
  }
  for (const c of pools.decals) { if (!c.alive) continue; c.age += dt; if (c.grow > 0 && c.age < 6) c.size += c.grow * dt / 6; if (c.age > c.life) c.alive = false; }
  for (const g of pools.gibs) {
    if (!g.alive) continue;
    g.age += dt;
    if (g.age > g.life) { g.alive = false; continue; }
    if (g.rest) continue;
    g.vy -= 9.8 * dt;
    g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
    g.rx += g.spin * dt; g.rz += g.spin * 0.6 * dt;
    // a bleeding part leaves a trail while it flies
    if (g.bleed > 0 && level === "FULL") {
      g.bleed -= dt;
      if (rnd() < dt * 18) Object.assign(slot(pools, "d", pools.drops), { x: g.x, y: g.y, z: g.z, vx: g.vx * 0.2, vy: 0, vz: g.vz * 0.2, size: 0.03, life: 1.2, age: 0, blood: g.blood, alive: true, trail: true });
    }
    const floor = ground(g.x, g.z) + 0.08 * g.size;
    if (g.y <= floor) {
      g.y = floor;
      if (Math.abs(g.vy) < 1.6) {
        g.rest = true; g.vx = g.vy = g.vz = 0;
        if (g.blood !== "MACHINE") addDecal(pools, g.x, floor - 0.08 * g.size, g.z, 0.35 * g.size, g.blood, level, rnd, GORE_TUNE[level].pool ? 0.25 : 0);
      } else {
        g.vy = -g.vy * 0.32; g.vx *= 0.55; g.vz *= 0.55; g.spin *= 0.5;
        if (g.blood !== "MACHINE") addDecal(pools, g.x, floor - 0.08 * g.size, g.z, 0.22 * g.size, g.blood, level, rnd);
      }
    }
  }
}

/* ---------------- corpses ---------------- */

export const CORPSE_POOL = 8;
export type Corpse = {
  alive: boolean; age: number; life: number;
  /** its death animation (death-animations.ts), the seed that varies it, and whether it is mirrored (a fall to the right) */
  style: DeathStyle; seed: number; mirror: boolean;
  kind: "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD" | "SKYBORN"; role: "standard" | "elite" | "boss";
  x: number; z: number; groundY: number; rot: number; scale: number;
  /** fall direction (world, normalised): which way the death animation carries the body */
  fx: number; fz: number;
  sever: SeverPart | null; blood: BloodType; spurt: number;
};
export const makeCorpses = (): Corpse[] => Array.from({ length: CORPSE_POOL }, () => ({ alive: false, age: 0, life: 0, style: "CRUMPLE" as DeathStyle, seed: 0, mirror: false, kind: "RAIDER", role: "standard", x: 0, z: 0, groundY: 0, rot: 0, scale: 1, fx: 0, fz: 1, sever: null, blood: "RED", spurt: 0 }));

/** the fall comes from the body's death animation (death-animations.ts): tip, hip drop, slide, lift and twist over its
 * duration, with a small settle bounce when it lands; afterwards the body lies still, then sinks away */
export const SINK_TIME = 1.6;
export function corpsePose(c: Pick<Corpse, "age" | "life" | "style">): { tip: number; sink: number; root: RootKey } {
  const root = deathRoot(c.style, c.age), end = DEATHS[c.style].duration;
  const bounce = c.age >= end ? Math.max(0, Math.sin(Math.min(1, (c.age - end) / 0.25) * Math.PI) * 0.04) : 0;
  const tip = root.tip - bounce;
  const sinkStart = c.life - SINK_TIME;
  const sink = c.age > sinkStart ? Math.min(1, (c.age - sinkStart) / SINK_TIME) : 0;
  return { tip, sink, root };
}

/** lay a body down from a KILL event (gibbed bodies leave no corpse: the gibs are the body) */
export function addCorpse(corpses: Corpse[], e: GoreEvent, level: GoreLevel, spray: Pick<Spray, "sever" | "gib" | "stumpSpurt">): Corpse | null {
  if (!e.body || spray.gib) return null;
  let c = corpses.find((k) => !k.alive);
  if (!c) c = corpses.reduce((a, b) => (b.age / b.life > a.age / a.life ? b : a));
  // which death: from the cause, the killing blow's power and where it came from relative to the way the body faced
  const seed = Math.random();
  const { style, mirror } = deathStyleFor(e.cause, e.power, e.dx, e.dz, e.body.rot, seed);
  const fall = e.body.rot + deathFall(style, seed, mirror);
  const fx = Math.sin(fall), fz = Math.cos(fall);
  Object.assign(c, { alive: true, age: 0, style, seed, mirror, life: Math.max(DEATHS[style].duration + SINK_TIME + 1, GORE_TUNE[level].corpseLife * (e.body.role === "boss" ? 2 : 1)), kind: e.body.kind, role: e.body.role, x: e.x, z: e.z, groundY: e.body.groundY, rot: e.body.rot, scale: e.body.scale, fx, fz, sever: spray.sever, blood: e.blood, spurt: spray.stumpSpurt });
  return c;
}
export function stepCorpses(corpses: Corpse[], dt: number) {
  for (const c of corpses) { if (!c.alive) continue; c.age += dt; c.spurt = Math.max(0, c.spurt - dt); if (c.age > c.life) c.alive = false; }
}

/** the bone that carries each severable part. The enemy rigs are Mixamo ("mixamorig:LeftArm"); scaling that bone to
 * zero collapses everything it carries, leaving the stump where the parent bone ends. */
export const SEVER_BONE: Record<SeverPart, string> = { HEAD: "Head", ARM_L: "LeftArm", ARM_R: "RightArm", LEG_L: "LeftUpLeg", LEG_R: "RightUpLeg" };
/** find a part's bone among a rig's bone names (prefix-agnostic: "mixamorig:Head", "mixamorigHead", "Head") */
export function severBone(names: string[], part: SeverPart): string | null {
  const want = SEVER_BONE[part].toLowerCase();
  return names.find((n) => { const k = n.toLowerCase().replace(/^mixamorig:?/, ""); return k === want; }) ?? null;
}
