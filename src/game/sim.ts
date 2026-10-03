import { familyFor, rollRaidDrop } from "./raid-loot";
import { squadMove, squadRole } from "./enemy-intelligence";
import { createAi, pickCover, shouldTakeCover, sightRange, stepAwareness, type EnemyAi } from "./enemy-perception";
import { REGIONS, type Region } from "./world";
import { heightAt, smoothstep, walkHeight } from "./terrain";
import { LANES, laneLanePoint, laneSamples, type Lane } from "./lanes";
import { collideBody } from "./obstacles";
import {
  createAdaptation,
  dominantBehavior,
  adaptationMods,
  logBehavior,
  stepAdaptation,
  type Adaptation,
  type AdaptationMods,
} from "./adaptation";
import {
  beginStats,
  countEntity,
  createStats,
  endStats,
  getSimulationTier,
  predictPosition,
  shouldTick,
  tierDt,
  type SimStats,
  type SimTier,
} from "./lod";
import { generateLoot, type LootContext, type LootItem } from "./loot";
import {
  createDirector,
  directorEvent,
  directorTick,
  type Director,
} from "./director";
import { absorbTitanDamage, createTitanState, tickTitan, type TitanState } from "./titan";
import { encounterFor, troopFor } from "./encounters";
import type { MaterialId } from "./inventory";
import type { GearItem } from "./inventory";
import { phaseForHpFraction, tuningFor, type BossPhaseIndex } from "./boss-phases";
import { decayPoise, hitPoise, INITIAL_POISE, openWeakPoint, type PoiseState } from "./boss-poise";
import { counterTuningFor, type CounterTuning } from "./boss-adaptive-ai";
import { completeEmergencyQuest, EMERGENCY_QUEST_INIT, stepEmergencyQuest, type EmergencyQuest } from "./emergency-quest";
import { scenarioById, scenarioFor, type UniqueScenario } from "./unique-scenarios";

/* ------------------------------------------------------------------
 * World simulation: faction capture, fracture instability,
 * AI war machines, NPC convoys, projectiles and physics impacts.
 * One fixed pipeline per frame: inputs → physics → collisions →
 * combat → AI director → world update.
 * ------------------------------------------------------------------ */

export type Faction = "vanguard" | "syndicate" | "overseer";

export const FACTIONS: Record<Faction, { name: string; short: string; color: string }> = {
  vanguard: { name: "Resonants (you)", short: "RSN", color: "#66e0ff" },
  syndicate: { name: "Breakers", short: "BRK", color: "#ff4d4d" },
  overseer: { name: "Controllers", short: "CTL", color: "#c86bff" },
};

export type ZoneState = {
  region: Region;
  owner: Faction;
  /** 0..1 capture progress of the challenger */
  progress: number;
  challenger: Faction;
  contested: boolean;
  /** fracture instability 0..1 */
  instability: number;
};

export type Machine = {
  alive: boolean;
  x: number;
  z: number;
  y: number;
  hp: number;
  rot: number;
  scale: number;
  zone: string;
  cool: number;
  elite: boolean;
  profile: string;
  kind: "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD";
  drop: MaterialId;
  boss: boolean;
  /** spawned by an authored mission (Broken Signal) */
  mission?: boolean;
  /** knockback velocity from impacts */
  kx: number;
  kz: number;
  /** boss-only: hp at full health, and which of BOSS_PHASES it's currently in (see boss-phases.ts) */
  maxHp?: number;
  phase?: BossPhaseIndex;
  /** boss-only: poise/stagger/weak-point meter (see boss-poise.ts) */
  poiseState?: PoiseState;
  /** true when this boss was spawned by the Emergency Quest system (see emergency-quest.ts) */
  eq?: boolean;
  /** set when this boss is a Unique Scenario encounter (see unique-scenarios.ts) instead of a regular catalog boss */
  scenarioId?: string;
  /** patrol/detection/cover state (see enemy-perception.ts); reset when a pooled slot respawns */
  ai?: EnemyAi;
};

export type Truck = {
  alive: boolean;
  lane: number;
  t: number;
  dir: 1 | -1;
  x: number;
  z: number;
  y: number;
  rot: number;
  hp: number;
  cargo: number;
  /** current lane speed, eased so trucks brake instead of colliding */
  speed: number;
  /** seconds spent stopped — used to break rare standoffs */
  stalled: number;
  /** seconds holding at a depot gate, waiting for the player */
  wait: number;
};

export type Turret = {
  x: number;
  z: number;
  y: number;
  /** region the turret defends */
  zone: string;
  cool: number;
  /** >0 while the muzzle flash / tracer is drawn */
  flash: number;
  rot: number;
  range: number;
};

export type Bullet = {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  dmg: number;
  knock: number;
};

export type { Lane };
export { laneSamples };

