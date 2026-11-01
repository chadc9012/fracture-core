import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { FLEET_MODELS, type FleetModelId } from "@/game/fleet-models";
import { AuthoredVehicle } from "./AuthoredVehicle";
import { InstancedGlb } from "./InstancedGlb";
import { facadeMaterial, facadeNight } from "./facade-shader";
import { NexusDistricts } from "./NexusDistricts";
import { streetLights } from "@/game/nexus-districts";
import { walkHeight } from "@/game/terrain";
import { worldLight } from "@/game/world-light";

/** Dev showroom (routes/dev.showroom.tsx): a lineup under day or night light, for judging vehicle and building finish. */
const SETS: Record<string, FleetModelId[]> = {
  cars: ["luxury-sedan", "tuner", "security-suv", "city-pod", "armored-muscle", "offroad-truck"],
  trucks: ["war-rig", "tech-transport", "raider-buggy", "goliath-tank", "fracture-behemoth", "hover-car"],
  air: ["rift-helicopter", "vanguard-jet", "aether-hoverbike", "void-skimmer", "ai-interceptor", "hydro-sub-skiff"],
};
const BUILDINGS = ["/models/buildings/nexus-civic-a.glb", "/models/buildings/nexus-terrace-a.glb", "/models/buildings/neon-tower-a.glb", "/models/buildings/neon-block-b.glb"];

function params() {
  const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  return { set: q.get("set") ?? "cars", hour: Number(q.get("hour") ?? 13), close: q.get("cam") === "close", lamp: Number(q.get("lamp") ?? 7), up: Number(q.get("up") ?? 0) };
}

function Lineup({ ids, gap }: { ids: FleetModelId[]; gap: number }) {
  return <group>{ids.map((id, i) => {
    const m = FLEET_MODELS[id];
    const x = ((i % 3) - 1) * gap, z = (Math.floor(i / 3) - 0.5) * gap * 1.3;
    return <group key={id} position={[x, 0, z]} rotation-y={-0.6}><Suspense fallback={null}><AuthoredVehicle model={m} lights /></Suspense></group>;
  })}</group>;
}

function Buildings() {
  return <group>{BUILDINGS.map((url, i) => <Suspense key={url} fallback={null}><InstancedGlb url={url} items={[{ x: (i - 1.5) * 30, y: 0, z: -10, yaw: 0, scale: 1 }]} /></Suspense>)}</group>;
}

/** box towers in the district facade shader, a shopfront plinth under each */
function Facades() {
  const looks = useMemo(() => [
    facadeMaterial({ color: "#5d7486", glass: "#1b2b3a", lit: 0.56, cell: [1.6, 3.4], win: [0.84, 0.72], metal: 0.32, rough: 0.36, grime: 0.35 }, { key: "show-glass" }),
    facadeMaterial({ color: "#a39a8c", glass: "#1d2229", lit: 0.5, cell: [2.0, 3.4], win: [0.62, 0.62], metal: 0.05, rough: 0.9, grime: 1 }, { key: "show-concrete" }),
    facadeMaterial({ color: "#4f5458", glass: "#1a1d20", lit: 0.3, cell: [4.0, 4.2], win: [0.45, 0.35], metal: 0.5, rough: 0.7, grime: 0.9 }, { key: "show-industrial" }),
  ], []);
  const shop = useMemo(() => facadeMaterial({ color: "#4a4844", glass: "#1a2630", metal: 0.05, rough: 0.6, cell: [5.2, 3.4], win: [0.8, 0.8], lit: 1, grime: 0.6 }, { shop: true, key: "show-shop" }), []);
  return <group>{looks.map((m, i) => <group key={i} position={[(i - 1) * 24, 0, -12]}>
    <mesh material={m} position={[0, 24, 0]} castShadow receiveShadow><boxGeometry args={[16, 40, 14]} /></mesh>
    {/* sized like the game's instanced plinths: a unit box scaled, base 0.5 m below the pavement */}
    <mesh material={shop} position={[0, 1.6, 0]} scale={[16.3, 4.2, 14.3]} castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /></mesh>
  </group>)}</group>;
}

