import { rollSetDrop, setById, type SetDrop } from "./armor-sets";
import { stratagemById, type StratagemId } from "./stratagems";
import { NO_BACKPACK, type BackpackDef } from "./backpacks";
import { createEnvState, STRIKE_MACHINE_DAMAGE, STRIKE_PLAYER_DAMAGE, type EnvState, type Strike } from "./environment";
import { familyFor, rollRaidDrop } from "./raid-loot";
import { squadMove, squadRole } from "./enemy-intelligence";
import { createAi, pickCover, shouldTakeCover, sightRange, stepAwareness, type EnemyAi } from "./enemy-perception";
import { RIFT_TURRET_DAMAGE, deployRiftTurret, stepRiftTurret, type RiftTurret } from "./operator-abilities";
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
import { decayPoise, hitPoise, INITIAL_POISE, isStaggered, isWeakPointOpen, openWeakPoint, type PoiseState } from "./boss-poise";
import { counterTuningFor, type CounterTuning } from "./boss-adaptive-ai";
import { completeEmergencyQuest, EMERGENCY_QUEST_INIT, stepEmergencyQuest, type EmergencyQuest } from "./emergency-quest";
import { scenarioById, scenarioFor, type UniqueScenario } from "./unique-scenarios";
import { INITIAL_NULL_CHARGE, NULL_PERK, NULL_PULSE_POISE, NULL_PULSE_RADIUS, NULL_PULSE_STUN_SECONDS, registerNullHit, type NullChargeState } from "./null-disruption";
import { PARTICIPATION_HITS, SCENARIO_LOOT, rollScenario, type ScenarioClaim } from "./scenario-loot";
import { attunedElement, gimmickMultiplier, type DamageElement } from "./scenario-gimmicks";

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
  /** scenario gimmick bookkeeping (scenario-gimmicks.ts): recent hit elements, and the attunement last announced */
  gimmickHistory?: DamageElement[];
  attuned?: DamageElement;
  /** scenario run id (unique per summon) and how many player bullets landed on it — the basis of reward eligibility */
  scenarioRun?: string;
  playerHits?: number;
  /** patrol/detection/cover state (see enemy-perception.ts); reset when a pooled slot respawns */
  ai?: EnemyAi;
  /** subclass-verb vulnerability window (see subclass-verbs.ts's WEAKEN/MARKED) — while
   * performance.now()/1000 < vulnUntil, incoming damage is multiplied by vulnMult. Reset to 0/1 on
   * every (re)spawn so a pooled slot never inherits a stale debuff from its previous occupant. */
  vulnUntil: number;
  vulnMult: number;
  /** seconds left in a ranged shot's wind-up telegraph; >0 means this machine holds an attack ticket */
  aim?: number;
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

/** A thrown stratagem beacon (stratagems.ts): flies, sticks to the ground, counts down, then blasts. */
export type Beacon = {
  alive: boolean;
  kind: StratagemId;
  state: "FLIGHT" | "ARMED" | "BLAST";
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** seconds left in the current state */
  timer: number;
  radius: number;
};
export type StratagemEvent = { kind: StratagemId; x: number; z: number; radius: number };
const BEACON_POOL = 4;
const BEACON_BLAST_S = 0.45;

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
  /** perk of the weapon in hand (set each frame by Scene) and the Null Disruption charge it feeds (null-disruption.ts) */
  equippedPerk: GearItem["perk"] | undefined;
  nullCharge: NullChargeState;
  nextHitId: number;
  materials: Partial<Record<MaterialId, number>>;
  drops: { id: number; material: MaterialId; amount: number; enemy: string; /** armor-sets.ts: a set piece this kill dropped */ setDrop?: SetDrop; /** scenario-loot.ts: signature reward claim for a valid Unique Scenario clear */ scenarioClaim?: ScenarioClaim }[];
  /** equipped armor-set bonuses (armor-sets.ts), written by Scene each frame: damage resist 0..0.5 and hull regen/s */
  armorResist: number;
  armorRegen: number;
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
  /** subclass-verb state (see subclass-verbs.ts). volatileZones are standing DoT pulses dropped by
   * the Void Warlock's Corrosion Field, ticked in stepSim. verbDamageMult/verbIncomingMult are set
   * every frame by Scene.tsx from the live LiveBuild's self-targeted verb (RAGE/OVERSHIELD) since
   * LiveBuild itself has no reference to WorldSim. */
  volatileZones: { x: number; z: number; radius: number; dps: number; until: number }[];
  /** CIPHER Rift Turrets (operator-abilities.ts): temporary deployables, expire on their own */
  riftTurrets: RiftTurret[];
  /** NYX Phase Veil: multiplies enemy sight range (1 = visible), set by Scene each frame */
  stealthMult: number;
  verbDamageMult: number;
  verbIncomingMult: number;
  /** seasons/hazards state (see environment.ts): exposure meters, pending lightning, strike flashes */
  env: EnvState;
  /** thrown stratagem beacons and the detonations Scene drains each frame (ammo refill, sfx, camera punch) */
  beacons: Beacon[];
  /** equipped class backpack (backpacks.ts) — modifies beacon radius and detonation effects */
  backpack: BackpackDef;
  stratagemEvents: StratagemEvent[];
};

