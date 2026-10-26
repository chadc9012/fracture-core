import { stormGroundAt } from "./storm-quests";
import { liveDescentGroundAt } from "./fracture-gates";
import { emptyChainState, registerChainHit, resolveChainDamage, type ChainState, type ChainReaction } from "./legendary-chain";
import { rollSetDrop, setById, type SetDrop } from "./armor-sets";
import { stratagemById, type StratagemId } from "./stratagems";
import { NO_BACKPACK, type BackpackDef } from "./backpacks";
import { createEnvState, STRIKE_MACHINE_DAMAGE, STRIKE_PLAYER_DAMAGE, type EnvState, type Strike } from "./environment";
import { squadMove, squadRole } from "./enemy-intelligence";
import { drivePattern } from "./pattern-drive";
import { createAi, pickCover, shouldTakeCover, sightRange, stepAwareness, type EnemyAi } from "./enemy-perception";
import { enemyHitChance, sightLine } from "./line-of-sight";
import { DIVE, diveDirection, FLEE, fleeDirection, reactsInTime, roundThreat } from "./enemy-evasion";
import { FLANK_AFTER, FLANK_GIVE_UP, findFlankSpot, GRENADE, GRENADE_AFTER, grenadeDamage, lobVelocity, MAX_FLANKERS, stepGrenade, throwsGrenades, type Grenade } from "./enemy-tactics";
import { freshGadgets, GADGET, inCaltrops, inFlames, droneTarget, mineTriggered, slowFor, spoofed, stepDrone, stepFlares, type GadgetState } from "./vehicle-gadgets";
import { COVER_CHEST, COVER_HOLD, coverCandidates, coverPhase, findCover, HIDE_SECONDS } from "./enemy-cover";
import { registeredModelSolids } from "./environment-collision";
/** seconds between line-of-sight refreshes per machine */
const LOS_REFRESH = 0.25;
import type { AbilityEvent } from "./ability-effects";
import { RIFT_TURRET_DAMAGE, deployRiftTurret, stepRiftTurret, type RiftTurret } from "./operator-abilities";
import { REGIONS, type Region } from "./world";
import { heightAt, smoothstep, walkHeight, WATER_LEVEL } from "./terrain";
import { LANES, laneLanePoint, laneSamples, type Lane } from "./lanes";
import { collideBody, queryObstacles } from "./obstacles";
import { collideWalls } from "./walls";
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
import type { LootItem } from "./loot";
import {
  createDirector,
  directorEvent,
  directorTick,
  type Director,
} from "./director";
import { createSquad, stepSquad, type SquadState } from "./squad";
import { absorbTitanDamage, createTitanState, tickTitan, type TitanState } from "./titan";
import { encounterFor, factionOf, troopFor } from "./encounters";
import { ENEMY_TUNING, aggroRadius, rangedCooldownFor, trooperSpeed, windupFor } from "./enemy-tuning";
import type { MaterialId } from "./inventory";
import type { GearItem } from "./inventory";
import { phaseForHpFraction, tuningFor, type BossPhaseIndex } from "./boss-phases";
import { decayPoise, hitPoise, INITIAL_POISE, isStaggered, isWeakPointOpen, openWeakPoint, type PoiseState, BOSS_HP, POISE_PER_DAMAGE, BOSS_KNOCK_MASS } from "./boss-poise";
import { counterTuningFor, type CounterTuning } from "./boss-adaptive-ai";
import { completeEmergencyQuest, EMERGENCY_QUEST_INIT, stepEmergencyQuest, type EmergencyQuest } from "./emergency-quest";
import { scenarioById, scenarioFor, type UniqueScenario } from "./unique-scenarios";
import { INITIAL_MAW, MAW_PERK, mawEffect, registerMawHit, type MawState } from "./maw-collapse";
import { INITIAL_NULL_CHARGE, NULL_PERK, NULL_PULSE_POISE, NULL_PULSE_RADIUS, NULL_PULSE_STUN_SECONDS, registerNullHit, type NullChargeState } from "./null-disruption";
import { ENCOUNTERS } from "./scenario-encounters";
import { encounterHpFloor, endEncounter, onDecoyShattered, resetEncounters, pinSummons, stepEncounters, type EncounterEvent, type EncounterState, type EncounterZone } from "./encounter-sim";
import { rollWeaponLoot } from "./weapon-loot";
import { isStaggeredNow, reactTo, hitPart } from "./enemy-reactions";
import { enemyPower, hitMultiplier, powerScale } from "./weapon-meta";
import type { WeaponId } from "./weapons";
import type { ClassId } from "./loadout";
import { PARTICIPATION_HITS, SCENARIO_LOOT, rollScenario, type ScenarioClaim } from "./scenario-loot";
import { attunedElement, gimmickMultiplier, type DamageElement } from "./scenario-gimmicks";
import { fireRound, splashDamage, stepRound, type Burst, type OrdnanceDef, type Round } from "./ordnance";
import { LAUNCHERS, pickLockTarget, type LauncherId } from "./launchers";
import { ABILITY_RULES, burstTargets, evolutionDamageMult, freshCharge, registerEvolutionHit, ruinElementOf, type EvolutionAbility, type EvolutionCharge } from "./weapon-evolution";
import { stepHealth } from "./health";
import { FOUNDRY_RULES, type FoundryId } from "./foundries";
import { AWAKENED_MULT, DEVOUR_EVERY, DEVOUR_MULT, NO_RUNES, REAP_HEAL, RIFT_MULT, WARD_MULT, type RuneCombat } from "./godforge";
import { nemesisStats, WEAK_ELEMENT, type KillerSnapshot, type Nemesis } from "./nemesis";
import { bloodOf, critterBlood, GORE_LOG, emptyGoreEvent, type GoreCause, type GoreEvent } from "./gore";
import { applyElementHit, isChilled, burnDamage, freshStatuses, mergeVuln, statusSpeedMult, type MachineStatuses } from "./weapon-elements";

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
  /** enemy-evasion.ts: diving out of a rocket's blast or running out of a strike circle (no shooting meanwhile); when it may dive again; the last strike beacon it rolled to notice */
  evade?: { vx: number; vz: number; start: number; until: number; dive: boolean } | undefined;
  evadeCool?: number | undefined;
  /** pattern-drive.ts: the wind-up this machine is showing right now (a ring or a charge lane), for the ground telegraph */
  patternTell?: { kind: "RING" | "LANE"; x: number; z: number; radius: number; width: number; progress: number } | undefined;
  strikeSeen?: string | undefined;
  /** enemy-tactics.ts: seconds the player has been out of this machine's sight while it is alert; a flank it is running; when it may throw again */
  hiddenFor?: number | undefined;
  flank?: { x: number; z: number; until: number } | undefined;
  grenadeAt?: number | undefined;
  /** vehicle gadgets (vehicle-gadgets.ts): caltrops and EMP mines slow it to snareMult until snareUntil */
  snareUntil?: number | undefined;
  snareMult?: number | undefined;
  /** line of sight to the player (line-of-sight.ts), refreshed a few times a second: clear, or where it is blocked */
  los?: { t: number; clear: boolean; at?: { x: number; y: number; z: number } | undefined } | undefined;
  /** gore presentation only (gore.ts): direction, cause and size of the last hit, read when the machine dies */
  goreHit?: { dx: number; dz: number; dmg: number; cause: GoreCause; y: number } | undefined;
  /** crucible.ts: a rival operator in a Crucible match (renders as that operator; kills score the match, no loot) */
  rival?: "TITAN" | "HUNTER" | "WARLOCK" | undefined;
  /** performance.now()/1000 of the last damage the PLAYER (or the player's own abilities/vehicle/stratagems) dealt; environmental deaths only pay if this is recent */
  lastPlayerDamage?: number;
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
  kind: "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD" | "SKYBORN" | "GUARDIAN" | "ABYSSAL";
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
  /** underwater (Thalassia) machines hold this world-y instead of riding the surface; cleared when the slot is freed */
  swimY?: number | undefined;
  /** scenario gimmick bookkeeping (scenario-gimmicks.ts): recent hit elements, and the attunement last announced */
  gimmickHistory?: DamageElement[];
  attuned?: DamageElement;
  /** scenario run id (unique per summon) and how many player bullets landed on it — the basis of reward eligibility */
  scenarioRun?: string;
  /** seconds clock and death count at summon (scenario claims report elapsed/deaths) */
  scenarioT0?: number;
  scenarioDeaths0?: number;
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
  /** Unique Scenario encounter director state (encounter-sim.ts): phase, attack state machine, arena centre */
  encounter?: EncounterState | undefined;
  /** Hollow Saint false copy: inert, shatters without kills/credit/loot (encounter-sim.ts) */
  decoy?: boolean | undefined;
  /** called in by an encounter boss (encounter-sim.ts SUMMON): ordinary hostile troops that vanish when the fight ends */
  summoned?: boolean | undefined;
  /** Living World event id (living-events.ts) this machine belongs to; never leashed away, cleared when the slot is freed */
  living?: string | undefined;
  /** nemesis.ts: this machine is a nemesis (id), its weak element and its damage multiplier; cleared when the slot is freed */
  nemesis?: string | undefined;
  nemesisWeak?: DamageElement | undefined;
  nemesisDamage?: number | undefined;
  /** enemy-reactions.ts: the live flinch/stagger from the last confirmed hit (cleared when the slot respawns) */
  react?: import("./enemy-reactions").Reaction | undefined;
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
  /** set only by weapons that carry an element (Pulse, Heavy): drives on-hit status and the gimmick element; undefined = legacy behaviour */
  element?: DamageElement | undefined;
  /** gore presentation only: a shotgun pellet tears, a single round punches */
  cause?: GoreCause | undefined;
  /** weapon-meta.ts: the on-foot gun that fired it (range band, precision, class affinity) and where it left the barrel; unset for vehicle guns */
  weapon?: WeaponId | undefined;
  ox?: number | undefined;
  oz?: number | undefined;
};
export type BulletHit = "ground" | "cover" | "machine" | "truck" | "water";
/** presentation log of where bullets struck (a fixed ring, IMPACT_LOG slots; impact effects read it, combat never does) */
export type ImpactEvent = { id: number; x: number; y: number; z: number; kind: BulletHit; vx: number; vz: number };
export const IMPACT_LOG = 32;
export function logImpact(sim: WorldSim, b: Pick<Bullet, "x" | "y" | "z" | "vx" | "vz">, kind: BulletHit) {
  const id = sim.nextImpactId++;
  const e = sim.impacts[id % IMPACT_LOG]!;
  e.id = id; e.x = b.x; e.y = b.y; e.z = b.z; e.kind = kind; e.vx = b.vx; e.vz = b.vz;
}

/** presentation log for gore.ts: what bled, where, which way and how hard (combat never reads it) */
export function logGore(sim: WorldSim, e: Omit<GoreEvent, "id">) {
  const id = sim.nextGoreId++;
  const slot = sim.gore[id % GORE_LOG]!;
  Object.assign(slot, e, { id });
  if (!e.body) slot.body = undefined;
  if (!e.critter) slot.critter = undefined;
}
/** remember how a machine was just hurt (for its gore, and how its body falls if this hit kills it) */
export function markGoreHit(sim: WorldSim, m: Machine, dx: number, dz: number, dmg: number, cause: GoreCause, y = m.y - 2.2 * m.scale + 1.25 * enemyBodyScaleOf(m.scale), hitLog = true) {
  const d = Math.hypot(dx, dz) || 1;
  m.goreHit = { dx: dx / d, dz: dz / d, dmg, cause, y };
  // blasts, blades, rams and abilities make the body react too (bullets react in the bullet loop, which also staggers);
  // presentation only here: the gore damage numbers are inflated, so no stun comes from this
  if (cause !== "BULLET" && cause !== "PELLET" && m.hp > 0 && !m.rival && !m.decoy) {
    const prev = m.react;
    const r = reactTo(prev, { damage: dmg / 2, maxHp: m.maxHp ?? (m.elite ? 7 : 3.5), elite: m.elite, boss: m.boss, now: performance.now() / 1000, dx, dz, part: cause === "BLAST" ? "TORSO" : hitPart(y, m.y - 2.2 * m.scale, 1.85 * enemyBodyScaleOf(m.scale)) });
    if (r && r !== prev) m.react = r;
  }
  if (hitLog && m.hp > 0 && !m.decoy) logGore(sim, { kind: "HIT", blood: bloodOf(m), cause, x: m.x - (dx / d) * 0.3 * m.scale, y, z: m.z - (dz / d) * 0.3 * m.scale, dx: dx / d, dz: dz / d, power: Math.min(1, dmg / Math.max(0.5, m.maxHp ?? (m.elite ? 7 : 3.5))), size: enemyBodyScaleOf(m.scale) });
}
/** the bullet hit-cylinder of a machine: feet (the ground under it, or its swim depth), top and radius */
function bodySpan(m: Machine): { feet: number; top: number; r: number } {
  const feet = m.swimY !== undefined ? m.y - 2.2 * m.scale : Math.max(walkHeight(m.x, m.z), m.y - 2.2 * m.scale);
  return { feet: feet - 0.2, top: feet + 2.05 * enemyBodyScaleOf(m.scale) + 0.35, r: Math.max(1, 1.5 * m.scale) };
}
function bodyOnPath(sim: WorldSim, b: Bullet, dt: number): boolean {
  for (const m of sim.machines) {
    if (!m.alive) continue;
    const c = bodySpan(m);
    if (segmentHitsBody(b.x - b.vx * dt, b.y - b.vy * dt, b.z - b.vz * dt, b.x, b.y, b.z, m.x, m.z, c.r, c.feet, c.top) >= 0) return true;
  }
  return false;
}
/** first point (0..1 along the segment a->b) inside the vertical cylinder at (cx, cz), radius r, from y0 to y1; -1 if none */
export function segmentHitsBody(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cz: number, r: number, y0: number, y1: number): number {
  const dx = bx - ax, dz = bz - az, fx = ax - cx, fz = az - cz;
  const A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - r * r;
  let t0: number, t1: number;
  if (A < 1e-9) { if (C > 0) return -1; t0 = 0; t1 = 1; }
  else {
    const disc = B * B - 4 * A * C;
    if (disc < 0) return -1;
    const q = Math.sqrt(disc);
    t0 = (-B - q) / (2 * A); t1 = (-B + q) / (2 * A);
  }
  const lo = Math.max(0, t0), hi = Math.min(1, t1);
  if (lo > hi) return -1;
  // clip [lo, hi] to the cylinder's height span
  const dy = by - ay;
  let a = lo, b = hi;
  if (Math.abs(dy) < 1e-9) { if (ay < y0 || ay > y1) return -1; }
  else {
    const ta = (y0 - ay) / dy, tb = (y1 - ay) / dy;
    a = Math.max(a, Math.min(ta, tb)); b = Math.min(b, Math.max(ta, tb));
  }
  return a <= b ? a : -1;
}
/** on-screen bulk of a machine (enemy-visuals.ts enemyBodyScale, repeated so the sim does not import presentation data) */
const enemyBodyScaleOf = (simScale: number) => 1 + (simScale - 1) * 0.35;

