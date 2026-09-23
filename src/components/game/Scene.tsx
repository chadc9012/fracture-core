import { Environment, Lightformer, Sky, Stars, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { REGIONS, SKY, ZONE_COLOR, clockLabel, phaseFor, regionAt, WORLD_RADIUS } from "@/game/world";
import { useKeyboard } from "@/game/useKeyboard";
import { walkHeight, slopeAt, heightAt, WATER_LEVEL } from "@/game/terrain";
import { collidePlayer, createSim, fireBullet, stepSim, type Faction, type WorldSim } from "@/game/sim";
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

import type { GameSettings } from "./SettingsWindow";

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
  settings = { aimAssist: true, firstPersonDefault: false, zoneLabels: true, hudDensity: "full" },
  playerClass = "TITAN",
  subclassId = "SHIELD_TITAN",
  appearanceId = "RANGER",
  vehicleId = "scrap-interceptor",
  vehicleUnlocked = false,
}: {
  onHud: (s: HudState) => void;
  settings?: GameSettings;
  playerClass?: ClassId;
  subclassId?: SubclassId;
  appearanceId?: AppearanceId;
  vehicleId?: VehicleId;
  vehicleUnlocked?: boolean;
}) {
  const keys = useKeyboard();
  const sim = useMemo<WorldSim>(() => createSim(), []);
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

  const state = useRef({
    x: SPAWN.x,
    z: SPAWN.z,
    y: walkHeight(SPAWN.x, SPAWN.z) + 1.6,
    vy: 0,
    yaw: 0,
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
    firstPerson: settings.firstPersonDefault,
    aimLocked: false,
    reported: { hp: 100 },
  });

  /** snapshot of every live engine system for the dev inspector */
  const buildInspector = (): InspectorView => {
    const s = state.current;
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
  const skyColor = useMemo(() => new THREE.Color(), []);
  const fogColor = useMemo(() => new THREE.Color(), []);
  const lightColor = useMemo(() => new THREE.Color(), []);
  const { scene } = useThree();

  useFrame(({ camera }, raw) => {
    const dt = Math.min(raw, 0.05);
    const held = keys.current;
    const s = state.current;

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
    if (held.has("KeyF") && s.viewCool <= 0) {
      s.viewCool = 0.35;
      s.firstPerson = !s.firstPerson;
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

    if (held.has("Space") && s.fireCool <= 0 && !sim.overheated) {
      s.fireCool = (s.inVehicle ? 0.16 : 0.28) / sim.mods.fireRate;
      fireBullet(sim, s.x, s.y + 1.2, s.z, s.yaw, s.inVehicle);
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
      const maxSpeed = 62 * biomeGrip * (boost ? 1.5 : 1) * sim.mods.vehicleSpeed * selectedVehicle.speed;
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
      // camera-relative walking (camera is axis aligned on foot)
      wish.set(0, 0, 0);
      if (throttleF) wish.z -= 1;
      if (throttleB) wish.z += 1;
      if (left) wish.x -= 1;
      if (right) wish.x += 1;
      const walk = 26 * traction * (boost ? 1.9 : 1) * sim.mods.footSpeed;
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(walk);
      velocity.lerp(wish, 1 - Math.exp(-9 * dt));
      s.x += velocity.x * dt;
      s.z += velocity.z * dt;
      if (velocity.lengthSq() > 0.6) {
        const target = Math.atan2(velocity.x, velocity.z);
        s.yaw += Math.atan2(Math.sin(target - s.yaw), Math.cos(target - s.yaw)) * (1 - Math.exp(-8 * dt));
      }
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

    /* ---------------- simulation step ---------------- */
    const { playerInstability } = stepSim(sim, {
      dt,
      px: s.x,
      pz: s.z,
      night,
      inVehicle: s.inVehicle,
    });

    /* ---------------- vertical: gravity + terrain follow ---------------- */
    const standY = walkHeight(s.x, s.z) + (s.inVehicle ? 1.9 : 1.6);
    if (!s.inVehicle && held.has("KeyC") && s.grounded) {
      s.vy = Math.sqrt(2 * sim.gravity * 6.5);
      s.grounded = false;
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
      p.visible = !s.inVehicle;
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
    if (s.firstPerson) {
      // cockpit / eye view: sit inside the body and look down the barrel
      const fwd = s.inVehicle ? 1.4 : 0.5;
      camTarget.set(
        s.x + Math.sin(s.yaw) * fwd,
        s.y + (s.inVehicle ? 1.5 : 1.0),
        s.z + Math.cos(s.yaw) * fwd,
      );
      camera.position.lerp(camTarget, 1 - Math.exp(-18 * dt));
      look.set(s.x + Math.sin(s.yaw) * 60, s.y + (s.inVehicle ? 1.5 : 1.2), s.z + Math.cos(s.yaw) * 60);
      camera.lookAt(look);
    } else {
      if (s.inVehicle) {
        camTarget.set(
          s.x - Math.sin(s.yaw) * 30,
          s.y + 20 + Math.abs(s.vSpeed) * 0.08,
          s.z - Math.cos(s.yaw) * 30,
        );
      } else {
        camTarget.set(s.x, s.y + 26, s.z + 38);
      }
      camTarget.y = Math.max(camTarget.y, walkHeight(camTarget.x, camTarget.z) + 6);
      camera.position.lerp(camTarget, 1 - Math.exp(-4.5 * dt));
      look.set(s.x, s.y + 2.5, s.z);
      camera.lookAt(look);
    }

    /* ---------------- HUD ---------------- */
    report.current += dt;
    if (report.current > 0.18) {
      report.current = 0;
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
        view: s.firstPerson ? "first" : "third",
        aimLocked: s.aimLocked,
        playerClass,
        subclassName: selectedSubclass.name,
        abilities: selectedClass.abilities.map((ability) => ({ slot: ability.slot, name: ability.name, ready: true })),
        firstMissionComplete: sim.director.missions.some((mission) => mission.kind === "FIRST_RESONANCE" && mission.state === "COMPLETED"),
        weather,
        streamTier: "ACTIVE · neighbors reduced · distant dormant",
        vehicleUnlocked,
        vehicleName: selectedVehicle.name,
        vehicleDomain: selectedVehicle.domain,
        vehicleWeapon: selectedVehicle.weapon,
        vehicleSeats: selectedVehicle.seats,
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
        castShadow
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
      <Bullets sim={sim} />
      {settings.zoneLabels && <RegionLabels />}

      {/* player on foot */}
      <group ref={player} position={SPAWN.toArray()}>
        <Scavenger armor={appearance.armor} cloth={appearance.cloth} visor={appearance.visor} />
      </group>


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
