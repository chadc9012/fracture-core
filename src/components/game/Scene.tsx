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
};

const SPAWN_REGION = REGIONS.find((r) => r.id === "nexus")!;
export const SPAWN = new THREE.Vector3(SPAWN_REGION.x, 0, SPAWN_REGION.z + 20);

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

export function Scene({ onHud }: { onHud: (s: HudState) => void }) {
  const keys = useKeyboard();
  const sim = useMemo<WorldSim>(() => createSim(), []);
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
    reported: { hp: 100 },
  });

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
    if (held.has("KeyV") && s.toggleCool <= 0) {
      s.toggleCool = 0.4;
      s.inVehicle = !s.inVehicle;
      s.vSpeed = 0;
      velocity.set(0, 0, 0);
    }
    const here = regionAt(s.x, s.z);
    const slope = slopeAt(s.x, s.z);
    const ground = walkHeight(s.x, s.z);
    const submerged = heightAt(s.x, s.z) < WATER_LEVEL - 0.2;

    if (held.has("Space") && s.fireCool <= 0) {
      s.fireCool = s.inVehicle ? 0.16 : 0.28;
      fireBullet(sim, s.x, s.y + 1.2, s.z, s.yaw);
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
      const maxSpeed = 62 * biomeGrip * (boost ? 1.5 : 1);
      const accel = 52 * traction;
      if (throttleF) s.vSpeed += accel * dt;
      else if (throttleB) s.vSpeed -= accel * 0.8 * dt;
      else s.vSpeed *= Math.exp(-1.4 * dt);
      // drag + grade resistance climbing hills
      s.vSpeed *= Math.exp(-(0.22 + slope * 1.6) * dt);
      s.vSpeed = THREE.MathUtils.clamp(s.vSpeed, -18, maxSpeed);

      const steerRate = 1.5 * traction * THREE.MathUtils.clamp(Math.abs(s.vSpeed) / 14, 0.15, 1);
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
      const walk = 26 * traction * (boost ? 1.9 : 1);
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
      v.visible = s.inVehicle;
      if (s.inVehicle) {
        v.position.set(s.x, s.y, s.z);
        v.rotation.y = s.yaw;
        v.rotation.x = -slopeAt(s.x, s.z) * 0.25;
      } else {
        // parked at the spawn pad when on foot
        v.position.set(SPAWN.x + 8, walkHeight(SPAWN.x + 8, SPAWN.z + 6) + 1.9, SPAWN.z + 6);
        v.rotation.set(0, 0.6, 0);
        v.visible = true;
      }
    }

    /* ---------------- camera ---------------- */
    if (s.inVehicle) {
      camTarget.set(
        s.x - Math.sin(s.yaw) * 30,
        s.y + 20 + Math.abs(s.vSpeed) * 0.08,
        s.z - Math.cos(s.yaw) * 30,
      );
    } else {
      camTarget.set(s.x, s.y + 32, s.z + 44);
    }
    camTarget.y = Math.max(camTarget.y, walkHeight(camTarget.x, camTarget.z) + 6);
    camera.position.lerp(camTarget, 1 - Math.exp(-4.5 * dt));
    look.set(s.x, s.y + 2.5, s.z);
    camera.lookAt(look);

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
      <RegionLabels />

      {/* player on foot */}
      <group ref={player} position={SPAWN.toArray()}>
        <mesh castShadow>
          <capsuleGeometry args={[0.8, 1.5, 6, 14]} />
          <meshStandardMaterial color="#e9f3ff" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.4, -0.75]}>
          <boxGeometry args={[0.9, 0.5, 0.25]} />
          <meshStandardMaterial color="#66e0ff" emissive="#66e0ff" emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      </group>

      {/* drivable assault buggy — CC0 shell with rolling wheels */}
      <group ref={vehicle}>
        <Car body="race_future" scale={2.6} speedRef={carSpeed} steerRef={carSteer} />
        <mesh position={[0, 2.4, 0.6]} castShadow>
          <boxGeometry args={[0.45, 0.45, 3.2]} />
          <meshStandardMaterial color="#1b2129" metalness={0.85} roughness={0.25} />
        </mesh>
        <pointLight position={[0, 1.2, 4]} color="#bfeaff" intensity={18} distance={44} decay={2} />
      </group>
    </>
  );
}
