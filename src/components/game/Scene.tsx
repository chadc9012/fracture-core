import { Environment, Lightformer, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { REGIONS, SKY, ZONE_COLOR, clockLabel, phaseFor, regionAt, WORLD_RADIUS } from "@/game/world";
import { useKeyboard } from "@/game/useKeyboard";
import { Terrain } from "./Terrain";

export type HudState = {
  region: string;
  sub: string;
  kind: keyof typeof ZONE_COLOR;
  difficulty: number;
  rules: string[];
  phase: string;
  clock: string;
  speed: number;
};

const SPAWN_REGION = REGIONS.find((r) => r.id === "nexus")!;
export const SPAWN = new THREE.Vector3(SPAWN_REGION.x, 0, SPAWN_REGION.z + 8);

const stops: { t: number; key: keyof typeof SKY }[] = [
  { t: 0, key: "Dawn" },
  { t: 0.25, key: "Day" },
  { t: 0.5, key: "Sunset" },
  { t: 0.65, key: "Night" },
  { t: 0.85, key: "Moonlight" },
  { t: 1, key: "Dawn" },
];

function blend(t: number, field: "top" | "bottom" | "fog" | "light", out: THREE.Color) {
  const h = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < stops.length - 1 && h > stops[i + 1]!.t) i++;
  const a = stops[i]!;
  const b = stops[i + 1] ?? a;
  const k = (h - a.t) / Math.max(0.0001, b.t - a.t);
  return out.set(SKY[a.key][field]).lerp(new THREE.Color(SKY[b.key][field]), k);
}

function intensityAt(t: number) {
  const h = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < stops.length - 1 && h > stops[i + 1]!.t) i++;
  const a = stops[i]!;
  const b = stops[i + 1] ?? a;
  const k = (h - a.t) / Math.max(0.0001, b.t - a.t);
  return THREE.MathUtils.lerp(SKY[a.key].intensity, SKY[b.key].intensity, k);
}

function RegionLabels() {
  return (
    <group>
      {REGIONS.map((r) => (
        <Text
          key={r.id}
          position={[r.x, 46, r.z]}
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
  const player = useRef<THREE.Group>(null!);
  const sun = useRef<THREE.DirectionalLight>(null!);
  const moon = useRef<THREE.DirectionalLight>(null!);
  const time = useRef(0.28);
  const report = useRef(0);
  const velocity = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const skyColor = useMemo(() => new THREE.Color(), []);
  const fogColor = useMemo(() => new THREE.Color(), []);
  const lightColor = useMemo(() => new THREE.Color(), []);
  const { scene } = useThree();

  useFrame(({ camera }, raw) => {
    const dt = Math.min(raw, 0.05);
    const held = keys.current;

    // ---- day / night ----
    const fast = held.has("KeyT");
    time.current += dt * (fast ? 0.06 : 0.008);

    blend(time.current, "bottom", skyColor);
    blend(time.current, "fog", fogColor);
    blend(time.current, "light", lightColor);
    scene.background = skyColor.clone();
    if (scene.fog) {
      (scene.fog as THREE.Fog).color.copy(fogColor);
    }
    const ang = ((time.current % 1) + 1) % 1;
    const theta = ang * Math.PI * 2 - Math.PI / 2;
    if (sun.current) {
      sun.current.position.set(Math.cos(theta) * 120, Math.sin(theta) * 130 + 10, 60);
      sun.current.intensity = Math.max(0, intensityAt(time.current));
      sun.current.color.copy(lightColor);
    }
    if (moon.current) {
      moon.current.intensity = 0.25 + Math.max(0, -Math.sin(theta)) * 0.5;
    }

    // ---- player movement (camera-relative, camera is axis aligned) ----
    const p = player.current;
    if (!p) return;
    const here = regionAt(p.position.x, p.position.z);
    const speedMul = here?.speed ?? 0.9;
    const boost = held.has("ShiftLeft") || held.has("ShiftRight") ? 1.9 : 1;

    tmp.set(0, 0, 0);
    if (held.has("KeyW") || held.has("ArrowUp")) tmp.z -= 1;
    if (held.has("KeyS") || held.has("ArrowDown")) tmp.z += 1;
    if (held.has("KeyA") || held.has("ArrowLeft")) tmp.x -= 1;
    if (held.has("KeyD") || held.has("ArrowRight")) tmp.x += 1;
    if (tmp.lengthSq() > 0) tmp.normalize().multiplyScalar(64 * speedMul * boost * dt);

    velocity.lerp(tmp, 1 - Math.exp(-10 * dt));
    p.position.add(velocity);

    // keep the player on the landmass
    const d = Math.hypot(p.position.x, p.position.z);
    if (d > WORLD_RADIUS - 4) {
      p.position.multiplyScalar((WORLD_RADIUS - 4) / d);
    }

    if (velocity.lengthSq() > 0.0005) {
      const yaw = Math.atan2(velocity.x, velocity.z);
      p.rotation.y = THREE.MathUtils.lerp(p.rotation.y, yaw, 1 - Math.exp(-8 * dt));
    }
    p.position.y = 1.2 + Math.sin(performance.now() * 0.008) * 0.06;

    // ---- follow camera ----
    camTarget.set(p.position.x, p.position.y + 30, p.position.z + 38);
    camera.position.lerp(camTarget, 1 - Math.exp(-4 * dt));
    look.copy(p.position);
    look.y += 2;
    camera.lookAt(look);

    // ---- HUD (throttled) ----
    report.current += dt;
    if (report.current > 0.2) {
      report.current = 0;
      onHud({
        region: here?.name ?? "Open Wilds",
        sub: here?.sub ?? "Unclaimed / No cover",
        kind: here?.kind ?? "war",
        difficulty: here?.difficulty ?? 2,
        rules: here?.rules ?? ["No stability field", "AI patrols roam freely"],
        phase: phaseFor(time.current),
        clock: clockLabel(time.current),
        speed: Math.round(velocity.length() * 60),
      });
    }
  });

  return (
    <>
      <fog attach="fog" args={["#c6e2ee", 90, 420]} />
      <hemisphereLight args={["#9ec8e8", "#3b3326", 0.9]} />
      <directionalLight
        ref={sun}
        position={[80, 120, 60]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-far={400}
      />
      <directionalLight ref={moon} position={[-90, 90, -60]} color="#9fc4ff" intensity={0.3} />
      <Environment>
        <Lightformer intensity={1.4} position={[0, 40, 0]} scale={[60, 60, 1]} />
        <Lightformer intensity={0.7} color="#7fb6d9" position={[-60, 10, -20]} rotation-y={Math.PI / 2} scale={[80, 8, 1]} />
      </Environment>

      <Terrain />
      <RegionLabels />

      {/* player */}
      <group ref={player} position={SPAWN.toArray()}>
        <mesh castShadow>
          <capsuleGeometry args={[0.8, 1.5, 6, 14]} />
          <meshStandardMaterial color="#e9f3ff" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.4, -0.75]}>
          <boxGeometry args={[0.9, 0.5, 0.25]} />
          <meshStandardMaterial color="#66e0ff" emissive="#66e0ff" emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 1.6, 0]} color="#8fe6ff" intensity={12} distance={22} decay={2} />
      </group>
    </>
  );
}