export type WorldSim = {
  /** active boss fight performance tracker (raid drops) */
  raidFight?: { start: number; hurt: number; region: string } | undefined;
  zones: ZoneState[];
  lanes: Lane[];
  machines: Machine[];
  trucks: Truck[];
  turrets: Turret[];
  bullets: Bullet[];
  credits: number;
  cargo: number;
  hp: number;
  /** Nexus city core integrity — the director's protect target */
  coreHp: number;
  gravity: number;
  alerts: { text: string; life: number }[];
  kills: number;
  extractions: number;
  director: Director;
  /** impact damage cooldown so one obstacle cannot drain the hull */
  impactCool: number;
  /** rolling combat activity used for pacing */
  combatHeat: number;
  /** 0..1 weather visibility set by Scene each frame; shrinks enemy sight */
  envVisibility: number;
  /** latest player gunfire noise 0..1, decays each frame */
  playerNoise: number;
  /** adaptive skill profile driven by observed behaviour */
  adaptation: Adaptation;
  /** derived gameplay modifiers from the adaptive build */
  mods: AdaptationMods;
  /** simulation optimisation telemetry */
  stats: SimStats;
  /** weapon heat 0..100 — sustained fire overheats the gun */
  weaponHeat: number;
  /** true while the weapon vents and cannot fire */
  overheated: boolean;
  lastHit: number;
  /** timestamp of the most recent hull-destroyed respawn — Scene watches this to trigger the death screen and teleport home */
  lastDeath: number;
  /** cause text + cargo lost on the most recent death, for the death screen's stakes readout */
  lastDeathCause: string;
  lastDeathCargo: number;
  deaths: number;
  /** most recent AI-generated drops (newest first) */
  loot: LootItem[];
  /** everything picked up this session */
  vault: LootItem[];
  titan: TitanState;
  titanActive: boolean;
  equippedElement: GearItem["element"];
  materials: Partial<Record<MaterialId, number>>;
  drops: { id: number; material: MaterialId; amount: number; enemy: string }[];
  /** enemy gunfire this frame, consumed by the audio layer */
  enemyShots: { x: number; z: number; kind: string; boss: boolean; elite: boolean }[];
  /** boss phase transitions this frame, consumed by the audio/camera layer (see boss-phases.ts) */
  bossPhaseFlares: { x: number; z: number; name: string; phase: BossPhaseIndex; label: string }[];
  /** Loot + XP System v1 (xp.ts) — Scene.tsx drains this each frame and applies it to PlayerProgression. */
  xpEvents: { type: "KILL" | "ELITE_KILL" | "BOSS_KILL"; enemyLevel: number; combatHeat: number }[];
  nextDropId: number;
  /** Emergency Quest world event — a rare, countdown-warned world-boss spawn (see emergency-quest.ts) */
  emergencyQuest: EmergencyQuest;
  /** adaptive boss AI counter tuning, set by Scene.tsx each frame from the player's recent action
   * log before stepSim() runs (see boss-adaptive-ai.ts) and folded into the engaged boss's phase
   * tuning below — kept as its own field rather than routing through `mods` since `mods` is
   * recomputed fresh from `adaptation` every frame and would just overwrite it. */
  bossCounter: CounterTuning;
};

export const HEAT_PER_SHOT_FOOT = 7;
export const HEAT_PER_SHOT_VEHICLE = 11;

/** roll an AI-generated drop from the live world state */
function dropLoot(sim: WorldSim, zone: ZoneState | undefined, enemyType: string) {
  const ctx: LootContext = {
    enemyType,
    zoneState: zone?.contested ? "Contested" : (zone?.instability ?? 0) > 0.5 ? "Fractured" : "Stable",
    difficulty: zone?.region.difficulty ?? 3,
    isRaid: (zone?.region.kind ?? "war") === "core",
    corruption: Math.round((zone?.instability ?? 0.2) * 100),
    playstyle: dominantBehavior(sim.adaptation.playstyle),
  };
  const item = generateLoot(ctx);
  sim.loot.unshift(item);
  if (sim.loot.length > 5) sim.loot.pop();
  sim.vault.push(item);
  sim.credits += Math.round(item.power * 0.12);
  alert(sim, `${item.rarity} drop — ${item.name}`);
}