/** a launcher round in flight (ordnance.ts rules) plus what the burst needs; pooled, never allocated per frame */
export type SimRound = Round & { launcher: LauncherId; element: DamageElement; /** index into sim.machines for guided rounds, -1 = unguided */ target: number; knock: number };
/** presentation log of rocket detonations (CombatFx reads it; it never decides anything) */
export type BurstEvent = { id: number; x: number; y: number; z: number; radius: number; element: DamageElement; launcher: LauncherId; /** draw style override (an EMP mine is ARC blue) */ fx?: "ARC" | "FIRE" | "BALLISTIC" | undefined };
const ROUND_POOL = 12;
const NO_ORDNANCE: OrdnanceDef = { id: "none", kind: "ROCKET", name: "", speed: 0, turnRate: 0, life: 0, splashRadius: 0, damage: 0, proximity: 0, domain: "ANY", fits: [] };

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
  /** Crucible: rival operators the player has eliminated (crucible.ts) */
  rivalKills: number;
  /** activities.ts: tiered kill counters */
  eliteKills: number;
  bossKills: number;
  extractions: number;
  director: Director;
  /** impact damage cooldown so one obstacle cannot drain the hull */
  impactCool: number;
  /** rolling combat activity used for pacing */
  combatHeat: number;
  /** Living World: player kills per event id (living-events.ts reads this to decide who won) */
  livingKills: Record<string, number>;
  /** small player sanctuaries beyond the region safe zones (Vael's opened forge, owned garage bases): hostiles are pushed out, the player heals as in a safe zone */
  sanctuaries: { x: number; z: number; radius: number }[];
  /** foundries.ts: the equipped weapon's foundry (set by Scene) and the monoblade deflect window (performance.now()/1000) */
  foundry: FoundryId | null;
  deflectUntil: number;
  /** nemesis.ts: the machine that last hit the player, deaths it caused, and nemesis kills/escapes for Scene to report */
  lastHitBy: KillerSnapshot | null;
  deathEvents: { killer: KillerSnapshot; at: number }[];
  nemesisEvents: { id: string; killed: boolean }[];
  /** star-map challenge (map-activities.ts CHALLENGES), set by Scene from the save: enemy health and damage multipliers */
  challenge: { enemyHp: number; enemyDamage: number };
  /** AI squadmates (squad.ts): formation + support fire, presentation in Squad.tsx */
  squad: SquadState;
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
  /** seconds (performance clock) of the last damage taken; health.ts regen waits on it */
  lastDamageAt: number;
  /** set by Scene each frame: standing in a safe zone (fast recovery) */
  inSafeZone: boolean;
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
  /** evolved-weapon ability in hand (set each frame by Scene) and its hit counter (weapon-evolution.ts) */
  equippedEvolution: EvolutionAbility | undefined;
  evoCharge: EvolutionCharge;
  /** godforge.ts: the Godforged relic in hand (set each frame by Scene) with one hit counter per burst rune and the Devour counter */
  runes: RuneCombat & { charges: EvolutionCharge[]; devourHits: number };
  nullCharge: NullChargeState;
  maw: MawState;
  mawCollapse: { id: number; x: number; z: number; at: number } | null;
  /** last released Null Disruption pulse (id increments per pulse); Scene/NullPulseFx read it, never write it */
  nullPulse: { id: number; x: number; z: number; radius: number; at: number } | null;
  nextHitId: number;
  /** Per-simulation combo ledger. Damage and defeats still use the normal simulation pipeline. */
  chainState: ChainState;
  /** legendary-chain hit ids; separate from nextHitId, which belongs to the Null Disruption ledger */
  nextChainHitId: number;
  lastChainReaction: ChainReaction | null;
  /** Unique Scenario encounters (encounter-sim.ts): live hazard zones and a presentation event log. Presentation reads, never writes. */
  encounterZones: EncounterZone[];
  encounterEvents: EncounterEvent[];
  nextEncounterEventId: number;
  nextEncounterZoneId: number;
  /** launcher rounds, element statuses per machine (weapon-elements.ts) and the detonation log */
  rounds: SimRound[];
  statuses: Map<Machine, MachineStatuses>;
  burstEvents: BurstEvent[];
  /** evolved-ability bursts for presentation (CombatFx reads, never decides) */
  evoBursts: { id: number; x: number; y: number; z: number; ability: EvolutionAbility; at: number }[];
  nextBurstId: number;
  /** bullet impact ring (presentation only, see logImpact) */
  impacts: ImpactEvent[];
  nextImpactId: number;
  /** gore presentation ring (gore.ts / GoreFx.tsx read it; combat never does) */
  gore: GoreEvent[];
  nextGoreId: number;
  /** live wildlife the bullets can strike (published by Wildlife.tsx each frame; presentation creatures, not combat targets) */
  fauna: { id: string; x: number; y: number; z: number; r: number; species: string }[];
  /** critters struck since Wildlife last read them */
  faunaHits: string[];
  /** 0..1 on-foot speed multiplier from slowing zones this step (Scene applies it) */
  hazardSpeedMult: number;
  materials: Partial<Record<MaterialId, number>>;
  drops: { id: number; material: MaterialId; amount: number; enemy: string; /** armor-sets.ts: a set piece this kill dropped */ setDrop?: SetDrop; /** scenario-loot.ts: signature reward claim for a valid Unique Scenario clear */ scenarioClaim?: ScenarioClaim; /** weapon-loot.ts: a real weapon item this kill dropped */ weaponDrop?: GearItem }[];
  /** equipped armor-set bonuses (armor-sets.ts), written by Scene each frame: damage resist 0..0.5 and hull regen/s */
  armorResist: number;
  armorRegen: number;
  consumableDamageMult: number;
  /** enemy gunfire this frame, consumed by the audio layer */
  enemyShots: { x: number; z: number; kind: string; boss: boolean; elite: boolean; /** region the shooter stands in (presentation: elemental flights) */ zone: string; /** sim.machines index (presentation: fire from that enemy's held gun) */ slot?: number; /** did it hit the player; where cover took it (line-of-sight.ts) */ hit?: boolean; blockAt?: { x: number; y: number; z: number } }[];
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
  /** vehicle gadgets (vehicle-gadgets.ts): mines, caltrops, drones, flares, flame jets, ram multipliers */
  gadgets: GadgetState;
  /** enemy grenades in flight or on the ground (enemy-tactics.ts), and the squad cooldown between throws */
  grenades: Grenade[];
  grenadeCool: number;
  nextGrenadeId: number;
  /** ability-effects.ts: stable outcome log (activation / rejection / cancellation) consumed by HUD, animation and VFX; never written by presentation */
  abilityEvents: AbilityEvent[];
  nextAbilityEventId: number;
  /** seconds of full damage immunity (Rift Dash) and of the Bastion Shield barrier; both zero on death */
  iframes: number;
  /** 0..1 damage reduction while an Operator dash (GOLIATH Bulwark Rush) is active; set by Scene each frame */
  dashResist: number;
  /** Dragonhide resistance from dragonite-cast.ts (already capped there) */
  dragoniteResist: number;
  barrierTime: number;
  /** performance.now() of the last hit the iframes/barrier absorbed (HUD feedback) */
  lastBlockedAt: number;
  /** NYX Phase Veil: multiplies enemy sight range (1 = visible), set by Scene each frame */
  stealthMult: number;
  verbDamageMult: number;
  verbIncomingMult: number;
  /** weapon-meta.ts, set by Scene each frame: the build's damage (ability synergy x momentum, on top of the skill tree's
   * mods.bulletDamage), the operator's power level (null = untracked: no power scaling) and class (signature weapons) */
  buildDamage: number;
  operatorPower: number | null;
  operatorClass: ClassId | null;
  /** performance.now() of the player's last precision (head-band) hit: the gold hit marker and tick */
  lastCrit: number;
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

/** the HUD loot feed: only items the player keeps (weapon and armor drops that claimDrops saves). It used to show a separately
 * generated "AI drop" per kill, plus guaranteed EXOTIC raid drops on bosses, none of which ever reached the inventory. */
function feedEntry(gear: Pick<GearItem, "name" | "power" | "rarity" | "slot">): LootItem {
  const rarity: LootItem["rarity"] = gear.rarity ?? (gear.power >= 300 ? "LEGENDARY" : gear.power >= 250 ? "EPIC" : gear.power >= 180 ? "RARE" : "COMMON");
  return { name: gear.name, slot: gear.slot === "primary" || gear.slot === "secondary" || gear.slot === "heavy" ? "WEAPON" : gear.slot === "classItem" ? "CORE" : "ARMOR", rarity, power: gear.power, mods: [], life: 1 };
}
function feedLoot(sim: WorldSim, item: LootItem) {
  sim.loot.unshift(item);
  if (sim.loot.length > 5) sim.loot.length = 5;
}

/** Who gets the kill. "world" = ambient defences (the safe-zone stability field and perimeter turrets): the machine dies but nothing is paid,
 * no XP/credit/loot/kill count/quest signal is produced. Why: standing still in a safe zone used to level the player up from kills they never made. */
export type KillCredit = "player" | "world";

/** How long after the player last hurt a machine a death by the environment (collision, lightning, burn) still counts as the player's kill. */
export const PLAYER_CREDIT_WINDOW_S = 8;
/** Credit for a machine that died from environmental damage: the player only if they damaged it recently, otherwise nobody (no XP, credits or drops). */
export function envCredit(m: Machine, windowS = PLAYER_CREDIT_WINDOW_S): KillCredit {
  if (m.mission) return "player"; // a scripted mission machine always counts: the mission state machines wait on its death
  return m.lastPlayerDamage !== undefined && performance.now() / 1000 - m.lastPlayerDamage <= windowS ? "player" : "world";
}
const markPlayerDamage = (m: Machine) => { m.lastPlayerDamage = performance.now() / 1000; };

/** Black Armory Nanite Swarm: one hop of nanite damage into the nearest hostile near a player kill (never chains) */
let naniteChain = false;
function naniteBurst(sim: WorldSim, x: number, z: number) {
  let best: Machine | null = null, bd: number = FOUNDRY_RULES.naniteRange;
  for (const o of sim.machines) { if (!o.alive || o.decoy) continue; const d = Math.hypot(o.x - x, o.z - z); if (d > 0.01 && d < bd) { bd = d; best = o; } }
  if (!best) return;
  best.hp -= applyMachineDamageMods(sim, best, FOUNDRY_RULES.naniteDamage, "KINETIC", x, z);
  if (best.hp <= 0) { naniteChain = true; try { if (best.boss) best.hp = 0.01; else defeatMachine(sim, best, "player"); } finally { naniteChain = false; } }
}

