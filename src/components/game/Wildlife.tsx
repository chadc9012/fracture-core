import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { REGIONS } from "@/game/world";
import { heightAt, WATER_LEVEL } from "@/game/terrain";
import { mulberry32 } from "@/game/useKeyboard";
import { SPECIES_PROFILE, spawnCritter, stepCritter, type Critter, type Species } from "@/game/wildlife";

/**
 * Ambient, non-hostile wildlife: deer and birds in the forest, fish in the water, dogs and cats
 * around Nexus City, snakes in the desert/wastelands. Purely atmospheric — see wildlife.ts for the
 * shared wander/flee AI (a stationary player never spooks anything; a moving one does).
 *
 * One <CritterView> per animal owns its own refs and reads the shared, centrally-stepped Critter
 * object every frame — the AI runs once per critter per frame regardless of how many components
 * are watching it, and the view layer only ever imperatively sets transforms (no React re-renders
 * on the hot path), the same pattern Weather.tsx uses for its particle fields.
 */
const byId = (id: string) => REGIONS.find((r) => r.id === id)!;

function buildSpawnList(): Critter[] {
  const list: Critter[] = [];
  let n = 0;
  const add = (species: Species, homeX: number, homeZ: number, count: number, seed: number) => {
    const rnd = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * SPECIES_PROFILE[species].homeRadius * 0.6;
      const hx = homeX + Math.cos(a) * d;
      const hz = homeZ + Math.sin(a) * d;
      list.push(spawnCritter(`${species}-${n}`, species, hx, hz, n));
      n++;
    }
  };

  const forest = byId("veridan");
  const swamp = byId("swamps");
  const nexus = byId("nexus");
  const waste = byId("wastelands");
  const solara = byId("solara");

  add("DEER", forest.x, forest.z, 6, 301);
  add("BIRD", forest.x + 10, forest.z - 6, 10, 302);
  add("FISH", swamp.x, swamp.z, 14, 303);
  add("DOG", nexus.x - 8, nexus.z + 10, 4, 304);
  add("CAT", nexus.x + 6, nexus.z - 8, 4, 305);
  add("SNAKE", waste.x, waste.z, 5, 306);
  add("SNAKE", solara.x, solara.z, 5, 307);

  return list;
}

const UP = new THREE.Vector3(0, 1, 0);

function Deer({ phase, fleeing }: { phase: number; fleeing: boolean }) {
  const legRef = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (!legRef.current) return;
    const swing = Math.sin(phase) * (fleeing ? 0.55 : 0.3);
    legRef.current.children.forEach((leg, i) => {
      leg.rotation.x = (i % 2 === 0 ? swing : -swing) * (i < 2 ? 1 : -1);
    });
  });
  return (
    <group scale={1.1}>
      <RoundedBox args={[0.55, 0.55, 1.15]} radius={0.12} smoothness={4} position={[0, 0.95, 0]} castShadow><meshStandardMaterial color="#8a6141" roughness={0.9} /></RoundedBox>
      <RoundedBox args={[0.32, 0.32, 0.5]} radius={0.08} smoothness={4} position={[0, 1.15, 0.75]} rotation-x={0.35} castShadow><meshStandardMaterial color="#8a6141" roughness={0.9} /></RoundedBox>
      <RoundedBox args={[0.24, 0.26, 0.3]} radius={0.06} smoothness={4} position={[0, 1.4, 0.98]} castShadow><meshStandardMaterial color="#9a7452" roughness={0.9} /></RoundedBox>
      {[[-0.09, 1.62, 1.02], [0.09, 1.62, 1.02]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation-x={-0.3}><coneGeometry args={[0.03, 0.28, 8]} /><meshStandardMaterial color="#4a3a2a" roughness={0.8} /></mesh>
      ))}
      <group ref={legRef} position={[0, 0.68, 0]}>
        {[[-0.2, 0, 0.42], [0.2, 0, 0.42], [-0.2, 0, -0.42], [0.2, 0, -0.42]].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} castShadow><cylinderGeometry args={[0.06, 0.05, 0.68, 8]} /><meshStandardMaterial color="#5c4028" roughness={0.9} /></mesh>
        ))}
      </group>
    </group>
  );
}