export function defeatMachine(sim: WorldSim, m: Machine) {
  if (!m.alive || m.hp > 0) return;
  m.alive = false;
  sim.kills++;
  sim.credits += m.boss ? 250 : m.elite ? 75 : 45;
  directorEvent(sim.director, { type: "KILL" });
  const material = m.drop;
  const amount = m.boss ? 3 : m.elite ? 2 : 1;
  sim.materials[material] = (sim.materials[material] ?? 0) + amount;
  sim.drops.push({ id: sim.nextDropId++, material, amount, enemy: m.profile });
  sim.xpEvents.push({ type: m.boss ? "BOSS_KILL" : m.elite ? "ELITE_KILL" : "KILL", enemyLevel: 1 + Math.floor(sim.combatHeat / 25), combatHeat: sim.combatHeat });
  dropLoot(sim, zoneOf(sim, m.zone), m.boss ? "ELITE" : m.profile);
  if (m.boss) {
    const fight = sim.raidFight ?? { start: performance.now() / 1000, hurt: 50, region: m.zone };
    const drops = rollRaidDrop(familyFor(fight.region), { phasesCleared: 3, damageTaken: fight.hurt, seconds: performance.now() / 1000 - fight.start });
    for (const item of drops) { sim.vault.push(item); sim.loot.unshift(item); alert(sim, `${item.rarity} raid drop — ${item.name}`); }
    if (sim.loot.length > 5) sim.loot.length = 5;
    sim.raidFight = undefined;
  }
  if (m.eq) {
    sim.emergencyQuest = completeEmergencyQuest(sim.emergencyQuest);
    sim.credits += 400;
    alert(sim, "Emergency Quest cleared — bonus payout secured");
  }
  if (m.scenarioId) {
    const scenario = scenarioById(m.scenarioId);
    if (scenario) {
      sim.credits += scenario.rewardCredits;
      alert(sim, `${scenario.name} cleared · bonus payout secured`);
    }
  }
  alert(sim, `${m.profile} defeated · ${material.replace(/([A-Z])/g, " $1")} +${amount}`);
}

const byId = (id: string) => REGIONS.find((r) => r.id === id)!;

export const MACHINE_POOL = 18;
export const TRUCK_POOL = 12;
export const BULLET_POOL = 48;

export function createSim(): WorldSim {
  const zones: ZoneState[] = REGIONS.map((region) => ({
    region,
    owner:
      region.id === "nexus"
        ? "vanguard"
        : region.kind === "fracture" || region.kind === "core"
          ? "overseer"
          : "syndicate",
    progress: 0,
    challenger: "vanguard",
    contested: false,
    instability: 0,
  }));

  const machines: Machine[] = Array.from({ length: MACHINE_POOL }, () => ({
    alive: false,
    x: 0,
    z: 0,
    y: 0,
    hp: 0,
    rot: 0,
    scale: 1,
    zone: "",
    cool: 0,
    elite: false,
    profile: "Wasteland Grunt", kind: "RAIDER", drop: "scrapMetal", boss: false,
    kx: 0,
    kz: 0,
  }));

  // one truck per lane+direction slot: two trucks can never share a corridor
  const trucks: Truck[] = Array.from({ length: TRUCK_POOL }, (_, i) => ({
    alive: i < LANES.length * 2,
    lane: i % LANES.length,
    t: 0.1 + ((i * 0.37) % 0.8),
    dir: Math.floor(i / LANES.length) % 2 === 0 ? 1 : -1,
    x: 0,
    z: 0,
    y: 0,
    rot: 0,
    hp: 3,
    cargo: 1 + (i % 3),
    speed: 0.035,
    stalled: 0,
    wait: 0,
  }));

  // automated defence grid on the safe-zone perimeters
  const turrets: Turret[] = REGIONS.filter((r) => r.kind === "safe" || r.kind === "starter").flatMap((r) => {
    const count = r.kind === "safe" ? 8 : 5;
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      const x = r.x + Math.cos(a) * r.radius * 0.92;
      const z = r.z + Math.sin(a) * r.radius * 0.92;
      return {
        x,
        z,
        y: walkHeight(x, z),
        zone: r.id,
        cool: Math.random(),
        flash: 0,
        rot: a,
        range: r.kind === "safe" ? 62 : 44,
      };
    });
  });

  const bullets: Bullet[] = Array.from({ length: BULLET_POOL }, () => ({
    alive: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    dmg: 1,
    knock: 1,
  }));

  const adaptation = createAdaptation();

  return {
    zones,
    lanes: LANES,
    machines,
    trucks,
    turrets,
    bullets,
    credits: 0,
    cargo: 0,
    hp: 100,
    coreHp: 100,
    gravity: 26,
    alerts: [],
    kills: 0,
    extractions: 0,
    director: createDirector(),
    impactCool: 0,
    combatHeat: 0,
    adaptation,
    mods: adaptationMods(adaptation),
    stats: createStats(),
    weaponHeat: 0,
    overheated: false,
    lastHit: 0,
    lastDeath: 0,
    lastDeathCause: "",
    lastDeathCargo: 0,
    deaths: 0,
    loot: [],
    vault: [],
    titan: createTitanState(),
    titanActive: false,
    equippedElement: "KINETIC",
    materials: {}, drops: [], enemyShots: [], bossPhaseFlares: [], xpEvents: [], nextDropId: 0,
    emergencyQuest: EMERGENCY_QUEST_INIT,
    bossCounter: counterTuningFor(null),
  };
}

export function alert(sim: WorldSim, text: string) {
  sim.alerts.unshift({ text, life: 6 });
  if (sim.alerts.length > 4) sim.alerts.pop();
}

export function zoneOf(sim: WorldSim, id: string) {
  return sim.zones.find((z) => z.region.id === id);
}

/** Reads the zone's own live `instability` (already driven every frame by the fracture-pulse formula
 * below, and already fed into spawn rate + the player-toss physics) as a 5-tier label the player can
 * actually see — the tiering a pasted "world corruption" spec asked for, applied to the real per-zone
 * value this sim already computes, instead of a second corruption number ticking up in the background. */
