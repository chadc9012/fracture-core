import { DistrictLight } from "./DistrictLight";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";


import { MODELS, type ModelKey } from "@/game/models";
import type { FleetModelId } from "@/game/fleet-models";
import { BUILDING_MODELS, NEXUS_HUB_PROMENADE, NEXUS_HUB_ROAD_R, nexusHubTowers, type BuildingModelId } from "@/game/building-models";
import { InstancedGlb, type GlbInstance } from "./InstancedGlb";
import { NexusPalms } from "./CityPalms";
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
      {byModel.map(([id, items]) => <InstancedGlb key={id} url={BUILDING_MODELS[id].url} items={items} />)}
      {/* (the old "lit window" planes sat at fixed offsets that missed these towers' walls, so they floated round the skyline as
          cream rectangles; removed — the towers carry their own window textures) */}
      <DistrictLight range={120} position={[NEXUS.x, walkHeight(NEXUS.x, NEXUS.z) + 9, NEXUS.z]} color="#ffbf7a" intensity={22} distance={NEXUS.radius} decay={1.6} />
      {/* plaza slab so the hub reads as built ground, not open dirt */}
      <mesh rotation-x={-Math.PI / 2} position={[NEXUS.x, walkHeight(NEXUS.x, NEXUS.z) + 0.06, NEXUS.z]} receiveShadow>
        <circleGeometry args={[NEXUS.radius * 0.86, 64]} />
        {/* rain-slick paving: the neon and the storm smear across it at night (trailer look) */}
        <meshStandardMaterial color="#2a313d" roughness={0.34} metalness={0.32} />
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
    gait.current += dt * 6.2 * (0.6 + Math.abs(ped.speed) * 0.15);
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
      body.current.rotation.z = Math.sin(gait.current) * 0.035;
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
    return Array.from({ length: 14 }, (_, i) => ({
      a: (i / 14) * Math.PI * 2,
      r: NEXUS_HUB_PROMENADE[0] + (i % 3) * ((NEXUS_HUB_PROMENADE[1] - NEXUS_HUB_PROMENADE[0]) / 2),
      speed: (i % 2 ? 1 : -1) * (1.6 + (i % 3) * 0.5),
      key: NPC_KEYS[i % NPC_KEYS.length]!,
      height: 0.96 + (i % 3) * 0.04,
      phase: Math.random() * 6,
    }));
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
      <WorldPiece name="nexus palms"><NexusPalms /></WorldPiece>
      <ResidentialHomes city="nexus" />
      <Pedestrians />
      <CityTraffic />
      <Turrets sim={sim} />
    </group>
  );
}