/** set=district: a real Nexus district street (NexusDistricts) from pavement height beside street lamp `lamp`, looking along the kerb */
function districtView(lamp: number, up = 0): { cam: [number, number, number]; target: [number, number, number] } {
  const ls = streetLights(), l = ls[lamp % ls.length]!;
  const g = walkHeight(l.x, l.z);
  // along the kerb: the lamp arm points over the road (yaw), so the street runs at right angles to it
  const ax = Math.cos(l.yaw), az = -Math.sin(l.yaw), ox = Math.sin(l.yaw), oz = Math.cos(l.yaw);
  // stand at the kerb edge (the lamp arm reaches over the road), look down the street a little toward the buildings
  return { cam: [l.x + ox * 2.5 - ax * 8, g + 1.9 + up, l.z + oz * 2.5 - az * 8], target: [l.x - ox * 3 + ax * 40, g + 9, l.z - oz * 3 + az * 40] };
}

/** the sun, its shadow box centred on what is being looked at */
function Sun({ at, dir, night }: { at: [number, number, number]; dir: THREE.Vector3; night: boolean }) {
  const target = useMemo(() => { const o = new THREE.Object3D(); o.position.set(...at); return o; }, [at]);
  return <><primitive object={target} />
    <directionalLight target={target} position={[at[0] + dir.x, at[1] + dir.y, at[2] + dir.z]} intensity={night ? 0.25 : 3} color={night ? "#8fa8ff" : "#fff1dc"} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} shadow-camera-far={300} />
  </>;
}

export default function Showroom() {
  const { set, hour, close, lamp, up } = params();
  const night = hour < 6 || hour > 19;
  facadeNight.value = night ? 1 : 0;
  worldLight.night = night ? 1 : 0;
  const district = set === "district" ? districtView(lamp, up) : null;
  const sun = useMemo(() => { const a = ((hour - 6) / 12) * Math.PI; return new THREE.Vector3(Math.cos(a) * 40, Math.max(4, Math.sin(a) * 60), 25); }, [hour]);
  const far = set === "buildings" || set === "facades";
  return <div className="h-screen w-screen bg-black">
    <Canvas shadows dpr={1} camera={{ position: district ? district.cam : close ? [10, 2.4, 7] : far ? [40, 22, 55] : set === "cars" ? [9, 5, 13] : [18, 10, 26], fov: 42 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      <color attach="background" args={[night ? "#0b1220" : "#9fb8d0"]} />
      <hemisphereLight args={[night ? "#2a3550" : "#cfe2ff", "#3a342c", night ? 0.25 : 0.7]} />
      <Sun at={district ? district.target : [0, 0, 0]} dir={sun} night={night} />
      {night && <pointLight position={[0, 7, 4]} intensity={160} distance={40} color="#ffc27e" />}
      <Environment resolution={256}>
        <Lightformer intensity={night ? 0.15 : 1.4} position={[0, 30, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} color={night ? "#33405a" : "#dfeeff"} />
        <Lightformer intensity={night ? 0.6 : 1.2} position={[-30, 6, 10]} rotation-y={Math.PI / 2} scale={[40, 8, 1]} color={night ? "#ff6ad5" : "#ffffff"} />
        <Lightformer intensity={night ? 0.5 : 0.8} position={[30, 4, -10]} rotation-y={-Math.PI / 2} scale={[40, 6, 1]} color={night ? "#4fd8ff" : "#fff3e0"} />
      </Environment>
      {!district && <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[400, 400]} /><meshStandardMaterial color={night ? "#1b1d22" : "#4b4f55"} roughness={0.85} /></mesh>}
      {SETS[set] && <Lineup ids={SETS[set]!} gap={set === "cars" ? 7 : 13} />}
      {set === "buildings" && <Buildings />}
      {set === "facades" && <Facades />}
      {district && <Suspense fallback={null}><NexusDistricts /></Suspense>}
      <OrbitControls target={district ? district.target : close ? [0, 2.2, -4] : far ? [0, 14, -10] : [0, 0.8, 0]} />
    </Canvas>
  </div>;
}
