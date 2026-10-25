import { useMemo } from "react";
import * as THREE from "three";
import { beachSpots } from "@/game/ambient-population";
import { heightAt } from "@/game/terrain";

/** Sand, a parasol and a drinks cooler at each gentle shore that has beachgoers (ambient-population.ts `beachSpots`; the
 * people themselves are civilians in Civilians.tsx). The sand is a small grid draped on the terrain from just past the
 * waterline to a little behind the beachgoers' post, so it follows the slope instead of floating or clipping. Decorative:
 * no collision, no terrain change. Owner, Ambient Life & Beaches pass 15. */
const ALONG = 22, DEPTH = 16, SEG_A = 14, SEG_D = 10;

function sandPatch(edgeX: number, edgeZ: number, yaw: number): THREE.BufferGeometry {
  const sx = Math.sin(yaw), sz = Math.cos(yaw); // seaward
  const ax = Math.cos(yaw), az = -Math.sin(yaw); // along the shore
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= SEG_D; j++) {
    const d = -DEPTH + (j / SEG_D) * (DEPTH + 2); // 16 m inland .. 2 m past the edge
    for (let i = 0; i <= SEG_A; i++) {
      const a = (i / SEG_A - 0.5) * ALONG;
      const x = edgeX + sx * d + ax * a, z = edgeZ + sz * d + az * a;
      pos.push(x, heightAt(x, z) + 0.05, z);
      uv.push(i / SEG_A, j / SEG_D);
    }
  }
  for (let j = 0; j < SEG_D; j++) for (let i = 0; i < SEG_A; i++) {
    const k = j * (SEG_A + 1) + i;
    idx.push(k, k + SEG_A + 1, k + 1, k + 1, k + SEG_A + 1, k + SEG_A + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** soft-edged sand: opaque in the middle, fading out at the rim so it blends into the shore */
function sandMaterial(): THREE.MeshStandardMaterial {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const grad = x.createRadialGradient(32, 32, 10, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
  const alpha = new THREE.CanvasTexture(c);
  return new THREE.MeshStandardMaterial({ color: "#a08c66", roughness: 1, opacity: 0.85, alphaMap: alpha, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
}

export function CoastalBeaches() {
  const beaches = useMemo(() => {
    if (typeof document === "undefined") return null;
    const mat = sandMaterial();
    return beachSpots().map((s) => ({ s, geo: sandPatch(s.edgeX, s.edgeZ, s.yaw), mat }));
  }, []);
  if (!beaches) return null;
  return <group>{beaches.map(({ s, geo, mat }, i) => {
    const y = heightAt(s.x, s.z);
    const vx = s.x + Math.cos(s.yaw) * 5, vz = s.z - Math.sin(s.yaw) * 5; // the drinks seller's spot (beachgoerSpecs)
    return <group key={i}>
      <mesh geometry={geo} material={mat} receiveShadow renderOrder={1} />
      {/* parasol over the sunbather, tilted toward the sun side */}
      <group position={[s.x - Math.sin(s.yaw) * 1.4, y, s.z - Math.cos(s.yaw) * 1.4]} rotation={[0.12, s.yaw, 0]}>
        <mesh position={[0, 1.1, 0]} castShadow><cylinderGeometry args={[0.03, 0.03, 2.2, 6]} /><meshStandardMaterial color="#d8d4cc" roughness={0.6} /></mesh>
        <mesh position={[0, 2.2, 0]} castShadow><coneGeometry args={[1.4, 0.45, 10, 1, true]} /><meshStandardMaterial color="#b4553c" roughness={0.9} side={THREE.DoubleSide} /></mesh>
      </group>
      {/* towel */}
      <mesh position={[s.x + Math.sin(s.yaw) * 0.8, heightAt(s.x + Math.sin(s.yaw) * 0.8, s.z + Math.cos(s.yaw) * 0.8) + 0.07, s.z + Math.cos(s.yaw) * 0.8]} rotation={[-Math.PI / 2, 0, -s.yaw]} receiveShadow>
        <planeGeometry args={[0.9, 1.8]} /><meshStandardMaterial color="#2f6f8a" roughness={0.95} />
      </mesh>
      {/* the drinks seller's cooler */}
      <mesh position={[vx + Math.sin(s.yaw) * 0.8, heightAt(vx, vz) + 0.22, vz + Math.cos(s.yaw) * 0.8]} rotation={[0, s.yaw, 0]} castShadow>
        <boxGeometry args={[0.7, 0.44, 0.45]} /><meshStandardMaterial color="#e8e6df" roughness={0.6} />
      </mesh>
    </group>;
  })}</group>;
}