export function defeatMachine(sim: WorldSim, m: Machine, credit: KillCredit = "player") {
  if (!m.alive || m.hp > 0) return;
  sim.statuses.delete(m);
  m.swimY = undefined;
  if (m.decoy) { // a False Saint: no kill, credit, loot or progress
    m.alive = false;
    delete m.living;
    onDecoyShattered(sim, m);
    delete m.decoy; delete m.summoned;
    return;
  }
  // encounter bosses cannot die before their authored finale window opens (Last Oath / Drowning / Last Benediction)
  const floor = encounterHpFloor(m, performance.now() / 1000);
  if (floor > 0) { m.hp = floor; return; }
  m.alive = false;
  {
    // gore.ts: lay the body down where it fell (presentation only)
    const g = m.goreHit, body = enemyBodyScaleOf(m.scale), feet = m.y - 2.2 * m.scale;
    logGore(sim, { kind: "KILL", blood: bloodOf(m), cause: g?.cause ?? "BULLET", x: m.x, y: g?.y ?? feet + 1.25 * body, z: m.z, dx: g?.dx ?? 0, dz: g?.dz ?? 0,
      power: Math.min(1, (g?.dmg ?? 1) / Math.max(0.5, m.maxHp ?? (m.elite ? 7 : 3.5)) + (m.hp < 0 ? -m.hp / Math.max(0.5, m.maxHp ?? 3.5) : 0)), size: body,
      body: m.rival ? undefined : { kind: m.kind, role: m.boss ? "boss" : m.elite ? "elite" : "standard", rot: m.rot, groundY: feet, scale: body } });
    m.goreHit = undefined;
  }
  if (m.rival) { // Crucible rival: scores the match; the match result pays out, not a drop
    const who = m.rival;
    delete m.rival; delete m.living; delete m.lastPlayerDamage;
    if (credit === "player") { sim.rivalKills++; alert(sim, `Rival ${who === "TITAN" ? "GOLIATH" : who === "HUNTER" ? "NYX" : "CIPHER"} eliminated`); }
    return;
  }
  if (m.nemesis) { sim.nemesisEvents.push({ id: m.nemesis, killed: credit === "player" }); delete m.nemesis; delete m.nemesisWeak; delete m.nemesisDamage; }
  const livingTag = m.living;
  if (m.living) { if (credit === "player") sim.livingKills[m.living] = (sim.livingKills[m.living] ?? 0) + 1; delete m.living; }
  // a Living World boss that dies to the world (a wall, the patrols) pays nobody, unlike catalog bosses
  if (credit === "world" && !m.eq && !m.scenarioId && (!m.boss || livingTag)) { // ambient kill: no kill, credit, XP, drop or director event
    endEncounter(sim, m);
    delete m.gimmickHistory; delete m.attuned; delete m.scenarioRun; delete m.playerHits; delete m.encounter; delete m.decoy; delete m.summoned; delete m.lastPlayerDamage;
    return;
  }
  sim.kills++;
  if (m.boss) sim.bossKills++; else if (m.elite) sim.eliteKills++;
  if (sim.runes.reap) sim.hp = Math.min(100, sim.hp + REAP_HEAL); // godforge.ts Reap rune
  if (sim.foundry === "BLACK_ARMORY" && credit === "player" && !naniteChain) naniteBurst(sim, m.x, m.z); // foundries.ts: Nanite Swarm
  sim.credits += m.boss ? 250 : m.elite ? 75 : 45;
  directorEvent(sim.director, { type: "KILL" });
  const material = m.drop;
  const amount = m.boss ? 3 : m.elite ? 2 : 1;
  sim.materials[material] = (sim.materials[material] ?? 0) + amount;
  const setDrop = rollSetDrop(m.zone, m.boss ? "BOSS" : m.elite ? "ELITE" : "NORMAL", Math.random()) ?? undefined;
  const scenarioClaim: ScenarioClaim | undefined = m.scenarioId && SCENARIO_LOOT[m.scenarioId] && m.scenarioRun
    ? { scenarioId: m.scenarioId, runId: m.scenarioRun, participated: (m.playerHits ?? 0) >= PARTICIPATION_HITS, rolls: rollScenario(m.scenarioId), elapsed: m.scenarioT0 !== undefined ? performance.now() / 1000 - m.scenarioT0 : undefined, deaths: m.scenarioDeaths0 !== undefined ? sim.deaths - m.scenarioDeaths0 : undefined }
    : undefined;
  const dropId = sim.nextDropId++;
  const weaponDrop = rollWeaponLoot(m.boss ? "enemy-boss" : m.elite ? "enemy-elite" : "enemy-regular", m.zone, Math.random(), `${dropId}-${Math.random().toString(36).slice(2, 8)}`) ?? undefined;
  sim.drops.push({ id: dropId, material, amount, enemy: m.profile, ...(weaponDrop ? { weaponDrop } : {}), ...(setDrop ? { setDrop } : {}), ...(scenarioClaim ? { scenarioClaim } : {}) });
  if (weaponDrop) { alert(sim, `Weapon drop — ${weaponDrop.name}`); feedLoot(sim, feedEntry(weaponDrop)); }
  if (setDrop) { const name = setById(setDrop.setId)?.pieces[setDrop.slot] ?? "set piece"; alert(sim, `Armor drop — ${name}`); feedLoot(sim, { name, slot: "ARMOR", rarity: "EPIC", power: 0, mods: [], life: 1 }); }
  sim.xpEvents.push({ type: m.boss ? "BOSS_KILL" : m.elite ? "ELITE_KILL" : "KILL", enemyLevel: 1 + Math.floor(sim.combatHeat / 25), combatHeat: sim.combatHeat });
  // bosses pay through real drops only (35% T4 weapon, set pieces, scenario rewards); the old raid roll announced EXOTIC/LEGENDARY
  // items that never reached the save, so it is gone
  if (m.boss) sim.raidFight = undefined;
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
  endEncounter(sim, m);
  delete m.scenarioId; delete m.gimmickHistory; delete m.attuned; delete m.scenarioRun; delete m.playerHits; delete m.encounter; delete m.decoy; delete m.summoned; delete m.lastPlayerDamage;
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
    element: undefined,
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
    rivalKills: 0,
    eliteKills: 0,
    bossKills: 0,
    extractions: 0,
    director: createDirector(),
    impactCool: 0,
    combatHeat: 0,
    livingKills: {},
    sanctuaries: [],
    foundry: null,
    deflectUntil: 0,
    runes: { ...NO_RUNES, charges: [], devourHits: 0 },
    lastHitBy: null,
    deathEvents: [],
    nemesisEvents: [],
    challenge: { enemyHp: 1, enemyDamage: 1 },
    squad: createSquad(0, 0, typeof location !== "undefined" && /[?&]squad=1/.test(location.search)),
    envVisibility: 1,
    playerNoise: 0,
    adaptation,
    mods: adaptationMods(adaptation),
    stats: createStats(),
    weaponHeat: 0,
    overheated: false,
    lastHit: 0,
    lastDeath: 0,
    lastDamageAt: 0,
    inSafeZone: false,
    lastDeathCause: "",
    lastDeathCargo: 0,
    deaths: 0,
    loot: [],
    vault: [],
    titan: createTitanState(),
    titanActive: false,
    equippedElement: "KINETIC",
    equippedPerk: undefined,
    equippedEvolution: undefined,
    evoCharge: freshCharge(),
    nullCharge: { ...INITIAL_NULL_CHARGE },
    maw: { ...INITIAL_MAW },
    mawCollapse: null,
    nullPulse: null,
    nextHitId: 0, nextChainHitId: 0, chainState: emptyChainState(), lastChainReaction: null,
    encounterZones: [], encounterEvents: [], nextEncounterEventId: 1, nextEncounterZoneId: 1, hazardSpeedMult: 1,
    rounds: Array.from({ length: ROUND_POOL }, () => ({ ...fireRound(NO_ORDNANCE, { x: 0, y: 0, z: 0 }, [0, 0, 1]), alive: false, launcher: "ROCKET" as LauncherId, element: "KINETIC" as DamageElement, target: -1, knock: 1 })),
    statuses: new Map(), burstEvents: [], evoBursts: [], nextBurstId: 1, impacts: Array.from({ length: IMPACT_LOG }, () => ({ id: 0, x: 0, y: 0, z: 0, kind: "ground" as BulletHit, vx: 0, vz: 0 })), nextImpactId: 1, gore: Array.from({ length: GORE_LOG }, emptyGoreEvent), nextGoreId: 1, fauna: [], faunaHits: [],
    materials: {}, drops: [], armorResist: 0, armorRegen: 0, consumableDamageMult: 1, enemyShots: [], bossPhaseFlares: [], xpEvents: [], nextDropId: 0,
    emergencyQuest: EMERGENCY_QUEST_INIT,
    bossCounter: counterTuningFor(null),
    volatileZones: [],
    riftTurrets: [],
    gadgets: freshGadgets(),
    grenades: [], grenadeCool: 0, nextGrenadeId: 1,
    abilityEvents: [],
    nextAbilityEventId: 1,
    iframes: 0,
    dashResist: 0,
    dragoniteResist: 0,
    barrierTime: 0,
    lastBlockedAt: 0,
    stealthMult: 1,
    verbDamageMult: 1,
    verbIncomingMult: 1,
    buildDamage: 1,
    operatorPower: null,
    operatorClass: null,
    lastCrit: 0,
    env: createEnvState(),
    backpack: NO_BACKPACK,
    beacons: Array.from({ length: BEACON_POOL }, () => ({ alive: false, kind: "RESUPPLY" as StratagemId, state: "FLIGHT" as const, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, timer: 0, radius: 0 })),
    stratagemEvents: [],
  };
}

export function alert(sim: WorldSim, text: string) {
  // the same line while it is still on screen only refreshes it (repeating hazards stacked two identical banners)
  const live = sim.alerts.find((a) => a.text === text);
  if (live) { live.life = 6; return; }
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
  m.hp = ((elite ? 7 : 3) + Math.round(zone.region.difficulty * 0.8)) * (sim.challenge?.enemyHp ?? 1);
  m.maxHp = m.hp; m.react = undefined;
  m.rot = 0;
  m.scale = (elite ? 1.5 : 0.9) + Math.random() * 0.7;
  m.zone = zone.region.id;
  m.cool = 1.5;
  m.elite = elite;
  m.kx = 0;
  m.kz = 0;
  m.vulnUntil = 0;
  delete m.lastPlayerDamage;
  m.vulnMult = 1;
  m.aim = 0;
  delete m.encounter; delete m.decoy; delete m.summoned; delete m.living; delete m.nemesis; delete m.nemesisWeak; delete m.nemesisDamage;
}

/** Spawn Broken Signal data drones around a point; tagged so the mission can count them. */
/** Spawns a mission wave in a ring around (x,z). Without `regionId` it is the classic data-drone wave;
 * with one, the wave is that region's own troops (encounters.ts), e.g. spore-walkers in the swamps. */
export function spawnMissionDrones(sim: WorldSim, x: number, z: number, count: number, elite: boolean, regionId?: string, troopsFrom?: string) {
  for (let i = 0; i < count; i++) {
    const m = sim.machines.find((e) => !e.alive);
    if (!m) return;
    const a = (i / count) * Math.PI * 2;
    const troop = troopsFrom || regionId ? troopFor(troopsFrom ?? regionId!, i) : null; // troopsFrom: a place inside the region with its own roster (Thalassia)
    Object.assign(m, { alive: true, react: undefined, x: x + Math.cos(a) * 16, z: z + Math.sin(a) * 16, hp: (elite ? 6 : 3) * (sim.challenge?.enemyHp ?? 1), maxHp: (elite ? 6 : 3) * (sim.challenge?.enemyHp ?? 1), rot: 0, scale: elite ? 1.1 : 0.8, zone: regionId ?? "nexus", cool: elite ? 1.2 : 2.5, elite, profile: troop ? troop.name : elite ? "Data Drone Elite" : "Data Drone Scout", kind: troop ? troop.kind : ("OVERCLOCKED" as const), drop: (troop ? troop.drop : "dataShards") as MaterialId, boss: false, kx: 0, kz: 0, mission: true, vulnUntil: 0, vulnMult: 1, encounter: undefined, decoy: undefined, living: undefined, nemesis: undefined, nemesisWeak: undefined, nemesisDamage: undefined });
  }
}

/** Make room in the machine pool for an authored wave: retire the farthest ambient machines (not mission, boss, event,
 * nemesis or scenario machines) silently — no kill, no credit. Returns how many slots are now free. */
export function freeSlots(sim: WorldSim, need: number, px: number, pz: number): number {
  let free = sim.machines.filter((m) => !m.alive).length;
  if (free >= need) return free;
  const ambient = sim.machines.filter((m) => m.alive && !m.mission && !m.boss && !m.living && !m.nemesis && !m.scenarioId && !m.eq && !m.decoy)
    .sort((a, b) => Math.hypot(b.x - px, b.z - pz) - Math.hypot(a.x - px, a.z - pz));
  for (const m of ambient) { if (free >= need) break; m.alive = false; delete m.lastPlayerDamage; free++; }
  return free;
}

/** Living World event wave (living-events.ts): `regionId` troops in a ring around (x,z), tagged with the event id. Not a
 * scripted-mission machine (missions wait on `mission` machines), but never leashed away while the event runs. */
