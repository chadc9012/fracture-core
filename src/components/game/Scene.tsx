import "@/game/venue-doors";
import { accessibleShop } from "@/game/shop-access";
const DISCOVERY_LABEL: Record<string, string> = { flag: "Flag", beacon: "Beacon", patrol: "Patrol", fracture: "Rift Fracture", distress: "Distress Signal", cache: "Cache", movement: "Movement Route", anomaly: "Anomaly" };
const ACTIVITY_REGION: Record<string, string> = { veridan: "veridan", ember: "ember", wastelands: "wastelands", swamps: "swamps", solara: "solara", frostspire: "frostspire", thalassia: "swamps" };
import { nearby as discoveriesNear, triggered as discoveryTriggered } from "@/game/discoveries";
import { RaceCourse } from "./RaceCourse";
import { raceById, raceObstacles, raceSpeedFactor, worldPoint, type RaceRun } from "@/game/racing";
import { novaHint } from "@/game/encounter-journal";
import { stepRun as stepActivity, currentTarget as activityTarget, type ActivityDef, type Run as ActivityRun } from "@/game/activities";
import { renderCounts, setterCalls } from "@/game/perf-counters";
import { createHudGate } from "@/game/hud-gate";
import { Billboard, Environment, Lightformer, Sky, useGLTF } from "@react-three/drei";
import { Text } from "./SafeText";
import { getPin, pinMarker, reached, setPin } from "@/game/map-pin";
import { ARENA_POINT, ARENA_RADIUS, clearRivals, newCrucible, stepRivals, type CrucibleState, type RivalClass } from "@/game/crucible";
import { pointWorld } from "@/game/activities";
import { CoverWall } from "./PropModels";
import { getPerfTier, heavyShadows, NEAR_SCALE, setPerfTier } from "@/game/perf-budget";
import { ruins, isEvolved, isDiscovered, freshCharge, RUIN_DISCOVER_RADIUS, RUIN_REACH } from "@/game/weapon-evolution";
import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, type ComponentProps } from "react";
import * as THREE from "three";
import { softSprite } from "./softSprite";

import { REGIONS, SKY, SKY_STOPS, ZONE_COLOR, clockLabel, phaseFor, regionAt, WORLD_RADIUS, WORLD_SCALE, NEON_FLAT } from "@/game/world";
import { BASE_FOOT_SPEED, SPRINT_MULT } from "@/game/foot-speed";
import { useKeyboard } from "@/game/useKeyboard";
import { touch, getEquippedBoots, activeBuffs, dashHud, dragoniteHud } from "@/game/client-input";
import { buffEffect } from "@/game/stash";
import { bootStats, SKATE_SHOP_OFFSET, SKATE_SHOP_RADIUS } from "@/game/skate-boots";
import { walkHeight, slopeAt, heightAt, waterNetwork, WATER_LEVEL } from "@/game/terrain";
import { normalizeGore } from "@/game/gore";
import { inSwordArc } from "@/game/melee-arc";
import { aimFor, armamentFor, vehiclePoint, vehicleVelocity, type VehicleGun } from "@/game/vehicle-weapons";
import { ordnanceById } from "@/game/ordnance";
import { MuzzleFlash, type MuzzleFlashState } from "./VehicleGunFx";
import { GoreFx } from "./GoreFx";
import { waterMix } from "@/game/water-audio";
/** water audio is eased in the audio graph, so it only needs a pose update ~8x/s */
let lastWaterAudioAt = 0;
import { flavorFor } from "@/game/audio-design";
import { alert, applyLightning, chipPlayer, collidePlayer, createSim, defeatMachine, logImpact, markGoreHit, fireOrdnance, applyMachineDamageMods, FACTIONS, fireBullet, fireLauncher, hurtPlayer, throwBeacon, instabilityTier, spawnMissionDrones, spawnEventSquad, spawnStormGuardians, stepSim, summonBoss, summonScenarioBoss, type Faction, type InstabilityTier, type WorldSim, type ZoneState } from "@/game/sim";
import type { MissionEvent, MissionRun } from "@/game/missions/broken-signal";
import type { MissionEvent as BlackoutEvent, MissionRun as BlackoutRun } from "@/game/missions/blackout-protocol";
import type { MissionEvent as NeonCoreEvent, MissionRun as NeonCoreRun } from "@/game/missions/stitched-neon-core";
import type { MissionEvent as CoreNodeEvent, MissionRun as CoreNodeRun } from "@/game/missions/core-node";
import { ZONE_MISSIONS, ZONE_MISSION_IDS, zoneSite, type MissionEvent as ZoneEvent, type MissionRun as ZoneRun, type ZoneMissionId } from "@/game/missions/zone-missions";
import { arraySite, type MissionEvent as ArrayEvent, type MissionRun as ArrayRun } from "@/game/missions/solar-array";
import { relaySite, type MissionEvent as RelayEvent, type MissionRun as RelayRun } from "@/game/missions/drowned-relay";
import type { MissionEvent as DescentEvent, MissionRun as DescentRun } from "@/game/missions/descent-protocol";
import type { MissionEvent as SystemCoreEvent, MissionRun as SystemCoreRun } from "@/game/missions/system-core";
import { introCameraAt } from "@/game/intro-camera";
import type { AwakeningEvent, AwakeningRun } from "@/game/missions/awakening";
import { directorTrend, type Mission } from "@/game/director";
import { isStaggered, isWeakPointOpen, POISE_MAX } from "@/game/boss-poise";
import { tuningFor } from "@/game/boss-phases";
import { counterTuningFor, dominantPattern, logAction, type ActionLogEntry, type PlayerAction } from "@/game/boss-adaptive-ai";
import { Terrain } from "./Terrain";
import type { SkyEnv } from "./CloudLayer";
import { Weather } from "./Weather";
import { weatherName as weatherLabel } from "@/game/weather-cycle";
import { environmentAt, stepEnvironment } from "@/game/environment";
import { backpackFor } from "@/game/backpacks";
import { createReticle, markHit, stepReticle, type Motion, type ReticleView, EMPTY_RETICLE } from "@/game/crosshair";
import { createGrind, isGrinding, leaveGrind, stepGrind, tryLatch, worldRails } from "@/game/maggrind";
import { CLIMB_MAX, createTraversal, MANTLE_MAX, restTraversal, startTraversal, stepTraversal } from "@/game/traversal";
import { VyrakClueSites } from "./VyrakClueSites";
import { VYRAK_CLUE_SITES, lairRevealed, nearClueSite, nearHiddenLair } from "@/game/vyrak-site";
import { createPersonality, furyBonus, maybeIdle, react as vyrakReact, stepMood as vyrakStepMood } from "@/game/vyrak-personality";
import { createDragoniteRuntime, castDragonite, stepDragonite, statsFor as dragoniteStatsFor } from "@/game/dragonite-cast";
import { DRAGONITE_IDS, DRAGONITE } from "@/game/dragonite";
import { DASHES, createDashState, dashHit, dashStats, hoverVy, stepDash, tryDash } from "@/game/dash";
import { airJump, cameraDrop, cancelSlide, createMoveState, glideVy, GLIDE_THRUST, land, movementFov, resolveStance, startSlide, stepSlide, stepStance, AIR_PROFILE, STANCE_SPEED, SLIDE_SECONDS, type Stance } from "@/game/movement";
import { loadoutEffects } from "@/game/armor-attributes";
import { armorLook } from "@/game/armor-look";
import { createStride, stepStride, RUN_SPEED, type FeelView } from "@/game/movement-feel";
import { updateWind } from "@/game/wind-sway";
import { waterStyleAt } from "@/game/water-style";
import { atmosphereAt, cityNightFill, cityPresence, INSTABILITY_FOG, instabilityBleed, NEUTRAL_ATMOSPHERE, type Atmosphere } from "@/game/atmosphere";
import { closeStratagems, createStratagemState, inputDirection, openStratagems, releaseStratagems, stratagemById, stratagemHud, tickStratagems, type StratagemHud } from "@/game/stratagems";
import { Wildlife } from "./Wildlife";
import { Civilians } from "./Civilians";
import { Bullets, BeaconMarkers, Convoys, HazardMarkers, SupplyLanes, WarMachines, ZoneBeacons } from "./Actors";
import { BulletImpacts } from "./BulletFx";
import { Roads } from "./Roads";
import { RoadDressing } from "./RoadDressing";
import { ScenarioBosses } from "./ScenarioBosses";
import { NullPulseFx } from "./NullPulseFx";
import { AbilityFx } from "./AbilityFx";
import { ShardGainFx } from "./ShardGainFx";
import { SkylineLookout } from "./SkylineLookout";
import { Squad } from "./Squad";
import { CoreNodePod } from "./CoreNodePod";
import { ThalassiaSectors } from "./ThalassiaSectors";
import { LavaTrench, WreckField } from "./SetPieces";
import { EmberPeaks } from "./EmberPeaks";
import { SolaraDesert } from "./SolaraDesert";
import { FrostspireDressing } from "./FrostspireDressing";
import { SwampDressing } from "./SwampDressing";
import { WastelandsDressing } from "./WastelandsDressing";
import { CombatFx } from "./CombatFx";
import { fxBus } from "@/game/fx-bus";
import { launch, zoneElement } from "@/game/combat-fx";
import { ejectCasing } from "@/game/casings";
import { EncounterFx } from "./EncounterFx";
import { COMBAT_FEEDBACK, impactFor, rumble } from "@/game/combat-feedback";
import { encounterFor } from "@/game/scenario-encounters";
const feedbackPad = () => (typeof navigator !== "undefined" && navigator.getGamepads ? Array.from(navigator.getGamepads()).find(Boolean) ?? null : null);
import { raceLive } from "./NeonDistricts";
import { RACE_BEST_KEY, RACE_GATES, RACE_IDLE, raceReward, stepRace, type RaceState } from "@/game/neon-districts";
import { VAELITH, VAELITH_LAIR, dialogueDue, lairDefenseCleared, memoryNear, startLairDefense, vaelithFightable, type StoryWorldEvent } from "@/game/vaelith";
import { EMPTY_STORY, stageOf } from "@/game/story";
import { bossStoryFor, introDue, vaultNear, type BossStoryId } from "@/game/boss-stories";
import { NexusCity } from "./NexusCity";
import { NeonCity, NEON_CITY_CENTER } from "./NeonCity";
import { CityStreets } from "./CityStreets";
import { Thalassia, THALASSIA_CENTER } from "./Thalassia";
import { Water } from "./Water";
import { Operator } from "./Operator";
import { OperatorModel, OPERATOR_MODELS } from "./OperatorModel";
import { Interior } from "./Interior";
import { WorldMarkers } from "./WorldMarkers";
import { buildInterior, applyDamage, hitTest, stepDebris, STRUCTURE_MULT } from "@/game/destruction";
import { scenarioById } from "@/game/unique-scenarios";
import { BOSS_LAIRS, SCENARIO_LAIRS, GATHER_RADIUS, LAIR_RADIUS, RESOURCE_SITES, RESPAWN_SECONDS, regionCenter, track, type Marker, type TrackedMarker } from "@/game/waypoints";
import type { InspectorView } from "./Inspector";
import { TIER_RADII } from "@/game/lod";
import { RARITY_COLOR, type Rarity } from "@/game/loot";
import { appearanceById, classById, subclassById, type AppearanceDefinition, type ClassId, type SubclassId } from "@/game/loadout";
import { handlingFor, stepVehicle, canExitVehicle, vehicleCamera } from "@/game/vehicle-handling";
import { surfaceAt, surfaceGrip } from "@/game/vehicle-surface";
import { vehicleById, type VehicleId } from "@/game/vehicles";
import { projectDome, shieldBash } from "@/game/titan";
import { RENDER_PRESETS } from "@/game/performance";
import { branchPosture } from "@/game/branch-effects";
import { activateLiveAbility, createLiveBuild, rebindLiveBuild, tickLiveBuild } from "@/game/live-build";
import { hazardAt, type HazardEffect } from "@/game/region-hazards";
import { zoneAt, combineHazard } from "@/game/hazard-zones";
import { LANDMARKS, isLandmarkKnown } from "@/game/landmarks";
import { RiftTurrets } from "./RiftTurrets";
import { NearOnly } from "./NearOnly";
import { PerfProbe } from "./PerfProbe";
import { OPERATOR_CAMERA, OPERATOR_HEIGHT, type BodyType } from "@/game/operators";
import { SIEGE_BLOOM_MULT, VEIL_BREAK_TIME, siegeMoveMult } from "@/game/operator-abilities";
import type { ActiveBuild } from "@/game/ability-network";
import { buildSynergy } from "@/game/ability-network";
import type { SquadArchetype } from "@/game/adaptation";
import { ADAPTIVE_TUTORIAL_INIT, maybeReteach, recordStruggle } from "@/game/adaptive-tutorial";
import { isValidPlayerState, resetFrameFailureCount, sanitizePlayerState, softFrameFailure } from "@/game/safe-state";
import { difficultyCurve, playerPowerScore } from "@/game/balance";
import type { TutorialEvent, TutorialState } from "@/game/onboarding";
import { CITY_RADIUS, DOCK_DECK_Y, REACTOR_REACH, REBREATHER_DRAIN_SCALE, SECTOR_LABEL, airStationAt, airlockSite, coolantDamage, coolantPhase, dockSite, hullDamagePerSec, hullStressStep, reactorSite, ringWaypoint, sectorAt, type ThalassiaSector } from "@/game/thalassia-sectors";
import { airlockRestored } from "@/game/missions/descent-protocol";
import { underwaterVisibility } from "@/game/underwater";
import { OXYGEN_MAX, WATER_DRAG, applyWaterDrag, classifyUnderwaterState, lowOxygenPenalty, oxygenStep, pressureSpeedMultiplier, stepBuoyancy } from "@/game/underwater";
import { underwaterSpread } from "@/game/underwater-combat";
import { heatStatus, stepHeatMeter } from "@/game/heat";
import { shouldForceFootTransition, vehicleDamageStage, VEHICLE_DAMAGE_EFFECT, type VehicleDamageStage } from "@/game/chase-ai";
import { exitVehicleMomentum, parkourChainBonus, vaultLunge } from "@/game/parkour";
import { anySensorSees, detectionStateFor, lockdownStatus, nexusSensors, stepDetectionMeter, stepHackProgress, type DetectionState, type LockdownTier } from "@/game/stealth";
import { INTERIORS, INTERIOR_ALTITUDE, doorAt, atExitMarker, interiorById, isInteriorOpen, clampHomeLocal, exitPosition } from "@/game/interiors";
import { clampToFloor, registeredModelSolids, roomSolids, solidTopAt, structureSolids, sweepSolids } from "@/game/environment-collision";
import { homeById } from "@/game/housing";
import { HomeInteriors } from "./HomeInteriors";
import { Interiors } from "./Interiors";

import type { GameSettings } from "./SettingsWindow";
import { clampPitch, lookDelta } from "@/game/camera-look";
import { VerdantForest } from "./VerdantForest";
import { LightShafts } from "./LightShafts";
import { CRASH_SITE, ENCOUNTER, NEW_INVESTIGATION, shouldWakePatrol, stepInvestigation } from "@/game/verdant";
import { spawnForestPatrol } from "@/game/forest-encounter";
import { CHECKPOINT_INTERVAL_S, chooseRespawn, isCheckpointSafe } from "@/game/respawn";
import { WEAPONS, WEAPON_ORDER, decay, freshAmmo, type WeaponId } from "@/game/weapons";
import { atSupplyPoint, killRefund, restockAll, trickleRestock } from "@/game/ammo";
import { initialView, stepView, viewPose, type ViewPose, type ViewState } from "@/game/weapon-handling";
import { ViewWeapon } from "./ViewWeapon";
import { isLauncherId } from "@/game/launchers";
import { acquireTarget, cycleTarget as cycleLockTarget, lockLookAt, newLockState, retainLock, swapShoulder, type LockCandidate } from "@/game/target-lock";
import { DEFAULT_BINDINGS, abilityChord, maskChord, normalizeBindings } from "@/game/bindings";
import type { AbilityHud } from "@/game/ability-effects";
import { abilityHud, cancelAbilities, castAbility, holdDisabledField, syncSimFromLive } from "@/game/ability-effects";
import * as sfx from "@/game/audio";
import { setVoiceLoad } from "@/game/voice-director";
import { RegionLighting } from "./RegionLighting";
import { ShopStalls } from "./ShopStalls";
import { Storefronts } from "./Storefronts";
import { SkyBodies } from "./SkyBodies";
import { SkyDome } from "./SkyDome";
import { BrokenHorizon } from "./BrokenHorizon";
import { NovaDrone } from "./NovaDrone";
import { Wyrmling } from "./Wyrmling";
import { GlitchAnomalies } from "./GlitchAnomalies";
import { GroundCover } from "./GroundCover";
import { coverDensityFor } from "@/game/ground-cover";
import { GrassField } from "./GrassField";
import { assetDetails, getAssetSummary } from "@/game/forest-assets";
import { EmberLightning } from "./EmberLightning";
import { Badlands } from "./Badlands";
import { moonAngle, moonlight } from "@/game/celestial";
import { shopNear } from "@/game/regional-shops";
import { createLivingRuntime, stepLivingRuntime, type LivingEmit, type LivingHud, type LivingRuntime } from "@/game/living-runtime";
import { EMPTY_LIVING } from "@/game/living-world";
import { fallenDistricts } from "@/game/living-events";
import { CHALLENGES } from "@/game/map-activities";
import { HOLLOW_CROWN, VAEL, runeCombat, vaelNear } from "@/game/godforge";
import { fleetById, fleetTuningSummary, garageNear, sanctuariesFor, tunedVehicle, type FleetTuningSummary } from "@/game/fleet";
import { vehicleModelFor } from "@/game/fleet-models";
import { worldLight } from "@/game/world-light";
import { AuthoredVehicle } from "./AuthoredVehicle";
import { SiteMarkers } from "./SiteMarkers";
import { WorldPiece } from "./WorldPiece";
import { StormIslands } from "./StormIslands";
import { STORM_ISLANDS_CENTER, stormSiteById, stormSiteWorld } from "@/game/storm-islands";
import { inStormAirspace, islandTop, sighted, stormGroundAt, stormQuests, stormSiteAt } from "@/game/storm-quests";
import { ResidenceGarages } from "./ResidenceGarages";
import { reportVehicleEnter, reportVehicleExit, takeDriveOut } from "@/game/vehicle-request";
import { deedNear, parkedAt } from "@/game/residence-deeds";
import { conditionEffects, FRESH_VEHICLE, impactVehicle, normalizeCondition, recoverVehicle, type VehicleCondition } from "@/game/vehicle-condition";
import { VehicleDamageFx } from "./VehicleDamageFx";
import { VehicleBodyDamage } from "./VehicleBodyDamage";
import { hashSeed } from "@/game/vehicle-damage-render";
import { driveTelemetry } from "@/game/vehicle-audio";
import { FOUNDRY_RULES, activeBlade, foundryOf, inShockwave, swingStats } from "@/game/foundries";
import { LIVING_NPCS, PLEDGE_KEY, livingMarkers, npcNear, npcWorld } from "@/game/living-npcs";
import { SECRETS, secretPoint, type SecretContext } from "@/game/secrets";
import { LivingCity } from "./LivingCity";
import { WastelandSites } from "./WastelandSites";
import { createWasteRuntime, stepWasteRuntime, type WasteEmit, type WasteHud, type WasteRuntime } from "@/game/wasteland-runtime";
import type { ArmorVisualState } from "./Scavenger";
import type { PlayerProgression } from "@/game/progression";
import { SkyFx, type SkyFxLive } from "./SkyFx";
import { Rivers } from "./Rivers";
import { LootCaches } from "./LootCaches";
import { nearestCache, canOpen, GUARD_RADIUS, ENCRYPT_SECONDS, SCENARIO_LABEL, type CacheRarity } from "@/game/loot-caches";
import { skyFxAt, NO_SKY_FX } from "@/game/sky-effects";
import { COMBAT_STANCE_HOLD, combatStance } from "@/game/combat-stance";
import { weaponDamageMultiplier } from "@/game/inventory";
import { boomClearance } from "@/game/camera-occlusion";
import { FractureStorm } from "./FractureStorm";

export type LootView = { name: string; rarity: Rarity; power: number; mods: string[]; color: string };

export type HudState = {
  region: string;
  /** stable region id (world.ts REGIONS[].id), unlike the display-name `region` field — for systems (like the quest engine) that key off it */
  regionId: string;
  sub: string;
  kind: keyof typeof ZONE_COLOR;
  difficulty: number;
  rules: string[];
  phase: string;
  clock: string;
  speed: number;
  /* systems */
  mode: "foot" | "vehicle";
  vehicle?: { name: string; rpm: number; load: number; reverse: boolean; hull: number; tuning: FleetTuningSummary | null; primary?: string; secondary?: string; secondaryReady?: number };
  owner: Faction;
  challenger: Faction;
  progress: number;
  contested: boolean;
  instability: number;
  gravity: number;
  hp: number;
  credits: number;
  cargo: number;
  kills: number;
  /** the Storm Island under the player (storm-quests.ts), and whether the chain is in sight */
  stormSite?: string | null;
  stormSighted?: boolean;
  elevation: number;
  traction: number;
  alerts: string[];
  threat: number;
  heat: number;
  coreHp: number;
  trend: string;
  missions: Mission[];
  ownership: { id: string; name: string; owner: Faction }[];
  /* gunnery + gear */
  weaponHeat: number;
  overheated: boolean;
  loot: LootView[];
  view: "third" | "first";
  aimLocked: boolean;
  aiming: boolean;
  meleeTime: number;
  weaponName: string;
  weaponSlot: number;
  /* ammo + weapon selection */
  ammo: { id: WeaponId; name: string; mag: number; magSize: number; reserve: number; element?: string }[];
  reloading: number;
  weaponWheel: boolean;
  weaponSwitched: number;
  controller: boolean;
  bloom: number;
  hitMarker: boolean;
  /** dynamic reticle view (crosshair.ts): spread gap, lagging barrel index, hit/kill marker */
  reticle: ReticleView;
  playerClass: ClassId;
  subclassName: string;
  callsign: string;
  abilities: AbilityHud[];
  firstMissionComplete: boolean;
  weather: string;
  /** "Autumn · Dense fog · 14°C" */
  environment: string;
  /** active hazard line (exposure / lightning), "" when none */
  hazardWarning: string;
  hazard?: { name: string; intensity: number; active: boolean } | undefined;
  /** Helldivers-style call-in code entry (stratagems.ts); empty when not in use */
  stratagem: StratagemHud;
  streamTier: string;
  vehicleUnlocked: boolean;
  vehicleName: string;
  vehicleDomain: string;
  vehicleWeapon: string;
  vehicleSeats: number;
  shield: number;
  energy: number;
  stability: number;
  blocking: boolean;
  domeTime: number;
  titanFeedback: string;
  liveEnergy: number;
  liveEffect: string;
  enemyResponse: string;
  momentum: number;
  /* dev inspector */
  inspector: InspectorView | null;
  /* tracking */
  markers: TrackedMarker[];
  px: number;
  pz: number;
  yaw: number;
  structure: { standing: number; total: number; lastEvent: string };
  /* Thalassia-style underwater state — populated any time the player is submerged, not just in Thalassia */
  diving: boolean;
  oxygen: number;
  underwaterState: string;
  depth: number;
  /** Thalassia sector the player is in (thalassia-sectors.ts), hull stress 0..1, coolant cycle phase in the Abyssal Ring, seconds since a sector breach */
  sector: string;
  hullStress: number;
  coolant: string;
  breachAge: number;
  /* Neon City chase system — heat is derived from sim.combatHeat, vehicle stage from sim.hp while in a vehicle */
  heatLevel: number;
  heatLabel: string;
  heatResponse: string;
  vehicleStage: VehicleDamageStage;
  parkourChain: number;
  /* Nexus City stealth/surveillance — only meaningful while inside the Nexus zone, but always populated */
  nexusDetection: DetectionState;
  nexusLockdownTier: LockdownTier;
  nexusLockdownLabel: string;
  nexusLockdownResponse: string;
  hacking: boolean;
  hackProgress: number;
  /* Interior Building system — populated only while insideInterior is set */
  insideInterior: string | null;
  interiorName: string;
  interiorOpen: boolean;
  /** Living World (living-runtime.ts): the city you're in and its live world event */
  living?: LivingHud | null;
  /** fleet.ts: a garage base within reach */
  garageNear?: string | null;
  /** a walk-in residence's front door or garage is right here (residence-deeds.ts) */
  residenceNear?: string | null;
  skateShopNear?: boolean;
  /** wasteland-runtime.ts: the running Wastelands activity (vault defense / rally / derby) */
  waste?: WasteHud;
  /** godforge.ts: Vael is in reach (her forge is open) */
  vaelNear?: boolean;
  /** talkable Living World NPC within reach (living-npcs.ts) */
  npcNear?: { id: string; name: string; title: string } | null;
  /** walk-up regional vendor within reach (regional-shops.ts), null when none */
  shopNearId?: string | null;
  shopNearName?: string;
  /** nearest world loot cache within reach (loot-caches.ts), with whether its scenario lets it open now */
  /** weapon-evolution ruin within discovery range (reach = close enough to evolve) */
  ruinNear?: { id: string; name: string; dist: number; reach: boolean; done: boolean } | null;
  cacheNear?: { id: string; label: string; rarity: CacheRarity; ok: boolean; reason: string; hold: number } | null;
  /** current zone's live instability tier — see sim.ts's instabilityTier(); STABLE unless the zone's own fracture-pulse is actually elevated */
  zoneTier: InstabilityTier;
  /** timestamp of the most recent hull-destroyed respawn (mirrors sim.lastDeath) — GameCanvas watches this to trigger the death screen */
  justDied: number;
  deathCause: string;
  deathCargoLost: number;
  deaths: number;
  /** the currently-engaged boss (regional, Emergency Quest, or Unique Scenario), or null when none is alive */
  bossHud: {
    name: string;
    hpPct: number;
    phaseLabel: string;
    poisePct: number;
    weakPointOpen: boolean;
    staggered: boolean;
    adaptedTell: string;
    scenario: boolean;
  } | null;
  /** Emergency Quest world event — see emergency-quest.ts; null while fully dormant */
  emergencyQuest: { state: "WARNING" | "ACTIVE" | "COMPLETE" | "FAILED"; bossName: string; regionId: string; timer: number } | null;
};

const SPAWN_REGION = REGIONS.find((r) => r.id === "veridan");
/** the bigger map needs a longer view: fog distances grow by about half of the extra scale (1 at the original world; camera far is 1800) */
const VERIDAN_REGION = REGIONS.find((r) => r.id === "veridan")!;
const FOG_REACH = 1 + (WORLD_SCALE - 1) * 0.2;
/** furthest fog line per quality tier (m); HIGH/ULTRA keep the full view */
const FOG_CAP = { LOW: 480, MEDIUM: 700, HIGH: Infinity, ULTRA: Infinity } as const;
export const SPAWN = new THREE.Vector3(SPAWN_REGION?.x ?? -58, 0, (SPAWN_REGION?.z ?? -34) + 12);
const NEXUS_REGION = REGIONS.find((r) => r.id === "nexus")!;

const stops = SKY_STOPS;

function segment(t: number) {
  const h = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < stops.length - 1 && h > stops[i + 1]!.t) i++;
  const a = stops[i]!;
  const b = stops[i + 1] ?? a;
  return { a, b, k: (h - a.t) / Math.max(0.0001, b.t - a.t) };
}

function blend(t: number, field: "top" | "bottom" | "fog" | "light", out: THREE.Color) {
  const { a, b, k } = segment(t);
  return out.set(SKY[a.key][field]).lerp(new THREE.Color(SKY[b.key][field]), k);
}

function intensityAt(t: number) {
  const { a, b, k } = segment(t);
  return THREE.MathUtils.lerp(SKY[a.key].intensity, SKY[b.key].intensity, k);
}

/** 0 = full day, 1 = deep night — drives AI aggression and visibility */
function nightFactor(t: number) {
  const theta = (((t % 1) + 1) % 1) * Math.PI * 2 - Math.PI / 2;
  return Math.min(1, Math.max(0, -Math.sin(theta) * 1.2 + 0.15));
}

/** Region name labels are a landmark seen from outside a region; inside it the HUD already names the region and a
 * camera-facing 52 m-high label just fills the sky (it did at spawn). Hidden while the camera is within `radius`. */
function HideInside({ x, z, radius, children }: { x: number; z: number; radius: number; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  useFrame(({ camera }) => { if (g.current) g.current.visible = Math.hypot(camera.position.x - x, camera.position.z - z) > radius; });
  return <group ref={g}>{children}</group>;
}

/** Labels tint by the zone's live faction owner (FACTIONS[...].color) instead of a static zone-kind
 * color, and append the instability tier when it's above STABLE — the territory-control sim
 * (sim.ts's zones: owner/challenger/contested/instability) already runs every frame, it just never
 * showed up anywhere the player could see it before this. */
function RegionLabels({ zones }: { zones: readonly ZoneState[] }) {
  return (
    <group>
      {REGIONS.map((r) => {
        const zone = zones.find((z) => z.region.id === r.id);
        const tier = instabilityTier(zone?.instability ?? 0);
        const color = zone ? FACTIONS[zone.owner].color : ZONE_COLOR[r.kind];
        return (
          <HideInside key={r.id} x={r.x} z={r.z} radius={r.radius * 0.5}>
          <Billboard position={[r.x, walkHeight(r.x, r.z) + 52, r.z]}>
          <Text
            fontSize={7}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.25}
            outlineColor="#04070d"
          >
            {r.name.toUpperCase()}
            {zone?.contested ? " · CONTESTED" : ""}
            {tier !== "STABLE" ? ` · ${tier}` : ""}
          </Text>
          </Billboard>
          </HideInside>
        );
      })}
    </group>
  );
}

