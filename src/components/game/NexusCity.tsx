import { DistrictLight } from "./DistrictLight";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";


import { MODELS, type ModelKey } from "@/game/models";
import type { FleetModelId } from "@/game/fleet-models";
import { BUILDING_MODELS, NEXUS_HUB_PROMENADE, NEXUS_HUB_ROAD_R, nexusHubTowers, type BuildingModelId } from "@/game/building-models";
import { InstancedGlb, type GlbInstance } from "./InstancedGlb";
import { NexusPalms } from "./CityPalms";
import { NexusStreetDetail } from "./NexusStreetDetail";
import { MergeStatic } from "./MergeStatic";
import { WorldPiece } from "./WorldPiece";
import { InstancedFleet, type FleetInstance } from "./InstancedFleet";
import { REGIONS } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import type { WorldSim } from "@/game/sim";
import { addObstacle } from "@/game/obstacles";
import { Model, QuietModel, useModel } from "./Vehicle";
import { NexusDistricts } from "./NexusDistricts";
import { NexusSigns } from "./NexusSigns";
import { ResidentialHomes } from "./ResidentialHomes";
import { NexusDiner } from "./NexusDiner";
import { carIsOut } from "@/game/traffic-density";
import { shopClockHour } from "@/game/shop-hours";

const NEXUS = REGIONS.find((r) => r.id === "nexus")!;

/* ---------------- buildings ---------------- */

type Placed = { model: BuildingModelId; x: number; z: number; y: number; rot: number };

/** the hub's ring of authored civic towers (building-models.ts nexusHubTowers), each turned to face the plaza */
function cityBlocks(): Placed[] {
  return nexusHubTowers(NEXUS).map((t) => ({ model: t.model, x: t.x, z: t.z, y: walkHeight(t.x, t.z) - 0.2, rot: t.rot }));
}

/** Architectural entrance detailing for existing authored towers.
 * All geometry is visual-only; the original GLBs and obstacle geometry remain authoritative.
 * Components share geometry/material instances to keep draw-call costs predictable.
 */
const entryGlass = new THREE.MeshPhysicalMaterial({
  color: "#263f53", metalness: 0.46, roughness: 0.17,
  transparent: true, opacity: 0.75, depthWrite: false,
  clearcoat: 0.82, clearcoatRoughness: 0.13,
});
const entryMetal = new THREE.MeshStandardMaterial({ color: "#414954", metalness: 0.8, roughness: 0.28 });
const entryStone = new THREE.MeshStandardMaterial({ color: "#85858b", metalness: 0.08, roughness: 0.64 });
const entryLight = new THREE.MeshBasicMaterial({ color: "#f6d8aa", toneMapped: false });
const glassPaneGeo = new THREE.BoxGeometry(1, 1, 1);

