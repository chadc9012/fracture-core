import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";




import { FACTIONS, laneSamples, type WorldSim } from "@/game/sim";
import { getVoicePose, isBossSpeaker } from "@/game/voice-animation";
import { walkHeight } from "@/game/terrain";

/* ---------------- supply lanes (roads) ---------------- */

export function SupplyLanes({ sim }: { sim: WorldSim }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const width = 5.5;
    for (const lane of sim.lanes) {
      const pts = laneSamples(lane, 40);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        const nx = (-dz / len) * width;
        const nz = (dx / len) * width;
        const ay = walkHeight(a.x, a.z) + 0.35;
        const by = walkHeight(b.x, b.z) + 0.35;
        const quad = [
          [a.x + nx, ay, a.z + nz],
          [a.x - nx, ay, a.z - nz],
          [b.x - nx, by, b.z - nz],
          [a.x + nx, ay, a.z + nz],
          [b.x - nx, by, b.z - nz],
          [b.x + nx, by, b.z + nz],
        ];
        for (const v of quad) positions.push(v[0]!, v[1]!, v[2]!);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, [sim.lanes]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#2e2b26" roughness={0.9} transparent opacity={0.85} />
    </mesh>
  );
}

/* ---------------- faction beacons per zone ---------------- */

export function ZoneBeacons({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    sim.zones.forEach((z, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      const color = FACTIONS[z.owner].color;
      node.children.forEach((child) => {
        const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.color) {
          m.color.set(color);
          if (m.emissive) m.emissive.set(color);
        }
      });
      node.scale.y = z.contested ? 1 + Math.sin(performance.now() * 0.006) * 0.25 : 1;
    });
  });

  return (
    <group ref={group}>
      {sim.zones.map((z) => {
        const y = walkHeight(z.region.x, z.region.z);
        return (
          <group key={z.region.id} position={[z.region.x, y, z.region.z]}>
            <mesh position-y={20}>
              <cylinderGeometry args={[0.4, 0.9, 46, 6, 1, true]} />
              <meshStandardMaterial
                color={FACTIONS[z.owner].color}
                emissive={FACTIONS[z.owner].color}
                emissiveIntensity={1.6}
                transparent
                depthWrite={false}
                opacity={0.18}
                side={THREE.DoubleSide}
                toneMapped={false}
              />
            </mesh>
            <mesh position-y={0.6} rotation-x={-Math.PI / 2}>
              <ringGeometry args={[8, 10, 40]} />
              <meshStandardMaterial
                color={FACTIONS[z.owner].color}
                emissive={FACTIONS[z.owner].color}
                emissiveIntensity={1.4}
                transparent
                opacity={0.6}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ---------------- AI war machines — quad "walking tank" (concept-art reference) ---------------- */

/** Sand-and-gunmetal palette taken from the reference sheets. */
const HULL = "#b9a67c";
const HULL_DARK = "#8d7c58";
const STEEL = "#3c4149";
const STEEL_DARK = "#22262b";

function Leg({ side, front }: { side: 1 | -1; front: 1 | -1 }) {
  return (
    <group position={[1.6 * side, -0.4, 1.5 * front]} rotation={[0, side > 0 ? 0.25 : -0.25, 0]}>
      {/* hip */}
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color={STEEL} metalness={0.55} roughness={0.5} />
      </mesh>
      {/* thigh angled outward */}
      <mesh position={[0.8 * side, -0.7, 0.5 * front]} rotation={[0.5 * front, 0, -0.6 * side]} castShadow>
        <boxGeometry args={[0.55, 2.2, 0.7]} />
        <meshStandardMaterial color={HULL_DARK} metalness={0.3} roughness={0.7} />
      </mesh>
      {/* shin down to the foot */}
      <mesh position={[1.5 * side, -2.1, 1.0 * front]} rotation={[0.25 * front, 0, 0.15 * side]} castShadow>
        <boxGeometry args={[0.42, 2.4, 0.5]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.55} />
      </mesh>
      {/* foot pad */}
      <mesh position={[1.7 * side, -3.2, 1.2 * front]} castShadow>
        <boxGeometry args={[1, 0.3, 1.5]} />
        <meshStandardMaterial color={STEEL_DARK} roughness={0.9} />
      </mesh>
    </group>
  );
}

function WalkingTank() {
  return (
    <group>
      {/* lower chassis */}
      <mesh castShadow>
        <boxGeometry args={[3.2, 1.5, 4.6]} />
        <meshStandardMaterial color={HULL} metalness={0.25} roughness={0.75} />
      </mesh>
      {/* sloped armour deck */}
      <mesh position={[0, 1.1, -0.2]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[2.9, 0.7, 3.6]} />
        <meshStandardMaterial color={HULL_DARK} metalness={0.25} roughness={0.7} />
      </mesh>
      {/* side skirts */}
      <mesh position={[-1.75, 0.1, 0]} castShadow>
        <boxGeometry args={[0.3, 1.3, 4.2]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[1.75, 0.1, 0]} castShadow>
        <boxGeometry args={[0.3, 1.3, 4.2]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.6} />
      </mesh>
      {/* turret */}
      <mesh position={[0, 2.05, -0.1]} castShadow>
        <boxGeometry args={[2.1, 1, 2.4]} />
        <meshStandardMaterial color={HULL} metalness={0.3} roughness={0.65} />
      </mesh>
      {/* rail gun barrel */}
      <mesh position={[0.25, 2.1, 2.4]} castShadow>
        <boxGeometry args={[0.42, 0.42, 4.2]} />
        <meshStandardMaterial color={STEEL_DARK} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* close-quarters cannon pod */}
      <mesh position={[-1.1, 2.4, 1.1]} rotation={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.7, 0.6, 1.8]} />
        <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.35} />
      </mesh>
      {/* sensor strip */}
      <mesh position={[0, 2.5, 1.15]}>
        <boxGeometry args={[1.3, 0.16, 0.1]} />
        <meshStandardMaterial color="#ff5a3c" emissive="#ff3a20" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <Leg side={1} front={1} />
      <Leg side={-1} front={1} />
      <Leg side={1} front={-1} />
      <Leg side={-1} front={-1} />
    </group>
  );
}

function RegionalEnemy({ kind, boss }: { kind: "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD"; boss: boolean }) {
  const metal = kind === "RAIDER" ? "#765949" : kind === "ABERRATION" ? "#375c43" : kind === "VANGUARD" ? "#5b7481" : "#636c85";
  const glow = kind === "RAIDER" ? "#f36b33" : kind === "ABERRATION" ? "#83dc89" : "#58d8ef";
  const head = useRef<THREE.Group>(null!);
  const visor = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame((state) => {
    // bosses react to their own spoken lines: visor flicker with loudness, menacing lean
    if (!boss) return;
    const pose = getVoicePose(isBossSpeaker, state.clock.elapsedTime);
    if (visor.current) visor.current.emissiveIntensity = 2 * pose.glow * (pose.talking ? 0.8 + Math.random() * 0.4 : 1);
    if (head.current) head.current.rotation.x = pose.lean + pose.jaw * 0.2;
  });
  return <group>
    <RoundedBox args={[1.4, 2.2, 0.8]} radius={0.16} smoothness={4} position-y={2.1} castShadow><meshStandardMaterial color={metal} roughness={0.55} metalness={kind === "ABERRATION" ? 0.1 : 0.65} /></RoundedBox>
    <group ref={head} position-y={3.65}>
      <mesh castShadow><icosahedronGeometry args={[0.68, 2]} /><meshStandardMaterial color={metal} metalness={0.5} roughness={0.4} /></mesh>
      <RoundedBox args={[0.9, 0.2, 0.16]} radius={0.04} smoothness={2} position={[0, 0, 0.59]}><meshStandardMaterial ref={visor} color={glow} emissive={glow} emissiveIntensity={2} /></RoundedBox>
    </group>
    {[-1, 1].map((side) => <group key={side}>
      <mesh position={[side * 1.04, 2, 0]} rotation-z={side * 0.25} castShadow><capsuleGeometry args={[0.25, 1.15, 4, 6]} /><meshStandardMaterial color={metal} metalness={0.5} /></mesh>
      <mesh position={[side * 0.45, 0.58, 0]} castShadow><capsuleGeometry args={[0.3, 1.2, 4, 6]} /><meshStandardMaterial color={metal} metalness={0.35} /></mesh>
      {(kind === "ABERRATION" || boss) && <mesh position={[side * 0.7, 4.25, 0]} rotation-z={side * -0.35} castShadow><coneGeometry args={[0.24, 1.25, 5]} /><meshStandardMaterial color={glow} roughness={0.7} /></mesh>}
    </group>)}
    {kind === "RAIDER" && <mesh position={[1.3, 1.9, 1]} rotation-x={Math.PI / 2} castShadow><cylinderGeometry args={[0.18, 0.3, 2.6, 8]} /><meshStandardMaterial color="#302f32" metalness={0.75} /></mesh>}
    {kind === "OVERCLOCKED" && <mesh position={[0, 2.1, 0.5]}><octahedronGeometry args={[0.38]} /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.8} /></mesh>}
    {boss && <mesh position-y={2.5} rotation-x={Math.PI / 2}><torusGeometry args={[2.2, 0.08, 6, 24]} /><meshBasicMaterial color={glow} /></mesh>}
  </group>;
}

export function WarMachines({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    sim.machines.forEach((m, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      node.visible = m.alive;
      if (!m.alive) return;
      const modelName = m.boss ? "boss-model" : m.kind === "OVERCLOCKED" ? "overclocked-model" : m.kind === "ABERRATION" ? "aberration-model" : m.kind === "VANGUARD" ? "vanguard-model" : "regional-model";
      for (const child of node.children) child.visible = child.name === "elite-ring" ? m.elite && !m.boss : child.name === modelName;
      // walking gait: subtle body bob + roll so the legs read as striding
      const gait = t * 3 + i;
      node.position.set(m.x, m.y - 2.2 * m.scale + Math.abs(Math.sin(gait)) * 0.28, m.z);
      node.rotation.set(Math.sin(gait) * 0.03, m.rot, Math.sin(gait * 0.5) * 0.05);
      // attack telegraph: a fast pulse while the machine winds up a ranged shot
      node.scale.setScalar(m.scale * ((m.aim ?? 0) > 0 ? 1 + Math.abs(Math.sin(t * 28)) * 0.1 : 1));
    });
  });

  return (
    <group ref={group}>
      {sim.machines.map((_, i) => (
        <group key={i} visible={false}>
          <group name="regional-model" visible={false}><RegionalEnemy kind="RAIDER" boss={false} /></group>
          <group name="overclocked-model" visible={false}><RegionalEnemy kind="OVERCLOCKED" boss={false} /></group>
          <group name="aberration-model" visible={false}><RegionalEnemy kind="ABERRATION" boss={false} /></group>
          <group name="vanguard-model" visible={false}><RegionalEnemy kind="VANGUARD" boss={false} /></group>
          <group name="boss-model" visible={false}><RegionalEnemy kind="OVERCLOCKED" boss /></group>
          {/* loot cue: elites (better drops) wear a glowing amber ring at their feet, like Diablo's elite tell */}
          <mesh name="elite-ring" visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.9, 0]}><ringGeometry args={[2.6, 3.1, 40]} /><meshBasicMaterial color="#ffb357" transparent opacity={0.85} depthWrite={false} /></mesh>
        </group>
      ))}
    </group>
  );
}