const GOLDEN = new THREE.Color("#ffb06a");
const NOON = new THREE.Color("#fff6ea");
function SceneImpl({
  onHud,
  settings = { aimAssist: true, firstPersonDefault: true, zoneLabels: true, hudDensity: "full", renderTier: "HIGH" },
  onCameraPreference,
  playerClass = "TITAN",
  subclassId = "SHIELD_TITAN",
  bonded = false,
  appearance: appearanceProp,
  bodyType,
  vehicleId = "scrap-interceptor",
  vehicleUnlocked = false,
  armorState = "STABLE",
  activeBuild,
  abilityBranches = {},
  tutorial,
  onTutorialEvent,
  onDrops,
  onStoryEvent,
  onEncounterClue,
  activity,
  onActivityChange,
  onDiscovery,
  vyrakRematch,
  onVyrakRematch,
  onLiving,
  onVehicleCondition,
  onWaste,
  summonNemesis = null,
  gear,
  mission,
  onMissionEvent,
  relay,
  onRelayEvent,
  blackout,
  onBlackoutEvent,
  neonCore,
  onNeonCoreEvent,
  solarArray,
  onSolarArrayEvent,
  coreNode,
  onCoreNodeEvent,
  zoneRuns,
  onZoneEvent,
  descent,
  onDescentEvent,
  systemCore,
  onSystemCoreEvent,
  awakening,
  onAwakeningEvent,
  onXP,
  weaponOrder = WEAPON_ORDER,
  travelTo = null,
  onCheckpoint,
  introPlayback,
  openedCaches = [],
}: {
  /** cache ids already opened today (hidden in the world) */
  openedCaches?: string[];
  onHud: (s: HudState) => void;
  settings?: GameSettings;
  onCameraPreference?: (firstPerson: boolean) => void;
  playerClass?: ClassId;
  subclassId?: SubclassId;
  /** dragon-covenant.ts: the active class won Vyrak's Covenant — render the Wyrmling companion */
  bonded?: boolean;
  /** Fully-resolved field colors + callsign (preset or freely customized in the Identity Forge) —
   * session-local only, never synced to player_saves. */
  appearance?: AppearanceDefinition;
  bodyType?: BodyType | undefined;
  vehicleId?: VehicleId;
  vehicleUnlocked?: boolean;
  armorState?: ArmorVisualState;
  activeBuild: ActiveBuild;
  abilityBranches?: Record<string, string>;
  tutorial?: TutorialState | null;
  onTutorialEvent?: (event: TutorialEvent) => void;
  onDrops?: (drops: WorldSim["drops"]) => void;
  /** story scenarios (vaelith.ts): lair entry, memory pickups, trial survived, lair defence cleared; the handler applies them with pure reducers */
  onStoryEvent?: (event: StoryWorldEvent) => void;
  /** an encounter clue was found in the world (encounter-journal.ts); the host records it and returns nothing */
  onEncounterClue?: (encounterId: string, clueId: string) => void;
  /** activities.ts: the run in progress (mutated here each frame) and a notifier when its stage/progress/status changes */
  activity?: { def: ActivityDef; run: ActivityRun } | null;
  onActivityChange?: () => void;
  /** the player walked into a discovery; the host starts it through the same activity pipeline as the board */
  onDiscovery?: (discoveryId: string) => void;
  /** Vyrak rematch (activities.ts VYRAK_REMATCH): a bonded Operator may re-summon the Sky Sovereign only while this is true; the host spends the attempt */
  vyrakRematch?: boolean;
  onVyrakRematch?: () => void;
  /** Living World outcomes (city kills, event results, survey/stash reached); GameCanvas applies them to progression */
  onLiving?: (event: LivingEmit) => void;
  onVehicleCondition?: (id: string, condition: VehicleCondition) => void;
  /** Wastelands activity results (wasteland-runtime.ts); GameCanvas resolves them into the save */
  onWaste?: (event: WasteEmit) => void;
  gear?: Pick<PlayerProgression, "inventory" | "equippedGear" | "dungeonClears" | "completedMissions" | "story" | "earnedRewards" | "missionRuns"> & Partial<Pick<PlayerProgression, "living" | "challenge" | "nemeses" | "fleet" | "blade" | "vehicleConditions" | "nexLedger" | "housing" | "fractureShards">>;
  /** nemesis.ts: a nemesis the player picked on the map; it ambushes right after arrival */
  summonNemesis?: string | null;
  mission?: MissionRun | null;
  onMissionEvent?: (event: MissionEvent) => void;
  relay?: RelayRun | null;
  onRelayEvent?: (event: RelayEvent) => void;
  blackout?: BlackoutRun | null;
  onBlackoutEvent?: (event: BlackoutEvent) => void;
  neonCore?: NeonCoreRun | null;
  onNeonCoreEvent?: (event: NeonCoreEvent) => void;
  solarArray?: ArrayRun | null;
  onSolarArrayEvent?: (event: ArrayEvent) => void;
  coreNode?: CoreNodeRun | null;
  onCoreNodeEvent?: (event: CoreNodeEvent) => void;
  zoneRuns?: Partial<Record<ZoneMissionId, ZoneRun>>;
  onZoneEvent?: (id: ZoneMissionId, event: ZoneEvent) => void;
  descent?: DescentRun | null;
  onDescentEvent?: (event: DescentEvent) => void;
  systemCore?: SystemCoreRun | null;
  onSystemCoreEvent?: (event: SystemCoreEvent) => void;
  awakening?: AwakeningRun | null;
  onAwakeningEvent?: (event: AwakeningEvent) => void;
  onXP?: (event: WorldSim["xpEvents"][number]) => void;
  /** active class loadout: weapon slot order for keys 1-3, cycling and HUD */
  weaponOrder?: WeaponId[];
  /** star map deployment target; nonce changes trigger the drop */
  travelTo?: { x: number; z: number; nonce: number; y?: number } | null;
  onCheckpoint?: (p: { x: number; z: number }) => void;
  /** Opening cinematic: while set, the camera follows intro-camera.ts's scripted flythrough
   * instead of the normal player follow-cam — IntroCinematic.tsx's overlay fades out over this
   * same window, so this is the literal "world reveal" the player sees underneath it. */
  introPlayback?: { elapsed: number; totalSeconds: number } | null;
}) {
  /** the running activity, for dev hooks registered once (window.__dev.race) */
  const activityLive = useRef(activity); activityLive.current = activity;
  renderCounts.scene++;
  const orderRef = useRef(weaponOrder); orderRef.current = weaponOrder;
  const travelSeen = useRef(0);
  const checkpoint = useRef<{ x: number; z: number } | null>(null);
  const checkpointClock = useRef(0);
  // last simulated body position, for swept collision; door entry/exit is a teleport, not a sweep across the world
  const prevBodyPos = useRef<{ x: number; z: number; interior: string | null } | null>(null);
  const keys = useKeyboard();
  const sim = useMemo<WorldSim>(() => createSim(), []);
  const livingRt = useRef<LivingRuntime | null>(null);
  const wasteRt = useRef<WasteRuntime | null>(null);
  const wasteHud = useRef<WasteHud>(null);
  // fleet.ts / godforge.ts: Vael's opened forge and owned garage bases are small sanctuaries (sim.ts pushes hostiles out)
  const sanctuaries = useMemo(() => sanctuariesFor({ earnedRewards: gear?.earnedRewards ?? [], fleet: gear?.fleet }), [gear?.earnedRewards, gear?.fleet]);
  const stormNest = useRef(false);
  const gearLive = useRef(gear); gearLive.current = gear; // dev hooks read the latest save, not the one at mount
  const runeKeyRef = useRef("");
  const relicIdRef = useRef<string | null>(null);
  const livingHud = useRef<LivingHud | null>(null);
  const livingThreats = useRef<{ x: number; z: number }[]>([]);
  const livingFallen = useMemo(() => fallenDistricts({ living: gear?.living ?? EMPTY_LIVING }, Date.now()), [gear?.living]);
  const livingMarks = useMemo(() => (gear ? livingMarkers({ ...(gear as PlayerProgression), living: gear.living ?? EMPTY_LIVING }) : []), [gear]);
  // Global Balance Controller: recomputed only when equipped gear/clears/missions actually change,
  // not every frame — the frame loop just assigns the (already-cheap) result into sim.mods below.
  const balance = useMemo(() => difficultyCurve(playerPowerScore({ inventory: gear?.inventory ?? [], equippedGear: gear?.equippedGear ?? {}, dungeonClears: gear?.dungeonClears ?? {}, completedMissions: gear?.completedMissions ?? [] } as Parameters<typeof playerPowerScore>[0])), [gear?.inventory, gear?.equippedGear, gear?.dungeonClears, gear?.completedMissions]);
  // Equipped chest/helmet/legs upgrade levels -> Operator's real armor-geometry tiers (tierOf()
  // in Operator.tsx), so gearing up actually changes the model, not just its tint.
  const armorLevels = useMemo(() => ({
    chest: gear?.inventory.find((item) => item.id === gear.equippedGear.chest)?.level ?? 1,
    helmet: gear?.inventory.find((item) => item.id === gear.equippedGear.helmet)?.level ?? 1,
    legs: gear?.inventory.find((item) => item.id === gear.equippedGear.legs)?.level ?? 1,
  }), [gear?.inventory, gear?.equippedGear]);
  const worn = useMemo(() => armorLook({ inventory: gear?.inventory ?? [], equippedGear: gear?.equippedGear ?? {} }, playerClass), [gear?.inventory, gear?.equippedGear, playerClass]);
  // Equipped armor-set bonuses (armor-sets.ts): recomputed only when gear changes; the frame loop reads the ref.
  const armorFx = useMemo(() => loadoutEffects({ inventory: gear?.inventory ?? [], equippedGear: gear?.equippedGear ?? {} }), [gear?.inventory, gear?.equippedGear]);
  const armorFxRef = useRef(armorFx);
  armorFxRef.current = armorFx;
  const missionSpawned = useRef("");
  const blackoutSpawned = useRef("");
  const relaySpawned = useRef("");
  const crucible = useRef<CrucibleState | null>(null);
  const neonCoreSpawned = useRef("");
  const descentSpawned = useRef("");
  const burstHeard = useRef(0);
  const devWarp = useRef<{ x: number; z: number; y?: number } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("dev") !== "1") return;
    const w = window as unknown as { __warp?: (to: string | { x: number; z: number; y?: number }) => string };
    w.__warp = (to) => {
      if (typeof to !== "string") { devWarp.current = to; return "ok"; }
      const r = REGIONS.find((g) => g.id === to);
      const spot = to === "neon" ? { x: NEON_CITY_CENTER.x, z: NEON_CITY_CENTER.z + 20 } : to === "thalassia" ? { x: airlockSite().x + 5, z: airlockSite().z, y: DOCK_DECK_Y + 1.6 } : to === "spire" ? { x: NEON_CITY_CENTER.x, z: NEON_CITY_CENTER.z - 30 } : r ? { x: r.x, z: r.z + r.radius * 0.3 } : null;
      if (!spot) return "unknown place";
      devWarp.current = spot; return "ok";
    };
    const wr = window as unknown as { __where?: () => unknown };
    wr.__where = () => { const st = state.current; return { x: Math.round(st.x), y: Math.round(st.y * 10) / 10, z: Math.round(st.z), diving: st.diving, sector: st.sector, oxygen: Math.round(st.oxygen), hull: st.hull, hp: Math.round(sim.hp) }; };
    // dev-only test aids (?dev=1): finish the current mission wave as the player, or set hp/oxygen to exercise death and refill paths
    const wd = window as unknown as { __dev?: Record<string, (...args: never[]) => unknown> };
    wd.__dev = {
      /** the running race: phase, next gate, penalties, and every gate/obstacle position (to drive or warp through it in a test) */
      race: () => { const a = activityLive.current; const id = a?.def.stages[0]?.kind === "race" ? (a.def.stages[0] as { raceId: string }).raceId : null; const def = id ? raceById(id) : undefined; const r = a?.run.race as RaceRun | undefined; if (!def || !r) return null;
        return { id, mode: def.mode, phase: r.phase, next: r.next, of: def.points.length, time: Math.round(r.time * 10) / 10, collisions: r.collisions, impact: r.impact ?? 0, notice: r.notice, result: r.result ?? null, gates: def.points.map((_, i) => { const w = worldPoint(def, i); return [Math.round(w.x), Math.round(w.z), w.depth === undefined ? null : Math.round(w.depth)]; }), obstacles: raceObstacles(def).map((o) => [Math.round(o.x), Math.round(o.z), o.segment]),
          // what RaceCourse is showing right now: visible gates, boards, obstacles, rivals, start line (name@x,z)
          shown: (() => { const out: string[] = []; const p = new THREE.Vector3(); scene.traverse((o) => { if (!o.name.startsWith("race-") || !o.visible) return; o.getWorldPosition(p); out.push(`${o.name}@${Math.round(p.x)},${Math.round(p.z)}`); }); return out; })() }; },
      /** gore check (?dev=1): kill the nearest live enemy as if by `cause` from the player's position (BULLET, PELLET, BLADE, BLAST, CRUSH) */
      killNear: (cause: "BULLET" | "PELLET" | "BLADE" | "BLAST" | "CRUSH" = "BULLET") => { const st = state.current; let best = null as null | (typeof sim.machines)[number], bd = 1e9; for (const m of sim.machines) { if (!m.alive) continue; const d = Math.hypot(m.x - st.x, m.z - st.z); if (d < bd) { bd = d; best = m; } } if (!best) return "none"; const dmg = (best.maxHp ?? 3.5) * 2; best.hp -= dmg; markGoreHit(sim, best, best.x - st.x, best.z - st.z, dmg, cause); defeatMachine(sim, best, "player"); return `${best.profile} ${best.alive ? "survived" : "down"} at ${Math.round(bd)} m`; },
      killMission: () => { let n = 0; for (const m of sim.machines) if (m.alive && m.mission) { m.hp = 0; defeatMachine(sim, m, "player"); if (!m.alive) n++; } return n; },
      hp: (n = 1) => { sim.hp = n; return sim.hp; },
      o2: (n = 0) => { state.current.oxygen = n; return n; },
      hull: (n = 0) => { state.current.hull = n; return n; },
      /** set the current vehicle's condition (0-100 damage) and optionally get in, to see damage presentation */
      wreck: (engine = 80, body = 70, drive = true) => { condition.current = { ...condition.current, engine, body }; if (drive) state.current.inVehicle = true; return condition.current; },
      /** equip any weapon by id for this session (added to the slot order so the loadout guard doesn't swap it back) */
      weapon: (id: string) => { const w = id as WeaponId; if (!WEAPONS[w]) return "unknown weapon"; if (!orderRef.current.includes(w)) orderRef.current = [...orderRef.current, w]; state.current.weapon = w; return w; },
      /** perf investigation: the live three.js state (scene, gl, camera) and the render tier, for toggling layers by hand */
      three: () => ({ ...getThree(), tier: getPerfTier() }),
      /** presentation test: log bullet impacts of each kind in an arc 6-9 m ahead of the player (no damage, nothing hit) */
      impacts: () => { const st = state.current; const kinds = ["ground", "cover", "truck", "machine"] as const; kinds.forEach((k, i) => { const a = st.yaw + (i - 1.5) * 0.25, d = 7; const x = st.x + Math.sin(a) * d, z = st.z + Math.cos(a) * d; logImpact(sim, { x, y: walkHeight(x, z) + (k === "ground" ? 0.3 : 1.2), z, vx: Math.sin(a) * 130, vz: Math.cos(a) * 130 }, k); }); return "ok"; },
      /** which decorative models loaded, are loading or failed (forest-assets.ts), with per-model detail */
      assets: () => ({ summary: getAssetSummary(), details: assetDetails() }),
      /** set the time of day (0-24 h) and optionally hold it there (frozen) for screenshots */
      time: (hour = 12, freeze = true) => { time.current = (((hour / 24) % 1) + 1) % 1; timeFrozen.current = freeze; return hour; },
      /** third-person (false) or first-person (true) camera */
      fp: (on = false) => { state.current.firstPerson = on; return on; },
      look: (yawDeg = 0, pitchDeg = 0) => { state.current.yaw = (yawDeg * Math.PI) / 180; state.current.pitch = (pitchDeg * Math.PI) / 180; return "ok"; },
      // what the camera can actually see around the player: named scene groups within `r` metres (verifies set pieces mounted)
      near: (r = 60) => { const out: string[] = []; const p = new THREE.Vector3(); scene.traverse((o) => { if (!o.name || out.length > 60) return; o.getWorldPosition(p); const st = state.current; if (Math.hypot(p.x - st.x, p.z - st.z) < r) out.push(`${o.name}@${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`); }); return out; },
      /** what the frame costs: every visible, on-screen mesh grouped by its nearest named ancestor (draws, instances, triangles) */
      census: (top = 25) => {
        const three = getThree(); const cam = three.camera; cam.updateMatrixWorld();
        const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
        const groups = new Map<string, { draws: number; inst: number; tris: number; shadow: number }>();
        const sphere = new THREE.Sphere();
        three.scene.traverseVisible((o) => {
          const m = o as THREE.Mesh & { count?: number; isInstancedMesh?: boolean };
          if (!m.isMesh && !(o as THREE.Sprite).isSprite) return;
          if (m.frustumCulled !== false && m.geometry) {
            if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
            const bs = (m as THREE.InstancedMesh).boundingSphere ?? m.geometry.boundingSphere;
            if (bs) { sphere.copy(bs).applyMatrix4(m.matrixWorld); if (!frustum.intersectsSphere(sphere)) return; }
          }
          let key = ""; for (let q: THREE.Object3D | null = o; q; q = q.parent) if (q.name) { key = q.name.split(":")[0]!.split("@")[0]!; break; }
          if (!key) { const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial | undefined; key = `?${m.geometry?.type ?? "sprite"}/${mat?.type ?? ""}/${mat?.name || mat?.color?.getHexString?.() || ""}`; }
          const g = groups.get(key) ?? { draws: 0, inst: 0, tris: 0, shadow: 0 };
          const count = m.isInstancedMesh ? (m.count ?? 0) : 1;
          const idx = m.geometry?.index ? m.geometry.index.count : m.geometry?.attributes["position"]?.count ?? 0;
          const mats = Array.isArray(m.material) ? m.material.length : 1;
          g.draws += mats; g.inst += count; g.tris += (idx / 3) * count; if (m.castShadow) g.shadow += mats;
          groups.set(key, g);
        });
        const list = [...groups.entries()].map(([k, v]) => ({ k, ...v, tris: Math.round(v.tris) })).sort((a, b) => b.draws - a.draws);
        const total = list.reduce((t, g) => ({ draws: t.draws + g.draws, tris: t.tris + g.tris, shadow: t.shadow + g.shadow }), { draws: 0, tris: 0, shadow: 0 });
        const lights: string[] = [];
        three.scene.traverseVisible((o) => { const l = o as THREE.Light; if (!l.isLight) return; const path: string[] = []; for (let q: THREE.Object3D | null = o.parent; q && path.length < 4; q = q.parent) if (q.name) path.push(q.name); lights.push(`${l.type} i=${l.intensity.toFixed(1)} @${[o.getWorldPosition(new THREE.Vector3())].map((v) => `${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.z)}`)[0]} ${path.join("<") || "(unnamed)"}`); });
        return { total, lights, info: { calls: three.gl.info.render.calls, tris: three.gl.info.render.triangles, programs: three.gl.info.programs?.length, geometries: three.gl.info.memory.geometries, textures: three.gl.info.memory.textures }, top: list.slice(0, top) };
      },
      // meshes around the camera with what could hide them (visibility up the tree, layers, material side/opacity, frustum culling)
      meshes: (r = 8) => { const camera = getThree().camera; const out: unknown[] = []; const p = new THREE.Vector3(); scene.traverse((o) => { const mesh = o as THREE.Mesh; if (!mesh.isMesh || out.length > 40) return; mesh.getWorldPosition(p); if (p.distanceTo(camera.position) > r) return; let vis = true; for (let q: THREE.Object3D | null = mesh; q; q = q.parent) if (!q.visible) vis = false; const m = mesh.material as THREE.MeshStandardMaterial; out.push({ geo: mesh.geometry.type, at: [p.x, p.y, p.z].map((v) => Math.round(v * 10) / 10), vis, layers: mesh.layers.mask, side: m?.side, op: m?.opacity, tr: m?.transparent, col: m?.color?.getHexString?.(), culled: mesh.frustumCulled, order: mesh.renderOrder }); }); return { cam: [camera.position.x, camera.position.y, camera.position.z].map((v) => Math.round(v * 10) / 10), near: (camera as THREE.PerspectiveCamera).near, layers: camera.layers.mask, list: out }; },
      machines: () => sim.machines.filter((m) => m.alive && m.mission).map((m) => ({ x: Math.round(m.x), z: Math.round(m.z), hp: Math.round(m.hp) })),
      /** Living World: start the next city event now (optionally of a given kind), read the live one, list guards */
      npcs: () => ({ near: npcNear(state.current.x, state.current.z)?.id ?? null, inVehicle: state.current.inVehicle, list: LIVING_NPCS.map((n) => ({ id: n.id, ...npcWorld(n) })) }),
      livingNow: () => { if (livingRt.current) livingRt.current.director = { ...livingRt.current.director, next: 0 }; return "next city event starts on the next frame (you must be inside Nexus or Neon City)"; },
      living: () => ({ event: livingRt.current?.director.current ?? null, next: Math.round(livingRt.current?.director.next ?? 0), guards: livingRt.current?.guards.map((g) => ({ id: g.id, state: g.state, x: Math.round(g.x), z: Math.round(g.z) })) }),
      /** list every live machine with its tags (nemesis/boss/living/mission) */
      all: () => sim.machines.filter((m) => m.alive).map((m) => ({ profile: m.profile, x: Math.round(m.x), z: Math.round(m.z), hp: +m.hp.toFixed(1), boss: m.boss, nemesis: m.nemesis ?? null, living: m.living ?? null, mission: !!m.mission })),
      aim: (only?: "nemesis" | "boss" | "living") => { const st = state.current; let best = null as null | { x: number; z: number }, bd = 1e9; for (const m of sim.machines) { if (!m.alive) continue; if (only === "nemesis" && !m.nemesis) continue; if (only === "boss" && !m.boss) continue; if (only === "living" && !m.living) continue; const d = Math.hypot(m.x - st.x, m.z - st.z); if (d < bd) { bd = d; best = m; } } if (!best) return "none"; st.yaw = Math.atan2(best.x - st.x, best.z - st.z); st.pitch = -0.04; return Math.round(bd); },
      secrets: () => SECRETS.map((sc) => ({ id: sc.id, ...secretPoint(sc), condition: sc.condition })),
      crown: () => ({ ...HOLLOW_CROWN, vael: VAEL }),
      spawn: (n = 4) => spawnEventSquad(sim, "", state.current.x + 18, state.current.z, n, 1, regionAt(state.current.x, state.current.z)?.id ?? "wastelands", 6),
      dieTo: () => { const profile = "Wasteland Grunt"; sim.lastHitBy = { profile, zone: regionAt(state.current.x, state.current.z)?.id ?? "wastelands", elite: true, boss: false }; hurtPlayer(sim, 9999, profile); return "died"; },
      nemesis: () => (gearLive.current?.nemeses ?? []).map((n) => `${n.name} ${n.epithet} r${n.rank} ${n.regionId} ${n.status} [${n.traits.join(",")}]`),
      livingKill: () => { let n = 0; const id = livingRt.current?.director.current?.id; for (const m of sim.machines) if (m.alive && id && m.living === id) { m.hp = 0; defeatMachine(sim, m, "player"); n++; } return n; },
    };
    return () => { delete w.__warp; delete wr.__where; delete wd.__dev; };
  }, []);
  const solarArraySpawned = useRef("");
  const coreNodeSpawned = useRef("");
  const zoneSpawned = useRef<Partial<Record<ZoneMissionId, string>>>({});
  const systemCoreSpawned = useRef("");
  const bossActionLog = useRef<ActionLogEntry[]>([]);
  const bossAdaptedPattern = useRef<PlayerAction | null>(null);
  const adaptiveTutorial = useRef(ADAPTIVE_TUTORIAL_INIT);
  const lastHpForAdaptive = useRef(100);
  const lastDodgeStruggleAt = useRef(0);
  const lastAbilityStruggleAt = useRef(0);
  const awakeSpawned = useRef("");
  const investigation = useRef(NEW_INVESTIGATION); // Verdant crash-site scan (verdant.ts), client-session only
  const patrolWoken = useRef(false);
  const holdRef = useRef(0);
  const structure = useMemo(() => buildInterior("veridan-ruin", SPAWN.x + 28, walkHeight(SPAWN.x + 28, SPAWN.z + 20), SPAWN.z + 20), []);
  const depleted = useRef<Record<string, number>>({});
  const lairsTriggered = useRef<Record<string, boolean>>({});
  const storyBeats = useRef({ seenEncounterEvent: 0, defenseAt: -1, askedAt: {} as Record<string, number> });
  const appearance = appearanceProp ?? appearanceById("BASTION");
  const selectedClass = classById(playerClass);
  const selectedSubclass = subclassById(subclassId);
  const activeParked = Boolean(gear?.fleet?.active && gear.housing && parkedAt(gear)[gear.fleet.active]);
  const selectedVehicle = useMemo(() => tunedVehicle(vehicleById(vehicleId), gear?.fleet), [vehicleId, gear?.fleet]); // fleet.ts tuning of the active build
  const playerCarModel = useMemo(() => {
    const active = gear?.fleet?.active ?? null;
    const build = active && fleetById(active)?.base === vehicleId ? active : null;
    return { model: vehicleModelFor(vehicleId, build), paint: build ? gear?.fleet?.paint[build] ?? null : null, cosmetics: build ? gear?.fleet?.cosmetics?.[build] ?? null : null };
  }, [vehicleId, gear?.fleet]);
  const handling = useMemo(() => handlingFor(vehicleById(vehicleId)), [vehicleId]); // vehicle-handling.ts: jet/heli/boat/sub/tank/car each move differently
  const vh = useRef({ airborne: false, slip: 0, roll: 0, pitch: 0, skidAt: 0, groundPitch: 0, groundRoll: 0 });
  // vehicle-weapons.ts: what this vehicle's hardpoints fire, and the secondary salvo in progress
  // the fleet build being driven fires its own hardpoints (fleet.ts / vehicle-weapons.ts BY_BUILD), else the chassis's
  const activeBuildId = gear?.fleet?.active && fleetById(gear.fleet.active)?.base === vehicleId ? gear.fleet.active : null;
  const armament = useMemo(() => armamentFor(vehicleId, handling.kind, activeBuildId), [vehicleId, handling.kind, activeBuildId]);
  const muzzleFlash = useRef<MuzzleFlashState | null>(null);
  const vFire = useRef({ cool: 0, gunCool: 0, secCool: 0, salvoLeft: 0, salvoCool: 0, barrel: 0, gunBarrel: 0, podBarrel: 0 });
  const condition = useRef<VehicleCondition>(FRESH_VEHICLE);
  useEffect(() => { condition.current = normalizeCondition(gear?.vehicleConditions?.[vehicleId]); }, [vehicleId, gear?.vehicleConditions]);
  const player = useRef<THREE.Group>(null!);
  // start fetching this operator's model at once so the plain procedural stand-in is on screen for as short a time as possible
  // foliage / region-model / light budgets read the live tier from perf-budget.ts
  setPerfTier(settings.renderTier);
  useEffect(() => { const entry = OPERATOR_MODELS[playerClass]; if (entry) useGLTF.preload(entry.url); }, [playerClass]);
  const vehicle = useRef<THREE.Group>(null!);
  const sun = useRef<THREE.DirectionalLight>(null!);
  const weatherKind = useRef<string>("Clear shield");
  const weatherFx = useRef({ precipitation: 0, windX: 0, windZ: 0 });
  const weatherName = useRef("Clear");
  const stratagem = useRef(createStratagemState());
  const environmentSummary = useRef("");
  const hazardWarning = useRef("");
  const hazardRef = useRef<HazardEffect>(hazardAt({ regionId: null, t: 0, dt: 0, sheltered: true, exposure: 0 }));
  const lightning = useRef(0);
  const zonePull = useRef({ x: 0, z: 0 });
  const discoveryClock = useRef(0);
  const markerList = (px?: number, pz?: number): Marker[] => {
    const now = performance.now();
    const list: Marker[] = [];
    if (awakening?.target) list.push({ id: "m-awakening", kind: "MISSION", label: "Awakening", x: awakening.target.x, z: awakening.target.z, regionId: "nexus" });
    if (mission?.target && mission.state !== "COMPLETE" && mission.state !== "WORLD_UPDATE") list.push({ id: "m-broken-signal", kind: "MISSION", label: "Broken Signal", x: mission.target.x, z: mission.target.z, regionId: "nexus" });
    if (relay?.target && relay.state !== "COMPLETE" && relay.state !== "WORLD_UPDATE") list.push({ id: "m-drowned-relay", kind: "MISSION", label: "The Drowned Relay", x: relay.target.x, z: relay.target.z, regionId: "swamps" });
    if (blackout?.target && blackout.state !== "COMPLETE" && blackout.state !== "WORLD_UPDATE") list.push({ id: "m-blackout-protocol", kind: "MISSION", label: "Blackout Protocol", x: blackout.target.x, z: blackout.target.z, regionId: "nexus" });
    if (neonCore?.target && neonCore.state !== "COMPLETE" && neonCore.state !== "WORLD_UPDATE") list.push({ id: "m-stitched-neon-core", kind: "MISSION", label: "Stitched Neon Core", x: neonCore.target.x, z: neonCore.target.z, regionId: "nexus" });
    if (solarArray?.target && solarArray.state !== "COMPLETE" && solarArray.state !== "WORLD_UPDATE") list.push({ id: "m-solar-array", kind: "MISSION", label: "Solar Array Alpha", x: solarArray.target.x, z: solarArray.target.z, regionId: "solara" });
    if (coreNode?.target && coreNode.state !== "COMPLETE" && coreNode.state !== "WORLD_UPDATE") list.push({ id: "m-core-node", kind: "MISSION", label: "The Core Node", x: coreNode.target.x, z: coreNode.target.z, regionId: "nexus" });
    for (const id of ZONE_MISSION_IDS) { const z = zoneRuns?.[id]; if (z?.target && z.state !== "COMPLETE" && z.state !== "WORLD_UPDATE") list.push({ id: `m-${id}`, kind: "MISSION", label: ZONE_MISSIONS[id].title, x: z.target.x, z: z.target.z, regionId: ZONE_MISSIONS[id].regionId }); }
    if (descent?.target && descent.state !== "COMPLETE" && descent.state !== "WORLD_UPDATE") list.push({ id: "m-descent-protocol", kind: "MISSION", label: "Descent Protocol", x: descent.target.x, z: descent.target.z, regionId: "swamps" });
    if (systemCore?.target && systemCore.state !== "COMPLETE" && systemCore.state !== "WORLD_UPDATE") list.push({ id: "m-system-core", kind: "MISSION", label: "The System Core", x: systemCore.target.x, z: systemCore.target.z, regionId: "swamps" });
    for (const m of sim.director.missions) { if (m.state !== "ACTIVE") continue; const c = regionCenter(m.regionId); if (c) list.push({ id: `m-${m.id}`, kind: "MISSION", label: m.name, x: c.x, z: c.z, regionId: m.regionId }); }
    // open-world discoveries (discoveries.ts): only ones the player can see or hear from here; hidden ones appear once a beacon has revealed them
    if (gear && !tutorial && px !== undefined && pz !== undefined) for (const f of discoveriesNear(gear, px, pz, Date.now())) list.push({ id: `disc-${f.discovery.id}`, kind: "MISSION", label: `${DISCOVERY_LABEL[f.discovery.kind]} · ${f.discovery.name}`, x: f.x, z: f.z, regionId: ACTIVITY_REGION[f.discovery.area] ?? "nexus" });
    { const tg = activity ? activityTarget(activity.def, activity.run) : null; if (tg) list.push({ id: "m-activity", kind: "MISSION", label: `${activity!.def.name} · ${tg.label}`, x: tg.x, z: tg.z, regionId: ACTIVITY_REGION[activity!.def.area] ?? "nexus" }); }
    // Storm Islands (storm-quests.ts): each active quest's next objective, once the chain has been sighted
    if (gear && !tutorial) for (const st of stormQuests({ earnedRewards: gear.earnedRewards ?? [] })) if (st.state === "ACTIVE" && st.next) { const site = stormSiteById(st.next.siteId); if (site) { const w = stormSiteWorld(site); list.push({ id: `storm-${st.quest.id}`, kind: "MISSION", label: `${st.quest.title} · ${st.next.description}`, x: w.x, z: w.z, regionId: "storm" }); } }
    if (!investigation.current.done) list.push({ id: "forest-crash-site", kind: "MISSION", label: CRASH_SITE.label, x: CRASH_SITE.x, z: CRASH_SITE.z, regionId: "veridan" });
    for (const site of RESOURCE_SITES) list.push({ ...site, ready: (depleted.current[site.id] ?? 0) <= now });
    for (const lair of BOSS_LAIRS) list.push(lair);
    if (gear) for (const r of ruins()) if (isDiscovered(gear, r.id)) list.push({ id: `ruin-${r.id}`, kind: "RUIN", label: isEvolved(gear, r.id) ? `${r.name} (spent)` : r.name, x: r.x, z: r.z, regionId: r.regionId });
    for (const lair of SCENARIO_LAIRS) if (!gear || lairRevealed(gear, lair.scenarioId)) list.push(lair);
    if (gear) for (const l of LANDMARKS) if (l.id !== "neon-city" && l.id !== "thalassia" && isLandmarkKnown(gear, l.id)) list.push({ id: `lm-${l.id}`, kind: "LANDMARK", label: l.name, x: l.x, z: l.z, regionId: l.regionId });
    for (const m of sim.machines) if (m.alive && m.boss) list.push({ id: `live-${m.profile}`, kind: "BOSS", label: `${m.profile} (engaged)`, x: m.x, z: m.z, regionId: m.zone });
    if (sim.emergencyQuest.state === "WARNING" || sim.emergencyQuest.state === "ACTIVE") list.push({ id: "eq-boss", kind: "BOSS", label: `EQ · ${sim.emergencyQuest.bossName}`, x: sim.emergencyQuest.x, z: sim.emergencyQuest.z, regionId: sim.emergencyQuest.regionId });
    list.push({ id: "neon-city", kind: "MISSION", label: "Neon City", x: NEON_CITY_CENTER.x, z: NEON_CITY_CENTER.z, regionId: "nexus" });
    list.push({ id: "thalassia", kind: "MISSION", label: "Thalassia (deep dive)", x: THALASSIA_CENTER.x, z: THALASSIA_CENTER.z, regionId: "swamps" });
    // the player's own waypoint (map-pin.ts): first in the list so the compass and tracker always show it; cleared on arrival
    { const pin = getPin(); if (pin) { if (px !== undefined && pz !== undefined && reached(pin, px, pz)) { setPin(null); alert(sim, `Waypoint reached: ${pin.label}`); } else list.unshift(pinMarker(pin)); } }
    return list;
  };
  const moon = useRef<THREE.DirectionalLight>(null!);
  const time = useRef(0.36); // 08:38, morning light (the clock: sunrise 06:00, noon 12:00, sunset 18:00)
  const timeFrozen = useRef(false);
  const camHead = useMemo(() => new THREE.Vector3(), []);
  const sunDir = useRef(new THREE.Vector3(0.4, 0.9, 0.3));
  const carSpeed = useRef(0);
  const carSteer = useRef(0);
  const carBrake = useRef(0);
  /** the driven body's real bounds (Car fills it), so damage smoke and fire sit on its hood, not inside it */
  const carBounds = useRef<THREE.Box3 | null>(null);
  const headlamp = useRef<THREE.PointLight>(null);
  const sky = useRef<THREE.Object3D>(null!);
  const skyDomeGroup = useRef<THREE.Group>(null);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  /** stride shared by camera bob, viewmodel sway and the Operator's limbs (movement-feel.ts) */
  const feel = useRef((() => {
    const motion = { phase: 0, intensity: 0, swing: 0.35, lean: 0.04, air: false, stance: "STAND" as Stance, slideT: 0, combat: false };
    // Operator reads a ref-shaped `{ current }`, so the same live object is also exposed boxed
    return { stride: createStride(), view: null as FeelView | null, motion, motionRef: { current: motion }, lastShots: 0, combatUntil: 0 };
  })());
  /** class movement kit (movement.ts): air jumps, glide, slide + previous-frame jump/slide key state for edge detection */
  const move = useRef({ state: createMoveState(), jumpHeld: false, slideHeld: false, proneHeld: false });
  const reticle = useRef({ state: createReticle(), view: EMPTY_RETICLE, yaw: 0, pitch: 0, hit: 0, kills: 0, ready: false });
  /** eased regional atmosphere (atmosphere.ts) + scratch colours, so crossing a border blends rather than pops */
  const atmo = useRef({ fogMix: 0, fogScale: 1, lightMix: 0, skyMix: 0, haze: 0, fogTint: new THREE.Color("#ffffff"), lightTint: new THREE.Color("#ffffff"), skyTint: new THREE.Color("#ffffff"), hemiBase: new THREE.Color("#9ec8e8") });
  /** eased regional water style (water-style.ts): deep/shallow colours, murk and wave chop */
  const waterStyle = useRef({ deep: new THREE.Color("#062a44"), shallow: new THREE.Color("#1d7fa8"), murk: 0.15, chop: 1 });
  const ruinLive = useRef<HudState["ruinNear"]>(null);
  const cacheLive = useRef<{ id: string | null; hold: number; view: HudState["cacheNear"] }>({ id: null, hold: 0, view: null });
  /** eased regional signature sky (sky-effects.ts): ashfall, aurora, spores, dust, pollen */
  const skyFx = useRef<SkyFxLive>({ color: new THREE.Color("#ffffff"), density: 0, fall: 0, drift: 0, size: 2, glow: 0, aurora: 0 });
  const report = useRef(0);
  const hudGate = useRef(createHudGate());
  const live = useRef(createLiveBuild(activeBuild, abilityBranches));
  const abilityHeld = useRef<Record<string, boolean>>({});
  const cameraToggleHeld = useRef(false);
  const bossHeld = useRef(false);
  const tutorialClock = useRef(0);
  const lastGate = useRef(0);
  const tutorialEnemyHealth = useRef(2);
  const sentinelHealth = useRef(5);
  const chamberActions = useRef(new Set<string>());
  const tutorialStage = useRef<TutorialState["step"] | null>(null);
  const tutorialKills = useRef(0);
  const sentinel = useRef<WorldSim["machines"][number] | null>(null);
  /** machines spawned for the current tutorial step; survivors lose their mission tag when the step ends */
  const tutorialSpawns = useRef<WorldSim["machines"]>([]);
  const lastLockdownTier = useRef<LockdownTier>("MONITORING");

  const state = useRef({
    x: SPAWN.x,
    z: SPAWN.z,
    y: walkHeight(SPAWN.x, SPAWN.z) + 1.6,
    vy: 0,
    yaw: Math.PI,
    inVehicle: false,
    /** vehicle forward speed */
    vSpeed: 0,
    grounded: true,
    toggleCool: 0,
    fireCool: 0,
    inspectorCool: 0,
    showInspector: false,
    fps: 60,
    viewCool: 0,
    bashCool: 0,
    domeCool: 0,
    meleeCool: 0,
    meleeTime: 0,
    weapon: "AUTO" as WeaponId,
    ammo: freshAmmo(),
    reload: 0,
    switchedAt: 0,
    /** shots fired so far (the first-person weapon reads the change to kick, flash and cycle) */
    shots: 0,
    wheel: false,
    burstLeft: 0,
    burstCool: 0,
    recoil: 0,
    punch: 0,
    bloom: 0,
    combo: 0,
    comboTime: 0,
    swing: 0,
    specialTime: 0,
    pitch: 0,
    cameraBlend: settings.firstPersonDefault ? 0 : 1,
    firstPerson: settings.firstPersonDefault,
    aimLocked: false,
    reported: { hp: 100 },
    /* Thalassia-style underwater state — active any time `submerged` is true, not just in Thalassia */
    diving: false,
    oxygen: OXYGEN_MAX,
    wasSubmerged: false,
    hull: 0,
    sector: null as ThalassiaSector | null,
    breachAt: -1e9,
    /** NOVA hazard cues already given this dive (reset on surfacing) */
    cues: new Set<string>(),
    /* Neon City chase system — heat meter, vault chain tracking */
    heatMeter: 0,
    chainCount: 0,
    lastVaultAt: -10,
    /* Nexus City stealth/surveillance */
    detectionMeter: 0,
    hacking: false,
    hackProgress: 0,
    /* Interior Building system — which interior (if any) the player is currently inside, and where to return to */
    insideInterior: null as string | null,
    interiorReturnPos: null as { x: number; y: number; z: number } | null,
    interiorPrevX: null as number | null,
  });

  /** snapshot of every live engine system for the dev inspector */
  const buildInspector = (): InspectorView => {
    const s = state.current;
    if (tutorial && tutorial.step !== tutorialStage.current) {
      tutorialStage.current = tutorial.step;
      // a spare drone left from the previous step must not hold later mission "wave cleared" checks open
      for (const m of tutorialSpawns.current) if (m.alive) m.mission = false;
      tutorialSpawns.current = [];
      if (tutorial.step === "CONTACT" || tutorial.step === "SENTINEL") {
        const count = tutorial.step === "CONTACT" ? 3 : 1;
        for (let i = 0; i < count; i++) {
          const machine = sim.machines.find((candidate) => !candidate.alive);
          if (!machine) continue;
          machine.alive = true; machine.x = s.x + (i - (count - 1) / 2) * 8; machine.z = s.z - 28;
          machine.y = walkHeight(machine.x, machine.z); machine.hp = tutorial.step === "SENTINEL" ? 14 : 3;
           machine.scale = tutorial.step === "SENTINEL" ? 2 : 1; machine.zone = "veridan"; machine.cool = 2; machine.elite = tutorial.step === "SENTINEL"; machine.boss = tutorial.step === "SENTINEL"; machine.profile = tutorial.step === "SENTINEL" ? "Adaptive Sentinel" : "Cyber-Corrupted Drone"; machine.kind = "OVERCLOCKED"; machine.drop = "microCircuits"; machine.kx = 0; machine.kz = 0;
          // tagged as a scripted machine so the Veridan stability field leaves it for the player; pooled-slot leftovers cleared
          Object.assign(machine, { mission: true, vulnUntil: 0, vulnMult: 1, encounter: undefined, decoy: undefined, living: undefined, scenarioId: undefined, eq: undefined, swimY: undefined, nemesis: undefined, nemesisWeak: undefined, nemesisDamage: undefined, rival: undefined });
          tutorialSpawns.current.push(machine);
          if (tutorial.step === "SENTINEL") sentinel.current = machine;
        }
        tutorialKills.current = sim.kills;
      }
    }
    const st = sim.stats;
    let alive = 0;
    let elite = 0;
    let engaging = 0;
    for (const m of sim.machines) {
      if (!m.alive) continue;
      alive++;
      if (m.elite) elite++;
      if (Math.hypot(m.x - s.x, m.z - s.z) < TIER_RADII.full) engaging++;
    }
    return {
      clock: clockLabel(time.current),
      phase: phaseFor(time.current),
      tick: st.frame,
      fps: Math.round(s.fps),
      stepMs: st.stepMs,
      avgMs: st.avgMs,
      warIntensity: Math.round(sim.director.threat),
      coreHp: Math.round(sim.coreHp),
      tiers: [...st.tiers] as [number, number, number, number],
      ticked: st.ticked,
      skipped: st.skipped,
      dormant: st.dormant,
      relevant: st.relevant,
      offloaded: st.offloaded,
      regionLoad: Object.entries(st.regionLoad)
        .map(([id, load]) => ({ id, load }))
        .sort((a, b) => b.load - a.load)
        .slice(0, 5),
      machines: { alive, elite, engaging },
      convoys: sim.trucks
        .filter((tr) => tr.alive)
        .slice(0, 6)
        .map((tr, i) => {
          const dist = Math.hypot(tr.x - s.x, tr.z - s.z);
          const tierNote = dist < TIER_RADII.full ? "T0" : dist < TIER_RADII.high ? "T1" : "T2";
          return {
            id: i,
            lane: tr.lane,
            state: tr.wait > 0 ? "HOLD" : tr.speed < 0.006 ? "BRAKING" : "ROLLING",
            speed: tr.speed,
            cargo: tr.cargo,
            hp: tr.hp,
            tierNote,
          };
        }),
      regions: sim.zones.map((z) => ({
        id: z.region.id,
        name: z.region.name,
        owner: z.owner,
        progress: z.progress,
        instability: z.instability,
      })),
      shards: sim.zones.slice(0, 4).map((z) => {
        const load = sim.stats.regionLoad[z.region.id] ?? 0;
        const latency = Math.round(28 + load * 6 + z.instability * 40);
        return {
          region: z.region.name.split(" ")[0]!,
          latency,
          sync: latency > 120 ? "DEGRADED" : latency > 70 ? "SYNCING" : "STABLE",
        };
      }),
      identity: `${selectedClass.name} · ${selectedSubclass.name}`,
      mutations: [],
      missions: sim.director.missions
        .filter((m) => m.state === "ACTIVE")
        .slice(0, 3)
        .map((m) => ({ name: m.name, state: m.state })),
    };
  };

  const velocity = useMemo(() => new THREE.Vector3(), []);
  const bootDash = useRef({ held: false, readyAt: 0 });
  /** Operator dash (dash.ts): per-class dash with perks from abilityBranches */
  const trav = useRef(createTraversal(playerClass));
  const travTop = useRef<{ y: number; onto: boolean } | null>(null);
  /** Mag-Grind Boots rail grinding (maggrind.ts) */
  const grindRt = useRef({ state: createGrind(), jumpPrev: false });
  const grindRails = useMemo(() => worldRails(NEON_CITY_CENTER, walkHeight), []);
  const opDash = useRef({ state: createDashState(playerClass, abilityBranches), held: false, wasActive: false });
  /** Dragonite abilities of the bonded Operator (dragonite-cast.ts) */
  /** target lock + shoulder side (target-lock.ts) */
  const lockRt = useRef({ state: newLockState(), keys: {} as Record<string, boolean> });
  /** Vyrak's mood and banter (vyrak-personality.ts) */
  const clueSent = useRef(new Set<string>());
  const vyrakMind = useRef({ p: createPersonality(), kills: 0, hp: 100, clock: 0, lowAt: -99, bosses: 0 });
  const dragoniteRt = useRef({ rt: createDragoniteRuntime(), held: {} as Record<string, boolean> });
  const opDashStats = useMemo(() => dashStats(playerClass, abilityBranches), [playerClass, abilityBranches]);
  const wish = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const lastCamPlayer = useRef({ x: NaN, y: NaN, z: NaN }); // unknown until the first follow frame, so that frame eases (never a false jump)
  const look = useMemo(() => new THREE.Vector3(), []);
  const cameraDirection = useMemo(() => new THREE.Vector3(), []);
  const viewmodel = useRef<THREE.Group>(null);
  const vmBaseFov = useRef(78);
  // first-person weapon presentation (weapon-handling.ts): state stepped each frame, pose read by ViewWeapon
  const viewState = useRef<ViewState | null>(null);
  const viewPoseRef = useRef<ViewPose | null>(null);
  const viewShots = useRef(0);
  const mouse = useRef({ fire: false, aim: false });
  const padPrev = useRef<boolean[]>([]);
  const keyPrev = useRef<Set<string>>(new Set());
  const padState = useRef({ fire: false, aim: false, connected: false });
  /** hit stop: a ~40-80ms near-freeze on kills and on hits against elites/bosses (weight, not on every auto-fire hit) */
  const hitStopUntil = useRef(0);
  const ammoKills = useRef(0);
  const ammoCarry = useRef<Partial<Record<WeaponId, number>>>({});
  const audioSeen = useRef({ hit: 0, kills: 0, hp: 100, hurtAt: 0, stepT: 1, bossAlive: false, bossX: 0, bossZ: 0, encEvent: 0, weakOpen: false });
  const race = useRef<RaceState>(RACE_IDLE);
  /** last sim.lastDeath timestamp this component has already reacted to — mirrors the audioSeen pattern above */
  const deathSeen = useRef(0);
  useEffect(() => {
    const unlock = () => sfx.unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); sfx.updateEngine(false, "", 0, 0, false); sfx.stopWaterAudio(); };
  }, []);
  useEffect(() => sfx.setVolume(settings.volume ?? 0.7), [settings.volume]);
  useEffect(() => { const m = settings.mute ?? {}; sfx.setMixVolumes(m.music ? 0 : settings.musicVolume ?? 1, m.sfx ? 0 : settings.sfxVolume ?? 1, m.ambience ? 0 : settings.ambienceVolume ?? 1, m.abilities ? 0 : settings.abilityVolume ?? 1); }, [settings.musicVolume, settings.sfxVolume, settings.ambienceVolume, settings.abilityVolume, settings.mute]);
  const skyColor = useMemo(() => new THREE.Color(), []);
  const fogColor = useMemo(() => new THREE.Color(), []);