/** max ranged machines winding up a shot at the same moment (bosses bypass the cap) */
const MAX_AIMING = 3;

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
  const setDrop = rollSetDrop(m.zone, m.boss ? "BOSS" : m.elite ? "ELITE" : "NORMAL", Math.random()) ?? undefined;
  const scenarioClaim: ScenarioClaim | undefined = m.scenarioId && SCENARIO_LOOT[m.scenarioId] && m.scenarioRun
    ? { scenarioId: m.scenarioId, runId: m.scenarioRun, participated: (m.playerHits ?? 0) >= PARTICIPATION_HITS, rolls: rollScenario(m.scenarioId) }
    : undefined;
  sim.drops.push({ id: sim.nextDropId++, material, amount, enemy: m.profile, ...(setDrop ? { setDrop } : {}), ...(scenarioClaim ? { scenarioClaim } : {}) });
  if (setDrop) alert(sim, `Armor drop — ${setById(setDrop.setId)?.pieces[setDrop.slot] ?? "set piece"}`);
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
  // pooled slots are reused: never let the next occupant inherit this fight's scenario state
  delete m.scenarioId; delete m.gimmickHistory; delete m.attuned; delete m.scenarioRun; delete m.playerHits;
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
    vulnUntil: 0,
    vulnMult: 1,
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
    envVisibility: 1,
    playerNoise: 0,
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
    equippedPerk: undefined,
    nullCharge: { ...INITIAL_NULL_CHARGE },
    nextHitId: 0,
    materials: {}, drops: [], armorResist: 0, armorRegen: 0, enemyShots: [], bossPhaseFlares: [], xpEvents: [], nextDropId: 0,
    emergencyQuest: EMERGENCY_QUEST_INIT,
    bossCounter: counterTuningFor(null),
    volatileZones: [],
    riftTurrets: [],
    stealthMult: 1,
    verbDamageMult: 1,
    verbIncomingMult: 1,
    env: createEnvState(),
    backpack: NO_BACKPACK,
    beacons: Array.from({ length: BEACON_POOL }, () => ({ alive: false, kind: "RESUPPLY" as StratagemId, state: "FLIGHT" as const, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, timer: 0, radius: 0 })),
    stratagemEvents: [],
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
  m.vulnUntil = 0;
  m.vulnMult = 1;
  m.aim = 0;
}

