import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { localBounds } from "@/game/vehicle-bounds";

import { FLEET_MODELS, paintColor, type FleetModel } from "@/game/fleet-models";
import type { VehicleCosmetics } from "@/game/fleet";
import { QuietModel } from "./Vehicle";

/**
 * An authored fleet model (public/models/fleet, built by scripts/build-fleet.py): clear-coated paint, real wheels, glass,
 * lamps and rotors. Reads the node names documented in src/game/fleet-models.ts: wheels roll with the car's speed and the
 * front pivots steer, rotors spin, tail lamps brighten while braking, paint follows the garage choice and the saved
 * cosmetics switch the spoiler, underglow, wheels and bolt-on kit. Every copy gets its own paint/lamp materials, so a
 * painted player car never repaints the traffic that shares the file. A model that cannot load draws a plain hull.
 */
type Props = {
  model: FleetModel;
  paint?: string | null | undefined;
  cosmetics?: VehicleCosmetics | null | undefined;
  speedRef?: MutableRefObject<number>;
  steerRef?: MutableRefObject<number>;
  brakeRef?: MutableRefObject<number>;
  boundsRef?: MutableRefObject<THREE.Box3 | null>;
  lights?: boolean;
  /** parked / showroom copies skip shadows of their own when false */
  shadows?: boolean;
  /** the model's ground plane relative to the parent (the driven car's group sits at body height, 1.9 m up) */
  lift?: number;
};

export function AuthoredVehicle(props: Props) {
  const fallback = <group position-y={props.lift ?? 0}><PlainHull /></group>;
  return (
    <QuietModel url={props.model.url} fallback={fallback}>
      <Suspense fallback={fallback}><VehicleBody {...props} /></Suspense>
    </QuietModel>
  );
}

function PlainHull() {
  return (
    <group>
      <mesh position={[0, 0.75, 0]} castShadow><boxGeometry args={[2, 0.8, 4.6]} /><meshStandardMaterial color="#2a2e36" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 1.3, -0.2]} castShadow><boxGeometry args={[1.6, 0.5, 2.2]} /><meshStandardMaterial color="#10141a" metalness={0.2} roughness={0.1} /></mesh>
    </group>
  );
}

const GLOW: Record<VehicleCosmetics["glow"], string | null> = { off: null, cyan: "#00eaff", magenta: "#ff45d4" };