const atmoScratch = useMemo(() => new THREE.Color(), []);
  const deepWater = useMemo(() => new THREE.Color("#0a4f63"), []);
  const waterTint = useMemo(() => new THREE.Color(), []);
  const underK = useRef(0);
  const instabilityColor = useMemo(() => new THREE.Color(INSTABILITY_FOG.color), []);
  const lightColor = useMemo(() => new THREE.Color(), []);
  const skyEnv = useRef<SkyEnv>({ cloud: 0, tint: new THREE.Color("#ffffff") });
  const scene = useThree((s) => s.scene); const gl = useThree((s) => s.gl); const getThree = useThree((s) => s.get); // selectors: a selector-less useThree call re-renders this whole tree on every R3F store change (Canvas reconfigures on each parent render)

  useEffect(() => { state.current.firstPerson = settings.firstPersonDefault; }, [settings.firstPersonDefault]);
  useEffect(() => {
    const canvas = gl.domElement;
    const down = (event: MouseEvent) => {
      if (event.target !== canvas) return;
      if (event.button === 0) mouse.current.fire = true;
      if (event.button === 2) mouse.current.aim = true;
    };
    const up = (event: MouseEvent) => {
      if (event.button === 0) mouse.current.fire = false;
      if (event.button === 2) mouse.current.aim = false;
    };
    const move = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      state.current.yaw -= event.movementX * 0.0022;
      state.current.pitch = THREE.MathUtils.clamp(state.current.pitch - event.movementY * 0.0022, -1.2, 1.2);
    };
    const blur = () => { mouse.current.fire = false; mouse.current.aim = false; };
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("blur", blur);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [gl]);

  useFrame(({ camera }, raw) => {
    setVoiceLoad(raw > 1 / 40);
    const dt = Math.min(raw, 0.05) * (performance.now() < hitStopUntil.current ? 0.08 : 1);
    const held = keys.current;
    const s = state.current;
    if (touch.active && s) {
      // touch controls (TouchControls.tsx): look drag turns the camera, fire/aim buttons stand in for the mouse
      s.yaw -= touch.lookDX * 0.005; s.pitch = THREE.MathUtils.clamp(s.pitch - touch.lookDY * 0.005, -1.2, 1.2);
      touch.lookDX = 0; touch.lookDY = 0; mouse.current.fire = touch.fire; mouse.current.aim = touch.aim;
    }
    const boots = bootStats(gearLive.current?.earnedRewards ?? [], getEquippedBoots());
    // Safe-state guard: a null/invalid player or world ref (bad hot-reload, a race during a scene
    // transition) skips this frame instead of throwing into React Three Fiber's render loop.
    if (!s || !sim) return;
    if (!isValidPlayerState(s)) { Object.assign(s, sanitizePlayerState(s)); }
    try {
    /* Interior Building system — non-null while the player is inside a pocket-dimension room (see @/game/interiors) */
    let interior = interiorById(s.insideInterior);
    live.current = rebindLiveBuild(live.current, activeBuild, abilityBranches);
    tickLiveBuild(live.current, dt, armorFxRef.current.abilityRecharge);
    tutorialClock.current += dt;
    if (tutorial?.step === "MATERIALIZE" && tutorialClock.current > 2) onTutorialEvent?.("READY");
    sim.titanActive = playerClass === "TITAN" && !s.inVehicle;
    sim.backpack = backpackFor(playerClass);
    { const bf = buffEffect(activeBuffs.current, Date.now()); sim.armorResist = Math.min(0.75, armorFxRef.current.resist + bf.resist); sim.armorRegen = armorFxRef.current.regen + bf.regen; sim.consumableDamageMult = bf.damageMult; }

    /* ---------------- day / night ---------------- */
    if (!timeFrozen.current) time.current += dt * (held.has("KeyT") ? 0.06 : 0.008);
    const night = nightFactor(time.current);

    blend(time.current, "bottom", skyColor);
    blend(time.current, "fog", fogColor);
    blend(time.current, "light", lightColor);
    scene.background = skyColor.clone();
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(fogColor);

    const theta = (((time.current % 1) + 1) % 1) * Math.PI * 2 - Math.PI / 2;
    if (sun.current) {
      sun.current.position.set(Math.cos(theta) * 140, Math.sin(theta) * 150 + 8, 70);
      // gritty key/fill ratio: a stronger sun over a dimmer sky fill, so forms model with real shadow sides instead of the
      // flat, evenly lit "plastic" read a bright hemisphere + bright IBL gave every surface
      sun.current.intensity = Math.max(0, intensityAt(time.current)) * 1.2;
      sun.current.color.copy(lightColor);
      // golden hour: low sun warms toward amber, high sun stays near-white for a natural daylight read
      const elev = Math.sin(theta);
      if (elev > -0.05) sun.current.color.lerp(GOLDEN, Math.max(0, Math.min(1, 1 - elev * 3)) * 0.55).lerp(NOON, Math.max(0, elev - 0.5) * 0.6);
    }
    sunDir.current.set(Math.cos(theta), Math.max(-0.2, Math.sin(theta)), 0.42).normalize();
    if (sky.current) {
      const m = (sky.current as unknown as { material?: THREE.ShaderMaterial }).material;
      if (m?.uniforms?.["sunPosition"]) {
        (m.uniforms["sunPosition"].value as THREE.Vector3)
          .copy(sunDir.current)
          .multiplyScalar(400);
      }
    }
    if (moon.current) {
      const ma = moonAngle(time.current);
      moon.current.position.set(-Math.cos(ma) * 140, Math.max(10, Math.sin(ma) * 120), -70);
      moon.current.intensity = 0.12 + moonlight(time.current, 0) * night * 0.85;
    }

    /* ---------------- input ---------------- */
    s.toggleCool -= dt;
    s.fireCool -= dt;
    s.bashCool -= dt;
    s.domeCool -= dt;
    s.meleeCool -= dt;
    s.meleeTime = Math.max(0, s.meleeTime - dt);
    s.specialTime = Math.max(0, s.specialTime - dt);
    const wantsBlock = sim.titanActive && held.has("KeyQ") && sim.titan.shieldBroken <= 0;
    if (wantsBlock && !sim.titan.blocking) sim.titan.blockStartedAt = performance.now() / 1000;
    sim.titan.blocking = wantsBlock;
    if (sim.titanActive && held.has("KeyE") && s.bashCool <= 0) {
      s.bashCool = 0.35;
      const damage = shieldBash(sim.titan);
      if (damage > 0) {
        s.specialTime = Math.max(s.specialTime, 0.75);
        for (const machine of sim.machines) {
          if (!machine.alive || Math.hypot(machine.x - s.x, machine.z - s.z) > 10) continue;
          machine.hp -= damage;
          markGoreHit(sim, machine, machine.x - s.x || 0.01, machine.z - s.z, damage * 1.5, "CRUSH");
          const distance = Math.hypot(machine.x - s.x, machine.z - s.z) || 1;
          machine.kx += ((machine.x - s.x) / distance) * 24;
          machine.kz += ((machine.z - s.z) / distance) * 24;
          machine.cool = Math.max(machine.cool, 2.2);
        }
      }
    }
    if (sim.titanActive && held.has("KeyR") && s.domeCool <= 0) {
      s.domeCool = 0.35;
      if (projectDome(sim.titan)) s.specialTime = Math.max(s.specialTime, 1.1);
    }
    if (vehicleUnlocked && held.has("KeyV") && s.toggleCool <= 0 && !interior) {
      s.toggleCool = 0.4;
      const wasInVehicle = s.inVehicle;
      const exitCheck = wasInVehicle ? canExitVehicle(handling, { speed: s.vSpeed, airborne: vh.current.airborne }, heightAt(s.x, s.z) < WATER_LEVEL - 1.5) : { ok: true as const };
      if (!exitCheck.ok) alert(sim, exitCheck.reason);
      else {
      s.inVehicle = !s.inVehicle && !conditionEffects(condition.current).disabled;
      if (s.inVehicle) { vh.current.airborne = false; vh.current.slip = 0; if (handling.mode === "WATER" && heightAt(s.x, s.z) > WATER_LEVEL - 0.3) { s.inVehicle = false; alert(sim, "Boats launch from the water's edge"); } }
      if (s.inVehicle) { sfx.playVehicleEngineStart(vehicleId, selectedVehicle.speed / vehicleById(vehicleId).speed); reportVehicleEnter(); }
      // Neon City parkour: hopping out mid-drive keeps a fraction of the car's speed as foot-chase momentum.
      if (wasInVehicle) velocity.set(Math.sin(s.yaw), 0, Math.cos(s.yaw)).multiplyScalar(exitVehicleMomentum(s.vSpeed));
      else velocity.set(0, 0, 0);
      if (wasInVehicle && !s.inVehicle && Math.abs(s.vSpeed) < 3) reportVehicleExit(s.x, s.z);
      s.vSpeed = 0;
      }
    }
    s.inspectorCool -= dt;
    if (held.has("KeyI") && s.inspectorCool <= 0) {
      s.inspectorCool = 0.35;
      s.showInspector = !s.showInspector;
    }
    s.fps = s.fps * 0.9 + (1 / Math.max(0.001, raw)) * 0.1;

    // Neon City chase system: heat climbs off the same combatHeat signal sim.ts already tracks, decays when disengaged.
    s.heatMeter = stepHeatMeter(s.heatMeter, sim.combatHeat, dt);
    const damageFx = conditionEffects(condition.current);
    if (held.has("KeyB") && !s.inVehicle && Math.abs(s.vSpeed) < 1 && sim.combatHeat < 0.1 && performance.now() - sim.lastHit > 6000) {
      const recovered = recoverVehicle(condition.current, true, true);
      if (JSON.stringify(recovered) !== JSON.stringify(condition.current)) { condition.current = recovered; onVehicleCondition?.(vehicleId, recovered); }
    }
    const vehicleStage = vehicleDamageStage(100 - condition.current.body);
    const vehicleEffect = VEHICLE_DAMAGE_EFFECT[vehicleStage];

    const here = regionAt(s.x, s.z);

    // Nexus City stealth/surveillance: the safe-zone perimeter turrets double as vision-cone sensors while you're in Nexus.
    const inNexus = here?.id === "nexus";
    const seenByNexus = inNexus && anySensorSees(nexusSensors(sim.turrets), s.x, s.z);
    s.hacking = inNexus && !s.inVehicle && held.has("KeyH");
    s.detectionMeter = inNexus ? stepDetectionMeter(s.detectionMeter, dt, seenByNexus, s.hacking) : Math.max(0, s.detectionMeter - dt * 30);
    const nexusDetection = detectionStateFor(s.detectionMeter);
    if (s.hacking) s.hackProgress = stepHackProgress(s.hackProgress, dt, nexusDetection);
    else if (inNexus) s.hackProgress = Math.max(0, s.hackProgress - dt * 6); // an abandoned hack slowly drops off, doesn't hard-reset
    // world loot caches: nearest unopened one, its scenario gate, and hold-to-decrypt progress
    {
      const c = s.inVehicle || s.insideInterior ? null : nearestCache(s.x, s.z, s.y);
      const near = c && !openedCaches.includes(c.id) ? c : null;
      if (!near || near.id !== cacheLive.current.id) cacheLive.current.hold = 0;
      if (near?.scenario === "encrypted" && held.has("KeyY")) cacheLive.current.hold = Math.min(ENCRYPT_SECONDS, cacheLive.current.hold + dt);
      else if (near?.scenario === "encrypted") cacheLive.current.hold = Math.max(0, cacheLive.current.hold - dt * 2);
      cacheLive.current.id = near?.id ?? null;
      if (near) {
        let enemiesNear = 0;
        for (const m of sim.machines) if (m.alive && Math.hypot(m.x - near.x, m.z - near.z) < GUARD_RADIUS) enemiesNear++;
        const gate = canOpen(near, { enemiesNear, weather: environmentAt(here?.id, time.current, nightFactor(time.current)).weather?.state, night: nightFactor(time.current), heldSeconds: cacheLive.current.hold });
        cacheLive.current.view = { id: near.id, label: SCENARIO_LABEL[near.scenario], rarity: near.rarity, ok: gate.ok, reason: gate.reason, hold: cacheLive.current.hold / ENCRYPT_SECONDS };
      } else cacheLive.current.view = null;
    }
    // weapon-evolution ruins (weapon-evolution.ts): report the nearest one in discovery range
    {
      let best: HudState["ruinNear"] = null;
      if (!s.inVehicle && !s.insideInterior) for (const r of ruins()) {
        const d = Math.hypot(r.x - s.x, r.z - s.z);
        if (d <= RUIN_DISCOVER_RADIUS && (!best || d < best.dist)) best = { id: r.id, name: r.name, dist: d, reach: d <= RUIN_REACH, done: gear ? isEvolved(gear, r.id) : false };
      }
      ruinLive.current = best;
    }
    const nexusLockdown = lockdownStatus(s.detectionMeter);
    if (inNexus && nexusLockdown.tier !== lastLockdownTier.current) {
      if (nexusLockdown.tier !== "MONITORING") alert(sim, `Nexus City: ${nexusLockdown.response}`);
      lastLockdownTier.current = nexusLockdown.tier;
    } else if (!inNexus) {
      lastLockdownTier.current = "MONITORING";
    }

    if (held.has("KeyB") && !bossHeld.current && here && here.kind !== "safe" && !tutorial && !sim.machines.some((m) => m.alive && m.boss && m.zone === here.id)) {
      summonBoss(sim, here.id, s.x + Math.sin(s.yaw) * 24, s.z + Math.cos(s.yaw) * 24);
    }
    bossHeld.current = held.has("KeyB");
    // Abilities: Scene only forwards the input edge (keyboard Q/E/R, or the controller chord) and the pose.
    // Cost, cooldown, target validation, damage, stun and the event record all happen in ability-effects.ts against the real sim.
    const padForAbilities = typeof navigator !== "undefined" && navigator.getGamepads ? Array.from(navigator.getGamepads()).find(Boolean) ?? null : null;
    const chord = abilityChord(padForAbilities ? padForAbilities.buttons.map((b) => b.pressed) : [], (settings.bindings ?? DEFAULT_BINDINGS).gamepad);
    for (const [key, slot] of [["KeyQ", "PRIMARY"], ["KeyE", "TACTICAL"], ["KeyR", "ULTIMATE"]] as const) {
      const down = held.has(key) || chord[slot];
      if (down && !abilityHeld.current[key]) {
        const cast = castAbility(sim, live.current, slot, { x: s.x, z: s.z, yaw: s.yaw }, { environment: here?.kind ?? "war", subclassId, inVehicle: s.inVehicle });
        if (cast.ok) {
          const effect = cast.config.effects[0];
          s.x = cast.pose.x; s.z = cast.pose.z; s.yaw = cast.pose.yaw;
          s.specialTime = Math.max(s.specialTime, slot === "ULTIMATE" ? 1.5 : 0.8);
          sfx.playAbility(effect?.kind ?? "ABILITY");
          s.punch += COMBAT_FEEDBACK.ability.cameraImpulse * 8; rumble(padForAbilities, "ability");
          bossActionLog.current = logAction(bossActionLog.current, effect?.kind === "DASH" ? "DASH" : "ABILITY", performance.now() / 1000);
          if (tutorial?.step === "ABILITY") onTutorialEvent?.("ABILITY");
          else if (tutorial?.step === "REINFORCE" && slot === "PRIMARY") onTutorialEvent?.("MASTERY");
          else if (tutorial?.step === "CHAMBER") { chamberActions.current.add(slot); if (chamberActions.current.size >= 2) onTutorialEvent?.("CHAMBER"); }
          else if (tutorial?.step === "POWER" && slot !== "PRIMARY") onTutorialEvent?.("CHAIN");
          else if (tutorial?.step === "SENTINEL" && sentinel.current && effect?.kind !== "BLOCK") { sentinel.current.hp -= 2; }
        } else alert(sim, cast.text);
      }
      abilityHeld.current[key] = down;
    }
    {
      // Dragonite (dragonite-cast.ts): the bonded Operator's four abilities on rebindable keys
      const dkeys = normalizeBindings(settings.bindings).keyboard;
      const dr = dragoniteRt.current, dctx: { earnedRewards: readonly string[]; inventory: PlayerProgression["inventory"]; equippedGear: Partial<Record<string, string>>; cls: ClassId | null; fury?: number } = { earnedRewards: gear?.earnedRewards ?? [], inventory: gear?.inventory ?? [], equippedGear: gear?.equippedGear ?? {}, cls: playerClass };
      for (const id of DRAGONITE_IDS) {
        const down = held.has(dkeys[id]);
        if (down && !dr.held[id]) {
          const e = { value: live.current.energy };
          const r = castDragonite(dr.rt, sim, e, id, { x: s.x, z: s.z, yaw: s.yaw }, s.grounded, dctx);
          if (r.ok) {
            if (id === "wyrmcall") { const line = vyrakReact(vyrakMind.current.p, "summon", vyrakMind.current.clock); if (line) alert(sim, `VYRAK: ${line.text}`); }
            live.current.energy = e.value; s.punch += 0.2; sfx.playAbility("ABILITY");
            if (r.launchVy) { s.vy = Math.max(s.vy, r.launchVy); s.grounded = false; }
            else if (id === "wyrmwing") { velocity.x += Math.sin(s.yaw) * 18; velocity.z += Math.cos(s.yaw) * 18; }
          } else if (r.text) alert(sim, r.text);
        }
        dr.held[id] = down;
      }
      const vm = vyrakMind.current;
      if (dctx.earnedRewards.includes(`covenant:vyrak:${playerClass}`)) {
        vm.clock += dt; vyrakStepMood(vm.p, dt);
        const say = (line: { text: string } | null) => { if (line) alert(sim, `VYRAK: ${line.text}`); };
        if (sim.kills > vm.kills) say(vyrakReact(vm.p, sim.machines.filter((m) => m.alive && m.boss).length < vm.bosses ? "bossKill" : "kill", vm.clock));
        if (sim.hp < vm.hp - 0.5) say(vyrakReact(vm.p, "hurt", vm.clock));
        if (sim.hp < 30 && vm.hp >= 30 && vm.clock - vm.lowAt > 30) { vm.lowAt = vm.clock; say(vyrakReact(vm.p, "lowHp", vm.clock)); }
        if (sim.hp >= 60 && vm.hp < 30) say(vyrakReact(vm.p, "recover", vm.clock));
        vm.kills = sim.kills; vm.hp = sim.hp; vm.bosses = sim.machines.filter((m) => m.alive && m.boss).length;
        say(maybeIdle(vm.p, vm.clock));
        dctx.fury = furyBonus(vm.p);
      }
      const dres = stepDragonite(dr.rt, sim, dt, { x: s.x, z: s.z }, dctx);
      dragoniteHud.current = playerClass && dctx.earnedRewards.includes(`covenant:vyrak:${playerClass}`) ? DRAGONITE_IDS.map((id) => ({ name: DRAGONITE[id].name, cd: dr.rt.cd[id], max: dragoniteStatsFor(dctx, id).cooldown, key: dkeys[id] })) : null;
      sim.dragoniteResist = dres.resist;
    }
    /* ---------------- weather cycle (deterministic fronts per region, see weather-cycle.ts) ---------------- */
    // seasons layer on top of the fronts (environment.ts): same deterministic clock, seasonally-adjusted weather
    const envSample = environmentAt(here?.id, time.current, night);
    const wx = interior ? null : envSample.weather;
    const weather = interior ? "Indoor" : wx!.label;
    weatherKind.current = weather;
    weatherFx.current.precipitation = wx?.precipitation ?? 0;
    weatherFx.current.windX = wx?.windX ?? 0;
    weatherFx.current.windZ = wx?.windZ ?? 0;
    updateWind(dt, wx?.windX ?? 0, wx?.windZ ?? 0);
    weatherName.current = interior ? "Indoor" : weatherLabel(wx!, here?.id);
    const visibility = interior ? 1 : wx!.visibility;
    sim.envVisibility = visibility;
    {
      const hzT = performance.now() / 1000, hzSheltered = s.inVehicle || !!s.insideInterior;
      const zone = zoneAt(s.x, s.z, hzT, hzSheltered); // localized zones (hazard-zones.ts) stack on the regional hazard
      zonePull.current.x = zone.pullX; zonePull.current.z = zone.pullZ;
      const hz = combineHazard(hazardAt({ regionId: s.insideInterior ? null : regionAt(s.x, s.z)?.id ?? null, t: hzT, dt, sheltered: hzSheltered, exposure: hazardRef.current.exposure }), zone);
      if (hz.warning && hz.warning !== hazardRef.current.warning) alert(sim, hz.warning);
      hazardRef.current = hz;
      if (hz.damagePerSec > 0) { if (sim.hp - hz.damagePerSec * dt <= 1) hurtPlayer(sim, 5, hz.name); else chipPlayer(sim, hz.damagePerSec * dt); }
    }
    // environmental hazards: exposure, lightning, with shelter in interiors / safe zones / the Nexus shield
    {
      sim.sanctuaries = sanctuaries;
      sim.inSafeZone = !s.diving && (here?.kind === "safe" || here?.id === "nexus" || sanctuaries.some((z) => Math.hypot(s.x - z.x, s.z - z.z) < z.radius)); // health.ts: fast recovery in safe zones
      // ammo.ts: kills refund the equipped weapon, safe ground and supply points top every reserve up
      if (sim.kills > ammoKills.current) { s.ammo = killRefund(s.ammo, s.weapon, sim.kills - ammoKills.current); }
      ammoKills.current = sim.kills;
      if (sim.inSafeZone || atSupplyPoint(s.x, s.z)) s.ammo = trickleRestock(s.ammo, dt, ammoCarry.current);
      const sheltered = Boolean(interior) || here?.kind === "safe" || here?.id === "nexus" || s.diving; // underwater: no lightning or air exposure (live playtest showed a storm bolt striking the Sentry Dock seabed)
      const hazard = stepEnvironment(sim.env, { dt, regionId: here?.id, env: envSample, sheltered, px: s.x, pz: s.z, rand: Math.random });
      if (hazard.damage > 0) hurtPlayer(sim, hazard.damage, hazard.cause);
      for (const strike of hazard.detonated) {
        applyLightning(sim, strike, s.x, s.z);
        sfx.playExplosion(false, sfx.where(s.x, s.z, s.yaw, strike.x, strike.z));
        s.punch += Math.hypot(s.x - strike.x, s.z - strike.z) < 25 ? 1.2 : 0.4;
      }
      environmentSummary.current = interior ? "Indoor" : envSample.summary;
      hazardWarning.current = hazard.warning;
    }
    // regional atmosphere: ease toward this region's air (fog tint/thickness, sun + skylight tint)
    {
      const target: Atmosphere = interior ? NEUTRAL_ATMOSPHERE : atmosphereAt(here?.id ?? (Math.hypot(s.x - NEON_CITY_CENTER.x, s.z - NEON_CITY_CENTER.z) < 160 ? "neon" : undefined), wx?.state, night);
      const a = atmo.current;
      const k = 1 - Math.exp(-0.9 * dt);
      a.fogMix += (target.fogMix - a.fogMix) * k;
      a.fogScale += (target.fogScale - a.fogScale) * k;
      a.lightMix += (target.lightMix - a.lightMix) * k;
      a.skyMix += (target.skyMix - a.skyMix) * k;
      a.haze += (target.haze - a.haze) * k;
      a.fogTint.lerp(atmoScratch.set(target.fogTint), k);
      a.lightTint.lerp(atmoScratch.set(target.lightTint), k);
      a.skyTint.lerp(atmoScratch.set(target.skyTint), k);
      if (scene.fog) (scene.fog as THREE.Fog).color.lerp(a.fogTint, a.fogMix);
      // regional sky colour: the horizon/background picks up this region's own sky tint
      scene.background instanceof THREE.Color && scene.background.lerp(a.fogTint, a.fogMix * 0.35).lerp(a.skyTint, a.skyMix);
      if (sun.current) sun.current.color.lerp(a.lightTint, a.lightMix);
      if (hemi.current) hemi.current.color.copy(a.hemiBase).lerp(a.lightTint, a.lightMix * 0.8);
      // regional water: ease the ocean toward this region's colours, murk and wave chop
      const wTarget = waterStyleAt(here?.id, wx?.state);
      const w = waterStyle.current;
      w.deep.lerp(atmoScratch.set(wTarget.deep), k);
      w.shallow.lerp(atmoScratch.set(wTarget.shallow), k);
      w.murk += (wTarget.murk - w.murk) * k;
      w.chop += (wTarget.chop - w.chop) * k;
      // signature sky: ease toward this region's effect so borders blend instead of popping
      const fxT = interior ? NO_SKY_FX : skyFxAt(here?.id, night, wx?.state, wx?.cloud ?? 0);
      const f = skyFx.current;
      f.color.lerp(atmoScratch.set(fxT.color), k);
      f.density += (fxT.density - f.density) * k;
      f.fall += (fxT.fall - f.fall) * k;
      f.drift += (fxT.drift - f.drift) * k;
      f.size += (fxT.size - f.size) * k;
      f.glow += (fxT.glow - f.glow) * k;
      f.aurora += (fxT.aurora - f.aurora) * k * 0.5;
    }
    if (scene.fog instanceof THREE.Fog) {
      const fogK = 1 - Math.exp(-3 * dt);
      // regional air thickness (atmosphere.ts fogScale) scales the weather-driven fog distances
      // the cheaper tiers see less far: the terrain streams out to ~1.25x the fog distance (Terrain.tsx), so a nearer fog line
      // is fewer ground chunks to build and draw (measured: ~130 chunk draws a frame in the forest at scale 6 with no cap)
      const fogCap = FOG_CAP[settings.renderTier as keyof typeof FOG_CAP] ?? Infinity;
      scene.fog.near += (Math.min(fogCap * 0.3, (25 + visibility * 95) * FOG_REACH * atmo.current.fogScale) - scene.fog.near) * fogK;
      scene.fog.far += (Math.min(fogCap, (120 + visibility * 400) * FOG_REACH * atmo.current.fogScale) - scene.fog.far) * fogK;
    }
    // underwater look: diving swaps the horizon for a close, turbid teal murk (eased in and out)
    underK.current += ((s.diving && !interior ? 1 : 0) - underK.current) * (1 - Math.exp(-4 * dt));
    sfx.setUnderwaterMuffle(underK.current);
    if (underK.current > 0.01 && scene.fog instanceof THREE.Fog) {
      const u = underK.current;
      // Thalassia keeps its structures readable; open water stays a close murk (underwater.ts underwaterVisibility)
      const vis = underwaterVisibility(s.sector, Math.max(0, WATER_LEVEL - s.y));
      waterTint.copy(deepWater).multiplyScalar(0.55 + vis.light * 0.75);
      scene.fog.color.lerp(waterTint, u);
      scene.fog.near += (vis.near - scene.fog.near) * u;
      scene.fog.far += (vis.far - scene.fog.far) * u;
      if (scene.background instanceof THREE.Color) scene.background.lerp(waterTint, u);
    }
    // below the surface there is no sky: hide the atmosphere and the dome so the murk reads as water, not air
    const skyUp = underK.current < 0.6;
    if (sky.current) sky.current.visible = skyUp;
    if (skyDomeGroup.current) skyDomeGroup.current.visible = skyUp;
    const cloud = wx?.cloud ?? 0;
    if (sun.current) sun.current.intensity *= 1 - cloud * 0.6;
    if (moon.current) moon.current.intensity *= 1 - cloud * 0.5;

    /* ---------------- sky atmosphere + cloud layer (reacts to day phase + live regional weather) ---------------- */
    skyEnv.current.cloud = cloud;
    skyEnv.current.region = interior ? undefined : here?.id;
    skyEnv.current.tint.copy(lightColor).multiplyScalar(1 - cloud * 0.3);
    skyEnv.current.night = night;
    worldLight.night = night;
    // image-based light (region HDRIs) is daylight: dim it after dark so night scenes are lit by the moon, neon and the storm

    // cities after dark keep a glow-bounce fill (atmosphere.ts cityNightFill), so their streets read between the lamps
    const inCity = interior ? 1 : Math.max(cityPresence(Math.hypot(s.x - NEON_CITY_CENTER.x, s.z - NEON_CITY_CENTER.z), NEON_FLAT), cityPresence(Math.hypot(s.x - NEXUS_REGION.x, s.z - NEXUS_REGION.z), 95));
    if (hemi.current) hemi.current.intensity = 0.2 + 0.38 * (1 - night) + cityNightFill(inCity, night); // a moonlit sky fill at night: the reference nights read blue, not black
    // Neon City after dark: the glow bounce takes the signage's violet-cyan cast instead of grey moonlight (owner: neon cyberpunk)
    const inNeon = interior ? 0 : cityPresence(Math.hypot(s.x - NEON_CITY_CENTER.x, s.z - NEON_CITY_CENTER.z), NEON_FLAT);
    if (hemi.current) hemi.current.groundColor.copy(HEMI_GROUND); // the sky colour is re-based every frame above; the ground colour is here
    if (hemi.current && inNeon > 0.01 && night > 0.01) { hemi.current.color.lerp(NEON_SKY_GLOW, 0.55 * inNeon * night); hemi.current.groundColor.lerp(NEON_GROUND_GLOW, 0.5 * inNeon * night); }
    // metal and glass are lit by reflections, not the hemisphere: keep some city glow in the reflections too, or Neon's
    // metal stalls and decks render pure black at night
    (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = 0.62 * (1 - 0.75 * night) + cityNightFill(inCity, night) * 0.9;
    if (sky.current) {
      const m = (sky.current as unknown as { material?: THREE.ShaderMaterial }).material;
      const u = m?.uniforms;
      if (u) {
        // low sun angle and poor visibility both thicken the haze near the horizon; cloud cover
        // scatters more light too, so an overcast/stormy sky reads hazier and less saturated
        const horizonBoost = Math.max(0, 1 - Math.abs(Math.sin(theta)));
        // regional haze (atmosphere.ts): ember smoke / swamp mist / wasteland grit thicken the sky
        const haze = atmo.current.haze;
        if (u["turbidity"]) u["turbidity"].value = 3.5 + horizonBoost * 2.5 + cloud * 5 + (1 - visibility) * 7 + haze * 0.5; // high turbidity bleaches the physical sky white, so regional haze only adds half; the colour comes from the sky mood (sky-dome.ts)
        if (u["rayleigh"]) u["rayleigh"].value = 1.4 + horizonBoost * 1.4 + night * 0.4;
        if (u["mieCoefficient"]) u["mieCoefficient"].value = 0.004 + cloud * 0.01 + (1 - visibility) * 0.01 + haze * 0.002;
        if (u["mieDirectionalG"]) u["mieDirectionalG"].value = 0.8;
      }
    }
    // storm lightning: brief sky-wide flashes
    if (wx?.state === "STORM") {
      lightning.current -= dt;
      if (lightning.current < -2 - Math.random() * 6) lightning.current = 0.18;
      if (lightning.current > 0 && sun.current) { sun.current.intensity += 3.5; sun.current.color.set("#d9c4ff"); /* fracture storms flash violet (trailer reference) */ }
    }
    // Interiors are flat pocket rooms far outside the terrain's authored bounds, so slope/height/water sampling there would just be noise — treat them as dry, flat, and out of the water entirely.
    const slope = interior ? 0 : slopeAt(s.x, s.z);
    const ground = interior ? INTERIOR_ALTITUDE : Math.max(walkHeight(s.x, s.z), stormGroundAt(s.x, s.z, s.y - 1.6));
    let submerged = interior ? false : heightAt(s.x, s.z) < WATER_LEVEL - 0.2; // re-read after a teleport below, or the first frame snaps a diver to the surface
    if (submerged && !s.wasSubmerged) sfx.playSplash(Math.min(1, (s.inVehicle ? Math.abs(s.vSpeed) : velocity.length()) / 20));
    s.wasSubmerged = submerged;
    if (!submerged) s.diving = false;
    /* ---------------- oxygen: depletes while diving below the surface, regenerates everywhere else ---------------- */
    // functional air stations in Thalassia refill the rebreather even while submerged (thalassia-sectors.ts)
    const dockAir = airlockRestored(descent) || !!gear?.completedMissions?.includes("descent-protocol");
    const atStation = s.diving ? airStationAt(s.x, s.y, s.z, dockAir) : null;
    s.oxygen = oxygenStep(s.oxygen, dt, s.diving && !atStation, s.sector ? REBREATHER_DRAIN_SCALE : 1);
    const depth = s.diving ? Math.max(0, WATER_LEVEL - s.y) : 0;
    const oxygenPenalty = lowOxygenPenalty(s.oxygen);
    if (s.diving && s.oxygen <= 0 && Math.random() < dt * 0.6) chipPlayer(sim, 4); // drowning trickle damage, never a hard kill on its own
    /* ---------------- Thalassia sectors: hull stress past crush depth, electrified coolant in the Abyssal Ring ---------------- */
    {
      const sector = submerged ? sectorAt(s.x, s.y, s.z) : null;
      if (sector && !s.sector) s.breachAt = performance.now() / 1000; // entering the city: the breach overlay plays
      s.sector = sector;
      s.hull = hullStressStep(s.hull, s.diving ? depth : 0, dt);
      const envDamage = hullDamagePerSec(s.hull) * dt + coolantDamage(sector, s.y, performance.now() / 1000, dt);
      if (envDamage > 0) chipPlayer(sim, envDamage); // environmental, like drowning: never a hard kill on its own
      // NOVA hazard cues: once per dive each, before the hazard can matter
      const cue = (key: string, line: string) => { if (!s.cues.has(key)) { s.cues.add(key); alert(sim, `NOVA: ${line}`); } };
      if (!s.diving) s.cues.clear();
      else {
        if (s.oxygen < 30) cue("o2", "Rebreather's under a third. Find an air station or get topside.");
        if (sector === "ABYSSAL_RING") cue("coolant", "Live coolant on this floor. When the ring charges, get up off it.");
        if (s.hull > 0.25) cue("hull", "Past crush depth — your suit won't hold long. Ascend to bleed the stress off.");
        if (atStation) cue(`air-${atStation.id}`, "Air station's live. Breathe while you can.");
      }
    }

    s.viewCool -= dt;
    if (held.has("KeyF") && !cameraToggleHeld.current) {
      s.firstPerson = !s.firstPerson;
      onCameraPreference?.(s.firstPerson);
    }
    cameraToggleHeld.current = held.has("KeyF");

    if (held.has("KeyX") && s.meleeCool <= 0 && !s.inVehicle) {
      s.meleeCool = 0.7;
      s.meleeTime = 0.72;
      bossActionLog.current = logAction(bossActionLog.current, "MELEE", performance.now() / 1000);
      for (const enemy of sim.machines) {
        if (!enemy.alive) continue;
        const dx = enemy.x - s.x;
        const dz = enemy.z - s.z;
        if (Math.hypot(dx, dz) > 7 || dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw) < 0) continue;
        enemy.hp -= 2.4;
        markGoreHit(sim, enemy, dx || 0.01, dz, 2.4, "CRUSH");
        enemy.cool = Math.max(enemy.cool, 0.5);
         defeatMachine(sim, enemy);
      }
    }

    /* ------- predictive aim assist: cone → lead → soft magnetism ------- */
    s.aimLocked = false;
    if (settings.aimAssist) {
      const CONE = 0.12; // ~7 degrees
      let best: { yaw: number; score: number } | null = null;
      for (const m of sim.machines) {
        if (!m.alive) continue;
        const dx = m.x - s.x;
        const dz = m.z - s.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 120 || dist < 2) continue;
        // lead the target using its knockback drift so shots land ahead of it
        const lead = dist / 130;
        const want = Math.atan2(dx + m.kx * lead, dz + m.kz * lead);
        const off = Math.abs(Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw)));
        if (off > CONE) continue;
        const score = off + dist * 0.002;
        if (!best || score < best.score) best = { yaw: want, score };
      }
      if (best) {
        // soft snap only — strength grows as the crosshair closes on the target
        const strength = best.score < 0.03 ? 0.35 : best.score < 0.07 ? 0.2 : 0.1;
        const delta = Math.atan2(Math.sin(best.yaw - s.yaw), Math.cos(best.yaw - s.yaw));
        s.yaw += delta * strength * Math.min(1, dt * 12);
        s.aimLocked = true;
      }
    }

    /* ------- weapon system: guns = rhythm, sword = close-quarters, feel springs back ------- */
    /* ------- input: keyboard + controller weapon selection (configurable bindings) ------- */
    const binds = settings.bindings ?? DEFAULT_BINDINGS;
    const pad = typeof navigator !== "undefined" && navigator.getGamepads ? Array.from(navigator.getGamepads()).find(Boolean) ?? null : null;
    const padNow = pad ? maskChord(pad.buttons.map((b) => b.pressed), binds.gamepad) : [];
    const padTap = (i: number) => !!padNow[i] && !padPrev.current[i];
    const keyTap = (code: string) => held.has(code) && !keyPrev.current.has(code);
    padState.current = { fire: !!padNow[binds.gamepad.fire], aim: !!padNow[binds.gamepad.aim], connected: !!pad };
    const equip = (id: WeaponId) => {
      if (s.weapon === id) return;
      s.weapon = id; s.burstLeft = 0; s.reload = 0; s.switchedAt = performance.now();
      s.fireCool = Math.max(s.fireCool, 0.25);
      sfx.playSwitch();
      alert(sim, `${WEAPONS[id].name} equipped`);
    };
    const order = orderRef.current;
    if (!order.includes(s.weapon)) equip(order[0]!);
    const step = (dir: number) => equip(order[(Math.max(0, order.indexOf(s.weapon)) + dir + order.length) % order.length]!);
    order.forEach((id, i) => { if (held.has(`Digit${i + 1}`) || padTap(binds.gamepad[`slot${i + 1}` as "slot1"])) equip(id); });
    if (keyTap(binds.keyboard.nextWeapon) || padTap(binds.gamepad.nextWeapon)) step(1);
    if (keyTap(binds.keyboard.prevWeapon) || padTap(binds.gamepad.prevWeapon)) step(-1);
    s.wheel = held.has(binds.keyboard.weaponWheel) || !!padNow[binds.gamepad.weaponWheel];
    if (s.wheel && pad) {
      // flick the right stick toward a slot: up=1, right=2, down=3, left=4
      const [rx = 0, ry = 0] = [pad.axes[2], pad.axes[3]];
      if (Math.hypot(rx, ry) > 0.6) equip(Math.abs(rx) > Math.abs(ry) ? (rx > 0 ? order[1 % order.length]! : order[order.length - 1]!) : (ry < 0 ? order[0]! : order[2 % order.length]!));
    }
    const def = WEAPONS[s.weapon];
    const clip = s.ammo[s.weapon];
    const startReload = () => { if (def.mag > 0 && s.reload <= 0 && clip.mag < def.mag && clip.reserve > 0) { s.reload = def.reload; s.burstLeft = 0; sfx.playReload("start"); alert(sim, `Reloading ${def.name}`); } };
    if (!s.inVehicle && (keyTap(binds.keyboard.reload) || padTap(binds.gamepad.reload))) startReload();

    /* ---------------- stratagems: hold N, enter an arrow code, release N to throw the beacon ---------------- */
    {
      const st = stratagem.current;
      const nowS = performance.now() / 1000;
      const allowed = !s.inVehicle && !interior && !tutorial;
      if (!allowed && (st.open || st.armed)) { st.armed = null; closeStratagems(st); }
      if (allowed && keyTap("KeyN") && !st.armed) openStratagems(st);
      if (st.open) {
        for (const [code, dir] of [["ArrowUp", "U"], ["ArrowDown", "D"], ["ArrowLeft", "L"], ["ArrowRight", "R"]] as const) {
          if (!keyTap(code)) continue;
          const event = inputDirection(st, dir, nowS);
          if (event === "match") { sfx.playAbility("MARK"); alert(sim, `${stratagemById(st.armed!).name} ready — release N to throw`); }
          else if (event === "cooldown") alert(sim, "Stratagem still cooling down");
          else if (event === "partial") sfx.playReload("end");
        }
        tickStratagems(st, nowS);
      }
      if (!held.has("KeyN") && keyPrev.current.has("KeyN")) {
        const thrown = releaseStratagems(st, nowS, sim.backpack.cooldownMult);
        if (thrown && !throwBeacon(sim, thrown, s.x, s.y + 1.4, s.z, s.yaw, s.pitch)) alert(sim, "Too many beacons in the field");
      }
    }
    if (s.reload > 0) {
      s.reload -= dt;
      if (s.reload <= 0) { const take = Math.min(def.mag - clip.mag, clip.reserve); clip.mag += take; clip.reserve -= take; s.reload = 0; sfx.playReload("end"); }
    }
    padPrev.current = padNow;
    keyPrev.current = new Set(held);
    const wpn = s.inVehicle ? WEAPONS.AUTO : WEAPONS[s.weapon];
    const equippedWeapon = gear?.inventory.find((item) => item.id === gear.equippedGear[s.inVehicle ? "vehicle" : s.weapon === "HEAVY" || WEAPONS[s.weapon].kind === "launcher" ? "heavy" : s.weapon === "PULSE" ? "secondary" : "primary"]);
    const gearPower = equippedWeapon ? weaponDamageMultiplier(equippedWeapon.power) : 1;
    // foundries.ts: the equipped weapon's foundry is a real rule (Häkke/Black Armory in sim.ts, Omolon/SUROS/Tex here)
    const foundry = s.inVehicle ? null : foundryOf(equippedWeapon);
    sim.foundry = foundry;
    const heatMult = foundry === "OMOLON" ? FOUNDRY_RULES.omolonHeat : 1, recoilMult = foundry === "SUROS" ? FOUNDRY_RULES.surosRecoil : 1;
    const hipMult = foundry === "TEX_MECHANICA" && !(mouse.current.aim || padState.current.aim) ? FOUNDRY_RULES.texHip : 1;
    sim.equippedElement = equippedWeapon?.element ?? "KINETIC";
    if (sim.equippedPerk !== equippedWeapon?.perk) sim.nullCharge = { charge: 0, lastTimedAt: -1e9, cooldownUntil: sim.nullCharge.cooldownUntil, lastEventId: sim.nullCharge.lastEventId };
    sim.equippedPerk = equippedWeapon?.perk;
    if (sim.equippedEvolution !== equippedWeapon?.evolution?.ability) sim.evoCharge = freshCharge();
    sim.equippedEvolution = equippedWeapon?.evolution?.ability;
    // godforge.ts: runes of the relic in hand (rebuilt only when the relic or its runes change)
    const runeKey = equippedWeapon?.godforge ? `${equippedWeapon.id}|${equippedWeapon.godforge.runes.join(",")}|${equippedWeapon.godforge.awakened}` : "";
    if (runeKey !== runeKeyRef.current) { runeKeyRef.current = runeKey; const rc = runeCombat(equippedWeapon?.godforge); Object.assign(sim.runes, rc, { charges: rc.bursts.map(() => freshCharge()), devourHits: 0 }); relicIdRef.current = equippedWeapon?.godforge ? equippedWeapon.id : null; }
    // self-targeted subclass verbs (RAGE/OVERSHIELD, see subclass-verbs.ts) live on LiveBuild, which
    // has no reference to WorldSim — bridge them in every frame rather than one-shot at cast time.
    syncSimFromLive(sim, live.current);
    s.recoil = decay(s.recoil, 9, dt);
    s.punch = decay(s.punch, 14, dt);
    s.bloom = decay(s.bloom, 6, dt);
    if (live.current.siegeTime > 0) s.bloom *= SIEGE_BLOOM_MULT;
    {
      // dynamic reticle: spread follows locomotion + bloom, the barrel index lags the camera, hits flash
      const r = reticle.current;
      if (!r.ready) { r.yaw = s.yaw; r.pitch = s.pitch; r.hit = sim.lastHit; r.kills = sim.kills; r.ready = true; }
      const speed = Math.hypot(velocity.x, velocity.z);
      const motion: Motion = !s.grounded && !s.diving && !s.inVehicle ? "AIR" : speed > 2 && (held.has("ShiftLeft") || held.has("ShiftRight")) ? "SPRINT" : speed > 0.6 ? "WALK" : "IDLE";
      const safeDt = Math.max(dt, 1e-3);
      let dYaw = s.yaw - r.yaw;
      if (dYaw > Math.PI) dYaw -= Math.PI * 2; else if (dYaw < -Math.PI) dYaw += Math.PI * 2;
      const lookRight = -dYaw / safeDt; // yaw decreases when the camera turns right
      const lookUp = (s.pitch - r.pitch) / safeDt;
      r.yaw = s.yaw; r.pitch = s.pitch;
      if (sim.kills > r.kills) markHit(r.state, "KILL");
      else if (sim.lastHit !== r.hit) markHit(r.state, "HIT");
      r.kills = sim.kills; r.hit = sim.lastHit;
      r.view = stepReticle(r.state, { motion: s.inVehicle ? "IDLE" : motion, bloom: s.bloom, aiming: Boolean(mouse.current.aim || padState.current.aim), lookRight, lookUp }, dt);
    }
    s.swing = Math.max(0, s.swing - dt);
    s.comboTime = Math.max(0, s.comboTime - dt);
    if (s.comboTime <= 0) s.combo = 0;
    // in a vehicle Space is the handbrake and the pad's RT is the throttle, so neither fires: mouse or pad X (2) fires the guns, RMB / pad Y (3) the ordnance
    const trigger = s.inVehicle ? mouse.current.fire || !!padNow[2] : held.has("Space") || mouse.current.fire || padState.current.fire;
    const secondaryTrigger = s.inVehicle && (mouse.current.aim || !!padNow[3]);
    // rounds leave from just under the eye, along the camera ray: the old +0.95 (2.55 m up, from before the life-size pass)
    // flew over a standing trooper's head and drew first-person tracers ~5 degrees above the crosshair, never crossing it
    const SHOT_EYE = OPERATOR_CAMERA.eye - 0.05;
    const shoot = () => {
      if (!s.inVehicle && wpn.mag > 0) {
        if (s.reload > 0) return;
        if (clip.mag <= 0) { s.burstLeft = 0; if (clip.reserve <= 0) sfx.playDryFire(); startReload(); return; }
      }
      const spread = underwaterSpread((wpn.spread + s.bloom * 0.04) * ((mouse.current.aim || padState.current.aim) ? wpn.adsSpread : 1), s.diving ? depth : 0);
      const yawJ = (Math.random() - 0.5) * 2 * spread;
      const pitchJ = (Math.random() - 0.5) * 2 * spread;
      if (!s.inVehicle && wpn.kind === "launcher" && isLauncherId(wpn.id)) {
        // launcher rounds are sim.rounds (ordnance rules): splash damage and elemental status are resolved in stepSim, never here
        if (fireLauncher(sim, wpn.id, s.x + Math.sin(s.yaw) * 0.6, s.y + SHOT_EYE, s.z + Math.cos(s.yaw) * 0.6, s.yaw + yawJ, s.pitch + s.recoil + pitchJ, wpn.damage * gearPower * (1 + armorFxRef.current.weaponDamage), wpn.knock, wpn.heat * heatMult)) {
          bossActionLog.current = logAction(bossActionLog.current, "RANGED", performance.now() / 1000);
          sfx.playShot(s.weapon);
          s.shots++;
          s.recoil += wpn.recoil * recoilMult;
          s.punch += wpn.punch;
          s.bloom = Math.min(1, s.bloom + 0.18 * wpn.punch);
          if (live.current.veilTime > VEIL_BREAK_TIME) live.current.veilTime = VEIL_BREAK_TIME;
          clip.mag--; if (clip.mag <= 0) startReload();
        }
        return;
      }
      // shotguns fire a spread of pellets per trigger pull; every pellet is a real bullet with its own jitter
      let fired = false;
      const pellets = s.inVehicle ? 1 : wpn.pellets ?? 1;
      for (let pi = 0; pi < pellets; pi++) {
        const py = pi === 0 ? yawJ : (Math.random() - 0.5) * 2 * spread, pp = pi === 0 ? pitchJ : (Math.random() - 0.5) * 2 * spread;
        if (fireBullet(sim, s.x, s.y + SHOT_EYE, s.z, s.yaw + py, s.inVehicle, s.pitch + s.recoil + pp, wpn.damage * gearPower * hipMult * (1 + armorFxRef.current.weaponDamage), wpn.knock / pellets, (wpn.heat * heatMult) / pellets, s.inVehicle ? undefined : wpn.element, pellets > 1 ? "PELLET" : "BULLET")) fired = true;
      }
       if (fired) {
        s.shots++;
        bossActionLog.current = logAction(bossActionLog.current, "RANGED", performance.now() / 1000);
        sfx.playShot(s.inVehicle ? "VEHICLE" : s.weapon);
        if (!s.inVehicle) ejectCasing(fxBus.casings, s.weapon, s.x + Math.sin(s.yaw) * 0.5, s.y + 0.9, s.z + Math.cos(s.yaw) * 0.5, s.yaw);
        s.recoil += wpn.recoil * recoilMult;
        s.punch += wpn.punch;
        s.bloom = Math.min(1, s.bloom + 0.18 * wpn.punch);
        if (live.current.veilTime > VEIL_BREAK_TIME) live.current.veilTime = VEIL_BREAK_TIME;
        if (!s.inVehicle && wpn.mag > 0) { clip.mag--; if (clip.mag <= 0) startReload(); }
      }
    };
    if (wpn.kind === "sword") {
      if (trigger && s.fireCool <= 0) {
        s.fireCool = wpn.fireRate;
        s.combo = (s.combo % 3) + 1;
        s.comboTime = 0.9;
        s.swing = 0.3;
        sfx.playSwing(s.combo === 3);
        s.meleeTime = Math.max(s.meleeTime, 0.6);
        bossActionLog.current = logAction(bossActionLog.current, "MELEE", performance.now() / 1000);
        s.punch += wpn.punch * (s.combo === 3 ? 1.6 : 1);
        // foundries.ts monoblades: damage, reach, a finisher shockwave and a deflect window replace the plain swing
        const blade = activeBlade({ earnedRewards: gear?.earnedRewards ?? [], blade: gear?.blade });
        const swing = swingStats(blade, s.combo, { damage: wpn.damage, reach: s.combo === 3 ? 8 : 6 }, false);
        const reach = swing.reach;
        if (swing.deflect > 0) sim.deflectUntil = performance.now() / 1000 + swing.deflect;
        if (swing.shockwave) {
          const sw = swing.shockwave;
          for (const enemy of sim.machines) {
            if (!enemy.alive || enemy.decoy || !inShockwave(sw, s.x, s.z, s.yaw, enemy.x, enemy.z)) continue;
            const swd = applyMachineDamageMods(sim, enemy, sw.damage, "ARC", s.x, s.z);
            enemy.hp -= swd;
            markGoreHit(sim, enemy, enemy.x - s.x || 0.01, enemy.z - s.z, swd * 2, "BLADE");
            sim.lastHit = performance.now();
            if (enemy.hp <= 0) { if (enemy.boss) enemy.hp = 0.01; else defeatMachine(sim, enemy); }
          }
          sim.burstEvents.push({ id: sim.nextBurstId++, x: s.x + Math.sin(s.yaw) * sw.length * 0.5, y: s.y, z: s.z + Math.cos(s.yaw) * sw.length * 0.5, radius: 5, element: "ARC", launcher: "ROCKET" }); // drawn + heard like a small blast
        }
        for (const enemy of sim.machines) {
          if (!enemy.alive) continue;
          const dx = enemy.x - s.x;
          const dz = enemy.z - s.z;
          const d = Math.hypot(dx, dz);
          if (!inSwordArc({ x: s.x, z: s.z, feet: s.y - 1.6, yaw: s.yaw }, { x: enemy.x, z: enemy.z, feet: Math.max(walkHeight(enemy.x, enemy.z), enemy.y - 2.2 * enemy.scale), scale: enemy.scale }, reach)) continue;
          // the one shared damage path (Weaken/Marked, boss poise, scenario gimmicks, reward participation, player credit)
          const dmg = applyMachineDamageMods(sim, enemy, swingStats(blade, s.combo, { damage: wpn.damage, reach }, enemy.elite || enemy.boss).damage, "KINETIC", s.x, s.z);
          enemy.hp -= dmg;
          // gore.ts: a blade cuts across the swing (left/right by combo step), the finisher drives through
          { const across = s.combo === 2 ? -1 : 1, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw); markGoreHit(sim, enemy, s.combo === 3 ? fx : fz * across * 0.8 + fx * 0.6, s.combo === 3 ? fz : -fx * across * 0.8 + fz * 0.6, dmg * (s.combo === 3 ? 2 : 1.3), "BLADE"); }
          enemy.kx += (dx / Math.max(d, 0.1)) * wpn.knock * 8;
          enemy.kz += (dz / Math.max(d, 0.1)) * wpn.knock * 8;
          enemy.cool = Math.max(enemy.cool, 0.6);
          sim.lastHit = performance.now();
           defeatMachine(sim, enemy);
        }
      }
    } else if (s.inVehicle) {
      // vehicle hardpoints (vehicle-weapons.ts): rounds leave the real barrels, carry the vehicle's velocity, and turrets follow the camera
      const vf = vFire.current;
      vf.cool -= dt; vf.gunCool -= dt; vf.secCool -= dt; vf.salvoCool -= dt;
      if (!sim.overheated && !vehicleEffect.weaponsDisabled) {
        const air = handling.mode === "AIR";
        const pose = { x: s.x, y: s.y - 1.9, z: s.z, yaw: s.yaw, pitch: air ? vh.current.pitch : vh.current.groundPitch, roll: air ? vh.current.roll : vh.current.groundRoll };
        const bounds = carBounds.current;
        // keep authored offsets on the model: never above its roof (+0.5 m) or past its nose (+0.6 m)
        const fit = (o: readonly [number, number, number]): [number, number, number] => bounds ? [o[0], Math.min(o[1], bounds.max.y + 1.9 + 0.5), Math.min(o[2], bounds.max.z + 0.6)] : [o[0], o[1], o[2]];
        const carry = vehicleVelocity(s.yaw, s.vSpeed, air || handling.mode === "WATER" ? s.vy : 0);
        // one gun on one trigger: rounds from the next barrel, toward the camera (turret) or along the nose (fixed)
        const fireGun = (g: VehicleGun, slot: "cool" | "gunCool", barrel: "barrel" | "gunBarrel") => {
          if (vf[slot] > 0) return;
          vf[slot] = g.rate / sim.mods.fireRate;
          const muzzle = vehiclePoint(pose, fit(g.muzzles[vf[barrel]++ % g.muzzles.length]!));
          const aim = aimFor(g.mount, pose, s.yaw, s.pitch + s.recoil, g.pitchAssist, muzzle, g.converge);
          const jy = (Math.random() - 0.5) * 2 * g.spread, jp = (Math.random() - 0.5) * 2 * g.spread;
          const dmg = g.damage * gearPower * (1 + armorFxRef.current.weaponDamage);
          let fired = false;
          if (g.shell) {
            // a cannon shell is ordnance: it flies flat and fast and bursts with splash on what it meets
            fired = fireOrdnance(sim, { id: "cannon-shell", kind: "ROCKET", name: g.name, speed: g.speed, turnRate: 0, life: 3, splashRadius: g.shell, damage: 1, proximity: 1.6, domain: "ANY", fits: [vehicleId] }, muzzle.x, muzzle.y, muzzle.z, aim.yaw + jy, aim.pitch + jp, dmg, Math.max(0, s.vSpeed), g.knock);
          } else fired = fireBullet(sim, muzzle.x, muzzle.y, muzzle.z, aim.yaw + jy, true, aim.pitch + jp, dmg, g.knock, g.heat, undefined, g.damage >= 3 ? "PELLET" : "BULLET", { speed: g.speed, inherit: carry });
          if (fired) {
            s.shots++;
            bossActionLog.current = logAction(bossActionLog.current, "RANGED", performance.now() / 1000);
            sfx.playShot(g.sound === "VEHICLE" ? "VEHICLE" : g.sound === "PULSE" ? "PULSE" : "AUTO");
            s.recoil += g.shell ? 0.03 : 0.004; s.punch += g.shell ? 0.9 : 0.12; s.bloom = Math.min(1, s.bloom + 0.05);
            muzzleFlash.current = { x: muzzle.x, y: muzzle.y, z: muzzle.z, t: performance.now() / 1000, big: !!g.shell };
          }
        };
        if (trigger && armament.primary) fireGun(armament.primary, "cool", "barrel");
        if (secondaryTrigger && armament.secondaryGun) fireGun(armament.secondaryGun, "gunCool", "gunBarrel");
        const sec = armament.secondary;
        if (sec) {
          if (secondaryTrigger && vf.secCool <= 0 && vf.salvoLeft <= 0) { vf.secCool = sec.rate; vf.salvoLeft = sec.salvo; vf.salvoCool = 0; }
          if (vf.salvoLeft > 0 && vf.salvoCool <= 0) {
            const def = ordnanceById(sec.ordnance);
            const muzzle = vehiclePoint(pose, fit(sec.muzzles[vf.podBarrel++ % sec.muzzles.length]!));
            const aim = aimFor(sec.mount, pose, s.yaw, s.pitch, 0.25, muzzle, 0);
            if (def && fireOrdnance(sim, def, muzzle.x, muzzle.y, muzzle.z, aim.yaw + (Math.random() - 0.5) * 0.02, aim.pitch + (Math.random() - 0.5) * 0.02, sec.damage * gearPower, Math.max(0, s.vSpeed))) {
              sfx.playShot("VEHICLE"); s.punch += 0.3;
              muzzleFlash.current = { x: muzzle.x, y: muzzle.y, z: muzzle.z, t: performance.now() / 1000, big: true };
            }
            vf.salvoLeft--; vf.salvoCool = sec.salvoGap;
          }
        }
      }
    } else if (!sim.overheated) {
      if (s.burstLeft > 0) {
        s.burstCool -= dt;
        if (s.burstCool <= 0) { s.burstLeft--; s.burstCool = wpn.burstGap; shoot(); }
      } else if (trigger && s.fireCool <= 0) {
        s.fireCool = (s.inVehicle ? 0.16 : wpn.fireRate) / sim.mods.fireRate;
        shoot();
        s.burstLeft = wpn.burst - 1;
        s.burstCool = wpn.burstGap;
      }
    }

    {
      // Target lock (target-lock.ts): U locks the best target in front, P cycles, O swaps the camera shoulder; the camera turns softly toward the lock
      const lk = lockRt.current, lkeys = normalizeBindings(settings.bindings).keyboard;
      const edge = (name: "lockOn" | "cycleTarget" | "swapShoulder") => { const down = held.has(lkeys[name]); const hit = down && !lk.keys[name]; lk.keys[name] = down; return hit; };
      const cands: LockCandidate[] = [];
      for (let i = 0; i < sim.machines.length; i++) { const m = sim.machines[i]!; if (m.alive) cands.push({ id: String(i), position: { x: m.x, y: m.y, z: m.z }, alive: true, priority: m.boss ? 2 : m.elite ? 1 : 0 }); }
      const origin = { x: s.x, y: s.y + 1.4, z: s.z };
      const fwd = { x: Math.sin(s.yaw), y: 0, z: Math.cos(s.yaw) };
      if (edge("lockOn")) {
        if (lk.state.lockedTargetId) { lk.state = { ...lk.state, lockedTargetId: null }; alert(sim, "Lock released"); }
        else { const id = acquireTarget(origin, fwd, cands); lk.state = { ...lk.state, lockedTargetId: id }; alert(sim, id ? "TARGET LOCKED" : "No target in view"); }
      }
      if (edge("cycleTarget")) lk.state = { ...lk.state, lockedTargetId: cycleLockTarget(lk.state.lockedTargetId, cands) };
      if (edge("swapShoulder")) lk.state = swapShoulder(lk.state);
      lk.state = retainLock(lk.state, origin, cands);
      const lockedMachine = lk.state.lockedTargetId ? sim.machines[Number(lk.state.lockedTargetId)] : undefined;
      if (lockedMachine && lockedMachine.alive && !s.inVehicle && !introPlayback) {
        const at = lockLookAt({ x: lockedMachine.x, y: lockedMachine.y, z: lockedMachine.z }, { x: lockedMachine.kx, y: 0, z: lockedMachine.kz }, { targetHeight: 1.0, leadSeconds: 0.15 });
        const want = Math.atan2(at.x - s.x, at.z - s.z), delta = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
        s.yaw += delta * Math.min(1, dt * 6);
        const flat = Math.hypot(at.x - s.x, at.z - s.z);
        s.pitch = clampPitch(s.pitch + (Math.atan2(at.y - origin.y, Math.max(1, flat)) - s.pitch) * Math.min(1, dt * 4));
      } else if (lk.state.lockedTargetId) lk.state = { ...lk.state, lockedTargetId: null };
    }
    /* ---------------- keyboard + gamepad look: arrows / right stick turn the camera on foot (mouse look still works) ---------------- */
    const codeEntry = stratagem.current.open; // arrows enter the call-in code while N is held
    if (!s.inVehicle && !codeEntry && !introPlayback) {
      const stickX = pad && !s.wheel ? pad.axes[2] ?? 0 : 0, stickY = pad && !s.wheel ? pad.axes[3] ?? 0 : 0; // the right stick picks weapons while the wheel is held
      const look = lookDelta({ left: held.has("ArrowLeft"), right: held.has("ArrowRight"), up: held.has("ArrowUp"), down: held.has("ArrowDown"), stickX, stickY }, dt);
      if (look.dyaw || look.dpitch) { s.yaw += look.dyaw; s.pitch = clampPitch(s.pitch + look.dpitch); }
    }
    const arrowsMove = !codeEntry && s.inVehicle; // arrows still steer a vehicle; on foot they now look
    const throttleF = held.has("KeyW") || (arrowsMove && held.has("ArrowUp"));
    const throttleB = held.has("KeyS") || (arrowsMove && held.has("ArrowDown"));
    const left = held.has("KeyA") || (arrowsMove && held.has("ArrowLeft"));
    const right = held.has("KeyD") || (arrowsMove && held.has("ArrowRight"));
    const boost = held.has("ShiftLeft") || held.has("ShiftRight");

    /* ---------------- movement ---------------- */
    // traction: biome speed rating, penalised by slope and water
    const biomeGrip = here?.speed ?? 0.9;
    const traction = Math.max(0.18, biomeGrip * (1 - slope * 0.75) * (s.diving ? pressureSpeedMultiplier(depth) * oxygenPenalty.speedMultiplier : submerged ? 0.45 : 1));

    if (s.inVehicle) {
       const vehicleGear = gear?.inventory.find((item) => item.id === gear.equippedGear.vehicle);
       // Neon City vehicle-combat: a damaged car tops out slower and steers worse, per VEHICLE_DAMAGE_EFFECT.
       // a race obstacle you just hit holds your top speed down for a moment (racing.ts raceSpeedFactor); 1 outside a race
       const raceRun = activity?.run.status === "active" && activity.def.stages[0]?.kind === "race" ? (activity.run.race as RaceRun | undefined) : undefined;
       const raceSlow = raceRun?.phase === "running" ? raceSpeedFactor(raceRun.impact) : 1;
       const maxSpeed = 62 * biomeGrip * (boost ? 1.5 : 1) * sim.mods.vehicleSpeed * selectedVehicle.speed * (vehicleGear ? 1 + vehicleGear.level * 0.04 : 1) * damageFx.speed * raceSlow;
      const ax = pad?.axes ?? [];
      const dz = (v: number | undefined) => (v && Math.abs(v) > 0.15 ? v : 0);
      const trig = (i: number) => pad?.buttons[i]?.value ?? 0;
      const gSurface = surfaceAt(here?.id, heightAt(s.x, s.z), WATER_LEVEL);
      const vin = {
        throttle: Math.max(throttleF ? 1 : 0, trig(7)), brake: Math.max(throttleB ? 1 : 0, trig(6)),
        steer: THREE.MathUtils.clamp((left ? 1 : 0) - (right ? 1 : 0) - dz(ax[0]), -1, 1),
        ascend: Math.max(held.has("KeyC") ? 1 : 0, pad?.buttons[5]?.pressed ? 1 : 0, handling.mode === "AIR" ? Math.max(0, -dz(ax[3])) : 0),
        descend: Math.max(held.has("KeyZ") ? 1 : 0, pad?.buttons[4]?.pressed ? 1 : 0, handling.mode === "AIR" ? Math.max(0, dz(ax[3])) : 0),
        handbrake: held.has("Space") || !!pad?.buttons[0]?.pressed, boost,
      };
      const floorH = handling.mode === "WATER" ? heightAt(s.x, s.z) : walkHeight(s.x, s.z);
      const venv = { grip: surfaceGrip(gSurface, slope) * damageFx.grip * damageFx.stability * selectedVehicle.handling, slope, floor: floorH, water: WATER_LEVEL, overWater: heightAt(s.x, s.z) < WATER_LEVEL - 0.3 };
      const before = { x: s.x, z: s.z };
      const r = stepVehicle(handling, { speed: s.vSpeed, yaw: s.yaw, y: s.y, vy: s.vy, ...vh.current }, vin, venv, maxSpeed / (boost ? 1.5 : 1), dt);
      s.vSpeed = r.speed; s.yaw = r.yaw;
      vh.current.airborne = r.airborne; vh.current.slip = r.slip; vh.current.roll = r.roll; vh.current.pitch = r.pitch;
      if (handling.mode !== "GROUND") { s.y = r.y; s.vy = r.vy; }
      if (r.landed) { sfx.playReload("end"); if (r.hardLanding) { rumble(pad as never, "heavy"); condition.current = impactVehicle(condition.current, 14); onVehicleCondition?.(vehicleId, condition.current); } }
      if (r.skidding && performance.now() - vh.current.skidAt > 450) { vh.current.skidAt = performance.now(); rumble(pad as never, "light", 0.4); }
      s.x += Math.sin(s.yaw) * s.vSpeed * dt;
      s.z += Math.cos(s.yaw) * s.vSpeed * dt;
      if (handling.mode === "WATER" && heightAt(s.x, s.z) > WATER_LEVEL - 0.3) { s.x = before.x; s.z = before.z; s.vSpeed *= 0.2; }
    } else {
      // Mouse-look sets the facing direction; WASD stays relative to it.
      wish.set(0, 0, 0);
      if (throttleF) { wish.x += Math.sin(s.yaw); wish.z += Math.cos(s.yaw); }
      if (throttleB) { wish.x -= Math.sin(s.yaw); wish.z -= Math.cos(s.yaw); }
      if (left) { wish.x += Math.sin(s.yaw + Math.PI / 2); wish.z += Math.cos(s.yaw + Math.PI / 2); }
      if (right) { wish.x += Math.sin(s.yaw - Math.PI / 2); wish.z += Math.cos(s.yaw - Math.PI / 2); }
      // Neon City parkour: chaining vaults within the window nets a small, capped speed bonus.
      {
        // jet-boots dash (skate-boots.ts): tap Shift for a burst along the facing, gated by the pair's cooldown
        const shift = held.has("ShiftLeft") || held.has("ShiftRight");
        const nowB = performance.now() / 1000;
        if (boots.dash > 0 && shift && !bootDash.current.held && nowB >= bootDash.current.readyAt) {
          velocity.x += Math.sin(s.yaw) * boots.dash; velocity.z += Math.cos(s.yaw) * boots.dash;
          if (boots.dashStyle === "air" && !s.grounded) s.vy = Math.max(s.vy, 6);
          if (boots.dashStyle === "blink") { s.x += Math.sin(s.yaw) * 4; s.z += Math.cos(s.yaw) * 4; }
          bootDash.current.readyAt = nowB + boots.dashCooldown; s.punch += 0.2; sfx.playAbility("DASH");
        }
        bootDash.current.held = shift;
      }
      const chainBonus = parkourChainBonus(s.chainCount, performance.now() / 1000 - s.lastVaultAt);
      const mvs = move.current;
      const crouchKey = held.has(binds.keyboard.crouch) || !!padNow[binds.gamepad.crouch];
      const proneKey = held.has(binds.keyboard.prone) || !!padNow[binds.gamepad.prone];
      if (proneKey && !mvs.proneHeld) mvs.state.prone = !mvs.state.prone;
      mvs.proneHeld = proneKey;
      const stance = resolveStance(mvs.state, { crouchHeld: crouchKey, sprinting: boost, jumping: held.has("KeyC"), grounded: s.grounded, sliding: mvs.state.slideLeft > 0, swimming: s.diving || submerged });
      stepStance(mvs.state, dt);
      const sprint = boost && stance === "STAND";
      const walk = BASE_FOOT_SPEED * traction * (sprint ? SPRINT_MULT * boots.boost : 1) * STANCE_SPEED[stance] * (1 + armorFxRef.current.moveSpeed) * sim.mods.footSpeed * (live.current.dashTime > 0 ? 1.4 : 1) * siegeMoveMult(live.current.siegeTime) * (1 + chainBonus) * sim.hazardSpeedMult;
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(walk * hazardRef.current.speedMul);
      {
        // slide: out of a sprint, commit to the heading with a speed burst that bleeds off (movement.ts)
        const mv = move.current;
        const slideKey = crouchKey;
        if (slideKey && !mv.slideHeld && s.grounded && !s.diving && !submerged) startSlide(mv.state, velocity.x, velocity.z);
        mv.slideHeld = slideKey;
        if (mv.state.slideLeft > 0 && (!s.grounded || held.has("KeyC"))) cancelSlide(mv.state);
        const slideSpeed = stepSlide(mv.state, dt);
        if (slideSpeed > 0) { const sb = slideSpeed * (1 + armorFxRef.current.slideBoost); wish.set(mv.state.slideDirX * sb, 0, mv.state.slideDirZ * sb); }
      }
      {
        // Operator dash (dash.ts): NYX Ghost Step / GOLIATH Bulwark Rush / CIPHER Phase Drift
        const od = opDash.current, st = opDashStats, ds = od.state;
        const dashKey = held.has(binds.keyboard.dash) || !!padNow[binds.gamepad.dash];
        if (dashKey && !od.held && !s.diving && !submerged) {
          const dirX = wish.lengthSq() > 0 ? wish.x : Math.sin(s.yaw), dirZ = wish.lengthSq() > 0 ? wish.z : Math.cos(s.yaw);
          if (tryDash(ds, st, dirX, dirZ)) { sim.iframes = Math.max(sim.iframes, st.iframes); od.wasActive = true; cancelSlide(mvs.state); s.punch += 0.2; sfx.playAbility("DASH"); }
        }
        od.held = dashKey;
        const dashSpeed = stepDash(ds, st, dt);
        dashHud.current = { name: DASHES[playerClass].name, charges: ds.charges, max: st.charges, fill: ds.charges >= st.charges ? 1 : Math.max(0, Math.min(1, 1 - ds.recharge / st.cooldown)) };
        sim.dashResist = dashSpeed > 0 ? st.resist : 0;
        if (dashSpeed > 0) {
          wish.set(ds.dirX * dashSpeed, 0, ds.dirZ * dashSpeed);
          velocity.x = wish.x; velocity.z = wish.z;
          const nowS = performance.now() / 1000;
          for (let i = 0; i < sim.machines.length; i++) {
            const m = sim.machines[i]!;
            if (!m.alive || Math.hypot(m.x - s.x, m.z - s.z) > 1.8 || !dashHit(ds, st, i)) continue;
            if (!m.boss && st.hitDamage > 0) { m.hp -= st.hitDamage; if (m.hp <= 0) defeatMachine(sim, m, "player"); }
            m.kx += ds.dirX * st.knockback; m.kz += ds.dirZ * st.knockback;
            if (st.mark > 0) { m.vulnUntil = nowS + 4; m.vulnMult = 1 + st.mark; }
            if (st.slow > 0) m.cool = Math.max(m.cool, st.slow * 3);
            if (!st.pierce && !m.boss) ds.active = Math.min(ds.active, 0.0001);
          }
        } else if (od.wasActive) {
          od.wasActive = false;
          if (st.endBlastRadius > 0) for (const m of sim.machines) {
            if (!m.alive) continue;
            const ex = m.x - s.x, ez = m.z - s.z, ed = Math.hypot(ex, ez);
            if (ed > st.endBlastRadius) continue;
            if (!m.boss) { m.hp -= st.endBlastDamage; if (m.hp <= 0) { defeatMachine(sim, m, "player"); continue; } }
            m.kx += (ex / (ed || 1)) * 3; m.kz += (ez / (ed || 1)) * 3;
          }
        }
      }
      if (s.diving) {
        // swimming toward where you're looking: pitch steers you up/down, and the response is floatier than land movement
        const swimPitch = (throttleF ? 1 : throttleB ? -1 : 0) * Math.sin(s.pitch);
        s.vy = THREE.MathUtils.clamp(s.vy + swimPitch * walk * 0.18 * dt, -4.5, 4.5);
        velocity.lerp(wish, 1 - Math.exp(-6 * dt));
      } else {
        velocity.lerp(wish, 1 - Math.exp(-14 * dt));
      }
      s.x += (velocity.x + zonePull.current.x) * dt;
      s.z += (velocity.z + zonePull.current.z) * dt;
      if (tutorial?.step === "MOVEMENT") { const travel = Math.hypot(s.x - SPAWN.x, s.z - SPAWN.z); if (travel >= (lastGate.current + 1) * 10 && lastGate.current < 3) { lastGate.current++; onTutorialEvent?.("GATE"); } }
    }

    /* ---------------- Storm Islands: the Thunder Nest's guardian pack lands when you stand on the nest with its hunt active ---------------- */
    if (!interior && gearLive.current) {
      const site = stormSiteAt(s.x, s.z, s.y - 1.6);
      if (site?.id === "thunder-nest") {
        const hunt = stormQuests({ earnedRewards: gearLive.current.earnedRewards ?? [] }).find((q) => q.quest.id === "storm-side-01");
        if (hunt?.state === "ACTIVE" && hunt.next?.event === "defeat" && !stormNest.current && !sim.machines.some((m) => m.alive && m.living === "storm:nest")) {
          const w = stormSiteWorld(site);
          spawnStormGuardians(sim, w.x, w.z, islandTop(site));
          stormNest.current = true;
          alert(sim, "Stormborne guardians rise from the nest");
        }
      } else stormNest.current = false;
    }
    /* ---------------- interiors: walk up to a door to go in, walk up to the exit marker to come back out ---------------- */
    if (!interior && !s.inVehicle) {
      // homes open for their owner only; nightlife venues only during their hours (nightlife.ts VENUE_HOURS)
      const door = doorAt(s.x, s.z, (d) => (!d.homeId || `home:${d.homeId}` in (gearLive.current?.nexLedger ?? {})) && (d.kind !== "VENUE" || isInteriorOpen(d, time.current)));
      if (door) {
        s.interiorReturnPos = { x: s.x, y: s.y, z: s.z };
        s.insideInterior = door.id;
        interior = door;
        s.x = door.origin.x + door.spawnOffset.x;
        s.z = door.origin.z + door.spawnOffset.z;
        s.y = INTERIOR_ALTITUDE + 1.6;
        s.vy = 0;
        s.grounded = true;
        s.diving = false;
        velocity.set(0, 0, 0);
      }
    } else if (interior) {
      if (interior.homeId) {
        const rooms = homeById(interior.homeId)?.rooms.length ?? 1;
        const c = clampHomeLocal(interior, rooms, s.x - interior.origin.x, s.z - interior.origin.z, (s.interiorPrevX ?? s.x) - interior.origin.x);
        s.x = interior.origin.x + c.x; s.z = interior.origin.z + c.z;
      }
      if (!interior.homeId) {
        s.x = interior.origin.x + Math.max(-4.5, Math.min(4.5, s.x - interior.origin.x));
        s.z = interior.origin.z + Math.max(-4.5, Math.min(4.5, s.z - interior.origin.z));
      }
      s.interiorPrevX = s.x;
      const localX = s.x - interior.origin.x;
      const localZ = s.z - interior.origin.z;
      if (atExitMarker(interior, localX, localZ)) {
        const back = s.interiorReturnPos;
        const leaving = interior;
        s.insideInterior = null;
        interior = null;
        if (back) { const out = exitPosition(leaving.doorPos, back); s.x = out.x; s.y = back.y; s.z = out.z; }
        s.interiorReturnPos = null;
        s.vy = 0;
        s.grounded = true;
        velocity.set(0, 0, 0);
      }
    }

    // world bounds — skipped inside a pocket-dimension interior, which lives far outside WORLD_RADIUS by design
    // Thalassia sits past the world disc in open ocean: its city radius (plus an approach lane) is inside the bounds too
    // and the Storm Islands hang over the ocean past the rim: high in the air near the chain is in bounds (storm-quests.ts)
    if (!interior && Math.hypot(s.x - THALASSIA_CENTER.x, s.z - THALASSIA_CENTER.z) > CITY_RADIUS + 80 && !inStormAirspace(s.x, s.y, s.z)) {
      const d = Math.hypot(s.x, s.z);
      if (d > WORLD_RADIUS - 6) {
        s.x *= (WORLD_RADIUS - 6) / d;
        s.z *= (WORLD_RADIUS - 6) / d;
        s.vSpeed *= 0.3;
      }
    }

    /* ---------------- collisions (physics before sim) ---------------- */
    const preCollideSpeed = s.vSpeed;
    const body = { x: s.x, z: s.z, y: s.y - 1.6, yaw: s.yaw, vSpeed: s.vSpeed, inVehicle: s.inVehicle };
    collidePlayer(sim, body);
    const prevBody = prevBodyPos.current;
    const bodyFrom = prevBody && prevBody.interior === (s.insideInterior ?? null) ? prevBody : { x: body.x, z: body.z };
    const solids = interior ? roomSolids(interior, INTERIOR_ALTITUDE, interior.homeId ? homeById(interior.homeId)?.rooms.length ?? 1 : 1) : [...registeredModelSolids(), ...structureSolids(structure.nodes.values())];
    const blockedSolid = sweepSolids(body, bodyFrom, s.y - (s.inVehicle ? 1.9 : 1.6), s.inVehicle ? 2.2 : OPERATOR_HEIGHT, s.inVehicle ? 2.6 : 0.5, solids);
    if (blockedSolid) { body.vSpeed *= -0.18; velocity.set(0, 0, 0); }
    prevBodyPos.current = { x: body.x, z: body.z, interior: s.insideInterior ?? null };
    s.x = body.x;
    s.z = body.z;
    s.vSpeed = body.vSpeed;
    if (s.inVehicle && Math.abs(preCollideSpeed - s.vSpeed) > 2) { condition.current = impactVehicle(condition.current, Math.abs(preCollideSpeed - s.vSpeed)); onVehicleCondition?.(vehicleId, condition.current); }

    // Neon City vehicle-combat: a wreck-level car forces you out on foot; a heavily damaged one only does when the collision actually stopped it.
    if (s.inVehicle) {
      const blocked = Math.abs(preCollideSpeed) > 4 && Math.abs(s.vSpeed) < Math.abs(preCollideSpeed) * 0.4;
      if (conditionEffects(condition.current).disabled || shouldForceFootTransition(vehicleStage, blocked)) {
        s.inVehicle = false;
        velocity.set(Math.sin(s.yaw), 0, Math.cos(s.yaw)).multiplyScalar(exitVehicleMomentum(s.vSpeed));
        s.vSpeed = 0;
      }
    }

    /* ---------------- destructible interior: bullets vs structural graph, debris, player/enemy reaction ---------------- */
    for (const b of sim.bullets) {
      if (!b.alive) continue;
      const node = hitTest(structure, b.x, b.y, b.z);
      if (node) { b.alive = false; applyDamage(structure, node.id, b.dmg * (STRUCTURE_MULT[s.inVehicle ? "VEHICLE" : s.weapon] ?? 1)); sfx.playImpact(node.material === "GLASS" ? "TECH" : node.material === "METAL" ? "METAL" : "ORGANIC", sfx.where(s.x, s.z, s.yaw, node.x, node.z)); }
    }
    if (s.swing > 0.25 && !s.inVehicle) {
      const node = hitTest(structure, s.x + Math.sin(s.yaw) * 1.8, s.y + 0.4, s.z + Math.cos(s.yaw) * 1.8);
      if (node) applyDamage(structure, node.id, 6 * dt * 60 * 0.05);
    }
    stepDebris(structure, dt, structure.nodes.get("crate-a")!.y - 0.6);
    if (!s.inVehicle) for (const n of structure.nodes.values()) {
      if (n.isDestroyed || n.type === "CEILING" || n.type === "FLOOR" || s.y > n.y + n.h / 2 + 0.5) continue;
      const hx = n.w / 2 + 0.5, hz = n.d / 2 + 0.5, dx = s.x - n.x, dz = s.z - n.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) { const px = hx - Math.abs(dx), pz = hz - Math.abs(dz); if (px < pz) s.x = n.x + Math.sign(dx || 1) * hx; else s.z = n.z + Math.sign(dz || 1) * hz; }
    }
    if (structure.lastCollapse && performance.now() - structure.lastCollapse.t < 50) {
      alert(sim, "STRUCTURE COLLAPSE — cover lost");
      sfx.playExplosion(true, sfx.where(s.x, s.z, s.yaw, structure.lastCollapse.x, structure.lastCollapse.z));
      for (const m of sim.machines) { if (!m.alive) continue; const d = Math.hypot(m.x - structure.lastCollapse.x, m.z - structure.lastCollapse.z); if (d < 14) { m.hp -= 4; m.kx += (m.x - structure.lastCollapse.x) / Math.max(1, d) * 18; m.kz += (m.z - structure.lastCollapse.z) / Math.max(1, d) * 18; m.cool = Math.max(m.cool, 1.2); } }
      if (Math.hypot(s.x - structure.lastCollapse.x, s.z - structure.lastCollapse.z) < 6) chipPlayer(sim, 12);
      structure.lastCollapse = { ...structure.lastCollapse, t: 0 };
    }

    /* ---------------- resource gathering + boss lairs ---------------- */
    // Crucible (crucible.ts): keep the rival lineup on the field while a match runs; rivals leave when it ends
    {
      const stage = activity && activity.run.status === "active" ? activity.def.stages[activity.run.stage] : undefined;
      if (stage?.kind === "crucible") {
        if (!crucible.current || crucible.current.mode !== stage.mode) crucible.current = newCrucible(stage.mode);
        stepRivals(sim, crucible.current, pointWorld(activity!.def.area, ARENA_POINT), playerClass as RivalClass, dt);
      } else if (crucible.current) { clearRivals(sim); crucible.current = null; }
    }
    if (!s.inVehicle && !tutorial) {
      const now = performance.now();
      for (const site of RESOURCE_SITES) {
        if ((depleted.current[site.id] ?? 0) > now) continue;
        if (Math.hypot(site.x - s.x, site.z - s.z) < GATHER_RADIUS) {
          depleted.current[site.id] = now + RESPAWN_SECONDS * 1000;
          sim.drops.push({ id: sim.nextDropId++, material: site.material, amount: site.amount, enemy: site.label });
          alert(sim, `Gathered ${site.label} · +${site.amount}`);
          sfx.playReload("end");
        }
      }
      for (const lair of BOSS_LAIRS) {
        const inside = Math.hypot(lair.x - s.x, lair.z - s.z) < LAIR_RADIUS;
        if (inside && !lairsTriggered.current[lair.id] && !sim.machines.some((m) => m.alive && m.boss)) { lairsTriggered.current[lair.id] = true; summonBoss(sim, lair.regionId, lair.x, lair.z); }
        if (!inside && Math.hypot(lair.x - s.x, lair.z - s.z) > LAIR_RADIUS * 4) lairsTriggered.current[lair.id] = false;
      }
      // Vyrak discovery (vyrak-site.ts): walk up to a clue site, or sense the hidden lair; each pays its journal clue once
      // walking into a discovery starts it (consuming one attempt, like any activity); a running activity or the tutorial blocks it
      if (gear && !tutorial && !activity && onDiscovery) { discoveryClock.current += dt; if (discoveryClock.current > 0.3) { discoveryClock.current = 0; const hit = discoveryTriggered(gear, s.x, s.z, Date.now()); if (hit) onDiscovery(hit.id); } }
      if (gear && !tutorial && onEncounterClue) {
        const known = (id: string) => gear.earnedRewards.includes(`enc-clue:vyrak:${id}`) || clueSent.current.has(id);
        // NOVA comments after each new clue (one clue is not a pattern; two or more point at the region), using the keys the journal will hold once this clue is saved
        const nova = () => { const h = novaHint({ earnedRewards: [...gear.earnedRewards, ...[...clueSent.current].map((c) => `enc-clue:vyrak:${c}`)] }, "vyrak"); if (h) alert(sim, h); };
        const site = nearClueSite(s.x, s.z);
        if (site && !known(site.clueId)) { clueSent.current.add(site.clueId); onEncounterClue("vyrak", site.clueId); alert(sim, `CLUE · ${site.found}`); nova(); }
        if (nearHiddenLair(s.x, s.z) && !known("site")) { clueSent.current.add("site"); onEncounterClue("vyrak", "site"); alert(sim, "CLUE · The air is hot and the stone is scarred here. Something enormous has slept nearby."); nova(); }
      }
      // Unique Scenario lairs (Rime Alpha, Dark Knight, ...): same walk-in trigger, but they summon the scenario boss
      for (const lair of SCENARIO_LAIRS) {
        const inside = Math.hypot(lair.x - s.x, lair.z - s.z) < LAIR_RADIUS;
        const scenario = scenarioById(lair.scenarioId);
        // Vaelith is a story scenario: entering asks for the Ashen Gate conversation first; the trial begins once it has been heard
        if (inside && lair.scenarioId === VAELITH && !tutorial && dialogueDue(gear?.story ?? EMPTY_STORY) && !lairsTriggered.current[`${lair.id}-asked`]) { lairsTriggered.current[`${lair.id}-asked`] = true; onStoryEvent?.({ type: "LAIR_ENTER" }); }
        if (!inside) lairsTriggered.current[`${lair.id}-asked`] = false;
        if (lair.scenarioId === VAELITH && (stageOf(gear?.story ?? EMPTY_STORY, VAELITH) === undefined || !vaelithFightable(gear?.story ?? EMPTY_STORY))) continue;
        // The four existing boss stories: the lair intro conversation plays first (re-asked every 3 s while it is unheard and nothing else is open); the fight itself is unchanged
        if (inside && bossStoryFor(lair.scenarioId) && !tutorial && introDue(gear?.story ?? EMPTY_STORY, lair.scenarioId as BossStoryId)) {
          const beatsAsk = storyBeats.current, tNow = performance.now() / 1000;
          if (tNow - (beatsAsk.askedAt[lair.id] ?? -99) > 3) { beatsAsk.askedAt[lair.id] = tNow; onStoryEvent?.({ type: "BOSS_LAIR_ENTER", scenarioId: lair.scenarioId }); }
          continue;
        }
        // unique encounter: the first meeting is hidden-discovery gated; once bonded the Sky Sovereign returns only as a rematch within the real-time daily limit and cooldown
        if (lair.scenarioId === "vyrak" && ((gear && !lairRevealed(gear, "vyrak")) || (bonded && !vyrakRematch))) continue;
        if (inside && scenario && !lairsTriggered.current[lair.id] && !tutorial && !sim.machines.some((m) => m.alive && m.boss)) { lairsTriggered.current[lair.id] = true; if (summonScenarioBoss(sim, scenario, lair.x, lair.z) && lair.scenarioId === "vyrak" && bonded) { onVyrakRematch?.(); alert(sim, "VYRAK REMATCH · No death and a fast kill earn the Covenant ornaments."); } }
        if (!inside && Math.hypot(lair.x - s.x, lair.z - s.z) > LAIR_RADIUS * 4) lairsTriggered.current[lair.id] = false;
      }
      // Story beats (vaelith.ts): the sim decides what happened, these only forward it to the pure reducers
      {
        const story = gear?.story ?? EMPTY_STORY;
        const beats = storyBeats.current;
        const mem = memoryNear(story, s.x, s.z);
        if (mem) onStoryEvent?.({ type: "MEMORY", id: mem });
        const vault = vaultNear(story, s.x, s.z);
        if (vault && !tutorial) { const tNow = performance.now() / 1000; if (tNow - (beats.askedAt[`vault-${vault}`] ?? -99) > 3) { beats.askedAt[`vault-${vault}`] = tNow; onStoryEvent?.({ type: "VAULT_ENTER", scenarioId: vault }); } }
        for (const e of sim.encounterEvents) {
          if (e.id <= beats.seenEncounterEvent) continue;
          beats.seenEncounterEvent = e.id;
          if (e.kind === "TRUCE" && e.scenarioId === VAELITH) onStoryEvent?.({ type: "TRIAL_SURVIVED" });
          // boss stories: captions follow the encounter's own phases; BOSS_DEFEATED comes only from the real-kill VICTORY event (never a truce, reset or death)
          if (e.kind === "PHASE" && bossStoryFor(e.scenarioId)) onStoryEvent?.({ type: "BOSS_PHASE", scenarioId: e.scenarioId, phase: e.phase });
          if (e.kind === "VICTORY" && bossStoryFor(e.scenarioId)) onStoryEvent?.({ type: "BOSS_DEFEATED", scenarioId: e.scenarioId });
        }
        if (stageOf(story, VAELITH) === "memories") {
          const nearLair = Math.hypot(VAELITH_LAIR.x - s.x, VAELITH_LAIR.z - s.z) < 30;
          if (beats.defenseAt < 0 && nearLair && !tutorial) { if (startLairDefense(sim) > 0) beats.defenseAt = performance.now() / 1000; }
          else if (beats.defenseAt >= 0 && performance.now() / 1000 - beats.defenseAt > 2 && lairDefenseCleared(sim)) { beats.defenseAt = -1; onStoryEvent?.({ type: "DEFENSE_CLEARED" }); }
        } else beats.defenseAt = -1;
      }
    }
    // the running activity steps in a vehicle too (it used to sit inside the on-foot block above, so a vehicle race never left the start line)
    if (!tutorial) {
        if (activity && activity.run.status === "active") {
          const r = activity.run, rsig = () => { const rr = r.race as { phase?: string; next?: number; recoveries?: number; notice?: string | null; countdown?: number } | undefined; return `${r.stage}|${r.progress}|${r.status}|${r.cp}|${r.carrying}|${rr?.phase}|${rr?.next}|${rr?.recoveries}|${rr?.notice}|${rr?.phase === "countdown" ? Math.ceil(rr.countdown ?? 0) : ""}`; }, sig0 = rsig();
          const hitsBefore = (r.race as RaceRun | undefined)?.hitObstacles?.length ?? 0;
          stepActivity(activity.def, r, { x: s.x, z: s.z, dt, now: Date.now(), kills: sim.kills, elites: sim.eliteKills, bosses: sim.bossKills, hp: sim.hp, deaths: sim.deaths, rivalKills: sim.rivalKills, mode: s.inVehicle ? "vehicle" : s.diving ? "dive" : "foot", y: s.y, vehicleDisabled: s.inVehicle && conditionEffects(condition.current).disabled });
          // a race asked to put the player back on the course (wreck, fall, or lost): same place as the last checkpoint, race clock keeps running
          const back = (r.race as { recover?: { x: number; z: number; depth?: number } | null } | undefined)?.recover;
          if (back) { s.x = back.x; s.z = back.z; s.vSpeed = 0; s.vy = 0; if (back.depth !== undefined) s.y = back.depth; else s.y = walkHeight(back.x, back.z) + 0.2; (r.race as { recover: unknown }).recover = null; }
          // first contact with a track obstacle costs momentum straight away
          if (s.inVehicle && ((r.race as RaceRun | undefined)?.hitObstacles?.length ?? 0) > hitsBefore) s.vSpeed *= 0.55;
          if (sig0 !== rsig()) onActivityChange?.();
        }
    }

    /* ---------------- combat audio: impacts, kills, damage taken, intensity mix ---------------- */
    {
      const a = audioSeen.current;
      if (sim.lastHit !== a.hit) {
        a.hit = sim.lastHit;
        let near: (typeof sim.machines)[number] | undefined; let best = Infinity;
        for (const m of sim.machines) { if (!m.alive) continue; const d = Math.hypot(m.x - s.x, m.z - s.z); if (d < best) { best = d; near = m; } }
        sfx.playImpact(near?.kind === "ABERRATION" ? "ORGANIC" : near?.kind === "OVERCLOCKED" ? "TECH" : "METAL", near ? sfx.where(s.x, s.z, s.yaw, near.x, near.z) : {});
        if (near && (near.elite || near.boss) && best < 40) hitStopUntil.current = Math.max(hitStopUntil.current, performance.now() + 45);
        // combat-feedback.ts: one impact class per hit scales camera kick + controller rumble (heavy weapons, bosses hit harder)
        const heavyWeapon = !s.inVehicle && (s.weapon === "SHOTGUN" || s.weapon === "HEAVY" || s.weapon === "SWORD" || String(s.weapon).startsWith("LAUNCH"));
        const cls = impactFor({ boss: Boolean(near?.boss && best < 40), critical: heavyWeapon || Boolean(near?.elite), damage: 0 });
        s.punch += COMBAT_FEEDBACK[cls].cameraImpulse * 6;
        rumble(feedbackPad(), cls);
      }
      if (sim.kills > a.kills) { sfx.playKill(false, {}); hitStopUntil.current = Math.max(hitStopUntil.current, performance.now() + 70); s.punch += 0.6; rumble(feedbackPad(), "heavy"); }
      a.kills = sim.kills;
      const now = performance.now();
      if (sim.hp < a.hp - 0.5 && now - a.hurtAt > 250) { sfx.playHurt(); a.hurtAt = now; s.punch += 0.35; rumble(feedbackPad(), sim.hp < a.hp - 15 ? "boss" : "light"); }
      // Unique encounter telegraphs (encounter-sim.ts events): wind-up siren, phase roar, finale/weak-point chime + rumble
      for (const e of sim.encounterEvents) {
        if (e.id <= a.encEvent) continue;
        a.encEvent = e.id;
        if (e.kind === "TELL") sfx.playBossTell(e.attack && encounterFor(e.scenarioId)?.phases.some((p) => p.finale?.attack === e.attack) ? 2 : e.radius > 6 ? 1 : 0);
        else if (e.kind === "PHASE") { sfx.playBossPhaseChange(Math.min(2, e.phase) as 0 | 1 | 2); s.punch += 1; rumble(feedbackPad(), "boss", 1.2); }
        else if (e.kind === "FINALE") { sfx.playWeakPointOpen(); rumble(feedbackPad(), "boss"); }
        else if (e.kind === "IMPACT" && e.hit) rumble(feedbackPad(), "boss");
      }
      const tNow = performance.now() / 1000;
      const weakOpen = sim.machines.some((m) => m.alive && m.scenarioId && (m.poiseState?.weakPointUntil ?? 0) > tNow);
      if (weakOpen && !a.weakOpen) sfx.playWeakPointOpen();
      a.weakOpen = weakOpen;
      // Rust-Muck underground race (neon-districts.ts): on foot or in a vehicle, gates in order, credits on finish
      {
        const rr = stepRace(race.current, s.x - NEON_CITY_CENTER.x, s.z - NEON_CITY_CENTER.z, tNow);
        race.current = rr.state;
        raceLive.gate = rr.state.phase === "RUNNING" ? rr.state.gate : -1;
        const ev = rr.event;
        if (ev?.kind === "COUNTDOWN") { alert(sim, "UNDERGROUND RACE · 3… 2… 1…"); sfx.playBossTell(0); }
        else if (ev?.kind === "GO") { alert(sim, `GO! ${RACE_GATES.length} gates — follow the gold ring`); sfx.playWeakPointOpen(); }
        else if (ev?.kind === "GATE") { alert(sim, `Gate ${ev.gate + 1}/${RACE_GATES.length}`); sfx.playSwitch(); }
        else if (ev?.kind === "TIMEOUT") alert(sim, "Race abandoned — time limit reached");
        else if (ev?.kind === "FINISH") {
          let best: number | null = null;
          try { const v = Number(localStorage.getItem(RACE_BEST_KEY)); best = v > 0 ? v : null; } catch { /* storage off */ }
          const r = raceReward(ev.time, best);
          sim.credits += r.credits;
          if (r.newBest) try { localStorage.setItem(RACE_BEST_KEY, String(ev.time)); } catch { /* storage off */ }
          alert(sim, `FINISH ${ev.time.toFixed(1)}s${r.newBest ? " · NEW BEST" : ""}`);
          sfx.playLevelUp();
        }
      }
      a.hp = sim.hp;
      // Boss-fight audio: track the engaged boss's last known position so a sudden "alive -> not
      // alive" edge (it just died) can play a real explosion there instead of the ordinary kill
      // chime, and so the combat mix knows to run its distinct boss-fight pattern while one's up.
      const liveBoss = sim.machines.find((m) => m.alive && m.boss);
      if (liveBoss) { a.bossAlive = true; a.bossX = liveBoss.x; a.bossZ = liveBoss.z; }
      else if (a.bossAlive) { a.bossAlive = false; sfx.playExplosion(true, sfx.where(s.x, s.z, s.yaw, a.bossX, a.bossZ)); }
      sfx.updateCombatAudio(Math.min(1, sim.combatHeat / 100), Boolean(liveBoss));
      sfx.updateBiomeAmbient(s.diving ? "thalassia" : here?.id ?? "");
      sfx.updateWeatherAmbient(weather);
      // running water: one stream + one waterfall voice, nearest wins; muffled indoors and while diving (water-audio.ts)
      if (now - lastWaterAudioAt > 120) { lastWaterAudioAt = now; sfx.updateWaterAudio(s.x, s.z, s.yaw, waterMix(s.x, s.z, waterNetwork(), interior ? 0.25 : s.diving ? 0.4 : 1)); }
      // interiors keep their home region's music (a pocket room isn't its own "place"), so the score doesn't drop to silence indoors
      sfx.updateMusicRegion(interior ? interior.regionId : here?.id ?? "");
      for (const shot of sim.enemyShots.splice(0)) {
        sfx.playEnemyShot(shot.kind, shot.boss || shot.elite, sfx.where(s.x, s.z, s.yaw, shot.x, shot.z));
        // visual flight only (the hit chance and damage are unchanged): troops shoot the element of the region they stand in
        launch(fxBus.flights, zoneElement(shot.zone, shot.kind), [shot.x, walkHeight(shot.x, shot.z) + 1.9, shot.z], [s.x, s.y + 1, s.z], shot.boss ? 2 : shot.elite ? 1.4 : 1);
      }
      for (const flare of sim.bossPhaseFlares.splice(0)) { sfx.playBossPhaseChange(flare.phase); s.punch += 1.4 + flare.phase * 0.6; }
      for (const event of sim.xpEvents.splice(0)) onXP?.(event);
      const speedNow = velocity.length();
      if (!s.inVehicle && speedNow > 3 && s.y - walkHeight(s.x, s.z) < 1.9) {
        a.stepT -= dt * (speedNow / 30) * 2.4;
        if (a.stepT <= 0) { a.stepT = 1; const rid = here?.id; sfx.playFootstep(interior ? "HARD" : submerged ? "WATER" : rid === "frostspire" ? "SNOW" : rid === "solara" ? "SAND" : rid === "nexus" ? "HARD" : "GRASS", held.has("ShiftLeft") || held.has("ShiftRight")); }
      }
      const fwd = held.has("KeyW") || held.has("ArrowUp"), rev = held.has("KeyS") || held.has("ArrowDown");
      sfx.updateEngine(s.inVehicle, vehicleId, Math.min(1, Math.abs(s.vSpeed) / 45), fwd || rev ? 1 : 0, rev && s.vSpeed > 2, selectedVehicle.speed / vehicleById(vehicleId).speed);
    }

    /* ---------------- Mission 01 · Broken Signal world triggers ---------------- */
    if (mission && onMissionEvent) {
      if (mission.state === "TRIGGERED" && !mission.target) onMissionEvent({ type: "ANCHOR", x: s.x + Math.sin(s.yaw) * 40, z: s.z + Math.cos(s.yaw) * 40 });
      if ((mission.state === "DISCOVERY" || mission.state === "TRAVERSAL") && mission.target && Math.hypot(mission.target.x - s.x, mission.target.z - s.z) < 8) onMissionEvent({ type: "ARRIVED", from: mission.state });
      const combat = mission.state === "COMBAT_1" || mission.state === "COMBAT_2";
      if (combat && missionSpawned.current !== mission.state && missionSpawned.current !== `${mission.state}-done`) {
        missionSpawned.current = mission.state;
        spawnMissionDrones(sim, s.x, s.z, mission.state === "COMBAT_1" ? 3 : 5, mission.state === "COMBAT_2");
      }
      if (combat && missionSpawned.current === mission.state && !sim.machines.some((m) => m.alive && m.mission)) { missionSpawned.current = `${mission.state}-done`; onMissionEvent({ type: "CLEAR" }); }

      // Adaptive re-teaching: a debounced (max once per 2s) struggle signal during the mission's
      // combat beats — repeated big hits with no defensive ability up, or staying low-hp without
      // activating one at all — builds toward a re-taught hint instead of firing on one bad frame.
      if (combat) {
        const now = performance.now() / 1000;
        const hpDrop = lastHpForAdaptive.current - sim.hp;
        const usingAbility = live.current.dashTime > 0 || live.current.hackTime > 0 || live.current.fieldTime > 0;
        if (hpDrop > 12 && !usingAbility && now - lastDodgeStruggleAt.current > 2) {
          lastDodgeStruggleAt.current = now;
          const struggled = recordStruggle(adaptiveTutorial.current, "DODGE");
          const result = maybeReteach(struggled, "DODGE", now);
          adaptiveTutorial.current = result.state;
          if (result.hint) alert(sim, `NOVA · ${result.hint}`);
        }
        if (sim.hp < 40 && !usingAbility && now - lastAbilityStruggleAt.current > 2) {
          lastAbilityStruggleAt.current = now;
          const struggled = recordStruggle(adaptiveTutorial.current, "ABILITY_USE");
          const result = maybeReteach(struggled, "ABILITY_USE", now);
          adaptiveTutorial.current = result.state;
          if (result.hint) alert(sim, `NOVA · ${result.hint}`);
        }
      }
      lastHpForAdaptive.current = sim.hp;
    }

    /* ---------------- Swamp story mission · The Drowned Relay world triggers ---------------- */
    if (relay && onRelayEvent) {
      const swamps = REGIONS.find((r) => r.id === "swamps");
      if (relay.state === "TRIGGERED" && !relay.target && swamps) { const site = relaySite(swamps); onRelayEvent({ type: "ANCHOR", x: site.x, z: site.z }); }
      if (relay.state === "WADING" && relay.target && Math.hypot(relay.target.x - s.x, relay.target.z - s.z) < 14) onRelayEvent({ type: "ARRIVED" });
      if (relay.state === "COMBAT_1" && relaySpawned.current !== "COMBAT_1" && relaySpawned.current !== "COMBAT_1-done") {
        relaySpawned.current = "COMBAT_1";
        spawnMissionDrones(sim, s.x, s.z, 5, false, "swamps");
      }
      if (relay.state === "COMBAT_1" && relaySpawned.current === "COMBAT_1" && !sim.machines.some((m) => m.alive && m.mission)) { relaySpawned.current = "COMBAT_1-done"; onRelayEvent({ type: "CLEAR" }); }
      if (relay.state === "BOSS" && relaySpawned.current !== "BOSS" && relaySpawned.current !== "BOSS-done") {
        relaySpawned.current = "BOSS";
        summonBoss(sim, "swamps", s.x, s.z - 18, { mission: true });
      }
      if (relay.state === "BOSS" && relaySpawned.current === "BOSS" && !sim.machines.some((m) => m.alive && m.mission)) { relaySpawned.current = "BOSS-done"; onRelayEvent({ type: "CLEAR" }); }
    }

    /* ---------------- Mission 02 · Blackout Protocol world triggers ---------------- */
    if (blackout && onBlackoutEvent) {
      if (blackout.state === "TRIGGERED" && !blackout.target) onBlackoutEvent({ type: "ANCHOR", x: NEON_CITY_CENTER.x, z: NEON_CITY_CENTER.z });
      if (blackout.state === "INFILTRATION" && blackout.target && Math.hypot(blackout.target.x - s.x, blackout.target.z - s.z) < 14) onBlackoutEvent({ type: "ARRIVED" });
      const blackoutCombat = blackout.state === "COMBAT_1" || blackout.state === "COMBAT_2";
      if (blackoutCombat && blackoutSpawned.current !== blackout.state && blackoutSpawned.current !== `${blackout.state}-done`) {
        blackoutSpawned.current = blackout.state;
        spawnMissionDrones(sim, s.x, s.z, blackout.state === "COMBAT_1" ? 4 : 6, blackout.state === "COMBAT_2");
      }
      if (blackoutCombat && blackoutSpawned.current === blackout.state && !sim.machines.some((m) => m.alive && m.mission)) { blackoutSpawned.current = `${blackout.state}-done`; onBlackoutEvent({ type: "CLEAR" }); }
    }

    /* ---------------- Mission 03 · Stitched Neon Core world triggers ---------------- */
    if (neonCore && onNeonCoreEvent) {
      if (neonCore.state === "TRIGGERED" && !neonCore.target) onNeonCoreEvent({ type: "ANCHOR", x: NEON_CITY_CENTER.x, z: NEON_CITY_CENTER.z });
      if (neonCore.state === "DESCENT" && neonCore.target && Math.hypot(neonCore.target.x - s.x, neonCore.target.z - s.z) < 14) onNeonCoreEvent({ type: "ARRIVED" });
      if (neonCore.state === "COMBAT_1" && neonCoreSpawned.current !== "COMBAT_1" && neonCoreSpawned.current !== "COMBAT_1-done") {
        neonCoreSpawned.current = "COMBAT_1";
        spawnMissionDrones(sim, s.x, s.z, 5, true);
      }
      if (neonCore.state === "COMBAT_1" && neonCoreSpawned.current === "COMBAT_1" && !sim.machines.some((m) => m.alive && m.mission)) { neonCoreSpawned.current = "COMBAT_1-done"; onNeonCoreEvent({ type: "CLEAR" }); }
      if (neonCore.state === "BOSS" && neonCoreSpawned.current !== "BOSS" && neonCoreSpawned.current !== "BOSS-done") {
        neonCoreSpawned.current = "BOSS";
        summonBoss(sim, "nexus", s.x, s.z - 18, { mission: true });
      }
      if (neonCore.state === "BOSS" && neonCoreSpawned.current === "BOSS" && !sim.machines.some((m) => m.alive && m.mission)) { neonCoreSpawned.current = "BOSS-done"; onNeonCoreEvent({ type: "CLEAR" }); }
    }

    /* ---------------- Solara story mission · Solar Array Alpha world triggers ---------------- */
    if (solarArray && onSolarArrayEvent) {
      const solara = REGIONS.find((r) => r.id === "solara");
      if (solarArray.state === "TRIGGERED" && !solarArray.target && solara) { const site = arraySite(solara); onSolarArrayEvent({ type: "ANCHOR", x: site.x, z: site.z }); }
      if (solarArray.state === "CROSSING" && solarArray.target && Math.hypot(solarArray.target.x - s.x, solarArray.target.z - s.z) < 14) onSolarArrayEvent({ type: "ARRIVED" });
      if (solarArray.state === "COMBAT_1" && solarArraySpawned.current !== "COMBAT_1" && solarArraySpawned.current !== "COMBAT_1-done") {
        solarArraySpawned.current = "COMBAT_1";
        spawnMissionDrones(sim, s.x, s.z, 6, false, "solara");
      }
      if (solarArray.state === "COMBAT_1" && solarArraySpawned.current === "COMBAT_1" && !sim.machines.some((m) => m.alive && m.mission)) { solarArraySpawned.current = "COMBAT_1-done"; onSolarArrayEvent({ type: "CLEAR" }); }
      if (solarArray.state === "BOSS" && solarArraySpawned.current !== "BOSS" && solarArraySpawned.current !== "BOSS-done") {
        solarArraySpawned.current = "BOSS";
        summonBoss(sim, "solara", s.x, s.z - 18, { mission: true });
      }
      if (solarArray.state === "BOSS" && solarArraySpawned.current === "BOSS" && !sim.machines.some((m) => m.alive && m.mission)) { solarArraySpawned.current = "BOSS-done"; onSolarArrayEvent({ type: "CLEAR" }); }
    }

    /* ---------------- Reveal mission · The Core Node world triggers (the REVEAL phase is UI only) ---------------- */
    if (coreNode && onCoreNodeEvent) {
      const nexus = REGIONS.find((r) => r.id === "nexus");
      if (coreNode.state === "TRIGGERED" && !coreNode.target && nexus) onCoreNodeEvent({ type: "ANCHOR", x: nexus.x + 6, z: nexus.z - 8 });
      if (coreNode.state === "INFILTRATE" && coreNode.target && Math.hypot(coreNode.target.x - s.x, coreNode.target.z - s.z) < 12) onCoreNodeEvent({ type: "ARRIVED" });
      if (coreNode.state === "COMBAT_1" && coreNodeSpawned.current !== "COMBAT_1" && coreNodeSpawned.current !== "COMBAT_1-done") {
        coreNodeSpawned.current = "COMBAT_1";
        spawnMissionDrones(sim, s.x, s.z, 6, true, "nexus");
      }
      if (coreNode.state === "COMBAT_1" && coreNodeSpawned.current === "COMBAT_1" && !sim.machines.some((m) => m.alive && m.mission)) { coreNodeSpawned.current = "COMBAT_1-done"; onCoreNodeEvent({ type: "CLEAR" }); }
    }

    /* ---------------- Zone story missions (Frostspire / Ember / Wastelands) world triggers ---------------- */
    if (zoneRuns && onZoneEvent) {
      for (const id of ZONE_MISSION_IDS) {
        const z = zoneRuns[id];
        if (!z) continue;
        const spec = ZONE_MISSIONS[id];
        const spawned = zoneSpawned.current[id] ?? "";
        const region = REGIONS.find((r) => r.id === spec.regionId);
        if (z.state === "TRIGGERED" && !z.target && region) { const site = zoneSite(spec, region); onZoneEvent(id, { type: "ANCHOR", x: site.x, z: site.z }); }
        if (z.state === "TRAVEL" && z.target && Math.hypot(z.target.x - s.x, z.target.z - s.z) < 14) onZoneEvent(id, { type: "ARRIVED" });
        if (z.state === "COMBAT_1" && spawned !== "COMBAT_1" && spawned !== "COMBAT_1-done") {
          zoneSpawned.current[id] = "COMBAT_1";
          spawnMissionDrones(sim, s.x, s.z, spec.waveSize, false, spec.regionId);
        }
        if (z.state === "COMBAT_1" && zoneSpawned.current[id] === "COMBAT_1" && !sim.machines.some((m) => m.alive && m.mission)) { zoneSpawned.current[id] = "COMBAT_1-done"; onZoneEvent(id, { type: "CLEAR" }); }
        if (z.state === "BOSS" && spawned !== "BOSS" && spawned !== "BOSS-done") {
          zoneSpawned.current[id] = "BOSS";
          summonBoss(sim, spec.regionId, s.x, s.z - 18, { mission: true });
        }
        if (z.state === "BOSS" && zoneSpawned.current[id] === "BOSS" && !sim.machines.some((m) => m.alive && m.mission)) { zoneSpawned.current[id] = "BOSS-done"; onZoneEvent(id, { type: "CLEAR" }); }
      }
    }

    /* ---------------- Mission 04 · Descent Protocol world triggers ---------------- */
    if (descent && onDescentEvent) {
      if (descent.state === "TRIGGERED" && !descent.target) { const d = dockSite(); onDescentEvent({ type: "ANCHOR", x: d.x, z: d.z }); }
      if (descent.state === "DIVE" && descent.target && Math.hypot(descent.target.x - s.x, descent.target.z - s.z) < 18) onDescentEvent({ type: "ARRIVED", from: descent.state });
      // the dock's security frames wake only at the dock, and give a respawned diver a few seconds before re-waking
      if (descent.state === "COMBAT_1" && descentSpawned.current !== "COMBAT_1" && descentSpawned.current !== "COMBAT_1-done" && s.sector === "SENTRY_DOCK" && performance.now() - sim.lastDeath > 6000) {
        descentSpawned.current = "COMBAT_1";
        spawnMissionDrones(sim, s.x, s.z, 4, false, "swamps", "thalassia");
      }
      if (descent.state === "COMBAT_1" && descentSpawned.current === "COMBAT_1" && !sim.machines.some((m) => m.alive && m.mission)) { descentSpawned.current = "COMBAT_1-done"; onDescentEvent({ type: "CLEAR", from: descent.state }); }
      // Thalassia's mission machines swim at the diver's depth instead of riding the surface
      if (s.diving && s.sector) for (const m of sim.machines) if (m.alive && m.mission && Math.hypot(m.x - s.x, m.z - s.z) < 90) m.swimY = s.y + 0.5;
      if (descent.state === "RING") { const w = ringWaypoint(); if (Math.hypot(w.x - s.x, w.z - s.z) < 9) onDescentEvent({ type: "ARRIVED", from: descent.state }); }
      if (descent.state === "CORE") {
        // the Sunk-Core's patrol wakes once when you go down; it is not a gate — the reactor is the objective
        if (descentSpawned.current !== "CORE" && s.sector === "SUNK_CORE") { descentSpawned.current = "CORE"; const r = reactorSite(); spawnMissionDrones(sim, r.x, r.z, 3, true, "swamps", "thalassia"); }
        const r = reactorSite();
        if (s.sector === "SUNK_CORE" && Math.hypot(r.x - s.x, r.z - s.z) < REACTOR_REACH) onDescentEvent({ type: "ARRIVED", from: descent.state });
      }
    }

    /* ---------------- Mission 05 · The System Core world triggers ---------------- */
    if (systemCore && onSystemCoreEvent) {
      if (systemCore.state === "TRIGGERED" && !systemCore.target) onSystemCoreEvent({ type: "ANCHOR", x: THALASSIA_CENTER.x, z: THALASSIA_CENTER.z });
      if (systemCore.state === "DIVE" && systemCore.target && Math.hypot(systemCore.target.x - s.x, systemCore.target.z - s.z) < 18) onSystemCoreEvent({ type: "ARRIVED" });
      if (systemCore.state === "COMBAT_1" && systemCoreSpawned.current !== "COMBAT_1" && systemCoreSpawned.current !== "COMBAT_1-done") {
        systemCoreSpawned.current = "COMBAT_1";
        spawnMissionDrones(sim, s.x, s.z, 6, true);
      }
      if (systemCore.state === "COMBAT_1" && systemCoreSpawned.current === "COMBAT_1" && !sim.machines.some((m) => m.alive && m.mission)) { systemCoreSpawned.current = "COMBAT_1-done"; onSystemCoreEvent({ type: "CLEAR" }); }
      if (systemCore.state === "BOSS" && systemCoreSpawned.current !== "BOSS" && systemCoreSpawned.current !== "BOSS-done") {
        systemCoreSpawned.current = "BOSS";
        summonBoss(sim, "thalassia", s.x, s.z - 18, { mission: true });
      }
      if (systemCore.state === "BOSS" && systemCoreSpawned.current === "BOSS" && !sim.machines.some((m) => m.alive && m.mission)) { systemCoreSpawned.current = "BOSS-done"; onSystemCoreEvent({ type: "CLEAR" }); }
    }

    /* ---------------- Verdant Forest · crash-site investigation + ambush patrol ---------------- */
    {
      const inv = stepInvestigation(investigation.current, dt, Math.hypot(CRASH_SITE.x - s.x, CRASH_SITE.z - s.z));
      investigation.current = inv.next;
      if (inv.event === "APPROACH") alert(sim, "Fracture energy signature ahead — investigate the crash site");
      else if (inv.event === "COMPLETE") alert(sim, "Crash site scanned — Fracture residue logged");
      if (!tutorial && shouldWakePatrol(Math.hypot(ENCOUNTER.x - s.x, ENCOUNTER.z - s.z), patrolWoken.current)) {
        patrolWoken.current = true;
        if (spawnForestPatrol(sim) > 0) alert(sim, "Hostile signatures in the clearing — use the cover");
      }
    }

    /* ---------------- Neon Core · Awakening micro-objectives ---------------- */
    if (awakening && onAwakeningEvent) {
      const a = awakening;
      if (a.state === "DROP") onAwakeningEvent({ type: "ANCHOR", x: s.x, z: s.z });
      const wave = a.state === "PATROL" ? 4 : a.state === "ESCALATION" ? 1 : a.state === "HOLD" ? 5 : 0;
      if (wave && awakeSpawned.current !== a.state && awakeSpawned.current !== `${a.state}-done`) {
        awakeSpawned.current = a.state;
        spawnMissionDrones(sim, s.x, s.z, wave, a.state === "ESCALATION");
        if (a.state === "ESCALATION") alert(sim, "NEON CORE DISTRICT ALERT: Faction activity detected");
      }
      if ((a.state === "PATROL" || a.state === "ESCALATION") && awakeSpawned.current === a.state && !sim.machines.some((m) => m.alive && m.mission)) { awakeSpawned.current = `${a.state}-done`; onAwakeningEvent({ type: "CLEAR", from: a.state }); }
      if ((a.state === "CAPTURE" || a.state === "EXTRACT") && a.target && Math.hypot(a.target.x - s.x, a.target.z - s.z) < 9) onAwakeningEvent({ type: "ARRIVED" });
      if (a.state === "HOLD" && a.target) {
        if (Math.hypot(a.target.x - s.x, a.target.z - s.z) < 12) holdRef.current = Math.min(100, holdRef.current + dt * 8);
        const step = Math.floor(holdRef.current / 5) * 5;
        if (step !== a.hold) onAwakeningEvent({ type: "HOLD", progress: step });
      } else holdRef.current = 0;
    }

    /* ---------------- Adaptive boss AI: read the player's recent pattern, feed it to sim.ts ---------------- */
    {
      const engagedBoss = sim.machines.find((e) => e.alive && e.boss);
      if (!engagedBoss) {
        bossActionLog.current = [];
        bossAdaptedPattern.current = null;
        sim.bossCounter = counterTuningFor(null);
      } else {
        const pattern = dominantPattern(bossActionLog.current, performance.now() / 1000);
        sim.bossCounter = counterTuningFor(pattern);
        if (pattern && pattern !== bossAdaptedPattern.current) {
          bossAdaptedPattern.current = pattern;
          alert(sim, `${engagedBoss.profile} is ${sim.bossCounter.tell}`);
        } else if (!pattern) {
          bossAdaptedPattern.current = null;
        }
      }
    }

    /* ---------------- simulation step ---------------- */
    const hpBeforeCombat = sim.hp;
    const { playerInstability } = stepSim(sim, {
      dt,
      px: s.x,
      pz: s.z,
      night,
      inVehicle: s.inVehicle,
      yaw: s.yaw,
    });
    if (s.inVehicle && sim.hp < hpBeforeCombat) { condition.current = impactVehicle(condition.current, hpBeforeCombat - sim.hp + 2); onVehicleCondition?.(vehicleId, condition.current); }
    // Living World: city events, patrols, civilian panic and contract progress (living-runtime.ts); outcomes go to GameCanvas
    {
      livingRt.current ??= createLivingRuntime(sim);
      const ch = CHALLENGES[gear?.challenge ?? "STANDARD"];
      sim.challenge.enemyHp = ch.enemyHp; sim.challenge.enemyDamage = ch.enemyDamage;
      const blocked = !!tutorial || !!interior || !!introPlayback || sim.machines.some((m) => m.alive && m.mission);
      const secretCtx = livingSecretCtx(gear, night > 0.5, wx?.state === "STORM");
      const lv = stepLivingRuntime(livingRt.current, sim, { dt, now: Date.now(), px: s.x, pz: s.z, blocked, living: gear?.living ?? EMPTY_LIVING, fallen: livingFallen, markers: livingMarks, rnd: Math.random, nemeses: gear?.nemeses ?? [], summonedNemesis: summonNemesis, secrets: secretCtx, forge: { earned: gear?.earnedRewards ?? [], relicId: relicIdRef.current } });
      livingHud.current = lv.hud;
      livingThreats.current = livingRt.current.threats;
      for (const e of lv.emits) onLiving?.(e);
      // Wastelands activities (wasteland-runtime.ts): vault defense, Rust Run rally, Mash-Pit derby
      wasteRt.current ??= createWasteRuntime(sim);
      const wv = stepWasteRuntime(wasteRt.current, sim, { dt, now: Date.now(), px: s.x, pz: s.z, inVehicle: s.inVehicle, blocked });
      wasteHud.current = wv.hud;
      for (const e of wv.emits) onWaste?.(e);
    }
    // Hull-destroyed respawn: hurtPlayer() (sim.ts) already resets hp/cargo and stamps sim.lastDeath, but
    // it can't touch the player's world position — that lives here in Scene's own state, not in WorldSim.
    // Detect the new timestamp and do the part sim.ts's alert text always claimed but never performed:
    // teleport back to Nexus City, bail out of any vehicle/interior, and zero out momentum.
    // launcher detonations (sim.burstEvents, read-only here): until this pass every rocket/elemental round blew up in silence
    for (const ev of sim.burstEvents) {
      if (ev.id <= burstHeard.current) continue;
      burstHeard.current = ev.id;
      sfx.playExplosion(ev.radius >= 7, sfx.where(s.x, s.z, s.yaw, ev.x, ev.z), flavorFor(ev.element));
      if (Math.hypot(s.x - ev.x, s.z - ev.z) < 25) s.punch += 0.5;
    }
    for (const ev of sim.stratagemEvents.splice(0)) {
      const dist = Math.hypot(s.x - ev.x, s.z - ev.z);
      sfx.playExplosion(ev.kind === "ORBITAL_STRIKE", sfx.where(s.x, s.z, s.yaw, ev.x, ev.z));
      if (ev.kind === "ORBITAL_STRIKE") s.punch += dist < 40 ? 2 : 0.6;
      if (ev.kind === "RESUPPLY" && dist <= ev.radius) {
        for (const id of WEAPON_ORDER) { s.ammo[id].mag = WEAPONS[id].mag; s.ammo[id].reserve = WEAPONS[id].reserve; }
        alert(sim, "Supply drop collected · ammo restocked, hull repaired");
      }
    }
    const hostiles = sim.machines.filter((m) => m.alive);
    checkpointClock.current += dt;
    if (checkpointClock.current >= CHECKPOINT_INTERVAL_S) {
      checkpointClock.current = 0;
      const here = { x: s.x, z: s.z };
      if (!s.insideInterior && isCheckpointSafe(here, hostiles, performance.now() - sim.lastHit < 6000)) { checkpoint.current = here; onCheckpoint?.(here); }
    }
    // dev warp (?dev=1): window.__warp("neon" | "thalassia" | "nexus" | "ember" | ...) — a testing aid for checking places in the real game
    if (devWarp.current) {
      const w = devWarp.current; devWarp.current = null;
      s.x = w.x; s.z = w.z; s.y = w.y ?? walkHeight(s.x, s.z) + 1.6; s.vy = 0; s.vSpeed = 0; s.inVehicle = false; s.insideInterior = null; interior = null; velocity.set(0, 0, 0);
      if (w.y !== undefined) { s.diving = true; s.grounded = false; s.oxygen = OXYGEN_MAX; s.hull = 0; }
      submerged = heightAt(s.x, s.z) < WATER_LEVEL - 0.2;
    }
    if (travelTo && travelTo.nonce !== travelSeen.current) {
      travelSeen.current = travelTo.nonce;
      s.x = travelTo.x; s.z = travelTo.z; s.y = walkHeight(s.x, s.z) + 1.6; s.vy = 0; s.vSpeed = 0; s.inVehicle = false; s.insideInterior = null; interior = null; velocity.set(0, 0, 0);
      // submersible arrival (Thalassia): the sub breaches the dock seal and you exit at depth, diving, full rebreather
      if (travelTo.y !== undefined) { s.y = travelTo.y; s.diving = true; s.grounded = false; s.oxygen = OXYGEN_MAX; s.hull = 0; s.breachAt = performance.now() / 1000; s.sector = sectorAt(s.x, s.y, s.z); }
      submerged = heightAt(s.x, s.z) < WATER_LEVEL - 0.2;
    }
    // "Drive out" from a home garage (residence-deeds.ts): into the driver's seat at the bay, nose to the door
    { const out = takeDriveOut(); if (out && vehicleUnlocked) { s.x = out.x; s.z = out.z; s.y = out.y + 1.6; s.yaw = out.yaw; s.vy = 0; s.vSpeed = 0; s.insideInterior = null; interior = null; velocity.set(0, 0, 0); s.inVehicle = !conditionEffects(condition.current).disabled; vh.current.airborne = false; vh.current.slip = 0; if (s.inVehicle) sfx.playVehicleEngineStart(vehicleId, 1); } }
    if (sim.lastDeath !== deathSeen.current) {
      deathSeen.current = sim.lastDeath;
      s.ammo = restockAll(s.ammo); // ammo.ts: you come back armed
      live.current = cancelAbilities(sim, live.current, { x: s.x, z: s.z, yaw: s.yaw });
      const arena = crucible.current && activity ? pointWorld(activity.def.area, ARENA_POINT) : null;
      // in a Crucible match you come back at the arena edge, opposite where you fell, not at a distant checkpoint
      const spot = arena ? { x: arena.x - Math.sign(s.x - arena.x || 1) * ARENA_RADIUS * 0.7, z: arena.z, label: "the arena edge" } : chooseRespawn({ x: s.x, z: s.z }, checkpoint.current, hostiles);
      // Thalassia descent checkpoint: dying in the city during the mission returns you to the dock berth
      const inCity = Math.hypot(s.x - dockSite().x, s.z - dockSite().z) < CITY_RADIUS + 60;
      // live playtest: before this, a death at the dock (pre-airlock) respawned the diver ~1 km away in the Verdant Forest. The berth is
      // the checkpoint from arrival on; restoring the airlock adds the air station there.
      const dockCheckpoint = inCity && !!descent && descent.state !== "TRIGGERED" && descent.state !== "DIVE" && descent.state !== "WORLD_UPDATE";
      if (dockCheckpoint && descent?.state === "COMBAT_1") {
        // the wave that killed you stands down (no kill credit) and re-wakes a few seconds after you are back on the berth
        for (const m of sim.machines) if (m.alive && m.mission) m.alive = false;
        descentSpawned.current = "";
      }
      const a = airlockSite();
      alert(sim, dockCheckpoint ? "Respawned at the Sentry Dock airlock" : `Respawned at ${spot.label} — away from active combat`);
      s.x = dockCheckpoint ? a.x + 5 : spot.x;
      s.z = dockCheckpoint ? a.z : spot.z;
      s.y = dockCheckpoint ? DOCK_DECK_Y + 1.6 : walkHeight(s.x, s.z) + 1.6;
      s.vy = 0;
      s.vSpeed = 0;
      s.grounded = !dockCheckpoint;
      s.diving = dockCheckpoint;
      if (dockCheckpoint) { s.oxygen = OXYGEN_MAX; s.hull = 0; }
      s.inVehicle = false;
      s.insideInterior = null;
      s.interiorReturnPos = null;
      interior = null;
      velocity.set(0, 0, 0);
      submerged = heightAt(s.x, s.z) < WATER_LEVEL - 0.2;
      sfx.playDeath();
    }
    // Zones already toss the player around above 0.6 instability (below); this is the visual half of
    // that same signal — the fog bleeds toward red and the sun flickers as a fracturing zone gets worse,
    // instead of the instability being felt only through physics with no on-screen cue at all.
    if (scene.fog instanceof THREE.Fog && playerInstability > INSTABILITY_FOG.from) scene.fog.color.lerp(instabilityColor, instabilityBleed(playerInstability));
    if (sun.current && playerInstability > 0.4) {
      const flicker = Math.min(1, (playerInstability - 0.4) / 0.4);
      sun.current.intensity *= 1 - Math.abs(Math.sin(performance.now() * 0.012 + s.x)) * 0.2 * flicker;
    }
    if (tutorial?.step === "CONTACT" && sim.kills > tutorialKills.current) { tutorialKills.current++; onTutorialEvent?.("KILL"); }
    if (tutorial?.step === "SENTINEL" && sentinel.current && !sentinel.current.alive) { sentinel.current = null; onTutorialEvent?.("BOSS"); }
    sim.mods.incomingDamageScale = balance.incomingDamageScale;
    sim.mods.bulletDamage = Math.max(0.5, 1.2 * live.current.damageMultiplier * (1 + live.current.momentum * 0.25) * balance.outgoingDamageScale);
    // the equipped ability build's archetype and active shield/reflect state actually change how enemy
    // squads move and hold fire (see squadMove in enemy-intelligence.ts), not just the HUD threat line
    const synergyArchetype = buildSynergy(live.current.equipped).archetype;
    sim.mods.squadArchetype = (synergyArchetype === "Defender" ? "DEFENSIVE" : synergyArchetype === "Striker" ? "STRIKER" : synergyArchetype === "Strategist" ? "STRATEGIST" : "BALANCED") as SquadArchetype;
    sim.mods.rangedHoldFire = live.current.shieldReflect > 0;
    sim.mods.branchPosture = branchPosture(live.current.equipped.slots, live.current.branches);
    if (live.current.fieldTime > 0) sim.gravity *= 0.55;
    sim.gravity *= hazardRef.current.gravityMul;
    if (live.current.dashTime > 0) sim.hp = Math.min(100, sim.hp + dt * 15);
    holdDisabledField(sim, live.current, { x: s.x, z: s.z, yaw: s.yaw });

    /* ---------------- vertical: gravity + terrain follow, or buoyancy + pressure diving ---------------- */
    // the Storm Islands' caps are ground too, for whoever stands on or drops onto them (storm-quests.ts)
    const skyGround = interior ? -Infinity : stormGroundAt(s.x, s.z, s.y - (s.inVehicle ? 1.9 : 1.6));
    // crates, walls and cover tops are ground too once your feet are on (or a step below) them
    const boxTop = interior || s.inVehicle ? -Infinity : solidTopAt(s.x, s.z, s.y - 1.6, solids, 0.45, 0.2);
    const standY = (interior ? INTERIOR_ALTITUDE : Math.max(walkHeight(s.x, s.z), skyGround, boxTop)) + (s.inVehicle ? 1.9 : 1.6);
    if (s.inVehicle && handling.mode !== "GROUND") {
      s.grounded = !vh.current.airborne; // stepVehicle owns height for aircraft and boats
    } else if (!s.inVehicle && submerged && (s.diving || held.has("KeyZ"))) {
      // Thalassia-style underwater vertical control: KeyC kicks up, KeyZ dives down, otherwise buoyancy carries you toward the surface.
      s.diving = true;
      const descend = held.has("KeyZ");
      const ascend = held.has("KeyC");
      if (ascend) s.vy = Math.min(4.5, s.vy + 9 * dt);
      if (descend) s.vy = Math.max(-4.5, s.vy - 9 * dt);
      // inside Thalassia the suit trims to neutral buoyancy (you hover where you stop); in open water you drift up
      s.vy = applyWaterDrag(s.sector ? s.vy : stepBuoyancy(s.vy, dt, descend), WATER_DRAG.vertical, dt);
      s.y += s.vy * dt;
      // Diving follows the true seabed; walkHeight is surface-clamped for ordinary walkers.
      const floor = heightAt(s.x, s.z) + 1.1;
      if (s.y < floor) { s.y = floor; s.vy = 0; }
      if (s.y > WATER_LEVEL + 1.5) { s.diving = false; s.grounded = false; s.vy = 0; }
    } else if (s.grounded || (submerged && !s.diving)) {
      if (!s.inVehicle && held.has("KeyC") && s.grounded && !submerged) {
        // Neon City parkour: a running jump vaults further and a little higher — momentum-based since the world's collision is radius-based, not mesh-accurate.
        const lunge = vaultLunge(velocity.length(), Math.sqrt(2 * sim.gravity * 6.5));
        s.vy = lunge.verticalBoost * boots.jump;
        if (lunge.forwardBoost > 0 && velocity.lengthSq() > 0.01) velocity.addScaledVector(velocity.clone().normalize(), lunge.forwardBoost);
        const nowSec = performance.now() / 1000;
        s.chainCount = nowSec - s.lastVaultAt < 1.4 ? s.chainCount + 1 : 1;
        s.lastVaultAt = nowSec;
        s.grounded = false;
        if (tutorial?.step === "MOVEMENT") onTutorialEvent?.("JUMP");
      } else {
        s.y = THREE.MathUtils.lerp(s.y, standY, 1 - Math.exp(-14 * dt));
        s.grounded = true;
        land(move.current.state, playerClass); move.current.state.airJumpsLeft += boots.extraAirJumps;
        move.current.jumpHeld = held.has("KeyC");
      }
    } else {
      if (!s.inVehicle && !submerged && !interior) {
        // class air mobility: tap jump again for an air jump; Warlocks hold jump to glide (movement.ts)
        const mv = move.current;
        const jumpHeld = held.has("KeyC");
        if (jumpHeld && !mv.jumpHeld) {
          const mult = airJump(mv.state, playerClass);
          if (mult !== null) { s.vy = Math.sqrt(2 * sim.gravity * 6.5) * mult * boots.jump; s.punch += 0.15; sfx.playReload("end"); }
        }
        mv.jumpHeld = jumpHeld;
        const before = s.vy;
        s.vy = hoverVy(opDash.current.state, glideVy(s.vy, playerClass, jumpHeld));
        if (AIR_PROFILE[playerClass].glide && jumpHeld && s.vy !== before) { velocity.x += Math.sin(s.yaw) * GLIDE_THRUST * dt; velocity.z += Math.cos(s.yaw) * GLIDE_THRUST * dt; }
      }
      // mantle / climb (traversal.ts): meeting a higher surface while airborne pulls you over it instead of snapping you up
      let travActive = false;
      if (!s.inVehicle && !submerged && !interior && !s.diving) {
        const tv = trav.current, climbHeld = held.has("KeyC");
        if (tv.mode === "NONE") {
          // the surface to pull onto: higher ground under you, or the top of a box just ahead (a ledge you are pressing into)
          let top = standY, onto = false;
          if (throttleF && !s.grounded) { // jump at a ledge to grab it; walking into a crate never auto-climbs
            const ax = s.x + Math.sin(s.yaw) * 0.8, az = s.z + Math.cos(s.yaw) * 0.8;
            const ledge = solidTopAt(ax, az, s.y - 1.6, solids, climbHeld ? CLIMB_MAX : MANTLE_MAX, 0) + 1.6;
            if (ledge > top) { top = ledge; onto = true; }
          }
          if (top > s.y && startTraversal(tv, playerClass, s.y, top, { forward: throttleF, climbHeld })) { s.vy = 0; s.punch += 0.15; sfx.playReload("end"); travTop.current = { y: top, onto }; }
        }
        if (tv.mode !== "NONE") {
          const goal = travTop.current?.onto ? travTop.current.y : standY;
          const r = stepTraversal(tv, playerClass, dt, goal, climbHeld);
          travActive = !r.fell;
          if (!r.fell) {
            s.y = r.y; s.vy = 0; velocity.x *= r.steer; velocity.z *= r.steer;
            if (r.done) {
              // over the lip: step onto the top you pulled up to
              if (travTop.current?.onto) { s.x += Math.sin(s.yaw) * 0.9; s.z += Math.cos(s.yaw) * 0.9; }
              s.y = goal; s.grounded = true; land(move.current.state, playerClass); move.current.state.airJumpsLeft += boots.extraAirJumps;
              travTop.current = null;
            }
          } else travTop.current = null;
        }
      }
      if (!travActive) {
      s.vy -= sim.gravity * dt;
      if (dragoniteRt.current.rt.glide > 0 && s.vy < -2.5) s.vy = -2.5; // Wyrmwing glide
      s.y += s.vy * dt;
      if (s.y <= standY) {
        s.y = standY;
        s.vy = 0;
        s.grounded = true;
        land(move.current.state, playerClass); move.current.state.airJumpsLeft += boots.extraAirJumps;
      }
      }
    }
    restTraversal(trav.current, playerClass, dt, s.grounded);
    // body origin must stay above the sampled support surface, even uphill or after a knockdown
    clampToFloor(s, s.diving ? heightAt(s.x, s.z) : interior ? INTERIOR_ALTITUDE : Math.max(walkHeight(s.x, s.z), stormGroundAt(s.x, s.z, s.y - (s.inVehicle ? 1.9 : 1.6))), s.diving ? 1.1 : s.inVehicle ? 1.9 : 1.6);
    // fracture instability tosses loose objects (and you) around
    if (playerInstability > 0.6 && s.grounded && !s.diving && Math.random() < playerInstability * dt * 1.2) {
      s.vy = 6 + playerInstability * 10;
      s.grounded = false;
    }
    {
      // Mag-Grind Boots: latch onto a Neon City rail, ride it, jump off with the speed (maggrind.ts)
      const gr = grindRt.current, jumpNow = held.has("KeyC");
      if (!interior && !s.inVehicle && !s.diving && !submerged) {
        const slideKey = held.has(binds.keyboard.crouch) || !!padNow[binds.gamepad.crouch];
        if (!isGrinding(gr.state) && boots.grind && (!s.grounded ? s.vy <= 0.5 : slideKey) && tryLatch(gr.state, grindRails, true, s.x, s.y - 0.5, s.z, velocity.x, velocity.z)) { sfx.playAbility("DASH"); s.punch += 0.2; cancelSlide(move.current.state); }
        const g = stepGrind(gr.state, grindRails, dt);
        if (g) {
          if (g.ended) { velocity.x = g.vx; velocity.z = g.vz; s.vy = 4; s.grounded = false; }
          else if (jumpNow && !gr.jumpPrev) {
            const out = leaveGrind(gr.state, grindRails);
            if (out) { velocity.x = out.vx; velocity.z = out.vz; s.vy = out.vy; s.grounded = false; s.punch += 0.25; sfx.playReload("end"); }
          } else { s.x = g.x; s.z = g.z; s.y = g.y + 0.5; s.vy = 0; s.grounded = true; velocity.x = g.vx; velocity.z = g.vz; }
        }
      } else if (isGrinding(gr.state)) gr.state.railId = null;
      gr.jumpPrev = jumpNow;
    }
    void ground;

    carSpeed.current = s.inVehicle ? s.vSpeed : 0;
    carSteer.current = s.inVehicle ? (left ? 0.4 : right ? -0.4 : 0) : 0;
    carBrake.current = s.inVehicle && ((throttleB && s.vSpeed > 0.5) || s.vSpeed < -0.3) ? 1 : 0;
    // the light count changes only when you get in or out (one shader rebuild), not while driving
    if (headlamp.current && headlamp.current.visible !== s.inVehicle) headlamp.current.visible = s.inVehicle;

    /* ---------------- transforms ---------------- */
    const p = player.current;
    const v = vehicle.current;
    if (p) {
      p.visible = !s.inVehicle && s.cameraBlend > 0.3;
      p.position.set(s.x, s.y, s.z);
      p.rotation.y = s.yaw;
    }
    if (v) {
        v.visible = vehicleUnlocked && s.inVehicle;
      if (s.inVehicle) {
        v.position.set(s.x, s.y, s.z);
        // yaw, then pitch and roll about the vehicle's own axes (the default XYZ order pitched aircraft about the world X axis,
        // so a jet heading east rolled instead of climbing)
        v.rotation.order = "YXZ";
        v.rotation.y = s.yaw;
        if (handling.mode === "GROUND") {
          // sit on the ground under the wheels: pitch from the ground ahead/behind, roll from left/right (one centre sample
          // left wheels floating or buried on every slope)
          const L = 1.8, W = 0.9, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
          const gp = Math.atan2(walkHeight(s.x + fx * L, s.z + fz * L) - walkHeight(s.x - fx * L, s.z - fz * L), 2 * L);
          const gr = Math.atan2(walkHeight(s.x + fz * W, s.z - fx * W) - walkHeight(s.x - fz * W, s.z + fx * W), 2 * W);
          const k = 1 - Math.exp(-10 * dt);
          vh.current.groundPitch += (gp - vh.current.groundPitch) * k;
          vh.current.groundRoll += (gr - vh.current.groundRoll) * k;
          v.rotation.x = -vh.current.groundPitch;
          v.rotation.z = vh.current.roll + vh.current.groundRoll;
        } else {
          v.rotation.x = handling.mode === "AIR" ? -vh.current.pitch : 0;
          v.rotation.z = vh.current.roll;
        }
      } else {
        // parked at the spawn pad when on foot
        v.position.set(SPAWN.x + 8, walkHeight(SPAWN.x + 8, SPAWN.z + 6) + 1.9, SPAWN.z + 6);
        v.rotation.set(0, 0.6, 0);
        // a car parked in a home garage (ResidenceGarages.tsx) stands there, not here as well
        v.visible = vehicleUnlocked && !activeParked;
      }
    }

    /* ---------------- camera ---------------- */
    if (introPlayback) {
      // Opening cinematic: the scripted flythrough owns the camera outright — no follow-cam
      // lerp, no shake/recoil/FOV kick, no viewmodel (there's no weapon drawn yet at this point
      // in onboarding). Normal control resumes the instant IntroCinematic.tsx unmounts and this
      // prop goes away, at which point the follow-cam picks up from exactly where this leaves it.
      const pose = introCameraAt(introPlayback.elapsed, introPlayback.totalSeconds);
      camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
      camera.lookAt(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
      if (viewmodel.current) viewmodel.current.visible = false;
    } else {
      // stride: walking/running cadence from the real ground speed, shared by camera, weapon and limbs
      {
        const f = feel.current;
        const hSpeed = s.inVehicle ? 0 : Math.hypot(velocity.x, velocity.z);
        const strafe = (velocity.x * Math.cos(s.yaw) - velocity.z * Math.sin(s.yaw)) / RUN_SPEED;
        f.view = stepStride(f.stride, { speed: hSpeed, grounded: s.grounded && !s.diving && !s.inVehicle, sliding: move.current.state.slideLeft > 0, vy: s.vy, dt }, strafe);
        f.motion.phase = f.view.phase; f.motion.intensity = f.view.intensity; f.motion.swing = f.view.swing; f.motion.lean = f.view.lean; f.motion.air = !s.grounded && !s.diving; f.motion.stance = move.current.state.stance; if (s.shots !== f.lastShots) { f.lastShots = s.shots; f.combatUntil = performance.now() / 1000 + COMBAT_STANCE_HOLD; } f.motion.combat = combatStance(Boolean(mouse.current.aim || padState.current.aim), performance.now() / 1000, f.combatUntil); f.motion.slideT = move.current.state.slideLeft > 0 ? 1 - move.current.state.slideLeft / SLIDE_SECONDS : -1;
      }
      const override = !s.inVehicle && (s.meleeTime > 0 || s.specialTime > 0);
      // vehicles always use the chase camera: a first-person blend put the camera at the vehicle's centre, inside its body
      const targetBlend = override || !s.firstPerson || s.inVehicle ? 1 : 0;
      s.cameraBlend += (targetBlend - s.cameraBlend) * (1 - Math.exp(-15 * dt));
      const shoulder = s.inVehicle ? 0 : OPERATOR_CAMERA.shoulder * lockRt.current.state.shoulderSide;
      const vcam = vehicleCamera(handling);
      const distance = s.inVehicle ? vcam.distance : interior ? OPERATOR_CAMERA.indoorDistance : OPERATOR_CAMERA.distance;
      camTarget.set(
        s.x + Math.sin(s.yaw) * (s.inVehicle ? 1 : 0.15) + (Math.cos(s.yaw) * shoulder - Math.sin(s.yaw) * distance) * s.cameraBlend,
        s.y + (s.inVehicle ? 1.5 : OPERATOR_CAMERA.eye) + (s.inVehicle ? vcam.height : interior ? OPERATOR_CAMERA.indoorRise : OPERATOR_CAMERA.rise) * s.cameraBlend,
        s.z + Math.cos(s.yaw) * (s.inVehicle ? 1 : 0.15) + (-Math.sin(s.yaw) * shoulder - Math.cos(s.yaw) * distance) * s.cameraBlend,
      );
      // divers: the camera may go below the surface (clamp to the seabed, not the water-clamped walk height)
      camTarget.y = Math.max(camTarget.y, (interior ? INTERIOR_ALTITUDE : s.diving ? heightAt(camTarget.x, camTarget.z) + 0.6 : walkHeight(camTarget.x, camTarget.z)) + (s.diving ? 0 : 1.35)) - cameraDrop(move.current.state);
      // third-person boom: pull the camera in front of a trunk, rock, tower or wall between it and the operator (camera-occlusion.ts)
      if (!s.inVehicle && !interior && s.cameraBlend > 0.5) {
        camHead.set(s.x, s.y + OPERATOR_CAMERA.eye, s.z);
        const clear = boomClearance(camHead, camTarget);
        if (clear < 1) camTarget.lerpVectors(camHead, camTarget, clear);
      }
      // a teleport (door into a pocket room and back, fast travel, respawn) snaps the camera; easing it would fly the view
      // across kilometres of world for half a second. Keyed on the player's own jump, so the intro hand-off still eases in.
      const jumped = Math.hypot(s.x - lastCamPlayer.current.x, s.y - lastCamPlayer.current.y, s.z - lastCamPlayer.current.z) > 40;
      lastCamPlayer.current = { x: s.x, y: s.y, z: s.z };
      if (jumped) camera.position.copy(camTarget);
      else camera.position.lerp(camTarget, 1 - Math.exp(-18 * dt));
      const kickPitch = s.pitch + s.recoil;
      const shakeAmt = Math.min(0.08, s.punch * 0.012);
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt;
      cameraDirection.set(Math.sin(s.yaw) * Math.cos(kickPitch), Math.sin(kickPitch), Math.cos(s.yaw) * Math.cos(kickPitch));
      look.copy(camera.position).addScaledVector(cameraDirection, 60);
      camera.lookAt(look);
      if (feel.current.view && !s.inVehicle) {
        // head bob + weight shift + strafe roll; third person feels it at a reduced strength
        const fv = feel.current.view;
        const k = 1 - 0.65 * s.cameraBlend;
        camera.position.y += fv.bobY * k;
        camera.position.x += Math.cos(s.yaw) * fv.swayX * k;
        camera.position.z += -Math.sin(s.yaw) * fv.swayX * k;
        camera.rotateZ(fv.roll * k);
      }
      if (camera instanceof THREE.PerspectiveCamera) {
        const desiredFov = movementFov(Boolean(mouse.current.aim || padState.current.aim), !s.inVehicle && s.grounded && boost && move.current.state.stance === "STAND" && Math.hypot(velocity.x, velocity.z) > 2, move.current.state.slideLeft > 0, move.current.state.stance);
        camera.fov += (desiredFov - camera.fov) * (1 - Math.exp(-12 * dt));
        camera.updateProjectionMatrix();
      }
      if (viewmodel.current) {
        viewmodel.current.visible = !s.inVehicle && s.cameraBlend < 0.22;
        viewmodel.current.position.copy(camera.position);
        viewmodel.current.quaternion.copy(camera.quaternion);
        // sprint/slide widen the FOV; scaling the viewmodel's x/y by the same ratio keeps the gun and hands where they sit
        // at the hip (or aim) FOV, instead of sliding apart and stretching on every FOV kick
        if (camera instanceof THREE.PerspectiveCamera) {
          // the baseline eases exactly like the camera does, so aiming in/out is untouched and only the kicks are cancelled
          const want = movementFov(Boolean(mouse.current.aim || padState.current.aim), false, false, "STAND");
          vmBaseFov.current += (want - vmBaseFov.current) * (1 - Math.exp(-12 * dt));
          const k = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(vmBaseFov.current / 2));
          viewmodel.current.scale.set(k, k, 1);
        }
        // one shared handling system: draw/holster, ADS, recoil spring, sprint, reload choreography, slide/pump/bolt, melee arcs
        const vdef = WEAPONS[s.weapon];
        const vfeel = { mobility: armorFxRef.current.moveSpeed * 10, defense: armorFxRef.current.resist * 4 };
        const fired = s.shots - viewShots.current; viewShots.current = s.shots;
        const vin = {
          weapon: s.weapon,
          aiming: Boolean(mouse.current.aim || padState.current.aim),
          sprinting: s.grounded && (held.has("ShiftLeft") || held.has("ShiftRight")) && Math.hypot(velocity.x, velocity.z) > 2 && move.current.state.stance === "STAND",
          fired: Math.max(0, Math.min(3, fired)),
          reload: s.reload > 0 && vdef.reload > 0 ? 1 - s.reload / vdef.reload : -1,
          swing: s.swing > 0 ? 1 - s.swing / 0.3 : -1,
          combo: s.combo,
          feel: vfeel,
          noise: Math.random() * 2 - 1,
        };
        viewState.current = stepView(viewState.current ?? initialView(s.weapon), vin, dt);
        const fv = feel.current.view;
        viewPoseRef.current = viewPose(viewState.current, vin, fv?.bobY ?? 0, fv?.swayX ?? 0, vfeel);
      }
    }

    /* ---------------- HUD ---------------- */
    report.current += dt;
    if (report.current > 0.18) {
      report.current = 0;
      if (sim.drops.length) onDrops?.(sim.drops.splice(0));
      // While indoors here is null (interiors sit far outside WORLD_RADIUS), so read the zone through
      // the interior's own regionId — the same substitution updateMusicRegion/regionId already use —
      // rather than silently falling back to defaults for owner/contested/zoneTier while inside.
      const zone = sim.zones.find((z) => z.region.id === (interior ? interior.regionId : here?.id));
      const hudSnapshot: HudState = {
        region: interior ? interior.name : here?.name ?? "Open Wilds",
        sub: interior ? (interior.kind === "SHOP" ? (isInteriorOpen(interior, time.current) ? "Shop — open" : "Shop — closed for the night") : interior.kind === "VENUE" ? "Nightlife venue" : "Private residence") : here?.sub ?? "Unclaimed / no cover",
        kind: interior ? "safe" : here?.kind ?? "war",
        difficulty: interior ? 0 : here?.difficulty ?? 2,
        rules: interior ? ["Indoors — hostiles can't follow", "Walk to the door to head back out"] : here?.rules ?? ["No stability field", "AI patrols roam freely"],
        phase: phaseFor(time.current),
        clock: clockLabel(time.current),
        speed: Math.round(s.inVehicle ? Math.abs(s.vSpeed) * 2.4 : velocity.length() * 2.4),
        mode: s.inVehicle ? "vehicle" : "foot",
        ...(s.inVehicle ? { vehicle: { name: selectedVehicle.name, ...driveTelemetry(vehicleId, Math.abs(s.vSpeed) / 45, keys.current.has("KeyW") || keys.current.has("KeyS") ? 1 : 0, selectedVehicle.speed / vehicleById(vehicleId).speed), load: Math.min(1, Math.abs(s.vSpeed) / 45), reverse: s.vSpeed < -0.1, hull: selectedVehicle.hull, tuning: fleetTuningSummary(gear?.fleet), primary: armament.primary?.name ?? "Unarmed", ...(armament.secondary ? { secondary: armament.secondary.name, secondaryReady: Math.max(0, Math.min(1, 1 - vFire.current.secCool / armament.secondary.rate)) } : armament.secondaryGun ? { secondary: armament.secondaryGun.name, secondaryReady: 1 } : {}) } } : {}),
        owner: zone?.owner ?? "syndicate",
        challenger: zone?.challenger ?? "vanguard",
        progress: zone?.progress ?? 0,
        contested: zone?.contested ?? false,
        instability: playerInstability,
        gravity: sim.gravity,
        hp: Math.round(sim.hp),
        credits: sim.credits,
        cargo: sim.cargo,
        kills: sim.kills,
        stormSite: interior ? null : stormSiteAt(s.x, s.z, s.y - 1.6)?.id ?? null,
        stormSighted: !interior && sighted(s.x, s.z),
        elevation: interior ? 0 : Math.round(heightAt(s.x, s.z)),
        traction,
        alerts: sim.alerts.map((a) => a.text),
        threat: Math.round(sim.director.threat),
        heat: Math.round(sim.combatHeat),
        coreHp: Math.round(sim.coreHp),
        trend: directorTrend(sim.director),
        missions: sim.director.missions.filter((m) => m.state === "ACTIVE").slice(0, 3),
        ownership: sim.zones.map((z) => ({ id: z.region.id, name: z.region.name, owner: z.owner })),
        weaponHeat: Math.round(sim.weaponHeat),
        overheated: sim.overheated,
        view: s.cameraBlend > 0.5 ? "third" : "first",
        aimLocked: s.aimLocked,
        aiming: (mouse.current.aim || padState.current.aim),
        meleeTime: s.meleeTime,
        weaponName: WEAPONS[s.weapon].name,
        weaponSlot: orderRef.current.indexOf(s.weapon) + 1,
        ammo: orderRef.current.map((id) => ({ id, name: WEAPONS[id].name, mag: s.ammo[id].mag, magSize: WEAPONS[id].mag, reserve: s.ammo[id].reserve, ...(WEAPONS[id].element && WEAPONS[id].element !== "KINETIC" ? { element: WEAPONS[id].element } : {}) })),
        reloading: s.reload > 0 ? 1 - s.reload / WEAPONS[s.weapon].reload : 0,
        weaponWheel: s.wheel,
        weaponSwitched: s.switchedAt,
        controller: padState.current.connected,
        bloom: Math.round(s.bloom * 100) / 100,
        hitMarker: performance.now() - sim.lastHit < 180,
        reticle: reticle.current.view,
        playerClass,
        subclassName: selectedSubclass.name,
        callsign: appearance.callsign,
        abilities: abilityHud(live.current),
        firstMissionComplete: sim.director.missions.some((mission) => mission.kind === "FIRST_RESONANCE" && mission.state === "COMPLETED"),
        weather: weatherName.current,
        environment: environmentSummary.current,
        hazardWarning: hazardWarning.current,
        hazard: hazardRef.current.id === "none" ? undefined : { name: hazardRef.current.name, intensity: hazardRef.current.intensity, active: hazardRef.current.damagePerSec > 0 || hazardRef.current.gravityMul !== 1 },
        stratagem: stratagemHud(stratagem.current, performance.now() / 1000, backpackFor(playerClass).name),
        streamTier: "ACTIVE · neighbors reduced · distant dormant",
        vehicleUnlocked,
        vehicleName: selectedVehicle.name,
        vehicleDomain: selectedVehicle.domain,
        vehicleWeapon: selectedVehicle.weapon,
        vehicleSeats: selectedVehicle.seats,
        shield: Math.round(sim.titan.shield),
        energy: Math.round(sim.titan.energy),
        stability: Math.round(sim.titan.stability),
        blocking: sim.titan.blocking,
        domeTime: sim.titan.domeTime,
        titanFeedback: sim.titan.feedback,
        liveEnergy: Math.round(live.current.energy),
        liveEffect: live.current.effectTime > 0 ? live.current.effect : "",
        enemyResponse: live.current.threat,
        momentum: Math.round(live.current.momentum * 100),
        loot: (sim.loot ?? []).map((it) => ({
          name: it.name,
          rarity: it.rarity,
          power: it.power,
          mods: it.mods.map((m) => `${m.name} +${m.value}${m.effect === "Utility" ? "" : "%"}`),
          color: RARITY_COLOR[it.rarity],
        })),
        inspector: s.showInspector ? buildInspector() : null,
        markers: track(markerList(s.x, s.z), s.x, s.z, s.yaw),
        px: s.x, pz: s.z, yaw: s.yaw,
        diving: s.diving,
        oxygen: Math.round(s.oxygen),
        depth: Math.round(depth),
        underwaterState: classifyUnderwaterState({ submerged, depth, oxygen: s.oxygen, boosting: boost }),
        sector: s.sector ? SECTOR_LABEL[s.sector] : "",
        hullStress: Math.round(s.hull * 100) / 100,
        coolant: s.sector === "ABYSSAL_RING" ? coolantPhase(performance.now() / 1000) : "",
        breachAge: performance.now() / 1000 - s.breachAt,
        structure: (() => { const all = [...structure.nodes.values()]; const e = structure.events[structure.events.length - 1]; return { standing: all.filter((n) => !n.isDestroyed).length, total: all.length, lastEvent: e ? `${e.type} ${e.nodeId}` : "" }; })(),
        heatLevel: heatStatus(s.heatMeter).level,
        heatLabel: heatStatus(s.heatMeter).label,
        heatResponse: heatStatus(s.heatMeter).response,
        vehicleStage,
        parkourChain: s.chainCount,
        nexusDetection,
        nexusLockdownTier: nexusLockdown.tier,
        nexusLockdownLabel: nexusLockdown.label,
        nexusLockdownResponse: nexusLockdown.response,
        hacking: s.hacking,
        hackProgress: Math.round(s.hackProgress),
        regionId: interior ? interior.regionId : here?.id ?? "",
        insideInterior: s.insideInterior,
        interiorName: interior?.name ?? "",
        interiorOpen: interior ? isInteriorOpen(interior, time.current) : true,
        living: livingHud.current,
        garageNear: !interior ? garageNear(s.x, s.z) : null,
        residenceNear: !interior && !s.inVehicle ? deedNear(s.x, s.z) : null,
        skateShopNear: !interior && Math.hypot(s.x - NEON_CITY_CENTER.x - SKATE_SHOP_OFFSET.x, s.z - NEON_CITY_CENTER.z - SKATE_SHOP_OFFSET.z) < SKATE_SHOP_RADIUS,
        waste: wasteHud.current,
        vaelNear: !interior && !s.inVehicle && vaelNear({ earnedRewards: gear?.earnedRewards ?? [] }, s.x, s.z),
        npcNear: !interior && !s.inVehicle ? (() => { const n = npcNear(s.x, s.z); return n ? { id: n.id, name: n.name, title: n.title } : null; })() : null,
        shopNearId: !s.inVehicle && (!interior || isInteriorOpen(interior, time.current)) ? accessibleShop(s.x, s.z, interior)?.id ?? null : null,
        shopNearName: !s.inVehicle ? accessibleShop(s.x, s.z, interior)?.name ?? "" : "",
        cacheNear: cacheLive.current.view,
        ruinNear: ruinLive.current,
        zoneTier: instabilityTier(zone?.instability ?? 0),
        justDied: sim.lastDeath,
        deathCause: sim.lastDeathCause,
        deathCargoLost: sim.lastDeathCargo,
        deaths: sim.deaths,
        bossHud: (() => {
          const b = sim.machines.find((e) => e.alive && e.boss && e.maxHp);
          if (!b || !b.maxHp) return null;
          const nowSec = performance.now() / 1000;
          const poise = b.poiseState;
          return {
            name: b.profile,
            hpPct: Math.max(0, Math.round((b.hp / b.maxHp) * 100)),
            phaseLabel: tuningFor(b.phase ?? 0).label,
            poisePct: Math.round(((poise?.poise ?? 0) / POISE_MAX) * 100),
            weakPointOpen: poise ? isWeakPointOpen(poise, nowSec) : false,
            staggered: poise ? isStaggered(poise, nowSec) : false,
            adaptedTell: bossAdaptedPattern.current ? sim.bossCounter.tell : "",
            scenario: Boolean(b.scenarioId),
          };
        })(),
        emergencyQuest: sim.emergencyQuest.state === "DORMANT" ? null : {
          state: sim.emergencyQuest.state,
          bossName: sim.emergencyQuest.bossName,
          regionId: sim.emergencyQuest.regionId,
          timer: Math.ceil(sim.emergencyQuest.timer),
        },
      };
      // identical snapshots (standing still) skip the React re-render; a heartbeat keeps clock-driven HUD fresh
      if (hudGate.current(hudSnapshot, performance.now())) onHud(hudSnapshot);
    }
    resetFrameFailureCount();
    } catch (err) {
      softFrameFailure(err, () => {
        // Escalated soft-fail rollback: a genuine run of broken frames, not one freak error — snap
        // back to the same safe respawn-at-Nexus state hurtPlayer()'s death flow already uses.
        s.x = NEXUS_REGION.x;
        s.z = NEXUS_REGION.z + 10;
        s.y = walkHeight(s.x, s.z) + 1.6;
        s.vy = 0;
        s.vSpeed = 0;
        s.grounded = true;
        sim.hp = 100;
        alert(sim, "World state recovered — respawned at Nexus City");
      });
    }
  });

  return (
    <>
      <fog attach="fog" args={["#5f9aa3", 70 * FOG_REACH, 430 * FOG_REACH]} />
      <Motes />
      <hemisphereLight ref={hemi} args={["#9ec8e8", "#3b3326", 0.85]} />
      <directionalLight
        ref={sun}
        position={[80, 140, 70]}
        intensity={1.6}
        castShadow={RENDER_PRESETS[settings.renderTier].shadows}
        shadow-mapSize-width={settings.renderTier === "ULTRA" ? 4096 : settings.renderTier === "HIGH" ? 2048 : 1024}
        shadow-mapSize-height={settings.renderTier === "ULTRA" ? 4096 : settings.renderTier === "HIGH" ? 2048 : 1024}
        shadow-bias={-0.00035}
        shadow-normalBias={0.035}
        shadow-radius={settings.renderTier === "LOW" ? 1 : 2}
        shadow-camera-left={-130}
        shadow-camera-right={130}
        shadow-camera-top={130}
        shadow-camera-bottom={-130}
        shadow-camera-far={520}
      />
      <directionalLight ref={moon} position={[-90, 110, -70]} color="#b9c8e8" intensity={0.3} />
      <group name="iso:sky">
      <Sky
        ref={sky as unknown as React.Ref<never>}
        distance={4000}
        sunPosition={[120, 90, 60]}
        turbidity={5}
        rayleigh={2.4}
        mieCoefficient={0.006}
        mieDirectionalG={0.82}
      />
      <group ref={skyDomeGroup}><SkyDome sunDirRef={sunDir} envRef={skyEnv} playerRef={player} tier={settings.renderTier} /><BrokenHorizon playerRef={player} /></group>
      <FractureStorm envRef={skyEnv} />
      <SkyBodies timeRef={time} sunDirRef={sunDir} envRef={skyEnv} playerRef={player} />
      {/* the billboard cloud puffs (CloudLayer) are retired: the sky dome draws real lit cumulus now, and the owner disliked the puffs */}
      {settings.renderTier !== "LOW" && <SkyFx fxRef={skyFx} envRef={skyEnv} playerRef={player} />}
      </group>
      <RegionLighting playerRef={player} tier={settings.renderTier} />

      <group name="terrain+trees"><Terrain renderTier={settings.renderTier} /></group>
      <Roads />
      <WorldPiece name="road-dressing"><RoadDressing /></WorldPiece>
      <group name="ground-cover"><GroundCover density={coverDensityFor(settings.renderTier)} /></group>
      <GrassField tier={settings.renderTier} />
      <group name="iso:forest">{settings.renderTier !== "LOW" && <LightShafts sunRef={sunDir} skyEnv={skyEnv} forest={VERIDAN_REGION} />}<GlitchAnomalies /><VerdantForest density={settings.renderTier === "LOW" ? 0.5 : settings.renderTier === "MEDIUM" ? 0.75 : 1} models={settings.renderTier !== "LOW"} investigation={investigation} heavyShadow={heavyShadows(settings.renderTier)} /></group>
      <RiftTurrets sim={sim} />
      <PerfProbe />
      <group name="iso:weather"><Weather playerRef={player} weatherRef={weatherKind} fxRef={weatherFx} /></group>
      <group name="iso:life"><Wildlife playerRef={player} sim={sim} /><Civilians playerRef={player} threatsRef={livingThreats} /><LivingCity runtime={livingRt} playerRef={player} gear={gear as PlayerProgression | undefined} /><WastelandSites runtime={wasteRt} playerRef={player} /></group>
      <group name="iso:water"><Water size={WORLD_RADIUS * 4} sunRef={sunDir} styleRef={waterStyle} tier={settings.renderTier} /><Rivers sunRef={sunDir} /></group>
      <LootCaches opened={openedCaches} />
      <ShopStalls />
      <Storefronts />
      <NearOnly playerRef={player} x={NEXUS_REGION.x} z={NEXUS_REGION.z} radius={330 * NEAR_SCALE[settings.renderTier]} name="city:nexus"><NexusCity sim={sim} />{gear && <ResidenceGarages city="nexus" progression={{ nexLedger: gear.nexLedger ?? {}, housing: gear.housing, fleet: gear.fleet }} />}</NearOnly>
      {/* street level (kerbs, crossings, furniture, signals; src/game/city-streets.ts): only near enough to read */}
      <NearOnly playerRef={player} x={NEXUS_REGION.x} z={NEXUS_REGION.z} radius={190 * NEAR_SCALE[settings.renderTier]} name="streets:nexus"><WorldPiece name="nexus streets"><CityStreets city="nexus" tier={settings.renderTier} /></WorldPiece></NearOnly>
      <NearOnly playerRef={player} x={NEON_CITY_CENTER.x} z={NEON_CITY_CENTER.z} radius={240 * NEAR_SCALE[settings.renderTier]} name="streets:neon"><WorldPiece name="neon streets"><CityStreets city="neon" tier={settings.renderTier} /></WorldPiece></NearOnly>
      <WorldPiece name="atlas sites"><SiteMarkers playerRef={player} /></WorldPiece>
      <NearOnly playerRef={player} x={STORM_ISLANDS_CENTER.x} z={STORM_ISLANDS_CENTER.z} radius={1500} name="storm-islands"><WorldPiece name="storm islands"><StormIslands /></WorldPiece></NearOnly>
      <NearOnly playerRef={player} x={NEON_CITY_CENTER.x} z={NEON_CITY_CENTER.z} radius={300 * NEAR_SCALE[settings.renderTier]} name="city:neon"><NeonCity />{gear && <ResidenceGarages city="neon" progression={{ nexLedger: gear.nexLedger ?? {}, housing: gear.housing, fleet: gear.fleet }} />}</NearOnly>
      {(() => { const rg = REGIONS.find((r) => r.id === "frostspire"); return rg ? <NearOnly playerRef={player} x={rg.x} z={rg.z} radius={(rg.radius + 220) * NEAR_SCALE[settings.renderTier]} name="region:frostspire"><FrostspireDressing /></NearOnly> : null; })()}
      {(() => { const rg = REGIONS.find((r) => r.id === "swamps"); return rg ? <NearOnly playerRef={player} x={rg.x} z={rg.z} radius={(rg.radius + 220) * NEAR_SCALE[settings.renderTier]} name="region:swamps"><SwampDressing /></NearOnly> : null; })()}
      {(() => { const rg = REGIONS.find((r) => r.id === "wastelands"); return rg ? <NearOnly playerRef={player} x={rg.x} z={rg.z} radius={(rg.radius + 220) * NEAR_SCALE[settings.renderTier]} name="region:wastelands"><WastelandsDressing /></NearOnly> : null; })()}
      {(() => { const so = REGIONS.find((r) => r.id === "solara"); return so ? <NearOnly playerRef={player} x={so.x} z={so.z} radius={(so.radius + 220) * NEAR_SCALE[settings.renderTier]} name="region:solara"><SolaraDesert /></NearOnly> : null; })()}
      {(() => { const wl = REGIONS.find((r) => r.id === "wastelands"); return wl ? <NearOnly playerRef={player} x={wl.x} z={wl.z} radius={(wl.radius + 320) * NEAR_SCALE[settings.renderTier]} name="region:badlands"><Badlands shadows={heavyShadows(settings.renderTier)} /></NearOnly> : null; })()}
      {(() => { const em = REGIONS.find((r) => r.id === "ember"); return em ? <NearOnly playerRef={player} x={em.x} z={em.z} radius={(em.radius + 220) * NEAR_SCALE[settings.renderTier]} name="region:ember"><EmberPeaks /><EmberLightning /></NearOnly> : null; })()}
      {LANDMARKS.filter((l) => l.id === "convoy-sprint" || l.id === "smoldering-trench").map((l) => (
        <NearOnly key={l.id} playerRef={player} x={l.x} z={l.z} radius={260 * NEAR_SCALE[settings.renderTier]} name={`set:${l.id}`}>{l.id === "convoy-sprint" ? <WreckField /> : <LavaTrench />}</NearOnly>
      ))}
      <NearOnly playerRef={player} x={THALASSIA_CENTER.x} z={THALASSIA_CENTER.z} radius={260 * NEAR_SCALE[settings.renderTier]} name="city:thalassia"><Thalassia /><ThalassiaSectors descent={descent ?? null} everRestored={!!gear?.completedMissions?.includes("descent-protocol")} /></NearOnly>
      <SupplyLanes sim={sim} />
      <ZoneBeacons sim={sim} />
      <Convoys sim={sim} />
      <group name="enemies"><WarMachines sim={sim} /></group>
      <ScenarioBosses sim={sim} />
      <CombatFx sim={sim} reducedMotion={!!settings.reducedMotion} />
      <AbilityFx sim={sim} reducedMotion={!!settings.reducedMotion} />
      {!settings.reducedMotion && <ShardGainFx shards={gear?.fractureShards} playerRef={player} />}
      <SkylineLookout />
      <Squad sim={sim} />
      {coreNode?.target && <CoreNodePod run={coreNode} />}
      <NullPulseFx sim={sim} tier={settings.renderTier} reducedMotion={!!settings.reducedMotion || (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)} />
      <EncounterFx sim={sim} reducedMotion={!!settings.reducedMotion || (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)} />
      <HazardMarkers sim={sim} />
      <BeaconMarkers sim={sim} />
      {awakening?.target && (awakening.state === "CAPTURE" || awakening.state === "HOLD" || awakening.state === "EXTRACT") && (
        <group position={[awakening.target.x, heightAt(awakening.target.x, awakening.target.z) + 0.2, awakening.target.z]}>
          <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[10, 12, 48]} /><meshBasicMaterial color={awakening.state === "EXTRACT" ? "#7dffca" : "#ff3df2"} transparent opacity={0.6} /></mesh>
          <mesh position={[0, 30, 0]}><cylinderGeometry args={[0.2, 0.2, 60, 6]} /><meshBasicMaterial color={awakening.state === "EXTRACT" ? "#7dffca" : "#ff3df2"} transparent opacity={0.4} /></mesh>
        </group>
      )}
      {mission?.target && (mission.state === "DISCOVERY" || mission.state === "TRAVERSAL") && (
        <group position={[mission.target.x, heightAt(mission.target.x, mission.target.z) + 3, mission.target.z]}>
          <mesh><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#39e6ff" emissive="#39e6ff" emissiveIntensity={3} /></mesh>
          <mesh position={[0, 30, 0]}><cylinderGeometry args={[0.15, 0.15, 60, 6]} /><meshBasicMaterial color={mission.state === "TRAVERSAL" ? "#ff6a3d" : "#39e6ff"} transparent opacity={0.45} /></mesh>
        </group>
      )}
      {relay?.target && relay.state === "WADING" && (
        <group position={[relay.target.x, heightAt(relay.target.x, relay.target.z) + 3, relay.target.z]}>
          <mesh><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#63d6a8" emissive="#63d6a8" emissiveIntensity={3} /></mesh>
          <mesh position={[0, 30, 0]}><cylinderGeometry args={[0.15, 0.15, 60, 6]} /><meshBasicMaterial color="#63d6a8" transparent opacity={0.45} /></mesh>
        </group>
      )}
      {blackout?.target && blackout.state === "INFILTRATION" && (
        <group position={[blackout.target.x, heightAt(blackout.target.x, blackout.target.z) + 3, blackout.target.z]}>
          <mesh><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#38e8ff" emissive="#38e8ff" emissiveIntensity={3} /></mesh>
          <mesh position={[0, 30, 0]}><cylinderGeometry args={[0.15, 0.15, 60, 6]} /><meshBasicMaterial color="#38e8ff" transparent opacity={0.45} /></mesh>
        </group>
      )}
      {neonCore?.target && neonCore.state === "DESCENT" && (
        <group position={[neonCore.target.x, heightAt(neonCore.target.x, neonCore.target.z) + 3, neonCore.target.z]}>
          <mesh><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#ff3df2" emissive="#ff3df2" emissiveIntensity={3} /></mesh>
          <mesh position={[0, 30, 0]}><cylinderGeometry args={[0.15, 0.15, 60, 6]} /><meshBasicMaterial color="#ff3df2" transparent opacity={0.45} /></mesh>
        </group>
      )}
      {solarArray?.target && solarArray.state === "CROSSING" && (
        <group position={[solarArray.target.x, heightAt(solarArray.target.x, solarArray.target.z) + 3, solarArray.target.z]}>
          <mesh><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#ffe8a8" emissive="#ffe8a8" emissiveIntensity={3} /></mesh>
          <mesh position={[0, 30, 0]}><cylinderGeometry args={[0.15, 0.15, 60, 6]} /><meshBasicMaterial color="#ffe8a8" transparent opacity={0.45} /></mesh>
        </group>
      )}
      {coreNode?.target && coreNode.state === "INFILTRATE" && (
        <group position={[coreNode.target.x, heightAt(coreNode.target.x, coreNode.target.z) + 3, coreNode.target.z]}>
          <mesh><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#66e0ff" emissive="#66e0ff" emissiveIntensity={3} /></mesh>
          <mesh position={[0, 30, 0]}><cylinderGeometry args={[0.15, 0.15, 60, 6]} /><meshBasicMaterial color="#66e0ff" transparent opacity={0.45} /></mesh>
        </group>
      )}
      {ZONE_MISSION_IDS.map((id) => {
        const z = zoneRuns?.[id];
        if (!z?.target || z.state !== "TRAVEL") return null;
        const c = ZONE_MISSIONS[id].accent;
        return <group key={id} position={[z.target.x, heightAt(z.target.x, z.target.z) + 3, z.target.z]}>
          <mesh><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={3} /></mesh>
          <mesh position={[0, 30, 0]}><cylinderGeometry args={[0.15, 0.15, 60, 6]} /><meshBasicMaterial color={c} transparent opacity={0.45} /></mesh>
        </group>;
      })}
      {descent?.target && descent.state === "DIVE" && (
        <group position={[descent.target.x, heightAt(descent.target.x, descent.target.z) + 3, descent.target.z]}>
          <mesh><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#5fd8ff" emissive="#5fd8ff" emissiveIntensity={3} /></mesh>
          <mesh position={[0, 30, 0]}><cylinderGeometry args={[0.15, 0.15, 60, 6]} /><meshBasicMaterial color="#5fd8ff" transparent opacity={0.45} /></mesh>
        </group>
      )}
      {systemCore?.target && systemCore.state === "DIVE" && (
        <group position={[systemCore.target.x, heightAt(systemCore.target.x, systemCore.target.z) + 3, systemCore.target.z]}>
          <mesh><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#ff2e4e" emissive="#ff2e4e" emissiveIntensity={3} /></mesh>
          <mesh position={[0, 30, 0]}><cylinderGeometry args={[0.15, 0.15, 60, 6]} /><meshBasicMaterial color="#ff2e4e" transparent opacity={0.45} /></mesh>
        </group>
      )}
      <Bullets sim={sim} />
      <GoreFx sim={sim} level={normalizeGore(settings.gore)} />
      <MuzzleFlash flash={muzzleFlash} />
      <BulletImpacts sim={sim} />
      <WorldMarkers depleted={depleted} />
      <Interior structure={structure} />
      <Interiors />
      <HomeInteriors housing={gear?.housing} nexLedger={gear?.nexLedger} />
      {settings.zoneLabels && <RegionLabels zones={sim.zones} />}

      <NovaDrone held={state} />
      {bonded && <Wyrmling held={state} hurtAt={audioSeen} />}
      <VyrakClueSites />
      {activity && activity.def.stages[0]?.kind === "race" && activity.run.race ? <RaceCourse race={raceById((activity.def.stages[0] as { raceId: string }).raceId)!} run={activity.run.race as RaceRun} /> : null}
      {/* player on foot */}
      <group ref={player} position={SPAWN.toArray()}>
        <OperatorModel colorway held={state} gear={gear} bodyType={bodyType} classId={playerClass} height={OPERATOR_HEIGHT} feetY={-1.6} color={appearance.armor} trim={appearance.visor} cloth={appearance.cloth} look={worn} pose="locomotion" motion={feel.current.motionRef} fallback={
  <group scale={OPERATOR_HEIGHT / 2.75} position={[0, -1.55 * (1 - OPERATOR_HEIGHT / 2.75), 0]}><Operator bodyType={bodyType} armor={appearance.armor} cloth={appearance.cloth} visor={appearance.visor} trim={appearance.trim} classId={playerClass} motion={feel.current.motionRef} visualState={armorState} chestLevel={armorLevels.chest} helmetLevel={armorLevels.helmet} legsLevel={armorLevels.legs} look={worn} /></group>
        } />
        {playerClass === "TITAN" && sim.titan.blocking && (
          // Chevron-angled holographic panels + a glowing rim edge instead of one flat box —
          // reads as a projected energy shield rather than a translucent slab.
          <group position={[0, 1.8, 1.4]}>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.85, 0, -0.35]} rotation={[0, side * -0.42, 0]}>
                <boxGeometry args={[1.9, 4.5, 0.12]} />
                <meshStandardMaterial color="#74dfff" emissive="#3daec7" emissiveIntensity={2.8} transparent opacity={0.45} />
              </mesh>
            ))}
            {[-1, 1].map((side) => (
              <mesh key={`edge${side}`} position={[side * 1.7, 0, -0.7]} rotation={[0, side * -0.42, 0]}>
                <boxGeometry args={[0.05, 4.5, 0.14]} />
                <meshStandardMaterial color="#c7f6ff" emissive="#c7f6ff" emissiveIntensity={4} toneMapped={false} />
              </mesh>
            ))}
          </group>
        )}
        {playerClass === "TITAN" && sim.titan.domeTime > 0 && <mesh position={[0, 0.5, 0]}><sphereGeometry args={[8, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#74dfff" emissive="#2e9ab6" emissiveIntensity={1.5} transparent opacity={0.24} side={THREE.DoubleSide} /></mesh>}
      </group>

      {/* Local first-person arms and rifle; the world avatar remains available for external views. */}
      <group ref={viewmodel} visible={false}>
        <ViewWeapon pose={viewPoseRef} colors={{ armor: appearance.armor, cloth: appearance.cloth, accent: appearance.visor }} />
      </group>

      {/* Titan training arena: three readable cover anchors and one hazardous fracture pool. */}
      {playerClass === "TITAN" && <group position={[SPAWN.x, walkHeight(SPAWN.x, SPAWN.z), SPAWN.z]}>{([[-9, 0], [8, 5], [6, -8]] as const).map(([x, z], index) => <CoverWall key={index} position={[x, 1.5, z]} />)}<mesh position={[-8, 0.12, -10]} rotation-x={-Math.PI / 2}><circleGeometry args={[4, 32]} /><meshStandardMaterial color="#dc7042" emissive="#b84327" emissiveIntensity={2.2} /></mesh></group>}


      {/* drivable wasteland raider — armour plate, ram spikes, roof gun */}
      <group ref={vehicle} visible={vehicleUnlocked}>
        <VehicleDamageFx condition={condition} speedRef={carSpeed} bounds={carBounds} />
        <VehicleBodyDamage condition={condition} seed={hashSeed(vehicleId)} bounds={carBounds} />
        {/* no light of its own: the one headlamp below only switches on while you drive (a parked car's lights were lit pixels all game) */}
        {/* authored fleet model (fleet-models.ts): the active build's own body, paint and cosmetics */}
        <AuthoredVehicle model={playerCarModel.model} paint={playerCarModel.paint} cosmetics={playerCarModel.cosmetics} speedRef={carSpeed} steerRef={carSteer} brakeRef={carBrake} boundsRef={carBounds} lift={-1.9} />
        <pointLight ref={headlamp} visible={false} position={[0, 1.2, 4]} color="#ffe2b0" intensity={16} distance={44} decay={2} />
      </group>

    </>
  );
}

/* The Fracture (the tear in the sky) now lives in the sky dome as the Sky Rift (sky-dome.ts SKY_RIFT, SkyDome.tsx), drawn from the
 * trailer reference (docs/trailer-references.md): diagonal, white-hot seam, shattered-glass cracks and leaking code, violet at the edges.
 * Being part of the dome it hides underwater with the rest of the sky; the old billboard showed through the sea at Thalassia. */

/** Drifting violet/cyan energy motes around the player. */
function Motes() {
  const ref = useRef<THREE.Points>(null);
  const map = useMemo(() => softSprite("dot"), []);
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); const p = new Float32Array(600 * 3); for (let i = 0; i < p.length; i++) p[i] = (Math.random() - 0.5) * (i % 3 === 1 ? 30 : 120); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); return g; }, []);
  useFrame((st) => { if (!ref.current) return; const c = st.camera.position; ref.current.position.set(c.x, c.y + Math.sin(st.clock.elapsedTime * 0.3) * 1.5, c.z); ref.current.rotation.y = st.clock.elapsedTime * 0.02; });
  return <points ref={ref ?? null} geometry={geo}><pointsMaterial map={map ?? null} alphaTest={0.01} color="#9fe9ff" size={0.4} transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></points>;
}


