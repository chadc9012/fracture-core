import { Environment, Lightformer, Sky, Stars, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { REGIONS, SKY, ZONE_COLOR, clockLabel, phaseFor, regionAt, WORLD_RADIUS } from "@/game/world";
import { useKeyboard } from "@/game/useKeyboard";
import { walkHeight, slopeAt, heightAt, WATER_LEVEL } from "@/game/terrain";
import { alert, collidePlayer, createSim, defeatMachine, fireBullet, spawnMissionDrones, stepSim, summonBoss, type Faction, type WorldSim } from "@/game/sim";
import type { MissionEvent, MissionRun } from "@/game/missions/broken-signal";
import { directorTrend, type Mission } from "@/game/director";
import { Terrain } from "./Terrain";
import { Bullets, Convoys, SupplyLanes, WarMachines, ZoneBeacons } from "./Actors";
import { Car } from "./Vehicle";
import { NexusCity } from "./NexusCity";
import { Water } from "./Water";
import { Scavenger } from "./Scavenger";
import type { InspectorView } from "./Inspector";
import { TIER_RADII } from "@/game/lod";
import { RARITY_COLOR, type Rarity } from "@/game/loot";
import { appearanceById, classById, subclassById, type AppearanceId, type ClassId, type SubclassId } from "@/game/loadout";
import { vehicleById, type VehicleId } from "@/game/vehicles";
import { projectDome, shieldBash } from "@/game/titan";
import { RENDER_PRESETS } from "@/game/performance";
import { activateLiveAbility, createLiveBuild, rebindLiveBuild, tickLiveBuild } from "@/game/live-build";
import type { ActiveBuild } from "@/game/ability-network";
import type { TutorialEvent, TutorialState } from "@/game/onboarding";

import type { GameSettings } from "./SettingsWindow";
import { WEAPONS, WEAPON_ORDER, decay, freshAmmo, type WeaponId } from "@/game/weapons";
import { DEFAULT_BINDINGS } from "@/game/bindings";
import type { ArmorVisualState } from "./Scavenger";
import type { PlayerProgression } from "@/game/progression";

export type LootView = { name: string; rarity: Rarity; power: number; mods: string[]; color: string };

export type HudState = {
  region: string;
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
  playerClass: ClassId;
  subclassName: string;
  abilities: { slot: string; name: string; ready: boolean }[];
  firstMissionComplete: boolean;
  weather: string;
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
};

const SPAWN_REGION = REGIONS.find((r) => r.id === "veridan");
export const SPAWN = new THREE.Vector3(SPAWN_REGION?.x ?? -58, 0, (SPAWN_REGION?.z ?? -34) + 12);

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

function RegionLabels() {
  return (
    <group>
      {REGIONS.map((r) => (
        <Text
          key={r.id}
          position={[r.x, walkHeight(r.x, r.z) + 52, r.z]}
          fontSize={7}
          color={ZONE_COLOR[r.kind]}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.25}
          outlineColor="#04070d"
        >
          {r.name.toUpperCase()}
        </Text>
      ))}
    </group>
  );
}

