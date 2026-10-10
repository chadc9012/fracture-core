import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { softSprite } from "./softSprite";

/**
 * Visual weather particles for the region the player is currently standing in. Scene.tsx already
 * computes a "weather" label per region (Rain mist / Ashfall / Snow haze / Dust front / Clear
 * shield / Indoor) every frame for the HUD readout and the procedural ambience track in audio.ts —
 * this reads the same label from a ref (weatherRef, updated by Scene's own frame loop) so the
 * particles react instantly to a region change with no extra state plumbing or re-renders.
 *
 * All four systems stay mounted (cheap static geometry) but only the active one does per-particle
 * work each frame — the others just get `visible = false` and bail out immediately.
 */
const dummy = new THREE.Object3D();
const spin = new THREE.Quaternion();
const AXIS_Z = new THREE.Vector3(0, 0, 1);
/** Face the camera, then roll about the view axis, so flat textured flakes read as soft round particles from every angle. */
function billboard(cam: THREE.Camera, roll: number) {
  dummy.quaternion.copy(cam.quaternion);
  dummy.quaternion.multiply(spin.setFromAxisAngle(AXIS_Z, roll));
}

type WeatherKind = "Rain mist" | "Ashfall" | "Snow haze" | "Dust front" | "Clear shield" | "Indoor";

function useField(count: number, seed: number) {
  return useMemo(() => {
    let s = seed;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    return Array.from({ length: count }, () => ({
      x: (rnd() - 0.5) * 2,
      y: rnd(),
      z: (rnd() - 0.5) * 2,
      speed: 0.6 + rnd() * 0.8,
      drift: (rnd() - 0.5) * 2,
      phase: rnd() * Math.PI * 2,
    }));
  }, [count, seed]);
}

export type WeatherFx = { precipitation: number; windX: number; windZ: number };

function Rain({ playerRef, weatherRef, fxRef }: { playerRef: React.RefObject<THREE.Object3D>; weatherRef: React.RefObject<string>; fxRef?: React.RefObject<WeatherFx> | undefined }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const field = useField(420, 71);
  const spread = 60;
  const top = 42;
  useFrame((_, dt) => {
    const active = weatherRef.current === "Rain mist";
    if (mesh.current) mesh.current.visible = active;
    if (!active || !mesh.current || !playerRef.current) return;
    const p = playerRef.current.position;
    const fx = fxRef?.current;
    const precip = fx ? Math.max(0.2, fx.precipitation) : 0.6;
    const wX = fx?.windX ?? 0, wZ = fx?.windZ ?? 0;
    const fall = 34 + precip * 16;
    // tilt streaks along the wind; storms draw more drops
    const tiltX = Math.atan2(wZ, fall) , tiltZ = -Math.atan2(wX, fall);
    const shown = Math.floor(field.length * precip);
    mesh.current.count = shown;
    for (let i = 0; i < shown; i++) {
      const pt = field[i]!;
      pt.y -= (dt * fall * pt.speed) / top;
      pt.x += (wX * dt) / spread; pt.z += (wZ * dt) / spread;
      if (pt.x > 1) pt.x -= 2; else if (pt.x < -1) pt.x += 2;
      if (pt.z > 1) pt.z -= 2; else if (pt.z < -1) pt.z += 2;
      if (pt.y < 0) {
        pt.y = 1;
        pt.x = Math.random() * 2 - 1;
        pt.z = Math.random() * 2 - 1;
      }
      dummy.position.set(p.x + pt.x * spread, p.y + pt.y * top, p.z + pt.z * spread);
      dummy.rotation.set(tiltX, 0, tiltZ);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, field.length]} frustumCulled={false} visible={false}>
      <cylinderGeometry args={[0.012, 0.012, 0.85, 3]} />
      <meshBasicMaterial color="#bcd8e8" transparent opacity={0.4} depthWrite={false} fog={false} />
    </instancedMesh>
  );
}