function VehicleBody({ model, paint, cosmetics, speedRef, steerRef, brakeRef, boundsRef, lights = false, shadows = true, lift = 0 }: Props) {
  const { scene } = useGLTF(model.url);
  const rig = useMemo(() => {
    const root = scene.clone(true);
    const wheels: { node: THREE.Object3D; radius: number }[] = [];
    const steer: THREE.Object3D[] = [];
    const rotors: THREE.Object3D[] = [];
    const tailRotors: THREE.Object3D[] = [];
    const tails: THREE.MeshStandardMaterial[] = [];
    const heads: THREE.MeshStandardMaterial[] = [];
    let paintMat: THREE.MeshStandardMaterial | null = null, rimMat: THREE.MeshStandardMaterial | null = null;
    let wing: THREE.Object3D | null = null, underglow: THREE.Object3D | null = null;
    const own = new Map<THREE.Material, THREE.Material>();
    const mine = (m: THREE.Material) => { let c = own.get(m); if (!c) { c = m.clone(); own.set(m, c); } return c; };
    root.traverse((o) => {
      if (o.name.startsWith("Steer")) steer.push(o);
      else if (o.name.startsWith("Wheel")) wheels.push({ node: o, radius: Number((o.userData as { wheelRadius?: number }).wheelRadius) || 0.36 });
      else if (o.name === "RotorTail") tailRotors.push(o);
      else if (o.name.startsWith("Rotor")) rotors.push(o);
      else if (o.name === "Wing") wing = o;
      else if (o.name === "Underglow") underglow = o;
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = shadows; mesh.receiveShadow = shadows;
      const swap = (m: THREE.Material) => {
        const name = m.name;
        if (name === "Paint" || name === "Taillight" || name === "Headlight" || name === "Rim" || name === "Accent") {
          const c = mine(m) as THREE.MeshStandardMaterial;
          if (name === "Paint") paintMat = c; else if (name === "Rim") rimMat = c;
          else if (name === "Taillight" && !tails.includes(c)) tails.push(c);
          else if (name === "Headlight" && !heads.includes(c)) heads.push(c);
          return c;
        }
        if (name === "Glass") { const g = m as THREE.MeshStandardMaterial; g.transparent = true; g.depthWrite = false; g.envMapIntensity = 1.6; }
        return m;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
    const baseColor = paintMat ? (paintMat as THREE.MeshStandardMaterial).color.clone() : null;
    const baseRim = rimMat ? (rimMat as THREE.MeshStandardMaterial).color.clone() : null;
    // aircraft were built without landing gear and their lowest point sits ~1 m above the model origin, so a landed jet
    // floated; seat any body whose underside is that high on its own underside (cars sit at ~0 and hover bikes at ~0.2 keep theirs)
    const under = localBounds(root).min.y;
    const seat = under > 0.4 ? under : 0;
    return { seat, root, wheels, steer, rotors, tailRotors, tails, heads, paintMat: paintMat as THREE.MeshStandardMaterial | null, rimMat: rimMat as THREE.MeshStandardMaterial | null, baseColor, baseRim, wing: wing as THREE.Object3D | null, underglow: underglow as THREE.Object3D | null };
  }, [scene, shadows]);

  // garage paint
  useEffect(() => {
    if (!rig.paintMat || !rig.baseColor) return;
    const hex = paintColor(paint);
    if (hex) rig.paintMat.color.set(hex); else rig.paintMat.color.copy(rig.baseColor);
  }, [rig, paint]);

  // cosmetics: no saved entry shows the model as authored
  const kit = useMemo(() => {
    if (!cosmetics) return null;
    const box = new THREE.Box3().setFromObject(rig.root);
    return { box, glow: GLOW[cosmetics.glow] };
  }, [rig, cosmetics]);
  useEffect(() => {
    if (rig.wing) { rig.wing.visible = !cosmetics || cosmetics.spoiler !== "none" || model.id === "street-racer"; rig.wing.scale.setScalar(cosmetics?.spoiler === "lip" ? 0.7 : 1); }
    if (rig.underglow) rig.underglow.visible = !cosmetics || cosmetics.glow !== "off";
    if (rig.underglow && kit?.glow) rig.underglow.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mm?.emissive) { const c = mm.clone(); c.color.set(kit.glow!); c.emissive.set(kit.glow!); (o as THREE.Mesh).material = c; } });
    if (rig.rimMat && rig.baseRim) { if (cosmetics?.wheels === "sport") rig.rimMat.color.set("#1c1d21"); else rig.rimMat.color.copy(rig.baseRim); }
    const s = cosmetics?.wheels === "offroad" ? 1.08 : 1;
    for (const w of rig.wheels) w.node.scale.setScalar(s);
  }, [rig, cosmetics, kit, model.id]);

  useEffect(() => {
    if (!boundsRef) return;
    const b = localBounds(rig.root); // root-local, not world: see vehicle-bounds.ts
    const up = new THREE.Vector3(0, lift - rig.seat * model.scale, 0);
    boundsRef.current = new THREE.Box3(b.min.clone().multiplyScalar(model.scale).add(up), b.max.clone().multiplyScalar(model.scale).add(up));
    return () => { boundsRef.current = null; };
  }, [boundsRef, rig, model.scale, lift]);

  const wasBraking = useRef(-1);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const v = speedRef?.current ?? 0;
    for (const w of rig.wheels) w.node.rotation.x += (v / (w.radius * model.scale)) * dt;
    const steer = THREE.MathUtils.clamp(steerRef?.current ?? 0, -0.5, 0.5);
    for (const s of rig.steer) s.rotation.y = steer;
    for (const r of rig.rotors) r.rotation.y += dt * (14 + Math.abs(v) * 0.4);
    for (const r of rig.tailRotors) r.rotation.x += dt * 30;
    const brake = Math.round((brakeRef?.current ?? 0) * 10) / 10;
    if (brake !== wasBraking.current) {
      wasBraking.current = brake;
      for (const t of rig.tails) t.emissiveIntensity = 1.2 + brake * 5;
    }
  });

  useEffect(() => { for (const h of rig.heads) h.emissiveIntensity = lights ? 9 : 4; }, [rig, lights]);

  const k = kit?.box;
  return (
    <group scale={model.scale} position-y={lift - rig.seat * model.scale}>
      <primitive object={rig.root} />
      {k && cosmetics?.armor === "reinforced" && [-1, 1].map((s) => (
        <mesh key={s} position={[s * (k.max.x + 0.02), (k.min.y + k.max.y) * 0.32, (k.min.z + k.max.z) / 2]} castShadow>
          <boxGeometry args={[0.07, 0.38, (k.max.z - k.min.z) * 0.5]} />
          <meshStandardMaterial color="#4a5257" metalness={0.75} roughness={0.55} />
        </mesh>
      ))}
      {k && cosmetics?.body === "aero" && (
        <mesh position={[0, k.min.y + 0.12, k.max.z - 0.15]} castShadow><boxGeometry args={[(k.max.x - k.min.x) * 0.92, 0.04, 0.3]} /><meshStandardMaterial color="#111317" metalness={0.4} roughness={0.4} /></mesh>
      )}
      {k && cosmetics?.body === "widebody" && [-1, 1].map((s) => (
        <mesh key={s} position={[s * (k.max.x + 0.01), k.min.y + 0.32, (k.min.z + k.max.z) / 2]} castShadow><boxGeometry args={[0.06, 0.12, (k.max.z - k.min.z) * 0.72]} /><meshStandardMaterial color="#111317" metalness={0.4} roughness={0.4} /></mesh>
      ))}
      {k && !rig.wing && cosmetics && cosmetics.spoiler !== "none" && (
        <mesh position={[0, k.max.y * (cosmetics.spoiler === "wing" ? 0.85 : 0.72), k.min.z + 0.25]} castShadow><boxGeometry args={[(k.max.x - k.min.x) * 0.9, 0.04, 0.3]} /><meshStandardMaterial color="#14161a" metalness={0.5} roughness={0.35} /></mesh>
      )}
      {kit?.glow && <pointLight position={[0, 0.15, 0]} color={kit.glow} intensity={3} distance={5} decay={2} />}
    </group>
  );
}

/** warm the cache for the models the world shows most */
export function preloadFleetModels(ids: (keyof typeof FLEET_MODELS)[]) {
  for (const id of ids) useGLTF.preload(FLEET_MODELS[id].url);
}
