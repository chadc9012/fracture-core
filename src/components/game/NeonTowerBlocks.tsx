import { useGLTF } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { TOWER_FOOTPRINT, neonTowersWorld, type TowerPlacement, type TowerVariant } from "@/game/neon-layout";
import { neonPlateauLevel } from "@/game/terrain";
import { addObstacle } from "@/game/obstacles";
import { neonKeepOut } from "@/game/residences";
import { QuietModel } from "./Vehicle";

/**
 * Neon City's skyline: the authored towers (scripts/build-city.py) on the street grid from neon-layout.ts, standing on
 * the city plateau. Drawn instanced — one draw per variant per material instead of one per building — with each
 * tower's neon trim tinted from its own colour. If the file can't load, plain dark massing blocks stand in so the
 * streets and collision are the same either way.
 */
export const NEON_TOWERS_URL = "/models/city/neon-towers.glb";
const VARIANTS: TowerVariant[] = ["A", "B", "C", "D", "E", "F"];

function usePlacements() {
  return useMemo(() => {
    // same keep-out list the residences are laid out with, so the two can never claim the same block
    const list = neonTowersWorld(neonKeepOut());
    for (const t of list) {
      const [hx, hz] = TOWER_FOOTPRINT[t.variant];
      addObstacle("tower", t.x, t.z, Math.max(hx, hz) * 0.95, 400, 2);
    }
    return { list, y: neonPlateauLevel() };
  }, []);
}

const matrixFor = (t: TowerPlacement, y: number) =>
  new THREE.Matrix4().compose(new THREE.Vector3(t.x, y, t.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (t.rot * Math.PI) / 2), new THREE.Vector3(1, 1, 1));

function AuthoredTowers({ list, y }: { list: TowerPlacement[]; y: number }) {
  const { scene } = useGLTF(NEON_TOWERS_URL);
  const meshes = useMemo(() => {
    const out: THREE.InstancedMesh[] = [];
    // trims glow in each tower's own colour: an unlit material tinted per instance (instance colours multiply `color`)
    const trim = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(2.4), toneMapped: false });
    for (const v of VARIANTS) {
      const mine = list.filter((t) => t.variant === v);
      const root = scene.getObjectByName(`NeonTower${v}`);
      if (!root || !mine.length) continue;
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        const src = o as THREE.Mesh;
        if (!src.isMesh) return;
        const isTrim = (src.material as THREE.Material).name === "NeonTrim";
        const im = new THREE.InstancedMesh(src.geometry, isTrim ? trim : src.material, mine.length);
        // geometry is relative to the variant's root; keep any child offset the exporter wrote
        const local = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(src.matrixWorld);
        mine.forEach((t, i) => {
          im.setMatrixAt(i, matrixFor(t, y).multiply(local));
          if (isTrim) im.setColorAt(i, new THREE.Color(t.glow));
        });
        im.castShadow = !isTrim; im.receiveShadow = !isTrim;
        im.computeBoundingSphere();
        out.push(im);
      });
    }
    return out;
  }, [scene, list, y]);
  return <group>{meshes.map((m, i) => <primitive key={i} object={m} />)}</group>;
}

/** massing stand-in: one dark block per tower at the variant's real footprint and a typical height */
function MassingTowers({ list, y }: { list: TowerPlacement[]; y: number }) {
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#1a1d24", roughness: 0.6, metalness: 0.4 }), list.length);
    const H: Record<TowerVariant, number> = { A: 56, B: 64, C: 80, D: 26, E: 92, F: 50 };
    list.forEach((t, i) => {
      const [hx, hz] = TOWER_FOOTPRINT[t.variant];
      const h = H[t.variant];
      im.setMatrixAt(i, matrixFor(t, y).multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, h / 2, 0), new THREE.Quaternion(), new THREE.Vector3(hx * 2, h, hz * 2))));
    });
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    return im;
  }, [list, y]);
  return <primitive object={mesh} />;
}

export function NeonTowerBlocks() {
  const { list, y } = usePlacements();
  const fallback = <MassingTowers list={list} y={y} />;
  return (
    <QuietModel url={NEON_TOWERS_URL} fallback={fallback}>
      <Suspense fallback={fallback}><AuthoredTowers list={list} y={y} /></Suspense>
    </QuietModel>
  );
}

if (typeof window !== "undefined") useGLTF.preload(NEON_TOWERS_URL);
