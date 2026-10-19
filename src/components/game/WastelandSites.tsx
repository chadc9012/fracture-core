import { useFrame } from "@react-three/fiber";
import { DistrictLight } from "./DistrictLight";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { heightAt } from "@/game/terrain";
import { ARENA, RALLY_REACH, RUST_RUN, VAULT_GATE } from "@/game/wasteland-activities";
import type { WasteRuntime } from "@/game/wasteland-runtime";

/** Wastelands activity sites (presentation only; wasteland-runtime.ts decides everything): the Sub-Terra Apex vault gate,
 * the Mash-Pit arena ring and the Rust Run start arch + checkpoint rings (the next one lit while a run is going). */
const SHOW = 280;

function label(text: string, sub: string, color: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const g = c.getContext("2d"); if (!g) return null;
  g.fillStyle = "rgba(10,8,6,0.78)"; g.fillRect(0, 14, 512, 100); g.fillStyle = color; g.fillRect(0, 14, 10, 100);
  g.font = "700 46px 'Rajdhani','Segoe UI',sans-serif"; g.fillStyle = "#f4ede2"; g.textBaseline = "middle"; g.fillText(text.toUpperCase(), 28, 48);
  g.font = "500 26px 'Rajdhani','Segoe UI',sans-serif"; g.fillStyle = color; g.fillText(sub.toUpperCase(), 28, 90);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function useNear(playerRef: React.RefObject<THREE.Object3D>, x: number, z: number) {
  const g = useRef<THREE.Group>(null!);
  useFrame(() => { const p = playerRef.current; if (p && g.current) g.current.visible = Math.hypot(p.position.x - x, p.position.z - z) < SHOW; });
  return g;
}

function VaultGate({ playerRef }: { playerRef: React.RefObject<THREE.Object3D> }) {
  const g = useNear(playerRef, VAULT_GATE.x, VAULT_GATE.z);
  const y = useMemo(() => heightAt(VAULT_GATE.x, VAULT_GATE.z), []);
  const tex = useMemo(() => label("Sub-Terra Apex", "Vault gate · stand on the pad to defend", "#ffb23e"), []);
  // the portal faces the arrival side (west, toward Rust Port); the pad sits in front of it
  return (
    <group ref={g} position={[VAULT_GATE.x, y, VAULT_GATE.z]}>
      <group position={[8, 0, 0]} rotation-y={-Math.PI / 2}>
        {[-6, 6].map((x) => <mesh key={x} position={[x, 4, 0]} castShadow><boxGeometry args={[3, 8, 4]} /><meshStandardMaterial color="#4b4741" roughness={0.9} /></mesh>)}
        <mesh position={[0, 8.6, 0]} castShadow><boxGeometry args={[16, 2, 4.4]} /><meshStandardMaterial color="#3d3a35" roughness={0.9} /></mesh>
        <mesh position={[0, 3.6, -0.6]}><boxGeometry args={[9, 7.2, 0.6]} /><meshStandardMaterial color="#2c2a27" metalness={0.7} roughness={0.45} /></mesh>
        {[1.6, 3.6, 5.6].map((h) => <mesh key={h} position={[0, h, -0.25]}><boxGeometry args={[8.6, 0.12, 0.1]} /><meshStandardMaterial color="#ffb23e" emissive="#ffb23e" emissiveIntensity={1.8} toneMapped={false} /></mesh>)}
        <mesh position={[0, -1.4, 2.5]} rotation-x={-0.35}><boxGeometry args={[9, 0.4, 7]} /><meshStandardMaterial color="#35322e" roughness={0.95} /></mesh>
        {tex && <sprite position={[0, 11, 0.5]} scale={[7, 1.75, 1]}><spriteMaterial map={tex} transparent depthWrite={false} /></sprite>}
        <DistrictLight range={80} position={[0, 6, 3]} color="#ffb23e" intensity={8} distance={22} />
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 0]}><ringGeometry args={[VAULT_GATE.radius - 0.8, VAULT_GATE.radius, 48]} /><meshBasicMaterial color="#ffb23e" transparent opacity={0.65} toneMapped={false} /></mesh>
    </group>
  );
}