function TowerEntrance({ building }: { building: Placed }) {
  const spec = BUILDING_MODELS[building.model];
  const frontage = Math.min(spec.w * 0.75, 9.5);
  const paneCount = Math.max(3, Math.floor(frontage / 1.5));
  // Tower models face +Z before the placement rotation.
  return <group position={[building.x, building.y, building.z]} rotation-y={building.rot}>
    <group position={[0, 0, spec.d / 2 + 0.095]}>
      <mesh position={[0, 2.03, 0]} geometry={glassPaneGeo} material={entryGlass}
        scale={[frontage, 3.8, 0.07]} />
      {Array.from({ length: paneCount + 1 }, (_, i) =>
        <mesh key={i} position={[-frontage / 2 + (i / paneCount) * frontage, 2.02, 0.07]}
          material={entryMetal} scale={[0.055, 3.95, 0.11]}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>)}
      <mesh position={[0, 4.12, 0.36]} material={entryMetal}>
        <boxGeometry args={[frontage + 1.25, 0.18, 1.8]} />
      </mesh>
      <mesh position={[0, 4.0, 0.43]} material={entryLight}>
        <boxGeometry args={[frontage - 0.5, 0.025, 0.8]} />
      </mesh>
      <mesh position={[0, 0.065, 0.42]} material={entryStone} receiveShadow>
        <boxGeometry args={[frontage + 1.1, 0.12, 2.05]} />
      </mesh>
      {/* Ground-level storefront: recessed glazing, bronze mullions and layered signage.
          Uses existing tower dimensions, no additional gameplay/collision objects. */}
      <mesh position={[0, 2.15, 0.19]} material={entryGlass}>
        <boxGeometry args={[frontage * 0.68, 3.05, 0.07]} />
      </mesh>
      <mesh position={[0, 3.64, 0.26]} material={entryMetal}>
        <boxGeometry args={[frontage * 0.78, 0.12, 0.16]} />
      </mesh>
      {[-1, 1].map((side) => <group key={side}>
        <mesh position={[side * frontage * 0.43, 2.0, 0.16]} material={entryStone}>
          <boxGeometry args={[frontage * 0.11, 3.8, 0.34]} />
        </mesh>
        <mesh position={[side * frontage * 0.32, 3.1, 0.25]} material={entryLight}>
          <boxGeometry args={[0.055, 0.9, 0.08]} />
        </mesh>
      </group>)}
      {/* Repeated architectural floor bands establish scale without faking windows
          that may conflict with the underlying authored tower GLB. */}
      {[5.3, 8.8, 12.3].map((y) =>
        <mesh key={y} position={[0, y, -0.035]} material={entryMetal}>
          <boxGeometry args={[frontage + 0.4, 0.095, 0.16]} />
        </mesh>)}
      <mesh position={[0, 4.34, 0.4]} material={entryLight}>
        <boxGeometry args={[Math.min(4.8, frontage * 0.55), 0.085, 0.1]} />
      </mesh>
      <mesh position={[0, 2.02, 0.105]} material={entryMetal}>
        <boxGeometry args={[frontage, 0.065, 0.12]} />
      </mesh>
    </group>
  </group>;
}