export function spawnEventSquad(sim: WorldSim, tag: string, x: number, z: number, count: number, elite: number, regionId: string, ring = 12, troopIndex?: number): number {
  let n = 0;
  for (let i = 0; i < count; i++) {
    const m = sim.machines.find((e) => !e.alive);
    if (!m) break;
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const troop = troopFor(regionId, troopIndex ?? i);
    const isElite = i < elite;
    Object.assign(m, { alive: true, react: undefined, x: x + Math.cos(a) * ring, z: z + Math.sin(a) * ring, hp: (isElite ? 7 : 3.5) * (sim.challenge?.enemyHp ?? 1), maxHp: (isElite ? 7 : 3.5) * (sim.challenge?.enemyHp ?? 1), rot: 0, scale: isElite ? 1.4 : 0.95, zone: regionId, cool: 1.5 + Math.random(), elite: isElite, profile: troop ? troop.name : "Hostile", kind: troop ? troop.kind : ("RAIDER" as const), drop: (troop ? troop.drop : "scrapMetal") as MaterialId, boss: false, kx: 0, kz: 0, mission: false, vulnUntil: 0, vulnMult: 1, encounter: undefined, decoy: undefined, living: tag, scenarioId: undefined, eq: undefined, swimY: undefined, nemesis: undefined, nemesisWeak: undefined, nemesisDamage: undefined });
    delete m.lastPlayerDamage; delete m.ai;
    n++;
  }
  return n;
}


/** nemesis.ts: put a nemesis into a free machine slot at (x,z) with its rank's stats; returns false when the pool is full */
export function spawnNemesis(sim: WorldSim, n: Nemesis, x: number, z: number): boolean {
  const m = sim.machines.find((e) => !e.alive);
  if (!m) return false;
  const st = nemesisStats(n);
  const troop = troopFor(n.regionId, 0);
  const weak = n.traits.map((t) => WEAK_ELEMENT[t]).find(Boolean);
  Object.assign(m, { alive: true, react: undefined, x, z, hp: st.hp * (sim.challenge?.enemyHp ?? 1), maxHp: st.hp * (sim.challenge?.enemyHp ?? 1), rot: 0, scale: st.scale, zone: n.regionId, cool: 1.2, elite: true, profile: `${n.name} ${n.epithet}`, kind: troop ? troop.kind : ("RAIDER" as const), drop: (troop ? troop.drop : "scrapMetal") as MaterialId, boss: false, kx: 0, kz: 0, mission: false, vulnUntil: 0, vulnMult: 1, encounter: undefined, decoy: undefined, living: undefined, scenarioId: undefined, eq: undefined, swimY: undefined, nemesis: n.id, nemesisWeak: weak, nemesisDamage: st.damage });
  delete m.lastPlayerDamage; delete m.ai;
  alert(sim, `${n.name} ${n.epithet}: "${n.grudge}"`);
  return true;
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
  Object.assign(m, { alive: true, react: undefined, x, z, y: walkHeight(x, z) + 5, hp: BOSS_HP.regional * (sim.challenge?.enemyHp ?? 1), maxHp: BOSS_HP.regional * (sim.challenge?.enemyHp ?? 1), phase: 0 as BossPhaseIndex, rot: 0, scale: 2.3, zone: regionId, cool: 2, elite: true, boss: true, profile: boss.name, kind: factionOf(regionId), drop: boss.drop, kx: 0, kz: 0, poiseState: INITIAL_POISE, scenarioId: undefined, gimmickHistory: undefined, attuned: undefined, scenarioRun: undefined, playerHits: undefined, encounter: undefined, decoy: undefined, living: undefined, nemesis: undefined, nemesisWeak: undefined, nemesisDamage: undefined, vulnUntil: 0, vulnMult: 1, ...extra });
  sim.raidFight = { start: performance.now() / 1000, hurt: 0, region: regionId };
  alert(sim, `${boss.name} · ${boss.tell}`);
  return true;
}

/** Spawns a Unique Scenario encounter (unique-scenarios.ts) — a one-off boss with a real gimmick
 * instead of just reskinned stats; see that file for what `scenarioId` changes about combat. */
export function summonScenarioBoss(sim: WorldSim, scenario: UniqueScenario, x: number, z: number, extra?: Partial<Machine>): boolean {
  const m = sim.machines.find((candidate) => !candidate.alive);
  if (!m) return false;
  Object.assign(m, { alive: true, react: undefined, x, z, y: walkHeight(x, z) + 5, hp: BOSS_HP.scenario * (sim.challenge?.enemyHp ?? 1), maxHp: BOSS_HP.scenario * (sim.challenge?.enemyHp ?? 1), phase: 0 as BossPhaseIndex, rot: 0, scale: 2.5, zone: scenario.regionId, cool: 2, elite: true, boss: true, profile: scenario.bossName, kind: factionOf(scenario.regionId), drop: scenario.drop as MaterialId, kx: 0, kz: 0, poiseState: INITIAL_POISE, scenarioId: scenario.id, scenarioRun: `${scenario.id}-${Date.now().toString(36)}-${(sim.nextHitId++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`, playerHits: 0, gimmickHistory: [], attuned: undefined, encounter: undefined, decoy: undefined, living: undefined, nemesis: undefined, nemesisWeak: undefined, nemesisDamage: undefined, vulnUntil: 0, vulnMult: 1, ...extra });
  m.scenarioT0 = performance.now() / 1000; m.scenarioDeaths0 = sim.deaths;
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
  element?: DamageElement,
  cause?: GoreCause,
  /** vehicle guns (vehicle-weapons.ts): muzzle velocity and the shooter's own velocity, which the round keeps */
  shot?: { speed?: number; inherit?: { vx: number; vy: number; vz: number }; heat?: "VEHICLE" | "FOOT"; weapon?: WeaponId },
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
  const speed = shot?.speed ?? 130;
  b.vx = Math.sin(yaw) * Math.cos(pitch) * speed + (shot?.inherit?.vx ?? 0);
  b.vy = Math.sin(pitch) * speed + (shot?.inherit?.vy ?? 0);
  b.vz = Math.cos(yaw) * Math.cos(pitch) * speed + (shot?.inherit?.vz ?? 0);
  b.life = 1.4 * Math.max(1, speed / 130); // the same reach scales with muzzle velocity (~180 m), longer for fast guns
  b.dmg = dmg;
  b.knock = knock;
  b.element = element;
  b.cause = cause;
  b.weapon = shot?.weapon; b.ox = x; b.oz = z;
  logBehavior(sim.adaptation, "combat", 0.35);
  return true;
}

/** fire a launcher weapon: `dmg` is the weapon multiplier x gear power (bullet-equivalent units). Guided launchers lock the nearest machine in a
 * forward cone at the moment of firing. Shares heat/noise/overheat rules with bullets. Returns false when overheated or the pool is full. */
export function fireLauncher(sim: WorldSim, id: LauncherId, x: number, y: number, z: number, yaw: number, pitch: number, dmg: number, knock = 1, heat = 1): boolean {
  if (sim.overheated) return false;
  const r = sim.rounds.find((v) => !v.alive);
  if (!r) return false;
  const L = LAUNCHERS[id];
  sim.weaponHeat = Math.min(100, sim.weaponHeat + HEAT_PER_SHOT_FOOT * heat);
  sim.playerNoise = 1;
  if (sim.weaponHeat >= 100) { sim.overheated = true; alert(sim, "WEAPON OVERHEAT — venting"); }
  const lock = L.guided ? pickLockTarget({ x, z }, yaw, sim.machines, L.lockCone, L.lockRange) : -1;
  const aim: [number, number, number] = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  Object.assign(r, fireRound({ ...L.ordnance, damage: dmg * sim.mods.bulletDamage * sim.buildDamage * sim.verbDamageMult }, { x, y, z }, aim), { launcher: id, element: L.element, target: lock, knock });
  logBehavior(sim.adaptation, "combat", 0.6);
  return true;
}

/** vehicle ordnance (vehicle-weapons.ts secondary fire): a rocket/missile/torpedo from ordnance.ts flying from a hardpoint.
 * Guided rounds lock the nearest machine in a forward cone. Shares heat/noise with every other weapon; drawn and splashed like
 * the Breacher rocket. `carry` adds the vehicle's forward speed so a jet never outruns its own missiles. */
export function fireOrdnance(sim: WorldSim, def: OrdnanceDef, x: number, y: number, z: number, yaw: number, pitch: number, dmg: number, carry = 0, knock = 2): boolean {
  if (sim.overheated) return false;
  const r = sim.rounds.find((v) => !v.alive);
  if (!r) return false;
  // a rocket from a pod is cheap (a full 6-rocket ripple must not vent the guns), a missile or shell costs more
  sim.weaponHeat = Math.min(100, sim.weaponHeat + HEAT_PER_SHOT_VEHICLE * (def.kind === "ROCKET" && def.splashRadius <= 5 ? 0.5 : 1.5));
  sim.playerNoise = 1;
  if (sim.weaponHeat >= 100) { sim.overheated = true; alert(sim, "WEAPON OVERHEAT — venting"); }
  const lock = def.turnRate > 0 ? pickLockTarget({ x, z }, yaw, sim.machines, 0.5, def.kind === "MISSILE" ? 260 : 120) : -1;
  const aim: [number, number, number] = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  Object.assign(r, fireRound({ ...def, speed: def.speed + Math.max(0, carry), damage: dmg * sim.mods.bulletDamage * sim.buildDamage * sim.verbDamageMult }, { x, y, z }, aim), { launcher: "ROCKET" as LauncherId, element: "KINETIC" as DamageElement, target: lock, knock });
  logBehavior(sim.adaptation, "vehicles", 0.6);
  return true;
}

/** Register an authoritative elemental hit from a distinct Operator. The caller must
 * provide a stable unique hit ID and source ID (never trust client-generated damage).
 * Returns a proposed multiplier only; no HP, XP or loot is changed here. */
export function registerSimChainHit(sim: WorldSim, machine: Machine, hit: Readonly<{
  id: string; sourceId: string; element: DamageElement; at: number;
}>): ChainReaction | null {
  const targetIndex = sim.machines.indexOf(machine);
  if (targetIndex < 0 || !machine.alive) return null;
  const result = registerChainHit(sim.chainState, {
    ...hit, targetId: `machine:${targetIndex}`,
  });
  sim.chainState = result.state;
  sim.lastChainReaction = result.reaction;
  return result.reaction;
}

/** apply the elemental status for one hit to a machine (weapon-elements.ts rules); stun goes through stunMachine so bosses stay capped */
export function applyWeaponElement(sim: WorldSim, m: Machine, element: DamageElement) {
  if (element === "KINETIC") return;
  const now = performance.now() / 1000;
  let st = sim.statuses.get(m);
  if (!st) { st = freshStatuses(); sim.statuses.set(m, st); }
  const fx = applyElementHit(st, element, now, m.boss);
  if (fx.stun > 0) stunMachine(m, fx.stun);
  if (fx.vuln) { const v = mergeVuln({ mult: m.vulnMult, until: m.vulnUntil }, fx.vuln, now); m.vulnMult = v.mult; m.vulnUntil = v.until; }
}

/** evolved-weapon ability (weapon-evolution.ts): bursts go through applyMachineDamageMods / stunMachine like every other source */
function evolutionHit(sim: WorldSim, m: Machine, dmg: number, px: number, pz: number) {
  const ability = sim.equippedEvolution!;
  const r = registerEvolutionHit(sim.evoCharge, ability);
  sim.evoCharge = r.charge;
  if (!r.burst) return;
  abilityBurst(sim, m, dmg, px, pz, ability);
}
/** godforge.ts: each burst rune on the relic in hand keeps its own hit counter and bursts like an evolved weapon */
function runeHits(sim: WorldSim, m: Machine, dmg: number, px: number, pz: number) {
  sim.runes.bursts.forEach((ability, k) => {
    const r = registerEvolutionHit(sim.runes.charges[k] ?? freshCharge(), ability);
    sim.runes.charges[k] = r.charge;
    if (r.burst) abilityBurst(sim, m, dmg, px, pz, ability);
  });
}
/** godforge.ts: Devour (every 8th hit ×2.5), Rift (+25% vs elites/bosses), Frost (chilled bonus), awakened (+10%) */
function runeDamageMult(sim: WorldSim, m: Machine): number {
  let k = sim.runes.awakened ? AWAKENED_MULT : 1;
  if (sim.runes.devour) { sim.runes.devourHits++; if (sim.runes.devourHits >= DEVOUR_EVERY) { sim.runes.devourHits = 0; k *= DEVOUR_MULT; } }
  if (sim.runes.rift && (m.elite || m.boss)) k *= RIFT_MULT;
  if (sim.runes.bursts.includes("RIME_SHATTER")) { const st = sim.statuses.get(m); k *= evolutionDamageMult("RIME_SHATTER", !!st && isChilled(st, performance.now() / 1000)); }
  return k;
}
function abilityBurst(sim: WorldSim, m: Machine, dmg: number, px: number, pz: number, ability: EvolutionAbility) {
  const rule = ABILITY_RULES[ability];
  const element = ruinElementOf(ability);
  const live = sim.machines.filter((o) => o.alive && o !== m && !o.decoy);
  for (const o of burstTargets(m, live, ability)) {
    if (rule.burstFraction > 0) { o.hp -= applyMachineDamageMods(sim, o, dmg * rule.burstFraction, element, px, pz); }
    applyWeaponElement(sim, o, element);
    if (rule.stun > 0) stunMachine(o, rule.stun);
    defeatMachine(sim, o);
  }
  sim.evoBursts.push({ id: sim.nextBurstId++, x: m.x, y: m.y, z: m.z, ability, at: performance.now() / 1000 });
  if (sim.evoBursts.length > 8) sim.evoBursts.shift();
}

