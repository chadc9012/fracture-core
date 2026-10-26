import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PVP_MODES, ZONE_RADIUS, royaleRadius, type PvpState } from "@/game/pvp";
import { walkHeight } from "@/game/terrain";

/** Killbox mode markers in the world (pvp.ts): Dominion's three capture zones (light rings tinted by who holds them), the
 * centre objective for the round modes (it lights up when the Ascendancy zone opens or the Lockdown objective is live), and
 * Fracture Royale's closing circle as a tall violet wall. Reads the mutable match state every frame. */
export function PvpField({ state, center }: { state: PvpState; center: { x: number; z: number } }) {
  const mode = PVP_MODES[state.mode];
  const ring = useMemo(() => new THREE.RingGeometry(ZONE_RADIUS - 0.5, ZONE_RADIUS, 48).rotateX(-Math.PI / 2), []);
  const beam = useMemo(() => new THREE.CylinderGeometry(ZONE_RADIUS, ZONE_RADIUS, 14, 48, 1, true), []);
  const wall = useMemo(() => new THREE.CylinderGeometry(1, 1, 120, 128, 1, true), []);
  const mats = useMemo(() => ({
    ring: [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: "#cfd8e3", transparent: true, opacity: 0.85, toneMapped: false, side: THREE.DoubleSide })),
    beam: [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: "#cfd8e3", transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })),
    wall: new THREE.MeshBasicMaterial({ color: "#a050ff", transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
  }), []);
  useEffect(() => () => { ring.dispose(); beam.dispose(); wall.dispose(); mats.ring.forEach((m) => m.dispose()); mats.beam.forEach((m) => m.dispose()); mats.wall.dispose(); }, [ring, beam, wall, mats]);
  const wallRef = useRef<THREE.Mesh>(null);
  const zones = mode.kind === "zones" ? state.zones.map((z) => ({ x: center.x + z.dx, z: center.z + z.dz })) : mode.kind === "rounds" ? [{ x: center.x, z: center.z }] : [];
  const ys = useMemo(() => zones.map((z) => walkHeight(z.x, z.z) + 0.08), [zones.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => {
    const pulse = 0.6 + 0.4 * Math.sin(clock.elapsedTime * 3);
    if (mode.kind === "zones") state.zones.forEach((z, i) => {
      const c = z.owner === "us" ? "#38e8ff" : z.owner === "them" ? "#ff4a3a" : "#cfd8e3";
      mats.ring[i]!.color.set(c); mats.beam[i]!.color.set(c); mats.beam[i]!.opacity = 0.08 + 0.1 * Math.abs(z.cap) * pulse;
    });
    if (mode.kind === "rounds") {
      const live = mode.id === "lockdown" || state.roundClock >= (mode.roundTime ?? 90);
      mats.ring[0]!.color.set(live ? "#ffd166" : "#55606b"); mats.beam[0]!.color.set("#ffd166"); mats.beam[0]!.opacity = live ? 0.1 + 0.12 * pulse : 0;
    }
    if (wallRef.current) { const r = royaleRadius(state.clock).radius; wallRef.current.scale.set(r, 1, r); mats.wall.opacity = 0.16 + 0.08 * pulse; }
  });
  return (
    <group name="pvp-field">
      {zones.map((z, i) => (
        <group key={i} position={[z.x, ys[i] ?? 0, z.z]}>
          <mesh geometry={ring} material={mats.ring[i]!} />
          <mesh geometry={beam} material={mats.beam[i]!} position-y={7} />
        </group>
      ))}
      {mode.kind === "royale" && <mesh ref={wallRef} geometry={wall} material={mats.wall} position={[center.x, 40, center.z]} />}
    </group>
  );
}