export function Scene({
  onHud,
  settings = { aimAssist: true, firstPersonDefault: true, zoneLabels: true, hudDensity: "full", renderTier: "HIGH" },
  onCameraPreference,
  playerClass = "TITAN",
  subclassId = "SHIELD_TITAN",
  appearanceId = "RANGER",
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
}: {
  onHud: (s: HudState) => void;
  settings?: GameSettings;
  onCameraPreference?: (firstPerson: boolean) => void;
  playerClass?: ClassId;
  subclassId?: SubclassId;
  appearanceId?: AppearanceId;
  vehicleId?: VehicleId;
  vehicleUnlocked?: boolean;
  armorState?: ArmorVisualState;
  activeBuild: ActiveBuild;
  abilityBranches?: Record<string, string>;
  tutorial?: TutorialState | null;
  onTutorialEvent?: (event: TutorialEvent) => void;
  onDrops?: (drops: WorldSim["drops"]) => void;
  gear?: Pick<PlayerProgression, "inventory" | "equippedGear">;
  mission?: MissionRun | null;
  onMissionEvent?: (event: MissionEvent) => void;
}) {
  const keys = useKeyboard();
  const sim = useMemo<WorldSim>(() => createSim(), []);
  const missionSpawned = useRef("");
  const appearance = appearanceById(appearanceId);
  const selectedClass = classById(playerClass);
  const selectedSubclass = subclassById(subclassId);
  const selectedVehicle = vehicleById(vehicleId);
  const player = useRef<THREE.Group>(null!);
  const vehicle = useRef<THREE.Group>(null!);
  const sun = useRef<THREE.DirectionalLight>(null!);
  const moon = useRef<THREE.DirectionalLight>(null!);
  const moonMesh = useRef<THREE.Mesh>(null!);
  const time = useRef(0.28);
  const sunDir = useRef(new THREE.Vector3(0.4, 0.9, 0.3));
  const carSpeed = useRef(0);
  const carSteer = useRef(0);
  const sky = useRef<THREE.Object3D>(null!);
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
  const skyColor = useMemo(() => new THREE.Color(), []);
  const fogColor = useMemo(() => new THREE.Color(), []);
  const lightColor = useMemo(() => new THREE.Color(), []);
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
    const dt = Math.min(raw, 0.05);
    const held = keys.current;
    const s = state.current;
    live.current = rebindLiveBuild(live.current, activeBuild, abilityBranches);
    tickLiveBuild(live.current, dt);
    tutorialClock.current += dt;
    if (tutorial?.step === "MATERIALIZE" && tutorialClock.current > 2) onTutorialEvent?.("READY");
    sim.titanActive = playerClass === "TITAN" && !s.inVehicle;

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
    if (vehicleUnlocked && held.has("KeyV") && s.toggleCool <= 0) {
      s.toggleCool = 0.4;
      s.inVehicle = !s.inVehicle;
      s.vSpeed = 0;
      velocity.set(0, 0, 0);
    }
    s.inspectorCool -= dt;
    if (held.has("KeyI") && s.inspectorCool <= 0) {
      s.inspectorCool = 0.35;
      s.showInspector = !s.showInspector;
    }
    s.fps = s.fps * 0.9 + (1 / Math.max(0.001, raw)) * 0.1;

    const here = regionAt(s.x, s.z);
    if (held.has("KeyB") && !bossHeld.current && here && here.kind !== "safe" && !tutorial && !sim.machines.some((m) => m.alive && m.boss && m.zone === here.id)) {
      summonBoss(sim, here.id, s.x + Math.sin(s.yaw) * 24, s.z + Math.cos(s.yaw) * 24);
    }
    bossHeld.current = held.has("KeyB");
    for (const [key, slot] of [["KeyQ", "PRIMARY"], ["KeyE", "TACTICAL"], ["KeyR", "ULTIMATE"]] as const) {
      if (held.has(key) && !abilityHeld.current[key] && !s.inVehicle) {
        const ability = activateLiveAbility(live.current, slot, here?.kind ?? "war");
        if (ability) {
          s.specialTime = Math.max(s.specialTime, slot === "ULTIMATE" ? 1.5 : 0.8);
          const effect = ability.effects[0];
          if (effect?.kind === "DASH") { s.x += Math.sin(s.yaw) * effect.value; s.z += Math.cos(s.yaw) * effect.value; alert(sim, "PHASE DASH · incoming damage avoided"); }
          if (effect?.kind === "SILENCE" || effect?.kind === "FIELD" || effect?.kind === "COOLDOWN_SHIFT") {
            for (const enemy of sim.machines) if (enemy.alive && Math.hypot(enemy.x - s.x, enemy.z - s.z) < (effect.radius ?? 12)) enemy.cool = Math.max(enemy.cool, effect.duration ?? 3);
            if (effect.kind === "FIELD") live.current.fieldTime = effect.duration ?? 8;
            alert(sim, "Hostile systems disrupted · environment recalibrated");
          }
          if (effect?.kind === "DAMAGE") for (const enemy of sim.machines) if (enemy.alive && Math.hypot(enemy.x - s.x, enemy.z - s.z) < (effect.radius ?? 6) * 2) enemy.hp -= effect.value / 20;
          if (effect?.kind === "DOME") { sim.titan.domeTime = Math.max(sim.titan.domeTime, effect.duration ?? 5); alert(sim, "Barrier projected"); }
          if (effect?.kind === "MARK") { live.current.damageMultiplier = 1.25; alert(sim, "Target exposed · damage amplified"); }
          if (tutorial?.step === "ABILITY") onTutorialEvent?.("ABILITY");
          else if (tutorial?.step === "REINFORCE" && slot === "PRIMARY") onTutorialEvent?.("MASTERY");
          else if (tutorial?.step === "CHAMBER") { chamberActions.current.add(slot); if (chamberActions.current.size >= 2) onTutorialEvent?.("CHAMBER"); }
          else if (tutorial?.step === "POWER" && slot !== "PRIMARY") onTutorialEvent?.("CHAIN");
          else if (tutorial?.step === "SENTINEL" && sentinel.current && effect?.kind !== "BLOCK") { sentinel.current.hp -= 2; }
        }
      }
      abilityHeld.current[key] = held.has(key);
    }
    const weather = here?.id === "veridan" ? "Rain mist" : here?.id === "ember" ? "Ashfall" : here?.id === "frostspire" ? "Snow haze" : here?.id === "nexus" ? "Clear shield" : "Dust front";
    const visibility = here?.id === "nexus" ? 1 : here?.id === "veridan" ? 0.66 : here?.id === "ember" ? 0.55 : here?.id === "frostspire" ? 0.48 : 0.62;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = 55 + visibility * 65;
      scene.fog.far = 220 + visibility * 300;
    }
    if (sun.current) sun.current.intensity *= 0.7 + visibility * 0.3;
    const slope = slopeAt(s.x, s.z);
    const ground = walkHeight(s.x, s.z);
    const submerged = heightAt(s.x, s.z) < WATER_LEVEL - 0.2;

    s.viewCool -= dt;
    if (held.has("KeyF") && !cameraToggleHeld.current) {
      s.firstPerson = !s.firstPerson;
      onCameraPreference?.(s.firstPerson);
    }
    cameraToggleHeld.current = held.has("KeyF");

    if (held.has("KeyX") && s.meleeCool <= 0 && !s.inVehicle) {
      s.meleeCool = 0.7;
      s.meleeTime = 0.72;
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
    const padNow = pad ? pad.buttons.map((b) => b.pressed) : [];
    const padTap = (i: number) => !!padNow[i] && !padPrev.current[i];
    const keyTap = (code: string) => held.has(code) && !keyPrev.current.has(code);
    padState.current = { fire: !!padNow[binds.gamepad.fire], aim: !!padNow[binds.gamepad.aim], connected: !!pad };
    const equip = (id: WeaponId) => {
      if (s.weapon === id) return;
      s.weapon = id; s.burstLeft = 0; s.reload = 0; s.switchedAt = performance.now();
      s.fireCool = Math.max(s.fireCool, 0.25);
      alert(sim, `${WEAPONS[id].name} equipped`);
    };
    const step = (dir: number) => equip(WEAPON_ORDER[(WEAPON_ORDER.indexOf(s.weapon) + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length]!);
    WEAPON_ORDER.forEach((id, i) => { if (held.has(`Digit${i + 1}`) || padTap(binds.gamepad[`slot${i + 1}` as "slot1"])) equip(id); });
    if (keyTap(binds.keyboard.nextWeapon) || padTap(binds.gamepad.nextWeapon)) step(1);
    if (keyTap(binds.keyboard.prevWeapon) || padTap(binds.gamepad.prevWeapon)) step(-1);
    s.wheel = held.has(binds.keyboard.weaponWheel) || !!padNow[binds.gamepad.weaponWheel];
    if (s.wheel && pad) {
      // flick the right stick toward a slot: up=1, right=2, down=3, left=4
      const [rx = 0, ry = 0] = [pad.axes[2], pad.axes[3]];
      if (Math.hypot(rx, ry) > 0.6) equip(Math.abs(rx) > Math.abs(ry) ? (rx > 0 ? WEAPON_ORDER[1]! : WEAPON_ORDER[3]!) : (ry < 0 ? WEAPON_ORDER[0]! : WEAPON_ORDER[2]!));
    }
    const def = WEAPONS[s.weapon];
    const clip = s.ammo[s.weapon];
    const startReload = () => { if (def.mag > 0 && s.reload <= 0 && clip.mag < def.mag && clip.reserve > 0) { s.reload = def.reload; s.burstLeft = 0; alert(sim, `Reloading ${def.name}`); } };
    if (!s.inVehicle && (keyTap(binds.keyboard.reload) || padTap(binds.gamepad.reload))) startReload();
    if (s.reload > 0) {
      s.reload -= dt;
      if (s.reload <= 0) { const take = Math.min(def.mag - clip.mag, clip.reserve); clip.mag += take; clip.reserve -= take; s.reload = 0; }
    }
    padPrev.current = padNow;
    keyPrev.current = new Set(held);
    const wpn = s.inVehicle ? WEAPONS.AUTO : WEAPONS[s.weapon];
    const equippedWeapon = gear?.inventory.find((item) => item.id === gear.equippedGear[s.inVehicle ? "vehicle" : s.weapon === "HEAVY" ? "heavy" : s.weapon === "PULSE" ? "secondary" : "primary"]);
    const gearPower = equippedWeapon ? 1 + Math.max(0, equippedWeapon.power - 100) / 500 : 1;
    sim.equippedElement = equippedWeapon?.element ?? "KINETIC";
    s.recoil = decay(s.recoil, 9, dt);
    s.punch = decay(s.punch, 14, dt);
    s.bloom = decay(s.bloom, 6, dt);
    s.swing = Math.max(0, s.swing - dt);
    s.comboTime = Math.max(0, s.comboTime - dt);
    if (s.comboTime <= 0) s.combo = 0;
    const trigger = held.has("Space") || mouse.current.fire || padState.current.fire;
    const shoot = () => {
      if (!s.inVehicle && wpn.mag > 0) {
        if (s.reload > 0) return;
        if (clip.mag <= 0) { s.burstLeft = 0; startReload(); return; }
      }
      const spread = (wpn.spread + s.bloom * 0.04) * (mouse.current.aim ? wpn.adsSpread : 1);
      const yawJ = (Math.random() - 0.5) * 2 * spread;
      const pitchJ = (Math.random() - 0.5) * 2 * spread;
       if (fireBullet(sim, s.x, s.y + (s.inVehicle ? 1.5 : 0.95), s.z, s.yaw + yawJ, s.inVehicle, s.pitch + s.recoil + pitchJ, wpn.damage * gearPower, wpn.knock, wpn.heat)) {
        s.recoil += wpn.recoil;
        s.punch += wpn.punch;
        s.bloom = Math.min(1, s.bloom + 0.18 * wpn.punch);
        if (!s.inVehicle && wpn.mag > 0) { clip.mag--; if (clip.mag <= 0) startReload(); }
      }
    };
    if (wpn.kind === "sword") {
      if (trigger && s.fireCool <= 0) {
        s.fireCool = wpn.fireRate;
        s.combo = (s.combo % 3) + 1;
        s.comboTime = 0.9;
        s.swing = 0.3;
        s.meleeTime = Math.max(s.meleeTime, 0.6);
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

    const throttleF = held.has("KeyW") || held.has("ArrowUp");
    const throttleB = held.has("KeyS") || held.has("ArrowDown");
    const left = held.has("KeyA") || held.has("ArrowLeft");
    const right = held.has("KeyD") || held.has("ArrowRight");
    const boost = held.has("ShiftLeft") || held.has("ShiftRight");

    /* ---------------- movement ---------------- */
    // traction: biome speed rating, penalised by slope and water
    const biomeGrip = here?.speed ?? 0.9;
    const traction = Math.max(0.18, biomeGrip * (1 - slope * 0.75) * (submerged ? 0.45 : 1));

    if (s.inVehicle) {
       const vehicleGear = gear?.inventory.find((item) => item.id === gear.equippedGear.vehicle);
       const maxSpeed = 62 * biomeGrip * (boost ? 1.5 : 1) * sim.mods.vehicleSpeed * selectedVehicle.speed * (vehicleGear ? 1 + vehicleGear.level * 0.04 : 1);
      const accel = 52 * traction * selectedVehicle.speed;
      if (throttleF) s.vSpeed += accel * dt;
      else if (throttleB) s.vSpeed -= accel * 0.8 * dt;
      else s.vSpeed *= Math.exp(-1.4 * dt);
      // drag + grade resistance climbing hills
      s.vSpeed *= Math.exp(-(0.22 + slope * 1.6) * dt);
      s.vSpeed = THREE.MathUtils.clamp(s.vSpeed, -18, maxSpeed);

      const steerRate = 1.5 * traction * selectedVehicle.handling * THREE.MathUtils.clamp(Math.abs(s.vSpeed) / 14, 0.15, 1);
      if (left) s.yaw += steerRate * dt * Math.sign(s.vSpeed || 1);
      if (right) s.yaw -= steerRate * dt * Math.sign(s.vSpeed || 1);

      s.x += Math.sin(s.yaw) * s.vSpeed * dt;
      s.z += Math.cos(s.yaw) * s.vSpeed * dt;
    } else {
      // Mouse-look sets the facing direction; WASD stays relative to it.
      wish.set(0, 0, 0);
      if (throttleF) { wish.x += Math.sin(s.yaw); wish.z += Math.cos(s.yaw); }
      if (throttleB) { wish.x -= Math.sin(s.yaw); wish.z -= Math.cos(s.yaw); }
      if (left) { wish.x += Math.sin(s.yaw - Math.PI / 2); wish.z += Math.cos(s.yaw - Math.PI / 2); }
      if (right) { wish.x += Math.sin(s.yaw + Math.PI / 2); wish.z += Math.cos(s.yaw + Math.PI / 2); }
      const walk = 26 * traction * (boost ? 1.9 : 1) * sim.mods.footSpeed * (live.current.dashTime > 0 ? 1.4 : 1);
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(walk);
      velocity.lerp(wish, 1 - Math.exp(-9 * dt));
      s.x += velocity.x * dt;
      s.z += velocity.z * dt;
      if (tutorial?.step === "MOVEMENT") { const travel = Math.hypot(s.x - SPAWN.x, s.z - SPAWN.z); if (travel >= (lastGate.current + 1) * 10 && lastGate.current < 3) { lastGate.current++; onTutorialEvent?.("GATE"); } }
    }

    // world bounds
    const d = Math.hypot(s.x, s.z);
    if (d > WORLD_RADIUS - 6) {
      s.x *= (WORLD_RADIUS - 6) / d;
      s.z *= (WORLD_RADIUS - 6) / d;
      s.vSpeed *= 0.3;
    }

    /* ---------------- collisions (physics before sim) ---------------- */
    const body = { x: s.x, z: s.z, yaw: s.yaw, vSpeed: s.vSpeed, inVehicle: s.inVehicle };
    collidePlayer(sim, body);
    s.x = body.x;
    s.z = body.z;
    s.vSpeed = body.vSpeed;

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
    }

    /* ---------------- simulation step ---------------- */
    const { playerInstability } = stepSim(sim, {
      dt,
      px: s.x,
      pz: s.z,
      night,
      inVehicle: s.inVehicle,
    });
    if (tutorial?.step === "CONTACT" && sim.kills > tutorialKills.current) { tutorialKills.current++; onTutorialEvent?.("KILL"); }
    if (tutorial?.step === "SENTINEL" && sentinel.current && !sentinel.current.alive) { sentinel.current = null; onTutorialEvent?.("BOSS"); }
    sim.mods.bulletDamage = Math.max(0.5, 1.2 * live.current.damageMultiplier * (1 + live.current.momentum * 0.25));
    if (live.current.fieldTime > 0) sim.gravity *= 0.55;
    if (live.current.dashTime > 0) sim.hp = Math.min(100, sim.hp + dt * 15);
    if (live.current.hackTime > 0) for (const enemy of sim.machines) if (enemy.alive && Math.hypot(enemy.x - s.x, enemy.z - s.z) < 12) enemy.cool = Math.max(enemy.cool, 0.3);

    /* ---------------- vertical: gravity + terrain follow ---------------- */
    const standY = walkHeight(s.x, s.z) + (s.inVehicle ? 1.9 : 1.6);
    if (!s.inVehicle && held.has("KeyC") && s.grounded) {
      s.vy = Math.sqrt(2 * sim.gravity * 6.5);
      s.grounded = false;
      if (tutorial?.step === "MOVEMENT") onTutorialEvent?.("JUMP");
    }
    if (s.grounded) {
      s.y = THREE.MathUtils.lerp(s.y, standY, 1 - Math.exp(-14 * dt));
    } else {
      s.vy -= sim.gravity * dt;
      s.y += s.vy * dt;
      if (s.y <= standY) {
        s.y = standY;
        s.vy = 0;
        s.grounded = true;
      }
    }
    // fracture instability tosses loose objects (and you) around
    if (playerInstability > 0.6 && s.grounded && Math.random() < playerInstability * dt * 1.2) {
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
    camTarget.y = Math.max(camTarget.y, walkHeight(camTarget.x, camTarget.z) + 1.35);
    camera.position.lerp(camTarget, 1 - Math.exp(-18 * dt));
    const kickPitch = s.pitch + s.recoil;
    const shakeAmt = Math.min(0.08, s.punch * 0.012);
    camera.position.x += (Math.random() - 0.5) * shakeAmt;
    camera.position.y += (Math.random() - 0.5) * shakeAmt;
    cameraDirection.set(Math.sin(s.yaw) * Math.cos(kickPitch), Math.sin(kickPitch), Math.cos(s.yaw) * Math.cos(kickPitch));
    look.copy(camera.position).addScaledVector(cameraDirection, 60);
    camera.lookAt(look);
    if (camera instanceof THREE.PerspectiveCamera) {
      const desiredFov = mouse.current.aim ? 42 : 65;
      camera.fov += (desiredFov - camera.fov) * (1 - Math.exp(-12 * dt));
      camera.updateProjectionMatrix();
    }
    if (viewmodel.current) {
      viewmodel.current.visible = !s.inVehicle && s.cameraBlend < 0.22;
      viewmodel.current.position.copy(camera.position);
      viewmodel.current.quaternion.copy(camera.quaternion);
      if (gunModel.current) { gunModel.current.visible = WEAPONS[s.weapon].kind === "gun"; gunModel.current.position.z = Math.min(0.35, s.punch * 0.06); gunModel.current.rotation.x = s.recoil * 3; }
      if (swordModel.current) { swordModel.current.visible = WEAPONS[s.weapon].kind === "sword"; const t = s.swing / 0.3; swordModel.current.rotation.z = (s.combo % 2 ? 1 : -1) * (t > 0 ? (1 - t) * 2.4 - 1.2 : -0.35); }
    }

    /* ---------------- HUD ---------------- */
    report.current += dt;
    if (report.current > 0.18) {
      report.current = 0;
      if (sim.drops.length) onDrops?.(sim.drops.splice(0));
      const zone = sim.zones.find((z) => z.region.id === here?.id);
      onHud({
        region: here?.name ?? "Open Wilds",
        sub: here?.sub ?? "Unclaimed / no cover",
        kind: here?.kind ?? "war",
        difficulty: here?.difficulty ?? 2,
        rules: here?.rules ?? ["No stability field", "AI patrols roam freely"],
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
        elevation: Math.round(heightAt(s.x, s.z)),
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
        aiming: mouse.current.aim,
        meleeTime: s.meleeTime,
        weaponName: WEAPONS[s.weapon].name,
        weaponSlot: WEAPON_ORDER.indexOf(s.weapon) + 1,
        ammo: WEAPON_ORDER.map((id) => ({ id, name: WEAPONS[id].name, mag: s.ammo[id].mag, magSize: WEAPONS[id].mag, reserve: s.ammo[id].reserve })),
        reloading: s.reload > 0 ? 1 - s.reload / WEAPONS[s.weapon].reload : 0,
        weaponWheel: s.wheel,
        weaponSwitched: s.switchedAt,
        controller: padState.current.connected,
        bloom: Math.round(s.bloom * 100) / 100,
        hitMarker: performance.now() - sim.lastHit < 180,
        playerClass,
        subclassName: selectedSubclass.name,
        abilities: selectedClass.abilities.map((ability) => ({ slot: ability.slot, name: ability.name, ready: live.current.runtime[ability.slot]?.cooldown <= 0 })),
        firstMissionComplete: sim.director.missions.some((mission) => mission.kind === "FIRST_RESONANCE" && mission.state === "COMPLETED"),
        weather,
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
      });
    }
  });

  return (
    <>
      <fog attach="fog" args={["#c6e2ee", 110, 520]} />
      <hemisphereLight args={["#9ec8e8", "#3b3326", 0.85]} />
      <directionalLight
        ref={sun}
        position={[80, 140, 70]}
        intensity={1.6}
        castShadow={RENDER_PRESETS[settings.renderTier].shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
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
      <Environment>
        <Lightformer intensity={1.3} position={[0, 60, 0]} scale={[80, 80, 1]} />
        <Lightformer
          intensity={0.6}
          color="#7fb6d9"
          position={[-80, 20, -30]}
          rotation-y={Math.PI / 2}
          scale={[90, 10, 1]}
        />
      </Environment>

      <Terrain />
      <Water size={WORLD_RADIUS * 4} sunRef={sunDir} />
      <NexusCity sim={sim} />
      <SupplyLanes sim={sim} />
      <ZoneBeacons sim={sim} />
      <Convoys sim={sim} />
      <WarMachines sim={sim} />
      {mission?.target && (mission.state === "DISCOVERY" || mission.state === "TRAVERSAL") && (
        <group position={[mission.target.x, heightAt(mission.target.x, mission.target.z) + 3, mission.target.z]}>
          <mesh><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#39e6ff" emissive="#39e6ff" emissiveIntensity={3} /></mesh>
          <mesh position={[0, 30, 0]}><cylinderGeometry args={[0.15, 0.15, 60, 6]} /><meshBasicMaterial color={mission.state === "TRAVERSAL" ? "#ff6a3d" : "#39e6ff"} transparent opacity={0.45} /></mesh>
          <pointLight color={mission.state === "TRAVERSAL" ? "#ff6a3d" : "#39e6ff"} intensity={30} distance={40} />
        </group>
      )}
      <Bullets sim={sim} />
      {settings.zoneLabels && <RegionLabels />}

      {/* player on foot */}
      <group ref={player} position={SPAWN.toArray()}>
        <Scavenger armor={appearance.armor} cloth={appearance.cloth} visor={appearance.visor} classId={playerClass} visualState={armorState} />
        {playerClass === "TITAN" && sim.titan.blocking && <mesh position={[0, 1.8, 1.4]} rotation={[0, 0, 0]}><boxGeometry args={[3.4, 4.5, 0.16]} /><meshStandardMaterial color="#74dfff" emissive="#3daec7" emissiveIntensity={2.8} transparent opacity={0.45} /></mesh>}
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