/** convoy truck damage shared by bullets and launcher bursts (one kill/loot path) */
function damageTruck(sim: WorldSim, tr: Truck, dmg: number) {
  tr.hp -= dmg;
  logBehavior(sim.adaptation, "combat", 1);
  if (tr.hp <= 0 && tr.alive) {
    tr.alive = false;
    sim.cargo += tr.cargo;
    logBehavior(sim.adaptation, "logistics", tr.cargo * 2);
    directorEvent(sim.director, { type: "CARGO", amount: tr.cargo });
    alert(sim, `Convoy ambushed — ${tr.cargo} crate${tr.cargo > 1 ? "s" : ""} seized`);
  }
}

/** splash damage for one detonation. Never hurts the player; every machine goes through applyMachineDamageMods exactly once. */
/** a gadget blast (mines): splash through the shared damage path, drawn and heard like a rocket burst */
export function gadgetBlast(sim: WorldSim, x: number, y: number, z: number, radius: number, damage: number, knock: number, element: DamageElement, px: number, pz: number, fx?: BurstEvent["fx"]) {
  const b: Burst = { x, y, z, radius, damage, reason: "PROXIMITY" };
  for (const m of sim.machines) {
    if (!m.alive) continue;
    const dx = m.x - x, dz = m.z - z, planar = Math.hypot(dx, dz);
    const base = splashDamage(b, Math.max(0, planar - 1.5 * m.scale));
    if (base <= 0) continue;
    const dmg = applyMachineDamageMods(sim, m, base, element, px, pz);
    m.hp -= dmg;
    markGoreHit(sim, m, dx || 0.01, dz, dmg * 2.2, "BLAST", undefined, false);
    const fall = 1 - Math.min(1, planar / radius), n = planar || 1;
    m.kx += (dx / n) * 7 * knock * fall; m.kz += (dz / n) * 7 * knock * fall;
    applyWeaponElement(sim, m, element);
    sim.lastHit = performance.now();
    defeatMachine(sim, m);
  }
  for (const tr of sim.trucks) {
    if (!tr.alive) continue;
    const base = splashDamage(b, Math.max(0, Math.hypot(tr.x - x, tr.z - z) - 3));
    if (base > 0) damageTruck(sim, tr, Math.min(base, 4));
  }
  sim.combatHeat += 3;
  sim.burstEvents.push({ id: sim.nextBurstId++, x, y, z, radius, element, launcher: "ROCKET", ...(fx ? { fx } : {}) });
  if (sim.burstEvents.length > 8) sim.burstEvents.splice(0, sim.burstEvents.length - 8);
}

/** enemy grenades (enemy-tactics.ts): fly, bounce, roll, then go off; cover between the blast and the player softens it */
function stepEnemyGrenades(sim: WorldSim, dt: number, px: number, pz: number, playerEye: number) {
  sim.grenadeCool = Math.max(0, sim.grenadeCool - dt);
  if (!sim.grenades.length) return;
  for (const gr of [...sim.grenades]) {
    stepGrenade(gr, dt, walkHeight);
    if (gr.fuse > 0) continue;
    sim.grenades.splice(sim.grenades.indexOf(gr), 1);
    const chest = { x: px, y: playerEye - 0.4, z: pz };
    const dist = Math.hypot(chest.x - gr.x, chest.y - gr.y, chest.z - gr.z);
    const covered = sightLine({ x: gr.x, y: gr.y + 0.4, z: gr.z }, chest, { ground: walkHeight, obstaclesNear: queryObstacles, solids: registeredModelSolids() }).blocked;
    const dmg = grenadeDamage(dist, covered);
    if (dmg > 0) hurtPlayer(sim, dmg / sim.mods.hullDurability, "grenade");
    sim.combatHeat += 3;
    sim.burstEvents.push({ id: sim.nextBurstId++, x: gr.x, y: gr.y + 0.3, z: gr.z, radius: GRENADE.radius, element: "KINETIC", launcher: "ROCKET" });
    if (sim.burstEvents.length > 8) sim.burstEvents.splice(0, sim.burstEvents.length - 8);
  }
}

/** vehicle gadgets each step (vehicle-gadgets.ts rules): mines, caltrop fields, flame jets, the Remora drone, flares */
function stepGadgets(sim: WorldSim, dt: number, px: number, pz: number, playerEye: number) {
  const st = sim.gadgets, now = performance.now() / 1000;
  const live = sim.machines.filter((m) => m.alive);
  // mines: armed, something steps on one, it goes off (an EMP mine stuns and slows instead of shredding)
  if (st.mines.length) {
    st.mines = st.mines.filter((mn) => mn.until > now);
    for (const mn of [...st.mines]) {
      if (!mineTriggered(mn, now, [...live, ...sim.trucks.filter((t) => t.alive)])) continue;
      st.mines.splice(st.mines.indexOf(mn), 1);
      if (mn.kind === "MINE") gadgetBlast(sim, mn.x, mn.y + 0.5, mn.z, GADGET.MINE.radius, GADGET.MINE.damage, GADGET.MINE.knock, "KINETIC", px, pz);
      else {
        const e = GADGET.EMP_MINE;
        for (const m of live) {
          if (Math.hypot(m.x - mn.x, m.z - mn.z) > e.radius) continue;
          stunMachine(m, e.stun);
          if ((m.aim ?? 0) > 0) m.aim = 0; // the wind-up is lost
          m.snareUntil = now + e.slowFor; m.snareMult = slowFor(e.slow, m.boss);
        }
        gadgetBlast(sim, mn.x, mn.y + 0.5, mn.z, e.radius, e.damage, 0.4, "ARC", px, pz, "ARC");
      }
    }
  }
  // caltrops: anything crossing the field is slowed and chewed
  if (st.caltrops.length) {
    st.caltrops = st.caltrops.filter((c) => c.until > now);
    for (const m of live) {
      if (!inCaltrops(st, m.x, m.z, now)) continue;
      m.snareUntil = Math.max(m.snareUntil ?? 0, now + 0.3); m.snareMult = slowFor(GADGET.CALTROPS.slow, m.boss);
      m.hp -= applyMachineDamageMods(sim, m, GADGET.CALTROPS.dps * dt, "KINETIC", px, pz);
      defeatMachine(sim, m);
    }
  }
  // flame jets: burn what is around the hull while the trigger is held (Scene sets st.flame each step it is lit)
  if (st.flame) {
    for (const m of live) {
      if (!inFlames(st.flame, m, 1.2 * m.scale)) continue;
      const dmg = applyMachineDamageMods(sim, m, GADGET.FLAME.dps * dt, "THERMAL", px, pz);
      m.hp -= dmg;
      applyWeaponElement(sim, m, "THERMAL");
      markGoreHit(sim, m, m.x - st.flame.x || 0.01, m.z - st.flame.z, dmg * 2, "ABILITY", undefined, false);
      sim.lastHit = performance.now();
      defeatMachine(sim, m);
    }
    sim.weaponHeat = Math.min(100, sim.weaponHeat + GADGET.FLAME.heat * dt);
    if (sim.weaponHeat >= 100 && !sim.overheated) { sim.overheated = true; alert(sim, "FLAME JETS OVERHEAT — venting"); }
    sim.combatHeat += dt * 2;
    st.flameLit = { ...st.flame, t: now };
    st.flame = null;
  }
  // the Remora drone: orbits over the player and picks off the nearest hostile it can see
  st.droneShots.length = 0;
  if (st.drones.length) {
    st.drones = st.drones.filter((d) => d.until > now);
    const world = { ground: walkHeight, obstaclesNear: queryObstacles, solids: registeredModelSolids() };
    for (const d of st.drones) {
      stepDrone(d, { x: px, y: playerEye, z: pz }, dt);
      if (d.cool > 0) continue;
      const chest = (m: Machine) => ({ x: m.x, y: walkHeight(m.x, m.z) + 1.3 * enemyBodyScaleOf(m.scale), z: m.z });
      const i = droneTarget(d, sim.machines, (k) => !sightLine(d, chest(sim.machines[k]!), world).blocked);
      const m = i >= 0 ? sim.machines[i] : undefined;
      if (!m) { d.cool = 0.3; continue; }
      d.cool = GADGET.DRONE.rate;
      const dmg = applyMachineDamageMods(sim, m, GADGET.DRONE.damage, "KINETIC", px, pz);
      m.hp -= dmg;
      const c = chest(m);
      markGoreHit(sim, m, m.x - d.x || 0.01, m.z - d.z, dmg, "BULLET", c.y);
      st.droneShots.push({ x: d.x, y: d.y, z: d.z, tx: c.x, ty: c.y, tz: c.z, id: st.nextId++ });
      sim.lastHit = performance.now();
      defeatMachine(sim, m);
    }
  }
  if (st.flares.length) stepFlares(st, now, dt);
}

function detonateRound(sim: WorldSim, r: SimRound, b: Burst, px: number, pz: number) {
  r.alive = false;
  for (const m of sim.machines) {
    if (!m.alive) continue;
    const dx = m.x - b.x, dz = m.z - b.z, planar = Math.hypot(dx, dz);
    const dist = Math.max(0, planar - 1.5 * m.scale);
    const base = splashDamage(b, dist);
    if (base <= 0) continue;
    const dmg = applyMachineDamageMods(sim, m, base, r.element, px, pz);
    m.hp -= dmg;
    markGoreHit(sim, m, dx || 0.01, dz, dmg * 2.2, "BLAST", undefined, false);
    const fall = 1 - Math.min(1, dist / b.radius), n = planar || 1;
    m.kx += (dx / n) * 7 * r.knock * fall;
    m.kz += (dz / n) * 7 * r.knock * fall;
    applyWeaponElement(sim, m, r.element);
    sim.lastHit = performance.now();
    logBehavior(sim.adaptation, "combat", 1);
    defeatMachine(sim, m);
  }
  for (const tr of sim.trucks) {
    if (!tr.alive) continue;
    const d = Math.max(0, Math.hypot(tr.x - b.x, tr.z - b.z) - 3);
    const base = splashDamage(b, d);
    if (base > 0) damageTruck(sim, tr, Math.min(base, 3));
  }
  sim.combatHeat += 3;
  sim.burstEvents.push({ id: sim.nextBurstId++, x: b.x, y: b.y, z: b.z, radius: b.radius, element: r.element, launcher: r.launcher });
  if (sim.burstEvents.length > 8) sim.burstEvents.splice(0, sim.burstEvents.length - 8);
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
      markPlayerDamage(m);
      m.hp -= m.boss ? 8 : 14;
      markGoreHit(sim, m, m.x - b.x || 0.01, m.z - b.z, 99, "BLAST", undefined, false);
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
      markGoreHit(sim, m, m.x - strike.x || 0.01, m.z - strike.z, STRIKE_MACHINE_DAMAGE * 3, "BLAST", undefined, false);
      if (m.hp <= 0) defeatMachine(sim, m, envCredit(m));
    }
  }
  if (Math.hypot(px - strike.x, pz - strike.z) <= strike.radius) hurtPlayer(sim, STRIKE_PLAYER_DAMAGE, "Lightning strike");
}

/** The one place incoming damage to a war machine is shaped, shared by bullets, abilities and turrets so they all
 * respect the same rules: Weaken/Marked vulnerability, boss poise windows, Unique Scenario gimmicks, and the hit count
 * that decides scenario reward participation. Returns the damage to subtract from m.hp. */
export function applyMachineDamageMods(sim: WorldSim, m: Machine, dmg: number, element: Parameters<typeof gimmickMultiplier>[1]["element"], px: number, pz: number): number {
  dmg *= sim.consumableDamageMult;
  // weapon-meta.ts: power level against the enemy's (its region's difficulty), Destiny style
  if (sim.operatorPower !== null) dmg *= powerScale(sim.operatorPower - enemyPower(byId(m.zone)?.difficulty ?? 0, m.elite, m.boss));
  const nowSec = performance.now() / 1000;
  markPlayerDamage(m); // bullets, abilities, launchers, turrets and strikes all price their damage here, so this is the player's damage
  if (m.vulnUntil > nowSec) dmg *= m.vulnMult;
  if (m.nemesisWeak && element === m.nemesisWeak) dmg *= 2; // nemesis.ts: a scarred nemesis takes double damage from its weak element
  if (!m.boss) return dmg;
  if (!m.poiseState) m.poiseState = INITIAL_POISE;
  const result = hitPoise(m.poiseState, dmg * POISE_PER_DAMAGE, nowSec);
  m.poiseState = result.state;
  let mult = result.damageMult;
  // Unique Scenario gimmick: near-immune outside the weak-point/stagger window it just got
  if (m.scenarioId && mult === 1) mult = scenarioById(m.scenarioId)?.outsideWindowMult ?? 1;
  dmg *= mult;
  if (m.scenarioId) {
    const g = gimmickMultiplier(scenarioById(m.scenarioId)?.gimmick, { element, nowSec, distance: Math.hypot(m.x - px, m.z - pz), history: m.gimmickHistory ?? [] });
    m.gimmickHistory = g.history;
    dmg *= g.mult;
    m.playerHits = (m.playerHits ?? 0) + 1;
  }
  return dmg;
}