/** Spawn Broken Signal data drones around a point; tagged so the mission can count them. */
export function spawnMissionDrones(sim: WorldSim, x: number, z: number, count: number, elite: boolean) {
  for (let i = 0; i < count; i++) {
    const m = sim.machines.find((e) => !e.alive);
    if (!m) return;
    const a = (i / count) * Math.PI * 2;
    Object.assign(m, { alive: true, x: x + Math.cos(a) * 16, z: z + Math.sin(a) * 16, hp: elite ? 6 : 3, rot: 0, scale: elite ? 1.1 : 0.8, zone: "nexus", cool: elite ? 1.2 : 2.5, elite, profile: elite ? "Data Drone Elite" : "Data Drone Scout", kind: "OVERCLOCKED" as const, drop: "dataShards" as MaterialId, boss: false, kx: 0, kz: 0, mission: true, vulnUntil: 0, vulnMult: 1 });
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
  Object.assign(m, { alive: true, x, z, y: walkHeight(x, z) + 5, hp: 28, maxHp: 28, phase: 0 as BossPhaseIndex, rot: 0, scale: 2.3, zone: regionId, cool: 2, elite: true, boss: true, profile: boss.name, kind: "OVERCLOCKED", drop: boss.drop, kx: 0, kz: 0, poiseState: INITIAL_POISE, scenarioId: undefined, gimmickHistory: undefined, attuned: undefined, scenarioRun: undefined, playerHits: undefined, vulnUntil: 0, vulnMult: 1, ...extra });
  sim.raidFight = { start: performance.now() / 1000, hurt: 0, region: regionId };
  alert(sim, `${boss.name} · ${boss.tell}`);
  return true;
}

/** Spawns a Unique Scenario encounter (unique-scenarios.ts) — a one-off boss with a real gimmick
 * instead of just reskinned stats; see that file for what `scenarioId` changes about combat. */
export function summonScenarioBoss(sim: WorldSim, scenario: UniqueScenario, x: number, z: number, extra?: Partial<Machine>): boolean {
  const m = sim.machines.find((candidate) => !candidate.alive);
  if (!m) return false;
  Object.assign(m, { alive: true, x, z, y: walkHeight(x, z) + 5, hp: 34, maxHp: 34, phase: 0 as BossPhaseIndex, rot: 0, scale: 2.5, zone: scenario.regionId, cool: 2, elite: true, boss: true, profile: scenario.bossName, kind: "ABERRATION", drop: scenario.drop as MaterialId, kx: 0, kz: 0, poiseState: INITIAL_POISE, scenarioId: scenario.id, scenarioRun: `${scenario.id}-${Date.now().toString(36)}-${(sim.nextHitId++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`, playerHits: 0, gimmickHistory: [], attuned: undefined, vulnUntil: 0, vulnMult: 1, ...extra });
  sim.raidFight = { start: performance.now() / 1000, hurt: 0, region: scenario.regionId };
  alert(sim, `${scenario.name} · ${scenario.briefing}`);
  if (scenario.taunt) alert(sim, `${scenario.bossName}: ${scenario.taunt}`);
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
  sim.playerNoise = 1; // gunfire is loud: enemies within hearing range turn toward it
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

/** Subclass-verb pulses (see subclass-verbs.ts). All three are cast from the player's own position
 * at activation time — Scene.tsx calls these right after activateLiveAbility hands back a
 * LiveBuild.pendingVerb, then clears it. */
export function applyVulnPulse(sim: WorldSim, x: number, z: number, radius: number, mult: number, duration: number) {
  const until = performance.now() / 1000 + duration;
  for (const m of sim.machines) {
    if (!m.alive) continue;
    if (Math.hypot(m.x - x, m.z - z) <= radius) { m.vulnUntil = until; m.vulnMult = mult; }
  }
}

export function placeRiftTurret(sim: WorldSim, x: number, z: number, duration: number) {
  sim.riftTurrets = deployRiftTurret(sim.riftTurrets, x, z, performance.now() / 1000, duration);
}

export function applySuppressPulse(sim: WorldSim, x: number, z: number, radius: number, coolAdd: number) {
  for (const m of sim.machines) {
    if (!m.alive) continue;
    if (Math.hypot(m.x - x, m.z - z) <= radius) m.cool = Math.max(m.cool, coolAdd);
  }
}

export function spawnVolatileZone(sim: WorldSim, x: number, z: number, radius: number, dps: number, duration: number) {
  sim.volatileZones.push({ x, z, radius, dps, until: performance.now() / 1000 + duration });
}

/** Throw an armed stratagem beacon from the player's hands along their view direction. */
export function throwBeacon(sim: WorldSim, kind: StratagemId, x: number, y: number, z: number, yaw: number, pitch: number): boolean {
  const b = sim.beacons.find((v) => !v.alive);
  if (!b) return false;
  const speed = 24;
  Object.assign(b, {
    alive: true, kind, state: "FLIGHT" as const,
    x: x + Math.sin(yaw) * 0.8, y, z: z + Math.cos(yaw) * 0.8,
    vx: Math.sin(yaw) * Math.cos(pitch) * speed, vy: Math.sin(pitch) * speed + 7, vz: Math.cos(yaw) * Math.cos(pitch) * speed,
    timer: 6, radius: stratagemById(kind).radius * (kind === "RECON_PULSE" ? sim.backpack.reconRadiusMult : 1),
  });
  return true;
}

function detonateBeacon(sim: WorldSim, b: Beacon, px: number, pz: number) {
  const inRange = (x: number, z: number, pad = 0) => Math.hypot(x - b.x, z - b.z) <= b.radius + pad;
  if (b.kind === "ORBITAL_STRIKE") {
    for (const m of sim.machines) {
      if (!m.alive || !inRange(m.x, m.z, m.scale)) continue;
      m.hp -= m.boss ? 8 : 14;
      if (m.hp <= 0) defeatMachine(sim, m);
    }
    // friendly fire: the strike does not care who is standing in it
    if (inRange(px, pz)) hurtPlayer(sim, 35 * sim.backpack.friendlyFireMult, "Orbital strike (friendly fire)");
  } else if (b.kind === "RECON_PULSE") {
    applyVulnPulse(sim, b.x, b.z, b.radius, sim.backpack.reconVuln, 8);
  } else if (inRange(px, pz)) {
    sim.hp = Math.min(100, sim.hp + 40 * sim.backpack.supplyHealMult);
  }
  sim.stratagemEvents.push({ kind: b.kind, x: b.x, z: b.z, radius: b.radius });
  if (sim.stratagemEvents.length > 12) sim.stratagemEvents.shift();
}

function stepBeacons(sim: WorldSim, dt: number, px: number, pz: number) {
  for (const b of sim.beacons) {
    if (!b.alive) continue;
    if (b.state === "FLIGHT") {
      b.vy -= sim.gravity * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.timer -= dt;
      const ground = heightAt(b.x, b.z) + 0.3;
      if (b.y <= ground) {
        b.y = ground; b.vx = b.vy = b.vz = 0;
        b.state = "ARMED"; b.timer = stratagemById(b.kind).delay;
        alert(sim, `${stratagemById(b.kind).name} beacon down — ${b.timer.toFixed(0)}s`);
      } else if (b.timer <= 0) b.alive = false; // lost in flight (fell out of the world)
    } else if (b.state === "ARMED") {
      b.timer -= dt;
      if (b.timer <= 0) { detonateBeacon(sim, b, px, pz); b.state = "BLAST"; b.timer = BEACON_BLAST_S; }
    } else {
      b.timer -= dt;
      if (b.timer <= 0) b.alive = false;
    }
  }
}

/** A lightning strike (environment.ts) just landed: hurts the player and any machines in its blast.
 * Storms are therefore a tactical tool — luring a squad under a marked strike thins it. */
export function applyLightning(sim: WorldSim, strike: Strike, px: number, pz: number) {
  for (const m of sim.machines) {
    if (!m.alive) continue;
    if (Math.hypot(m.x - strike.x, m.z - strike.z) <= strike.radius + m.scale) {
      m.hp -= STRIKE_MACHINE_DAMAGE;
      if (m.hp <= 0) defeatMachine(sim, m);
    }
  }
  if (Math.hypot(px - strike.x, pz - strike.z) <= strike.radius) hurtPlayer(sim, STRIKE_PLAYER_DAMAGE, "Lightning strike");
}

/** hurt the player and respawn at Nexus when the hull is gone */
export function hurtPlayer(sim: WorldSim, dmg: number, cause: string) {
  // Global Balance Controller (balance.ts): scales every hit the player takes by their own power
  // score before anything else runs — the one place all incoming damage already funnels through.
  // verbIncomingMult (Bulwark Titan's Safe Ground / OVERSHIELD) is set here too since every source
  // of incoming damage — bullets, collisions, hazards — already routes through this one function.
  const scaled = dmg * sim.mods.incomingDamageScale * sim.verbIncomingMult * (1 - Math.min(0.5, Math.max(0, sim.armorResist)));
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
    alert(sim, `Hull destroyed (${cause}) — cargo lost`);
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
  // Scene sets the build-driven squad fields once per frame (after stepSim); keep them across the rebuild
  // so enemy squads actually see the equipped archetype / shield / branch posture.
  const { squadArchetype, rangedHoldFire, branchPosture } = sim.mods;
  sim.mods = { ...adaptationMods(sim.adaptation), squadArchetype, rangedHoldFire, branchPosture };
  if (sim.mods.regen + sim.armorRegen > 0 && sim.hp < 100) sim.hp = Math.min(100, sim.hp + (sim.mods.regen + sim.armorRegen) * dt);

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
  // Attack tickets: at most MAX_AIMING ranged machines may be winding up a shot at once, so a big
  // squad reads as coordinated pressure with readable tells instead of one unreadable volley.
  let aimTickets = 0;
  for (const m of sim.machines) if (m.alive && (m.aim ?? 0) > 0) aimTickets++;
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
    const sight = sightRange(night, sim.envVisibility ?? 1, m.elite) * (sim.stealthMult ?? 1) * (aggro / 70 > 1 ? Math.min(1.6, aggro / 70) : 1);
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
      const move = squadMove(squadRole(i, m.elite, m.boss), d, sim.hp / 100, sim.combatHeat, performance.now() / 1000 + i, sim.mods.squadArchetype, sim.mods.rangedHoldFire, sim.mods.branchPosture);
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
      } else if ((m.aim ?? 0) > 0) {
        // wind-up telegraph (Actors.tsx pulses the machine while aim > 0), then the shot lands
        m.aim = (m.aim ?? 0) - dt;
        if ((m.aim ?? 0) <= 0) {
          m.aim = 0;
          m.cool = (m.boss ? 1.2 : m.elite ? 1.5 : 2.1) * (bossTuning?.cooldownMult ?? 1);
          sim.enemyShots.push({ x: m.x, z: m.z, kind: m.kind, boss: m.boss, elite: m.elite });
          if (sim.enemyShots.length > 24) sim.enemyShots.shift();
          if (Math.random() < 0.25) hurtPlayer(sim, ((m.boss ? 6 : m.elite ? 4 : 2) * (bossTuning?.damageMult ?? 1)) / sim.mods.hullDurability, m.profile);
        }
      } else if (d < 55 && m.cool <= 0 && (m.boss || aimTickets < MAX_AIMING)) {
        // ranged suppressing fire: take a ticket and start the telegraph; elites/bosses wind up faster
        m.aim = m.boss ? 0.2 : m.elite ? 0.28 : 0.4;
        aimTickets++;
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
    // knockback from impacts, damped frame-rate independently
    m.x += m.kx * dt;
    m.z += m.kz * dt;
    m.kx *= Math.exp(-3 * dt);
    m.kz *= Math.exp(-3 * dt);

    // machines collide with world props and with each other
    const hit = collideBody(m, 2.6 * m.scale, speed + Math.hypot(m.kx, m.kz), 1.6);
    if (hit.hit && hit.damage > 6) m.hp -= 1;
    for (let j = i + 1; j < sim.machines.length; j++) {
      const o = sim.machines[j]!;
      if (!o.alive) continue;
      const sx = m.x - o.x;
      const sz = m.z - o.z;
      const dist = Math.hypot(sx, sz) || 0.001;
      const min = 2.8 * m.scale + 2.8 * o.scale;
      if (dist < min) {
        const push = (min - dist) * 0.5;
        m.x += (sx / dist) * push;
        m.z += (sz / dist) * push;
        o.x -= (sx / dist) * push;
        o.z -= (sz / dist) * push;
      }
    }
     if (m.hp <= 0) {
       defeatMachine(sim, m);
      continue;
    }
    m.y = walkHeight(m.x, m.z) + 2.2 * m.scale;
  }

  // ---------- subclass-verb volatile zones (Void Warlock's Corrosion Field, see subclass-verbs.ts) ----------
  if (sim.volatileZones.length) {
    const nowSec = performance.now() / 1000;
    sim.volatileZones = sim.volatileZones.filter((zone) => zone.until > nowSec);
    for (const zone of sim.volatileZones) {
      for (const m of sim.machines) {
        if (!m.alive) continue;
        if (Math.hypot(m.x - zone.x, m.z - zone.z) <= zone.radius) {
          m.hp -= zone.dps * dt;
          if (m.hp <= 0) defeatMachine(sim, m);
        }
      }
    }
  }

  stepBeacons(sim, dt, px, pz);

// stealth: surviving close to hostiles without opening fire
  if (!input.inVehicle && hostileNear > 0 && sim.combatHeat < 2) {
    logBehavior(sim.adaptation, "stealth", dt * 0.8 * hostileNear);
  }

  // ---------- safe-zone stability field ----------
  // enemies can never enter a friendly safe zone: the field shoves them back
  // out across the boundary and burns their armour while they touch it.
  for (const z of sim.zones) {
    const r = z.region;
    if ((r.kind !== "safe" && r.kind !== "starter") || z.owner !== "vanguard") continue;
    for (const m of sim.machines) {
      if (!m.alive) continue;
      const dx = m.x - r.x;
      const dz = m.z - r.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d >= r.radius) continue;
      const push = r.radius - d + 0.5;
      m.x += (dx / d) * push;
      m.z += (dz / d) * push;
      m.kx += (dx / d) * 14;
      m.kz += (dz / d) * 14;
      m.hp -= dt * 6;
      if (m.hp <= 0) {
         defeatMachine(sim, m);
        alert(sim, `${r.name} stability field vaporised a war machine`);
      }
    }
  }

  // ---------- CIPHER rift turrets (temporary, see operator-abilities.ts) ----------
  if (sim.riftTurrets.length) {
    const nowS = performance.now() / 1000;
    sim.riftTurrets = sim.riftTurrets.filter((t) => t.until > nowS);
    for (const rt of sim.riftTurrets) {
      const hit = stepRiftTurret(rt, sim.machines, dt);
      const target = hit >= 0 ? sim.machines[hit] : undefined;
      if (target) {
        target.hp -= RIFT_TURRET_DAMAGE;
        const dx = target.x - rt.x, dz = target.z - rt.z, d = Math.hypot(dx, dz) || 1;
        target.kx += (dx / d) * 2;
        target.kz += (dz / d) * 2;
        if (target.hp <= 0) { defeatMachine(sim, target); alert(sim, "Rift Turret neutralized a hostile"); }
      }
    }
  }

  // ---------- perimeter defence turrets ----------
  for (const tur of sim.turrets) {
    tur.flash = Math.max(0, tur.flash - dt * 3);
    tur.cool -= dt;
    let best: Machine | null = null;
    let bestD = tur.range;
    for (const m of sim.machines) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - tur.x, m.z - tur.z);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    if (!best) continue;
    tur.rot = Math.atan2(best.x - tur.x, best.z - tur.z);
    if (tur.cool > 0) continue;
    tur.cool = 0.9;
    tur.flash = 1;
    best.hp -= 2;
    // knock the attacker away from the perimeter
    const dx = best.x - tur.x;
    const dz = best.z - tur.z;
    const d = Math.hypot(dx, dz) || 1;
    best.kx += (dx / d) * 8;
    best.kz += (dz / d) * 8;
    if (best.hp <= 0) {
       defeatMachine(sim, best);
      alert(sim, "Safe-zone turret destroyed an ambusher");
    }
  }

  // ---------- convoys: lane following with headway control ----------
  for (const tr of sim.trucks) {
    if (!tr.alive) continue;
    const lane = sim.lanes[tr.lane]!;

    // --- simulation LOD for logistics: distant convoys move abstractly ---
    const convoyTier: SimTier = getSimulationTier(tr.x, tr.z, px, pz);
    const convoyTick = shouldTick(convoyTier, sim.stats.frame);
    countEntity(sim.stats, convoyTier, convoyTick);
    if (convoyTier >= 2) {
      if (!convoyTick) continue;
      const sdt = tierDt(convoyTier, dt);
      tr.speed = 0.035 * sim.adaptation.influence.logisticsEfficiency;
      tr.wait = Math.max(0, tr.wait - sdt);
      if (tr.wait <= 0) tr.t += sdt * tr.speed * tr.dir;
      if (tr.t > 0.9) {
        tr.t = 0.1;
        tr.wait = 6;
      }
      if (tr.t < 0.1) {
        tr.t = 0.9;
        tr.wait = 6;
      }
      const abstract = laneLanePoint(lane, tr.t, tr.dir > 0 ? 3.2 : -3.2);
      tr.rot = Math.atan2(abstract.x - tr.x, abstract.z - tr.z) || tr.rot;
      tr.x = abstract.x;
      tr.z = abstract.z;
      tr.y = walkHeight(abstract.x, abstract.z) + 1.6;
      continue;
    }

    // keep a safe gap to the truck ahead on the same lane and heading
    let headway = 1;
    for (const other of sim.trucks) {
      if (other === tr || !other.alive || other.lane !== tr.lane || other.dir !== tr.dir) continue;
      let gap = (other.t - tr.t) * tr.dir;
      if (gap < 0) gap += 1;
      if (gap < 0.07) headway = Math.min(headway, Math.max(0, (gap - 0.025) / 0.045));
    }
    // junction yield: brake for any truck crossing close ahead, whatever lane
    for (const other of sim.trucks) {
      if (other === tr || !other.alive) continue;
      const dx = other.x - tr.x;
      const dz = other.z - tr.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 16) continue;
      const ahead = dx * Math.sin(tr.rot) + dz * Math.cos(tr.rot);
      if (ahead <= 0) continue;
      // both brake, but the higher-index truck keeps more distance so the
      // pair never deadlocks: the lower-index truck clears the junction first
      const keep = sim.trucks.indexOf(tr) > sim.trucks.indexOf(other) ? 10 : 6;
      headway = Math.min(headway, Math.max(0, (dist - keep) / 6));
    }

    // break a rare standoff: only the highest-priority stalled truck rolls on
    tr.stalled = tr.speed < 0.004 ? tr.stalled + dt : 0;
    if (tr.stalled > 4 && !sim.trucks.some((o) => o.alive && o !== tr && o.stalled > tr.stalled)) {
      headway = Math.max(headway, 0.35);
    }

    // holding at a depot gate: convoys wait for the player before rolling out,
    // and while parked inside the safe zone the defences cover them
    if (tr.wait > 0) {
      tr.wait -= dt;
      const playerNear = Math.hypot(px - tr.x, pz - tr.z) < 26;
      if (playerNear) tr.wait = Math.max(tr.wait, 0.6);
      headway = 0;
    }

    // ease toward the target lane speed so trucks brake smoothly
    const target = 0.035 * headway * sim.adaptation.influence.logisticsEfficiency;
    tr.speed += (target - tr.speed) * (1 - Math.exp(-3 * dt));

    const side = tr.dir > 0 ? 3.2 : -3.2;
    const prev = laneLanePoint(lane, tr.t, side);
    tr.t += dt * tr.speed * tr.dir;
    // loop between the depot gates, staying clear of the hub centres
    if (tr.t > 0.9) {
      tr.t = 0.1;
      tr.wait = 6;
    }
    if (tr.t < 0.1) {
      tr.t = 0.9;
      tr.wait = 6;
    }
    const now = laneLanePoint(lane, tr.t, side);
    tr.x = now.x;
    tr.z = now.z;
    tr.y = walkHeight(now.x, now.z) + 1.6;
    if (Math.hypot(now.x - prev.x, now.z - prev.z) > 0.0001) {
      tr.rot = Math.atan2(now.x - prev.x, now.z - prev.z);
    }
  }

  // only revive a truck when its lane+direction corridor is free
  // hard non-penetration: back the lower-priority truck off its route
  for (let i = 0; i < sim.trucks.length; i++) {
    const a = sim.trucks[i]!;
    if (!a.alive) continue;
    for (let j = i + 1; j < sim.trucks.length; j++) {
      const b = sim.trucks[j]!;
      if (!b.alive) continue;
      if (Math.hypot(a.x - b.x, a.z - b.z) >= 7) continue;
      const lane = sim.lanes[b.lane]!;
      const side = b.dir > 0 ? 3.2 : -3.2;
      for (let k = 0; k < 6; k++) {
        b.t -= b.dir * 0.003;
        if (b.t > 1) b.t -= 1;
        if (b.t < 0) b.t += 1;
        const p = laneLanePoint(lane, b.t, side);
        b.x = p.x;
        b.z = p.z;
        b.y = walkHeight(p.x, p.z) + 1.6;
        if (Math.hypot(a.x - b.x, a.z - b.z) >= 7) break;
      }
      b.speed = 0;
      b.stalled += 0.2;
    }
  }

  const dead = sim.trucks.filter(
    (x) => !x.alive && !sim.trucks.some((o) => o.alive && o.lane === x.lane && o.dir === x.dir),
  );
  if (dead.length && Math.random() < 0.08 * dt * dead.length) {
    const tr = dead[0]!;
    tr.alive = true;
    tr.hp = 3;
    tr.t = tr.dir > 0 ? 0.1 : 0.9;
    tr.speed = 0.01;
    tr.wait = 4;
    tr.cargo = 1 + Math.floor(Math.random() * 3);
  }

  // ---------- unique-scenario attunement (Hollow Saint): announce each change so the player can swap element ----------
  for (const m of sim.machines) {
    if (!m.alive || !m.scenarioId || scenarioById(m.scenarioId)?.gimmick !== "attune") continue;
    const now = attunedElement(performance.now() / 1000);
    if (m.attuned !== now) { m.attuned = now; alert(sim, `${m.profile} attunes to ${now} — match it`); }
  }

  // ---------- bullets ----------
  for (const b of sim.bullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    if (b.y < heightAt(b.x, b.z) + 0.35) {
      b.alive = false;
      continue;
    }
    if (b.life <= 0) {
      b.alive = false;
      continue;
    }
    // bullets chip world cover too
    const cover = collideBody(b, 0.4, 130, 0.25);
    if (cover.hit) {
      b.alive = false;
      continue;
    }
    for (const m of sim.machines) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - b.x, m.z - b.z) < 3.4 * m.scale) {
        b.alive = false;
        let dmg = sim.mods.bulletDamage * b.dmg * sim.verbDamageMult;
        if (sim.equippedElement !== "KINETIC") dmg += 0.35;
        if (m.vulnUntil > performance.now() / 1000) dmg *= m.vulnMult;
        if (m.boss) {
          const nowSec = performance.now() / 1000;
          if (!m.poiseState) m.poiseState = INITIAL_POISE;
          const result = hitPoise(m.poiseState, dmg * 9, nowSec);
          m.poiseState = result.state;
          let mult = result.damageMult;
          // Unique Scenario gimmick: near-immune outside the weak-point/stagger window it just got
          if (m.scenarioId && mult === 1) mult = scenarioById(m.scenarioId)?.outsideWindowMult ?? 1;
          dmg *= mult;
          if (m.scenarioId) {
            const g = gimmickMultiplier(scenarioById(m.scenarioId)?.gimmick, { element: sim.equippedElement, nowSec, distance: Math.hypot(m.x - px, m.z - pz), history: m.gimmickHistory ?? [] });
            m.gimmickHistory = g.history;
            dmg *= g.mult;
            m.playerHits = (m.playerHits ?? 0) + 1;
          }
        }
        m.hp -= dmg;
        if (sim.equippedPerk === NULL_PERK) {
          // timed = interrupting a wind-up, or hitting a boss while its weak-point/stagger window is open
          const nowS = performance.now() / 1000;
          const timed = (m.aim ?? 0) > 0 || (!!m.poiseState && (isWeakPointOpen(m.poiseState, nowS) || isStaggered(m.poiseState, nowS)));
          const r = registerNullHit(sim.nullCharge, { now: nowS, timed, eventId: sim.nextHitId++ });
          sim.nullCharge = r.state;
          if (r.pulse) {
            for (const other of sim.machines) {
              if (!other.alive || Math.hypot(other.x - m.x, other.z - m.z) > NULL_PULSE_RADIUS) continue;
              other.cool = Math.max(other.cool, NULL_PULSE_STUN_SECONDS);
              if (other.boss) other.poiseState = hitPoise(other.poiseState ?? INITIAL_POISE, NULL_PULSE_POISE, nowS).state;
            }
            alert(sim, "NULL DISRUPTION — pulse released");
          }
        }
        if (sim.equippedElement === "CRYO" || sim.equippedElement === "ARC") m.cool = Math.max(m.cool, sim.equippedElement === "CRYO" ? 0.9 : 0.6);
        sim.lastHit = performance.now();
        logBehavior(sim.adaptation, "combat", 1);
        // knockback impulse from the hit direction
        m.kx += b.vx * 0.06 * b.knock;
        m.kz += b.vz * 0.06 * b.knock;
        sim.combatHeat += 1.5;
         defeatMachine(sim, m);
        break;
      }
    }
    if (!b.alive) continue;
    for (const tr of sim.trucks) {
      if (!tr.alive) continue;
      if (Math.hypot(tr.x - b.x, tr.z - b.z) < 3.6) {
        b.alive = false;
        tr.hp -= sim.mods.bulletDamage;
        logBehavior(sim.adaptation, "combat", 1);
        if (tr.hp <= 0) {
          tr.alive = false;
          sim.cargo += tr.cargo;
          logBehavior(sim.adaptation, "logistics", tr.cargo * 2);
          directorEvent(sim.director, { type: "CARGO", amount: tr.cargo });
          alert(sim, `Convoy ambushed — ${tr.cargo} crate${tr.cargo > 1 ? "s" : ""} seized`);
          dropLoot(sim, sim.zones.find((z) => Math.hypot(tr.x - z.region.x, tr.z - z.region.z) < z.region.radius), "CONVOY");
        }
        break;
      }
    }
  }

  for (const it of sim.loot) it.life -= dt;
  sim.loot = sim.loot.filter((it) => it.life > 0);

  // ---------- extraction ----------
  const nexus = byId("nexus");
  if (sim.cargo > 0 && Math.hypot(px - nexus.x, pz - nexus.z) < nexus.radius * 0.55) {
    const paid = Math.round(sim.cargo * 120 * sim.mods.cargoValue * sim.adaptation.influence.logisticsEfficiency);
    sim.credits += paid;
    sim.extractions += sim.cargo;
    logBehavior(sim.adaptation, "logistics", sim.cargo * 3);
    sim.cargo = 0;
    sim.hp = Math.min(100, sim.hp + 35);
    alert(sim, `Extraction complete  +${paid} cr`);
  }

  // ---------- AI mission director ----------
  const playerZone = sim.zones.find((z) => Math.hypot(px - z.region.x, pz - z.region.z) < z.region.radius);
  const before = sim.director.completed;
  directorTick(
    sim.director,
    {
      dt,
      combatHeat: sim.combatHeat,
      playerRegionId: playerZone?.region.id ?? "wastelands",
      contestedZones,
      instability: playerInstability,
      night,
      coreHp: sim.coreHp,
      hostileNear,
    },
    {
      alert: (text) => alert(sim, text),
      spawnWave: (regionId, count, elite) => {
        const zone = sim.zones.find((z) => z.region.id === regionId) ?? sim.zones[0]!;
        for (let i = 0; i < count; i++) spawnMachine(sim, zone, elite);
      },
    },
  );
  if (sim.director.completed > before) {
    const paid = sim.director.missions.find((m) => m.state === "COMPLETED")?.reward ?? 0;
    sim.credits += paid;
  }

  endStats(sim.stats, performance.now() - t0);

  return { playerInstability };
}
