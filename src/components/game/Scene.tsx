import { Environment, Lightformer, Sky, Stars, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { REGIONS, SKY, ZONE_COLOR, clockLabel, phaseFor, regionAt, WORLD_RADIUS } from "@/game/world";
import { useKeyboard } from "@/game/useKeyboard";
import { walkHeight, slopeAt, heightAt, WATER_LEVEL } from "@/game/terrain";
import { alert, applyLightning, collidePlayer, createSim, defeatMachine, FACTIONS, fireBullet, hurtPlayer, throwBeacon, instabilityTier, spawnMissionDrones, stepSim, summonBoss, summonScenarioBoss, type Faction, type InstabilityTier, type WorldSim, type ZoneState } from "@/game/sim";
import type { MissionEvent, MissionRun } from "@/game/missions/broken-signal";
import type { MissionEvent as BlackoutEvent, MissionRun as BlackoutRun } from "@/game/missions/blackout-protocol";
import type { MissionEvent as NeonCoreEvent, MissionRun as NeonCoreRun } from "@/game/missions/stitched-neon-core";
import type { MissionEvent as DescentEvent, MissionRun as DescentRun } from "@/game/missions/descent-protocol";
import type { MissionEvent as SystemCoreEvent, MissionRun as SystemCoreRun } from "@/game/missions/system-core";
import { introCameraAt } from "@/game/intro-camera";
import type { AwakeningEvent, AwakeningRun } from "@/game/missions/awakening";
import { directorTrend, type Mission } from "@/game/director";
import { isStaggered, isWeakPointOpen, POISE_MAX } from "@/game/boss-poise";
import { tuningFor } from "@/game/boss-phases";
import { counterTuningFor, dominantPattern, logAction, type ActionLogEntry, type PlayerAction } from "@/game/boss-adaptive-ai";
import { Terrain } from "./Terrain";
import { CloudLayer, type SkyEnv } from "./CloudLayer";
import { Weather } from "./Weather";
import { weatherName as weatherLabel } from "@/game/weather-cycle";
import { environmentAt, stepEnvironment } from "@/game/environment";
import { backpackFor } from "@/game/backpacks";
import { createReticle, markHit, stepReticle, type Motion, type ReticleView, EMPTY_RETICLE } from "@/game/crosshair";
import { airJump, cameraDrop, cancelSlide, createMoveState, glideVy, GLIDE_THRUST, land, movementFov, resolveStance, startSlide, stepSlide, stepStance, AIR_PROFILE, STANCE_SPEED, SLIDE_SECONDS, type Stance } from "@/game/movement";
import { loadoutEffects } from "@/game/armor-attributes";
import { armorLook } from "@/game/armor-look";
import { createStride, stepStride, RUN_SPEED, type FeelView } from "@/game/movement-feel";
import { updateWind } from "@/game/wind-sway";
import { atmosphereAt, NEUTRAL_ATMOSPHERE, type Atmosphere } from "@/game/atmosphere";
import { closeStratagems, createStratagemState, inputDirection, openStratagems, releaseStratagems, stratagemById, stratagemHud, tickStratagems, type StratagemHud } from "@/game/stratagems";
import { Wildlife } from "./Wildlife";
import { Civilians } from "./Civilians";
import { Bullets, BeaconMarkers, Convoys, HazardMarkers, SupplyLanes, WarMachines, ZoneBeacons } from "./Actors";
import { ScenarioBosses } from "./ScenarioBosses";
import { NullPulseFx } from "./NullPulseFx";
import { Car } from "./Vehicle";
import { NexusCity } from "./NexusCity";
import { NeonCity, NEON_CITY_CENTER } from "./NeonCity";
import { Thalassia, THALASSIA_CENTER } from "./Thalassia";
import { Water } from "./Water";
import { Operator } from "./Operator";
import { OperatorModel } from "./OperatorModel";
import { Interior } from "./Interior";
import { WorldMarkers } from "./WorldMarkers";
import { buildInterior, applyDamage, hitTest, stepDebris, STRUCTURE_MULT } from "@/game/destruction";
import { scenarioById } from "@/game/unique-scenarios";
import { BOSS_LAIRS, SCENARIO_LAIRS, GATHER_RADIUS, LAIR_RADIUS, RESOURCE_SITES, RESPAWN_SECONDS, regionCenter, track, type Marker, type TrackedMarker } from "@/game/waypoints";
import type { InspectorView } from "./Inspector";
import { TIER_RADII } from "@/game/lod";
import { RARITY_COLOR, type Rarity } from "@/game/loot";
import { appearanceById, classById, subclassById, type AppearanceDefinition, type ClassId, type SubclassId } from "@/game/loadout";
import { vehicleById, type VehicleId } from "@/game/vehicles";
import { projectDome, shieldBash } from "@/game/titan";
import { RENDER_PRESETS } from "@/game/performance";
import { branchPosture } from "@/game/branch-effects";
import { activateLiveAbility, createLiveBuild, rebindLiveBuild, tickLiveBuild } from "@/game/live-build";
import { hazardAt, type HazardEffect } from "@/game/region-hazards";
import { RiftTurrets } from "./RiftTurrets";
import { NearOnly } from "./NearOnly";
import { PerfProbe } from "./PerfProbe";
import type { BodyType } from "@/game/operators";
import { SIEGE_BLOOM_MULT, VEIL_BREAK_TIME, siegeMoveMult } from "@/game/operator-abilities";
import type { ActiveBuild } from "@/game/ability-network";
import { buildSynergy } from "@/game/ability-network";
import type { SquadArchetype } from "@/game/adaptation";
import { ADAPTIVE_TUTORIAL_INIT, maybeReteach, recordStruggle } from "@/game/adaptive-tutorial";
import { isValidPlayerState, resetFrameFailureCount, sanitizePlayerState, softFrameFailure } from "@/game/safe-state";
import { difficultyCurve, playerPowerScore } from "@/game/balance";
import type { TutorialEvent, TutorialState } from "@/game/onboarding";
import { OXYGEN_MAX, WATER_DRAG, applyWaterDrag, classifyUnderwaterState, lowOxygenPenalty, oxygenStep, pressureSpeedMultiplier, stepBuoyancy } from "@/game/underwater";
import { underwaterSpread } from "@/game/underwater-combat";
import { heatStatus, stepHeatMeter } from "@/game/heat";
import { shouldForceFootTransition, vehicleDamageStage, VEHICLE_DAMAGE_EFFECT, type VehicleDamageStage } from "@/game/chase-ai";
import { exitVehicleMomentum, parkourChainBonus, vaultLunge } from "@/game/parkour";
import { anySensorSees, detectionStateFor, lockdownStatus, nexusSensors, stepDetectionMeter, stepHackProgress, type DetectionState, type LockdownTier } from "@/game/stealth";
import { INTERIORS, INTERIOR_ALTITUDE, doorAt, atExitMarker, interiorById, isInteriorOpen } from "@/game/interiors";
import { Interiors } from "./Interiors";

import type { GameSettings } from "./SettingsWindow";
import { clampPitch, lookDelta } from "@/game/camera-look";
import { VerdantForest } from "./VerdantForest";
import { CRASH_SITE, ENCOUNTER, NEW_INVESTIGATION, shouldWakePatrol, stepInvestigation } from "@/game/verdant";
import { spawnForestPatrol } from "@/game/forest-encounter";
import { CHECKPOINT_INTERVAL_S, chooseRespawn, isCheckpointSafe } from "@/game/respawn";
import { WEAPONS, WEAPON_ORDER, decay, freshAmmo, type WeaponId } from "@/game/weapons";
import { DEFAULT_BINDINGS, abilityChord, maskChord } from "@/game/bindings";
import type { AbilityHud } from "@/game/ability-effects";
import { abilityHud, cancelAbilities, castAbility, holdDisabledField, syncSimFromLive } from "@/game/ability-effects";
import * as sfx from "@/game/audio";
import { setVoiceLoad } from "@/game/voice-director";
import { RegionLighting } from "./RegionLighting";
import type { ArmorVisualState } from "./Scavenger";
import type { PlayerProgression } from "@/game/progression";

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
  ammo: { id: WeaponId; name: string; mag: number; magSize: number; reserve: number }[];
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
export const SPAWN = new THREE.Vector3(SPAWN_REGION?.x ?? -58, 0, (SPAWN_REGION?.z ?? -34) + 12);
const NEXUS_REGION = REGIONS.find((r) => r.id === "nexus")!;

const stops: { t: number; key: keyof typeof SKY }[] = [
  { t: 0, key: "Dawn" },
  { t: 0.25, key: "Day" },
  { t: 0.5, key: "Sunset" },
  { t: 0.65, key: "Night" },
  { t: 0.85, key: "Moonlight" },
  { t: 1, key: "Dawn" },
];

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
          <Text
            key={r.id}
            position={[r.x, walkHeight(r.x, r.z) + 52, r.z]}
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
        );
      })}
    </group>
  );
}

