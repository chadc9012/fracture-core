import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { walkHeight } from "@/game/terrain";
import { FactionEnemy, type DriveRef } from "./EnemyModel";

const TRACER_LIFE = 0.09;
const TRACER_POOL = 12;

/** Presentation for the AI squadmates (squad.ts): armored troopers with a run cycle, rifle, muzzle flash and tracers.
 * Reads sim.squad only; never applies damage or moves anyone. The body falls back to a procedural trooper if the model can't load. */
export function Squad({ sim }: { sim: WorldSim }) {
  const mates = useRef<THREE.Group>(null);
  const tracers = useRef<THREE.Group>(null);
  const drives = useMemo(() => [0, 1].map(() => ({ current: { speed: 0, aiming: false } })), []);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);

  useFrame((_, dt) => {
    const root = mates.current, tr = tracers.current;
    if (!root || !tr) return;
    const sq = sim.squad;
    root.visible = sq.enabled;
    tr.visible = sq.enabled;
    if (!sq.enabled) return;
    sq.mates.forEach((m, i) => {
      const g = root.children[i] as THREE.Group | undefined;
      if (!g) return;
      g.position.set(m.x, walkHeight(m.x, m.z), m.z);
      g.rotation.y = m.yaw;
      const d = drives[i]; if (d) { d.current.speed = m.speed; d.current.aiming = m.firing > 0.06; }
      const flash = g.children[2];
      if (flash) { flash.visible = m.firing > 0.06; if (flash.visible) flash.rotation.z = Math.random() * Math.PI; }
    });
    // tracers: newest shots, fading quickly
    const now = sq.clock;
    const live = sq.shots.filter((s) => now - s.at < TRACER_LIFE).slice(-TRACER_POOL);
    tr.children.forEach((c, i) => {
      const s = live[i];
      c.visible = !!s;
      if (!s) return;
      tmp.a.set(s.fromX, walkHeight(s.fromX, s.fromZ) + 1.35, s.fromZ);
      tmp.b.set(s.toX, walkHeight(s.toX, s.toZ) + 1.1, s.toZ);
      const len = tmp.a.distanceTo(tmp.b);
      c.position.copy(tmp.a).lerp(tmp.b, 0.5);
      c.lookAt(tmp.b);
      c.scale.set(1, 1, len);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - (now - s.at) / TRACER_LIFE);
    });
  });

  return (
    <group>
      <group ref={mates}>
        {[0, 1].map((i) => <Trooper key={i} drive={drives[i]!} />)}
      </group>
      <group ref={tracers}>
        {Array.from({ length: TRACER_POOL }, (_, i) => (
          <mesh key={i} visible={false}>
            <boxGeometry args={[0.04, 0.04, 1]} />
            <meshBasicMaterial color="#ffd27a" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** children read by Squad: [body, ally marker, muzzle flash]. The body is the authored Vanguard elite trooper
 * (enemy-visuals.ts, animated from the mate's speed and firing); a cyan chevron over the head marks it friendly. */
function Trooper({ drive }: { drive: DriveRef }) {
  return (
    <group>
      <FactionEnemy kind="VANGUARD" role="elite" drive={drive} />
      <mesh position={[0, 2.35, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.12, 0.22, 3]} /><meshBasicMaterial color="#5fe6ff" toneMapped={false} /></mesh>
      <mesh position={[0.05, 1.35, 0.95]} visible={false}>
        <planeGeometry args={[0.45, 0.45]} />
        <meshBasicMaterial color="#ffcf6a" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
