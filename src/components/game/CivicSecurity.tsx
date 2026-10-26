import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { BASTION, SECURITY, step, wanted, type SecurityState } from "@/game/civic-security";
import { NEON_SITE } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import { Text } from "./SafeText";

/** What the security units share with Scene each frame: whether any unit sees the player, and whether one has caught them. */
export type SecurityFeed = { seen: boolean; caught: boolean };

type Unit = { home: { x: number; z: number }; phase: number; radius: number; kind: "bot" | "soldier"; force: "neon" | "base" };
const UNITS: Unit[] = [
  { home: { x: NEON_SITE.x - 22, z: NEON_SITE.z + 8 }, phase: 0, radius: 14, kind: "bot", force: "neon" },
  { home: { x: NEON_SITE.x + 24, z: NEON_SITE.z - 14 }, phase: 2.2, radius: 16, kind: "bot", force: "neon" },
  { home: { x: NEON_SITE.x + 4, z: NEON_SITE.z + 30 }, phase: 4.4, radius: 12, kind: "bot", force: "neon" },
  { home: { x: NEON_SITE.x - 6, z: NEON_SITE.z - 48 }, phase: 1.1, radius: 18, kind: "bot", force: "neon" },
  { home: { x: BASTION.x, z: BASTION.z - 24 }, phase: 0, radius: 28, kind: "soldier", force: "base" },
  { home: { x: BASTION.x, z: BASTION.z + 24 }, phase: 2.7, radius: 28, kind: "soldier", force: "base" },
];

/** One security unit: walks its beat; when the player is wanted and in sight it chases, searches the last-seen spot after
 * losing them, and reports a catch when it gets within reach. No damage, ever. */
function Patrol({ u, player, security, feed, jurisdiction }: { u: Unit; player: MutableRefObject<THREE.Group>; security: MutableRefObject<SecurityState>; feed: MutableRefObject<SecurityFeed>; jurisdiction: MutableRefObject<string> }) {
  const ref = useRef<THREE.Group>(null);
  const lastSeen = useRef<{ x: number; z: number } | null>(null);
  const lights = useRef<THREE.MeshBasicMaterial[]>([]);
  useFrame(({ clock }, raw) => {
    const g = ref.current; if (!g) return;
    const dt = Math.min(raw, 0.1), t = clock.elapsedTime * 0.3 + u.phase;
    const beat = { x: u.home.x + Math.cos(t) * u.radius, z: u.home.z + Math.sin(t) * u.radius };
    const p = player.current?.position, w = wanted(security.current.heat);
    const mine = jurisdiction.current === u.force;
    const sees = !!p && w > 0 && mine && Math.hypot(p.x - g.position.x, p.z - g.position.z) < SECURITY.sight;
    if (sees && p) { lastSeen.current = { x: p.x, z: p.z }; feed.current.seen = true; }
    if (w === 0) lastSeen.current = null;
    const goal = sees && p ? { x: p.x, z: p.z } : lastSeen.current ?? beat;
    const speed = w > 0 && lastSeen.current ? SECURITY.chaseBase + w * SECURITY.chasePerStar : SECURITY.patrolSpeed;
    const next = step({ x: g.position.x, z: g.position.z }, goal, speed, dt);
    if (lastSeen.current && !sees && Math.hypot(next.x - lastSeen.current.x, next.z - lastSeen.current.z) < 1.5 && security.current.searchLeft <= 0) lastSeen.current = null;
    const yaw = Math.atan2(goal.x - g.position.x, goal.z - g.position.z);
    g.position.set(next.x, walkHeight(next.x, next.z) + (u.kind === "bot" ? 0.25 + Math.sin(clock.elapsedTime * 3 + u.phase) * 0.08 : 0), next.z);
    if (Math.abs(goal.x - g.position.x) + Math.abs(goal.z - g.position.z) > 0.05) g.rotation.y = yaw;
    if (sees && p && Math.hypot(p.x - next.x, p.z - next.z) < SECURITY.catchRange) feed.current.caught = true;
    // light bar: red/blue strobe while chasing, steady cyan on patrol
    const chase = w > 0 && !!lastSeen.current, on = Math.sin(clock.elapsedTime * 14) > 0;
    lights.current.forEach((m, i) => m.color.set(chase ? ((i === 0) === on ? "#ff2a4a" : "#2a6aff") : "#33ddff").multiplyScalar(chase ? 3 : 1.6));
  });
  const mats = useMemo(() => ({
    shell: new THREE.MeshStandardMaterial({ color: u.kind === "bot" ? "#2b3448" : "#4d5f55", metalness: u.kind === "bot" ? 0.8 : 0.2, roughness: u.kind === "bot" ? 0.3 : 0.7 }),
    plate: new THREE.MeshStandardMaterial({ color: u.kind === "bot" ? "#c3d1dd" : "#283a3c", metalness: 0.7, roughness: 0.3 }),
    a: new THREE.MeshBasicMaterial({ color: "#33ddff", toneMapped: false }), b: new THREE.MeshBasicMaterial({ color: "#33ddff", toneMapped: false }),
  }), [u.kind]);
  lights.current = [mats.a, mats.b];
  return (
    <group ref={ref} name={`security:${u.kind}`} position={[u.home.x, walkHeight(u.home.x, u.home.z), u.home.z]}>
      {u.kind === "bot" ? <>
        <mesh material={mats.shell} position-y={1.1} castShadow><capsuleGeometry args={[0.46, 0.9, 5, 10]} /></mesh>
        <mesh material={mats.plate} position-y={1.95} castShadow><boxGeometry args={[0.78, 0.42, 0.62]} /></mesh>
        <mesh material={mats.a} position={[-0.17, 2.0, 0.32]}><boxGeometry args={[0.26, 0.1, 0.04]} /></mesh>
        <mesh material={mats.b} position={[0.17, 2.0, 0.32]}><boxGeometry args={[0.26, 0.1, 0.04]} /></mesh>
        {[-1, 1].map((s) => <mesh key={s} material={mats.plate} position={[s * 0.6, 1.2, 0]}><boxGeometry args={[0.22, 0.8, 0.26]} /></mesh>)}
      </> : <>
        <mesh material={mats.shell} position-y={1.1} castShadow><capsuleGeometry args={[0.38, 1.1, 5, 10]} /></mesh>
        <mesh material={mats.plate} position-y={2.05} castShadow><sphereGeometry args={[0.36, 12, 10]} /></mesh>
        <mesh material={mats.a} position={[0, 2.05, 0.3]}><boxGeometry args={[0.4, 0.08, 0.06]} /></mesh>
        <mesh material={mats.b} position={[0.3, 1.3, 0.25]}><boxGeometry args={[0.12, 0.12, 0.7]} /></mesh>
      </>}
    </group>
  );
}