function Bird({ phase }: { phase: number }) {
  const left = useRef<THREE.Mesh>(null!);
  const right = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const flap = Math.sin(phase * 3) * 0.7;
    if (left.current) left.current.rotation.z = flap;
    if (right.current) right.current.rotation.z = -flap;
  });
  return (
    <group scale={0.6}>
      <mesh castShadow><sphereGeometry args={[0.16, 12, 8]} /><meshStandardMaterial color="#d8d3c4" roughness={0.85} /></mesh>
      <mesh ref={left} position={[-0.12, 0, 0]}><planeGeometry args={[0.5, 0.14]} /><meshStandardMaterial color="#8f887a" side={THREE.DoubleSide} roughness={0.9} /></mesh>
      <mesh ref={right} position={[0.12, 0, 0]}><planeGeometry args={[0.5, 0.14]} /><meshStandardMaterial color="#8f887a" side={THREE.DoubleSide} roughness={0.9} /></mesh>
      <mesh position={[0, 0, -0.16]} rotation-x={Math.PI / 2}><coneGeometry args={[0.05, 0.16, 8]} /><meshStandardMaterial color="#e0b23a" roughness={0.7} /></mesh>
    </group>
  );
}

function Fish({ phase }: { phase: number }) {
  const tail = useRef<THREE.Mesh>(null!);
  useFrame(() => { if (tail.current) tail.current.rotation.y = Math.sin(phase * 4) * 0.5; });
  return (
    <group scale={0.5} rotation-x={0} >
      <mesh rotation-z={Math.PI / 2} castShadow><capsuleGeometry args={[0.12, 0.4, 6, 10]} /><meshStandardMaterial color="#5aa3c9" metalness={0.3} roughness={0.5} /></mesh>
      <mesh ref={tail} position={[0, 0, -0.32]}><coneGeometry args={[0.16, 0.24, 8]} /><meshStandardMaterial color="#3d7fa3" metalness={0.3} roughness={0.5} /></mesh>
    </group>
  );
}

function Quadruped({ phase, fleeing, body, ear }: { phase: number; fleeing: boolean; body: string; ear: string }) {
  const legRef = useRef<THREE.Group>(null!);
  const tail = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const swing = Math.sin(phase) * (fleeing ? 0.5 : 0.28);
    if (legRef.current) legRef.current.children.forEach((leg, i) => { leg.rotation.x = (i % 2 === 0 ? swing : -swing) * (i < 2 ? 1 : -1); });
    if (tail.current) tail.current.rotation.y = Math.sin(phase * 1.5) * 0.4;
  });
  return (
    <group scale={0.55}>
      <RoundedBox args={[0.4, 0.36, 0.75]} radius={0.1} smoothness={4} position={[0, 0.5, 0]} castShadow><meshStandardMaterial color={body} roughness={0.85} /></RoundedBox>
      <RoundedBox args={[0.28, 0.28, 0.3]} radius={0.07} smoothness={4} position={[0, 0.62, 0.5]} castShadow><meshStandardMaterial color={body} roughness={0.85} /></RoundedBox>
      {[[-0.1, 0.82, 0.58], [0.1, 0.82, 0.58]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}><coneGeometry args={[0.06, 0.14, 8]} /><meshStandardMaterial color={ear} roughness={0.8} /></mesh>
      ))}
      <mesh ref={tail} position={[0, 0.6, -0.45]} rotation-x={0.6}><coneGeometry args={[0.05, 0.32, 8]} /><meshStandardMaterial color={body} roughness={0.85} /></mesh>
      <group ref={legRef} position={[0, 0.28, 0]}>
        {[[-0.14, 0, 0.28], [0.14, 0, 0.28], [-0.14, 0, -0.28], [0.14, 0, -0.28]].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]}><cylinderGeometry args={[0.045, 0.04, 0.44, 8]} /><meshStandardMaterial color={body} roughness={0.85} /></mesh>
        ))}
      </group>
    </group>
  );
}