/** Bosses are never hard-locked: any stun on a boss is capped to the same window Null Disruption uses. */
export const BOSS_STUN_CAP = NULL_PULSE_STUN_SECONDS;
export function stunMachine(m: Machine, seconds: number) {
  m.cool = Math.max(m.cool, m.boss ? Math.min(seconds, BOSS_STUN_CAP) : seconds);
}

/** hurt the player and respawn at Nexus when the hull is gone */
/** Non-lethal environmental damage (drowning, hull stress, coolant, falling debris): never takes the last point of health, but it is still
 * damage, so it pauses recovery (health.ts). */
export function chipPlayer(sim: WorldSim, dmg: number) {
  if (dmg <= 0 || sim.hp <= 0) return;
  sim.hp = Math.max(1, sim.hp - dmg);
  sim.lastDamageAt = performance.now() / 1000;
}

export function hurtPlayer(sim: WorldSim, dmg: number, cause: string) {
  // Rift Dash i-frames and the Bastion Shield barrier negate the hit entirely (every damage source funnels through here)
  if (sim.iframes > 0 || sim.barrierTime > 0) { sim.lastBlockedAt = performance.now(); return; }
  // Global Balance Controller (balance.ts): scales every hit the player takes by their own power
  // score before anything else runs — the one place all incoming damage already funnels through.
  // verbIncomingMult (Bulwark Titan's Safe Ground / OVERSHIELD) is set here too since every source
  // of incoming damage — bullets, collisions, hazards — already routes through this one function.
  const scaled = dmg * (performance.now() / 1000 < sim.deflectUntil ? 0.5 : 1) * (sim.challenge?.enemyDamage ?? 1) * (sim.runes?.ward ? WARD_MULT : 1) * sim.mods.incomingDamageScale * sim.verbIncomingMult * (1 - Math.min(0.9, Math.max(0, sim.dashResist))) * (1 - Math.min(0.5, Math.max(0, sim.dragoniteResist))) * (1 - Math.min(0.5, Math.max(0, sim.armorResist)));
  const resolvedDamage = sim.titanActive ? absorbTitanDamage(sim.titan, scaled, performance.now() / 1000) : scaled;
  sim.hp = Math.max(0, sim.hp - resolvedDamage);
  if (resolvedDamage > 0) sim.lastDamageAt = performance.now() / 1000;
  if (sim.raidFight) sim.raidFight.hurt += resolvedDamage;
  if (sim.hp === 0) {
    sim.lastDeath = performance.now();
    sim.lastDeathCause = cause;
    if (sim.lastHitBy && sim.lastHitBy.profile === cause) { sim.deathEvents.push({ killer: sim.lastHitBy, at: Date.now() }); if (sim.deathEvents.length > 8) sim.deathEvents.shift(); }
    sim.lastDeathCargo = sim.cargo;
    sim.deaths++;
    sim.hp = 100;
    sim.cargo = 0;
    alert(sim, `Hull destroyed (${cause}) — cargo lost`);
    resetEncounters(sim);
  }
}

/** `y` (feet), when given, lets a body pass over or under a wall */
export type PlayerBody = { x: number; z: number; y?: number; yaw: number; vSpeed: number; inVehicle: boolean };

/**
 * Physics pass for the player body: collide with terrain props, war machines
 * and convoys. Impacts damage both sides and bleed off speed.
 */
export function collidePlayer(sim: WorldSim, body: PlayerBody) {
  const radius = body.inVehicle ? 3.1 : 1.0;
  const mass = body.inVehicle ? 2.4 : 0.8;
  const speed = body.inVehicle ? body.vSpeed : 8;

  // --- building walls (residences): a person-sized body so doorways stay passable; a vehicle stops at the wall ---
  if (collideWalls(body, body.inVehicle ? 2.2 : 0.45, body.y) && body.inVehicle) body.vSpeed *= 0.4;

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
      markPlayerDamage(m);
      const ram = body.inVehicle ? sim.gadgets.ram : { damageMult: 1, selfMult: 1 };
      m.hp -= Math.round((force / 30) * sim.mods.ramDamage * ram.damageMult);
      markGoreHit(sim, m, -dx / dist, -dz / dist, (force / 30) * sim.mods.ramDamage * ram.damageMult * 2, "CRUSH");
      logBehavior(sim.adaptation, body.inVehicle ? "vehicles" : "combat", 2);
      body.vSpeed *= 0.4;
      sim.combatHeat += 4;
       defeatMachine(sim, m);
      hurtPlayer(sim, (force * 0.12 * ram.selfMult) / sim.mods.hullDurability, "vehicle collision");
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
  /** player facing (yaw 0 = +z); squadmates hold formation off it */
  yaw?: number;
  /** player eye height (world y); defaults to standing on the ground. Enemy line of sight aims just below it */
  py?: number;
  /** player ground speed (m/s) and stance: a moving or crouched target is harder to hit (line-of-sight.ts enemyHitChance) */
  pspeed?: number;
  stance?: "STAND" | "CROUCH" | "PRONE";
};

