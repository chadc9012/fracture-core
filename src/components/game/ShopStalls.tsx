import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { QuietModel } from "./Vehicle";
import { REGIONAL_SHOPS } from "@/game/regional-shops";
import { shopAccessKind } from "@/game/shop-access";
import { walkHeight } from "@/game/terrain";
import { DistrictLight } from "./DistrictLight";
import { KIND_COLOR } from "./Storefronts";

/** Open-air vendor tables: counter, canopy and a glowing kind-coloured sign so shops read from a distance.
 * Only "table" shops get a stall — walk-in shops have a real storefront building and window shops a
 * service facade (Storefronts.tsx), and rendering a stall on top of those would double them up. */
export function ShopStalls() {
  const stalls = useMemo(() => REGIONAL_SHOPS.filter((s) => shopAccessKind(s.id) === "table").map((s) => ({ ...s, y: walkHeight(s.x, s.z) })), []);
  return (
    <group>
      {stalls.map((s) => (
        <group key={s.id} position={[s.x, s.y, s.z]}>
          <QuietModel url={STALL_URL} fallback={<PrimitiveStall />}>
            <Suspense fallback={<PrimitiveStall />}><Stall tint={KIND_COLOR[s.kind] ?? "#2f7f96"} /></Suspense>
          </QuietModel>
          <mesh position={[0, 2.38, 0.98]}>
            <boxGeometry args={[1.8, 0.35, 0.05]} />
            <meshBasicMaterial color={KIND_COLOR[s.kind]} toneMapped={false} />
          </mesh>
          {/* warm lantern under the canopy lights the counter; the sign casts a soft wash of its own colour */}
          <mesh position={[0, 2.75, 0.2]}><sphereGeometry args={[0.12, 10, 8]} /><meshStandardMaterial color="#2a1a0c" emissive="#ffb35c" emissiveIntensity={2.2} toneMapped={false} /></mesh>
          <DistrictLight range={45} position={[0, 2.6, 0.4]} color="#ffb867" intensity={6} distance={9} decay={2} />
          <DistrictLight range={45} position={[0, 2.4, 1.1]} color={KIND_COLOR[s.kind]} intensity={2.2} distance={5} decay={2} />
        </group>
      ))}
    </group>
  );
}

/** the authored market stall (scripts/build-stall.py): plank counter, steel posts, a sagging striped canopy with a
 * scalloped valance, produce crates, a jar shelf and a lantern. Its coloured stripes ("Paint") take the shop kind's
 * colour, muted toward canvas so a street of stalls reads as dyed cloth, not neon. */
const STALL_URL = "/models/props/market-stall.glb";
const canvasTone = new THREE.Color("#8d8370");
function Stall({ tint }: { tint: string }) {
  const { scene } = useGLTF(STALL_URL);
  const root = useMemo(() => {
    const r = scene.clone(true);
    r.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true;
      const swap = (mat: THREE.Material) => { if (mat.name !== "Paint") return mat; const c = (mat as THREE.MeshStandardMaterial).clone(); c.color.set(tint).lerp(canvasTone, 0.35); return c; };
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
    });
    return r;
  }, [scene, tint]);
  return <primitive object={root} />;
}
function PrimitiveStall() {
  return <group>
    <mesh position={[0, 0.55, 0]} castShadow receiveShadow><boxGeometry args={[2.4, 1.1, 1]} /><meshStandardMaterial color="#2d3744" metalness={0.5} roughness={0.5} /></mesh>
    <mesh position={[0, 3, 0]} rotation-x={0.15}><boxGeometry args={[2.8, 0.08, 1.8]} /><meshStandardMaterial color="#39424f" roughness={0.8} /></mesh>
  </group>;
}