/* ---------------- render isolation ----------------
 * Live profiling (Long Animation Frames, Oct 2026) showed React reconciliation taking ~80% of main-thread time: every HUD
 * update re-rendered GameCanvas, which re-rendered this whole 3D tree. Scene's parent passes fresh callback closures and
 * fresh arrays/objects each render, so a plain memo never hit. The shell below routes every callback prop through a
 * stable forwarder that always calls the latest prop (so useFrame closures never go stale), and the memo compares data
 * props by value one level deep (arrays element-wise, plain objects key-wise). */
type SceneProps = ComponentProps<typeof SceneImpl>;
const shallowSame = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && Object.getPrototypeOf(a) === Object.prototype && Object.getPrototypeOf(b) === Object.prototype) {
    const ka = Object.keys(a as object), kb = Object.keys(b as object);
    return ka.length === kb.length && ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
};
/** secrets.ts conditions from the save and the live clock/weather */
function livingSecretCtx(gear: SceneProps["gear"], night: boolean, storm: boolean): SecretContext {
  return { night, storm, nemesisSlain: (gear?.nemeses ?? []).some((n) => n.status === "SLAIN"), pledged: !!gear?.story?.choices?.[PLEDGE_KEY], earned: gear?.earnedRewards ?? [] };
}

export const scenePropsEqual = (a: Record<string, unknown>, b: Record<string, unknown>): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (!shallowSame(a[k], b[k])) { setterCalls[`scene!=${k}`] = (setterCalls[`scene!=${k}`] ?? 0) + 1; return false; }
  return true;
};
const SceneMemo = memo(SceneImpl, (a, b) => scenePropsEqual(a as Record<string, unknown>, b as Record<string, unknown>));

const NEON_SKY_GLOW = new THREE.Color("#7a5cff"), NEON_GROUND_GLOW = new THREE.Color("#1d5c6e"), HEMI_GROUND = new THREE.Color("#3b3326");
export function Scene(props: SceneProps) {
  const latest = useRef(props);
  latest.current = props;
  const forwarders = useRef<Record<string, (...args: unknown[]) => unknown>>({});
  const routed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === "function") {
      forwarders.current[k] ??= (...args: unknown[]) => ((latest.current as Record<string, unknown>)[k] as ((...a: unknown[]) => unknown) | undefined)?.(...args);
      routed[k] = forwarders.current[k];
    } else routed[k] = v;
  }
  return <SceneMemo {...(routed as SceneProps)} />;
}