function Snake({ phase }: { phase: number }) {
  const segments = 6;
  return (
    <group scale={0.7}>
      {Array.from({ length: segments }, (_, i) => {
        const t = i / (segments - 1);
        const lateral = Math.sin(phase * 3 - i * 0.9) * 0.16;
        return (
          <mesh key={i} position={[lateral, 0.06, -t * 0.9]} castShadow>
            <sphereGeometry args={[0.12 * (1 - t * 0.45), 8, 6]} />
            <meshStandardMaterial color={i === 0 ? "#8a9a4a" : "#6f8a3f"} roughness={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

function CritterView({ critter, sharedRef }: { critter: Critter; sharedRef: React.RefObject<Critter[]> }) {
  const group = useRef<THREE.Group>(null!);
  const live = useRef(critter);
  useFrame(() => {
    const current = sharedRef.current?.find((c) => c.id === critter.id) ?? critter;
    live.current = current;
    if (!group.current) return;
    const isFish = current.species === "FISH";
    const y = isFish ? Math.min(WATER_LEVEL - 0.6, heightAt(current.x, current.z)) + Math.sin(current.phase * 0.7) * 0.3 : heightAt(current.x, current.z);
    group.current.position.set(current.x, y, current.z);
    group.current.quaternion.setFromAxisAngle(UP, current.heading);
    const bob = current.state !== "IDLE" ? Math.abs(Math.sin(current.phase)) * 0.05 : 0;
    group.current.position.y += bob;
  });
  const species = critter.species;
  const fleeing = live.current.state === "FLEE";
  return (
    <group ref={group}>
      {species === "DEER" && <Deer phase={critter.phase} fleeing={fleeing} />}
      {species === "BIRD" && <Bird phase={critter.phase} />}
      {species === "FISH" && <Fish phase={critter.phase} />}
      {species === "DOG" && <Quadruped phase={critter.phase} fleeing={fleeing} body="#7a5a3a" ear="#5c4028" />}
      {species === "CAT" && <Quadruped phase={critter.phase} fleeing={fleeing} body="#3a3a3a" ear="#e0a44a" />}
      {species === "SNAKE" && <Snake phase={critter.phase} />}
    </group>
  );
}

export function Wildlife({ playerRef }: { playerRef: React.RefObject<THREE.Object3D> }) {
  const critters = useMemo(() => buildSpawnList(), []);
  const crittersRef = useRef<Critter[]>(critters);
  const rndRef = useRef(mulberry32(909));
  const lastPlayer = useRef({ x: 0, z: 0, init: false });

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.08);
    const p = playerRef.current;
    if (!p) return;
    if (!lastPlayer.current.init) {
      lastPlayer.current = { x: p.position.x, z: p.position.z, init: true };
    }
    const moved = Math.hypot(p.position.x - lastPlayer.current.x, p.position.z - lastPlayer.current.z);
    const moving = moved > 0.01;
    lastPlayer.current.x = p.position.x;
    lastPlayer.current.z = p.position.z;
    for (const c of crittersRef.current) {
      // only bother stepping AI for critters anywhere near the player — cheap distance culling so
      // dozens of animals off in other regions don't all run their wander logic every frame
      if (Math.hypot(c.x - p.position.x, c.z - p.position.z) > 140) continue;
      stepCritter(c, dt, p.position.x, p.position.z, moving, rndRef.current);
    }
  });

  return (
    <group>
      {critters.map((c) => (
        <CritterView key={c.id} critter={c} sharedRef={crittersRef} />
      ))}
    </group>
  );
}