function Arena({ playerRef }: { playerRef: React.RefObject<THREE.Object3D> }) {
  const g = useNear(playerRef, ARENA.x, ARENA.z);
  const tex = useMemo(() => label("The Mash-Pit", "Drive in to start a derby round", "#ff5a3c"), []);
  const posts = useMemo(() => Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * Math.PI * 2; const x = ARENA.x + Math.cos(a) * ARENA.radius, z = ARENA.z + Math.sin(a) * ARENA.radius; return { x, z, y: heightAt(x, z), a }; }), []);
  const lights = useMemo(() => [0, 1, 2, 3].map((i) => { const a = (i / 4) * Math.PI * 2 + 0.4; const x = ARENA.x + Math.cos(a) * (ARENA.radius + 3), z = ARENA.z + Math.sin(a) * (ARENA.radius + 3); return { x, z, y: heightAt(x, z) }; }), []);
  const y0 = useMemo(() => heightAt(ARENA.x, ARENA.z), []);
  return (
    <group ref={g}>
      {posts.map((p, i) => i % 9 === 0 ? null : (
        <group key={i} position={[p.x, p.y, p.z]} rotation-y={-p.a}>
          <mesh position={[0, 0.45, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.55, 0.55, 0.45, 12]} /><meshStandardMaterial color="#141414" roughness={0.95} /></mesh>
          <mesh position={[0, 1.0, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.55, 0.55, 0.45, 12]} /><meshStandardMaterial color="#1b1b1b" roughness={0.95} /></mesh>
        </group>
      ))}
      {lights.map((l, i) => (
        <group key={i} position={[l.x, l.y, l.z]}>
          <mesh position={[0, 5, 0]}><cylinderGeometry args={[0.15, 0.2, 10, 6]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
          <mesh position={[0, 10, 0]}><boxGeometry args={[1.2, 0.5, 0.5]} /><meshStandardMaterial color="#fff4d0" emissive="#ffd88a" emissiveIntensity={2} toneMapped={false} /></mesh>
        </group>
      ))}
      <DistrictLight range={100} position={[ARENA.x, y0 + 12, ARENA.z]} color="#ffcf8a" intensity={10} distance={40} />
      {tex && <sprite position={[ARENA.x, y0 + 9, ARENA.z - ARENA.radius - 2]} scale={[8, 2, 1]}><spriteMaterial map={tex} transparent depthWrite={false} /></sprite>}
    </group>
  );
}

function Rally({ runtime, playerRef }: { runtime: React.RefObject<WasteRuntime | null>; playerRef: React.RefObject<THREE.Object3D> }) {
  const tex = useMemo(() => label(RUST_RUN.name, "Rally · drive through to start", "#38e8ff"), []);
  const start = useMemo(() => ({ ...RUST_RUN.start, y: heightAt(RUST_RUN.start.x, RUST_RUN.start.z) }), []);
  const cps = useMemo(() => RUST_RUN.checkpoints.map((c, i) => { const prev = i === 0 ? RUST_RUN.start : RUST_RUN.checkpoints[i - 1]!; return { ...c, y: heightAt(c.x, c.z), yaw: Math.atan2(c.x - prev.x, c.z - prev.z) }; }), []);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const startG = useNear(playerRef, start.x, start.z);
  useFrame((st) => {
    const run = runtime.current?.rally;
    rings.current.forEach((m, i) => {
      if (!m) return;
      const next = run ? run.next === i : false;
      m.visible = !!run && i >= run.next; // only the course ahead while a run is going
      (m.material as THREE.MeshBasicMaterial).opacity = next ? 0.85 + Math.sin(st.clock.elapsedTime * 6) * 0.1 : 0.25;
      m.scale.setScalar(next ? 1 : 0.8);
    });
  });
  return (
    <group>
      <group ref={startG} position={[start.x, start.y, start.z]} rotation-y={Math.atan2(RUST_RUN.checkpoints[0]!.x - start.x, RUST_RUN.checkpoints[0]!.z - start.z)}>
        {[-RALLY_REACH, RALLY_REACH].map((x) => <mesh key={x} position={[x, 3, 0]}><boxGeometry args={[0.8, 6, 0.8]} /><meshStandardMaterial color="#222" metalness={0.6} /></mesh>)}
        <mesh position={[0, 6.2, 0]}><boxGeometry args={[RALLY_REACH * 2 + 0.8, 0.8, 0.8]} /><meshStandardMaterial color="#38e8ff" emissive="#38e8ff" emissiveIntensity={1.4} toneMapped={false} /></mesh>
        {tex && <sprite position={[0, 8.2, 0]} scale={[8, 2, 1]}><spriteMaterial map={tex} transparent depthWrite={false} /></sprite>}
      </group>
      {cps.map((c, i) => (
        <mesh key={i} ref={(m) => { rings.current[i] = m; }} position={[c.x, c.y + RALLY_REACH * 0.55, c.z]} rotation-y={c.yaw} visible={false}>
          <torusGeometry args={[RALLY_REACH * 0.6, 0.35, 8, 40]} />
          <meshBasicMaterial color="#38e8ff" transparent opacity={0.3} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export function WastelandSites({ runtime, playerRef }: { runtime: React.RefObject<WasteRuntime | null>; playerRef: React.RefObject<THREE.Object3D> }) {
  return (
    <group name="wasteland-sites">
      <VaultGate playerRef={playerRef} />
      <Arena playerRef={playerRef} />
      <Rally runtime={runtime} playerRef={playerRef} />
    </group>
  );
}