export function stepSim(sim: WorldSim, input: SimInput) {
  const { dt, px, pz, night } = input;
  const playerEye = input.py ?? walkHeight(px, pz) + 1.6;
  const t0 = performance.now();
  beginStats(sim.stats);
  if (sim.titanActive) tickTitan(sim.titan, dt);
  sim.iframes = Math.max(0, sim.iframes - dt);
  sim.barrierTime = Math.max(0, sim.barrierTime - dt);
  stepEncounters(sim, dt, px, pz);

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
  const { squadArchetype, rangedHoldFire, branchPosture, incomingDamageScale } = sim.mods;
  // incomingDamageScale is Scene's too (balance.ts difficulty curve): it was lost here every step
  sim.mods = { ...adaptationMods(sim.adaptation), squadArchetype, rangedHoldFire, branchPosture, incomingDamageScale };
  sim.hp = stepHealth(sim.hp, dt, performance.now() / 1000 - sim.lastDamageAt, { bonusRate: sim.mods.regen + sim.armorRegen, safe: sim.inSafeZone });

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

  // ---------- squadmates ----------
  {
    const hits = stepSquad(sim.squad, sim.machines, { px, pz, yaw: input.yaw ?? 0, dt, heat: sim.combatHeat, inVehicle: input.inVehicle, rand: Math.random });
    for (const h of hits) {
      const m = sim.machines[h.index];
      if (!m?.alive) continue;
      m.hp -= applyMachineDamageMods(sim, m, h.damage, "KINETIC", px, pz);
      if (m.hp <= 0 && !m.boss) defeatMachine(sim, m);
      else if (m.hp <= 0) m.hp = 0.01;
    }
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
      m.y = Math.max(walkHeight(m.x, m.z), stormGroundAt(m.x, m.z, m.y - 2.2 * m.scale), liveDescentGroundAt(m.x, m.z, m.y - 2.2 * m.scale)) + 2.2 * m.scale;
      if (!m.mission && !m.living && Math.hypot(px - m.x, pz - m.z) > 340) m.alive = false; // scripted mission machines are never leashed away: missions wait on their defeat
      sim.stats.dormant++;
      continue;
    }

    // Hollow Saint copies are inert: they never move or fight, they only exist to be told apart from the real boss
    if (m.decoy) {
      m.cool = Math.max(m.cool, 99);
      if (m.hp <= 0) { defeatMachine(sim, m); continue; }
      m.y = walkHeight(m.x, m.z) + 2.2 * m.scale;
      continue;
    }
    // authored Unique Scenario bosses attack only through the encounter director (encounter-sim.ts), never the generic melee/volley
    const scripted = !!m.boss && !!m.scenarioId && !!ENCOUNTERS[m.scenarioId];
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
      aggroRadius(night, m.elite, sim.mods.aggroRadius, sim.adaptation.influence.aiAggression); // enemy-tuning.ts
    const speed = trooperSpeed(night, m.elite) * (bossTuning?.speedMult ?? 1) * statusSpeedMult(sim.statuses.get(m), performance.now() / 1000) * ((m.snareUntil ?? 0) > performance.now() / 1000 ? m.snareMult ?? 1 : 1);
    if (d < 120) hostileNear++;

    // ---- awareness: patrol → suspicious → alert → search (enemy-perception.ts) ----
    if (!m.ai || m.hp > m.ai.lastHp + 0.01) m.ai = createAi(m.x, m.z, m.hp);
    const ai = m.ai;
    const damaged = m.hp < ai.lastHp - 0.001;
    ai.lastHp = m.hp;
    const facingDot = (Math.sin(m.rot) * dx + Math.cos(m.rot) * dz) / d;
    // line of sight (line-of-sight.ts): eye to the player's chest, refreshed every LOS_REFRESH s; far machines skip it
    const nowLos = performance.now() / 1000;
    if (d < 160 && (!m.los || nowLos - m.los.t > LOS_REFRESH)) {
      const feet = m.swimY !== undefined ? m.y - 2.2 * m.scale : Math.max(walkHeight(m.x, m.z), m.y - 2.2 * m.scale);
      const line = sightLine({ x: m.x, y: feet + 1.55 * enemyBodyScaleOf(m.scale), z: m.z }, { x: px, y: playerEye - 0.35, z: pz }, { ground: walkHeight, obstaclesNear: queryObstacles, solids: registeredModelSolids() });
      m.los = { t: nowLos, clear: !line.blocked, at: line.blocked ? line.at : undefined };
    }
    m.hiddenFor = m.los && !m.los.clear && d < 160 ? (m.hiddenFor ?? 0) + dt : 0;
    const inView = d >= 160 || (m.los?.clear ?? true);
    const sight = sightRange(night, sim.envVisibility ?? 1, m.elite) * (sim.stealthMult ?? 1) * (aggro / 70 > 1 ? Math.min(1.6, aggro / 70) : 1);
    const forced = m.boss || m.mission || m.summoned || sim.hp < 35 && d < 40;
    const aiState = forced && d < aggro ? (ai.state = "ALERT", ai.awareness = 1, ai.lastX = px, ai.lastZ = pz, "ALERT")
      : stepAwareness(ai, { distance: d, sight, noise: Math.min(1, (sim.playerNoise ?? 0) + sim.combatHeat / 120), damaged, facing: facingDot > 0.3, inView }, px, pz, dt);
    // ---- getting out of the way (enemy-evasion.ts): dive from an incoming round's blast, run out of a strike circle ----
    {
      const nowE = performance.now() / 1000, canEvade = !m.boss && !scripted && !m.decoy && !m.rival && d < 90;
      if (canEvade && !(m.evade && nowE < m.evade.until) && nowE >= (m.evadeCool ?? 0)) {
        for (const r of sim.rounds) {
          if (!r.alive) continue;
          const th = roundThreat(r, m.x, m.z, walkHeight, 1.5 * m.scale);
          if (!th) continue;
          // one reaction roll per threat (a miss waits out the cooldown, so it isn't re-rolled every frame)
          if (!reactsInTime(th.t, m.elite, Math.random())) { m.evadeCool = nowE + DIVE.cooldown; break; }
          const dir = diveDirection(m.x, m.z, th, r.dx, r.dz, sim.machines.indexOf(m) % 2 ? 1 : -1);
          m.evade = { vx: dir.x * DIVE.speed, vz: dir.z * DIVE.speed, start: nowE, until: nowE + DIVE.seconds, dive: true };
          m.evadeCool = nowE + DIVE.cooldown; m.aim = 0;
          break;
        }
      }
      if (canEvade && aiState === "ALERT" && !(m.evade && nowE < m.evade.until)) {
        sim.beacons.forEach((b, bi) => {
          if (!b.alive || b.kind !== "ORBITAL_STRIKE" || b.state !== "ARMED") return;
          if (Math.hypot(m.x - b.x, m.z - b.z) > b.radius + m.scale) return;
          const key = `${bi}:${Math.round(b.x)}:${Math.round(b.z)}`;
          if (m.strikeSeen === key) return;
          m.strikeSeen = key;
          const roll = Math.random();
          if (roll >= FLEE.notice) return;
          const dir = fleeDirection(m.x, m.z, b.x, b.z, roll);
          const dist = b.radius + FLEE.pad - Math.hypot(m.x - b.x, m.z - b.z);
          m.evade = { vx: dir.x * (dist / FLEE.seconds) * 1.2, vz: dir.z * (dist / FLEE.seconds) * 1.2, start: nowE, until: nowE + FLEE.seconds, dive: false };
          m.aim = 0;
        });
      }
    }
    if (aiState === "ALERT" && ai.coverTime <= 0 && shouldTakeCover(m.hp / Math.max(1, m.maxHp ?? (m.elite ? 6 : 3)), ai.coverTime, m.boss) && d < 45 && damaged) {
      // real cover first (enemy-cover.ts): behind a rock, wreck, wall or building the player cannot see through
      const near = coverCandidates(queryObstacles(m.x, m.z), registeredModelSolids(), walkHeight);
      const real = near.length ? findCover(m.x, m.z, { x: px, y: playerEye, z: pz }, near, { ground: walkHeight, obstaclesNear: queryObstacles, solids: registeredModelSolids() }) : null;
      if (real) { ai.coverX = real.x; ai.coverZ = real.z; ai.peekX = real.peekX; ai.peekZ = real.peekZ; ai.hideLeft = HIDE_SECONDS; ai.coverTime = COVER_HOLD; m.aim = 0; }
      else { const c = pickCover(m.x, m.z, px, pz, i % 2 ? 1 : -1); ai.coverX = c.x; ai.coverZ = c.z; delete ai.peekX; delete ai.peekZ; ai.coverTime = 3.5; }
    }
    ai.coverTime -= dt;
    // the player walked round the cover: it no longer hides anything, break off and fight
    if (ai.peekX !== undefined && ai.coverTime > 0 && (ai.hideLeft ?? 0) > 0 && (m.aim ?? 0) <= 0 && Math.hypot(ai.coverX - m.x, ai.coverZ - m.z) < 0.6
      && !sightLine({ x: px, y: playerEye, z: pz }, { x: m.x, y: walkHeight(m.x, m.z) + COVER_CHEST, z: m.z }, { ground: walkHeight, obstaclesNear: queryObstacles, solids: registeredModelSolids() }).blocked) ai.coverTime = 0;

    // shared engage step: melee up close, resolve a wind-up, or start one (ranged fire is resolved against the line of sight)
    const engage = () => {
      if (!scripted && d < 6 && m.cool <= 0) {
        m.cool = ENEMY_TUNING.meleeCooldown * (bossTuning?.cooldownMult ?? 1);
        sim.combatHeat += 2;
        sim.lastHitBy = { profile: m.profile, zone: m.zone, elite: m.elite, boss: m.boss, nemesis: m.nemesis };
        hurtPlayer(sim, ((m.boss ? 17 : m.elite ? 12 : 7) * (bossTuning?.damageMult ?? 1) * (m.nemesisDamage ?? 1)) / sim.mods.hullDurability, m.profile);
        // machines besieging Nexus chew the city core
        if (Math.hypot(m.x - byId("nexus").x, m.z - byId("nexus").z) < byId("nexus").radius) {
          sim.coreHp = Math.max(0, sim.coreHp - 2);
        }
      } else if ((m.aim ?? 0) > 0) {
        // wind-up telegraph (Actors.tsx pulses the machine while aim > 0), then the shot lands
        m.aim = (m.aim ?? 0) - dt;
        if ((m.aim ?? 0) <= 0) {
          m.aim = 0;
          m.cool = rangedCooldownFor(m) * (bossTuning?.cooldownMult ?? 1);
          // the shot resolves against the line it travels: cover takes it, otherwise range, the player's speed and stance decide
          const blocked = m.los && !m.los.clear ? m.los.at : undefined;
          const hit = !blocked && !spoofed(sim.gadgets, performance.now() / 1000) && Math.random() < enemyHitChance(d, ENEMY_TUNING.rangedRange, input.pspeed ?? 0, input.stance);
          sim.enemyShots.push({ x: m.x, z: m.z, kind: m.kind, boss: m.boss, elite: m.elite, zone: m.zone, slot: sim.machines.indexOf(m), hit, ...(blocked ? { blockAt: blocked } : {}) });
          if (sim.enemyShots.length > 24) sim.enemyShots.shift();
          if (hit) { sim.lastHitBy = { profile: m.profile, zone: m.zone, elite: m.elite, boss: m.boss, nemesis: m.nemesis }; hurtPlayer(sim, ((m.boss ? 6 : m.elite ? 4 : 2) * (bossTuning?.damageMult ?? 1) * (m.nemesisDamage ?? 1)) / sim.mods.hullDurability, m.profile); }
          ai.hideLeft = HIDE_SECONDS; // from cover: duck back after the shot
        }
      } else if (!scripted && d < ENEMY_TUNING.rangedRange && m.cool <= 0 && (m.boss || aimTickets < MAX_AIMING)) {
        // ranged suppressing fire: take a ticket and start the telegraph; elites/bosses wind up faster
        m.aim = windupFor(m);
        aimTickets++;
      }
    };

    if (m.evade && performance.now() / 1000 < m.evade.until) {
      // diving or running clear: all movement, no shots (a dive ends low and slows at the end)
      const e = m.evade, p = (performance.now() / 1000 - e.start) / Math.max(1e-6, e.until - e.start), ease = e.dive ? 1 - p * 0.6 : 1;
      m.x += e.vx * ease * dt; m.z += e.vz * ease * dt;
      m.rot = e.dive ? Math.atan2(dx, dz) : Math.atan2(e.vx, e.vz);
      m.cool = Math.max(m.cool, 0.35);
    } else if (aiState === "ALERT" && ai.coverTime > 0 && ai.peekX !== undefined && ai.peekZ !== undefined) {
      // fighting from real cover: run there, then hide, lean out to fire, duck back
      const atCover = Math.hypot(ai.coverX - m.x, ai.coverZ - m.z) < 1.5 || Math.hypot(ai.peekX - m.x, ai.peekZ - m.z) < 1.2;
      const phase = atCover ? coverPhase(ai.hideLeft ?? 0, (m.aim ?? 0) > 0, m.cool) : "RUN";
      const tx = phase === "PEEK" ? ai.peekX : ai.coverX, tz = phase === "PEEK" ? ai.peekZ : ai.coverZ;
      const cx = tx - m.x, cz = tz - m.z, cd = Math.hypot(cx, cz);
      if (cd > 0.4) { const k = phase === "RUN" ? 1.25 : 0.8; m.x += (cx / cd) * Math.min(cd / dt, speed * k) * dt; m.z += (cz / cd) * Math.min(cd / dt, speed * k) * dt; }
      m.rot = phase === "RUN" ? Math.atan2(cx, cz) : Math.atan2(dx, dz);
      if (phase === "HIDE") ai.hideLeft = Math.max(0, (ai.hideLeft ?? 0) - dt);
      m.cool -= dt;
      if (phase === "PEEK" && cd < 0.6) engage();
      else if (phase === "RUN") m.cool = Math.max(m.cool, 0.4);
    } else if (aiState === "ALERT" && ai.coverTime > 1.2) {
      // break line of fire: sprint to cover, no shooting while relocating
      const cx = ai.coverX - m.x, cz = ai.coverZ - m.z, cd = Math.hypot(cx, cz);
      if (cd > 1.5) { m.x += (cx / cd) * speed * 1.25 * dt; m.z += (cz / cd) * speed * 1.25 * dt; m.rot = Math.atan2(cx, cz); }
      else m.rot = Math.atan2(dx, dz);
      m.cool = Math.max(m.cool, 0.4);
    } else if (aiState === "ALERT") {
      const i = sim.machines.indexOf(m);
      const nowT = performance.now() / 1000;
      const role = squadRole(i, m.elite, m.boss);
      // the player has gone to ground (enemy-tactics.ts): lob a grenade over the cover at where they were last seen…
      if (!scripted && throwsGrenades(m.kind) && (m.hiddenFor ?? 0) >= GRENADE_AFTER && d >= GRENADE.minRange && d <= GRENADE.maxRange
        && sim.grenades.length < GRENADE.maxLive && sim.grenadeCool <= 0 && nowT >= (m.grenadeAt ?? 0) && (m.aim ?? 0) <= 0) {
        const feetG = walkHeight(m.x, m.z), guess = { x: px + (Math.random() - 0.5) * 3, z: pz + (Math.random() - 0.5) * 3 };
        const from = { x: m.x, y: feetG + 1.7 * enemyBodyScaleOf(m.scale), z: m.z };
        const v = lobVelocity(from, { x: guess.x, y: walkHeight(guess.x, guess.z), z: guess.z });
        sim.grenades.push({ ...from, vx: v.vx, vy: v.vy, vz: v.vz, fuse: GRENADE.fuse, id: sim.nextGrenadeId++, rest: false });
        sim.grenadeCool = GRENADE.squadCooldown; m.grenadeAt = nowT + GRENADE.ownCooldown;
        m.cool = Math.max(m.cool, 0.9); m.rot = Math.atan2(dx, dz);
        if (d < 26) alert(sim, "GRENADE — move!");
      }
      // …and send a couple of troopers round the side to find a line on them
      if (!m.flank && !scripted && !m.boss && role !== "LEADER" && (m.hiddenFor ?? 0) >= FLANK_AFTER && ai.peekX === undefined) {
        const running = sim.machines.filter((o) => o.alive && o.flank && o.flank.until > nowT).length;
        if (running < MAX_FLANKERS) {
          const spot = findFlankSpot(m.x, m.z, { x: px, y: playerEye, z: pz }, i % 2 ? 1 : -1, { ground: walkHeight, obstaclesNear: queryObstacles, solids: registeredModelSolids() });
          if (spot) m.flank = { ...spot, until: nowT + FLANK_GIVE_UP };
        }
      }
      if (m.flank && (nowT > m.flank.until || m.los?.clear || Math.hypot(m.flank.x - m.x, m.flank.z - m.z) < 1.5)) m.flank = undefined;
      if (m.flank) {
        // running the flank: move round to the spot, guns up, firing the moment there is a line
        const fx = m.flank.x - m.x, fz = m.flank.z - m.z, fd = Math.hypot(fx, fz) || 1;
        m.x += (fx / fd) * speed * 1.15 * dt; m.z += (fz / fd) * speed * 1.15 * dt;
        m.rot = Math.atan2(fx, fz);
        m.cool -= dt;
        if (m.los?.clear) { m.rot = Math.atan2(dx, dz); engage(); }
      } else {
      // squad role + threat drive positioning instead of a straight chase
      // authored attack & movement patterns (enemy-patterns.ts): charges, leaps, strafing, blinks, shells; a kind with none uses the squad roles
      const drv = !scripted ? drivePattern(sim, m, i, { d, dx, dz, dt, speed, time: nowT, yaw: input.yaw, playerHp: sim.hp / 100 }) : null;
      if (drv) {
        m.cool -= dt;
        if (drv.fire) engage();
      } else {
      const move = squadMove(role, d, sim.hp / 100, sim.combatHeat, nowT + i, sim.mods.squadArchetype, sim.mods.rangedHoldFire, sim.mods.branchPosture);
      const nx = dx / d, nz = dz / d;
      m.x += (nx * move.forward + -nz * move.strafe) * speed * dt;
      m.z += (nz * move.forward + nx * move.strafe) * speed * dt;
      m.rot = Math.atan2(dx, dz);
      m.cool -= dt;
      engage();
      }
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
      if (d > 260 && !m.mission && !m.living) m.alive = false; // live playtest: a respawn 1 km away leashed the dock wave away and the mission counted it as cleared
    }
    // knockback from impacts, damped frame-rate independently
    // bosses are heavy: knockback barely moves them (under sustained fire every bullet's shove added up to ~20 m/s and
    // carried a boss out of its own fight, beyond ENGAGE_RANGE, so it never attacked; see boss-poise.ts BOSS_KNOCK_MASS)
    const mass = m.boss ? BOSS_KNOCK_MASS : 1;
    m.x += (m.kx / mass) * dt;
    m.z += (m.kz / mass) * dt;
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
       defeatMachine(sim, m, envCredit(m)); // dying to a collision with a tree, wreck or another machine is nobody's kill unless the player had just hurt it
      continue;
    }
    if (m.swimY !== undefined && heightAt(m.x, m.z) < WATER_LEVEL - 2) {
      // swimmers stay submerged: between the seabed and just under the surface
      const bed = heightAt(m.x, m.z) + 1.5;
      m.y += (Math.max(bed, Math.min(WATER_LEVEL - 1.5, m.swimY)) - m.y) * Math.min(1, dt * 2);
    } else m.y = Math.max(walkHeight(m.x, m.z), stormGroundAt(m.x, m.z, m.y - 2.2 * m.scale), liveDescentGroundAt(m.x, m.z, m.y - 2.2 * m.scale)) + 2.2 * m.scale; // Storm Islands' caps hold their guardians up
  }

  // ---------- subclass-verb volatile zones (Void Warlock's Corrosion Field, see subclass-verbs.ts) ----------
  if (sim.volatileZones.length) {
    const nowSec = performance.now() / 1000;
    sim.volatileZones = sim.volatileZones.filter((zone) => zone.until > nowSec);
    for (const zone of sim.volatileZones) {
      for (const m of sim.machines) {
        if (!m.alive) continue;
        if (Math.hypot(m.x - zone.x, m.z - zone.z) <= zone.radius) {
          markPlayerDamage(m);
          m.hp -= zone.dps * dt;
          if (m.hp <= 0) defeatMachine(sim, m);
        }
      }
    }
  }

  stepBeacons(sim, dt, px, pz);
  stepGadgets(sim, dt, px, pz, playerEye);
  stepEnemyGrenades(sim, dt, px, pz, playerEye);