function Snow({ playerRef, weatherRef }: { playerRef: React.RefObject<THREE.Object3D>; weatherRef: React.RefObject<string> }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const map = useMemo(() => softSprite("flake"), []);
  const field = useField(220, 137);
  const spread = 55;
  const top = 38;
  useFrame(({ clock, camera }, dt) => {
    const active = weatherRef.current === "Snow haze";
    if (mesh.current) mesh.current.visible = active;
    if (!active || !mesh.current || !playerRef.current) return;
    const p = playerRef.current.position;
    const t = clock.elapsedTime;
    for (let i = 0; i < field.length; i++) {
      const pt = field[i]!;
      pt.y -= (dt * 5 * pt.speed) / top;
      if (pt.y < 0) {
        pt.y = 1;
        pt.x = Math.random() * 2 - 1;
        pt.z = Math.random() * 2 - 1;
      }
      const sway = Math.sin(t * 0.8 + pt.phase) * 1.4;
      dummy.position.set(p.x + pt.x * spread + sway, p.y + pt.y * top, p.z + pt.z * spread + sway * 0.6);
      billboard(camera, pt.phase + t * 0.4 * pt.drift);
      dummy.scale.setScalar(0.9 + Math.sin(pt.phase) * 0.3);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, field.length]} frustumCulled={false} visible={false}>
      <planeGeometry args={[0.26, 0.26]} />
      <meshBasicMaterial map={map} color="#ffffff" transparent opacity={0.9} depthWrite={false} fog={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Ashfall({ playerRef, weatherRef }: { playerRef: React.RefObject<THREE.Object3D>; weatherRef: React.RefObject<string> }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const map = useMemo(() => softSprite("ember"), []);
  const field = useField(180, 211);
  const spread = 50;
  const top = 34;
  useFrame(({ clock, camera }, dt) => {
    const active = weatherRef.current === "Ashfall";
    if (mesh.current) mesh.current.visible = active;
    if (!active || !mesh.current || !playerRef.current) return;
    const p = playerRef.current.position;
    const t = clock.elapsedTime;
    for (let i = 0; i < field.length; i++) {
      const pt = field[i]!;
      pt.y -= (dt * 3.2 * pt.speed) / top;
      if (pt.y < 0) {
        pt.y = 1;
        pt.x = Math.random() * 2 - 1;
        pt.z = Math.random() * 2 - 1;
      }
      const sway = Math.sin(t * 0.5 + pt.phase) * 1.1;
      dummy.position.set(p.x + pt.x * spread + sway, p.y + pt.y * top, p.z + pt.z * spread);
      const flicker = 0.6 + Math.sin(t * 3 + pt.phase * 4) * 0.4;
      billboard(camera, 0);
      dummy.scale.setScalar(0.5 + flicker * 0.3);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, field.length]} frustumCulled={false} visible={false}>
      <planeGeometry args={[0.34, 0.34]} />
      <meshBasicMaterial map={map} color="#ff8a3d" transparent opacity={0.8} depthWrite={false} fog={false} toneMapped={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Dust({ playerRef, weatherRef }: { playerRef: React.RefObject<THREE.Object3D>; weatherRef: React.RefObject<string> }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const map = useMemo(() => softSprite("dot"), []);
  const field = useField(220, 313);
  const spread = 70;
  useFrame(({ clock, camera }, dt) => {
    const active = weatherRef.current === "Dust front";
    if (mesh.current) mesh.current.visible = active;
    if (!active || !mesh.current || !playerRef.current) return;
    const p = playerRef.current.position;
    const t = clock.elapsedTime;
    for (let i = 0; i < field.length; i++) {
      const pt = field[i]!;
      pt.x += dt * 3.5 * pt.speed * Math.sign(pt.drift || 1);
      if (pt.x > 1) pt.x = -1;
      if (pt.x < -1) pt.x = 1;
      const bob = Math.sin(t * 0.6 + pt.phase) * 0.6;
      dummy.position.set(p.x + pt.x * spread, p.y + 0.4 + pt.y * 4.5 + bob, p.z + pt.z * spread);
      billboard(camera, 0);
      dummy.scale.setScalar(1.1 + Math.sin(pt.phase) * 0.4);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, field.length]} frustumCulled={false} visible={false}>
      <planeGeometry args={[1.1, 1.1]} />
      <meshBasicMaterial map={map} color="#cbb27a" transparent opacity={0.3} depthWrite={false} fog={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

export function Weather({ playerRef, weatherRef, fxRef }: { playerRef: React.RefObject<THREE.Object3D>; weatherRef: React.RefObject<string>; fxRef?: React.RefObject<WeatherFx> | undefined }) {
  return (
    <group>
      <Rain playerRef={playerRef} weatherRef={weatherRef} fxRef={fxRef} />
      <Snow playerRef={playerRef} weatherRef={weatherRef} />
      <Ashfall playerRef={playerRef} weatherRef={weatherRef} />
      <Dust playerRef={playerRef} weatherRef={weatherRef} />
    </group>
  );
}

export type { WeatherKind };