function CityBuildings() {
  const placed = useMemo(() => {
    const list = cityBlocks();
    for (const b of list) addObstacle("tower", b.x, b.z, Math.min(BUILDING_MODELS[b.model].w, BUILDING_MODELS[b.model].d) * 0.5, 400, 2);
    return list;
  }, []);
  const byModel = useMemo(() => {
    const m = new Map<BuildingModelId, GlbInstance[]>();
    for (const b of placed) m.set(b.model, [...(m.get(b.model) ?? []), { x: b.x, y: b.y, z: b.z, yaw: b.rot }]);
    return [...m.entries()];
  }, [placed]);

  return (
    <group>
      {/* the hub ring stands right round the player: at the default glow its lit panels read as floodlit cyan-white walls up close
          (owner's Nexus night frame: smaller, warmer, moderate windows, many dark) */}
      {byModel.map(([id, items]) => <InstancedGlb key={id} url={BUILDING_MODELS[id].url} items={items} nightGlow={[0.06, 0.75]} windowScale={2} />)}
      {/* owner's Nexus facade pass: visual-only entrance glazing, piers and canopies, merged to a few draw calls */}
      <MergeStatic name="nexus-tower-entrances">{placed.map((b, i) => <TowerEntrance key={`tower-entry-${i}`} building={b} />)}</MergeStatic>
      {/* (the old "lit window" planes sat at fixed offsets that missed these towers' walls, so they floated round the skyline as
          cream rectangles; removed — the towers carry their own window textures) */}
      <DistrictLight range={120} position={[NEXUS.x, walkHeight(NEXUS.x, NEXUS.z) + 9, NEXUS.z]} color="#ffbf7a" intensity={22} distance={NEXUS.radius} decay={1.6} />
      {/* plaza slab so the hub reads as built ground, not open dirt */}
      <mesh rotation-x={-Math.PI / 2} position={[NEXUS.x, walkHeight(NEXUS.x, NEXUS.z) + 0.06, NEXUS.z]} receiveShadow>
        <circleGeometry args={[NEXUS.radius * 0.86, 64]} />
        {/* rain-slick paving: the neon and the storm smear across it at night (trailer look) */}
        <meshStandardMaterial color="#2a313d" roughness={0.43} metalness={0.16} />
      </mesh>
      {/* stability field dome */}
      <mesh position={[NEXUS.x, walkHeight(NEXUS.x, NEXUS.z), NEXUS.z]}>
        <sphereGeometry args={[NEXUS.radius, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#66e0ff" transparent opacity={0.025} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ---------------- pedestrians (real low-poly NPC models, not primitives) ---------------- */

const NPC_KEYS: ModelKey[] = ["npc_a", "npc_b", "npc_c"];

type Ped = { a: number; r: number; speed: number; key: ModelKey; height: number; phase: number };

function Pedestrian({ ped }: { ped: Ped }) {
  const group = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const model = useModel(ped.key);
  // hosted models come in at their own size: normalise to a life-size 1.65-1.85 m adult
  const norm = useMemo(() => { const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()); return size.y > 0.01 ? 1.72 / size.y : 1; }, [model]);
  const angle = useRef(ped.a);
  const gait = useRef(ped.phase);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    angle.current += (ped.speed / ped.r) * dt;
    gait.current += dt * (4.0 + Math.abs(ped.speed) * 1.8);
    const x = NEXUS.x + Math.cos(angle.current) * ped.r;
    const z = NEXUS.z + Math.sin(angle.current) * ped.r;
    const g = group.current;
    if (!g) return;
    g.position.set(x, walkHeight(x, z), z);
    // face the direction of travel; +90deg because the model's forward axis is +Z
    g.rotation.y = Math.atan2(-Math.sin(angle.current), Math.cos(angle.current)) + Math.PI / 2 + (ped.speed < 0 ? Math.PI : 0);
    // small procedural bob + sway stands in for a walk cycle since the glb has no rig baked in
    if (body.current) {
      body.current.position.y = Math.abs(Math.sin(gait.current)) * 0.05;
      body.current.rotation.z = Math.sin(gait.current) * 0.025;
      body.current.rotation.x = Math.sin(gait.current * 0.5) * 0.018;
    }
  });

  return (
    <group ref={group} scale={ped.height * norm}>
      <group ref={body}>
        <primitive object={model} />
      </group>
    </group>
  );
}

function Pedestrians() {
  const peds = useMemo<Ped[]>(() => {
    // deterministic crowd (owner's crowd pass): mixed walking speeds and heights, no Math.random remount pops.
    // Two lanes, one per direction, both on the promenade itself (12.8-13.8): the pack's four lanes reached 14.3 (the ring road's
    // inner lane) and 12.3 (through the planters), and opposite-direction lanes 0.23 m apart walked through each other.
    const count = 20; // the pack had 28: each walker is a cloned GLB with its own frame callback, so phones pay per walker
    const fract = (n: number) => n - Math.floor(n);
    const hash = (n: number) => fract(Math.sin(n * 127.1 + 19.19) * 43758.5453);
    const inner = NEXUS_HUB_PROMENADE[0] + 0.2, outer = NEXUS_HUB_PROMENADE[1] - 0.2;
    return Array.from({ length: count }, (_, i) => {
      const lane = i % 2;
      return {
        a: (i / count) * Math.PI * 2 + (hash(i + 7) - 0.5) * 0.22,
        r: lane ? outer : inner,
        speed: (lane % 2 ? 1 : -1) * (0.8 + hash(i + 13) * 0.75),
        key: NPC_KEYS[i % NPC_KEYS.length]!,
        height: 0.94 + hash(i + 21) * 0.14,
        phase: hash(i + 31) * Math.PI * 2,
      };
    });
  }, []);
  return (
    <group>
      {peds.map((p, i) => (
        <QuietModel key={i} url={MODELS[p.key]} fallback={null}><Suspense fallback={null}><Pedestrian ped={p} /></Suspense></QuietModel>
      ))}
    </group>
  );
}


/* ---------------- traffic (city cars on a loop) ---------------- */

const TRAFFIC: { model: FleetModelId; paint: string }[] = [
  { model: "street-racer", paint: "#2a0a6e" }, { model: "luxury-sedan", paint: "#0c0d10" }, { model: "security-suv", paint: "#c9ced6" },
  { model: "muscle-car", paint: "#9aa3ad" }, { model: "tuner", paint: "#1b2e66" }, { model: "city-pod", paint: "#e8ecf2" },
];
/** city cars on the ring road: one authored model each, instanced, wheels in rest pose (they read as moving from the street) */
function CityTraffic() {
  const t = useRef(0);
  const cars = useMemo(() => TRAFFIC.map((c, i) => ({ ...c, a: (i / TRAFFIC.length) * Math.PI * 2, r: NEXUS_HUB_ROAD_R + (i % 2 ? 1.1 : -1.1), speed: 0.16 + (i % 3) * 0.03 })), []);
  const items = useMemo<FleetInstance[]>(() => cars.map((c) => ({ model: c.model, paint: c.paint, x: 0, y: 0, z: 0, yaw: 0 })), [cars]);
  useFrame((_, raw) => { t.current += Math.min(raw, 0.05); });
  const place = (model: FleetModelId, _i: number, o: THREE.Object3D) => {
    const idx = cars.findIndex((k) => k.model === model), c = cars[idx]!;
    if (!carIsOut(idx, cars.length, shopClockHour())) { o.position.set(NEXUS.x, -1000, NEXUS.z); return; } // off the road for the quiet hours (traffic-density.ts)
    const a = c.a + t.current * c.speed;
    const x = NEXUS.x + Math.cos(a) * c.r, z = NEXUS.z + Math.sin(a) * c.r;
    o.position.set(x, walkHeight(x, z), z); o.rotation.set(0, -a, 0);
  };
  return <InstancedFleet items={items} place={place} />;
}

/* ---------------- defence turrets ---------------- */

export function Turrets({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    sim.turrets.forEach((t, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      node.rotation.y = t.rot;
      const flash = node.children[2] as THREE.Mesh | undefined;
      if (flash) {
        flash.visible = t.flash > 0.05;
        flash.scale.setScalar(0.6 + t.flash);
      }
    });
  });

  return (
    <group ref={group}>
      {sim.turrets.map((t, i) => (
        <group key={i} position={[t.x, t.y, t.z]}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <cylinderGeometry args={[1.1, 1.6, 3.2, 10]} />
            <meshStandardMaterial color="#2d3744" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 3.4, 1.4]} castShadow>
            <boxGeometry args={[0.6, 0.6, 3]} />
            <meshStandardMaterial color="#1a2129" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 3.4, 3.2]} visible={false}>
            <sphereGeometry args={[0.7, 10, 10]} />
            <meshBasicMaterial color="#9fe8ff" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function NexusCity({ sim }: { sim: WorldSim }) {
  return (
    <group>
      <CityBuildings />
      <NexusDistricts />
      {/* Grid Line Diner frontage (venue-life.ts): Nexus City's late-night venue */}
      <WorldPiece name="nexus diner"><NexusDiner /></WorldPiece>
      <NexusSigns />
      <MergeStatic name="nexus-street-detail"><NexusStreetDetail /></MergeStatic>
      <WorldPiece name="nexus palms"><NexusPalms /></WorldPiece>
      <ResidentialHomes city="nexus" />
      <Pedestrians />
      <CityTraffic />
      <Turrets sim={sim} />
    </group>
  );
}