/* ---------------- NPC convoy trucks — armoured 6x6 hauler (concept-art reference) ---------------- */

function ArmoredHauler() {
  const wheelZ = [3.1, -0.6, -2.2];
  return (
    <group>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[3.1, 0.5, 10.4]} />
        <meshStandardMaterial color={STEEL_DARK} metalness={0.6} roughness={0.6} />
      </mesh>
      {/* armoured cab + sloped windscreen plate */}
      <mesh position={[0, 2.1, 3.2]} castShadow>
        <boxGeometry args={[3.3, 2.1, 3]} />
        <meshStandardMaterial color="#6d7176" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.75, 4.6]} rotation={[-0.32, 0, 0]} castShadow>
        <boxGeometry args={[3, 1.2, 0.22]} />
        <meshStandardMaterial color="#2b3238" metalness={0.75} roughness={0.25} />
      </mesh>
      {/* grille guard + headlights */}
      <mesh position={[0, 1.6, 5]} castShadow>
        <boxGeometry args={[3.1, 1.1, 0.3]} />
        <meshStandardMaterial color={STEEL_DARK} metalness={0.7} roughness={0.5} />
      </mesh>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 1.75, 5.2]}>
          <boxGeometry args={[0.5, 0.3, 0.14]} />
          <meshStandardMaterial color="#fff3cf" emissive="#ffd889" emissiveIntensity={2.6} toneMapped={false} />
        </mesh>
      ))}
      {/* roof rack */}
      <mesh position={[0, 3.25, 3.2]} castShadow>
        <boxGeometry args={[3.1, 0.16, 2.4]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.7} />
      </mesh>
      {/* ribbed cargo bed with tarp cap */}
      <mesh position={[0, 2.35, -1.6]} castShadow>
        <boxGeometry args={[3.4, 2, 6.2]} />
        <meshStandardMaterial color="#8b8f93" metalness={0.35} roughness={0.65} />
      </mesh>
      {[-3.6, -2.2, -0.8, 0.6].map((z) => (
        <mesh key={z} position={[0, 2.35, z]} castShadow>
          <boxGeometry args={[3.55, 1.9, 0.14]} />
          <meshStandardMaterial color="#5f6367" metalness={0.5} roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, 3.45, -1.6]} castShadow>
        <boxGeometry args={[3.5, 0.22, 6.3]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.9} />
      </mesh>
      {/* six heavy wheels */}
      {wheelZ.map((z) =>
        [-1.75, 1.75].map((x) => (
          <mesh key={`${x}:${z}`} position={[x, 0.95, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.95, 0.95, 0.72, 14]} />
            <meshStandardMaterial color="#191b1d" roughness={0.95} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function Convoys({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    sim.trucks.forEach((t, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      node.visible = t.alive;
      if (!t.alive) return;
      node.position.set(t.x, t.y, t.z);
      node.rotation.y = t.rot;
    });
  });

  return (
    <group ref={group}>
      {sim.trucks.map((_, i) => (
        <group key={i} visible={false}>
          <ArmoredHauler />
          <pointLight position={[0, 1.8, 6]} color="#ffe2b0" intensity={10} distance={30} decay={2} />
        </group>
      ))}
    </group>
  );
}



/* ---------------- projectiles ---------------- */

/** Bullets were a bare glowing sphere at each live bullet's position — readable but flat next to
 * the tracer/muzzle-flash combat feedback in the reference art. Adds, per pooled bullet: a thin
 * stretched cylinder oriented along its velocity (a tracer streak instead of a dot) and a brief
 * additive flash disc for its first ~0.2s of life (a stand-in muzzle flash, since it spawns right
 * at the gun tip). Still one fixed-size instance per BULLET_POOL slot, just three meshes instead
 * of one — no new allocation per frame, same pooled-visibility pattern as before. */
export function Bullets({ sim }: { sim: WorldSim }) {
  const core = useRef<THREE.Group>(null!);
  const tracer = useRef<THREE.Group>(null!);
  const flash = useRef<THREE.Group>(null!);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(() => {
    const cg = core.current, tg = tracer.current, fg = flash.current;
    if (!cg || !tg || !fg) return;
    sim.bullets.forEach((b, i) => {
      const coreMesh = cg.children[i] as THREE.Mesh | undefined;
      const tracerMesh = tg.children[i] as THREE.Mesh | undefined;
      const flashMesh = fg.children[i] as THREE.Mesh | undefined;
      if (!coreMesh || !tracerMesh || !flashMesh) return;
      coreMesh.visible = b.alive;
      tracerMesh.visible = b.alive;
      const justFired = b.alive && b.life > 1.2; // life starts at 1.4 and counts down
      flashMesh.visible = justFired;
      if (!b.alive) return;

      coreMesh.position.set(b.x, b.y, b.z);
      tracerMesh.position.set(b.x, b.y, b.z);
      const speed = Math.hypot(b.vx, b.vy, b.vz) || 1;
      dir.set(b.vx, b.vy, b.vz).normalize();
      quat.setFromUnitVectors(up, dir);
      tracerMesh.quaternion.copy(quat);
      tracerMesh.scale.set(1, THREE.MathUtils.clamp(speed * 0.035, 0.6, 2.4), 1);
      (coreMesh.material as THREE.MeshStandardMaterial).opacity = THREE.MathUtils.clamp(b.life / 1.4, 0.35, 1);
      (tracerMesh.material as THREE.MeshStandardMaterial).opacity = THREE.MathUtils.clamp(b.life / 1.4, 0.25, 0.9);

      if (justFired) {
        flashMesh.position.set(b.x, b.y, b.z);
        const t = (b.life - 1.2) / 0.2; // 1 right at the muzzle, fading to 0 over ~0.2s
        flashMesh.scale.setScalar(0.35 + t * 0.85);
        (flashMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t) * 0.8;
      }
    });
  });

  return (
    <>
      <group ref={tracer}>
        {sim.bullets.map((_, i) => (
          <mesh key={i} visible={false}>
            <cylinderGeometry args={[0.07, 0.07, 1, 6]} />
            <meshStandardMaterial color="#a8f0ff" emissive="#66e0ff" emissiveIntensity={4} transparent toneMapped={false} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group ref={core}>
        {sim.bullets.map((_, i) => (
          <mesh key={i} visible={false}>
            <sphereGeometry args={[0.17, 8, 8]} />
            <meshStandardMaterial color="#d8faff" emissive="#8af0ff" emissiveIntensity={5} transparent toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={flash}>
        {sim.bullets.map((_, i) => (
          <mesh key={i} visible={false}>
            <circleGeometry args={[0.5, 10]} />
            <meshBasicMaterial color="#eaffff" transparent opacity={0} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        ))}
      </group>
    </>
  );
}

const HAZARD_SLOTS = 6;

/** Environmental hazard markers (environment.ts): a pulsing ring on the ground during a lightning
 * strike's warning window, then a brief bright column when it lands. Pooled meshes, no allocation. */
export function HazardMarkers({ sim }: { sim: WorldSim }) {
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const bolts = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < HAZARD_SLOTS; i++) {
      const ring = rings.current[i];
      const strike = sim.env.strikes[i];
      if (ring) {
        ring.visible = Boolean(strike);
        if (strike) {
          ring.position.set(strike.x, walkHeight(strike.x, strike.z) + 0.25, strike.z);
          // pulse faster as the strike nears so the countdown reads without text
          const pulse = 0.75 + 0.25 * Math.sin(t * (10 + (1.6 - strike.warn) * 14));
          ring.scale.setScalar(strike.radius * pulse);
        }
      }
      const bolt = bolts.current[i];
      const flash = sim.env.flashes[i];
      if (bolt) {
        bolt.visible = Boolean(flash);
        if (flash) { bolt.position.set(flash.x, walkHeight(flash.x, flash.z) + 30, flash.z); bolt.scale.set(1, 1, 1); (bolt.material as THREE.MeshBasicMaterial).opacity = Math.min(1, flash.t / 0.3); }
      }
    }
  });

  return (
    <group>
      {Array.from({ length: HAZARD_SLOTS }, (_, i) => (
        <group key={i}>
          <mesh ref={(node) => { rings.current[i] = node; }} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.82, 1, 48]} />
            <meshBasicMaterial color="#9fd8ff" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={(node) => { bolts.current[i] = node; }} visible={false}>
            <cylinderGeometry args={[0.35, 0.9, 60, 8, 1, true]} />
            <meshBasicMaterial color="#e8f4ff" transparent opacity={1} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
