import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { cityStreets } from "@/game/city-streets";
import { GROUND_FLEET, assignLoops, findLoops, streetGrid } from "@/game/neon-ground-traffic";
import { drivenEdges, neonRoadworks, ROADWORKS } from "@/game/neon-roadworks";
import { addObstacle } from "@/game/obstacles";
import { walkHeight } from "@/game/terrain";
import { lampLevel, worldLight } from "@/game/world-light";

/** Neon City lane closures (neon-roadworks.ts): concrete jersey barriers with a yellow-black hazard band, striped traffic cones, and a
 * blinking amber lamp on the first barrier of each run. Four instanced draws; barriers are solid. */
function jerseyGeometry(): THREE.BufferGeometry {
  // the classic safety-shape profile: 0.6 m base, steep lower face, 0.24 m top, 0.81 m tall
  const s = new THREE.Shape();
  s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.28, 0.08); s.lineTo(0.16, 0.25); s.lineTo(0.12, 0.81); s.lineTo(-0.12, 0.81); s.lineTo(-0.16, 0.25); s.lineTo(-0.28, 0.08); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: ROADWORKS.barrierLen - 0.06, bevelEnabled: false });
  g.translate(0, 0, -(ROADWORKS.barrierLen - 0.06) / 2);
  g.computeVertexNormals();
  return g;
}
function coneGeometry(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(0.17, 0.7, 14, 1, true); g.translate(0, 0.39, 0);
  return g;
}

export function NeonRoadworks() {
  const works = useMemo(() => {
    const c = cityStreets("neon"), g = streetGrid(c);
    return neonRoadworks(c, g, drivenEdges(assignLoops(findLoops(g), GROUND_FLEET)));
  }, []);
  useEffect(() => {
    const added = works.barriers.map((b) => addObstacle("rock", b.x, b.z, 0.75, 1e9, 1));
    return () => { for (const o of added) o.broken = true; };
  }, [works]);

  const geo = useMemo(() => ({
    barrier: jerseyGeometry(), band: new THREE.BoxGeometry(0.26, 0.14, ROADWORKS.barrierLen - 0.1).translate(0, 0.62, 0),
    cone: coneGeometry(), base: new THREE.BoxGeometry(0.42, 0.04, 0.42).translate(0, 0.02, 0), stripe: new THREE.CylinderGeometry(0.105, 0.125, 0.12, 14, 1, true).translate(0, 0.46, 0),
    lamp: new THREE.SphereGeometry(0.09, 10, 8).translate(0, 0.9, 0),
  }), []);
  const mats = useMemo(() => ({
    concrete: new THREE.MeshStandardMaterial({ color: "#b8b4aa", roughness: 0.85 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.5, emissive: "#ffb000", emissiveIntensity: 0.15 }),
    cone: new THREE.MeshStandardMaterial({ color: "#ff5a12", roughness: 0.55, side: THREE.DoubleSide }),
    base: new THREE.MeshStandardMaterial({ color: "#1c1c1c", roughness: 0.9 }),
    stripe: new THREE.MeshStandardMaterial({ color: "#f4f4f4", emissive: "#ffffff", emissiveIntensity: 0.25, roughness: 0.3, side: THREE.DoubleSide }),
    lamp: new THREE.MeshStandardMaterial({ color: "#ffb000", emissive: "#ffa000", emissiveIntensity: 3, toneMapped: false }),
  }), []);
  useEffect(() => () => { Object.values(geo).forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); }, [geo, mats]);

  useFrame(({ clock }) => {
    const k = lampLevel(worldLight.night);
    mats.lamp.emissiveIntensity = (Math.sin(clock.elapsedTime * 6) > 0 ? 3.5 : 0.2) * (0.5 + 0.5 * k);
    mats.stripe.emissiveIntensity = 0.1 + 0.5 * k;   // retro-reflective bands catch the street light at night
    mats.hazard.emissiveIntensity = 0.08 + 0.3 * k;
  });

  const barrierItems = works.barriers.map((b) => ({ ...b, y: walkHeight(b.x, b.z) }));
  const coneItems = works.cones.map((c, i) => ({ x: c.x, z: c.z, yaw: i * 0.7, y: walkHeight(c.x, c.z) }));
  const lampItems = works.lamps.map((b) => ({ ...b, y: walkHeight(b.x, b.z) }));
  return (
    <group name="neon-roadworks">
      <Batch geo={geo.barrier} mat={mats.concrete} items={barrierItems} />
      <Batch geo={geo.band} mat={mats.hazard} items={barrierItems} shadow={false} />
      <Batch geo={geo.cone} mat={mats.cone} items={coneItems} />
      <Batch geo={geo.base} mat={mats.base} items={coneItems} shadow={false} />
      <Batch geo={geo.stripe} mat={mats.stripe} items={coneItems} shadow={false} />
      <Batch geo={geo.lamp} mat={mats.lamp} items={lampItems} shadow={false} />
    </group>
  );
}

let hazardTex: THREE.CanvasTexture | null = null;
/** yellow and black diagonal hazard stripes */
function hazardTexture(): THREE.CanvasTexture | null {
  if (hazardTex) return hazardTex;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 128; c.height = 16;
  const g = c.getContext("2d"); if (!g) return null;
  g.fillStyle = "#f2c200"; g.fillRect(0, 0, 128, 16);
  g.fillStyle = "#111111";
  for (let x = -16; x < 144; x += 16) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 8, 16); g.lineTo(x + 16, 0); g.lineTo(x + 8, 0); g.closePath(); g.fill(); }
  hazardTex = new THREE.CanvasTexture(c); hazardTex.colorSpace = THREE.SRGBColorSpace; hazardTex.wrapS = THREE.RepeatWrapping; hazardTex.repeat.set(3, 1);
  return hazardTex;
}

function Batch({ geo, mat, items, shadow = true }: { geo: THREE.BufferGeometry; mat: THREE.Material; items: { x: number; y: number; z: number; yaw: number }[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D();
    items.forEach((it, i) => { o.position.set(it.x, it.y, it.z); o.rotation.set(0, it.yaw, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={shadow} receiveShadow />;
}
