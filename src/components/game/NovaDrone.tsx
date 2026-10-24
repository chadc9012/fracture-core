import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { droneStation, stepDrone, type DronePose } from "@/game/nova-drone";

type Held = { current: { x: number; y: number; z: number; yaw: number; inVehicle?: boolean } };

/** NOVA's hovering field drone (rules: nova-drone.ts), keeping station at the Operator's left shoulder: a compact
 * gunmetal hull, three ducted rotors on short arms (props spin), an under-slung sensor gimbal with a cyan eye and an
 * amber status strip. Built once (drone-geometry below), presentation only; hidden while driving and when it drifts
 * right up against the camera, so it never fills the lens. No lights (the glow is emissive). */
const DRONE = (() => {
  const hull = new THREE.LatheGeometry([[0.001, -0.07], [0.16, -0.08], [0.22, -0.04], [0.23, 0.02], [0.18, 0.07], [0.08, 0.1], [0.001, 0.1]].map(([r, y]) => new THREE.Vector2(r!, y!)), 18);
  const duct = new THREE.TorusGeometry(0.11, 0.022, 6, 20).rotateX(Math.PI / 2);
  const arm = new THREE.BoxGeometry(0.2, 0.025, 0.04).translate(0.1, 0, 0);
  const prop = new THREE.BoxGeometry(0.2, 0.006, 0.025);
  const gimbal = new THREE.SphereGeometry(0.06, 12, 8);
  const strip = new THREE.TorusGeometry(0.232, 0.009, 4, 36).rotateX(Math.PI / 2);
  return { hull, duct, arm, prop, gimbal, strip };
})();
const ROTORS = [0, 1, 2].map((i) => (i / 3) * Math.PI * 2 + Math.PI / 6);
const _cam = new THREE.Vector3();
export function NovaDrone({ held }: { held: Held }) {
  const root = useRef<THREE.Group>(null);
  const props = useRef<(THREE.Mesh | null)[]>([]);
  const pose = useRef<DronePose | null>(null);
  useFrame(({ clock, camera }, delta) => {
    const s = held.current, g = root.current;
    if (!g) return;
    if (s.inVehicle) { g.visible = false; return; }
    const t = clock.elapsedTime;
    const target = droneStation(s.x, s.y, s.z, s.yaw, t);
    pose.current = pose.current ? stepDrone(pose.current, target, Math.min(delta, 0.1)) : target;
    const p = pose.current;
    g.position.set(p.x, p.y, p.z);
    g.rotation.set(Math.sin(t * 1.3) * 0.08, p.yaw, Math.cos(t * 1.1) * 0.08);
    camera.getWorldPosition(_cam);
    g.visible = _cam.distanceTo(g.position) > 2.2; // a third-person camera swinging past it never gets a lens full of drone
    props.current.forEach((m, i) => { if (m) m.rotation.y = t * (38 + i * 3); });
  });
  return (
    <group ref={root} scale={0.7}>
      <mesh geometry={DRONE.hull} castShadow><meshStandardMaterial color="#4a5059" metalness={0.75} roughness={0.42} /></mesh>
      <mesh geometry={DRONE.strip} position-y={0.0}><meshBasicMaterial color="#ffb347" toneMapped={false} /></mesh>
      {ROTORS.map((a, i) => (
        <group key={i} rotation-y={a}>
          <mesh geometry={DRONE.arm} position={[0.16, 0.02, 0]}><meshStandardMaterial color="#2e3238" metalness={0.6} roughness={0.5} /></mesh>
          <group position={[0.42, 0.03, 0]}>
            <mesh geometry={DRONE.duct}><meshStandardMaterial color="#3a3f46" metalness={0.7} roughness={0.4} /></mesh>
            <mesh ref={(m) => { props.current[i] = m; }} geometry={DRONE.prop}><meshStandardMaterial color="#1c1e22" roughness={0.6} transparent opacity={0.55} /></mesh>
          </group>
        </group>
      ))}
      <group position={[0, -0.1, 0.06]}>
        <mesh geometry={DRONE.gimbal}><meshStandardMaterial color="#25282d" metalness={0.8} roughness={0.3} /></mesh>
        <mesh position={[0, 0, 0.05]}><sphereGeometry args={[0.024, 10, 8]} /><meshBasicMaterial color="#63f2ff" toneMapped={false} /></mesh>
      </group>
    </group>
  );
}
