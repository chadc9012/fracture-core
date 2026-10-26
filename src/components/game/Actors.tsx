import { enemyBodyScale } from "@/game/enemy-visuals";
import { OPERATOR_HEIGHT } from "@/game/operators";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { enemyDrives, FactionEnemy, type DriveRef } from "./EnemyModel";
import { scenarioModelReady } from "./ScenarioBosses";
import { OperatorModel, type ModelMotion } from "./OperatorModel";
import { RIVAL_COLORS, type RivalClass } from "@/game/crucible";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { isStaggeredNow, reactionBones, recoilAt } from "@/game/enemy-reactions";
import { diveBones } from "@/game/enemy-evasion";




import { FACTIONS, laneSamples, type WorldSim } from "@/game/sim";
import { getVoicePose, isBossSpeaker } from "@/game/voice-animation";
import { walkHeight } from "@/game/terrain";
import { enemyVisible } from "@/game/actor-cull";
import { FLEET_MODELS } from "@/game/fleet-models";
import { AuthoredVehicle } from "./AuthoredVehicle";

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
              <ringGeometry args={[9.6, 10, 64]} />
              <meshStandardMaterial
                color={FACTIONS[z.owner].color}
                emissive={FACTIONS[z.owner].color}
                emissiveIntensity={0.9}
                transparent
                depthWrite={false}
                opacity={0.3}
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

function RegionalEnemy({ kind, boss, elite = false, drive }: { kind: "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD" | "SKYBORN" | "GUARDIAN" | "ABYSSAL" | "BEAST"; boss: boolean; elite?: boolean; drive: DriveRef }) {
  const metal = kind === "RAIDER" ? "#765949" : kind === "ABERRATION" ? "#375c43" : kind === "VANGUARD" ? "#5b7481" : kind === "SKYBORN" ? "#cfc8b8" : kind === "GUARDIAN" ? "#8a7a5e" : kind === "ABYSSAL" ? "#2a3a4e" : kind === "BEAST" ? "#8a7458" : "#636c85";
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
  return <FactionEnemy kind={kind} role={boss ? "boss" : elite ? "elite" : "standard"} visorRef={visor} headRef={head} drive={drive} />;
}