export type InstabilityTier = "STABLE" | "STRAINED" | "FRACTURED" | "COLLAPSING" | "VOID";
export function instabilityTier(instability: number): InstabilityTier {
  if (instability < 0.2) return "STABLE";
  if (instability < 0.4) return "STRAINED";
  if (instability < 0.6) return "FRACTURED";
  if (instability < 0.8) return "COLLAPSING";
  return "VOID";
}

function spawnMachine(sim: WorldSim, zone: ZoneState, elite = false) {
  const m = sim.machines.find((x) => !x.alive);
  if (!m) return;
  const a = Math.random() * Math.PI * 2;
  const d = zone.region.radius * (0.4 + Math.random() * 0.55);
  m.alive = true;
  m.x = zone.region.x + Math.cos(a) * d;
  m.z = zone.region.z + Math.sin(a) * d;
  const profile = troopFor(zone.region.id, Math.floor(Math.random() * 3));
  if (!profile) return;
  m.profile = profile.name; m.kind = profile.kind; m.drop = profile.drop as MaterialId; m.boss = false; m.mission = false;
  m.hp = (elite ? 7 : 3) + Math.round(zone.region.difficulty * 0.8);
  m.rot = 0;
  m.scale = (elite ? 1.5 : 0.9) + Math.random() * 0.7;
  m.zone = zone.region.id;
  m.cool = 1.5;
  m.elite = elite;
  m.kx = 0;
  m.kz = 0;
}

/** Spawn Broken Signal data drones around a point; tagged so the mission can count them. */
export function spawnMissionDrones(sim: WorldSim, x: number, z: number, count: number, elite: boolean) {
  for (let i = 0; i < count; i++) {
    const m = sim.machines.find((e) => !e.alive);
    if (!m) return;
    const a = (i / count) * Math.PI * 2;
    Object.assign(m, { alive: true, x: x + Math.cos(a) * 16, z: z + Math.sin(a) * 16, hp: elite ? 6 : 3, rot: 0, scale: elite ? 1.1 : 0.8, zone: "nexus", cool: elite ? 1.2 : 2.5, elite, profile: elite ? "Data Drone Elite" : "Data Drone Scout", kind: "OVERCLOCKED" as const, drop: "dataShards" as MaterialId, boss: false, kx: 0, kz: 0, mission: true });
  }
}


/** Spawns the regional catalog boss (encounters.ts) at (x,z). `extra` merges additional Machine
 * fields in afterward — used to tag an Emergency Quest spawn (`{ eq: true }`). Falls back to that
 * region's Unique Scenario (unique-scenarios.ts) when it has no catalog boss, so the same call
 * site (the "B" debug summon, a boss lair, or the Emergency Quest spawner) works for both. */
export function summonBoss(sim: WorldSim, regionId: string, x: number, z: number, extra?: Partial<Machine>): boolean {
  const boss = encounterFor(regionId)?.boss;
  if (!boss) {
    const scenario = scenarioFor(regionId);
    return scenario ? summonScenarioBoss(sim, scenario, x, z, extra) : false;
  }
  const m = sim.machines.find((candidate) => !candidate.alive);
  if (!m) return false;
  Object.assign(m, { alive: true, x, z, y: walkHeight(x, z) + 5, hp: 28, maxHp: 28, phase: 0 as BossPhaseIndex, rot: 0, scale: 2.3, zone: regionId, cool: 2, elite: true, boss: true, profile: boss.name, kind: "OVERCLOCKED", drop: boss.drop, kx: 0, kz: 0, poiseState: INITIAL_POISE, ...extra });
  sim.raidFight = { start: performance.now() / 1000, hurt: 0, region: regionId };
  alert(sim, `${boss.name} · ${boss.tell}`);
  return true;
}

/** Spawns a Unique Scenario encounter (unique-scenarios.ts) — a one-off boss with a real gimmick
 * instead of just reskinned stats; see that file for what `scenarioId` changes about combat. */
export function summonScenarioBoss(sim: WorldSim, scenario: UniqueScenario, x: number, z: number, extra?: Partial<Machine>): boolean {
  const m = sim.machines.find((candidate) => !candidate.alive);
  if (!m) return false;
  Object.assign(m, { alive: true, x, z, y: walkHeight(x, z) + 5, hp: 34, maxHp: 34, phase: 0 as BossPhaseIndex, rot: 0, scale: 2.5, zone: scenario.regionId, cool: 2, elite: true, boss: true, profile: scenario.bossName, kind: "ABERRATION", drop: scenario.drop as MaterialId, kx: 0, kz: 0, poiseState: INITIAL_POISE, scenarioId: scenario.id, ...extra });
  sim.raidFight = { start: performance.now() / 1000, hurt: 0, region: scenario.regionId };
  alert(sim, `${scenario.name} · ${scenario.briefing}`);
  return true;
}