export function Scene({
  onHud,
  settings = { aimAssist: true, firstPersonDefault: true, zoneLabels: true, hudDensity: "full", renderTier: "HIGH" },
  onCameraPreference,
  playerClass = "TITAN",
  subclassId = "SHIELD_TITAN",
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
  gear,
  mission,
  onMissionEvent,
  blackout,
  onBlackoutEvent,
  neonCore,
  onNeonCoreEvent,
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
}: {
  onHud: (s: HudState) => void;
  settings?: GameSettings;
  onCameraPreference?: (firstPerson: boolean) => void;
  playerClass?: ClassId;
  subclassId?: SubclassId;
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
  gear?: Pick<PlayerProgression, "inventory" | "equippedGear" | "dungeonClears" | "completedMissions">;
  mission?: MissionRun | null;
  onMissionEvent?: (event: MissionEvent) => void;
  blackout?: BlackoutRun | null;
  onBlackoutEvent?: (event: BlackoutEvent) => void;
  neonCore?: NeonCoreRun | null;
  onNeonCoreEvent?: (event: NeonCoreEvent) => void;
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
  travelTo?: { x: number; z: number; nonce: number } | null;
  onCheckpoint?: (p: { x: number; z: number }) => void;
  /** Opening cinematic: while set, the camera follows intro-camera.ts's scripted flythrough
   * instead of the normal player follow-cam — IntroCinematic.tsx's overlay fades out over this
   * same window, so this is the literal "world reveal" the player sees underneath it. */
  introPlayback?: { elapsed: number; totalSeconds: number } | null;
}) {
  const orderRef = useRef(weaponOrder); orderRef.current = weaponOrder;
  const travelSeen = useRef(0);
  const checkpoint = useRef<{ x: number; z: number } | null>(null);
  const checkpointClock = useRef(0);
  const keys = useKeyboard();
  const sim = useMemo<WorldSim>(() => createSim(), []);
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
  const worn = useMemo(() => armorLook({ inventory: gear?.inventory ?? [], equippedGear: gear?.equippedGear ?? {} }), [gear?.inventory, gear?.equippedGear]);
  // Equipped armor-set bonuses (armor-sets.ts): recomputed only when gear changes; the frame loop reads the ref.
  const armorFx = useMemo(() => loadoutEffects({ inventory: gear?.inventory ?? [], equippedGear: gear?.equippedGear ?? {} }), [gear?.inventory, gear?.equippedGear]);
  const armorFxRef = useRef(armorFx);
  armorFxRef.current = armorFx;
  const missionSpawned = useRef("");
  const blackoutSpawned = useRef("");
  const neonCoreSpawned = useRef("");
  const descentSpawned = useRef("");
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
  const appearance = appearanceProp ?? appearanceById("BASTION");
  const selectedClass = classById(playerClass);
  const selectedSubclass = subclassById(subclassId);
  const selectedVehicle = vehicleById(vehicleId);
  const player = useRef<THREE.Group>(null!);
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
  const markerList = (): Marker[] => {
    const now = performance.now();
    const list: Marker[] = [];
    if (awakening?.target) list.push({ id: "m-awakening", kind: "MISSION", label: "Awakening", x: awakening.target.x, z: awakening.target.z, regionId: "nexus" });
    if (mission?.target && mission.state !== "COMPLETE" && mission.state !== "WORLD_UPDATE") list.push({ id: "m-broken-signal", kind: "MISSION", label: "Broken Signal", x: mission.target.x, z: mission.target.z, regionId: "nexus" });
    if (blackout?.target && blackout.state !== "COMPLETE" && blackout.state !== "WORLD_UPDATE") list.push({ id: "m-blackout-protocol", kind: "MISSION", label: "Blackout Protocol", x: blackout.target.x, z: blackout.target.z, regionId: "nexus" });
    if (neonCore?.target && neonCore.state !== "COMPLETE" && neonCore.state !== "WORLD_UPDATE") list.push({ id: "m-stitched-neon-core", kind: "MISSION", label: "Stitched Neon Core", x: neonCore.target.x, z: neonCore.target.z, regionId: "nexus" });
    if (descent?.target && descent.state !== "COMPLETE" && descent.state !== "WORLD_UPDATE") list.push({ id: "m-descent-protocol", kind: "MISSION", label: "Descent Protocol", x: descent.target.x, z: descent.target.z, regionId: "swamps" });
    if (systemCore?.target && systemCore.state !== "COMPLETE" && systemCore.state !== "WORLD_UPDATE") list.push({ id: "m-system-core", kind: "MISSION", label: "The System Core", x: systemCore.target.x, z: systemCore.target.z, regionId: "swamps" });
    for (const m of sim.director.missions) { if (m.state !== "ACTIVE") continue; const c = regionCenter(m.regionId); if (c) list.push({ id: `m-${m.id}`, kind: "MISSION", label: m.name, x: c.x, z: c.z, regionId: m.regionId }); }
    if (!investigation.current.done) list.push({ id: "forest-crash-site", kind: "MISSION", label: CRASH_SITE.label, x: CRASH_SITE.x, z: CRASH_SITE.z, regionId: "veridan" });
    for (const site of RESOURCE_SITES) list.push({ ...site, ready: (depleted.current[site.id] ?? 0) <= now });
    for (const lair of BOSS_LAIRS) list.push(lair);
    for (const lair of SCENARIO_LAIRS) list.push(lair);
    for (const m of sim.machines) if (m.alive && m.boss) list.push({ id: `live-${m.profile}`, kind: "BOSS", label: `${m.profile} (engaged)`, x: m.x, z: m.z, regionId: m.zone });
    if (sim.emergencyQuest.state === "WARNING" || sim.emergencyQuest.state === "ACTIVE") list.push({ id: "eq-boss", kind: "BOSS", label: `EQ · ${sim.emergencyQuest.bossName}`, x: sim.emergencyQuest.x, z: sim.emergencyQuest.z, regionId: sim.emergencyQuest.regionId });
    list.push({ id: "neon-city", kind: "MISSION", label: "Neon City", x: NEON_CITY_CENTER.x, z: NEON_CITY_CENTER.z, regionId: "nexus" });
    list.push({ id: "thalassia", kind: "MISSION", label: "Thalassia (deep dive)", x: THALASSIA_CENTER.x, z: THALASSIA_CENTER.z, regionId: "swamps" });
    return list;
  };
  const moon = useRef<THREE.DirectionalLight>(null!);
  const moonMesh = useRef<THREE.Mesh>(null!);
  const time = useRef(0.28);
  const sunDir = useRef(new THREE.Vector3(0.4, 0.9, 0.3));
  const carSpeed = useRef(0);
  const carSteer = useRef(0);
  const sky = useRef<THREE.Object3D>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  /** stride shared by camera bob, viewmodel sway and the Operator's limbs (movement-feel.ts) */
  const feel = useRef((() => {
    const motion = { phase: 0, intensity: 0, swing: 0.35, lean: 0.04, air: false, stance: "STAND" as Stance, slideT: 0 };
    // Operator reads a ref-shaped `{ current }`, so the same live object is also exposed boxed
    return { stride: createStride(), view: null as FeelView | null, motion, motionRef: { current: motion } };
  })());
  /** class movement kit (movement.ts): air jumps, glide, slide + previous-frame jump/slide key state for edge detection */
  const move = useRef({ state: createMoveState(), jumpHeld: false, slideHeld: false, proneHeld: false });
  const reticle = useRef({ state: createReticle(), view: EMPTY_RETICLE, yaw: 0, pitch: 0, hit: 0, kills: 0, ready: false });
  /** eased regional atmosphere (atmosphere.ts) + scratch colours, so crossing a border blends rather than pops */
  const atmo = useRef({ fogMix: 0, fogScale: 1, lightMix: 0, fogTint: new THREE.Color("#ffffff"), lightTint: new THREE.Color("#ffffff"), hemiBase: new THREE.Color("#9ec8e8") });
  const report = useRef(0);
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
  });

  /** snapshot of every live engine system for the dev inspector */
  const buildInspector = (): InspectorView => {
    const s = state.current;
    if (tutorial && tutorial.step !== tutorialStage.current) {
      tutorialStage.current = tutorial.step;
      if (tutorial.step === "CONTACT" || tutorial.step === "SENTINEL") {
        const count = tutorial.step === "CONTACT" ? 3 : 1;
        for (let i = 0; i < count; i++) {
          const machine = sim.machines.find((candidate) => !candidate.alive);
          if (!machine) continue;
          machine.alive = true; machine.x = s.x + (i - (count - 1) / 2) * 8; machine.z = s.z - 28;
          machine.y = walkHeight(machine.x, machine.z); machine.hp = tutorial.step === "SENTINEL" ? 14 : 3;
           machine.scale = tutorial.step === "SENTINEL" ? 2 : 1; machine.zone = "veridan"; machine.cool = 2; machine.elite = tutorial.step === "SENTINEL"; machine.boss = tutorial.step === "SENTINEL"; machine.profile = tutorial.step === "SENTINEL" ? "Adaptive Sentinel" : "Cyber-Corrupted Drone"; machine.kind = "OVERCLOCKED"; machine.drop = "microCircuits"; machine.kx = 0; machine.kz = 0;
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
  const wish = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const cameraDirection = useMemo(() => new THREE.Vector3(), []);
  const gunModel = useRef<THREE.Group>(null);
  const swordModel = useRef<THREE.Group>(null);
  const viewmodel = useRef<THREE.Group>(null);
  const mouse = useRef({ fire: false, aim: false });
  const padPrev = useRef<boolean[]>([]);
  const keyPrev = useRef<Set<string>>(new Set());
  const padState = useRef({ fire: false, aim: false, connected: false });
  /** hit stop: a ~40-80ms near-freeze on kills and on hits against elites/bosses (weight, not on every auto-fire hit) */
  const hitStopUntil = useRef(0);
  const audioSeen = useRef({ hit: 0, kills: 0, hp: 100, hurtAt: 0, stepT: 1, bossAlive: false, bossX: 0, bossZ: 0 });
  /** last sim.lastDeath timestamp this component has already reacted to — mirrors the audioSeen pattern above */
  const deathSeen = useRef(0);
  useEffect(() => {
    const unlock = () => sfx.unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); sfx.updateEngine(false, "", 0, 0, false); };
  }, []);
  useEffect(() => sfx.setVolume(settings.volume ?? 0.7), [settings.volume]);
  useEffect(() => sfx.setMixVolumes(settings.musicVolume ?? 1, settings.sfxVolume ?? 1), [settings.musicVolume, settings.sfxVolume]);
  const skyColor = useMemo(() => new THREE.Color(), []);
  const fogColor = useMemo(() => new THREE.Color(), []);
  const atmoScratch = useMemo(() => new THREE.Color(), []);
  const deepWater = useMemo(() => new THREE.Color("#0a4f63"), []);
  const underK = useRef(0);
  const instabilityColor = useMemo(() => new THREE.Color("#ff2d55"), []);
  const lightColor = useMemo(() => new THREE.Color(), []);
  const skyEnv = useRef<SkyEnv>({ cloud: 0, tint: new THREE.Color("#ffffff") });
  const { scene, gl } = useThree();

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
    sim.armorResist = armorFxRef.current.resist;
    sim.armorRegen = armorFxRef.current.regen;

    /* ---------------- day / night ---------------- */
    time.current += dt * (held.has("KeyT") ? 0.06 : 0.008);
    const night = nightFactor(time.current);

    blend(time.current, "bottom", skyColor);
    blend(time.current, "fog", fogColor);
    blend(time.current, "light", lightColor);
    scene.background = skyColor.clone();
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(fogColor);

    const theta = (((time.current % 1) + 1) % 1) * Math.PI * 2 - Math.PI / 2;
    if (sun.current) {
      sun.current.position.set(Math.cos(theta) * 140, Math.sin(theta) * 150 + 8, 70);
      sun.current.intensity = Math.max(0, intensityAt(time.current));
      sun.current.color.copy(lightColor);
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
    if (moon.current) moon.current.intensity = 0.15 + night * 0.55;
    if (moonMesh.current) {
      moonMesh.current.position.set(-Math.cos(theta) * 300, -Math.sin(theta) * 280, -140);
      moonMesh.current.visible = night > 0.05;
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
      s.inVehicle = !s.inVehicle;
      // Neon City parkour: hopping out mid-drive keeps a fraction of the car's speed as foot-chase momentum.
      if (wasInVehicle) velocity.set(Math.sin(s.yaw), 0, Math.cos(s.yaw)).multiplyScalar(exitVehicleMomentum(s.vSpeed));
      else velocity.set(0, 0, 0);
      s.vSpeed = 0;
    }
    s.inspectorCool -= dt;
    if (held.has("KeyI") && s.inspectorCool <= 0) {
      s.inspectorCool = 0.35;
      s.showInspector = !s.showInspector;
    }
    s.fps = s.fps * 0.9 + (1 / Math.max(0.001, raw)) * 0.1;

    // Neon City chase system: heat climbs off the same combatHeat signal sim.ts already tracks, decays when disengaged.
    s.heatMeter = stepHeatMeter(s.heatMeter, sim.combatHeat, dt);
    // No separate vehicle-HP pool exists in this codebase — the car's condition is read straight off the shared sim.hp while riding it.
    const vehicleStage = s.inVehicle ? vehicleDamageStage(sim.hp) : "NOMINAL";
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
      const hz = hazardAt({ regionId: s.insideInterior ? null : regionAt(s.x, s.z)?.id ?? null, t: performance.now() / 1000, dt, sheltered: s.inVehicle || !!s.insideInterior, exposure: hazardRef.current.exposure });
      if (hz.warning && hz.warning !== hazardRef.current.warning) alert(sim, hz.warning);
      hazardRef.current = hz;
      if (hz.damagePerSec > 0) { if (sim.hp - hz.damagePerSec * dt <= 1) hurtPlayer(sim, 5, hz.name); else sim.hp -= hz.damagePerSec * dt; }
    }
    // environmental hazards: exposure, lightning, with shelter in interiors / safe zones / the Nexus shield
    {
      const sheltered = Boolean(interior) || here?.kind === "safe" || here?.id === "nexus";
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
      const target: Atmosphere = interior ? NEUTRAL_ATMOSPHERE : atmosphereAt(here?.id, wx?.state, night);
      const a = atmo.current;
      const k = 1 - Math.exp(-0.9 * dt);
      a.fogMix += (target.fogMix - a.fogMix) * k;
      a.fogScale += (target.fogScale - a.fogScale) * k;
      a.lightMix += (target.lightMix - a.lightMix) * k;
      a.fogTint.lerp(atmoScratch.set(target.fogTint), k);
      a.lightTint.lerp(atmoScratch.set(target.lightTint), k);
      if (scene.fog) (scene.fog as THREE.Fog).color.lerp(a.fogTint, a.fogMix);
      scene.background instanceof THREE.Color && scene.background.lerp(a.fogTint, a.fogMix * 0.35);
      if (sun.current) sun.current.color.lerp(a.lightTint, a.lightMix);
      if (hemi.current) hemi.current.color.copy(a.hemiBase).lerp(a.lightTint, a.lightMix * 0.8);
    }
    if (scene.fog instanceof THREE.Fog) {
      const fogK = 1 - Math.exp(-3 * dt);
      // regional air thickness (atmosphere.ts fogScale) scales the weather-driven fog distances
      scene.fog.near += ((25 + visibility * 95) * atmo.current.fogScale - scene.fog.near) * fogK;
      scene.fog.far += ((120 + visibility * 400) * atmo.current.fogScale - scene.fog.far) * fogK;
    }
    // underwater look: diving swaps the horizon for a close, turbid teal murk (eased in and out)
    underK.current += ((s.diving && !interior ? 1 : 0) - underK.current) * (1 - Math.exp(-4 * dt));
    if (underK.current > 0.01 && scene.fog instanceof THREE.Fog) {
      const u = underK.current;
      scene.fog.color.lerp(deepWater, u);
      scene.fog.near += (0.5 - scene.fog.near) * u;
      scene.fog.far += (45 - scene.fog.far) * u;
      if (scene.background instanceof THREE.Color) scene.background.lerp(deepWater, u);
    }
    const cloud = wx?.cloud ?? 0;
    if (sun.current) sun.current.intensity *= 1 - cloud * 0.6;
    if (moon.current) moon.current.intensity *= 1 - cloud * 0.5;

    /* ---------------- sky atmosphere + cloud layer (reacts to day phase + live regional weather) ---------------- */
    skyEnv.current.cloud = cloud;
    skyEnv.current.tint.copy(lightColor).multiplyScalar(1 - cloud * 0.3);
    if (sky.current) {
      const m = (sky.current as unknown as { material?: THREE.ShaderMaterial }).material;
      const u = m?.uniforms;
      if (u) {
        // low sun angle and poor visibility both thicken the haze near the horizon; cloud cover
        // scatters more light too, so an overcast/stormy sky reads hazier and less saturated
        const horizonBoost = Math.max(0, 1 - Math.abs(Math.sin(theta)));
        if (u["turbidity"]) u["turbidity"].value = 3.5 + horizonBoost * 6 + cloud * 5 + (1 - visibility) * 7;
        if (u["rayleigh"]) u["rayleigh"].value = 1.4 + horizonBoost * 1.4 + night * 0.4;
        if (u["mieCoefficient"]) u["mieCoefficient"].value = 0.004 + cloud * 0.01 + (1 - visibility) * 0.01;
        if (u["mieDirectionalG"]) u["mieDirectionalG"].value = 0.8;
      }
    }
    // storm lightning: brief sky-wide flashes
    if (wx?.state === "STORM") {
      lightning.current -= dt;
      if (lightning.current < -2 - Math.random() * 6) lightning.current = 0.18;
      if (lightning.current > 0 && sun.current) { sun.current.intensity += 3.5; sun.current.color.set("#cfe0ff"); }
    }
    // Interiors are flat pocket rooms far outside the terrain's authored bounds, so slope/height/water sampling there would just be noise — treat them as dry, flat, and out of the water entirely.
    const slope = interior ? 0 : slopeAt(s.x, s.z);
    const ground = interior ? INTERIOR_ALTITUDE : walkHeight(s.x, s.z);
    const submerged = interior ? false : heightAt(s.x, s.z) < WATER_LEVEL - 0.2;
    if (submerged && !s.wasSubmerged) sfx.playSplash(Math.min(1, (s.inVehicle ? Math.abs(s.vSpeed) : velocity.length()) / 20));
    s.wasSubmerged = submerged;
    if (!submerged) s.diving = false;
    /* ---------------- oxygen: depletes while diving below the surface, regenerates everywhere else ---------------- */
    s.oxygen = oxygenStep(s.oxygen, dt, s.diving);
    const depth = s.diving ? Math.max(0, WATER_LEVEL - s.y) : 0;
    const oxygenPenalty = lowOxygenPenalty(s.oxygen);
    if (s.diving && s.oxygen <= 0 && Math.random() < dt * 0.6) sim.hp = Math.max(1, sim.hp - 4); // drowning trickle damage, never a hard kill on its own

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
    const equippedWeapon = gear?.inventory.find((item) => item.id === gear.equippedGear[s.inVehicle ? "vehicle" : s.weapon === "HEAVY" ? "heavy" : s.weapon === "PULSE" ? "secondary" : "primary"]);
    const gearPower = equippedWeapon ? 1 + Math.max(0, equippedWeapon.power - 100) / 500 : 1;
    sim.equippedElement = equippedWeapon?.element ?? "KINETIC";
    if (sim.equippedPerk !== equippedWeapon?.perk) sim.nullCharge = { charge: 0, lastTimedAt: -1e9, cooldownUntil: sim.nullCharge.cooldownUntil, lastEventId: sim.nullCharge.lastEventId };
    sim.equippedPerk = equippedWeapon?.perk;
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
    const trigger = held.has("Space") || mouse.current.fire || padState.current.fire;
    const shoot = () => {
      if (!s.inVehicle && wpn.mag > 0) {
        if (s.reload > 0) return;
        if (clip.mag <= 0) { s.burstLeft = 0; if (clip.reserve <= 0) sfx.playDryFire(); startReload(); return; }
      }
      const spread = underwaterSpread((wpn.spread + s.bloom * 0.04) * ((mouse.current.aim || padState.current.aim) ? wpn.adsSpread : 1), s.diving ? depth : 0);
      const yawJ = (Math.random() - 0.5) * 2 * spread;
      const pitchJ = (Math.random() - 0.5) * 2 * spread;
       if (fireBullet(sim, s.x, s.y + (s.inVehicle ? 1.5 : 0.95), s.z, s.yaw + yawJ, s.inVehicle, s.pitch + s.recoil + pitchJ, wpn.damage * gearPower * (1 + armorFxRef.current.weaponDamage), wpn.knock, wpn.heat)) {
        bossActionLog.current = logAction(bossActionLog.current, "RANGED", performance.now() / 1000);
        sfx.playShot(s.inVehicle ? "VEHICLE" : s.weapon);
        s.recoil += wpn.recoil;
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
        const reach = s.combo === 3 ? 8 : 6;
        const dmg = wpn.damage * (s.combo === 3 ? 1.8 : 1);
        for (const enemy of sim.machines) {
          if (!enemy.alive) continue;
          const dx = enemy.x - s.x;
          const dz = enemy.z - s.z;
          const d = Math.hypot(dx, dz);
          if (d > reach * enemy.scale + 1 || dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw) < 0) continue;
          enemy.hp -= dmg;
          enemy.kx += (dx / Math.max(d, 0.1)) * wpn.knock * 8;
          enemy.kz += (dz / Math.max(d, 0.1)) * wpn.knock * 8;
          enemy.cool = Math.max(enemy.cool, 0.6);
          sim.lastHit = performance.now();
           defeatMachine(sim, enemy);
        }
      }
    } else if (!sim.overheated && !(s.inVehicle && vehicleEffect.weaponsDisabled)) {
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
       const maxSpeed = 62 * biomeGrip * (boost ? 1.5 : 1) * sim.mods.vehicleSpeed * selectedVehicle.speed * (vehicleGear ? 1 + vehicleGear.level * 0.04 : 1) * vehicleEffect.speedMult;
      const accel = 52 * traction * selectedVehicle.speed * vehicleEffect.speedMult;
      if (throttleF) s.vSpeed += accel * dt;
      else if (throttleB) s.vSpeed -= accel * 0.8 * dt;
      else s.vSpeed *= Math.exp(-1.4 * dt);
      // drag + grade resistance climbing hills
      s.vSpeed *= Math.exp(-(0.22 + slope * 1.6) * dt);
      s.vSpeed = THREE.MathUtils.clamp(s.vSpeed, -18, maxSpeed);

      const steerRate = 1.5 * traction * selectedVehicle.handling * vehicleEffect.handlingMult * THREE.MathUtils.clamp(Math.abs(s.vSpeed) / 14, 0.15, 1);
      if (left) s.yaw += steerRate * dt * Math.sign(s.vSpeed || 1);
      if (right) s.yaw -= steerRate * dt * Math.sign(s.vSpeed || 1);

      s.x += Math.sin(s.yaw) * s.vSpeed * dt;
      s.z += Math.cos(s.yaw) * s.vSpeed * dt;
    } else {
      // Mouse-look sets the facing direction; WASD stays relative to it.
      wish.set(0, 0, 0);
      if (throttleF) { wish.x += Math.sin(s.yaw); wish.z += Math.cos(s.yaw); }
      if (throttleB) { wish.x -= Math.sin(s.yaw); wish.z -= Math.cos(s.yaw); }
      if (left) { wish.x += Math.sin(s.yaw + Math.PI / 2); wish.z += Math.cos(s.yaw + Math.PI / 2); }
      if (right) { wish.x += Math.sin(s.yaw - Math.PI / 2); wish.z += Math.cos(s.yaw - Math.PI / 2); }
      // Neon City parkour: chaining vaults within the window nets a small, capped speed bonus.
      const chainBonus = parkourChainBonus(s.chainCount, performance.now() / 1000 - s.lastVaultAt);
      const mvs = move.current;
      const crouchKey = held.has(binds.keyboard.crouch) || !!padNow[binds.gamepad.crouch];
      const proneKey = held.has(binds.keyboard.prone) || !!padNow[binds.gamepad.prone];
      if (proneKey && !mvs.proneHeld) mvs.state.prone = !mvs.state.prone;
      mvs.proneHeld = proneKey;
      const stance = resolveStance(mvs.state, { crouchHeld: crouchKey, sprinting: boost, jumping: held.has("KeyC"), grounded: s.grounded, sliding: mvs.state.slideLeft > 0, swimming: s.diving || submerged });
      stepStance(mvs.state, dt);
      const sprint = boost && stance === "STAND";
      const walk = 30 * traction * (sprint ? 2.1 : 1) * STANCE_SPEED[stance] * (1 + armorFxRef.current.moveSpeed) * sim.mods.footSpeed * (live.current.dashTime > 0 ? 1.4 : 1) * siegeMoveMult(live.current.siegeTime) * (1 + chainBonus);
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
      if (s.diving) {
        // swimming toward where you're looking: pitch steers you up/down, and the response is floatier than land movement
        const swimPitch = (throttleF ? 1 : throttleB ? -1 : 0) * Math.sin(s.pitch);
        s.vy = THREE.MathUtils.clamp(s.vy + swimPitch * walk * 0.18 * dt, -4.5, 4.5);
        velocity.lerp(wish, 1 - Math.exp(-6 * dt));
      } else {
        velocity.lerp(wish, 1 - Math.exp(-14 * dt));
      }
      s.x += velocity.x * dt;
      s.z += velocity.z * dt;
      if (tutorial?.step === "MOVEMENT") { const travel = Math.hypot(s.x - SPAWN.x, s.z - SPAWN.z); if (travel >= (lastGate.current + 1) * 10 && lastGate.current < 3) { lastGate.current++; onTutorialEvent?.("GATE"); } }
    }

    /* ---------------- interiors: walk up to a door to go in, walk up to the exit marker to come back out ---------------- */
    if (!interior && !s.inVehicle) {
      const door = doorAt(s.x, s.z);
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
      const localX = s.x - interior.origin.x;
      const localZ = s.z - interior.origin.z;
      if (atExitMarker(interior, localX, localZ)) {
        const back = s.interiorReturnPos;
        s.insideInterior = null;
        interior = null;
        if (back) { s.x = back.x; s.y = back.y; s.z = back.z; }
        s.interiorReturnPos = null;
        s.vy = 0;
        s.grounded = true;
        velocity.set(0, 0, 0);
      }
    }

    // world bounds — skipped inside a pocket-dimension interior, which lives far outside WORLD_RADIUS by design
    if (!interior) {
      const d = Math.hypot(s.x, s.z);
      if (d > WORLD_RADIUS - 6) {
        s.x *= (WORLD_RADIUS - 6) / d;
        s.z *= (WORLD_RADIUS - 6) / d;
        s.vSpeed *= 0.3;
      }
    }

    /* ---------------- collisions (physics before sim) ---------------- */
    const preCollideSpeed = s.vSpeed;
    const body = { x: s.x, z: s.z, yaw: s.yaw, vSpeed: s.vSpeed, inVehicle: s.inVehicle };
    collidePlayer(sim, body);
    s.x = body.x;
    s.z = body.z;
    s.vSpeed = body.vSpeed;

    // Neon City vehicle-combat: a wreck-level car forces you out on foot; a heavily damaged one only does when the collision actually stopped it.
    if (s.inVehicle) {
      const blocked = Math.abs(preCollideSpeed) > 4 && Math.abs(s.vSpeed) < Math.abs(preCollideSpeed) * 0.4;
      if (shouldForceFootTransition(vehicleStage, blocked)) {
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
      if (Math.hypot(s.x - structure.lastCollapse.x, s.z - structure.lastCollapse.z) < 6) sim.hp = Math.max(1, sim.hp - 12);
      structure.lastCollapse = { ...structure.lastCollapse, t: 0 };
    }

    /* ---------------- resource gathering + boss lairs ---------------- */
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
      // Unique Scenario lairs (Rime Alpha, Dark Knight, ...): same walk-in trigger, but they summon the scenario boss
      for (const lair of SCENARIO_LAIRS) {
        const inside = Math.hypot(lair.x - s.x, lair.z - s.z) < LAIR_RADIUS;
        const scenario = scenarioById(lair.scenarioId);
        if (inside && scenario && !lairsTriggered.current[lair.id] && !tutorial && !sim.machines.some((m) => m.alive && m.boss)) { lairsTriggered.current[lair.id] = true; summonScenarioBoss(sim, scenario, lair.x, lair.z); }
        if (!inside && Math.hypot(lair.x - s.x, lair.z - s.z) > LAIR_RADIUS * 4) lairsTriggered.current[lair.id] = false;
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
      }
      if (sim.kills > a.kills) { sfx.playKill(false, {}); hitStopUntil.current = Math.max(hitStopUntil.current, performance.now() + 70); s.punch += 0.6; }
      a.kills = sim.kills;
      const now = performance.now();
      if (sim.hp < a.hp - 0.5 && now - a.hurtAt > 250) { sfx.playHurt(); a.hurtAt = now; }
      a.hp = sim.hp;
      // Boss-fight audio: track the engaged boss's last known position so a sudden "alive -> not
      // alive" edge (it just died) can play a real explosion there instead of the ordinary kill
      // chime, and so the combat mix knows to run its distinct boss-fight pattern while one's up.
      const liveBoss = sim.machines.find((m) => m.alive && m.boss);
      if (liveBoss) { a.bossAlive = true; a.bossX = liveBoss.x; a.bossZ = liveBoss.z; }
      else if (a.bossAlive) { a.bossAlive = false; sfx.playExplosion(true, sfx.where(s.x, s.z, s.yaw, a.bossX, a.bossZ)); }
      sfx.updateCombatAudio(Math.min(1, sim.combatHeat / 100), Boolean(liveBoss));
      sfx.updateBiomeAmbient(here?.id ?? "");
      sfx.updateWeatherAmbient(weather);
      // interiors keep their home region's music (a pocket room isn't its own "place"), so the score doesn't drop to silence indoors
      sfx.updateMusicRegion(interior ? interior.regionId : here?.id ?? "");
      for (const shot of sim.enemyShots.splice(0)) sfx.playEnemyShot(shot.kind, shot.boss || shot.elite, sfx.where(s.x, s.z, s.yaw, shot.x, shot.z));
      for (const flare of sim.bossPhaseFlares.splice(0)) { sfx.playBossPhaseChange(flare.phase); s.punch += 1.4 + flare.phase * 0.6; }
      for (const event of sim.xpEvents.splice(0)) onXP?.(event);
      const speedNow = velocity.length();
      if (!s.inVehicle && speedNow > 3 && s.y - walkHeight(s.x, s.z) < 1.9) {
        a.stepT -= dt * (speedNow / 30) * 2.4;
        if (a.stepT <= 0) { a.stepT = 1; const rid = here?.id; sfx.playFootstep(interior ? "HARD" : submerged ? "WATER" : rid === "frostspire" ? "SNOW" : rid === "solara" ? "SAND" : rid === "nexus" ? "HARD" : "GRASS", held.has("ShiftLeft") || held.has("ShiftRight")); }
      }
      const fwd = held.has("KeyW") || held.has("ArrowUp"), rev = held.has("KeyS") || held.has("ArrowDown");
      sfx.updateEngine(s.inVehicle, vehicleId, Math.min(1, Math.abs(s.vSpeed) / 45), fwd || rev ? 1 : 0, rev && s.vSpeed > 2);
    }

    /* ---------------- Mission 01 · Broken Signal world triggers ---------------- */
    if (mission && onMissionEvent) {
      if (mission.state === "TRIGGERED" && !mission.target) onMissionEvent({ type: "ANCHOR", x: s.x + Math.sin(s.yaw) * 40, z: s.z + Math.cos(s.yaw) * 40 });
      if ((mission.state === "DISCOVERY" || mission.state === "TRAVERSAL") && mission.target && Math.hypot(mission.target.x - s.x, mission.target.z - s.z) < 8) onMissionEvent({ type: "ARRIVED" });
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

    /* ---------------- Mission 04 · Descent Protocol world triggers ---------------- */
    if (descent && onDescentEvent) {
      if (descent.state === "TRIGGERED" && !descent.target) onDescentEvent({ type: "ANCHOR", x: THALASSIA_CENTER.x, z: THALASSIA_CENTER.z });
      if (descent.state === "DIVE" && descent.target && Math.hypot(descent.target.x - s.x, descent.target.z - s.z) < 18) onDescentEvent({ type: "ARRIVED" });
      if (descent.state === "COMBAT_1" && descentSpawned.current !== "COMBAT_1" && descentSpawned.current !== "COMBAT_1-done") {
        descentSpawned.current = "COMBAT_1";
        spawnMissionDrones(sim, s.x, s.z, 4, false);
      }
      if (descent.state === "COMBAT_1" && descentSpawned.current === "COMBAT_1" && !sim.machines.some((m) => m.alive && m.mission)) { descentSpawned.current = "COMBAT_1-done"; onDescentEvent({ type: "CLEAR" }); }
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
    const { playerInstability } = stepSim(sim, {
      dt,
      px: s.x,
      pz: s.z,
      night,
      inVehicle: s.inVehicle,
    });
    // Hull-destroyed respawn: hurtPlayer() (sim.ts) already resets hp/cargo and stamps sim.lastDeath, but
    // it can't touch the player's world position — that lives here in Scene's own state, not in WorldSim.
    // Detect the new timestamp and do the part sim.ts's alert text always claimed but never performed:
    // teleport back to Nexus City, bail out of any vehicle/interior, and zero out momentum.
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
    if (travelTo && travelTo.nonce !== travelSeen.current) {
      travelSeen.current = travelTo.nonce;
      s.x = travelTo.x; s.z = travelTo.z; s.y = walkHeight(s.x, s.z) + 1.6; s.vy = 0; s.vSpeed = 0; s.inVehicle = false; s.insideInterior = null; interior = null; velocity.set(0, 0, 0);
    }
    if (sim.lastDeath !== deathSeen.current) {
      deathSeen.current = sim.lastDeath;
      live.current = cancelAbilities(sim, live.current, { x: s.x, z: s.z, yaw: s.yaw });
      const spot = chooseRespawn({ x: s.x, z: s.z }, checkpoint.current, hostiles);
      alert(sim, `Respawned at ${spot.label} — away from active combat`);
      s.x = spot.x;
      s.z = spot.z;
      s.y = walkHeight(s.x, s.z) + 1.6;
      s.vy = 0;
      s.vSpeed = 0;
      s.grounded = true;
      s.diving = false;
      s.inVehicle = false;
      s.insideInterior = null;
      s.interiorReturnPos = null;
      interior = null;
      velocity.set(0, 0, 0);
      sfx.playDeath();
    }
    // Zones already toss the player around above 0.6 instability (below); this is the visual half of
    // that same signal — the fog bleeds toward red and the sun flickers as a fracturing zone gets worse,
    // instead of the instability being felt only through physics with no on-screen cue at all.
    if (scene.fog instanceof THREE.Fog && playerInstability > 0.2) {
      const bleed = Math.min(1, (playerInstability - 0.2) / 0.6);
      scene.fog.color.lerp(instabilityColor, bleed * 0.35);
    }
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
    const standY = (interior ? INTERIOR_ALTITUDE : walkHeight(s.x, s.z)) + (s.inVehicle ? 1.9 : 1.6);
    if (!s.inVehicle && submerged && (s.diving || held.has("KeyZ"))) {
      // Thalassia-style underwater vertical control: KeyC kicks up, KeyZ dives down, otherwise buoyancy carries you toward the surface.
      s.diving = true;
      const descend = held.has("KeyZ");
      const ascend = held.has("KeyC");
      if (ascend) s.vy = Math.min(4.5, s.vy + 9 * dt);
      if (descend) s.vy = Math.max(-4.5, s.vy - 9 * dt);
      s.vy = applyWaterDrag(stepBuoyancy(s.vy, dt, descend), WATER_DRAG.vertical, dt);
      s.y += s.vy * dt;
      // Diving follows the true seabed; walkHeight is surface-clamped for ordinary walkers.
      const floor = heightAt(s.x, s.z) + 1.1;
      if (s.y < floor) { s.y = floor; s.vy = 0; }
      if (s.y > WATER_LEVEL + 1.5) { s.diving = false; s.grounded = false; s.vy = 0; }
    } else if (s.grounded || (submerged && !s.diving)) {
      if (!s.inVehicle && held.has("KeyC") && s.grounded && !submerged) {
        // Neon City parkour: a running jump vaults further and a little higher — momentum-based since the world's collision is radius-based, not mesh-accurate.
        const lunge = vaultLunge(velocity.length(), Math.sqrt(2 * sim.gravity * 6.5));
        s.vy = lunge.verticalBoost;
        if (lunge.forwardBoost > 0 && velocity.lengthSq() > 0.01) velocity.addScaledVector(velocity.clone().normalize(), lunge.forwardBoost);
        const nowSec = performance.now() / 1000;
        s.chainCount = nowSec - s.lastVaultAt < 1.4 ? s.chainCount + 1 : 1;
        s.lastVaultAt = nowSec;
        s.grounded = false;
        if (tutorial?.step === "MOVEMENT") onTutorialEvent?.("JUMP");
      } else {
        s.y = THREE.MathUtils.lerp(s.y, standY, 1 - Math.exp(-14 * dt));
        s.grounded = true;
        land(move.current.state, playerClass);
        move.current.jumpHeld = held.has("KeyC");
      }
    } else {
      if (!s.inVehicle && !submerged && !interior) {
        // class air mobility: tap jump again for an air jump; Warlocks hold jump to glide (movement.ts)
        const mv = move.current;
        const jumpHeld = held.has("KeyC");
        if (jumpHeld && !mv.jumpHeld) {
          const mult = airJump(mv.state, playerClass);
          if (mult !== null) { s.vy = Math.sqrt(2 * sim.gravity * 6.5) * mult; s.punch += 0.15; sfx.playReload("end"); }
        }
        mv.jumpHeld = jumpHeld;
        const before = s.vy;
        s.vy = glideVy(s.vy, playerClass, jumpHeld);
        if (AIR_PROFILE[playerClass].glide && jumpHeld && s.vy !== before) { velocity.x += Math.sin(s.yaw) * GLIDE_THRUST * dt; velocity.z += Math.cos(s.yaw) * GLIDE_THRUST * dt; }
      }
      s.vy -= sim.gravity * dt;
      s.y += s.vy * dt;
      if (s.y <= standY) {
        s.y = standY;
        s.vy = 0;
        s.grounded = true;
        land(move.current.state, playerClass);
      }
    }
    // fracture instability tosses loose objects (and you) around
    if (playerInstability > 0.6 && s.grounded && !s.diving && Math.random() < playerInstability * dt * 1.2) {
      s.vy = 6 + playerInstability * 10;
      s.grounded = false;
    }
    void ground;

    carSpeed.current = s.inVehicle ? s.vSpeed : 0;
    carSteer.current = s.inVehicle ? (left ? 0.4 : right ? -0.4 : 0) : 0;

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
        v.rotation.y = s.yaw;
        v.rotation.x = -slopeAt(s.x, s.z) * 0.25;
      } else {
        // parked at the spawn pad when on foot
        v.position.set(SPAWN.x + 8, walkHeight(SPAWN.x + 8, SPAWN.z + 6) + 1.9, SPAWN.z + 6);
        v.rotation.set(0, 0.6, 0);
        v.visible = vehicleUnlocked;
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
        f.motion.phase = f.view.phase; f.motion.intensity = f.view.intensity; f.motion.swing = f.view.swing; f.motion.lean = f.view.lean; f.motion.air = !s.grounded && !s.diving; f.motion.stance = move.current.state.stance; f.motion.slideT = move.current.state.slideLeft > 0 ? 1 - move.current.state.slideLeft / SLIDE_SECONDS : -1;
      }
      const override = !s.inVehicle && (s.meleeTime > 0 || s.specialTime > 0);
      const targetBlend = override || !s.firstPerson ? 1 : 0;
      s.cameraBlend += (targetBlend - s.cameraBlend) * (1 - Math.exp(-15 * dt));
      const shoulder = s.inVehicle ? 0 : 1.3;
      const distance = s.inVehicle ? 14 : 5.8;
      camTarget.set(
        s.x + Math.sin(s.yaw) * (s.inVehicle ? 1 : 0.15) + (Math.cos(s.yaw) * shoulder - Math.sin(s.yaw) * distance) * s.cameraBlend,
        s.y + (s.inVehicle ? 1.5 : 0.95) + (s.inVehicle ? 5 : 2.2) * s.cameraBlend,
        s.z + Math.cos(s.yaw) * (s.inVehicle ? 1 : 0.15) + (-Math.sin(s.yaw) * shoulder - Math.cos(s.yaw) * distance) * s.cameraBlend,
      );
      camTarget.y = Math.max(camTarget.y, (interior ? INTERIOR_ALTITUDE : walkHeight(camTarget.x, camTarget.z)) + 1.35) - cameraDrop(move.current.state);
      camera.position.lerp(camTarget, 1 - Math.exp(-18 * dt));
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
        if (gunModel.current) { gunModel.current.visible = WEAPONS[s.weapon].kind === "gun"; gunModel.current.position.z = Math.min(0.35, s.punch * 0.06); gunModel.current.rotation.x = s.recoil * 3; const fv = feel.current.view; if (fv) { gunModel.current.position.y = fv.bobY * 0.9; gunModel.current.position.x = fv.swayX * 1.4; gunModel.current.rotation.z = Math.sin(fv.phase) * 0.03 * fv.intensity; } }
        if (swordModel.current) { swordModel.current.visible = WEAPONS[s.weapon].kind === "sword"; const t = s.swing / 0.3; swordModel.current.rotation.z = (s.combo % 2 ? 1 : -1) * (t > 0 ? (1 - t) * 2.4 - 1.2 : -0.35); }
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
      onHud({
        region: interior ? interior.name : here?.name ?? "Open Wilds",
        sub: interior ? (interior.kind === "SHOP" ? (isInteriorOpen(interior, time.current) ? "Shop — open" : "Shop — closed for the night") : "Private residence") : here?.sub ?? "Unclaimed / no cover",
        kind: interior ? "safe" : here?.kind ?? "war",
        difficulty: interior ? 0 : here?.difficulty ?? 2,
        rules: interior ? ["Indoors — hostiles can't follow", "Walk to the door to head back out"] : here?.rules ?? ["No stability field", "AI patrols roam freely"],
        phase: phaseFor(time.current),
        clock: clockLabel(time.current),
        speed: Math.round(s.inVehicle ? Math.abs(s.vSpeed) * 2.4 : velocity.length() * 2.4),
        mode: s.inVehicle ? "vehicle" : "foot",
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
        ammo: orderRef.current.map((id) => ({ id, name: WEAPONS[id].name, mag: s.ammo[id].mag, magSize: WEAPONS[id].mag, reserve: s.ammo[id].reserve })),
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
        markers: track(markerList(), s.x, s.z, s.yaw),
        px: s.x, pz: s.z, yaw: s.yaw,
        diving: s.diving,
        oxygen: Math.round(s.oxygen),
        depth: Math.round(depth),
        underwaterState: classifyUnderwaterState({ submerged, depth, oxygen: s.oxygen, boosting: boost }),
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
      });
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
      <fog attach="fog" args={["#5f9aa3", 70, 430]} />
      <FracturePortal />
      <Motes />
      <hemisphereLight ref={hemi} args={["#9ec8e8", "#3b3326", 0.85]} />
      <directionalLight
        ref={sun}
        position={[80, 140, 70]}
        intensity={1.6}
        castShadow={RENDER_PRESETS[settings.renderTier].shadows}
        shadow-mapSize-width={settings.renderTier === "ULTRA" ? 4096 : settings.renderTier === "HIGH" ? 2048 : 1024}
        shadow-mapSize-height={settings.renderTier === "ULTRA" ? 4096 : settings.renderTier === "HIGH" ? 2048 : 1024}
        shadow-bias={-0.0018}
        shadow-camera-left={-130}
        shadow-camera-right={130}
        shadow-camera-top={130}
        shadow-camera-bottom={-130}
        shadow-camera-far={520}
      />
      <directionalLight ref={moon} position={[-90, 110, -70]} color="#9fc4ff" intensity={0.3} />
      <mesh ref={moonMesh} position={[-200, 200, -140]}>
        <sphereGeometry args={[14, 24, 24]} />
        <meshBasicMaterial color="#eaf2ff" toneMapped={false} />
      </mesh>
      <Sky
        ref={sky as unknown as React.Ref<never>}
        distance={4000}
        sunPosition={[120, 90, 60]}
        turbidity={5}
        rayleigh={2.4}
        mieCoefficient={0.006}
        mieDirectionalG={0.82}
      />
      <Stars radius={420} depth={90} count={1800} factor={7} fade speed={0.6} />
      <CloudLayer envRef={skyEnv} />
      <RegionLighting playerRef={player} tier={settings.renderTier} />

      <Terrain renderTier={settings.renderTier} />
      <VerdantForest density={settings.renderTier === "LOW" ? 0.5 : settings.renderTier === "MEDIUM" ? 0.75 : 1} models={settings.renderTier !== "LOW"} investigation={investigation} />
      <RiftTurrets sim={sim} />
      <PerfProbe />
      <Weather playerRef={player} weatherRef={weatherKind} fxRef={weatherFx} />
      <Wildlife playerRef={player} />
      <Civilians playerRef={player} />
      <Water size={WORLD_RADIUS * 4} sunRef={sunDir} />
      <NearOnly playerRef={player} x={NEXUS_REGION.x} z={NEXUS_REGION.z} radius={330}><NexusCity sim={sim} /></NearOnly>
      <NearOnly playerRef={player} x={NEON_CITY_CENTER.x} z={NEON_CITY_CENTER.z} radius={300}><NeonCity /></NearOnly>
      <NearOnly playerRef={player} x={THALASSIA_CENTER.x} z={THALASSIA_CENTER.z} radius={260}><Thalassia /></NearOnly>
      <SupplyLanes sim={sim} />
      <ZoneBeacons sim={sim} />
      <Convoys sim={sim} />
      <WarMachines sim={sim} />
      <ScenarioBosses sim={sim} />
      <NullPulseFx sim={sim} tier={settings.renderTier} reducedMotion={!!settings.reducedMotion || (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)} />
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
      <WorldMarkers depleted={depleted} />
      <Interior structure={structure} />
      <Interiors />
      {settings.zoneLabels && <RegionLabels zones={sim.zones} />}

      {/* player on foot */}
      <group ref={player} position={SPAWN.toArray()}>
        <OperatorModel bodyType={bodyType} classId={playerClass} height={2.75} feetY={-1.55} color={appearance.armor} cloth={appearance.cloth} look={worn} pose="locomotion" motion={feel.current.motionRef} fallback={
  <Operator bodyType={bodyType} armor={appearance.armor} cloth={appearance.cloth} visor={appearance.visor} trim={appearance.trim} classId={playerClass} motion={feel.current.motionRef} visualState={armorState} chestLevel={armorLevels.chest} helmetLevel={armorLevels.helmet} legsLevel={armorLevels.legs} look={worn} />
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
        <mesh position={[0.52, -0.54, -1.05]} rotation={[0.25, -0.16, 0.2]}>
          <boxGeometry args={[0.27, 0.3, 0.85]} />
          <meshStandardMaterial color={appearance.armor} metalness={0.6} roughness={0.45} depthTest={false} />
        </mesh>
        <mesh position={[-0.36, -0.62, -1.02]} rotation={[0.2, 0.15, -0.25]}>
          <boxGeometry args={[0.25, 0.27, 0.7]} />
          <meshStandardMaterial color={appearance.cloth} roughness={0.8} depthTest={false} />
        </mesh>
        <group ref={gunModel}>
        <mesh position={[0.32, -0.39, -1.45]}>
          <boxGeometry args={[0.3, 0.23, 1.55]} />
          <meshStandardMaterial color={appearance.armor} metalness={0.75} roughness={0.32} depthTest={false} />
        </mesh>
        <mesh position={[0.32, -0.37, -2.38]}>
          <boxGeometry args={[0.11, 0.11, 0.55]} />
          <meshStandardMaterial color={appearance.visor} emissive={appearance.visor} emissiveIntensity={0.3} depthTest={false} />
        </mesh>
        </group>
        <group ref={swordModel} position={[0.45, -0.45, -1.2]} visible={false}>
          <mesh position={[0, 0.9, -0.2]} rotation-x={-0.5}>
            <boxGeometry args={[0.07, 1.8, 0.16]} />
            <meshStandardMaterial color={appearance.visor} emissive={appearance.visor} emissiveIntensity={0.8} metalness={0.9} roughness={0.2} depthTest={false} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.36, 0.08, 0.12]} />
            <meshStandardMaterial color={appearance.armor} metalness={0.7} roughness={0.4} depthTest={false} />
          </mesh>
        </group>
      </group>

      {/* Titan training arena: three readable cover anchors and one hazardous fracture pool. */}
      {playerClass === "TITAN" && <group position={[SPAWN.x, walkHeight(SPAWN.x, SPAWN.z), SPAWN.z]}>{([[-9, 0], [8, 5], [6, -8]] as const).map(([x, z], index) => <mesh key={index} position={[x, 1.5, z]} castShadow><boxGeometry args={[4.5, 3, 1.3]} /><meshStandardMaterial color="#46515a" metalness={0.65} roughness={0.55} /></mesh>)}<mesh position={[-8, 0.12, -10]} rotation-x={-Math.PI / 2}><circleGeometry args={[4, 32]} /><meshStandardMaterial color="#dc7042" emissive="#b84327" emissiveIntensity={2.2} /></mesh></group>}


      {/* drivable wasteland raider — armour plate, ram spikes, roof gun */}
      <group ref={vehicle} visible={vehicleUnlocked}>
        <Car body={selectedVehicle.model} scale={selectedVehicle.modelScale} speedRef={carSpeed} steerRef={carSteer} />
        {/* front ram spikes */}
        {[-1.1, -0.55, 0, 0.55, 1.1].map((x) => (
          <mesh key={x} position={[x, 0.8, 3.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[0.16, 1.5, 6]} />
            <meshStandardMaterial color="#6b5b45" metalness={0.65} roughness={0.7} />
          </mesh>
        ))}
        {/* bull bar */}
        <mesh position={[0, 1, 3.1]} castShadow>
          <boxGeometry args={[2.9, 0.35, 0.3]} />
          <meshStandardMaterial color="#4a4238" metalness={0.55} roughness={0.75} />
        </mesh>
        {/* side armour skirts */}
        <mesh position={[-1.5, 1, 0]} castShadow>
          <boxGeometry args={[0.22, 0.9, 4.4]} />
          <meshStandardMaterial color="#8d7c58" metalness={0.3} roughness={0.8} />
        </mesh>
        <mesh position={[1.5, 1, 0]} castShadow>
          <boxGeometry args={[0.22, 0.9, 4.4]} />
          <meshStandardMaterial color="#8d7c58" metalness={0.3} roughness={0.8} />
        </mesh>
        {/* roof cargo rack */}
        <mesh position={[0, 2.7, -0.6]} castShadow>
          <boxGeometry args={[2.4, 0.18, 2.6]} />
          <meshStandardMaterial color="#5a5040" metalness={0.4} roughness={0.85} />
        </mesh>
        {/* pintle-mounted gun */}
        <mesh position={[0, 3, 0.4]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 0.5, 8]} />
          <meshStandardMaterial color="#2a2e33" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, 3.2, 1.6]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 2.6, 8]} />
          <meshStandardMaterial color="#1d2226" metalness={0.85} roughness={0.3} />
        </mesh>
        <pointLight position={[0, 1.2, 4]} color="#ffe2b0" intensity={16} distance={44} decay={2} />
      </group>

    </>
  );
}