export function WarMachines({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);
  // one motion record per pooled machine slot, shared by that slot's faction variants
  const drives = useMemo<DriveRef[]>(() => sim.machines.map(() => ({ current: { speed: 0, aiming: false } })), [sim.machines]);
  useEffect(() => { drives.forEach((d, i) => { enemyDrives[i] = d; }); return () => { enemyDrives.length = 0; }; }, [drives]);
  const last = useMemo(() => sim.machines.map(() => ({ x: NaN, z: NaN })), [sim.machines]);
  // Crucible rivals walk/run on the operator rig's own clips, driven from their real ground speed
  const strides = useMemo<ModelMotion[]>(() => sim.machines.map(() => ({ current: { phase: 0, intensity: 0, air: false } })), [sim.machines]);
  // variants mount the first time a slot needs them (and stay mounted): an unseen faction never downloads or clones its model
  const [mounted, setMounted] = useState<string[][]>(() => sim.machines.map(() => []));
  const mountedRef = useRef(mounted);
  const need = (i: number, name: string) => mounted[i]?.includes(name) ?? false;

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    sim.machines.forEach((m, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      const cdx = m.x - state.camera.position.x, cdz = m.z - state.camera.position.z;
      node.visible = enemyVisible(m, cdx * cdx + cdz * cdz);
      const prev = last[i], drive = drives[i];
      if (!m.alive) { if (prev) prev.x = NaN; return; }
      if (prev && drive) {
        const v = Number.isNaN(prev.x) || dt <= 0 ? 0 : Math.hypot(m.x - prev.x, m.z - prev.z) / dt;
        drive.current.speed += (Math.min(v, 12) - drive.current.speed) * Math.min(1, dt * 8);
        drive.current.aiming = (m.aim ?? 0) > 0;
        const nowD = performance.now() / 1000, ev = m.evade && m.evade.dive && nowD < m.evade.until ? m.evade : null;
        // diving out of a blast (enemy-evasion.ts) takes over the limbs; otherwise any hit reaction plays over the clip
        drive.current.hit = ev ? diveBones((nowD - ev.start) / (ev.until - ev.start)).bones : reactionBones(m.react, nowD, m.rot);
        prev.x = m.x; prev.z = m.z;
      }
      const stride = strides[i];
      if (m.rival && stride && drive) { stride.current.phase += drive.current.speed * dt * 1.25; stride.current.intensity = Math.min(1, drive.current.speed / 9); drive.current.procedural = false; }
      const modelName = m.rival ? `rival-${m.rival}` : m.boss && m.scenarioId && scenarioModelReady.has(m.scenarioId) ? "scenario-model" : m.boss || (m.nemesis && (m.kind === "SKYBORN" || m.kind === "GUARDIAN" || m.kind === "ABYSSAL" || m.kind === "BEAST")) ? `boss-model-${m.kind ?? "OVERCLOCKED"}` /* a Skyborn nemesis is a Harbinger, their commander caste */ : (m.kind === "OVERCLOCKED" ? "overclocked-model" : m.kind === "ABERRATION" ? "aberration-model" : m.kind === "VANGUARD" ? "vanguard-model" : m.kind === "SKYBORN" ? "skyborn-model" : m.kind === "GUARDIAN" ? "guardian-model" : m.kind === "ABYSSAL" ? "abyssal-model" : m.kind === "BEAST" ? "beast-model" : "regional-model") + (m.elite ? "-elite" : "");
      if (modelName !== "scenario-model" && !mountedRef.current[i]?.includes(modelName)) {
        const next = mountedRef.current.map((list, k) => (k === i ? [...list, modelName] : list));
        mountedRef.current = next;
        setMounted(next);
      }
      for (const child of node.children) child.visible = m.summoned ? child.name === "summon-ring" : child.name === "elite-ring" ? m.elite && !m.boss : child.name === "summon-ring" ? Boolean(m.summoned) : child.name === modelName;
      // walking gait: subtle body bob + roll so the legs read as striding
      const gait = t * 3 + i;
      // rigged models walk with their own clips; only clip-less ones get the procedural bob/roll, and only while moving
      // (a 28 cm hop on a clock made standing crawlers bounce off the ground)
      const bob = drive?.current.procedural === false ? 0 : Math.min(1, (drive?.current.speed ?? 0) / 1.2);
      // hit reaction (enemy-reactions.ts): thrown back along the shot, hardest on a stagger, easing out
      const nowS = performance.now() / 1000, kick = recoilAt(m.react, nowS), staggered = isStaggeredNow(m.react, nowS);
      const back = kick * (staggered ? 0.55 : 0.18) * enemyBodyScale(m.scale), rx = m.react?.dx ?? 0, rz = m.react?.dz ?? 0;
      // a dive drops the body low and pitches it toward the way it is going
      const ev = m.evade && m.evade.dive && nowS < m.evade.until ? m.evade : null;
      const dip = ev ? diveBones((nowS - ev.start) / (ev.until - ev.start)).dip : 0;
      node.position.set(m.x + rx * back, m.y - 2.2 * m.scale + Math.abs(Math.sin(gait)) * 0.06 * bob - dip * 0.45 * enemyBodyScale(m.scale), m.z + rz * back);
      // lean: pitch away from the hit in the enemy's own frame
      const c = Math.cos(m.rot), sn = Math.sin(m.rot), fwd = rx * sn + rz * c, side = rx * c - rz * sn, lean = kick * (staggered ? 0.32 : 0.1);
      const evl = ev ? Math.hypot(ev.vx, ev.vz) || 1 : 1, eFwd = ev ? (ev.vx * sn + ev.vz * c) / evl : 0, eSide = ev ? (ev.vx * c - ev.vz * sn) / evl : 0;
      node.rotation.set(Math.sin(gait) * 0.03 * bob + fwd * lean + eFwd * dip * 0.5, m.rot, Math.sin(gait * 0.5) * 0.05 * bob - side * lean - eSide * dip * 0.6);
      // attack telegraph: a fast pulse while the machine winds up a ranged shot (a stagger cancels it)
      node.scale.setScalar(enemyBodyScale(m.scale) * ((m.aim ?? 0) > 0 && !staggered ? 1 + Math.abs(Math.sin(t * 28)) * 0.1 : 1));
    });
  });

  return (
    <group ref={group}>
      {sim.machines.map((_, i) => (
        <group key={i} visible={false}>
          <group name="regional-model" visible={false}>{need(i, "regional-model") && <RegionalEnemy kind="RAIDER" boss={false} drive={drives[i]!} />}</group>
          <group name="overclocked-model" visible={false}>{need(i, "overclocked-model") && <RegionalEnemy kind="OVERCLOCKED" boss={false} drive={drives[i]!} />}</group>
          <group name="aberration-model" visible={false}>{need(i, "aberration-model") && <RegionalEnemy kind="ABERRATION" boss={false} drive={drives[i]!} />}</group>
          <group name="vanguard-model" visible={false}>{need(i, "vanguard-model") && <RegionalEnemy kind="VANGUARD" boss={false} drive={drives[i]!} />}</group>
          <group name="regional-model-elite" visible={false}>{need(i, "regional-model-elite") && <RegionalEnemy kind="RAIDER" boss={false} elite drive={drives[i]!} />}</group>
          <group name="overclocked-model-elite" visible={false}>{need(i, "overclocked-model-elite") && <RegionalEnemy kind="OVERCLOCKED" boss={false} elite drive={drives[i]!} />}</group>
          <group name="aberration-model-elite" visible={false}>{need(i, "aberration-model-elite") && <RegionalEnemy kind="ABERRATION" boss={false} elite drive={drives[i]!} />}</group>
          <group name="vanguard-model-elite" visible={false}>{need(i, "vanguard-model-elite") && <RegionalEnemy kind="VANGUARD" boss={false} elite drive={drives[i]!} />}</group>
          <group name="skyborn-model" visible={false}>{need(i, "skyborn-model") && <RegionalEnemy kind="SKYBORN" boss={false} drive={drives[i]!} />}</group>
          <group name="skyborn-model-elite" visible={false}>{need(i, "skyborn-model-elite") && <RegionalEnemy kind="SKYBORN" boss={false} elite drive={drives[i]!} />}</group>
          <group name="guardian-model" visible={false}>{need(i, "guardian-model") && <RegionalEnemy kind="GUARDIAN" boss={false} drive={drives[i]!} />}</group>
          <group name="guardian-model-elite" visible={false}>{need(i, "guardian-model-elite") && <RegionalEnemy kind="GUARDIAN" boss={false} elite drive={drives[i]!} />}</group>
          <group name="abyssal-model" visible={false}>{need(i, "abyssal-model") && <RegionalEnemy kind="ABYSSAL" boss={false} drive={drives[i]!} />}</group>
          <group name="abyssal-model-elite" visible={false}>{need(i, "abyssal-model-elite") && <RegionalEnemy kind="ABYSSAL" boss={false} elite drive={drives[i]!} />}</group>
          <group name="beast-model" visible={false}>{need(i, "beast-model") && <RegionalEnemy kind="BEAST" boss={false} drive={drives[i]!} />}</group>
          <group name="beast-model-elite" visible={false}>{need(i, "beast-model-elite") && <RegionalEnemy kind="BEAST" boss={false} elite drive={drives[i]!} />}</group>
          {/* region bosses wear their region faction's boss from the faction sheet (encounters.ts REGION_FACTION) */}
          <group name="boss-model-RAIDER" visible={false}>{need(i, "boss-model-RAIDER") && <RegionalEnemy kind="RAIDER" boss drive={drives[i]!} />}</group>
          <group name="boss-model-OVERCLOCKED" visible={false}>{need(i, "boss-model-OVERCLOCKED") && <RegionalEnemy kind="OVERCLOCKED" boss drive={drives[i]!} />}</group>
          <group name="boss-model-VANGUARD" visible={false}>{need(i, "boss-model-VANGUARD") && <RegionalEnemy kind="VANGUARD" boss drive={drives[i]!} />}</group>
          <group name="boss-model-ABERRATION" visible={false}>{need(i, "boss-model-ABERRATION") && <RegionalEnemy kind="ABERRATION" boss drive={drives[i]!} />}</group>
          <group name="boss-model-SKYBORN" visible={false}>{need(i, "boss-model-SKYBORN") && <RegionalEnemy kind="SKYBORN" boss drive={drives[i]!} />}</group>
          <group name="boss-model-GUARDIAN" visible={false}>{need(i, "boss-model-GUARDIAN") && <RegionalEnemy kind="GUARDIAN" boss drive={drives[i]!} />}</group>
          <group name="boss-model-ABYSSAL" visible={false}>{need(i, "boss-model-ABYSSAL") && <RegionalEnemy kind="ABYSSAL" boss drive={drives[i]!} />}</group>
          <group name="boss-model-BEAST" visible={false}>{need(i, "boss-model-BEAST") && <RegionalEnemy kind="BEAST" boss drive={drives[i]!} />}</group>
          {/* Crucible rival operators in their hostile colourways (crucible.ts) */}
          {(["TITAN", "HUNTER", "WARLOCK"] as RivalClass[]).map((cls) => (
            <group key={cls} name={`rival-${cls}`} visible={false} position={[0, 2.2, 0]}>
              {need(i, `rival-${cls}`) && <OperatorModel classId={cls} height={OPERATOR_HEIGHT} feetY={-2.2} pose="locomotion" motion={strides[i]} color={RIVAL_COLORS[cls].armor} trim={RIVAL_COLORS[cls].trim} cloth={RIVAL_COLORS[cls].cloth} fallback={<RegionalEnemy kind="VANGUARD" boss={false} drive={drives[i]!} />} />}
            </group>
          ))}
          {/* loot cue: elites (better drops) wear a glowing amber ring at their feet, like Diablo's elite tell */}
          <mesh name="summon-ring" visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.85, 0]}><ringGeometry args={[2.2, 3.4, 40]} /><meshBasicMaterial color="#a463ff" transparent opacity={0.9} depthWrite={false} /></mesh>
          <mesh name="elite-ring" visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.9, 0]}><ringGeometry args={[2.6, 3.1, 40]} /><meshBasicMaterial color="#ffb357" transparent opacity={0.85} depthWrite={false} /></mesh>
        </group>
      ))}
    </group>
  );
}