// stealth: surviving close to hostiles without opening fire
  if (!input.inVehicle && hostileNear > 0 && sim.combatHeat < 2) {
    logBehavior(sim.adaptation, "stealth", dt * 0.8 * hostileNear);
  }

  // ---------- sanctuaries (forge, owned garages): hostiles are shoved out, no burn, no kills ----------
  for (const sz of sim.sanctuaries) {
    for (const m of sim.machines) {
      if (!m.alive) continue;
      const dx = m.x - sz.x, dz = m.z - sz.z, d = Math.hypot(dx, dz) || 0.001;
      if (d >= sz.radius) continue;
      const push = sz.radius - d + 0.5;
      m.x += (dx / d) * push; m.z += (dz / d) * push;
    }
  }

  // ---------- safe-zone stability field ----------
  // enemies can never enter a friendly safe zone: the field shoves them back
  // out across the boundary and burns their armour while they touch it.
  // Scripted mission/tutorial machines are exempt: they are placed on purpose and the
  // mission or tutorial step waits on the player killing them (a field kill pays no kill).
  for (const z of sim.zones) {
    const r = z.region;
    if ((r.kind !== "safe" && r.kind !== "starter") || z.owner !== "vanguard") continue;
    for (const m of sim.machines) {
      if (!m.alive || m.mission) continue;
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
         defeatMachine(sim, m, "world");
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
        target.hp -= applyMachineDamageMods(sim, target, RIFT_TURRET_DAMAGE, "KINETIC", px, pz);
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
      if (!m.alive || m.living) continue; // Living World events are the player's (and the city patrols') fight, not the hub turrets'
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
       defeatMachine(sim, best, "world");
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

  // ---------- element statuses: burn ticks (regular enemies only), expiry, dead-slot cleanup ----------
  {
    const nowS = performance.now() / 1000;
    for (const [m, st] of sim.statuses) {
      if (!m.alive) { sim.statuses.delete(m); continue; }
      const d = burnDamage(st, nowS, dt);
      if (d > 0) { m.hp -= d; defeatMachine(sim, m, envCredit(m, 12)); }
      else if (st.burnUntil <= nowS && st.chillUntil <= nowS && st.shockReadyAt <= nowS) sim.statuses.delete(m);
    }
  }

  // ---------- launcher rounds ----------
  for (const r of sim.rounds) {
    if (!r.alive) continue;
    const tm = r.target >= 0 ? sim.machines[r.target] : undefined;
    const ry0 = r.y;
    let burst = stepRound(r, dt, tm && tm.alive ? { x: tm.x, y: tm.y + 1, z: tm.z } : null, heightAt);
    // a rocket, missile or shell that dives into the sea bursts on the surface (torpedoes are made for the water)
    if (!burst && r.alive && r.def.domain !== "WATER" && ry0 >= WATER_LEVEL && r.y < WATER_LEVEL && heightAt(r.x, r.z) < WATER_LEVEL - 0.3) {
      r.y = WATER_LEVEL;
      burst = { x: r.x, y: WATER_LEVEL, z: r.z, radius: r.def.splashRadius, damage: r.def.damage, reason: "GROUND" };
      logImpact(sim, { x: r.x, y: WATER_LEVEL, z: r.z, vx: r.dx * r.def.speed, vz: r.dz * r.def.speed }, "water");
    }
    if (!burst && r.alive && collideBody(r, 0.5, 70, 0.3).hit) burst = { x: r.x, y: r.y, z: r.z, radius: r.def.splashRadius, damage: r.def.damage, reason: "PROXIMITY" };
    if (!burst && r.alive && r.y - heightAt(r.x, r.z) < 8) {
      for (const m of sim.machines) {
        if (m.alive && Math.hypot(m.x - r.x, m.z - r.z) < 2.6 * m.scale) { burst = { x: r.x, y: r.y, z: r.z, radius: r.def.splashRadius, damage: r.def.damage, reason: "PROXIMITY" }; break; }
      }
    }
    if (!burst && r.alive && r.y - heightAt(r.x, r.z) < 8) {
      for (const tr of sim.trucks) {
        if (tr.alive && Math.hypot(tr.x - r.x, tr.z - r.z) < 3.6) { burst = { x: r.x, y: r.y, z: r.z, radius: r.def.splashRadius, damage: r.def.damage, reason: "PROXIMITY" }; break; }
      }
    }
    if (burst) detonateRound(sim, r, burst, px, pz);
  }

  // ---------- bullets ----------
  for (const b of sim.bullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    // a round fired from above that crosses the sea surface this step stops there in a splash (rounds fired underwater by
    // a diver started below the surface and keep going: underwater-combat.ts slows them instead)
    {
      const y0 = b.y - b.vy * dt;
      if (y0 >= WATER_LEVEL && b.y < WATER_LEVEL && heightAt(b.x, b.z) < WATER_LEVEL - 0.3 && !bodyOnPath(sim, b, dt)) {
        const k = (y0 - WATER_LEVEL) / Math.max(1e-6, y0 - b.y); // fraction of the step before the surface
        b.x -= b.vx * dt * (1 - k); b.z -= b.vz * dt * (1 - k); b.y = WATER_LEVEL;
        b.alive = false;
        logImpact(sim, b, "water");
        continue;
      }
    }
    // a round that met a body on its way down this step hits the body, not the dirt at its feet (resolved below)
    if (b.y < heightAt(b.x, b.z) + 0.35 && !bodyOnPath(sim, b, dt)) {
      b.alive = false;
      logImpact(sim, b, "ground");
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
      logImpact(sim, b, "cover");
      continue;
    }
    // wildlife (gore.ts): a round that meets an animal stops there and drops it; no credit, loot or heat
    if (sim.fauna.length) {
      let struck = false;
      for (const f of sim.fauna) {
        if (f.r <= 0 || segmentHitsBody(b.x - b.vx * dt, b.y - b.vy * dt, b.z - b.vz * dt, b.x, b.y, b.z, f.x, f.z, f.r, f.y - f.r, f.y + f.r) < 0) continue;
        b.alive = false; struck = true;
        const sp = Math.hypot(b.vx, b.vz) || 1;
        logGore(sim, { kind: "KILL", blood: critterBlood(f.species), cause: b.cause ?? "BULLET", x: f.x, y: f.y, z: f.z, dx: b.vx / sp, dz: b.vz / sp, power: 0.8, size: Math.max(0.35, f.r), critter: f.id });
        sim.faunaHits.push(f.id);
        f.r = -1; // one round per animal
        break;
      }
      if (struck) continue;
    }
    for (const m of sim.machines) {
      if (!m.alive) continue;
      // the body is a standing cylinder (feet to head, a generous 1.5 m x scale radius) and the round is the segment it
      // travelled this step: the old flat 3.4 m circle ignored height and direction (a shot into the sky, or from a
      // helicopter 100 m up, killed a grunt below) and fast rounds stepped straight through targets
      const half = Math.hypot(b.vx, b.vz) * dt * 0.5;
      if (Math.hypot(m.x - (b.x - b.vx * dt * 0.5), m.z - (b.z - b.vz * dt * 0.5)) > half + Math.max(1, 1.5 * m.scale)) continue; // cheap reject
      const c = bodySpan(m); // feet on the ground under it (or a storm cap it stands on); swimmers hold their own depth
      const t = segmentHitsBody(b.x - b.vx * dt, b.y - b.vy * dt, b.z - b.vz * dt, b.x, b.y, b.z, m.x, m.z, c.r, c.feet, c.top);
      // a round that starts inside the generous body radius only hits a body that is ahead of it (never one at your back)
      if (t === 0 && ((m.x - (b.x - b.vx * dt)) * b.vx + (m.z - (b.z - b.vz * dt)) * b.vz) / (Math.hypot(b.vx, b.vz) || 1) < -0.75) continue;
      if (t >= 0) {
        b.alive = false;
        // report the strike where it met the body, not where the step ended
        b.x -= b.vx * dt * (1 - t); b.y -= b.vy * dt * (1 - t); b.z -= b.vz * dt * (1 - t);
        logImpact(sim, b, "machine");
        let dmg = sim.mods.bulletDamage * sim.buildDamage * b.dmg * sim.verbDamageMult;
        if (sim.equippedElement !== "KINETIC") dmg += 0.35;
        // weapon-meta.ts: the gun's range band, a head-band hit's precision multiplier and the class's signature weapons
        if (b.weapon) {
          // the head band of the drawn body (bodySpan pads the collider 0.2 m under the feet); bosses have their own weak points
          const precision = !m.boss && hitPart(b.y, c.feet + 0.2, 1.85 * enemyBodyScaleOf(m.scale)) === "HEAD";
          dmg *= hitMultiplier(b.weapon, { distance: Math.hypot(m.x - (b.ox ?? m.x), m.z - (b.oz ?? m.z)), precision, cls: sim.operatorClass });
          if (precision) sim.lastCrit = performance.now();
        }
        if (sim.equippedEvolution) { const st = sim.statuses.get(m); dmg *= evolutionDamageMult(sim.equippedEvolution, !!st && isChilled(st, performance.now() / 1000)); }
        if (sim.runes.bursts.length || sim.runes.devour || sim.runes.rift || sim.runes.awakened) dmg *= runeDamageMult(sim, m);
        if (sim.foundry === "HAKKE" && (m.elite || m.boss)) dmg *= FOUNDRY_RULES.hakkeArmored; // foundries.ts: Wall-Piercer
        const bulletElement = b.element ?? sim.equippedElement;
        const chain = registerSimChainHit(sim, m, {
          id: `hit:${sim.nextChainHitId++}`, sourceId: "local-operator",
          element: bulletElement, at: performance.now(),
        });
        dmg = applyMachineDamageMods(sim, m, resolveChainDamage(dmg, chain), bulletElement, px, pz);
        m.hp -= dmg;
        markGoreHit(sim, m, b.vx, b.vz, dmg, b.cause ?? "BULLET", Math.min(Math.max(b.y, m.y - 2.2 * m.scale + 0.4), m.y - 2.2 * m.scale + 1.7 * enemyBodyScaleOf(m.scale)));
        if (b.element) applyWeaponElement(sim, m, b.element);
        if (sim.equippedEvolution) evolutionHit(sim, m, dmg, px, pz);
        if (sim.runes.bursts.length) runeHits(sim, m, dmg, px, pz);
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
            sim.nullPulse = { id: (sim.nullPulse?.id ?? 0) + 1, x: m.x, z: m.z, radius: NULL_PULSE_RADIUS, at: nowS };
            alert(sim, "NULL DISRUPTION — pulse released");
          }
        }
        if (sim.equippedPerk === MAW_PERK) {
          const nowS = performance.now() / 1000;
          const r = registerMawHit(sim.maw, { now: nowS, eventId: sim.nextHitId++ });
          sim.maw = r.state;
          if (r.collapse) {
            for (const other of sim.machines) {
              if (!other.alive || other === m) continue;
              const e = mawEffect(other.x - m.x, other.z - m.z, dmg);
              if (!e) continue;
              other.kx += e.pullX; other.kz += e.pullZ;
              other.hp -= e.damage;
              if (other.hp <= 0) defeatMachine(sim, other);
            }
            sim.mawCollapse = { id: (sim.mawCollapse?.id ?? 0) + 1, x: m.x, z: m.z, at: nowS };
            alert(sim, "MAW COLLAPSE — singularity released");
          }
        }
        // (after the perks read the wind-up) flinch / stagger (enemy-reactions.ts): a stagger knocks a ranged wind-up back to the start (the shot is delayed, the telegraph stays readable) and holds the next attack
        if (!m.rival && !m.decoy) {
          const nowR = performance.now() / 1000, prevR = m.react;
          m.react = reactTo(m.react, { damage: dmg, maxHp: m.maxHp ?? (m.elite ? 7 : 3.5), elite: m.elite, boss: m.boss, now: nowR, dx: m.x - px, dz: m.z - pz, part: hitPart(m.goreHit?.y ?? b.y, m.y - 2.2 * m.scale, 1.85 * enemyBodyScaleOf(m.scale)) });
          if (m.react !== prevR && isStaggeredNow(m.react, nowR)) { if ((m.aim ?? 0) > 0) m.aim = Math.max(m.aim ?? 0, windupFor(m)); stunMachine(m, m.react!.until - nowR + 0.25); }
        }
        if (!b.element && (sim.equippedElement === "CRYO" || sim.equippedElement === "ARC")) m.cool = Math.max(m.cool, sim.equippedElement === "CRYO" ? 0.9 : 0.6);
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
        logImpact(sim, b, "truck");
        damageTruck(sim, tr, sim.mods.bulletDamage);
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

  pinSummons(sim, dt, px, pz);
  endStats(sim.stats, performance.now() - t0);

  return { playerInstability };
}

/** the Thunder Nest's guardian pack (storm-quests.ts): spawned on the island cap, tagged so it is never leashed away */
export function spawnStormGuardians(sim: WorldSim, x: number, z: number, top: number): number {
  const n = spawnEventSquad(sim, "storm:nest", x, z, 6, 2, "frostspire", 10);
  for (const m of sim.machines) if (m.alive && m.living === "storm:nest") m.y = top + 2.2 * m.scale;
  return n;
}