export function fireBullet(
  sim: WorldSim,
  x: number,
  y: number,
  z: number,
  yaw: number,
  inVehicle = false,
  pitch = 0,
  dmg = 1,
  knock = 1,
  heat = 1,
) {
  if (sim.overheated) return false;
  const b = sim.bullets.find((v) => !v.alive);
  if (!b) return false;
  sim.weaponHeat = Math.min(100, sim.weaponHeat + (inVehicle ? HEAT_PER_SHOT_VEHICLE : HEAT_PER_SHOT_FOOT) * heat);
  if (sim.weaponHeat >= 100) {
    sim.overheated = true;
    alert(sim, "WEAPON OVERHEAT — venting");
  }
  b.alive = true;
  b.x = x;
  b.y = y;
  b.z = z;
  b.vx = Math.sin(yaw) * Math.cos(pitch) * 130;
  b.vy = Math.sin(pitch) * 130;
  b.vz = Math.cos(yaw) * Math.cos(pitch) * 130;
  b.life = 1.4;
  b.dmg = dmg;
  b.knock = knock;
  logBehavior(sim.adaptation, "combat", 0.35);
  return true;
}

/** hurt the player and respawn at Nexus when the hull is gone */
export function hurtPlayer(sim: WorldSim, dmg: number, cause: string) {
  // Global Balance Controller (balance.ts): scales every hit the player takes by their own power
  // score before anything else runs — the one place all incoming damage already funnels through.
  const scaled = dmg * sim.mods.incomingDamageScale;
  const resolvedDamage = sim.titanActive ? absorbTitanDamage(sim.titan, scaled, performance.now() / 1000) : scaled;
  sim.hp = Math.max(0, sim.hp - resolvedDamage);
  if (sim.raidFight) sim.raidFight.hurt += resolvedDamage;
  if (sim.hp === 0) {
    sim.lastDeath = performance.now();
    sim.lastDeathCause = cause;
    sim.lastDeathCargo = sim.cargo;
    sim.deaths++;
    sim.hp = 100;
    sim.cargo = 0;
    alert(sim, `Hull destroyed (${cause}) — respawned at Nexus City, cargo lost`);
  }
}

export type PlayerBody = { x: number; z: number; yaw: number; vSpeed: number; inVehicle: boolean };

/**
 * Physics pass for the player body: collide with terrain props, war machines
 * and convoys. Impacts damage both sides and bleed off speed.
 */
export function collidePlayer(sim: WorldSim, body: PlayerBody) {
  const radius = body.inVehicle ? 3.1 : 1.0;
  const mass = body.inVehicle ? 2.4 : 0.8;
  const speed = body.inVehicle ? body.vSpeed : 8;

  // --- world props (trees, rocks, wrecks, towers) ---
  const impact = collideBody(body, radius, speed, mass);
  if (impact.hit && Math.abs(speed) > 6) {
    body.vSpeed *= impact.broke ? 0.55 : -0.18;
    if (impact.damage > 2 && sim.impactCool <= 0) {
      sim.impactCool = 0.6;
      hurtPlayer(sim, Math.min(30, impact.damage), impact.broke ? `smashed a ${impact.kind}` : `hit a ${impact.kind}`);
      sim.combatHeat += 3;
      if (impact.broke) alert(sim, `Rammed through a ${impact.kind}`);
    }
  }

  // --- vehicle vs war machine ---
  for (const m of sim.machines) {
    if (!m.alive) continue;
    const dx = body.x - m.x;
    const dz = body.z - m.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const min = radius + 3.0 * m.scale;
    if (dist >= min) continue;
    const push = min - dist + 0.05;
    body.x += (dx / dist) * push * 0.4;
    body.z += (dz / dist) * push * 0.4;
    m.kx -= (dx / dist) * Math.abs(speed) * 0.5;
    m.kz -= (dz / dist) * Math.abs(speed) * 0.5;

    const force = Math.abs(speed) * mass;
    if (force > 30 && sim.impactCool <= 0) {
      sim.impactCool = 0.6;
      m.hp -= Math.round((force / 30) * sim.mods.ramDamage);
      logBehavior(sim.adaptation, body.inVehicle ? "vehicles" : "combat", 2);
      body.vSpeed *= 0.4;
      sim.combatHeat += 4;
       defeatMachine(sim, m);
      hurtPlayer(sim, (force * 0.12) / sim.mods.hullDurability, "vehicle collision");
    } else {
      hurtPlayer(sim, (force * 0.02) / sim.mods.hullDurability, "vehicle collision");
    }
  }

  // --- vehicle vs convoy truck ---
  for (const tr of sim.trucks) {
    if (!tr.alive) continue;
    const dx = body.x - tr.x;
    const dz = body.z - tr.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const min = radius + 3.4;
    if (dist >= min) continue;
    const push = min - dist + 0.05;
    body.x += (dx / dist) * push;
    body.z += (dz / dist) * push;

    const force = Math.abs(speed) * mass;
    if (force > 40 && sim.impactCool <= 0) {
      sim.impactCool = 0.6;
      tr.hp -= Math.max(1, Math.round(sim.mods.ramDamage));
      body.vSpeed *= 0.3;
      hurtPlayer(sim, (force * 0.1) / sim.mods.hullDurability, "convoy ram");
      logBehavior(sim.adaptation, "vehicles", 2);
      sim.combatHeat += 4;
      if (tr.hp <= 0) {
        tr.alive = false;
        sim.cargo += tr.cargo;
        logBehavior(sim.adaptation, "logistics", tr.cargo * 2);
        directorEvent(sim.director, { type: "CARGO", amount: tr.cargo });
        alert(sim, `Convoy rammed — ${tr.cargo} crate${tr.cargo > 1 ? "s" : ""} seized`);
      }
    } else {
      body.vSpeed *= 0.6;
    }
  }
}

