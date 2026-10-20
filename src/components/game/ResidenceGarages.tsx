import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { BAY_W, DOOR_H, GARAGE_D, WALL, bayPose, bayX, garageBoxes, garageDecks, garageWalls, garageWidth, residences, type Garage } from "@/game/residences";
import { ownsDeed, parkedIn } from "@/game/residence-deeds";
import { fleetById } from "@/game/fleet";
import { vehicleById } from "@/game/vehicles";
import { MODELS, type ModelKey } from "@/game/models";
import type { PlayerProgression } from "@/game/progression";
import { setWalls, clearWalls } from "@/game/walls";
import { registerDeck } from "@/game/district-decks";
import { Car, QuietModel } from "./Vehicle";
import { mergeByMat } from "./ResidentialHomes";

/**
 * Each walk-in home's garage (layout in residences.ts, deeds in residence-deeds.ts): the shell merged into a few meshes
 * per city, one overhead door per bay, a lamp over each door (green: yours, red: someone else's) and the fleet vehicles
 * you parked there standing in their bays. The doors swing up and back under the ceiling when the owner walks or drives
 * up, and drop shut behind them; a closed door is a wall (walls.ts), so nobody drives into a garage that isn't theirs.
 * Step out of your car inside one of your own garages and it is parked there (GameCanvas, vehicle-request.ts).
 */
const OPEN_REACH = 13;   // metres from the garage front the owner's doors start to open
const SPEED = 0.9;       // full swing in ~1.1 s

const doorMat = new THREE.MeshStandardMaterial({ color: "#c9ccd0", roughness: 0.55, metalness: 0.35 });
const slatMat = new THREE.MeshStandardMaterial({ color: "#9a9ea4", roughness: 0.6, metalness: 0.3 });
const okLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color("#3dff8a").multiplyScalar(1.6), toneMapped: false });
const noLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff3b3b").multiplyScalar(1.4), toneMapped: false });

export function ResidenceGarages({ city, progression }: { city: "nexus" | "neon"; progression: { nexLedger: PlayerProgression["nexLedger"]; housing?: PlayerProgression["housing"] | undefined; fleet?: PlayerProgression["fleet"] | undefined } }) {
  const homes = useMemo(() => residences().filter((r) => r.city === city && r.garage), [city]);
  const shells = useMemo(() => mergeByMat(homes.flatMap((h) => garageBoxes(h.garage!, h.garage!.floor - h.garage!.base).map((b) => ({ b, at: h.garage! }))), `garages:${city}`), [homes, city]);
  useEffect(() => () => { for (const m of shells) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }, [shells]);
  useEffect(() => { for (const h of homes) for (const d of garageDecks(h.id, h.garage!)) registerDeck(d); }, [homes]);
  if (!homes.length) return null;
  return <group name={`garages-${city}`}>
    {shells.map((m) => <primitive key={m.name} object={m} />)}
    {homes.map((h) => <HomeGarage key={h.id} id={h.id} g={h.garage!} owned={ownsDeed(progression, h.id)} parked={parkedIn(progression, h.id)} />)}
  </group>;
}

function HomeGarage({ id, g, owned, parked }: { id: string; g: Garage; owned: boolean; parked: string[] }) {
  const camera = useThree((s) => s.camera);
  const doors = useRef<(THREE.Group | null)[]>([]);
  const open = useRef<number[]>(Array.from({ length: g.bays }, () => 0));
  const solid = useRef<boolean[]>(Array.from({ length: g.bays }, () => false));
  const wallId = `${id}:garage`;
  useEffect(() => { setWalls(wallId, garageWalls(g, solid.current)); return () => clearWalls(wallId); }, [g, wallId]);
  const front = useMemo(() => ({ x: g.x + (GARAGE_D / 2 + 2) * Math.sin(g.rot), z: g.z + (GARAGE_D / 2 + 2) * Math.cos(g.rot) }), [g]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const near = owned && Math.hypot(camera.position.x - front.x, camera.position.z - front.z) < OPEN_REACH;
    let changed = false;
    for (let i = 0; i < g.bays; i++) {
      const t = open.current[i]!, goal = near ? 1 : 0;
      const n = goal > t ? Math.min(goal, t + dt * SPEED) : Math.max(goal, t - dt * SPEED);
      open.current[i] = n;
      // eased swing about the door's top edge, up and back to lie flat under the ceiling
      const e = n * n * (3 - 2 * n), d = doors.current[i];
      if (d) d.rotation.x = e * Math.PI / 2;
      const passable = n > 0.8;
      if (passable !== solid.current[i]) { solid.current[i] = passable; changed = true; }
    }
    if (changed) setWalls(wallId, garageWalls(g, solid.current));
  });
  const z = GARAGE_D / 2 - WALL - 0.06;
  return <group position={[g.x, g.floor, g.z]} rotation={[0, g.rot, 0]}>
    {Array.from({ length: g.bays }, (_, i) => {
      const x = bayX(g, i), w = BAY_W - 0.32;
      return <group key={i}>
        {/* pivot on the door's top edge */}
        <group ref={(el) => { doors.current[i] = el; }} position={[x, DOOR_H, z]}>
          <mesh material={doorMat} position={[0, -DOOR_H / 2, 0]} castShadow receiveShadow><boxGeometry args={[w, DOOR_H, 0.06]} /></mesh>
          {[0.2, 0.4, 0.6, 0.8].map((k) => <mesh key={k} material={slatMat} position={[0, -DOOR_H * k, 0.035]}><boxGeometry args={[w - 0.04, 0.05, 0.02]} /></mesh>)}
        </group>
        <mesh material={owned ? okLamp : noLamp} position={[x, DOOR_H + 0.25, GARAGE_D / 2 + 0.02]}><boxGeometry args={[0.36, 0.08, 0.04]} /></mesh>
      </group>;
    })}
    {parked.slice(0, g.bays).map((v, i) => <ParkedVehicle key={v} fleetId={v} x={bayX(g, i)} />)}
  </group>;
}

/** a parked fleet vehicle, scaled down if it has to be to fit the bay (the game's drivable scales are generous) */
function ParkedVehicle({ fleetId, x }: { fleetId: string; x: number }) {
  const f = fleetById(fleetId);
  if (!f) return null;
  const v = vehicleById(f.base);
  return <QuietModel url={MODELS[v.model]} fallback={null}><Suspense fallback={null}><Fitted body={v.model} scale={v.modelScale} x={x} /></Suspense></QuietModel>;
}
function Fitted({ body, scale, x }: { body: ModelKey; scale: number; x: number }) {
  const { scene } = useGLTF(MODELS[body]);
  const wheel = useGLTF(MODELS.wheel).scene;
  const { fit, lift } = useMemo(() => {
    const b = new THREE.Box3().setFromObject(scene), w = b.max.x - b.min.x, l = b.max.z - b.min.z;
    const wb = new THREE.Box3().setFromObject(wheel);
    const fit = Math.min(scale, (BAY_W - 0.7) / Math.max(0.01, w), (GARAGE_D - 1.2) / Math.max(0.01, l));
    // wheels sit at the body origin (Vehicle.tsx WHEEL_OFFSETS y 0): stand them on the floor
    return { fit, lift: Math.max(-b.min.y, -wb.min.y, 0) * fit };
  }, [scene, wheel, scale]);
  return <group position={[x, lift, 0.2]}><Car body={body} scale={fit} lights={false} /></group>;
}

export { bayPose, garageWidth };
