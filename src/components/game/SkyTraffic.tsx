import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SKY_LANES, vehicleAt } from "@/game/sky-traffic";
import { lampLevel, worldLight } from "@/game/world-light";

/** a hover car about 5 m long: a wedge body with a tapered nose and tail, a glass canopy, two side engine pods (nose along +z) */
function hoverBody(): THREE.BufferGeometry {
  const body = new THREE.BoxGeometry(1.9, 0.7, 5, 2, 1, 4);
  const p = body.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), y = p.getY(i), t = (z + 2.5) / 5;               // 0 tail .. 1 nose
    const taper = 1 - Math.pow(Math.max(0, t - 0.55) / 0.45, 1.4) * 0.6 - Math.pow(Math.max(0, 0.15 - t) / 0.15, 1) * 0.25;
    p.setX(i, p.getX(i) * taper);
    p.setY(i, y > 0 ? y * (1 - Math.max(0, t - 0.6) * 1.2) : y);       // the nose slopes down
  }
  body.computeVertexNormals();
  const canopy = new THREE.SphereGeometry(0.75, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 0.55, 1.6).translate(0, 0.3, 0.1);
  const podL = new THREE.CylinderGeometry(0.32, 0.38, 2.4, 10).rotateX(Math.PI / 2).translate(-1.15, -0.1, -0.9);
  const podR = podL.clone().translate(2.3, 0, 0);
  const g = mergeGeometries([body.toNonIndexed(), canopy.toNonIndexed(), podL.toNonIndexed(), podR.toNonIndexed()])!;
  g.computeVertexNormals();
  return g;
}
/** the lit parts: two headlight bars, the engine exhausts at the pod tails, a tail-light bar */
function lightGeo(kind: "head" | "engine" | "tail"): THREE.BufferGeometry {
  if (kind === "head") return mergeGeometries([new THREE.BoxGeometry(0.5, 0.08, 0.05).translate(-0.45, 0.05, 2.45), new THREE.BoxGeometry(0.5, 0.08, 0.05).translate(0.45, 0.05, 2.45)])!;
  if (kind === "engine") return mergeGeometries([new THREE.CircleGeometry(0.3, 10).rotateY(Math.PI).translate(-1.15, -0.1, -2.12), new THREE.CircleGeometry(0.3, 10).rotateY(Math.PI).translate(1.15, -0.1, -2.12)])!;
  return new THREE.BoxGeometry(1.5, 0.07, 0.05).translate(0, 0.12, -2.52);
}

const TOTAL = SKY_LANES.reduce((n, l) => n + l.count, 0);

/** Flying traffic over Nexus and Neon City (sky-traffic.ts): one instanced draw for the bodies and three for the lights, which are
 * bright enough for the bloom pass to make them glow. Lights burn brighter at night. */
export function SkyTraffic() {
  const geo = useMemo(() => ({ body: hoverBody(), head: lightGeo("head"), engine: lightGeo("engine"), tail: lightGeo("tail") }), []);
  const mats = useMemo(() => ({
    body: new THREE.MeshStandardMaterial({ color: "#2a2f3a", metalness: 0.8, roughness: 0.32 }),
    head: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 3.6), toneMapped: false }),
    engine: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), toneMapped: false, side: THREE.DoubleSide }),
    tail: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.25), toneMapped: false }),
  }), []);
  useEffect(() => () => { Object.values(geo).forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); }, [geo, mats]);
  const refs = { body: useRef<THREE.InstancedMesh>(null), head: useRef<THREE.InstancedMesh>(null), engine: useRef<THREE.InstancedMesh>(null), tail: useRef<THREE.InstancedMesh>(null) };
  // engine glow takes the lane's colour, overdriven so it blooms
  useEffect(() => {
    const m = refs.engine.current; if (!m) return;
    const c = new THREE.Color(); let i = 0;
    for (const l of SKY_LANES) for (let k = 0; k < l.count; k++) m.setColorAt(i++, c.set(l.color).multiplyScalar(3.2));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, lit = 0.35 + 0.65 * lampLevel(worldLight.night);
    mats.head.color.setRGB(4 * lit, 4 * lit, 3.6 * lit); mats.tail.color.setRGB(4 * lit, 0.3 * lit, 0.25 * lit);
    let i = 0;
    for (const l of SKY_LANES) for (let k = 0; k < l.count; k++) {
      const v = vehicleAt(l, k, t);
      o.position.set(v.x, v.y, v.z); o.rotation.set(0, v.yaw, v.bank, "YXZ"); o.updateMatrix();
      for (const r of Object.values(refs)) r.current?.setMatrixAt(i, o.matrix);
      i++;
    }
    for (const r of Object.values(refs)) if (r.current) r.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group name="sky-traffic">
      <instancedMesh ref={refs.body} args={[geo.body, mats.body, TOTAL]} frustumCulled={false} />
      <instancedMesh ref={refs.head} args={[geo.head, mats.head, TOTAL]} frustumCulled={false} />
      <instancedMesh ref={refs.engine} args={[geo.engine, mats.engine, TOTAL]} frustumCulled={false} />
      <instancedMesh ref={refs.tail} args={[geo.tail, mats.tail, TOTAL]} frustumCulled={false} />
    </group>
  );
}