/** Swirling fracture rift hanging in the sky with orbiting shards — the reference art's signature. */
function FracturePortal() {
  const g = useRef<THREE.Group>(null);
  const rings = useMemo(() => [0, 1, 2, 3].map((i) => ({ r: 34 + i * 13, c: i % 2 ? "#8e7dff" : "#5ff2ff", o: 0.5 - i * 0.09 })), []);
  const shards = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ a: (i / 18) * Math.PI * 2, r: 50 + (i % 4) * 14, s: 3 + (i % 3) * 2.5, y: (i % 5) * 6 - 12 })), []);
  useFrame((st, dt) => {
    if (!g.current) return;
    g.current.position.set(st.camera.position.x, 190, st.camera.position.z - 420);
    g.current.children.forEach((c, i) => { c.rotation.z += dt * (i < rings.length ? 0.12 + i * 0.05 : 0.05) * (i % 2 ? -1 : 1); });
  });
  return <group ref={g}>
    {rings.map((r, i) => <mesh key={i}><torusGeometry args={[r.r, 3.5 + i, 8, 96]} /><meshBasicMaterial color={r.c} transparent opacity={r.o} fog={false} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>)}
    <group>{shards.map((sh, i) => <mesh key={i} position={[Math.cos(sh.a) * sh.r, Math.sin(sh.a) * sh.r + sh.y, 6]} rotation={[sh.a, sh.a * 2, sh.a]}><tetrahedronGeometry args={[sh.s]} /><meshBasicMaterial color="#1a2330" fog={false} /></mesh>)}</group>
    <mesh position={[0, 0, -4]}><circleGeometry args={[30, 48]} /><meshBasicMaterial color="#bff8ff" transparent opacity={0.35} fog={false} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
  </group>;
}

/** Drifting violet/cyan energy motes around the player. */
function Motes() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); const p = new Float32Array(600 * 3); for (let i = 0; i < p.length; i++) p[i] = (Math.random() - 0.5) * (i % 3 === 1 ? 30 : 120); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); return g; }, []);
  useFrame((st) => { if (!ref.current) return; const c = st.camera.position; ref.current.position.set(c.x, c.y + Math.sin(st.clock.elapsedTime * 0.3) * 1.5, c.z); ref.current.rotation.y = st.clock.elapsedTime * 0.02; });
  return <points ref={ref} geometry={geo}><pointsMaterial color="#9fe9ff" size={0.35} transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></points>;
}