export type SimInput = {
  px: number;
  pz: number;
  dt: number;
  /** 0..1 through the day; night raises AI aggression */
  night: number;
  inVehicle: boolean;
};

export function stepSim(sim: WorldSim, input: SimInput) {
  const { dt, px, pz, night } = input;
  const t0 = performance.now();
  beginStats(sim.stats);
  if (sim.titanActive) tickTitan(sim.titan, dt);

  // ---------- adaptive build loop ----------
  // passive behaviour: time spent driving, sneaking past hostiles, holding the line
  if (input.inVehicle) logBehavior(sim.adaptation, "vehicles", dt * 0.6);
  let escorting = 0;
  for (const tr of sim.trucks) {
    if (tr.alive && Math.hypot(px - tr.x, pz - tr.z) < 40) escorting++;
  }
  if (escorting > 0) logBehavior(sim.adaptation, "support", dt * 0.5 * escorting);
  stepAdaptation(sim.adaptation, dt);
  sim.mods = adaptationMods(sim.adaptation);
  if (sim.mods.regen > 0 && sim.hp < 100) sim.hp = Math.min(100, sim.hp + sim.mods.regen * dt);

  // ---------- Emergency Quest world event ----------
  const eqWasWarning = sim.emergencyQuest.state === "WARNING";
  sim.emergencyQuest = stepEmergencyQuest(sim.emergencyQuest, dt, (regionId) => {
    const r = REGIONS.find((rr) => rr.id === regionId);
    return r ? { x: r.x + (Math.random() - 0.5) * 30, z: r.z + (Math.random() - 0.5) * 30 } : null;
  });
  if (sim.emergencyQuest.state === "WARNING" && !eqWasWarning) {
    alert(sim, `EMERGENCY QUEST · ${sim.emergencyQuest.bossName} inbound — ${sim.emergencyQuest.regionId}`);
  }
  if (eqWasWarning && sim.emergencyQuest.state === "ACTIVE") {
    const eq = sim.emergencyQuest;
    if (!summonBoss(sim, eq.regionId, eq.x, eq.z, { eq: true })) sim.emergencyQuest = { ...sim.emergencyQuest, state: "FAILED", timer: 10 };
    else alert(sim, `EMERGENCY QUEST ACTIVE · ${eq.bossName} has arrived`);
  }

  // ---------- alerts ----------
  for (const a of sim.alerts) a.life -= dt;
  sim.alerts = sim.alerts.filter((a) => a.life > 0);
  sim.combatHeat = Math.max(0, sim.combatHeat - dt * 6);
  sim.playerNoise = Math.max(0, (sim.playerNoise ?? 0) - dt * 1.5);
  // weapon cooling: venting from an overheat is slower than a normal cooldown
  sim.weaponHeat = Math.max(0, sim.weaponHeat - dt * (sim.overheated ? 22 : 34));
  if (sim.overheated && sim.weaponHeat <= 6) {
    sim.overheated = false;
    alert(sim, "Weapon cooled — ready");
  }
  sim.impactCool = Math.max(0, sim.impactCool - dt);

  const t = performance.now() / 1000;
  let playerInstability = 0;
  let liveMachines = 0;
  let hostileNear = 0;
  let contestedZones = 0;
  for (const m of sim.machines) if (m.alive) liveMachines++;

  // ---------- zones: instability + faction capture ----------
  for (const z of sim.zones) {
    const r = z.region;
    const dPlayer = Math.hypot(px - r.x, pz - r.z);
    const inside = dPlayer < r.radius;

    if (r.kind === "fracture" || r.kind === "core") {
      const pulse = (Math.sin(t * 0.35 + r.x) + Math.sin(t * 0.11 + r.z)) * 0.5;
      z.instability = Math.min(1, Math.max(0, 0.45 + pulse * 0.55));
    } else {
      z.instability = 0;
    }
    if (inside) {
      playerInstability = Math.max(
        playerInstability,
        z.instability * (1 - smoothstep(r.radius * 0.6, r.radius, dPlayer)),
      );
    }

    if (r.id === "nexus") {
      z.contested = false;
      z.progress = 0;
      // the core slowly repairs while it is not under siege
      sim.coreHp = Math.min(100, sim.coreHp + dt * 1.2);
      continue;
    }

    const pressure = (0.012 + r.difficulty * 0.004) * (night > 0.5 ? 1.5 : 1);
    if (inside) {
      z.challenger = "vanguard";
      z.progress += dt * (input.inVehicle ? 0.075 : 0.05);
    } else {
      const drift = z.owner === "vanguard" ? 1 : -1;
      if (z.owner === "vanguard") z.challenger = r.kind === "fracture" || r.kind === "core" ? "overseer" : "syndicate";
      z.progress += dt * pressure * drift;
    }
    z.progress = Math.min(1, Math.max(0, z.progress));
    z.contested = z.progress > 0.08;
    if (z.contested) contestedZones++;

    if (z.progress >= 1) {
      const old = z.owner;
      z.owner = z.challenger;
      z.progress = 0;
      z.challenger = old;
      alert(sim, `${r.name} captured by ${FACTIONS[z.owner].short}`);
      directorEvent(sim.director, { type: "CAPTURE", regionId: r.id });
      const waves = 2 + Math.round(r.difficulty * 0.7 * (1 + z.instability));
      for (let i = 0; i < waves; i++) spawnMachine(sim, z);
    }

    if (inside && z.owner !== "vanguard" && liveMachines < MACHINE_POOL - 2) {
      const rate = 0.16 * (1 + z.instability * 1.6) * (1 + night) * (r.difficulty / 3);
      if (Math.random() < rate * dt) {
        spawnMachine(sim, z);
        liveMachines++;
      }
    }
  }

  sim.gravity = 26 * (1 - playerInstability * 0.66);

  // ---------- war machines ----------
  for (let i = 0; i < sim.machines.length; i++) {
    const m = sim.machines[i]!;
    if (!m.alive) continue;

    // --- simulation LOD: only nearby machines get full AI + physics ---
    const simTier: SimTier = getSimulationTier(m.x, m.z, px, pz);
    const simTick = shouldTick(simTier, sim.stats.frame);
    countEntity(sim.stats, simTier, simTick, m.zone);
    if (simTier >= 2) {
      // dormant: abstract drift, no collisions, no combat resolution
      if (!simTick) {
        sim.stats.dormant++;
        continue;
      }
      const sdt = tierDt(simTier, dt);
      m.rot += sdt * 0.2;
      const pred = predictPosition(m, 4, sdt);
      m.x = pred.x;
      m.z = pred.z;
      m.y = walkHeight(m.x, m.z) + 2.2 * m.scale;
      if (Math.hypot(px - m.x, pz - m.z) > 340) m.alive = false;
      sim.stats.dormant++;
      continue;
    }

    const dx = px - m.x;
    const dz = pz - m.z;
    const d = Math.hypot(dx, dz) || 1;

    // multi-phase boss combat: re-derive the phase from current hp fraction every frame, and flare
    // once when it changes, so named bosses escalate instead of fighting as one flat health bar
    let bossTuning: ReturnType<typeof tuningFor> | null = null;
    if (m.boss && m.maxHp) {
      const nowSec = performance.now() / 1000;
      if (!m.poiseState) m.poiseState = INITIAL_POISE;
      m.poiseState = decayPoise(m.poiseState, dt, nowSec);
      const nextPhase = phaseForHpFraction(Math.max(0, m.hp) / m.maxHp);
      if (m.phase === undefined) m.phase = 0;
      if (nextPhase !== m.phase) {
        m.phase = nextPhase;
        // the phase shift doubles as the weak-point telegraph: its core destabilizes right as it escalates
        m.poiseState = openWeakPoint(m.poiseState, nowSec);
        const t = tuningFor(nextPhase);
        sim.bossPhaseFlares.push({ x: m.x, z: m.z, name: m.profile, phase: nextPhase, label: t.label });
        if (sim.bossPhaseFlares.length > 6) sim.bossPhaseFlares.shift();
        alert(sim, `${m.profile} · ${t.label} — ${t.telegraph}`);
      }
      const base = tuningFor(m.phase);
      const counter = sim.bossCounter;
      bossTuning = {
        label: base.label,
        telegraph: base.telegraph,
        speedMult: base.speedMult * counter.speedMult,
        damageMult: base.damageMult * counter.damageMult,
        cooldownMult: base.cooldownMult * counter.cooldownMult,
      };
    }

    const aggro =
      (70 + night * 60) * (m.elite ? 1.6 : 1) * sim.mods.aggroRadius * sim.adaptation.influence.aiAggression;
    const speed = (10 + night * 6) * (m.elite ? 1.15 : 1) * (bossTuning?.speedMult ?? 1);
    if (d < 120) hostileNear++;

    // ---- awareness: patrol → suspicious → alert → search (enemy-perception.ts) ----
    if (!m.ai || m.hp > m.ai.lastHp + 0.01) m.ai = createAi(m.x, m.z, m.hp);
    const ai = m.ai;
    const damaged = m.hp < ai.lastHp - 0.001;
    ai.lastHp = m.hp;
    const facingDot = (Math.sin(m.rot) * dx + Math.cos(m.rot) * dz) / d;
    const sight = sightRange(night, sim.envVisibility ?? 1, m.elite) * (aggro / 70 > 1 ? Math.min(1.6, aggro / 70) : 1);
    const forced = m.boss || m.mission || sim.hp < 35 && d < 40;
    const aiState = forced && d < aggro ? (ai.state = "ALERT", ai.awareness = 1, ai.lastX = px, ai.lastZ = pz, "ALERT")
      : stepAwareness(ai, { distance: d, sight, noise: Math.min(1, (sim.playerNoise ?? 0) + sim.combatHeat / 120), damaged, facing: facingDot > 0.3 }, px, pz, dt);
    if (aiState === "ALERT" && ai.coverTime <= 0 && shouldTakeCover(m.hp / Math.max(1, m.maxHp ?? (m.elite ? 6 : 3)), ai.coverTime, m.boss) && d < 45 && damaged) {
      const c = pickCover(m.x, m.z, px, pz, i % 2 ? 1 : -1);
      ai.coverX = c.x; ai.coverZ = c.z; ai.coverTime = 3.5;
    }
    ai.coverTime -= dt;

    if (aiState === "ALERT" && ai.coverTime > 1.2) {
      // break line of fire: sprint to cover, no shooting while relocating
      const cx = ai.coverX - m.x, cz = ai.coverZ - m.z, cd = Math.hypot(cx, cz);
      if (cd > 1.5) { m.x += (cx / cd) * speed * 1.25 * dt; m.z += (cz / cd) * speed * 1.25 * dt; m.rot = Math.atan2(cx, cz); }
      else m.rot = Math.atan2(dx, dz);
      m.cool = Math.max(m.cool, 0.4);
    } else if (aiState === "ALERT") {
      // squad role + threat drive positioning instead of a straight chase
      const i = sim.machines.indexOf(m);
      const move = squadMove(squadRole(i, m.elite, m.boss), d, sim.hp / 100, sim.combatHeat, performance.now() / 1000 + i, sim.mods.squadArchetype, sim.mods.rangedHoldFire);
      const nx = dx / d, nz = dz / d;
      m.x += (nx * move.forward + -nz * move.strafe) * speed * dt;
      m.z += (nz * move.forward + nx * move.strafe) * speed * dt;
      m.rot = Math.atan2(dx, dz);
      m.cool -= dt;
      if (d < 6 && m.cool <= 0) {
        m.cool = 1.1 * (bossTuning?.cooldownMult ?? 1);
        sim.combatHeat += 2;
         hurtPlayer(sim, ((m.boss ? 17 : m.elite ? 12 : 7) * (bossTuning?.damageMult ?? 1)) / sim.mods.hullDurability, m.profile);
        // machines besieging Nexus chew the city core
        if (Math.hypot(m.x - byId("nexus").x, m.z - byId("nexus").z) < byId("nexus").radius) {
          sim.coreHp = Math.max(0, sim.coreHp - 2);
        }
      } else if (d < 55 && m.cool <= 0) {
        // ranged suppressing fire: telegraphed by sound, lands occasionally
        m.cool = (m.boss ? 1.2 : m.elite ? 1.5 : 2.1) * (bossTuning?.cooldownMult ?? 1);
        sim.enemyShots.push({ x: m.x, z: m.z, kind: m.kind, boss: m.boss, elite: m.elite });
        if (sim.enemyShots.length > 24) sim.enemyShots.shift();
        if (Math.random() < 0.25) hurtPlayer(sim, ((m.boss ? 6 : m.elite ? 4 : 2) * (bossTuning?.damageMult ?? 1)) / sim.mods.hullDurability, m.profile);
      }
    } else if (aiState === "SUSPICIOUS" || aiState === "SEARCH") {
      // investigate last known position; turn to face it, move cautiously
      const lx = ai.lastX - m.x, lz = ai.lastZ - m.z, ld = Math.hypot(lx, lz);
      const pace = aiState === "SEARCH" ? 0.7 : 0.45;
      if (ld > 3) { m.x += (lx / ld) * speed * pace * dt; m.z += (lz / ld) * speed * pace * dt; m.rot = Math.atan2(lx, lz); }
      else m.rot += dt * 1.6; // sweep around
    } else {
      // patrol between waypoints around the spawn anchor
      const wx = ai.wpX - m.x, wz = ai.wpZ - m.z, wd = Math.hypot(wx, wz);
      if (wd < 2.5) {
        ai.timer -= dt;
        m.rot += dt * 0.6;
        if (ai.timer <= 0) {
          const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 22;
          ai.wpX = ai.homeX + Math.cos(a) * r; ai.wpZ = ai.homeZ + Math.sin(a) * r; ai.timer = 1.5 + Math.random() * 2;
        }
      } else {
        m.x += (wx / wd) * 5 * dt; m.z += (wz / wd) * 5 * dt;
        m.rot = Math.atan2(wx, wz);
      }
      if (d > 260) m.alive = false;
    }