/* ---------------- NPC convoy trucks ---------------- */

/** Convoy trucks are the authored war rig (public/models/fleet/war-rig.glb) with its wheels rolling at the truck's real
 * speed (a plain hull stands in if the model can't load). Truck y is ground + 1.6 (the sim's
 * eye-height convention for targeting), so the body sits 1.6 m lower. */
const CONVOY_MODEL = FLEET_MODELS["war-rig"];
export function Convoys({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);
  const speeds = useMemo(() => sim.trucks.map(() => ({ current: 0 })), [sim.trucks]);
  const last = useRef<{ x: number; z: number }[]>([]);

  useFrame((_, raw) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.max(1e-3, Math.min(raw, 0.1));
    sim.trucks.forEach((t, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      node.visible = t.alive;
      if (!t.alive) return;
      const p = last.current[i];
      const v = p ? Math.hypot(t.x - p.x, t.z - p.z) / dt : 0;
      const sp = speeds[i]; if (sp) sp.current += (Math.min(v, 30) - sp.current) * Math.min(1, dt * 4);
      last.current[i] = { x: t.x, z: t.z };
      node.position.set(t.x, t.y - 1.6, t.z);
      node.rotation.y = t.rot;
    });
  });

  return (
    <group ref={group}>
      {sim.trucks.map((_, i) => (
        <group key={i} visible={false}>
          <AuthoredVehicle model={CONVOY_MODEL} speedRef={speeds[i]!} lights />
        </group>
      ))}
    </group>
  );
}



