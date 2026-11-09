import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EXTRACT, PVP_MODES, ZONE_RADIUS, royaleRadius, type PvpState } from "@/game/pvp";
import { walkHeight } from "@/game/terrain";

/** Killbox mode markers in the world (pvp.ts): Dominion's three capture zones (light rings tinted by who holds them), the
 * centre objective for the round modes (it lights up when the Ascendancy zone opens or the Lockdown objective is live), and
 * Fracture Royale's closing circle as a tall violet wall, and Extraction's data core (a turning amber crystal with a light column,
 * carried over its carrier's head) and the two extraction pads (yours cyan, theirs red). Reads the mutable match state every frame. */
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
  const wallRef = useRef<THREE.Mesh>(null), coreRef = useRef<THREE.Group>(null);
  const core = useMemo(() => ({ gem: new THREE.OctahedronGeometry(0.55, 1), column: new THREE.CylinderGeometry(0.25, 0.25, 30, 16, 1, true).translate(0, 15, 0), pad: new THREE.RingGeometry(EXTRACT.padRadius - 0.35, EXTRACT.padRadius, 64).rotateX(-Math.PI / 2), padBeam: new THREE.CylinderGeometry(EXTRACT.padRadius, EXTRACT.padRadius, 6, 64, 1, true).translate(0, 3, 0) }), []);
  const coreMats = useMemo(() => ({
    gem: new THREE.MeshStandardMaterial({ color: "#ffd27a", emissive: "#ffb02e", emissiveIntensity: 2.4, roughness: 0.2, metalness: 0.3, toneMapped: false }),
    column: new THREE.MeshBasicMaterial({ color: "#ffb02e", transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    pads: (["#38e8ff", "#ff4a3a"] as const).map((c) => ({ ring: new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, toneMapped: false, side: THREE.DoubleSide }), beam: new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }) })),
  }), []);
  useEffect(() => () => { Object.values(core).forEach((g) => g.dispose()); coreMats.gem.dispose(); coreMats.column.dispose(); coreMats.pads.forEach((p) => { p.ring.dispose(); p.beam.dispose(); }); }, [core, coreMats]);
  const pads = state.core ? [state.core.pads.us, state.core.pads.them].map((p) => ({ x: center.x + p.x, z: center.z + p.z })) : [];
  const padYs = useMemo(() => pads.map((p) => walkHeight(p.x, p.z) + 0.08), [pads.length]); // eslint-disable-line react-hooks/exhaustive-deps
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
    const c = state.core, g = coreRef.current;
    if (c && g) {
      const x = center.x + c.x, z = center.z + c.z, held = c.holder !== null;
      g.position.set(x, walkHeight(x, z) + (held ? 2.5 : 1.1) + Math.sin(clock.elapsedTime * 2) * 0.12, z);
      g.rotation.y = clock.elapsedTime * 1.4;
      coreMats.gem.emissive.set(c.holder === "them" ? "#ff4a3a" : c.holder === "us" ? "#38e8ff" : "#ffb02e");
      coreMats.column.color.copy(coreMats.gem.emissive); coreMats.column.opacity = held ? 0.18 : 0.28 * pulse;
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
      {mode.kind === "extract" && state.core && <>
        <group ref={coreRef}><mesh geometry={core.gem} material={coreMats.gem} /><mesh geometry={core.column} material={coreMats.column} /></group>
        {pads.map((p, i) => (
          <group key={i} position={[p.x, padYs[i] ?? 0, p.z]}>
            <mesh geometry={core.pad} material={coreMats.pads[i]!.ring} />
            <mesh geometry={core.padBeam} material={coreMats.pads[i]!.beam} />
          </group>
        ))}
      </>}
      {mode.kind === "royale" && <mesh ref={wallRef} geometry={wall} material={mats.wall} position={[center.x, 40, center.z]} />}
    </group>
  );
}