/** Bastion Command: perimeter walls with a gate, corner towers, barracks / armory / motor pool / command, and the open
 * training range with targets. Scenery; the restricted core is enforced by civic-security.ts. */
function Bastion() {
  const y = useMemo(() => walkHeight(BASTION.x, BASTION.z), []);
  const wall = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5e6c73", metalness: 0.35, roughness: 0.7 }), []);
  const roof = useMemo(() => new THREE.MeshStandardMaterial({ color: "#222c35", metalness: 0.5, roughness: 0.5 }), []);
  const block = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4c5a61", metalness: 0.4, roughness: 0.65 }), []);
  const pad = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a4246", roughness: 0.95 }), []);
  const X = BASTION.halfX, Z = BASTION.halfZ;
  return (
    <group name="site:bastion-command" position={[BASTION.x, y, BASTION.z]}>
      <mesh material={pad} position-y={0.06} receiveShadow><boxGeometry args={[X * 2, 0.14, Z * 2]} /></mesh>
      {[-1, 1].map((s) => <mesh key={`x${s}`} material={wall} position={[s * X, 2.4, 0]} castShadow><boxGeometry args={[1.2, 4.8, Z * 2]} /></mesh>)}
      <mesh material={wall} position={[0, 2.4, -Z]} castShadow><boxGeometry args={[X * 2, 4.8, 1.2]} /></mesh>
      {/* the south wall has a gate gap */}
      {[-1, 1].map((s) => <mesh key={`g${s}`} material={wall} position={[s * (X / 2 + 4), 2.4, Z]} castShadow><boxGeometry args={[X - 8, 4.8, 1.2]} /></mesh>)}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => <group key={`t${i}`} position={[a! * (X - 2), 0, b! * (Z - 2)]}>
        <mesh material={wall} position-y={5} castShadow><cylinderGeometry args={[2.4, 2.8, 10, 10]} /></mesh>
        <mesh material={roof} position-y={10.6}><cylinderGeometry args={[3.2, 2.6, 1.2, 10]} /></mesh>
      </group>)}
      {([[-20, -16, 22, 13, "BARRACKS"], [14, -18, 20, 14, "ARMORY"], [-20, 14, 22, 14, "MOTOR POOL"], [-2, 0, 14, 12, "COMMAND"]] as const).map(([x, z, w, d, name]) => <group key={name} position={[x, 0, z]}>
        <mesh material={block} position-y={2.6} castShadow receiveShadow><boxGeometry args={[w, 5.2, d]} /></mesh>
        <mesh material={roof} position-y={5.45}><boxGeometry args={[w + 1, 0.5, d + 1]} /></mesh>
        <Text position={[0, 3.4, d / 2 + 0.12]} fontSize={1.1} color="#d2f1ff" anchorX="center">{name}</Text>
      </group>)}
      <group position={[BASTION.range.dx, 0, BASTION.range.dz]}>
        <mesh position-y={0.18} receiveShadow><cylinderGeometry args={[BASTION.range.r, BASTION.range.r, 0.2, 32]} /><meshStandardMaterial color="#55554b" roughness={1} /></mesh>
        {[-1, 0, 1].map((i) => <group key={i} position={[i * 5, 0, -BASTION.range.r + 2]}>
          <mesh position-y={1.6} material={wall}><boxGeometry args={[1.4, 3.2, 0.3]} /></mesh>
          <mesh position={[0, 2, 0.2]}><circleGeometry args={[0.5, 16]} /><meshStandardMaterial color="#ff7d5c" emissive="#702315" emissiveIntensity={0.4} /></mesh>
        </group>)}
        <Text position={[0, 3.6, BASTION.range.r]} fontSize={0.9} color="#f5df9d" anchorX="center">OPEN TRAINING RANGE</Text>
      </group>
      <Text position={[0, 7.4, Z + 0.7]} fontSize={2.2} color="#cde9fa" anchorX="center">BASTION COMMAND</Text>
    </group>
  );
}

export function CivicSecurity({ player, security, feed, jurisdiction }: { player: MutableRefObject<THREE.Group>; security: MutableRefObject<SecurityState>; feed: MutableRefObject<SecurityFeed>; jurisdiction: MutableRefObject<string> }) {
  return (
    <group name="civic-security">
      <Bastion />
      {UNITS.map((u, i) => <Patrol key={i} u={u} player={player} security={security} feed={feed} jurisdiction={jurisdiction} />)}
    </group>
  );
}