/* ---------------- projectiles ---------------- */

/** player bullets (instanced tracers) live in BulletFx.tsx */
export { Bullets } from "./BulletFx";

const HAZARD_SLOTS = 6;
/** Fracture lightning (trailer reference, docs/trailer-references.md): a jagged violet bolt with a side fork instead of a smooth column.
 * One fixed shape per pool slot (seeded), spun per strike so repeats don't read as the same bolt. 60 m tall, centred on its midpoint. */
const boltCache = new Map<number, THREE.BufferGeometry>();
function boltGeometry(slot: number): THREE.BufferGeometry {
  const hit = boltCache.get(slot); if (hit) return hit;
  let seed = 977 + slot * 131; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const main: THREE.Vector3[] = [];
  for (let k = 0; k <= 10; k++) main.push(new THREE.Vector3(k === 0 || k === 10 ? 0 : (rnd() - 0.5) * 7, 30 - k * 6, k === 0 || k === 10 ? 0 : (rnd() - 0.5) * 7));
  const forkFrom = main[3]!.clone();
  const fork = [forkFrom, forkFrom.clone().add(new THREE.Vector3(5 + rnd() * 4, -7, rnd() * 3)), forkFrom.clone().add(new THREE.Vector3(9 + rnd() * 5, -15, rnd() * 5))];
  const a = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(main, false, "catmullrom", 0.1), 40, 0.45, 5, false);
  const b = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fork, false, "catmullrom", 0.1), 12, 0.22, 4, false);
  const merged = mergeGeometries([a, b]) ?? a;
  boltCache.set(slot, merged);
  return merged;
}

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
        if (flash) { bolt.position.set(flash.x, walkHeight(flash.x, flash.z) + 30, flash.z); bolt.rotation.y = flash.x * 0.37 + flash.z * 0.11; bolt.scale.set(1, 1, 1); (bolt.material as THREE.MeshBasicMaterial).opacity = Math.min(1, flash.t / 0.3); }
      }
    }
  });

  return (
    <group>
      {Array.from({ length: HAZARD_SLOTS }, (_, i) => (
        <group key={i}>
          <mesh ref={(node) => { rings.current[i] = node; }} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.82, 1, 48]} />
            <meshBasicMaterial color="#b98cff" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={(node) => { bolts.current[i] = node; }} visible={false} geometry={boltGeometry(i)}>
            <meshBasicMaterial color="#d9b8ff" transparent opacity={1} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const BEACON_COLOR: Record<string, string> = { ORBITAL_STRIKE: "#ff5a4a", RESUPPLY: "#6dffa8", RECON_PULSE: "#6bd0ff" };

/** Thrown stratagem beacons (stratagems.ts): the body in flight, then once planted a vertical beam
 * and a pulsing radius ring (the strike telegraph, speeding up as it nears), then an expanding blast. */
export function BeaconMarkers({ sim }: { sim: WorldSim }) {
  const root = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    sim.beacons.forEach((b, i) => {
      const node = root.current?.children[i] as THREE.Group | undefined;
      if (!node) return;
      node.visible = b.alive;
      if (!b.alive) return;
      const color = BEACON_COLOR[b.kind] ?? "#ffffff";
      node.position.set(b.x, b.y, b.z);
      const [body, beam, ring, blast, glow] = node.children as THREE.Mesh[];
      const mat = (mesh?: THREE.Mesh) => mesh?.material as THREE.MeshBasicMaterial;
      for (const mesh of [body, beam, ring, blast, glow]) mat(mesh)?.color.set(color);
      // while the call-in is still in flight it carries a glowing halo so the throw can be followed across the sky
      glow!.visible = b.state === "FLIGHT";
      glow!.scale.setScalar(1 + 0.25 * Math.sin(t * 20));
      const armed = b.state === "ARMED";
      body!.visible = b.state !== "BLAST";
      body!.rotation.y = t * 6;
      beam!.visible = armed;
      ring!.visible = armed;
      blast!.visible = b.state === "BLAST";
      if (armed) {
        const pulse = 0.8 + 0.2 * Math.sin(t * (6 + (3 - Math.min(3, b.timer)) * 6));
        ring!.scale.setScalar(b.radius * pulse);
        mat(beam).opacity = 0.35 + 0.35 * Math.abs(Math.sin(t * 8));
      }
      if (b.state === "BLAST") {
        const k = 1 - b.timer / 0.45;
        blast!.scale.setScalar(Math.max(0.1, b.radius * (0.4 + k * 0.7)));
        mat(blast).opacity = 0.7 * (1 - k);
      }
    });
  });

  return (
    <group ref={root}>
      {sim.beacons.map((_, i) => (
        <group key={i} visible={false}>
          <mesh><boxGeometry args={[0.35, 0.5, 0.35]} /><meshBasicMaterial color="#ffffff" /></mesh>
          <mesh position={[0, 20, 0]} visible={false}><cylinderGeometry args={[0.12, 0.12, 40, 8, 1, true]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} visible={false}><ringGeometry args={[0.9, 1, 56]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} /></mesh>
          <mesh visible={false}><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} /></mesh>
          <mesh visible={false}><sphereGeometry args={[0.9, 14, 10]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} /></mesh>
        </group>
      ))}
    </group>
  );
}
